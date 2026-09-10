import mongoose from "mongoose";

import {
  APPROVAL_STATUS,
  APPROVAL_ACTION,
} from "../../constants/statuses.js";


const { Schema } = mongoose;


// ======================================================
// ACTION / COMMENT
// ======================================================

const approvalActivitySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      enum: Object.values(APPROVAL_ACTION),
      required: true,
    },

    comment: {
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

const approvalStatusHistorySchema = new Schema(
  {
    status: {
      type: String,
      required: true,
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
// APPROVAL MODEL
// ======================================================

const approvalSchema = new Schema(
  {
    approvalId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
      default: () =>
        `APR-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 8)
          .toUpperCase()}`,
    },

    rfq: {
      type: Schema.Types.ObjectId,
      ref: "RFQ",
      required: true,
      index: true,
    },

    quote: {
      type: Schema.Types.ObjectId,
      ref: "Quote",
      default: null,
    },

    weddingProject: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "WeddingProject",
  default: null,
},

    quoteVersion: {
      type: Number,
      default: null,
    },

    document: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },

    subjectType: {
      type: String,
      enum: [
        "quote",
        "proof",
        "artwork",
        "sample",
        "specification",
        "wedding_concept",
        "document",
      ],
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      required: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    version: {
      type: Number,
      min: 1,
      default: 1,
    },

    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reviewer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.PENDING,
      index: true,
    },

    activities: {
      type: [approvalActivitySchema],
      default: [],
    },

    decision: {
      action: {
        type: String,
        enum: [
          APPROVAL_ACTION.APPROVE,
          APPROVAL_ACTION.REQUEST_CHANGES,
        ],
        default: undefined,
      },

      comment: {
        type: String,
        trim: true,
        default: "",
      },

      decidedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      decidedAt: {
        type: Date,
        default: null,
      },
    },

    statusHistory: {
      type: [approvalStatusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);


approvalSchema.index({
  reviewer: 1,
  status: 1,
  createdAt: -1,
});


approvalSchema.index({
  rfq: 1,
  subjectType: 1,
  version: -1,
});


const Approval = mongoose.model(
  "Approval",
  approvalSchema
);

export default Approval;