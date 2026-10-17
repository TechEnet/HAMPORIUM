
import mongoose from "mongoose";

import User from "../users/user.model.js";
import Product from "../catalog/product.model.js";
import Order from "../orders/order.model.js";
import Payment from "../payments/payment.model.js";
import ProductionJob from "../production/productionJob.model.js";
import Fulfilment from "../fulfilment/fulfilment.model.js";
import createAuditLog from "../../helpers/createAuditLog.js";
import notifyUser from "../../helpers/notifyUser.js";

import asyncHandler from "../../utils/asyncHandler.js";

import {
  getPagination,
  getPaginationMeta,
} from "../../utils/pagination.js";

import {
  PRODUCT_STATUS,
  ORDER_STATUS,
  ORDER_PAYMENT_STATUS,
  PAYMENT_STATUS,
  CANCELLATION_STATUS,
  FULFILMENT_STATUS,
  NOTIFICATION_TYPE,
  PRODUCTION_STAGE,
} from "../../constants/statuses.js";


const isValidId = (id) => mongoose.isValidObjectId(id);

// Remove obsolete UI-facing refund links without deleting stored audit history.
const hideLegacyRefundLinks = (value) => {
  if (!value || typeof value !== "object") return value;
  if (value.cancellation && typeof value.cancellation === "object") {
    delete value.cancellation.refund;
  }
  if (value.order && typeof value.order === "object") {
    hideLegacyRefundLinks(value.order);
  }
  return value;
};


const escapeRegex = (value = "") => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};


const ORDER_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAYMENT_FAILED]: [ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING],
  [ORDER_STATUS.PROCESSING]: [],
  [ORDER_STATUS.SHIPPED]: [],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
});


// ======================================================
// ADMIN DASHBOARD
// ======================================================

export const getAdminDashboard = asyncHandler(
  async (req, res) => {
    const [
      totalUsers,
      totalProducts,
      activeProducts,
      totalOrders,
      paidOrders,
      capturedPayments,
      revenueResult,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments(),

      Product.countDocuments(),

      Product.countDocuments({
        status: PRODUCT_STATUS.ACTIVE,
      }),

      Order.countDocuments(),

      Order.countDocuments({
        paymentStatus: {
          $in: [
            ORDER_PAYMENT_STATUS.PAID,
            ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
            ORDER_PAYMENT_STATUS.REFUNDED,
          ],
        },
      }),

      Payment.countDocuments({
        status: {
          $in: [
            PAYMENT_STATUS.CAPTURED,
            PAYMENT_STATUS.PARTIALLY_REFUNDED,
            PAYMENT_STATUS.REFUNDED,
          ],
        },
      }),

      Payment.aggregate([
        {
          $match: {
            status: {
              $in: [
                PAYMENT_STATUS.CAPTURED,
                PAYMENT_STATUS.PARTIALLY_REFUNDED,
                PAYMENT_STATUS.REFUNDED,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $subtract: [
                  "$amount",
                  { $ifNull: ["$refundedAmount", 0] },
                ],
              },
            },
          },
        },
      ]),

      Order.find()
        .populate(
          "user",
          "name email"
        )
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .select(
          "orderNumber user totalAmount currency status paymentStatus cancellation createdAt"
        )
        .lean(),
    ]);


    const pendingFulfilment =
      await Order.countDocuments({
        paymentStatus: {
          $in: [
            ORDER_PAYMENT_STATUS.PAID,
            ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
          ],
        },

        status: {
          $in: [
            ORDER_STATUS.CONFIRMED,
            ORDER_STATUS.PROCESSING,
          ],
        },
      });


    const totalRevenue =
      revenueResult[0]?.totalRevenue || 0;


    res.status(200).json({
      success: true,

      stats: {
        totalUsers,

        products: {
          total: totalProducts,
          active: activeProducts,
        },

        orders: {
          total: totalOrders,
          paid: paidOrders,
          pendingFulfilment,
        },

        payments: {
          captured: capturedPayments,
        },

        totalRevenue,
        currency: "INR",
      },

      recentOrders: recentOrders.map(hideLegacyRefundLinks),
    });
  }
);


// ======================================================
// ADMIN ORDERS
// ======================================================

