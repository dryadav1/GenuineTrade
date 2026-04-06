import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";
import {
  createConversationMessage,
  getRecipientUserId,
  resolveConversationForActor
} from "../services/conversationService.js";
import { cacheService } from "../services/cacheService.js";
import { serializeConversation, serializeMessage } from "../utils/serializers.js";

let ioInstance = null;

const connectedUserState = new Map();

const getAllowedOrigins = () => process.env.CLIENT_URL?.split(",") || "*";

const getConversationRoomName = (conversationId) => `conversation:${conversationId}`;
const getThreadRoomName = (threadId) => `thread:${threadId}`;

const buildPresenceSnapshot = () => {
  const byRole = {
    admin: 0,
    buyer: 0,
    exporter: 0
  };

  connectedUserState.forEach((entry) => {
    if (byRole[entry.role] !== undefined) {
      byRole[entry.role] += entry.count;
    }
  });

  return {
    totalActiveUsers: Array.from(connectedUserState.values()).reduce(
      (sum, entry) => sum + entry.count,
      0
    ),
    uniqueActiveUsers: connectedUserState.size,
    byRole
  };
};

const publishPresenceSnapshot = async () => {
  const snapshot = buildPresenceSnapshot();
  await cacheService.set("presence:snapshot", snapshot, 60);

  if (ioInstance) {
    ioInstance.to("role:admin").emit("presence:update", snapshot);
  }

  return snapshot;
};

const resolveTokenFromSocket = (socket) => {
  const authToken = socket.handshake.auth?.token;

  if (authToken) {
    return authToken;
  }

  const authHeader = socket.handshake.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "");
  }

  return "";
};

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

const notifyRecipientOfChatMessage = async ({ actor, conversation, message }) => {
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

const broadcastPresenceUpdate = async (userId, isOnline) => {
  const conversations = await Conversation.find({
    participants: userId
  }).select("participants");

  const targets = new Set();

  conversations.forEach((conversation) => {
    (conversation.participants || []).forEach((participantId) => {
      targets.add(participantId.toString());
    });
  });

  targets.forEach((targetUserId) => {
    emitToUser(targetUserId, "presence:update", {
      userId,
      isOnline
    });
  });
};

const joinConversationRooms = (socket, conversation) => {
  socket.join(getConversationRoomName(conversation._id.toString()));

  if (conversation.conversationKey) {
    socket.join(getThreadRoomName(conversation.conversationKey));
  }
};

export const initializeSocketServer = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true
    }
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = resolveTokenFromSocket(socket);

      if (!token) {
        next(new Error("Authentication required"));
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        next(new Error("User not found"));
        return;
      }

      if (user.accountStatus !== "active") {
        next(new Error("User is not allowed to connect"));
        return;
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Invalid socket token"));
    }
  });

  ioInstance.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    const currentState = connectedUserState.get(userId) || {
      role: socket.user.role,
      count: 0
    };

    currentState.count += 1;
    connectedUserState.set(userId, currentState);

    socket.join(`user:${userId}`);
    socket.join(`role:${socket.user.role}`);
    socket.emit("socket:ready", {
      userId,
      role: socket.user.role
    });

    await publishPresenceSnapshot();
    await broadcastPresenceUpdate(userId, true);

    const joinConversation = async (payload = {}, ack) => {
      try {
        const conversation = await resolveConversationForActor({
          actor: socket.user,
          conversationId: payload.conversationId,
          threadId: payload.threadId,
          createIfMissing: false
        });

        joinConversationRooms(socket, conversation);
        ack?.({
          ok: true,
          conversationId: conversation._id.toString(),
          threadId: conversation.conversationKey
        });
      } catch (error) {
        ack?.({
          ok: false,
          message: error.message || "Unable to join conversation"
        });
      }
    };

    socket.on("join_room", joinConversation);
    socket.on("chat:join", ({ threadId, conversationId } = {}, ack) =>
      joinConversation({ threadId, conversationId }, ack)
    );

    socket.on("send_message", async (payload = {}, ack) => {
      try {
        const { conversation, message } = await createConversationMessage({
          actor: socket.user,
          conversationId: payload.conversationId,
          body: payload.body,
          attachments: Array.isArray(payload.attachments) ? payload.attachments : []
        });

        joinConversationRooms(socket, conversation);

        const serializedRealtimeMessage = serializeMessage(message, null);
        emitToConversation(conversation._id, "receive_message", serializedRealtimeMessage);
        emitToThread(conversation.conversationKey, "message:new", serializedRealtimeMessage);
        emitConversationUpdate(conversation);
        await notifyRecipientOfChatMessage({
          actor: socket.user,
          conversation,
          message
        });

        ack?.({
          ok: true,
          conversation: serializeConversation(conversation, socket.user, {
            onlineUserIds: getOnlineUserIds()
          }),
          message: serializeMessage(message, socket.user)
        });
      } catch (error) {
        ack?.({
          ok: false,
          message: error.message || "Unable to send message"
        });
      }
    });

    socket.on("disconnect", async () => {
      const state = connectedUserState.get(userId);

      if (!state) {
        return;
      }

      state.count -= 1;

      if (state.count <= 0) {
        connectedUserState.delete(userId);
      } else {
        connectedUserState.set(userId, state);
      }

      await publishPresenceSnapshot();
      await broadcastPresenceUpdate(userId, isUserOnline(userId));
    });
  });

  return ioInstance;
};

export const getSocketServer = () => ioInstance;

export const emitToUser = (userId, eventName, payload) => {
  if (ioInstance && userId) {
    ioInstance.to(`user:${userId}`).emit(eventName, payload);
  }
};

export const emitToAdmins = (eventName, payload) => {
  if (ioInstance) {
    ioInstance.to("role:admin").emit(eventName, payload);
  }
};

export const emitToConversation = (conversationId, eventName, payload) => {
  if (ioInstance && conversationId) {
    ioInstance.to(getConversationRoomName(conversationId.toString())).emit(eventName, payload);
  }
};

export const emitToThread = (threadId, eventName, payload) => {
  if (ioInstance && threadId) {
    ioInstance.to(getThreadRoomName(threadId)).emit(eventName, payload);
  }
};

export const isUserOnline = (userId) => connectedUserState.has(userId?.toString());

export const getOnlineUserIds = () =>
  new Set(Array.from(connectedUserState.keys()).map((userId) => userId.toString()));

export const getPresenceSnapshot = async () => {
  const cachedSnapshot = await cacheService.get("presence:snapshot");
  return cachedSnapshot || buildPresenceSnapshot();
};
