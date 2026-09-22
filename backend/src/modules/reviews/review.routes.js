import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { ROLES } from "../../constants/roles.js";

import {
  createOrUpdateReview,
  deleteMyReview,
  getAdminReviews,
  getCustomHamperReviewEligibility,
  getHomepageReviews,
  getMyReviews,
  getProductReviews,
  getReviewEligibility,
  moderateReview,
  setHomepageFeatured,
  updateMyReview,
} from "./review.controller.js";

const router = Router();

const adminAccess =
  allowRoles(
    ROLES.ADMIN,
    ROLES.OPERATIONS
  );

/*
 * Public homepage showcase.
 * Returns only published reviews explicitly selected by admin/operations.
 */
router.get(
  "/homepage",
  getHomepageReviews
);

router.get(
  "/product/:productId",
  getProductReviews
);

router.use(protect);

/*
 * Custom hamper eligibility is checked by delivered order.
 * No order-item id is required, so older delivered orders work too.
 */
router.get(
  "/eligibility/custom-hamper/:orderId",
  getCustomHamperReviewEligibility
);

router.get(
  "/eligibility/:productId",
  getReviewEligibility
);

router.get(
  "/mine",
  getMyReviews
);

router.post(
  "/",
  createOrUpdateReview
);

router.patch(
  "/:reviewId",
  updateMyReview
);

router.delete(
  "/:reviewId",
  deleteMyReview
);

router.get(
  "/admin/all",
  adminAccess,
  getAdminReviews
);

router.patch(
  "/admin/:reviewId/homepage",
  adminAccess,
  setHomepageFeatured
);

router.patch(
  "/admin/:reviewId/moderate",
  adminAccess,
  moderateReview
);

export default router;
