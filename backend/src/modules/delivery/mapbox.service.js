import dns from "node:dns";

const MAPBOX_BASE_URL =
  "https://api.mapbox.com/search/geocode/v6";

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

const MAPBOX_TIMEOUT_MS = clampInteger(
  process.env.MAPBOX_TIMEOUT_MS,
  15000,
  5000,
  30000
);

const MAPBOX_MAX_ATTEMPTS = clampInteger(
  process.env.MAPBOX_MAX_ATTEMPTS,
  2,
  1,
  3
);

const MAPBOX_RETRY_DELAY_MS = clampInteger(
  process.env.MAPBOX_RETRY_DELAY_MS,
  400,
  100,
  3000
);

/* =========================================================
   NETWORK PREFERENCE
========================================================= */

/*
 * On some Windows networks Node can try an unusable IPv6 route first,
 * which makes fetch hang until AbortController times out even though
 * the same URL works in the browser. Prefer IPv4 first for outbound
 * DNS resolution while still allowing IPv6 as a fallback.
 */
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Older Node versions can safely continue without this preference.
}

/* =========================================================
   ERRORS
========================================================= */

const createProviderError = (
  message,
  statusCode = 502,
  code = "MAPBOX_ERROR"
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

/* =========================================================
   TOKEN
========================================================= */

const getMapboxToken = () => {
  const token =
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.VITE_MAPBOX_ACCESS_TOKEN;

  if (!token?.trim()) {
    throw createProviderError(
      "Mapbox access token is not configured",
      500,
      "MAPBOX_TOKEN_MISSING"
    );
  }

  return token.trim();
};

/* =========================================================
   REQUEST HELPERS
========================================================= */

const sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const isRetryableStatus = (status) =>
  status === 408 ||
  status === 429 ||
  status === 500 ||
  status === 502 ||
  status === 503 ||
  status === 504;

const parseResponseBody = async (response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const requestMapboxOnce = async (url) => {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, MAPBOX_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "HAMPORIUM-Backend/1.0",
      },
      signal: controller.signal,
    });

    const data = await parseResponseBody(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw createProviderError(
          "Mapbox access token was rejected",
          502,
          "MAPBOX_TOKEN_REJECTED"
        );
      }

      if (response.status === 429) {
        throw createProviderError(
          data?.message || "Mapbox rate limit reached",
          503,
          "MAPBOX_RATE_LIMIT"
        );
      }

      throw createProviderError(
        data?.message ||
          `Mapbox location request failed with status ${response.status}`,
        isRetryableStatus(response.status) ? 503 : 502,
        isRetryableStatus(response.status)
          ? "MAPBOX_RETRYABLE_HTTP_ERROR"
          : "MAPBOX_HTTP_ERROR"
      );
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createProviderError(
        `Location service timed out after ${MAPBOX_TIMEOUT_MS}ms`,
        504,
        "MAPBOX_TIMEOUT"
      );
    }

    if (error?.statusCode) {
      throw error;
    }

    throw createProviderError(
      "Unable to connect to the location service",
      502,
      "MAPBOX_NETWORK_ERROR"
    );
  } finally {
    clearTimeout(timeout);
  }
};

const requestMapbox = async (url) => {
  let lastError = null;

  for (
    let attempt = 1;
    attempt <= MAPBOX_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await requestMapboxOnce(url);
    } catch (error) {
      lastError = error;

      const retryable = [
        "MAPBOX_TIMEOUT",
        "MAPBOX_NETWORK_ERROR",
        "MAPBOX_RATE_LIMIT",
        "MAPBOX_RETRYABLE_HTTP_ERROR",
      ].includes(error?.code);

      const hasAnotherAttempt =
        attempt < MAPBOX_MAX_ATTEMPTS;

      if (!retryable || !hasAnotherAttempt) {
        throw error;
      }

      await sleep(
        MAPBOX_RETRY_DELAY_MS * attempt
      );
    }
  }

  throw (
    lastError ||
    createProviderError(
      "Mapbox location request failed",
      502
    )
  );
};

/* =========================================================
   MAPBOX RESPONSE HELPERS
========================================================= */

const getFeatureContext = (feature, type) => {
  const properties = feature?.properties || {};

  if (properties.feature_type === type) {
    return properties;
  }

  return properties.context?.[type] || null;
};

const getFeatureName = (feature, type) => {
  const context = getFeatureContext(feature, type);
  return String(context?.name || "").trim();
};

const getCountryCode = (feature) => {
  const country = getFeatureContext(feature, "country");

  return String(country?.country_code || "")
    .trim()
    .toUpperCase();
};

