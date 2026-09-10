import mongoose from "mongoose";
import * as XLSX from "xlsx";

import asyncHandler from "../../utils/asyncHandler.js";

import WeddingProject from "./weddingProject.model.js";
import WeddingEvent from "./weddingEvent.model.js";
import WeddingGuest from "./weddingGuest.model.js";

import User from "../users/user.model.js";

import RFQ from "../rfq/rfq.model.js";
import Quote from "../quotes/quote.model.js";
import Approval from "../approvals/approval.model.js";
import Document from "../documents/document.model.js";
import Payment from "../payments/payment.model.js";

import {
  APPROVAL_STATUS,

  QUOTE_STATUS,

  RFQ_STATUS,

  WEDDING_CONCEPT_STATUS,
  WEDDING_EVENT_STATUS,

  WEDDING_GUEST_DELIVERY_STATUS,
  WEDDING_GUEST_IMPORT_STATUS,
  WEDDING_GUEST_STATUS,

  WEDDING_PAYMENT_MILESTONE_STATUS,
  WEDDING_PROJECT_STATUS,
} from "../../constants/statuses.js";


// ======================================================
// BASIC HELPERS
// ======================================================

const createError = (
  statusCode,
  message
) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};


const getUserId = (req) => {
  return (
    req.user?._id ||
    req.user?.id
  );
};


