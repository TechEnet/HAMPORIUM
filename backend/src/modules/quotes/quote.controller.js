import RFQ from "../rfq/rfq.model.js";
import Quote from "./quote.model.js";

import {
  RFQ_STATUS,
  QUOTE_STATUS,
  QUOTE_VERSION_STATUS,
} from "../../constants/statuses.js";

const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getUserId = (req) =>
  req.user?._id || req.user?.id;

const sameId = (a, b) =>
  String(a || "") === String(b || "");

const INTERNAL_ROLES = new Set([
  "admin",
  "operations",
]);

const isInternalUser = (req) => {
  const roles = Array.isArray(req.user?.roles)
    ? req.user.roles
    : [];

  return roles.some((role) =>
    INTERNAL_ROLES.has(
      String(role).toLowerCase()
    )
  );
};

const requireInternal = (req) => {
  if (!isInternalUser(req)) {
    throw createError(
      403,
      "Internal staff access required."
    );
  }
};

// ======================================================
// BUILD VERSION
// ======================================================

const buildVersion = ({
  body,
  versionNumber,
  userId,
}) => {
  const rawItems =
    Array.isArray(body.lineItems)
      ? body.lineItems
      : [];

  if (!rawItems.length) {
    throw createError(
      400,
      "At least one quote line item is required."
    );
  }

  const lineItems = rawItems.map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);

    if (quantity < 1) {
      throw createError(
        400,
        "Each line item quantity must be at least 1."
      );
    }

    if (unitPrice < 0) {
      throw createError(
        400,
        "Unit price cannot be negative."
      );
    }

    if (!item.name?.trim()) {
      throw createError(
        400,
        "Each quote item requires a name."
      );
    }

    return {
      productReference: item.productReference || "",
      name: item.name,
      description: item.description || "",
      image: item.image || "",
      quantity,
      unitPrice,
      personalization: item.personalization || "",
      packaging: item.packaging || "",
      moq: Number(item.moq || 0),
      stockStatus: item.stockStatus || "",
      lineTotal: Number((quantity * unitPrice).toFixed(2)),
    };
  });

  const subtotal = Number(
    lineItems
      .reduce((sum, item) => sum + item.lineTotal, 0)
      .toFixed(2)
  );

  const discount = Math.max(Number(body.discount || 0), 0);
  const freight = Math.max(Number(body.freight || 0), 0);
  const taxRate = Math.max(Number(body.taxRate || 0), 0);
  const beforeTax = Math.max(subtotal - discount + freight, 0);
  const taxAmount = Number(((beforeTax * taxRate) / 100).toFixed(2));
  const total = Number((beforeTax + taxAmount).toFixed(2));

  return {
    versionNumber,
    lineItems,
    subtotal,
    discount,
    freight,
    taxRate,
    taxAmount,
    total,
    currency: body.currency || "INR",
    leadTimeDays: Number(body.leadTimeDays || 0),
    paymentTerms: body.paymentTerms || "",
    validUntil: body.validUntil || null,
    assumptions: Array.isArray(body.assumptions)
      ? body.assumptions
      : [],
    notes: body.notes || "",
    status: QUOTE_VERSION_STATUS.DRAFT,
    createdBy: userId,
  };
};

// ======================================================
// CREATE QUOTE V1
// POST /api/quotes
// ======================================================

export const createQuote = catchAsync(async (req, res) => {
  requireInternal(req);

  const { rfqId } = req.body;

  if (!rfqId) {
    throw createError(400, "rfqId is required.");
  }

  const rfq = await RFQ.findById(rfqId);

  if (!rfq) {
    throw createError(404, "RFQ not found.");
  }

  if (
    [
      RFQ_STATUS.DRAFT,
      RFQ_STATUS.CANCELLED,
      RFQ_STATUS.APPROVED,
    ].includes(rfq.status)
  ) {
    throw createError(
      400,
      `Cannot create quote for RFQ status: ${rfq.status}.`
    );
  }

  const existing = await Quote.findOne({ rfq: rfq._id });

  if (existing) {
    throw createError(
      409,
      "A quote already exists for this RFQ. Create a new version instead."
    );
  }

  const userId = getUserId(req);
  const version = buildVersion({
    body: req.body,
    versionNumber: 1,
    userId,
  });

  const quote = await Quote.create({
    rfq: rfq._id,
    customer: rfq.requester,
    versions: [version],
    currentVersionNumber: 1,
    status: QUOTE_STATUS.DRAFT,
    statusHistory: [
      {
        status: QUOTE_STATUS.DRAFT,
        versionNumber: 1,
        changedBy: userId,
        note: "Quote version 1 created.",
      },
    ],
  });

  rfq.status = RFQ_STATUS.UNDER_REVIEW;
  rfq.nextAction = "Prepare and send quotation";
  rfq.statusHistory.push({
    status: RFQ_STATUS.UNDER_REVIEW,
    changedBy: userId,
    note: "Quotation draft created.",
  });

  await rfq.save();

  res.status(201).json({
    success: true,
    message: "Quote version 1 created.",
    quote,
  });
});

