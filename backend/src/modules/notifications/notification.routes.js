import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";

import {
  getAllNotifications,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.controller.js";

const router = express.Router();

router.use(protect);

router.get("/mine", getMyNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

router.get(
  "/admin/all",
  allowRoles("admin", "operations"),
  getAllNotifications
);

export default router;