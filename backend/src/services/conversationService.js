import mongoose from "mongoose";
import Buyer from "../models/Buyer.js";
import Conversation from "../models/Conversation.js";
import Exporter from "../models/Exporter.js";
import Match from "../models/Match.js";
import Message from "../models/Message.js";
import Transaction from "../models/Transaction.js";
import { createHttpError } from "../utils/httpErrors.js";

const userSelectFields = "name email phone role publicId";

let backfillPromise = null;

const toIdString = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
};

const buildParticipantStates = (buyerUserId, exporterUserId, currentStates = []) => {
  const stateByUserId = new Map(
    (currentStates || []).map((state) => [toIdString(state.userId), state])
  );

  return [buyerUserId, exporterUserId]
    .map((userId) => toIdString(userId))
    .filter(Boolean)
    .map((userId) => {
      const existing = stateByUserId.get(userId);
      return {
        userId,
        unreadCount: Number(existing?.unreadCount || 0),
        lastReadAt: existing?.lastReadAt || null
      };
    });
};

const getParticipantState = (conversation, userId) =>
  (conversation.participantStates || []).find(
    (state) => toIdString(state.userId) === toIdString(userId)
  );

const ensureParticipantMetadata = (conversation, buyerUserId, exporterUserId) => {
  const nextParticipants = [buyerUserId, exporterUserId]
    .map((userId) => toIdString(userId))
    .filter(Boolean);
  conversation.participants = nextParticipants;
  conversation.participantStates = buildParticipantStates(
    buyerUserId,
    exporterUserId,
    conversation.participantStates
  );
  return conversation;
};

export const buildConversationKey = ({ buyerId, exporterId, rfqId, transactionId }) => {
  if (transactionId) {
    return `transaction:${transactionId}`;
  }

  if (rfqId) {
    return `rfq:${rfqId}:buyer:${buyerId}:exporter:${exporterId}`;
  }

  return `direct:buyer:${buyerId}:exporter:${exporterId}`;
};

const createMessagePreview = ({ body, attachments = [] }) => {
  const trimmedBody = String(body || "").trim();

  if (trimmedBody) {
    return trimmedBody.slice(0, 160);
  }

  if (!attachments.length) {
    return "";
  }

  const attachment = attachments[0];

  if (attachment.type === "image") {
    return "Sent an image";
  }

  if (attachment.type === "pdf") {
    return `Sent ${attachment.name || "a PDF"}`;
  }

  return `Sent ${attachment.name || "an attachment"}`;
};

const getCurrentBuyer = (userId) =>
  Buyer.findOne({ userId }).populate("userId", userSelectFields);

const getCurrentExporter = (userId) =>
  Exporter.findOne({ userId }).populate("userId", userSelectFields);

const hydrateConversation = (conversationId) =>
  Conversation.findById(conversationId)
    .populate({
      path: "buyerId",
      populate: {
        path: "userId",
        select: userSelectFields
      }
    })
    .populate({
      path: "exporterId",
      populate: {
        path: "userId",
        select: userSelectFields
      }
    })
    .populate("rfqId")
    .populate("transactionId")
    .populate("lastMessageSenderId", userSelectFields);

export const hydrateMessage = (messageId) =>
  Message.findById(messageId)
    .populate("senderId", userSelectFields)
    .populate({
      path: "buyerId",
      populate: {
        path: "userId",
        select: userSelectFields
      }
    })
    .populate({
      path: "exporterId",
      populate: {
        path: "userId",
        select: userSelectFields
      }
    })
    .populate("rfqId")
    .populate("transactionId")
    .populate("conversationId");

const assertChatActorRole = (actor) => {
  if (!["buyer", "exporter"].includes(actor?.role)) {
    throw createHttpError(403, "Messaging is available for buyers and exporters only");
  }
};

export const isConversationParticipant = (conversation, userId) =>
  Boolean(
    conversation &&
      (conversation.participants || []).some(
        (participantId) => toIdString(participantId) === toIdString(userId)
      )
  );

const findConversationByIdentifier = async ({ conversationId, threadId }) => {
  if (conversationId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return null;
    }

    return Conversation.findById(conversationId);
  }

  if (threadId) {
    return Conversation.findOne({ conversationKey: threadId });
  }

  return null;
};

