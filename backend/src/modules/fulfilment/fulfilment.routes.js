import express from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";

import {
  createShipment,
  deliverShipment,
  dispatchShipment,
  getShipmentById,
  getShipments,
  updateShipment,
  updateShipmentStatus,
} from "./fulfilment.controller.js";

const router = express.Router();

router.use(protect, allowRoles("admin", "operations"));

router.get("/", getShipments);
router.post("/", createShipment);

router.get("/:id", getShipmentById);
router.patch("/:id", updateShipment);
router.patch("/:id/status", updateShipmentStatus);
router.post("/:id/dispatch", dispatchShipment);
router.post("/:id/deliver", deliverShipment);

export default router;