import mongoose from "mongoose";

import Document from "./document.model.js";
import RFQ from "../rfq/rfq.model.js";
import Quote from "../quotes/quote.model.js";
import Approval from "../approvals/approval.model.js";
import WeddingProject from "../weddings/weddingProject.model.js";
import Partner from "../partners/partner.model.js";
import PartnerProject from "../partners/partnerProject.model.js";
import PartnerPayout from "../payouts/partnerPayout.model.js";

import uploadFile from "../../helpers/uploadFile.js";

import {
  DOCUMENT_STATUS,
  RFQ_STATUS,
} from "../../constants/statuses.js";


const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getUserId = (req) => req.user?._id || req.user?.id;

const sameId = (a, b) =>
  String(a?._id || a || "") === String(b?._id || b || "");

const INTERNAL_ROLES = new Set(["admin", "operations"]);

const isInternalUser = (req) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];

  return roles.some((role) =>
    INTERNAL_ROLES.has(String(role).toLowerCase())
  );
};

const normalizeUploadResult = (result = {}) => ({
  url:
    result.url ||
    result.secure_url ||
    result.location ||
    result.Location ||
    "",

  storageKey:
    result.storageKey ||
    result.key ||
    result.Key ||
    result.public_id ||
    "",
});


// ======================================================
// ENTITY ACCESS
// ======================================================

const checkEntityAccess = async ({
  req,
  entityType,
  entityId,
}) => {
  if (!mongoose.Types.ObjectId.isValid(entityId)) {
    throw createError(400, "Invalid entity id.");
  }

  if (isInternalUser(req)) return null;

  const userId = getUserId(req);

  if (entityType === "rfq") {
    const rfq = await RFQ.findById(entityId).select("requester");

    if (!rfq) throw createError(404, "RFQ not found.");

    if (!sameId(rfq.requester, userId)) {
      throw createError(403, "You cannot access this RFQ.");
    }

    return rfq;
  }

  if (entityType === "quote") {
    const quote = await Quote.findById(entityId).select("customer");

    if (!quote) throw createError(404, "Quote not found.");

    if (!sameId(quote.customer, userId)) {
      throw createError(403, "You cannot access this quote.");
    }

    return quote;
  }

  if (entityType === "approval") {
    const approval = await Approval.findById(entityId).select("reviewer");

    if (!approval) {
      throw createError(404, "Approval not found.");
    }

    if (!sameId(approval.reviewer, userId)) {
      throw createError(403, "You cannot access this approval.");
    }

    return approval;
  }

  // --------------------------------------
  // PHASE 7 - WEDDING
  // --------------------------------------

  if (entityType === "wedding") {
    const project = await WeddingProject.findById(entityId).select(
      "owner members"
    );

    if (!project) {
      throw createError(404, "Wedding project not found.");
    }

    const ownerAccess = sameId(project.owner, userId);

    const memberAccess = project.members?.some(
      (member) =>
        member.isActive &&
        sameId(member.user, userId)
    );

    if (!ownerAccess && !memberAccess) {
      throw createError(
        403,
        "You do not have access to this wedding project."
      );
    }

    return project;
  }

  if (entityType === "partner") {
    const partner = await Partner.findById(entityId).select("owner members");
    if (!partner) throw createError(404, "Partner not found.");

    const allowed =
      sameId(partner.owner, userId) ||
      partner.members?.some(
        (member) => member.isActive && sameId(member.user, userId)
      );

    if (!allowed) {
      throw createError(403, "You do not have access to this partner account.");
    }

    return partner;
  }

  if (entityType === "partner_project") {
    const project = await PartnerProject.findById(entityId).select("partner");
    if (!project) throw createError(404, "Partner project not found.");

    const partner = await Partner.findById(project.partner).select("owner members");
    if (!partner) throw createError(404, "Partner not found.");

    const allowed =
      sameId(partner.owner, userId) ||
      partner.members?.some(
        (member) => member.isActive && sameId(member.user, userId)
      );

    if (!allowed) {
      throw createError(403, "You do not have access to this partner project.");
    }

    return project;
  }

  if (entityType === "partner_payout") {
    const payout = await PartnerPayout.findById(entityId).select("partner");
    if (!payout) throw createError(404, "Partner payout not found.");

    const partner = await Partner.findById(payout.partner).select("owner members");
    if (!partner) throw createError(404, "Partner not found.");

    const allowed =
      sameId(partner.owner, userId) ||
      partner.members?.some(
        (member) => member.isActive && sameId(member.user, userId)
      );

    if (!allowed) {
      throw createError(403, "You do not have access to this partner payout.");
    }

    return payout;
  }

  throw createError(
    403,
    "You cannot upload documents for this entity type."
  );
};


// ======================================================
// UPLOAD / CREATE DOCUMENT
// ======================================================

