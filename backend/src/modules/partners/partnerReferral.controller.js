import mongoose from "mongoose";

import Partner from "./partner.model.js";
import PartnerReferral from "./partnerReferral.model.js";
import PartnerProject from "./partnerProject.model.js";
import Showcase from "../showcases/showcase.model.js";

import asyncHandler from "../../utils/asyncHandler.js";
import createAuditLog from "../../helpers/createAuditLog.js";

import {
  PARTNER_REFERRAL_STATUS,
  PARTNER_STATUS,
} from "../../constants/statuses.js";

const clean = (value, maxLength = 160) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const normalizeCode = (value) => clean(value, 40).toUpperCase();
const sameId = (a, b) => String(a || "") === String(b || "");

const findApprovedPartnerByCode = async (code) =>
  Partner.findOne({
    referralCode: normalizeCode(code),
    status: PARTNER_STATUS.APPROVED,
  }).select(
    "partnerId referralCode businessName status owner +customerDiscountRate"
  );

const validateProjectAndShowcase = async ({
  partnerId,
  projectId,
  showcaseId,
}) => {
  let project = null;
  let showcase = null;

  if (projectId) {
    if (!mongoose.isValidObjectId(projectId)) {
      return { error: "Invalid partner project ID" };
    }

    project = await PartnerProject.findOne({
      _id: projectId,
      partner: partnerId,
    }).select("_id");

    if (!project) {
      return { error: "Partner project does not belong to this referral" };
    }
  }

  if (showcaseId) {
    if (!mongoose.isValidObjectId(showcaseId)) {
      return { error: "Invalid showcase ID" };
    }

    showcase = await Showcase.findOne({
      _id: showcaseId,
      partner: partnerId,
    }).select("_id project");

    if (!showcase) {
      return { error: "Showcase does not belong to this referral" };
    }

    if (project && !sameId(showcase.project, project._id)) {
      return { error: "Showcase does not belong to the selected project" };
    }

    if (!project && showcase.project) {
      project = { _id: showcase.project };
    }
  }

  return { project, showcase };
};

const buildSnapshot = ({ partner, referral, project, showcase, source }) => ({
  partner: partner._id,
  referral: referral?._id || null,
  partnerId: partner.partnerId,
  referralCode: partner.referralCode,
  project: project?._id || referral?.project || null,
  showcase: showcase?._id || referral?.showcase || null,
  acquiredAt: referral?.acquiredAt || new Date(),
  source: clean(source, 80) || referral?.source || "partner_referral",
});

const buildPromo = (partner) => ({
  partner: partner._id,
  partnerId: partner.partnerId,
  referralCode: partner.referralCode,
  businessName: partner.businessName,
  discountPercent: Math.max(
    0,
    Math.min(100, Number(partner.customerDiscountRate || 0))
  ),
});

