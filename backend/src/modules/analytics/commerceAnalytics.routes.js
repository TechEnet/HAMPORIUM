// EXACT PATH: backend/src/modules/analytics/commerceAnalytics.routes.js
// REPLACE FILE

import { Router } from "express";
import { getAdminCommerceSummary, recordProductView } from "./commerceAnalytics.controller.js";
import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { attachConsentedAnalyticsCustomer } from "../../middlewares/analyticsCustomerIdentity.middleware.js";
import { ROLES } from "../../constants/roles.js";

const router = Router();
const adminAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

// Keep anonymous visitors visible in aggregate product-view analytics.
router.post("/events/product-view", attachConsentedAnalyticsCustomer, recordProductView);
router.get("/admin/summary", protect, adminAccess, getAdminCommerceSummary);
export default router;