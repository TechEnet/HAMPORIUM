// EXACT PATH: backend/src/modules/analytics/searchAnalytics.routes.js
// REPLACE FILE

import { Router } from "express";
import { getAdminSearchSummary, recordSearchAnalytics } from "./searchAnalytics.controller.js";
import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { attachConsentedAnalyticsCustomer } from "../../middlewares/analyticsCustomerIdentity.middleware.js";
import { ROLES } from "../../constants/roles.js";

const router = Router();
const adminAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

// Public/anonymous search analytics remains functional without login.
router.post("/search", attachConsentedAnalyticsCustomer, recordSearchAnalytics);

router.get("/admin/search-summary", protect, adminAccess, getAdminSearchSummary);
export default router;
