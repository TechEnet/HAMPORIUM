import mongoose from "mongoose";
import * as XLSX from "xlsx";

import asyncHandler from "../../utils/asyncHandler.js";

import Organization from "./organization.model.js";
import Campaign from "./campaign.model.js";
import Recipient from "./recipient.model.js";

import User from "../users/user.model.js";

import RFQ from "../rfq/rfq.model.js";
import Quote from "../quotes/quote.model.js";
import Approval from "../approvals/approval.model.js";
import Document from "../documents/document.model.js";
import Payment from "../payments/payment.model.js";

import {
  APPROVAL_STATUS,
  CORPORATE_CAMPAIGN_STATUS,
  CORPORATE_PAYMENT_STATUS,
  CORPORATE_PO_STATUS,
  ORGANIZATION_STATUS,
  QUOTE_STATUS,
  RECIPIENT_IMPORT_STATUS,
  RECIPIENT_STATUS,
  RFQ_STATUS,
} from "../../constants/statuses.js";


// ======================================================
// HELPERS
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


const sameId = (a, b) => {
  return (
    String(a || "") ===
    String(b || "")
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


const getOrganizationMembership = (
  organization,
  userId
) => {
  return organization.members?.find(
    (member) =>
      member.isActive &&
      sameId(
        member.user,
        userId
      )
  );
};


const hasOrganizationAccess = (
  organization,
  req
) => {
  if (isInternalUser(req)) {
    return true;
  }

  const userId = getUserId(req);

  if (
    sameId(
      organization.owner,
      userId
    )
  ) {
    return true;
  }

  return Boolean(
    getOrganizationMembership(
      organization,
      userId
    )
  );
};


const canManageOrganization = (
  organization,
  req
) => {
  if (isInternalUser(req)) {
    return true;
  }

  const userId = getUserId(req);

  if (
    sameId(
      organization.owner,
      userId
    )
  ) {
    return true;
  }

  const membership =
    getOrganizationMembership(
      organization,
      userId
    );

  return [
    "owner",
    "corporate_admin",
  ].includes(
    membership?.role
  );
};


const getOrganizationOrFail =
  async (organizationId) => {
    if (
      !mongoose.isValidObjectId(
        organizationId
      )
    ) {
      throw createError(
        400,
        "Invalid organization ID."
      );
    }

    const organization =
      await Organization.findById(
        organizationId
      );

    if (!organization) {
      throw createError(
        404,
        "Organization not found."
      );
    }

    return organization;
  };


const getCampaignOrFail =
  async (campaignId) => {
    if (
      !mongoose.isValidObjectId(
        campaignId
      )
    ) {
      throw createError(
        400,
        "Invalid campaign ID."
      );
    }

    const campaign =
      await Campaign.findById(
        campaignId
      );

    if (!campaign) {
      throw createError(
        404,
        "Campaign not found."
      );
    }

    return campaign;
  };


const requireCampaignAccess =
  async (campaign, req) => {
    const organization =
      await Organization.findById(
        campaign.organization
      );

    if (!organization) {
      throw createError(
        404,
        "Campaign organization not found."
      );
    }

    if (
      !hasOrganizationAccess(
        organization,
        req
      )
    ) {
      throw createError(
        403,
        "You do not have access to this campaign."
      );
    }

    return organization;
  };


const pushCampaignStatus = (
  campaign,
  status,
  userId,
  note = ""
) => {
  if (
    campaign.workflowStatus === status
  ) {
    return;
  }

  campaign.workflowStatus =
    status;

  campaign.statusHistory.push({
    status,
    changedBy: userId,
    note,
  });
};


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
    return CORPORATE_PAYMENT_STATUS.PAID;
  }

  if (
    [
      "partial",
      "partially_paid",
    ].includes(status)
  ) {
    return CORPORATE_PAYMENT_STATUS.PARTIAL;
  }

  if (
    [
      "failed",
      "failure",
      "declined",
      "cancelled",
    ].includes(status)
  ) {
    return CORPORATE_PAYMENT_STATUS.FAILED;
  }

  if (
    [
      "refunded",
      "refund",
      "partially_refunded",
    ].includes(status)
  ) {
    return CORPORATE_PAYMENT_STATUS.REFUNDED;
  }

  return CORPORATE_PAYMENT_STATUS.PENDING;
};


const isCommercialConfirmed = (
  campaign
) => {
  if (
    campaign.commercialRoute ===
      "po" &&
    campaign.po?.status ===
      CORPORATE_PO_STATUS.VERIFIED
  ) {
    return true;
  }

  if (
    campaign.commercialRoute ===
      "payment" &&
    campaign.paymentInfo?.status ===
      CORPORATE_PAYMENT_STATUS.PAID
  ) {
    return true;
  }

  return false;
};


const calculateRecipientSummary =
  async (campaignId) => {
    const [
      total,
      valid,
      invalid,
      approved,
    ] = await Promise.all([
      Recipient.countDocuments({
        campaign: campaignId,
      }),

      Recipient.countDocuments({
        campaign: campaignId,
        status:
          RECIPIENT_STATUS.VALID,
      }),

      Recipient.countDocuments({
        campaign: campaignId,
        status:
          RECIPIENT_STATUS.INVALID,
      }),

      Recipient.countDocuments({
        campaign: campaignId,
        status:
          RECIPIENT_STATUS.APPROVED,
      }),
    ]);

    return {
      total,
      valid,
      invalid,
      approved,
    };
  };


