import mongoose from "mongoose";

import asyncHandler from "../../utils/asyncHandler.js";
import Partner from "../partners/partner.model.js";
import Component from "../catalog/component.model.js";
import Container from "../catalog/container.model.js";

import SupplierOffer from "./supplierOffer.model.js";
import PurchaseRequest from "./purchaseRequest.model.js";
import SupplierQuote from "./supplierQuote.model.js";
import PurchaseOrder from "./purchaseOrder.model.js";
import GoodsReceipt from "./goodsReceipt.model.js";
import SupplierInvoice from "./supplierInvoice.model.js";
import SupplierPayment from "./supplierPayment.model.js";

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const sameId = (a, b) => String(a || "") === String(b || "");
const isObjectId = (value) => mongoose.isValidObjectId(value);
const getUserId = (req) => req.user?._id || req.user?.id;

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getPartnerForUser = (userId) =>
  Partner.findOne({
    $or: [
      { owner: userId },
      { members: { $elemMatch: { user: userId, isActive: true } } },
    ],
  });

const isSupplierPartner = (partner) => {
  if (!partner || partner.status !== "approved") return false;

  const model = String(partner.commercialProfile?.preferredWorkingModel || "").toLowerCase();
  const capabilities = (partner.capabilities || []).map((item) => String(item || "").toLowerCase());
  const hasSupplierCapability = capabilities.some((item) =>
    ["supplier", "supply", "vendor", "material", "materials", "procurement"].some((key) => item.includes(key))
  );

  return (
    model === "supplier" ||
    model === "hybrid" ||
    hasSupplierCapability ||
    (partner.supplyCategories || []).length > 0
  );
};

const requireSupplierPartner = async (req) => {
  const partner = req.partner || (await getPartnerForUser(getUserId(req)));

  if (!partner) throw createError(403, "Partner account required.");
  if (!isSupplierPartner(partner)) {
    throw createError(403, "This partner account is not enabled for supply business.");
  }

  return partner;
};

const getSupplierQuoteTotals = (request, rawLines = []) => {
  const requestLines = new Map(request.lines.map((line) => [String(line._id), line]));
  const lines = [];

  for (const raw of rawLines) {
    const requestLine = requestLines.get(String(raw.requestLineId || ""));
    if (!requestLine) throw createError(400, "One or more quoted lines do not belong to this purchase request.");

    const quantity = Number(raw.quantity ?? requestLine.quantity);
    const unitPrice = Number(raw.unitPrice);
    const taxPercent = Number(raw.taxPercent || 0);
    const leadTimeDays = Number(raw.leadTimeDays || 0);

    if (!Number.isFinite(quantity) || quantity <= 0) throw createError(400, "Quote quantity must be greater than zero.");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw createError(400, "Quote unit price is invalid.");
    if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) throw createError(400, "Quote tax percentage is invalid.");

    const lineSubtotal = roundMoney(quantity * unitPrice);
    const lineTax = roundMoney((lineSubtotal * taxPercent) / 100);
    const lineTotal = roundMoney(lineSubtotal + lineTax);

    lines.push({
      requestLineId: requestLine._id,
      quantity,
      unit: raw.unit || requestLine.unit || "pc",
      unitPrice,
      taxPercent,
      leadTimeDays: Math.max(0, leadTimeDays),
      lineSubtotal,
      lineTax,
      lineTotal,
      note: String(raw.note || "").trim(),
    });
  }

  if (!lines.length) throw createError(400, "Add at least one quotation line.");

  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineSubtotal, 0));
  const taxAmount = roundMoney(lines.reduce((sum, line) => sum + line.lineTax, 0));
  const total = roundMoney(subtotal + taxAmount);

  return { lines, subtotal, taxAmount, total };
};

