import mongoose from "mongoose";
import {
  NOTIFICATION_EMAIL_STATUS,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPE,
  NOTIFICATION_WHATSAPP_STATUS,
} from "../../constants/statuses.js";

const emailDeliverySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_EMAIL_STATUS),
      default: NOTIFICATION_EMAIL_STATUS.NOT_REQUESTED,
    },
    provider: { type: String, default: "brevo", trim: true },
    providerMessageId: { type: String, default: "", trim: true },
    attemptedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    error: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const whatsappDeliverySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_WHATSAPP_STATUS),
      default: NOTIFICATION_WHATSAPP_STATUS.NOT_REQUESTED,
    },
    provider: { type: String, default: "meta_whatsapp_cloud", trim: true },
    providerMessageId: { type: String, default: "", trim: true },
    templateName: { type: String, default: "", trim: true, maxlength: 160 },
    recipientPhone: { type: String, default: "", trim: true, maxlength: 30 },
    attemptedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    error: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      default: NOTIFICATION_TYPE.SYSTEM,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    entityType: {
      type: String,
      default: "",
      trim: true,
    },

    entityId: {
      type: String,
      default: "",
      trim: true,
    },

    actionUrl: {
      type: String,
      default: "",
    },

    eventKey: {
      type: String,
      trim: true,
      default: undefined,
    },

    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.UNREAD,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    emailDelivery: {
      type: emailDeliverySchema,
      default: () => ({}),
    },

    whatsappDelivery: {
      type: whatsappDeliverySchema,
      default: () => ({}),
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
notificationSchema.index(
  { eventKey: 1 },
  {
    unique: true,
    sparse: true,
  }
);

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
