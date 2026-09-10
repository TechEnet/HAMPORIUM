import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { getAuditLogById, getAuditLogs } from "./audit.controller.js";

const router = express.Router();

router.use(protect, allowRoles("admin", "operations"));

router.get("/", getAuditLogs);
router.get("/:id", getAuditLogById);

export default router;