const buildPurchaseOrderLines = (request, supplierQuote) => {
  const requestLines = new Map(request.lines.map((line) => [String(line._id), line]));

  return supplierQuote.lines.map((quoted) => {
    const source = requestLines.get(String(quoted.requestLineId));
    if (!source) throw createError(409, "Purchase request changed after supplier quotation.");

    return {
      description: source.description,
      kind: source.kind,
      component: source.component || null,
      container: source.container || null,
      quantity: quoted.quantity,
      unit: quoted.unit,
      unitPrice: quoted.unitPrice,
      taxPercent: quoted.taxPercent,
      lineSubtotal: quoted.lineSubtotal,
      lineTax: quoted.lineTax,
      lineTotal: quoted.lineTotal,
      receivedQty: 0,
      acceptedQty: 0,
      rejectedQty: 0,
    };
  });
};

// ======================================================
// PARTNER SUMMARY
// ======================================================
export const getSupplierSummary = asyncHandler(async (req, res) => {
  const partner = await requireSupplierPartner(req);

  const [offers, openRequests, orders, invoices, unpaidInvoices] = await Promise.all([
    SupplierOffer.countDocuments({ partner: partner._id }),
    PurchaseRequest.countDocuments({ invitedSuppliers: partner._id, status: { $in: ["open", "quoted"] } }),
    PurchaseOrder.countDocuments({ partner: partner._id, status: { $nin: ["cancelled", "closed"] } }),
    SupplierInvoice.countDocuments({ partner: partner._id }),
    SupplierInvoice.aggregate([
      { $match: { partner: partner._id, status: { $in: ["submitted", "verified", "approved"] } } },
      { $group: { _id: null, amount: { $sum: "$total" } } },
    ]),
  ]);

  res.json({
    success: true,
    summary: {
      offers,
      openRequests,
      activeOrders: orders,
      invoices,
      amountAwaitingPayment: Number(unpaidInvoices[0]?.amount || 0),
    },
  });
});

// ======================================================
// SUPPLIER OFFERS
// ======================================================
export const getMySupplierOffers = asyncHandler(async (req, res) => {
  const partner = await requireSupplierPartner(req);
  const offers = await SupplierOffer.find({ partner: partner._id })
    .populate("component", "name code category availability")
    .populate("container", "name code category availability")
    .sort({ updatedAt: -1 });

  res.json({ success: true, offers });
});

