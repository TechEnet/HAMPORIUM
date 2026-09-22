import mongoose from "mongoose";

import {
  CANCELLATION_STATUS,
  CANCELLATION_STATUS_VALUES,
  ORDER_STATUS,
  ORDER_STATUS_VALUES,
  ORDER_PAYMENT_STATUS,
  ORDER_PAYMENT_STATUS_VALUES,
} from "../../constants/statuses.js";

const attributionSnapshotSchema = new mongoose.Schema(
  {
    sessionId: { type: String, trim: true, default: "", maxlength: 120 },
    searchEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SearchAnalytics",
      default: null,
    },
    query: { type: String, trim: true, default: "", maxlength: 160 },
    normalizedQuery: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 160,
    },
    source: { type: String, trim: true, default: "", maxlength: 60 },
    clickedAt: { type: Date, default: null },
  },
  { _id: false }
);

const partnerAttributionSnapshotSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
      index: true,
    },
    referral: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PartnerReferral",
      default: null,
    },
    partnerId: { type: String, trim: true, default: "", maxlength: 40 },
    referralCode: { type: String, trim: true, default: "", maxlength: 40 },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PartnerProject",
      default: null,
    },
    showcase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Showcase",
      default: null,
    },
    acquiredAt: { type: Date, default: null },
    source: { type: String, trim: true, default: "", maxlength: 80 },
  },
  { _id: false }
);

const partnerPromoSnapshotSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 40,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
    },
    partnerId: { type: String, trim: true, default: "", maxlength: 40 },
    businessName: { type: String, trim: true, default: "", maxlength: 160 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    eligibleAmount: { type: Number, min: 0, default: 0 },
    // Pre-GST discount applied to eligible taxable value.
    discountAmount: { type: Number, min: 0, default: 0 },
    // GST reduction caused by the promo discount.
    taxReductionAmount: { type: Number, min: 0, default: 0 },
    // Customer-visible total saving = discountAmount + taxReductionAmount.
    customerSavings: { type: Number, min: 0, default: 0 },
    appliedAt: { type: Date, default: null },
  },
  { _id: false }
);

const promotionSnapshotSchema = new mongoose.Schema(
  {
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "automatic_sale",
        "public_coupon",
        "client_coupon",
        "customer_care",
        "first_order",
      ],
      required: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 40,
    },
    name: { type: String, trim: true, required: true, maxlength: 180 },
    customerLabel: { type: String, trim: true, default: "", maxlength: 120 },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    discountValue: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxReductionAmount: { type: Number, min: 0, default: 0 },
    customerSavings: { type: Number, min: 0, default: 0 },
    appliedSkus: [{ type: mongoose.Schema.Types.ObjectId, ref: "SKU" }],
    appliedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const partnerCommissionSnapshotSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    referralCode: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      maxlength: 40,
    },
    rate: { type: Number, min: 0, max: 100, required: true },
    eligibleValue: { type: Number, min: 0, required: true },
    basis: {
      type: String,
      enum: ["order_taxable_value"],
      default: "order_taxable_value",
    },
    lockedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const discountSnapshotSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    value: { type: Number, default: 0, min: 0 },
    amount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const taxSnapshotSchema = new mongoose.Schema(
  {
    hsnSac: { type: String, trim: true, default: "", maxlength: 40 },
    taxType: {
      type: String,
      enum: ["none", "intrastate", "interstate", "unconfigured", "mixed"],
      default: "none",
    },
    sellerState: { type: String, trim: true, default: "", maxlength: 120 },
    destinationState: { type: String, trim: true, default: "", maxlength: 120 },
    gstRate: { type: Number, default: null, min: 0, max: 100 },
    cgstRate: { type: Number, default: 0, min: 0, max: 100 },
    cgstAmount: { type: Number, default: 0, min: 0 },
    sgstRate: { type: Number, default: 0, min: 0, max: 100 },
    sgstAmount: { type: Number, default: 0, min: 0 },
    igstRate: { type: Number, default: 0, min: 0, max: 100 },
    igstAmount: { type: Number, default: 0, min: 0 },
    totalTax: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const customHamperComponentSnapshotSchema = new mongoose.Schema(
  {
    component: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Component",
      default: null,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, default: "", trim: true },
    image: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    baseUnitPrice: { type: Number, min: 0, default: undefined },
    baseLineTotal: { type: Number, min: 0, default: undefined },
    discount: { type: discountSnapshotSchema, default: undefined },
    taxableAmount: { type: Number, min: 0, default: undefined },
    tax: { type: taxSnapshotSchema, default: undefined },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const customHamperContainerSnapshotSchema = new mongoose.Schema(
  {
    basePrice: { type: Number, min: 0, default: undefined },
    discount: { type: discountSnapshotSchema, default: undefined },
    taxableAmount: { type: Number, min: 0, default: undefined },
    tax: { type: taxSnapshotSchema, default: undefined },
    finalPrice: { type: Number, min: 0, default: undefined },
  },
  { _id: false }
);

const customHamperPersonalizationAssetSnapshotSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["logo", "icon", "gift_wrap", "reference_design"],
      required: true,
    },
    url: { type: String, required: true, trim: true, maxlength: 2000 },
    publicId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      select: false,
    },
    fileName: { type: String, trim: true, default: "", maxlength: 180 },
    mimeType: { type: String, trim: true, default: "", maxlength: 100 },
    placement: {
      type: String,
      enum: [
        "top_lid",
        "front",
        "inside_lid",
        "gift_tag",
        "message_card",
        "ribbon_tag",
        "full_wrap",
        "other",
      ],
      default: "top_lid",
    },
    notes: { type: String, trim: true, default: "", maxlength: 500 },
  },
  { _id: false }
);

const customHamperPersonalizationSnapshotSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    assets: {
      type: [customHamperPersonalizationAssetSnapshotSchema],
      default: [],
    },
    message: { type: String, trim: true, default: "", maxlength: 500 },
    instructions: { type: String, trim: true, default: "", maxlength: 1500 },
  },
  { _id: false }
);

const customHamperSnapshotSchema = new mongoose.Schema(
  {
    container: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Container",
      default: null,
    },
    containerName: { type: String, required: true, trim: true },
    containerCode: { type: String, default: "", trim: true },
    containerImage: { type: String, default: "" },
    channel: {
      type: String,
      enum: ["", "corporate", "wedding", "diwali", "hamperOne"],
      default: "",
    },
    containerPricing: {
      type: customHamperContainerSnapshotSchema,
      default: undefined,
    },
    components: { type: [customHamperComponentSnapshotSchema], default: [] },
    decorations: { type: [customHamperComponentSnapshotSchema], default: [] },
    personalization: {
      type: customHamperPersonalizationSnapshotSchema,
      default: undefined,
    },
    containerPrice: { type: Number, required: true, min: 0 },
    itemsTotal: { type: Number, required: true, min: 0 },
    decorationsTotal: { type: Number, default: 0, min: 0 },
    baseSubtotal: { type: Number, min: 0, default: undefined },
    discountAmount: { type: Number, min: 0, default: undefined },
    taxableAmount: { type: Number, min: 0, default: undefined },
    taxAmount: { type: Number, min: 0, default: undefined },
    hamperUnitPrice: { type: Number, required: true, min: 0 },
    capacity: {
      usedVolumeCm3: { type: Number, default: null },
      usableVolumeCm3: { type: Number, default: null },
      remainingVolumeCm3: { type: Number, default: null },
      usedWeightGrams: { type: Number, default: null },
      maxWeightGrams: { type: Number, default: null },
      remainingWeightGrams: { type: Number, default: null },
      itemCount: { type: Number, default: null },
      maxItems: { type: Number, default: null },
    },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
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
      required() {
        return this.itemType === "sku";
      },
    },

    sku: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SKU",
      default: null,
      required() {
        return this.itemType === "sku";
      },
    },

    productName: { type: String, required: true },
    productSlug: { type: String, default: "" },
    skuName: { type: String, default: "" },
    skuCode: { type: String, default: "" },
    image: { type: String, default: "" },

    optionValues: { type: Map, of: String, default: {} },

    customHamper: {
      type: customHamperSnapshotSchema,
      default: undefined,
      required() {
        return this.itemType === "custom_hamper";
      },
    },

    attribution: { type: attributionSnapshotSchema, default: undefined },

    quantity: { type: Number, required: true, min: 1 },

    baseUnitPrice: { type: Number, min: 0, default: undefined },
    baseLineTotal: { type: Number, min: 0, default: undefined },
    discount: { type: discountSnapshotSchema, default: undefined },

    // Separate discount buckets keep catalogue, HAMPORIUM promotion and partner
    // promo values independently auditable.
    promotionDiscountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    partnerPromoDiscountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    taxableAmount: { type: Number, min: 0, default: undefined },
    tax: { type: taxSnapshotSchema, default: undefined },

    /* Customer-facing post-discount + GST values. */
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const recipientSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const addressSnapshotSchema = new mongoose.Schema(
  {
    label: String,
    fullName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    landmark: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  { _id: false }
);

const deliveryPlanSchema = new mongoose.Schema(
  {
    materialsReadyDate: { type: Date, default: null },
    dispatchReadyDate: { type: Date, default: null },
    expectedDeliveryDate: { type: Date, default: null },
    calculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderAnalyticsSchema = new mongoose.Schema(
  {
    sessionId: { type: String, trim: true, default: "", maxlength: 120 },
    source: {
      type: String,
      trim: true,
      default: "checkout",
      maxlength: 60,
    },
    pagePath: { type: String, trim: true, default: "", maxlength: 500 },
  },
  { _id: false }
);

const taxSummarySchema = new mongoose.Schema(
  {
    sellerState: { type: String, trim: true, default: "", maxlength: 120 },
    destinationState: { type: String, trim: true, default: "", maxlength: 120 },
    taxType: {
      type: String,
      enum: ["none", "intrastate", "interstate", "unconfigured"],
      default: "none",
    },
    taxableAmount: { type: Number, default: 0, min: 0 },
    cgstAmount: { type: Number, default: 0, min: 0 },
    sgstAmount: { type: Number, default: 0, min: 0 },
    igstAmount: { type: Number, default: 0, min: 0 },
    totalTax: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const commercialLineItemSnapshotSchema = new mongoose.Schema(
  {
    productReference: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: "" },
    image: { type: String, trim: true, default: "" },
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, required: true },
    personalization: { type: String, trim: true, default: "" },
    packaging: { type: String, trim: true, default: "" },
    lineTotal: { type: Number, min: 0, required: true },
  },
  { _id: false }
);

const commercialSnapshotSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ["quote"],
      default: "quote",
    },
    quoteId: { type: String, trim: true, default: "" },
    rfqId: { type: String, trim: true, default: "" },
    versionNumber: { type: Number, min: 1, required: true },
    lineItems: { type: [commercialLineItemSnapshotSchema], default: [] },
    subtotal: { type: Number, min: 0, default: 0 },
    discount: { type: Number, min: 0, default: 0 },
    freight: { type: Number, min: 0, default: 0 },
    taxRate: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
    leadTimeDays: { type: Number, min: 0, default: 0 },
    paymentTerms: { type: String, trim: true, default: "" },
    validUntil: { type: Date, default: null },
    assumptions: { type: [String], default: [] },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const bulkOrderSnapshotSchema = new mongoose.Schema(
  {
    quantity: { type: Number, min: 1, default: 1 },
    companyName: { type: String, trim: true, default: "" },
    gstNumber: { type: String, trim: true, uppercase: true, default: "" },
    occasion: { type: String, trim: true, default: "" },
    addressModel: {
      type: String,
      enum: ["single_address", "multiple_addresses", "not_decided"],
      default: "not_decided",
    },
    deliveryLocations: { type: [String], default: [] },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const cancellationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: CANCELLATION_STATUS_VALUES,
      default: CANCELLATION_STATUS.NONE,
      index: true,
    },
    reason: { type: String, trim: true, default: "", maxlength: 1000 },
    requestedAt: { type: Date, default: null },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewNote: { type: String, trim: true, default: "", maxlength: 1000 },
    refund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },

    checkoutKey: { type: String, required: true },

    checkoutMode: {
      type: String,
      enum: ["cart", "buy_now", "quote"],
      default: "cart",
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: { type: [orderItemSchema], required: true },

    quote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
      default: null,
    },

    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
      default: null,
      index: true,
    },

    commercialSnapshot: {
      type: commercialSnapshotSchema,
      default: undefined,
    },

    bulkOrder: {
      type: bulkOrderSnapshotSchema,
      default: undefined,
    },

    recipient: {
      type: recipientSchema,
      default: undefined,
      required() {
        return this.checkoutMode !== "quote";
      },
    },

    deliveryAddress: {
      type: addressSnapshotSchema,
      default: undefined,
      required() {
        return this.checkoutMode !== "quote";
      },
    },

    deliveryDate: {
      type: Date,
      default: null,
      required() {
        return this.checkoutMode !== "quote";
      },
    },

    deliveryPlan: {
      type: deliveryPlanSchema,
      default: undefined,
    },

    giftMessage: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    analytics: { type: orderAnalyticsSchema, default: () => ({}) },

    partnerAttribution: {
      type: partnerAttributionSnapshotSchema,
      default: undefined,
    },

    promotionSnapshots: {
      type: [promotionSnapshotSchema],
      default: [],
    },

    partnerPromo: {
      type: partnerPromoSnapshotSchema,
      default: undefined,
    },

    // Private checkout-time lock for partner commission. This is deliberately
    // excluded from normal queries and customer responses.
    partnerCommissionSnapshot: {
      type: partnerCommissionSnapshotSchema,
      default: undefined,
      select: false,
    },

    /*
     * baseSubtotal = before all discounts/GST
     * discountAmount = catalogue + HAMPORIUM promotion + partner promo discounts
     * taxableAmount = after all discounts, before GST
     * subtotal = final item total including GST, before shipping
     */
    baseSubtotal: { type: Number, min: 0, default: undefined },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxableAmount: { type: Number, min: 0, default: undefined },
    taxAmount: { type: Number, min: 0, default: undefined },
    taxSummary: { type: taxSummarySchema, default: undefined },
    subtotal: { type: Number, required: true, min: 0 },
    shippingAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    currency: { type: String, default: "INR" },

    status: {
      type: String,
      enum: ORDER_STATUS_VALUES,
      default: ORDER_STATUS.PENDING_PAYMENT,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ORDER_PAYMENT_STATUS_VALUES,
      default: ORDER_PAYMENT_STATUS.PENDING,
      index: true,
    },

    cancellation: {
      type: cancellationSchema,
      default: () => ({ status: CANCELLATION_STATUS.NONE }),
    },

    razorpayOrderId: { type: String, default: "", index: true },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    paidAt: { type: Date, default: null },

    invoiceNumber: { type: String, trim: true, default: undefined },
    invoiceIssuedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, checkoutKey: 1 }, { unique: true });
orderSchema.index(
  { quote: 1 },
  {
    unique: true,
    partialFilterExpression: {
      quote: { $type: "objectId" },
    },
  }
);
orderSchema.index({ rfq: 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, paidAt: -1 });
orderSchema.index({ status: 1, deliveryDate: 1 });
orderSchema.index({ "partnerAttribution.partner": 1, createdAt: -1 });
orderSchema.index({ "partnerPromo.partner": 1, createdAt: -1 });
orderSchema.index({ "partnerPromo.code": 1, createdAt: -1 });
orderSchema.index({ "promotionSnapshots.promotion": 1, createdAt: -1 });
orderSchema.index({ "promotionSnapshots.code": 1, createdAt: -1 });
orderSchema.index({ "cancellation.status": 1, "cancellation.requestedAt": -1 });
orderSchema.index(
  { invoiceNumber: 1 },
  {
    unique: true,
    sparse: true,
  }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
