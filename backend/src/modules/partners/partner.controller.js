import mongoose from "mongoose";

import asyncHandler from "../../utils/asyncHandler.js";
import notifyUser from "../../helpers/notifyUser.js";
import createAuditLog from "../../helpers/createAuditLog.js";
import { ROLES } from "../../constants/roles.js";

import User from "../users/user.model.js";
import Product from "../catalog/product.model.js";
import Order from "../orders/order.model.js";
import Commission from "../commissions/commission.model.js";
import Showcase from "../showcases/showcase.model.js";
import PartnerReferral from "./partnerReferral.model.js";
import PartnerPayout from "../payouts/partnerPayout.model.js";

import Partner from "./partner.model.js";
import PartnerProject from "./partnerProject.model.js";

import {
  PARTNER_STATUS,
  PARTNER_PROJECT_STATUS,
  COMMISSION_STATUS,
  COMMISSION_PAYOUT_STATUS,
  NOTIFICATION_TYPE,
} from "../../constants/statuses.js";

// ======================================================
// HELPERS
// ======================================================

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getUserId = (req) => req.user?._id || req.user?.id;

const sameId = (a, b) => String(a || "") === String(b || "");

const INTERNAL_ROLES = new Set(["admin", "operations"]);

const isInternalUser = (req) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];

  return roles.some((role) =>
    INTERNAL_ROLES.has(String(role).toLowerCase())
  );
};

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

const hasPartnerAccess = (partner, req) => {
  if (isInternalUser(req)) return true;

  const userId = getUserId(req);

  if (sameId(partner.owner, userId)) return true;

  return partner.members?.some(
    (member) => member.isActive && sameId(member.user, userId)
  );
};

const canManagePartner = (partner, req) => {
  if (isInternalUser(req)) return true;

  const userId = getUserId(req);

  if (sameId(partner.owner, userId)) return true;

  return partner.members?.some(
    (member) =>
      member.isActive &&
      member.role === "partner_admin" &&
      sameId(member.user, userId)
  );
};

const getMyPartnerRecord = async (req, extraSelect = "") => {
  const userId = getUserId(req);

  return Partner.findOne({
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
  }).select(extraSelect);
};

const getPartnerOrFail = async (id, extraSelect = "") => {
  if (!isValidObjectId(id)) {
    throw createError(400, "Invalid partner id.");
  }

  const partner = await Partner.findById(id).select(extraSelect);

  if (!partner) {
    throw createError(404, "Partner not found.");
  }

  return partner;
};

const getProjectOrFail = async (id, extraSelect = "") => {
  if (!isValidObjectId(id)) {
    throw createError(400, "Invalid partner project id.");
  }

  const project = await PartnerProject.findById(id).select(extraSelect);

  if (!project) {
    throw createError(404, "Partner project not found.");
  }

  return project;
};

const requireProjectAccess = async (project, req) => {
  if (isInternalUser(req)) return;

  const partner = await Partner.findById(project.partner);

  if (!partner || !hasPartnerAccess(partner, req)) {
    throw createError(403, "You do not have access to this project.");
  }
};

const pushPartnerStatus = (partner, status, req, note = "") => {
  partner.status = status;
  partner.statusHistory.push({
    status,
    changedBy: getUserId(req),
    note,
  });
};

const pushProjectStatus = (project, status, req, note = "") => {
  project.status = status;
  project.statusHistory.push({
    status,
    changedBy: getUserId(req),
    note,
  });
};

const normalizeProjectItems = async (items = []) => {
  if (!Array.isArray(items)) {
    throw createError(400, "Items must be an array.");
  }

  const normalized = [];

  for (const item of items) {
    let product = null;

    if (item.product) {
      if (!isValidObjectId(item.product)) {
        throw createError(400, "Invalid product id.");
      }

      product = await Product.findById(item.product);

      if (!product) {
        throw createError(404, "Selected product not found.");
      }
    }

    if (!product && !String(item.requestedTitle || "").trim()) {
      throw createError(
        400,
        "Each item needs a product or requested title."
      );
    }

    normalized.push({
      product: product?._id || undefined,
      requestedTitle: String(item.requestedTitle || "").trim(),
      quantity: Math.max(Number(item.quantity || 1), 1),
      personalization: String(item.personalization || "").trim(),
      partnerNote: String(item.partnerNote || "").trim(),
    });
  }

  return normalized;
};

// ======================================================
// PARTNER APPLICATION
// ======================================================