export const createSupplierOffer = asyncHandler(async (req, res) => {
  const partner = await requireSupplierPartner(req);
  const body = req.body || {};
  const kind = String(body.kind || "").trim();

  if (!["component", "container", "material", "service"].includes(kind)) {
    throw createError(400, "Invalid supplier offer type.");
  }

  let component = null;
  let container = null;

  if (kind === "component" && body.component) {
    if (!isObjectId(body.component)) throw createError(400, "Invalid component id.");
    component = await Component.findById(body.component).select("name category");
    if (!component) throw createError(404, "Component not found.");
  }

  if (kind === "container" && body.container) {
    if (!isObjectId(body.container)) throw createError(400, "Invalid container id.");
    container = await Container.findById(body.container).select("name category");
    if (!container) throw createError(404, "Container not found.");
  }

  const name = String(body.name || component?.name || container?.name || "").trim();
  if (!name) throw createError(400, "Offer name is required.");

  const unitPrice = Number(body.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw createError(400, "Valid unit price is required.");

  const offer = await SupplierOffer.create({
    partner: partner._id,
    kind,
    component: component?._id || null,
    container: container?._id || null,
    name,
    category: String(body.category || component?.category || container?.category || "").trim(),
    supplierSku: String(body.supplierSku || "").trim(),
    unit: String(body.unit || "pc").trim(),
    unitPrice,
    taxPercent: Math.max(0, Math.min(100, Number(body.taxPercent || 0))),
    moq: Math.max(1, Number(body.moq || 1)),
    leadTimeDays: Math.max(0, Number(body.leadTimeDays || 0)),
    monthlyCapacity: Math.max(0, Number(body.monthlyCapacity || 0)),
    serviceArea: Array.isArray(body.serviceArea) ? body.serviceArea.map(String).map((v) => v.trim()).filter(Boolean).slice(0, 50) : [],
    notes: String(body.notes || "").trim(),
    status: body.submit === false ? "draft" : "pending",
  });

  res.status(201).json({ success: true, message: "Supplier offer created.", offer });
});

export const updateSupplierOffer = asyncHandler(async (req, res) => {
  const partner = await requireSupplierPartner(req);
  const offer = await SupplierOffer.findOne({ _id: req.params.id, partner: partner._id });
  if (!offer) throw createError(404, "Supplier offer not found.");
  if (!["draft", "pending", "rejected"].includes(offer.status)) {
    throw createError(409, "Approved or suspended offers cannot be edited directly.");
  }

  const editable = ["name", "category", "supplierSku", "unit", "unitPrice", "taxPercent", "moq", "leadTimeDays", "monthlyCapacity", "serviceArea", "notes"];
  for (const field of editable) {
    if (req.body?.[field] !== undefined) offer[field] = req.body[field];
  }
  offer.status = req.body?.submit === false ? "draft" : "pending";
  offer.reviewNote = "";
  offer.reviewedBy = null;
  offer.reviewedAt = null;
  await offer.save();

  res.json({ success: true, message: "Supplier offer updated.", offer });
});

export const reviewSupplierOfferAdmin = asyncHandler(async (req, res) => {
  const offer = await SupplierOffer.findById(req.params.id);
  if (!offer) throw createError(404, "Supplier offer not found.");

  const status = String(req.body.status || "");
  if (!["approved", "rejected", "suspended"].includes(status)) throw createError(400, "Invalid review status.");

  offer.status = status;
  offer.reviewNote = String(req.body.note || "").trim();
  offer.reviewedBy = getUserId(req);
  offer.reviewedAt = new Date();
  await offer.save();

  res.json({ success: true, message: "Supplier offer review updated.", offer });
});

export const getSupplierOffersAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.partner && isObjectId(req.query.partner)) filter.partner = req.query.partner;

  const offers = await SupplierOffer.find(filter)
    .populate("partner", "partnerId businessName supplyCategories status")
    .populate("component", "name code category")
    .populate("container", "name code category")
    .sort({ updatedAt: -1 });

  res.json({ success: true, offers });
});

// ======================================================
// PURCHASE REQUESTS + SUPPLIER QUOTES
// ======================================================
export const createPurchaseRequestAdmin = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!String(body.title || "").trim()) throw createError(400, "Purchase request title is required.");
  if (!Array.isArray(body.lines) || !body.lines.length) throw createError(400, "Add at least one purchase request line.");

  const lines = body.lines.map((line) => {
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw createError(400, "Every purchase request line needs a positive quantity.");
    return {
      kind: line.kind,
      component: line.component || null,
      container: line.container || null,
      description: String(line.description || "").trim(),
      quantity,
      unit: String(line.unit || "pc").trim(),
      targetUnitPrice: line.targetUnitPrice === "" || line.targetUnitPrice == null ? null : Number(line.targetUnitPrice),
      requiredBy: line.requiredBy || null,
      specification: String(line.specification || "").trim(),
    };
  });

  if (lines.some((line) => !line.description || !["component", "container", "material", "service"].includes(line.kind))) {
    throw createError(400, "Each purchase request line requires a valid type and description.");
  }

  const invitedSuppliers = Array.isArray(body.invitedSuppliers)
    ? [...new Set(body.invitedSuppliers.map(String))].filter(isObjectId)
    : [];

  if (invitedSuppliers.length) {
    const eligibleCount = await Partner.countDocuments({
      _id: { $in: invitedSuppliers },
      status: "approved",
    });
    if (eligibleCount !== invitedSuppliers.length) throw createError(400, "One or more invited suppliers are not approved partners.");
  }

  const request = await PurchaseRequest.create({
    title: String(body.title).trim(),
    lines,
    invitedSuppliers,
    priority: body.priority || "normal",
    notes: String(body.notes || "").trim(),
    status: body.open === false ? "draft" : "open",
    openedAt: body.open === false ? null : new Date(),
    createdBy: getUserId(req),
  });

  res.status(201).json({ success: true, message: "Purchase request created.", request });
});

