import AuditLog from "./audit.model.js";

export const getAuditLogs = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const { module, action, entityType, entityId, search } = req.query;
  const filter = {};

  if (module) filter.module = module;
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = String(entityId);

  if (search) {
    filter.$or = [
      { action: { $regex: search, $options: "i" } },
      { module: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { entityId: { $regex: search, $options: "i" } },
    ];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

export const getAuditLogById = async (req, res) => {
  const log = await AuditLog.findById(req.params.id).lean();

  if (!log) {
    return res.status(404).json({ message: "Audit log not found." });
  }

  res.json({ log });
};