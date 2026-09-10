import RFQ from "../rfq/rfq.model.js";
import Quote from "../quotes/quote.model.js";
import Document from "../documents/document.model.js";
import WeddingProject from "../weddings/weddingProject.model.js";

import Approval from "./approval.model.js";

import {
  RFQ_STATUS,
  QUOTE_STATUS,
  APPROVAL_STATUS,
  APPROVAL_ACTION,
  WEDDING_CONCEPT_STATUS,
  WEDDING_PROJECT_STATUS,
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

const requireInternal = (req) => {
  if (!isInternalUser(req)) {
    throw createError(403, "Internal staff access required.");
  }
};


// ======================================================
// CREATE APPROVAL
// POST /api/approvals
// ======================================================

export const createApproval = catchAsync(async (req, res) => {
  requireInternal(req);

  const {
    rfqId,
    quoteId,
    documentId,
    weddingProjectId,
    subjectType,
    title,
    description = "",
    reviewer,
  } = req.body || {};

  if (!rfqId) throw createError(400, "rfqId is required.");
  if (!subjectType) throw createError(400, "subjectType is required.");
  if (!title?.trim()) throw createError(400, "Approval title is required.");

  const rfq = await RFQ.findById(rfqId);
  if (!rfq) throw createError(404, "RFQ not found.");

  let quote = null;

  if (quoteId) {
    quote = await Quote.findById(quoteId);

    if (!quote) throw createError(404, "Quote not found.");

    if (!sameId(quote.rfq, rfq._id)) {
      throw createError(400, "Quote does not belong to this RFQ.");
    }
  }

  let document = null;

  if (documentId) {
    document = await Document.findById(documentId);

    if (!document) {
      throw createError(404, "Document not found.");
    }
  }

  let weddingProject = null;

  if (weddingProjectId) {
    weddingProject = await WeddingProject.findById(weddingProjectId);

    if (!weddingProject) {
      throw createError(404, "Wedding project not found.");
    }

    if (!sameId(weddingProject.rfq, rfq._id)) {
      throw createError(
        400,
        "Wedding project does not belong to this RFQ."
      );
    }
  }

  if (
    ["proof", "artwork", "sample", "specification"].includes(subjectType)
  ) {
    if (!quote || quote.status !== QUOTE_STATUS.ACCEPTED) {
      throw createError(
        400,
        "Quote must be accepted before proof/sample approval starts."
      );
    }
  }

  const scope = {
    rfq: rfq._id,
    subjectType,
    status: APPROVAL_STATUS.PENDING,
  };

  if (weddingProject) {
    scope.weddingProject = weddingProject._id;
  }

  const existingPending = await Approval.findOne(scope);

  if (existingPending) {
    throw createError(
      409,
      "A pending approval already exists for this subject."
    );
  }

  const latestScope = {
    rfq: rfq._id,
    subjectType,
  };

  if (weddingProject) {
    latestScope.weddingProject = weddingProject._id;
  }

  const latest = await Approval.findOne(latestScope)
    .sort({ version: -1 })
    .select("version");

  const version = Number(latest?.version || 0) + 1;

  const approval = await Approval.create({
    rfq: rfq._id,
    quote: quote?._id || null,
    quoteVersion: quote?.acceptedVersionNumber || null,
    weddingProject: weddingProject?._id || null,
    document: document?._id || null,

    subjectType,
    title: title.trim(),
    description,
    version,

    requestedBy: getUserId(req),
    reviewer: reviewer || weddingProject?.owner || rfq.requester,

    status: APPROVAL_STATUS.PENDING,

    statusHistory: [
      {
        status: APPROVAL_STATUS.PENDING,
        changedBy: getUserId(req),
        note: `Approval version ${version} published.`,
      },
    ],
  });

  // Wedding concept is an intermediate approval.
  // It must NOT mark the shared RFQ as approval_pending/final approved.
  if (
    subjectType === "wedding_concept" &&
    weddingProject
  ) {
    weddingProject.status = WEDDING_PROJECT_STATUS.CONCEPT_READY;
    weddingProject.nextAction = "Customer concept review";

    weddingProject.statusHistory.push({
      status: WEDDING_PROJECT_STATUS.CONCEPT_READY,
      changedBy: getUserId(req),
      note: `Wedding concept approval V${version} requested.`,
    });

    await weddingProject.save();

    return res.status(201).json({
      success: true,
      message: `Approval version ${version} created.`,
      approval,
    });
  }

  rfq.status = RFQ_STATUS.APPROVAL_PENDING;
  rfq.nextAction = "Customer approval required";

  rfq.statusHistory.push({
    status: RFQ_STATUS.APPROVAL_PENDING,
    changedBy: getUserId(req),
    note: `${subjectType} approval version ${version} requested.`,
  });

  await rfq.save();

  res.status(201).json({
    success: true,
    message: `Approval version ${version} created.`,
    approval,
  });
});


// ======================================================
// MY APPROVALS
// ======================================================

export const getMyApprovals = catchAsync(async (req, res) => {
  const approvals = await Approval.find({
    reviewer: getUserId(req),
  })
    .populate("rfq", "rfqId title companyName status")
    .populate(
      "quote",
      "quoteId status currentVersionNumber acceptedVersionNumber"
    )
    .populate(
      "weddingProject",
      "weddingProjectId projectTitle status"
    )
    .populate(
      "document",
      "documentId documentType title version fileName url storageKey status"
    )
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: approvals.length,
    approvals,
  });
});