const upsertConversationDocument = async ({
  buyer,
  exporter,
  rfqId = null,
  transactionId = null,
  conversationKey,
  seed = null
}) => {
  const buyerUserId = buyer?.userId?._id || buyer?.userId;
  const exporterUserId = exporter?.userId?._id || exporter?.userId;

  if (!buyer?._id || !exporter?._id || !buyerUserId || !exporterUserId) {
    throw createHttpError(400, "Conversation participants are incomplete");
  }

  let conversation = await Conversation.findOne({
    conversationKey
  });

  if (!conversation) {
    conversation = new Conversation({
      participants: [buyerUserId, exporterUserId],
      buyerId: buyer._id,
      exporterId: exporter._id,
      rfqId: rfqId || null,
      transactionId: transactionId || null,
      conversationKey,
      lastMessage: seed?.lastMessage || "",
      lastMessageAt: seed?.lastMessageAt || null,
      lastMessageSenderId: seed?.lastMessageSenderId || null,
      participantStates: buildParticipantStates(buyerUserId, exporterUserId, seed?.participantStates)
    });

    try {
      await conversation.save();
    } catch (error) {
      if (error?.code === 11000) {
        conversation = await Conversation.findOne({ conversationKey });
      } else {
        throw error;
      }
    }
  }

  conversation.buyerId = buyer._id;
  conversation.exporterId = exporter._id;
  conversation.rfqId = rfqId || null;
  conversation.transactionId = transactionId || null;
  ensureParticipantMetadata(conversation, buyerUserId, exporterUserId);

  if (seed?.lastMessage !== undefined) {
    conversation.lastMessage = seed.lastMessage;
    conversation.lastMessageAt = seed.lastMessageAt || conversation.lastMessageAt;
    conversation.lastMessageSenderId =
      seed.lastMessageSenderId || conversation.lastMessageSenderId;
  }

  await conversation.save();
  return conversation;
};

const loadConversationContextFromTransaction = async ({ actor, transactionId }) => {
  const transaction = await Transaction.findById(transactionId);

  if (!transaction) {
    throw createHttpError(404, "Transaction not found");
  }

  const [buyer, exporter] = await Promise.all([
    Buyer.findById(transaction.buyerId).populate("userId", userSelectFields),
    Exporter.findById(transaction.exporterId).populate("userId", userSelectFields)
  ]);

  if (!buyer || !exporter) {
    throw createHttpError(404, "Conversation participants not found");
  }

  if (
    toIdString(buyer.userId?._id || buyer.userId) !== toIdString(actor._id) &&
    toIdString(exporter.userId?._id || exporter.userId) !== toIdString(actor._id)
  ) {
    throw createHttpError(403, "You do not have access to this conversation");
  }

  return {
    buyer,
    exporter,
    rfqId: transaction.rfqId || null,
    transactionId: transaction._id
  };
};

const loadConversationContextFromMatch = async ({ actor, matchId }) => {
  const match = await Match.findById(matchId);

  if (!match) {
    throw createHttpError(404, "Match not found");
  }

  const [buyer, exporter] = await Promise.all([
    Buyer.findById(match.buyerId).populate("userId", userSelectFields),
    Exporter.findById(match.exporterId).populate("userId", userSelectFields)
  ]);

  if (!buyer || !exporter) {
    throw createHttpError(404, "Conversation participants not found");
  }

  if (
    toIdString(buyer.userId?._id || buyer.userId) !== toIdString(actor._id) &&
    toIdString(exporter.userId?._id || exporter.userId) !== toIdString(actor._id)
  ) {
    throw createHttpError(403, "You do not have access to this conversation");
  }

  return {
    buyer,
    exporter,
    rfqId: match.rfqId || null,
    transactionId: null
  };
};

const loadConversationContextFromLegacyFields = async ({
  actor,
  buyerId,
  exporterId,
  rfqId
}) => {
  const [currentBuyer, currentExporter] = await Promise.all([
    actor.role === "buyer" ? getCurrentBuyer(actor._id) : Promise.resolve(null),
    actor.role === "exporter" ? getCurrentExporter(actor._id) : Promise.resolve(null)
  ]);

  if (actor.role === "buyer" && !currentBuyer) {
    throw createHttpError(404, "Buyer profile not found");
  }

  if (actor.role === "exporter" && !currentExporter) {
    throw createHttpError(404, "Exporter profile not found");
  }

  const resolvedBuyer =
    actor.role === "buyer"
      ? currentBuyer
      : await Buyer.findById(buyerId).populate("userId", userSelectFields);
  const resolvedExporter =
    actor.role === "exporter"
      ? currentExporter
      : await Exporter.findById(exporterId).populate("userId", userSelectFields);

  if (!resolvedBuyer || !resolvedExporter) {
    throw createHttpError(400, "A valid buyer/exporter conversation context is required");
  }

  const match = await Match.findOne({
    buyerId: resolvedBuyer._id,
    exporterId: resolvedExporter._id,
    ...(rfqId ? { rfqId } : {})
  }).sort({ createdAt: -1 });

  if (!match) {
    throw createHttpError(
      403,
      "Chat is only available for buyer-exporter pairs connected by a match, RFQ, or transaction"
    );
  }

  return {
    buyer: resolvedBuyer,
    exporter: resolvedExporter,
    rfqId: rfqId || match.rfqId || null,
    transactionId: null
  };
};

