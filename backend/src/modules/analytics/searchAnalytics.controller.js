// EXACT PATH: backend/src/modules/analytics/searchAnalytics.controller.js
// REPLACE FILE

import { createSearchAnalyticsEvent, getSearchAnalyticsSummary } from "./searchAnalytics.service.js";
import { CustomerActivity } from "../customerIntelligence/customerIntelligence.model.js";

/**
 * Main SearchAnalytics collection remains the single source of truth for the
 * Business Analytics dashboard and anonymous traffic. No user identifier is
 * added to its existing anonymous records.
 * Only when attachConsentedAnalyticsCustomer authenticated a user AND found
 * opt-in, write a bounded-lifetime customer-owned companion event.
 */
export const recordSearchAnalytics = async (req, res, next) => {
  try {
    const body = req.body || {};
    const event = await createSearchAnalyticsEvent({
      eventType: body.eventType,
      query: body.query,
      source: body.source,
      visibleResultCount: body.visibleResultCount,
      pagePath: body.pagePath,
      sessionId: body.sessionId,
      productId: body.productId,
      productSlug: body.productSlug,
      productName: body.productName,
      location: body.location,
    });

    if (req.analyticsCustomerId && event?.eventType === "search_submit") {
      const query = String(event.query || "").trim().slice(0, 120);
      // Sensitive-looking terms do not belong in a named customer's history.
      if (query.length >= 2 && !/@|\b\d{10,}\b/.test(query)) {
        try {
          await CustomerActivity.updateOne(
            { user: req.analyticsCustomerId, eventKey: `search-${String(event._id)}` },
            {
              $setOnInsert: {
                user: req.analyticsCustomerId,
                eventKey: `search-${String(event._id)}`,
                type: "search_submitted",
                source: "web",
                searchQuery: query,
                pagePath: String(event.pagePath || "").split(/[?#]/)[0].slice(0, 240),
              },
            },
            { upsert: true }
          );
        } catch (error) {
          console.warn("[Analytics] Customer search mirror unavailable:", error?.message);
        }
      }
    }

    return res.status(201).json({ success: true, eventId: event._id });
  } catch (error) {
    next(error);
  }
};

export const getAdminSearchSummary = async (req, res, next) => {
  try {
    const analytics = await getSearchAnalyticsSummary({
      days: req.query?.days,
      limit: req.query?.limit,
    });
    return res.status(200).json({ success: true, analytics });
  } catch (error) {
    next(error);
  }
};
