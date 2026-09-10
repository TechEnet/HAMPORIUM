import crypto from "crypto";
import mongoose from "mongoose";
import { COMMISSION_STATUS, COMMISSION_PAYOUT_STATUS } from "../../constants/statuses.js";

const createCommissionId = () => `COM-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const historySchema = new mongoose.Schema({
  status: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  note: { type: String, trim: true, default: "" },
  changedAt: { type: Date, default: Date.now },
}, { _id: false });

const adjustmentSchema = new mongoose.Schema({
  type: { type: String, enum: ["refund", "manual"], required: true },
  amount: { type: Number, default: 0 },
  note: { type: String, trim: true, default: "" },
  at: { type: Date, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { _id: false });

const commissionSchema = new mongoose.Schema({
  commissionId: { type: String, unique: true, index: true, default: createCommissionId },
  idempotencyKey: { type: String, unique: true, sparse: true, index: true, trim: true },
  partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
  referral: { type: mongoose.Schema.Types.ObjectId, ref: "PartnerReferral", default: null, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "PartnerProject", default: null, index: true },
  showcase: { type: mongoose.Schema.Types.ObjectId, ref: "Showcase", default: null },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: undefined },
  attributionSource: { type: String, enum: ["referral", "project", "manual"], default: "manual" },
  basis: { type: String, enum: ["project_value", "order_taxable_value", "order_subtotal", "order_total", "manual"], default: "order_taxable_value" },
  originalEligibleValue: { type: Number, min: 0, required: true },
  eligibleValue: { type: Number, min: 0, required: true },
  currency: { type: String, uppercase: true, default: "INR" },
  rate: { type: Number, min: 0, max: 100, required: true, select: false },
  amount: { type: Number, min: 0, required: true },
  status: { type: String, enum: Object.values(COMMISSION_STATUS), default: COMMISSION_STATUS.ATTRIBUTED, index: true },
  payoutStatus: { type: String, enum: Object.values(COMMISSION_PAYOUT_STATUS), default: COMMISSION_PAYOUT_STATUS.NOT_DUE, index: true },
  payout: {
    reference: { type: String, trim: true, default: "" },
    paidAt: Date,
    note: { type: String, trim: true, default: "" },
  },
  reversal: {
    reason: { type: String, trim: true, default: "" },
    reversedAt: Date,
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  adjustments: { type: [adjustmentSchema], default: [] },
  attributedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

commissionSchema.index({ partner: 1, createdAt: -1 });
commissionSchema.index({ status: 1, payoutStatus: 1 });
commissionSchema.index({ order: 1 }, { unique: true, sparse: true });

const Commission = mongoose.models.Commission || mongoose.model("Commission", commissionSchema);
export default Commission;