const syncCampaignWorkflow =
  async (
    campaign,
    changedBy = null
  ) => {
    if (
      campaign.workflowStatus ===
      CORPORATE_CAMPAIGN_STATUS.CANCELLED
    ) {
      return campaign;
    }


    // --------------------------------------
    // No RFQ yet
    // --------------------------------------

    if (!campaign.rfq) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.DRAFT,
        changedBy,
        "Campaign is still in draft."
      );

      await campaign.save();

      return campaign;
    }


    const [
      rfq,
      quote,
      latestApproval,
    ] = await Promise.all([
      RFQ.findById(
        campaign.rfq
      ),

      Quote.findOne({
        rfq: campaign.rfq,
      }),

      Approval.findOne({
        rfq: campaign.rfq,
      }).sort({
        version: -1,
        createdAt: -1,
      }),
    ]);


    // --------------------------------------
    // Sync linked payment
    // --------------------------------------

    if (
      campaign.paymentInfo
        ?.payment
    ) {
      const payment =
        await Payment.findById(
          campaign.paymentInfo
            .payment
        );

      if (payment) {
        campaign.paymentInfo.status =
          normalizePaymentStatus(
            payment
          );

        campaign.paymentInfo.syncedAt =
          new Date();
      }
    }


    // --------------------------------------
    // RFQ only
    // --------------------------------------

    if (!quote) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.RFQ_SUBMITTED,
        changedBy,
        "RFQ submitted and awaiting quotation."
      );

      campaign.nextAction =
        "HAMPORIUM quotation preparation";

      await campaign.save();

      return campaign;
    }


    // --------------------------------------
    // Quote
    // --------------------------------------

    if (
      quote.status ===
      QUOTE_STATUS.DRAFT
    ) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.QUOTE_IN_PROGRESS,
        changedBy,
        "Quotation is being prepared."
      );

      campaign.nextAction =
        "Prepare / send quotation";

      await campaign.save();

      return campaign;
    }


    if (
      quote.status ===
      QUOTE_STATUS.CHANGE_REQUESTED
    ) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.QUOTE_CHANGE_REQUESTED,
        changedBy,
        "Customer requested quotation changes."
      );

      campaign.nextAction =
        "Prepare revised quotation";

      await campaign.save();

      return campaign;
    }


    if (
      quote.status ===
      QUOTE_STATUS.SENT
    ) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.QUOTE_SENT,
        changedBy,
        "Quotation sent to customer."
      );

      campaign.nextAction =
        "Customer quotation review";

      await campaign.save();

      return campaign;
    }


    if (
      quote.status ===
      QUOTE_STATUS.ACCEPTED
    ) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.QUOTE_ACCEPTED,
        changedBy,
        "Commercial quotation accepted."
      );

      campaign.nextAction =
        "Prepare proof / artwork";
    }


    // --------------------------------------
    // Proof / approval
    // --------------------------------------

    if (
      rfq?.status ===
      RFQ_STATUS.PROOF_READY
    ) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.PROOF_PENDING,
        changedBy,
        "Proof is ready for customer review."
      );

      campaign.nextAction =
        "Customer proof review";
    }


    if (
      latestApproval?.status ===
      APPROVAL_STATUS.PENDING
    ) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.APPROVAL_PENDING,
        changedBy,
        "Customer approval is pending."
      );

      campaign.nextAction =
        "Customer approval";
    }


    if (
      latestApproval?.status ===
      APPROVAL_STATUS.CHANGES_REQUESTED
    ) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.PROOF_PENDING,
        changedBy,
        "Customer requested proof changes."
      );

      campaign.nextAction =
        "Prepare revised proof";
    }


    const approved =
      rfq?.status ===
        RFQ_STATUS.APPROVED ||
      latestApproval?.status ===
        APPROVAL_STATUS.APPROVED;


    if (!approved) {
      await campaign.save();

      return campaign;
    }


    pushCampaignStatus(
      campaign,
      CORPORATE_CAMPAIGN_STATUS.APPROVED,
      changedBy,
      "Proof / approval stage completed."
    );


    // --------------------------------------
    // PO / payment
    // --------------------------------------

    if (
      !isCommercialConfirmed(
        campaign
      )
    ) {
      if (
        campaign.commercialRoute ===
        "po"
      ) {
        pushCampaignStatus(
          campaign,
          CORPORATE_CAMPAIGN_STATUS.PO_PENDING,
          changedBy,
          "PO verification is pending."
        );

        campaign.nextAction =
          "PO submission / verification";
      } else if (
        campaign.commercialRoute ===
        "payment"
      ) {
        pushCampaignStatus(
          campaign,
          CORPORATE_CAMPAIGN_STATUS.PAYMENT_PENDING,
          changedBy,
          "Payment confirmation is pending."
        );

        campaign.nextAction =
          "Payment confirmation";
      } else {
        pushCampaignStatus(
          campaign,
          CORPORATE_CAMPAIGN_STATUS.COMMERCIAL_PENDING,
          changedBy,
          "PO or payment route must be selected."
        );

        campaign.nextAction =
          "Select PO or payment";
      }

      await campaign.save();

      return campaign;
    }


    pushCampaignStatus(
      campaign,
      CORPORATE_CAMPAIGN_STATUS.COMMERCIAL_CONFIRMED,
      changedBy,
      "PO / payment requirement completed."
    );


    // --------------------------------------
    // Recipient data
    // --------------------------------------

    const summary =
      await calculateRecipientSummary(
        campaign._id
      );

    campaign.recipientSummary =
      summary;


    if (
      campaign.recipientImportStatus ===
        RECIPIENT_IMPORT_STATUS.NEEDS_REVIEW ||
      summary.invalid > 0
    ) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.RECIPIENTS_REVIEW,
        changedBy,
        "Recipient data requires correction or review."
      );

      campaign.nextAction =
        "Review recipient data";

      await campaign.save();

      return campaign;
    }


    if (
      campaign.recipientImportStatus ===
        RECIPIENT_IMPORT_STATUS.APPROVED &&
      summary.total > 0 &&
      summary.approved ===
        summary.total
    ) {
      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.READY_FOR_PRODUCTION,
        changedBy,
        "Commercial and recipient data are ready for production."
      );

      campaign.nextAction =
        "Production handoff";

      await campaign.save();

      return campaign;
    }


    pushCampaignStatus(
      campaign,
      CORPORATE_CAMPAIGN_STATUS.RECIPIENTS_PENDING,
      changedBy,
      "Recipient spreadsheet is pending."
    );

    campaign.nextAction =
      "Upload recipient spreadsheet";

    await campaign.save();

    return campaign;
  };


// ======================================================
// RECIPIENT SPREADSHEET HELPERS
// ======================================================

const normalizeHeader = (
  value
) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};


const getSpreadsheetValue = (
  row,
  aliases
) => {
  const entries =
    Object.entries(row);

  for (
    const [key, value]
    of entries
  ) {
    const normalized =
      normalizeHeader(key);

    if (
      aliases.includes(
        normalized
      )
    ) {
      return String(
        value ?? ""
      ).trim();
    }
  }

  return "";
};


