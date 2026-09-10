import api from "../api/api.js";

const SESSION_KEY =
  "hamporium-search-session";

/* =========================================================
   HELPERS
========================================================= */

const cleanString = (
  value,
  maxLength = 200
) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const createSessionId =
  () => {
    if (
      typeof crypto !==
        "undefined" &&
      typeof crypto.randomUUID ===
        "function"
    ) {
      return `hs_${crypto.randomUUID()}`;
    }

    return `hs_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 12)}`;
  };

export const getSearchSessionId =
  () => {
    try {
      let sessionId =
        sessionStorage.getItem(
          SESSION_KEY
        );

      if (!sessionId) {
        sessionId =
          createSessionId();

        sessionStorage.setItem(
          SESSION_KEY,
          sessionId
        );
      }

      return sessionId;
    } catch {
      return createSessionId();
    }
  };

const sanitizeLocation = (
  location
) => {
  if (!location) {
    return undefined;
  }

  return {
    pincode:
      cleanString(
        location.pincode,
        6
      ),

    city:
      cleanString(
        location.city,
        120
      ),

    state:
      cleanString(
        location.state,
        120
      ),

    country:
      cleanString(
        location.country ||
          "India",
        120
      ),
  };
};

/* =========================================================
   TRACK SEARCH EVENT
========================================================= */

export const trackSearchAnalytics =
  async ({
    eventType,
    query,
    source,
    visibleResultCount,
    pagePath,
    productId,
    productSlug,
    productName,
    location,
  }) => {
    const cleanedQuery =
      cleanString(
        query,
        160
      );

    if (!cleanedQuery) {
      return null;
    }

    try {
      const response =
        await api.post(
          "/analytics/search",
          {
            eventType,

            query:
              cleanedQuery,

            source:
              cleanString(
                source ||
                  "unknown",
                60
              ),

            visibleResultCount:
              visibleResultCount ===
                null ||
              visibleResultCount ===
                undefined
                ? null
                : Number(
                    visibleResultCount
                  ),

            pagePath:
              cleanString(
                pagePath ||
                  window.location
                    .pathname,
                500
              ),

            sessionId:
              getSearchSessionId(),

            productId:
              productId ||
              undefined,

            productSlug:
              cleanString(
                productSlug,
                220
              ) ||
              undefined,

            productName:
              cleanString(
                productName,
                180
              ) ||
              undefined,

            location:
              sanitizeLocation(
                location
              ),
          }
        );

      return response.data;
    } catch (error) {
      /*
       * Analytics must NEVER break search/navigation.
       */
      console.warn(
        "Search analytics tracking failed:",
        error.response?.data
          ?.message ||
          error.message
      );

      return null;
    }
  };