const getCoordinates = (feature) => {
  const properties = feature?.properties || {};

  const longitude =
    properties.coordinates?.longitude ??
    feature?.geometry?.coordinates?.[0] ??
    null;

  const latitude =
    properties.coordinates?.latitude ??
    feature?.geometry?.coordinates?.[1] ??
    null;

  const parsedLongitude = Number(longitude);
  const parsedLatitude = Number(latitude);

  return {
    longitude: Number.isFinite(parsedLongitude)
      ? parsedLongitude
      : null,

    latitude: Number.isFinite(parsedLatitude)
      ? parsedLatitude
      : null,
  };
};

const buildAddressLine1 = (feature) => {
  const properties = feature?.properties || {};
  const featureType = String(
    properties.feature_type || ""
  );

  const addressContext =
    getFeatureContext(feature, "address");

  const streetContext =
    getFeatureContext(feature, "street");

  const houseNumber = String(
    properties.address ||
      properties.house_number ||
      addressContext?.address_number ||
      ""
  ).trim();

  const street = String(
    streetContext?.name ||
      (featureType === "street"
        ? properties.name || ""
        : "") ||
      properties.name ||
      ""
  ).trim();

  const values = [];

  if (houseNumber) {
    values.push(houseNumber);
  }

  if (
    street &&
    !values.includes(street)
  ) {
    values.push(street);
  }

  return values.join(" ").trim();
};

const normalizeFeature = (feature) => {
  if (!feature) {
    return null;
  }

  const properties = feature.properties || {};
  const coordinates = getCoordinates(feature);

  const pincode = getFeatureName(feature, "postcode");
  const place = getFeatureName(feature, "place");
  const locality = getFeatureName(feature, "locality");
  const neighborhood = getFeatureName(
    feature,
    "neighborhood"
  );
  const district = getFeatureName(feature, "district");
  const state = getFeatureName(feature, "region");
  const country = getFeatureName(feature, "country");

  const formattedAddress = String(
    properties.full_address ||
      [
        properties.name,
        properties.place_formatted,
      ]
        .filter(Boolean)
        .join(", ") ||
      ""
  ).trim();

  return {
    mapboxId: String(
      properties.mapbox_id ||
        feature.id ||
        ""
    ).trim(),

    featureType: String(
      properties.feature_type || ""
    ).trim(),

    name: String(
      properties.name || ""
    ).trim(),

    addressLine1: buildAddressLine1(feature),

    neighborhood: String(
      neighborhood || ""
    ).trim(),

    locality: String(
      locality || ""
    ).trim(),

    pincode: String(pincode || "")
      .replace(/\D/g, "")
      .trim(),

    city: String(
      place ||
        locality ||
        district ||
        ""
    ).trim(),

    district: String(
      district || ""
    ).trim(),

    state: String(
      state || ""
    ).trim(),

    country: String(
      country || ""
    ).trim(),

    countryCode: getCountryCode(feature),

    formattedAddress,

    longitude: coordinates.longitude,
    latitude: coordinates.latitude,
  };
};

const isIndianFeature = (location) =>
  !location?.countryCode ||
  location.countryCode === "IN";

/* =========================================================
   FORWARD PINCODE REQUEST
========================================================= */

const requestPincode = async (
  pincode,
  structured = true
) => {
  const token = getMapboxToken();
  const url = new URL(
    `${MAPBOX_BASE_URL}/forward`
  );

  if (structured) {
    url.searchParams.set(
      "postcode",
      pincode
    );

    url.searchParams.set(
      "country",
      "in"
    );
  } else {
    url.searchParams.set(
      "q",
      `${pincode}, India`
    );

    url.searchParams.set(
      "country",
      "in"
    );
  }

  url.searchParams.set(
    "types",
    "postcode"
  );

  url.searchParams.set(
    "autocomplete",
    "false"
  );

  url.searchParams.set(
    "limit",
    "1"
  );

  url.searchParams.set(
    "language",
    "en"
  );

  url.searchParams.set(
    "worldview",
    "in"
  );

  url.searchParams.set(
    "access_token",
    token
  );

  return requestMapbox(
    url.toString()
  );
};

/* =========================================================
   PINCODE -> LOCATION
========================================================= */