const getId = (value) => {
  if (!value) {
    return "";
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  return (
    value._id ||
    value.id ||
    ""
  );
};


const sameId = (a, b) => {
  return (
    String(getId(a)) ===
    String(getId(b))
  );
};


const isInternalUser = (req) => {
  const roles = Array.isArray(
    req.user?.roles
  )
    ? req.user.roles
    : [];

  return roles.some((role) =>
    [
      "admin",
      "operations",
    ].includes(
      String(role).toLowerCase()
    )
  );
};


const requireInternal = (req) => {
  if (!isInternalUser(req)) {
    throw createError(
      403,
      "Admin or operations access required."
    );
  }
};


// ======================================================
// PROJECT ACCESS
// ======================================================

const getProjectMember = (
  project,
  userId
) => {
  return project.members?.find(
    (member) =>
      member.isActive &&
      sameId(
        member.user,
        userId
      )
  );
};


const hasProjectAccess = (
  project,
  req
) => {
  if (isInternalUser(req)) {
    return true;
  }

  const userId =
    getUserId(req);


  if (
    sameId(
      project.owner,
      userId
    )
  ) {
    return true;
  }


  return Boolean(
    getProjectMember(
      project,
      userId
    )
  );
};


const canManageProject = (
  project,
  req
) => {
  if (isInternalUser(req)) {
    return true;
  }

  const userId =
    getUserId(req);


  if (
    sameId(
      project.owner,
      userId
    )
  ) {
    return true;
  }


  const member =
    getProjectMember(
      project,
      userId
    );


  return [
    "owner",
    "family",
    "planner",
  ].includes(
    member?.role
  );
};


// ======================================================

const getProjectOrFail =
  async (
    projectId,
    includeInternal = false
  ) => {
    if (
      !mongoose.isValidObjectId(
        projectId
      )
    ) {
      throw createError(
        400,
        "Invalid wedding project ID."
      );
    }


    let query =
      WeddingProject.findById(
        projectId
      );


    if (includeInternal) {
      query =
        query.select(
          "+internalNotes"
        );
    }


    const project =
      await query;


    if (!project) {
      throw createError(
        404,
        "Wedding project not found."
      );
    }


    return project;
  };


const requireProjectAccess =
  async (
    project,
    req
  ) => {
    if (
      !hasProjectAccess(
        project,
        req
      )
    ) {
      throw createError(
        403,
        "You do not have access to this wedding project."
      );
    }
  };


// ======================================================
// STATUS HELPERS
// ======================================================

const pushProjectStatus = (
  project,
  status,
  changedBy,
  note = ""
) => {
  if (
    project.status === status
  ) {
    return;
  }


  project.status =
    status;


  project.statusHistory.push({
    status,

    changedBy,

    note,
  });
};


// ======================================================
// PAYMENT HELPERS
// ======================================================

const normalizePaymentStatus = (
  payment
) => {
  const status = String(
    payment?.status || ""
  ).toLowerCase();


  if (
    [
      "paid",
      "success",
      "successful",
      "captured",
      "completed",
    ].includes(status)
  ) {
    return (
      WEDDING_PAYMENT_MILESTONE_STATUS.PAID
    );
  }


  if (
    [
      "partial",
      "partially_paid",
    ].includes(status)
  ) {
    return (
      WEDDING_PAYMENT_MILESTONE_STATUS.PARTIAL
    );
  }


  return (
    WEDDING_PAYMENT_MILESTONE_STATUS.PENDING
  );
};


const syncPaymentMilestones =
  async (project) => {
    for (
      const milestone
      of project.paymentMilestones
    ) {
      if (!milestone.payment) {
        continue;
      }


      const payment =
        await Payment.findById(
          milestone.payment
        );


      if (!payment) {
        continue;
      }


      milestone.status =
        normalizePaymentStatus(
          payment
        );


      if (
        milestone.status ===
        WEDDING_PAYMENT_MILESTONE_STATUS.PAID &&
        !milestone.paidAt
      ) {
        milestone.paidAt =
          new Date();
      }
    }
  };


const areRequiredPaymentsComplete = (
  project
) => {
  const required =
    project.paymentMilestones.filter(
      (milestone) =>
        milestone.required
    );


  if (required.length === 0) {
    return false;
  }


  return required.every(
    (milestone) =>
      [
        WEDDING_PAYMENT_MILESTONE_STATUS.PAID,
        WEDDING_PAYMENT_MILESTONE_STATUS.WAIVED,
      ].includes(
        milestone.status
      )
  );
};


const hasPartialPayment = (
  project
) => {
  return project.paymentMilestones.some(
    (milestone) =>
      [
        WEDDING_PAYMENT_MILESTONE_STATUS.PARTIAL,
        WEDDING_PAYMENT_MILESTONE_STATUS.PAID,
      ].includes(
        milestone.status
      )
  );
};


// ======================================================
// GUEST SUMMARY
// ======================================================

const calculateGuestSummary =
  async (projectId) => {
    const [
      total,
      valid,
      invalid,
      approved,
      allocated,
    ] = await Promise.all([
      WeddingGuest.countDocuments({
        project: projectId,
      }),

      WeddingGuest.countDocuments({
        project: projectId,

        status:
          WEDDING_GUEST_STATUS.VALID,
      }),

      WeddingGuest.countDocuments({
        project: projectId,

        status:
          WEDDING_GUEST_STATUS.INVALID,
      }),

      WeddingGuest.countDocuments({
        project: projectId,

        status:
          WEDDING_GUEST_STATUS.APPROVED,
      }),

      WeddingGuest.countDocuments({
        project: projectId,

        deliveryStatus: {
          $in: [
            WEDDING_GUEST_DELIVERY_STATUS.ALLOCATED,
            WEDDING_GUEST_DELIVERY_STATUS.READY,
            WEDDING_GUEST_DELIVERY_STATUS.DELIVERED,
          ],
        },
      }),
    ]);


    return {
      total,
      valid,
      invalid,
      approved,
      allocated,
    };
  };


// ======================================================
// MAIN PROJECT WORKFLOW SYNC
// ======================================================

const syncWeddingProjectWorkflow =
  async (
    project,
    changedBy = null
  ) => {
    if (
      project.status ===
      WEDDING_PROJECT_STATUS.CANCELLED
    ) {
      return project;
    }


    // --------------------------------------
    // Draft
    // --------------------------------------

    if (!project.rfq) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.DRAFT,
        changedBy,
        "Wedding brief is still in draft."
      );

      project.nextAction =
        "Complete and submit wedding brief";


      await project.save();

      return project;
    }


    const [
      rfq,
      quote,
      conceptApproval,
      finalApproval,
    ] = await Promise.all([
      RFQ.findById(
        project.rfq
      ),

      Quote.findOne({
        rfq:
          project.rfq,
      }),

      Approval.findOne({
        weddingProject:
          project._id,

        subjectType:
          "wedding_concept",
      }).sort({
        version: -1,
        createdAt: -1,
      }),

      Approval.findOne({
        weddingProject:
          project._id,

        subjectType: {
          $in: [
            "sample",
            "proof",
            "artwork",
            "specification",
          ],
        },
      }).sort({
        createdAt: -1,
      }),
    ]);


    // --------------------------------------
    // Brief submitted, no concept yet
    // --------------------------------------

    if (
      project.currentConceptVersion === 0
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.UNDER_REVIEW,
        changedBy,
        "Wedding brief is under HAMPORIUM review."
      );

      project.nextAction =
        "HAMPORIUM concept preparation";


      await project.save();

      return project;
    }


    // --------------------------------------
    // Concept stage
    // --------------------------------------

    if (
      conceptApproval?.status ===
      APPROVAL_STATUS.PENDING
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.CONCEPT_READY,
        changedBy,
        "Wedding concept is ready for review."
      );

      project.nextAction =
        "Customer concept review";


      await project.save();

      return project;
    }


    if (
      conceptApproval?.status ===
      APPROVAL_STATUS.CHANGES_REQUESTED
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.CONCEPT_CHANGE_REQUESTED,
        changedBy,
        "Customer requested concept changes."
      );

      project.nextAction =
        "Prepare revised wedding concept";


      await project.save();

      return project;
    }


    if (
      !conceptApproval ||
      conceptApproval.status !==
        APPROVAL_STATUS.APPROVED
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.CONCEPT_READY,
        changedBy,
        "Wedding concept awaiting approval."
      );

      project.nextAction =
        "Customer concept approval";


      await project.save();

      return project;
    }


    pushProjectStatus(
      project,
      WEDDING_PROJECT_STATUS.CONCEPT_APPROVED,
      changedBy,
      "Wedding concept approved."
    );


    // --------------------------------------
    // Quote stage
    // --------------------------------------

    if (!quote) {
      project.nextAction =
        "Prepare wedding estimate / quotation";


      await project.save();

      return project;
    }


    if (
      quote.status ===
      QUOTE_STATUS.DRAFT
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.QUOTE_IN_PROGRESS,
        changedBy,
        "Wedding quotation is being prepared."
      );

      project.nextAction =
        "Send wedding quotation";


      await project.save();

      return project;
    }


    if (
      quote.status ===
      QUOTE_STATUS.CHANGE_REQUESTED
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.QUOTE_CHANGE_REQUESTED,
        changedBy,
        "Customer requested quotation changes."
      );

      project.nextAction =
        "Prepare revised wedding quotation";


      await project.save();

      return project;
    }


    if (
      quote.status ===
      QUOTE_STATUS.SENT
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.QUOTE_SENT,
        changedBy,
        "Wedding quotation sent."
      );

      project.nextAction =
        "Customer quotation review";


      await project.save();

      return project;
    }


    if (
      quote.status !==
      QUOTE_STATUS.ACCEPTED
    ) {
      await project.save();

      return project;
    }


    pushProjectStatus(
      project,
      WEDDING_PROJECT_STATUS.QUOTE_ACCEPTED,
      changedBy,
      "Wedding quotation accepted."
    );


    // --------------------------------------
    // Sample / Proof approval
    // --------------------------------------

    if (!finalApproval) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.SAMPLE_PENDING,
        changedBy,
        "Sample / proof is pending."
      );

      project.nextAction =
        "Prepare sample or proof";


      await project.save();

      return project;
    }


    if (
      finalApproval.status ===
      APPROVAL_STATUS.PENDING
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.APPROVAL_PENDING,
        changedBy,
        "Sample / proof approval is pending."
      );

      project.nextAction =
        "Customer sample / proof review";


      await project.save();

      return project;
    }


    if (
      finalApproval.status ===
      APPROVAL_STATUS.CHANGES_REQUESTED
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.PROOF_CHANGE_REQUESTED,
        changedBy,
        "Customer requested sample / proof changes."
      );

      project.nextAction =
        "Prepare revised sample / proof";


      await project.save();

      return project;
    }


    if (
      finalApproval.status !==
      APPROVAL_STATUS.APPROVED
    ) {
      await project.save();

      return project;
    }


    pushProjectStatus(
      project,
      WEDDING_PROJECT_STATUS.APPROVED,
      changedBy,
      "Wedding commercial concept and proof approved."
    );


    // --------------------------------------
    // Payment milestones
    // --------------------------------------

    await syncPaymentMilestones(
      project
    );


    const paymentsComplete =
      areRequiredPaymentsComplete(
        project
      );


    if (!paymentsComplete) {
      if (
        hasPartialPayment(
          project
        )
      ) {
        pushProjectStatus(
          project,
          WEDDING_PROJECT_STATUS.PAYMENT_PARTIAL,
          changedBy,
          "Wedding payment milestones are partially completed."
        );
      } else {
        pushProjectStatus(
          project,
          WEDDING_PROJECT_STATUS.PAYMENT_PENDING,
          changedBy,
          "Wedding payment milestone is pending."
        );
      }


      project.nextAction =
        project.paymentMilestones
          .length === 0
          ? "Admin define payment milestone"
          : "Complete payment milestone";


      await project.save();

      return project;
    }


    pushProjectStatus(
      project,
      WEDDING_PROJECT_STATUS.PAYMENT_CONFIRMED,
      changedBy,
      "Required payment milestones completed."
    );


    // --------------------------------------
    // Guest data
    // --------------------------------------

    const summary =
      await calculateGuestSummary(
        project._id
      );


    project.guestSummary =
      summary;


    if (
      project.guestImportStatus ===
        WEDDING_GUEST_IMPORT_STATUS.NOT_UPLOADED ||
      summary.total === 0
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.GUESTS_PENDING,
        changedBy,
        "Wedding guest / room data is pending."
      );

      project.nextAction =
        "Upload wedding guest spreadsheet";


      await project.save();

      return project;
    }


    if (
      project.guestImportStatus ===
        WEDDING_GUEST_IMPORT_STATUS.NEEDS_REVIEW ||
      summary.invalid > 0
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.GUESTS_REVIEW,
        changedBy,
        "Wedding guest data requires review."
      );

      project.nextAction =
        "Correct guest / hotel data";


      await project.save();

      return project;
    }


    if (
      project.guestImportStatus ===
        WEDDING_GUEST_IMPORT_STATUS.APPROVED &&
      summary.total > 0 &&
      summary.approved ===
        summary.total
    ) {
      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.READY_FOR_PRODUCTION,
        changedBy,
        "Wedding project is approved and ready for production."
      );

      project.nextAction =
        "Production handoff";


      await project.save();

      return project;
    }


    pushProjectStatus(
      project,
      WEDDING_PROJECT_STATUS.GUESTS_READY,
      changedBy,
      "Guest data imported and awaiting final operations review."
    );


    project.nextAction =
      "Admin review guest allocation";


    await project.save();

    return project;
  };


// ======================================================
// SPREADSHEET HELPERS
// ======================================================

const normalizeHeader = (
  value
) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );
};


const spreadsheetValue = (
  row,
  aliases
) => {
  for (
    const [key, value]
    of Object.entries(row)
  ) {
    if (
      aliases.includes(
        normalizeHeader(key)
      )
    ) {
      return String(
        value ?? ""
      ).trim();
    }
  }


  return "";
};