// ======================================================
// CREATE NEW QUOTE VERSION
// POST /api/quotes/:id/versions
// ======================================================

export const createQuoteVersion = catchAsync(async (req, res) => {
  requireInternal(req);

  const quote = await Quote.findById(req.params.id);

  if (!quote) {
    throw createError(404, "Quote not found.");
  }

  if (
    quote.status === QUOTE_STATUS.ACCEPTED ||
    quote.acceptedVersionNumber
  ) {
    throw createError(
      400,
      "Accepted quote is locked and cannot be changed."
    );
  }

  const currentVersion = quote.versions.find(
    (version) =>
      version.versionNumber === quote.currentVersionNumber
  );

  if (currentVersion) {
    currentVersion.status = QUOTE_VERSION_STATUS.SUPERSEDED;
  }

  const nextVersionNumber = quote.currentVersionNumber + 1;
  const newVersion = buildVersion({
    body: req.body,
    versionNumber: nextVersionNumber,
    userId: getUserId(req),
  });

  quote.versions.push(newVersion);
  quote.currentVersionNumber = nextVersionNumber;
  quote.status = QUOTE_STATUS.DRAFT;

  quote.statusHistory.push({
    status: QUOTE_STATUS.DRAFT,
    versionNumber: nextVersionNumber,
    changedBy: getUserId(req),
    note: `Quote version ${nextVersionNumber} created.`,
  });

  await quote.save();

  const rfq = await RFQ.findById(quote.rfq);

  if (rfq) {
    rfq.status = RFQ_STATUS.UNDER_REVIEW;
    rfq.nextAction =
      `Review and send quotation version ${nextVersionNumber}`;
    rfq.statusHistory.push({
      status: RFQ_STATUS.UNDER_REVIEW,
      changedBy: getUserId(req),
      note: `Quotation version ${nextVersionNumber} created.`,
    });
    await rfq.save();
  }

  res.status(201).json({
    success: true,
    message: `Quote version ${nextVersionNumber} created.`,
    quote,
  });
});

// ======================================================
// SEND CURRENT QUOTE VERSION
// POST /api/quotes/:id/send
// ======================================================

export const sendQuote = catchAsync(async (req, res) => {
  requireInternal(req);

  const quote = await Quote.findById(req.params.id);

  if (!quote) {
    throw createError(404, "Quote not found.");
  }

  if (quote.status === QUOTE_STATUS.ACCEPTED) {
    throw createError(400, "Accepted quote cannot be sent again.");
  }

  const version = quote.versions.find(
    (item) => item.versionNumber === quote.currentVersionNumber
  );

  if (!version) {
    throw createError(400, "Current quote version not found.");
  }

  if (
    version.validUntil &&
    new Date(version.validUntil) < new Date()
  ) {
    quote.status = QUOTE_STATUS.EXPIRED;
    quote.statusHistory.push({
      status: QUOTE_STATUS.EXPIRED,
      versionNumber: version.versionNumber,
      changedBy: getUserId(req),
      note: `Quote version ${version.versionNumber} expired before it could be sent.`,
    });
    await quote.save();

    throw createError(
      400,
      "Quote validity date has already expired."
    );
  }

  version.status = QUOTE_VERSION_STATUS.SENT;
  version.publishedAt = new Date();
  quote.status = QUOTE_STATUS.SENT;

  quote.statusHistory.push({
    status: QUOTE_STATUS.SENT,
    versionNumber: version.versionNumber,
    changedBy: getUserId(req),
    note:
      req.body?.note ||
      `Quote version ${version.versionNumber} sent to customer.`,
  });

  await quote.save();

  const rfq = await RFQ.findById(quote.rfq);

  if (rfq) {
    rfq.status = RFQ_STATUS.QUOTED;
    rfq.nextAction = "Customer quotation review";
    rfq.statusHistory.push({
      status: RFQ_STATUS.QUOTED,
      changedBy: getUserId(req),
      note: `Quote version ${version.versionNumber} shared with customer.`,
    });
    await rfq.save();
  }

  res.status(200).json({
    success: true,
    message: `Quote version ${version.versionNumber} sent successfully.`,
    quote,
  });
});

