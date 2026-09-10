import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { requirePartner } from "../../middlewares/partner.middleware.js";
import { ROLES } from "../../constants/roles.js";

import {
  createPayoutAdmin,
  getMyPayoutById,
  getMyPayouts,
  getPayoutsAdmin,
  updatePayoutAdmin,
} from "./payout.controller.js";

const router = Router();
const financeAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

router.use(protect);

router.get("/mine", requirePartner, getMyPayouts);
router.get("/mine/:id", requirePartner, getMyPayoutById);

router.get("/admin/all", financeAccess, getPayoutsAdmin);
router.post("/admin", financeAccess, createPayoutAdmin);
router.patch("/admin/:id", financeAccess, updatePayoutAdmin);

export default router;
