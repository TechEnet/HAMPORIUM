import mongoose from "mongoose";
import crypto from "crypto";

import {
  WEDDING_EVENT_STATUS,
} from "../../constants/statuses.js";


const createWeddingEventId = () => {
  return `WEV-${Date.now()
    .toString(36)
    .toUpperCase()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
};


const weddingEventSchema =
  new mongoose.Schema(
    {
      weddingEventId: {
        type: String,
        unique: true,
        immutable: true,
        default:
          createWeddingEventId,
      },

      project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WeddingProject",
        required: true,
        index: true,
      },

      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      eventType: {
        type: String,
        enum: [
          "save_the_date",
          "invitation",
          "welcome",
          "room_hamper",
          "mehendi",
          "haldi",
          "sangeet",
          "wedding",
          "reception",
          "vip_family",
          "return_favour",
          "departure",
          "other",
        ],
        default: "other",
      },

      title: {
        type: String,
        required: true,
        trim: true,
      },

      eventDate: {
        type: Date,
      },

      startTime: {
        type: String,
        trim: true,
      },

      endTime: {
        type: String,
        trim: true,
      },

      venueName: {
        type: String,
        trim: true,
      },

      hotelName: {
        type: String,
        trim: true,
      },

      city: {
        type: String,
        trim: true,
      },

      expectedGuests: {
        type: Number,
        min: 0,
        default: 0,
      },

      giftQuantity: {
        type: Number,
        min: 0,
        default: 0,
      },

      giftingCategories: {
        type: [String],
        default: [],
      },

      deliveryPoint: {
        type: String,
        trim: true,
      },

      deliveryInstructions: {
        type: String,
        trim: true,
      },

      notes: {
        type: String,
        trim: true,
      },

      status: {
        type: String,
        enum: Object.values(
          WEDDING_EVENT_STATUS
        ),
        default:
          WEDDING_EVENT_STATUS.PLANNED,
        index: true,
      },
    },
    {
      timestamps: true,
    }
  );


weddingEventSchema.index({
  project: 1,
  eventDate: 1,
});


const WeddingEvent =
  mongoose.model(
    "WeddingEvent",
    weddingEventSchema
  );


export default WeddingEvent;