const assertConversationAccess = (conversation, actor) => {
  if (!conversation || !isConversationParticipant(conversation, actor._id)) {
    throw createHttpError(404, "Conversation not found");
  }
};

export const backfillConversationHistory = async () => {
  const threadIds = await Message.distinct("threadId", {
    $or: [{ conversationId: { $exists: false } }, { conversationId: null }]
  });

  for (const threadId of threadIds) {
    const messages = await Message.find({ threadId }).sort({ createdAt: 1 });

    if (!messages.length) {
      continue;
    }

    const firstMessage = messages[0];
    const [buyer, exporter] = await Promise.all([
      Buyer.findById(firstMessage.buyerId).populate("userId", userSelectFields),
      Exporter.findById(firstMessage.exporterId).populate("userId", userSelectFields)
    ]);

    if (!buyer || !exporter) {
      continue;
    }

    const buyerUserId = buyer.userId?._id || buyer.userId;
    const exporterUserId = exporter.userId?._id || exporter.userId;
    const lastMessage = messages[messages.length - 1];

    const participantStates = buildParticipantStates(buyerUserId, exporterUserId).map(
      (state) => {
        const stateUserId = toIdString(state.userId);
        const unreadCount = messages.filter(
          (message) =>
            toIdString(message.senderId) !== stateUserId &&
            !(message.readBy || []).some(
              (readerId) => toIdString(readerId) === stateUserId
            )
        ).length;
        const readTimestamps = messages
          .filter((message) =>
            (message.readBy || []).some(
              (readerId) => toIdString(readerId) === stateUserId
            )
          )
          .map((message) => message.createdAt)
          .sort((left, right) => right.getTime() - left.getTime());

        return {
          ...state,
          unreadCount,
          lastReadAt: readTimestamps[0] || null
        };
      }
    );

    const conversation = await upsertConversationDocument({
      buyer,
      exporter,
      rfqId: firstMessage.rfqId || null,
      transactionId: firstMessage.transactionId || null,
      conversationKey: threadId,
      seed: {
        lastMessage: createMessagePreview({
          body: lastMessage.body,
          attachments: lastMessage.attachments
        }),
        lastMessageAt: lastMessage.createdAt,
        lastMessageSenderId: lastMessage.senderId,
        participantStates
      }
    });

    await Message.updateMany(
      {
        threadId
      },
      {
        $set: {
          conversationId: conversation._id
        }
      }
    );
  }
};

export const ensureConversationBackfill = async () => {
  if (!backfillPromise) {
    backfillPromise = backfillConversationHistory().catch((error) => {
      backfillPromise = null;
      throw error;
    });
  }

  return backfillPromise;
};

export const resolveConversationForActor = async ({
  actor,
  conversationId,
  threadId,
  matchId,
  transactionId,
  buyerId,
  exporterId,
  rfqId,
  createIfMissing = true
}) => {
  assertChatActorRole(actor);
  await ensureConversationBackfill();

  const existingConversation = await findConversationByIdentifier({
    conversationId,
    threadId
  });

  if (existingConversation) {
    assertConversationAccess(existingConversation, actor);
    return hydrateConversation(existingConversation._id);
  }

  if (!createIfMissing) {
    throw createHttpError(404, "Conversation not found");
  }

  if (
    (conversationId || threadId) &&
    !matchId &&
    !transactionId &&
    !buyerId &&
    !exporterId &&
    !rfqId
  ) {
    throw createHttpError(404, "Conversation not found");
  }

  let context;

  if (transactionId) {
    context = await loadConversationContextFromTransaction({ actor, transactionId });
  } else if (matchId) {
    context = await loadConversationContextFromMatch({ actor, matchId });
  } else {
    context = await loadConversationContextFromLegacyFields({
      actor,
      buyerId,
      exporterId,
      rfqId
    });
  }

  const conversationKey =
    threadId ||
    buildConversationKey({
      buyerId: context.buyer._id.toString(),
      exporterId: context.exporter._id.toString(),
      rfqId: context.rfqId ? context.rfqId.toString() : "",
      transactionId: context.transactionId ? context.transactionId.toString() : ""
    });

  const conversation = await upsertConversationDocument({
    buyer: context.buyer,
    exporter: context.exporter,
    rfqId: context.rfqId,
    transactionId: context.transactionId,
    conversationKey
  });

  return hydrateConversation(conversation._id);
};

