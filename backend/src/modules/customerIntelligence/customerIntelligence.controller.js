import mongoose from "mongoose";
import asyncHandler from "../../utils/asyncHandler.js";
import User from "../users/user.model.js";
import Address from "../users/address.model.js";
import Order from "../orders/order.model.js";
import Payment from "../payments/payment.model.js";
import Partner from "../partners/partner.model.js";
import { CustomerActivity, CustomerActivityConsent, CustomerAccountAction }
  from "./customerIntelligence.model.js";

// ===== Analytics ingest, opt-in and auth response hook =====

export const ALLOWED_WEB_TYPES = new Set([
  "search_submitted", "product_viewed", "cart_item_added",
  "cart_item_removed", "wishlist_item_added", "wishlist_item_removed",
  "builder_started", "hamper_configured", "checkout_started",
]);

const clean = (value, max) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ").trim().slice(0, max);
const objectId = (value) => mongoose.isValidObjectId(value) ? value : null;

export const normalizeWebEvent = (event) => {
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;
  const type = clean(event.type, 60);
  if (!ALLOWED_WEB_TYPES.has(type)) return null;
  const searchQuery = type === "search_submitted" ? clean(event.query, 120) : "";
  if (type === "search_submitted" && (searchQuery.length < 2 ||
      /@|\b\d{10,}\b/.test(searchQuery))) return null;
  const productId = objectId(event.productId);
  const skuId = objectId(event.skuId);
  if (type === "product_viewed" && !productId && !skuId) return null;
  // Reject URL querystrings (which often hold email, tokens, or other PII).
  const pagePath = clean(event.path, 240).split("?")[0].split("#")[0];
  const normalizedPath = pagePath.startsWith("/") && !pagePath.startsWith("//")
    ? pagePath : "";
  const eventKey = clean(event.eventKey, 100);
  return {
    type,
    source: "web",
    productId,
    skuId,
    searchQuery,
    pagePath: normalizedPath,
    ...(eventKey ? { eventKey } : {}),
  };
};

export const writeAuthActivity = async ({ userId, type }) => {
  if (!mongoose.isValidObjectId(userId)) return;
  if (!["account_created", "email_verified", "signed_in"].includes(type)) return;
  await CustomerActivity.create({ user: userId, type, source: "auth" });
};

export const setActivityConsent = async ({ userId, enabled }) => {
  const now = new Date();
  return CustomerActivityConsent.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        analyticsEnabled: enabled,
        noticeVersion: "customer-analytics-v1",
        ...(enabled ? { grantedAt: now, withdrawnAt: null } : { withdrawnAt: now }),
      },
      $setOnInsert: { user: userId },
    },
    { upsert: true, new: true, runValidators: true }
  ).lean();
};

export const storeWebEvents = async ({ userId, events }) => {
  const consent = await CustomerActivityConsent.exists({
    user: userId,
    analyticsEnabled: true,
  });
  if (!consent) return { consentRequired: true, stored: 0 };
  const seenKeys = new Set();
  const normalized = events.map(normalizeWebEvent).filter((event) => {
    if (!event) return false;
    if (!event.eventKey) return true;
    if (seenKeys.has(event.eventKey)) return false;
    seenKeys.add(event.eventKey);
    return true;
  });
  if (!normalized.length) return { consentRequired: false, stored: 0 };
  // Deduplicate by optional eventKey. Only write customer-owned, allowlisted fields.
  const writes = normalized.map((event) => event.eventKey
    ? {
        updateOne: {
          filter: { user: userId, eventKey: event.eventKey },
          update: { $setOnInsert: { user: userId, ...event } },
          upsert: true,
        },
      }
    : { insertOne: { document: { user: userId, ...event } } });
  let result;
  try {
    result = await CustomerActivity.bulkWrite(writes, { ordered: false });
  } catch (error) {
    if (error.code !== 11000) throw error;
    // Duplicate client eventKey is an idempotent no-op, including concurrent retries.
    result = error.result || {};
  }
  return {
    consentRequired: false,
    stored: Number(result.insertedCount || 0) + Number(result.upsertedCount || 0),
  };
};

// ===== Customer and partner aggregation, orders and insights =====

