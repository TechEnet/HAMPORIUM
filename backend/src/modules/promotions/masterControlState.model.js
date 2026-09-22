import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["archive", "restore", "update", "delete_attempt"],
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: { type: String, trim: true, default: "", maxlength: 800 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const masterControlStateSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["product", "sku", "component", "container"],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    restoredAt: { type: Date, default: null },
    restoredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reason: { type: String, trim: true, default: "", maxlength: 800 },
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

masterControlStateSchema.index(
  { entityType: 1, entityId: 1 },
  { unique: true }
);
masterControlStateSchema.index({ entityType: 1, archived: 1, updatedAt: -1 });

const MasterControlState =
  mongoose.models.MasterControlState ||
  mongoose.model("MasterControlState", masterControlStateSchema);

export default MasterControlState;