export const getPurchaseRequestsAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const requests = await PurchaseRequest.find(filter)
    .populate("invitedSuppliers", "partnerId businessName")
    .populate("awardedSupplier", "partnerId businessName")
    .sort({ createdAt: -1 });

  res.json({ success: true, requests });
});

export const getMyPurchaseRequests = asyncHandler(async (req, res) => {
  const partner = await requireSupplierPartner(req);
  const requests = await PurchaseRequest.find({
    invitedSuppliers: partner._id,
    status: { $in: ["open", "quoted", "awarded"] },
  })
    .populate("awardedSupplier", "partnerId businessName")
    .sort({ createdAt: -1 });

  const requestIds = requests.map((item) => item._id);
  const quotes = await SupplierQuote.find({ purchaseRequest: { $in: requestIds }, partner: partner._id }).lean();
  const quoteMap = new Map(quotes.map((item) => [String(item.purchaseRequest), item]));

  res.json({
    success: true,
    requests: requests.map((item) => ({ ...item.toObject(), myQuote: quoteMap.get(String(item._id)) || null })),
  });
});

export const submitSupplierQuote = asyncHandler(async (req, res) => {
  const partner = await requireSupplierPartner(req);
  if (!isObjectId(req.params.requestId)) throw createError(400, "Invalid purchase request id.");

  const request = await PurchaseRequest.findOne({
    _id: req.params.requestId,
    invitedSuppliers: partner._id,
    status: { $in: ["open", "quoted"] },
  });
  if (!request) throw createError(404, "Open purchase request not found for this supplier.");

  const totals = getSupplierQuoteTotals(request, req.body.lines || []);
  let quote = await SupplierQuote.findOne({ purchaseRequest: request._id, partner: partner._id });

  if (quote && quote.status === "accepted") throw createError(409, "Accepted supplier quotation is locked.");

  if (!quote) {
    quote = await SupplierQuote.create({
      purchaseRequest: request._id,
      partner: partner._id,
      ...totals,
      currency: req.body.currency || "INR",
      validUntil: req.body.validUntil || null,
      paymentTerms: String(req.body.paymentTerms || "").trim(),
      notes: String(req.body.notes || "").trim(),
      status: "submitted",
      submittedAt: new Date(),
    });
  } else {
    quote.lines = totals.lines;
    quote.subtotal = totals.subtotal;
    quote.taxAmount = totals.taxAmount;
    quote.total = totals.total;
    quote.currency = req.body.currency || quote.currency || "INR";
    quote.validUntil = req.body.validUntil || null;
    quote.paymentTerms = String(req.body.paymentTerms || "").trim();
    quote.notes = String(req.body.notes || "").trim();
    quote.status = "submitted";
    quote.submittedAt = new Date();
    await quote.save();
  }

  if (request.status === "open") {
    request.status = "quoted";
    await request.save();
  }

  res.status(201).json({ success: true, message: "Supplier quotation submitted.", quote });
});

export const getSupplierQuotesAdmin = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.requestId)) throw createError(400, "Invalid purchase request id.");
  const quotes = await SupplierQuote.find({ purchaseRequest: req.params.requestId })
    .populate("partner", "partnerId businessName gstNumber contact")
    .sort({ total: 1, createdAt: 1 });

  res.json({ success: true, quotes });
});

