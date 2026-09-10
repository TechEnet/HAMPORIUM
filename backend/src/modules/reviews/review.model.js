import mongoose from "mongoose";

const REVIEW_STATUS = ["published", "hidden"];

const reviewSchema = new mongoose.Schema(
  {
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
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    sku: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SKU",
      default: null,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    comment: {
      type: String,
      trim: true,
      required: true,
      minlength: 3,
      maxlength: 2000,
    },
    verifiedPurchase: {
      type: Boolean,
      default: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: REVIEW_STATUS,
      default: "published",
      index: true,
    },
    moderation: {
      note: { type: String, trim: true, default: "", maxlength: 1000 },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ product: 1, status: 1, rating: 1 });

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;