const numeric = (value) => Number(Number(value || 0).toFixed(2));
const safePage = (raw) => Math.max(1, Math.min(100000, Math.floor(Number(raw) || 1)));
const safeLimit = (raw) => Math.max(1, Math.min(100, Math.floor(Number(raw) || 20)));
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ORDER_DELIVERED_SUPPORTED =
  (Order.schema.path("status")?.enumValues || []).includes("delivered");

const orderSummaryPipeline = (match) => [
  { $match: match },
  {
    $group: {
      _id: "$user",
      totalOrders: { $sum: 1 },
      cancelledOrders: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
      cancellationRequests: { $sum: {
        $cond: [
          { $and: [
            { $ne: ["$cancellation.status", "none"] },
            { $ne: ["$cancellation.status", null] },
          ] },
          1, 0,
        ],
      } },
      deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
      paidOrders: { $sum: { $cond: [
        { $in: ["$paymentStatus", ["paid", "partially_refunded", "refunded"]] }, 1, 0,
      ] } },
      paidOrderValue: { $sum: { $cond: [
        { $in: ["$paymentStatus", ["paid", "partially_refunded", "refunded"]] },
        "$totalAmount", 0,
      ] } },
      latestOrderAt: { $max: "$createdAt" },
    },
  },
];

const paymentRefundPipeline = (match) => [
  { $match: match },
  { $match: { sourceType: { $in: ["order", null] } } },
  { $group: {
    _id: { user: "$user", order: "$order" },
    refundAmount: { $sum: "$refundedAmount" },
    refundPaymentRecords: { $sum: { $cond: [
      { $gt: ["$refundedAmount", 0] }, 1, 0,
    ] } },
  } },
  { $group: {
    _id: "$_id.user",
    refundAmount: { $sum: "$refundAmount" },
    refundPaymentRecords: { $sum: "$refundPaymentRecords" },
    refundedOrders: { $sum: { $cond: [
      { $and: [ { $gt: ["$refundAmount", 0] }, { $ne: ["$_id.order", null] } ] },
      1, 0,
    ] } },
  } },
];

const defaults = () => ({
  totalOrders: 0, cancelledOrders: 0, cancellationRequests: 0,
  deliveredOrders: ORDER_DELIVERED_SUPPORTED ? 0 : null,
  deliveredSupported: ORDER_DELIVERED_SUPPORTED,
  paidOrders: 0, paidOrderValue: 0, refundAmount: 0, refundedOrders: 0, refundPaymentRecords: 0,
  latestOrderAt: null, netPaidAfterRefund: 0,
});

const mergeStats = (orderRow, refundRow) => ({
  ...defaults(),
  ...(orderRow ? {
    totalOrders: orderRow.totalOrders,
    cancelledOrders: orderRow.cancelledOrders,
    cancellationRequests: orderRow.cancellationRequests,
    deliveredOrders: ORDER_DELIVERED_SUPPORTED ? orderRow.deliveredOrders : null,
    paidOrders: orderRow.paidOrders,
    paidOrderValue: numeric(orderRow.paidOrderValue),
    latestOrderAt: orderRow.latestOrderAt,
  } : {}),
  ...(refundRow ? {
    refundAmount: numeric(refundRow.refundAmount),
    refundedOrders: refundRow.refundedOrders || 0,
    refundPaymentRecords: refundRow.refundPaymentRecords,
  } : {}),
});

// Role filters are on ONE User ID. A partner who shops uses the same order ledger.
// The "both" segment does not create a separate or duplicate customer document.
export const customerFilter = (search = "", roleType = "all", status = "all") => {
  const filter = { roles: { $in: ["customer", "partner"] },
    $and: [{ roles: { $nin: ["admin", "operations"] } }] };
  switch (String(roleType || "all").toLowerCase()) {
    case "customer":
    case "customer_only":
      filter.roles = { $in: ["customer"], $nin: ["partner"] };
      break;
    case "partner":
    case "partner_only":
      filter.roles = { $in: ["partner"], $nin: ["customer"] };
      break;
    case "both":
      filter.roles = { $all: ["customer", "partner"] };
      break;
    case "all": break;
    default: { const err = new Error("roleType must be all, customer, partner or both");
      err.statusCode = 400; throw err; }
  }
  switch (String(status || "all").toLowerCase()) {
    case "active": filter.isActive = true; filter.isDeleted = { $ne: true }; break;
    case "suspended": filter.isActive = false; filter.isDeleted = { $ne: true }; break;
    case "deleted": filter.isDeleted = true; break;
    case "all": break;
    default: { const err = new Error("status must be all, active, suspended or deleted");
      err.statusCode = 400; throw err; }
  }
  const term = String(search || "").trim().slice(0, 100);
  if (term.length >= 2) {
    const re = new RegExp(escapeRegExp(term), "i");
    filter.$or = [{ name: re }, { email: re }, { phone: re }];
  }
  return filter;
};

