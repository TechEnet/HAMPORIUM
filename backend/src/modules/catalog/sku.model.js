import mongoose from "mongoose";

import {
  calculateCatalogPricing,
  normalizeDiscountConfig,
  normalizeTaxPercent,
} from "../tax/tax.service.js";

const SOURCE_TYPES = ["manual", "product_master", "google_sheet"];
const DIMENSION_UNITS = ["mm", "cm"];
const WEIGHT_UNITS = ["g", "kg"];

const skuImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: "" },
    alt: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const dimensionsSchema = new mongoose.Schema(
  {
    length: { type: Number, default: null, min: 0 },
    width: { type: Number, default: null, min: 0 },
    height: { type: Number, default: null, min: 0 },
    unit: { type: String, enum: DIMENSION_UNITS, default: "cm" },
  },
  { _id: false }
);

const weightSchema = new mongoose.Schema(
  {
    value: { type: Number, default: null, min: 0 },
    unit: { type: String, enum: WEIGHT_UNITS, default: "kg" },
  },
  { _id: false }
);

const discountSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    value: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const hamperContentSchema = new mongoose.Schema(
  {
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Component",
      required: true,
    },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, trim: true, default: "pc", maxlength: 30 },
    displayName: { type: String, trim: true, default: "", maxlength: 180 },
    sortOrder: { type: Number, default: 0 },
    isOptional: { type: Boolean, default: false },
  },
  { _id: true }
);

/*
 * Decorations are intentionally stored separately from hamperContents.
 * They are customer-facing finishes, but they do not consume the gift-product
 * item count, volume or max-content-weight capacity of the selected box.
 */
const decorationSchema = new mongoose.Schema(
  {
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Component",
      required: true,
    },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, trim: true, default: "pc", maxlength: 30 },
    displayName: { type: String, trim: true, default: "", maxlength: 180 },
    sortOrder: { type: Number, default: 0 },
    isOptional: { type: Boolean, default: false },
  },
  { _id: true }
);

const internalMaterialSchema = new mongoose.Schema(
  {
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Component",
      required: true,
    },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, trim: true, default: "pc", maxlength: 30 },
    specification: { type: String, trim: true, default: "", maxlength: 1000 },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },
  },
  { _id: true }
);

const productionLeadTimeSchema = new mongoose.Schema(
  {
    personalizationDays: { type: Number, default: 0, min: 0 },
    assemblyDays: { type: Number, default: 0, min: 0 },
    packingDays: { type: Number, default: 0, min: 0 },
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

const skuSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    skuBarcode: { type: String, trim: true, default: "", maxlength: 120 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    optionValues: { type: Map, of: String, default: {} },

    /*
     * Pricing contract:
     * - baseSellingPrice = pre-GST selling price from Product Master/manual admin.
     * - discount is applied to baseSellingPrice before GST.
     * - price = final customer-facing price after discount + GST.
     * Existing frontend can keep reading `price`.
     */
    baseSellingPrice: { type: Number, default: null, min: 0 },
    mrp: { type: Number, default: null, min: 0 },
    taxEnabled: { type: Boolean, default: true },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },
    hsnSac: { type: String, trim: true, default: "", maxlength: 40 },
    discount: { type: discountSchema, default: () => ({}) },
    pricingSource: {
      type: String,
      enum: SOURCE_TYPES,
      default: "manual",
    },
    taxSource: {
      type: String,
      enum: SOURCE_TYPES,
      default: "manual",
    },

    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: null, min: 0 },
    images: { type: [skuImageSchema], default: [] },

    container: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Container",
      default: null,
      index: true,
    },

    hamperContents: { type: [hamperContentSchema], default: [] },
    decorations: { type: [decorationSchema], default: [] },
    internalMaterials: { type: [internalMaterialSchema], default: [] },

    packagedDimensions: {
      type: dimensionsSchema,
      default: () => ({ length: null, width: null, height: null, unit: "cm" }),
    },

    packagedWeight: {
      type: weightSchema,
      default: () => ({ value: null, unit: "kg" }),
    },

    productionLeadTime: {
      type: productionLeadTimeSchema,
      default: () => ({
        personalizationDays: 0,
        assemblyDays: 0,
        packingDays: 0,
      }),
    },

    defaultCourierDays: { type: Number, default: null, min: 0, max: 60 },
    earliestExpiryDate: { type: Date, default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    source: { type: sourceSchema, default: () => ({ type: "manual" }) },
  },
  { timestamps: true }
);

skuSchema.pre("validate", function syncCustomerFacingPrice() {
  const fallbackBase =
    this.baseSellingPrice === null || this.baseSellingPrice === undefined
      ? Number(this.price || 0)
      : Number(this.baseSellingPrice);

  const baseSellingPrice = Number.isFinite(fallbackBase)
    ? Math.max(0, fallbackBase)
    : 0;

  const taxPercent = normalizeTaxPercent(this.taxPercent, 0);
  const discount = normalizeDiscountConfig(
    this.discount?.toObject ? this.discount.toObject() : this.discount
  );

  const pricing = calculateCatalogPricing({
    baseSellingPrice,
    taxPercent,
    taxEnabled: this.taxEnabled !== false,
    discount,
  });

  this.baseSellingPrice = pricing.baseSellingPrice;
  this.taxPercent = pricing.taxPercent;
  this.discount = pricing.discount;
  this.price = pricing.price;

  if (
    this.compareAtPrice !== null &&
    this.compareAtPrice !== undefined &&
    Number(this.compareAtPrice) <= Number(this.price)
  ) {
    this.compareAtPrice = null;
  }
});

skuSchema.path("discount.value").validate(function validateDiscountValue(value) {
  if (!this.discount?.enabled) return true;
  if (this.discount.type === "percentage") return Number(value) <= 100;
  return true;
}, "Percentage discount cannot exceed 100");

skuSchema.index({ product: 1, isActive: 1, sortOrder: 1 });
skuSchema.index({ container: 1, isActive: 1 });
skuSchema.index({ "hamperContents.component": 1 });
skuSchema.index({ "decorations.component": 1 });
skuSchema.index({ "internalMaterials.component": 1 });
skuSchema.index({ "source.externalSku": 1 });
skuSchema.index({ hsnSac: 1, taxPercent: 1 });

const SKU = mongoose.model("SKU", skuSchema);

export default SKU;