export const awardSupplierQuoteAdmin = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.quoteId)) throw createError(400, "Invalid supplier quote id.");

  const quote = await SupplierQuote.findById(req.params.quoteId);
  if (!quote || quote.status !== "submitted") throw createError(404, "Submitted supplier quotation not found.");

  const request = await PurchaseRequest.findById(quote.purchaseRequest);
  if (!request || !["open", "quoted"].includes(request.status)) throw createError(409, "Purchase request is no longer awardable.");

  const existingPo = await PurchaseOrder.findOne({ purchaseRequest: request._id });
  if (existingPo) throw createError(409, "A purchase order already exists for this request.");

  const poLines = buildPurchaseOrderLines(request, quote);

  const purchaseOrder = await PurchaseOrder.create({
    purchaseRequest: request._id,
    supplierQuote: quote._id,
    partner: quote.partner,
    lines: poLines,
    subtotal: quote.subtotal,
    taxAmount: quote.taxAmount,
    total: quote.total,
    currency: quote.currency,
    expectedDeliveryDate: req.body.expectedDeliveryDate || null,
    deliveryAddress: req.body.deliveryAddress || {},
    status: "issued",
    createdBy: getUserId(req),
  });

  quote.status = "accepted";
  await quote.save();

  await SupplierQuote.updateMany(
    { purchaseRequest: request._id, _id: { $ne: quote._id }, status: "submitted" },
    { $set: { status: "rejected" } }
  );

  request.status = "awarded";
  request.awardedAt = new Date();
  request.awardedSupplier = quote.partner;
  request.awardedQuote = quote._id;
  await request.save();

  res.status(201).json({ success: true, message: "Supplier selected and purchase order issued.", purchaseOrder });
});

// ======================================================
// PURCHASE ORDERS + RECEIVING
// ======================================================
export const getMyPurchaseOrders = asyncHandler(async (req, res) => {
  const partner = await requireSupplierPartner(req);
  const orders = await PurchaseOrder.find({ partner: partner._id })
    .populate("purchaseRequest", "requestId title priority")
    .sort({ createdAt: -1 });
  res.json({ success: true, orders });
});

export const getPurchaseOrdersAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.partner && isObjectId(req.query.partner)) filter.partner = req.query.partner;

  const orders = await PurchaseOrder.find(filter)
    .populate("partner", "partnerId businessName contact")
    .populate("purchaseRequest", "requestId title")
    .sort({ createdAt: -1 });
  res.json({ success: true, orders });
});

export const updateMyPurchaseOrder = asyncHandler(async (req, res) => {
  const partner = await requireSupplierPartner(req);
  const order = await PurchaseOrder.findOne({ _id: req.params.id, partner: partner._id });
  if (!order) throw createError(404, "Purchase order not found.");

  const action = String(req.body.action || "");
  if (action === "accept") {
    if (order.status !== "issued") throw createError(409, "Only an issued purchase order can be accepted.");
    order.status = "accepted";
    order.acceptedAt = new Date();
  } else if (action === "production") {
    if (!['accepted', 'in_production'].includes(order.status)) throw createError(409, "Purchase order must be accepted first.");
    order.status = "in_production";
  } else if (action === "dispatch") {
    if (!['accepted', 'in_production'].includes(order.status)) throw createError(409, "Purchase order is not ready for dispatch.");
    order.status = "dispatched";
    order.supplierDispatch = {
      dispatchedAt: new Date(),
      carrier: String(req.body.carrier || "").trim(),
      trackingNumber: String(req.body.trackingNumber || "").trim(),
      note: String(req.body.note || "").trim(),
    };
  } else {
    throw createError(400, "Invalid purchase order action.");
  }

  await order.save();
  res.json({ success: true, message: "Purchase order updated.", order });
});

