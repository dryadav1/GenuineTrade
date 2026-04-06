import { createNotification } from "../services/notificationService.js";
import { storeChatAttachment } from "../services/chatStorageService.js";
import {
  createConversationMessage,
  getConversationMessagesForActor,
  getRecipientUserId,
  listConversationsForActor,
  markConversationReadForActor,
  resolveConversationForActor
} from "../services/conversationService.js";
import {
  emitToConversation,
  emitToThread,
  emitToUser,
  getOnlineUserIds
} from "../realtime/socketServer.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination } from "../utils/pagination.js";
import {
  serializeConversation,
  serializeMessage,
  serializeMessageThread
} from "../utils/serializers.js";

const canUseMessaging = (user) => ["buyer", "exporter"].includes(user?.role);

const emitConversationUpdate = (conversation, targetUserIds = []) => {
  const onlineUserIds = getOnlineUserIds();
  const participantIds = (targetUserIds.length
    ? targetUserIds
    : conversation.participants || []
  ).map((participantId) => participantId.toString());

  participantIds.forEach((participantId) => {
    const serializedConversation = serializeConversation(
      conversation,
      { _id: participantId },
      { onlineUserIds }
    );

    emitToUser(participantId, "conversation_updated", {
      conversation: serializedConversation
    });
    emitToUser(participantId, "message:thread:update", {
      conversationId: serializedConversation.conversationId,
      threadId: serializedConversation.conversationKey,
      conversation: serializedConversation
    });
  });
};

const notifyConversationParticipants = async ({ actor, conversation, message }) => {
  const serializedMessage = serializeMessage(message, null);

  emitToConversation(conversation._id, "receive_message", serializedMessage);
  emitToThread(conversation.conversationKey, "message:new", serializedMessage);
  emitConversationUpdate(conversation);

  const recipientUserId = getRecipientUserId(conversation, actor._id);
  if (!recipientUserId) {
    return;
  }

  const senderCompanyName =
    actor.role === "buyer"
      ? conversation.buyerId?.companyName
      : conversation.exporterId?.companyName;

  await createNotification({
    recipientId: recipientUserId,
    type: "chat",
    title: "New chat message",
    body:
      message.body?.trim() ||
      `${senderCompanyName || actor.name || actor.email} sent an attachment.`,
    actionUrl: `/chat?conversationId=${encodeURIComponent(conversation._id.toString())}`,
    entityType: "Conversation",
    entityId: conversation._id.toString(),
    metadata: {
      conversationId: conversation._id.toString(),
      threadId: conversation.conversationKey
    }
  });
};

export const getConversations = asyncHandler(async (req, res) => {
  if (!canUseMessaging(req.user)) {
    res.status(403).json({ message: "Messaging is available for buyers and exporters only" });
    return;
  }

  const conversations = await listConversationsForActor(req.user);
  const onlineUserIds = getOnlineUserIds();

  res.json({
    items: conversations.map((conversation) =>
      serializeConversation(conversation, req.user, {
        onlineUserIds
      })
    )
  });
});

export const getThreads = asyncHandler(async (req, res) => {
  if (!canUseMessaging(req.user)) {
    res.status(403).json({ message: "Messaging is available for buyers and exporters only" });
    return;
  }

  const conversations = await listConversationsForActor(req.user);

  res.json({
    items: conversations.map((conversation) =>
      serializeMessageThread(conversation, req.user)
    )
  });
});

export const resolveConversation = asyncHandler(async (req, res) => {
  if (!canUseMessaging(req.user)) {
    res.status(403).json({ message: "Messaging is available for buyers and exporters only" });
    return;
  }

  const conversation = await resolveConversationForActor({
    actor: req.user,
    conversationId: req.body?.conversationId || req.query?.conversationId,
    threadId: req.body?.threadId || req.query?.threadId,
    matchId: req.body?.matchId || req.query?.matchId,
    transactionId: req.body?.transactionId || req.query?.transactionId,
    buyerId: req.body?.buyerId || req.query?.buyerId,
    exporterId: req.body?.exporterId || req.query?.exporterId,
    rfqId: req.body?.rfqId || req.query?.rfqId,
    createIfMissing: true
  });

  res.json({
    conversation: serializeConversation(conversation, req.user, {
      onlineUserIds: getOnlineUserIds()
    })
  });
});

