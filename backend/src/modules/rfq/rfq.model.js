import mongoose from "mongoose";
import { RFQ_STATUS } from "../../constants/statuses.js";

const { Schema } = mongoose;

// ======================================================
// STATUS HISTORY
// ======================================================

const rfqStatusHistorySchema = new Schema(
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
// BRANDING
// ======================================================

const brandingSchema = new Schema(
  {
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
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

// ======================================================
// CUSTOM HAMPER RFQ SNAPSHOT
// ======================================================

const customHamperAssetSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["logo", "icon", "gift_wrap", "reference_design"],
      required: true,
    },
    url: {
      type: String,
      trim: true,
      required: true,
      maxlength: 2000,
    },
    publicId: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
      select: false,
    },
    fileName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },
    mimeType: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },
    placement: {
      type: String,
      enum: [
        "top_lid",
        "front",
        "inside_lid",
        "gift_tag",
        "message_card",
        "ribbon_tag",
        "full_wrap",
        "other",
      ],
      default: "top_lid",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
  },
  { _id: false }
);

const customHamperPersonalizationSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    assets: {
      type: [customHamperAssetSchema],
      default: [],
    },
    message: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    instructions: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1500,
    },
  },
  { _id: false }
);

const customHamperSelectionSnapshotSchema = new Schema(
  {
    component: {
      type: Schema.Types.ObjectId,
      ref: "Component",
      default: null,
    },
    name: {
      type: String,
      trim: true,
      required: true,
    },
    code: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
    quantity: {
      type: Number,
      min: 1,
      required: true,
    },
    indicativeUnitPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    indicativeLineTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const customHamperRequestSchema = new Schema(
  {
    snapshotVersion: {
      type: Number,
      default: 1,
      min: 1,
    },

    container: {
      type: Schema.Types.ObjectId,
      ref: "Container",
      default: null,
    },

    containerName: {
      type: String,
      trim: true,
      required: true,
    },

    containerCode: {
      type: String,
      trim: true,
      default: "",
    },

    containerImage: {
      type: String,
      trim: true,
      default: "",
    },

    channel: {
      type: String,
      enum: ["", "corporate", "wedding", "diwali", "hamperOne"],
      default: "",
    },

    items: {
      type: [customHamperSelectionSnapshotSchema],
      default: [],
    },

    decorations: {
      type: [customHamperSelectionSnapshotSchema],
      default: [],
    },

    personalization: {
      type: customHamperPersonalizationSchema,
      default: undefined,
    },

    indicativePricing: {
      currency: {
        type: String,
        trim: true,
        uppercase: true,
        default: "INR",
      },
      containerPrice: {
        type: Number,
        min: 0,
        default: 0,
      },
      itemsTotal: {
        type: Number,
        min: 0,
        default: 0,
      },
      decorationsTotal: {
        type: Number,
        min: 0,
        default: 0,
      },
      total: {
        type: Number,
        min: 0,
        default: 0,
      },
    },

    capacity: {
      usedVolumeCm3: { type: Number, default: null },
      usableVolumeCm3: { type: Number, default: null },
      remainingVolumeCm3: { type: Number, default: null },
      usedWeightGrams: { type: Number, default: null },
      maxWeightGrams: { type: Number, default: null },
      remainingWeightGrams: { type: Number, default: null },
      itemCount: { type: Number, default: null },
      maxItems: { type: Number, default: null },
    },
  },
  { _id: false }
);

// ======================================================
// RFQ MODEL
// ======================================================

const rfqSchema = new Schema(
  {
    rfqId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
      default: () =>
        `RFQ-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 8)
          .toUpperCase()}`,
    },

    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sourceType: {
      type: String,
      enum: [
        "corporate",
        "diwali_bulk",
        "wedding",
        "partner",
        "concierge",
        "custom_hamper",
        "other",
      ],
      default: "corporate",
      index: true,
    },

    companyName: {
      type: String,
      trim: true,
      default: "",
    },

    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    contactName: {
      type: String,
      trim: true,
      required: true,
    },

    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
    },

    contactPhone: {
      type: String,
      trim: true,
      default: "",
    },

    title: {
      type: String,
      trim: true,
      required: true,
    },

    objective: {
      type: String,
      trim: true,
      default: "",
    },

    occasion: {
      type: String,
      trim: true,
      default: "",
    },

    recipientType: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
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
      trim: true,
      uppercase: true,
      default: "INR",
    },

    deliveryLocations: {
      type: [String],
      default: [],
    },

    addressModel: {
      type: String,
      enum: ["single_address", "multiple_addresses", "not_decided"],
      default: "not_decided",
    },

    requiredDeliveryDate: {
      type: Date,
      default: null,
    },

    productInterest: {
      type: [String],
      default: [],
    },

    branding: {
      type: brandingSchema,
      default: () => ({}),
    },

    packagingRequirements: {
      type: String,
      trim: true,
      default: "",
    },

    dietaryRequirements: {
      type: [String],
      default: [],
    },

    personalizationRequirements: {
      type: String,
      trim: true,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    customHamperRequest: {
      type: customHamperRequestSchema,
      default: undefined,
    },

    commercialPaymentStatus: {
      type: String,
      enum: ["not_started", "pending", "paid", "failed"],
      default: "not_started",
      index: true,
    },

    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    documents: [
      {
        type: Schema.Types.ObjectId,
        ref: "Document",
      },
    ],

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },

    promisedDate: {
      type: Date,
      default: null,
    },

    nextAction: {
      type: String,
      trim: true,
      default: "",
    },

    internalNotes: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },

    status: {
      type: String,
      enum: Object.values(RFQ_STATUS),
      default: RFQ_STATUS.DRAFT,
      index: true,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    statusHistory: {
      type: [rfqStatusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

rfqSchema.index({ requester: 1, createdAt: -1 });
rfqSchema.index({ status: 1, priority: 1, createdAt: -1 });
rfqSchema.index({ assignedTo: 1, status: 1 });
rfqSchema.index({ commercialPaymentStatus: 1, createdAt: -1 });

const RFQ = mongoose.model("RFQ", rfqSchema);

export default RFQ;
