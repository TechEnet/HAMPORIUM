import mongoose from "mongoose";

import {
  QUOTE_STATUS,
  QUOTE_VERSION_STATUS,
} from "../../constants/statuses.js";

const { Schema } = mongoose;

// ======================================================
// LINE ITEM
// ======================================================

const quoteLineItemSchema = new Schema(
  {
    productReference: {
      type: String,
      trim: true,
      default: "",
    },

    name: {
      type: String,
      trim: true,
      required: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    image: {
      type: String,
      trim: true,
      default: "",
    },

    quantity: {
      type: Number,
      min: 1,
      required: true,
    },

    unitPrice: {
      type: Number,
      min: 0,
      required: true,
    },

    personalization: {
      type: String,
      trim: true,
      default: "",
    },

    packaging: {
      type: String,
      trim: true,
      default: "",
    },

    moq: {
      type: Number,
      min: 0,
      default: 0,
    },

    stockStatus: {
      type: String,
      trim: true,
      default: "",
    },

    lineTotal: {
      type: Number,
      min: 0,
      required: true,
    },
  },
  { _id: true }
);

// ======================================================
// CHANGE REQUEST
// ======================================================

const quoteChangeRequestSchema = new Schema(
  {
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    comment: {
      type: String,
      trim: true,
      required: true,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ======================================================
// QUOTE VERSION
// ======================================================

const quoteVersionSchema = new Schema(
  {
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    lineItems: {
      type: [quoteLineItemSchema],
      default: [],
    },

    subtotal: {
      type: Number,
      min: 0,
      default: 0,
    },

    discount: {
      type: Number,
      min: 0,
      default: 0,
    },

    freight: {
      type: Number,
      min: 0,
      default: 0,
    },

    taxRate: {
      type: Number,
      min: 0,
      default: 0,
    },

    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    total: {
      type: Number,
      min: 0,
      default: 0,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "INR",
    },

    leadTimeDays: {
      type: Number,
      min: 0,
      default: 0,
    },

    paymentTerms: {
      type: String,
      trim: true,
      default: "",
    },

    validUntil: {
      type: Date,
      default: null,
    },

    assumptions: {
      type: [String],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: Object.values(QUOTE_VERSION_STATUS),
      default: QUOTE_VERSION_STATUS.DRAFT,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    changeRequest: {
      type: quoteChangeRequestSchema,
      default: null,
    },
  },
  { _id: true }
);

// ======================================================
// QUOTE COMMUNICATION
// ======================================================

const quoteCommunicationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      enum: ["comment", "ask_for_call"],
      required: true,
    },

    message: {
      type: String,
      trim: true,
      default: "",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ======================================================
// STATUS HISTORY
// ======================================================

const quoteStatusHistorySchema = new Schema(
  {
    status: {
      type: String,
      required: true,
    },

    versionNumber: {
      type: Number,
      default: null,
    },

    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ======================================================
// QUOTE MODEL
// ======================================================

const quoteSchema = new Schema(
  {
    quoteId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
      default: () =>
        `QUO-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 8)
          .toUpperCase()}`,
    },

    rfq: {
      type: Schema.Types.ObjectId,
      ref: "RFQ",
      required: true,
      unique: true,
      index: true,
    },

    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    versions: {
      type: [quoteVersionSchema],
      default: [],
    },

    currentVersionNumber: {
      type: Number,
      min: 0,
      default: 0,
    },

    acceptedVersionNumber: {
      type: Number,
      default: null,
    },

    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    communications: {
      type: [quoteCommunicationSchema],
      default: [],
    },

    status: {
      type: String,
      enum: Object.values(QUOTE_STATUS),
      default: QUOTE_STATUS.DRAFT,
      index: true,
    },

    statusHistory: {
      type: [quoteStatusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

quoteSchema.index({ customer: 1, createdAt: -1 });
quoteSchema.index({ status: 1, createdAt: -1 });
quoteSchema.index({ order: 1 }, { sparse: true });

const Quote = mongoose.model("Quote", quoteSchema);

export default Quote;
