import crypto from "crypto";
import mongoose from "mongoose";

import {
  SHOWCASE_STATUS,
  SHOWCASE_CLIENT_ACTION,
} from "../../constants/statuses.js";


const createShowcaseId = () =>
  `SHW-${crypto
    .randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;


const showcaseItemSchema =
  new mongoose.Schema(
    {
      projectItemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },

      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },

      title: {
        type: String,
        trim: true,
        default: "",
      },

      quantity: {
        type: Number,
        min: 1,
        default: 1,
      },

      personalization: {
        type: String,
        trim: true,
        default: "",
      },

      clientPrice: {
        type: Number,
        min: 0,
        required: true,
      },
    },
    {
      _id: true,
    }
  );


const clientActionSchema =
  new mongoose.Schema(
    {
      action: {
        type: String,
        enum: Object.values(
          SHOWCASE_CLIENT_ACTION
        ),
        required: true,
      },

      itemId: {
        type: mongoose.Schema.Types.ObjectId,
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
    {
      _id: true,
    }
  );


const showcaseSchema =
  new mongoose.Schema(
    {
      showcaseId: {
        type: String,
        unique: true,
        index: true,
        default: createShowcaseId,
      },

      partner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Partner",
        required: true,
        index: true,
      },

      project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PartnerProject",
        required: true,
        unique: true,
        index: true,
      },

      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
      },

      introduction: {
        type: String,
        trim: true,
        default: "",
      },

      client: {
        name: {
          type: String,
          trim: true,
          required: true,
        },

        email: {
          type: String,
          trim: true,
          lowercase: true,
          required: true,
        },
      },

      items: {
        type: [showcaseItemSchema],
        default: [],
      },

      status: {
        type: String,
        enum: Object.values(
          SHOWCASE_STATUS
        ),
        default:
          SHOWCASE_STATUS.DRAFT,
        index: true,
      },

      expiresAt: {
        type: Date,
        default: null,
        index: true,
      },

      access: {
        tokenHash: {
          type: String,
          default: null,
          select: false,
        },

        publishedAt: Date,

        revokedAt: Date,

        sessionVersion: {
          type: Number,
          default: 0,
        },

        otpHash: {
          type: String,
          default: null,
          select: false,
        },

        otpExpiresAt: {
          type: Date,
          default: null,
          select: false,
        },

        otpAttempts: {
          type: Number,
          default: 0,
          select: false,
        },

        otpLastSentAt: {
          type: Date,
          default: null,
          select: false,
        },

        otpWindowStartedAt: {
          type: Date,
          default: null,
          select: false,
        },

        otpSendCount: {
          type: Number,
          default: 0,
          select: false,
        },

        lastAccessAt: Date,

        accessCount: {
          type: Number,
          default: 0,
        },
      },

      clientActions: {
        type: [clientActionSchema],
        default: [],
      },
    },
    {
      timestamps: true,
    }
  );


showcaseSchema.index({
  partner: 1,
  createdAt: -1,
});


const Showcase =
  mongoose.models.Showcase ||
  mongoose.model(
    "Showcase",
    showcaseSchema
  );


export default Showcase;