export const listConversationsForActor = async (actor) => {
  assertChatActorRole(actor);
  await ensureConversationBackfill();

  return Conversation.find({
    participants: actor._id
  })
    .sort({
      lastMessageAt: -1,
      updatedAt: -1
    })
    .populate({
      path: "buyerId",
      populate: {
        path: "userId",
        select: userSelectFields
      }
    })
    .populate({
      path: "exporterId",
      populate: {
        path: "userId",
        select: userSelectFields
      }
    })
    .populate("rfqId")
    .populate("transactionId")
    .populate("lastMessageSenderId", userSelectFields);
};

export const getConversationMessagesForActor = async ({
  actor,
  conversationId,
  page,
  limit,
  skip
}) => {
  assertChatActorRole(actor);
  const conversation = await resolveConversationForActor({
    actor,
    conversationId,
    createIfMissing: false
  });

  const [messages, total] = await Promise.all([
    Message.find({
      conversationId: conversation._id
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("senderId", userSelectFields)
      .populate({
        path: "buyerId",
        populate: {
          path: "userId",
          select: userSelectFields
        }
      })
      .populate({
        path: "exporterId",
        populate: {
          path: "userId",
          select: userSelectFields
        }
      })
      .populate("rfqId")
      .populate("transactionId")
      .populate("conversationId"),
    Message.countDocuments({
      conversationId: conversation._id
    })
  ]);

  return {
    conversation,
    items: messages.reverse(),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
};

export const markConversationReadForActor = async ({ actor, conversationId }) => {
  assertChatActorRole(actor);
  const conversation = await resolveConversationForActor({
    actor,
    conversationId,
    createIfMissing: false
  });
  const now = new Date();

  ensureParticipantMetadata(
    conversation,
    conversation.buyerId?.userId?._id || conversation.buyerId?.userId,
    conversation.exporterId?.userId?._id || conversation.exporterId?.userId
  );

  const state = getParticipantState(conversation, actor._id);
  if (state) {
    state.unreadCount = 0;
    state.lastReadAt = now;
  }

  await conversation.save();

  await Message.updateMany(
    {
      conversationId: conversation._id,
      senderId: {
        $ne: actor._id
      },
      readBy: {
        $ne: actor._id
      }
    },
    {
      $addToSet: {
        readBy: actor._id
      }
    }
  );

  return hydrateConversation(conversation._id);
};

export const createConversationMessage = async ({
  actor,
  conversationId,
  body,
  attachments = []
}) => {
  assertChatActorRole(actor);
  const trimmedBody = String(body || "").trim();

  if (!trimmedBody && !attachments.length) {
    throw createHttpError(400, "Message body or attachment is required");
  }

  const conversation = await resolveConversationForActor({
    actor,
    conversationId,
    createIfMissing: false
  });

  ensureParticipantMetadata(
    conversation,
    conversation.buyerId?.userId?._id || conversation.buyerId?.userId,
    conversation.exporterId?.userId?._id || conversation.exporterId?.userId
  );

  const message = await Message.create({
    conversationId: conversation._id,
    threadId: conversation.conversationKey,
    buyerId: conversation.buyerId._id || conversation.buyerId,
    exporterId: conversation.exporterId._id || conversation.exporterId,
    rfqId: conversation.rfqId?._id || conversation.rfqId || null,
    transactionId: conversation.transactionId?._id || conversation.transactionId || null,
    senderId: actor._id,
    body: trimmedBody,
    attachments,
    readBy: [actor._id]
  });

  const sentAt = message.createdAt || new Date();
  conversation.lastMessage = createMessagePreview({
    body: trimmedBody,
    attachments
  });
  conversation.lastMessageAt = sentAt;
  conversation.lastMessageSenderId = actor._id;

  (conversation.participantStates || []).forEach((state) => {
    if (toIdString(state.userId) === toIdString(actor._id)) {
      state.lastReadAt = sentAt;
      state.unreadCount = 0;
      return;
    }

    state.unreadCount = Number(state.unreadCount || 0) + 1;
  });

  await conversation.save();

  return {
    conversation: await hydrateConversation(conversation._id),
    message: await hydrateMessage(message._id)
  };
};

export const getRecipientUserId = (conversation, senderId) =>
  (conversation.participants || []).find(
    (participantId) => toIdString(participantId) !== toIdString(senderId)
  ) || null;
