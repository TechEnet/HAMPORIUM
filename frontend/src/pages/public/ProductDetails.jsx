import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../../api/api.js";
import formatCurrency from "../../utils/formatCurrency.js";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  useCart,
} from "../../context/CartContext.jsx";

import {
  useDeliveryLocation,
} from "../../context/LocationContext.jsx";

import {
  trackProductView,
} from "../../utils/analytics.js";

import {
  saveBuyNowIntent,
} from "../../utils/buyNow.js";

import {
  clearStoredPartnerReferral,
  getStoredPartnerReferral,
  storePartnerReferral,
} from "../../utils/partnerReferral.js";

import ProductReviewsSection from
  "../../components/reviews/ProductReviewsSection.jsx";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const RECENT_KEY =
  "hamporium-recent-products";

const getGalleryUrl = (image) => {
  if (!image) {
    return "";
  }

  if (typeof image === "string") {
    return image;
  }

  return (
    image.url ||
    image.secure_url ||
    image.src ||
    image.location ||
    ""
  );
};

const normalizeGalleryImage = (image) => {
  const url = getGalleryUrl(image);

  if (!url) {
    return null;
  }

  return {
    ...(typeof image === "object" ? image : {}),
    url,
    alt:
      typeof image === "object"
        ? image.alt || image.name || ""
        : "",
  };
};


/* =========================================================
   HELPERS
========================================================= */

const formatDateValue = (
  value
) => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
};

const formatDimensions = (
  dimensions
) => {
  if (!dimensions) {
    return "—";
  }

  const {
    length,
    width,
    height,
    unit,
  } = dimensions;

  if (
    length === undefined ||
    length === null ||
    width === undefined ||
    width === null ||
    height === undefined ||
    height === null
  ) {
    return "—";
  }

  return `${length} × ${width} × ${height} ${
    unit || "cm"
  }`;
};

const formatWeightValue = (
  weight
) => {
  if (
    !weight ||
    weight.value === null ||
    weight.value === undefined
  ) {
    return "—";
  }

  const value =
    Number(
      weight.value
    );

  if (
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }

  return `${value.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 3,
    }
  )} ${weight.unit || "kg"}`;
};

const formatDaysValue = (
  value
) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const days =
    Number(value);

  if (
    !Number.isFinite(
      days
    )
  ) {
    return "—";
  }

  return `${days} ${
    days === 1
      ? "day"
      : "days"
  }`;
};

const normalizePincode = (
  value
) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);

const normalizePartnerCode = (
  value
) =>
  String(value || "")
    .toUpperCase()
    .replace(
      /[^A-Z0-9_-]/g,
      ""
    )
    .slice(0, 32);

const readLocalArray = (
  key
) => {
  try {
    const value =
      JSON.parse(
        localStorage.getItem(
          key
        ) || "[]"
      );

    return Array.isArray(
      value
    )
      ? value
      : [];
  } catch {
    return [];
  }
};

/* =========================================================
   PRODUCT DETAILS
========================================================= */

