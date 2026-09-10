import crypto from "crypto";
import mongoose from "mongoose";
import { FULFILMENT_STATUS } from "../../constants/statuses.js";

const shipmentHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(FULFILMENT_STATUS),
      required: true,
    },
    note: { type: String, default: "" },
    location: { type: String, default: "" },
    by: { type: mongoose.Schema.Types.ObjectId, default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const packageSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" },
    weight: { type: Number, default: null },
    length: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    itemCount: { type: Number, default: 1, min: 1 },
  },
  { _id: true }
);

const fulfilmentSchema = new mongoose.Schema(
  {
    shipmentCode: { type: String, unique: true, index: true },

    productionJob: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductionJob",
      required: true,
      index: true,
    },

    sourceType: { type: String, default: "", index: true },
    sourceId: { type: String, default: "", index: true },

    customerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    recipientName: { type: String, required: true, trim: true },
    recipientPhone: { type: String, default: "", trim: true },

    shippingAddress: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, default: "", trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
      country: { type: String, default: "India", trim: true },
    },

    packages: { type: [packageSchema], default: [] },

    carrier: { type: String, default: "", trim: true },
    trackingNumber: { type: String, default: "", trim: true, index: true },
    trackingUrl: { type: String, default: "", trim: true },

    status: {
      type: String,
      enum: Object.values(FULFILMENT_STATUS),
      default: FULFILMENT_STATUS.CREATED,
      index: true,
    },

    dispatchedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },
    history: { type: [shipmentHistorySchema], default: [] },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

/* Mongoose 9-safe synchronous middleware: do not call next(). */
fulfilmentSchema.pre("validate", function () {
  if (!this.shipmentCode) {
    this.shipmentCode =
      `SHP-${Date.now().toString().slice(-8)}-` +
      crypto.randomBytes(2).toString("hex").toUpperCase();
  }
});

fulfilmentSchema.index({ productionJob: 1, createdAt: -1 });
fulfilmentSchema.index({ status: 1, createdAt: -1 });
fulfilmentSchema.index({ sourceType: 1, sourceId: 1, createdAt: -1 });

const Fulfilment = mongoose.model("Fulfilment", fulfilmentSchema);

export default Fulfilment;
