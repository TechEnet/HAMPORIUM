import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api.js";

const LocationContext =
  createContext(null);

const STORAGE_KEY =
  "hamporium-delivery-location";

const INDIA_PINCODE_REGEX =
  /^[1-9][0-9]{5}$/;

/* =========================================================
   HELPERS
========================================================= */

const normalizePincode = (
  value
) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);

const cleanString = (
  value,
  maxLength = 200
) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

const sanitizeLocation = (
  value
) => {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const pincode =
    normalizePincode(
      value.pincode
    );

  if (
    !INDIA_PINCODE_REGEX.test(
      pincode
    )
  ) {
    return null;
  }

  /*
   * IMPORTANT:
   * Exact browser latitude/longitude are intentionally
   * not stored in localStorage.
   */
  return {
    pincode,

    mapboxId:
      cleanString(
        value.mapboxId,
        220
      ),

    featureType:
      cleanString(
        value.featureType,
        80
      ),

    name:
      cleanString(
        value.name,
        180
      ),

    addressLine1:
      cleanString(
        value.addressLine1,
        300
      ),

    neighborhood:
      cleanString(
        value.neighborhood,
        180
      ),

    locality:
      cleanString(
        value.locality,
        180
      ),

    city:
      cleanString(
        value.city,
        120
      ),

    district:
      cleanString(
        value.district,
        120
      ),

    state:
      cleanString(
        value.state,
        120
      ),

    country:
      cleanString(
        value.country ||
          "India",
        120
      ) || "India",

    countryCode:
      cleanString(
        value.countryCode ||
          "IN",
        10
      ) || "IN",

    formattedAddress:
      cleanString(
        value.formattedAddress,
        500
      ),
  };
};

const readStoredLocation =
  () => {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return null;
      }

      const parsed =
        JSON.parse(raw);

      return sanitizeLocation(
        parsed
      );
    } catch {
      return null;
    }
  };

const createLocationError = (
  message
) => {
  const error =
    new Error(message);

  error.isLocationError =
    true;

  return error;
};

/* =========================================================
   PROVIDER
========================================================= */