const parseBoolean = (
  value
) => {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();


  return [
    "yes",
    "y",
    "true",
    "1",
    "vip",
  ].includes(
    normalized
  );
};


const parseDateValue = (
  value
) => {
  if (!value) {
    return null;
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }


  return date;
};


const buildGuestRow = (
  row,
  rowNumber,
  project,
  userId
) => {
  const guest = {
    project:
      project._id,

    importedBy:
      userId,

    rowNumber,

    familyName:
      spreadsheetValue(
        row,
        [
          "family",
          "familyname",
          "group",
        ]
      ),

    name:
      spreadsheetValue(
        row,
        [
          "name",
          "guestname",
          "fullname",
        ]
      ),

    phone:
      spreadsheetValue(
        row,
        [
          "phone",
          "mobile",
          "mobilenumber",
          "contact",
        ]
      ),

    email:
      spreadsheetValue(
        row,
        [
          "email",
          "emailaddress",
        ]
      ),

    hotelName:
      spreadsheetValue(
        row,
        [
          "hotel",
          "hotelname",
          "property",
        ]
      ),

    roomNumber:
      spreadsheetValue(
        row,
        [
          "room",
          "roomnumber",
          "roomno",
        ]
      ),

    arrivalDate:
      parseDateValue(
        spreadsheetValue(
          row,
          [
            "arrivaldate",
            "arrival",
            "checkindate",
          ]
        )
      ),

    arrivalTime:
      spreadsheetValue(
        row,
        [
          "arrivaltime",
          "checkintime",
        ]
      ),

    departureDate:
      parseDateValue(
        spreadsheetValue(
          row,
          [
            "departuredate",
            "departure",
            "checkoutdate",
          ]
        )
      ),

    departureTime:
      spreadsheetValue(
        row,
        [
          "departuretime",
          "checkouttime",
        ]
      ),

    dietaryPreference:
      spreadsheetValue(
        row,
        [
          "dietary",
          "dietarypreference",
          "diet",
        ]
      ),

    isChild:
      parseBoolean(
        spreadsheetValue(
          row,
          [
            "child",
            "ischild",
            "kid",
          ]
        )
      ),

    isVIP:
      parseBoolean(
        spreadsheetValue(
          row,
          [
            "vip",
            "isvip",
          ]
        )
      ),

    isInternationalGuest:
      parseBoolean(
        spreadsheetValue(
          row,
          [
            "international",
            "internationalguest",
            "isinternationalguest",
          ]
        )
      ),

    giftCategory:
      spreadsheetValue(
        row,
        [
          "giftcategory",
          "gift",
          "hampercategory",
        ]
      ),

    personalizationText:
      spreadsheetValue(
        row,
        [
          "personalization",
          "personalisation",
          "personalizationtext",
          "nametoprint",
        ]
      ),

    deliveryPoint:
      spreadsheetValue(
        row,
        [
          "deliverypoint",
          "deliverylocation",
          "location",
        ]
      ),

    deliveryWindow:
      spreadsheetValue(
        row,
        [
          "deliverywindow",
          "deliverytime",
        ]
      ),

    allocationNotes:
      spreadsheetValue(
        row,
        [
          "notes",
          "allocationnotes",
          "instructions",
        ]
      ),

    validationErrors: [],
  };


  if (!guest.name) {
    guest.validationErrors.push(
      "Guest name is required."
    );
  }


  if (
    guest.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      guest.email
    )
  ) {
    guest.validationErrors.push(
      "Email address is invalid."
    );
  }


  if (
    !guest.hotelName &&
    !guest.deliveryPoint
  ) {
    guest.validationErrors.push(
      "Hotel or delivery point is required."
    );
  }


  if (
    guest.roomNumber &&
    !guest.hotelName
  ) {
    guest.validationErrors.push(
      "Room number requires a hotel name."
    );
  }


  guest.status =
    guest.validationErrors
      .length > 0
      ? WEDDING_GUEST_STATUS.INVALID
      : WEDDING_GUEST_STATUS.VALID;


  return guest;
};


const validateGuestDocument = (
  guest
) => {
  const errors = [];


  if (!guest.name?.trim()) {
    errors.push(
      "Guest name is required."
    );
  }


  if (
    guest.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      guest.email
    )
  ) {
    errors.push(
      "Email address is invalid."
    );
  }


  if (
    !guest.hotelName?.trim() &&
    !guest.deliveryPoint?.trim()
  ) {
    errors.push(
      "Hotel or delivery point is required."
    );
  }


  if (
    guest.roomNumber?.trim() &&
    !guest.hotelName?.trim()
  ) {
    errors.push(
      "Room number requires a hotel name."
    );
  }


  return errors;
};


// ======================================================
// CREATE WEDDING PROJECT / BRIEF
// ======================================================

export const createWeddingProject =
  asyncHandler(
    async (req, res) => {
      const body =
        req.body || {};

      const userId =
        getUserId(req);


      if (
        !body.projectTitle?.trim()
      ) {
        throw createError(
          400,
          "Wedding project title is required."
        );
      }


      const project =
        await WeddingProject.create({
          owner:
            userId,

          members: [
            {
              user:
                userId,

              role:
                "owner",

              isActive:
                true,
            },
          ],

          projectTitle:
            body.projectTitle.trim(),

          coupleName:
            body.coupleName || "",

          familyName:
            body.familyName || "",

          primaryContact: {
            name:
              body.primaryContact
                ?.name ||
              req.user?.name ||
              "",

            email:
              body.primaryContact
                ?.email ||
              req.user?.email ||
              "",

            phone:
              body.primaryContact
                ?.phone ||
              req.user?.phone ||
              "",
          },

          weddingStartDate:
            body.weddingStartDate ||
            null,

          weddingEndDate:
            body.weddingEndDate ||
            null,

          destination:
            body.destination || {},

          venueName:
            body.venueName || "",

          hotelName:
            body.hotelName || "",

          estimatedGuestCount:
            Number(
              body.estimatedGuestCount ||
                0
            ),

          estimatedRoomCount:
            Number(
              body.estimatedRoomCount ||
                0
            ),

          totalGiftQuantity:
            Math.max(
              Number(
                body.totalGiftQuantity ||
                  1
              ),
              1
            ),

          budgetPerGift:
            Number(
              body.budgetPerGift ||
                0
            ),

          totalBudget:
            Number(
              body.totalBudget ||
                0
            ),

          currency:
            body.currency ||
            "INR",

          giftingCategories:
            Array.isArray(
              body.giftingCategories
            )
              ? body.giftingCategories
              : [],

          theme:
            body.theme || "",

          style:
            body.style || "",

          colourPalette:
            Array.isArray(
              body.colourPalette
            )
              ? body.colourPalette
              : [],

          dietaryRequirements:
            Array.isArray(
              body.dietaryRequirements
            )
              ? body.dietaryRequirements
              : [],

          culturalRequirements:
            Array.isArray(
              body.culturalRequirements
            )
              ? body.culturalRequirements
              : [],

          personalizationRequirements:
            body.personalizationRequirements ||
            "",

          packagingRequirements:
            body.packagingRequirements ||
            "",

          destinationConstraints:
            body.destinationConstraints ||
            "",

          notes:
            body.notes || "",

          status:
            WEDDING_PROJECT_STATUS.DRAFT,

          nextAction:
            "Complete and submit wedding brief",

          statusHistory: [
            {
              status:
                WEDDING_PROJECT_STATUS.DRAFT,

              changedBy:
                userId,

              note:
                "Wedding project created.",
            },
          ],
        });


      res.status(201).json({
        success: true,

        message:
          "Wedding project created successfully.",

        project,
      });
    }
  );


// ======================================================
// UPDATE DRAFT BRIEF
// ======================================================

