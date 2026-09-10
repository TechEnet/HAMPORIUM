import mongoose from "mongoose";

import User from "../users/user.model.js";
import Product from "../catalog/product.model.js";
import Order from "../orders/order.model.js";
import Payment from "../payments/payment.model.js";

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
} from "../../constants/statuses.js";


const isValidId = (id) => mongoose.isValidObjectId(id);


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

      recentOrders,
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
        "status amount refundedAmount razorpayPaymentId method paidAt lastRefundAt"
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
      orders,

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
        "provider status amount amountPaise refundedAmount refundedAmountPaise currency receipt razorpayOrderId razorpayPaymentId method email contact paidAt lastRefundAt createdAt"
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
        order,
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
          "Paid orders must use the cancellation/refund workflow instead of direct cancellation.",
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

      order,
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
          "user order provider status amount refundedAmount currency receipt razorpayOrderId razorpayPaymentId method email contact errorCode errorDescription paidAt lastRefundAt createdAt"
        )
        .lean();


    res.status(200).json({
      success: true,
      payments,

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
          "user order provider status amount amountPaise refundedAmount refundedAmountPaise currency receipt razorpayOrderId razorpayPaymentId method email contact errorCode errorDescription paidAt lastRefundAt createdAt"
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
      payment,
    });
  });