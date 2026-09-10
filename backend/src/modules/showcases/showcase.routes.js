import express from "express";

import protect from "../../middlewares/auth.middleware.js";

import {
  allowRoles,
} from "../../middlewares/access.middleware.js";

import {
  createShowcase,
  getMyShowcases,
  getShowcaseById,
  publishShowcase,
  revokeShowcase,
  getShowcasesAdmin,

  requestShowcaseOtp,
  verifyShowcaseOtp,
  getPublicShowcase,
  recordClientAction,
} from "./showcase.controller.js";


const router =
  express.Router();


// ======================================================
// PUBLIC SECURE SHOWCASE
// MUST STAY BEFORE router.use(protect)
// ======================================================

router.post(
  "/public/:token/request-otp",
  requestShowcaseOtp
);

router.post(
  "/public/:token/verify-otp",
  verifyShowcaseOtp
);

router.get(
  "/public/session/view",
  getPublicShowcase
);

router.post(
  "/public/session/actions",
  recordClientAction
);


// ======================================================
// PROTECTED PARTNER / ADMIN
// ======================================================

router.use(protect);


router.post(
  "/",
  createShowcase
);

router.get(
  "/mine",
  getMyShowcases
);


// ADMIN BEFORE :id

router.get(
  "/admin/all",
  allowRoles(
    "admin",
    "operations"
  ),
  getShowcasesAdmin
);


router.get(
  "/:id",
  getShowcaseById
);

router.post(
  "/:id/publish",
  publishShowcase
);

router.post(
  "/:id/revoke",
  revokeShowcase
);


export default router;