import mongoose from "mongoose";
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import Payment from "./payment.model.js";
import Order from "../orders/order.model.js";
import Cart from "../cart/cart.model.js";
import Quote from "../quotes/quote.model.js";
import RFQ from "../rfq/rfq.model.js";
import { ensureProductionJobForOrder } from "../production/production.controller.js";
import asyncHandler from "../../utils/asyncHandler.js";
import generateId from "../../utils/generateId.js";
import {
  getPagination,
  getPaginationMeta,
} from "../../utils/pagination.js";
import {
  createGatewayOrder,
  fetchGatewayPayment,
  getRazorpayKeyId,
} from "../../helpers/paymentGateway.js";
import {
  NOTIFICATION_TYPE,
  ORDER_STATUS,
  ORDER_PAYMENT_STATUS,
  PAYMENT_STATUS,
  QUOTE_STATUS,
} from "../../constants/statuses.js";
import {
  recordCommerceEvent,
} from "../analytics/commerceAnalytics.service.js";
import {
  ensureOrderInvoiceIdentity,
} from "../orders/invoice.service.js";
import notifyUser from "../../helpers/notifyUser.js";
import { ensureCommissionForPaidOrder } from "../commissions/commission.controller.js";
import {
  assertOrderPromotionReservations,
  markOrderPromotionRedemptionsPaid,
} from "../promotions/promotion.service.js";
const isValidId = (id) => mongoose.isValidObjectId(id);
const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const hasExplicitPartnerPromo = (order) => {
  const promoPartner = order?.partnerPromo?.partner;
  const attributionPartner = order?.partnerAttribution?.partner;

  return Boolean(
    order?.partnerPromo?.code &&
      promoPartner &&
      attributionPartner &&
      String(promoPartner) === String(attributionPartner)
  );
};
const verifyPaymentSignature = ({
  razorpayOrderId,
  razorpayPaymentId,
  signature,
}) => {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const generatedSignature = createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(generatedSignature, "hex"),
    Buffer.from(signature, "hex")
  );
};
const recordPurchaseAnalytics = async (order) => {
  const firstAttribution = (order.items || [])
    .map((item) => item.attribution)
    .find(Boolean);
  try {
    await recordCommerceEvent({
      eventType: "purchase",
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
      eventKey: `purchase:${order._id}`,
    });
  } catch (error) {
    console.error("Purchase analytics failed:", error.message);
  }
};
const recordPaymentFailureAnalytics = async ({
  order,
  paymentRecord,
  webhookEventId = "",
}) => {
  if (!order) return;
  const eventKey = webhookEventId
    ? `payment-failed:${webhookEventId}`
    : `payment-failed:${paymentRecord._id}:${paymentRecord.razorpayPaymentId || "unknown"}`;
  try {
    await recordCommerceEvent({
      eventType: "payment_failed",
      userId: order.user,
      sessionId: order.analytics?.sessionId,
      source: order.analytics?.source || "checkout",
      pagePath: order.analytics?.pagePath,
      orderId: order._id,
      checkoutMode: order.checkoutMode || "cart",
      value: order.totalAmount,
      currency: order.currency,
      location: order.deliveryAddress,
      eventKey,
    });
  } catch (error) {
    console.error("Payment failure analytics failed:", error.message);
  }
};
const sendPaidNotifications = (order, paymentRecord) => {
  void notifyUser({
    recipient: order.user,
    type: NOTIFICATION_TYPE.PAYMENT,
    title: "Payment Confirmed",
    message: `Payment for ${order.orderNumber} has been confirmed.`,
    entityType: "order",
    entityId: order._id,
    actionUrl: `/account/orders/${order._id}`,
    eventKey: `payment-confirmed:${paymentRecord._id}`,
    metadata: {
      orderId: order._id,
      paymentId: paymentRecord._id,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
    },
    email: {
      enabled: true,
      subject: `Payment confirmed for ${order.orderNumber}`,
      textContent: `We have received your payment of INR ${Number(
        paymentRecord.amount || order.totalAmount || 0
      ).toFixed(2)} for ${order.orderNumber}.`,
    },
  });
  void notifyUser({
    recipient: order.user,
    type: NOTIFICATION_TYPE.ORDER,
    title: "Order Confirmed",
    message: `${order.orderNumber} is confirmed and will now move into preparation.`,
    entityType: "order",
    entityId: order._id,
    actionUrl: `/account/orders/${order._id}`,
    eventKey: `order-confirmed:${order._id}`,
    metadata: {
      orderId: order._id,
      paymentId: paymentRecord._id,
    },
    email: {
      enabled: true,
      subject: `Order confirmed - ${order.orderNumber}`,
      textContent: `${order.orderNumber} is confirmed. We will send another update when your gift is dispatched.`,
      actionLabel: "Track your order",
    },
    whatsapp: {
      enabled: true,
      templateKey: "order_confirmed",
      bodyParameters: [order.orderNumber],
      includeActionUrl: true,
    },
  });
};
const getAcceptedQuoteBundle = async ({
  quoteId,
  userId = null,
}) => {
  if (!isValidId(quoteId)) {
    const error = new Error("Invalid quote ID");
    error.statusCode = 400;
    throw error;
  }
  const filter = { _id: quoteId };
  if (userId) filter.customer = userId;
  const quote = await Quote.findOne(filter);
  if (!quote) {
    const error = new Error("Quote not found");
    error.statusCode = 404;
    throw error;
  }
  if (
    quote.status !== QUOTE_STATUS.ACCEPTED ||
    !quote.acceptedVersionNumber
  ) {
    const error = new Error(
      "Accept the quotation before starting payment."
    );
    error.statusCode = 409;
    throw error;
  }
  const version = quote.versions.find(
    (item) => item.versionNumber === quote.acceptedVersionNumber
  );
  if (!version) {
    const error = new Error("Accepted quote version not found");
    error.statusCode = 409;
    throw error;
  }
  if (Number(version.total || 0) <= 0) {
    const error = new Error(
      "Accepted quotation total must be greater than zero."
    );
    error.statusCode = 409;
    throw error;
  }
  const rfq = await RFQ.findById(quote.rfq).select(
    "+customHamperRequest.personalization.assets.publicId"
  );
  if (!rfq) {
    const error = new Error("RFQ not found for quotation");
    error.statusCode = 404;
    throw error;
  }
  if (
    rfq.sourceType !== "custom_hamper" ||
    !rfq.customHamperRequest
  ) {
    const error = new Error(
      "Online quote payment is currently available for Custom Hamper bulk requests only."
    );
    error.statusCode = 409;
    throw error;
  }
  return { quote, rfq, version };
};
const buildQuoteCustomHamperOrderItem = ({ rfq, version }) => {
  const request = rfq.customHamperRequest;
  const quantity = Math.max(1, Number(rfq.quantity || 1));
  const commercialUnitPrice = roundMoney(
    Number(version.total || 0) / quantity
  );
  const beforeTax = roundMoney(
    Math.max(
      Number(version.subtotal || 0) -
        Number(version.discount || 0) +
        Number(version.freight || 0),
      0
    )
  );
  const buildComponent = (item) => ({
    component: item.component || null,
    name: item.name || "Custom Hamper Item",
    code: item.code || "",
    image: item.image || "",
    quantity: Math.max(1, Number(item.quantity || 1)),
    baseUnitPrice: roundMoney(item.indicativeUnitPrice || 0),
    baseLineTotal: roundMoney(item.indicativeLineTotal || 0),
    taxableAmount: roundMoney(item.indicativeLineTotal || 0),
    unitPrice: roundMoney(item.indicativeUnitPrice || 0),
    lineTotal: roundMoney(item.indicativeLineTotal || 0),
  });
  const personalization = request.personalization?.enabled
    ? {
        enabled: true,
        assets: (request.personalization.assets || []).map((asset) => ({
          type: asset.type,
          url: asset.url,
          publicId: asset.publicId,
          fileName: asset.fileName || "",
          mimeType: asset.mimeType || "",
          placement: asset.placement || "top_lid",
          notes: asset.notes || "",
        })),
        message: request.personalization.message || "",
        instructions: request.personalization.instructions || "",
      }
    : undefined;
  const indicativePricing = request.indicativePricing || {};
  return {
    itemType: "custom_hamper",
    product: null,
    sku: null,
    productName: "Bulk Custom Hamper",
    productSlug: "",
    skuName: request.containerName || "Custom Hamper Box",
    skuCode: request.containerCode || "CUSTOM-HAMPER",
    image: request.containerImage || "",
    optionValues: {},
    partnerPromoDiscountAmount: 0,
    customHamper: {
      container: request.container || null,
      containerName: request.containerName || "Custom Hamper Box",
      containerCode: request.containerCode || "",
      containerImage: request.containerImage || "",
      channel: request.channel || "",
      containerPricing: {
        basePrice: roundMoney(indicativePricing.containerPrice || 0),
        taxableAmount: roundMoney(indicativePricing.containerPrice || 0),
        finalPrice: roundMoney(indicativePricing.containerPrice || 0),
      },
      components: (request.items || []).map(buildComponent),
      decorations: (request.decorations || []).map(buildComponent),
      personalization,
      containerPrice: roundMoney(indicativePricing.containerPrice || 0),
      itemsTotal: roundMoney(indicativePricing.itemsTotal || 0),
      decorationsTotal: roundMoney(indicativePricing.decorationsTotal || 0),
      baseSubtotal: roundMoney(indicativePricing.total || 0),
      discountAmount: 0,
      taxableAmount: roundMoney(indicativePricing.total || 0),
      taxAmount: 0,
      hamperUnitPrice: commercialUnitPrice,
      capacity: request.capacity || {},
    },
    quantity,
    baseUnitPrice: roundMoney(Number(version.subtotal || 0) / quantity),
    baseLineTotal: roundMoney(version.subtotal || 0),
    discount: {
      enabled: Number(version.discount || 0) > 0,
      type: "fixed",
      value: roundMoney(version.discount || 0),
      amount: roundMoney(version.discount || 0),
    },
    taxableAmount: beforeTax,
    tax: {
      hsnSac: "MULTI",
      taxType: Number(version.taxAmount || 0) > 0 ? "unconfigured" : "none",
      sellerState: "",
      destinationState: "",
      gstRate: Number(version.taxRate || 0),
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      totalTax: roundMoney(version.taxAmount || 0),
    },
    unitPrice: commercialUnitPrice,
    lineTotal: roundMoney(version.total || 0),
  };
};
const buildCommercialSnapshot = ({ quote, rfq, version }) => ({
  sourceType: "quote",
  quoteId: quote.quoteId || String(quote._id),
  rfqId: rfq.rfqId || String(rfq._id),
  versionNumber: version.versionNumber,
  lineItems: (version.lineItems || []).map((item) => ({
    productReference: item.productReference || "",
    name: item.name,
    description: item.description || "",
    image: item.image || "",
    quantity: Number(item.quantity || 1),
    unitPrice: roundMoney(item.unitPrice || 0),
    personalization: item.personalization || "",
    packaging: item.packaging || "",
    lineTotal: roundMoney(item.lineTotal || 0),
  })),
  subtotal: roundMoney(version.subtotal || 0),
  discount: roundMoney(version.discount || 0),
  freight: roundMoney(version.freight || 0),
  taxRate: Number(version.taxRate || 0),
  taxAmount: roundMoney(version.taxAmount || 0),
  total: roundMoney(version.total || 0),
  currency: version.currency || "INR",
  leadTimeDays: Number(version.leadTimeDays || 0),
  paymentTerms: version.paymentTerms || "",
  validUntil: version.validUntil || null,
  assumptions: version.assumptions || [],
  notes: version.notes || "",
});
const ensureQuoteOrderForPayment = async (paymentRecord) => {
  const { quote, rfq, version } = await getAcceptedQuoteBundle({
    quoteId: paymentRecord.quote,
  });
  if (String(quote.customer) !== String(paymentRecord.user)) {
    throw new Error("Quote payment customer mismatch");
  }
  let order = await Order.findOne({ quote: quote._id });
  if (!order) {
    const taxableAmount = roundMoney(
      Math.max(
        Number(version.subtotal || 0) -
          Number(version.discount || 0) +
          Number(version.freight || 0),
        0
      )
    );
    const shippingAmount = roundMoney(version.freight || 0);
    const totalAmount = roundMoney(version.total || 0);
    const itemSubtotal = roundMoney(
      Math.max(totalAmount - shippingAmount, 0)
    );
    const payload = {
      orderNumber: generateId("HMP-ORD"),
      checkoutKey: `quote:${quote._id}:v${version.versionNumber}`,
      checkoutMode: "quote",
      user: quote.customer,
      quote: quote._id,
      rfq: rfq._id,
      items: [
        buildQuoteCustomHamperOrderItem({
          rfq,
          version,
        }),
      ],
      commercialSnapshot: buildCommercialSnapshot({
        quote,
        rfq,
        version,
      }),
      bulkOrder: {
        quantity: Math.max(1, Number(rfq.quantity || 1)),
        companyName: rfq.companyName || "",
        gstNumber: rfq.gstNumber || "",
        occasion: rfq.occasion || "",
        addressModel: rfq.addressModel || "not_decided",
        deliveryLocations: rfq.deliveryLocations || [],
        notes: rfq.notes || "",
      },
      deliveryDate: rfq.requiredDeliveryDate || null,
      giftMessage: rfq.customHamperRequest?.personalization?.message || "",
      analytics: {
        sessionId: "",
        source: "bulk_quote_payment",
        pagePath: `/account/corporate/quotes/${quote._id}`,
      },
      baseSubtotal: roundMoney(version.subtotal || 0),
      discountAmount: roundMoney(version.discount || 0),
      taxableAmount,
      taxAmount: roundMoney(version.taxAmount || 0),
      taxSummary: {
        sellerState: "",
        destinationState: "",
        taxType: Number(version.taxAmount || 0) > 0 ? "unconfigured" : "none",
        taxableAmount,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: roundMoney(version.taxAmount || 0),
      },
      subtotal: itemSubtotal,
      shippingAmount,
      totalAmount,
      currency: version.currency || "INR",
      razorpayOrderId: paymentRecord.razorpayOrderId,
      payment: paymentRecord._id,
    };
    try {
      order = await Order.create(payload);
    } catch (error) {
      if (error?.code !== 11000) throw error;
      order = await Order.findOne({ quote: quote._id });
      if (!order) throw error;
    }
  }
  paymentRecord.order = order._id;
  quote.payment = paymentRecord._id;
  quote.order = order._id;
  quote.paidAt = paymentRecord.paidAt || new Date();
  await quote.save();
  rfq.payment = paymentRecord._id;
  rfq.order = order._id;
  rfq.paidAt = paymentRecord.paidAt || new Date();
  rfq.commercialPaymentStatus = "paid";
  rfq.nextAction = "Order placed - production preparation";
  await rfq.save();
  return order;
};
export const markPaymentCaptured = async ({
  paymentRecord,
  gatewayPayment,
  signature = "",
  webhookEventId = "",
}) => {
  if (Number(gatewayPayment.amount) !== Number(paymentRecord.amountPaise)) {
    throw new Error("Payment amount mismatch");
  }
  if (
    String(gatewayPayment.currency).toUpperCase() !==
    String(paymentRecord.currency).toUpperCase()
  ) {
    throw new Error("Payment currency mismatch");
  }
  if (
    ![PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED].includes(
      paymentRecord.status
    )
  ) {
    paymentRecord.status = PAYMENT_STATUS.CAPTURED;
  }
  paymentRecord.razorpayPaymentId = gatewayPayment.id;
  if (signature) {
    paymentRecord.razorpaySignature = signature;
  }
  paymentRecord.method = gatewayPayment.method || "";
  paymentRecord.email = gatewayPayment.email || "";
  paymentRecord.contact = gatewayPayment.contact || "";
  paymentRecord.paidAt = paymentRecord.paidAt || new Date();
  let order;
  if (paymentRecord.sourceType === "quote") {
    await paymentRecord.save();
    order = await ensureQuoteOrderForPayment(paymentRecord);
    if (
      webhookEventId &&
      !paymentRecord.webhookEventIds.includes(webhookEventId)
    ) {
      paymentRecord.webhookEventIds.push(webhookEventId);
    }
    await paymentRecord.save();
  } else {
    order = await Order.findById(paymentRecord.order);
    if (!order) {
      throw new Error("Order not found for payment");
    }
    if (
      webhookEventId &&
      !paymentRecord.webhookEventIds.includes(webhookEventId)
    ) {
      paymentRecord.webhookEventIds.push(webhookEventId);
    }
    await paymentRecord.save();
  }
  const newlyPaid = ![
    ORDER_PAYMENT_STATUS.PAID,
    ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
    ORDER_PAYMENT_STATUS.REFUNDED,
  ].includes(order.paymentStatus);
  if (newlyPaid) {
    order.paymentStatus = ORDER_PAYMENT_STATUS.PAID;
    order.status = ORDER_STATUS.CONFIRMED;
    order.payment = paymentRecord._id;
    order.razorpayOrderId = paymentRecord.razorpayOrderId;
    order.paidAt = paymentRecord.paidAt;
    await order.save();
    sendPaidNotifications(order, paymentRecord);
  }
  await ensureOrderInvoiceIdentity(order);

  // Promotion reservation is created before payment starts. Mark it redeemed
  // only after Razorpay capture succeeds. This is idempotent across webhook/API
  // retries and protects first-order offers from duplicate use.
  try {
    await markOrderPromotionRedemptionsPaid(order._id);
  } catch (error) {
    console.error(
      `Promotion redemption finalization failed for order ${order.orderNumber || order._id}:`,
      error.message
    );
  }

  // Commission is based on the explicit partner-code snapshot, never on a
  // passive/persistent attribution alone. Run on every captured callback so a
  // later retry can self-heal if a previous commission write temporarily failed.
  if (hasExplicitPartnerPromo(order)) {
    try {
      await ensureCommissionForPaidOrder(order);
    } catch (error) {
      console.error(
        `Partner commission creation failed for order ${order.orderNumber || order._id}:`,
        error.message
      );
    }
  }
  if (
    order.status !== ORDER_STATUS.CANCELLED &&
    order.paymentStatus !== ORDER_PAYMENT_STATUS.REFUNDED
  ) {
    try {
      await ensureProductionJobForOrder(order);
    } catch (error) {
      console.error(
        `Production job creation failed for order ${order.orderNumber || order._id}:`,
        error.message
      );
    }
  }
  await recordPurchaseAnalytics(order);
  if (newlyPaid && (order.checkoutMode || "cart") === "cart") {
    await Cart.updateOne(
      { user: order.user },
      { $set: { items: [] } }
    );
  }
  return order;
};
export const markPaymentFailed = async ({
  paymentRecord,
  gatewayPayment,
  webhookEventId = "",
}) => {
  if (
    [
      PAYMENT_STATUS.CAPTURED,
      PAYMENT_STATUS.PARTIALLY_REFUNDED,
      PAYMENT_STATUS.REFUNDED,
    ].includes(paymentRecord.status)
  ) {
    if (
      webhookEventId &&
      !paymentRecord.webhookEventIds.includes(webhookEventId)
    ) {
      paymentRecord.webhookEventIds.push(webhookEventId);
      await paymentRecord.save();
    }
    return;
  }
  paymentRecord.status = PAYMENT_STATUS.FAILED;
  paymentRecord.razorpayPaymentId =
    gatewayPayment.id || paymentRecord.razorpayPaymentId;
  paymentRecord.method = gatewayPayment.method || "";
  paymentRecord.errorCode = gatewayPayment.error_code || "";
  paymentRecord.errorDescription = gatewayPayment.error_description || "";
  if (
    webhookEventId &&
    !paymentRecord.webhookEventIds.includes(webhookEventId)
  ) {
    paymentRecord.webhookEventIds.push(webhookEventId);
  }
  await paymentRecord.save();
  const order = paymentRecord.order
    ? await Order.findById(paymentRecord.order)
    : null;
  if (
    order &&
    order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID &&
    order.razorpayOrderId === paymentRecord.razorpayOrderId
  ) {
    order.paymentStatus = ORDER_PAYMENT_STATUS.FAILED;
    order.status = ORDER_STATUS.PAYMENT_FAILED;
    await order.save();
  }
  if (paymentRecord.sourceType === "quote" && paymentRecord.rfq) {
    await RFQ.updateOne(
      { _id: paymentRecord.rfq, commercialPaymentStatus: { $ne: "paid" } },
      {
        $set: {
          commercialPaymentStatus: "failed",
          nextAction: "Customer payment retry",
        },
      }
    );
  }
  await recordPaymentFailureAnalytics({
    order,
    paymentRecord,
    webhookEventId,
  });
};
// ======================================================
// RETAIL ORDER PAYMENT
// ======================================================
export const createPaymentOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!isValidId(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
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
  if (order.status === ORDER_STATUS.CANCELLED) {
    return res.status(409).json({
      success: false,
      message: "Cancelled order cannot be paid",
    });
  }
  if (
    [
      ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
      ORDER_PAYMENT_STATUS.REFUNDED,
    ].includes(order.paymentStatus)
  ) {
    return res.status(409).json({
      success: false,
      message: "Refunded order cannot start a new payment",
    });
  }
  // IMPORTANT: idempotent paid-order response. This fixes the frontend 409
  // when an already completed order is returned for the same checkout key.
  if (order.paymentStatus === ORDER_PAYMENT_STATUS.PAID) {
    return res.status(200).json({
      success: true,
      alreadyPaid: true,
      message: "Order is already paid",
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
      },
    });
  }

  // A first-order discount must still own its reservation when payment starts.
  // This also blocks a stale/tampered discounted order from being paid later.
  await assertOrderPromotionReservations(order);

  const existingPayment = await Payment.findOne({
    order: order._id,
    $or: [
      { sourceType: "order" },
      { sourceType: { $exists: false } },
    ],
    status: {
      $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.AUTHORIZED],
    },
  }).sort({ createdAt: -1 });
  if (existingPayment) {
    order.razorpayOrderId = existingPayment.razorpayOrderId;
    order.paymentStatus = ORDER_PAYMENT_STATUS.PENDING;
    order.status = ORDER_STATUS.PENDING_PAYMENT;
    order.payment = existingPayment._id;
    await order.save();
    return res.status(200).json({
      success: true,
      checkout: {
        keyId: getRazorpayKeyId(),
        orderId: order._id,
        orderNumber: order.orderNumber,
        razorpayOrderId: existingPayment.razorpayOrderId,
        amount: order.totalAmount,
        amountPaise: existingPayment.amountPaise,
        currency: existingPayment.currency,
        checkoutMode: order.checkoutMode || "cart",
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone || "",
        },
      },
    });
  }
  const amountPaise = Math.round(order.totalAmount * 100);
  let gatewayOrder;
  try {
    gatewayOrder = await createGatewayOrder({
      amountPaise,
      currency: order.currency,
      receipt: order.orderNumber,
      notes: {
        hamporiumOrderId: order._id.toString(),
        orderNumber: order.orderNumber,
        checkoutMode: order.checkoutMode || "cart",
        partnerPromoCode: order.partnerPromo?.code || "",
      },
    });
  } catch (error) {
    console.error(
      "Razorpay order creation failed:",
      error?.error?.description || error.message
    );
    return res.status(502).json({
      success: false,
      message: "Unable to start payment. Please try again.",
    });
  }
  const payment = await Payment.create({
    user: req.user._id,
    sourceType: "order",
    order: order._id,
    amount: order.totalAmount,
    amountPaise,
    currency: order.currency,
    receipt: order.orderNumber,
    razorpayOrderId: gatewayOrder.id,
  });
  order.razorpayOrderId = gatewayOrder.id;
  order.paymentStatus = ORDER_PAYMENT_STATUS.PENDING;
  order.status = ORDER_STATUS.PENDING_PAYMENT;
  order.payment = payment._id;
  await order.save();
  res.status(201).json({
    success: true,
    message: "Payment order created",
    checkout: {
      keyId: getRazorpayKeyId(),
      orderId: order._id,
      orderNumber: order.orderNumber,
      razorpayOrderId: gatewayOrder.id,
      amount: order.totalAmount,
      amountPaise,
      currency: order.currency,
      checkoutMode: order.checkoutMode || "cart",
      prefill: {
        name: req.user.name,
        email: req.user.email,
        contact: req.user.phone || "",
      },
    },
  });
});
export const verifyPayment = asyncHandler(async (req, res) => {
  const {
    orderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;
  if (!isValidId(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
    });
  }
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: "Payment verification details are incomplete",
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
  const payment = await Payment.findOne({
    order: order._id,
    razorpayOrderId: order.razorpayOrderId,
    $or: [
      { sourceType: "order" },
      { sourceType: { $exists: false } },
    ],
  }).sort({ createdAt: -1 });
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "Payment record not found",
    });
  }
  if (razorpay_order_id !== payment.razorpayOrderId) {
    return res.status(400).json({
      success: false,
      message: "Payment order mismatch",
    });
  }
  const validSignature = verifyPaymentSignature({
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!validSignature) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment signature",
    });
  }
  let gatewayPayment;
  try {
    gatewayPayment = await fetchGatewayPayment(razorpay_payment_id);
  } catch {
    return res.status(502).json({
      success: false,
      message:
        "Payment was verified but status could not be confirmed. Please retry.",
    });
  }
  if (gatewayPayment.order_id !== payment.razorpayOrderId) {
    return res.status(400).json({
      success: false,
      message: "Gateway payment order mismatch",
    });
  }
  if (gatewayPayment.status === "captured") {
    const paidOrder = await markPaymentCaptured({
      paymentRecord: payment,
      gatewayPayment,
      signature: razorpay_signature,
    });
    return res.status(200).json({
      success: true,
      message: "Payment successful",
      order: paidOrder,
    });
  }
  if (gatewayPayment.status === "authorized") {
    payment.status = PAYMENT_STATUS.AUTHORIZED;
    payment.razorpayPaymentId = gatewayPayment.id;
    payment.razorpaySignature = razorpay_signature;
    payment.method = gatewayPayment.method || "";
    await payment.save();
    return res.status(202).json({
      success: true,
      paymentPending: true,
      message: "Payment verified and is awaiting capture.",
    });
  }
  if (gatewayPayment.status === "failed") {
    await markPaymentFailed({
      paymentRecord: payment,
      gatewayPayment,
    });
    return res.status(409).json({
      success: false,
      message: gatewayPayment.error_description || "Payment failed",
    });
  }
  return res.status(409).json({
    success: false,
    message: "Payment has not been captured",
  });
});
// ======================================================
// ACCEPTED CUSTOM-HAMPER QUOTE PAYMENT
// ======================================================
export const createQuotePaymentOrder = asyncHandler(async (req, res) => {
  const { quoteId } = req.params;
  const { quote, rfq, version } = await getAcceptedQuoteBundle({
    quoteId,
    userId: req.user._id,
  });
  if (quote.order) {
    const order = await Order.findOne({
      _id: quote.order,
      user: req.user._id,
    });
    return res.status(200).json({
      success: true,
      alreadyPaid: true,
      order,
    });
  }
  const previousCaptured = await Payment.findOne({
    sourceType: "quote",
    quote: quote._id,
    status: PAYMENT_STATUS.CAPTURED,
  }).sort({ createdAt: -1 });
  if (previousCaptured?.razorpayPaymentId) {
    try {
      const gatewayPayment = await fetchGatewayPayment(
        previousCaptured.razorpayPaymentId
      );
      if (gatewayPayment.status === "captured") {
        const order = await markPaymentCaptured({
          paymentRecord: previousCaptured,
          gatewayPayment,
        });
        return res.status(200).json({
          success: true,
          alreadyPaid: true,
          order,
        });
      }
    } catch (error) {
      console.error("Quote payment recovery failed:", error.message);
    }
  }
  const existingPayment = await Payment.findOne({
    sourceType: "quote",
    quote: quote._id,
    status: {
      $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.AUTHORIZED],
    },
  }).sort({ createdAt: -1 });
  if (existingPayment) {
    quote.payment = existingPayment._id;
    await quote.save();
    rfq.payment = existingPayment._id;
    rfq.commercialPaymentStatus = "pending";
    rfq.nextAction = "Customer payment pending";
    await rfq.save();
    return res.status(200).json({
      success: true,
      checkout: {
        keyId: getRazorpayKeyId(),
        quoteId: quote._id,
        quoteNumber: quote.quoteId,
        razorpayOrderId: existingPayment.razorpayOrderId,
        amount: existingPayment.amount,
        amountPaise: existingPayment.amountPaise,
        currency: existingPayment.currency,
        checkoutMode: "quote",
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone || "",
        },
      },
    });
  }
  const amount = roundMoney(version.total);
  const amountPaise = Math.round(amount * 100);
  let gatewayOrder;
  try {
    gatewayOrder = await createGatewayOrder({
      amountPaise,
      currency: version.currency || "INR",
      receipt: quote.quoteId,
      notes: {
        hamporiumQuoteId: String(quote._id),
        quoteNumber: quote.quoteId,
        rfqId: String(rfq._id),
        rfqNumber: rfq.rfqId,
        acceptedVersion: String(version.versionNumber),
        checkoutMode: "quote",
      },
    });
  } catch (error) {
    console.error(
      "Razorpay quote order creation failed:",
      error?.error?.description || error.message
    );
    return res.status(502).json({
      success: false,
      message: "Unable to start quotation payment. Please try again.",
    });
  }
  const payment = await Payment.create({
    user: req.user._id,
    sourceType: "quote",
    quote: quote._id,
    rfq: rfq._id,
    order: null,
    amount,
    amountPaise,
    currency: version.currency || "INR",
    receipt: quote.quoteId,
    razorpayOrderId: gatewayOrder.id,
  });
  quote.payment = payment._id;
  await quote.save();
  rfq.payment = payment._id;
  rfq.commercialPaymentStatus = "pending";
  rfq.nextAction = "Customer payment pending";
  await rfq.save();
  res.status(201).json({
    success: true,
    message: "Quotation payment order created",
    checkout: {
      keyId: getRazorpayKeyId(),
      quoteId: quote._id,
      quoteNumber: quote.quoteId,
      razorpayOrderId: gatewayOrder.id,
      amount,
      amountPaise,
      currency: version.currency || "INR",
      checkoutMode: "quote",
      prefill: {
        name: req.user.name,
        email: req.user.email,
        contact: req.user.phone || "",
      },
    },
  });
});
export const verifyQuotePayment = asyncHandler(async (req, res) => {
  const { quoteId } = req.params;
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;
  const { quote } = await getAcceptedQuoteBundle({
    quoteId,
    userId: req.user._id,
  });
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: "Payment verification details are incomplete",
    });
  }
  const payment = await Payment.findOne({
    sourceType: "quote",
    quote: quote._id,
    razorpayOrderId: razorpay_order_id,
    user: req.user._id,
  }).sort({ createdAt: -1 });
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "Quotation payment record not found",
    });
  }
  const validSignature = verifyPaymentSignature({
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!validSignature) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment signature",
    });
  }
  let gatewayPayment;
  try {
    gatewayPayment = await fetchGatewayPayment(razorpay_payment_id);
  } catch {
    return res.status(502).json({
      success: false,
      message:
        "Payment was verified but status could not be confirmed. Please retry.",
    });
  }
  if (gatewayPayment.order_id !== payment.razorpayOrderId) {
    return res.status(400).json({
      success: false,
      message: "Gateway payment order mismatch",
    });
  }
  if (gatewayPayment.status === "captured") {
    const order = await markPaymentCaptured({
      paymentRecord: payment,
      gatewayPayment,
      signature: razorpay_signature,
    });
    return res.status(200).json({
      success: true,
      message: "Quotation payment successful and order placed",
      order,
    });
  }
  if (gatewayPayment.status === "authorized") {
    payment.status = PAYMENT_STATUS.AUTHORIZED;
    payment.razorpayPaymentId = gatewayPayment.id;
    payment.razorpaySignature = razorpay_signature;
    payment.method = gatewayPayment.method || "";
    await payment.save();
    return res.status(202).json({
      success: true,
      paymentPending: true,
      message: "Payment verified and is awaiting capture.",
    });
  }
  if (gatewayPayment.status === "failed") {
    await markPaymentFailed({
      paymentRecord: payment,
      gatewayPayment,
    });
    return res.status(409).json({
      success: false,
      message: gatewayPayment.error_description || "Payment failed",
    });
  }
  return res.status(409).json({
    success: false,
    message: "Payment has not been captured",
  });
});
// ======================================================
// PAYMENT HISTORY
// ======================================================
export const getMyPayments = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { page, limit, skip } = getPagination(req.query, 10, 50);
  const filter = {
    user: req.user._id,
  };
  if (status) {
    if (!Object.values(PAYMENT_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }
    filter.status = status;
  }
  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate(
      "order",
      "orderNumber checkoutMode items.itemType items.productName items.productSlug items.skuName items.skuCode items.image items.quantity items.customHamper.containerName items.customHamper.containerImage partnerPromo totalAmount currency status paymentStatus deliveryDate invoiceNumber invoiceIssuedAt createdAt"
    )
    .populate(
      "quote",
      "quoteId status acceptedVersionNumber order paidAt createdAt"
    )
    .populate(
      "rfq",
      "rfqId title sourceType commercialPaymentStatus quantity"
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select(
      "sourceType order quote rfq provider status amount refundedAmount currency receipt razorpayOrderId razorpayPaymentId method paidAt lastRefundAt createdAt"
    )
    .lean();
  res.status(200).json({
    success: true,
    payments,
    pagination: getPaginationMeta(total, page, limit),
  });
});
export const getMyPaymentById = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  if (!mongoose.isValidObjectId(paymentId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment ID",
    });
  }
  const payment = await Payment.findOne({
    _id: paymentId,
    user: req.user._id,
  })
    .populate(
      "order",
      "orderNumber checkoutMode quote rfq commercialSnapshot bulkOrder items recipient deliveryAddress deliveryDate giftMessage partnerAttribution partnerPromo baseSubtotal discountAmount taxableAmount taxAmount taxSummary subtotal shippingAmount totalAmount currency status paymentStatus cancellation paidAt invoiceNumber invoiceIssuedAt createdAt"
    )
    .populate(
      "quote",
      "quoteId status acceptedVersionNumber order paidAt createdAt"
    )
    .populate(
      "rfq",
      "rfqId title sourceType commercialPaymentStatus quantity"
    )
    .select(
      "sourceType order quote rfq provider status amount amountPaise refundedAmount refundedAmountPaise currency receipt razorpayOrderId razorpayPaymentId method email contact errorCode errorDescription paidAt lastRefundAt createdAt"
    )
    .lean();
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "Payment not found",
    });
  }
  res.status(200).json({
    success: true,
    payment,
  });
});
