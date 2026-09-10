import express from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";

import {
  createApproval,
  getMyApprovals,
  getAllApprovals,
  getApprovalById,

  approve,
  requestChanges,
  comment,
  askForCall,
  cancelApproval,
} from "./approval.controller.js";


const router = express.Router();


router.use(protect);


// ======================================
// ADMIN CREATE APPROVAL
// ======================================

router.post(
  "/",
  allowRoles(
    "admin",
    "operations"
  ),
  createApproval
);


// ======================================
// CUSTOMER
// ======================================

router.get(
  "/mine",
  getMyApprovals
);


// ======================================
// ADMIN
// IMPORTANT: before /:id
// ======================================

router.get(
  "/admin/all",
  allowRoles(
    "admin",
    "operations"
  ),
  getAllApprovals
);


// ======================================
// CUSTOMER DECISION
// ======================================

router.post(
  "/:id/approve",
  approve
);


router.post(
  "/:id/request-changes",
  requestChanges
);


// ======================================
// SHARED COMMUNICATION
// ======================================

router.post(
  "/:id/comment",
  comment
);


router.post(
  "/:id/ask-for-call",
  askForCall
);


// ======================================
// ADMIN CANCEL
// ======================================

router.patch(
  "/:id/cancel",
  allowRoles(
    "admin",
    "operations"
  ),
  cancelApproval
);


// ======================================
// SINGLE APPROVAL
// ======================================

router.get(
  "/:id",
  getApprovalById
);


export default router;