export const LocationProvider = ({
  children,
}) => {
  const [
    deliveryLocation,
    setDeliveryLocation,
  ] = useState(
    readStoredLocation
  );

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(false);

  const [
    locationError,
    setLocationError,
  ] = useState("");

  /* =======================================================
     PERSIST
  ======================================================= */

  const persistLocation =
    useCallback(
      (value) => {
        const normalized =
          sanitizeLocation(
            value
          );

        if (!normalized) {
          return null;
        }

        setDeliveryLocation(
          normalized
        );

        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
              normalized
            )
          );
        } catch {
          // Ignore localStorage failure.
        }

        setLocationError("");

        return normalized;
      },
      []
    );

  /* =======================================================
     MANUAL PINCODE
  ======================================================= */

  const resolvePincode =
    useCallback(
      async (
        rawPincode
      ) => {
        const pincode =
          normalizePincode(
            rawPincode
          );

        setLocationError("");

        if (
          !INDIA_PINCODE_REGEX.test(
            pincode
          )
        ) {
          const error =
            createLocationError(
              "Enter a valid 6-digit Indian pincode."
            );

          setLocationError(
            error.message
          );

          throw error;
        }

        setLocationLoading(
          true
        );

        try {
          const response =
            await api.post(
              "/delivery/resolve",
              {
                pincode,
              }
            );

          const location =
            persistLocation(
              response.data
                ?.location
            );

          if (!location) {
            throw createLocationError(
              "We could not verify this delivery location."
            );
          }

          return location;
        } catch (error) {
          const message =
            error.response
              ?.data?.message ||
            error.message ||
            "Unable to verify this delivery location.";

          setLocationError(
            message
          );

          throw createLocationError(
            message
          );
        } finally {
          setLocationLoading(
            false
          );
        }
      },
      [persistLocation]
    );

  /* =======================================================
     CURRENT LOCATION
  ======================================================= */

  const detectCurrentLocation =
    useCallback(
      async () => {
        setLocationError("");

        if (
          !navigator.geolocation
        ) {
          const error =
            createLocationError(
              "Location detection is not supported by this browser."
            );

          setLocationError(
            error.message
          );

          throw error;
        }

        setLocationLoading(
          true
        );

        try {
          const position =
            await new Promise(
              (
                resolve,
                reject
              ) => {
                navigator.geolocation.getCurrentPosition(
                  resolve,

                  (
                    geolocationError
                  ) => {
                    let message =
                      "Unable to detect your current location.";

                    if (
                      geolocationError.code ===
                      1
                    ) {
                      message =
                        "Location permission was denied. Please allow location access or enter your pincode manually.";
                    }

                    if (
                      geolocationError.code ===
                      2
                    ) {
                      message =
                        "Your current location could not be detected. Please enter your pincode manually.";
                    }

                    if (
                      geolocationError.code ===
                      3
                    ) {
                      message =
                        "Location detection timed out. Please try again.";
                    }

                    reject(
                      createLocationError(
                        message
                      )
                    );
                  },

                  {
                    enableHighAccuracy:
                      true,

                    timeout:
                      15000,

                    /*
                     * Allow a recent browser location
                     * so repeat usage feels faster.
                     */
                    maximumAge:
                      5 *
                      60 *
                      1000,
                  }
                );
              }
            );

          const {
            latitude,
            longitude,
          } =
            position.coords;

          const response =
            await api.post(
              "/delivery/location",
              {
                latitude,
                longitude,
              }
            );

          const location =
            persistLocation(
              response.data
                ?.location
            );

          if (!location) {
            throw createLocationError(
              "We found your location but could not detect a valid pincode."
            );
          }

          return location;
        } catch (error) {
          const message =
            error.response
              ?.data?.message ||
            error.message ||
            "Unable to detect your current location.";

          setLocationError(
            message
          );

          throw createLocationError(
            message
          );
        } finally {
          setLocationLoading(
            false
          );
        }
      },
      [persistLocation]
    );

  /* =======================================================
     APPLY LOCATION FROM OTHER SCREENS
  ======================================================= */

  const applyDeliveryLocation =
    useCallback(
      (value) => {
        return persistLocation(
          value
        );
      },
      [persistLocation]
    );

  /* =======================================================
     CLEAR
  ======================================================= */

  const clearDeliveryLocation =
    useCallback(() => {
      setDeliveryLocation(
        null
      );

      setLocationError("");

      try {
        localStorage.removeItem(
          STORAGE_KEY
        );
      } catch {
        // Ignore localStorage failure.
      }
    }, []);

  /* =======================================================
     CROSS TAB SYNC
  ======================================================= */

  useEffect(() => {
    const handleStorage = (
      event
    ) => {
      if (
        event.key !==
        STORAGE_KEY
      ) {
        return;
      }

      if (!event.newValue) {
        setDeliveryLocation(
          null
        );

        return;
      }

      try {
        const parsed =
          JSON.parse(
            event.newValue
          );

        setDeliveryLocation(
          sanitizeLocation(
            parsed
          )
        );
      } catch {
        setDeliveryLocation(
          null
        );
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  /* =======================================================
     DISPLAY LABEL
  ======================================================= */

  const locationLabel =
    useMemo(() => {
      if (
        !deliveryLocation
      ) {
        return "Select location";
      }

      const place =
        deliveryLocation.city ||
        deliveryLocation
          .district ||
        deliveryLocation.state ||
        "India";

      return `${place} ${deliveryLocation.pincode}`;
    }, [deliveryLocation]);

  const value =
    useMemo(
      () => ({
        deliveryLocation,

        locationLabel,

        locationLoading,

        locationError,

        resolvePincode,

        detectCurrentLocation,

        applyDeliveryLocation,

        clearDeliveryLocation,

        setLocationError,
      }),
      [
        deliveryLocation,
        locationLabel,
        locationLoading,
        locationError,
        resolvePincode,
        detectCurrentLocation,
        applyDeliveryLocation,
        clearDeliveryLocation,
      ]
    );

  return (
    <LocationContext.Provider
      value={value}
    >
      {children}
    </LocationContext.Provider>
  );
};

/* =========================================================
   HOOK
========================================================= */

export const useDeliveryLocation =
  () => {
    const context =
      useContext(
        LocationContext
      );

    if (!context) {
      throw new Error(
        "useDeliveryLocation must be used inside LocationProvider"
      );
    }

    return context;
  };

export default LocationContext;