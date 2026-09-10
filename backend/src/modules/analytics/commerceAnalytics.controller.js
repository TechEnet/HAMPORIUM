import {
  getCommerceAnalyticsSummary,
  recordCommerceEvent,
} from "./commerceAnalytics.service.js";

/* =========================================================
   PUBLIC PRODUCT VIEW
========================================================= */
export const recordProductView = async (req, res, next) => {
  try {
    const event = await recordCommerceEvent({
      eventType: "product_view",
      sessionId: req.body?.sessionId,
      source: req.body?.source || "product_detail",
      pagePath: req.body?.pagePath,
      productId: req.body?.productId,
      skuId: req.body?.skuId,
      productSlug: req.body?.productSlug,
      productName: req.body?.productName,
      location: req.body?.location,
    });

    return res.status(201).json({
      success: true,
      eventId: event._id,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   ADMIN COMMERCE SUMMARY
========================================================= */
export const getAdminCommerceSummary = async (req, res, next) => {
  try {
    const analytics = await getCommerceAnalyticsSummary({
      days: req.query?.days,
      limit: req.query?.limit,
    });

    return res.status(200).json({
      success: true,
      analytics,
    });
  } catch (error) {
    next(error);
  }
};
