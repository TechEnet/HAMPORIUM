import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { ROLES } from "../../constants/roles.js";

import {
  awardSupplierQuoteAdmin,
  createPurchaseRequestAdmin,
  createSupplierOffer,
  createSupplierPaymentAdmin,
  getMyPurchaseOrders,
  getMyPurchaseRequests,
  getMySupplierInvoices,
  getMySupplierOffers,
  getPurchaseOrdersAdmin,
  getPurchaseRequestsAdmin,
  getSupplierInvoicesAdmin,
  getSupplierOffersAdmin,
  getSupplierPaymentsAdmin,
  getSupplierQuotesAdmin,
  getSupplierSummary,
  postGoodsReceiptAdmin,
  reviewSupplierInvoiceAdmin,
  reviewSupplierOfferAdmin,
  submitSupplierInvoice,
  submitSupplierQuote,
  updateMyPurchaseOrder,
  updateSupplierOffer,
  updateSupplierPaymentAdmin,
} from "./procurement.controller.js";

const router = Router();
const internal = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

router.use(protect);

// Partner supplier workspace
router.get("/partner/summary", getSupplierSummary);
router.get("/partner/offers", getMySupplierOffers);
router.post("/partner/offers", createSupplierOffer);
router.patch("/partner/offers/:id", updateSupplierOffer);
router.get("/partner/requests", getMyPurchaseRequests);
router.post("/partner/requests/:requestId/quote", submitSupplierQuote);
router.get("/partner/orders", getMyPurchaseOrders);
router.patch("/partner/orders/:id", updateMyPurchaseOrder);
router.get("/partner/invoices", getMySupplierInvoices);
router.post("/partner/invoices", submitSupplierInvoice);

// Admin / operations procurement
router.get("/admin/offers", internal, getSupplierOffersAdmin);
router.patch("/admin/offers/:id/review", internal, reviewSupplierOfferAdmin);
router.get("/admin/requests", internal, getPurchaseRequestsAdmin);
router.post("/admin/requests", internal, createPurchaseRequestAdmin);
router.get("/admin/requests/:requestId/quotes", internal, getSupplierQuotesAdmin);
router.post("/admin/quotes/:quoteId/award", internal, awardSupplierQuoteAdmin);
router.get("/admin/orders", internal, getPurchaseOrdersAdmin);
router.post("/admin/orders/:id/receipts", internal, postGoodsReceiptAdmin);
router.get("/admin/invoices", internal, getSupplierInvoicesAdmin);
router.patch("/admin/invoices/:id/review", internal, reviewSupplierInvoiceAdmin);
router.get("/admin/payments", internal, getSupplierPaymentsAdmin);
router.post("/admin/payments", internal, createSupplierPaymentAdmin);
router.patch("/admin/payments/:id", internal, updateSupplierPaymentAdmin);

export default router;