export const createDocument = catchAsync(async (req, res) => {
  const body = req.body || {};

  const {
    entityType,
    entityId,
    documentType = "other",
    title = "",
    description = "",
    fileName: bodyFileName = "",
    url: bodyUrl = "",
    storageKey: bodyStorageKey = "",
    mimeType: bodyMimeType = "",
    size: bodySize = 0,
    owner: requestedOwner,
  } = body;

  if (!entityType || !entityId) {
    throw createError(
      400,
      "entityType and entityId are required."
    );
  }

  await checkEntityAccess({
    req,
    entityType,
    entityId,
  });

  const userId = getUserId(req);

  if (!userId) {
    throw createError(401, "Authentication required.");
  }

  let uploadData = {
    url: bodyUrl,
    storageKey: bodyStorageKey,
  };

  if (req.file) {
    const result = await uploadFile(
      req.file,
      `hamporium/${entityType}/${entityId}`
    );

    uploadData = normalizeUploadResult(result);
  }

  const finalFileName =
    req.file?.originalname ||
    bodyFileName ||
    title;

  if (!finalFileName) {
    throw createError(400, "File name is required.");
  }

  if (!uploadData.url && !uploadData.storageKey) {
    throw createError(
      400,
      "Upload a file or provide file url/storageKey."
    );
  }

  let owner = userId;

  if (requestedOwner && isInternalUser(req)) {
    owner = requestedOwner;
  }

  if (entityType === "rfq") {
    const rfq = await RFQ.findById(entityId);

    if (!rfq) throw createError(404, "RFQ not found.");

    owner = rfq.requester;
  }

  if (entityType === "quote") {
    const quote = await Quote.findById(entityId);

    if (!quote) throw createError(404, "Quote not found.");

    owner = quote.customer;
  }

  if (entityType === "approval") {
    const approval = await Approval.findById(entityId);

    if (!approval) {
      throw createError(404, "Approval not found.");
    }

    owner = approval.reviewer;
  }

  if (entityType === "wedding") {
    const project = await WeddingProject.findById(entityId);

    if (!project) {
      throw createError(404, "Wedding project not found.");
    }

    owner = project.owner;
  }

  if (entityType === "partner") {
    const partner = await Partner.findById(entityId);
    if (!partner) throw createError(404, "Partner not found.");
    owner = partner.owner;
  }

  if (entityType === "partner_project") {
    const project = await PartnerProject.findById(entityId);
    if (!project) throw createError(404, "Partner project not found.");
    const partner = await Partner.findById(project.partner);
    if (!partner) throw createError(404, "Partner not found.");
    owner = partner.owner;
  }

  if (entityType === "partner_payout") {
    const payout = await PartnerPayout.findById(entityId);
    if (!payout) throw createError(404, "Partner payout not found.");
    const partner = await Partner.findById(payout.partner);
    if (!partner) throw createError(404, "Partner not found.");
    owner = partner.owner;
  }

  const document = await Document.create({
    owner,
    uploadedBy: userId,

    entityType,
    entityId,

    documentType,
    title,
    description,

    version: 1,

    fileName: finalFileName,

    originalName:
      req.file?.originalname ||
      finalFileName,

    mimeType:
      req.file?.mimetype ||
      bodyMimeType,

    size:
      req.file?.size ||
      Number(bodySize || 0),

    storageKey: uploadData.storageKey,
    url: uploadData.url,

    status: DOCUMENT_STATUS.ACTIVE,

    statusHistory: [
      {
        status: DOCUMENT_STATUS.ACTIVE,
        changedBy: userId,
        note: "Document created.",
      },
    ],
  });

  if (entityType === "rfq") {
    await RFQ.findByIdAndUpdate(entityId, {
      $addToSet: {
        documents: document._id,
      },
    });
  }

  if (entityType === "wedding") {
    await WeddingProject.findByIdAndUpdate(entityId, {
      $addToSet: {
        documents: document._id,
      },
    });
  }

  if (entityType === "partner_project") {
    await PartnerProject.findByIdAndUpdate(entityId, {
      $addToSet: { documents: document._id },
    });
  }

  if (
    entityType === "rfq" &&
    isInternalUser(req) &&
    ["proof", "artwork", "sample"].includes(documentType)
  ) {
    await RFQ.findByIdAndUpdate(entityId, {
      $set: {
        status: RFQ_STATUS.PROOF_READY,
        nextAction: "Customer proof review",
      },

      $push: {
        statusHistory: {
          status: RFQ_STATUS.PROOF_READY,
          changedBy: userId,
          note: `${documentType} uploaded.`,
        },
      },
    });
  }

  res.status(201).json({
    success: true,
    message: "Document uploaded successfully.",
    document,
  });
});


// ======================================================
// GET ENTITY DOCUMENTS
// ======================================================

export const getEntityDocuments = catchAsync(async (req, res) => {
  const { entityType, entityId } = req.params;

  await checkEntityAccess({
    req,
    entityType,
    entityId,
  });

  const documents = await Document.find({
    entityType,
    entityId,
  })
    .populate("uploadedBy", "name email roles")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: documents.length,
    documents,
  });
});


// ======================================================
// GET SINGLE DOCUMENT
// ======================================================