const roleTypeForUser = (roles = []) => {
  const customer = roles.includes("customer");
  const partner = roles.includes("partner");
  return customer && partner ? "both" : partner ? "partner" : customer ? "customer" : "other";
};

export const getCustomerOverview = async () => {
  const base = customerFilter();
  const [registeredUsers, activeUsers, deletedUsers, customerOnly, partnerOnly, both,
    orders, refunds, recent] = await Promise.all([
    User.countDocuments(base),
    User.countDocuments({ ...base, isActive: true, isDeleted: { $ne: true } }),
    User.countDocuments({ ...base, isDeleted: true }),
    User.countDocuments(customerFilter("", "customer")),
    User.countDocuments(customerFilter("", "partner")),
    User.countDocuments(customerFilter("", "both")),
    Order.aggregate(orderSummaryPipeline({})),
    Payment.aggregate(paymentRefundPipeline({})),
    User.find(base).select("name email avatar roles isDeleted createdAt isActive")
      .sort({ createdAt: -1 }).limit(6).lean(),
  ]);
  const combinedOrders = orders.reduce((acc, cur) => ({
    totalOrders: acc.totalOrders + cur.totalOrders,
    cancelledOrders: acc.cancelledOrders + cur.cancelledOrders,
    cancellationRequests: acc.cancellationRequests + cur.cancellationRequests,
    deliveredOrders: acc.deliveredOrders + cur.deliveredOrders,
    paidOrders: acc.paidOrders + cur.paidOrders,
    paidOrderValue: acc.paidOrderValue + cur.paidOrderValue,
  }), { totalOrders: 0, cancelledOrders: 0, cancellationRequests: 0,
    deliveredOrders: 0, paidOrders: 0, paidOrderValue: 0 });
  return {
    registeredUsers, activeUsers, deletedUsers,
    roleSegments: { customerOnly, partnerOnly, both, uniqueTotal: registeredUsers },
    orders: { ...combinedOrders,
      deliveredOrders: ORDER_DELIVERED_SUPPORTED ? combinedOrders.deliveredOrders : null,
      deliveredSupported: ORDER_DELIVERED_SUPPORTED,
      paidOrderValue: numeric(combinedOrders.paidOrderValue),
    },
    refunds: {
      refundedAmount: numeric(refunds.reduce((sum, row) => sum + (row.refundAmount || 0), 0)),
      refundPaymentRecords: refunds.reduce((sum, row) => sum + row.refundPaymentRecords, 0),
      refundedOrders: refunds.reduce((sum, row) => sum + (row.refundedOrders || 0), 0),
    },
    recentCustomers: recent.map((u) => ({
      id: u._id, name: u.name, email: u.email, avatar: u.avatar || "",
      roles: u.roles || [], roleType: roleTypeForUser(u.roles || []),
      isDeleted: Boolean(u.isDeleted), createdAt: u.createdAt, isActive: u.isActive,
    })),
    note: "Order/payment totals derive from transaction collections, not tracking events.",
  };
};