export const applyPartner = asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  if (req.user?.emailVerified === false) {
    throw createError(
      403,
      "Verify your email before submitting a partner application."
    );
  }

  const existing = await getMyPartnerRecord(req);
  if (existing) {
    throw createError(409, "You already belong to a partner account.");
  }

  const body = req.body || {};
  const businessName = String(body.businessName || "").trim();
  const contactName = String(
    body.contact?.name || req.user?.name || ""
  ).trim();
  const contactEmail = String(
    body.contact?.email || req.user?.email || ""
  )
    .trim()
    .toLowerCase();

  if (!businessName || !contactName || !contactEmail) {
    throw createError(
      400,
      "Business name, contact name and contact email are required."
    );
  }

  const capabilities = Array.isArray(body.capabilities)
    ? [
        ...new Set(
          body.capabilities
            .map((v) => String(v || "").trim())
            .filter(Boolean)
        ),
      ]
    : [];

  if (!capabilities.length) {
    throw createError(400, "Select at least one partner capability.");
  }

  if (
    body.application?.termsAccepted !== true ||
    body.application?.privacyAccepted !== true ||
    body.application?.declarationAccepted !== true
  ) {
    throw createError(
      400,
      "Partner terms, privacy policy and declaration must be accepted."
    );
  }

  const now = new Date();

  const partner = await Partner.create({
    owner: userId,
    businessName,
    legalName: String(body.legalName || "").trim(),
    registeredBusinessName: String(
      body.registeredBusinessName || body.legalName || businessName
    ).trim(),
    businessType: body.businessType || "individual",
    partnerType: body.partnerType || "event_planner",
    capabilities,
    supplyCategories: Array.isArray(body.supplyCategories)
      ? body.supplyCategories
          .map((v) => String(v || "").trim())
          .filter(Boolean)
          .slice(0, 40)
      : [],
    servicesOffered: Array.isArray(body.servicesOffered)
      ? body.servicesOffered
          .map((v) => String(v || "").trim())
          .filter(Boolean)
          .slice(0, 40)
      : [],
    contact: {
      name: contactName,
      email: contactEmail,
      phone: String(body.contact?.phone || req.user?.phone || "").trim(),
    },
    website: String(body.website || "").trim(),
    social: body.social || {},
    gstNumber: String(body.gstNumber || "").trim().toUpperCase(),
    panNumber: String(body.panNumber || "").trim().toUpperCase(),
    address: body.address || {},
    serviceAreas: Array.isArray(body.serviceAreas)
      ? body.serviceAreas.slice(0, 50)
      : [],
    about: String(body.about || "").trim(),
    experienceYears: Math.max(0, Number(body.experienceYears || 0)),
    portfolioUrl: String(body.portfolioUrl || "").trim(),
    commercialProfile: {
      expectedMonthlyVolume: Math.max(
        0,
        Number(body.commercialProfile?.expectedMonthlyVolume || 0)
      ),
      typicalOrderValue: Math.max(
        0,
        Number(body.commercialProfile?.typicalOrderValue || 0)
      ),
      preferredWorkingModel:
        body.commercialProfile?.preferredWorkingModel || "referral",
      commissionAcknowledged: Boolean(
        body.commercialProfile?.commissionAcknowledged
      ),
    },
    members: [{ user: userId, role: "partner_admin", isActive: true }],
    status: PARTNER_STATUS.APPLIED,
    application: {
      onboardingVersion: String(body.application?.onboardingVersion || "1.0"),
      submittedAt: now,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      declarationAcceptedAt: now,
      onboardingCompletedAt: now,
    },
    agreement: {
      version: String(
        body.application?.agreementVersion ||
          body.application?.onboardingVersion ||
          "1.0"
      ),
      acceptedAt: now,
      acceptedBy: userId,
      note: "Accepted during partner onboarding.",
    },
    statusHistory: [
      {
        status: PARTNER_STATUS.APPLIED,
        changedBy: userId,
        note: "Partner application submitted.",
      },
    ],
  });

  if (!req.user.roles.includes(ROLES.PARTNER)) {
    req.user.roles.push(ROLES.PARTNER);
    await req.user.save({ validateBeforeSave: false });
  }

  await createAuditLog({
    req,
    action: "partner_application_submitted",
    module: "partners",
    entityType: "partner",
    entityId: partner._id,
    description: `Partner application submitted by ${contactEmail}.`,
  });

  res.status(201).json({
    success: true,
    message: "Partner application submitted.",
    partner,
  });
});

