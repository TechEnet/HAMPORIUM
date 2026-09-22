import crypto from "crypto";
import mongoose from "mongoose";

const createId = () => `GRN-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const lineSchema = new mongoose.Schema(
  {
    purchaseOrderLineId: { type: mongoose.Schema.Types.ObjectId, required: true },
    receivedQty: { type: Number, min: 0, required: true },
    acceptedQty: { type: Number, min: 0, required: true },
    rejectedQty: { type: Number, min: 0, required: true },
    qcStatus: { type: String, enum: ["accepted", "partially_accepted", "rejected"], required: true },
    qcNote: { type: String, trim: true, default: "", maxlength: 1500 },
  },
  { _id: true }
);

const goodsReceiptSchema = new mongoose.Schema(
  {
    receiptId: { type: String, unique: true, index: true, immutable: true, default: createId },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    lines: { type: [lineSchema], default: [] },
    receivedAt: { type: Date, default: Date.now },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, trim: true, default: "", maxlength: 2000 },
    status: { type: String, enum: ["posted", "void"], default: "posted", index: true },
  },
  { timestamps: true }
);

const GoodsReceipt = mongoose.models.GoodsReceipt || mongoose.model("GoodsReceipt", goodsReceiptSchema);
export default GoodsReceipt;
