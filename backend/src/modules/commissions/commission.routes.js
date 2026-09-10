import express from "express";

import protect from "../../middlewares/auth.middleware.js";

import {
  allowRoles,
} from "../../middlewares/access.middleware.js";

import {
  getMyCommissions,
  getCommissionById,

  getCommissionsAdmin,
  createCommissionAttribution,
  linkCommissionOrder,
  updateCommissionStatus,
  reverseCommission,
} from "./commission.controller.js";


const router =
  express.Router();


router.use(protect);


// ======================================================
// PARTNER
// ======================================================

router.get(
  "/mine",
  getMyCommissions
);


// ======================================================
// ADMIN
// Must stay before /:id
// ======================================================

router.get(
  "/admin/all",
  allowRoles(
    "admin",
    "operations"
  ),
  getCommissionsAdmin
);

router.post(
  "/admin/attribute",
  allowRoles(
    "admin",
    "operations"
  ),
  createCommissionAttribution
);

router.post(
  "/admin/:id/order",
  allowRoles(
    "admin",
    "operations"
  ),
  linkCommissionOrder
);

router.patch(
  "/admin/:id/status",
  allowRoles(
    "admin",
    "operations"
  ),
  updateCommissionStatus
);

router.post(
  "/admin/:id/reverse",
  allowRoles(
    "admin",
    "operations"
  ),
  reverseCommission
);


// ======================================================
// DETAIL
// ======================================================

router.get(
  "/:id",
  getCommissionById
);


export default router;