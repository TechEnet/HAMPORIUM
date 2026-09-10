import { Router } from "express";

import {
  checkDeliveryAvailability,
  getAddressSuggestions,
  resolveCurrentLocation,
  resolvePincodeLocation,
} from "./delivery.controller.js";

const router = Router();

/* =========================================================
   PUBLIC DELIVERY ROUTES
========================================================= */
router.post("/location", resolveCurrentLocation);
router.post("/resolve", resolvePincodeLocation);
router.post("/address-suggestions", getAddressSuggestions);
router.post("/check", checkDeliveryAvailability);

export default router;
