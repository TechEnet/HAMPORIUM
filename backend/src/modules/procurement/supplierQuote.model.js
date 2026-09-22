import crypto from "crypto";
import mongoose from "mongoose";

const createId = () => `SQT-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const lineSchema = new mongoose.Schema(
  {
    requestLineId: { type: mongoose.Schema.Types.ObjectId, required: true },
    quantity: { type: Number, min: 0.001, required: true },
    unit: { type: String, trim: true, default: "pc", maxlength: 30 },
    unitPrice: { type: Number, min: 0, required: true },
    taxPercent: { type: Number, min: 0, max: 100, default: 0 },
    leadTimeDays: { type: Number, min: 0, default: 0 },
    lineSubtotal: { type: Number, min: 0, required: true },
    lineTax: { type: Number, min: 0, required: true },
    lineTotal: { type: Number, min: 0, required: true },
    note: { type: String, trim: true, default: "", maxlength: 1000 },
  },
  { _id: true }
);

const supplierQuoteSchema = new mongoose.Schema(
  {
    quoteId: { type: String, unique: true, index: true, immutable: true, default: createId },
    purchaseRequest: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequest", required: true, index: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    lines: { type: [lineSchema], default: [] },
    subtotal: { type: Number, min: 0, required: true },
    taxAmount: { type: Number, min: 0, required: true },
    total: { type: Number, min: 0, required: true },
    currency: { type: String, uppercase: true, default: "INR" },
    validUntil: { type: Date, default: null },
    paymentTerms: { type: String, trim: true, default: "", maxlength: 1000 },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },
    status: {
      type: String,
      enum: ["draft", "submitted", "accepted", "rejected", "withdrawn"],
      default: "submitted",
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

supplierQuoteSchema.index({ purchaseRequest: 1, partner: 1 }, { unique: true });
supplierQuoteSchema.index({ partner: 1, status: 1, createdAt: -1 });

const SupplierQuote = mongoose.models.SupplierQuote || mongoose.model("SupplierQuote", supplierQuoteSchema);
export default SupplierQuote;
