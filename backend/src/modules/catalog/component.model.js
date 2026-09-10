import mongoose from "mongoose";

const COMPONENT_TYPES = ["food", "non_food", "packaging"];
const HAMPER_ROLES = ["content", "decoration"];
const AVAILABILITY_STATUS = ["in_stock", "incoming", "out_of_stock"];
const DIMENSION_UNITS = ["mm", "cm"];
const WEIGHT_UNITS = ["g", "kg"];
const STOCK_UNITS = ["pc", "g", "kg", "ml", "l", "mm", "cm", "m"];
const SOURCE_TYPES = ["manual", "product_master", "google_sheet"];

const componentImageSchema = new mongoose.Schema(
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
    unit: { type: String, enum: WEIGHT_UNITS, default: "g" },
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    status: { type: String, enum: AVAILABILITY_STATUS, default: "in_stock" },
    availableQuantity: { type: Number, default: null, min: 0 },
    unit: { type: String, enum: STOCK_UNITS, default: "pc" },
    nextAvailableDate: { type: Date, default: null },
  },
  { _id: false }
);

const channelsSchema = new mongoose.Schema(
  {
    corporate: { type: Boolean, default: false },
    wedding: { type: Boolean, default: false },
    diwali: { type: Boolean, default: false },
    hamperOne: { type: Boolean, default: false },
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

const sourceSchema = new mongoose.Schema(
  {
    type: { type: String, enum: SOURCE_TYPES, default: "manual" },
    externalSku: { type: String, trim: true, default: "", maxlength: 120 },
    sourceUpdatedAt: { type: Date, default: null },
    lastSyncedAt: { type: Date, default: null },
  },
  { _id: false }
);

const componentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 180 },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 80,
    },

    type: { type: String, enum: COMPONENT_TYPES, required: true, index: true },
    hamperRole: {
      type: String,
      enum: HAMPER_ROLES,
      default: "content",
      index: true,
    },
    brand: { type: String, trim: true, default: "", maxlength: 120 },
    description: { type: String, trim: true, default: "", maxlength: 2000 },
    images: { type: [componentImageSchema], default: [] },

    skuBarcode: { type: String, trim: true, default: "", maxlength: 120 },
    sizePack: { type: String, trim: true, default: "", maxlength: 120 },
    uom: { type: String, trim: true, default: "", maxlength: 30 },
    piecesPerUom: { type: Number, default: null, min: 0 },
    sourceProductType: { type: String, trim: true, default: "", maxlength: 180 },
    taxonomyBaseId: { type: String, trim: true, default: "", maxlength: 120 },
    categoryCode: { type: String, trim: true, default: "", maxlength: 60, index: true },
    category: { type: String, trim: true, default: "", maxlength: 180, index: true },
    subcategory: { type: String, trim: true, default: "", maxlength: 180, index: true },
    segment: { type: String, trim: true, default: "", maxlength: 180, index: true },
    productPriority: { type: Number, default: null, min: 0 },

    mrp: { type: Number, default: null, min: 0 },
    /* Pre-GST price from Product Master/manual admin. */
    sellingPrice: { type: Number, default: null, min: 0 },
    latestUnitCost: { type: Number, default: null, min: 0 },
    actualLandedCost: { type: Number, default: null, min: 0 },
    taxEnabled: { type: Boolean, default: true },
    taxPercent: { type: Number, default: null, min: 0, max: 100 },
    hsnSac: { type: String, trim: true, default: "", maxlength: 40 },
    discount: { type: discountSchema, default: () => ({}) },
    pricingSource: { type: String, enum: SOURCE_TYPES, default: "manual" },
    taxSource: { type: String, enum: SOURCE_TYPES, default: "manual" },
    minGrossMarginPercent: { type: Number, default: null, min: 0, max: 100 },
    moqQty: { type: Number, default: null, min: 0 },
    leadTimeDays: { type: Number, default: null, min: 0 },

    dimensions: { type: dimensionsSchema, default: () => ({}) },
    weight: { type: weightSchema, default: () => ({}) },
    fragile: { type: Boolean, default: false },

    dietary: { type: String, trim: true, default: "", maxlength: 120 },
    expiryTracked: { type: Boolean, default: false },
    shelfLifeDays: { type: Number, default: null, min: 0 },
    expiryDate: { type: Date, default: null },

    personalizable: { type: Boolean, default: false },
    personalizationMethod: { type: String, trim: true, default: "", maxlength: 240 },
    hamperUse: { type: Boolean, default: true, index: true },
    channels: { type: channelsSchema, default: () => ({}) },

    availability: {
      type: availabilitySchema,
      default: () => ({
        status: "in_stock",
        availableQuantity: null,
        unit: "pc",
        nextAvailableDate: null,
      }),
    },

    customerSelectable: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    internalNotes: { type: String, trim: true, default: "", maxlength: 3000 },
    source: { type: sourceSchema, default: () => ({ type: "manual" }) },
  },
  { timestamps: true }
);

componentSchema.path("discount.value").validate(function validateDiscountValue(value) {
  if (!this.discount?.enabled) return true;
  if (this.discount.type === "percentage") return Number(value) <= 100;
  return true;
}, "Percentage discount cannot exceed 100");

componentSchema.index({ type: 1, hamperRole: 1, isActive: 1, customerSelectable: 1, name: 1 });
componentSchema.index({ "availability.status": 1, isActive: 1 });
componentSchema.index({ category: 1, subcategory: 1, segment: 1, isActive: 1 });
componentSchema.index({ "channels.wedding": 1, isActive: 1, customerSelectable: 1 });
componentSchema.index({ "channels.corporate": 1, isActive: 1, customerSelectable: 1 });
componentSchema.index({ "channels.diwali": 1, isActive: 1, customerSelectable: 1 });
componentSchema.index({ "channels.hamperOne": 1, isActive: 1, customerSelectable: 1 });
componentSchema.index({ "source.externalSku": 1 });
componentSchema.index({ hsnSac: 1, taxPercent: 1 });

const Component = mongoose.model("Component", componentSchema);

export default Component;
