import mongoose from "mongoose";

export const COMMERCE_EVENT_TYPES = Object.freeze([
  "product_view",
  "add_to_cart",
  "checkout_start",
  "buy_now_start",
  "purchase",
  "payment_failed",
]);

const locationSchema = new mongoose.Schema(
  {
    pincode: {
      type: String,
      trim: true,
      default: "",
      maxlength: 6,
    },
    city: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    state: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    country: {
      type: String,
      trim: true,
      default: "India",
      maxlength: 120,
    },
  },
  { _id: false }
);

const attributionSchema = new mongoose.Schema(
  {
    searchEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SearchAnalytics",
      default: null,
    },
    query: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    normalizedQuery: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 160,
    },
    source: {
      type: String,
      trim: true,
      default: "",
      maxlength: 60,
    },
    clickedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const commerceAnalyticsSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: COMMERCE_EVENT_TYPES,
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    sessionId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
      index: true,
    },

    source: {
      type: String,
      trim: true,
      default: "unknown",
      maxlength: 60,
      index: true,
    },

    pagePath: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    sku: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SKU",
      default: null,
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    productSlug: {
      type: String,
      trim: true,
      default: "",
      maxlength: 220,
    },

    productName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },

    itemType: {
      type: String,
      enum: ["", "sku", "custom_hamper"],
      default: "",
    },

    checkoutMode: {
      type: String,
      enum: ["", "cart", "buy_now"],
      default: "",
      index: true,
    },

    quantity: {
      type: Number,
      default: null,
      min: 0,
    },

    value: {
      type: Number,
      default: null,
      min: 0,
    },

    currency: {
      type: String,
      trim: true,
      default: "INR",
      maxlength: 10,
    },

    location: {
      type: locationSchema,
      default: () => ({}),
    },

    attribution: {
      type: attributionSchema,
      default: undefined,
    },

    /*
     * Used for retry-safe events such as checkout and purchase.
     * Leave undefined for events that are intentionally repeatable.
     */
    eventKey: {
      type: String,
      trim: true,
      default: undefined,
      maxlength: 220,
    },
  },
  { timestamps: true }
);

commerceAnalyticsSchema.index({
  eventType: 1,
  createdAt: -1,
});

commerceAnalyticsSchema.index({
  product: 1,
  eventType: 1,
  createdAt: -1,
});

commerceAnalyticsSchema.index({
  sessionId: 1,
  createdAt: -1,
});

commerceAnalyticsSchema.index({
  order: 1,
  eventType: 1,
});

commerceAnalyticsSchema.index(
  { eventKey: 1 },
  {
    unique: true,
    sparse: true,
  }
);

const CommerceAnalytics = mongoose.model(
  "CommerceAnalytics",
  commerceAnalyticsSchema
);

export default CommerceAnalytics;