const mapRecipientRow = (
  row,
  rowNumber,
  campaign,
  userId
) => {
  const recipient = {
    campaign:
      campaign._id,

    organization:
      campaign.organization,

    importedBy:
      userId,

    rowNumber,

    employeeId:
      getSpreadsheetValue(
        row,
        [
          "employeeid",
          "empid",
          "reference",
          "recipientid",
          "code",
        ]
      ),

    name:
      getSpreadsheetValue(
        row,
        [
          "name",
          "recipientname",
          "fullname",
          "employeename",
        ]
      ),

    email:
      getSpreadsheetValue(
        row,
        [
          "email",
          "emailaddress",
        ]
      ),

    phone:
      getSpreadsheetValue(
        row,
        [
          "phone",
          "mobile",
          "mobilenumber",
          "phonenumber",
          "contact",
        ]
      ),

    address: {
      addressLine1:
        getSpreadsheetValue(
          row,
          [
            "address",
            "address1",
            "addressline1",
            "street",
          ]
        ),

      addressLine2:
        getSpreadsheetValue(
          row,
          [
            "address2",
            "addressline2",
            "landmark",
          ]
        ),

      city:
        getSpreadsheetValue(
          row,
          [
            "city",
            "town",
          ]
        ),

      state:
        getSpreadsheetValue(
          row,
          [
            "state",
            "province",
          ]
        ),

      pincode:
        getSpreadsheetValue(
          row,
          [
            "pincode",
            "pin",
            "postalcode",
            "zipcode",
            "zip",
          ]
        ),

      country:
        getSpreadsheetValue(
          row,
          [
            "country",
          ]
        ) || "India",
    },

    giftMessage:
      getSpreadsheetValue(
        row,
        [
          "giftmessage",
          "message",
        ]
      ),

    personalizationText:
      getSpreadsheetValue(
        row,
        [
          "personalization",
          "personalisation",
          "personalizationtext",
          "nametoprint",
        ]
      ),

    dietaryPreference:
      getSpreadsheetValue(
        row,
        [
          "dietary",
          "dietarypreference",
          "diet",
        ]
      ),

    deliveryNotes:
      getSpreadsheetValue(
        row,
        [
          "deliverynotes",
          "notes",
          "instruction",
          "instructions",
        ]
      ),

    validationErrors: [],
  };


  if (!recipient.name) {
    recipient.validationErrors.push(
      "Recipient name is required."
    );
  }


  if (!recipient.phone) {
    recipient.validationErrors.push(
      "Phone number is required."
    );
  }


  if (
    !recipient.address.addressLine1
  ) {
    recipient.validationErrors.push(
      "Address is required."
    );
  }


  if (!recipient.address.city) {
    recipient.validationErrors.push(
      "City is required."
    );
  }


  if (!recipient.address.state) {
    recipient.validationErrors.push(
      "State is required."
    );
  }


  if (
    !recipient.address.pincode
  ) {
    recipient.validationErrors.push(
      "Pincode is required."
    );
  }


  if (
    recipient.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      recipient.email
    )
  ) {
    recipient.validationErrors.push(
      "Email address is invalid."
    );
  }


  const digits =
    recipient.phone.replace(
      /\D/g,
      ""
    );

  if (
    recipient.phone &&
    digits.length < 8
  ) {
    recipient.validationErrors.push(
      "Phone number appears invalid."
    );
  }


  recipient.status =
    recipient.validationErrors
      .length > 0
      ? RECIPIENT_STATUS.INVALID
      : RECIPIENT_STATUS.VALID;


  return recipient;
};


const validateRecipientDocument = (
  recipient
) => {
  const errors = [];


  if (!recipient.name?.trim()) {
    errors.push(
      "Recipient name is required."
    );
  }


  if (!recipient.phone?.trim()) {
    errors.push(
      "Phone number is required."
    );
  }


  if (
    !recipient.address
      ?.addressLine1
      ?.trim()
  ) {
    errors.push(
      "Address is required."
    );
  }


  if (
    !recipient.address
      ?.city
      ?.trim()
  ) {
    errors.push(
      "City is required."
    );
  }


  if (
    !recipient.address
      ?.state
      ?.trim()
  ) {
    errors.push(
      "State is required."
    );
  }


  if (
    !recipient.address
      ?.pincode
      ?.trim()
  ) {
    errors.push(
      "Pincode is required."
    );
  }


  if (
    recipient.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      recipient.email
    )
  ) {
    errors.push(
      "Email address is invalid."
    );
  }


  return errors;
};


// ======================================================
// ORGANIZATION
// ======================================================

export const createOrganization =
  asyncHandler(
    async (req, res) => {
      const userId =
        getUserId(req);

      const {
        name,
        legalName,
        gstNumber,
        panNumber,
        primaryContact,
        billing,
      } = req.body;


      if (!name?.trim()) {
        throw createError(
          400,
          "Organization name is required."
        );
      }


      const organization =
        await Organization.create({
          owner: userId,

          name:
            name.trim(),

          legalName:
            legalName?.trim() ||
            "",

          gstNumber:
            gstNumber?.trim() ||
            "",

          panNumber:
            panNumber?.trim() ||
            "",

          primaryContact:
            primaryContact || {},

          billing:
            billing || {},

          members: [
            {
              user: userId,
              role: "owner",
              isActive: true,
            },
          ],

          status:
            ORGANIZATION_STATUS.ACTIVE,

          statusHistory: [
            {
              status:
                ORGANIZATION_STATUS.ACTIVE,

              changedBy:
                userId,

              note:
                "Organization created.",
            },
          ],
        });


      res.status(201).json({
        success: true,
        message:
          "Organization created successfully.",
        organization,
      });
    }
  );


// ======================================================

export const getMyOrganizations =
  asyncHandler(
    async (req, res) => {
      const userId =
        getUserId(req);


      const organizations =
        await Organization.find({
          $or: [
            {
              owner: userId,
            },

            {
              members: {
                $elemMatch: {
                  user: userId,
                  isActive: true,
                },
              },
            },
          ],
        })
          .sort({
            createdAt: -1,
          })
          .populate(
            "members.user",
            "name email"
          );


      res.json({
        success: true,
        organizations,
      });
    }
  );


// ======================================================

export const getOrganizationById =
  asyncHandler(
    async (req, res) => {
      const organization =
        await getOrganizationOrFail(
          req.params.id
        );


      if (
        !hasOrganizationAccess(
          organization,
          req
        )
      ) {
        throw createError(
          403,
          "You do not have access to this organization."
        );
      }


      await organization.populate(
        "members.user",
        "name email"
      );


      res.json({
        success: true,
        organization,
      });
    }
  );


// ======================================================

export const updateOrganization =
  asyncHandler(
    async (req, res) => {
      const organization =
        await getOrganizationOrFail(
          req.params.id
        );


      if (
        !canManageOrganization(
          organization,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot update this organization."
        );
      }


      const allowedFields = [
        "name",
        "legalName",
        "gstNumber",
        "panNumber",
        "primaryContact",
        "billing",
      ];


      for (
        const field of allowedFields
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          organization[field] =
            req.body[field];
        }
      }


      await organization.save();


      res.json({
        success: true,
        message:
          "Organization updated successfully.",
        organization,
      });
    }
  );