export const updateWeddingProject =
  asyncHandler(
    async (req, res) => {
      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      if (
        !canManageProject(
          project,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot edit this wedding project."
        );
      }


      if (project.rfq) {
        throw createError(
          400,
          "Submitted wedding brief cannot be edited here. Contact HAMPORIUM for requirement changes."
        );
      }


      const allowed = [
        "projectTitle",
        "coupleName",
        "familyName",
        "primaryContact",
        "weddingStartDate",
        "weddingEndDate",
        "destination",
        "venueName",
        "hotelName",
        "estimatedGuestCount",
        "estimatedRoomCount",
        "totalGiftQuantity",
        "budgetPerGift",
        "totalBudget",
        "currency",
        "giftingCategories",
        "theme",
        "style",
        "colourPalette",
        "dietaryRequirements",
        "culturalRequirements",
        "personalizationRequirements",
        "packagingRequirements",
        "destinationConstraints",
        "notes",
      ];


      for (
        const field of allowed
      ) {
        if (
          body[field] !==
          undefined
        ) {
          project[field] =
            body[field];
        }
      }


      await project.save();


      res.json({
        success: true,

        message:
          "Wedding brief updated.",

        project,
      });
    }
  );


// ======================================================
// SUBMIT WEDDING BRIEF
// Creates shared RFQ so Quote engine remains shared.
// ======================================================

export const submitWeddingBrief =
  asyncHandler(
    async (req, res) => {
      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      if (
        !canManageProject(
          project,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot submit this wedding brief."
        );
      }


      if (project.rfq) {
        throw createError(
          400,
          "Wedding brief has already been submitted."
        );
      }


      const contactName =
        project.primaryContact
          ?.name ||
        req.user?.name;


      const contactEmail =
        project.primaryContact
          ?.email ||
        req.user?.email;


      if (
        !contactName ||
        !contactEmail
      ) {
        throw createError(
          400,
          "Primary contact name and email are required."
        );
      }


      const deliveryLocations =
        [
          project.destination?.city,
          project.hotelName,
          project.venueName,
        ].filter(Boolean);


      const rfq =
        await RFQ.create({
          requester:
            project.owner,

          sourceType:
            "wedding",

          companyName:
            project.familyName ||
            project.coupleName ||
            "Wedding Project",

          gstNumber:
            "",

          contactName,

          contactEmail,

          contactPhone:
            project.primaryContact
              ?.phone ||
            "",

          title:
            project.projectTitle,

          objective:
            "Wedding gifting programme",

          occasion:
            "Wedding",

          recipientType:
            "Wedding Guests",

          description: [
            project.coupleName
              ? `Couple: ${project.coupleName}`
              : "",

            project.theme
              ? `Theme: ${project.theme}`
              : "",

            project.style
              ? `Style: ${project.style}`
              : "",
          ]
            .filter(Boolean)
            .join(" | "),

          quantity:
            Math.max(
              project.totalGiftQuantity ||
                project.estimatedGuestCount ||
                1,
              1
            ),

          budgetPerGift:
            project.budgetPerGift ||
            0,

          totalBudget:
            project.totalBudget ||
            0,

          currency:
            project.currency ||
            "INR",

          deliveryLocations,

          addressModel:
            "multiple_addresses",

          requiredDeliveryDate:
            project.weddingStartDate ||
            null,

          productInterest:
            project.giftingCategories ||
            [],

          branding: {
            required:
              Boolean(
                project.personalizationRequirements
              ),

            logoRequired:
              false,

            personalizationRequired:
              Boolean(
                project.personalizationRequirements
              ),

            method:
              "Wedding personalization",

            notes:
              project.personalizationRequirements ||
              "",
          },

          packagingRequirements:
            project.packagingRequirements ||
            "",

          dietaryRequirements:
            project.dietaryRequirements ||
            [],

          personalizationRequirements:
            project.personalizationRequirements ||
            "",

          notes:
            [
              project.destinationConstraints,

              project.culturalRequirements
                ?.length
                ? `Cultural requirements: ${project.culturalRequirements.join(", ")}`
                : "",

              project.notes,
            ]
              .filter(Boolean)
              .join("\n"),

          documents:
            project.documents ||
            [],

          status:
            RFQ_STATUS.SUBMITTED,

          submittedAt:
            new Date(),

          nextAction:
            "Wedding brief review",

          statusHistory: [
            {
              status:
                RFQ_STATUS.SUBMITTED,

              changedBy:
                getUserId(req),

              note:
                `Submitted from wedding project ${project.weddingProjectId}.`,
            },
          ],
        });


      project.rfq =
        rfq._id;

      project.submittedAt =
        new Date();


      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.BRIEF_SUBMITTED,
        getUserId(req),
        `Wedding brief submitted as RFQ ${rfq.rfqId}.`
      );


      project.nextAction =
        "HAMPORIUM wedding brief review";


      await project.save();


      res.status(201).json({
        success: true,

        message:
          "Wedding brief submitted successfully.",

        project,

        rfq,
      });
    }
  );


// ======================================================
// MY PROJECTS
// ======================================================

export const getMyWeddingProjects =
  asyncHandler(
    async (req, res) => {
      const userId =
        getUserId(req);


      const projects =
        await WeddingProject.find({
          $or: [
            {
              owner:
                userId,
            },

            {
              members: {
                $elemMatch: {
                  user:
                    userId,

                  isActive:
                    true,
                },
              },
            },
          ],
        })
          .sort({
            createdAt: -1,
          })
          .populate(
            "rfq",
            "rfqId status title"
          )
          .populate(
            "assignedTo",
            "name email"
          );


      res.json({
        success: true,

        projects,
      });
    }
  );


// ======================================================
// ADMIN LIST
// ======================================================

export const getAllWeddingProjects =
  asyncHandler(
    async (req, res) => {
      requireInternal(req);


      const {
        status,
        priority,
        page = 1,
        limit = 25,
      } = req.query;


      const query = {};


      if (status) {
        query.status =
          status;
      }


      if (priority) {
        query.priority =
          priority;
      }


      const safePage =
        Math.max(
          Number(page) || 1,
          1
        );


      const safeLimit =
        Math.min(
          Math.max(
            Number(limit) || 25,
            1
          ),
          100
        );


      const [
        projects,
        total,
      ] = await Promise.all([
        WeddingProject.find(
          query
        )
          .select(
            "+internalNotes"
          )
          .sort({
            createdAt: -1,
          })
          .skip(
            (safePage - 1) *
              safeLimit
          )
          .limit(
            safeLimit
          )
          .populate(
            "owner",
            "name email"
          )
          .populate(
            "assignedTo",
            "name email"
          )
          .populate(
            "rfq",
            "rfqId status"
          ),

        WeddingProject.countDocuments(
          query
        ),
      ]);


      res.json({
        success: true,

        pagination: {
          page:
            safePage,

          limit:
            safeLimit,

          total,

          pages:
            Math.ceil(
              total /
                safeLimit
            ),
        },

        projects,
      });
    }
  );


// ======================================================
// PROJECT DETAIL
// ======================================================

