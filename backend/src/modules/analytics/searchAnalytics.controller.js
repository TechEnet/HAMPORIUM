import {
  createSearchAnalyticsEvent,
  getSearchAnalyticsSummary,
} from "./searchAnalytics.service.js";

/* =========================================================
   RECORD SEARCH EVENT
========================================================= */

/**
 * POST /api/analytics/search
 *
 * Examples:
 *
 * search submit:
 * {
 *   eventType: "search_submit",
 *   query: "birthday hamper",
 *   source: "desktop_header",
 *   visibleResultCount: 6
 * }
 *
 * product click:
 * {
 *   eventType: "search_result_click",
 *   query: "birthday hamper",
 *   productId: "...",
 *   productSlug: "...",
 *   productName: "..."
 * }
 */
export const recordSearchAnalytics =
  async (
    req,
    res,
    next
  ) => {
    try {
      const event =
        await createSearchAnalyticsEvent(
          {
            eventType:
              req.body
                ?.eventType,

            query:
              req.body?.query,

            source:
              req.body?.source,

            visibleResultCount:
              req.body
                ?.visibleResultCount,

            pagePath:
              req.body
                ?.pagePath,

            sessionId:
              req.body
                ?.sessionId,

            productId:
              req.body
                ?.productId,

            productSlug:
              req.body
                ?.productSlug,

            productName:
              req.body
                ?.productName,

            location:
              req.body
                ?.location,
          }
        );

      return res
        .status(201)
        .json({
          success: true,

          eventId:
            event._id,
        });
    } catch (error) {
      next(error);
    }
  };

/* =========================================================
   ADMIN SEARCH SUMMARY
========================================================= */

/**
 * GET /api/analytics/admin/search-summary?days=30&limit=10
 */
export const getAdminSearchSummary =
  async (
    req,
    res,
    next
  ) => {
    try {
      const analytics =
        await getSearchAnalyticsSummary(
          {
            days:
              req.query
                ?.days,

            limit:
              req.query
                ?.limit,
          }
        );

      return res
        .status(200)
        .json({
          success: true,
          analytics,
        });
    } catch (error) {
      next(error);
    }
  };