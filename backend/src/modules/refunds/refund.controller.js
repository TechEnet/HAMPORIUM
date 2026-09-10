import mongoose from "mongoose";

import Refund from "./refund.model.js";
import Order from "../orders/order.model.js";
import Payment from "../payments/payment.model.js";
import ProductionJob from "../production/productionJob.model.js";
import Fulfilment from "../fulfilment/fulfilment.model.js";

import asyncHandler from "../../utils/asyncHandler.js";
import createAuditLog from "../../helpers/createAuditLog.js";
import notifyUser from "../../helpers/notifyUser.js";
import { createGatewayRefund } from "../../helpers/refundGateway.js";
import { syncCommissionForRefundedOrder } from "../commissions/commission.controller.js";

import {
  CANCELLATION_STATUS,
  FULFILMENT_STATUS,
  NOTIFICATION_TYPE,
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PRODUCTION_STAGE,
  REFUND_STATUS,
  REFUND_TYPE,
} from "../../constants/statuses.js";

const isValidId = (id) => mongoose.isValidObjectId(id);
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const toPaise = (value) => Math.round(roundMoney(value) * 100);

const cleanString = (value, maxLength = 1000) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const getPaymentForOrder = async (order) => {
  if (order.payment) {
    const payment = await Payment.findById(order.payment);
    if (payment) return payment;
  }

  return Payment.findOne({
    order: order._id,
    status: {
      $in: [
        PAYMENT_STATUS.CAPTURED,
        PAYMENT_STATUS.PARTIALLY_REFUNDED,
        PAYMENT_STATUS.REFUNDED,
      ],
    },
  }).sort({ createdAt: -1 });
};

const getCompletedRefundTotalPaise = async (paymentId) => {
  const result = await Refund.aggregate([
    {
      $match: {
        payment: new mongoose.Types.ObjectId(paymentId),
        status: REFUND_STATUS.COMPLETED,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amountPaise" },
      },
    },
  ]);

  return Number(result[0]?.total || 0);
};

const getReservedRefundTotalPaise = async (paymentId) => {
  const result = await Refund.aggregate([
    {
      $match: {
        payment: new mongoose.Types.ObjectId(paymentId),
        status: {
          $in: [
            REFUND_STATUS.CREATED,
            REFUND_STATUS.PROCESSING,
            REFUND_STATUS.COMPLETED,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amountPaise" },
      },
    },
  ]);

  return Number(result[0]?.total || 0);
};

export const syncPaymentRefundTotals = async (paymentId) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) return null;

  const completedPaise = await getCompletedRefundTotalPaise(payment._id);
  const cappedPaise = Math.min(completedPaise, Number(payment.amountPaise || 0));

  payment.refundedAmountPaise = cappedPaise;
  payment.refundedAmount = roundMoney(cappedPaise / 100);
  payment.lastRefundAt = cappedPaise > 0 ? new Date() : payment.lastRefundAt;

  if (cappedPaise >= Number(payment.amountPaise || 0) && payment.amountPaise > 0) {
    payment.status = PAYMENT_STATUS.REFUNDED;
  } else if (cappedPaise > 0) {
    payment.status = PAYMENT_STATUS.PARTIALLY_REFUNDED;
  } else if (
    [PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED].includes(
      payment.status
    )
  ) {
    payment.status = PAYMENT_STATUS.CAPTURED;
  }

  await payment.save();

  const order = await Order.findById(payment.order);

  if (order) {
    if (payment.status === PAYMENT_STATUS.REFUNDED) {
      order.paymentStatus = ORDER_PAYMENT_STATUS.REFUNDED;
    } else if (payment.status === PAYMENT_STATUS.PARTIALLY_REFUNDED) {
      order.paymentStatus = ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED;
    } else if (payment.status === PAYMENT_STATUS.CAPTURED) {
      order.paymentStatus = ORDER_PAYMENT_STATUS.PAID;
    }

    await order.save();

    try {
      await syncCommissionForRefundedOrder({ order, payment });
    } catch (error) {
      console.error(`Partner commission refund sync failed for order ${order.orderNumber || order._id}:`, error.message);
    }
  }

  return payment;
};