export const listCustomerProfiles = async ({ search, page, limit, roleType = "all", status = "all" }) => {
  const pageNumber = safePage(page);
  const pageSize = safeLimit(limit);
  const filter = customerFilter(search, roleType, status);
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).select("name email phone avatar roles isActive isDeleted deletedAt suspendedAt emailVerified createdAt lastLoginAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((pageNumber - 1) * pageSize).limit(pageSize).lean(),
  ]);
  const ids = users.map((u) => u._id);
  if (!ids.length) return { customers: [], total, page: pageNumber, limit: pageSize,
    totalPages: Math.ceil(total / pageSize) };
  const [orders, refunds, addresses] = await Promise.all([
    Order.aggregate(orderSummaryPipeline({ user: { $in: ids } })),
    Payment.aggregate(paymentRefundPipeline({ user: { $in: ids } })),
    Address.aggregate([
      { $match: { user: { $in: ids } } },
      { $sort: { isDefault: -1, updatedAt: -1 } },
      { $group: { _id: "$user", city: { $first: "$city" }, state: { $first: "$state" } } },
    ]),
  ]);
  const orderMap = new Map(orders.map((x) => [String(x._id), x]));
  const refundMap = new Map(refunds.map((x) => [String(x._id), x]));
  const locationMap = new Map(addresses.map((x) => [String(x._id), x]));
  return {
    customers: users.map((u) => ({
      id: u._id, name: u.name, email: u.email, phone: u.phone || "",
      avatar: u.avatar || "", roles: u.roles || [], roleType: roleTypeForUser(u.roles || []),
      isActive: u.isActive, isDeleted: Boolean(u.isDeleted),
      deletedAt: u.deletedAt || null, suspendedAt: u.suspendedAt || null,
      emailVerified: u.emailVerified, createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt || null,
      location: locationMap.get(String(u._id)) || null,
      metrics: mergeStats(orderMap.get(String(u._id)), refundMap.get(String(u._id))),
    })),
    total, page: pageNumber, limit: pageSize,
    totalPages: Math.ceil(total / pageSize), roleType, status,
  };
};

const ensureCustomer = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid customer ID"); err.statusCode = 400; throw err;
  }
  const user = await User.findOne({
    _id: id, roles: { $in: ["customer", "partner"] },
    $and: [{ roles: { $nin: ["admin", "operations"] } }],
  })
    .select("name email phone avatar isActive isDeleted deletedAt suspendedAt emailVerified createdAt updatedAt lastLoginAt roles")
    .lean();
  if (!user) { const err = new Error("Account not found"); err.statusCode = 404; throw err; }
  return user;
};