export const getAdminOrders = asyncHandler(
  async (req, res) => {
    const {
      search,
      status,
      paymentStatus,
    } = req.query;


    const { page, limit, skip } =
      getPagination(
        req.query,
        20,
        100
      );


    const filter = {};


    if (search?.trim()) {
      const safeSearch =
        escapeRegex(search.trim());

      filter.$or = [
        {
          orderNumber: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          "recipient.fullName": {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          "recipient.phone": {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }


    if (status) {
      if (
        !Object.values(ORDER_STATUS)
          .includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status",
        });
      }

      filter.status = status;
    }


    if (paymentStatus) {
      if (
        !Object.values(
          ORDER_PAYMENT_STATUS
        ).includes(paymentStatus)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status",
        });
      }

      filter.paymentStatus =
        paymentStatus;
    }


    const total =
      await Order.countDocuments(filter);


    const orders = await Order.find(filter)
      .populate(
        "user",
        "name email phone"
      )
      .populate(
        "payment",
        "status amount razorpayPaymentId method paidAt"
      )
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .select(
        "orderNumber user recipient baseSubtotal discountAmount taxableAmount taxAmount subtotal totalAmount currency status paymentStatus cancellation payment deliveryDate paidAt createdAt"
      )
      .lean();


    res.status(200).json({
      success: true,
      orders: orders.map(hideLegacyRefundLinks),

      pagination:
        getPaginationMeta(
          total,
          page,
          limit
        ),
    });
  }
);


// ======================================================
// ADMIN ORDER DETAIL
// ======================================================

export const getAdminOrderById =
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;


    if (!isValidId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }


    const order = await Order.findById(
      orderId
    )
      .populate(
        "user",
        "name email phone roles"
      )
      .populate(
        "payment",
        "provider status amount amountPaise currency receipt razorpayOrderId razorpayPaymentId method email contact paidAt createdAt"
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
      order: hideLegacyRefundLinks(order),
    });
  });


// ======================================================
// ADMIN UPDATE ORDER STATUS
// ======================================================

export const updateAdminOrderStatus =
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;


    if (!isValidId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }


    if (
      !status ||
      !Object.values(ORDER_STATUS)
        .includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }


    const order =
      await Order.findById(orderId);


    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }


    if (order.status === status) {
      return res.status(200).json({
        success: true,
        message:
          "Order already has this status",
        order: hideLegacyRefundLinks(order.toObject()),
      });
    }

    if ([ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED].includes(status)) {
      return res.status(409).json({
        success: false,
        message:
          "Shipped and delivered retail order statuses are controlled by fulfilment.",
      });
    }

    if (
      status === ORDER_STATUS.CANCELLED &&
      [
        ORDER_PAYMENT_STATUS.PAID,
        ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
        ORDER_PAYMENT_STATUS.REFUNDED,
      ].includes(order.paymentStatus)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Paid orders must use the cancellation request review workflow, not direct status changes.",
      });
    }


    const allowedNextStatuses =
      ORDER_TRANSITIONS[
        order.status
      ] || [];


    if (
      !allowedNextStatuses.includes(
        status
      )
    ) {
      return res.status(409).json({
        success: false,

        message:
          `Cannot change order status from ${order.status} to ${status}`,

        allowedStatuses:
          allowedNextStatuses,
      });
    }


    const operationalStatuses = [
      ORDER_STATUS.PROCESSING,
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.DELIVERED,
    ];


    if (
      operationalStatuses.includes(
        status
      ) &&
      ![
        ORDER_PAYMENT_STATUS.PAID,
        ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
      ].includes(order.paymentStatus)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Unpaid order cannot move to fulfilment",
      });
    }


    order.status = status;

    await order.save();


    res.status(200).json({
      success: true,

      message:
        "Order status updated successfully",

      order: hideLegacyRefundLinks(order.toObject()),
    });
  });


// ======================================================
// ADMIN PAYMENTS
// ======================================================

