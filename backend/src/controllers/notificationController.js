import Notification from "../models/Notification.js";
import {
  getNotificationSettings,
  pushNotificationCount,
  sendOtpCode,
  updateNotificationSettings,
  verifyOtpCode
} from "../services/notificationService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createPaginationMeta, parsePagination } from "../utils/pagination.js";
import { serializeNotification } from "../utils/serializers.js";

export const getMyNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filters = {
    recipientId: req.user._id
  };

  if (req.query.status) {
    filters.status = req.query.status;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filters),
    Notification.countDocuments({
      recipientId: req.user._id,
      status: "unread"
    })
  ]);

  res.json({
    items: notifications.map(serializeNotification),
    unreadCount,
    pagination: createPaginationMeta({ page, limit, total })
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.notificationId,
    recipientId: req.user._id
  });

  if (!notification) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }

  notification.status = "read";
  notification.readAt = new Date();
  await notification.save();

  const unreadCount = await pushNotificationCount(req.user._id);

  res.json({
    notification: serializeNotification(notification),
    unreadCount
  });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    {
      recipientId: req.user._id,
      status: "unread"
    },
    {
      $set: {
        status: "read",
        readAt: new Date()
      }
    }
  );

  const unreadCount = await pushNotificationCount(req.user._id);

  res.json({
    message: "Notifications marked as read",
    unreadCount
  });
});

export const getMyNotificationSettings = asyncHandler(async (req, res) => {
  res.json({
    settings: await getNotificationSettings(req.user)
  });
});

export const updateMyNotificationSettings = asyncHandler(async (req, res) => {
  const settings = await updateNotificationSettings(req.user, req.body || {});

  res.json({
    message: "Notification settings updated",
    settings
  });
});

export const sendMyOtpCode = asyncHandler(async (req, res) => {
  const result = await sendOtpCode({
    user: req.user,
    purpose: req.body?.purpose || "phone_verification"
  });

  res.status(201).json({
    message: "Verification code sent",
    ...result
  });
});

export const verifyMyOtpCode = asyncHandler(async (req, res) => {
  const verified = await verifyOtpCode({
    user: req.user,
    code: req.body?.code,
    purpose: req.body?.purpose || "phone_verification"
  });

  if (!verified) {
    res.status(400).json({ message: "Invalid or expired verification code" });
    return;
  }

  res.json({
    message: "Phone verified successfully",
    phoneVerified: true
  });
});