export const getCustomerProfile = async (id) => {
  const user = await ensureCustomer(id);
  const [addresses, orders, payments, consent, recentOrders, partners, lastActions] = await Promise.all([
    Address.find({ user: user._id })
      .select("label fullName phone addressLine1 addressLine2 landmark city state postalCode country isDefault createdAt")
      .sort({ isDefault: -1, createdAt: -1 }).lean(),
    Order.aggregate(orderSummaryPipeline({ user: user._id })),
    Payment.aggregate(paymentRefundPipeline({ user: user._id })),
    CustomerActivityConsent.findOne({ user: user._id }).lean(),
    Order.find({ user: user._id })
      .select("orderNumber status paymentStatus totalAmount currency createdAt")
      .sort({ createdAt: -1 }).limit(5).lean(),
    Partner.find({ $or: [{ owner: user._id }, { "members.user": user._id }] })
      .select("partnerId businessName status owner members.user members.role members.isActive")
      .limit(50).lean(),
    CustomerAccountAction.find({ target: user._id })
      .select("action status reason actor createdAt completedAt")
      .sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  return {
    customer: {
      id: user._id, name: user.name, email: user.email, phone: user.phone || "",
      avatar: user.avatar || "", isActive: user.isActive, isDeleted: Boolean(user.isDeleted),
      deletedAt: user.deletedAt || null, suspendedAt: user.suspendedAt || null,
      roles: user.roles || [], roleType: roleTypeForUser(user.roles || []),
      emailVerified: user.emailVerified, createdAt: user.createdAt,
      updatedAt: user.updatedAt, lastLoginAt: user.lastLoginAt || null,
    },
    addresses,
    location: addresses[0]
      ? { city: addresses[0].city, state: addresses[0].state, country: addresses[0].country }
      : null,
    metrics: mergeStats(orders[0], payments[0]),
    recentOrders,
    analyticsConsent: Boolean(consent?.analyticsEnabled),
    partnerRecords: partners.map((p) => ({
      id: p._id, partnerId: p.partnerId || "", businessName: p.businessName || "",
      status: p.status || "", relationship: String(p.owner) === String(user._id)
        ? "owner" : "member",
      membershipActive: Boolean(p.members?.some((m) =>
        String(m.user) === String(user._id) && m.isActive)),
    })),
    recentAccountActions: lastActions,
  };
};

export const getCustomerOrders = async (id, { page, limit } = {}) => {
  await ensureCustomer(id);
  const pageNumber = safePage(page), pageSize = safeLimit(limit);
  const filter = { user: id };
  const [total, rows] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .select("orderNumber checkoutMode items.itemType items.productName items.skuName items.quantity items.lineTotal status paymentStatus totalAmount currency cancellation deliveryDate deliveryAddress.city deliveryAddress.state deliveryAddress.postalCode createdAt updatedAt paidAt")
      .sort({ createdAt: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize).lean(),
  ]);
  return { orders: rows, total, page: pageNumber, limit: pageSize, totalPages: Math.ceil(total / pageSize) };
};

export const getCustomerPayments = async (id, { page, limit } = {}) => {
  await ensureCustomer(id);
  const pageNumber = safePage(page), pageSize = safeLimit(limit);
  const filter = { user: id };
  const [total, payments] = await Promise.all([
    Payment.countDocuments(filter),
    Payment.find(filter)
      .select("order quote sourceType status amount refundedAmount currency paidAt lastRefundAt method createdAt updatedAt")
      .sort({ createdAt: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize).lean(),
  ]);
  return { payments, total, page: pageNumber, limit: pageSize, totalPages: Math.ceil(total / pageSize) };
};

export const getCustomerActivity = async (id, { page, limit, type } = {}) => {
  await ensureCustomer(id);
  const pageNumber = safePage(page), pageSize = safeLimit(limit);
  const filter = { user: id };
  if (type && CustomerActivity.schema.path("type").enumValues.includes(type)) filter.type = type;
  const [total, events] = await Promise.all([
    CustomerActivity.countDocuments(filter),
    CustomerActivity.find(filter).select("type source productId skuId searchQuery pagePath createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((pageNumber - 1) * pageSize).limit(pageSize).lean(),
  ]);
  return { events, total, page: pageNumber, limit: pageSize, totalPages: Math.ceil(total / pageSize) };
};

export const getCustomerInsights = async (id) => {
  await ensureCustomer(id);
  const userId = new mongoose.Types.ObjectId(String(id));
  const [topSearches, topViewedProducts, eventCount] = await Promise.all([
    CustomerActivity.aggregate([
      { $match: { user: userId, type: "search_submitted", searchQuery: { $ne: "" } } },
      { $group: { _id: "$searchQuery", count: { $sum: 1 }, lastAt: { $max: "$createdAt" } } },
      { $sort: { count: -1, lastAt: -1 } }, { $limit: 12 },
    ]),
    CustomerActivity.aggregate([
      { $match: { user: userId, type: "product_viewed", productId: { $ne: null } } },
      { $group: { _id: "$productId", count: { $sum: 1 }, lastAt: { $max: "$createdAt" } } },
      { $sort: { count: -1, lastAt: -1 } }, { $limit: 12 },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
      { $project: { count: 1, lastAt: 1, productName: { $ifNull: [{ $first: "$product.name" }, "" ] } } },
    ]),
    CustomerActivity.countDocuments({ user: userId }),
  ]);
  return {
    totalTrackedEvents: eventCount,
    topSearches: topSearches.map((e) => ({ query: e._id, count: e.count, lastAt: e.lastAt })),
    topViewedProducts: topViewedProducts.map((e) => ({ productId: e._id, name: e.productName, views: e.count, lastAt: e.lastAt })),
  };
};

export const getCustomerTimeline = async (id) => {
  const customer = await ensureCustomer(id);
  const [events, orders, payments, accountActions] = await Promise.all([
    CustomerActivity.find({ user: id }).select("type source searchQuery productId skuId pagePath createdAt")
      .sort({ createdAt: -1 }).limit(100).lean(),
    Order.find({ user: id }).select("orderNumber status paymentStatus cancellation.status cancellation.reason cancellation.requestedAt totalAmount createdAt")
      .sort({ createdAt: -1 }).limit(100).lean(),
    Payment.find({ user: id }).select("order status refundedAmount currency paidAt lastRefundAt")
      .sort({ createdAt: -1 }).limit(100).lean(),
    CustomerAccountAction.find({ target: id, status: "completed" })
      .select("action reason completedAt actor").sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  const items = [
    { kind: "account_created", at: customer.createdAt, label: "Account registered", source: "user" },
    ...events.filter((e) => e.type !== "account_created").map((e) => ({ kind: e.type, at: e.createdAt, source: e.source,
      query: e.searchQuery, productId: e.productId, skuId: e.skuId, path: e.pagePath })),
    ...orders.flatMap((o) => [
      { kind: "order_placed", at: o.createdAt, orderId: o._id,
        orderNumber: o.orderNumber, amount: o.totalAmount, currentStatus: o.status,
        currentPaymentStatus: o.paymentStatus },
      ...(o.cancellation?.requestedAt ? [{ kind: "cancellation_requested",
        at: o.cancellation.requestedAt, orderId: o._id, orderNumber: o.orderNumber,
        currentStatus: o.cancellation.status, reason: o.cancellation.reason }] : []),
    ]),
    ...accountActions.map((a) => ({ kind: `account_${a.action}`, at: a.completedAt,
      reason: a.reason, actorId: a.actor })),
    ...payments.flatMap((p) => [
      ...(p.paidAt ? [{ kind: "payment_captured", at: p.paidAt,
        orderId: p.order, status: p.status }] : []),
      ...(p.lastRefundAt && Number(p.refundedAmount) > 0 ? [{ kind: "refund_recorded",
        at: p.lastRefundAt, orderId: p.order, refundedAmountToDate: p.refundedAmount,
        status: p.status }] : []),
    ]),
  ].filter((e) => e.at);
  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  return {
    timeline: items.slice(0, 150),
    note: "Order/status fields are current snapshots; only timestamped actions are shown as historical events.",
  };
};

// ===== Opt-in browser / registered-user API handlers =====
export const getMyActivityConsent = asyncHandler(async (req, res) => {
  const consent = await CustomerActivityConsent.findOne({ user: req.user._id }).lean();
  res.json({ success: true, consent: {
    analyticsEnabled: Boolean(consent?.analyticsEnabled),
    noticeVersion: consent?.noticeVersion || "customer-analytics-v1",
    updatedAt: consent?.updatedAt || null,
  } });
});

export const updateMyActivityConsent = asyncHandler(async (req, res) => {
  if (typeof req.body?.analyticsEnabled !== "boolean") {
    return res.status(400).json({ success: false, message: "analyticsEnabled must be a boolean" });
  }
  const consent = await setActivityConsent({ userId: req.user._id,
    enabled: req.body.analyticsEnabled });
  res.json({ success: true, consent: {
    analyticsEnabled: consent.analyticsEnabled, noticeVersion: consent.noticeVersion,
    updatedAt: consent.updatedAt,
  } });
});

export const deleteMyActivityHistory = asyncHandler(async (req, res) => {
  await setActivityConsent({ userId: req.user._id, enabled: false });
  const deleted = await CustomerActivity.deleteMany({ user: req.user._id, source: "web" });
  res.json({ success: true, deleted: deleted.deletedCount,
    message: "Optional browsing activity erased and tracking disabled" });
});

export const collectMyActivityEvents = asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body?.events) || req.body.events.length < 1 || req.body.events.length > 20) {
    return res.status(400).json({ success: false, message: "events must contain 1 to 20 items" });
  }
  const result = await storeWebEvents({ userId: req.user._id, events: req.body.events });
  if (result.consentRequired) return res.status(403).json({
    success: false, code: "CONSENT_REQUIRED", message: "Analytics consent is required",
  });
  res.status(202).json({ success: true, stored: result.stored });
});

export const adminOverview = asyncHandler(async (req, res) => {
  res.json({ success: true, overview: await getCustomerOverview() });
});
export const adminCustomers = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listCustomerProfiles(req.query)) });
});
export const adminCustomerDetail = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await getCustomerProfile(req.params.customerId)) });
});
export const adminCustomerOrders = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await getCustomerOrders(req.params.customerId, req.query)) });
});
export const adminCustomerPayments = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await getCustomerPayments(req.params.customerId, req.query)) });
});
export const adminCustomerActivity = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await getCustomerActivity(req.params.customerId, req.query)) });
});
export const adminCustomerInsights = asyncHandler(async (req, res) => {
  res.json({ success: true, insights: await getCustomerInsights(req.params.customerId) });
});
export const adminCustomerTimeline = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await getCustomerTimeline(req.params.customerId)) });
});