const mapGatewayRefundStatus = (gatewayStatus) => {
  const status = String(gatewayStatus || "").toLowerCase();

  if (status === "processed") return REFUND_STATUS.COMPLETED;
  if (status === "failed") return REFUND_STATUS.FAILED;
  return REFUND_STATUS.PROCESSING;
};

const fireRefundNotification = ({ refund, order, stage }) => {
  const orderNumber = order?.orderNumber || String(refund.order);
  const amountLabel = `₹${Number(refund.amount || 0).toFixed(2)}`;

  if (stage === "initiated") {
    void notifyUser({
      recipient: refund.user,
      type: NOTIFICATION_TYPE.REFUND,
      title: "Refund Initiated",
      message: `${amountLabel} refund for order ${orderNumber} has been initiated.`,
      entityType: "refund",
      entityId: refund._id,
      actionUrl: `/account/orders/${refund.order}`,
      eventKey: `refund-initiated:${refund._id}`,
      metadata: {
        orderId: refund.order,
        refundId: refund._id,
      },
      email: {
        enabled: true,
        subject: `Refund initiated for ${orderNumber}`,
        textContent: `${amountLabel} refund for order ${orderNumber} has been initiated. You will receive another update when it is completed.`,
        actionLabel: "View refund status",
      },
      whatsapp: {
        enabled: true,
        templateKey: "refund_initiated",
        bodyParameters: [amountLabel, orderNumber],
        includeActionUrl: true,
      },
    });
  }

  if (stage === "completed") {
    void notifyUser({
      recipient: refund.user,
      type: NOTIFICATION_TYPE.REFUND,
      title: "Refund Completed",
      message: `${amountLabel} refund for order ${orderNumber} has been completed.`,
      entityType: "refund",
      entityId: refund._id,
      actionUrl: `/account/orders/${refund.order}`,
      eventKey: `refund-completed:${refund._id}`,
      metadata: {
        orderId: refund.order,
        refundId: refund._id,
      },
      email: {
        enabled: true,
        subject: `Refund completed for ${orderNumber}`,
        textContent: `${amountLabel} refund for order ${orderNumber} has been completed by Razorpay. Bank settlement time can vary by payment method.`,
        actionLabel: "View order",
      },
      whatsapp: {
        enabled: true,
        templateKey: "refund_completed",
        bodyParameters: [amountLabel, orderNumber],
        includeActionUrl: true,
      },
    });
  }

  if (stage === "failed") {
    void notifyUser({
      recipient: refund.user,
      type: NOTIFICATION_TYPE.REFUND,
      title: "Refund Update",
      message: `The refund for order ${orderNumber} needs attention. Our team will review it.`,
      entityType: "refund",
      entityId: refund._id,
      actionUrl: `/account/orders/${refund.order}`,
      eventKey: `refund-failed:${refund._id}`,
      metadata: {
        orderId: refund.order,
        refundId: refund._id,
      },
      email: {
        enabled: true,
        subject: `Refund update for ${orderNumber}`,
        textContent: `The refund for order ${orderNumber} could not be completed automatically. Our team will review it.`,
        actionLabel: "View order",
      },
      whatsapp: {
        enabled: true,
        templateKey: "refund_failed",
        bodyParameters: [orderNumber],
        includeActionUrl: true,
      },
    });
  }
};

