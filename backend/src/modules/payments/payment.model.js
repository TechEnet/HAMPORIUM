import mongoose from "mongoose";

import {
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
} from "../../constants/statuses.js";

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sourceType: {
      type: String,
      enum: ["order", "quote"],
      default: "order",
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,

      required() {
        return (
          this.sourceType ===
          "order"
        );
      },
    },

    quote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
      default: null,
      index: true,

      required() {
        return (
          this.sourceType ===
          "quote"
        );
      },
    },

    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
      default: null,
      index: true,
    },

    provider: {
      type: String,
      default: "razorpay",
    },

    status: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PAYMENT_STATUS.CREATED,
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
      min: 0,
    },

    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundedAmountPaise: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastRefundAt: {
      type: Date,
      default: null,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    receipt: {
      type: String,
      required: true,
      trim: true,
    },

    /*
     * Razorpay order ID exists immediately when
     * a payment attempt is created.
     */
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    /*
     * IMPORTANT:
     *
     * Razorpay payment ID DOES NOT exist when
     * the Razorpay order is initially created.
     *
     * Do NOT use:
     *
     * default: null
     *
     * with a unique index.
     *
     * Leaving it undefined means MongoDB does
     * not store the field until a real payment
     * ID exists.
     */
    razorpayPaymentId: {
      type: String,
      default: undefined,
      trim: true,
    },

    razorpaySignature: {
      type: String,
      default: "",
      select: false,
    },

    method: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    contact: {
      type: String,
      default: "",
      trim: true,
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
    },

    paidAt: {
      type: Date,
      default: null,
    },

    webhookEventIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/* =====================================================
   INDEXES
===================================================== */

paymentSchema.index({
  webhookEventIds: 1,
});

paymentSchema.index({
  order: 1,
  createdAt: -1,
});

paymentSchema.index({
  quote: 1,
  createdAt: -1,
});

paymentSchema.index({
  sourceType: 1,
  status: 1,
  createdAt: -1,
});

paymentSchema.index({
  status: 1,
  lastRefundAt: -1,
});

/*
 * Unique ONLY when razorpayPaymentId is actually
 * a string.
 *
 * Multiple payment records without a payment ID
 * are therefore completely valid.
 */
paymentSchema.index(
  {
    razorpayPaymentId: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      razorpayPaymentId: {
        $type: "string",
      },
    },
  }
);

const Payment =
  mongoose.models.Payment ||
  mongoose.model(
    "Payment",
    paymentSchema
  );

export default Payment;