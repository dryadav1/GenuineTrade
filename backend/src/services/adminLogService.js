import AdminLog from "../models/AdminLog.js";
import { emitToAdmins } from "../realtime/socketServer.js";

export const serializeAdminLog = (log) => ({
  id: log._id,
  actorId: log.actorId?._id || log.actorId,
  actorEmail: log.actorEmail,
  actorAccessLevel: log.actorAccessLevel,
  action: log.action,
  targetType: log.targetType,
  targetId: log.targetId,
  summary: log.summary,
  metadata: log.metadata || {},
  createdAt: log.createdAt
});

export const createAdminLog = async ({
  actor,
  action,
  targetType,
  targetId,
  summary,
  metadata = {}
}) => {
  if (!actor?._id) {
    return null;
  }

  const log = await AdminLog.create({
    actorId: actor._id,
    actorEmail: actor.email || "",
    actorAccessLevel: actor.adminAccessLevel || "sub_admin",
    action,
    targetType,
    targetId,
    summary,
    metadata
  });

  emitToAdmins("admin.log", serializeAdminLog(log));

  return log;
};