// ===== Auth event capture (no login controller modification) =====

const AUTH_ACTIONS = Object.freeze({
  "/register": "account_created",
  "/partner/register": "account_created",
  "/login": "signed_in",
  "/google": "signed_in",
  "/partner/login": "signed_in",
  "/partner/google/login": "signed_in",
  "/partner/google/register": "signed_in",
  "/verify-email": "email_verified",
});

// Mount BEFORE the existing /api routes to capture successful auth responses,
// without rewriting stable password/Google/partner authentication controllers.
// Only the returned user ID (or registration email for lookup) is processed.
// Request passwords, OTPs, credentials, cookies and response bodies are NEVER stored.
export const captureAuthActivity = (req, res, next) => {
  const action = req.method === "POST" ? AUTH_ACTIONS[req.path] : null;
  if (!action) return next();

  const originalJson = res.json.bind(res);
  res.json = function capturedAuthJson(body) {
    if (res.statusCode >= 200 && res.statusCode < 300 && body?.success === true) {
      const returnedId = body?.user?.id || body?.user?._id || null;
      const normalizedEmail = typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
      // Do not delay login response if telemetry is unavailable.
      queueMicrotask(async () => {
        try {
          let userId = returnedId;
          if (!userId && normalizedEmail &&
              ["account_created", "email_verified"].includes(action)) {
            const user = await User.findOne({ email: normalizedEmail }).select("_id").lean();
            userId = user?._id;
          }
          if (userId) await writeAuthActivity({ userId, type: action });
        } catch (error) {
          console.warn("Customer auth activity capture failed:", error.message);
        }
      });
    }
    return originalJson(body);
  };
  next();
};


