import crypto from "crypto";
import mongoose from "mongoose";

const createId = () => `SOF-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const supplierOfferSchema = new mongoose.Schema(
  {
    offerId: { type: String, unique: true, index: true, immutable: true, default: createId },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    kind: {
      type: String,
      enum: ["component", "container", "material", "service"],
      required: true,
      index: true,
    },
    component: { type: mongoose.Schema.Types.ObjectId, ref: "Component", default: null, index: true },
    container: { type: mongoose.Schema.Types.ObjectId, ref: "Container", default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    category: { type: String, trim: true, default: "", maxlength: 120, index: true },
    supplierSku: { type: String, trim: true, default: "", maxlength: 120 },
    unit: { type: String, trim: true, default: "pc", maxlength: 30 },
    unitPrice: { type: Number, min: 0, required: true },
    taxPercent: { type: Number, min: 0, max: 100, default: 0 },
    moq: { type: Number, min: 1, default: 1 },
    leadTimeDays: { type: Number, min: 0, default: 0 },
    monthlyCapacity: { type: Number, min: 0, default: 0 },
    serviceArea: { type: [String], default: [] },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected", "suspended"],
      default: "draft",
      index: true,
    },
    reviewNote: { type: String, trim: true, default: "", maxlength: 1200 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supplierOfferSchema.index({ partner: 1, status: 1, createdAt: -1 });
supplierOfferSchema.index({ kind: 1, status: 1, category: 1 });

const SupplierOffer = mongoose.models.SupplierOffer || mongoose.model("SupplierOffer", supplierOfferSchema);
export default SupplierOffer;
