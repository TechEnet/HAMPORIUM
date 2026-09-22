import mongoose from "mongoose";

const marginPolicySchema = new mongoose.Schema(
  {
    minGrossMarginPercent: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    // Optional admin/data-team landed-cost override per finished SKU.
    // This is essential for standalone catalogue SKUs that do not have a
    // component/container BOM from which cost can be derived.
    unitCostOverride: { type: Number, default: null, min: 0 },
    extraUnitCost: { type: Number, default: 0, min: 0 },
    deliverySubsidy: { type: Number, default: 0, min: 0 },
    paymentFeePercent: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const promoEligibilitySchema = new mongoose.Schema(
  {
    allowAutomaticSale: { type: Boolean, default: true },
    allowCoupons: { type: Boolean, default: true },
    allowPartnerCode: { type: Boolean, default: true },
  },
  { _id: false }
);

const productControlSchema = new mongoose.Schema(
  {
    sku: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SKU",
      required: true,
      unique: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    marginPolicy: {
      type: marginPolicySchema,
      default: () => ({}),
    },

    promoEligibility: {
      type: promoEligibilitySchema,
      default: () => ({}),
    },

    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1600,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

productControlSchema.index({ product: 1, updatedAt: -1 });

const ProductControl =
  mongoose.models.ProductControl ||
  mongoose.model("ProductControl", productControlSchema);

export default ProductControl;
