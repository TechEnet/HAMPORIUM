import mongoose from "mongoose";
import asyncHandler from "../../utils/asyncHandler.js";
import Partner from "../partners/partner.model.js";
import PartnerProject from "../partners/partnerProject.model.js";
import Showcase from "../showcases/showcase.model.js";
import Order from "../orders/order.model.js";
import Commission from "./commission.model.js";
import notifyUser from "../../helpers/notifyUser.js";
import createAuditLog from "../../helpers/createAuditLog.js";
import {
  COMMISSION_STATUS,
  COMMISSION_PAYOUT_STATUS,
  NOTIFICATION_TYPE,
  PARTNER_PROJECT_STATUS,
} from "../../constants/statuses.js";
const roundMoney = (v) => Math.round(Number(v || 0) * 100) / 100;
const calc = (v, r) =>
  roundMoney((Number(v || 0) * Number(r || 0)) / 100);
const sameId = (a, b) => String(a || "") === String(b || "");
const isInternal = (req) =>
  (req.user?.roles || []).some((r) =>
    ["admin", "operations", "finance"].includes(r)
  );
const getPartnerForUser = (userId) =>
  Partner.findOne({
    $or: [
      { owner: userId },
      {
        members: {
          $elemMatch: {
            user: userId,
            isActive: true,
          },
        },
      },
    ],
  });
const safe = (c) => ({
  _id: c._id,
  commissionId: c.commissionId,
  referral: c.referral,
  project: c.project,
  showcase: c.showcase,
  order: c.order,
  basis: c.basis,
  eligibleValue: c.eligibleValue,
  currency: c.currency,
  amount: c.amount,
  status: c.status,
  payoutStatus: c.payoutStatus,
  payout: c.payout,
  adjustments: c.adjustments,
  history: c.history,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});
const notifyPartner = async (commission, title, message, event) => {
  const partner = await Partner.findById(commission.partner).select(
    "owner businessName"
  );
  if (!partner?.owner) return;
  void notifyUser({
    recipient: partner.owner,
    type: NOTIFICATION_TYPE.COMMISSION,
    title,
    message,
    entityType: "commission",
    entityId: commission._id,
    actionUrl: "/partner/commissions",
    eventKey: `commission:${commission._id}:${event}`,
    email: {
      enabled: true,
      subject: `${title} - HAMPORIUM`,
      textContent: message,
    },
  });
};
/*
 * Automatic retail commission is intentionally narrower than general partner
 * attribution: an explicit partner code must be frozen on the order. New orders
 * also lock the commission rate and promo-eligible taxable base at checkout.
 */
