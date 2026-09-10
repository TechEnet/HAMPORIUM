import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { ROLES } from "../../constants/roles.js";

import {
  createOrUpdateReview,
  deleteMyReview,
  getAdminReviews,
  getMyReviews,
  getProductReviews,
  getReviewEligibility,
  moderateReview,
  updateMyReview,
} from "./review.controller.js";

const router = Router();
const adminAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

// Public: anyone can read published product reviews.
router.get("/product/:productId", getProductReviews);

router.use(protect);

router.get("/eligibility/:productId", getReviewEligibility);
router.get("/mine", getMyReviews);
router.post("/", createOrUpdateReview);
router.patch("/:reviewId", updateMyReview);
router.delete("/:reviewId", deleteMyReview);

router.get("/admin/all", adminAccess, getAdminReviews);
router.patch("/admin/:reviewId/moderate", adminAccess, moderateReview);

export default router;