// ======================================================

export const addOrganizationMember =
  asyncHandler(
    async (req, res) => {
      const organization =
        await getOrganizationOrFail(
          req.params.id
        );


      if (
        !canManageOrganization(
          organization,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot manage organization members."
        );
      }


      const {
        userId,
        email,
        role = "viewer",
      } = req.body;


      const allowedRoles = [
        "corporate_admin",
        "requester",
        "approver",
        "procurement_finance",
        "viewer",
      ];


      if (
        !allowedRoles.includes(
          role
        )
      ) {
        throw createError(
          400,
          "Invalid corporate member role."
        );
      }


      let user;


      if (
        userId &&
        mongoose.isValidObjectId(
          userId
        )
      ) {
        user =
          await User.findById(
            userId
          );
      } else if (email) {
        user =
          await User.findOne({
            email:
              String(email)
                .trim()
                .toLowerCase(),
          });
      }


      if (!user) {
        throw createError(
          404,
          "User not found. The user must have a HAMPORIUM account first."
        );
      }


      if (
        sameId(
          user._id,
          organization.owner
        )
      ) {
        throw createError(
          400,
          "Organization owner is already a member."
        );
      }


      const existing =
        organization.members.find(
          (member) =>
            sameId(
              member.user,
              user._id
            )
        );


      if (existing) {
        existing.role = role;
        existing.isActive = true;
      } else {
        organization.members.push({
          user: user._id,
          role,
          isActive: true,
        });
      }


      await organization.save();


      await organization.populate(
        "members.user",
        "name email"
      );


      res.json({
        success: true,
        message:
          "Organization member saved successfully.",
        organization,
      });
    }
  );


// ======================================================

export const removeOrganizationMember =
  asyncHandler(
    async (req, res) => {
      const organization =
        await getOrganizationOrFail(
          req.params.id
        );


      if (
        !canManageOrganization(
          organization,
          req
        )
      ) {
        throw createError(
          403,
          "You cannot manage organization members."
        );
      }


      const member =
        organization.members.find(
          (item) =>
            sameId(
              item.user,
              req.params.userId
            )
        );


      if (!member) {
        throw createError(
          404,
          "Organization member not found."
        );
      }


      member.isActive = false;


      await organization.save();


      res.json({
        success: true,
        message:
          "Organization member removed.",
      });
    }
  );


// ======================================================
// CAMPAIGN CREATE
// ======================================================

export const createCampaign =
  asyncHandler(
    async (req, res) => {
      const {
        organizationId,
        campaignType = "corporate",
        title,
        objective,
        occasion,
        recipientType,
        description,
        quantity,
        budgetPerGift,
        totalBudget,
        currency,
        deliveryCities,
        addressModel,
        requiredDeliveryDate,
        productInterest,
        contact,
        branding,
        packagingRequirements,
        dietaryRequirements,
        personalizationRequirements,
        notes,
      } = req.body;


      if (!organizationId) {
        throw createError(
          400,
          "organizationId is required."
        );
      }


      const organization =
        await getOrganizationOrFail(
          organizationId
        );


      if (
        !hasOrganizationAccess(
          organization,
          req
        )
      ) {
        throw createError(
          403,
          "You do not have access to this organization."
        );
      }


      if (
        ![
          "corporate",
          "diwali_bulk",
        ].includes(
          campaignType
        )
      ) {
        throw createError(
          400,
          "campaignType must be corporate or diwali_bulk."
        );
      }


      if (!title?.trim()) {
        throw createError(
          400,
          "Campaign title is required."
        );
      }


      if (
        Number(quantity) < 1
      ) {
        throw createError(
          400,
          "Campaign quantity must be at least 1."
        );
      }


      const campaign =
        await Campaign.create({
          organization:
            organization._id,

          createdBy:
            getUserId(req),

          campaignType,

          title:
            title.trim(),

          objective,

          occasion,

          recipientType,

          description,

          quantity:
            Number(quantity),

          budgetPerGift:
            Number(
              budgetPerGift || 0
            ),

          totalBudget:
            Number(
              totalBudget || 0
            ),

          currency:
            currency || "INR",

          deliveryCities:
            Array.isArray(
              deliveryCities
            )
              ? deliveryCities
              : [],

          addressModel:
            addressModel ||
            "not_decided",

          requiredDeliveryDate:
            requiredDeliveryDate ||
            null,

          productInterest:
            Array.isArray(
              productInterest
            )
              ? productInterest
              : [],

          contact: {
            name:
              contact?.name ||
              organization
                .primaryContact
                ?.name ||
              "",

            email:
              contact?.email ||
              organization
                .primaryContact
                ?.email ||
              "",

            phone:
              contact?.phone ||
              organization
                .primaryContact
                ?.phone ||
              "",
          },

          branding:
            branding || {},

          packagingRequirements,

          dietaryRequirements:
            Array.isArray(
              dietaryRequirements
            )
              ? dietaryRequirements
              : [],

          personalizationRequirements,

          notes,

          workflowStatus:
            CORPORATE_CAMPAIGN_STATUS.DRAFT,

          nextAction:
            "Complete and submit RFQ",

          statusHistory: [
            {
              status:
                CORPORATE_CAMPAIGN_STATUS.DRAFT,

              changedBy:
                getUserId(req),

              note:
                "Corporate campaign created.",
            },
          ],
        });


      res.status(201).json({
        success: true,
        message:
          "Campaign created successfully.",
        campaign,
      });
    }
  );


// ======================================================
// CREATE CAMPAIGN FROM EXISTING PHASE 5 RFQ
// ======================================================