// ======================================================
// MY PARTNER
// ======================================================

export const getMyPartner = asyncHandler(async (req, res) => {
  const partner = await getMyPartnerRecord(req, "+panNumber");

  if (!partner) {
    return res.status(200).json({
      success: true,
      partner: null,
    });
  }

  await partner.populate([
    {
      path: "owner",
      select: "name email",
    },
    {
      path: "members.user",
      select: "name email",
    },
  ]);

  res.json({
    success: true,
    partner,
  });
});

// ======================================================
// UPDATE PARTNER PROFILE
// ======================================================

export const updateMyPartner = asyncHandler(async (req, res) => {
  const partner = await getMyPartnerRecord(req);

  if (!partner) {
    throw createError(404, "Partner account not found.");
  }

  if (!canManagePartner(partner, req)) {
    throw createError(403, "You cannot manage this partner account.");
  }

  if (partner.status === PARTNER_STATUS.SUSPENDED) {
    throw createError(403, "This partner account is suspended.");
  }

  const allowed = [
    "businessName",
    "legalName",
    "registeredBusinessName",
    "businessType",
    "partnerType",
    "capabilities",
    "supplyCategories",
    "servicesOffered",
    "website",
    "social",
    "gstNumber",
    "panNumber",
    "address",
    "serviceAreas",
    "about",
    "experienceYears",
    "portfolioUrl",
    "commercialProfile",
  ];

  allowed.forEach((field) => {
    if (req.body?.[field] !== undefined) {
      partner[field] = req.body[field];
    }
  });

  if (req.body?.contact) {
    partner.contact = {
      ...partner.contact.toObject?.(),
      ...req.body.contact,
    };
  }

  await partner.save();

  res.json({
    success: true,
    message: "Partner profile updated.",
    partner,
  });
});

// ======================================================
// ADD PARTNER MEMBER
// ======================================================

export const addPartnerMember = asyncHandler(async (req, res) => {
  const partner = await getMyPartnerRecord(req);

  if (!partner) {
    throw createError(404, "Partner account not found.");
  }

  if (!canManagePartner(partner, req)) {
    throw createError(403, "You cannot manage partner members.");
  }

  const {
    userId,
    email,
    role = "partner_user",
  } = req.body || {};

  let memberUser;

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw createError(400, "Invalid user id.");
    }

    memberUser = await User.findById(userId);
  } else if (email) {
    memberUser = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });
  }

  if (!memberUser) {
    throw createError(404, "HAMPORIUM user not found.");
  }

  const otherPartner = await Partner.findOne({
    _id: { $ne: partner._id },
    $or: [
      { owner: memberUser._id },
      {
        members: {
          $elemMatch: {
            user: memberUser._id,
            isActive: true,
          },
        },
      },
    ],
  }).select("_id businessName");

  if (otherPartner) {
    throw createError(
      409,
      "This user already belongs to another partner account."
    );
  }

  const existingMember = partner.members.find((member) =>
    sameId(member.user, memberUser._id)
  );

  if (existingMember) {
    existingMember.isActive = true;
    existingMember.role = role;
  } else {
    partner.members.push({
      user: memberUser._id,
      role,
      isActive: true,
    });
  }

  await partner.save();

  if (!memberUser.roles?.includes(ROLES.PARTNER)) {
    memberUser.roles = [...(memberUser.roles || []), ROLES.PARTNER];
    await memberUser.save({ validateBeforeSave: false });
  }

  void notifyUser({
    recipient: memberUser._id,
    type: NOTIFICATION_TYPE.PARTNER,
    title: "Added to Partner Team",
    message: `You were added to ${partner.businessName}.`,
    entityType: "partner",
    entityId: partner._id,
    actionUrl: "/partner",
    eventKey: `partner-member:${partner._id}:${memberUser._id}`,
    email: {
      enabled: true,
      subject: `You were added to ${partner.businessName} on HAMPORIUM`,
      textContent: `Your HAMPORIUM account now has access to the ${partner.businessName} partner workspace.`,
    },
  });

  res.json({
    success: true,
    message: "Partner member added.",
    partner,
  });
});

// ======================================================
// REMOVE PARTNER MEMBER
// ======================================================