const ProductDetails = () => {
  const {
    slug,
  } = useParams();

  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    user,
  } = useAuth();

  const {
    deliveryLocation,
    resolvePincode,
    detectCurrentLocation,
  } =
    useDeliveryLocation();

  const {
    addToCart,
  } = useCart();

  const trackedProductRef =
    useRef("");

  const autoDeliveryKeyRef =
    useRef("");

  /* =======================================================
     PRODUCT
  ======================================================= */

  const [
    product,
    setProduct,
  ] = useState(null);

  const [
    selectedSku,
    setSelectedSku,
  ] = useState(null);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState("");

  const [
    quantity,
    setQuantity,
  ] = useState(1);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    adding,
    setAdding,
  ] = useState(false);

  const [
    buying,
    setBuying,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    activeInfoTab,
    setActiveInfoTab,
  ] = useState(
    "description"
  );

  const [
    zoomImage,
    setZoomImage,
  ] = useState("");

  const [
    shareMessage,
    setShareMessage,
  ] = useState("");

  const [
    recentProducts,
    setRecentProducts,
  ] = useState([]);

  const [
    reviewSummary,
    setReviewSummary,
  ] = useState(null);

  /* =======================================================
     DELIVERY
  ======================================================= */

  const [
    deliveryPincode,
    setDeliveryPincode,
  ] = useState(
    deliveryLocation
      ?.pincode ||
      ""
  );

  const [
    deliveryChecking,
    setDeliveryChecking,
  ] = useState(false);

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(false);

  const [
    deliveryResult,
    setDeliveryResult,
  ] = useState(null);

  const [
    deliveryError,
    setDeliveryError,
  ] = useState("");

  /* =======================================================
     PARTNER PROMO
     Unified storage + backend validation
  ======================================================= */

  const [
    promoCode,
    setPromoCode,
  ] = useState(() =>
    getStoredPartnerReferral()
      ?.referralCode ||
    ""
  );

  const [
    appliedPromoCode,
    setAppliedPromoCode,
  ] = useState(() =>
    getStoredPartnerReferral()
      ?.referralCode ||
    ""
  );

  const [
    promoMessage,
    setPromoMessage,
  ] = useState(() => {
    const stored =
      getStoredPartnerReferral();

    if (!stored?.referralCode) {
      return "";
    }

    return Number(
      stored.discountPercent ||
        0
    ) > 0
      ? `${stored.discountPercent}% partner discount saved for eligible ready-made products.`
      : "Partner code saved. It will be verified again at checkout.";
  });

  const [
    promoError,
    setPromoError,
  ] = useState("");

  const [
    promoApplying,
    setPromoApplying,
  ] = useState(false);

  /* =======================================================
     VALIDATE SAVED PARTNER CODE
  ======================================================= */

  useEffect(() => {
    const stored =
      getStoredPartnerReferral();

    const code =
      normalizePartnerCode(
        stored?.referralCode
      );

    if (!code) {
      return;
    }

    let active = true;

    const validateStoredCode =
      async () => {
        try {
          const response =
            await api.get(
              `/partners/referrals/resolve/${encodeURIComponent(
                code
              )}`
            );

          const referral =
            response.data
              ?.referral;

          if (
            !active ||
            !response.data
              ?.valid ||
            !referral
              ?.referralCode
          ) {
            return;
          }

          const saved =
            storePartnerReferral({
              ...stored,
              ...referral,
              source:
                stored?.source ||
                "promo_code",
            });

          if (!saved) {
            return;
          }

          setPromoCode(
            saved.referralCode
          );

          setAppliedPromoCode(
            saved.referralCode
          );

          setPromoMessage(
            Number(
              saved.discountPercent ||
                0
            ) > 0
              ? `${saved.discountPercent}% partner discount saved for eligible ready-made products.`
              : "Partner code saved. It will be verified again at checkout."
          );
        } catch (requestError) {
          if (!active) {
            return;
          }

          if (
            requestError.response
              ?.status === 404
          ) {
            clearStoredPartnerReferral();
            setPromoCode("");
            setAppliedPromoCode(
              ""
            );
            setPromoMessage(
              ""
            );
          }
        }
      };

    void validateStoredCode();

    return () => {
      active = false;
    };
  }, []);

  /* =======================================================
     LOAD PRODUCT
  ======================================================= */

  useEffect(() => {
    const loadProduct =
      async () => {
        setLoading(true);

        setError("");

        setDeliveryPincode(
          deliveryLocation
            ?.pincode ||
            ""
        );

        setDeliveryResult(
          null
        );

        setDeliveryError(
          ""
        );

        try {
          const response =
            await api.get(
              `/catalog/products/${slug}`
            );

          const loadedProduct =
            response.data
              ?.product;

          setProduct(
            loadedProduct ||
              null
          );

          if (
            loadedProduct
              ?.skus
              ?.length
          ) {
            setSelectedSku(
              loadedProduct
                .skus[0]
            );
          } else {
            setSelectedSku(
              null
            );
          }

          setSelectedImage(
            getGalleryUrl(
              loadedProduct
                ?.images?.[0]
            )
          );

          setQuantity(1);

          setActiveInfoTab(
            "description"
          );
        } catch (
          requestError
        ) {
          console.error(
            "Product load error:",
            requestError
          );

          setProduct(
            null
          );
        } finally {
          setLoading(false);
        }
      };

    void loadProduct();
  }, [slug]);

  /* =======================================================
     REVIEW SUMMARY
     Uses the same public review endpoint as the catalogue.
  ======================================================= */

  useEffect(() => {
    if (!product?._id) {
      setReviewSummary(null);
      return;
    }

    let active = true;

    const loadReviewSummary = async () => {
      try {
        const response = await api.get(
          `/reviews/product/${product._id}`,
          {
            params: {
              page: 1,
              limit: 1,
            },
          }
        );

        if (!active) {
          return;
        }

        setReviewSummary(
          response.data?.summary ||
          null
        );
      } catch {
        if (active) {
          setReviewSummary(null);
        }
      }
    };

    void loadReviewSummary();

    return () => {
      active = false;
    };
  }, [product?._id]);

  /* =======================================================
     PRODUCT VIEW ANALYTICS
  ======================================================= */

  useEffect(() => {
    if (
      !product?._id
    ) {
      return;
    }

    const viewKey =
      String(
        product._id
      );

    if (
      trackedProductRef
        .current ===
      viewKey
    ) {
      return;
    }

    trackedProductRef.current =
      viewKey;

    void trackProductView({
      productId:
        product._id,

      skuId:
        selectedSku?._id,

      productSlug:
        product.slug,

      productName:
        product.name,

      source:
        "product_detail",

      pagePath:
        `${location.pathname}${location.search}`,

      location:
        deliveryLocation,
    });
  }, [
    product?._id,
    product?.slug,
    product?.name,
    selectedSku?._id,
    location.pathname,
    location.search,
    deliveryLocation,
  ]);

  /* =======================================================
     RECENTLY VIEWED
  ======================================================= */

  useEffect(() => {
    if (
      !product?.slug
    ) {
      return;
    }

    const existing =
      readLocalArray(
        RECENT_KEY
      );

    const currentEntry = {
      slug:
        product.slug,

      name:
        product.name,

      image:
        getGalleryUrl(
          product
            .images?.[0]
        ),

      price:
        product.minPrice ??
        0,

      category:
        product.category
          ?.name ||
        "",
    };

    const withoutCurrent =
      existing.filter(
        (item) =>
          item.slug !==
          product.slug
      );

    const next = [
      currentEntry,
      ...withoutCurrent,
    ].slice(
      0,
      8
    );

    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(
        next
      )
    );

    setRecentProducts(
      next.filter(
        (item) =>
          item.slug !==
          product.slug
      )
    );
  }, [product]);

  /* =======================================================
     IMAGE MODAL
  ======================================================= */

  useEffect(() => {
    if (
      !zoomImage
    ) {
      return;
    }

    const handleEscape = (
      event
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setZoomImage(
          ""
        );
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape
    );

    document.body.style
      .overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );

      document.body.style
        .overflow =
        "";
    };
  }, [zoomImage]);

  /* =======================================================
     SKU
  ======================================================= */

  const selectSku = (
    sku
  ) => {
    setSelectedSku(
      sku
    );

    setSelectedImage(
      getGalleryUrl(
        sku.images?.[0]
      ) ||
        getGalleryUrl(
          product
            ?.images?.[0]
        )
    );

    setError("");

    setDeliveryResult(
      null
    );

    setDeliveryError(
      ""
    );

    autoDeliveryKeyRef.current =
      "";
  };

  /* =======================================================
     DELIVERY CHECK
  ======================================================= */

  const checkDeliveryForPincode =
    async (
      rawPincode
    ) => {
      const pincode =
        normalizePincode(
          rawPincode
        );

      setDeliveryPincode(
        pincode
      );

      setDeliveryError(
        ""
      );

      setDeliveryResult(
        null
      );

      if (
        !selectedSku?._id
      ) {
        setDeliveryError(
          "Please select a product option first."
        );

        return null;
      }

      if (
        !/^[1-9][0-9]{5}$/.test(
          pincode
        )
      ) {
        setDeliveryError(
          "Enter a valid 6-digit Indian pincode."
        );

        return null;
      }

      setDeliveryChecking(
        true
      );

      try {
        autoDeliveryKeyRef.current =
          `${selectedSku._id}:${pincode}`;

        if (
          deliveryLocation
            ?.pincode !==
          pincode
        ) {
          await resolvePincode(
            pincode
          );
        }

        const response =
          await api.post(
            "/delivery/check",
            {
              skuId:
                selectedSku._id,

              pincode,
            }
          );

        const result =
          response.data
            ?.delivery ||
          null;

        setDeliveryResult(
          result
        );

        return result;
      } catch (
        requestError
      ) {
        setDeliveryError(
          requestError
            .response?.data
            ?.message ||
            requestError
              .message ||
            "Unable to check delivery right now."
        );

        return null;
      } finally {
        setDeliveryChecking(
          false
        );
      }
    };

  const handleDeliverySubmit =
    async (
      event
    ) => {
      event.preventDefault();

      await checkDeliveryForPincode(
        deliveryPincode
      );
    };

  const handleDeliveryPincodeChange =
    (
      event
    ) => {
      setDeliveryPincode(
        normalizePincode(
          event.target.value
        )
      );

      setDeliveryResult(
        null
      );

      setDeliveryError(
        ""
      );
    };

  /* =======================================================
     CURRENT LOCATION
  ======================================================= */

  const handleUseCurrentLocation =
    async () => {
      setDeliveryError(
        ""
      );

      setDeliveryResult(
        null
      );

      setLocationLoading(
        true
      );

      try {
        const detected =
          await detectCurrentLocation();

        const detectedPincode =
          normalizePincode(
            detected?.pincode
          );

        if (
          !/^[1-9][0-9]{5}$/.test(
            detectedPincode
          )
        ) {
          setDeliveryError(
            "We found your location but could not detect its pincode. Please enter it manually."
          );

          return;
        }

        setDeliveryPincode(
          detectedPincode
        );

        await checkDeliveryForPincode(
          detectedPincode
        );
      } catch (
        requestError
      ) {
        setDeliveryError(
          requestError
            ?.message ||
            requestError
              ?.response
              ?.data
              ?.message ||
            "Unable to detect your delivery location. Please enter your pincode manually."
        );
      } finally {
        setLocationLoading(
          false
        );
      }
    };

  /* =======================================================
     SAVED LOCATION AUTO CHECK
  ======================================================= */

  useEffect(() => {
    const pincode =
      normalizePincode(
        deliveryLocation
          ?.pincode
      );

    if (
      !selectedSku?._id ||
      !/^[1-9][0-9]{5}$/.test(
        pincode
      )
    ) {
      return;
    }

    const key =
      `${selectedSku._id}:${pincode}`;

    if (
      autoDeliveryKeyRef
        .current ===
      key
    ) {
      return;
    }

    autoDeliveryKeyRef.current =
      key;

    setDeliveryPincode(
      pincode
    );

    void checkDeliveryForPincode(
      pincode
    );
  }, [
    selectedSku?._id,
    deliveryLocation
      ?.pincode,
  ]);

  /* =======================================================
     PARTNER PROMO CODE
     Backend validated + shared checkout storage
  ======================================================= */

  const handlePromoSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      const code =
        normalizePartnerCode(
          promoCode
        );

      setPromoError(
        ""
      );

      setPromoMessage(
        ""
      );

      if (!code) {
        setPromoError(
          "Enter your partner promo code."
        );

        return;
      }

      if (
        code.length < 4
      ) {
        setPromoError(
          "Enter a valid partner promo code."
        );

        return;
      }

      setPromoApplying(
        true
      );

      try {
        const response =
          await api.get(
            `/partners/referrals/resolve/${encodeURIComponent(
              code
            )}`
          );

        const referral =
          response.data
            ?.referral;

        if (
          !response.data
            ?.valid ||
          !referral
            ?.referralCode
        ) {
          throw new Error(
            "Partner promo code is unavailable."
          );
        }

        const saved =
          storePartnerReferral({
            ...referral,
            source:
              "promo_code",
          });

        if (!saved) {
          throw new Error(
            "Unable to save partner promo code."
          );
        }

        if (
          user &&
          !user.roles
            ?.includes(
              "partner"
            )
        ) {
          try {
            await api.post(
              "/partners/referrals/claim",
              {
                referralCode:
                  saved.referralCode,
                source:
                  "promo_code",
              }
            );
          } catch (
            claimError
          ) {
            if (
              ![
                400,
                404,
                409,
              ].includes(
                claimError
                  .response
                  ?.status
              )
            ) {
              throw claimError;
            }
          }
        }

        setPromoCode(
          saved.referralCode
        );

        setAppliedPromoCode(
          saved.referralCode
        );

        setPromoMessage(
          Number(
            saved.discountPercent ||
              0
          ) > 0
            ? `${saved.discountPercent}% partner discount will be applied to eligible ready-made products at checkout.`
            : "Partner code applied. This code currently has no customer discount."
        );
      } catch (
        requestError
      ) {
        setPromoError(
          requestError
            .response?.data
            ?.message ||
            requestError
              .message ||
            "Unable to apply partner promo code."
        );
      } finally {
        setPromoApplying(
          false
        );
      }
    };

  const handlePromoChange =
    (
      event
    ) => {
      const code =
        normalizePartnerCode(
          event.target.value
        );

      setPromoCode(
        code
      );

      setPromoError(
        ""
      );

      if (
        code !==
        appliedPromoCode
      ) {
        setPromoMessage(
          ""
        );
      }
    };

  const handlePromoClear =
    async () => {
      setPromoError(
        ""
      );

      setPromoMessage(
        ""
      );

      try {
        if (user) {
          await api.delete(
            "/partners/referrals/mine"
          );
        }
      } catch (
        requestError
      ) {
        if (
          ![
            404,
            409,
          ].includes(
            requestError
              .response?.status
          )
        ) {
          setPromoError(
            "Promo removed from this browser, but account referral sync could not be cleared right now."
          );
        }
      } finally {
        clearStoredPartnerReferral();

        setPromoCode(
          ""
        );

        setAppliedPromoCode(
          ""
        );
      }
    };

  /* =======================================================
     PURCHASE VALIDATION
  ======================================================= */

  const validatePurchase =
    () => {
      setError("");

      if (!user) {
        navigate(
          "/login",
          {
            state: {
              from: {
                pathname:
                  `/products/${slug}`,
              },
            },
          }
        );

        return false;
      }

      if (
        !selectedSku
      ) {
        setError(
          "Please select a product option."
        );

        return false;
      }

      if (
        selectedSku
          .deliveryEstimate
          ?.status ===
        "unavailable"
      ) {
        setError(
          "This hamper is currently unavailable."
        );

        return false;
      }

      if (
        deliveryResult &&
        deliveryResult
          .serviceable ===
          false
      ) {
        setError(
          "Delivery is not available to the selected pincode."
        );

        return false;
      }

      if (
        deliveryResult &&
        deliveryResult
          .orderable ===
          false
      ) {
        setError(
          deliveryResult
            .message ||
            "This hamper is currently unavailable."
        );

        return false;
      }

      return true;
    };

  /* =======================================================
     ADD TO CART
  ======================================================= */

  const handleAddToCart =
    async () => {
      if (
        !validatePurchase()
      ) {
        return;
      }

      setAdding(true);

      try {
        await addToCart(
          selectedSku._id,
          quantity,
          {
            source:
              "product_detail",

            pagePath:
              `${location.pathname}${location.search}`,

            location:
              deliveryLocation,
          }
        );

        navigate(
          "/cart"
        );
      } catch (
        requestError
      ) {
        setError(
          requestError
            .response?.data
            ?.message ||
            "Unable to add item to cart"
        );
      } finally {
        setAdding(false);
      }
    };

  /* =======================================================
     BUY NOW
  ======================================================= */

  const handleBuyNow =
    async () => {
      if (
        !validatePurchase()
      ) {
        return;
      }

      setBuying(true);

      try {
        const intent =
          saveBuyNowIntent({
            skuId:
              selectedSku._id,

            quantity,

            productId:
              product._id,

            productSlug:
              product.slug,

            productName:
              product.name,

            skuName:
              selectedSku.name,

            skuCode:
              selectedSku.code,

            image:
              selectedSku
                .images?.[0]
                ?.url ||
              product
                .images?.[0]
                ?.url ||
              "",

            unitPrice:
              selectedSku.price,

            baseSellingPrice:
              selectedSku
                .baseSellingPrice ??
              selectedSku.price,

            taxEnabled:
              selectedSku
                .taxEnabled !==
              false,

            taxPercent:
              selectedSku
                .taxPercent ??
              0,

            hsnSac:
              selectedSku
                .hsnSac ||
              "",

            discount:
              selectedSku
                .discount || {
                enabled:
                  false,

                type:
                  "percentage",

                value:
                  0,
              },

            compareAtPrice:
              selectedSku
                .compareAtPrice,

            optionValues:
              selectedSku
                .optionValues ||
              {},

            // Backend-validated partner promo snapshot for checkout.
            partnerPromoCode:
              appliedPromoCode ||
              "",
          });

        if (!intent) {
          throw new Error(
            "Unable to prepare Buy Now checkout"
          );
        }

        navigate(
          "/checkout?mode=buy-now"
        );
      } catch (
        requestError
      ) {
        setError(
          requestError
            .response?.data
            ?.message ||
            requestError
              .message ||
            "Unable to continue to checkout"
        );
      } finally {
        setBuying(false);
      }
    };

  /* =======================================================
     SHARE
  ======================================================= */

  const handleShare =
    async () => {
      if (!product) {
        return;
      }

      const shareData = {
        title:
          product.name,

        text:
          product
            .shortDescription ||
          `Check out ${product.name} on HAMPORIUM`,

        url:
          window.location
            .href,
      };

      try {
        if (
          navigator.share
        ) {
          await navigator.share(
            shareData
          );

          return;
        }

        await navigator
          .clipboard
          .writeText(
            window.location
              .href
          );

        setShareMessage(
          "Link copied"
        );

        window.setTimeout(
          () =>
            setShareMessage(
              ""
            ),
          2000
        );
      } catch (
        shareError
      ) {
        if (
          shareError?.name !==
          "AbortError"
        ) {
          setShareMessage(
            "Unable to share"
          );

          window.setTimeout(
            () =>
              setShareMessage(
                ""
              ),
            2000
          );
        }
      }
    };

  /* =======================================================
     EARLY RETURNS
  ======================================================= */

  if (
    loading
  ) {
    return (
      <ProductDetailsSkeleton />
    );
  }

  if (
    !product
  ) {
    return (
      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-[#FAF9F6]
          px-5
          py-24
          text-center
        "
        style={{
          fontFamily:
            "'Manrope', Arial, sans-serif",
        }}
      >
        <div className="w-full max-w-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center border border-black/[0.08] bg-white text-[#F97316]">
            <GiftIcon />
          </div>

          <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#F97316]">
            HAMPORIUM
          </p>

          <h1
            style={{
              fontFamily:
                DISPLAY_FONT,
            }}
            className="mt-3 text-[38px] font-semibold leading-none tracking-[-0.035em] text-[#171717] sm:text-[48px]"
          >
            Product not found
          </h1>

          <p className="mx-auto mt-5 max-w-md text-[15px] leading-7 text-black/50">
            This product is not currently available in our catalogue.
          </p>

          <Link
            to="/gifts"
            className="mt-8 inline-flex min-h-[50px] items-center justify-center gap-2 border border-[#171717] bg-[#171717] px-8 text-[12px] font-extrabold uppercase tracking-[0.08em] text-white transition hover:border-[#F97316] hover:bg-[#F97316]"
          >
            Back to Gifts

            <ArrowIcon />
          </Link>
        </div>
      </main>
    );
  }

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const images = (() => {
    const skuImages =
      Array.isArray(
        selectedSku?.images
      )
        ? selectedSku.images
        : [];

    const productImages =
      Array.isArray(
        product?.images
      )
        ? product.images
        : [];

    const seen =
      new Set();

    return [
      ...skuImages,
      ...productImages,
    ]
      .map(
        normalizeGalleryImage
      )
      .filter(
        (image) => {
          if (
            !image?.url ||
            seen.has(
              image.url
            )
          ) {
            return false;
          }

          seen.add(
            image.url
          );

          return true;
        }
      );
  })();

  // Keep the gallery UI ready for multiple images even when
  // the backend currently provides only one image.
  const GALLERY_SLOT_COUNT = 5;

  const gallerySlots =
    images.length >=
    GALLERY_SLOT_COUNT
      ? images
      : [
          ...images,
          ...Array.from(
            {
              length:
                GALLERY_SLOT_COUNT -
                images.length,
            },
            () => null
          ),
        ];

  const displayImage =
    images.some(
      (image) =>
        image.url ===
        selectedImage
    )
      ? selectedImage
      : images[0]?.url ||
        "";

  const deliveryEstimate =
    selectedSku
      ?.deliveryEstimate ||
    null;

  const skuUnavailable =
    deliveryEstimate
      ?.status ===
    "unavailable";

  const deliveryBlocked =
    Boolean(
      deliveryResult &&
        (
          deliveryResult
            .serviceable ===
            false ||
          deliveryResult
            .orderable ===
            false
        )
    );

  const purchaseUnavailable =
    skuUnavailable ||
    deliveryBlocked;

  const hamperContents =
    Array.isArray(
      selectedSku
        ?.hamperContents
    )
      ? selectedSku
          .hamperContents
      : [];

  const selectedContainer =
    selectedSku
      ?.container &&
    typeof selectedSku
      .container ===
      "object"
      ? selectedSku
          .container
      : null;

  const hamperMetrics =
    selectedSku
      ?.hamperMetrics ||
    null;

  const hamperDimensions =
    hamperMetrics
      ?.dimensions ||
    selectedContainer
      ?.outerDimensions ||
    null;

  const hamperWeight =
    hamperMetrics
      ?.hamperWeight ||
    hamperMetrics
      ?.contentWeight ||
    null;

  /* =======================================================
     DELIVERY / EXPIRY
  ======================================================= */

  const earliestExpiryDate =
    selectedSku
      ?.earliestExpiryDate ||
    null;

  const dispatchReadyDate =
    deliveryEstimate
      ?.dispatchReadyDate ||
    null;

  const defaultExpectedDeliveryDate =
    deliveryEstimate
      ?.expectedDeliveryDate ||
    null;

  const locationExpectedDeliveryDate =
    deliveryResult
      ?.expectedDeliveryDate ||
    null;

  const expectedDeliveryDate =
    locationExpectedDeliveryDate ||
    defaultExpectedDeliveryDate;

  const productionLeadDays =
    deliveryEstimate
      ?.productionLeadDays;

  const courierDays =
    deliveryEstimate
      ?.courierDays ??
    deliveryEstimate
      ?.defaultCourierDays;

  const hasProductionLead =
    productionLeadDays !==
      null &&
    productionLeadDays !==
      undefined;

  const hasCourierDays =
    courierDays !==
      null &&
    courierDays !==
      undefined;

  const hasDeliveryFreshnessInfo =
    Boolean(
      earliestExpiryDate ||
      dispatchReadyDate ||
      expectedDeliveryDate ||
      hasProductionLead ||
      hasCourierDays
    );

  const actionBusy =
    adding ||
    buying;

  const activeImageIndex =
    Math.max(
      0,
      images.findIndex(
        (image) =>
          image.url ===
          displayImage
      )
    );

  const reviewAverage =
    Number(
      reviewSummary
        ?.averageRating ||
        0
    );

  const reviewCount =
    Number(
      reviewSummary
        ?.totalReviews ||
        0
    );

  const selectedSizeEntry =
    Object.entries(
      selectedSku
        ?.optionValues ||
        {}
    ).find(
      ([key]) =>
        String(key)
          .trim()
          .toLowerCase() ===
        "size"
    );

  const selectedSize =
    selectedSizeEntry
      ?.[1] ||
    selectedSku?.name ||
    "—";

  const selectedPrice =
    Number(
      selectedSku
        ?.price
    );

  const selectedComparePrice =
    Number(
      selectedSku
        ?.compareAtPrice
    );

  const discountPercent =
    Number.isFinite(
      selectedPrice
    ) &&
    Number.isFinite(
      selectedComparePrice
    ) &&
    selectedComparePrice >
      selectedPrice &&
    selectedComparePrice >
      0
      ? Math.round(
          (
            (
              selectedComparePrice -
              selectedPrice
            ) /
            selectedComparePrice
          ) *
            100
        )
      : 0;

  const deliveryCheckerProps = {
    deliveryPincode,

    deliveryChecking,

    locationLoading,

    selectedSku,

    deliveryLocation,

    deliveryError,

    deliveryResult,

    handleDeliverySubmit,

    handleUseCurrentLocation,

    handleDeliveryPincodeChange,
  };

  const promoBoxProps = {
    promoCode,

    appliedPromoCode,

    promoMessage,

    promoError,

    promoApplying,

    handlePromoSubmit,

    handlePromoChange,

    handlePromoClear,
  };

  return (
    <main
      className="min-h-screen w-full overflow-x-hidden bg-[#FCFAF7] pb-[82px] text-[#191714] sm:pb-0"
      style={{
        fontFamily:
          "'Manrope', Arial, sans-serif",
      }}
    >
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');

          .hp-product-scrollbar {
            scrollbar-width: none;
          }

          .hp-product-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>

      <section className="w-full px-4 pb-16 pt-[96px] sm:px-6 sm:pt-[108px] lg:px-8 lg:pt-[118px] xl:px-10 2xl:px-12">
        {/* ===================================================
            BREADCRUMB
        =================================================== */}

        <nav className="mb-5 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.08em] text-black/32 sm:mb-7 sm:text-[10px]">
          <Link
            to="/"
            className="shrink-0 transition hover:text-[#F47822]"
          >
            Home
          </Link>

          <span>/</span>

          <Link
            to="/gifts"
            className="shrink-0 transition hover:text-[#F47822]"
          >
            Gifts
          </Link>

          {product.category?.name && (
            <>
              <span>/</span>

              <span className="max-w-[160px] truncate">
                {product.category.name}
              </span>
            </>
          )}

          <span>/</span>

          <span className="min-w-0 truncate font-extrabold text-black/60">
            {product.name}
          </span>
        </nav>

        {/* ===================================================
            PRODUCT HERO
        =================================================== */}

        <section className="grid w-full min-w-0 gap-7 lg:grid-cols-[minmax(0,1.12fr)_minmax(440px,.88fr)] lg:items-start lg:gap-9 xl:grid-cols-[minmax(0,1.18fr)_minmax(500px,.82fr)] xl:gap-12 2xl:grid-cols-[minmax(0,1.22fr)_minmax(540px,.78fr)] 2xl:gap-14">
          {/* GALLERY */}

          <div className="min-w-0">
            <div className="grid min-w-0 gap-3 md:grid-cols-[88px_minmax(0,1fr)]">
              {/*
                AMAZON-LIKE THUMBNAIL RAIL
                Always visible on desktop. If backend has only one image,
                the remaining slots stay as elegant placeholders.
              */}
              <div className="hp-product-scrollbar order-2 hidden max-h-[760px] flex-col gap-2 overflow-y-auto pr-1 md:order-1 md:flex">
                {gallerySlots.map(
                  (
                    image,
                    index
                  ) => {
                    const available =
                      Boolean(
                        image?.url
                      );

                    const active =
                      available &&
                      displayImage ===
                        image.url;

                    if (!available) {
                      return (
                        <div
                          key={`empty-gallery-slot-${index}`}
                          aria-label={`Product image slot ${index + 1} is empty`}
                          className="flex h-[82px] w-[82px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-[#DED3C8] bg-[#F8F4EF] text-[#C1B4A8]"
                        >
                          <div className="text-center">
                            <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-[#E4D9CE] bg-white/70">
                              <GiftIcon />
                            </span>

                            <span className="mt-1 block text-[7px] font-black uppercase tracking-[0.08em] text-black/22">
                              Image {index + 1}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={`${image.url}-${index}`}
                        type="button"
                        onMouseEnter={() =>
                          setSelectedImage(
                            image.url
                          )
                        }
                        onFocus={() =>
                          setSelectedImage(
                            image.url
                          )
                        }
                        onClick={() =>
                          setSelectedImage(
                            image.url
                          )
                        }
                        aria-label={`View product image ${index + 1}`}
                        className={`group relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-[14px] border bg-white p-[3px] transition duration-300 ${
                          active
                            ? "border-[#F47822] shadow-[0_8px_22px_rgba(244,120,34,.14)]"
                            : "border-[#E6DDD4] hover:border-[#F47822]/60"
                        }`}
                      >
                        <SafeImage
                          src={
                            image.url
                          }
                          alt={
                            image.alt ||
                            `${product.name} image ${index + 1}`
                          }
                          className="h-full w-full rounded-[10px] object-cover"
                        />

                        {active && (
                          <span className="pointer-events-none absolute inset-x-3 bottom-1 h-[2px] rounded-full bg-[#F47822]" />
                        )}
                      </button>
                    );
                  }
                )}
              </div>

              {/* MAIN IMAGE */}
              <div className="order-1 min-w-0 overflow-hidden rounded-[24px] border border-[#E7DED5] bg-[#F5F0EA] shadow-[0_20px_60px_rgba(45,31,20,.06)] md:order-2">
                <div className="group relative aspect-square overflow-hidden bg-[#F5F0EA]">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        displayImage
                      ) {
                        setZoomImage(
                          displayImage
                        );
                      }
                    }}
                    disabled={
                      !displayImage
                    }
                    className="absolute inset-0 z-[1] block h-full w-full cursor-zoom-in disabled:cursor-default"
                    aria-label="Open product image"
                  >
                    <SafeImage
                      src={
                        displayImage
                      }
                      alt={
                        product.name
                      }
                      className="h-full w-full object-contain object-center transition duration-500 ease-[cubic-bezier(.16,1,.3,1)]"
                      largePlaceholder
                    />
                  </button>

                  {images.length > 0 && (
                    <span className="absolute left-4 top-4 z-10 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-[9px] font-black tracking-[0.08em] text-[#423B35] shadow-sm backdrop-blur">
                      {activeImageIndex + 1} / {images.length}
                    </span>
                  )}

                  {/* Real images only are used by previous/next navigation. */}
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous image"
                        onClick={() => {
                          const next =
                            activeImageIndex <= 0
                              ? images.length - 1
                              : activeImageIndex - 1;

                          setSelectedImage(
                            images[next]?.url ||
                            ""
                          );
                        }}
                        className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-black/[0.08] bg-white/95 text-[26px] font-medium text-black/55 shadow-[0_8px_22px_rgba(0,0,0,.08)] backdrop-blur transition duration-300 hover:scale-105 hover:border-[#F47822] hover:text-[#F47822] sm:left-4 sm:h-12 sm:w-12"
                      >
                        ‹
                      </button>

                      <button
                        type="button"
                        aria-label="Next image"
                        onClick={() => {
                          const next =
                            activeImageIndex >=
                            images.length - 1
                              ? 0
                              : activeImageIndex + 1;

                          setSelectedImage(
                            images[next]?.url ||
                            ""
                          );
                        }}
                        className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-black/[0.08] bg-white/95 text-[26px] font-medium text-black/55 shadow-[0_8px_22px_rgba(0,0,0,.08)] backdrop-blur transition duration-300 hover:scale-105 hover:border-[#F47822] hover:text-[#F47822] sm:right-4 sm:h-12 sm:w-12"
                      >
                        ›
                      </button>
                    </>
                  )}

                  {displayImage && (
                    <button
                      type="button"
                      onClick={() =>
                        setZoomImage(
                          displayImage
                        )
                      }
                      aria-label="Zoom product image"
                      className="absolute bottom-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.08] bg-white/95 text-black/45 shadow-[0_8px_24px_rgba(0,0,0,.08)] transition duration-300 hover:scale-105 hover:border-[#F47822] hover:text-[#F47822]"
                    >
                      <ZoomIcon />
                    </button>
                  )}
                </div>
              </div>

              {/* MOBILE THUMBNAIL RAIL – also shows empty future slots */}
              <div className="hp-product-scrollbar order-3 col-span-full flex gap-2 overflow-x-auto pb-1 pt-1 md:hidden">
                {gallerySlots.map(
                  (
                    image,
                    index
                  ) => {
                    const available =
                      Boolean(
                        image?.url
                      );

                    const active =
                      available &&
                      displayImage ===
                        image.url;

                    if (!available) {
                      return (
                        <div
                          key={`mobile-empty-gallery-slot-${index}`}
                          className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[12px] border border-dashed border-[#DED3C8] bg-[#F8F4EF] text-[#C1B4A8]"
                        >
                          <span className="text-[8px] font-black uppercase tracking-[0.06em] text-black/22">
                            {index + 1}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={`mobile-${image.url}-${index}`}
                        type="button"
                        onClick={() =>
                          setSelectedImage(
                            image.url
                          )
                        }
                        aria-label={`View product image ${index + 1}`}
                        className={`relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-[12px] border bg-white p-[3px] transition ${
                          active
                            ? "border-[#F47822]"
                            : "border-[#E6DDD4]"
                        }`}
                      >
                        <SafeImage
                          src={
                            image.url
                          }
                          alt={
                            image.alt ||
                            `${product.name} image ${index + 1}`
                          }
                          className="h-full w-full rounded-[9px] object-cover"
                        />
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Dots represent actual backend images only. */}
            {images.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-1.5 md:hidden">
                {images.map(
                  (
                    image,
                    index
                  ) => (
                    <button
                      key={`dot-${image.url}-${index}`}
                      type="button"
                      aria-label={`Go to product image ${index + 1}`}
                      onClick={() =>
                        setSelectedImage(
                          image.url
                        )
                      }
                      className={`h-1.5 rounded-full transition-all ${
                        index ===
                        activeImageIndex
                          ? "w-6 bg-[#F47822]"
                          : "w-1.5 bg-black/15"
                      }`}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* PURCHASE PANEL */}

          <div className="min-w-0 w-full lg:sticky lg:top-[104px]">
            <div className="rounded-[24px] border border-[#E7DED5] bg-white p-5 shadow-[0_20px_60px_rgba(45,31,20,.055)] sm:p-6 lg:p-7">
              <div className="flex flex-wrap items-center gap-3">
                {product.category
                  ?.name && (
                  <span className="text-[9px] font-black uppercase tracking-[0.19em] text-[#F47822] sm:text-[10px]">
                    {
                      product.category
                        .name
                    }
                  </span>
                )}

                {product.brand && (
                  <>
                    <span className="h-px w-7 bg-[#D4AF37]" />

                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-black/30">
                      {
                        product.brand
                      }
                    </span>
                  </>
                )}
              </div>

              <h1
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="mt-3 break-words text-[40px] font-semibold leading-[0.93] tracking-[-0.045em] text-[#171411] sm:text-[48px] lg:text-[46px] xl:text-[52px]"
              >
                {product.name}
              </h1>

              {product
                .shortDescription && (
                <p className="mt-4 text-[13px] font-medium leading-6 text-[#726A62] sm:text-[14px] sm:leading-7">
                  {
                    product
                      .shortDescription
                  }
                </p>
              )}

              {/* REAL REVIEW SUMMARY */}

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#EEE5DC] pb-4">
                {reviewCount > 0 ? (
                  <>
                    <div className="flex items-center gap-0.5 text-[15px] text-[#F47822]">
                      {[
                        1,
                        2,
                        3,
                        4,
                        5,
                      ].map(
                        (
                          star
                        ) => (
                          <span
                            key={
                              star
                            }
                            className={
                              star <=
                              Math.round(
                                reviewAverage
                              )
                                ? "opacity-100"
                                : "opacity-20"
                            }
                          >
                            ★
                          </span>
                        )
                      )}
                    </div>

                    <p className="text-[10px] font-black text-[#2B2723]">
                      {
                        reviewAverage.toFixed(
                          1
                        )
                      }
                    </p>

                    <p className="text-[10px] font-semibold text-black/35">
                      (
                      {
                        reviewCount
                      }{" "}
                      reviews)
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] font-semibold text-black/38">
                    Verified customer reviews will appear below.
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex min-h-[31px] items-center gap-2 rounded-full border px-3 text-[9px] font-black uppercase tracking-[0.08em] ${
                    skuUnavailable
                      ? "border-red-200 bg-red-50 text-red-600"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      skuUnavailable
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                  />

                  {skuUnavailable
                    ? "Currently unavailable"
                    : "Available to order"}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2">
                <p className="text-[37px] font-black leading-none tracking-[-0.04em] text-[#171411] sm:text-[41px]">
                  {formatCurrency(
                    selectedSku
                      ?.price ??
                      product.minPrice
                  )}
                </p>

                {selectedSku
                  ?.compareAtPrice &&
                  selectedSku
                    .compareAtPrice >
                    selectedSku
                      .price && (
                    <>
                      <p className="pb-0.5 text-[14px] font-semibold text-black/28 line-through">
                        {formatCurrency(
                          selectedSku
                            .compareAtPrice
                        )}
                      </p>

                      {discountPercent >
                        0 && (
                        <span className="mb-0.5 rounded-full bg-[#FFF0E5] px-3 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#F47822]">
                          {
                            discountPercent
                          }
                          % off
                        </span>
                      )}
                    </>
                  )}
              </div>

              <p className="mt-2 text-[10px] font-semibold leading-5 text-black/30">
                Inclusive of applicable taxes

                {selectedSku
                  ?.taxEnabled !==
                  false &&
                Number(
                  selectedSku
                    ?.taxPercent ||
                    0
                ) > 0
                  ? ` · GST ${selectedSku.taxPercent}%`
                  : ""}

                {selectedSku
                  ?.hsnSac
                  ? ` · HSN/SAC ${selectedSku.hsnSac}`
                  : ""}
              </p>

              {product.skus
                ?.length >
                1 && (
                <div className="mt-5">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/60">
                      Select Option
                    </p>

                    <p className="text-[10px] font-semibold text-black/35">
                      {
                        selectedSku
                          ?.name
                      }
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {product.skus.map(
                      (sku) => {
                        const active =
                          selectedSku
                            ?._id ===
                          sku._id;

                        return (
                          <button
                            key={
                              sku._id
                            }
                            type="button"
                            onClick={() =>
                              selectSku(
                                sku
                              )
                            }
                            className={`min-h-[40px] rounded-xl border px-4 py-2 text-[11px] font-extrabold transition ${
                              active
                                ? "border-[#F47822] bg-[#FFF0E5] text-[#D85D0E]"
                                : "border-[#E5DAD0] bg-[#FCFAF7] text-black/50 hover:border-[#F47822]/50"
                            }`}
                          >
                            {
                              sku.name
                            }
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.08em] text-black/55">
                    Quantity
                  </p>

                  <div className="flex h-[48px] items-center overflow-hidden rounded-xl border border-[#E2D7CC] bg-[#FCFAF7]">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() =>
                        setQuantity(
                          (
                            current
                          ) =>
                            Math.max(
                              1,
                              current -
                                1
                            )
                        )
                      }
                      className="flex h-full flex-1 items-center justify-center text-[20px] text-black/40 transition hover:bg-[#FFF0E5] hover:text-[#F47822]"
                    >
                      −
                    </button>

                    <span className="flex h-full min-w-[58px] items-center justify-center border-x border-[#E8DED5] text-[14px] font-black">
                      {
                        quantity
                      }
                    </span>

                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() =>
                        setQuantity(
                          (
                            current
                          ) =>
                            Math.min(
                              99,
                              current +
                                1
                            )
                        )
                      }
                      className="flex h-full flex-1 items-center justify-center text-[20px] text-black/40 transition hover:bg-[#FFF0E5] hover:text-[#F47822]"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.08em] text-black/55">
                    Size / Variant
                  </p>

                  <div className="flex h-[48px] items-center gap-3 rounded-xl border border-[#E2D7CC] bg-[#FCFAF7] px-4">
                    <span className="text-[#F47822]">
                      <SizeIcon />
                    </span>

                    <p className="min-w-0 truncate text-[12px] font-black">
                      {
                        selectedSize
                      }
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold leading-5 text-red-700">
                  {
                    error
                  }
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={
                    actionBusy ||
                    !selectedSku ||
                    purchaseUnavailable
                  }
                  onClick={
                    handleAddToCart
                  }
                  className="flex min-h-[54px] items-center justify-center gap-3 rounded-xl bg-[#F47822] px-5 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#DE6513] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {adding
                    ? "Adding..."
                    : purchaseUnavailable
                      ? "Unavailable"
                      : "Add to Cart"}

                  {!adding &&
                    !purchaseUnavailable && (
                      <CartIcon />
                    )}
                </button>

                <button
                  type="button"
                  disabled={
                    actionBusy ||
                    !selectedSku ||
                    purchaseUnavailable
                  }
                  onClick={
                    handleBuyNow
                  }
                  className="flex min-h-[54px] items-center justify-center gap-3 rounded-xl bg-[#181818] px-5 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#F47822] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {buying
                    ? "Opening..."
                    : purchaseUnavailable
                      ? "Unavailable"
                      : "Buy Now"}

                  {!buying &&
                    !purchaseUnavailable && (
                      <BoltIcon />
                    )}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={
                    handleShare
                  }
                  className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.08em] text-black/38 transition hover:text-[#F47822]"
                >
                  <ShareIcon />
                  Share Product
                </button>
              </div>

              {shareMessage && (
                <p className="mt-2 text-right text-[9px] font-black uppercase tracking-[0.08em] text-[#F47822]">
                  {
                    shareMessage
                  }
                </p>
              )}

              {/* PARTNER PROMO – functional, compact */}

              <div className="mt-5 border-t border-[#EEE5DC] pt-5">
                <PartnerPromoBox
                  {...promoBoxProps}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================
            PRODUCT DETAILS TABS
        =================================================== */}

        <section className="mt-8 w-full overflow-hidden rounded-[22px] border border-[#E7DED5] bg-white shadow-[0_16px_48px_rgba(45,31,20,.04)]">
          <div className="grid grid-cols-2 border-b border-[#E9E0D7] bg-[#FCFAF7] lg:grid-cols-4">
            <InfoTabButton
              active={
                activeInfoTab ===
                "description"
              }
              onClick={() =>
                setActiveInfoTab(
                  "description"
                )
              }
            >
              Description
            </InfoTabButton>

            <InfoTabButton
              active={
                activeInfoTab ===
                "inside"
              }
              onClick={() =>
                setActiveInfoTab(
                  "inside"
                )
              }
            >
              What's Inside
            </InfoTabButton>

            <InfoTabButton
              active={
                activeInfoTab ===
                "product"
              }
              onClick={() =>
                setActiveInfoTab(
                  "product"
                )
              }
            >
              Product Info
            </InfoTabButton>

            <InfoTabButton
              active={
                activeInfoTab ===
                "delivery"
              }
              onClick={() =>
                setActiveInfoTab(
                  "delivery"
                )
              }
            >
              Delivery & Returns
            </InfoTabButton>
          </div>

          {activeInfoTab ===
            "description" && (
            <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[.9fr_1.1fr] lg:gap-12 lg:p-9">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F47822]">
                  More Than A Hamper
                </p>

                <h2
                  style={{
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                  className="mt-2 text-[34px] font-semibold leading-[0.95] tracking-[-0.035em] sm:text-[40px]"
                >
                  A Moment of
                  Good Taste
                </h2>

                <p className="mt-4 whitespace-pre-line text-[13px] font-medium leading-7 text-[#6F675F] sm:text-[14px]">
                  {product.description ||
                    product.shortDescription ||
                    "Thoughtfully curated and beautifully presented for a memorable gifting experience."}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <MiniPromise
                    icon={
                      <GiftIcon />
                    }
                    text="Gift ready"
                  />

                  <MiniPromise
                    icon={
                      <FreshnessIcon />
                    }
                    text="Thoughtfully curated"
                  />

                  <MiniPromise
                    icon={
                      <DeliveryIcon />
                    }
                    text="Delivery support"
                  />
                </div>
              </div>

              <div className="rounded-[18px] border border-[#ECE3DA] bg-[#FCFAF7] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <h3
                    style={{
                      fontFamily:
                        DISPLAY_FONT,
                    }}
                    className="text-[26px] font-semibold"
                  >
                    Included in the Hamper
                  </h3>

                  {hamperContents.length >
                    0 && (
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-black/30">
                      {
                        hamperContents.length
                      }{" "}
                      items
                    </span>
                  )}
                </div>

                {hamperContents.length >
                0 ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {hamperContents
                      .slice()
                      .sort(
                        (
                          a,
                          b
                        ) =>
                          Number(
                            a.sortOrder ||
                              0
                          ) -
                          Number(
                            b.sortOrder ||
                              0
                          )
                      )
                      .slice(
                        0,
                        4
                      )
                      .map(
                        (
                          item,
                          index
                        ) => {
                          const component =
                            item.component &&
                            typeof item.component ===
                              "object"
                              ? item.component
                              : null;

                          return (
                            <InsidePreviewItem
                              key={
                                item._id ||
                                component?._id ||
                                `${index}-${item.displayName}`
                              }
                              item={
                                item
                              }
                              component={
                                component
                              }
                            />
                          );
                        }
                      )}
                  </div>
                ) : (
                  <p className="mt-4 text-[12px] leading-6 text-black/40">
                    Hamper contents will appear here when configured.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeInfoTab ===
            "inside" && (
            <div className="p-5 sm:p-7 lg:p-9">
              <div className="flex items-end justify-between gap-5 border-b border-[#EEE5DC] pb-5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F47822]">
                    Curated Composition
                  </p>

                  <h2
                    style={{
                      fontFamily:
                        DISPLAY_FONT,
                    }}
                    className="mt-1 text-[34px] font-semibold leading-none"
                  >
                    What's Inside
                  </h2>
                </div>

                <p className="text-[10px] font-semibold text-black/35">
                  {
                    hamperContents.length
                  }{" "}
                  items
                </p>
              </div>

              {hamperContents.length >
              0 ? (
                <div className="mt-5 grid overflow-hidden rounded-[16px] border-l border-t border-[#EAE1D8] md:grid-cols-2">
                  {hamperContents
                    .slice()
                    .sort(
                      (
                        a,
                        b
                      ) =>
                        Number(
                          a.sortOrder ||
                            0
                        ) -
                        Number(
                          b.sortOrder ||
                            0
                        )
                    )
                    .map(
                      (
                        item,
                        index
                      ) => {
                        const component =
                          item.component &&
                          typeof item.component ===
                            "object"
                            ? item.component
                            : null;

                        return (
                          <HamperContentItem
                            key={
                              item._id ||
                              component?._id ||
                              `${index}-${item.displayName}`
                            }
                            item={
                              item
                            }
                            component={
                              component
                            }
                          />
                        );
                      }
                    )}
                </div>
              ) : (
                <p className="mt-6 text-[13px] leading-7 text-black/40">
                  No additional hamper contents are listed for this product.
                </p>
              )}
            </div>
          )}

          {activeInfoTab ===
            "product" && (
            <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-2 lg:gap-12 lg:p-9">
              <div>
                <InfoSectionTitle>
                  Product Information
                </InfoSectionTitle>

                <div className="mt-5">
                  {product.category
                    ?.name && (
                    <LargeInfoRow
                      label="Category"
                      value={
                        product.category
                          .name
                      }
                    />
                  )}

                  {product.brand && (
                    <LargeInfoRow
                      label="Brand"
                      value={
                        product.brand
                      }
                    />
                  )}

                  {selectedSku
                    ?.name && (
                    <LargeInfoRow
                      label="Variant"
                      value={
                        selectedSku
                          .name
                      }
                    />
                  )}

                  {selectedContainer
                    ?.name && (
                    <LargeInfoRow
                      label="Hamper Box"
                      value={
                        selectedContainer
                          .name
                      }
                    />
                  )}

                  <LargeInfoRow
                    label="Hamper Size"
                    value={formatDimensions(
                      hamperDimensions
                    )}
                  />

                  <LargeInfoRow
                    label="Hamper Weight"
                    value={formatWeightValue(
                      hamperWeight
                    )}
                  />
                </div>
              </div>

              <div>
                <InfoSectionTitle>
                  Timing & Freshness
                </InfoSectionTitle>

                <div className="mt-5">
                  {earliestExpiryDate && (
                    <LargeInfoRow
                      label="Earliest Expiry"
                      value={formatDateValue(
                        earliestExpiryDate
                      )}
                    />
                  )}

                  {dispatchReadyDate && (
                    <LargeInfoRow
                      label="Dispatch Ready"
                      value={formatDateValue(
                        dispatchReadyDate
                      )}
                    />
                  )}

                  {defaultExpectedDeliveryDate && (
                    <LargeInfoRow
                      label="Expected Delivery"
                      value={formatDateValue(
                        defaultExpectedDeliveryDate
                      )}
                    />
                  )}

                  {hasProductionLead && (
                    <LargeInfoRow
                      label="Production Lead"
                      value={formatDaysValue(
                        productionLeadDays
                      )}
                    />
                  )}

                  {hasCourierDays && (
                    <LargeInfoRow
                      label="Courier Time"
                      value={formatDaysValue(
                        courierDays
                      )}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeInfoTab ===
            "delivery" && (
            <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[1.15fr_.85fr] lg:p-9">
              <div className="rounded-[18px] border border-[#E9DFD5] bg-[#FCFAF7] p-5">
                <DeliveryChecker
                  {...deliveryCheckerProps}
                />
              </div>

              <div>
                {hasDeliveryFreshnessInfo && (
                  <DeliveryFreshnessSummary
                    earliestExpiryDate={
                      earliestExpiryDate
                    }
                    dispatchReadyDate={
                      dispatchReadyDate
                    }
                    expectedDeliveryDate={
                      expectedDeliveryDate
                    }
                    productionLeadDays={
                      productionLeadDays
                    }
                    courierDays={
                      courierDays
                    }
                    locationSpecific={
                      Boolean(
                        locationExpectedDeliveryDate
                      )
                    }
                    unavailable={
                      skuUnavailable
                    }
                  />
                )}

                <div className="mt-4 rounded-[18px] border border-[#E9DFD5] bg-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F47822]">
                    Returns & Support
                  </p>

                  <p className="mt-3 text-[12px] font-medium leading-6 text-[#6F675F]">
                    Return and refund eligibility follows HAMPORIUM's order and refund policy. Final delivery estimates are confirmed for the selected pincode and hamper configuration.
                  </p>

                  <Link
                    to="/returns-refunds"
                    className="mt-4 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.1em] text-[#171411] transition hover:text-[#F47822]"
                  >
                    View Return Policy
                    <ArrowIcon />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ===================================================
            REVIEWS
            Existing verified-review functionality preserved.
        =================================================== */}

        <div className="mt-14 w-full lg:mt-16">
          <ProductReviewsSection
            productId={
              product._id
            }
          />
        </div>

        {/* ===================================================
            RECENTLY VIEWED
        =================================================== */}

        {recentProducts.length >
          0 && (
          <section className="mt-16 w-full lg:mt-20">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F47822]">
                  You May Also Like
                </p>

                <h2
                  style={{
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                  className="mt-1 text-[36px] font-semibold leading-none tracking-[-0.035em] sm:text-[42px]"
                >
                  Recently Viewed
                </h2>
              </div>

              <Link
                to="/gifts"
                className="hidden items-center gap-2 text-[9px] font-black uppercase tracking-[0.1em] text-[#F47822] transition hover:text-[#171411] sm:inline-flex"
              >
                View All Hampers
                <ArrowIcon />
              </Link>
            </div>

            <div className="hp-product-scrollbar mt-6 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible md:grid-cols-3 lg:grid-cols-4">
              {recentProducts
                .slice(
                  0,
                  4
                )
                .map(
                  (
                    item
                  ) => (
                    <RecentProductCard
                      key={
                        item.slug
                      }
                      item={
                        item
                      }
                    />
                  )
                )}
            </div>
          </section>
        )}
      </section>

      {/* =====================================================
          MOBILE PURCHASE BAR
      ===================================================== */}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.1] bg-white/95 px-3 py-3 shadow-[0_-6px_24px_rgba(0,0,0,.07)] backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-[auto_1fr_1fr] items-center gap-2">
          <div className="pr-2">
            <p className="text-[8px] font-black uppercase tracking-[0.08em] text-black/30">
              Price
            </p>

            <p className="mt-0.5 whitespace-nowrap text-[15px] font-black">
              {formatCurrency(
                selectedSku
                  ?.price ??
                  product.minPrice
              )}
            </p>
          </div>

          <button
            type="button"
            disabled={
              actionBusy ||
              !selectedSku ||
              purchaseUnavailable
            }
            onClick={
              handleAddToCart
            }
            className="h-[48px] rounded-xl bg-[#F47822] px-2 text-[9px] font-black uppercase tracking-[0.06em] text-white disabled:opacity-40"
          >
            {adding
              ? "Adding..."
              : purchaseUnavailable
                ? "Unavailable"
                : "Add Cart"}
          </button>

          <button
            type="button"
            disabled={
              actionBusy ||
              !selectedSku ||
              purchaseUnavailable
            }
            onClick={
              handleBuyNow
            }
            className="h-[48px] rounded-xl bg-[#171717] px-2 text-[9px] font-black uppercase tracking-[0.06em] text-white disabled:opacity-40"
          >
            {buying
              ? "Opening..."
              : purchaseUnavailable
                ? "Unavailable"
                : "Buy Now"}
          </button>
        </div>
      </div>

      {/* =====================================================
          IMAGE MODAL
      ===================================================== */}

      {zoomImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Product image preview"
          onClick={() =>
            setZoomImage(
              ""
            )
          }
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-7"
        >
          <button
            type="button"
            onClick={() =>
              setZoomImage(
                ""
              )
            }
            aria-label="Close image preview"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white text-[#171717] shadow-xl sm:right-6 sm:top-6"
          >
            <CloseIcon />
          </button>

          <div
            onClick={(
              event
            ) =>
              event
                .stopPropagation()
            }
            className="relative flex max-h-[90vh] w-full max-w-[1200px] items-center justify-center"
          >
            <SafeImage
              src={
                zoomImage
              }
              alt={
                product.name
              }
              className="max-h-[90vh] max-w-full object-contain shadow-2xl"
              largePlaceholder
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous zoom image"
                  onClick={() => {
                    const current =
                      Math.max(
                        0,
                        images.findIndex(
                          (image) =>
                            image.url ===
                            zoomImage
                        )
                      );

                    const next =
                      current <= 0
                        ? images.length - 1
                        : current - 1;

                    const url =
                      images[next]?.url ||
                      "";

                    setZoomImage(
                      url
                    );
                    setSelectedImage(
                      url
                    );
                  }}
                  className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[28px] text-black/60 shadow-xl transition hover:text-[#F47822] sm:left-5"
                >
                  ‹
                </button>

                <button
                  type="button"
                  aria-label="Next zoom image"
                  onClick={() => {
                    const current =
                      Math.max(
                        0,
                        images.findIndex(
                          (image) =>
                            image.url ===
                            zoomImage
                        )
                      );

                    const next =
                      current >=
                      images.length - 1
                        ? 0
                        : current + 1;

                    const url =
                      images[next]?.url ||
                      "";

                    setZoomImage(
                      url
                    );
                    setSelectedImage(
                      url
                    );
                  }}
                  className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[28px] text-black/60 shadow-xl transition hover:text-[#F47822] sm:right-5"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

/* =========================================================
   MINI PROMISE
========================================================= */

const MiniPromise = ({
  icon,
  text,
}) => (
  <div className="flex items-center gap-2.5 rounded-full border border-[#E9DFD5] bg-[#FFF9F4] px-3 py-2.5">
    <span className="text-[#F47822]">
      {icon}
    </span>

    <span className="text-[9px] font-black text-[#5F5750]">
      {text}
    </span>
  </div>
);

/* =========================================================
   INSIDE PREVIEW ITEM
========================================================= */

const InsidePreviewItem = ({
  item,
  component,
}) => (
  <div className="flex min-w-0 items-center gap-3 rounded-[12px] border border-[#ECE3DA] bg-white p-3">
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[9px] bg-[#F5F0EA]">
      <SafeImage
        src={
          component
            ?.images?.[0]
            ?.url ||
          ""
        }
        alt={
          item.displayName ||
          component?.name ||
          "Hamper item"
        }
        className="h-full w-full object-cover"
      />
    </div>

    <div className="min-w-0">
      <p className="line-clamp-2 text-[10px] font-black leading-4 text-[#322D28]">
        {item.displayName ||
          component?.name ||
          "Hamper Item"}
      </p>

      <p className="mt-1 text-[9px] font-semibold text-black/35">
        {item.quantity}{" "}
        {item.unit ||
          "pc"}
      </p>

      {component
        ?.expiryDate && (
        <p className="mt-1 text-[8px] font-bold text-[#B37A27]">
          Exp{" "}
          {formatDateValue(
            component
              .expiryDate
          )}
        </p>
      )}
    </div>
  </div>
);

/* =========================================================
   DELIVERY CHECKER
========================================================= */

const DeliveryChecker = ({
  deliveryPincode,
  deliveryChecking,
  locationLoading,
  selectedSku,
  deliveryLocation,
  deliveryError,
  deliveryResult,
  handleDeliverySubmit,
  handleUseCurrentLocation,
  handleDeliveryPincodeChange,
}) => (
  <div className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF3E8] text-[#F97316]">
          <LocationIcon />
        </span>

        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.11em] text-[#171717]">
            Delivery & Location
          </p>

          {deliveryLocation?.pincode && (
            <p className="mt-0.5 text-[9px] font-semibold text-black/35">
              Saved pincode {deliveryLocation.pincode}
            </p>
          )}
        </div>
      </div>

      {deliveryResult?.serviceable === true && deliveryResult?.orderable === true && (
        <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.07em] text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Available
        </span>
      )}
    </div>

    <form
      onSubmit={handleDeliverySubmit}
      className="mt-4 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_170px]"
    >
      <div className="relative min-w-0">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-black/28">
          <PinIcon />
        </span>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          value={deliveryPincode}
          onChange={handleDeliveryPincodeChange}
          placeholder="Enter 6-digit pincode"
          className="h-[50px] w-full border border-black/[0.10] bg-[#FCFBF9] pl-12 pr-4 text-[13px] font-bold text-[#171717] outline-none transition placeholder:font-medium placeholder:text-black/25 focus:border-[#F97316] focus:bg-white"
        />
      </div>

      <button
        type="submit"
        disabled={
          deliveryChecking ||
          locationLoading ||
          !selectedSku
        }
        className="flex h-[50px] items-center justify-center gap-2 bg-[#171717] px-4 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {deliveryChecking ? (
          <>
            <SpinnerIcon />
            Checking
          </>
        ) : (
          "Check Delivery"
        )}
      </button>
    </form>

    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <button
        type="button"
        disabled={locationLoading || deliveryChecking}
        onClick={handleUseCurrentLocation}
        className="inline-flex items-center gap-2 text-[9px] font-extrabold text-[#F97316] transition hover:text-[#171717] disabled:opacity-40"
      >
        {locationLoading ? <SpinnerIcon /> : <LocateIcon />}
        {locationLoading ? "Detecting..." : "Use current location"}
      </button>

      {deliveryError && (
        <p className="text-[9px] font-semibold text-red-600">
          {deliveryError}
        </p>
      )}
    </div>

    {deliveryResult && (
      <DeliveryResult delivery={deliveryResult} />
    )}
  </div>
);

/* =========================================================
   PARTNER PROMO BOX
========================================================= */

const PartnerPromoBox = ({
  promoCode,
  appliedPromoCode,
  promoMessage,
  promoError,
  promoApplying,
  handlePromoSubmit,
  handlePromoChange,
  handlePromoClear,
}) => (
  <div className="min-w-0">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF8E8] text-[#B08A2E]">
          <PromoIcon />
        </span>

        <p className="text-[11px] font-extrabold uppercase tracking-[0.11em] text-[#171717]">
          Partner Promo
        </p>
      </div>

      {appliedPromoCode && !promoError && (
        <span className="text-[9px] font-extrabold uppercase tracking-[0.07em] text-emerald-700">
          Applied
        </span>
      )}
    </div>

    <form
      onSubmit={handlePromoSubmit}
      className="mt-4 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_128px] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_128px]"
    >
      <div className="relative min-w-0">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#B08A2E]">
          <TicketIcon />
        </span>

        <input
          type="text"
          value={promoCode}
          onChange={handlePromoChange}
          autoComplete="off"
          placeholder="Partner code"
          className="h-[50px] w-full border border-black/[0.10] bg-[#FCFBF9] pl-12 pr-4 text-[12px] font-extrabold uppercase tracking-[0.05em] text-[#171717] outline-none transition placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-black/25 focus:border-[#D4AF37] focus:bg-white"
        />
      </div>

      <button
        type="submit"
        disabled={promoApplying}
        className="flex h-[50px] items-center justify-center bg-[#B58C2C] px-4 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {promoApplying
          ? "Applying..."
          : appliedPromoCode === promoCode && appliedPromoCode
            ? "Applied"
            : "Apply"}
      </button>
    </form>

    {appliedPromoCode && (
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3 border-l-2 border-emerald-500 pl-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black text-emerald-800">
            {appliedPromoCode}
          </p>

          {promoMessage && !promoError && (
            <p className="mt-0.5 line-clamp-1 text-[9px] font-medium text-black/40">
              {promoMessage}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handlePromoClear}
          className="shrink-0 text-[8px] font-black uppercase tracking-[0.06em] text-red-500 transition hover:text-red-700"
        >
          Remove
        </button>
      </div>
    )}

    {promoError && (
      <p className="mt-3 text-[9px] font-semibold text-red-600">
        {promoError}
      </p>
    )}
  </div>
);

/* =========================================================
   DELIVERY & FRESHNESS
========================================================= */

const DeliveryFreshnessSummary = ({
  earliestExpiryDate,
  dispatchReadyDate,
  expectedDeliveryDate,
  productionLeadDays,
  courierDays,
  locationSpecific = false,
  unavailable = false,
}) => {
  const hasProductionLead =
    productionLeadDays !==
      null &&
    productionLeadDays !==
      undefined;

  const hasCourierDays =
    courierDays !==
      null &&
    courierDays !==
      undefined;

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#E9DFD5] bg-white">
      <div className="flex items-start gap-3 border-b border-black/[0.07] bg-[#FFF9F3] px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#D4AF37]/20 bg-white text-[#B08A2E]">
          <CalendarIcon />
        </span>

        <div>
          <p className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#272727]">
            Delivery & Freshness
          </p>

          <p className="mt-0.5 text-[10px] leading-5 text-black/38">
            Current estimate for this hamper configuration
          </p>
        </div>
      </div>

      <div className="flex flex-wrap">
        {expectedDeliveryDate && (
          <SummaryInfoBox
            label={
              locationSpecific
                ? "Delivery to your location"
                : "Expected Delivery"
            }
            value={formatDateValue(
              expectedDeliveryDate
            )}
            icon={
              <DeliveryIcon />
            }
          />
        )}

        {earliestExpiryDate && (
          <SummaryInfoBox
            label="Earliest Expiry"
            value={formatDateValue(
              earliestExpiryDate
            )}
            icon={
              <FreshnessIcon />
            }
            gold
          />
        )}

        {dispatchReadyDate && (
          <SummaryInfoBox
            label="Dispatch Ready"
            value={formatDateValue(
              dispatchReadyDate
            )}
            icon={
              <BoxReadyIcon />
            }
          />
        )}

        {hasProductionLead && (
          <SummaryInfoBox
            label="Production Lead"
            value={formatDaysValue(
              productionLeadDays
            )}
            icon={
              <ClockIcon />
            }
          />
        )}

        {hasCourierDays && (
          <SummaryInfoBox
            label="Courier Time"
            value={formatDaysValue(
              courierDays
            )}
            icon={
              <DeliveryIcon />
            }
          />
        )}
      </div>

      {unavailable && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-[11px] font-semibold leading-5 text-red-700">
          A reliable delivery estimate cannot currently be guaranteed because one or more required materials are unavailable.
        </div>
      )}
    </div>
  );
};

const SummaryInfoBox = ({
  label,
  value,
  icon,
  gold = false,
}) => (
  <div className="flex min-h-[78px] min-w-[165px] flex-1 basis-[180px] items-center gap-3 border-b border-r border-black/[0.06] px-4 py-3">
    <span
      className={`
        flex
        h-9
        w-9
        shrink-0
        items-center
        justify-center
        border

        ${
          gold
            ? "border-[#D4AF37]/20 bg-[#FFF9E9] text-[#B08A2E]"
            : "border-orange-100 bg-[#FFF6EF] text-[#F97316]"
        }
      `}
    >
      {icon}
    </span>

    <div className="min-w-0">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-black/35">
        {label}
      </p>

      <p className="mt-1 break-words text-[13px] font-extrabold text-[#252525]">
        {value}
      </p>
    </div>
  </div>
);

/* =========================================================
   DELIVERY RESULT
========================================================= */

const DeliveryResult = ({
  delivery,
}) => {
  const serviceable =
    delivery?.serviceable === true;

  const orderable =
    delivery?.orderable === true;

  const available =
    serviceable && orderable;

  const locationText = [
    delivery?.city,
    delivery?.state,
  ]
    .filter(Boolean)
    .join(", ");

  if (available) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-emerald-500 pl-3">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <SuccessIcon />
        </span>

        <p className="text-[10px] font-extrabold text-emerald-800">
          Delivery available{locationText ? ` to ${locationText}` : ""}
        </p>

        <p className="text-[9px] font-medium text-black/40">
          {delivery.pincode ? `Pincode ${delivery.pincode}` : ""}
          {delivery.expectedDeliveryDate
            ? `${delivery.pincode ? " · " : ""}Expected by ${formatDateValue(
                delivery.expectedDeliveryDate
              )}`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-start gap-2 border-l-2 border-amber-400 pl-3">
      <span className="mt-0.5 shrink-0 text-amber-600">
        <InfoIcon />
      </span>

      <p className="text-[9px] font-semibold leading-5 text-amber-800">
        {delivery?.message ||
          "Delivery is currently unavailable for this pincode."}
      </p>
    </div>
  );
};

/* =========================================================
   SAFE IMAGE
========================================================= */

const SafeImage = ({
  src,
  alt,
  className = "",
  largePlaceholder = false,
}) => {
  const [
    failed,
    setFailed,
  ] = useState(false);

  useEffect(() => {
    setFailed(
      false
    );
  }, [src]);

  if (
    !src ||
    failed
  ) {
    return (
      <div
        className={`
          flex
          items-center
          justify-center
          bg-[#F3F1EC]
          text-[#F97316]

          ${className}
        `}
      >
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center border border-black/[0.06] bg-white">
            <GiftIcon />
          </span>

          {largePlaceholder && (
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.05em] text-black/30">
              Image unavailable
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <img
      src={
        src
      }
      alt={
        alt
      }
      onError={() =>
        setFailed(
          true
        )
      }
      className={
        className
      }
    />
  );
};

/* =========================================================
   TAB BUTTON
========================================================= */

const InfoTabButton = ({
  active,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={
      onClick
    }
    className={`relative min-h-[58px] border-r border-[#E9E0D7] px-3 text-center text-[11px] font-extrabold transition last:border-r-0 sm:min-h-[64px] sm:text-[12px] lg:text-[13px] ${
      active
        ? "bg-white text-[#F47822]"
        : "bg-[#FCFAF7] text-black/36 hover:bg-white hover:text-black/65"
    }`}
  >
    {children}

    <span
      className={`absolute bottom-0 left-0 h-[2px] transition-all ${
        active
          ? "w-full bg-[#F47822]"
          : "w-0"
      }`}
    />
  </button>
);

/* =========================================================
   SECTION TITLE
========================================================= */

const InfoSectionTitle = ({
  children,
}) => (
  <div className="flex items-center gap-3">
    <span className="h-6 w-[3px] shrink-0 bg-[#F97316]" />

    <h3 className="text-[16px] font-extrabold uppercase tracking-[0.05em] text-[#262626] sm:text-[18px]">
      {children}
    </h3>
  </div>
);

/* =========================================================
   INFO ROW
========================================================= */

const LargeInfoRow = ({
  label,
  value,
}) => (
  <div className="grid gap-1.5 border-b border-black/[0.07] py-4 sm:grid-cols-[minmax(135px,190px)_minmax(0,1fr)] sm:items-start sm:gap-6 sm:py-5">
    <p className="text-[12px] font-bold uppercase tracking-[0.05em] leading-6 text-black/38 sm:text-[13px]">
      {label}
    </p>

    <p className="min-w-0 break-words text-[14px] font-semibold leading-6 text-[#393939] sm:text-[15px] sm:leading-7">
      {value}
    </p>
  </div>
);

/* =========================================================
   HAMPER CONTENT ITEM
========================================================= */

const HamperContentItem = ({
  item,
  component,
}) => (
  <details className="group min-w-0 border-b border-r border-black/[0.07] bg-[#FDFCFB] transition open:bg-white hover:bg-white">
    <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
      <div className="h-[68px] w-[68px] shrink-0 overflow-hidden border border-black/[0.06] bg-[#F4F2EE]">
        <SafeImage
          src={
            component
              ?.images?.[0]
              ?.url ||
            ""
          }
          alt={
            item.displayName ||
            component?.name ||
            "Hamper Item"
          }
          className="h-full w-full object-cover"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="break-words text-[13px] font-extrabold leading-5 text-[#303030] sm:text-[14px]">
          {item.displayName ||
            component?.name ||
            "Hamper Item"}
        </p>

        {component
          ?.brand && (
          <p className="mt-1 truncate text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#F97316] sm:text-[10px]">
            {
              component.brand
            }
          </p>
        )}

        <p className="mt-1.5 text-[11px] font-semibold text-black/38">
          Qty{" "}
          {
            item.quantity
          }{" "}
          {item.unit ||
            "pc"}
        </p>

        {component
          ?.expiryDate && (
          <p className="mt-1 text-[10px] font-bold text-[#B08A2E]">
            Best before{" "}
            {formatDateValue(
              component
                .expiryDate
            )}
          </p>
        )}
      </div>

      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-black/[0.07] bg-white text-black/30 transition group-open:rotate-180 group-open:border-[#F97316] group-open:text-[#F97316]">
        <ChevronIcon />
      </span>
    </summary>

    {component && (
      <div className="border-t border-black/[0.06] bg-white px-4 pb-4 pt-3">
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {component
            .dimensions && (
            <ContentMeta
              label="Size"
              value={formatDimensions(
                component
                  .dimensions
              )}
            />
          )}

          {component
            .weight && (
            <ContentMeta
              label="Weight"
              value={formatWeightValue(
                component
                  .weight
              )}
            />
          )}

          {component
            .dietary && (
            <ContentMeta
              label="Dietary"
              value={
                component.dietary
              }
            />
          )}

          {component
            .expiryDate && (
            <ContentMeta
              label="Expiry"
              value={formatDateValue(
                component
                  .expiryDate
              )}
            />
          )}

          {component
            .expiryTracked &&
            component
              .shelfLifeDays !==
              null &&
            component
              .shelfLifeDays !==
              undefined && (
              <ContentMeta
                label="Shelf Life"
                value={formatDaysValue(
                  component
                    .shelfLifeDays
                )}
              />
            )}
        </div>
      </div>
    )}
  </details>
);

const ContentMeta = ({
  label,
  value,
}) => (
  <p className="break-words text-[12px] leading-5 text-black/48 sm:text-[13px]">
    <span className="font-extrabold text-black/62">
      {label}:
    </span>{" "}

    {value}
  </p>
);

/* =========================================================
   RECENT PRODUCT
========================================================= */

const RecentProductCard = ({
  item,
}) => (
  <Link
    to={`/products/${item.slug}`}
    className="group w-[78vw] max-w-[310px] shrink-0 overflow-hidden rounded-[18px] border border-[#E8DED5] bg-white shadow-[0_10px_28px_rgba(45,31,20,.04)] transition duration-300 hover:-translate-y-1 hover:border-[#E0C8B1] hover:shadow-[0_18px_42px_rgba(45,31,20,.07)] sm:w-auto sm:max-w-none"
  >
    <div className="aspect-[1.35/1] overflow-hidden bg-[#F4F0EB]">
      <SafeImage
        src={
          item.image
        }
        alt={
          item.name
        }
        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
      />
    </div>

    <div className="p-4">
      {item.category && (
        <p className="truncate text-[8px] font-black uppercase tracking-[0.14em] text-[#F47822]">
          {
            item.category
          }
        </p>
      )}

      <p className="mt-1.5 line-clamp-2 min-h-[38px] text-[12px] font-black leading-[19px] text-[#2D2824]">
        {
          item.name
        }
      </p>

      <p className="mt-3 text-[15px] font-black">
        {formatCurrency(
          item.price
        )}
      </p>
    </div>
  </Link>
);

/* =========================================================
   SKELETON
========================================================= */

const ProductDetailsSkeleton =
  () => (
    <main className="min-h-screen bg-[#FAF9F6] px-4 pb-16 pt-[100px] sm:px-6 lg:px-8 lg:pt-[118px]">
      <div className="w-full">
        <div className="mb-7 h-4 w-52 animate-pulse bg-black/[0.04]" />

        <div className="grid gap-9 xl:grid-cols-[1.08fr_.92fr] xl:gap-10">
          <div className="aspect-square animate-pulse border border-black/[0.05] bg-black/[0.05]" />

          <div>
            <div className="h-3 w-28 animate-pulse bg-[#F97316]/15" />

            <div className="mt-5 h-12 w-4/5 animate-pulse bg-black/[0.06]" />

            <div className="mt-3 h-12 w-3/5 animate-pulse bg-black/[0.05]" />

            <div className="mt-7 h-4 w-full animate-pulse bg-black/[0.04]" />

            <div className="mt-3 h-4 w-4/5 animate-pulse bg-black/[0.04]" />

            <div className="mt-9 h-12 w-40 animate-pulse bg-black/[0.06]" />
          </div>
        </div>
      </div>
    </main>
  );

/* =========================================================
   ICON BASE
========================================================= */

const IconBase = ({
  children,
  className =
    "h-[18px] w-[18px]",
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={
      className
    }
  >
    {children}
  </svg>
);

/* =========================================================
   ICONS
========================================================= */

const GiftIcon = () => (
  <IconBase>
    <path d="M4 9h16v11H4V9ZM12 9v11M4 13h16" />

    <path d="M12 9C9 9 7 8 7 6.2 7 5 7.9 4 9.1 4c1.8 0 2.8 2.4 2.9 5ZM12 9c3 0 5-1 5-2.8C17 5 16.1 4 14.9 4c-1.8 0-2.8 2.4-2.9 5Z" />
  </IconBase>
);

const DeliveryIcon = () => (
  <IconBase>
    <path d="M3 6h11v10H3z" />

    <path d="M14 9h4l3 3v4h-7z" />

    <circle
      cx="7"
      cy="18"
      r="2"
    />

    <circle
      cx="18"
      cy="18"
      r="2"
    />
  </IconBase>
);

const SizeIcon = () => (
  <IconBase>
    <path d="M5 19V5M5 5l3 3M5 5l-3 3" />

    <path d="M5 19h14M19 19l-3-3M19 19l-3 3" />
  </IconBase>
);

const CartIcon = () => (
  <IconBase>
    <circle
      cx="9"
      cy="20"
      r="1"
    />

    <circle
      cx="18"
      cy="20"
      r="1"
    />

    <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H6" />
  </IconBase>
);

const BoltIcon = () => (
  <IconBase>
    <path d="M13 2 5 13h6l-1 9 9-13h-6V2Z" />
  </IconBase>
);

const ZoomIcon = () => (
  <IconBase>
    <circle
      cx="11"
      cy="11"
      r="6"
    />

    <path d="m16 16 4 4M8 11h6M11 8v6" />
  </IconBase>
);

const ShareIcon = () => (
  <IconBase>
    <circle
      cx="18"
      cy="5"
      r="2.5"
    />

    <circle
      cx="6"
      cy="12"
      r="2.5"
    />

    <circle
      cx="18"
      cy="19"
      r="2.5"
    />

    <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
  </IconBase>
);

const LocationIcon = () => (
  <IconBase>
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

    <circle
      cx="12"
      cy="10"
      r="2.5"
    />
  </IconBase>
);

const PinIcon = () => (
  <IconBase className="h-[17px] w-[17px]">
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

    <circle
      cx="12"
      cy="10"
      r="2"
    />
  </IconBase>
);

const LocateIcon = () => (
  <IconBase className="h-[16px] w-[16px]">
    <circle
      cx="12"
      cy="12"
      r="4"
    />

    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </IconBase>
);

const PromoIcon = () => (
  <IconBase>
    <path d="M4 7h16v10H4V7Z" />

    <path d="M9 7a3 3 0 0 1 6 0" />

    <path d="M8 12h8" />

    <path d="M12 9v6" />
  </IconBase>
);

const TicketIcon = () => (
  <IconBase className="h-[17px] w-[17px]">
    <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z" />

    <path d="M12 8v8" />
  </IconBase>
);

const CalendarIcon = () => (
  <IconBase>
    <rect
      x="4"
      y="5"
      width="16"
      height="15"
      rx="1"
    />

    <path d="M8 3v4M16 3v4M4 10h16" />
  </IconBase>
);

const FreshnessIcon = () => (
  <IconBase>
    <path d="M12 21c5-3 7-7 7-12-5 0-8 2-10 6" />

    <path d="M12 21C7 18 5 14 5 9c4 0 7 1.5 9 5" />

    <path d="M12 21v-7" />
  </IconBase>
);

const ClockIcon = () => (
  <IconBase>
    <circle
      cx="12"
      cy="12"
      r="8"
    />

    <path d="M12 7v5l3 2" />
  </IconBase>
);

const BoxReadyIcon = () => (
  <IconBase>
    <path d="m12 3 8 4-8 4-8-4 8-4Z" />

    <path d="M4 7v10l8 4 8-4V7" />

    <path d="M12 11v10" />

    <path d="m16 12 1.5 1.5L21 10" />
  </IconBase>
);

const ChevronIcon = () => (
  <IconBase className="h-4 w-4">
    <path d="m6 9 6 6 6-6" />
  </IconBase>
);

const CloseIcon = () => (
  <IconBase>
    <path d="m6 6 12 12M18 6 6 18" />
  </IconBase>
);

const InfoIcon = () => (
  <IconBase>
    <circle
      cx="12"
      cy="12"
      r="9"
    />

    <path d="M12 11v5M12 8h.01" />
  </IconBase>
);

const SuccessIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-3.5 w-3.5"
  >
    <path d="m5 10 3 3 7-7" />
  </svg>
);

const SpinnerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 animate-spin"
    fill="none"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="2"
      className="opacity-25"
    />

    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="opacity-90"
    />
  </svg>
);

const ArrowIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <path d="M5 10h10M12 7l3 3-3 3" />
  </svg>
);

export default ProductDetails;