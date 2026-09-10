import mongoose from "mongoose";
import { DOCUMENT_STATUS } from "../../constants/statuses.js";

const { Schema } = mongoose;

const documentStatusHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, trim: true, default: "" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const documentSchema = new Schema(
  {
    documentId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
      default: () =>
        `DOC-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`,
    },

    versionGroup: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      index: true,
      default: () => new mongoose.Types.ObjectId(),
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    entityType: {
      type: String,
      enum: [
        "rfq",
        "quote",
        "approval",
        "order",
        "corporate",
        "wedding",
        "partner",
        "partner_project",
        "partner_payout",
        "other",
      ],
      required: true,
      index: true,
    },

    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    documentType: {
      type: String,
      enum: [
        "requirement",
        "logo",
        "artwork",
        "moodboard",
        "concept",
        "proof",
        "quote",
        "po",
        "invoice",
        "recipient_file",
        "guest_file",
        "sample",
        "kyc",
        "pan",
        "gst",
        "business_registration",
        "agreement",
        "payout_statement",
        "other",
      ],
      default: "other",
      index: true,
    },

    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    version: { type: Number, default: 1, min: 1 },

    fileName: { type: String, trim: true, required: true },
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0, min: 0 },
    storageKey: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },

    isPrivate: { type: Boolean, default: true },

    status: {
      type: String,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.ACTIVE,
      index: true,
    },

    statusHistory: { type: [documentStatusHistorySchema], default: [] },
  },
  { timestamps: true }
);

documentSchema.index({
  entityType: 1,
  entityId: 1,
  documentType: 1,
  version: -1,
});
documentSchema.index({ owner: 1, createdAt: -1 });
documentSchema.index({ versionGroup: 1, version: -1 }, { unique: true });

const Document =
  mongoose.models.Document ||
  mongoose.model("Document", documentSchema);

export default Document;