export const createCampaignFromRFQ =
  asyncHandler(
    async (req, res) => {
      const { rfqId } =
        req.params;


      if (
        !mongoose.isValidObjectId(
          rfqId
        )
      ) {
        throw createError(
          400,
          "Invalid RFQ ID."
        );
      }


      const rfq =
        await RFQ.findById(
          rfqId
        );


      if (!rfq) {
        throw createError(
          404,
          "RFQ not found."
        );
      }


      if (
        !isInternalUser(req) &&
        !sameId(
          rfq.requester,
          getUserId(req)
        )
      ) {
        throw createError(
          403,
          "You do not have access to this RFQ."
        );
      }


      const existing =
        await Campaign.findOne({
          rfq: rfq._id,
        });


      if (existing) {
        return res.json({
          success: true,
          message:
            "Campaign already exists for this RFQ.",
          campaign: existing,
        });
      }


      let organization;


     const organizationId =
  req.body?.organizationId;


if (organizationId) {
  organization =
    await getOrganizationOrFail(
      organizationId
    );


  if (
    !isInternalUser(req) &&
    !hasOrganizationAccess(
      organization,
      req
    )
  ) {
    throw createError(
      403,
      "You do not have access to this organization."
    );
  }
} else {
  organization =
    await Organization.findOne({
      owner: rfq.requester,

      name:
        rfq.companyName ||
        "Corporate Organization",
    });


  if (!organization) {
    organization =
      await Organization.create({
        owner:
          rfq.requester,

        name:
          rfq.companyName ||
          "Corporate Organization",

        gstNumber:
          rfq.gstNumber ||
          "",

        primaryContact: {
          name:
            rfq.contactName ||
            "",

          email:
            rfq.contactEmail ||
            "",

          phone:
            rfq.contactPhone ||
            "",
        },

        members: [
          {
            user:
              rfq.requester,

            role:
              "owner",

            isActive:
              true,
          },
        ],

        status:
          ORGANIZATION_STATUS.ACTIVE,

        statusHistory: [
          {
            status:
              ORGANIZATION_STATUS.ACTIVE,

            changedBy:
              getUserId(req),

            note:
              "Organization created from existing RFQ.",
          },
        ],
      });
  }
}
      const campaign =
        await Campaign.create({
          organization:
            organization._id,

          createdBy:
            rfq.requester,

          rfq:
            rfq._id,

          campaignType:
            rfq.sourceType ===
            "diwali_bulk"
              ? "diwali_bulk"
              : "corporate",

          title:
            rfq.title,

          objective:
            rfq.objective,

          occasion:
            rfq.occasion,

          recipientType:
            rfq.recipientType,

          description:
            rfq.description,

          quantity:
            rfq.quantity,

          budgetPerGift:
            rfq.budgetPerGift ||
            0,

          totalBudget:
            rfq.totalBudget ||
            0,

          currency:
            rfq.currency ||
            "INR",

          deliveryCities:
            rfq.deliveryLocations ||
            [],

          addressModel:
            rfq.addressModel ||
            "not_decided",

          requiredDeliveryDate:
            rfq.requiredDeliveryDate,

          productInterest:
            rfq.productInterest ||
            [],

          contact: {
            name:
              rfq.contactName,

            email:
              rfq.contactEmail,

            phone:
              rfq.contactPhone,
          },

          branding:
            rfq.branding || {},

          packagingRequirements:
            rfq.packagingRequirements,

          dietaryRequirements:
            rfq.dietaryRequirements ||
            [],

          personalizationRequirements:
            rfq.personalizationRequirements,

          notes:
            rfq.notes,

          documents:
            rfq.documents || [],

          workflowStatus:
            CORPORATE_CAMPAIGN_STATUS.RFQ_SUBMITTED,

          statusHistory: [
            {
              status:
                CORPORATE_CAMPAIGN_STATUS.RFQ_SUBMITTED,

              changedBy:
                getUserId(req),

              note:
                "Campaign created from existing RFQ.",
            },
          ],
        });


      await syncCampaignWorkflow(
        campaign,
        getUserId(req)
      );


      res.status(201).json({
        success: true,
        message:
          "Corporate campaign created from RFQ.",
        campaign,
        organization,
      });
    }
  );


// ======================================================
// UPDATE DRAFT CAMPAIGN
// ======================================================

export const updateCampaign =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      await requireCampaignAccess(
        campaign,
        req
      );


      if (campaign.rfq) {
        throw createError(
          400,
          "Campaign requirement cannot be edited here after RFQ submission. Use the shared RFQ workflow."
        );
      }


      if (
        campaign.workflowStatus !==
        CORPORATE_CAMPAIGN_STATUS.DRAFT
      ) {
        throw createError(
          400,
          "Only draft campaigns can be edited."
        );
      }


      const allowed = [
        "campaignType",
        "title",
        "objective",
        "occasion",
        "recipientType",
        "description",
        "quantity",
        "budgetPerGift",
        "totalBudget",
        "currency",
        "deliveryCities",
        "addressModel",
        "requiredDeliveryDate",
        "productInterest",
        "contact",
        "branding",
        "packagingRequirements",
        "dietaryRequirements",
        "personalizationRequirements",
        "notes",
      ];


      for (
        const field of allowed
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          campaign[field] =
            req.body[field];
        }
      }


      await campaign.save();


      res.json({
        success: true,
        message:
          "Campaign updated successfully.",
        campaign,
      });
    }
  );


// ======================================================
// CAMPAIGN -> SHARED RFQ
// ======================================================

export const submitCampaignRFQ =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      const organization =
        await requireCampaignAccess(
          campaign,
          req
        );


      if (campaign.rfq) {
        throw createError(
          400,
          "RFQ has already been created for this campaign."
        );
      }


      if (
        campaign.workflowStatus !==
        CORPORATE_CAMPAIGN_STATUS.DRAFT
      ) {
        throw createError(
          400,
          "Only a draft campaign can be submitted."
        );
      }


      if (
        !campaign.contact
          ?.name ||
        !campaign.contact
          ?.email
      ) {
        throw createError(
          400,
          "Campaign contact name and email are required."
        );
      }


      if (
        !campaign.title ||
        Number(
          campaign.quantity
        ) < 1
      ) {
        throw createError(
          400,
          "Campaign title and quantity are required."
        );
      }


      const userId =
        getUserId(req);


      const rfq =
        await RFQ.create({
          requester:
            userId,

          sourceType:
            campaign.campaignType ===
            "diwali_bulk"
              ? "diwali_bulk"
              : "corporate",

          companyName:
            organization.name,

          gstNumber:
            organization.gstNumber ||
            "",

          contactName:
            campaign.contact.name,

          contactEmail:
            campaign.contact.email,

          contactPhone:
            campaign.contact.phone ||
            "",

          title:
            campaign.title,

          objective:
            campaign.objective,

          occasion:
            campaign.occasion,

          recipientType:
            campaign.recipientType,

          description:
            campaign.description,

          quantity:
            campaign.quantity,

          budgetPerGift:
            campaign.budgetPerGift,

          totalBudget:
            campaign.totalBudget,

          currency:
            campaign.currency,

          deliveryLocations:
            campaign.deliveryCities,

          addressModel:
            campaign.addressModel,

          requiredDeliveryDate:
            campaign.requiredDeliveryDate,

          productInterest:
            campaign.productInterest,

          branding:
            campaign.branding,

          packagingRequirements:
            campaign.packagingRequirements,

          dietaryRequirements:
            campaign.dietaryRequirements,

          personalizationRequirements:
            campaign.personalizationRequirements,

          notes:
            campaign.notes,

          documents:
            campaign.documents,

          status:
            RFQ_STATUS.SUBMITTED,

          submittedAt:
            new Date(),

          nextAction:
            "Admin review",

          statusHistory: [
            {
              status:
                RFQ_STATUS.SUBMITTED,

              changedBy:
                userId,

              note:
                `Submitted from corporate campaign ${campaign.campaignId}.`,
            },
          ],
        });


      campaign.rfq =
        rfq._id;

      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.RFQ_SUBMITTED,
        userId,
        `RFQ ${rfq.rfqId} submitted.`
      );

      campaign.nextAction =
        "HAMPORIUM review and quotation";


      await campaign.save();


      res.status(201).json({
        success: true,
        message:
          "Campaign RFQ submitted successfully.",
        campaign,
        rfq,
      });
    }
  );