// ======================================================
// CUSTOMER REQUEST CHANGES
// POST /api/quotes/:id/request-changes
// ======================================================

export const requestQuoteChanges = catchAsync(async (req, res) => {
  const quote = await Quote.findById(req.params.id);

  if (!quote) {
    throw createError(404, "Quote not found.");
  }

  if (!sameId(quote.customer, getUserId(req))) {
    throw createError(403, "You cannot change this quotation.");
  }

  if (quote.status !== QUOTE_STATUS.SENT) {
    throw createError(
      400,
      "Only a sent quotation can receive a change request."
    );
  }

  const comment = String(req.body.comment || "").trim();

  if (!comment) {
    throw createError(400, "Change request comment is required.");
  }

  const version = quote.versions.find(
    (item) => item.versionNumber === quote.currentVersionNumber
  );

  if (!version) {
    throw createError(400, "Current quote version not found.");
  }

  version.status = QUOTE_VERSION_STATUS.CHANGE_REQUESTED;
  version.changeRequest = {
    requestedBy: getUserId(req),
    comment,
    requestedAt: new Date(),
  };
  quote.status = QUOTE_STATUS.CHANGE_REQUESTED;

  quote.statusHistory.push({
    status: QUOTE_STATUS.CHANGE_REQUESTED,
    versionNumber: version.versionNumber,
    changedBy: getUserId(req),
    note: comment,
  });

  await quote.save();

  const rfq = await RFQ.findById(quote.rfq);

  if (rfq) {
    rfq.status = RFQ_STATUS.QUOTE_CHANGE_REQUESTED;
    rfq.nextAction = "Prepare revised quotation";
    rfq.statusHistory.push({
      status: RFQ_STATUS.QUOTE_CHANGE_REQUESTED,
      changedBy: getUserId(req),
      note: `Customer requested changes to quote version ${version.versionNumber}.`,
    });
    await rfq.save();
  }

  res.json({
    success: true,
    message: "Quote changes requested.",
    quote,
  });
});

// ======================================================
// ACCEPT QUOTE
// POST /api/quotes/:id/accept
// ======================================================

export const acceptQuote = catchAsync(async (req, res) => {
  const quote = await Quote.findById(req.params.id);

  if (!quote) {
    throw createError(404, "Quote not found.");
  }

  if (!sameId(quote.customer, getUserId(req))) {
    throw createError(403, "You cannot accept this quotation.");
  }

  if (quote.status !== QUOTE_STATUS.SENT) {
    throw createError(
      400,
      "Only the currently sent quote can be accepted."
    );
  }

  const version = quote.versions.find(
    (item) => item.versionNumber === quote.currentVersionNumber
  );

  if (!version) {
    throw createError(400, "Current quote version not found.");
  }

  if (
    version.validUntil &&
    new Date(version.validUntil) < new Date()
  ) {
    quote.status = QUOTE_STATUS.EXPIRED;
    await quote.save();
    throw createError(400, "This quotation has expired.");
  }

  version.status = QUOTE_VERSION_STATUS.ACCEPTED;
  version.acceptedAt = new Date();
  quote.acceptedVersionNumber = version.versionNumber;
  quote.status = QUOTE_STATUS.ACCEPTED;

  quote.statusHistory.push({
    status: QUOTE_STATUS.ACCEPTED,
    versionNumber: version.versionNumber,
    changedBy: getUserId(req),
    note:
      req.body.comment ||
      `Quote version ${version.versionNumber} accepted.`,
  });

  await quote.save();

  const rfq = await RFQ.findById(quote.rfq);

  if (rfq) {
    rfq.status = RFQ_STATUS.QUOTE_ACCEPTED;

    if (rfq.sourceType === "custom_hamper") {
      rfq.commercialPaymentStatus = "not_started";
      rfq.nextAction = "Customer payment pending";
    } else {
      rfq.nextAction = "Prepare sample/proof";
    }

    rfq.statusHistory.push({
      status: RFQ_STATUS.QUOTE_ACCEPTED,
      changedBy: getUserId(req),
      note: `Quote version ${version.versionNumber} accepted.`,
    });

    await rfq.save();
  }

  res.json({
    success: true,
    message: `Quote version ${version.versionNumber} accepted successfully.`,
    quote,
  });
});

// ======================================================
// COMMENT ON QUOTE
// POST /api/quotes/:id/comment
// ======================================================