export const getWeddingProjectById =
  asyncHandler(
    async (req, res) => {
      let project =
        await getProjectOrFail(
          req.params.id,
          isInternalUser(req)
        );


      await requireProjectAccess(
        project,
        req
      );


      await syncWeddingProjectWorkflow(
        project,
        getUserId(req)
      );


      project =
        await WeddingProject.findById(
          project._id
        )
          .select(
            isInternalUser(req)
              ? "+internalNotes"
              : "-internalNotes"
          )
          .populate(
            "owner",
            "name email"
          )
          .populate(
            "members.user",
            "name email"
          )
          .populate(
            "assignedTo",
            "name email"
          )
          .populate(
            "rfq"
          )
          .populate(
            "documents"
          )
          .populate(
            "guestFile"
          )
          .populate(
            "concepts.document"
          )
          .populate(
            "concepts.approval"
          )
          .populate(
            "paymentMilestones.payment"
          );


      const [
        events,
        quote,
        approvals,
        guestSummary,
      ] = await Promise.all([
        WeddingEvent.find({
          project:
            project._id,
        }).sort({
          eventDate: 1,
          createdAt: 1,
        }),

        project.rfq
          ? Quote.findOne({
              rfq:
                project.rfq._id,
            })
          : null,

        Approval.find({
          weddingProject:
            project._id,
        })
          .sort({
            createdAt: -1,
          })
          .populate(
            "document"
          ),

        calculateGuestSummary(
          project._id
        ),
      ]);


      res.json({
        success: true,

        project,

        events,

        quote,

        approvals,

        guestSummary,
      });
    }
  );


// ======================================================
// MEMBERS
// ======================================================

export const addWeddingMember =
  asyncHandler(
    async (req, res) => {
      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      if (
        !canManageProject(
          project,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot manage wedding project members."
        );
      }


      const allowedRoles = [
        "family",
        "planner",
        "finance",
        "viewer",
      ];


      if (
        !allowedRoles.includes(
          body.role
        )
      ) {
        throw createError(
          400,
          "Invalid wedding member role."
        );
      }


      let user = null;


      if (
        body.userId &&
        mongoose.isValidObjectId(
          body.userId
        )
      ) {
        user =
          await User.findById(
            body.userId
          );
      } else if (
        body.email
      ) {
        user =
          await User.findOne({
            email:
              String(
                body.email
              )
                .trim()
                .toLowerCase(),
          });
      }


      if (!user) {
        throw createError(
          404,
          "User not found. They must have a HAMPORIUM account first."
        );
      }


      if (
        sameId(
          user._id,
          project.owner
        )
      ) {
        throw createError(
          400,
          "Project owner already has access."
        );
      }


      const existing =
        project.members.find(
          (member) =>
            sameId(
              member.user,
              user._id
            )
        );


      if (existing) {
        existing.role =
          body.role;

        existing.isActive =
          true;
      } else {
        project.members.push({
          user:
            user._id,

          role:
            body.role,

          isActive:
            true,
        });
      }


      await project.save();


      res.json({
        success: true,

        message:
          "Wedding project member saved.",

        project,
      });
    }
  );


// ======================================================

export const removeWeddingMember =
  asyncHandler(
    async (req, res) => {
      const project =
        await getProjectOrFail(
          req.params.id
        );


      if (
        !canManageProject(
          project,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot manage wedding project members."
        );
      }


      const member =
        project.members.find(
          (item) =>
            sameId(
              item.user,
              req.params.userId
            )
        );


      if (!member) {
        throw createError(
          404,
          "Wedding project member not found."
        );
      }


      member.isActive =
        false;


      await project.save();


      res.json({
        success: true,

        message:
          "Wedding project member removed.",
      });
    }
  );


// ======================================================
// EVENTS
// ======================================================

export const createWeddingEvent =
  asyncHandler(
    async (req, res) => {
      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      if (
        !canManageProject(
          project,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot manage wedding events."
        );
      }


      if (
        !body.title?.trim()
      ) {
        throw createError(
          400,
          "Event title is required."
        );
      }


      const event =
        await WeddingEvent.create({
          project:
            project._id,

          createdBy:
            getUserId(req),

          eventType:
            body.eventType ||
            "other",

          title:
            body.title.trim(),

          eventDate:
            body.eventDate ||
            null,

          startTime:
            body.startTime ||
            "",

          endTime:
            body.endTime ||
            "",

          venueName:
            body.venueName ||
            "",

          hotelName:
            body.hotelName ||
            "",

          city:
            body.city ||
            "",

          expectedGuests:
            Number(
              body.expectedGuests ||
                0
            ),

          giftQuantity:
            Number(
              body.giftQuantity ||
                0
            ),

          giftingCategories:
            Array.isArray(
              body.giftingCategories
            )
              ? body.giftingCategories
              : [],

          deliveryPoint:
            body.deliveryPoint ||
            "",

          deliveryInstructions:
            body.deliveryInstructions ||
            "",

          notes:
            body.notes ||
            "",

          status:
            WEDDING_EVENT_STATUS.PLANNED,
        });


      res.status(201).json({
        success: true,

        message:
          "Wedding event created.",

        event,
      });
    }
  );


// ======================================================

export const updateWeddingEvent =
  asyncHandler(
    async (req, res) => {
      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      if (
        !canManageProject(
          project,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot manage wedding events."
        );
      }


      const event =
        await WeddingEvent.findOne({
          _id:
            req.params.eventId,

          project:
            project._id,
        });


      if (!event) {
        throw createError(
          404,
          "Wedding event not found."
        );
      }


      const allowed = [
        "eventType",
        "title",
        "eventDate",
        "startTime",
        "endTime",
        "venueName",
        "hotelName",
        "city",
        "expectedGuests",
        "giftQuantity",
        "giftingCategories",
        "deliveryPoint",
        "deliveryInstructions",
        "notes",
        "status",
      ];


      for (
        const field of allowed
      ) {
        if (
          body[field] !==
          undefined
        ) {
          event[field] =
            body[field];
        }
      }


      await event.save();


      res.json({
        success: true,

        message:
          "Wedding event updated.",

        event,
      });
    }
  );


// ======================================================

export const deleteWeddingEvent =
  asyncHandler(
    async (req, res) => {
      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      if (
        !canManageProject(
          project,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot manage wedding events."
        );
      }


      const guestCount =
        await WeddingGuest.countDocuments({
          project:
            project._id,

          eventIds:
            req.params.eventId,
        });


      if (
        guestCount > 0
      ) {
        throw createError(
          400,
          "Event cannot be deleted while guests are allocated to it."
        );
      }


      const event =
        await WeddingEvent.findOneAndDelete({
          _id:
            req.params.eventId,

          project:
            project._id,
        });


      if (!event) {
        throw createError(
          404,
          "Wedding event not found."
        );
      }


      res.json({
        success: true,

        message:
          "Wedding event deleted.",
      });
    }
  );


// ======================================================
// CREATE / PUBLISH CONCEPT VERSION
//
// First upload concept using shared documents:
// POST /api/documents
// entityType = wedding
// entityId = project._id
// documentType = concept
//
// Then send returned documentId here.
// ======================================================

