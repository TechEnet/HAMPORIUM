import mongoose from "mongoose";

const auditSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    actorRoles: [{ type: String }],
    action: { type: String, required: true, trim: true, index: true },
    module: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, default: "", trim: true },
    entityId: { type: String, default: "", trim: true, index: true },
    description: { type: String, default: "", trim: true },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

auditSchema.index({ module: 1, createdAt: -1 });
auditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditSchema);

export default AuditLog;