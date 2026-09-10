import mongoose from "mongoose";
import crypto from "crypto";

import {
  RECIPIENT_STATUS,
} from "../../constants/statuses.js";


const createRecipientId = () => {
  return `RCP-${Date.now()
    .toString(36)
    .toUpperCase()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
};


const recipientSchema =
  new mongoose.Schema(
    {
      recipientId: {
        type: String,
        unique: true,
        immutable: true,
        default: createRecipientId,
      },

      campaign: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CorporateCampaign",
        required: true,
        index: true,
      },

      organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true,
      },

      importedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      rowNumber: {
        type: Number,
        required: true,
      },

      employeeId: {
        type: String,
        trim: true,
      },

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

      address: {
        addressLine1: {
          type: String,
          trim: true,
        },

        addressLine2: {
          type: String,
          trim: true,
        },

        city: {
          type: String,
          trim: true,
        },

        state: {
          type: String,
          trim: true,
        },

        pincode: {
          type: String,
          trim: true,
        },

        country: {
          type: String,
          trim: true,
          default: "India",
        },
      },

      giftMessage: {
        type: String,
        trim: true,
      },

      personalizationText: {
        type: String,
        trim: true,
      },

      dietaryPreference: {
        type: String,
        trim: true,
      },

      deliveryNotes: {
        type: String,
        trim: true,
      },

      status: {
        type: String,
        enum: Object.values(
          RECIPIENT_STATUS
        ),
        default:
          RECIPIENT_STATUS.VALID,
        index: true,
      },

      validationErrors: {
        type: [String],
        default: [],
      },

      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      reviewedAt: {
        type: Date,
      },
    },
    {
      timestamps: true,
    }
  );


recipientSchema.index({
  campaign: 1,
  rowNumber: 1,
});


recipientSchema.index({
  campaign: 1,
  status: 1,
});


const Recipient =
  mongoose.model(
    "CorporateRecipient",
    recipientSchema
  );


export default Recipient;