export const removePartnerMember = asyncHandler(async (req, res) => {
  const partner = await getMyPartnerRecord(req);

  if (!partner) {
    throw createError(404, "Partner account not found.");
  }

  if (!canManagePartner(partner, req)) {
    throw createError(403, "You cannot manage partner members.");
  }

  const member = partner.members.find((item) =>
    sameId(item.user, req.params.userId)
  );

  if (!member) {
    throw createError(404, "Partner member not found.");
  }

  if (sameId(partner.owner, member.user)) {
    throw createError(400, "Partner owner cannot be removed.");
  }

  member.isActive = false;
  await partner.save();

  res.json({
    success: true,
    message: "Partner member removed.",
  });
});

// ======================================================
// ADMIN PARTNER LIST
// ======================================================

export const getPartnersAdmin = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const filter = {};

  if (status) filter.status = status;

  if (String(search || "").trim()) {
    const regex = new RegExp(String(search).trim(), "i");

    filter.$or = [
      { businessName: regex },
      { "contact.name": regex },
      { "contact.email": regex },
      { partnerId: regex },
      { referralCode: regex },
    ];
  }

  const partners = await Partner.find(filter)
    .select("+defaultCommissionRate +customerDiscountRate")
    .populate("owner", "name email")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    partners,
  });
});

// ======================================================
// ADMIN PARTNER DETAIL
// ======================================================

export const getPartnerAdmin = asyncHandler(async (req, res) => {
  const partner = await getPartnerOrFail(
    req.params.id,
    "+defaultCommissionRate +customerDiscountRate +panNumber"
  );

  await partner.populate([
    {
      path: "owner",
      select: "name email",
    },
    {
      path: "members.user",
      select: "name email",
    },
    {
      path: "review.reviewedBy",
      select: "name email",
    },
  ]);

  const projectCount = await PartnerProject.countDocuments({
    partner: partner._id,
  });

  res.json({
    success: true,
    partner,
    projectCount,
  });
});

// ======================================================
// ADMIN REVIEW PARTNER
// ======================================================

export const reviewPartnerAdmin = asyncHandler(async (req, res) => {
  const partner = await getPartnerOrFail(
    req.params.id,
    "+defaultCommissionRate +customerDiscountRate +panNumber"
  );

  const {
    status,
    note = "",
    defaultCommissionRate,
    customerDiscountRate,
    agreementVersion,
    agreementNote,
  } = req.body || {};

  const allowedStatuses = [
    PARTNER_STATUS.UNDER_REVIEW,
    PARTNER_STATUS.APPROVED,
    PARTNER_STATUS.REJECTED,
    PARTNER_STATUS.SUSPENDED,
  ];

  if (!allowedStatuses.includes(status)) {
    throw createError(400, "Invalid partner review status.");
  }

  if (defaultCommissionRate !== undefined) {
    const rate = Number(defaultCommissionRate);

    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      throw createError(400, "Commission rate must be between 0 and 100.");
    }

    partner.defaultCommissionRate = rate;
  }

  if (customerDiscountRate !== undefined) {
    const rate = Number(customerDiscountRate);

    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      throw createError(
        400,
        "Customer partner discount must be between 0 and 100."
      );
    }

    partner.customerDiscountRate = rate;
  }

  partner.review = {
    reviewedBy: getUserId(req),
    reviewedAt: new Date(),
    note: String(note).trim(),
  };

  if (status === PARTNER_STATUS.APPROVED) {
    partner.agreement = {
      version: String(
        agreementVersion ||
          partner.agreement?.version ||
          partner.application?.onboardingVersion ||
          "1.0"
      ).trim(),
      acceptedAt:
        partner.agreement?.acceptedAt ||
        partner.application?.termsAcceptedAt ||
        new Date(),
      acceptedBy:
        partner.agreement?.acceptedBy || partner.owner,
      note: String(
        agreementNote || partner.agreement?.note || ""
      ).trim(),
    };
  }

  if (status === PARTNER_STATUS.APPROVED) {
    const ownerUser = await User.findById(partner.owner).select(
      "emailVerified"
    );

    if (!ownerUser || ownerUser.emailVerified === false) {
      throw createError(
        409,
        "Partner owner must verify their email before approval."
      );
    }
  }

  pushPartnerStatus(partner, status, req, note);
  await partner.save();

  const statusTitle =
    status === PARTNER_STATUS.APPROVED
      ? "Partner Application Approved"
      : status === PARTNER_STATUS.REJECTED
        ? "Partner Application Update"
        : status === PARTNER_STATUS.SUSPENDED
          ? "Partner Account Suspended"
          : "Partner Application Under Review";

  void notifyUser({
    recipient: partner.owner,
    type: NOTIFICATION_TYPE.PARTNER,
    title: statusTitle,
    message:
      note ||
      `Your partner application is now ${String(status).replaceAll("_", " ")}.`,
    entityType: "partner",
    entityId: partner._id,
    actionUrl: "/partner",
    eventKey: `partner-status:${partner._id}:${status}:${partner.review.reviewedAt?.getTime() || Date.now()}`,
    email: {
      enabled: true,
      subject: `${statusTitle} - HAMPORIUM`,
      textContent:
        note ||
        `Your HAMPORIUM partner application is now ${String(status).replaceAll("_", " ")}.`,
    },
  });

  await createAuditLog({
    req,
    action: `partner_${status}`,
    module: "partners",
    entityType: "partner",
    entityId: partner._id,
    description: `Partner status changed to ${status}.`,
    metadata: {
      note: String(note || ""),
      defaultCommissionRate: partner.defaultCommissionRate,
      customerDiscountRate: partner.customerDiscountRate,
    },
  });

  res.json({
    success: true,
    message: "Partner review updated.",
    partner,
  });
});

