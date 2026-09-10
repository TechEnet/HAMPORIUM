import mongoose from "mongoose";

const attributionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
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

const customHamperSelectionSchema = new mongoose.Schema(
  {
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Component",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 99,
      default: 1,
    },
  },
  { _id: false }
);

const PERSONALIZATION_ASSET_TYPES = [
  "logo",
  "icon",
  "gift_wrap",
  "reference_design",
];

const PERSONALIZATION_PLACEMENTS = [
  "top_lid",
  "front",
  "inside_lid",
  "gift_tag",
  "message_card",
  "ribbon_tag",
  "full_wrap",
  "other",
];

const customHamperPersonalizationAssetSchema = new mongoose.Schema(
  {
    type: { type: String, enum: PERSONALIZATION_ASSET_TYPES, required: true },
    url: { type: String, required: true, trim: true, maxlength: 2000 },
    publicId: { type: String, required: true, trim: true, maxlength: 500 },
    fileName: { type: String, trim: true, default: "", maxlength: 180 },
    mimeType: { type: String, trim: true, default: "", maxlength: 100 },
    size: { type: Number, default: 0, min: 0, max: 5 * 1024 * 1024 },
    placement: {
      type: String,
      enum: PERSONALIZATION_PLACEMENTS,
      default: "top_lid",
    },
    notes: { type: String, trim: true, default: "", maxlength: 500 },
  },
  { _id: false }
);

const customHamperPersonalizationSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    assets: {
      type: [customHamperPersonalizationAssetSchema],
      default: [],
      validate: {
        validator: (assets) => assets.length <= 4,
        message: "A custom hamper can have at most 4 personalization assets",
      },
    },
    message: { type: String, trim: true, default: "", maxlength: 500 },
    instructions: { type: String, trim: true, default: "", maxlength: 1500 },
  },
  { _id: false }
);

const customHamperSchema = new mongoose.Schema(
  {
    container: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Container",
      required: true,
    },
    items: {
      type: [customHamperSelectionSchema],
      default: [],
    },
    decorations: {
      type: [customHamperSelectionSchema],
      default: [],
    },
    channel: {
      type: String,
      enum: ["", "corporate", "wedding", "diwali", "hamperOne"],
      default: "",
    },
    personalization: {
      type: customHamperPersonalizationSchema,
      default: undefined,
    },
    configurationKey: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const cartItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ["sku", "custom_hamper"],
      default: "sku",
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    sku: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SKU",
      default: null,
    },

    customHamper: {
      type: customHamperSchema,
      default: null,
    },

    attribution: {
      type: attributionSchema,
      default: undefined,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 99,
      default: 1,
    },
  },
  { timestamps: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;
