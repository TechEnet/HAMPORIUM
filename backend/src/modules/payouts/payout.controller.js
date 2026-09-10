import mongoose from "mongoose";

import PartnerPayout from "./partnerPayout.model.js";
import Partner from "../partners/partner.model.js";
import Commission from "../commissions/commission.model.js";

import asyncHandler from "../../utils/asyncHandler.js";
import notifyUser from "../../helpers/notifyUser.js";
import createAuditLog from "../../helpers/createAuditLog.js";

import {
  COMMISSION_PAYOUT_STATUS,
  COMMISSION_STATUS,
  NOTIFICATION_TYPE,
  PARTNER_PAYOUT_STATUS,
} from "../../constants/statuses.js";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const sameId = (a, b) => String(a || "") === String(b || "");

const getPartnerForUser = async (userId) =>
  Partner.findOne({
    $or: [
      { owner: userId },
      { members: { $elemMatch: { user: userId, isActive: true } } },
    ],
  });

export const getMyPayouts = asyncHandler(async (req, res) => {
  const partner = req.partner || (await getPartnerForUser(req.user._id));

  if (!partner) {
    return res.json({ success: true, payouts: [] });
  }

  const payouts = await PartnerPayout.find({ partner: partner._id })
    .sort({ createdAt: -1 })
    .populate("commissions", "commissionId order amount status payoutStatus")
    .lean();

  res.json({ success: true, payouts });
});

export const getMyPayoutById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid payout ID" });
  }

  const partner = req.partner || (await getPartnerForUser(req.user._id));
  if (!partner) {
    return res.status(403).json({ success: false, message: "Partner account required" });
  }

  const payout = await PartnerPayout.findOne({
    _id: req.params.id,
    partner: partner._id,
  })
    .populate("commissions", "commissionId order eligibleValue amount status payoutStatus")
    .lean();

  if (!payout) {
    return res.status(404).json({ success: false, message: "Payout not found" });
  }

  res.json({ success: true, payout });
});

export const getPayoutsAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.partner && mongoose.isValidObjectId(req.query.partner)) {
    filter.partner = req.query.partner;
  }

  const payouts = await PartnerPayout.find(filter)
    .populate("partner", "partnerId businessName owner")
    .populate("commissions", "commissionId order amount status payoutStatus")
    .populate("createdBy", "name email")
    .populate("processedBy", "name email")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, payouts });
});

export const createPayoutAdmin = asyncHandler(async (req, res) => {
  const { partnerId, commissionIds, adjustmentAmount = 0, note = "", period = {} } = req.body || {};

  if (!mongoose.isValidObjectId(partnerId)) {
    return res.status(400).json({ success: false, message: "Valid partner ID is required" });
  }

  const ids = Array.isArray(commissionIds)
    ? [...new Set(commissionIds.map(String))].filter(mongoose.isValidObjectId)
    : [];

  if (!ids.length) {
    return res.status(400).json({ success: false, message: "Select at least one payable commission" });
  }

  const partner = await Partner.findById(partnerId);
  if (!partner) {
    return res.status(404).json({ success: false, message: "Partner not found" });
  }

  const commissions = await Commission.find({
    _id: { $in: ids },
    partner: partner._id,
    status: COMMISSION_STATUS.PAYABLE,
  });

  if (commissions.length !== ids.length) {
    return res.status(409).json({
      success: false,
      message: "Every selected commission must belong to this partner and be payable",
    });
  }

  const alreadyIncluded = await PartnerPayout.exists({
    commissions: { $in: ids },
    status: {
      $in: [
        PARTNER_PAYOUT_STATUS.PENDING,
        PARTNER_PAYOUT_STATUS.PROCESSING,
        PARTNER_PAYOUT_STATUS.HELD,
        PARTNER_PAYOUT_STATUS.PAID,
      ],
    },
  });

  if (alreadyIncluded) {
    return res.status(409).json({
      success: false,
      message: "One or more selected commissions are already included in another payout",
    });
  }

  const grossAmount = roundMoney(
    commissions.reduce((sum, commission) => sum + Number(commission.amount || 0), 0)
  );
  const adjustment = roundMoney(adjustmentAmount);
  const netAmount = roundMoney(grossAmount + adjustment);

  if (netAmount < 0) {
    return res.status(400).json({ success: false, message: "Net payout amount cannot be negative" });
  }

  const payout = await PartnerPayout.create({
    partner: partner._id,
    commissions: commissions.map((commission) => commission._id),
    period: {
      from: period.from || null,
      to: period.to || null,
    },
    grossAmount,
    adjustmentAmount: adjustment,
    netAmount,
    currency: commissions[0]?.currency || "INR",
    status: PARTNER_PAYOUT_STATUS.PENDING,
    note: String(note || "").trim(),
    createdBy: req.user._id,
    history: [
      {
        status: PARTNER_PAYOUT_STATUS.PENDING,
        changedBy: req.user._id,
        note: "Payout batch created.",
      },
    ],
  });

  await createAuditLog({
    req,
    action: "partner_payout_created",
    module: "commissions",
    entityType: "partner_payout",
    entityId: payout._id,
    description: `Partner payout ${payout.payoutId} created.`,
    metadata: { partnerId: partner._id, grossAmount, adjustment, netAmount },
  });

  res.status(201).json({ success: true, message: "Partner payout created", payout });
});

