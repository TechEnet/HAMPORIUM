import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { ROLES } from "../../constants/roles.js";

import {
  createAdminRefund,
  getAdminRefunds,
  getCancellationRequests,
  getMyRefundById,
  getMyRefunds,
  reviewOrderCancellation,
} from "./refund.controller.js";

const router = Router();
const adminAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

router.use(protect);

router.get("/mine", getMyRefunds);
router.get("/mine/:refundId", getMyRefundById);

router.get("/admin", adminAccess, getAdminRefunds);
router.get("/admin/cancellations", adminAccess, getCancellationRequests);
router.patch(
  "/admin/cancellations/:orderId/review",
  adminAccess,
  reviewOrderCancellation
);
router.post("/admin/orders/:orderId", adminAccess, createAdminRefund);

export default router;
