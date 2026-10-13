import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { ROLES } from "../../constants/roles.js";
import {
  getMyActivityConsent, updateMyActivityConsent, deleteMyActivityHistory,
  collectMyActivityEvents, adminOverview, adminCustomers, adminCustomerDetail,
  adminCustomerOrders, adminCustomerPayments, adminCustomerActivity,
  adminCustomerInsights, adminCustomerTimeline,
  adminCustomerSuspend, adminCustomerReactivate, adminCustomerDelete, adminCustomerAccountActions,
} from "./customerIntelligence.controller.js";

const router = Router();
router.use(protect);

const eventsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Activity submission rate limit exceeded" },
});

// Customer-owned controls. Registration and purchase records are managed separately.
router.get("/me/consent", getMyActivityConsent);
router.put("/me/consent", updateMyActivityConsent);
router.delete("/me/activity", deleteMyActivityHistory);
router.post("/me/events", eventsLimiter, collectMyActivityEvents);

// PII is restricted to ADMIN, not operations or partners.
router.use("/admin", allowRoles(ROLES.ADMIN));
router.get("/admin/overview", adminOverview);
router.get("/admin/customers", adminCustomers);
router.get("/admin/customers/:customerId", adminCustomerDetail);
router.get("/admin/customers/:customerId/orders", adminCustomerOrders);
router.get("/admin/customers/:customerId/payments", adminCustomerPayments);
router.get("/admin/customers/:customerId/activity", adminCustomerActivity);
router.get("/admin/customers/:customerId/insights", adminCustomerInsights);
router.get("/admin/customers/:customerId/timeline", adminCustomerTimeline);
router.get("/admin/customers/:customerId/account-actions", adminCustomerAccountActions);
// High-impact changes: Admin JWT + explicit written reason + confirmation for deletion.
const moderationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20,
  standardHeaders: true, legacyHeaders: false });
router.post("/admin/customers/:customerId/suspend", moderationLimiter, adminCustomerSuspend);
router.post("/admin/customers/:customerId/reactivate", moderationLimiter, adminCustomerReactivate);
router.delete("/admin/customers/:customerId", moderationLimiter, adminCustomerDelete);
export default router;