export const postGoodsReceiptAdmin = asyncHandler(async (req, res) => {
  const order = await PurchaseOrder.findById(req.params.id);
  if (!order) throw createError(404, "Purchase order not found.");
  if (["cancelled", "closed"].includes(order.status)) throw createError(409, "This purchase order cannot receive goods.");

  const linesById = new Map(order.lines.map((line) => [String(line._id), line]));
  const receiptLines = [];

  for (const raw of req.body.lines || []) {
    const line = linesById.get(String(raw.purchaseOrderLineId || ""));
    if (!line) throw createError(400, "One or more receipt lines do not belong to this purchase order.");

    const receivedQty = Number(raw.receivedQty || 0);
    const acceptedQty = Number(raw.acceptedQty || 0);
    const rejectedQty = Number(raw.rejectedQty || 0);
    if (receivedQty <= 0 || acceptedQty < 0 || rejectedQty < 0 || roundMoney(acceptedQty + rejectedQty) !== roundMoney(receivedQty)) {
      throw createError(400, "Accepted and rejected quantities must equal received quantity.");
    }
    if (roundMoney(Number(line.receivedQty || 0) + receivedQty) > roundMoney(line.quantity)) {
      throw createError(409, "Received quantity exceeds purchase order quantity.");
    }

    const qcStatus = rejectedQty === 0 ? "accepted" : acceptedQty === 0 ? "rejected" : "partially_accepted";
    receiptLines.push({
      purchaseOrderLineId: line._id,
      receivedQty,
      acceptedQty,
      rejectedQty,
      qcStatus,
      qcNote: String(raw.qcNote || "").trim(),
    });

    line.receivedQty = roundMoney(Number(line.receivedQty || 0) + receivedQty);
    line.acceptedQty = roundMoney(Number(line.acceptedQty || 0) + acceptedQty);
    line.rejectedQty = roundMoney(Number(line.rejectedQty || 0) + rejectedQty);
  }

  if (!receiptLines.length) throw createError(400, "Add at least one receipt line.");

  const receipt = await GoodsReceipt.create({
    purchaseOrder: order._id,
    partner: order.partner,
    lines: receiptLines,
    receivedAt: req.body.receivedAt || new Date(),
    receivedBy: getUserId(req),
    note: String(req.body.note || "").trim(),
    status: "posted",
  });

  const fullyReceived = order.lines.every((line) => Number(line.receivedQty || 0) >= Number(line.quantity || 0));
  const anyReceived = order.lines.some((line) => Number(line.receivedQty || 0) > 0);
  order.status = fullyReceived ? "received" : anyReceived ? "partially_received" : order.status;
  await order.save();

  res.status(201).json({ success: true, message: "Goods receipt posted.", receipt, order });
});

// ======================================================
// SUPPLIER INVOICES + PAYMENTS
// ======================================================
export const getMySupplierInvoices = asyncHandler(async (req, res) => {
  const partner = await requireSupplierPartner(req);
  const invoices = await SupplierInvoice.find({ partner: partner._id })
    .populate("purchaseOrder", "purchaseOrderId total status")
    .sort({ createdAt: -1 });
  res.json({ success: true, invoices });
});

export const submitSupplierInvoice = asyncHandler(async (req, res) => {
  const partner = await requireSupplierPartner(req);
  if (!isObjectId(req.body.purchaseOrderId)) throw createError(400, "Valid purchase order id is required.");

  const order = await PurchaseOrder.findOne({ _id: req.body.purchaseOrderId, partner: partner._id });
  if (!order) throw createError(404, "Purchase order not found.");
  if (!["accepted", "in_production", "dispatched", "partially_received", "received"].includes(order.status)) {
    throw createError(409, "Purchase order is not ready for invoicing.");
  }

  const subtotal = Number(req.body.subtotal);
  const taxAmount = Number(req.body.taxAmount || 0);
  const total = Number(req.body.total);
  if (![subtotal, taxAmount, total].every(Number.isFinite) || subtotal < 0 || taxAmount < 0 || total < 0) {
    throw createError(400, "Invoice amounts are invalid.");
  }
  if (Math.abs(roundMoney(subtotal + taxAmount) - roundMoney(total)) > 0.01) {
    throw createError(400, "Invoice total must equal subtotal plus tax.");
  }

  const invoice = await SupplierInvoice.create({
    partner: partner._id,
    purchaseOrder: order._id,
    invoiceNumber: String(req.body.invoiceNumber || "").trim(),
    invoiceDate: req.body.invoiceDate || new Date(),
    subtotal: roundMoney(subtotal),
    taxAmount: roundMoney(taxAmount),
    total: roundMoney(total),
    currency: req.body.currency || order.currency || "INR",
    documentUrl: String(req.body.documentUrl || "").trim(),
    note: String(req.body.note || "").trim(),
    status: "submitted",
  });

  res.status(201).json({ success: true, message: "Supplier invoice submitted.", invoice });
});

