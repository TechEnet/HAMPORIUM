import crypto from "crypto";
import mongoose from "mongoose";

const createId = () => `SIN-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const supplierInvoiceSchema = new mongoose.Schema(
  {
    supplierInvoiceId: { type: String, unique: true, index: true, immutable: true, default: createId },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
    invoiceNumber: { type: String, required: true, trim: true, maxlength: 120 },
    invoiceDate: { type: Date, required: true },
    subtotal: { type: Number, min: 0, required: true },
    taxAmount: { type: Number, min: 0, required: true },
    total: { type: Number, min: 0, required: true },
    currency: { type: String, uppercase: true, default: "INR" },
    documentUrl: { type: String, trim: true, default: "", maxlength: 2000 },
    note: { type: String, trim: true, default: "", maxlength: 2000 },
    status: {
      type: String,
      enum: ["submitted", "verified", "disputed", "approved", "paid", "rejected"],
      default: "submitted",
      index: true,
    },
    reviewNote: { type: String, trim: true, default: "", maxlength: 1500 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supplierInvoiceSchema.index({ partner: 1, status: 1, createdAt: -1 });
supplierInvoiceSchema.index({ partner: 1, invoiceNumber: 1 }, { unique: true });

const SupplierInvoice = mongoose.models.SupplierInvoice || mongoose.model("SupplierInvoice", supplierInvoiceSchema);
export default SupplierInvoice;