export const createWeddingConcept =
  asyncHandler(
    async (req, res) => {
      requireInternal(req);


      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      if (!project.rfq) {
        throw createError(
          400,
          "Wedding brief must be submitted before publishing a concept."
        );
      }


      if (
        !body.documentId ||
        !mongoose.isValidObjectId(
          body.documentId
        )
      ) {
        throw createError(
          400,
          "Valid concept documentId is required."
        );
      }


      const document =
        await Document.findById(
          body.documentId
        );


      if (!document) {
        throw createError(
          404,
          "Concept document not found."
        );
      }


      if (
        document.entityType !==
          "wedding" ||
        !sameId(
          document.entityId,
          project._id
        )
      ) {
        throw createError(
          400,
          "Concept document does not belong to this wedding project."
        );
      }


      const pendingApproval =
        await Approval.findOne({
          weddingProject:
            project._id,

          subjectType:
            "wedding_concept",

          status:
            APPROVAL_STATUS.PENDING,
        });


      if (pendingApproval) {
        throw createError(
          409,
          "A wedding concept is already awaiting customer approval."
        );
      }


      for (
        const concept
        of project.concepts
      ) {
        if (
          concept.status ===
            WEDDING_CONCEPT_STATUS.PUBLISHED ||
          concept.status ===
            WEDDING_CONCEPT_STATUS.CHANGE_REQUESTED
        ) {
          concept.status =
            WEDDING_CONCEPT_STATUS.SUPERSEDED;
        }
      }


      const nextVersion =
        project.currentConceptVersion +
        1;


      const previousApproval =
        await Approval.findOne({
          weddingProject:
            project._id,

          subjectType:
            "wedding_concept",
        }).sort({
          version: -1,
        });


      const approvalVersion =
        previousApproval
          ? previousApproval.version +
            1
          : 1;


      const approval =
        await Approval.create({
          rfq:
            project.rfq,

          weddingProject:
            project._id,

          document:
            document._id,

          subjectType:
            "wedding_concept",

          title:
            body.title ||
            `Wedding Concept V${nextVersion}`,

          description:
            body.description ||
            "Please review this wedding gifting concept.",

          version:
            approvalVersion,

          requestedBy:
            getUserId(req),

          reviewer:
            project.owner,

          status:
            APPROVAL_STATUS.PENDING,

          statusHistory: [
            {
              status:
                APPROVAL_STATUS.PENDING,

              changedBy:
                getUserId(req),

              note:
                `Wedding concept V${nextVersion} published.`,
            },
          ],
        });


      project.concepts.push({
        versionNumber:
          nextVersion,

        title:
          body.title ||
          `Wedding Concept V${nextVersion}`,

        description:
          body.description ||
          "",

        document:
          document._id,

        approval:
          approval._id,

        status:
          WEDDING_CONCEPT_STATUS.PUBLISHED,

        createdBy:
          getUserId(req),
      });


      project.currentConceptVersion =
        nextVersion;


      project.documents.addToSet(
        document._id
      );


      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.CONCEPT_READY,
        getUserId(req),
        `Wedding concept V${nextVersion} published.`
      );


      project.nextAction =
        "Customer concept review";


      await project.save();


      res.status(201).json({
        success: true,

        message:
          `Wedding concept V${nextVersion} published for approval.`,

        project,

        approval,
      });
    }
  );


// ======================================================
// CREATE SAMPLE / PROOF APPROVAL
// Shared Approval model reused.
// ======================================================

export const createWeddingApproval =
  asyncHandler(
    async (req, res) => {
      requireInternal(req);


      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      if (!project.rfq) {
        throw createError(
          400,
          "Wedding project does not have an RFQ."
        );
      }


      const quote =
        await Quote.findOne({
          rfq:
            project.rfq,
        });


      if (
        !quote ||
        quote.status !==
          QUOTE_STATUS.ACCEPTED ||
        !quote.acceptedVersionNumber
      ) {
        throw createError(
          400,
          "Wedding quotation must be accepted before sample / proof approval."
        );
      }


      const subjectType =
        body.subjectType;


      if (
        ![
          "sample",
          "proof",
          "artwork",
          "specification",
        ].includes(
          subjectType
        )
      ) {
        throw createError(
          400,
          "subjectType must be sample, proof, artwork or specification."
        );
      }


      if (
        !body.documentId ||
        !mongoose.isValidObjectId(
          body.documentId
        )
      ) {
        throw createError(
          400,
          "Valid documentId is required."
        );
      }


      const document =
        await Document.findById(
          body.documentId
        );


      if (!document) {
        throw createError(
          404,
          "Document not found."
        );
      }


      const belongsToWedding =
        document.entityType ===
          "wedding" &&
        sameId(
          document.entityId,
          project._id
        );


      const belongsToRFQ =
        document.entityType ===
          "rfq" &&
        sameId(
          document.entityId,
          project.rfq
        );


      if (
        !belongsToWedding &&
        !belongsToRFQ
      ) {
        throw createError(
          400,
          "Document does not belong to this wedding project."
        );
      }


      const pending =
        await Approval.findOne({
          weddingProject:
            project._id,

          subjectType,

          status:
            APPROVAL_STATUS.PENDING,
        });


      if (pending) {
        throw createError(
          409,
          `A pending ${subjectType} approval already exists.`
        );
      }


      const previous =
        await Approval.findOne({
          weddingProject:
            project._id,

          subjectType,
        }).sort({
          version: -1,
        });


      const version =
        previous
          ? previous.version + 1
          : 1;


      const approval =
        await Approval.create({
          rfq:
            project.rfq,

          quote:
            quote._id,

          quoteVersion:
            quote.acceptedVersionNumber,

          weddingProject:
            project._id,

          document:
            document._id,

          subjectType,

          title:
            body.title ||
            `Wedding ${subjectType} approval`,

          description:
            body.description ||
            `Please review the wedding ${subjectType}.`,

          version,

          requestedBy:
            getUserId(req),

          reviewer:
            project.owner,

          status:
            APPROVAL_STATUS.PENDING,

          statusHistory: [
            {
              status:
                APPROVAL_STATUS.PENDING,

              changedBy:
                getUserId(req),

              note:
                `Wedding ${subjectType} approval V${version} created.`,
            },
          ],
        });


      project.documents.addToSet(
        document._id
      );


      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.APPROVAL_PENDING,
        getUserId(req),
        `Wedding ${subjectType} approval requested.`
      );


      project.nextAction =
        `Customer ${subjectType} review`;


      await project.save();


      res.status(201).json({
        success: true,

        message:
          `${subjectType} approval created.`,

        approval,

        project,
      });
    }
  );


// ======================================================
// PAYMENT MILESTONES
// ======================================================

export const createPaymentMilestone =
  asyncHandler(
    async (req, res) => {
      requireInternal(req);


      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      if (
        !body.title?.trim()
      ) {
        throw createError(
          400,
          "Payment milestone title is required."
        );
      }


      if (
        Number(
          body.amount || 0
        ) < 0
      ) {
        throw createError(
          400,
          "Payment milestone amount cannot be negative."
        );
      }


      project.paymentMilestones.push({
        title:
          body.title.trim(),

        amount:
          Number(
            body.amount || 0
          ),

        percentage:
          Number(
            body.percentage || 0
          ),

        dueDate:
          body.dueDate ||
          null,

        required:
          body.required !==
          false,

        status:
          WEDDING_PAYMENT_MILESTONE_STATUS.PENDING,

        note:
          body.note || "",
      });


      await project.save();


      await syncWeddingProjectWorkflow(
        project,
        getUserId(req)
      );


      res.status(201).json({
        success: true,

        message:
          "Wedding payment milestone created.",

        project,
      });
    }
  );


// ======================================================

export const linkMilestonePayment =
  asyncHandler(
    async (req, res) => {
      requireInternal(req);


      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      const milestone =
        project.paymentMilestones.id(
          req.params.milestoneId
        );


      if (!milestone) {
        throw createError(
          404,
          "Wedding payment milestone not found."
        );
      }


      if (
        !body.paymentId ||
        !mongoose.isValidObjectId(
          body.paymentId
        )
      ) {
        throw createError(
          400,
          "Valid paymentId is required."
        );
      }


      const payment =
        await Payment.findById(
          body.paymentId
        );


      if (!payment) {
        throw createError(
          404,
          "Payment not found."
        );
      }


      milestone.payment =
        payment._id;

      milestone.linkedAt =
        new Date();

      milestone.status =
        normalizePaymentStatus(
          payment
        );


      if (
        milestone.status ===
        WEDDING_PAYMENT_MILESTONE_STATUS.PAID
      ) {
        milestone.paidAt =
          new Date();
      }


      await project.save();


      await syncWeddingProjectWorkflow(
        project,
        getUserId(req)
      );


      res.json({
        success: true,

        message:
          "Payment linked to wedding milestone.",

        project,

        payment,
      });
    }
  );


// ======================================================