// ======================================================
// ADMIN APPROVAL LIST
// ======================================================

export const getAllApprovals = catchAsync(async (req, res) => {
  requireInternal(req);

  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.subjectType) filter.subjectType = req.query.subjectType;

  const approvals = await Approval.find(filter)
    .populate(
      "rfq",
      "rfqId title companyName status priority assignedTo"
    )
    .populate("quote", "quoteId status acceptedVersionNumber")
    .populate(
      "weddingProject",
      "weddingProjectId projectTitle status coupleName"
    )
    .populate(
      "document",
      "documentId documentType title version fileName url storageKey"
    )
    .populate("reviewer", "name email phone")
    .populate("requestedBy", "name email roles")
    .sort({ updatedAt: -1 });

  res.json({
    success: true,
    count: approvals.length,
    approvals,
  });
});


// ======================================================
// SINGLE APPROVAL
// ======================================================

export const getApprovalById = catchAsync(async (req, res) => {
  const approval = await Approval.findById(req.params.id)
    .populate("rfq", "rfqId title companyName status requester")
    .populate("quote")
    .populate("weddingProject")
    .populate("document")
    .populate("reviewer", "name email phone roles")
    .populate("requestedBy", "name email roles")
    .populate("activities.user", "name email roles")
    .populate("decision.decidedBy", "name email roles");

  if (!approval) {
    throw createError(404, "Approval not found.");
  }

  if (
    !isInternalUser(req) &&
    !sameId(approval.reviewer, getUserId(req))
  ) {
    throw createError(403, "You cannot access this approval.");
  }

  res.json({
    success: true,
    approval,
  });
});


// ======================================================
// APPROVE
// ======================================================

export const approve = catchAsync(async (req, res) => {
  const approval = await Approval.findById(req.params.id);

  if (!approval) {
    throw createError(404, "Approval not found.");
  }

  if (!sameId(approval.reviewer, getUserId(req))) {
    throw createError(
      403,
      "Only the assigned reviewer can approve."
    );
  }

  if (approval.status !== APPROVAL_STATUS.PENDING) {
    throw createError(
      400,
      "This approval is no longer pending."
    );
  }

  const comment = req.body?.comment || "";

  approval.status = APPROVAL_STATUS.APPROVED;

  approval.activities.push({
    user: getUserId(req),
    action: APPROVAL_ACTION.APPROVE,
    comment,
  });

  approval.decision = {
    action: APPROVAL_ACTION.APPROVE,
    comment,
    decidedBy: getUserId(req),
    decidedAt: new Date(),
  };

  approval.statusHistory.push({
    status: APPROVAL_STATUS.APPROVED,
    changedBy: getUserId(req),
    note: comment || "Approved by customer.",
  });

  await approval.save();

  // --------------------------------------
  // WEDDING CONCEPT APPROVAL
  // --------------------------------------

  if (
    approval.subjectType === "wedding_concept" &&
    approval.weddingProject
  ) {
    const project = await WeddingProject.findById(
      approval.weddingProject
    );

    if (project) {
      const concept = project.concepts.find((item) =>
        sameId(item.approval, approval._id)
      );

      if (concept) {
        concept.status = WEDDING_CONCEPT_STATUS.APPROVED;
        concept.approvedAt = new Date();
      }

      project.status = WEDDING_PROJECT_STATUS.CONCEPT_APPROVED;
      project.nextAction = "Prepare wedding estimate / quotation";

      project.statusHistory.push({
        status: WEDDING_PROJECT_STATUS.CONCEPT_APPROVED,
        changedBy: getUserId(req),
        note: `Wedding concept V${approval.version} approved.`,
      });

      await project.save();
    }

    return res.json({
      success: true,
      message: "Wedding concept approved successfully.",
      approval,
    });
  }

  // --------------------------------------
  // NORMAL FINAL RFQ APPROVAL
  // --------------------------------------

  const rfq = await RFQ.findById(approval.rfq);

  if (rfq) {
    rfq.status = RFQ_STATUS.APPROVED;
    rfq.nextAction =
      "Proceed to PO/payment and next commercial stage";

    rfq.statusHistory.push({
      status: RFQ_STATUS.APPROVED,
      changedBy: getUserId(req),
      note: `${approval.subjectType} version ${approval.version} approved.`,
    });

    await rfq.save();
  }

  res.json({
    success: true,
    message: "Approval completed successfully.",
    approval,
  });
});


// ======================================================
// REQUEST CHANGES
// ======================================================

