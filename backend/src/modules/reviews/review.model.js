import mongoose from "mongoose";

const REVIEW_STATUS = [
  "published",
  "hidden",
];

const REVIEW_TARGET_TYPE = [
  "product",
  "custom_hamper",
];

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

    targetType: {
      type: String,
      enum: REVIEW_TARGET_TYPE,
      default: "product",
      required: true,
      index: true,
    },

    /*
     * Required only for normal catalogue product reviews.
     * Custom hamper reviews keep product = null.
     */
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    /*
     * Optional reference to the original Order.items subdocument.
     *
     * IMPORTANT:
     * This field is NOT required for custom hamper reviews.
     * Older orders may not expose a usable item _id to the frontend,
     * so custom hamper eligibility is verified from the delivered order.
     */
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    targetName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 240,
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

    /*
     * Homepage review curation.
     *
     * Only admins/operations should change these fields through the
     * dedicated homepage-feature endpoint. Public homepage queries only
     * return published reviews where homepageFeatured = true.
     */
    homepageFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    homepagePosition: {
      type: Number,
      default: null,
      min: 1,
      max: 6,
    },

    homepageFeaturedAt: {
      type: Date,
      default: null,
    },

    homepageFeaturedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    moderation: {
      note: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000,
      },

      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      reviewedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Only validate the product field for normal product reviews.
 *
 * There is intentionally NO orderItemId validation for custom hampers.
 */
reviewSchema.pre(
  "validate",
  function validateReviewTarget() {
    if (
      this.targetType === "product" &&
      !this.product
    ) {
      this.invalidate(
        "product",
        "Product is required for a product review."
      );
    }

    if (
      this.targetType === "custom_hamper"
    ) {
      this.product = null;
      this.sku = null;
    }

    /*
     * Hidden reviews must never stay eligible for the homepage.
     * This is a model-level safety net in addition to controller checks.
     */
    if (this.status !== "published") {
      this.homepageFeatured = false;
      this.homepagePosition = null;
      this.homepageFeaturedAt = null;
      this.homepageFeaturedBy = null;
    }

    if (!this.homepageFeatured) {
      this.homepagePosition = null;
      this.homepageFeaturedAt = null;
      this.homepageFeaturedBy = null;
    }
  }
);

/*
 * One review per user per normal product.
 */
reviewSchema.index(
  {
    user: 1,
    product: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      targetType: "product",
      product: {
        $type: "objectId",
      },
    },
  }
);

/*
 * One custom hamper review per user per order.
 *
 * This intentionally does NOT use orderItemId.
 */
reviewSchema.index(
  {
    user: 1,
    order: 1,
    targetType: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      targetType: "custom_hamper",
    },
  }
);

reviewSchema.index({
  product: 1,
  status: 1,
  createdAt: -1,
});

reviewSchema.index({
  product: 1,
  status: 1,
  rating: 1,
});

reviewSchema.index({
  targetType: 1,
  status: 1,
  createdAt: -1,
});

reviewSchema.index({
  homepageFeatured: 1,
  status: 1,
  homepagePosition: 1,
});

const Review =
  mongoose.models.Review ||
  mongoose.model(
    "Review",
    reviewSchema
  );

export default Review;
