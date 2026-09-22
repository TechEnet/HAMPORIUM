import mongoose from "mongoose";
import Cart from "../cart/cart.model.js";
import { validateCustomHamper } from "../cart/cart.controller.js";
import SKU from "../catalog/sku.model.js";
import Address from "../users/address.model.js";
import ProductionJob from "../production/productionJob.model.js";
import Fulfilment from "../fulfilment/fulfilment.model.js";
import Order from "./order.model.js";
import Partner from "../partners/partner.model.js";
import PartnerReferral from "../partners/partnerReferral.model.js";
import { resolvePartnerAttributionForOrder } from "../partners/partnerReferral.controller.js";
import Promotion from "../promotions/promotion.model.js";
import {
  applyPartnerCodeWithMarginGuard,
  applyPromotionEngine,
  normalizePromotionCode,
  reservePromotionRedemptionsForOrder,
  resolvePromotionByCode,
} from "../promotions/promotion.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import generateId from "../../utils/generateId.js";
import createAuditLog from "../../helpers/createAuditLog.js";
import notifyUser from "../../helpers/notifyUser.js";
import {
  CANCELLATION_STATUS,
  CUSTOMER_ORDER_STATUS,
  FULFILMENT_STATUS,
  NOTIFICATION_TYPE,
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
  PRODUCT_STATUS,
  PRODUCTION_STAGE,
} from "../../constants/statuses.js";
import {
  aggregateTaxLines,
  calculateTaxLine,
  resolveTaxMode,
} from "../tax/tax.service.js";
import {
  recordCommerceEvent,
  resolveSearchAttribution,
} from "../analytics/commerceAnalytics.service.js";
import {
  ensureOrderInvoiceIdentity,
  streamOrderInvoicePdf,
} from "./invoice.service.js";
const isValidId = (id) => mongoose.isValidObjectId(id);
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const cleanString = (value, maxLength = 160) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
const parseDeliveryDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date < today) return null;
  return date;
};
const validateCartQuantity = (value) => {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 99
    ? quantity
    : null;
};
const normalizeAttribution = (value) => {
  if (!value) return undefined;
  const sessionId = cleanString(value.sessionId, 120);
  const query = cleanString(value.query, 160);
  const normalizedQuery = cleanString(
    value.normalizedQuery || value.query,
    160
  ).toLowerCase();
  const source = cleanString(value.source, 60);
  if (!sessionId && !query && !normalizedQuery && !source && !value.searchEvent) {
    return undefined;
  }
  return {
    sessionId,
    searchEvent:
      value.searchEvent && isValidId(value.searchEvent)
        ? value.searchEvent
        : null,
    query,
    normalizedQuery,
    source,
    clickedAt: value.clickedAt || null,
  };
};
const buildPersonalizationSnapshot = (personalization) => {
  if (!personalization?.enabled) return undefined;
  const assets = Array.isArray(personalization.assets)
    ? personalization.assets
        .slice(0, 4)
        .filter((asset) => asset?.url && asset?.type)
        .map((asset) => ({
          type: cleanString(asset.type, 40).toLowerCase(),
          url: cleanString(asset.url, 2000),
          publicId: cleanString(asset.publicId, 500),
          fileName: cleanString(asset.fileName, 180),
          mimeType: cleanString(asset.mimeType, 100).toLowerCase(),
          placement: cleanString(asset.placement || "top_lid", 40).toLowerCase(),
          notes: cleanString(asset.notes, 500),
        }))
    : [];
  const message = cleanString(personalization.message, 500);
  const instructions = cleanString(personalization.instructions, 1500);
  if (!assets.length && !message && !instructions) return undefined;
  return { enabled: true, assets, message, instructions };
};
const buildSkuOrderItem = (
  sourceItem,
  sku,
  destinationState,
  attributionOverride = undefined
) => {
  const quantity = validateCartQuantity(sourceItem.quantity);
  if (!quantity) return null;
  const baseUnitPrice = roundMoney(
    sku.baseSellingPrice ?? sku.price ?? 0
  );
  const pricing = calculateTaxLine({
    baseUnitPrice,
    quantity,
    taxPercent: sku.taxPercent ?? 0,
    hsnSac: sku.hsnSac || "",
    taxEnabled: sku.taxEnabled !== false,
    discount: sku.discount || {},
    destinationState,
  });
  return {
    itemType: "sku",
    product: sku.product._id,
    sku: sku._id,
    productName: sku.product.name,
    productSlug: sku.product.slug,
    skuName: sku.name,
    skuCode: sku.code,
    image: sku.images?.[0]?.url || sku.product.images?.[0]?.url || "",
    optionValues: sku.optionValues || {},
    attribution: normalizeAttribution(
      attributionOverride || sourceItem.attribution
    ),
    quantity,
    baseUnitPrice: pricing.baseUnitPrice,
    baseLineTotal: pricing.baseLineTotal,
    discount: {
      ...pricing.discount,
      amount: pricing.discountAmount,
    },
    promotionDiscountAmount: 0,
    partnerPromoDiscountAmount: 0,
    taxableAmount: pricing.taxableValue,
    tax: pricing.tax,
    unitPrice: pricing.unitPrice,
    lineTotal: pricing.lineTotal,
  };
};
const buildCustomHamperOrderItem = async (
  cartItem,
  destinationState
) => {
  const quantity = validateCartQuantity(cartItem.quantity);
  if (!quantity) {
    return {
      error: "Invalid custom hamper quantity",
    };
  }
  const customHamper = cartItem.customHamper;
  if (!customHamper?.container || !Array.isArray(customHamper.items)) {
    return {
      error: "Custom hamper configuration is incomplete",
    };
  }
  const validation = await validateCustomHamper({
    containerId: customHamper.container,
    items: customHamper.items,
    decorations: customHamper.decorations || [],
    channel: customHamper.channel || "",
  });
  if (!validation.orderable) {
    return {
      error:
        validation.message ||
        "Custom hamper is no longer orderable. Please rebuild it.",
    };
  }
  const componentMap = new Map(
    (validation.components || []).map((component) => [
      String(component._id),
      component,
    ])
  );
  const container = validation.container;
  const containerPricing = calculateTaxLine({
    baseUnitPrice: roundMoney(container?.sellingPrice),
    quantity: 1,
    taxPercent: container?.taxPercent ?? 0,
    hsnSac: container?.hsnSac || "",
    taxEnabled: container?.taxEnabled !== false,
    discount: container?.discount || {},
    destinationState,
  });
  const componentPricingLines = [];
  const decorationPricingLines = [];
  const buildComponentSnapshots = (selections, pricingLines, fallbackName) =>
    selections.map((selection) => {
      const component = componentMap.get(String(selection.componentId));
      const pricing = calculateTaxLine({
        baseUnitPrice: roundMoney(component?.sellingPrice),
        quantity: Number(selection.quantity || 1),
        taxPercent: component?.taxPercent ?? 0,
        hsnSac: component?.hsnSac || "",
        taxEnabled: component?.taxEnabled !== false,
        discount: component?.discount || {},
        destinationState,
      });
      pricingLines.push(pricing);
      return {
        component: component?._id || null,
        name: component?.name || fallbackName,
        code: component?.code || "",
        image: component?.images?.[0]?.url || "",
        quantity: Number(selection.quantity || 1),
        baseUnitPrice: pricing.baseUnitPrice,
        baseLineTotal: pricing.baseLineTotal,
        discount: {
          ...pricing.discount,
          amount: pricing.discountAmount,
        },
        taxableAmount: pricing.taxableValue,
        tax: pricing.tax,
        unitPrice: pricing.unitPrice,
        lineTotal: pricing.lineTotal,
      };
    });
  const components = buildComponentSnapshots(
    validation.items || [],
    componentPricingLines,
    "Custom hamper item"
  );
  const decorations = buildComponentSnapshots(
    validation.decorations || [],
    decorationPricingLines,
    "Decorative material"
  );
  const perHamperAggregate = aggregateTaxLines([
    containerPricing,
    ...componentPricingLines,
    ...decorationPricingLines,
  ]);
  const scale = (value) => roundMoney(Number(value || 0) * quantity);
  const resolvedTaxMode = resolveTaxMode(destinationState);
  const taxType =
    perHamperAggregate.totalTax > 0 ? resolvedTaxMode.mode : "none";
  const itemTax = {
    hsnSac: "MULTI",
    taxType,
    sellerState: resolvedTaxMode.sellerState || "",
    destinationState: resolvedTaxMode.destinationState || destinationState,
    gstRate: null,
    cgstRate: 0,
    cgstAmount: scale(perHamperAggregate.cgstAmount),
    sgstRate: 0,
    sgstAmount: scale(perHamperAggregate.sgstAmount),
    igstRate: 0,
    igstAmount: scale(perHamperAggregate.igstAmount),
    totalTax: scale(perHamperAggregate.totalTax),
  };
  const unitPrice = roundMoney(perHamperAggregate.subtotal);
  const lineTotal = scale(unitPrice);
  return {
    item: {
      itemType: "custom_hamper",
      product: null,
      sku: null,
      productName: "Custom Hamper",
      productSlug: "",
      skuName: container?.name || "Custom Hamper Box",
      skuCode: container?.code || "CUSTOM-HAMPER",
      image: container?.images?.[0]?.url || "",
      optionValues: {},
      attribution: normalizeAttribution(cartItem.attribution),
      customHamper: {
        container: container?._id || customHamper.container,
        containerName: container?.name || "Custom Hamper Box",
        containerCode: container?.code || "",
        containerImage: container?.images?.[0]?.url || "",
        channel: customHamper.channel || "",
        containerPricing: {
          basePrice: containerPricing.baseUnitPrice,
          discount: {
            ...containerPricing.discount,
            amount: containerPricing.discountAmount,
          },
          taxableAmount: containerPricing.taxableValue,
          tax: containerPricing.tax,
          finalPrice: containerPricing.lineTotal,
        },
        components,
        decorations,
        personalization: buildPersonalizationSnapshot(customHamper.personalization),
        containerPrice: containerPricing.lineTotal,
        itemsTotal: roundMoney(
          componentPricingLines.reduce(
            (sum, line) => sum + Number(line.lineTotal || 0),
            0
          )
        ),
        decorationsTotal: roundMoney(
          decorationPricingLines.reduce(
            (sum, line) => sum + Number(line.lineTotal || 0),
            0
          )
        ),
        baseSubtotal: perHamperAggregate.baseSubtotal,
        discountAmount: perHamperAggregate.discountAmount,
        taxableAmount: perHamperAggregate.taxableAmount,
        taxAmount: perHamperAggregate.totalTax,
        hamperUnitPrice: unitPrice,
        capacity: validation.capacity || {},
      },
      quantity,
      baseUnitPrice: perHamperAggregate.baseSubtotal,
      baseLineTotal: scale(perHamperAggregate.baseSubtotal),
      discount: {
        enabled: perHamperAggregate.discountAmount > 0,
        type: "fixed",
        value: perHamperAggregate.discountAmount,
        amount: scale(perHamperAggregate.discountAmount),
      },
      promotionDiscountAmount: 0,
      partnerPromoDiscountAmount: 0,
      taxableAmount: scale(perHamperAggregate.taxableAmount),
      tax: itemTax,
      unitPrice,
      lineTotal,
    },
  };
};
/* =====================================================
   PROMOTIONS / PARTNER PROMO SNAPSHOTS
   - Normal HAMPORIUM promotions are handled by promotion.service.js.
   - Partner codes are exclusive and use margin guard with commission included.
   - Custom hampers stay outside retail coupon/partner discount eligibility in V1.
===================================================== */
const buildPartnerPromoSnapshot = ({ promo, result }) => {
  if (!promo || !result) return undefined;

  return {
    code: result.referralCode,
    partner: result.partner,
    partnerId: result.partnerId,
    businessName: result.businessName,
    discountPercent: promo.rate,
    eligibleAmount: promo.eligibleAmount,
    discountAmount: promo.discountAmount,
    taxReductionAmount: promo.taxReductionAmount,
    customerSavings: promo.customerSavings,
    appliedAt: new Date(),
  };
};