// ======================================================
// MY CAMPAIGNS
// ======================================================

export const getMyCampaigns =
  asyncHandler(
    async (req, res) => {
      const userId =
        getUserId(req);


      const organizations =
        await Organization.find({
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
        }).select("_id");


      const organizationIds =
        organizations.map(
          (organization) =>
            organization._id
        );


      const campaigns =
        await Campaign.find({
          $or: [
            {
              organization: {
                $in:
                  organizationIds,
              },
            },

            {
              createdBy:
                userId,
            },
          ],
        })
          .sort({
            createdAt: -1,
          })
          .populate(
            "organization",
            "organizationId name"
          )
          .populate(
            "rfq",
            "rfqId status title"
          );


      res.json({
        success: true,
        campaigns,
      });
    }
  );


// ======================================================
// ADMIN CAMPAIGNS
// ======================================================

export const getAllCampaigns =
  asyncHandler(
    async (req, res) => {
      const {
        workflowStatus,
        campaignType,
        priority,
        page = 1,
        limit = 25,
      } = req.query;


      const query = {};


      if (workflowStatus) {
        query.workflowStatus =
          workflowStatus;
      }


      if (campaignType) {
        query.campaignType =
          campaignType;
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
        campaigns,
        total,
      ] = await Promise.all([
        Campaign.find(query)
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
            "organization",
            "organizationId name gstNumber"
          )
          .populate(
            "createdBy",
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

        Campaign.countDocuments(
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

        campaigns,
      });
    }
  );


// ======================================================
// CAMPAIGN DETAIL
// ======================================================

export const getCampaignById =
  asyncHandler(
    async (req, res) => {
      let campaign =
        await getCampaignOrFail(
          req.params.id
        );


      await requireCampaignAccess(
        campaign,
        req
      );


      await syncCampaignWorkflow(
        campaign,
        getUserId(req)
      );


      campaign =
        await Campaign.findById(
          campaign._id
        )
          .populate(
            "organization",
            "organizationId name legalName gstNumber primaryContact billing"
          )
          .populate(
            "createdBy",
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
            "po.document"
          )
          .populate(
            "recipientFile"
          )
          .populate(
            "paymentInfo.payment"
          );


      const [
        quote,
        approvals,
        documents,
      ] = await Promise.all([
        campaign.rfq
          ? Quote.findOne({
              rfq:
                campaign.rfq._id,
            })
          : null,

        campaign.rfq
          ? Approval.find({
              rfq:
                campaign.rfq._id,
            })
              .sort({
                createdAt: -1,
              })
              .populate(
                "document"
              )
          : [],

        campaign.rfq
          ? Document.find({
              entityType:
                "rfq",

              entityId:
                campaign.rfq._id,
            }).sort({
              createdAt: -1,
            })
          : [],
      ]);


      res.json({
        success: true,
        campaign,
        quote,
        approvals,
        documents,
      });
    }
  );


// ======================================================
// SET PO / PAYMENT ROUTE
// ======================================================

export const setCommercialRoute =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      await requireCampaignAccess(
        campaign,
        req
      );


      const { route } =
        req.body;


      if (
        ![
          "po",
          "payment",
        ].includes(route)
      ) {
        throw createError(
          400,
          "route must be po or payment."
        );
      }


      if (!campaign.rfq) {
        throw createError(
          400,
          "Campaign does not have an RFQ."
        );
      }


      const rfq =
        await RFQ.findById(
          campaign.rfq
        );


      if (
        rfq?.status !==
        RFQ_STATUS.APPROVED
      ) {
        throw createError(
          400,
          "Proof / customer approval must be completed before selecting PO or payment."
        );
      }


      campaign.commercialRoute =
        route;


      if (route === "po") {
        campaign.po.status =
          CORPORATE_PO_STATUS.PENDING;

        campaign.paymentInfo.status =
          CORPORATE_PAYMENT_STATUS.NOT_REQUIRED;
      } else {
        campaign.paymentInfo.status =
          CORPORATE_PAYMENT_STATUS.PENDING;

        campaign.po.status =
          CORPORATE_PO_STATUS.NOT_REQUIRED;
      }


      await campaign.save();


      await syncCampaignWorkflow(
        campaign,
        getUserId(req)
      );


      res.json({
        success: true,
        message:
          `Commercial route set to ${route}.`,
        campaign,
      });
    }
  );


// ======================================================
// LINK EXISTING DOCUMENT AS PO
//
// Upload PO first using existing document engine:
//
// POST /api/documents
// entityType = rfq
// entityId = campaign.rfq
// documentType = po
//
// Then call this endpoint.
// ======================================================

export const linkPODocument =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      await requireCampaignAccess(
        campaign,
        req
      );


      if (
        campaign.commercialRoute !==
        "po"
      ) {
        throw createError(
          400,
          "Campaign commercial route is not PO."
        );
      }


      const {
        documentId,
        referenceNumber,
        note,
      } = req.body;


      if (
        !documentId ||
        !mongoose.isValidObjectId(
          documentId
        )
      ) {
        throw createError(
          400,
          "Valid documentId is required."
        );
      }


      const document =
        await Document.findById(
          documentId
        );


      if (!document) {
        throw createError(
          404,
          "PO document not found."
        );
      }


      if (
        document.documentType !==
        "po"
      ) {
        throw createError(
          400,
          "Selected document is not a PO document."
        );
      }


      if (
        document.entityType !==
          "rfq" ||
        !sameId(
          document.entityId,
          campaign.rfq
        )
      ) {
        throw createError(
          400,
          "PO document does not belong to this campaign RFQ."
        );
      }


      campaign.po.document =
        document._id;

      campaign.po.referenceNumber =
        referenceNumber || "";

      campaign.po.note =
        note || "";

      campaign.po.status =
        CORPORATE_PO_STATUS.SUBMITTED;

      campaign.po.submittedAt =
        new Date();


      campaign.documents.addToSet(
        document._id
      );


      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.PO_PENDING,
        getUserId(req),
        "Purchase order submitted for verification."
      );


      campaign.nextAction =
        "Admin verify PO";


      await campaign.save();


      res.json({
        success: true,
        message:
          "PO submitted successfully.",
        campaign,
      });
    }
  );


