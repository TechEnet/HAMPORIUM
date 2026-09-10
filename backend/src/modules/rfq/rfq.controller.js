import crypto from "node:crypto";

import RFQ from "./rfq.model.js";
import Quote from "../quotes/quote.model.js";
import { validateCustomHamper } from "../cart/cart.controller.js";

import { RFQ_STATUS } from "../../constants/statuses.js";

const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getUserId = (req) => req.user?._id || req.user?.id;

const sameId = (a, b) =>
  String(a || "") === String(b || "");

const cleanString = (value, maxLength = 500) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const roundMoney = (value) =>
  Number(Number(value || 0).toFixed(2));

const INTERNAL_ROLES = new Set([
  "admin",
  "operations",
]);

const PERSONALIZATION_ASSET_TYPES = new Set([
  "logo",
  "icon",
  "gift_wrap",
  "reference_design",
]);

const PERSONALIZATION_PLACEMENTS = new Set([
  "top_lid",
  "front",
  "inside_lid",
  "gift_tag",
  "message_card",
  "ribbon_tag",
  "full_wrap",
  "other",
]);

const BULK_PURPOSES = new Set([
  "corporate",
  "wedding",
  "diwali",
  "event",
  "other",
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

const customerPopulate = [
  {
    path: "requester",
    select: "name email phone role roles",
  },
  {
    path: "assignedTo",
    select: "name email role roles",
  },
  {
    path: "documents",
    select:
      "documentId documentType title version fileName url storageKey status createdAt",
  },
  {
    path: "payment",
    select:
      "sourceType status amount currency razorpayOrderId razorpayPaymentId paidAt createdAt",
  },
  {
    path: "order",
    select:
      "orderNumber checkoutMode status paymentStatus totalAmount currency paidAt createdAt",
  },
];

const personalizationFolderForUser = (userId) =>
  `hamporium/custom-hamper-personalization/${String(userId)}`;

const getPersonalizationUploadSecret = () =>
  String(
    process.env.PERSONALIZATION_UPLOAD_SECRET ||
      process.env.JWT_SECRET ||
      process.env.COOKIE_SECRET ||
      ""
  );

const isSafeAssetUrl = (value) => {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const makePersonalizationUploadProof = ({ userId, publicId, url }) => {
  const secret = getPersonalizationUploadSecret();
  if (!secret) return "";

  return crypto
    .createHmac("sha256", secret)
    .update(`${String(userId)}\n${String(publicId)}\n${String(url)}`)
    .digest("hex");
};

const validPersonalizationUploadProof = ({
  userId,
  publicId,
  url,
  proof,
}) => {
  const expected = makePersonalizationUploadProof({
    userId,
    publicId,
    url,
  });

  const received = String(proof || "")
    .trim()
    .toLowerCase();

  if (
    !expected ||
    !/^[a-f0-9]{64}$/i.test(received) ||
    expected.length !== received.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex")
  );
};

const normalizeBulkPersonalization = (personalization, userId) => {
  if (!personalization || typeof personalization !== "object") {
    return undefined;
  }

  const rawAssets = Array.isArray(personalization.assets)
    ? personalization.assets
    : [];

  if (rawAssets.length > 4) {
    throw createError(
      400,
      "Upload at most 4 personalization images."
    );
  }

  const seen = new Set();
  const assets = [];

  for (let index = 0; index < rawAssets.length; index += 1) {
    const raw = rawAssets[index] || {};
    const type = cleanString(raw.type, 40).toLowerCase();
    const placement = cleanString(
      raw.placement || "top_lid",
      40
    ).toLowerCase();
    const url = cleanString(raw.url, 2000);
    const publicId = cleanString(raw.publicId, 500);
    const uploadProof = cleanString(raw.uploadProof, 128).toLowerCase();

    if (!PERSONALIZATION_ASSET_TYPES.has(type)) {
      throw createError(
        400,
        `Invalid personalization asset type at item ${index + 1}.`
      );
    }

    if (!PERSONALIZATION_PLACEMENTS.has(placement)) {
      throw createError(
        400,
        `Invalid personalization placement at item ${index + 1}.`
      );
    }

    if (!url || !publicId || !isSafeAssetUrl(url)) {
      throw createError(
        400,
        `Personalization asset ${index + 1} is incomplete.`
      );
    }

    if (
      !publicId.startsWith(`${personalizationFolderForUser(userId)}/`) ||
      !validPersonalizationUploadProof({
        userId,
        publicId,
        url,
        proof: uploadProof,
      })
    ) {
      throw createError(
        400,
        "One or more personalization uploads could not be verified for this account."
      );
    }

    if (seen.has(publicId)) {
      continue;
    }

    seen.add(publicId);

    assets.push({
      type,
      url,
      publicId,
      fileName: cleanString(raw.fileName, 180),
      mimeType: cleanString(raw.mimeType, 100).toLowerCase(),
      placement,
      notes: cleanString(raw.notes, 500),
    });
  }

  const message = cleanString(personalization.message, 500);
  const instructions = cleanString(personalization.instructions, 1500);

  if (!assets.length && !message && !instructions) {
    return undefined;
  }

  return {
    enabled: true,
    assets,
    message,
    instructions,
  };
};

const normalizeDeliveryLocations = (value) => {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(/[\n,]/);

  const result = [];
  const seen = new Set();

  for (const entry of source) {
    const normalized = cleanString(entry, 240);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);

    if (result.length >= 100) break;
  }

  return result;
};

const buildCustomHamperSnapshot = ({
  validation,
  personalization,
  channel,
}) => {
  const componentMap = new Map(
    (validation.components || []).map((component) => [
      String(component._id),
      component,
    ])
  );

  const contentPricingMap = new Map(
    (validation.pricing?.items || []).map((line) => [
      String(line.componentId),
      line,
    ])
  );

  const decorationPricingMap = new Map(
    (validation.pricing?.decorations || []).map((line) => [
      String(line.componentId),
      line,
    ])
  );

  const buildSelections = (selections, pricingMap) =>
    (selections || []).map((selection) => {
      const component = componentMap.get(
        String(selection.componentId)
      );
      const pricing = pricingMap.get(
        String(selection.componentId)
      );

      return {
        component: component?._id || selection.componentId,
        name: component?.name || pricing?.name || "Hamper item",
        code: component?.code || pricing?.code || "",
        image: component?.images?.[0]?.url || "",
        quantity: Number(selection.quantity || 1),
        indicativeUnitPrice: roundMoney(pricing?.unitPrice || 0),
        indicativeLineTotal: roundMoney(pricing?.lineTotal || 0),
      };
    });

  return {
    snapshotVersion: 1,
    container: validation.container?._id || null,
    containerName: validation.container?.name || "Custom Hamper Box",
    containerCode: validation.container?.code || "",
    containerImage: validation.container?.images?.[0]?.url || "",
    channel: channel || "",
    items: buildSelections(
      validation.items,
      contentPricingMap
    ),
    decorations: buildSelections(
      validation.decorations,
      decorationPricingMap
    ),
    personalization,
    indicativePricing: {
      currency: validation.pricing?.currency || "INR",
      containerPrice: roundMoney(
        validation.pricing?.containerPrice || 0
      ),
      itemsTotal: roundMoney(
        validation.pricing?.itemsTotal || 0
      ),
      decorationsTotal: roundMoney(
        validation.pricing?.decorationsTotal || 0
      ),
      total: roundMoney(validation.pricing?.total || 0),
    },
    capacity: validation.capacity || {},
  };
};

// ======================================================
// CREATE RFQ
// POST /api/rfqs
// ======================================================

export const createRFQ = catchAsync(async (req, res) => {
  const userId = getUserId(req);

  if (!userId) {
    throw createError(401, "Authentication required.");
  }

  const rfq = await RFQ.create({
    requester: userId,
    sourceType: req.body.sourceType || "corporate",
    companyName: req.body.companyName || "",
    gstNumber: req.body.gstNumber || "",
    contactName: req.body.contactName,
    contactEmail: req.body.contactEmail,
    contactPhone: req.body.contactPhone || "",
    title: req.body.title,
    objective: req.body.objective || "",
    occasion: req.body.occasion || "",
    recipientType: req.body.recipientType || "",
    description: req.body.description || "",
    quantity: Number(req.body.quantity),
    budgetPerGift: Number(req.body.budgetPerGift || 0),
    totalBudget: Number(req.body.totalBudget || 0),
    currency: req.body.currency || "INR",
    deliveryLocations: req.body.deliveryLocations || [],
    addressModel: req.body.addressModel || "not_decided",
    requiredDeliveryDate: req.body.requiredDeliveryDate || null,
    productInterest: req.body.productInterest || [],
    branding: {
      required: Boolean(req.body.branding?.required),
      logoRequired: Boolean(req.body.branding?.logoRequired),
      personalizationRequired: Boolean(
        req.body.branding?.personalizationRequired
      ),
      method: req.body.branding?.method || "",
      notes: req.body.branding?.notes || "",
    },
    packagingRequirements: req.body.packagingRequirements || "",
    dietaryRequirements: req.body.dietaryRequirements || [],
    personalizationRequirements:
      req.body.personalizationRequirements || "",
    notes: req.body.notes || "",
    status: RFQ_STATUS.DRAFT,
    nextAction: "Submit RFQ",
    statusHistory: [
      {
        status: RFQ_STATUS.DRAFT,
        changedBy: userId,
        note: "RFQ draft created.",
      },
    ],
  });

  res.status(201).json({
    success: true,
    message: "RFQ draft created successfully.",
    rfq,
  });
});

// ======================================================
// CREATE + SUBMIT CUSTOM HAMPER BULK RFQ
// POST /api/rfqs/custom-hamper
// ======================================================

export const createCustomHamperRFQ = catchAsync(
  async (req, res) => {
    const userId = getUserId(req);

    if (!userId) {
      throw createError(401, "Authentication required.");
    }

    const quantity = Number(req.body.quantity);
    const channel = cleanString(req.body.channel, 40);

    const validation = await validateCustomHamper({
      containerId: req.body.containerId,
      items: req.body.items,
      decorations: req.body.decorations || [],
      channel,
    });

    if (!validation.orderable) {
      throw createError(
        409,
        validation.message ||
          "This custom hamper is no longer available for a bulk quotation."
      );
    }

    const personalization = normalizeBulkPersonalization(
      req.body.personalization,
      userId
    );

    const customHamperRequest = buildCustomHamperSnapshot({
      validation,
      personalization,
      channel,
    });

    const purposeInput = cleanString(
      req.body.purpose || channel || "other",
      40
    ).toLowerCase();

    const purpose = BULK_PURPOSES.has(purposeInput)
      ? purposeInput
      : "other";

    const deliveryLocations = normalizeDeliveryLocations(
      req.body.deliveryLocations
    );

    const contactName = cleanString(
      req.body.contactName || req.user?.name,
      160
    );
    const contactEmail = cleanString(
      req.body.contactEmail || req.user?.email,
      200
    ).toLowerCase();
    const contactPhone = cleanString(
      req.body.contactPhone || req.user?.phone,
      60
    );

    if (!contactName || !contactEmail) {
      throw createError(
        400,
        "Your account needs a name and email before requesting a quotation."
      );
    }

    const packagingSummary = customHamperRequest.decorations.length
      ? customHamperRequest.decorations
          .map((item) => `${item.name} x${item.quantity}`)
          .join(", ")
      : "";

    const personalizationSummary = personalization?.enabled
      ? [
          personalization.message,
          personalization.instructions,
        ]
          .filter(Boolean)
          .join(" | ")
      : "";

    const submittedAt = new Date();

    const rfq = await RFQ.create({
      requester: userId,
      sourceType: "custom_hamper",
      companyName: cleanString(req.body.companyName, 200),
      gstNumber: cleanString(req.body.gstNumber, 40).toUpperCase(),
      contactName,
      contactEmail,
      contactPhone,
      title:
        cleanString(req.body.title, 240) ||
        `Bulk Custom Hamper - ${customHamperRequest.containerName}`,
      objective:
        cleanString(req.body.objective, 1000) ||
        "Bulk quotation for a customer-configured custom hamper.",
      occasion: purpose,
      recipientType:
        cleanString(req.body.recipientType, 200) ||
        "Bulk gifting recipients",
      description: cleanString(req.body.description, 2000),
      quantity,
      budgetPerGift: 0,
      totalBudget: 0,
      currency: "INR",
      deliveryLocations,
      addressModel: req.body.addressModel || "not_decided",
      requiredDeliveryDate: req.body.requiredDeliveryDate,
      productInterest: [
        "Custom Hamper",
        ...customHamperRequest.items.map((item) => item.name),
      ].slice(0, 40),
      branding: {
        required: Boolean(personalization?.enabled),
        logoRequired: Boolean(
          personalization?.assets?.some(
            (asset) => asset.type === "logo"
          )
        ),
        personalizationRequired: Boolean(personalization?.enabled),
        method: personalization?.enabled
          ? "Customer-supplied artwork / custom hamper personalisation"
          : "",
        notes: personalizationSummary,
      },
      packagingRequirements:
        cleanString(req.body.packagingRequirements, 1500) ||
        packagingSummary,
      dietaryRequirements: Array.isArray(req.body.dietaryRequirements)
        ? req.body.dietaryRequirements
            .map((item) => cleanString(item, 120))
            .filter(Boolean)
            .slice(0, 30)
        : [],
      personalizationRequirements: personalizationSummary,
      notes: cleanString(req.body.notes, 2000),
      customHamperRequest,
      commercialPaymentStatus: "not_started",
      status: RFQ_STATUS.SUBMITTED,
      submittedAt,
      nextAction: "HAMPORIUM review and quote preparation",
      statusHistory: [
        {
          status: RFQ_STATUS.SUBMITTED,
          changedBy: userId,
          note: "Custom hamper bulk quotation request submitted by customer.",
          changedAt: submittedAt,
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Custom hamper quotation request submitted successfully.",
      rfq,
    });
  }
);

// ======================================================
// UPDATE OWN DRAFT RFQ
// PATCH /api/rfqs/:id
// ======================================================

export const updateRFQ = catchAsync(async (req, res) => {
  const rfq = await RFQ.findById(req.params.id);

  if (!rfq) {
    throw createError(404, "RFQ not found.");
  }

  if (!sameId(rfq.requester, getUserId(req))) {
    throw createError(
      403,
      "You cannot edit this RFQ."
    );
  }

  if (rfq.status !== RFQ_STATUS.DRAFT) {
    throw createError(
      400,
      "Only draft RFQs can be edited."
    );
  }

  const editableFields = [
    "sourceType",
    "companyName",
    "gstNumber",
    "contactName",
    "contactEmail",
    "contactPhone",
    "title",
    "objective",
    "occasion",
    "recipientType",
    "description",
    "quantity",
    "budgetPerGift",
    "totalBudget",
    "currency",
    "deliveryLocations",
    "addressModel",
    "requiredDeliveryDate",
    "productInterest",
    "branding",
    "packagingRequirements",
    "dietaryRequirements",
    "personalizationRequirements",
    "notes",
  ];

  editableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      rfq[field] = req.body[field];
    }
  });

  await rfq.save();

  res.json({
    success: true,
    message: "RFQ updated successfully.",
    rfq,
  });
});

// ======================================================
// SUBMIT RFQ
// POST /api/rfqs/:id/submit
// ======================================================

export const submitRFQ = catchAsync(async (req, res) => {
  const rfq = await RFQ.findById(req.params.id);

  if (!rfq) {
    throw createError(404, "RFQ not found.");
  }

  if (!sameId(rfq.requester, getUserId(req))) {
    throw createError(
      403,
      "You cannot submit this RFQ."
    );
  }

  if (rfq.status !== RFQ_STATUS.DRAFT) {
    throw createError(
      400,
      "Only draft RFQs can be submitted."
    );
  }

  if (
    !rfq.contactName ||
    !rfq.contactEmail ||
    !rfq.title ||
    !rfq.quantity
  ) {
    throw createError(
      400,
      "Complete all required RFQ fields before submitting."
    );
  }

  rfq.status = RFQ_STATUS.SUBMITTED;
  rfq.submittedAt = new Date();
  rfq.nextAction = "HAMPORIUM review and quote preparation";

  rfq.statusHistory.push({
    status: RFQ_STATUS.SUBMITTED,
    changedBy: getUserId(req),
    note: "RFQ submitted by customer.",
  });

  await rfq.save();

  res.json({
    success: true,
    message: "RFQ submitted successfully.",
    rfq,
  });
});

// ======================================================
// MY RFQS
// GET /api/rfqs/mine
// ======================================================

export const getMyRFQs = catchAsync(async (req, res) => {
  const rfqs = await RFQ.find({
    requester: getUserId(req),
  })
    .populate(customerPopulate)
    .sort({
      createdAt: -1,
    });

  res.json({
    success: true,
    count: rfqs.length,
    rfqs,
  });
});

// ======================================================
// GET SINGLE RFQ
// ======================================================

export const getRFQById = catchAsync(async (req, res) => {
  const rfq = await RFQ.findById(req.params.id)
    .populate(customerPopulate);

  if (!rfq) {
    throw createError(404, "RFQ not found.");
  }

  if (
    !isInternalUser(req) &&
    !sameId(
      rfq.requester?._id || rfq.requester,
      getUserId(req)
    )
  ) {
    throw createError(
      403,
      "You cannot access this RFQ."
    );
  }

  const quote = await Quote.findOne({
    rfq: rfq._id,
  })
    .select(
      "quoteId status currentVersionNumber acceptedVersionNumber payment order paidAt createdAt updatedAt"
    )
    .populate(
      "payment",
      "status amount currency paidAt"
    )
    .populate(
      "order",
      "orderNumber status paymentStatus totalAmount currency paidAt"
    );

  res.json({
    success: true,
    rfq,
    quote,
  });
});

// ======================================================
// CANCEL OWN RFQ
// POST /api/rfqs/:id/cancel
// ======================================================

export const cancelRFQ = catchAsync(async (req, res) => {
  const rfq = await RFQ.findById(req.params.id);

  if (!rfq) {
    throw createError(404, "RFQ not found.");
  }

  if (!sameId(rfq.requester, getUserId(req))) {
    throw createError(
      403,
      "You cannot cancel this RFQ."
    );
  }

  const blockedStatuses = [
    RFQ_STATUS.QUOTE_ACCEPTED,
    RFQ_STATUS.PROOF_REVIEW,
    RFQ_STATUS.APPROVED,
  ];

  if (
    blockedStatuses.includes(rfq.status) ||
    ["pending", "paid"].includes(rfq.commercialPaymentStatus)
  ) {
    throw createError(
      400,
      "This RFQ can no longer be cancelled directly."
    );
  }

  rfq.status = RFQ_STATUS.CANCELLED;
  rfq.cancelledAt = new Date();
  rfq.nextAction = "";

  rfq.statusHistory.push({
    status: RFQ_STATUS.CANCELLED,
    changedBy: getUserId(req),
    note:
      req.body.reason ||
      "RFQ cancelled by customer.",
  });

  await rfq.save();

  res.json({
    success: true,
    message: "RFQ cancelled.",
    rfq,
  });
});

// ======================================================
// ADMIN LIST
// GET /api/rfqs/admin/all
// ======================================================

export const getAllRFQs = catchAsync(async (req, res) => {
  requireInternal(req);

  const page =
    Math.max(Number(req.query.page) || 1, 1);

  const limit =
    Math.min(
      Math.max(Number(req.query.limit) || 20, 1),
      100
    );

  const skip =
    (page - 1) * limit;

  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.priority) {
    filter.priority = req.query.priority;
  }

  if (req.query.sourceType) {
    filter.sourceType = req.query.sourceType;
  }

  if (req.query.assignedTo) {
    filter.assignedTo = req.query.assignedTo;
  }

  const [rfqs, total] = await Promise.all([
    RFQ.find(filter)
      .select("+internalNotes")
      .populate(customerPopulate)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit),

    RFQ.countDocuments(filter),
  ]);

  res.json({
    success: true,

    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },

    rfqs,
  });
});