const buildPartnerCommissionSnapshot = ({ promo, result }) => {
  if (!promo || !result?.partner || !result?.referralCode) return undefined;

  const rate = Number(result.commissionRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    const error = new Error("Partner commission configuration is invalid.");
    error.statusCode = 500;
    throw error;
  }

  return {
    partner: result.partner,
    referralCode: result.referralCode,
    rate,
    eligibleValue: roundMoney(
      promo.eligibleValueAfterDiscount ??
        Math.max(
          0,
          Number(promo.eligibleAmount || 0) -
            Number(promo.discountAmount || 0)
        )
    ),
    basis: "order_taxable_value",
    lockedAt: new Date(),
  };
};

const toPublicOrder = (order) => {
  const data =
    typeof order?.toObject === "function" ? order.toObject() : { ...order };
  delete data.partnerCommissionSnapshot;
  return data;
};

const validateCheckoutInput = async ({
  userId,
  checkoutKey,
  addressId,
  recipient,
  deliveryDate,
  giftMessage,
}) => {
  if (
    !checkoutKey ||
    String(checkoutKey).trim().length < 8 ||
    String(checkoutKey).trim().length > 100
  ) {
    return {
      errorStatus: 400,
      errorMessage: "Valid checkout key is required",
    };
  }
  if (!isValidId(addressId)) {
    return {
      errorStatus: 400,
      errorMessage: "Valid delivery address is required",
    };
  }
  if (!recipient?.fullName?.trim() || !recipient?.phone?.trim()) {
    return {
      errorStatus: 400,
      errorMessage: "Recipient name and phone are required",
    };
  }
  const parsedDeliveryDate = parseDeliveryDate(deliveryDate);
  if (!parsedDeliveryDate) {
    return {
      errorStatus: 400,
      errorMessage: "Enter a valid delivery date",
    };
  }
  if (giftMessage && String(giftMessage).length > 500) {
    return {
      errorStatus: 400,
      errorMessage: "Gift message cannot exceed 500 characters",
    };
  }
  const address = await Address.findOne({
    _id: addressId,
    user: userId,
  }).lean();
  if (!address) {
    return {
      errorStatus: 404,
      errorMessage: "Delivery address not found",
    };
  }
  return {
    normalizedCheckoutKey: String(checkoutKey).trim(),
    parsedDeliveryDate,
    address,
    recipient: {
      fullName: recipient.fullName.trim(),
      phone: recipient.phone.trim(),
    },
    giftMessage: String(giftMessage || "").trim(),
  };
};
const buildDeliveryAddressSnapshot = (address) => ({
  label: address.label || "",
  fullName: address.fullName,
  phone: address.phone,
  addressLine1: address.addressLine1,
  addressLine2: address.addressLine2 || "",
  landmark: address.landmark || "",
  city: address.city,
  state: address.state,
  postalCode: address.postalCode,
  country: address.country || "India",
});
const toValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const buildDeliveryPlanSnapshot = (estimate, fallbackExpectedDate) => {
  const expectedDeliveryDate = toValidDate(
    estimate?.expectedDeliveryDate || fallbackExpectedDate
  );
  if (!expectedDeliveryDate) return undefined;
  return {
    materialsReadyDate: toValidDate(estimate?.materialsReadyDate),
    dispatchReadyDate: toValidDate(estimate?.dispatchReadyDate),
    expectedDeliveryDate,
    calculatedAt: new Date(),
  };
};
const calculateTotals = (items, destinationState) => {
  const aggregate = aggregateTaxLines(
    items.map((item) => ({
      baseLineTotal: item.baseLineTotal,
      discountAmount: roundMoney(
        Number(item.discount?.amount || 0) +
          Number(item.promotionDiscountAmount || 0) +
          Number(item.partnerPromoDiscountAmount || 0)
      ),
      taxableValue: item.taxableAmount,
      tax: item.tax,
      lineTotal: item.lineTotal,
    }))
  );
  const shippingAmount = 0;
  const totalAmount = roundMoney(aggregate.subtotal + shippingAmount);
  const taxMode = resolveTaxMode(destinationState);
  return {
    baseSubtotal: aggregate.baseSubtotal,
    discountAmount: aggregate.discountAmount,
    taxableAmount: aggregate.taxableAmount,
    taxAmount: aggregate.totalTax,
    taxSummary: {
      sellerState: taxMode.sellerState,
      destinationState: taxMode.destinationState,
      taxType: aggregate.totalTax > 0 ? taxMode.mode : "none",
      taxableAmount: aggregate.taxableAmount,
      cgstAmount: aggregate.cgstAmount,
      sgstAmount: aggregate.sgstAmount,
      igstAmount: aggregate.igstAmount,
      totalTax: aggregate.totalTax,
    },
    subtotal: aggregate.subtotal,
    shippingAmount,
    totalAmount,
  };
};
const recordCheckoutAnalytics = async (order) => {
  try {
    const firstAttribution = (order.items || [])
      .map((item) => item.attribution)
      .find(Boolean);
    await recordCommerceEvent({
      eventType: "checkout_start",
      userId: order.user,
      sessionId: order.analytics?.sessionId || firstAttribution?.sessionId,
      source: order.analytics?.source || firstAttribution?.source || "checkout",
      pagePath: order.analytics?.pagePath,
      orderId: order._id,
      checkoutMode: order.checkoutMode || "cart",
      value: order.totalAmount,
      currency: order.currency,
      location: order.deliveryAddress,
      attribution: firstAttribution,
      eventKey: `checkout:${order._id}`,
    });
  } catch (error) {
    console.error("Checkout analytics failed:", error.message);
  }
};
const applyPartnerReferralOrderMetrics = async (partnerAttribution, order) => {
  if (!partnerAttribution?.referral) return;
  try {
    await PartnerReferral.updateOne(
      { _id: partnerAttribution.referral },
      {
        $set: { lastAttributedAt: new Date() },
        $inc: {
          attributedOrderCount: 1,
          attributedOrderValue: Number(order.totalAmount || 0),
        },
      }
    );
  } catch (error) {
    console.error("Partner referral metric update failed:", error.message);
  }
};
const resolveCheckoutPromotionContext = async ({
  user,
  partnerReferralCode,
  promoCode,
  partnerProjectId,
  showcaseId,
  source,
}) => {
  const partnerCode = normalizePromotionCode(partnerReferralCode);
  const promotionCode = normalizePromotionCode(promoCode);

  const submittedCode = promotionCode || partnerCode;
  if (submittedCode) {
    const [promotionNamespaceExists, partnerNamespaceExists] = await Promise.all([
      Promotion.exists({ code: submittedCode }),
      Partner.exists({ referralCode: submittedCode }),
    ]);

    if (promotionNamespaceExists && partnerNamespaceExists) {
      const error = new Error(
        "This code has a configuration conflict. Please contact HAMPORIUM support."
      );
      error.statusCode = 409;
      throw error;
    }
  }

  // Security rule: code type is explicit and unambiguous.
  // A client cannot submit the same text in both fields and let the server
  // reinterpret it as whichever type happens to succeed.
  if (partnerCode && promotionCode) {
    const error = new Error(
      "Only one promotion or partner code can be used on an order."
    );
    error.statusCode = 400;
    throw error;
  }

  // HAMPORIUM promotion codes are resolved ONLY as promotions. They are
  // revalidated server-side for status, dates, audience and first-order rules.
  if (promotionCode) {
    if (partnerProjectId || showcaseId) {
      const error = new Error(
        "A HAMPORIUM promotion code cannot be combined with a partner project or showcase."
      );
      error.statusCode = 400;
      throw error;
    }

    const promotion = await resolvePromotionByCode({
      code: promotionCode,
      user,
    });

    if (!promotion) {
      const error = new Error(
        "Promotion code is invalid, expired, or unavailable for this account."
      );
      error.statusCode = 400;
      throw error;
    }

    return {
      kind: "promotion",
      explicitCode: promotionCode,
      partnerAttributionResult: null,
      promotion,
    };
  }

  // Partner codes are resolved ONLY as approved partner referrals. This path
  // keeps self-referral, project/showcase ownership and commission checks in
  // the partner module instead of silently falling back to a normal coupon.
  if (partnerCode) {
    const partnerAttributionResult = await resolvePartnerAttributionForOrder({
      userId: user?._id || user?.id,
      referralCode: partnerCode,
      projectId: partnerProjectId,
      showcaseId,
      source,
    });

    if (!partnerAttributionResult?.promo) {
      const error = new Error(
        "Partner code is invalid, expired, or the partner is not approved."
      );
      error.statusCode = 400;
      throw error;
    }

    return {
      kind: "partner",
      explicitCode: partnerCode,
      partnerAttributionResult,
      promotion: null,
    };
  }

  // No retail code: persistent partner attribution is allowed only when an
  // explicit project/showcase context exists. It must not create a retail
  // partner discount or commission by itself.
  let partnerAttributionResult = null;
  if (partnerProjectId || showcaseId) {
    partnerAttributionResult = await resolvePartnerAttributionForOrder({
      userId: user?._id || user?.id,
      referralCode: "",
      projectId: partnerProjectId,
      showcaseId,
      source,
    });
  }

  return {
    kind: "none",
    explicitCode: "",
    partnerAttributionResult,
    promotion: null,
  };
};

