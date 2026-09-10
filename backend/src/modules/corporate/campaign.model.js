import mongoose from "mongoose";
import crypto from "crypto";

import {
  CORPORATE_CAMPAIGN_STATUS,
  CORPORATE_PAYMENT_STATUS,
  CORPORATE_PO_STATUS,
  RECIPIENT_IMPORT_STATUS,
} from "../../constants/statuses.js";


const createCampaignId = () => {
  return `CMP-${Date.now()
    .toString(36)
    .toUpperCase()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
};


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


const campaignSchema =
  new mongoose.Schema(
    {
      campaignId: {
        type: String,
        unique: true,
        immutable: true,
        default: createCampaignId,
      },

      organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true,
      },

      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      rfq: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RFQ",
        unique: true,
        sparse: true,
      },

      campaignType: {
        type: String,
        enum: [
          "corporate",
          "diwali_bulk",
        ],
        default: "corporate",
        index: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
      },

      objective: {
        type: String,
        trim: true,
      },

      occasion: {
        type: String,
        trim: true,
      },

      recipientType: {
        type: String,
        trim: true,
      },

      description: {
        type: String,
        trim: true,
      },

      quantity: {
        type: Number,
        min: 1,
        required: true,
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

      deliveryCities: {
        type: [String],
        default: [],
      },

      addressModel: {
        type: String,
        enum: [
          "single_address",
          "multiple_addresses",
          "not_decided",
        ],
        default: "not_decided",
      },

      requiredDeliveryDate: {
        type: Date,
      },

      productInterest: {
        type: [String],
        default: [],
      },

      contact: {
        name: {
          type: String,
          trim: true,
        },

        email: {
          type: String,
          trim: true,
          lowercase: true,
        },

        phone: {
          type: String,
          trim: true,
        },
      },

      branding: {
        required: {
          type: Boolean,
          default: false,
        },

        logoRequired: {
          type: Boolean,
          default: false,
        },

        personalizationRequired: {
          type: Boolean,
          default: false,
        },

        method: {
          type: String,
          trim: true,
        },

        notes: {
          type: String,
          trim: true,
        },
      },

      packagingRequirements: {
        type: String,
        trim: true,
      },

      dietaryRequirements: {
        type: [String],
        default: [],
      },

      personalizationRequirements: {
        type: String,
        trim: true,
      },

      notes: {
        type: String,
        trim: true,
      },

      documents: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Document",
        },
      ],

      commercialRoute: {
        type: String,
        enum: [
          "undecided",
          "po",
          "payment",
        ],
        default: "undecided",
      },

      po: {
        status: {
          type: String,
          enum: Object.values(
            CORPORATE_PO_STATUS
          ),
          default:
            CORPORATE_PO_STATUS.NOT_REQUIRED,
        },

        document: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Document",
        },

        referenceNumber: {
          type: String,
          trim: true,
        },

        submittedAt: {
          type: Date,
        },

        verifiedAt: {
          type: Date,
        },

        verifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        note: {
          type: String,
          trim: true,
        },
      },

      paymentInfo: {
        payment: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Payment",
        },

        status: {
          type: String,
          enum: Object.values(
            CORPORATE_PAYMENT_STATUS
          ),
          default:
            CORPORATE_PAYMENT_STATUS.NOT_REQUIRED,
        },

        linkedAt: {
          type: Date,
        },

        syncedAt: {
          type: Date,
        },
      },

      recipientFile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
      },

      recipientImportStatus: {
        type: String,
        enum: Object.values(
          RECIPIENT_IMPORT_STATUS
        ),
        default:
          RECIPIENT_IMPORT_STATUS.NOT_UPLOADED,
      },

      recipientSummary: {
        total: {
          type: Number,
          default: 0,
        },

        valid: {
          type: Number,
          default: 0,
        },

        invalid: {
          type: Number,
          default: 0,
        },

        approved: {
          type: Number,
          default: 0,
        },
      },

      workflowStatus: {
        type: String,
        enum: Object.values(
          CORPORATE_CAMPAIGN_STATUS
        ),
        default:
          CORPORATE_CAMPAIGN_STATUS.DRAFT,
        index: true,
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
        index: true,
      },

      promisedDate: {
        type: Date,
      },

      nextAction: {
        type: String,
        trim: true,
      },

      internalNotes: {
        type: String,
        trim: true,
        select: false,
      },

      statusHistory: {
        type: [statusHistorySchema],
        default: [],
      },

      cancelledAt: {
        type: Date,
      },
    },
    {
      timestamps: true,
    }
  );


campaignSchema.index({
  organization: 1,
  createdAt: -1,
});


campaignSchema.index({
  workflowStatus: 1,
  priority: 1,
  createdAt: -1,
});


campaignSchema.index({
  assignedTo: 1,
  workflowStatus: 1,
});


const Campaign =
  mongoose.model(
    "CorporateCampaign",
    campaignSchema
  );


export default Campaign;