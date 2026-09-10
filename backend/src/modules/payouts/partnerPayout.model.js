import crypto from "crypto";
import mongoose from "mongoose";

import { PARTNER_PAYOUT_STATUS } from "../../constants/statuses.js";

const createPayoutId = () =>
  `PYO-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const historySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: { type: String, trim: true, default: "", maxlength: 1000 },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const partnerPayoutSchema = new mongoose.Schema(
  {
    payoutId: {
      type: String,
      unique: true,
      index: true,
      immutable: true,
      default: createPayoutId,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
      index: true,
    },
    commissions: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Commission" }],
      default: [],
    },
    period: {
      from: { type: Date, default: null },
      to: { type: Date, default: null },
    },
    grossAmount: { type: Number, required: true, min: 0 },
    adjustmentAmount: { type: Number, default: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", uppercase: true },
    status: {
      type: String,
      enum: Object.values(PARTNER_PAYOUT_STATUS),
      default: PARTNER_PAYOUT_STATUS.PENDING,
      index: true,
    },
    reference: { type: String, trim: true, default: "", maxlength: 180 },
    paymentMethod: { type: String, trim: true, default: "bank_transfer", maxlength: 80 },
    note: { type: String, trim: true, default: "", maxlength: 1500 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    processedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

partnerPayoutSchema.index({ partner: 1, createdAt: -1 });
partnerPayoutSchema.index({ status: 1, createdAt: -1 });

const PartnerPayout =
  mongoose.models.PartnerPayout ||
  mongoose.model("PartnerPayout", partnerPayoutSchema);

export default PartnerPayout;
