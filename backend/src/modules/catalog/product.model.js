import mongoose from "mongoose";

import {
  PRODUCT_STATUS,
  PRODUCT_STATUS_VALUES,
} from "../../constants/statuses.js";

const SOURCE_TYPES = ["manual", "product_master", "google_sheet"];

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: "" },
    alt: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const sourceSchema = new mongoose.Schema(
  {
    type: { type: String, enum: SOURCE_TYPES, default: "manual" },
    externalSku: { type: String, trim: true, default: "", maxlength: 120 },
    sourceUpdatedAt: { type: Date, default: null },
    lastSyncedAt: { type: Date, default: null },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, trim: true, default: "", maxlength: 500 },
    description: { type: String, trim: true, default: "", maxlength: 10000 },
    brand: { type: String, trim: true, default: "HAMPORIUM" },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    collections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Collection" }],
    tags: { type: [String], default: [] },
    images: { type: [imageSchema], default: [] },

    status: {
      type: String,
      enum: PRODUCT_STATUS_VALUES,
      default: PRODUCT_STATUS.DRAFT,
      index: true,
    },

    isFeatured: { type: Boolean, default: false, index: true },

    source: {
      type: sourceSchema,
      default: () => ({ type: "manual" }),
    },

    minPrice: { type: Number, default: null, min: 0 },
    maxPrice: { type: Number, default: null, min: 0 },
    skuCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ status: 1, category: 1, isFeatured: -1, createdAt: -1 });
productSchema.index({ collections: 1, status: 1 });
productSchema.index({ minPrice: 1, status: 1 });
productSchema.index({ "source.externalSku": 1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