const upsertExplicitReferral = async ({
  userId,
  partner,
  project,
  showcase,
  source,
}) => {
  const now = new Date();
  let referral = await PartnerReferral.findOne({ user: userId });

  if (!referral) {
    try {
      referral = await PartnerReferral.create({
        partner: partner._id,
        user: userId,
        referralCode: partner.referralCode,
        source: clean(source, 80) || "promo_code",
        project: project?._id || null,
        showcase: showcase?._id || null,
        status: PARTNER_REFERRAL_STATUS.ACTIVE,
        acquiredAt: now,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      referral = await PartnerReferral.findOne({ user: userId });
    }
  }

  if (referral) {
    const partnerChanged = !sameId(referral.partner, partner._id);

    referral.partner = partner._id;
    referral.referralCode = partner.referralCode;
    referral.source = clean(source, 80) || "promo_code";
    referral.project = project?._id || null;
    referral.showcase = showcase?._id || null;
    referral.status = PARTNER_REFERRAL_STATUS.ACTIVE;
    referral.revokedAt = null;
    referral.revokedBy = null;
    referral.revokeReason = "";

    if (partnerChanged || !referral.acquiredAt) {
      referral.acquiredAt = now;
    }

    await referral.save();
  }

  return referral;
};

export const resolveReferralPublic = asyncHandler(async (req, res) => {
  const code = normalizeCode(req.params.code);
  const partner = code ? await findApprovedPartnerByCode(code) : null;

  if (!partner) {
    return res.status(404).json({
      success: false,
      valid: false,
      message: "Partner referral is unavailable",
    });
  }

  res.json({
    success: true,
    valid: true,
    referral: {
      referralCode: partner.referralCode,
      partnerId: partner.partnerId,
      businessName: partner.businessName,
      discountPercent: Math.max(
        0,
        Math.min(100, Number(partner.customerDiscountRate || 0))
      ),
    },
  });
});

/*
 * Attribution rules for orders:
 * 1. An explicitly submitted approved code is authoritative for that order.
 * 2. No explicit code means NO normal retail attribution. This prevents an old
 *    stored referral from silently earning commission after the customer has
 *    removed the promo code.
 * 3. Persistent referral fallback is retained only for an explicit partner
 *    project/showcase context.
 * 4. Customer discount is returned only for an explicit code.
 */
export const resolvePartnerAttributionForOrder = async ({
  userId,
  referralCode = "",
  projectId = null,
  showcaseId = null,
  source = "checkout",
}) => {
  if (!userId || !mongoose.isValidObjectId(userId)) return null;

  const code = normalizeCode(referralCode);

  if (code) {
    const partner = await findApprovedPartnerByCode(code);
    if (!partner) return null;

    const context = await validateProjectAndShowcase({
      partnerId: partner._id,
      projectId,
      showcaseId,
    });

    if (context.error) {
      const error = new Error(context.error);
      error.statusCode = 400;
      throw error;
    }

    const referral = await upsertExplicitReferral({
      userId,
      partner,
      project: context.project,
      showcase: context.showcase,
      source,
    });

    return {
      referral,
      snapshot: buildSnapshot({
        partner,
        referral,
        project: context.project,
        showcase: context.showcase,
        source: clean(source, 80) || "promo_code",
      }),
      promo: buildPromo(partner),
    };
  }

  // Normal retail checkout without a submitted code must stay unattributed.
  if (!projectId && !showcaseId) return null;

  const referral = await PartnerReferral.findOne({
    user: userId,
    status: PARTNER_REFERRAL_STATUS.ACTIVE,
  }).populate("partner", "partnerId referralCode businessName status owner");

  if (!referral || referral.partner?.status !== PARTNER_STATUS.APPROVED) {
    return null;
  }

  const context = await validateProjectAndShowcase({
    partnerId: referral.partner._id,
    projectId,
    showcaseId,
  });

  if (context.error) {
    const error = new Error(context.error);
    error.statusCode = 400;
    throw error;
  }

  return {
    referral,
    snapshot: {
      partner: referral.partner._id,
      referral: referral._id,
      partnerId: referral.partner.partnerId,
      referralCode: referral.referralCode,
      project: context.project?._id || referral.project || null,
      showcase: context.showcase?._id || referral.showcase || null,
      acquiredAt: referral.acquiredAt,
      source: clean(source, 80) || referral.source || "partner_context",
    },
    promo: null,
  };
};

export const claimReferral = asyncHandler(async (req, res) => {
  const result = await resolvePartnerAttributionForOrder({
    userId: req.user._id,
    referralCode: req.body.referralCode,
    projectId: req.body.projectId || null,
    showcaseId: req.body.showcaseId || null,
    source: req.body.source || "partner_link",
  });

  if (!result) {
    return res.status(404).json({
      success: false,
      message: "Valid approved partner referral not found",
    });
  }

  await createAuditLog({
    req,
    action: "partner_referral_claimed",
    module: "partners",
    entityType: "partner_referral",
    entityId: result.referral?._id || result.snapshot.partner,
    description: "Persistent partner referral attribution established.",
    metadata: {
      partnerId: result.snapshot.partner,
      referralCode: result.snapshot.referralCode,
      projectId: result.snapshot.project,
      showcaseId: result.snapshot.showcase,
    },
  });

  res.status(200).json({
    success: true,
    message: "Partner referral linked to your account",
    referral: {
      id: result.referral?._id || null,
      referralCode: result.snapshot.referralCode,
      partnerId: result.snapshot.partnerId,
      acquiredAt: result.snapshot.acquiredAt,
      source: result.snapshot.source,
      discountPercent: Number(result.promo?.discountPercent || 0),
    },
  });
});

export const getMyReferral = asyncHandler(async (req, res) => {
  const referral = await PartnerReferral.findOne({
    user: req.user._id,
    status: PARTNER_REFERRAL_STATUS.ACTIVE,
  })
    .populate({
      path: "partner",
      select: "partnerId businessName referralCode status +customerDiscountRate",
    })
    .populate("project", "projectId title status")
    .populate("showcase", "showcaseId title status")
    .lean();

  if (!referral) {
    return res.json({ success: true, referral: null });
  }

  res.json({
    success: true,
    referral: {
      _id: referral._id,
      referralCode: referral.referralCode,
      source: referral.source,
      status: referral.status,
      acquiredAt: referral.acquiredAt,
      project: referral.project || null,
      showcase: referral.showcase || null,
      partner: referral.partner
        ? {
            _id: referral.partner._id,
            partnerId: referral.partner.partnerId,
            businessName: referral.partner.businessName,
            referralCode: referral.partner.referralCode,
            status: referral.partner.status,
            discountPercent: Math.max(
              0,
              Math.min(100, Number(referral.partner.customerDiscountRate || 0))
            ),
          }
        : null,
    },
  });
});

export const clearMyReferral = asyncHandler(async (req, res) => {
  const referral = await PartnerReferral.findOne({
    user: req.user._id,
    status: PARTNER_REFERRAL_STATUS.ACTIVE,
  });

  if (!referral) {
    return res.status(200).json({
      success: true,
      message: "No active partner referral is linked to your account",
    });
  }

  referral.status = PARTNER_REFERRAL_STATUS.REVOKED;
  referral.revokedAt = new Date();
  referral.revokedBy = req.user._id;
  referral.revokeReason = "Cleared by customer";
  await referral.save();

  await createAuditLog({
    req,
    action: "partner_referral_cleared_by_customer",
    module: "partners",
    entityType: "partner_referral",
    entityId: referral._id,
    description: "Customer cleared the active partner referral.",
  });

  res.json({ success: true, message: "Partner promo/referral cleared" });
});

export const revokeReferralAdmin = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid referral ID" });
  }

  const referral = await PartnerReferral.findById(req.params.id);
  if (!referral) {
    return res.status(404).json({ success: false, message: "Referral not found" });
  }

  referral.status = PARTNER_REFERRAL_STATUS.REVOKED;
  referral.revokedAt = new Date();
  referral.revokedBy = req.user._id;
  referral.revokeReason = clean(req.body.reason, 1000);
  await referral.save();

  await createAuditLog({
    req,
    action: "partner_referral_revoked",
    module: "partners",
    entityType: "partner_referral",
    entityId: referral._id,
    description: "Persistent partner referral revoked by internal staff.",
    metadata: { reason: referral.revokeReason },
  });

  res.json({ success: true, message: "Referral revoked", referral });
});
