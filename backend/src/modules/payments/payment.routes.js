import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";

import {
  createPaymentOrder,
  verifyPayment,
  createQuotePaymentOrder,
  verifyQuotePayment,
  getMyPayments,
  getMyPaymentById,
} from "./payment.controller.js";

const router = Router();

router.use(protect);

// ================================
// CUSTOMER PAYMENT HISTORY
// ================================

router.get(
  "/my-payments",
  getMyPayments
);

router.get(
  "/my-payments/:paymentId",
  getMyPaymentById
);

// ================================
// ACCEPTED CUSTOM-HAMPER QUOTE
// ================================

router.post(
  "/quotes/:quoteId/create-order",
  createQuotePaymentOrder
);

router.post(
  "/quotes/:quoteId/verify",
  verifyQuotePayment
);

// ================================
// RETAIL RAZORPAY
// ================================

router.post(
  "/create-order",
  createPaymentOrder
);

router.post(
  "/verify",
  verifyPayment
);

export default router;
