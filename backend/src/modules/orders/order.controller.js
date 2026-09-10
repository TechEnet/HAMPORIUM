import mongoose from "mongoose";

import Cart from "../cart/cart.model.js";
import { validateCustomHamper } from "../cart/cart.controller.js";
import SKU from "../catalog/sku.model.js";
import Address from "../users/address.model.js";
import ProductionJob from "../production/productionJob.model.js";
import Fulfilment from "../fulfilment/fulfilment.model.js";
import Order from "./order.model.js";
import PartnerReferral from "../partners/partnerReferral.model.js";
import { resolvePartnerAttributionForOrder } from "../partners/partnerReferral.controller.js";

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

const normalizeReferralCode = (value) =>
  cleanString(value, 40).toUpperCase();

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
      partnerPromoDiscountAmount: 0,
      taxableAmount: scale(perHamperAggregate.taxableAmount),
      tax: itemTax,
      unitPrice,
      lineTotal,
    },
  };
};

/* =====================================================
   PARTNER PROMO
   Promo is currently valid for ready-made SKU items only.
   Custom hampers and quote orders retain their own commercial pricing.
===================================================== */

const scaleTaxSnapshot = (tax = {}, ratio = 1) => {
  const safeRatio = Math.max(0, Math.min(1, Number(ratio || 0)));
  const cgstAmount = roundMoney(Number(tax.cgstAmount || 0) * safeRatio);
  const sgstAmount = roundMoney(Number(tax.sgstAmount || 0) * safeRatio);
  const igstAmount = roundMoney(Number(tax.igstAmount || 0) * safeRatio);

  const componentTotal = roundMoney(cgstAmount + sgstAmount + igstAmount);
  const totalTax = componentTotal > 0
    ? componentTotal
    : roundMoney(Number(tax.totalTax || 0) * safeRatio);

  return {
    ...tax,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
  };
};

const applyPartnerPromoDiscount = (items, rawRate) => {
  const rate = Math.max(0, Math.min(100, Number(rawRate || 0)));

  let eligibleAmount = 0;
  let discountAmount = 0;
  let taxReductionAmount = 0;
  let customerSavings = 0;

  if (!rate) {
    return {
      rate,
      eligibleAmount,
      discountAmount,
      taxReductionAmount,
      customerSavings,
    };
  }

  for (const item of items) {
    if ((item.itemType || "sku") !== "sku") continue;

    const beforePromoTaxable = roundMoney(item.taxableAmount || 0);
    if (beforePromoTaxable <= 0) continue;

    const lineDiscount = Math.min(
      beforePromoTaxable,
      roundMoney((beforePromoTaxable * rate) / 100)
    );

    const afterPromoTaxable = roundMoney(
      Math.max(0, beforePromoTaxable - lineDiscount)
    );

    const ratio = beforePromoTaxable > 0
      ? afterPromoTaxable / beforePromoTaxable
      : 0;

    const previousTax = roundMoney(Number(item.tax?.totalTax || 0));
    const nextTax = scaleTaxSnapshot(item.tax || {}, ratio);
    const nextTaxTotal = roundMoney(Number(nextTax.totalTax || 0));
    const lineTaxReduction = roundMoney(Math.max(0, previousTax - nextTaxTotal));
    const lineCustomerSavings = roundMoney(lineDiscount + lineTaxReduction);
    const nextLineTotal = roundMoney(
      afterPromoTaxable + nextTaxTotal
    );

    item.partnerPromoDiscountAmount = lineDiscount;
    item.taxableAmount = afterPromoTaxable;
    item.tax = nextTax;
    item.lineTotal = nextLineTotal;
    item.unitPrice = roundMoney(
      nextLineTotal / Math.max(1, Number(item.quantity || 1))
    );

    eligibleAmount = roundMoney(eligibleAmount + beforePromoTaxable);
    discountAmount = roundMoney(discountAmount + lineDiscount);
    taxReductionAmount = roundMoney(taxReductionAmount + lineTaxReduction);
    customerSavings = roundMoney(customerSavings + lineCustomerSavings);
  }

  return {
    rate,
    eligibleAmount,
    discountAmount,
    taxReductionAmount,
    customerSavings,
  };
};

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