// ===== Moderation: restricted to verified ADMIN by the router =====
// Do not hard-delete order/payment/partner ledger documents.
const assertModifiableAccount = async (req, customerId) => {
  const target = await ensureCustomer(customerId);
  if (String(req.user._id) === String(target._id)) {
    const e = new Error("You cannot moderate your own account"); e.statusCode = 403; throw e;
  }
  if ((target.roles || []).some((r) => ["admin", "operations"].includes(r))) {
    const e = new Error("Administrative accounts are protected from this endpoint");
    e.statusCode = 403; throw e;
  }
  return target;
};

const requireReason = (value) => {
  const reason = clean(value, 500);
  if (reason.length < 10) {
    const e = new Error("Provide a moderation reason of at least 10 characters");
    e.statusCode = 400; throw e;
  }
  return reason;
};

const auditAccountChange = async ({ req, target, action, reason, partnerRecordsAffected = 0, operation }) => {
  // Create an immutable actor-target-reason trail before modifying the account.
  const entry = await CustomerAccountAction.create({
    target: target._id, actor: req.user._id, action, reason,
    accountRoles: target.roles || [], partnerRecordsAffected,
    status: "started",
  });
  try {
    const result = await operation(entry);
    entry.status = "completed";
    entry.completedAt = new Date();
    await entry.save();
    return { result, actionId: entry._id };
  } catch (error) {
    try { entry.status = "failed"; await entry.save(); } catch (auditError) {
      console.error("Account moderation audit update failed:", auditError.message);
    }
    throw error;
  }
};

export const adminCustomerSuspend = asyncHandler(async (req, res) => {
  const target = await assertModifiableAccount(req, req.params.customerId);
  const reason = requireReason(req.body?.reason);
  if (target.isDeleted) return res.status(409).json({ success: false, message: "Account is already deleted" });
  if (!target.isActive) return res.status(409).json({ success: false, message: "Account is already suspended" });
  const { actionId } = await auditAccountChange({ req, target, action: "suspend", reason,
    operation: async () => {
      const update = await User.updateOne({ _id: target._id, isActive: true, isDeleted: { $ne: true } }, {
        $set: { isActive: false, suspendedAt: new Date(), suspendedBy: req.user._id },
        $inc: { tokenVersion: 1 },
      });
      if (!update.modifiedCount) {
        const e = new Error("Account changed during moderation. Refresh and retry"); e.statusCode = 409; throw e;
      }
    },
  });
  res.json({ success: true, action: "suspend", actionId, message: "Account suspended and existing sessions revoked" });
});

export const adminCustomerReactivate = asyncHandler(async (req, res) => {
  const target = await assertModifiableAccount(req, req.params.customerId);
  const reason = requireReason(req.body?.reason);
  if (target.isDeleted) return res.status(409).json({ success: false,
    message: "Deleted accounts cannot be reactivated" });
  if (target.isActive) return res.status(409).json({ success: false, message: "Account is already active" });
  const { actionId } = await auditAccountChange({ req, target, action: "reactivate", reason,
    operation: async () => {
      const update = await User.updateOne({ _id: target._id, isActive: false, isDeleted: { $ne: true } }, {
        $set: { isActive: true, suspendedAt: null, suspendedBy: null },
        $inc: { tokenVersion: 1 },
      });
      if (!update.modifiedCount) {
        const e = new Error("Account changed during moderation. Refresh and retry"); e.statusCode = 409; throw e;
      }
    },
  });
  res.json({ success: true, action: "reactivate", actionId, message: "Account access restored" });
});