// ======================================================
// ADMIN VERIFY PO
// ======================================================

export const verifyPO =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      const {
        approved,
        note,
      } = req.body;


      if (
        campaign.commercialRoute !==
        "po"
      ) {
        throw createError(
          400,
          "Campaign is not using PO."
        );
      }


      if (
        campaign.po.status !==
          CORPORATE_PO_STATUS.SUBMITTED &&
        campaign.po.status !==
          CORPORATE_PO_STATUS.REJECTED
      ) {
        throw createError(
          400,
          "No submitted PO is awaiting verification."
        );
      }


      campaign.po.status =
        approved
          ? CORPORATE_PO_STATUS.VERIFIED
          : CORPORATE_PO_STATUS.REJECTED;


      campaign.po.note =
        note || "";

      campaign.po.verifiedBy =
        getUserId(req);

      campaign.po.verifiedAt =
        new Date();


      if (approved) {
        campaign.nextAction =
          "Recipient spreadsheet";
      } else {
        campaign.nextAction =
          "Customer submit corrected PO";
      }


      await campaign.save();


      await syncCampaignWorkflow(
        campaign,
        getUserId(req)
      );


      res.json({
        success: true,

        message: approved
          ? "PO verified successfully."
          : "PO rejected.",

        campaign,
      });
    }
  );


// ======================================================
// ADMIN LINK EXISTING SHARED PAYMENT
// ======================================================

export const linkPayment =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      const {
        paymentId,
      } = req.body;


      if (
        !paymentId ||
        !mongoose.isValidObjectId(
          paymentId
        )
      ) {
        throw createError(
          400,
          "Valid paymentId is required."
        );
      }


      const payment =
        await Payment.findById(
          paymentId
        );


      if (!payment) {
        throw createError(
          404,
          "Payment not found."
        );
      }


      campaign.commercialRoute =
        "payment";

      campaign.po.status =
        CORPORATE_PO_STATUS.NOT_REQUIRED;

      campaign.paymentInfo.payment =
        payment._id;

      campaign.paymentInfo.status =
        normalizePaymentStatus(
          payment
        );

      campaign.paymentInfo.linkedAt =
        new Date();

      campaign.paymentInfo.syncedAt =
        new Date();


      await campaign.save();


      await syncCampaignWorkflow(
        campaign,
        getUserId(req)
      );


      res.json({
        success: true,
        message:
          "Shared payment linked successfully.",
        campaign,
        payment,
      });
    }
  );


// ======================================================
// SYNC EXISTING PAYMENT STATUS
// ======================================================

export const syncPayment =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      await requireCampaignAccess(
        campaign,
        req
      );


      if (
        !campaign.paymentInfo
          ?.payment
      ) {
        throw createError(
          400,
          "No payment is linked to this campaign."
        );
      }


      const payment =
        await Payment.findById(
          campaign.paymentInfo
            .payment
        );


      if (!payment) {
        throw createError(
          404,
          "Linked payment no longer exists."
        );
      }


      campaign.paymentInfo.status =
        normalizePaymentStatus(
          payment
        );

      campaign.paymentInfo.syncedAt =
        new Date();


      await campaign.save();


      await syncCampaignWorkflow(
        campaign,
        getUserId(req)
      );


      res.json({
        success: true,
        campaign,
        payment,
      });
    }
  );


// ======================================================
// RECIPIENT IMPORT
//
// Multipart:
// file = xlsx/xls/csv
// documentId = optional existing private Document
// replaceExisting = true / false
//
// Recommended:
// upload same spreadsheet to shared /documents as recipient_file
// and send returned documentId here.
// ======================================================

export const importRecipients =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      await requireCampaignAccess(
        campaign,
        req
      );


      if (!req.file) {
        throw createError(
          400,
          "Recipient spreadsheet is required."
        );
      }


      if (!campaign.rfq) {
        throw createError(
          400,
          "Campaign RFQ must exist before recipient import."
        );
      }


      const replaceExisting =
        String(
          req.body
            ?.replaceExisting ||
            ""
        ).toLowerCase() ===
        "true";


      const existingCount =
        await Recipient.countDocuments({
          campaign:
            campaign._id,
        });


      if (
        existingCount > 0 &&
        !replaceExisting
      ) {
        throw createError(
          409,
          "Recipients already exist. Send replaceExisting=true to replace the existing import."
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
          "Unable to read recipient spreadsheet."
        );
      }


      const firstSheetName =
        workbook.SheetNames?.[0];


      if (!firstSheetName) {
        throw createError(
          400,
          "Spreadsheet does not contain a worksheet."
        );
      }


      const worksheet =
        workbook.Sheets[
          firstSheetName
        ];


      const rows =
        XLSX.utils.sheet_to_json(
          worksheet,
          {
            defval: "",
            raw: false,
          }
        );


      if (rows.length === 0) {
        throw createError(
          400,
          "Recipient spreadsheet contains no data rows."
        );
      }


      if (
        rows.length > 10000
      ) {
        throw createError(
          400,
          "Maximum 10,000 recipient rows are allowed per import."
        );
      }


      if (replaceExisting) {
        await Recipient.deleteMany({
          campaign:
            campaign._id,
        });
      }


      const userId =
        getUserId(req);


      const recipientRows =
        rows.map(
          (row, index) =>
            mapRecipientRow(
              row,
              index + 2,
              campaign,
              userId
            )
        );


      await Recipient.insertMany(
        recipientRows
      );


      const summary =
        await calculateRecipientSummary(
          campaign._id
        );


      campaign.recipientSummary =
        summary;


      campaign.recipientImportStatus =
        summary.invalid > 0
          ? RECIPIENT_IMPORT_STATUS.NEEDS_REVIEW
          : RECIPIENT_IMPORT_STATUS.UPLOADED;


      if (
        req.body?.documentId &&
        mongoose.isValidObjectId(
          req.body.documentId
        )
      ) {
        const document =
          await Document.findById(
            req.body.documentId
          );


        if (
          document &&
          document.documentType ===
            "recipient_file" &&
          document.entityType ===
            "rfq" &&
          sameId(
            document.entityId,
            campaign.rfq
          )
        ) {
          campaign.recipientFile =
            document._id;

          campaign.documents.addToSet(
            document._id
          );
        }
      }


      pushCampaignStatus(
        campaign,
        summary.invalid > 0
          ? CORPORATE_CAMPAIGN_STATUS.RECIPIENTS_REVIEW
          : CORPORATE_CAMPAIGN_STATUS.RECIPIENTS_REVIEW,
        userId,
        `${summary.total} recipient rows imported.`
      );


      campaign.nextAction =
        summary.invalid > 0
          ? "Correct invalid recipient rows"
          : "Admin verify recipient data";


      await campaign.save();


      res.status(201).json({
        success: true,

        message:
          "Recipient spreadsheet imported successfully.",

        summary,

        recipientImportStatus:
          campaign.recipientImportStatus,
      });
    }
  );