export const getAdminPayments =
  asyncHandler(async (req, res) => {
    const {
      search,
      status,
    } = req.query;


    const { page, limit, skip } =
      getPagination(
        req.query,
        20,
        100
      );


    const filter = {};


    if (status) {
      if (
        !Object.values(
          PAYMENT_STATUS
        ).includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status",
        });
      }

      filter.status = status;
    }


    if (search?.trim()) {
      const safeSearch =
        escapeRegex(search.trim());

      filter.$or = [
        {
          receipt: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          razorpayOrderId: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          razorpayPaymentId: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }


    const total =
      await Payment.countDocuments(
        filter
      );


    const payments =
      await Payment.find(filter)
        .populate(
          "user",
          "name email phone"
        )
        .populate(
          "order",
          "orderNumber status paymentStatus totalAmount"
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .select(
          "user order provider status amount currency receipt razorpayOrderId razorpayPaymentId method email contact errorCode errorDescription paidAt createdAt"
        )
        .lean();


    res.status(200).json({
      success: true,
      payments: payments.map(hideLegacyRefundLinks),

      pagination:
        getPaginationMeta(
          total,
          page,
          limit
        ),
    });
  });


// ======================================================
// ADMIN PAYMENT DETAIL
// ======================================================

export const getAdminPaymentById =
  asyncHandler(async (req, res) => {
    const { paymentId } = req.params;


    if (!isValidId(paymentId)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment ID",
      });
    }


    const payment =
      await Payment.findById(
        paymentId
      )
        .populate(
          "user",
          "name email phone roles"
        )
        .populate(
          "order",
          "orderNumber recipient deliveryAddress deliveryDate items baseSubtotal discountAmount taxableAmount taxAmount taxSummary subtotal shippingAmount totalAmount currency status paymentStatus cancellation paidAt createdAt"
        )
        .select(
          "user order provider status amount amountPaise currency receipt razorpayOrderId razorpayPaymentId method email contact errorCode errorDescription paidAt createdAt"
        )
        .lean();


    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment not found",
      });
    }


    res.status(200).json({
      success: true,
      payment: hideLegacyRefundLinks(payment),
    });
  });

// ======================================================
// ADMIN CANCELLATION REQUESTS (VOLUNTARY, NO REFUNDS)
// ======================================================

const cleanCancellationText = (value, maxLength = 1000) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);

const blockingShipmentStatuses = [
  FULFILMENT_STATUS.DISPATCHED,
  FULFILMENT_STATUS.IN_TRANSIT,
  FULFILMENT_STATUS.OUT_FOR_DELIVERY,
  FULFILMENT_STATUS.DELIVERED,
  FULFILMENT_STATUS.FAILED,
  FULFILMENT_STATUS.RETURNED,
];

