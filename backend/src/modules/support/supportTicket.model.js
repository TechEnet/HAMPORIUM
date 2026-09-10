import crypto from "crypto";
import mongoose from "mongoose";

const SUPPORT_CATEGORIES = [
  "order_status",
  "delivery",
  "damaged_item",
  "missing_item",
  "payment",
  "cancellation",
  "refund",
  "invoice",
  "product",
  "other",
];

const SUPPORT_STATUSES = [
  "open",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
];

const SUPPORT_PRIORITIES = ["low", "normal", "high", "urgent"];

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 2000 },
    name: { type: String, trim: true, default: "", maxlength: 180 },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["customer", "admin", "operations"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    refund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
      index: true,
    },
    category: {
      type: String,
      enum: SUPPORT_CATEGORIES,
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    status: {
      type: String,
      enum: SUPPORT_STATUSES,
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: SUPPORT_PRIORITIES,
      default: "normal",
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

supportTicketSchema.pre("validate", function assignTicketNumber() {
  if (!this.ticketNumber) {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    this.ticketNumber = `SUP-${stamp}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;
  }
});

supportTicketSchema.index({ user: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: -1, lastMessageAt: -1 });
supportTicketSchema.index({ assignedTo: 1, status: 1, lastMessageAt: -1 });

const SupportTicket =
  mongoose.models.SupportTicket ||
  mongoose.model("SupportTicket", supportTicketSchema);

export { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUSES };
export default SupportTicket;
