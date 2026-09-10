import express from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";

import {
  validateCreateRFQ,
  validateCreateCustomHamperRFQ,
  validateSubmitRFQ,
} from "./rfq.validation.js";

import {
  createRFQ,
  createCustomHamperRFQ,
  updateRFQ,
  submitRFQ,
  getMyRFQs,
  getRFQById,
  cancelRFQ,
  getAllRFQs,
  updateRFQAdmin,
} from "./rfq.controller.js";

const router = express.Router();

router.use(protect);

// ======================================
// CUSTOMER
// ======================================

router.post(
  "/custom-hamper",
  validateCreateCustomHamperRFQ,
  createCustomHamperRFQ
);

router.post(
  "/",
  validateCreateRFQ,
  createRFQ
);

router.get(
  "/mine",
  getMyRFQs
);

// ======================================
// ADMIN / OPERATIONS
// IMPORTANT: keep before /:id
// ======================================

router.get(
  "/admin/all",
  allowRoles("admin", "operations"),
  getAllRFQs
);

router.patch(
  "/:id/admin",
  allowRoles("admin", "operations"),
  updateRFQAdmin
);

// ======================================
// CUSTOMER ACTIONS
// ======================================

router.post(
  "/:id/submit",
  validateSubmitRFQ,
  submitRFQ
);

router.post(
  "/:id/cancel",
  cancelRFQ
);

router.patch(
  "/:id",
  updateRFQ
);

// ======================================
// SHARED DETAIL
// ======================================

router.get(
  "/:id",
  getRFQById
);

export default router;