export const getCancellationRequests = asyncHandler(async (req, res) => {
  const status = req.query.status || CANCELLATION_STATUS.REQUESTED;
  if (!Object.values(CANCELLATION_STATUS).includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid cancellation status" });
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const skip = (page - 1) * limit;
  const filter = { "cancellation.status": status };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email phone")
      .populate("payment", "status amount razorpayPaymentId paidAt")
      .sort({ "cancellation.requestedAt": -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  // Historical references stay in DB but are excluded from admin responses.
  orders.forEach(hideLegacyRefundLinks);

  return res.json({
    success: true,
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const reviewOrderCancellation = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const decision = cleanCancellationText(req.body?.decision, 30).toLowerCase();
  const reviewNote = cleanCancellationText(req.body?.note, 1000);

  if (!isValidId(orderId)) {
    return res.status(400).json({ success: false, message: "Invalid order ID" });
  }
  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({
      success: false,
      message: "Decision must be approve or reject",
    });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }
  if (order.cancellation?.status !== CANCELLATION_STATUS.REQUESTED) {
    return res.status(409).json({
      success: false,
      message: "This order does not have a pending cancellation request",
    });
  }

  if (decision === "approve") {
    // Only voluntarily cancelled PAID orders with recorded user acknowledgment.
    if (order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID) {
      return res.status(409).json({
        success: false,
        message: "Only confirmed paid orders using the new cancellation policy can be approved here. Review legacy cases manually.",
      });
    }
    if (!order.cancellation?.customerAcknowledgedNoRefundAt) {
      return res.status(409).json({
        success: false,
        message: "Customer has not acknowledged the voluntary cancellation policy. Reject this legacy request and ask for a new request.",
      });
    }
    if (![ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING].includes(order.status)) {
      return res.status(409).json({
        success: false,
        message: "Order is no longer eligible for cancellation.",
      });
    }
    const captured = await Payment.exists({
      order: order._id,
      status: PAYMENT_STATUS.CAPTURED,
    });
    if (!captured) {
      return res.status(409).json({
        success: false,
        message: "Paid payment record could not be verified; manual reconciliation required.",
      });
    }
    const shippedShipment = await Fulfilment.exists({
      sourceType: "order",
      sourceId: String(order._id),
      status: { $in: blockingShipmentStatuses },
    });
    if (shippedShipment) {
      return res.status(409).json({
        success: false,
        message: "Cancellation cannot be approved after dispatch.",
      });
    }
    const shippedJob = await ProductionJob.exists({
      sourceType: "order",
      sourceId: String(order._id),
      stage: { $in: [PRODUCTION_STAGE.SHIPPED, PRODUCTION_STAGE.DELIVERED] },
    });
    if (shippedJob) {
      return res.status(409).json({
        success: false,
        message: "Cancellation cannot be approved after production dispatch.",
      });
    }
  }

  const nextCancellationStatus =
    decision === "approve" ? CANCELLATION_STATUS.APPROVED : CANCELLATION_STATUS.REJECTED;
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      "cancellation.status": CANCELLATION_STATUS.REQUESTED,
      ...(decision === "approve"
        ? {
            status: { $in: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING] },
            paymentStatus: ORDER_PAYMENT_STATUS.PAID,
          }
        : {}),
    },
    {
      $set: {
        "cancellation.status": nextCancellationStatus,
        "cancellation.reviewedAt": new Date(),
        "cancellation.reviewedBy": req.user._id,
        "cancellation.reviewNote": reviewNote,
        ...(decision === "approve" ? { status: ORDER_STATUS.CANCELLED } : {}),
      },
    },
    { new: true, runValidators: true }
  );
  if (!updated) {
    return res.status(409).json({
      success: false,
      message: "Order or cancellation state changed. Refresh and try again.",
    });
  }

  if (decision === "approve") {
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
        $set: { status: FULFILMENT_STATUS.CANCELLED, updatedBy: req.user._id },
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
  }

  const approved = decision === "approve";
  void notifyUser({
    recipient: order.user,
    type: NOTIFICATION_TYPE.ORDER,
    title: approved ? "Cancellation Approved" : "Cancellation Request Rejected",
    message: approved
      ? `Your cancellation request for ${order.orderNumber} has been approved. No payment refund was initiated.`
      : `Cancellation request for ${order.orderNumber} was not approved.`,
    entityType: "order",
    entityId: order._id,
    actionUrl: `/account/orders/${order._id}`,
    eventKey: `cancellation-${approved ? "approved" : "rejected"}:${order._id}:${order.cancellation.requestedAt?.getTime() || "request"}`,
    metadata: { reviewNote, policyVersion: updated.cancellation.policyVersion || "" },
    email: {
      enabled: true,
      subject: `Cancellation update for ${order.orderNumber}`,
      textContent: approved
        ? `Your cancellation request for ${order.orderNumber} was approved. The order was cancelled without initiating a payment refund, subject to applicable law.`
        : `Your cancellation request for ${order.orderNumber} was not approved.${reviewNote ? ` Note: ${reviewNote}` : ""}`,
      actionLabel: "View order",
    },
    // No WhatsApp template here: the previous template may promise a refund.
    // Re-enable only after reviewing and approving non-refund wording.
  });

  await createAuditLog({
    req,
    action: approved ? "order_cancellation_approved" : "order_cancellation_rejected",
    module: "orders",
    entityType: "order",
    entityId: order._id,
    description: `Cancellation ${approved ? "approved" : "rejected"} for ${order.orderNumber}.`,
    metadata: { reviewNote, policyVersion: updated.cancellation.policyVersion || "" },
  });

  // Old financial history stays in the database, never in this response.
  const orderData = hideLegacyRefundLinks(updated.toObject());

  return res.json({
    success: true,
    message: approved
      ? "Cancellation approved. No payment refund was initiated."
      : "Cancellation request rejected",
    order: orderData,
  });
});
