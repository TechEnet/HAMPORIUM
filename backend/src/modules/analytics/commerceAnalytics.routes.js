import { Router } from "express";

import {
  getAdminCommerceSummary,
  recordProductView,
} from "./commerceAnalytics.controller.js";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { ROLES } from "../../constants/roles.js";

const router = Router();
const adminAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

/* =========================================================
   PUBLIC
========================================================= */
router.post("/events/product-view", recordProductView);

/* =========================================================
   ADMIN
========================================================= */
router.get(
  "/admin/summary",
  protect,
  adminAccess,
  getAdminCommerceSummary
);

export default router;