export const getConversationMessages = asyncHandler(async (req, res) => {
  if (!canUseMessaging(req.user)) {
    res.status(403).json({ message: "Messaging is available for buyers and exporters only" });
    return;
  }

  const { page, limit, skip } = parsePagination(req.query);
  const data = await getConversationMessagesForActor({
    actor: req.user,
    conversationId: req.params.conversationId,
    page,
    limit,
    skip
  });

  res.json({
    conversation: serializeConversation(data.conversation, req.user, {
      onlineUserIds: getOnlineUserIds()
    }),
    items: data.items.map((message) => serializeMessage(message, req.user)),
    pagination: data.pagination
  });
});

export const getMessages = asyncHandler(async (req, res) => {
  if (!canUseMessaging(req.user)) {
    res.status(403).json({ message: "Messaging is available for buyers and exporters only" });
    return;
  }

  const resolvedConversation = await resolveConversationForActor({
    actor: req.user,
    conversationId: req.query?.conversationId,
    threadId: req.query?.threadId,
    createIfMissing: false
  });
  const { page, limit, skip } = parsePagination(req.query);
  const data = await getConversationMessagesForActor({
    actor: req.user,
    conversationId: resolvedConversation._id,
    page,
    limit,
    skip
  });

  res.json({
    conversation: serializeConversation(data.conversation, req.user, {
      onlineUserIds: getOnlineUserIds()
    }),
    items: data.items.map((message) => serializeMessage(message, req.user)),
    pagination: data.pagination
  });
});

export const uploadAttachment = asyncHandler(async (req, res) => {
  if (!canUseMessaging(req.user)) {
    res.status(403).json({ message: "Messaging is available for buyers and exporters only" });
    return;
  }

  const conversationId = req.body?.conversationId || "";
  const file = req.body?.file;

  if (!file?.dataUrl || !file?.name || !file?.type) {
    res.status(400).json({ message: "Attachment name, type, and file payload are required" });
    return;
  }

  if (conversationId) {
    await resolveConversationForActor({
      actor: req.user,
      conversationId,
      createIfMissing: false
    });
  }

  const attachment = await storeChatAttachment({
    conversationId,
    userId: req.user._id.toString(),
    fileName: file.name,
    mimeType: file.type,
    fileBase64: file.dataUrl
  });

  res.status(201).json({
    attachment
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  if (!canUseMessaging(req.user)) {
    res.status(403).json({ message: "Messaging is available for buyers and exporters only" });
    return;
  }

  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
  let conversationId = req.body?.conversationId || "";

  if (!conversationId) {
    const conversation = await resolveConversationForActor({
      actor: req.user,
      conversationId: req.body?.conversationId,
      threadId: req.body?.threadId,
      matchId: req.body?.matchId,
      transactionId: req.body?.transactionId,
      buyerId: req.body?.buyerId,
      exporterId: req.body?.exporterId,
      rfqId: req.body?.rfqId,
      createIfMissing: true
    });
    conversationId = conversation._id.toString();
  }

  const { conversation, message } = await createConversationMessage({
    actor: req.user,
    conversationId,
    body: req.body?.body,
    attachments
  });

  await notifyConversationParticipants({
    actor: req.user,
    conversation,
    message
  });

  res.status(201).json({
    conversation: serializeConversation(conversation, req.user, {
      onlineUserIds: getOnlineUserIds()
    }),
    message: serializeMessage(message, req.user)
  });
});

export const markConversationRead = asyncHandler(async (req, res) => {
  if (!canUseMessaging(req.user)) {
    res.status(403).json({ message: "Messaging is available for buyers and exporters only" });
    return;
  }

  const conversation = await markConversationReadForActor({
    actor: req.user,
    conversationId: req.params.conversationId
  });

  emitConversationUpdate(conversation, [req.user._id.toString()]);

  res.json({
    message: "Conversation marked as read",
    conversation: serializeConversation(conversation, req.user, {
      onlineUserIds: getOnlineUserIds()
    })
  });
});

export const markThreadRead = asyncHandler(async (req, res) => {
  if (!canUseMessaging(req.user)) {
    res.status(403).json({ message: "Messaging is available for buyers and exporters only" });
    return;
  }

  const conversation = await resolveConversationForActor({
    actor: req.user,
    threadId: req.params.threadId,
    createIfMissing: false
  });
  const updatedConversation = await markConversationReadForActor({
    actor: req.user,
    conversationId: conversation._id
  });

  emitConversationUpdate(updatedConversation, [req.user._id.toString()]);

  res.json({
    message: "Conversation marked as read"
  });
});
