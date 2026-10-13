// EXACT PATH: backend/src/modules/analytics/commerceAnalytics.controller.js
// REPLACE FILE

import { getCommerceAnalyticsSummary, recordCommerceEvent } from "./commerceAnalytics.service.js";
import { CustomerActivity } from "../customerIntelligence/customerIntelligence.model.js";

/**
 * Public product view. Existing business analytics never requires a session.
 * Opted-in identified customers get a separate CustomerActivity event with
 * a 180-day TTL. We do NOT attach the user ID to the long-lived aggregate
 * CommerceAnalytics record; this avoids retaining behavioral identity there.
 */
export const recordProductView = async (req, res, next) => {
  try {
    const body = req.body || {};
    const event = await recordCommerceEvent({
      eventType: "product_view",
      sessionId: body.sessionId,
      source: body.source || "product_detail",
      pagePath: body.pagePath,
      productId: body.productId,
      skuId: body.skuId,
      productSlug: body.productSlug,
      productName: body.productName,
      location: body.location,
    });

    if (req.analyticsCustomerId && (event.product || event.sku)) {
      try {
        await CustomerActivity.updateOne(
          { user: req.analyticsCustomerId, eventKey: `view-${String(event._id)}` },
          {
            $setOnInsert: {
              user: req.analyticsCustomerId,
              eventKey: `view-${String(event._id)}`,
              type: "product_viewed",
              source: "web",
              productId: event.product || null,
              skuId: event.sku || null,
              pagePath: String(event.pagePath || "").split(/[?#]/)[0].slice(0, 240),
            },
          },
          { upsert: true }
        );
      } catch (error) {
        console.warn("[Analytics] Customer product-view mirror unavailable:", error?.message);
      }
    }

    return res.status(201).json({ success: true, eventId: event._id });
  } catch (error) {
    next(error);
  }
};

export const getAdminCommerceSummary = async (req, res, next) => {
  try {
    const analytics = await getCommerceAnalyticsSummary({
      days: req.query?.days,
      limit: req.query?.limit,
    });
    return res.status(200).json({ success: true, analytics });
  } catch (error) {
    next(error);
  }
};
