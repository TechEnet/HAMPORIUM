import crypto from "crypto";
import mongoose from "mongoose";

const createId = () => `SPY-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const supplierPaymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, unique: true, index: true, immutable: true, default: createId },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierInvoice", required: true, unique: true, index: true },
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, uppercase: true, default: "INR" },
    method: { type: String, trim: true, default: "bank_transfer", maxlength: 80 },
    reference: { type: String, trim: true, default: "", maxlength: 180 },
    status: { type: String, enum: ["pending", "processing", "paid", "failed", "cancelled"], default: "pending", index: true },
    note: { type: String, trim: true, default: "", maxlength: 1500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    processedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supplierPaymentSchema.index({ partner: 1, status: 1, createdAt: -1 });

const SupplierPayment = mongoose.models.SupplierPayment || mongoose.model("SupplierPayment", supplierPaymentSchema);
export default SupplierPayment;
