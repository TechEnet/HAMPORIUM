import crypto from "crypto";
import mongoose from "mongoose";

const createId = () => `PRQ-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const lineSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["component", "container", "material", "service"], required: true },
    component: { type: mongoose.Schema.Types.ObjectId, ref: "Component", default: null },
    container: { type: mongoose.Schema.Types.ObjectId, ref: "Container", default: null },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, min: 0.001, required: true },
    unit: { type: String, trim: true, default: "pc", maxlength: 30 },
    targetUnitPrice: { type: Number, min: 0, default: null },
    requiredBy: { type: Date, default: null },
    specification: { type: String, trim: true, default: "", maxlength: 2000 },
  },
  { _id: true }
);

const purchaseRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, unique: true, index: true, immutable: true, default: createId },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    lines: { type: [lineSchema], default: [] },
    invitedSuppliers: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Partner" }], default: [] },
    status: {
      type: String,
      enum: ["draft", "open", "quoted", "awarded", "cancelled", "closed"],
      default: "draft",
      index: true,
    },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
    notes: { type: String, trim: true, default: "", maxlength: 3000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    openedAt: { type: Date, default: null },
    awardedAt: { type: Date, default: null },
    awardedSupplier: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", default: null },
    awardedQuote: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierQuote", default: null },
  },
  { timestamps: true }
);

purchaseRequestSchema.index({ status: 1, priority: 1, createdAt: -1 });
purchaseRequestSchema.index({ invitedSuppliers: 1, status: 1 });

const PurchaseRequest = mongoose.models.PurchaseRequest || mongoose.model("PurchaseRequest", purchaseRequestSchema);
export default PurchaseRequest;
