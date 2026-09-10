import AuditLog from "../modules/audit/audit.model.js";

const createAuditLog = async (payload = {}) => {
  try {
    const {
      req = null,
      actor = null,
      actorRoles = [],
      action,
      module,
      entityType = "",
      entityId = "",
      description = "",
      changes = {},
      metadata = {},
    } = payload;

    if (!action || !module) return null;

    return await AuditLog.create({
      actor: actor || req?.user?._id || null,
      actorRoles: actorRoles.length ? actorRoles : req?.user?.roles || [],
      action,
      module,
      entityType,
      entityId: entityId ? String(entityId) : "",
      description,
      changes,
      metadata,
      ip: req?.ip || req?.socket?.remoteAddress || "",
      userAgent: req?.headers?.["user-agent"] || "",
    });
  } catch (error) {
    console.error("Audit log error:", error.message);
    return null;
  }
};

export default createAuditLog;