export const adminCustomerDelete = asyncHandler(async (req, res) => {
  const target = await assertModifiableAccount(req, req.params.customerId);
  const reason = requireReason(req.body?.reason);
  if (target.isDeleted) return res.status(409).json({ success: false, message: "Account is already deleted" });
  // Explicit email check prevents accidental account deletion by an Admin.
  if (String(req.body?.confirmEmail || "").trim().toLowerCase() !== target.email.toLowerCase()) {
    return res.status(400).json({ success: false, message: "Enter the exact account email to confirm deletion" });
  }
  const links = await Partner.countDocuments({
    $or: [{ owner: target._id }, { "members.user": target._id }],
  });
  if (links > 0 && req.body?.confirmPartnerImpact !== true) {
    return res.status(409).json({ success: false, code: "PARTNER_IMPACT_CONFIRMATION_REQUIRED",
      partnerRecords: links,
      message: "Partner account linked. Review active partner operations, then confirmPartnerImpact=true to delete account access. Partner business records are preserved." });
  }
  const userId = String(target._id);
  const { result, actionId } = await auditAccountChange({
    req, target, action: "delete", reason, partnerRecordsAffected: links,
    operation: async () => {
      // Keep User._id and roles so historical order/payment/partner references remain valid.
      // Synthetic email prevents reuse of the original PII in the account record.
      const update = await User.updateOne({ _id: target._id, isDeleted: { $ne: true } }, {
        $set: {
          isDeleted: true, deletedAt: new Date(), deletedBy: req.user._id,
          isActive: false, name: "Deleted Account",
          email: `deleted-${userId}@accounts.hamporium.invalid`, phone: "", avatar: "",
          emailVerified: false, emailVerifiedAt: null, password: null, lastLoginAt: null,
          emailVerificationOtpHash: null, emailVerificationOtpExpiresAt: null,
          emailVerificationOtpLastSentAt: null, emailVerificationOtpAttempts: 0,
          emailVerificationOtpWindowStartedAt: null, emailVerificationOtpSendCount: 0,
          passwordResetOtpHash: null, passwordResetOtpExpiresAt: null,
          passwordResetOtpAttempts: 0, passwordResetOtpLastSentAt: null,
          suspendedAt: null, suspendedBy: null,
        },
        $unset: { googleId: "" },
        $inc: { tokenVersion: 1 },
      });
      if (!update.modifiedCount) {
        const e = new Error("Account changed during moderation. Refresh and retry"); e.statusCode = 409; throw e;
      }
      // Independent cleanup; access deletion is effective even if a cleanup later fails.
      const cleanup = await Promise.allSettled([
        Address.deleteMany({ user: target._id }),
        CustomerActivity.deleteMany({ user: target._id }),
        CustomerActivityConsent.deleteMany({ user: target._id }),
      ]);
      const incomplete = cleanup.some((task) => task.status === "rejected");
      if (incomplete) console.error(`Account ${userId} deleted, but associated PII cleanup needs retry`);
      return { cleanupIncomplete: incomplete };
    },
  });
  res.json({ success: true, action: "delete", actionId, deletedUserId: target._id,
    cleanupIncomplete: result.cleanupIncomplete, linkedPartnerRecordsPreserved: links,
    message: result.cleanupIncomplete
      ? "Account access deleted. Some auxiliary personal data cleanup requires manual retry."
      : "Account access deleted; profile anonymized. Financial and partner records retained." });
});

export const adminCustomerAccountActions = asyncHandler(async (req, res) => {
  await ensureCustomer(req.params.customerId);
  const page = safePage(req.query.page), limit = safeLimit(req.query.limit);
  const filter = { target: req.params.customerId };
  const [total, actions] = await Promise.all([
    CustomerAccountAction.countDocuments(filter),
    CustomerAccountAction.find(filter).select("action status reason actor partnerRecordsAffected createdAt completedAt")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  res.json({ success: true, actions, total, page, limit, totalPages: Math.ceil(total / limit) });
});