// ======================================================
// CREATE PROJECT
// ======================================================

export const createPartnerProject = asyncHandler(async (req, res) => {
  const partner = await getMyPartnerRecord(req);

  if (!partner) {
    throw createError(404, "Partner account not found.");
  }

  if (partner.status !== PARTNER_STATUS.APPROVED) {
    throw createError(
      403,
      "Only approved partners can create client projects."
    );
  }

  const {
    title,
    client,
    eventType,
    eventDate,
    deliveryCity,
    requiredDeliveryDate,
    quantity,
    budgetPerGift,
    totalBudget,
    requirements,
    brandingRequirements,
    documents,
    items,
  } = req.body || {};

  if (!String(title || "").trim()) {
    throw createError(400, "Project title is required.");
  }

  if (
    !String(client?.name || "").trim() ||
    !String(client?.email || "").trim()
  ) {
    throw createError(400, "Client name and email are required.");
  }

  const normalizedItems = await normalizeProjectItems(items || []);

  const project = await PartnerProject.create({
    partner: partner._id,
    createdBy: getUserId(req),
    title: String(title).trim(),
    client: {
      name: String(client.name).trim(),
      email: String(client.email).trim().toLowerCase(),
      phone: String(client.phone || "").trim(),
      company: String(client.company || "").trim(),
    },
    eventType: String(eventType || "").trim(),
    eventDate: eventDate || null,
    deliveryCity: String(deliveryCity || "").trim(),
    requiredDeliveryDate: requiredDeliveryDate || null,
    quantity: Number(quantity || 1),
    budgetPerGift: Number(budgetPerGift || 0),
    totalBudget: Number(totalBudget || 0),
    requirements: String(requirements || "").trim(),
    brandingRequirements: String(brandingRequirements || "").trim(),
    documents: Array.isArray(documents)
      ? documents.filter(isValidObjectId)
      : [],
    items: normalizedItems,
    status: PARTNER_PROJECT_STATUS.DRAFT,
    statusHistory: [
      {
        status: PARTNER_PROJECT_STATUS.DRAFT,
        changedBy: getUserId(req),
        note: "Partner client project created.",
      },
    ],
  });

  res.status(201).json({
    success: true,
    message: "Partner project created.",
    project,
  });
});

// ======================================================
// MY PROJECTS
// ======================================================

export const getMyPartnerProjects = asyncHandler(async (req, res) => {
  const partner = await getMyPartnerRecord(req);

  if (!partner) {
    return res.json({
      success: true,
      projects: [],
    });
  }

  const filter = { partner: partner._id };
  if (req.query.status) filter.status = req.query.status;

  const projects = await PartnerProject.find(filter)
    .populate(
      "items.product",
      "name slug images shortDescription brand"
    )
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    projects,
  });
});

// ======================================================
// PROJECT DETAIL
// ======================================================

export const getPartnerProjectById = asyncHandler(async (req, res) => {
  const project = await getProjectOrFail(
    req.params.id,
    isInternalUser(req)
      ? "+commissionRateOverride +internalNotes"
      : ""
  );

  await requireProjectAccess(project, req);

  await project.populate([
    {
      path: "partner",
      select: "partnerId businessName status contact",
    },
    {
      path: "items.product",
      select: "name slug images shortDescription brand",
    },
    {
      path: "assignedTo",
      select: "name email",
    },
  ]);

  res.json({
    success: true,
    project,
  });
});

// ======================================================
// UPDATE PROJECT
// ======================================================