// ======================================================
// ADMIN UPDATE / ASSIGN / REVIEW
// PATCH /api/rfqs/:id/admin
// ======================================================

export const updateRFQAdmin = catchAsync(async (req, res) => {
  requireInternal(req);

  const rfq = await RFQ.findById(req.params.id)
    .select("+internalNotes");

  if (!rfq) {
    throw createError(404, "RFQ not found.");
  }

  const previousStatus = rfq.status;

  if (req.body.assignedTo !== undefined) {
    rfq.assignedTo =
      req.body.assignedTo || null;
  }

  if (req.body.priority !== undefined) {
    rfq.priority =
      req.body.priority;
  }

  if (req.body.promisedDate !== undefined) {
    rfq.promisedDate =
      req.body.promisedDate || null;
  }

  if (req.body.nextAction !== undefined) {
    rfq.nextAction =
      req.body.nextAction;
  }

  if (req.body.internalNotes !== undefined) {
    rfq.internalNotes =
      req.body.internalNotes;
  }

  if (req.body.status !== undefined) {
    if (
      !Object.values(RFQ_STATUS).includes(
        req.body.status
      )
    ) {
      throw createError(
        400,
        "Invalid RFQ status."
      );
    }

    rfq.status = req.body.status;
  }

  if (
    previousStatus === RFQ_STATUS.SUBMITTED &&
    req.body.status === undefined
  ) {
    rfq.status = RFQ_STATUS.UNDER_REVIEW;
  }

  if (rfq.status !== previousStatus) {
    rfq.statusHistory.push({
      status: rfq.status,
      changedBy: getUserId(req),
      note:
        req.body.statusNote ||
        "RFQ status updated by admin.",
    });
  }

  await rfq.save();

  res.json({
    success: true,
    message: "RFQ updated successfully.",
    rfq,
  });
});