export const getSupplierInvoicesAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.partner && isObjectId(req.query.partner)) filter.partner = req.query.partner;

  const invoices = await SupplierInvoice.find(filter)
    .populate("partner", "partnerId businessName gstNumber contact")
    .populate("purchaseOrder", "purchaseOrderId total currency status")
    .sort({ createdAt: -1 });
  res.json({ success: true, invoices });
});

export const reviewSupplierInvoiceAdmin = asyncHandler(async (req, res) => {
  const invoice = await SupplierInvoice.findById(req.params.id);
  if (!invoice) throw createError(404, "Supplier invoice not found.");

  const status = String(req.body.status || "");
  if (!["verified", "disputed", "approved", "rejected"].includes(status)) {
    throw createError(400, "Invalid supplier invoice review status.");
  }
  if (invoice.status === "paid") throw createError(409, "Paid supplier invoice cannot be changed.");

  invoice.status = status;
  invoice.reviewNote = String(req.body.note || "").trim();
  invoice.reviewedBy = getUserId(req);
  invoice.reviewedAt = new Date();
  await invoice.save();

  res.json({ success: true, message: "Supplier invoice review updated.", invoice });
});

export const createSupplierPaymentAdmin = asyncHandler(async (req, res) => {
  const invoice = await SupplierInvoice.findById(req.body.invoiceId);
  if (!invoice) throw createError(404, "Supplier invoice not found.");
  if (invoice.status !== "approved") throw createError(409, "Only approved supplier invoices can be paid.");

  const existing = await SupplierPayment.findOne({ invoice: invoice._id });
  if (existing) throw createError(409, "Supplier payment already exists for this invoice.");

  const payment = await SupplierPayment.create({
    partner: invoice.partner,
    invoice: invoice._id,
    amount: invoice.total,
    currency: invoice.currency,
    method: String(req.body.method || "bank_transfer").trim(),
    reference: String(req.body.reference || "").trim(),
    status: "pending",
    note: String(req.body.note || "").trim(),
    createdBy: getUserId(req),
  });

  res.status(201).json({ success: true, message: "Supplier payment created.", payment });
});

export const updateSupplierPaymentAdmin = asyncHandler(async (req, res) => {
  const payment = await SupplierPayment.findById(req.params.id);
  if (!payment) throw createError(404, "Supplier payment not found.");

  const status = String(req.body.status || "");
  if (!["processing", "paid", "failed", "cancelled"].includes(status)) throw createError(400, "Invalid supplier payment status.");
  if (payment.status === "paid" && status !== "paid") throw createError(409, "Paid supplier payment cannot move backwards.");

  const reference = String(req.body.reference || payment.reference || "").trim();
  if (status === "paid" && !reference) throw createError(400, "Payment reference is required before marking paid.");

  payment.status = status;
  payment.reference = reference;
  payment.method = String(req.body.method || payment.method || "bank_transfer").trim();
  payment.note = String(req.body.note ?? payment.note ?? "").trim();
  payment.processedBy = getUserId(req);
  payment.processedAt = new Date();
  if (status === "paid") payment.paidAt = new Date();
  await payment.save();

  const invoice = await SupplierInvoice.findById(payment.invoice);
  if (invoice && status === "paid") {
    invoice.status = "paid";
    invoice.paidAt = payment.paidAt;
    await invoice.save();
  }

  res.json({ success: true, message: "Supplier payment updated.", payment });
});

export const getSupplierPaymentsAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const payments = await SupplierPayment.find(filter)
    .populate("partner", "partnerId businessName")
    .populate("invoice", "supplierInvoiceId invoiceNumber total status")
    .sort({ createdAt: -1 });
  res.json({ success: true, payments });
});
