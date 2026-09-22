import mongoose from "mongoose";

const promotionRedemptionSchema = new mongoose.Schema(
  {
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      required: true,
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
      required: true,
      index: true,
    },
    promotionType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 40,
    },
    firstOrderLock: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ["reserved", "redeemed", "released"],
      default: "reserved",
      index: true,
    },
    discountAmount: { type: Number, default: 0, min: 0 },
    customerSavings: { type: Number, default: 0, min: 0 },
    reservedAt: { type: Date, default: Date.now },
    redeemedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

promotionRedemptionSchema.index(
  { promotion: 1, order: 1 },
  { unique: true }
);

// First-order promotions are deliberately locked to one order per customer.
// We do not silently release this lock after a failed attempt because that
// would allow multiple discounted pending orders to be created and paid later.
promotionRedemptionSchema.index(
  { promotion: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: { firstOrderLock: true },
  }
);

const PromotionRedemption =
  mongoose.models.PromotionRedemption ||
  mongoose.model("PromotionRedemption", promotionRedemptionSchema);

export default PromotionRedemption;
