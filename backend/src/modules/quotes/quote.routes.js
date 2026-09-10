import express from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";

import {
  createQuote,
  createQuoteVersion,
  sendQuote,

  requestQuoteChanges,
  acceptQuote,

  commentOnQuote,
  askForCall,

  getMyQuotes,
  getQuoteByRFQ,
  getQuoteById,
  getAllQuotes,
} from "./quote.controller.js";


const router = express.Router();


router.use(protect);


// ======================================
// ADMIN / OPERATIONS CREATE QUOTE
// ======================================

router.post(
  "/",
  allowRoles(
    "admin",
    "operations"
  ),
  createQuote
);


// ======================================
// CUSTOMER LIST
// ======================================

router.get(
  "/mine",
  getMyQuotes
);


// ======================================
// ADMIN LIST
// IMPORTANT: before /:id
// ======================================

router.get(
  "/admin/all",
  allowRoles(
    "admin",
    "operations"
  ),
  getAllQuotes
);


// ======================================
// GET QUOTE BY RFQ
// ======================================

router.get(
  "/rfq/:rfqId",
  getQuoteByRFQ
);


// ======================================
// ADMIN QUOTE VERSION FLOW
// ======================================

router.post(
  "/:id/versions",
  allowRoles(
    "admin",
    "operations"
  ),
  createQuoteVersion
);


router.post(
  "/:id/send",
  allowRoles(
    "admin",
    "operations"
  ),
  sendQuote
);


// ======================================
// CUSTOMER ACTIONS
// ======================================

router.post(
  "/:id/request-changes",
  requestQuoteChanges
);


router.post(
  "/:id/accept",
  acceptQuote
);


router.post(
  "/:id/comment",
  commentOnQuote
);


router.post(
  "/:id/ask-for-call",
  askForCall
);


// ======================================
// SINGLE QUOTE
// ======================================

router.get(
  "/:id",
  getQuoteById
);


export default router;