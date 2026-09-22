import crypto from "crypto";
import mongoose from "mongoose";

const createId = () => `PO-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const lineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 500 },
    kind: { type: String, enum: ["component", "container", "material", "service"], required: true },
    component: { type: mongoose.Schema.Types.ObjectId, ref: "Component", default: null },
    container: { type: mongoose.Schema.Types.ObjectId, ref: "Container", default: null },
    quantity: { type: Number, min: 0.001, required: true },
    unit: { type: String, trim: true, default: "pc" },
    unitPrice: { type: Number, min: 0, required: true },
    taxPercent: { type: Number, min: 0, max: 100, default: 0 },
    lineSubtotal: { type: Number, min: 0, required: true },
    lineTax: { type: Number, min: 0, required: true },
    lineTotal: { type: Number, min: 0, required: true },
    receivedQty: { type: Number, min: 0, default: 0 },
    acceptedQty: { type: Number, min: 0, default: 0 },
    rejectedQty: { type: Number, min: 0, default: 0 },
  },
  { _id: true }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    purchaseOrderId: { type: String, unique: true, index: true, immutable: true, default: createId },
    purchaseRequest: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequest", required: true, index: true },
    supplierQuote: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierQuote", required: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    lines: { type: [lineSchema], default: [] },
    subtotal: { type: Number, min: 0, required: true },
    taxAmount: { type: Number, min: 0, required: true },
    total: { type: Number, min: 0, required: true },
    currency: { type: String, uppercase: true, default: "INR" },
    expectedDeliveryDate: { type: Date, default: null },
    deliveryAddress: {
      line1: { type: String, trim: true, default: "" },
      line2: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      pincode: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "India" },
    },
    status: {
      type: String,
      enum: ["issued", "accepted", "in_production", "dispatched", "partially_received", "received", "cancelled", "closed"],
      default: "issued",
      index: true,
    },
    supplierDispatch: {
      dispatchedAt: { type: Date, default: null },
      carrier: { type: String, trim: true, default: "" },
      trackingNumber: { type: String, trim: true, default: "" },
      note: { type: String, trim: true, default: "" },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    acceptedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ partner: 1, status: 1, createdAt: -1 });
purchaseOrderSchema.index({ status: 1, expectedDeliveryDate: 1 });

const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model("PurchaseOrder", purchaseOrderSchema);
export default PurchaseOrder;