export const updatePartnerProject = asyncHandler(async (req, res) => {
  const project = await getProjectOrFail(req.params.id);
  await requireProjectAccess(project, req);

  if (
    ![
      PARTNER_PROJECT_STATUS.DRAFT,
      PARTNER_PROJECT_STATUS.CHANGES_REQUESTED,
    ].includes(project.status)
  ) {
    throw createError(
      400,
      "Only draft or change-requested projects can be edited."
    );
  }

  const allowed = [
    "title",
    "eventType",
    "eventDate",
    "deliveryCity",
    "requiredDeliveryDate",
    "quantity",
    "budgetPerGift",
    "totalBudget",
    "requirements",
    "brandingRequirements",
  ];

  allowed.forEach((field) => {
    if (req.body?.[field] !== undefined) {
      project[field] = req.body[field];
    }
  });

  if (req.body?.client) {
    project.client = {
      ...project.client.toObject?.(),
      ...req.body.client,
    };
  }

  if (req.body?.documents !== undefined) {
    project.documents = Array.isArray(req.body.documents)
      ? req.body.documents.filter(isValidObjectId)
      : [];
  }

  if (req.body?.items !== undefined) {
    project.items = await normalizeProjectItems(req.body.items);
  }

  await project.save();

  res.json({
    success: true,
    message: "Partner project updated.",
    project,
  });
});

// ======================================================
// SUBMIT PROJECT
// ======================================================

export const submitPartnerProject = asyncHandler(async (req, res) => {
  const project = await getProjectOrFail(req.params.id);
  await requireProjectAccess(project, req);

  if (
    ![
      PARTNER_PROJECT_STATUS.DRAFT,
      PARTNER_PROJECT_STATUS.CHANGES_REQUESTED,
    ].includes(project.status)
  ) {
    throw createError(
      400,
      "This project cannot be submitted in its current state."
    );
  }

  if (!project.items.length) {
    throw createError(
      400,
      "Add at least one product or custom request before submitting."
    );
  }

  pushProjectStatus(
    project,
    PARTNER_PROJECT_STATUS.SUBMITTED,
    req,
    "Submitted to HAMPORIUM for validation."
  );

  project.nextAction = "HAMPORIUM validation";
  await project.save();

  res.json({
    success: true,
    message: "Project submitted for HAMPORIUM validation.",
    project,
  });
});

// ======================================================
// ADMIN PROJECT LIST
// ======================================================

export const getPartnerProjectsAdmin = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.status) filter.status = req.query.status;

  if (req.query.partnerId && isValidObjectId(req.query.partnerId)) {
    filter.partner = req.query.partnerId;
  }

  const projects = await PartnerProject.find(filter)
    .select("+commissionRateOverride +internalNotes")
    .populate("partner", "partnerId businessName status")
    .populate("createdBy", "name email")
    .populate("assignedTo", "name email")
    .populate("items.product", "name slug images brand")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    projects,
  });
});

// ======================================================
// ADMIN HAMPORIUM VALIDATION
// ======================================================