export const commentOnQuote = catchAsync(async (req, res) => {
  const quote = await Quote.findById(req.params.id);

  if (!quote) {
    throw createError(404, "Quote not found.");
  }

  if (
    !isInternalUser(req) &&
    !sameId(quote.customer, getUserId(req))
  ) {
    throw createError(403, "You cannot comment on this quote.");
  }

  const message = String(req.body.message || "").trim();

  if (!message) {
    throw createError(400, "Comment is required.");
  }

  quote.communications.push({
    user: getUserId(req),
    action: "comment",
    message,
  });

  await quote.save();

  res.json({
    success: true,
    message: "Comment added.",
    quote,
  });
});

// ======================================================
// ASK FOR CALL
// POST /api/quotes/:id/ask-for-call
// ======================================================

export const askForCall = catchAsync(async (req, res) => {
  const quote = await Quote.findById(req.params.id);

  if (!quote) {
    throw createError(404, "Quote not found.");
  }

  if (!sameId(quote.customer, getUserId(req))) {
    throw createError(
      403,
      "You cannot request a call for this quote."
    );
  }

  quote.communications.push({
    user: getUserId(req),
    action: "ask_for_call",
    message:
      req.body.message ||
      "Customer requested a call.",
  });

  await quote.save();

  res.json({
    success: true,
    message: "Call request submitted successfully.",
    quote,
  });
});

const populateQuoteCommercialLinks = (query) =>
  query
    .populate(
      "rfq",
      "rfqId title companyName requester status sourceType quantity requiredDeliveryDate addressModel deliveryLocations commercialPaymentStatus customHamperRequest order payment paidAt"
    )
    .populate(
      "customer",
      "name email phone"
    )
    .populate(
      "payment",
      "sourceType status amount currency razorpayOrderId razorpayPaymentId paidAt createdAt"
    )
    .populate(
      "order",
      "orderNumber checkoutMode status paymentStatus totalAmount currency paidAt createdAt"
    );

// ======================================================
// MY QUOTES
// GET /api/quotes/mine
// ======================================================

export const getMyQuotes = catchAsync(async (req, res) => {
  const quotes = await Quote.find({
    customer: getUserId(req),
  })
    .populate(
      "rfq",
      "rfqId title companyName status sourceType requiredDeliveryDate quantity commercialPaymentStatus"
    )
    .populate(
      "payment",
      "status amount currency paidAt"
    )
    .populate(
      "order",
      "orderNumber status paymentStatus totalAmount currency paidAt"
    )
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: quotes.length,
    quotes,
  });
});

// ======================================================
// GET QUOTE BY RFQ
// GET /api/quotes/rfq/:rfqId
// ======================================================

export const getQuoteByRFQ = catchAsync(async (req, res) => {
  const quote = await populateQuoteCommercialLinks(
    Quote.findOne({ rfq: req.params.rfqId })
  );

  if (!quote) {
    throw createError(404, "Quote not found.");
  }

  if (
    !isInternalUser(req) &&
    !sameId(
      quote.customer?._id || quote.customer,
      getUserId(req)
    )
  ) {
    throw createError(403, "You cannot access this quote.");
  }

  res.json({
    success: true,
    quote,
  });
});

// ======================================================
// GET SINGLE QUOTE
// ======================================================

export const getQuoteById = catchAsync(async (req, res) => {
  const quote = await populateQuoteCommercialLinks(
    Quote.findById(req.params.id)
  )
    .populate(
      "versions.createdBy",
      "name email role roles"
    )
    .populate(
      "communications.user",
      "name email role roles"
    );

  if (!quote) {
    throw createError(404, "Quote not found.");
  }

  if (
    !isInternalUser(req) &&
    !sameId(
      quote.customer?._id || quote.customer,
      getUserId(req)
    )
  ) {
    throw createError(403, "You cannot access this quote.");
  }

  res.json({
    success: true,
    quote,
  });
});

// ======================================================
// ADMIN QUOTE LIST
// GET /api/quotes/admin/all
// ======================================================

export const getAllQuotes = catchAsync(async (req, res) => {
  requireInternal(req);

  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const quotes = await Quote.find(filter)
    .populate(
      "rfq",
      "rfqId title companyName status sourceType quantity priority assignedTo commercialPaymentStatus"
    )
    .populate(
      "customer",
      "name email phone"
    )
    .populate(
      "payment",
      "status amount currency paidAt"
    )
    .populate(
      "order",
      "orderNumber status paymentStatus totalAmount currency paidAt"
    )
    .sort({ updatedAt: -1 });

  res.json({
    success: true,
    count: quotes.length,
    quotes,
  });
});