export const updatePayoutAdmin = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid payout ID" });
  }

  const payout = await PartnerPayout.findById(req.params.id);
  if (!payout) {
    return res.status(404).json({ success: false, message: "Payout not found" });
  }

  const status = req.body.status;
  const allowed = Object.values(PARTNER_PAYOUT_STATUS);
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid payout status" });
  }

  if (payout.status === PARTNER_PAYOUT_STATUS.PAID && status !== PARTNER_PAYOUT_STATUS.PAID) {
    return res.status(409).json({ success: false, message: "Paid payout cannot be moved backwards" });
  }

  const reference = String(req.body.reference || payout.reference || "").trim();
  if (status === PARTNER_PAYOUT_STATUS.PAID && !reference) {
    return res.status(400).json({ success: false, message: "Payment reference is required" });
  }

  payout.status = status;
  payout.reference = reference;
  payout.paymentMethod = String(req.body.paymentMethod || payout.paymentMethod || "bank_transfer").trim();
  payout.note = String(req.body.note ?? payout.note ?? "").trim();
  payout.processedBy = req.user._id;
  payout.processedAt = new Date();
  payout.history.push({
    status,
    changedBy: req.user._id,
    note: String(req.body.note || "").trim(),
  });

  if (status === PARTNER_PAYOUT_STATUS.PAID) {
    payout.paidAt = new Date();
  }

  await payout.save();

  const commissions = await Commission.find({ _id: { $in: payout.commissions } });
  for (const commission of commissions) {
    if (status === PARTNER_PAYOUT_STATUS.PAID) {
      commission.status = COMMISSION_STATUS.PAID;
      commission.payoutStatus = COMMISSION_PAYOUT_STATUS.PAID;
      commission.payout.reference = payout.reference;
      commission.payout.paidAt = payout.paidAt;
      commission.payout.note = payout.note;
      commission.history.push({
        status: COMMISSION_STATUS.PAID,
        changedBy: req.user._id,
        note: `Paid in payout ${payout.payoutId}.`,
      });
    } else if (status === PARTNER_PAYOUT_STATUS.HELD) {
      commission.payoutStatus = COMMISSION_PAYOUT_STATUS.HELD;
    } else if (
      [PARTNER_PAYOUT_STATUS.FAILED, PARTNER_PAYOUT_STATUS.CANCELLED].includes(status) &&
      commission.status === COMMISSION_STATUS.PAYABLE
    ) {
      commission.payoutStatus = COMMISSION_PAYOUT_STATUS.PENDING;
    }

    await commission.save();
  }

  const partner = await Partner.findById(payout.partner).select("owner businessName");
  if (partner && [PARTNER_PAYOUT_STATUS.PAID, PARTNER_PAYOUT_STATUS.HELD, PARTNER_PAYOUT_STATUS.FAILED].includes(status)) {
    const title = status === PARTNER_PAYOUT_STATUS.PAID
      ? "Partner Payout Completed"
      : status === PARTNER_PAYOUT_STATUS.HELD
        ? "Partner Payout On Hold"
        : "Partner Payout Update";

    void notifyUser({
      recipient: partner.owner,
      type: NOTIFICATION_TYPE.PAYOUT,
      title,
      message: `Payout ${payout.payoutId} is ${status.replaceAll("_", " ")}.`,
      entityType: "partner_payout",
      entityId: payout._id,
      actionUrl: "/partner/payouts",
      eventKey: `partner-payout:${payout._id}:${status}:${payout.updatedAt?.getTime() || Date.now()}`,
      email: {
        enabled: true,
        subject: `${title} — HAMPORIUM`,
        textContent: `Your HAMPORIUM payout ${payout.payoutId} for ₹${Number(payout.netAmount || 0).toFixed(2)} is ${status.replaceAll("_", " ")}.`,
      },
    });
  }

  await createAuditLog({
    req,
    action: `partner_payout_${status}`,
    module: "commissions",
    entityType: "partner_payout",
    entityId: payout._id,
    description: `Partner payout ${payout.payoutId} changed to ${status}.`,
    metadata: { reference: payout.reference },
  });

  res.json({ success: true, message: "Partner payout updated", payout });
});