export const validatePartnerProjectAdmin = asyncHandler(async (req, res) => {
  const project = await getProjectOrFail(
    req.params.id,
    "+commissionRateOverride +internalNotes"
  );

  const {
    approved,
    note = "",
    items = [],
    assignedTo,
    promisedDate,
    priority,
    nextAction,
    internalNotes,
    commissionRateOverride,
  } = req.body || {};

  if (
    ![
      PARTNER_PROJECT_STATUS.SUBMITTED,
      PARTNER_PROJECT_STATUS.UNDER_REVIEW,
      PARTNER_PROJECT_STATUS.CHANGES_REQUESTED,
    ].includes(project.status)
  ) {
    throw createError(400, "Project is not waiting for validation.");
  }

  project.validation = {
    feasible: Boolean(approved),
    reviewedBy: getUserId(req),
    reviewedAt: new Date(),
    note: String(note).trim(),
  };

  if (assignedTo !== undefined) project.assignedTo = assignedTo || null;
  if (promisedDate !== undefined) project.promisedDate = promisedDate || null;
  if (priority !== undefined) project.priority = priority;
  if (nextAction !== undefined) {
    project.nextAction = String(nextAction || "").trim();
  }
  if (internalNotes !== undefined) {
    project.internalNotes = String(internalNotes || "").trim();
  }

  if (
    commissionRateOverride !== undefined &&
    commissionRateOverride !== null &&
    commissionRateOverride !== ""
  ) {
    const rate = Number(commissionRateOverride);

    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      throw createError(
        400,
        "Commission override must be between 0 and 100."
      );
    }

    project.commissionRateOverride = rate;
  }

  if (!approved) {
    pushProjectStatus(
      project,
      PARTNER_PROJECT_STATUS.CHANGES_REQUESTED,
      req,
      note || "Changes requested by HAMPORIUM."
    );

    project.nextAction = project.nextAction || "Partner changes required";
    await project.save();

    return res.json({
      success: true,
      message: "Project changes requested.",
      project,
    });
  }

  if (!Array.isArray(items) || !items.length) {
    throw createError(400, "Validated item pricing is required.");
  }

  for (const update of items) {
    const item = project.items.id(update.itemId);

    if (!item) {
      throw createError(404, "Project item not found.");
    }

    const status = update.validationStatus || "approved";
    item.validationStatus = status;
    item.validationNote = String(update.validationNote || "").trim();

    if (status === "approved") {
      const clientPrice = Number(update.clientPrice);

      if (Number.isNaN(clientPrice) || clientPrice <= 0) {
        throw createError(
          400,
          "Approved items require a valid client price."
        );
      }

      item.clientPrice = clientPrice;
    } else {
      item.clientPrice = 0;
    }
  }

  const approvedItems = project.items.filter(
    (item) =>
      item.validationStatus === "approved" && Number(item.clientPrice) > 0
  );

  if (!approvedItems.length) {
    throw createError(400, "At least one project item must be approved.");
  }

  project.clientPriceTotal = approvedItems.reduce(
    (total, item) =>
      total + Number(item.clientPrice || 0) * Number(item.quantity || 1),
    0
  );

  pushProjectStatus(
    project,
    PARTNER_PROJECT_STATUS.CLIENT_PRICE_APPROVED,
    req,
    note || "HAMPORIUM validation complete and client price approved."
  );

  project.nextAction = "Create private showcase";
  await project.save();

  res.json({
    success: true,
    message: "Project validated and client pricing approved.",
    project,
  });
});

// ======================================================
// PARTNER PORTAL DASHBOARD / ANALYTICS / ATTRIBUTED ORDERS
// ======================================================

const safePartner = (partner) => ({
  _id: partner._id,
  partnerId: partner.partnerId,
  referralCode: partner.referralCode,
  businessName: partner.businessName,
  legalName: partner.legalName,
  registeredBusinessName: partner.registeredBusinessName,
  businessType: partner.businessType,
  partnerType: partner.partnerType,
  capabilities: partner.capabilities,
  supplyCategories: partner.supplyCategories,
  servicesOffered: partner.servicesOffered,
  contact: partner.contact,
  website: partner.website,
  social: partner.social,
  gstNumber: partner.gstNumber,
  address: partner.address,
  serviceAreas: partner.serviceAreas,
  about: partner.about,
  experienceYears: partner.experienceYears,
  portfolioUrl: partner.portfolioUrl,
  commercialProfile: partner.commercialProfile,
  verification: partner.verification,
  application: partner.application,
  members: partner.members,
  status: partner.status,
  review: partner.review,
  agreement: partner.agreement,
  createdAt: partner.createdAt,
  updatedAt: partner.updatedAt,
});