export const geocodeIndianPincode = async (
  pincode
) => {
  const normalizedPincode = String(
    pincode || ""
  )
    .replace(/\D/g, "")
    .trim();

  if (
    !/^[1-9][0-9]{5}$/.test(
      normalizedPincode
    )
  ) {
    return null;
  }

  let data = await requestPincode(
    normalizedPincode,
    true
  );

  let feature = data?.features?.[0];

  if (!feature) {
    data = await requestPincode(
      normalizedPincode,
      false
    );

    feature = data?.features?.[0];
  }

  if (!feature) {
    return null;
  }

  const location = normalizeFeature(feature);

  if (
    !location ||
    !isIndianFeature(location)
  ) {
    return null;
  }

  const returnedPincode = String(
    location.pincode || ""
  )
    .replace(/\D/g, "")
    .trim();

  if (
    returnedPincode &&
    returnedPincode !==
      normalizedPincode
  ) {
    return null;
  }

  return {
    ...location,
    pincode: normalizedPincode,
    country:
      location.country || "India",
    countryCode:
      location.countryCode || "IN",
  };
};

/* =========================================================
   COORDINATES -> LOCATION
========================================================= */

export const reverseGeocodeIndianLocation = async ({
  latitude,
  longitude,
}) => {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (
    !Number.isFinite(parsedLatitude) ||
    parsedLatitude < -90 ||
    parsedLatitude > 90 ||
    !Number.isFinite(parsedLongitude) ||
    parsedLongitude < -180 ||
    parsedLongitude > 180
  ) {
    return null;
  }

  const token = getMapboxToken();

  const url = new URL(
    `${MAPBOX_BASE_URL}/reverse`
  );

  url.searchParams.set(
    "latitude",
    String(parsedLatitude)
  );

  url.searchParams.set(
    "longitude",
    String(parsedLongitude)
  );

  url.searchParams.set(
    "country",
    "in"
  );

  url.searchParams.set(
    "language",
    "en"
  );

  url.searchParams.set(
    "worldview",
    "in"
  );

  url.searchParams.set(
    "access_token",
    token
  );

  const data = await requestMapbox(
    url.toString()
  );

  const feature =
    data?.features?.[0];

  if (!feature) {
    return null;
  }

  const location = normalizeFeature(feature);

  if (
    !location ||
    !isIndianFeature(location)
  ) {
    return null;
  }

  const normalizedPincode = String(
    location.pincode || ""
  )
    .replace(/\D/g, "")
    .trim();

  return {
    ...location,

    pincode:
      /^[1-9][0-9]{5}$/.test(
        normalizedPincode
      )
        ? normalizedPincode
        : "",

    country:
      location.country || "India",

    countryCode:
      location.countryCode || "IN",
  };
};

/* =========================================================
   ADDRESS AUTOCOMPLETE
========================================================= */

export const searchIndianAddressSuggestions = async ({
  query,
  latitude = null,
  longitude = null,
  limit = 5,
}) => {
  const cleanedQuery = String(query || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 180);

  if (cleanedQuery.length < 3) {
    return [];
  }

  const resolvedLimit = Math.min(
    8,
    Math.max(
      1,
      Number.parseInt(limit, 10) || 5
    )
  );

  const token = getMapboxToken();

  const url = new URL(
    `${MAPBOX_BASE_URL}/forward`
  );

  url.searchParams.set(
    "q",
    cleanedQuery
  );

  url.searchParams.set(
    "country",
    "in"
  );

  url.searchParams.set(
    "types",
    "address,street,neighborhood,locality,place,district,postcode"
  );

  url.searchParams.set(
    "autocomplete",
    "true"
  );

  url.searchParams.set(
    "limit",
    String(resolvedLimit)
  );

  url.searchParams.set(
    "language",
    "en"
  );

  url.searchParams.set(
    "worldview",
    "in"
  );

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (
    Number.isFinite(parsedLatitude) &&
    parsedLatitude >= -90 &&
    parsedLatitude <= 90 &&
    Number.isFinite(parsedLongitude) &&
    parsedLongitude >= -180 &&
    parsedLongitude <= 180
  ) {
    url.searchParams.set(
      "proximity",
      `${parsedLongitude},${parsedLatitude}`
    );
  }

  url.searchParams.set(
    "access_token",
    token
  );

  const data = await requestMapbox(
    url.toString()
  );

  const features = Array.isArray(
    data?.features
  )
    ? data.features
    : [];

  const seen = new Set();
  const suggestions = [];

  for (const feature of features) {
    const location =
      normalizeFeature(feature);

    if (
      !location ||
      !isIndianFeature(location)
    ) {
      continue;
    }

    const key =
      location.mapboxId ||
      `${location.formattedAddress}|${location.latitude}|${location.longitude}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    suggestions.push({
      ...location,

      country:
        location.country || "India",

      countryCode:
        location.countryCode || "IN",

      label:
        location.formattedAddress ||
        [
          location.addressLine1,
          location.neighborhood,
          location.city,
          location.state,
          location.pincode,
        ]
          .filter(Boolean)
          .join(", "),
    });
  }

  return suggestions;
};
