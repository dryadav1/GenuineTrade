import express from "express";
import {
  getConversationMessages,
  getConversations,
  getMessages,
  getThreads,
  markConversationRead,
  markThreadRead,
  resolveConversation,
  uploadAttachment,
  sendMessage
} from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/conversations", getConversations);
router.post("/conversations/resolve", resolveConversation);
router.get("/conversations/:conversationId/messages", getConversationMessages);
router.patch("/conversations/:conversationId/read", markConversationRead);
router.post("/attachments", uploadAttachment);
router.get("/threads", getThreads);
router.get("/", getMessages);
router.post("/", sendMessage);
router.patch("/threads/:threadId/read", markThreadRead);

export default router;
