import { Router } from "express";

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import catalogRoutes from "./modules/catalog/catalog.routes.js";
import deliveryRoutes from "./modules/delivery/delivery.routes.js";
import cartRoutes from "./modules/cart/cart.routes.js";
import orderRoutes from "./modules/orders/order.routes.js";
import paymentRoutes from "./modules/payments/payment.routes.js";
import refundRoutes from "./modules/refunds/refund.routes.js";
import reviewRoutes from "./modules/reviews/review.routes.js";
import supportRoutes from "./modules/support/support.routes.js";

import analyticsRoutes from "./modules/analytics/searchAnalytics.routes.js";
import commerceAnalyticsRoutes from "./modules/analytics/commerceAnalytics.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import documentRoutes from "./modules/documents/document.routes.js";
import rfqRoutes from "./modules/rfq/rfq.routes.js";
import quoteRoutes from "./modules/quotes/quote.routes.js";
import approvalRoutes from "./modules/approvals/approval.routes.js";
import corporateRoutes from "./modules/corporate/corporate.routes.js";
import weddingRoutes from "./modules/weddings/wedding.routes.js";

import partnerRoutes from "./modules/partners/partner.routes.js";
import showcaseRoutes from "./modules/showcases/showcase.routes.js";
import commissionRoutes from "./modules/commissions/commission.routes.js";
import payoutRoutes from "./modules/payouts/payout.routes.js";

import productionRoutes from "./modules/production/production.routes.js";
import fulfilmentRoutes from "./modules/fulfilment/fulfilment.routes.js";
import notificationRoutes from "./modules/notifications/notification.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "HAMPORIUM API is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);

router.use("/catalog", catalogRoutes);
router.use("/delivery", deliveryRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/refunds", refundRoutes);
router.use("/reviews", reviewRoutes);
router.use("/support", supportRoutes);

router.use("/analytics", analyticsRoutes);
router.use("/analytics/commerce", commerceAnalyticsRoutes);

router.use("/admin", adminRoutes);

router.use("/documents", documentRoutes);
router.use("/rfqs", rfqRoutes);
router.use("/quotes", quoteRoutes);
router.use("/approvals", approvalRoutes);

router.use("/corporate", corporateRoutes);
router.use("/weddings", weddingRoutes);

router.use("/partners", partnerRoutes);
router.use("/showcases", showcaseRoutes);
router.use("/commissions", commissionRoutes);
router.use("/payouts", payoutRoutes);

router.use("/production", productionRoutes);
router.use("/fulfilment", fulfilmentRoutes);
router.use("/notifications", notificationRoutes);
router.use("/audit", auditRoutes);

export default router;