export const ensureCommissionForPaidOrder = async (
  order,
  { actorId = null } = {}
) => {
  if (!order?._id) return null;

  // Load the private checkout-time commission lock. Normal order queries exclude
  // this field so commission rates never leak to customer-facing APIs.
  const sourceOrder = await Order.findById(order._id).select(
    "+partnerCommissionSnapshot"
  );

  if (!sourceOrder) return null;

  const promo = sourceOrder.partnerPromo;
  const attribution = sourceOrder.partnerAttribution;
  const locked = sourceOrder.partnerCommissionSnapshot;

  // Automatic retail commission requires an explicit partner code snapshot.
  // Project/showcase attribution on its own is not enough.
  if (!promo?.code || !promo?.partner || !attribution?.partner) return null;
  if (!sameId(promo.partner, attribution.partner)) return null;
  if (
    attribution.referralCode &&
    String(attribution.referralCode).trim().toUpperCase() !==
      String(promo.code).trim().toUpperCase()
  ) {
    return null;
  }

  if (locked) {
    if (!sameId(locked.partner, promo.partner)) return null;
    if (
      String(locked.referralCode || "").trim().toUpperCase() !==
      String(promo.code).trim().toUpperCase()
    ) {
      return null;
    }
  }

  const existing = await Commission.findOne({ order: sourceOrder._id });
  if (existing) return existing;

  const partner = await Partner.findById(promo.partner).select(
    "+defaultCommissionRate status owner"
  );
  if (!partner) return null;

  let rate;

  if (locked) {
    rate = Number(locked.rate);
  } else {
    // Legacy fallback for orders created before the private rate snapshot existed.
    rate = Number(partner.defaultCommissionRate || 0);

    if (attribution.project) {
      const project = await PartnerProject.findById(attribution.project).select(
        "+commissionRateOverride"
      );

      if (
        project?.commissionRateOverride !== null &&
        project?.commissionRateOverride !== undefined
      ) {
        rate = Number(project.commissionRateOverride);
      }
    }
  }

  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return null;

  const legacyEligibleValue = roundMoney(
    (sourceOrder.items || [])
      .filter((item) => (item.itemType || "sku") === "sku")
      .reduce((sum, item) => sum + Number(item.taxableAmount || 0), 0)
  );

  const eligibleValue = roundMoney(
    locked?.eligibleValue ?? legacyEligibleValue
  );

  // Custom hampers / non-promo lines never enter the automatic partner basis.
  if (eligibleValue <= 0) return null;

  let commission;

  try {
    commission = await Commission.create({
      idempotencyKey: `order:${sourceOrder._id}`,
      partner: partner._id,
      referral: attribution.referral || null,
      project: attribution.project || null,
      showcase: attribution.showcase || null,
      order: sourceOrder._id,
      attributionSource: "referral",
      basis: locked?.basis || "order_taxable_value",
      originalEligibleValue: eligibleValue,
      eligibleValue,
      currency: sourceOrder.currency || "INR",
      rate,
      amount: calc(eligibleValue, rate),
      status: COMMISSION_STATUS.ORDER_CONFIRMED,
      payoutStatus: COMMISSION_PAYOUT_STATUS.NOT_DUE,
      attributedBy: actorId,
      history: [
        {
          status: COMMISSION_STATUS.ORDER_CONFIRMED,
          changedBy: actorId,
          note: locked
            ? "Paid order commission created from locked partner-code terms."
            : "Paid legacy partner-code order automatically attributed.",
        },
      ],
    });
  } catch (error) {
    // Webhook/API retries may race. Unique order/idempotency indexes make this
    // safe; return the winner instead of surfacing a false payment failure.
    if (error?.code === 11000) {
      return Commission.findOne({ order: sourceOrder._id });
    }
    throw error;
  }

  await notifyPartner(
    commission,
    "Partner Order Attributed",
    `A paid order has been attributed to you. Commission: INR ${commission.amount.toFixed(2)}.`,
    "order-confirmed"
  );

  return commission;
};

