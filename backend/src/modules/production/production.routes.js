import express from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";

import {
  createProductionJob,
  getProductionJobById,
  getProductionJobs,
  submitQCResult,
  syncPaidOrdersToProduction,
  updateProductionItem,
  updateProductionJob,
  updateProductionStage,
} from "./production.controller.js";

const router = express.Router();

router.use(protect, allowRoles("admin", "operations"));

router.get("/", getProductionJobs);
router.post("/", createProductionJob);
router.post("/sync-paid-orders", syncPaidOrdersToProduction);

router.get("/:id", getProductionJobById);
router.patch("/:id", updateProductionJob);
router.patch("/:id/stage", updateProductionStage);
router.patch("/:id/items/:itemId", updateProductionItem);
router.patch("/:id/qc", submitQCResult);

export default router;
