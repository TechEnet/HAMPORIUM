import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";

import {
  createOrder,
  createBuyNowOrder,
  getMyOrders,
  getMyOrderById,
  getMyOrderTracking,
  requestOrderCancellation,
  downloadMyInvoice,
} from "./order.controller.js";

import { getCheckoutDeliveryEstimate } from "./checkoutDelivery.controller.js";
import {
  autoDeliveryForBuyNow,
  autoDeliveryForCart,
} from "./autoDelivery.middleware.js";

const router = Router();

router.use(protect);

// Server-calculated delivery promise. The browser does not choose the date.
router.post("/checkout-estimate", getCheckoutDeliveryEstimate);

router.post("/", autoDeliveryForCart, createOrder);
router.post("/buy-now", autoDeliveryForBuyNow, createBuyNowOrder);

router.get("/my-orders", getMyOrders);
router.get("/:orderId/tracking", getMyOrderTracking);
router.post("/:orderId/cancellation", requestOrderCancellation);
router.get("/:orderId/invoice", downloadMyInvoice);
router.get("/:orderId", getMyOrderById);

export default router;