export const requestChanges = catchAsync(async (req, res) => {
  const approval = await Approval.findById(req.params.id);

  if (!approval) {
    throw createError(404, "Approval not found.");
  }

  if (!sameId(approval.reviewer, getUserId(req))) {
    throw createError(
      403,
      "Only the assigned reviewer can request changes."
    );
  }

  if (approval.status !== APPROVAL_STATUS.PENDING) {
    throw createError(
      400,
      "This approval is no longer pending."
    );
  }

  const comment = String(req.body?.comment || "").trim();

  if (!comment) {
    throw createError(
      400,
      "Change request comment is required."
    );
  }

  approval.status = APPROVAL_STATUS.CHANGES_REQUESTED;

  approval.activities.push({
    user: getUserId(req),
    action: APPROVAL_ACTION.REQUEST_CHANGES,
    comment,
  });

  approval.decision = {
    action: APPROVAL_ACTION.REQUEST_CHANGES,
    comment,
    decidedBy: getUserId(req),
    decidedAt: new Date(),
  };

  approval.statusHistory.push({
    status: APPROVAL_STATUS.CHANGES_REQUESTED,
    changedBy: getUserId(req),
    note: comment,
  });

  await approval.save();

  // --------------------------------------
  // WEDDING CONCEPT CHANGES
  // --------------------------------------

  if (
    approval.subjectType === "wedding_concept" &&
    approval.weddingProject
  ) {
    const project = await WeddingProject.findById(
      approval.weddingProject
    );

    if (project) {
      const concept = project.concepts.find((item) =>
        sameId(item.approval, approval._id)
      );

      if (concept) {
        concept.status =
          WEDDING_CONCEPT_STATUS.CHANGE_REQUESTED;

        concept.changeRequest = {
          comment,
          requestedAt: new Date(),
          requestedBy: getUserId(req),
        };
      }

      project.status =
        WEDDING_PROJECT_STATUS.CONCEPT_CHANGE_REQUESTED;

      project.nextAction =
        "Prepare revised wedding concept";

      project.statusHistory.push({
        status:
          WEDDING_PROJECT_STATUS.CONCEPT_CHANGE_REQUESTED,
        changedBy: getUserId(req),
        note: comment,
      });

      await project.save();
    }

    return res.json({
      success: true,
      message: "Wedding concept changes requested.",
      approval,
    });
  }

  // --------------------------------------
  // NORMAL PROOF / SAMPLE CHANGES
  // --------------------------------------

  const rfq = await RFQ.findById(approval.rfq);

  if (rfq) {
    rfq.status = RFQ_STATUS.PROOF_CHANGE_REQUESTED;
    rfq.nextAction = "Prepare revised proof/artwork";

    rfq.statusHistory.push({
      status: RFQ_STATUS.PROOF_CHANGE_REQUESTED,
      changedBy: getUserId(req),
      note: `Changes requested for ${approval.subjectType} version ${approval.version}.`,
    });

    await rfq.save();
  }

  res.json({
    success: true,
    message: "Changes requested successfully.",
    approval,
  });
});


// ======================================================
// COMMENT
// ======================================================

export const comment = catchAsync(async (req, res) => {
  const approval = await Approval.findById(req.params.id);

  if (!approval) {
    throw createError(404, "Approval not found.");
  }

  if (
    !isInternalUser(req) &&
    !sameId(approval.reviewer, getUserId(req))
  ) {
    throw createError(
      403,
      "You cannot comment on this approval."
    );
  }

  const message = String(req.body?.comment || "").trim();

  if (!message) {
    throw createError(400, "Comment is required.");
  }

  approval.activities.push({
    user: getUserId(req),
    action: APPROVAL_ACTION.COMMENT,
    comment: message,
  });

  await approval.save();

  res.json({
    success: true,
    message: "Comment added.",
    approval,
  });
});


// ======================================================
// ASK FOR CALL
// ======================================================

export const askForCall = catchAsync(async (req, res) => {
  const approval = await Approval.findById(req.params.id);

  if (!approval) {
    throw createError(404, "Approval not found.");
  }

  if (!sameId(approval.reviewer, getUserId(req))) {
    throw createError(
      403,
      "You cannot request a call for this approval."
    );
  }

  approval.activities.push({
    user: getUserId(req),
    action: APPROVAL_ACTION.ASK_FOR_CALL,
    comment:
      req.body?.comment ||
      "Customer requested a call.",
  });

  await approval.save();

  res.json({
    success: true,
    message: "Call request submitted successfully.",
    approval,
  });
});


// ======================================================
// CANCEL APPROVAL
// ======================================================

export const cancelApproval = catchAsync(async (req, res) => {
  requireInternal(req);

  const approval = await Approval.findById(req.params.id);

  if (!approval) {
    throw createError(404, "Approval not found.");
  }

  if (approval.status !== APPROVAL_STATUS.PENDING) {
    throw createError(
      400,
      "Only pending approval can be cancelled."
    );
  }

  approval.status = APPROVAL_STATUS.CANCELLED;

  approval.statusHistory.push({
    status: APPROVAL_STATUS.CANCELLED,
    changedBy: getUserId(req),
    note:
      req.body?.note ||
      "Approval cancelled by admin.",
  });

  await approval.save();

  res.json({
    success: true,
    message: "Approval cancelled.",
    approval,
  });
});