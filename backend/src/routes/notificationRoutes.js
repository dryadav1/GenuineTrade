import express from "express";
import {
  getMyNotificationSettings,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  sendMyOtpCode,
  updateMyNotificationSettings,
  verifyMyOtpCode
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", getMyNotifications);
router.get("/settings", getMyNotificationSettings);
router.patch("/settings", updateMyNotificationSettings);
router.post("/otp/send", sendMyOtpCode);
router.post("/otp/verify", verifyMyOtpCode);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:notificationId/read", markNotificationRead);

export default router;
