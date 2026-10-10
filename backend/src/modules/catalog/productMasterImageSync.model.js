
import mongoose from "mongoose";

// Stores a resumable image-only sync, NOT a duplicate product catalogue.
const imageSyncEntry = new mongoose.Schema(
  {
    externalSku: { type: String, required: true, trim: true },
    name: { type: String, default: "" },
    imageUrl: { type: String, required: true },
    sourceSheetName: { type: String, default: "" },
    rowNumber: { type: Number, default: null },
  },
  { _id: false }
);

const imageSyncResult = new mongoose.Schema(
  {
    sku: { type: String, default: "" },
    name: { type: String, default: "" },
    status: {
      type: String,
      enum: ["updated", "unchanged", "failed", "not_found"],
      required: true,
    },
    count: { type: Number, default: 0 },
    message: { type: String, default: "" },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    entries: { type: [imageSyncEntry], default: [] },
    results: { type: [imageSyncResult], default: [] },
    cursor: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["ready", "running", "done"],
      default: "ready",
    },
    startedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

jobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ProductMasterImageSyncJob =
  mongoose.models.ProductMasterImageSyncJob ||
  mongoose.model("ProductMasterImageSyncJob", jobSchema);

const assetSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, unique: true },
    fingerprint: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { timestamps: true }
);

export const ProductMasterDriveAsset =
  mongoose.models.ProductMasterDriveAsset ||
  mongoose.model("ProductMasterDriveAsset", assetSchema);
