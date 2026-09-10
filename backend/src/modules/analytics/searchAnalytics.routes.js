import {
  Router,
} from "express";

import {
  getAdminSearchSummary,
  recordSearchAnalytics,
} from "./searchAnalytics.controller.js";

import protect from "../../middlewares/auth.middleware.js";

import {
  allowRoles,
} from "../../middlewares/access.middleware.js";

import {
  ROLES,
} from "../../constants/roles.js";

const router =
  Router();

const adminAccess =
  allowRoles(
    ROLES.ADMIN,
    ROLES.OPERATIONS
  );

/* =========================================================
   PUBLIC ANALYTICS
========================================================= */

/**
 * Public because logged-out visitors also search.
 *
 * Does not store password/token/GPS coordinates.
 */
router.post(
  "/search",
  recordSearchAnalytics
);

/* =========================================================
   ADMIN ANALYTICS
========================================================= */

router.get(
  "/admin/search-summary",
  protect,
  adminAccess,
  getAdminSearchSummary
);

export default router;