import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { ROLES } from "../../constants/roles.js";

import {
  createSupportTicket,
  getAdminSupportTicketById,
  getAdminSupportTickets,
  getMySupportTicketById,
  getMySupportTickets,
  replyToMySupportTicket,
  replyToSupportTicketAdmin,
  updateSupportTicketAdmin,
} from "./support.controller.js";

const router = Router();
const adminAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

router.use(protect);

router.post("/", createSupportTicket);
router.get("/mine", getMySupportTickets);
router.get("/mine/:ticketId", getMySupportTicketById);
router.post("/mine/:ticketId/replies", replyToMySupportTicket);

router.get("/admin", adminAccess, getAdminSupportTickets);
router.get("/admin/:ticketId", adminAccess, getAdminSupportTicketById);
router.post("/admin/:ticketId/replies", adminAccess, replyToSupportTicketAdmin);
router.patch("/admin/:ticketId", adminAccess, updateSupportTicketAdmin);

export default router;
