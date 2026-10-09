import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { submitContact } from "./contact.controller.js";

const router = Router();

const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many enquiries. Please try again after 15 minutes.",
  },
});

// Public form: no authentication middleware. Mounted as POST /api/contact.
router.post("/", contactRateLimit, submitContact);

export default router;