export const applyGatewayRefundState = async ({
  refund,
  gatewayRefund,
  webhookEventId = "",
}) => {
  const previousStatus = refund.status;
  let nextStatus = mapGatewayRefundStatus(gatewayRefund?.status);

  /*
   * Keep webhook processing monotonic. A late refund.created/pending event
   * must never downgrade an already processed refund.
   */
  if (previousStatus === REFUND_STATUS.COMPLETED) {
    nextStatus = REFUND_STATUS.COMPLETED;
  } else if (
    previousStatus === REFUND_STATUS.FAILED &&
    nextStatus === REFUND_STATUS.PROCESSING
  ) {
    nextStatus = REFUND_STATUS.FAILED;
  }

  refund.razorpayRefundId = gatewayRefund?.id || refund.razorpayRefundId;

  const incomingProviderStatus = String(gatewayRefund?.status || "");
  const isDowngradeEvent =
    (previousStatus === REFUND_STATUS.COMPLETED &&
      nextStatus === REFUND_STATUS.COMPLETED &&
      incomingProviderStatus !== "processed") ||
    (previousStatus === REFUND_STATUS.FAILED &&
      nextStatus === REFUND_STATUS.FAILED &&
      incomingProviderStatus !== "failed");

  if (!isDowngradeEvent && incomingProviderStatus) {
    refund.providerStatus = incomingProviderStatus;
  }
  refund.speedRequested = String(
    gatewayRefund?.speed_requested || refund.speedRequested || ""
  );
  refund.speedProcessed = String(
    gatewayRefund?.speed_processed || refund.speedProcessed || ""
  );
  refund.arn = String(
    gatewayRefund?.acquirer_data?.arn || refund.arn || ""
  );

  if (webhookEventId && !refund.webhookEventIds.includes(webhookEventId)) {
    refund.webhookEventIds.push(webhookEventId);
  }

  refund.status = nextStatus;

  if (nextStatus === REFUND_STATUS.PROCESSING) {
    refund.initiatedAt = refund.initiatedAt || new Date();
    refund.failedAt = null;
    refund.errorCode = "";
    refund.errorDescription = "";
  }

  if (nextStatus === REFUND_STATUS.COMPLETED) {
    refund.initiatedAt = refund.initiatedAt || new Date();
    refund.completedAt = refund.completedAt || new Date();
    refund.failedAt = null;
    refund.errorCode = "";
    refund.errorDescription = "";
  }

  if (nextStatus === REFUND_STATUS.FAILED) {
    refund.failedAt = refund.failedAt || new Date();
    refund.errorCode = cleanString(
      gatewayRefund?.error_code || gatewayRefund?.status || "REFUND_FAILED",
      120
    );
    refund.errorDescription = cleanString(
      gatewayRefund?.error_description || "Razorpay could not process the refund.",
      1500
    );
  }

  await refund.save();

  const order = await Order.findById(refund.order).select(
    "orderNumber user paymentStatus status"
  );

  if (nextStatus === REFUND_STATUS.COMPLETED) {
    await syncPaymentRefundTotals(refund.payment);
  }

  if (
    nextStatus === REFUND_STATUS.PROCESSING &&
    previousStatus !== REFUND_STATUS.PROCESSING
  ) {
    fireRefundNotification({ refund, order, stage: "initiated" });
  }

  if (
    nextStatus === REFUND_STATUS.COMPLETED &&
    previousStatus !== REFUND_STATUS.COMPLETED
  ) {
    fireRefundNotification({ refund, order, stage: "completed" });
  }

  if (
    nextStatus === REFUND_STATUS.FAILED &&
    previousStatus !== REFUND_STATUS.FAILED
  ) {
    fireRefundNotification({ refund, order, stage: "failed" });
  }

  return refund;
};

