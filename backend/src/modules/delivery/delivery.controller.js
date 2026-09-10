import {
  checkSkuDeliveryForPincode,
  resolveLocationFromCoordinates,
  resolveLocationFromPincode,
} from "./delivery.service.js";

import {
  searchIndianAddressSuggestions,
} from "./mapbox.service.js";

const INDIA_PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const normalizePincode = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .trim();

const publicLocation = (location, fallbackPincode = "") => ({
  mapboxId: location?.mapboxId || "",
  featureType: location?.featureType || "",
  name: location?.name || "",
  addressLine1: location?.addressLine1 || "",
  neighborhood: location?.neighborhood || "",
  locality: location?.locality || "",
  pincode: location?.pincode || fallbackPincode || "",
  city: location?.city || "",
  district: location?.district || "",
  state: location?.state || "",
  country: location?.country || "India",
  countryCode: location?.countryCode || "IN",
  formattedAddress: location?.formattedAddress || "",
  latitude: location?.latitude ?? null,
  longitude: location?.longitude ?? null,
});

/* =========================================================
   CURRENT LOCATION
========================================================= */
export const resolveCurrentLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (
      !Number.isFinite(parsedLatitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude is required",
      });
    }

    if (
      !Number.isFinite(parsedLongitude) ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid longitude is required",
      });
    }

    const location = await resolveLocationFromCoordinates({
      latitude: parsedLatitude,
      longitude: parsedLongitude,
    });

    if (!location) {
      return res.status(422).json({
        success: false,
        message:
          "We could not detect a supported delivery location. Please enter your pincode manually.",
      });
    }

    if (!INDIA_PINCODE_REGEX.test(location.pincode || "")) {
      return res.status(422).json({
        success: false,
        message:
          "Pincode could not be detected from your current location. Please enter it manually.",
      });
    }

    return res.status(200).json({
      success: true,
      location: publicLocation(location),
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   RESOLVE MANUAL PINCODE
========================================================= */
export const resolvePincodeLocation = async (req, res, next) => {
  try {
    const pincode = normalizePincode(req.body?.pincode);

    if (!INDIA_PINCODE_REGEX.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 6-digit Indian pincode",
      });
    }

    const location = await resolveLocationFromPincode(pincode);

    if (!location) {
      return res.status(422).json({
        success: false,
        message: "We could not verify this Indian pincode.",
      });
    }

    return res.status(200).json({
      success: true,
      location: publicLocation(location, pincode),
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   ADDRESS SUGGESTIONS
========================================================= */
export const getAddressSuggestions = async (req, res, next) => {
  try {
    const query = String(req.body?.query || "")
      .trim()
      .replace(/\s+/g, " ");

    if (query.length < 3) {
      return res.status(200).json({
        success: true,
        suggestions: [],
      });
    }

    const suggestions = await searchIndianAddressSuggestions({
      query,
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
      limit: req.body?.limit,
    });

    return res.status(200).json({
      success: true,
      suggestions,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   DELIVERY CHECK
========================================================= */
export const checkDeliveryAvailability = async (req, res, next) => {
  try {
    const { skuId, pincode } = req.body;

    if (!skuId) {
      return res.status(400).json({
        success: false,
        message: "skuId is required",
      });
    }

    const normalizedPincode = normalizePincode(pincode);

    if (!INDIA_PINCODE_REGEX.test(normalizedPincode)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 6-digit Indian pincode",
      });
    }

    const delivery = await checkSkuDeliveryForPincode({
      skuId,
      pincode: normalizedPincode,
    });

    return res.status(200).json({
      success: true,
      delivery,
    });
  } catch (error) {
    next(error);
  }
};
