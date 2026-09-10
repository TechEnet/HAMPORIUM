import express from "express";

import protect from "../../middlewares/auth.middleware.js";
import validate from "../../middlewares/validate.middleware.js";
import { partnerApplicationValidation } from "../auth/auth.validation.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import {
  requireApprovedPartner,
  requirePartner,
  requirePartnerAdmin,
} from "../../middlewares/partner.middleware.js";
import { ROLES } from "../../constants/roles.js";

import {
  addPartnerMember,
  applyPartner,
  createPartnerProject,
  getMyPartner,
  getMyPartnerProjects,
  getPartnerAdmin,
  getPartnerAnalytics,
  getPartnerDashboard,
  getPartnerOrders,
  getPartnerProjectById,
  getPartnerProjectsAdmin,
  getPartnersAdmin,
  removePartnerMember,
  reviewPartnerAdmin,
  submitPartnerProject,
  updateMyPartner,
  updatePartnerProject,
  validatePartnerProjectAdmin,
} from "./partner.controller.js";

import {
  claimReferral,
  clearMyReferral,
  getMyReferral,
  resolveReferralPublic,
  revokeReferralAdmin,
} from "./partnerReferral.controller.js";

const router = express.Router();
const adminAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

// Public referral/promo validation.
router.get("/referrals/resolve/:code", resolveReferralPublic);

router.use(protect);

router.post("/apply", partnerApplicationValidation, validate, applyPartner);

router.post("/referrals/claim", claimReferral);
router.get("/referrals/mine", getMyReferral);
router.delete("/referrals/mine", clearMyReferral);

router.get("/admin/all", adminAccess, getPartnersAdmin);
router.get("/admin/:id", adminAccess, getPartnerAdmin);
router.patch("/admin/:id/review", adminAccess, reviewPartnerAdmin);
router.patch("/admin/referrals/:id/revoke", adminAccess, revokeReferralAdmin);
router.get("/projects/admin/all", adminAccess, getPartnerProjectsAdmin);
router.patch("/projects/:id/validate", adminAccess, validatePartnerProjectAdmin);

router.get("/me", requirePartner, getMyPartner);
router.patch("/me", requirePartnerAdmin, updateMyPartner);
router.get("/dashboard", requirePartner, getPartnerDashboard);
router.get("/analytics", requirePartner, getPartnerAnalytics);
router.get("/orders", requirePartner, getPartnerOrders);

router.post(
  "/members",
  requireApprovedPartner,
  requirePartnerAdmin,
  addPartnerMember
);
router.delete(
  "/members/:userId",
  requireApprovedPartner,
  requirePartnerAdmin,
  removePartnerMember
);

router.post("/projects", requireApprovedPartner, createPartnerProject);
router.get("/projects/mine", requirePartner, getMyPartnerProjects);
router.get("/projects/:id", getPartnerProjectById);
router.patch("/projects/:id", requireApprovedPartner, updatePartnerProject);
router.post("/projects/:id/submit", requireApprovedPartner, submitPartnerProject);

export default router;
