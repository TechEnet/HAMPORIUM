import mongoose from "mongoose";

export const PROMOTION_TYPES = [
  "automatic_sale",
  "public_coupon",
  "client_coupon",
  "customer_care",
  "first_order",
];

export const PROMOTION_STATUSES = ["draft", "active", "paused", "expired"];

const discountSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    value: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const automaticBandSchema = new mongoose.Schema(
  {
    minDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
    targetDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
    maxDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const scopeSchema = new mongoose.Schema(
  {
    allSkus: { type: Boolean, default: true },
    skus: [{ type: mongoose.Schema.Types.ObjectId, ref: "SKU" }],
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    collections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Collection" }],
  },
  { _id: false }
);

const audienceSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    emails: {
      type: [String],
      default: [],
      set: (values) =>
        (Array.isArray(values) ? values : [])
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean),
    },
  },
  { _id: false }
);

const displayImageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: "", maxlength: 2000 },
    publicId: { type: String, trim: true, default: "", maxlength: 500 },
    alt: { type: String, trim: true, default: "", maxlength: 180 },
  },
  { _id: false }
);

const websiteDisplaySchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    announcementBar: { type: Boolean, default: false },
    homeBanner: { type: Boolean, default: false },
    productBadge: { type: Boolean, default: false },
    checkoutNote: { type: Boolean, default: false },
    popupAd: { type: Boolean, default: false },
    floatingAd: { type: Boolean, default: false },
    adFrequency: {
      type: String,
      enum: ["once_per_session", "once_per_day", "always"],
      default: "once_per_session",
    },
    adDelaySeconds: { type: Number, default: 2, min: 0, max: 30 },
    floatingPosition: {
      type: String,
      enum: ["bottom_right", "bottom_left"],
      default: "bottom_right",
    },

    headline: { type: String, trim: true, default: "", maxlength: 120 },
    message: { type: String, trim: true, default: "", maxlength: 260 },
    buttonLabel: { type: String, trim: true, default: "", maxlength: 40 },
    buttonLink: { type: String, trim: true, default: "", maxlength: 500 },
    badgeText: { type: String, trim: true, default: "", maxlength: 40 },

    theme: {
      type: String,
      enum: ["cream", "dark", "orange", "gold"],
      default: "cream",
    },
    imagePosition: {
      type: String,
      enum: ["center", "top", "bottom", "left", "right"],
      default: "center",
    },
    overlayPercent: { type: Number, default: 38, min: 0, max: 90 },
    desktopImage: { type: displayImageSchema, default: () => ({}) },
    mobileImage: { type: displayImageSchema, default: () => ({}) },
  },
  { _id: false }
);

const promotionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 180 },
    type: {
      type: String,
      enum: PROMOTION_TYPES,
      required: true,
      index: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 40,
      default: undefined,
    },
    status: {
      type: String,
      enum: PROMOTION_STATUSES,
      default: "draft",
      index: true,
    },
    discount: {
      type: discountSchema,
      default: () => ({ type: "percentage", value: 0 }),
    },
    automaticBand: {
      type: automaticBandSchema,
      default: () => ({
        minDiscountPercent: 0,
        targetDiscountPercent: 0,
        maxDiscountPercent: 0,
      }),
    },
    minGrossMarginPercent: { type: Number, default: null, min: 0, max: 100 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    maxDiscountAmount: { type: Number, default: 0, min: 0 },
    stackWithAutomaticSale: { type: Boolean, default: false },
    scope: { type: scopeSchema, default: () => ({ allSkus: true }) },
    audience: {
      type: audienceSchema,
      default: () => ({ users: [], emails: [] }),
    },
    websiteDisplay: {
      type: websiteDisplaySchema,
      default: () => ({
        enabled: false,
        announcementBar: false,
        homeBanner: false,
        productBadge: false,
        checkoutNote: false,
        popupAd: false,
        floatingAd: false,
        adFrequency: "once_per_session",
        adDelaySeconds: 2,
        floatingPosition: "bottom_right",
        headline: "",
        message: "",
        buttonLabel: "",
        buttonLink: "",
        badgeText: "",
        theme: "cream",
        imagePosition: "center",
        overlayPercent: 38,
        desktopImage: {},
        mobileImage: {},
      }),
    },
    startsAt: { type: Date, default: null, index: true },
    endsAt: { type: Date, default: null, index: true },
    priority: { type: Number, default: 0, min: -1000, max: 1000 },
    customerLabel: { type: String, trim: true, default: "", maxlength: 120 },
    internalNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
      select: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

promotionSchema.pre("validate", function normalizePromotion() {
  if (this.code) this.code = String(this.code).trim().toUpperCase();

  if (this.type === "automatic_sale") {
    this.code = undefined;
    this.discount = {
      type: "percentage",
      value: Number(this.automaticBand?.targetDiscountPercent || 0),
    };
  }

  if (
    ["public_coupon", "client_coupon", "customer_care"].includes(this.type) &&
    !this.code
  ) {
    this.invalidate("code", "Coupon code is required for this promotion type");
  }

  if (
    this.type === "first_order" &&
    !this.code &&
    this.discount?.type !== "percentage"
  ) {
    this.invalidate(
      "discount.type",
      "Automatic first-order offers must use a percentage discount. Add a code to use a fixed first-order discount."
    );
  }

  if (this.discount?.type === "percentage" && Number(this.discount.value) > 100) {
    this.invalidate("discount.value", "Percentage discount cannot exceed 100");
  }

  if (this.type === "automatic_sale") {
    const min = Number(this.automaticBand?.minDiscountPercent || 0);
    const target = Number(this.automaticBand?.targetDiscountPercent || 0);
    const max = Number(this.automaticBand?.maxDiscountPercent || 0);

    if (target < min) {
      this.invalidate(
        "automaticBand.targetDiscountPercent",
        "Target discount cannot be lower than minimum discount"
      );
    }
    if (max < target) {
      this.invalidate(
        "automaticBand.maxDiscountPercent",
        "Maximum discount cannot be lower than target discount"
      );
    }
  }

  if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
    this.invalidate("endsAt", "Promotion end date must be after start date");
  }

  if (!this.scope) this.scope = { allSkus: true };
  const scoped =
    (this.scope.skus?.length || 0) +
    (this.scope.products?.length || 0) +
    (this.scope.categories?.length || 0) +
    (this.scope.collections?.length || 0);
  if (!scoped) this.scope.allSkus = true;

  if (!this.websiteDisplay) return;
  const display = this.websiteDisplay;
  const anyPlacement =
    display.announcementBar ||
    display.homeBanner ||
    display.productBadge ||
    display.checkoutNote ||
    display.popupAd ||
    display.floatingAd;
  if (!anyPlacement) display.enabled = false;
});

promotionSchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { code: { $type: "string" } },
  }
);
promotionSchema.index({ status: 1, type: 1, startsAt: 1, endsAt: 1 });
promotionSchema.index({ "scope.skus": 1, status: 1 });
promotionSchema.index({ "scope.products": 1, status: 1 });
promotionSchema.index({ priority: -1, createdAt: -1 });
promotionSchema.index({ "websiteDisplay.enabled": 1, status: 1, priority: -1 });

const Promotion =
  mongoose.models.Promotion || mongoose.model("Promotion", promotionSchema);

export default Promotion;
