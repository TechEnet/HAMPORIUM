import express from "express";
import multer from "multer";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";

import {
  createWeddingProject,
  updateWeddingProject,
  submitWeddingBrief,

  getMyWeddingProjects,
  getAllWeddingProjects,
  getWeddingProjectById,

  addWeddingMember,
  removeWeddingMember,

  createWeddingEvent,
  updateWeddingEvent,
  deleteWeddingEvent,

  createWeddingConcept,
  createWeddingApproval,

  createPaymentMilestone,
  linkMilestonePayment,
  syncMilestonePayment,
  waivePaymentMilestone,

  importWeddingGuests,
  getWeddingGuests,
  updateWeddingGuest,
  updateGuestAllocation,
  reviewWeddingGuests,
  exportWeddingGuests,

  updateWeddingAdmin,
  syncWeddingProject,
  cancelWeddingProject,
} from "./wedding.controller.js";


const router =
  express.Router();


// ======================================================
// GUEST SPREADSHEET PARSER
// ======================================================

const allowedSpreadsheetTypes =
  new Set([
    "text/csv",

    "application/vnd.ms-excel",

    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    "application/octet-stream",
  ]);


const guestUpload =
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
        !allowedSpreadsheetTypes.has(
          file.mimetype
        ) &&
        !validExtension
      ) {
        return cb(
          new Error(
            "Only CSV, XLS and XLSX guest files are allowed."
          )
        );
      }


      cb(null, true);
    },
  });


router.use(protect);


// ======================================================
// PROJECTS
// ======================================================

router.post(
  "/projects",
  createWeddingProject
);


router.get(
  "/projects/mine",
  getMyWeddingProjects
);


// IMPORTANT:
// must remain before /projects/:id

router.get(
  "/projects/admin/all",
  allowRoles(
    "admin",
    "operations"
  ),
  getAllWeddingProjects
);


router.get(
  "/projects/:id",
  getWeddingProjectById
);


router.patch(
  "/projects/:id",
  updateWeddingProject
);


router.post(
  "/projects/:id/submit",
  submitWeddingBrief
);


router.post(
  "/projects/:id/sync",
  syncWeddingProject
);


router.post(
  "/projects/:id/cancel",
  cancelWeddingProject
);


// ======================================================
// MEMBERS
// ======================================================

router.post(
  "/projects/:id/members",
  addWeddingMember
);


router.delete(
  "/projects/:id/members/:userId",
  removeWeddingMember
);


// ======================================================
// EVENTS
// ======================================================

router.post(
  "/projects/:id/events",
  createWeddingEvent
);


router.patch(
  "/projects/:id/events/:eventId",
  updateWeddingEvent
);


router.delete(
  "/projects/:id/events/:eventId",
  deleteWeddingEvent
);


// ======================================================
// CONCEPT
// ======================================================

router.post(
  "/projects/:id/concepts",
  allowRoles(
    "admin",
    "operations"
  ),
  createWeddingConcept
);


// ======================================================
// SAMPLE / PROOF APPROVAL
// ======================================================

router.post(
  "/projects/:id/approvals",
  allowRoles(
    "admin",
    "operations"
  ),
  createWeddingApproval
);


// ======================================================
// PAYMENT MILESTONES
// ======================================================

router.post(
  "/projects/:id/payment-milestones",
  allowRoles(
    "admin",
    "operations"
  ),
  createPaymentMilestone
);


router.post(
  "/projects/:id/payment-milestones/:milestoneId/link-payment",
  allowRoles(
    "admin",
    "operations"
  ),
  linkMilestonePayment
);


router.post(
  "/projects/:id/payment-milestones/:milestoneId/sync",
  syncMilestonePayment
);


router.patch(
  "/projects/:id/payment-milestones/:milestoneId/waive",
  allowRoles(
    "admin",
    "operations"
  ),
  waivePaymentMilestone
);


// ======================================================
// GUESTS
// ======================================================

router.post(
  "/projects/:id/guests/import",
  guestUpload.single(
    "file"
  ),
  importWeddingGuests
);


router.get(
  "/projects/:id/guests",
  getWeddingGuests
);


router.get(
  "/projects/:id/guests/export",
  exportWeddingGuests
);


router.patch(
  "/projects/:id/guests/:guestId",
  updateWeddingGuest
);


router.patch(
  "/projects/:id/guests/:guestId/allocation",
  allowRoles(
    "admin",
    "operations"
  ),
  updateGuestAllocation
);


router.post(
  "/projects/:id/guests/review",
  allowRoles(
    "admin",
    "operations"
  ),
  reviewWeddingGuests
);


// ======================================================
// ADMIN OPERATIONS
// ======================================================

router.patch(
  "/projects/:id/admin",
  allowRoles(
    "admin",
    "operations"
  ),
  updateWeddingAdmin
);


export default router;