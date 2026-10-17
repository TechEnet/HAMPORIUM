
import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { ROLES } from "../../constants/roles.js";

import {
  getAdminDashboard,
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  getCancellationRequests,
  reviewOrderCancellation,
  getAdminPayments,
  getAdminPaymentById,
} from "./admin.controller.js";

const router = Router();
const adminAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

router.use(protect, adminAccess);

// Dashboard
router.get("/dashboard", getAdminDashboard);

// Cancellation routes BEFORE /orders/:orderId to avoid route shadowing.
router.get("/orders/cancellations", getCancellationRequests);
router.patch("/orders/cancellations/:orderId/review", reviewOrderCancellation);

// Orders
router.get("/orders", getAdminOrders);
router.get("/orders/:orderId", getAdminOrderById);
router.patch("/orders/:orderId/status", updateAdminOrderStatus);

// Payments
router.get("/payments", getAdminPayments);
router.get("/payments/:paymentId", getAdminPaymentById);

export default router;
