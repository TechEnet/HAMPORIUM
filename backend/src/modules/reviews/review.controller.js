import mongoose from "mongoose";

import Review from "./review.model.js";
import Order from "../orders/order.model.js";
import Product from "../catalog/product.model.js";

import asyncHandler from "../../utils/asyncHandler.js";
import createAuditLog from "../../helpers/createAuditLog.js";
import { ORDER_STATUS } from "../../constants/statuses.js";

const isValidId = (value) => mongoose.isValidObjectId(value);
const clean = (value, maxLength) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const parseRating = (value) => {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5
    ? rating
    : null;
};

const pagination = (req, defaultLimit = 12) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const getProductSummary = async (productId) => {
  const objectId = new mongoose.Types.ObjectId(productId);

  const [totals, distributionRows] = await Promise.all([
    Review.aggregate([
      { $match: { product: objectId, status: "published" } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]),
    Review.aggregate([
      { $match: { product: objectId, status: "published" } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]),
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distributionRows) {
    distribution[row._id] = row.count;
  }

  return {
    averageRating: Number(Number(totals[0]?.averageRating || 0).toFixed(1)),
    totalReviews: Number(totals[0]?.totalReviews || 0),
    distribution,
  };
};

const findDeliveredPurchase = async ({ userId, productId, orderId = null }) => {
  const filter = {
    user: userId,
    status: ORDER_STATUS.DELIVERED,
    "items.product": productId,
  };

  if (orderId) {
    if (!isValidId(orderId)) return null;
    filter._id = orderId;
  }

  const order = await Order.findOne(filter).sort({ createdAt: -1 }).lean();
  if (!order) return null;

  const line = (order.items || []).find(
    (item) => String(item.product || "") === String(productId)
  );

  if (!line) return null;
  return { order, line };
};

export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!isValidId(productId)) {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }

  const { page, limit, skip } = pagination(req);
  const filter = { product: productId, status: "published" };

  const [reviews, total, summary] = await Promise.all([
    Review.find(filter)
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "user product sku rating title comment verifiedPurchase createdAt updatedAt"
      )
      .lean(),
    Review.countDocuments(filter),
    getProductSummary(productId),
  ]);

  res.json({
    success: true,
    reviews,
    summary,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getReviewEligibility = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!isValidId(productId)) {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }

  const [purchase, existingReview] = await Promise.all([
    findDeliveredPurchase({ userId: req.user._id, productId }),
    Review.findOne({ user: req.user._id, product: productId }).lean(),
  ]);

  res.json({
    success: true,
    eligibility: {
      eligible: Boolean(purchase),
      reason: purchase ? "DELIVERED_VERIFIED_PURCHASE" : "NO_DELIVERED_PURCHASE",
      orderId: purchase?.order?._id || null,
      existingReview: existingReview || null,
    },
  });
});

export const createOrUpdateReview = asyncHandler(async (req, res) => {
  const productId = req.body?.productId;
  const orderId = req.body?.orderId || null;
  const rating = parseRating(req.body?.rating);
  const title = clean(req.body?.title, 120);
  const comment = clean(req.body?.comment, 2000);

  if (!isValidId(productId)) {
    return res.status(400).json({ success: false, message: "Valid product ID is required" });
  }
  if (!rating) {
    return res.status(400).json({ success: false, message: "Rating must be a whole number from 1 to 5" });
  }
  if (comment.length < 3) {
    return res.status(400).json({ success: false, message: "Review must be at least 3 characters" });
  }

  const product = await Product.findById(productId).select("_id name").lean();
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  const purchase = await findDeliveredPurchase({
    userId: req.user._id,
    productId,
    orderId,
  });

  if (!purchase) {
    return res.status(403).json({
      success: false,
      message: "You can review this product only after your purchased order is delivered.",
    });
  }

  let review = await Review.findOne({ user: req.user._id, product: productId });
  const isNew = !review;

  if (!review) {
    review = new Review({
      user: req.user._id,
      order: purchase.order._id,
      product: productId,
      sku: purchase.line.sku || null,
      verifiedPurchase: true,
      status: "published",
    });
  }

  review.order = purchase.order._id;
  review.sku = purchase.line.sku || review.sku || null;
  review.rating = rating;
  review.title = title;
  review.comment = comment;
  await review.save();

  res.status(isNew ? 201 : 200).json({
    success: true,
    message: isNew ? "Review published" : "Review updated",
    review,
  });
});

export const updateMyReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  if (!isValidId(reviewId)) {
    return res.status(400).json({ success: false, message: "Invalid review ID" });
  }

  const review = await Review.findOne({ _id: reviewId, user: req.user._id });
  if (!review) {
    return res.status(404).json({ success: false, message: "Review not found" });
  }

  if (req.body.rating !== undefined) {
    const rating = parseRating(req.body.rating);
    if (!rating) {
      return res.status(400).json({ success: false, message: "Rating must be from 1 to 5" });
    }
    review.rating = rating;
  }

  if (req.body.title !== undefined) review.title = clean(req.body.title, 120);
  if (req.body.comment !== undefined) {
    const comment = clean(req.body.comment, 2000);
    if (comment.length < 3) {
      return res.status(400).json({ success: false, message: "Review must be at least 3 characters" });
    }
    review.comment = comment;
  }

  await review.save();
  res.json({ success: true, message: "Review updated", review });
});

export const deleteMyReview = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.reviewId)) {
    return res.status(400).json({ success: false, message: "Invalid review ID" });
  }

  const review = await Review.findOneAndDelete({
    _id: req.params.reviewId,
    user: req.user._id,
  });

  if (!review) {
    return res.status(404).json({ success: false, message: "Review not found" });
  }

  res.json({ success: true, message: "Review deleted" });
});

export const getMyReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req, 20);
  const filter = { user: req.user._id };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate("product", "name slug images")
      .populate("order", "orderNumber status deliveredAt")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  res.json({
    success: true,
    reviews,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getAdminReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req, 30);
  const filter = {};

  if (req.query.status) {
    if (!["published", "hidden"].includes(req.query.status)) {
      return res.status(400).json({ success: false, message: "Invalid review status" });
    }
    filter.status = req.query.status;
  }

  if (req.query.product && isValidId(req.query.product)) {
    filter.product = req.query.product;
  }

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate("user", "name email")
      .populate("product", "name slug")
      .populate("order", "orderNumber status")
      .populate("moderation.reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  res.json({
    success: true,
    reviews,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const moderateReview = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.reviewId)) {
    return res.status(400).json({ success: false, message: "Invalid review ID" });
  }

  const status = clean(req.body?.status, 30).toLowerCase();
  if (!["published", "hidden"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be published or hidden" });
  }

  const review = await Review.findById(req.params.reviewId);
  if (!review) {
    return res.status(404).json({ success: false, message: "Review not found" });
  }

  const previous = review.status;
  review.status = status;
  review.moderation = {
    note: clean(req.body?.note, 1000),
    reviewedBy: req.user._id,
    reviewedAt: new Date(),
  };
  await review.save();

  await createAuditLog({
    req,
    action: "review_moderated",
    module: "reviews",
    entityType: "review",
    entityId: review._id,
    description: `Review moderation changed from ${previous} to ${status}.`,
    changes: { status: { from: previous, to: status } },
  });

  res.json({ success: true, message: "Review moderation updated", review });
});
