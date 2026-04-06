import AuditLog from "../models/AuditLog.js";
import { emitToAdmins } from "../realtime/socketServer.js";
import { serializeActivityLog } from "../utils/serializers.js";
import { notifyAdmins } from "./notificationService.js";

export const createAuditLog = async ({
  actorId = null,
  actorRole = "system",
  action,
  entityType,
  entityId,
  metadata = {},
  notification = null
}) => {
  const auditLog = await AuditLog.create({
    actorId,
    actorRole,
    action,
    entityType,
    entityId,
    metadata
  });

  const activityPayload = serializeActivityLog(auditLog);
  emitToAdmins("admin.activity", activityPayload);

  if (notification?.title && notification?.body) {
    await notifyAdmins({
      type: notification.type || "system",
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl || "",
      entityType,
      entityId,
      metadata
    });
  }

  return auditLog;
};