export const initiateRefundForOrder = async ({
  order,
  payment,
  amountPaise = null,
  reason,
  type = REFUND_TYPE.FULL,
  idempotencyKey,
  requestedBy = null,
  processedBy = null,
  metadata = {},
}) => {
  if (!order?._id || !payment?._id) {
    throw new Error("Order and captured payment are required for refund");
  }

  if (!payment.razorpayPaymentId) {
    throw new Error("Captured Razorpay payment ID is unavailable");
  }

  const existing = await Refund.findOne({ idempotencyKey });
  if (existing) return existing;

  const syncedPayment = (await syncPaymentRefundTotals(payment._id)) || payment;
  const reservedRefundPaise = await getReservedRefundTotalPaise(
    syncedPayment._id
  );
  const refundablePaise = Math.max(
    0,
    Number(syncedPayment.amountPaise || 0) - reservedRefundPaise
  );

  const requestedPaise =
    amountPaise === null || amountPaise === undefined
      ? refundablePaise
      : Math.round(Number(amountPaise));

  if (!Number.isInteger(requestedPaise) || requestedPaise <= 0) {
    throw new Error("There is no refundable amount remaining");
  }

  if (requestedPaise > refundablePaise) {
    throw new Error("Refund amount exceeds the remaining refundable amount");
  }

  const receipt = `RFD-${String(order._id).slice(-18)}`;

  let refund;

  try {
    refund = await Refund.create({
      order: order._id,
      payment: syncedPayment._id,
      user: order.user,
      type,
      status: REFUND_STATUS.CREATED,
      amount: roundMoney(requestedPaise / 100),
      amountPaise: requestedPaise,
      currency: syncedPayment.currency || order.currency || "INR",
      reason: cleanString(reason, 1000) || "Refund requested",
      razorpayPaymentId: syncedPayment.razorpayPaymentId,
      idempotencyKey,
      requestedBy,
      processedBy,
      receipt,
      metadata,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await Refund.findOne({ idempotencyKey });
      if (duplicate) return duplicate;
    }

    throw error;
  }

  try {
    const gatewayRefund = await createGatewayRefund({
      paymentId: syncedPayment.razorpayPaymentId,
      amountPaise: requestedPaise,
      receipt,
      notes: {
        hamporiumOrderId: String(order._id),
        hamporiumOrderNumber: order.orderNumber || "",
        hamporiumRefundId: String(refund._id),
        reason: cleanString(reason, 200),
      },
    });

    refund.initiatedAt = new Date();
    await refund.save();

    fireRefundNotification({ refund, order, stage: "initiated" });

    return applyGatewayRefundState({
      refund,
      gatewayRefund,
    });
  } catch (error) {
    refund.status = REFUND_STATUS.FAILED;
    refund.failedAt = new Date();
    refund.errorCode = cleanString(
      error?.error?.code || error?.statusCode || "REFUND_API_ERROR",
      120
    );
    refund.errorDescription = cleanString(
      error?.error?.description || error?.message || "Refund initiation failed",
      1500
    );

    await refund.save();
    fireRefundNotification({ refund, order, stage: "failed" });
    return refund;
  }
};

export const getMyRefunds = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { user: req.user._id };

  if (req.query.status) {
    if (!Object.values(REFUND_STATUS).includes(req.query.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund status",
      });
    }

    filter.status = req.query.status;
  }

  const [refunds, total] = await Promise.all([
    Refund.find(filter)
      .populate("order", "orderNumber totalAmount currency status paymentStatus")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Refund.countDocuments(filter),
  ]);

  res.json({
    success: true,
    refunds,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getMyRefundById = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.refundId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid refund ID",
    });
  }

  const refund = await Refund.findOne({
    _id: req.params.refundId,
    user: req.user._id,
  })
    .populate("order", "orderNumber totalAmount currency status paymentStatus")
    .lean();

  if (!refund) {
    return res.status(404).json({
      success: false,
      message: "Refund not found",
    });
  }

  res.json({ success: true, refund });
});

