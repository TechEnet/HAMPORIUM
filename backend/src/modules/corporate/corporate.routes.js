import express from "express";
import multer from "multer";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";

import {
  createOrganization,
  getMyOrganizations,
  getOrganizationById,
  updateOrganization,
  addOrganizationMember,
  removeOrganizationMember,

  createCampaign,
  createCampaignFromRFQ,
  updateCampaign,
  submitCampaignRFQ,

  getMyCampaigns,
  getAllCampaigns,
  getCampaignById,

  setCommercialRoute,

  linkPODocument,
  verifyPO,

  linkPayment,
  syncPayment,

  importRecipients,
  getRecipients,
  updateRecipient,
  reviewRecipients,

  updateCampaignAdmin,
  syncCampaign,
  cancelCampaign,
} from "./corporate.controller.js";


const router = express.Router();


// ======================================================
// RECIPIENT FILE UPLOAD
// Parsing only.
// Private original file should also use existing
// /documents shared module.
// ======================================================

const allowedRecipientFileTypes =
  new Set([
    "text/csv",

    "application/vnd.ms-excel",

    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    "application/octet-stream",
  ]);


const recipientUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        10 * 1024 * 1024,
    },

    fileFilter: (
      req,
      file,
      cb
    ) => {
      const fileName =
        String(
          file.originalname ||
            ""
        ).toLowerCase();


      const validExtension =
        fileName.endsWith(
          ".csv"
        ) ||
        fileName.endsWith(
          ".xls"
        ) ||
        fileName.endsWith(
          ".xlsx"
        );


      if (
        !allowedRecipientFileTypes.has(
          file.mimetype
        ) &&
        !validExtension
      ) {
        return cb(
          new Error(
            "Only CSV, XLS and XLSX recipient files are allowed."
          )
        );
      }


      cb(null, true);
    },
  });


router.use(protect);


// ======================================================
// ORGANIZATIONS
// ======================================================

router.post(
  "/organizations",
  createOrganization
);


router.get(
  "/organizations/mine",
  getMyOrganizations
);


router.get(
  "/organizations/:id",
  getOrganizationById
);


router.patch(
  "/organizations/:id",
  updateOrganization
);


router.post(
  "/organizations/:id/members",
  addOrganizationMember
);


router.delete(
  "/organizations/:id/members/:userId",
  removeOrganizationMember
);


// ======================================================
// CAMPAIGN COLLECTION
// ======================================================

router.post(
  "/campaigns",
  createCampaign
);


router.post(
  "/campaigns/from-rfq/:rfqId",
  createCampaignFromRFQ
);


router.get(
  "/campaigns/mine",
  getMyCampaigns
);


// Must remain before /campaigns/:id

router.get(
  "/campaigns/admin/all",
  allowRoles(
    "admin",
    "operations"
  ),
  getAllCampaigns
);


// ======================================================
// CAMPAIGN DETAILS
// ======================================================

router.get(
  "/campaigns/:id",
  getCampaignById
);


router.patch(
  "/campaigns/:id",
  updateCampaign
);


router.post(
  "/campaigns/:id/submit-rfq",
  submitCampaignRFQ
);


router.post(
  "/campaigns/:id/sync",
  syncCampaign
);


router.post(
  "/campaigns/:id/cancel",
  cancelCampaign
);


// ======================================================
// ADMIN CAMPAIGN OPERATIONS
// ======================================================

router.patch(
  "/campaigns/:id/admin",
  allowRoles(
    "admin",
    "operations"
  ),
  updateCampaignAdmin
);


// ======================================================
// PO / PAYMENT
// ======================================================

router.post(
  "/campaigns/:id/commercial-route",
  setCommercialRoute
);


router.post(
  "/campaigns/:id/po",
  linkPODocument
);


router.patch(
  "/campaigns/:id/po/verify",
  allowRoles(
    "admin",
    "operations"
  ),
  verifyPO
);


router.post(
  "/campaigns/:id/payment/link",
  allowRoles(
    "admin",
    "operations"
  ),
  linkPayment
);


router.post(
  "/campaigns/:id/payment/sync",
  syncPayment
);


// ======================================================
// RECIPIENTS
// ======================================================

router.post(
  "/campaigns/:id/recipients/import",
  recipientUpload.single(
    "file"
  ),
  importRecipients
);


router.get(
  "/campaigns/:id/recipients",
  getRecipients
);


router.patch(
  "/campaigns/:id/recipients/:recipientId",
  updateRecipient
);


router.post(
  "/campaigns/:id/recipients/review",
  allowRoles(
    "admin",
    "operations"
  ),
  reviewRecipients
);


export default router;