const calculateTotals = (items, destinationState) => {
  const aggregate = aggregateTaxLines(
    items.map((item) => ({
      baseLineTotal: item.baseLineTotal,
      discountAmount: roundMoney(
        Number(item.discount?.amount || 0) +
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

const resolveOrderPartnerContext = async ({
  userId,
  partnerReferralCode,
  partnerProjectId,
  showcaseId,
  source,
}) => {
  const explicitCode = normalizeReferralCode(partnerReferralCode);

  const result = await resolvePartnerAttributionForOrder({
    userId,
    referralCode: explicitCode,
    projectId: partnerProjectId,
    showcaseId,
    source,
  });

  if (explicitCode && !result) {
    const error = new Error(
      "Partner promo code is invalid, expired, or the partner is not approved."
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    result,
    explicitCode,
  };
};

export const createOrder = asyncHandler(async (req, res) => {
  const {
    checkoutKey,
    addressId,
    recipient,
    deliveryDate,
    giftMessage,
    analytics = {},
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
      order: existingOrder,
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

  const { result: partnerAttributionResult, explicitCode } =
    await resolveOrderPartnerContext({
      userId: req.user._id,
      partnerReferralCode,
      partnerProjectId,
      showcaseId,
      source: analytics?.source || "checkout",
    });

  let partnerPromo = undefined;

  if (explicitCode && partnerAttributionResult?.promo) {
    const promoCalculation = applyPartnerPromoDiscount(
      items,
      partnerAttributionResult.promo.discountPercent
    );

    partnerPromo = buildPartnerPromoSnapshot({
      promo: promoCalculation,
      result: partnerAttributionResult.promo,
    });
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
    partnerPromo,
    ...totals,
    currency: "INR",
  });

  await recordCheckoutAnalytics(order);
  await applyPartnerReferralOrderMetrics(order.partnerAttribution, order);

  res.status(201).json({
    success: true,
    message: "Order created successfully",
    order,
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
      order: existingOrder,
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

  const { result: partnerAttributionResult, explicitCode } =
    await resolveOrderPartnerContext({
      userId: req.user._id,
      partnerReferralCode,
      partnerProjectId,
      showcaseId,
      source: attribution?.source || analytics?.source || "buy_now",
    });

  let partnerPromo = undefined;

  if (explicitCode && partnerAttributionResult?.promo) {
    const promoCalculation = applyPartnerPromoDiscount(
      [item],
      partnerAttributionResult.promo.discountPercent
    );

    partnerPromo = buildPartnerPromoSnapshot({
      promo: promoCalculation,
      result: partnerAttributionResult.promo,
    });
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
    partnerPromo,
    ...totals,
    currency: "INR",
  });

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
    order,
  });
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .select(
      "orderNumber checkoutMode items partnerPromo baseSubtotal discountAmount taxableAmount taxAmount taxSummary subtotal shippingAmount totalAmount currency status paymentStatus cancellation deliveryDate paidAt invoiceNumber invoiceIssuedAt createdAt"
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

  if (
    order.status === ORDER_STATUS.DELIVERED ||
    job?.stage === PRODUCTION_STAGE.DELIVERED ||
    (shipments.length > 0 &&
      shipments.every((shipment) =>
        [FULFILMENT_STATUS.DELIVERED, FULFILMENT_STATUS.CANCELLED].includes(
          shipment.status
        )
      ))
  ) {
    return CUSTOMER_ORDER_STATUS.DELIVERED;
  }

  if (
    order.status === ORDER_STATUS.SHIPPED ||
    job?.stage === PRODUCTION_STAGE.SHIPPED ||
    shipments.some((shipment) =>
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
    shipments.some((shipment) =>
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

  const deliveredAt = getShipmentTime(shipments, [FULFILMENT_STATUS.DELIVERED]);

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

  res.status(200).json({
    success: true,
    tracking: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerStatus,
      status: order.status,
      paymentStatus: order.paymentStatus,
      deliveryDate: order.deliveryDate,
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
