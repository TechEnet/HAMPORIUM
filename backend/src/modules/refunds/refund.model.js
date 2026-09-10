import mongoose from "mongoose";
import {
  REFUND_STATUS,
  REFUND_STATUS_VALUES,
  REFUND_TYPE,
  REFUND_TYPE_VALUES,
} from "../../constants/statuses.js";

const refundSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: REFUND_TYPE_VALUES,
      default: REFUND_TYPE.FULL,
      index: true,
    },

    status: {
      type: String,
      enum: REFUND_STATUS_VALUES,
      default: REFUND_STATUS.CREATED,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      default: "INR",
      trim: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    provider: {
      type: String,
      default: "razorpay",
      trim: true,
    },

    providerStatus: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    razorpayRefundId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      maxlength: 220,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    initiatedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    errorCode: {
      type: String,
      default: "",
      trim: true,
    },

    errorDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1500,
    },

    receipt: {
      type: String,
      default: "",
      trim: true,
    },

    speedRequested: {
      type: String,
      default: "",
      trim: true,
    },

    speedProcessed: {
      type: String,
      default: "",
      trim: true,
    },

    arn: {
      type: String,
      default: "",
      trim: true,
    },

    webhookEventIds: {
      type: [String],
      default: [],
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

refundSchema.index({ order: 1, createdAt: -1 });
refundSchema.index({ payment: 1, createdAt: -1 });
refundSchema.index({ user: 1, createdAt: -1 });
refundSchema.index({ status: 1, createdAt: -1 });
refundSchema.index({ webhookEventIds: 1 });

const Refund = mongoose.model("Refund", refundSchema);

export default Refund;