// ======================================================
// GET RECIPIENTS
// ======================================================

export const getRecipients =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      await requireCampaignAccess(
        campaign,
        req
      );


      const {
        status,
        page = 1,
        limit = 50,
      } = req.query;


      const query = {
        campaign:
          campaign._id,
      };


      if (status) {
        query.status =
          status;
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
        recipients,
        total,
      ] = await Promise.all([
        Recipient.find(query)
          .sort({
            rowNumber: 1,
          })
          .skip(
            (safePage - 1) *
              safeLimit
          )
          .limit(
            safeLimit
          ),

        Recipient.countDocuments(
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

        summary:
          campaign.recipientSummary,

        recipients,
      });
    }
  );


// ======================================================
// UPDATE ONE RECIPIENT
// ======================================================

export const updateRecipient =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      await requireCampaignAccess(
        campaign,
        req
      );


      const recipient =
        await Recipient.findOne({
          _id:
            req.params
              .recipientId,

          campaign:
            campaign._id,
        });


      if (!recipient) {
        throw createError(
          404,
          "Recipient not found."
        );
      }


      const allowed = [
        "employeeId",
        "name",
        "email",
        "phone",
        "address",
        "giftMessage",
        "personalizationText",
        "dietaryPreference",
        "deliveryNotes",
      ];


      for (
        const field of allowed
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          recipient[field] =
            req.body[field];
        }
      }


      recipient.validationErrors =
        validateRecipientDocument(
          recipient
        );


      recipient.status =
        recipient.validationErrors
          .length > 0
          ? RECIPIENT_STATUS.INVALID
          : RECIPIENT_STATUS.VALID;


      recipient.reviewedAt = null;
      recipient.reviewedBy = null;


      await recipient.save();


      campaign.recipientSummary =
        await calculateRecipientSummary(
          campaign._id
        );


      campaign.recipientImportStatus =
        campaign
          .recipientSummary
          .invalid > 0
          ? RECIPIENT_IMPORT_STATUS.NEEDS_REVIEW
          : RECIPIENT_IMPORT_STATUS.UPLOADED;


      await campaign.save();


      res.json({
        success: true,
        message:
          "Recipient updated successfully.",
        recipient,
        summary:
          campaign.recipientSummary,
      });
    }
  );


// ======================================================
// ADMIN APPROVE RECIPIENT IMPORT
// ======================================================

export const reviewRecipients =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      const summary =
        await calculateRecipientSummary(
          campaign._id
        );


      if (
        summary.total === 0
      ) {
        throw createError(
          400,
          "No recipients have been imported."
        );
      }


      if (
        summary.invalid > 0
      ) {
        throw createError(
          400,
          `${summary.invalid} recipient rows still contain validation errors.`
        );
      }


      await Recipient.updateMany(
        {
          campaign:
            campaign._id,

          status:
            RECIPIENT_STATUS.VALID,
        },

        {
          $set: {
            status:
              RECIPIENT_STATUS.APPROVED,

            reviewedBy:
              getUserId(req),

            reviewedAt:
              new Date(),
          },
        }
      );


      campaign.recipientImportStatus =
        RECIPIENT_IMPORT_STATUS.APPROVED;


      campaign.recipientSummary =
        await calculateRecipientSummary(
          campaign._id
        );


      await campaign.save();


      await syncCampaignWorkflow(
        campaign,
        getUserId(req)
      );


      res.json({
        success: true,
        message:
          "Recipient data approved successfully.",
        campaign,
        summary:
          campaign.recipientSummary,
      });
    }
  );


// ======================================================
// ADMIN CAMPAIGN OPERATIONS
// ======================================================

export const updateCampaignAdmin =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await Campaign.findById(
          req.params.id
        ).select(
          "+internalNotes"
        );


      if (!campaign) {
        throw createError(
          404,
          "Campaign not found."
        );
      }


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
          req.body[field] !==
          undefined
        ) {
          campaign[field] =
            req.body[field];
        }
      }


      await campaign.save();


      res.json({
        success: true,
        message:
          "Campaign operations updated.",
        campaign,
      });
    }
  );


// ======================================================
// MANUAL WORKFLOW SYNC
// ======================================================

export const syncCampaign =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      await requireCampaignAccess(
        campaign,
        req
      );


      await syncCampaignWorkflow(
        campaign,
        getUserId(req)
      );


      res.json({
        success: true,
        message:
          "Campaign status synchronized.",
        campaign,
      });
    }
  );


// ======================================================
// CANCEL CAMPAIGN
// ======================================================

export const cancelCampaign =
  asyncHandler(
    async (req, res) => {
      const campaign =
        await getCampaignOrFail(
          req.params.id
        );


      await requireCampaignAccess(
        campaign,
        req
      );


      if (
        campaign.workflowStatus ===
        CORPORATE_CAMPAIGN_STATUS.READY_FOR_PRODUCTION
      ) {
        throw createError(
          400,
          "Production-ready campaign cannot be cancelled from the customer workflow."
        );
      }


      campaign.cancelledAt =
        new Date();


      pushCampaignStatus(
        campaign,
        CORPORATE_CAMPAIGN_STATUS.CANCELLED,
        getUserId(req),
        req.body?.reason ||
          "Campaign cancelled."
      );


      campaign.nextAction =
        "Cancelled";


      await campaign.save();


      res.json({
        success: true,
        message:
          "Campaign cancelled successfully.",
        campaign,
      });
    }
  );