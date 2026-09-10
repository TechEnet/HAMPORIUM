import api from "../api/api.js";

const ANALYTICS_SESSION_KEY =
  "hamporium-analytics-session-id";

const createSessionId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `hmp-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
};

export const getAnalyticsSessionId = () => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const existing = window.sessionStorage.getItem(
      ANALYTICS_SESSION_KEY
    );

    if (existing) {
      return existing;
    }

    const next = createSessionId();

    window.sessionStorage.setItem(
      ANALYTICS_SESSION_KEY,
      next
    );

    return next;
  } catch {
    return createSessionId();
  }
};

const getCurrentPagePath = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.pathname}${window.location.search}`;
};

const normalizeLocation = (location) => {
  if (!location || typeof location !== "object") {
    return undefined;
  }

  return {
    pincode:
      location.pincode || location.postalCode || "",
    city: location.city || "",
    state: location.state || "",
    country: location.country || "India",
  };
};

export const buildAnalyticsPayload = ({
  source = "unknown",
  pagePath,
  searchEventId,
} = {}) => ({
  sessionId: getAnalyticsSessionId(),
  source,
  pagePath: pagePath || getCurrentPagePath(),
  ...(searchEventId
    ? { searchEventId }
    : {}),
});

export const trackSearchAnalytics = async (
  payload = {}
) => {
  try {
    const response = await api.post(
      "/analytics/search",
      {
        ...payload,
        sessionId:
          payload.sessionId ||
          getAnalyticsSessionId(),
        pagePath:
          payload.pagePath ||
          getCurrentPagePath(),
        location: normalizeLocation(
          payload.location
        ),
      }
    );

    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(
        "Search analytics event failed:",
        error
      );
    }

    return null;
  }
};

export const trackProductView = async ({
  productId,
  skuId,
  productSlug,
  productName,
  source = "product_detail",
  pagePath,
  location,
} = {}) => {
  if (!productId && !productSlug) {
    return null;
  }

  try {
    const response = await api.post(
      "/analytics/commerce/events/product-view",
      {
        sessionId: getAnalyticsSessionId(),
        source,
        pagePath:
          pagePath || getCurrentPagePath(),
        productId,
        skuId,
        productSlug,
        productName,
        location: normalizeLocation(location),
      }
    );

    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(
        "Product view analytics failed:",
        error
      );
    }

    return null;
  }
};
