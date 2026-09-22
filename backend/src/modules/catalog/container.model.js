import mongoose from "mongoose";

const DIMENSION_UNITS = ["mm", "cm"];
const WEIGHT_UNITS = ["g", "kg"];
const AVAILABILITY_STATUS = ["in_stock", "incoming", "out_of_stock"];
const SOURCE_TYPES = ["manual", "product_master", "google_sheet"];

const containerImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: "" },
    alt: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const dimensionsSchema = new mongoose.Schema(
  {
    length: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 0 },
    height: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: DIMENSION_UNITS, default: "cm" },
  },
  { _id: false }
);

const weightCapacitySchema = new mongoose.Schema(
  {
    value: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: WEIGHT_UNITS, default: "kg" },
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    status: { type: String, enum: AVAILABILITY_STATUS, default: "in_stock" },
    availableQuantity: { type: Number, default: null, min: 0 },
    nextAvailableDate: { type: Date, default: null },
  },
  { _id: false }
);

const packingMaterialSchema = new mongoose.Schema(
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

const containerSchema = new mongoose.Schema(
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

    material: { type: String, trim: true, default: "", maxlength: 180 },
    description: { type: String, trim: true, default: "", maxlength: 2000 },
    images: { type: [containerImageSchema], default: [] },

    skuBarcode: { type: String, trim: true, default: "", maxlength: 120 },
    sourceProductType: { type: String, trim: true, default: "", maxlength: 180 },
    taxonomyBaseId: { type: String, trim: true, default: "", maxlength: 120 },
    categoryCode: { type: String, trim: true, default: "", maxlength: 60, index: true },
    category: { type: String, trim: true, default: "", maxlength: 180, index: true },
    subcategory: { type: String, trim: true, default: "", maxlength: 180, index: true },
    segment: { type: String, trim: true, default: "", maxlength: 180, index: true },
    productPriority: { type: Number, default: null, min: 0 },

    mrp: { type: Number, default: null, min: 0 },
    // Pre-GST price from Product Master/manual admin.
    sellingPrice: { type: Number, default: null, min: 0 },
    latestUnitCost: { type: Number, default: null, min: 0 },
    actualLandedCost: { type: Number, default: null, min: 0 },
    // Container-level floor used by the central Promotion Margin Guard.
    minGrossMarginPercent: { type: Number, default: null, min: 0, max: 100 },
    taxEnabled: { type: Boolean, default: true },
    taxPercent: { type: Number, default: null, min: 0, max: 100 },
    hsnSac: { type: String, trim: true, default: "", maxlength: 40 },
    discount: { type: discountSchema, default: () => ({}) },
    pricingSource: { type: String, enum: SOURCE_TYPES, default: "manual" },
    taxSource: { type: String, enum: SOURCE_TYPES, default: "manual" },
    leadTimeDays: { type: Number, default: null, min: 0 },

    outerDimensions: { type: dimensionsSchema, required: true },
    innerDimensions: { type: dimensionsSchema, required: true },
    maxContentWeight: { type: weightCapacitySchema, required: true },
    usableVolumePercent: { type: Number, default: 85, min: 1, max: 100 },
    maxItems: { type: Number, default: 0, min: 0 },

    packingMaterials: { type: [packingMaterialSchema], default: [] },
    productionLeadTime: {
      type: productionLeadTimeSchema,
      default: () => ({
        personalizationDays: 0,
        assemblyDays: 0,
        packingDays: 0,
      }),
    },
    defaultCourierDays: { type: Number, default: null, min: 0, max: 60 },

    hamperUse: { type: Boolean, default: true, index: true },
    channels: { type: channelsSchema, default: () => ({}) },

    availability: {
      type: availabilitySchema,
      default: () => ({
        status: "in_stock",
        availableQuantity: null,
        nextAvailableDate: null,
      }),
    },

    customerSelectable: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    internalNotes: { type: String, trim: true, default: "", maxlength: 3000 },
    source: { type: sourceSchema, default: () => ({ type: "manual" }) },
  },
  { timestamps: true }
);

containerSchema.path("discount.value").validate(function validateDiscountValue(value) {
  if (!this.discount?.enabled) return true;
  if (this.discount.type === "percentage") return Number(value) <= 100;
  return true;
}, "Percentage discount cannot exceed 100");

containerSchema.index({ isActive: 1, customerSelectable: 1, sortOrder: 1, name: 1 });
containerSchema.index({ "availability.status": 1, isActive: 1 });
containerSchema.index({ category: 1, subcategory: 1, segment: 1, isActive: 1 });
containerSchema.index({ "source.externalSku": 1 });
containerSchema.index({ hsnSac: 1, taxPercent: 1 });

const Container =
  mongoose.models.Container || mongoose.model("Container", containerSchema);

export default Container;