export const syncMilestonePayment =
  asyncHandler(
    async (req, res) => {
      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      const milestone =
        project.paymentMilestones.id(
          req.params.milestoneId
        );


      if (!milestone) {
        throw createError(
          404,
          "Wedding payment milestone not found."
        );
      }


      if (!milestone.payment) {
        throw createError(
          400,
          "No payment is linked to this milestone."
        );
      }


      const payment =
        await Payment.findById(
          milestone.payment
        );


      if (!payment) {
        throw createError(
          404,
          "Linked payment no longer exists."
        );
      }


      milestone.status =
        normalizePaymentStatus(
          payment
        );


      if (
        milestone.status ===
        WEDDING_PAYMENT_MILESTONE_STATUS.PAID
      ) {
        milestone.paidAt =
          milestone.paidAt ||
          new Date();
      }


      await project.save();


      await syncWeddingProjectWorkflow(
        project,
        getUserId(req)
      );


      res.json({
        success: true,

        message:
          "Wedding payment milestone synchronized.",

        project,

        payment,
      });
    }
  );


// ======================================================

export const waivePaymentMilestone =
  asyncHandler(
    async (req, res) => {
      requireInternal(req);


      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      const milestone =
        project.paymentMilestones.id(
          req.params.milestoneId
        );


      if (!milestone) {
        throw createError(
          404,
          "Wedding payment milestone not found."
        );
      }


      milestone.status =
        WEDDING_PAYMENT_MILESTONE_STATUS.WAIVED;

      milestone.note =
        body.note ||
        "Payment milestone waived by operations.";


      await project.save();


      await syncWeddingProjectWorkflow(
        project,
        getUserId(req)
      );


      res.json({
        success: true,

        message:
          "Wedding payment milestone waived.",

        project,
      });
    }
  );


// ======================================================
// GUEST SPREADSHEET IMPORT
// ======================================================

export const importWeddingGuests =
  asyncHandler(
    async (req, res) => {
      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      if (!req.file) {
        throw createError(
          400,
          "Wedding guest spreadsheet is required."
        );
      }


      if (!project.rfq) {
        throw createError(
          400,
          "Submit wedding brief before importing guests."
        );
      }


      const replaceExisting =
        String(
          body.replaceExisting ||
          ""
        ).toLowerCase() ===
        "true";


      const currentCount =
        await WeddingGuest.countDocuments({
          project:
            project._id,
        });


      if (
        currentCount > 0 &&
        !replaceExisting
      ) {
        throw createError(
          409,
          "Wedding guests already exist. Send replaceExisting=true to replace the current import."
        );
      }


      let workbook;


      try {
        workbook =
          XLSX.read(
            req.file.buffer,
            {
              type: "buffer",
            }
          );
      } catch {
        throw createError(
          400,
          "Unable to read wedding guest spreadsheet."
        );
      }


      const sheetName =
        workbook.SheetNames?.[0];


      if (!sheetName) {
        throw createError(
          400,
          "Spreadsheet does not contain a worksheet."
        );
      }


      const rows =
        XLSX.utils.sheet_to_json(
          workbook.Sheets[
            sheetName
          ],
          {
            defval: "",
            raw: false,
          }
        );


      if (
        rows.length === 0
      ) {
        throw createError(
          400,
          "Wedding guest spreadsheet contains no rows."
        );
      }


      if (
        rows.length > 10000
      ) {
        throw createError(
          400,
          "Maximum 10,000 wedding guest rows are allowed per import."
        );
      }


      if (replaceExisting) {
        await WeddingGuest.deleteMany({
          project:
            project._id,
        });
      }


      const userId =
        getUserId(req);


      const guestRows =
        rows.map(
          (row, index) =>
            buildGuestRow(
              row,
              index + 2,
              project,
              userId
            )
        );


      await WeddingGuest.insertMany(
        guestRows
      );


      const summary =
        await calculateGuestSummary(
          project._id
        );


      project.guestSummary =
        summary;


      project.guestImportStatus =
        summary.invalid > 0
          ? WEDDING_GUEST_IMPORT_STATUS.NEEDS_REVIEW
          : WEDDING_GUEST_IMPORT_STATUS.UPLOADED;


      if (
        body.documentId &&
        mongoose.isValidObjectId(
          body.documentId
        )
      ) {
        const document =
          await Document.findById(
            body.documentId
          );


        if (
          document &&
          document.documentType ===
            "guest_file" &&
          document.entityType ===
            "wedding" &&
          sameId(
            document.entityId,
            project._id
          )
        ) {
          project.guestFile =
            document._id;

          project.documents.addToSet(
            document._id
          );
        }
      }


      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.GUESTS_REVIEW,
        userId,
        `${summary.total} wedding guest rows imported.`
      );


      project.nextAction =
        summary.invalid > 0
          ? "Correct invalid wedding guest rows"
          : "Admin review guest / hotel allocation";


      await project.save();


      res.status(201).json({
        success: true,

        message:
          "Wedding guest spreadsheet imported successfully.",

        summary,

        guestImportStatus:
          project.guestImportStatus,
      });
    }
  );


// ======================================================
// GET GUESTS
// ======================================================

export const getWeddingGuests =
  asyncHandler(
    async (req, res) => {
      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      const {
        status,
        hotelName,
        page = 1,
        limit = 50,
      } = req.query;


      const query = {
        project:
          project._id,
      };


      if (status) {
        query.status =
          status;
      }


      if (hotelName) {
        query.hotelName =
          hotelName;
      }


      const safePage =
        Math.max(
          Number(page) || 1,
          1
        );


      const safeLimit =
        Math.min(
          Math.max(
            Number(limit) || 50,
            1
          ),
          200
        );


      const [
        guests,
        total,
        summary,
      ] = await Promise.all([
        WeddingGuest.find(
          query
        )
          .sort({
            rowNumber: 1,
          })
          .skip(
            (safePage - 1) *
              safeLimit
          )
          .limit(
            safeLimit
          )
          .populate(
            "eventIds",
            "weddingEventId title eventDate"
          ),

        WeddingGuest.countDocuments(
          query
        ),

        calculateGuestSummary(
          project._id
        ),
      ]);


      res.json({
        success: true,

        pagination: {
          page:
            safePage,

          limit:
            safeLimit,

          total,

          pages:
            Math.ceil(
              total /
                safeLimit
            ),
        },

        summary,

        guests,
      });
    }
  );


// ======================================================
// CUSTOMER / PLANNER UPDATE GUEST
// ======================================================

export const updateWeddingGuest =
  asyncHandler(
    async (req, res) => {
      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      if (
        !canManageProject(
          project,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot edit wedding guest data."
        );
      }


      const guest =
        await WeddingGuest.findOne({
          _id:
            req.params.guestId,

          project:
            project._id,
        });


      if (!guest) {
        throw createError(
          404,
          "Wedding guest not found."
        );
      }


      const allowed = [
        "familyName",
        "name",
        "phone",
        "email",
        "hotelName",
        "roomNumber",
        "arrivalDate",
        "arrivalTime",
        "departureDate",
        "departureTime",
        "dietaryPreference",
        "isChild",
        "isVIP",
        "isInternationalGuest",
        "giftCategory",
        "personalizationText",
        "deliveryPoint",
        "deliveryWindow",
      ];


      for (
        const field of allowed
      ) {
        if (
          body[field] !==
          undefined
        ) {
          guest[field] =
            body[field];
        }
      }


      guest.validationErrors =
        validateGuestDocument(
          guest
        );


      guest.status =
        guest.validationErrors
          .length > 0
          ? WEDDING_GUEST_STATUS.INVALID
          : WEDDING_GUEST_STATUS.VALID;


      guest.reviewedBy =
        null;

      guest.reviewedAt =
        null;


      await guest.save();


      project.guestSummary =
        await calculateGuestSummary(
          project._id
        );


      project.guestImportStatus =
        project.guestSummary
          .invalid > 0
          ? WEDDING_GUEST_IMPORT_STATUS.NEEDS_REVIEW
          : WEDDING_GUEST_IMPORT_STATUS.UPLOADED;


      await project.save();


      res.json({
        success: true,

        message:
          "Wedding guest updated.",

        guest,

        summary:
          project.guestSummary,
      });
    }
  );


