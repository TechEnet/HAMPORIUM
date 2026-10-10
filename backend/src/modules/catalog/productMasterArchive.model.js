// backend/src/modules/catalog/productMasterArchive.model.js
import mongoose from "mongoose";

// Keeps the ORIGINAL Excel fields for every imported Product Master row,
// including invalid or incomplete ones that cannot fit production schemas yet.
// Archive is admin-only and is never served by public catalogue endpoints.
const productMasterArchiveSchema = new mongoose.Schema(
  {
    rowKey: { type: String, required: true, unique: true },
    sourceSheetName: { type: String, default: "" },
    rowNumber: { type: Number, required: true },
    externalSku: { type: String, default: "", index: true },
    name: { type: String, default: "" },
    recordType: { type: String, default: "" },
    sourceFilename: { type: String, default: "" },
    rawExcelData: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["imported", "needs_attention", "import_error"],
      default: "needs_attention",
    },
    reasons: { type: [String], default: [] },
    catalogModel: { type: String, default: "" },
    catalogId: { type: mongoose.Schema.Types.ObjectId, default: null },
    lastImportedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.ProductMasterArchive ||
  mongoose.model("ProductMasterArchive", productMasterArchiveSchema);