const reserveOrderPromotions = async (order, promotionSnapshots) => {
  if (!promotionSnapshots?.length) return;

  try {
    await reservePromotionRedemptionsForOrder({
      order,
      promotionSnapshots,
    });
  } catch (error) {
    // A first-order lock can lose a concurrency race. Remove only the unpaid
    // order we just created so the customer is not left with an unusable order.
    await Order.deleteOne({
      _id: order._id,
      paymentStatus: ORDER_PAYMENT_STATUS.PENDING,
    });
    throw error;
  }
};

export const createOrder = asyncHandler(async (req, res) => {
  const {
    checkoutKey,
    addressId,
    recipient,
    deliveryDate,
    giftMessage,
    analytics = {},
    promoCode = "",
    partnerReferralCode = "",
    partnerProjectId = null,
    showcaseId = null,
  } = req.body;
  const checkout = await validateCheckoutInput({
    userId: req.user._id,
    checkoutKey,
    addressId,
    recipient,
    deliveryDate,
    giftMessage,
  });
  if (checkout.errorMessage) {
    return res.status(checkout.errorStatus).json({
      success: false,
      message: checkout.errorMessage,
    });
  }
  const existingOrder = await Order.findOne({
    user: req.user._id,
    checkoutKey: checkout.normalizedCheckoutKey,
  });
  if (existingOrder) {
    return res.status(200).json({
      success: true,
      message: "Order already created",
      order: toPublicOrder(existingOrder),
    });
  }
  const cart = await Cart.findOne({ user: req.user._id }).lean();
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Your cart is empty",
    });
  }
  const skuIds = cart.items
    .filter((item) => (item.itemType || "sku") === "sku")
    .map((item) => item.sku)
    .filter(Boolean);
  const skus = skuIds.length
    ? await SKU.find({ _id: { $in: skuIds } })
        .populate("product", "name slug images status")
        .lean()
    : [];
  const skuMap = new Map(skus.map((sku) => [String(sku._id), sku]));
  const items = [];
  for (const cartItem of cart.items) {
    const itemType = cartItem.itemType || "sku";
    if (itemType === "custom_hamper") {
      const result = await buildCustomHamperOrderItem(
        cartItem,
        checkout.address.state
      );
      if (result.error) {
        return res.status(409).json({
          success: false,
          message: result.error,
        });
      }
      items.push(result.item);
      continue;
    }
    const sku = skuMap.get(String(cartItem.sku));
    if (
      !sku ||
      !sku.isActive ||
      !sku.product ||
      sku.product.status !== PRODUCT_STATUS.ACTIVE
    ) {
      return res.status(409).json({
        success: false,
        message:
          "One or more cart items are no longer available. Please review your cart.",
      });
    }
    const item = buildSkuOrderItem(
      cartItem,
      sku,
      checkout.address.state
    );
    if (!item) {
      return res.status(400).json({
        success: false,
        message: "Invalid cart quantity",
      });
    }
    items.push(item);
  }
  const promotionContext = await resolveCheckoutPromotionContext({
    user: req.user,
    promoCode,
    partnerReferralCode,
    partnerProjectId,
    showcaseId,
    source: analytics?.source || "checkout",
  });

  const partnerAttributionResult =
    promotionContext.partnerAttributionResult || null;
  let promotionSnapshots = [];
  let partnerPromo = undefined;
  let partnerCommissionSnapshot = undefined;

  if (promotionContext.kind === "partner") {
    // Partner code is exclusive: no HAMPORIUM coupon or automatic sale stacks.
    const promoCalculation = await applyPartnerCodeWithMarginGuard({
      items,
      discountPercent: partnerAttributionResult.promo.discountPercent,
      commissionRate: partnerAttributionResult.promo.commissionRate,
    });

    partnerPromo = buildPartnerPromoSnapshot({
      promo: promoCalculation,
      result: partnerAttributionResult.promo,
    });

    partnerCommissionSnapshot = buildPartnerCommissionSnapshot({
      promo: promoCalculation,
      result: partnerAttributionResult.promo,
    });
  } else {
    const promotionResult = await applyPromotionEngine({
      items,
      user: req.user,
      explicitPromotion: promotionContext.promotion,
      suppressAutomatic: false,
    });
    promotionSnapshots = promotionResult.promotionSnapshots || [];
  }
  const totals = calculateTotals(items, checkout.address.state);
  if (totals.totalAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Order total must be greater than zero",
    });
  }
  const order = await Order.create({
    orderNumber: generateId("HMP-ORD"),
    checkoutKey: checkout.normalizedCheckoutKey,
    checkoutMode: "cart",
    user: req.user._id,
    items,
    recipient: checkout.recipient,
    deliveryAddress: buildDeliveryAddressSnapshot(checkout.address),
    deliveryDate: checkout.parsedDeliveryDate,
    deliveryPlan: buildDeliveryPlanSnapshot(
      req.checkoutDeliveryEstimate,
      checkout.parsedDeliveryDate
    ),
    giftMessage: checkout.giftMessage,
    analytics: {
      sessionId: cleanString(
        analytics?.sessionId ||
          items.find((item) => item.attribution)?.attribution?.sessionId,
        120
      ),
      source: cleanString(analytics?.source || "checkout", 60) || "checkout",
      pagePath: cleanString(analytics?.pagePath, 500),
    },
    partnerAttribution: partnerAttributionResult?.snapshot || undefined,
    promotionSnapshots,
    partnerPromo,
    partnerCommissionSnapshot,
    ...totals,
    currency: "INR",
  });
  await reserveOrderPromotions(order, promotionSnapshots);
  await recordCheckoutAnalytics(order);
  await applyPartnerReferralOrderMetrics(order.partnerAttribution, order);
  res.status(201).json({
    success: true,
    message: "Order created successfully",
    order: toPublicOrder(order),
  });
});
export const createBuyNowOrder = asyncHandler(async (req, res) => {
  const {
    checkoutKey,
    addressId,
    recipient,
    deliveryDate,
    giftMessage,
    skuId,
    quantity = 1,
    analytics = {},
    promoCode = "",
    partnerReferralCode = "",
    partnerProjectId = null,
    showcaseId = null,
  } = req.body;
  const checkout = await validateCheckoutInput({
    userId: req.user._id,
    checkoutKey,
    addressId,
    recipient,
    deliveryDate,
    giftMessage,
  });
  if (checkout.errorMessage) {
    return res.status(checkout.errorStatus).json({
      success: false,
      message: checkout.errorMessage,
    });
  }
  const existingOrder = await Order.findOne({
    user: req.user._id,
    checkoutKey: checkout.normalizedCheckoutKey,
  });
  if (existingOrder) {
    return res.status(200).json({
      success: true,
      message: "Order already created",
      order: toPublicOrder(existingOrder),
    });
  }
  if (!isValidId(skuId)) {
    return res.status(400).json({
      success: false,
      message: "Valid SKU ID is required",
    });
  }
  const parsedQuantity = validateCartQuantity(quantity);
  if (!parsedQuantity) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be between 1 and 99",
    });
  }
  const sku = await SKU.findOne({
    _id: skuId,
    isActive: true,
  })
    .populate("product", "name slug images status")
    .lean();
  if (!sku || !sku.product || sku.product.status !== PRODUCT_STATUS.ACTIVE) {
    return res.status(409).json({
      success: false,
      message: "This product is currently unavailable",
    });
  }
  const searchAttribution = await resolveSearchAttribution({
    sessionId: analytics?.sessionId,
    productId: sku.product._id,
    productSlug: sku.product.slug,
    searchEventId: analytics?.searchEventId,
  });
  const attribution = normalizeAttribution({
    sessionId: searchAttribution?.sessionId || analytics?.sessionId,
    searchEvent: searchAttribution?.searchEvent,
    query: searchAttribution?.query,
    normalizedQuery: searchAttribution?.normalizedQuery,
    source: searchAttribution?.source || analytics?.source,
    clickedAt: searchAttribution?.clickedAt,
  });
  const item = buildSkuOrderItem(
    { quantity: parsedQuantity },
    sku,
    checkout.address.state,
    attribution
  );
  const promotionContext = await resolveCheckoutPromotionContext({
    user: req.user,
    promoCode,
    partnerReferralCode,
    partnerProjectId,
    showcaseId,
    source: attribution?.source || analytics?.source || "buy_now",
  });

  const partnerAttributionResult =
    promotionContext.partnerAttributionResult || null;
  let promotionSnapshots = [];
  let partnerPromo = undefined;
  let partnerCommissionSnapshot = undefined;

  if (promotionContext.kind === "partner") {
    const promoCalculation = await applyPartnerCodeWithMarginGuard({
      items: [item],
      discountPercent: partnerAttributionResult.promo.discountPercent,
      commissionRate: partnerAttributionResult.promo.commissionRate,
    });

    partnerPromo = buildPartnerPromoSnapshot({
      promo: promoCalculation,
      result: partnerAttributionResult.promo,
    });

    partnerCommissionSnapshot = buildPartnerCommissionSnapshot({
      promo: promoCalculation,
      result: partnerAttributionResult.promo,
    });
  } else {
    const promotionResult = await applyPromotionEngine({
      items: [item],
      user: req.user,
      explicitPromotion: promotionContext.promotion,
      suppressAutomatic: false,
    });
    promotionSnapshots = promotionResult.promotionSnapshots || [];
  }
  const totals = calculateTotals([item], checkout.address.state);
  if (totals.totalAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Order total must be greater than zero",
    });
  }
  const order = await Order.create({
    orderNumber: generateId("HMP-ORD"),
    checkoutKey: checkout.normalizedCheckoutKey,
    checkoutMode: "buy_now",
    user: req.user._id,
    items: [item],
    recipient: checkout.recipient,
    deliveryAddress: buildDeliveryAddressSnapshot(checkout.address),
    deliveryDate: checkout.parsedDeliveryDate,
    deliveryPlan: buildDeliveryPlanSnapshot(
      req.checkoutDeliveryEstimate,
      checkout.parsedDeliveryDate
    ),
    giftMessage: checkout.giftMessage,
    analytics: {
      sessionId: cleanString(attribution?.sessionId || analytics?.sessionId, 120),
      source: cleanString(
        attribution?.source || analytics?.source || "buy_now",
        60
      ),
      pagePath: cleanString(analytics?.pagePath, 500),
    },
    partnerAttribution: partnerAttributionResult?.snapshot || undefined,
    promotionSnapshots,
    partnerPromo,
    partnerCommissionSnapshot,
    ...totals,
    currency: "INR",
  });
  await reserveOrderPromotions(order, promotionSnapshots);
  try {
    await recordCommerceEvent({
      eventType: "buy_now_start",
      userId: req.user._id,
      sessionId: attribution?.sessionId || analytics?.sessionId,
      source: attribution?.source || analytics?.source || "product_detail",
      pagePath: analytics?.pagePath,
      productId: sku.product._id,
      skuId: sku._id,
      orderId: order._id,
      productSlug: sku.product.slug,
      productName: sku.product.name,
      itemType: "sku",
      checkoutMode: "buy_now",
      quantity: parsedQuantity,
      value: totals.totalAmount,
      currency: "INR",
      location: checkout.address,
      attribution,
      eventKey: `buy-now:${order._id}`,
    });
  } catch (error) {
    console.error("Buy Now analytics failed:", error.message);
  }
  await recordCheckoutAnalytics(order);
  await applyPartnerReferralOrderMetrics(order.partnerAttribution, order);
  res.status(201).json({
    success: true,
    message: "Buy Now order created successfully",
    order: toPublicOrder(order),
  });
});
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .select(
      "orderNumber checkoutMode items promotionSnapshots partnerPromo baseSubtotal discountAmount taxableAmount taxAmount taxSummary subtotal shippingAmount totalAmount currency status paymentStatus cancellation deliveryDate deliveryPlan paidAt invoiceNumber invoiceIssuedAt createdAt"
    )
    .lean();
  res.status(200).json({
    success: true,
    orders,
  });
});
export const getMyOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!isValidId(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
    });
  }
  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  })
    .populate(
      "payment",
      "status amount refundedAmount razorpayOrderId razorpayPaymentId method paidAt lastRefundAt"
    )
    .populate(
      "cancellation.refund",
      "type status amount currency razorpayRefundId initiatedAt completedAt failedAt"
    )
    .lean();
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }
  res.status(200).json({
    success: true,
    order,
  });
});
const getStageTime = (job, stages = []) => {
  if (!job) return null;
  const stageSet = new Set(stages);
  const historyMatch = (job.history || [])
    .filter((entry) => stageSet.has(entry.stage) && entry.at)
    .sort((a, b) => new Date(a.at) - new Date(b.at))[0];
  if (historyMatch?.at) return historyMatch.at;
  if (stageSet.has(job.stage)) return job.updatedAt || job.createdAt || null;
  return null;
};
const getShipmentTime = (shipments, statuses = []) => {
  const statusSet = new Set(statuses);
  const dates = [];
  for (const shipment of shipments || []) {
    if (statusSet.has(shipment.status)) {
      if (shipment.status === FULFILMENT_STATUS.DELIVERED && shipment.deliveredAt) {
        dates.push(new Date(shipment.deliveredAt));
      } else if (
        shipment.status === FULFILMENT_STATUS.DISPATCHED &&
        shipment.dispatchedAt
      ) {
        dates.push(new Date(shipment.dispatchedAt));
      } else if (shipment.updatedAt) {
        dates.push(new Date(shipment.updatedAt));
      }
    }
    for (const entry of shipment.history || []) {
      if (statusSet.has(entry.status) && entry.at) {
        dates.push(new Date(entry.at));
      }
    }
  }
  if (!dates.length) return null;
  dates.sort((a, b) => a - b);
  return dates[0];
};
const resolveCustomerOrderStatus = ({ order, job, shipments }) => {
  if (
    ![
      ORDER_PAYMENT_STATUS.PAID,
      ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
      ORDER_PAYMENT_STATUS.REFUNDED,
    ].includes(order.paymentStatus) &&
    order.status !== ORDER_STATUS.CANCELLED
  ) {
    return null;
  }
  if (
    order.status === ORDER_STATUS.CANCELLED ||
    job?.stage === PRODUCTION_STAGE.CANCELLED
  ) {
    return CUSTOMER_ORDER_STATUS.CANCELLED;
  }
  const activeShipments = (shipments || []).filter(
    (shipment) => shipment.status !== FULFILMENT_STATUS.CANCELLED
  );
  const allActiveShipmentsDelivered =
    activeShipments.length > 0 &&
    activeShipments.every(
      (shipment) => shipment.status === FULFILMENT_STATUS.DELIVERED
    );
  if (
    order.status === ORDER_STATUS.DELIVERED ||
    job?.stage === PRODUCTION_STAGE.DELIVERED ||
    allActiveShipmentsDelivered
  ) {
    return CUSTOMER_ORDER_STATUS.DELIVERED;
  }
  if (
    order.status === ORDER_STATUS.SHIPPED ||
    job?.stage === PRODUCTION_STAGE.SHIPPED ||
    activeShipments.some((shipment) =>
      [
        FULFILMENT_STATUS.DISPATCHED,
        FULFILMENT_STATUS.IN_TRANSIT,
        FULFILMENT_STATUS.OUT_FOR_DELIVERY,
      ].includes(shipment.status)
    )
  ) {
    return CUSTOMER_ORDER_STATUS.DISPATCHED;
  }
  if (
    job?.stage === PRODUCTION_STAGE.READY_TO_SHIP ||
    activeShipments.some((shipment) =>
      [FULFILMENT_STATUS.CREATED, FULFILMENT_STATUS.LABEL_READY].includes(
        shipment.status
      )
    )
  ) {
    return CUSTOMER_ORDER_STATUS.PACKED;
  }
  if (
    order.status === ORDER_STATUS.PROCESSING ||
    [
      PRODUCTION_STAGE.PERSONALIZATION,
      PRODUCTION_STAGE.ASSEMBLY,
      PRODUCTION_STAGE.QC,
      PRODUCTION_STAGE.PACKING,
      PRODUCTION_STAGE.ON_HOLD,
    ].includes(job?.stage)
  ) {
    return CUSTOMER_ORDER_STATUS.PREPARING;
  }
  return CUSTOMER_ORDER_STATUS.CONFIRMED;
};
const buildCustomerTimeline = ({ order, job, shipments, customerStatus }) => {
  const confirmedAt = customerStatus
    ? order.paidAt || order.createdAt || null
    : null;
  const preparingAt = getStageTime(job, [
    PRODUCTION_STAGE.PERSONALIZATION,
    PRODUCTION_STAGE.ASSEMBLY,
    PRODUCTION_STAGE.QC,
    PRODUCTION_STAGE.PACKING,
    PRODUCTION_STAGE.ON_HOLD,
  ]);
  const packedAt =
    getStageTime(job, [PRODUCTION_STAGE.READY_TO_SHIP]) ||
    getShipmentTime(shipments, [
      FULFILMENT_STATUS.CREATED,
      FULFILMENT_STATUS.LABEL_READY,
    ]);
  const dispatchedAt = getShipmentTime(shipments, [
    FULFILMENT_STATUS.DISPATCHED,
    FULFILMENT_STATUS.IN_TRANSIT,
    FULFILMENT_STATUS.OUT_FOR_DELIVERY,
  ]);
  const outForDeliveryAt = getShipmentTime(shipments, [
    FULFILMENT_STATUS.OUT_FOR_DELIVERY,
  ]);
  const deliveredAt = getShipmentTime(shipments, [
    FULFILMENT_STATUS.DELIVERED,
  ]);
  const rank = {
    [CUSTOMER_ORDER_STATUS.CONFIRMED]: 1,
    [CUSTOMER_ORDER_STATUS.PREPARING]: 2,
    [CUSTOMER_ORDER_STATUS.PACKED]: 3,
    [CUSTOMER_ORDER_STATUS.DISPATCHED]: 4,
    [CUSTOMER_ORDER_STATUS.DELIVERED]: 5,
    [CUSTOMER_ORDER_STATUS.CANCELLED]: 0,
  };
  const currentRank = rank[customerStatus] || 0;
  const entries = [
    {
      key: CUSTOMER_ORDER_STATUS.CONFIRMED,
      label: "Confirmed",
      completed: currentRank >= 1,
      at: confirmedAt,
    },
    {
      key: CUSTOMER_ORDER_STATUS.PREPARING,
      label: "Preparing",
      completed: currentRank >= 2,
      at: preparingAt,
    },
    {
      key: CUSTOMER_ORDER_STATUS.PACKED,
      label: "Packed",
      completed: currentRank >= 3,
      at: packedAt,
    },
    {
      key: CUSTOMER_ORDER_STATUS.DISPATCHED,
      label: "Dispatched",
      completed: currentRank >= 4,
      at: dispatchedAt,
    },
    {
      key: "out_for_delivery",
      label: "Out for delivery",
      completed: Boolean(outForDeliveryAt || deliveredAt),
      at: outForDeliveryAt,
    },
    {
      key: CUSTOMER_ORDER_STATUS.DELIVERED,
      label: "Delivered",
      completed: currentRank >= 5,
      at: deliveredAt,
    },
  ];
  if (customerStatus === CUSTOMER_ORDER_STATUS.CANCELLED) {
    entries.push({
      key: CUSTOMER_ORDER_STATUS.CANCELLED,
      label: "Cancelled",
      completed: true,
      at:
        order.cancellation?.reviewedAt ||
        order.cancellation?.requestedAt ||
        order.updatedAt ||
        null,
    });
  }
  return entries;
};
const getIndiaPromiseDeadline = (value) => {
  const date = toValidDate(value);
  if (!date) return null;
  const dateKey = date.toISOString().slice(0, 10);
  const deadline = new Date(`${dateKey}T23:59:59.999+05:30`);
  return Number.isNaN(deadline.getTime()) ? null : deadline;
};
const resolveDeliveryHealth = ({
  order,
  customerStatus,
  shipments,
}) => {
  if (customerStatus === CUSTOMER_ORDER_STATUS.CANCELLED) {
    return {
      status: "cancelled",
      isDelayed: false,
    };
  }
  const expectedDeliveryDate =
    order.deliveryPlan?.expectedDeliveryDate ||
    order.deliveryDate ||
    null;
  const deadline = getIndiaPromiseDeadline(expectedDeliveryDate);
  const deliveredAt = getShipmentTime(shipments, [
    FULFILMENT_STATUS.DELIVERED,
  ]);
  if (customerStatus === CUSTOMER_ORDER_STATUS.DELIVERED) {
    if (!deadline || !deliveredAt) {
      return {
        status: "delivered",
        isDelayed: false,
      };
    }
    const deliveredLate = new Date(deliveredAt) > deadline;
    return {
      status: deliveredLate ? "delivered_late" : "delivered_on_time",
      isDelayed: deliveredLate,
    };
  }
  if (!deadline) {
    return {
      status: "not_available",
      isDelayed: false,
    };
  }
  const isDelayed = new Date() > deadline;
  return {
    status: isDelayed ? "delayed" : "on_track",
    isDelayed,
  };
};
export const getMyOrderTracking = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!isValidId(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
    });
  }
  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  }).lean();
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }
  const sourceId = String(order._id);
  const [job, shipments] = await Promise.all([
    ProductionJob.findOne({ sourceType: "order", sourceId }).lean(),
    Fulfilment.find({ sourceType: "order", sourceId })
      .sort({ createdAt: 1 })
      .lean(),
  ]);
  const customerStatus = resolveCustomerOrderStatus({
    order,
    job,
    shipments,
  });
  const timeline = buildCustomerTimeline({
    order,
    job,
    shipments,
    customerStatus,
  });
  const deliveryHealth = resolveDeliveryHealth({
    order,
    customerStatus,
    shipments,
  });
  const expectedDeliveryDate =
    order.deliveryPlan?.expectedDeliveryDate ||
    order.deliveryDate ||
    null;
  res.status(200).json({
    success: true,
    tracking: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerStatus,
      status: order.status,
      paymentStatus: order.paymentStatus,
      deliveryDate: expectedDeliveryDate,
      expectedDeliveryDate,
      materialsReadyDate: order.deliveryPlan?.materialsReadyDate || null,
      dispatchReadyDate: order.deliveryPlan?.dispatchReadyDate || null,
      deliveryHealth: deliveryHealth.status,
      isDeliveryDelayed: deliveryHealth.isDelayed,
      cancellation: order.cancellation || null,
      timeline,
      production: job
        ? {
            jobCode: job.jobCode,
            stage: job.stage,
            updatedAt: job.updatedAt,
          }
        : null,
      shipments: shipments.map((shipment) => ({
        id: shipment._id,
        shipmentCode: shipment.shipmentCode,
        carrier: shipment.carrier || "",
        trackingNumber: shipment.trackingNumber || "",
        trackingUrl: shipment.trackingUrl || "",
        status: shipment.status,
        dispatchedAt: shipment.dispatchedAt || null,
        deliveredAt: shipment.deliveredAt || null,
        history: (shipment.history || []).map((entry) => ({
          status: entry.status,
          note: entry.note || "",
          location: entry.location || "",
          at: entry.at || null,
        })),
      })),
    },
  });
});
export const requestOrderCancellation = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const reason = cleanString(req.body?.reason, 1000);
  if (!isValidId(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
    });
  }
  if (reason.length < 5) {
    return res.status(400).json({
      success: false,
      message: "Please provide a cancellation reason of at least 5 characters",
    });
  }
  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  });
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }
  if (order.cancellation?.status === CANCELLATION_STATUS.REQUESTED) {
    return res.status(200).json({
      success: true,
      message: "Cancellation request is already under review",
      cancellation: order.cancellation,
    });
  }
  if (
    ![
      ORDER_PAYMENT_STATUS.PAID,
      ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
    ].includes(order.paymentStatus)
  ) {
    return res.status(409).json({
      success: false,
      message: "Only successfully paid orders can request cancellation",
    });
  }
  if (
    [
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.CANCELLED,
    ].includes(order.status)
  ) {
    return res.status(409).json({
      success: false,
      message: "This order can no longer be cancelled",
    });
  }
  const blockingShipment = await Fulfilment.findOne({
    sourceType: "order",
    sourceId: String(order._id),
    status: {
      $in: [
        FULFILMENT_STATUS.DISPATCHED,
        FULFILMENT_STATUS.IN_TRANSIT,
        FULFILMENT_STATUS.OUT_FOR_DELIVERY,
        FULFILMENT_STATUS.DELIVERED,
        FULFILMENT_STATUS.FAILED,
        FULFILMENT_STATUS.RETURNED,
      ],
    },
  }).lean();
  if (blockingShipment) {
    return res.status(409).json({
      success: false,
      message: "This order has already entered shipment and cannot be cancelled",
    });
  }
  const requestTime = new Date();
  order.cancellation = {
    status: CANCELLATION_STATUS.REQUESTED,
    reason,
    requestedAt: requestTime,
    requestedBy: req.user._id,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: "",
    refund: null,
  };
  await order.save();
  void notifyUser({
    recipient: order.user,
    type: NOTIFICATION_TYPE.ORDER,
    title: "Cancellation Request Received",
    message: `We received your cancellation request for ${order.orderNumber}.`,
    entityType: "order",
    entityId: order._id,
    actionUrl: `/account/orders/${order._id}`,
    eventKey: `cancellation-requested:${order._id}:${requestTime.getTime()}`,
    metadata: { reason },
    email: {
      enabled: true,
      subject: `Cancellation request received - ${order.orderNumber}`,
      textContent: `We received your cancellation request for ${order.orderNumber}. Our team will review it and send you an update.`,
      actionLabel: "View order",
    },
    whatsapp: {
      enabled: true,
      templateKey: "cancellation_requested",
      bodyParameters: [order.orderNumber],
      includeActionUrl: true,
    },
  });
  await createAuditLog({
    req,
    action: "order_cancellation_requested",
    module: "orders",
    entityType: "order",
    entityId: order._id,
    description: `Cancellation requested for ${order.orderNumber}.`,
    metadata: { reason },
  });
  res.status(202).json({
    success: true,
    message: "Cancellation request submitted",
    cancellation: order.cancellation,
  });
});
export const downloadMyInvoice = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!isValidId(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
    });
  }
  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  })
    .populate("user", "name email phone")
    .populate(
      "payment",
      "status razorpayOrderId razorpayPaymentId method paidAt"
    );
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }
  if (
    ![
      ORDER_PAYMENT_STATUS.PAID,
      ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
      ORDER_PAYMENT_STATUS.REFUNDED,
    ].includes(order.paymentStatus)
  ) {
    return res.status(409).json({
      success: false,
      message: "Invoice is available after successful payment",
    });
  }
  await ensureOrderInvoiceIdentity(order);
  streamOrderInvoicePdf({
    order,
    res,
  });
});
