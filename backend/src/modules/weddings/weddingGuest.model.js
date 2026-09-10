import mongoose from "mongoose";
import crypto from "crypto";

import {
  WEDDING_GUEST_DELIVERY_STATUS,
  WEDDING_GUEST_STATUS,
} from "../../constants/statuses.js";


const createWeddingGuestId = () => {
  return `WGU-${Date.now()
    .toString(36)
    .toUpperCase()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
};


const weddingGuestSchema =
  new mongoose.Schema(
    {
      weddingGuestId: {
        type: String,
        unique: true,
        immutable: true,
        default:
          createWeddingGuestId,
      },

      project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WeddingProject",
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

      familyName: {
        type: String,
        trim: true,
      },

      name: {
        type: String,
        trim: true,
      },

      phone: {
        type: String,
        trim: true,
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
      },

      hotelName: {
        type: String,
        trim: true,
      },

      roomNumber: {
        type: String,
        trim: true,
      },

      arrivalDate: {
        type: Date,
      },

      arrivalTime: {
        type: String,
        trim: true,
      },

      departureDate: {
        type: Date,
      },

      departureTime: {
        type: String,
        trim: true,
      },

      dietaryPreference: {
        type: String,
        trim: true,
      },

      isChild: {
        type: Boolean,
        default: false,
      },

      isVIP: {
        type: Boolean,
        default: false,
      },

      isInternationalGuest: {
        type: Boolean,
        default: false,
      },

      giftCategory: {
        type: String,
        trim: true,
      },

      personalizationText: {
        type: String,
        trim: true,
      },

      eventIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "WeddingEvent",
        },
      ],

      deliveryPoint: {
        type: String,
        trim: true,
      },

      deliveryWindow: {
        type: String,
        trim: true,
      },

      allocationNotes: {
        type: String,
        trim: true,
      },

      deliveryStatus: {
        type: String,
        enum: Object.values(
          WEDDING_GUEST_DELIVERY_STATUS
        ),
        default:
          WEDDING_GUEST_DELIVERY_STATUS.NOT_PLANNED,
      },

      status: {
        type: String,
        enum: Object.values(
          WEDDING_GUEST_STATUS
        ),
        default:
          WEDDING_GUEST_STATUS.VALID,
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


weddingGuestSchema.index({
  project: 1,
  rowNumber: 1,
});


weddingGuestSchema.index({
  project: 1,
  status: 1,
});


weddingGuestSchema.index({
  project: 1,
  hotelName: 1,
  roomNumber: 1,
});


const WeddingGuest =
  mongoose.model(
    "WeddingGuest",
    weddingGuestSchema
  );


export default WeddingGuest;