// ======================================================
// ADMIN HOTEL / EVENT ALLOCATION
// ======================================================

export const updateGuestAllocation =
  asyncHandler(
    async (req, res) => {
      requireInternal(req);


      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      const guest =
        await WeddingGuest.findOne({
          _id:
            req.params.guestId,

          project:
            project._id,
        });


      if (!guest) {
        throw createError(
          404,
          "Wedding guest not found."
        );
      }


      if (
        body.eventIds !==
        undefined
      ) {
        if (
          !Array.isArray(
            body.eventIds
          )
        ) {
          throw createError(
            400,
            "eventIds must be an array."
          );
        }


        const events =
          await WeddingEvent.find({
            _id: {
              $in:
                body.eventIds,
            },

            project:
              project._id,
          }).select("_id");


        if (
          events.length !==
          body.eventIds.length
        ) {
          throw createError(
            400,
            "One or more wedding events do not belong to this project."
          );
        }


        guest.eventIds =
          events.map(
            (event) =>
              event._id
          );
      }


      const allowed = [
        "hotelName",
        "roomNumber",
        "deliveryPoint",
        "deliveryWindow",
        "allocationNotes",
        "deliveryStatus",
      ];


      for (
        const field of allowed
      ) {
        if (
          body[field] !==
          undefined
        ) {
          guest[field] =
            body[field];
        }
      }


      await guest.save();


      project.guestSummary =
        await calculateGuestSummary(
          project._id
        );


      await project.save();


      res.json({
        success: true,

        message:
          "Wedding guest allocation updated.",

        guest,

        summary:
          project.guestSummary,
      });
    }
  );


// ======================================================
// ADMIN APPROVE GUEST DATA
// ======================================================

export const reviewWeddingGuests =
  asyncHandler(
    async (req, res) => {
      requireInternal(req);


      const project =
        await getProjectOrFail(
          req.params.id
        );


      const summary =
        await calculateGuestSummary(
          project._id
        );


      if (
        summary.total === 0
      ) {
        throw createError(
          400,
          "No wedding guests have been imported."
        );
      }


      if (
        summary.invalid > 0
      ) {
        throw createError(
          400,
          `${summary.invalid} wedding guest rows still contain validation errors.`
        );
      }


      await WeddingGuest.updateMany(
        {
          project:
            project._id,

          status:
            WEDDING_GUEST_STATUS.VALID,
        },

        {
          $set: {
            status:
              WEDDING_GUEST_STATUS.APPROVED,

            reviewedBy:
              getUserId(req),

            reviewedAt:
              new Date(),
          },
        }
      );


      project.guestImportStatus =
        WEDDING_GUEST_IMPORT_STATUS.APPROVED;


      project.guestSummary =
        await calculateGuestSummary(
          project._id
        );


      await project.save();


      await syncWeddingProjectWorkflow(
        project,
        getUserId(req)
      );


      res.json({
        success: true,

        message:
          "Wedding guest data approved.",

        project,

        summary:
          project.guestSummary,
      });
    }
  );


// ======================================================
// GUEST ALLOCATION EXPORT
// ======================================================

export const exportWeddingGuests =
  asyncHandler(
    async (req, res) => {
      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      const guests =
        await WeddingGuest.find({
          project:
            project._id,
        })
          .sort({
            hotelName: 1,
            roomNumber: 1,
            rowNumber: 1,
          })
          .populate(
            "eventIds",
            "title eventDate"
          );


      const rows =
        guests.map(
          (guest) => ({
            "Guest ID":
              guest.weddingGuestId,

            Family:
              guest.familyName,

            Name:
              guest.name,

            Phone:
              guest.phone,

            Email:
              guest.email,

            Hotel:
              guest.hotelName,

            Room:
              guest.roomNumber,

            "Arrival Date":
              guest.arrivalDate
                ? guest.arrivalDate.toISOString()
                    .slice(0, 10)
                : "",

            "Arrival Time":
              guest.arrivalTime,

            "Departure Date":
              guest.departureDate
                ? guest.departureDate.toISOString()
                    .slice(0, 10)
                : "",

            "Departure Time":
              guest.departureTime,

            Dietary:
              guest.dietaryPreference,

            Child:
              guest.isChild
                ? "Yes"
                : "No",

            VIP:
              guest.isVIP
                ? "Yes"
                : "No",

            International:
              guest.isInternationalGuest
                ? "Yes"
                : "No",

            "Gift Category":
              guest.giftCategory,

            Personalization:
              guest.personalizationText,

            Events:
              guest.eventIds
                ?.map(
                  (event) =>
                    event.title
                )
                .join(", ") ||
              "",

            "Delivery Point":
              guest.deliveryPoint,

            "Delivery Window":
              guest.deliveryWindow,

            "Allocation Notes":
              guest.allocationNotes,

            "Delivery Status":
              guest.deliveryStatus,

            "Validation Status":
              guest.status,
          })
        );


      const worksheet =
        XLSX.utils.json_to_sheet(
          rows
        );


      const workbook =
        XLSX.utils.book_new();


      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Wedding Guests"
      );


      const buffer =
        XLSX.write(
          workbook,
          {
            type: "buffer",
            bookType: "xlsx",
          }
        );


      const safeName =
        String(
          project.weddingProjectId
        ).replace(
          /[^a-zA-Z0-9_-]/g,
          ""
        );


      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );


      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}-guest-allocation.xlsx"`
      );


      res.send(buffer);
    }
  );


// ======================================================
// ADMIN OPERATIONS
// ======================================================

export const updateWeddingAdmin =
  asyncHandler(
    async (req, res) => {
      requireInternal(req);


      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id,
          true
        );


      const allowed = [
        "assignedTo",
        "priority",
        "promisedDate",
        "nextAction",
        "internalNotes",
      ];


      for (
        const field of allowed
      ) {
        if (
          body[field] !==
          undefined
        ) {
          project[field] =
            body[field];
        }
      }


      await project.save();


      res.json({
        success: true,

        message:
          "Wedding operations updated.",

        project,
      });
    }
  );


// ======================================================
// MANUAL SYNC
// ======================================================

export const syncWeddingProject =
  asyncHandler(
    async (req, res) => {
      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      await syncWeddingProjectWorkflow(
        project,
        getUserId(req)
      );


      res.json({
        success: true,

        message:
          "Wedding project synchronized.",

        project,
      });
    }
  );


// ======================================================
// CANCEL PROJECT
// ======================================================

export const cancelWeddingProject =
  asyncHandler(
    async (req, res) => {
      const body =
        req.body || {};


      const project =
        await getProjectOrFail(
          req.params.id
        );


      await requireProjectAccess(
        project,
        req
      );


      if (
        !canManageProject(
          project,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot cancel this wedding project."
        );
      }


      if (
        project.status ===
        WEDDING_PROJECT_STATUS.READY_FOR_PRODUCTION
      ) {
        throw createError(
          400,
          "Production-ready wedding project cannot be cancelled from the customer workflow."
        );
      }


      project.cancelledAt =
        new Date();


      pushProjectStatus(
        project,
        WEDDING_PROJECT_STATUS.CANCELLED,
        getUserId(req),
        body.reason ||
          "Wedding project cancelled."
      );


      project.nextAction =
        "Cancelled";


      await project.save();


      res.json({
        success: true,

        message:
          "Wedding project cancelled.",

        project,
      });
    }
  );