export const getAdminRefunds = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.status) {
    if (!Object.values(REFUND_STATUS).includes(req.query.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund status",
      });
    }

    filter.status = req.query.status;
  }

  if (req.query.order && isValidId(req.query.order)) {
    filter.order = req.query.order;
  }

  const [refunds, total] = await Promise.all([
    Refund.find(filter)
      .populate("user", "name email phone")
      .populate("order", "orderNumber totalAmount currency status paymentStatus cancellation")
      .populate("payment", "status amount refundedAmount razorpayPaymentId")
      .populate("requestedBy", "name email")
      .populate("processedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Refund.countDocuments(filter),
  ]);

  res.json({
    success: true,
    refunds,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getCancellationRequests = asyncHandler(async (req, res) => {
  const status = req.query.status || CANCELLATION_STATUS.REQUESTED;

  if (!Object.values(CANCELLATION_STATUS).includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid cancellation status",
    });
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {
    "cancellation.status": status,
  };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email phone")
      .populate("payment", "status amount refundedAmount razorpayPaymentId paidAt")
      .populate("cancellation.refund", "status amount razorpayRefundId createdAt")
      .sort({ "cancellation.requestedAt": -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const reviewOrderCancellation = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const decision = cleanString(req.body.decision, 30).toLowerCase();
  const reviewNote = cleanString(req.body.note, 1000);

  if (!isValidId(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
    });
  }

  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({
      success: false,
      message: "Decision must be approve or reject",
    });
  }

  const order = await Order.findById(orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  if (order.cancellation?.status !== CANCELLATION_STATUS.REQUESTED) {
    return res.status(409).json({
      success: false,
      message: "This order does not have a pending cancellation request",
      cancellation: order.cancellation,
    });
  }

  if (decision === "reject") {
    order.cancellation.status = CANCELLATION_STATUS.REJECTED;
    order.cancellation.reviewedAt = new Date();
    order.cancellation.reviewedBy = req.user._id;
    order.cancellation.reviewNote = reviewNote;
    await order.save();

    void notifyUser({
      recipient: order.user,
      type: NOTIFICATION_TYPE.ORDER,
      title: "Cancellation Request Rejected",
      message: `Cancellation request for ${order.orderNumber} was not approved.`,
      entityType: "order",
      entityId: order._id,
      actionUrl: `/account/orders/${order._id}`,
      eventKey: `cancellation-rejected:${order._id}:${order.cancellation.requestedAt?.getTime() || "request"}`,
      metadata: { reviewNote },
      email: {
        enabled: true,
        subject: `Cancellation update for ${order.orderNumber}`,
        textContent: `Your cancellation request for ${order.orderNumber} was not approved.${reviewNote ? ` Note: ${reviewNote}` : ""}`,
        actionLabel: "View order",
      },
      whatsapp: {
        enabled: true,
        templateKey: "cancellation_rejected",
        bodyParameters: [order.orderNumber],
        includeActionUrl: true,
      },
    });

    await createAuditLog({
      req,
      action: "order_cancellation_rejected",
      module: "orders",
      entityType: "order",
      entityId: order._id,
      description: `Cancellation request rejected for ${order.orderNumber}.`,
      metadata: { reviewNote },
    });

    return res.json({
      success: true,
      message: "Cancellation request rejected",
      order,
      refund: null,
    });
  }

  const shippedShipment = await Fulfilment.findOne({
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

  if (shippedShipment) {
    return res.status(409).json({
      success: false,
      message:
        "Cancellation cannot be approved after dispatch. Handle this as a return/refund exception instead.",
    });
  }

  const payment = await getPaymentForOrder(order);

  if (!payment) {
    return res.status(409).json({
      success: false,
      message: "Captured payment record not found for this order",
    });
  }

  if (
    ![
      PAYMENT_STATUS.CAPTURED,
      PAYMENT_STATUS.PARTIALLY_REFUNDED,
      PAYMENT_STATUS.REFUNDED,
    ].includes(payment.status)
  ) {
    return res.status(409).json({
      success: false,
      message: "Only captured payments can be refunded",
    });
  }

  order.cancellation.status = CANCELLATION_STATUS.APPROVED;
  order.cancellation.reviewedAt = new Date();
  order.cancellation.reviewedBy = req.user._id;
  order.cancellation.reviewNote = reviewNote;
  order.status = ORDER_STATUS.CANCELLED;
  await order.save();

  const job = await ProductionJob.findOne({
    sourceType: "order",
    sourceId: String(order._id),
  });

  if (
    job &&
    ![
      PRODUCTION_STAGE.SHIPPED,
      PRODUCTION_STAGE.DELIVERED,
      PRODUCTION_STAGE.CANCELLED,
    ].includes(job.stage)
  ) {
    job.stage = PRODUCTION_STAGE.CANCELLED;
    job.updatedBy = req.user._id;
    job.history.push({
      stage: PRODUCTION_STAGE.CANCELLED,
      note: "Order cancellation approved.",
      by: req.user._id,
    });
    await job.save();
  }

  await Fulfilment.updateMany(
    {
      sourceType: "order",
      sourceId: String(order._id),
      status: {
        $in: [FULFILMENT_STATUS.CREATED, FULFILMENT_STATUS.LABEL_READY],
      },
    },
    {
      $set: {
        status: FULFILMENT_STATUS.CANCELLED,
        updatedBy: req.user._id,
      },
      $push: {
        history: {
          status: FULFILMENT_STATUS.CANCELLED,
          note: "Order cancellation approved before dispatch.",
          by: req.user._id,
          at: new Date(),
        },
      },
    }
  );

  void notifyUser({
    recipient: order.user,
    type: NOTIFICATION_TYPE.ORDER,
    title: "Cancellation Approved",
    message: `Your cancellation request for ${order.orderNumber} has been approved.`,
    entityType: "order",
    entityId: order._id,
    actionUrl: `/account/orders/${order._id}`,
    eventKey: `cancellation-approved:${order._id}`,
    email: {
      enabled: true,
      subject: `Cancellation approved for ${order.orderNumber}`,
      textContent: `Your cancellation request for ${order.orderNumber} has been approved. If payment was captured, the refund is being initiated to the original payment method.`,
      actionLabel: "View order",
    },
    whatsapp: {
      enabled: true,
      templateKey: "cancellation_approved",
      bodyParameters: [order.orderNumber],
      includeActionUrl: true,
    },
  });

  let refund = null;

  if (payment.status !== PAYMENT_STATUS.REFUNDED) {
    refund = await initiateRefundForOrder({
      order,
      payment,
      reason: order.cancellation.reason || "Order cancellation approved",
      type: REFUND_TYPE.FULL,
      idempotencyKey: `cancellation:${order._id}`,
      requestedBy: order.cancellation.requestedBy || order.user,
      processedBy: req.user._id,
      metadata: {
        source: "cancellation_approval",
        reviewNote,
      },
    });

    order.cancellation.refund = refund?._id || null;
    await order.save();
  }

  await createAuditLog({
    req,
    action: "order_cancellation_approved",
    module: "orders",
    entityType: "order",
    entityId: order._id,
    description: `Cancellation approved for ${order.orderNumber}.`,
    metadata: {
      reviewNote,
      refundId: refund?._id || null,
      refundStatus: refund?.status || null,
    },
  });

  res.json({
    success: true,
    message: refund
      ? "Cancellation approved and refund workflow started"
      : "Cancellation approved",
    order,
    refund,
  });
});

export const createAdminRefund = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const reason = cleanString(req.body.reason, 1000);
  const requestKey = cleanString(req.body.requestKey, 100);
  const amount = Number(req.body.amount);

  if (!isValidId(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
    });
  }

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: "Refund reason is required",
    });
  }

  if (requestKey.length < 8) {
    return res.status(400).json({
      success: false,
      message: "requestKey must be at least 8 characters for idempotency",
    });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Refund amount must be greater than zero",
    });
  }

  const order = await Order.findById(orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const payment = await getPaymentForOrder(order);

  if (!payment?.razorpayPaymentId) {
    return res.status(409).json({
      success: false,
      message: "Captured Razorpay payment is required for refund",
    });
  }

  const amountPaise = toPaise(amount);
  const type =
    amountPaise >= Number(payment.amountPaise || 0)
      ? REFUND_TYPE.FULL
      : REFUND_TYPE.PARTIAL;

  const refund = await initiateRefundForOrder({
    order,
    payment,
    amountPaise,
    reason,
    type,
    idempotencyKey: `manual:${order._id}:${requestKey}`,
    requestedBy: req.user._id,
    processedBy: req.user._id,
    metadata: {
      source: "admin_manual_refund",
      requestKey,
    },
  });

  await createAuditLog({
    req,
    action: "refund_initiated",
    module: "payments",
    entityType: "refund",
    entityId: refund._id,
    description: `Refund ${refund._id} initiated for ${order.orderNumber}.`,
    metadata: {
      orderId: order._id,
      amount: refund.amount,
      status: refund.status,
    },
  });

  res.status(refund.status === REFUND_STATUS.FAILED ? 502 : 201).json({
    success: refund.status !== REFUND_STATUS.FAILED,
    message:
      refund.status === REFUND_STATUS.FAILED
        ? "Refund record created but Razorpay initiation failed"
        : "Refund initiated",
    refund,
  });
});
