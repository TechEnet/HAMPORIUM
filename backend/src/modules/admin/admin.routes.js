import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";

import {
  allowRoles,
} from "../../middlewares/access.middleware.js";

import {
  ROLES,
} from "../../constants/roles.js";

import {
  getAdminDashboard,

  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,

  getAdminPayments,
  getAdminPaymentById,
} from "./admin.controller.js";


const router = Router();


const adminAccess = allowRoles(
  ROLES.ADMIN,
  ROLES.OPERATIONS
);


router.use(
  protect,
  adminAccess
);


// ================================
// DASHBOARD
// ================================

router.get(
  "/dashboard",
  getAdminDashboard
);


// ================================
// ORDERS
// ================================

router.get(
  "/orders",
  getAdminOrders
);

router.get(
  "/orders/:orderId",
  getAdminOrderById
);

router.patch(
  "/orders/:orderId/status",
  updateAdminOrderStatus
);


// ================================
// PAYMENTS
// ================================

router.get(
  "/payments",
  getAdminPayments
);

router.get(
  "/payments/:paymentId",
  getAdminPaymentById
);


export default router;