export const getDocumentById = catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id)
    .populate("uploadedBy", "name email roles")
    .populate("owner", "name email roles");

  if (!document) {
    throw createError(404, "Document not found.");
  }

  if (!isInternalUser(req)) {
    const ownerAccess = sameId(
      document.owner,
      getUserId(req)
    );

    if (!ownerAccess) {
      if (["wedding", "partner", "partner_project", "partner_payout"].includes(document.entityType)) {
        await checkEntityAccess({
          req,
          entityType: document.entityType,
          entityId: document.entityId,
        });
      } else {
        throw createError(
          403,
          "You cannot access this document."
        );
      }
    }
  }

  res.json({
    success: true,
    document,
  });
});


// ======================================================
// REPLACE DOCUMENT / NEW VERSION
// ======================================================

export const replaceDocument = catchAsync(async (req, res) => {
  const body = req.body || {};

  const oldDocument = await Document.findById(req.params.id);

  if (!oldDocument) {
    throw createError(404, "Document not found.");
  }

  if (!isInternalUser(req)) {
    const ownerAccess = sameId(
      oldDocument.owner,
      getUserId(req)
    );

    if (!ownerAccess) {
      if (oldDocument.entityType === "wedding") {
        await checkEntityAccess({
          req,
          entityType: oldDocument.entityType,
          entityId: oldDocument.entityId,
        });
      } else {
        throw createError(
          403,
          "You cannot replace this document."
        );
      }
    }
  }

  const userId = getUserId(req);

  let uploadData = {
    url: body.url || "",
    storageKey: body.storageKey || "",
  };

  if (req.file) {
    const result = await uploadFile(
      req.file,
      `hamporium/${oldDocument.entityType}/${oldDocument.entityId}`
    );

    uploadData = normalizeUploadResult(result);
  }

  if (!uploadData.url && !uploadData.storageKey) {
    throw createError(
      400,
      "Upload replacement file or provide url/storageKey."
    );
  }

  const latestVersion = await Document.findOne({
    versionGroup: oldDocument.versionGroup,
  })
    .sort({ version: -1 })
    .select("version");

  const nextVersion =
    Number(latestVersion?.version || oldDocument.version) + 1;

  oldDocument.status = DOCUMENT_STATUS.SUPERSEDED;

  oldDocument.statusHistory.push({
    status: DOCUMENT_STATUS.SUPERSEDED,
    changedBy: userId,
    note: `Replaced by version ${nextVersion}.`,
  });

  await oldDocument.save();

  const document = await Document.create({
    versionGroup: oldDocument.versionGroup,

    owner: oldDocument.owner,
    uploadedBy: userId,

    entityType: oldDocument.entityType,
    entityId: oldDocument.entityId,

    documentType: oldDocument.documentType,

    title:
      body.title ??
      oldDocument.title,

    description:
      body.description ??
      oldDocument.description,

    version: nextVersion,

    fileName:
      req.file?.originalname ||
      body.fileName ||
      oldDocument.fileName,

    originalName:
      req.file?.originalname ||
      body.fileName ||
      oldDocument.originalName,

    mimeType:
      req.file?.mimetype ||
      body.mimeType ||
      oldDocument.mimeType,

    size:
      req.file?.size ||
      Number(
        body.size ||
        oldDocument.size ||
        0
      ),

    storageKey: uploadData.storageKey,
    url: uploadData.url,

    status: DOCUMENT_STATUS.ACTIVE,

    statusHistory: [
      {
        status: DOCUMENT_STATUS.ACTIVE,
        changedBy: userId,
        note: `Document version ${nextVersion} created.`,
      },
    ],
  });

  if (oldDocument.entityType === "rfq") {
    await RFQ.findByIdAndUpdate(
      oldDocument.entityId,
      {
        $addToSet: {
          documents: document._id,
        },
      }
    );
  }

  if (oldDocument.entityType === "wedding") {
    await WeddingProject.findByIdAndUpdate(
      oldDocument.entityId,
      {
        $addToSet: {
          documents: document._id,
        },
      }
    );
  }

  if (oldDocument.entityType === "partner_project") {
    await PartnerProject.findByIdAndUpdate(
      oldDocument.entityId,
      { $addToSet: { documents: document._id } }
    );
  }

  res.status(201).json({
    success: true,
    message: `Document version ${nextVersion} created.`,
    document,
  });
});


// ======================================================
// ARCHIVE DOCUMENT
// ======================================================

export const archiveDocument = catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    throw createError(404, "Document not found.");
  }

  if (!isInternalUser(req)) {
    const ownerAccess = sameId(
      document.owner,
      getUserId(req)
    );

    if (!ownerAccess) {
      if (["wedding", "partner", "partner_project", "partner_payout"].includes(document.entityType)) {
        await checkEntityAccess({
          req,
          entityType: document.entityType,
          entityId: document.entityId,
        });
      } else {
        throw createError(
          403,
          "You cannot archive this document."
        );
      }
    }
  }

  document.status = DOCUMENT_STATUS.ARCHIVED;

  document.statusHistory.push({
    status: DOCUMENT_STATUS.ARCHIVED,
    changedBy: getUserId(req),
    note:
      req.body?.note ||
      "Document archived.",
  });

  await document.save();

  res.json({
    success: true,
    message: "Document archived successfully.",
    document,
  });
});