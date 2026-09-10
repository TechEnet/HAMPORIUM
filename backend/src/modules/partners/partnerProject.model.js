import crypto from "crypto";
import mongoose from "mongoose";

import {
  PARTNER_PROJECT_STATUS,
} from "../../constants/statuses.js";


const createProjectId = () =>
  `PPJ-${crypto
    .randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;


const projectItemSchema =
  new mongoose.Schema(
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },

      requestedTitle: {
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

      partnerNote: {
        type: String,
        trim: true,
        default: "",
      },

      validationStatus: {
        type: String,
        enum: [
          "requested",
          "approved",
          "rejected",
        ],
        default: "requested",
      },

      clientPrice: {
        type: Number,
        min: 0,
        default: 0,
      },

      validationNote: {
        type: String,
        trim: true,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );


const statusHistorySchema =
  new mongoose.Schema(
    {
      status: {
        type: String,
        required: true,
      },

      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
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
    {
      _id: false,
    }
  );


const partnerProjectSchema =
  new mongoose.Schema(
    {
      projectId: {
        type: String,
        unique: true,
        index: true,
        default: createProjectId,
      },

      partner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Partner",
        required: true,
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

      client: {
        name: {
          type: String,
          required: true,
          trim: true,
        },

        email: {
          type: String,
          required: true,
          trim: true,
          lowercase: true,
        },

        phone: {
          type: String,
          trim: true,
          default: "",
        },

        company: {
          type: String,
          trim: true,
          default: "",
        },
      },

      eventType: {
        type: String,
        trim: true,
        default: "",
      },

      eventDate: Date,

      deliveryCity: {
        type: String,
        trim: true,
        default: "",
      },

      requiredDeliveryDate: Date,

      quantity: {
        type: Number,
        min: 1,
        default: 1,
      },

      budgetPerGift: {
        type: Number,
        min: 0,
        default: 0,
      },

      totalBudget: {
        type: Number,
        min: 0,
        default: 0,
      },

      currency: {
        type: String,
        default: "INR",
        uppercase: true,
      },

      requirements: {
        type: String,
        trim: true,
        default: "",
      },

      brandingRequirements: {
        type: String,
        trim: true,
        default: "",
      },

      documents: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Document",
        },
      ],

      items: {
        type: [projectItemSchema],
        default: [],
      },

      clientPriceTotal: {
        type: Number,
        min: 0,
        default: 0,
      },

      status: {
        type: String,
        enum: Object.values(
          PARTNER_PROJECT_STATUS
        ),
        default:
          PARTNER_PROJECT_STATUS.DRAFT,
        index: true,
      },

      validation: {
        feasible: {
          type: Boolean,
          default: null,
        },

        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        reviewedAt: Date,

        note: {
          type: String,
          trim: true,
          default: "",
        },
      },

      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      priority: {
        type: String,
        enum: [
          "low",
          "normal",
          "high",
          "urgent",
        ],
        default: "normal",
      },

      promisedDate: Date,

      nextAction: {
        type: String,
        trim: true,
        default: "",
      },

      rfq: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RFQ",
      },

      quote: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quote",
      },

      approval: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Approval",
      },

      commissionRateOverride: {
        type: Number,
        min: 0,
        max: 100,
        default: null,
        select: false,
      },

      internalNotes: {
        type: String,
        trim: true,
        default: "",
        select: false,
      },

      statusHistory: {
        type: [statusHistorySchema],
        default: [],
      },
    },
    {
      timestamps: true,
    }
  );


partnerProjectSchema.index({
  partner: 1,
  createdAt: -1,
});

partnerProjectSchema.index({
  status: 1,
  promisedDate: 1,
});


const PartnerProject =
  mongoose.models.PartnerProject ||
  mongoose.model(
    "PartnerProject",
    partnerProjectSchema
  );


export default PartnerProject;