export const markCommissionEligibleForOrder = async (
  orderId,
  actorId = null
) => {
  const commission = await Commission.findOne({ order: orderId }).select(
    "+rate"
  );
  if (
    !commission ||
    [
      COMMISSION_STATUS.ELIGIBLE,
      COMMISSION_STATUS.PAYABLE,
      COMMISSION_STATUS.PAID,
      COMMISSION_STATUS.REVERSED,
    ].includes(commission.status)
  ) {
    return commission;
  }
  commission.status = COMMISSION_STATUS.ELIGIBLE;
  commission.history.push({
    status: COMMISSION_STATUS.ELIGIBLE,
    changedBy: actorId,
    note: "Order delivered; commission is eligible.",
  });
  await commission.save();
  await notifyPartner(
    commission,
    "Commission Eligible",
    `Commission ${commission.commissionId} is now eligible.`,
    "eligible"
  );
  return commission;
};
export const syncCommissionForRefundedOrder = async ({
  order,
  payment,
  actorId = null,
}) => {
  const commission = await Commission.findOne({ order: order._id }).select(
    "+rate"
  );
  if (!commission || commission.status === COMMISSION_STATUS.REVERSED) {
    return commission;
  }
  const total = Number(payment?.amount || order.totalAmount || 0);
  const refunded = Number(payment?.refundedAmount || 0);
  const remainingRatio =
    total > 0
      ? Math.max(0, Math.min(1, (total - refunded) / total))
      : 0;
  const nextEligible = roundMoney(
    Number(
      commission.originalEligibleValue || commission.eligibleValue || 0
    ) * remainingRatio
  );
  if (nextEligible <= 0) {
    commission.status = COMMISSION_STATUS.REVERSED;
    commission.payoutStatus = COMMISSION_PAYOUT_STATUS.REVERSED;
    commission.reversal = {
      reason: "Order fully refunded",
      reversedAt: new Date(),
      reversedBy: actorId,
    };
    commission.history.push({
      status: COMMISSION_STATUS.REVERSED,
      changedBy: actorId,
      note: "Commission reversed after full refund.",
    });
    await commission.save();
    await notifyPartner(
      commission,
      "Commission Reversed",
      `Commission ${commission.commissionId} was reversed because the order was fully refunded.`,
      "refund-reversed"
    );
    return commission;
  }
  if (nextEligible < Number(commission.eligibleValue || 0)) {
    const oldAmount = commission.amount;
    commission.eligibleValue = nextEligible;
    commission.amount = calc(nextEligible, commission.rate);
    commission.adjustments.push({
      type: "refund",
      amount: roundMoney(commission.amount - oldAmount),
      note: `Adjusted after refund of INR ${refunded.toFixed(2)}.`,
      at: new Date(),
      by: actorId,
    });
    await commission.save();
    await notifyPartner(
      commission,
      "Commission Adjusted",
      `Commission ${commission.commissionId} was adjusted to INR ${commission.amount.toFixed(2)} after a partial refund.`,
      `refund-adjusted-${refunded}`
    );
  }
  return commission;
};
export const getMyCommissions = asyncHandler(async (req, res) => {
  const partner = req.partner || (await getPartnerForUser(req.user._id));
  if (!partner) {
    return res.json({ success: true, commissions: [] });
  }
  const filter = { partner: partner._id };
  if (req.query.status) filter.status = req.query.status;
  const rows = await Commission.find(filter)
    .populate("project", "projectId title status")
    .populate("showcase", "showcaseId title status")
    .populate("order", "orderNumber totalAmount status paymentStatus")
    .sort({ createdAt: -1 });
  res.json({
    success: true,
    commissions: rows.map(safe),
  });
});
export const getCommissionById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid commission id.",
    });
  }
  const commission = await Commission.findById(req.params.id)
    .populate("partner", "partnerId businessName owner members")
    .populate("project", "projectId title status")
    .populate("showcase", "showcaseId title status")
    .populate("order", "orderNumber totalAmount status paymentStatus");
  if (!commission) {
    return res.status(404).json({
      success: false,
      message: "Commission not found.",
    });
  }
  if (!isInternal(req)) {
    const p = commission.partner;
    const uid = req.user._id;
    if (
      !sameId(p.owner, uid) &&
      !p.members?.some((m) => m.isActive && sameId(m.user, uid))
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this commission.",
      });
    }
    return res.json({
      success: true,
      commission: safe(commission),
    });
  }
  const admin = await Commission.findById(req.params.id)
    .select("+rate")
    .populate("partner", "partnerId businessName")
    .populate("project", "projectId title")
    .populate("showcase", "showcaseId title")
    .populate("order");
  res.json({ success: true, commission: admin });
});
export const getCommissionsAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (
    req.query.partnerId &&
    mongoose.isValidObjectId(req.query.partnerId)
  ) {
    filter.partner = req.query.partnerId;
  }
  const rows = await Commission.find(filter)
    .select("+rate")
    .populate("partner", "partnerId businessName")
    .populate("project", "projectId title status")
    .populate("showcase", "showcaseId title status")
    .populate("order", "orderNumber totalAmount status paymentStatus")
    .sort({ createdAt: -1 });
  res.json({ success: true, commissions: rows });
});
export const createCommissionAttribution = asyncHandler(async (req, res) => {
  const {
    projectId,
    showcaseId,
    orderId,
    basis = "project_value",
    eligibleValue,
    rateOverride,
    note = "",
  } = req.body || {};
  if (!mongoose.isValidObjectId(projectId)) {
    return res.status(400).json({
      success: false,
      message: "Valid partner project id is required.",
    });
  }
  const project = await PartnerProject.findById(projectId).select(
    "+commissionRateOverride"
  );
  if (!project) {
    return res.status(404).json({
      success: false,
      message: "Partner project not found.",
    });
  }
  const partner = await Partner.findById(project.partner).select(
    "+defaultCommissionRate"
  );
  if (!partner) {
    return res.status(404).json({
      success: false,
      message: "Partner not found.",
    });
  }
  let showcase = null;
  if (showcaseId) {
    showcase = await Showcase.findOne({
      _id: showcaseId,
      project: project._id,
      partner: partner._id,
    });
    if (!showcase) {
      return res.status(404).json({
        success: false,
        message: "Showcase does not belong to this project.",
      });
    }
  }
  let order = null;
  if (orderId) {
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id.",
      });
    }
    order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }
  }
  const value = Number(eligibleValue);
  if (!Number.isFinite(value) || value <= 0) {
    return res.status(400).json({
      success: false,
      message: "Eligible commission value must be greater than zero.",
    });
  }
  let rate =
    rateOverride !== undefined && rateOverride !== ""
      ? Number(rateOverride)
      : project.commissionRateOverride ?? partner.defaultCommissionRate;
  rate = Number(rate || 0);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
    return res.status(400).json({
      success: false,
      message:
        "A valid commission rate must be configured before attribution.",
    });
  }
  const existing = order
    ? await Commission.findOne({ order: order._id })
    : null;
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "Commission already exists for this order.",
    });
  }
  const status = order
    ? COMMISSION_STATUS.ORDER_CONFIRMED
    : COMMISSION_STATUS.ATTRIBUTED;
  const commission = await Commission.create({
    idempotencyKey: order ? `order:${order._id}` : undefined,
    partner: partner._id,
    project: project._id,
    showcase: showcase?._id || null,
    order: order?._id || undefined,
    attributionSource: "manual",
    basis,
    originalEligibleValue: value,
    eligibleValue: value,
    rate,
    amount: calc(value, rate),
    status,
    attributedBy: req.user._id,
    history: [
      {
        status,
        changedBy: req.user._id,
        note: String(note || "").trim() || "Partner commission attributed.",
      },
    ],
  });
  if (order) {
    project.status = PARTNER_PROJECT_STATUS.ORDER_ATTRIBUTED;
    project.statusHistory.push({
      status: PARTNER_PROJECT_STATUS.ORDER_ATTRIBUTED,
      changedBy: req.user._id,
      note: "Order attributed to partner project.",
    });
    project.nextAction = "Commission eligibility review";
    await project.save();
  }
  res.status(201).json({
    success: true,
    message: "Commission attributed.",
    commission,
  });
});
const transitions = {
  [COMMISSION_STATUS.POTENTIAL]: [
    COMMISSION_STATUS.ATTRIBUTED,
    COMMISSION_STATUS.REVERSED,
  ],
  [COMMISSION_STATUS.ATTRIBUTED]: [
    COMMISSION_STATUS.ORDER_CONFIRMED,
    COMMISSION_STATUS.REVERSED,
  ],
  [COMMISSION_STATUS.ORDER_CONFIRMED]: [
    COMMISSION_STATUS.ELIGIBLE,
    COMMISSION_STATUS.REVERSED,
  ],
  [COMMISSION_STATUS.ELIGIBLE]: [
    COMMISSION_STATUS.PAYABLE,
    COMMISSION_STATUS.REVERSED,
  ],
  [COMMISSION_STATUS.PAYABLE]: [
    COMMISSION_STATUS.PAID,
    COMMISSION_STATUS.REVERSED,
  ],
  [COMMISSION_STATUS.PAID]: [COMMISSION_STATUS.REVERSED],
  [COMMISSION_STATUS.REVERSED]: [],
};
export const linkCommissionOrder = asyncHandler(async (req, res) => {
  const c = await Commission.findById(req.params.id).select("+rate");
  if (!c) {
    return res.status(404).json({
      success: false,
      message: "Commission not found.",
    });
  }
  const order = await Order.findById(req.body.orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found.",
    });
  }
  const duplicate = await Commission.findOne({
    order: order._id,
    _id: { $ne: c._id },
  });
  if (duplicate) {
    return res.status(409).json({
      success: false,
      message: "Order already has a commission.",
    });
  }
  c.order = order._id;
  c.idempotencyKey = `order:${order._id}`;
  c.status = COMMISSION_STATUS.ORDER_CONFIRMED;
  c.history.push({
    status: c.status,
    changedBy: req.user._id,
    note: req.body.note || "Attributed order confirmed.",
  });
  await c.save();
  res.json({
    success: true,
    message: "Order linked to commission.",
    commission: c,
  });
});
export const updateCommissionStatus = asyncHandler(async (req, res) => {
  const c = await Commission.findById(req.params.id).select("+rate");
  if (!c) {
    return res.status(404).json({
      success: false,
      message: "Commission not found.",
    });
  }
  const { status, note = "" } = req.body || {};
  if (status === COMMISSION_STATUS.REVERSED) {
    return res.status(400).json({
      success: false,
      message: "Use the commission reversal endpoint.",
    });
  }
  if (status === COMMISSION_STATUS.PAID) {
    return res.status(400).json({
      success: false,
      message: "Use the partner payout workflow to mark commissions paid.",
    });
  }
  if (!(transitions[c.status] || []).includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Commission cannot move from ${c.status} to ${status}.`,
    });
  }
  c.status = status;
  c.payoutStatus =
    status === COMMISSION_STATUS.PAYABLE
      ? COMMISSION_PAYOUT_STATUS.PENDING
      : c.payoutStatus;
  c.history.push({
    status,
    changedBy: req.user._id,
    note,
  });
  await c.save();
  if (
    status === COMMISSION_STATUS.ELIGIBLE ||
    status === COMMISSION_STATUS.PAYABLE
  ) {
    await notifyPartner(
      c,
      status === COMMISSION_STATUS.PAYABLE
        ? "Commission Payable"
        : "Commission Eligible",
      `Commission ${c.commissionId} is now ${status}.`,
      status
    );
  }
  res.json({
    success: true,
    message: "Commission status updated.",
    commission: c,
  });
});
export const reverseCommission = asyncHandler(async (req, res) => {
  const c = await Commission.findById(req.params.id).select("+rate");
  if (!c) {
    return res.status(404).json({
      success: false,
      message: "Commission not found.",
    });
  }
  if (c.status === COMMISSION_STATUS.REVERSED) {
    return res.status(400).json({
      success: false,
      message: "Commission is already reversed.",
    });
  }
  const reason = String(req.body.reason || "").trim();
  if (!reason) {
    return res.status(400).json({
      success: false,
      message: "Reversal reason is required.",
    });
  }
  c.status = COMMISSION_STATUS.REVERSED;
  c.payoutStatus = COMMISSION_PAYOUT_STATUS.REVERSED;
  c.reversal = {
    reason,
    reversedAt: new Date(),
    reversedBy: req.user._id,
  };
  c.history.push({
    status: c.status,
    changedBy: req.user._id,
    note: reason,
  });
  await c.save();
  await notifyPartner(
    c,
    "Commission Reversed",
    `Commission ${c.commissionId} was reversed. ${reason}`,
    "manual-reversal"
  );
  await createAuditLog({
    req,
    action: "partner_commission_reversed",
    module: "commissions",
    entityType: "commission",
    entityId: c._id,
    description: `Commission ${c.commissionId} reversed.`,
    metadata: { reason },
  });
  res.json({
    success: true,
    message: "Commission reversed.",
    commission: c,
  });
});