export const getPartnerDashboard = asyncHandler(async (req, res) => {
  const partner =
    req.partner || (await getMyPartnerRecord(req, "+panNumber"));

  if (!partner) throw createError(404, "Partner account not found.");

  const [
    projectCount,
    activeProjects,
    liveShowcases,
    clientActionsRows,
    attributedOrders,
    commissionRows,
    activeReferrals,
    recentProjects,
    recentCommissions,
  ] = await Promise.all([
    PartnerProject.countDocuments({ partner: partner._id }),
    PartnerProject.countDocuments({
      partner: partner._id,
      status: {
        $nin: [
          PARTNER_PROJECT_STATUS.CANCELLED,
          PARTNER_PROJECT_STATUS.ORDER_ATTRIBUTED,
        ],
      },
    }),
    Showcase.countDocuments({ partner: partner._id, status: "active" }),
    Showcase.aggregate([
      { $match: { partner: partner._id } },
      {
        $project: {
          count: { $size: { $ifNull: ["$clientActions", []] } },
        },
      },
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]),
    Order.countDocuments({ "partnerAttribution.partner": partner._id }),
    Commission.aggregate([
      { $match: { partner: partner._id } },
      {
        $group: {
          _id: "$status",
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    PartnerReferral.countDocuments({
      partner: partner._id,
      status: "active",
    }),
    PartnerProject.find({ partner: partner._id })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select("projectId title status nextAction client createdAt updatedAt")
      .lean(),
    Commission.find({ partner: partner._id })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate("project", "projectId title")
      .select(
        "commissionId project order amount status payoutStatus createdAt updatedAt"
      )
      .lean(),
  ]);

  const commission = {};
  for (const row of commissionRows) {
    commission[row._id] = {
      count: row.count,
      amount: Number(row.amount || 0),
    };
  }

  res.json({
    success: true,
    partner: safePartner(partner),
    stats: {
      projects: { total: projectCount, active: activeProjects },
      liveShowcases,
      clientActions: Number(clientActionsRows[0]?.total || 0),
      attributedOrders,
      attributedCustomers: activeReferrals,
      commission,
      payableCommission: Number(
        commission[COMMISSION_STATUS.PAYABLE]?.amount || 0
      ),
      paidCommission: Number(
        commission[COMMISSION_STATUS.PAID]?.amount || 0
      ),
    },
    recentProjects,
    recentCommissions,
  });
});

export const getPartnerAnalytics = asyncHandler(async (req, res) => {
  const partner = req.partner || (await getMyPartnerRecord(req));
  if (!partner) throw createError(404, "Partner account not found.");

  const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
  const from = new Date();
  from.setDate(from.getDate() - days);

  const [orders, commissions, referrals, projects, showcases, payouts] =
    await Promise.all([
      Order.aggregate([
        {
          $match: {
            "partnerAttribution.partner": partner._id,
            createdAt: { $gte: from },
          },
        },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: { $sum: "$totalAmount" },
            eligibleValue: {
              $sum: { $ifNull: ["$taxableAmount", "$subtotal"] },
            },
          },
        },
      ]),
      Commission.aggregate([
        { $match: { partner: partner._id, createdAt: { $gte: from } } },
        {
          $group: {
            _id: "$status",
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      PartnerReferral.countDocuments({
        partner: partner._id,
        acquiredAt: { $gte: from },
      }),
      PartnerProject.countDocuments({
        partner: partner._id,
        createdAt: { $gte: from },
      }),
      Showcase.countDocuments({
        partner: partner._id,
        createdAt: { $gte: from },
      }),
      PartnerPayout.aggregate([
        { $match: { partner: partner._id, createdAt: { $gte: from } } },
        {
          $group: {
            _id: "$status",
            amount: { $sum: "$netAmount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  const commissionByStatus = Object.fromEntries(
    commissions.map((row) => [
      row._id,
      { count: row.count, amount: Number(row.amount || 0) },
    ])
  );

  const payoutByStatus = Object.fromEntries(
    payouts.map((row) => [
      row._id,
      { count: row.count, amount: Number(row.amount || 0) },
    ])
  );

  const commerce = orders[0] || {};

  res.json({
    success: true,
    analytics: {
      period: { days, from, to: new Date() },
      attributedCustomers: referrals,
      projects,
      showcases,
      orders: Number(commerce.orders || 0),
      revenue: Number(commerce.revenue || 0),
      eligibleValue: Number(commerce.eligibleValue || 0),
      commissionByStatus,
      payoutByStatus,
      conversion:
        referrals > 0
          ? Number(
              ((Number(commerce.orders || 0) / referrals) * 100).toFixed(2)
            )
          : 0,
    },
  });
});

export const getPartnerOrders = asyncHandler(async (req, res) => {
  const partner = req.partner || (await getMyPartnerRecord(req));
  if (!partner) throw createError(404, "Partner account not found.");

  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const skip = (page - 1) * limit;
  const filter = { "partnerAttribution.partner": partner._id };

  if (req.query.status) filter.status = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "orderNumber checkoutMode partnerAttribution partnerPromo taxableAmount taxAmount subtotal shippingAmount totalAmount currency status paymentStatus paidAt deliveryDate createdAt"
      )
      .lean(),
    Order.countDocuments(filter),
  ]);

  const orderIds = orders.map((order) => order._id);

  const commissions = await Commission.find({ order: { $in: orderIds } })
    .select("order commissionId amount status payoutStatus")
    .lean();

  const commissionMap = new Map(
    commissions.map((item) => [String(item.order), item])
  );

  res.json({
    success: true,
    orders: orders.map((order) => ({
      ...order,
      commission: commissionMap.get(String(order._id)) || null,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});
