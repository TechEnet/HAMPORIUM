import { useEffect, useRef, useState } from "react";

import { Navigate, useLocation, useNavigate } from "react-router-dom";



import api from "../../api/api.js";
import PromoCodeField from "../../components/PromoCodeField.jsx";

import { useAuth } from "../../context/AuthContext.jsx";

import { useCart } from "../../context/CartContext.jsx";

import { useDeliveryLocation } from "../../context/LocationContext.jsx";

import formatCurrency from "../../utils/formatCurrency.js";

import { buildAnalyticsPayload } from "../../utils/analytics.js";

import {

  clearBuyNowIntent,

  getBuyNowIntent,

} from "../../utils/buyNow.js";

import {

  clearStoredPartnerReferral,

  getStoredPartnerReferral,

  storePartnerReferral,

} from "../../utils/partnerReferral.js";

import {
  clearStoredAppliedPromotion,
  getStoredAppliedPromotion,
  storeAppliedPromotion,
} from "../../utils/appliedPromo.js";



let razorpayScriptPromise = null;



const DISPLAY_FONT =

  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";



const roundMoney = (value) =>

  Math.round(Number(value || 0) * 100) / 100;



const formatExpectedDeliveryDate = (value) => {

  if (!value) return "—";



  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";



  return new Intl.DateTimeFormat("en-IN", {

    weekday: "short",

    day: "2-digit",

    month: "short",

    year: "numeric",

  }).format(date);

};



const getPublicDeliveryError = (requestError) => {

  const rawMessage = String(

    requestError?.response?.data?.message ||

      requestError?.message ||

      ""

  ).trim();



  if (

    /default courier days|set courier days in admin|courier days configured/i.test(

      rawMessage

    )

  ) {

    return "Expected delivery is temporarily unavailable for this item. Please try again shortly.";

  }



  return (

    rawMessage ||

    "Unable to calculate expected delivery for this address."

  );

};



const loadRazorpay = () => {

  if (window.Razorpay) return Promise.resolve(true);

  if (razorpayScriptPromise) return razorpayScriptPromise;



  razorpayScriptPromise = new Promise((resolve) => {

    const existingScript = document.querySelector(

      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'

    );



    if (existingScript) {

      existingScript.addEventListener("load", () => resolve(true), {

        once: true,

      });

      existingScript.addEventListener("error", () => resolve(false), {

        once: true,

      });

      return;

    }



    const script = document.createElement("script");

    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.async = true;

    script.onload = () => resolve(true);

    script.onerror = () => resolve(false);

    document.body.appendChild(script);

  });



  return razorpayScriptPromise;

};



const sleep = (milliseconds) =>

  new Promise((resolve) => {

    setTimeout(resolve, milliseconds);

  });



const Checkout = () => {

  const navigate = useNavigate();

  const location = useLocation();



  const { user } = useAuth();

  const { cart, refreshCart } = useCart();

  const {

    deliveryLocation,

    applyDeliveryLocation,

  } = useDeliveryLocation();



  const isBuyNow =

    new URLSearchParams(location.search).get("mode") ===

    "buy-now";



  const [buyNowIntent] = useState(() =>

    isBuyNow ? getBuyNowIntent() : null

  );



  const checkoutKey = useRef(crypto.randomUUID());



  const [addresses, setAddresses] = useState([]);

  const [addressId, setAddressId] = useState("");



  const [recipientName, setRecipientName] = useState(user?.name || "");

  const [recipientPhone, setRecipientPhone] = useState(user?.phone || "");



  const [giftMessage, setGiftMessage] = useState("");



  const [deliveryEstimate, setDeliveryEstimate] = useState(null);

  const [deliveryLoading, setDeliveryLoading] = useState(false);

  const [deliveryError, setDeliveryError] = useState("");



  const [loading, setLoading] = useState(true);

  const [paying, setPaying] = useState(false);

  const [error, setError] = useState("");



  const [partnerReferral, setPartnerReferral] = useState(() =>
    getStoredPartnerReferral()
  );
  const [promoCode, setPromoCode] = useState(() =>
    getStoredAppliedPromotion()?.code || ""
  );
  const [appliedPromo, setAppliedPromo] = useState(() =>
    getStoredAppliedPromotion()
  );
  const [promoLoading, setPromoLoading] = useState(() =>
    Boolean(
      getStoredPartnerReferral()?.referralCode ||
        getStoredAppliedPromotion()?.code
    )
  );
  const [promoWarning, setPromoWarning] = useState("");
  const [promotionQuote, setPromotionQuote] = useState(null);
  const [promotionQuoteLoading, setPromotionQuoteLoading] = useState(false);



  const deliveryFingerprint = isBuyNow

    ? `${buyNowIntent?.skuId || ""}:${buyNowIntent?.quantity || 1}`

    : (cart.items || [])

        .map((item) =>

          [

            item.cartItemId || item._id || item.sku?._id || item.sku || "",

            item.itemType || "sku",

            item.quantity || 1,

          ].join(":")

        )

        .join("|");



  useEffect(() => {

    const loadAddresses = async () => {

      try {

        const response = await api.get("/users/addresses");

        const loadedAddresses = response.data.addresses || [];



        setAddresses(loadedAddresses);



        const locationMatchedAddress = deliveryLocation?.pincode

          ? loadedAddresses.find(

              (address) =>

                String(address.postalCode || "") ===

                String(deliveryLocation.pincode)

            )

          : null;



        const defaultAddress =

          locationMatchedAddress ||

          loadedAddresses.find((address) => address.isDefault) ||

          loadedAddresses[0];



        if (defaultAddress) {

          setAddressId(defaultAddress._id);



          if (!recipientName) {

            setRecipientName(defaultAddress.fullName || "");

          }



          if (!recipientPhone) {

            setRecipientPhone(defaultAddress.phone || "");

          }

        }

      } catch (requestError) {

        setError(

          requestError.response?.data?.message || "Unable to load addresses"

        );

      } finally {

        setLoading(false);

      }

    };



    void loadAddresses();

  }, []);



  /* =====================================================

     VALIDATE SAVED PARTNER / PROMO CODE

  ===================================================== */

  useEffect(() => {
    let active = true;

    const validateSavedCode = async () => {
      const storedPartner = getStoredPartnerReferral();
      const storedPromotion = getStoredAppliedPromotion();
      const partnerCode = String(storedPartner?.referralCode || "")
        .trim()
        .toUpperCase();
      const promotionCode = String(storedPromotion?.code || "")
        .trim()
        .toUpperCase();

      setPromoWarning("");

      // Defensive fail-closed rule: never auto-restore two code types.
      if (partnerCode && promotionCode) {
        clearStoredAppliedPromotion();
        if (!active) return;
        setAppliedPromo(null);
        setPromoCode("");
        setPromoWarning(
          "A saved partner code is already active. Remove it before using another promotion."
        );
      }

      if (partnerCode) {
        setPromoLoading(true);
        try {
          const response = await api.post("/promotions/code/preview", {
            code: partnerCode,
          });
          const referral = response.data?.referral;

          if (
            !response.data?.valid ||
            response.data?.kind !== "partner" ||
            !referral?.referralCode
          ) {
            throw new Error("Partner promo code is unavailable.");
          }

          const saved = storePartnerReferral({
            ...storedPartner,
            ...referral,
            source: storedPartner?.source || "promo_code",
          });

          if (!active) return;
          setPartnerReferral(saved);
          setAppliedPromo(null);
          setPromoCode("");
          return;
        } catch (requestError) {
          clearStoredPartnerReferral();
          if (!active) return;
          setPartnerReferral(null);
          setPromoWarning(
            requestError.response?.data?.message ||
              "The saved partner code is no longer valid and has been removed."
          );
        } finally {
          if (active) setPromoLoading(false);
        }
      }

      if (promotionCode) {
        setPromoLoading(true);
        try {
          const response = await api.post("/promotions/code/preview", {
            code: promotionCode,
          });

          if (
            !response.data?.valid ||
            response.data?.kind !== "promotion" ||
            !response.data?.promotion?.code
          ) {
            throw new Error("Promotion code is unavailable.");
          }

          const promotion = response.data.promotion;
          const restored = {
            kind: "promotion",
            code: String(promotion.code || promotionCode).trim().toUpperCase(),
            title: promotion.name || "HAMPORIUM offer",
            detail: storedPromotion?.detail || "Offer code accepted.",
            data: promotion,
          };

          storeAppliedPromotion(restored);
          if (!active) return;
          setPartnerReferral(null);
          setAppliedPromo(restored);
          setPromoCode(restored.code);
        } catch (requestError) {
          clearStoredAppliedPromotion();
          if (!active) return;
          setAppliedPromo(null);
          setPromoCode("");
          setPromoWarning(
            requestError.response?.data?.message ||
              "The saved promotion code is no longer valid and has been removed."
          );
        } finally {
          if (active) setPromoLoading(false);
        }
        return;
      }

      if (active) {
        setPartnerReferral(null);
        setPromoLoading(false);
      }
    };

    void validateSavedCode();

    return () => {
      active = false;
    };
  }, []);

  /* =====================================================

     SERVER-CALCULATED CHECKOUT DELIVERY

  ===================================================== */



  useEffect(() => {

    if (

      loading ||

      !addressId ||

      (isBuyNow && !buyNowIntent?.skuId) ||

      (!isBuyNow && !cart.items?.length)

    ) {

      setDeliveryEstimate(null);

      setDeliveryError("");

      return undefined;

    }



    let active = true;



    const loadDeliveryEstimate = async () => {

      setDeliveryLoading(true);

      setDeliveryError("");



      try {

        const response = await api.post("/orders/checkout-estimate", {

          addressId,

          mode: isBuyNow ? "buy_now" : "cart",

          ...(isBuyNow

            ? {

                skuId: buyNowIntent.skuId,

                quantity: buyNowIntent.quantity,

              }

            : {}),

        });



        if (!active) return;

        setDeliveryEstimate(response.data?.estimate || null);

      } catch (requestError) {

        if (!active) return;

        setDeliveryEstimate(null);

        setDeliveryError(getPublicDeliveryError(requestError));

      } finally {

        if (active) setDeliveryLoading(false);

      }

    };



    void loadDeliveryEstimate();



    return () => {

      active = false;

    };

  }, [

    addressId,

    isBuyNow,

    deliveryFingerprint,

    loading,

    buyNowIntent?.skuId,

    buyNowIntent?.quantity,

  ]);



  /* =====================================================
     SERVER-CALCULATED PROMOTION SAVINGS
     A normal promotion is not considered usable for this checkout until the
     backend recalculates its exact eligible savings from server-side SKU data.
  ===================================================== */

  useEffect(() => {
    const code =
      appliedPromo?.kind === "promotion"
        ? String(appliedPromo.code || "").trim().toUpperCase()
        : "";

    if (!code) {
      setPromotionQuote(null);
      setPromotionQuoteLoading(false);
      return undefined;
    }

    if (
      (isBuyNow && !buyNowIntent?.skuId) ||
      (!isBuyNow && !cart.items?.length)
    ) {
      setPromotionQuote(null);
      return undefined;
    }

    let active = true;

    const loadPromotionQuote = async () => {
      setPromotionQuoteLoading(true);
      setPromoWarning("");

      try {
        const response = await api.post("/promotions/code/quote", {
          code,
          mode: isBuyNow ? "buy_now" : "cart",
          ...(addressId ? { addressId } : {}),
          ...(isBuyNow
            ? {
                skuId: buyNowIntent.skuId,
                quantity: buyNowIntent.quantity,
              }
            : {}),
        });

        if (!active) return;

        const quote = response.data?.quote;
        if (!response.data?.valid || !quote || Number(quote.customerSavings || 0) <= 0) {
          throw new Error("This promotion does not provide a discount on this checkout.");
        }

        setPromotionQuote(quote);

        // Keep only descriptive quote data in session storage. The backend will
        // recalculate everything again when the order is created.
        const refreshed = {
          ...appliedPromo,
          detail: `You save ${formatCurrency(quote.customerSavings)} on eligible items.`,
          quote,
        };
        setAppliedPromo(refreshed);
        storeAppliedPromotion(refreshed);
      } catch (requestError) {
        if (!active) return;

        clearStoredAppliedPromotion();
        setPromotionQuote(null);
        setAppliedPromo(null);
        setPromoCode("");
        setPromoWarning(
          requestError.response?.data?.message ||
            requestError.message ||
            "This promotion cannot be used on the current checkout."
        );
      } finally {
        if (active) setPromotionQuoteLoading(false);
      }
    };

    void loadPromotionQuote();

    return () => {
      active = false;
    };
  }, [
    appliedPromo?.kind,
    appliedPromo?.code,
    isBuyNow,
    addressId,
    deliveryFingerprint,
    buyNowIntent?.skuId,
    buyNowIntent?.quantity,
  ]);

  const handleRemovePartnerPromo = async () => {

    setPromoWarning("");



    try {

      if (user) {

        await api.delete("/partners/referrals/mine");

      }

    } catch (requestError) {

      if (![404, 409].includes(requestError.response?.status)) {

        setPromoWarning(

          requestError.response?.data?.message ||

            "Partner promo was removed from this checkout, but account sync could not be completed."

        );

      }

    } finally {
      clearStoredPartnerReferral();
      setPartnerReferral(null);
      setPromotionQuote(null);

      if (appliedPromo?.kind === "partner") {
        clearStoredAppliedPromotion();
        setAppliedPromo(null);
        setPromoCode("");
      }
    }
  };

  const handleAppliedPromo = (result) => {
    setPromoWarning("");
    setPromotionQuote(null);
    setAppliedPromo(result || null);

    if (result?.kind === "promotion") {
      storeAppliedPromotion(result);
      clearStoredPartnerReferral();
      setPartnerReferral(null);
    } else if (result?.kind === "partner") {
      clearStoredAppliedPromotion();
      const saved = storePartnerReferral({
        ...(result.data || {}),
        referralCode: result.code,
        source: "promo_code",
      });
      setPartnerReferral(saved || null);
    }

    if (result?.code) {
      setPromoCode(String(result.code).trim().toUpperCase());
    }
  };

  const handleClearPromo = () => {
    clearStoredAppliedPromotion();
    setPromotionQuote(null);
    setAppliedPromo(null);
    setPromoCode("");
    setPromoWarning("");
  };

  const handleAddressSelection = (address) => {

    setAddressId(address._id);



    applyDeliveryLocation({

      pincode: address.postalCode,

      city: address.city,

      state: address.state,

      country: address.country || "India",

      formattedAddress: [

        address.addressLine1,

        address.addressLine2,

        address.landmark,

        address.city,

        address.state,

        address.postalCode,

      ]

        .filter(Boolean)

        .join(", "),

    });

  };



  const verifyPayment = async (orderId, razorpayResponse) => {

    for (let attempt = 1; attempt <= 5; attempt += 1) {

      const response = await api.post("/payments/verify", {

        orderId,

        razorpay_order_id: razorpayResponse.razorpay_order_id,

        razorpay_payment_id: razorpayResponse.razorpay_payment_id,

        razorpay_signature: razorpayResponse.razorpay_signature,

      });



      if (!response.data.paymentPending) {

        return response.data;

      }



      if (attempt < 5) {

        await sleep(1500);

      }

    }



    return {

      success: true,

      paymentPending: true,

    };

  };



  const finishSuccessfulCheckout = async (orderId) => {

    if (isBuyNow) {

      clearBuyNowIntent();

    }



    clearStoredPartnerReferral();
    clearStoredAppliedPromotion();



    await refreshCart();



    navigate(`/order-success/${orderId}`, {

      replace: true,

    });

  };



  const handleCheckout = async (event) => {

    event.preventDefault();



    if (!addressId) {

      setError("Please select a delivery address.");

      return;

    }



    if (deliveryLoading) {

      setError("Please wait while we calculate your expected delivery.");

      return;

    }

    if (appliedPromo?.kind === "promotion" && promotionQuoteLoading) {
      setError("Please wait while we calculate your promotion savings.");
      return;
    }

    if (appliedPromo?.kind === "promotion" && !promotionQuote) {
      setError("Please apply the promotion again so we can confirm its savings.");
      return;
    }



    if (!deliveryEstimate?.canCheckout || !deliveryEstimate?.expectedDeliveryDate) {

      setError(

        deliveryError ||

          "Expected delivery is not currently available for this order. Please review the selected address or item availability."

      );

      return;

    }



    if (!isBuyNow && cart.hasUnavailableItems) {

      setError(

        "One or more cart items are no longer orderable. Please review your cart before checkout."

      );

      return;

    }



    setError("");

    setPaying(true);



    try {

      const razorpayLoaded = await loadRazorpay();



      if (!razorpayLoaded) {

        throw new Error("Unable to load Razorpay Checkout");

      }



      if (isBuyNow && !buyNowIntent?.skuId) {

        throw new Error(

          "Buy Now item expired. Please return to the product and try again."

        );

      }



      const analytics = buildAnalyticsPayload({

        source: isBuyNow ? "buy_now_checkout" : "checkout",

        pagePath: `${location.pathname}${location.search}`,

      });



      // Re-read just before order creation in case another component updated it.
      // Exactly one explicit code is sent to the backend.
      const storedPartnerReferral =
        getStoredPartnerReferral() || partnerReferral;

      const appliedPartnerCode =
        appliedPromo?.kind === "partner"
          ? String(appliedPromo.code || "").trim().toUpperCase()
          : "";

      const appliedPromotionCode =
        appliedPromo?.kind === "promotion"
          ? String(appliedPromo.code || "").trim().toUpperCase()
          : "";

      const storedPartnerCode = appliedPartnerCode
        ? ""
        : String(storedPartnerReferral?.referralCode || "")
            .trim()
            .toUpperCase();

      const partnerCodeForOrder = appliedPartnerCode || storedPartnerCode;

      if (partnerCodeForOrder && appliedPromotionCode) {
        throw new Error(
          "Only one promotion or partner code can be used on an order."
        );
      }

      const orderPayload = {
        checkoutKey: checkoutKey.current,
        addressId,
        recipient: {
          fullName: recipientName,
          phone: recipientPhone,
        },
        giftMessage,
        analytics,
        ...(appliedPromotionCode
          ? { promoCode: appliedPromotionCode }
          : {}),
        ...(partnerCodeForOrder
          ? { partnerReferralCode: partnerCodeForOrder }
          : {}),
        ...(isBuyNow

          ? {

              skuId: buyNowIntent.skuId,

              quantity: buyNowIntent.quantity,

            }

          : {}),

      };



      const orderResponse = await api.post(

        isBuyNow ? "/orders/buy-now" : "/orders",

        orderPayload

      );



      const localOrder = orderResponse.data.order;



      const paymentResponse = await api.post("/payments/create-order", {

        orderId: localOrder._id,

      });



      // FIX: payment can already be captured by an earlier frontend call or

      // webhook. Do not create/open Razorpay again in that case.

      if (paymentResponse.data?.alreadyPaid) {

        await finishSuccessfulCheckout(localOrder._id);

        return;

      }



      const checkout = paymentResponse.data?.checkout;



      if (!checkout?.razorpayOrderId) {

        throw new Error("Payment checkout details were not returned.");

      }



      const options = {

        key: checkout.keyId,

        amount: checkout.amountPaise,

        currency: checkout.currency,

        name: "HAMPORIUM",

        description: `Order ${checkout.orderNumber}`,

        order_id: checkout.razorpayOrderId,

        prefill: {

          name: checkout.prefill?.name || user?.name || "",

          email: checkout.prefill?.email || user?.email || "",

          contact:

            checkout.prefill?.contact ||

            user?.phone ||

            recipientPhone ||

            "",

        },

        theme: {

          color: "#F26522",

        },

        handler: async (razorpayResponse) => {

          try {

            const verification = await verifyPayment(

              localOrder._id,

              razorpayResponse

            );



            if (verification.paymentPending) {

              setError(

                "Payment received but confirmation is still pending. Please try again shortly."

              );

              setPaying(false);

              return;

            }



            await finishSuccessfulCheckout(localOrder._id);

          } catch (verificationError) {

            setError(

              verificationError.response?.data?.message ||

                "Payment verification failed. Please contact support if payment was deducted."

            );

            setPaying(false);

          }

        },

        modal: {

          ondismiss: () => {

            setPaying(false);

          },

        },

      };



      const razorpay = new window.Razorpay(options);



      razorpay.on("payment.failed", (response) => {

        setError(

          response.error?.description || "Payment failed. Please try again."

        );

        setPaying(false);

      });



      razorpay.open();

    } catch (requestError) {

      setError(

        requestError.response?.data?.message ||

          requestError.message ||

          "Unable to start payment"

      );

      setPaying(false);

    }

  };



  const buyNowDisplayItem = buyNowIntent

    ? {

        itemType: "sku",

        cartItemId: `buy-now-${buyNowIntent.skuId}`,

        product: {

          _id: buyNowIntent.productId,

          name: buyNowIntent.productName,

          slug: buyNowIntent.productSlug,

          images: buyNowIntent.image ? [{ url: buyNowIntent.image }] : [],

        },

        sku: {

          _id: buyNowIntent.skuId,

          name: buyNowIntent.skuName,

          code: buyNowIntent.skuCode,

          price: buyNowIntent.unitPrice,

          baseSellingPrice: buyNowIntent.baseSellingPrice,

          taxEnabled: buyNowIntent.taxEnabled,

          taxPercent: buyNowIntent.taxPercent,

          hsnSac: buyNowIntent.hsnSac,

          discount: buyNowIntent.discount,

          images: buyNowIntent.image ? [{ url: buyNowIntent.image }] : [],

        },

        quantity: buyNowIntent.quantity,

        lineTotal:

          Number(buyNowIntent.unitPrice || 0) *

          Number(buyNowIntent.quantity || 1),

      }

    : null;



  const checkoutItems = isBuyNow

    ? buyNowDisplayItem

      ? [buyNowDisplayItem]

      : []

    : cart.items;



  const checkoutSubtotal = isBuyNow

    ? Number(buyNowDisplayItem?.lineTotal || 0)

    : Number(cart.subtotal || 0);



  const appliedPartnerReferral =
    appliedPromo?.kind === "partner"
      ? {
          ...(appliedPromo.data || {}),
          referralCode: appliedPromo.code,
        }
      : null;

  const activePartnerReferral = appliedPartnerReferral || partnerReferral;
  const activePromotion =
    appliedPromo?.kind === "promotion" ? appliedPromo : null;

  const partnerDiscountPercent = Math.max(
    0,
    Math.min(100, Number(activePartnerReferral?.discountPercent || 0))
  );



  // V1 partner promo applies to ready-made SKU items only.

  const promoEligibleDisplayTotal = checkoutItems.reduce((sum, item) => {

    if ((item.itemType || "sku") !== "sku") return sum;

    return sum + Number(item.lineTotal || 0);

  }, 0);



  const estimatedPartnerDiscount = roundMoney(

    (promoEligibleDisplayTotal * partnerDiscountPercent) / 100

  );

  const estimatedPromotionSavings =
    activePromotion?.code && promotionQuote
      ? roundMoney(
          Number(
            promotionQuote.totalSavings ??
              promotionQuote.customerSavings ??
              0
          )
        )
      : 0;

  const estimatedCheckoutTotal = roundMoney(

    Math.max(
      0,
      checkoutSubtotal - estimatedPartnerDiscount - estimatedPromotionSavings
    )

  );



  if (isBuyNow && !buyNowIntent && !loading) {

    return <Navigate to="/gifts" replace />;

  }



  if (!isBuyNow && !cart.items.length && !loading) {

    return <Navigate to="/cart" replace />;

  }



  return (

    <main

      className="min-h-screen w-full bg-[#FBF8F4] text-[#171717]"

      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}

    >

      <section className="w-full px-4 pb-20 pt-[104px] sm:px-6 lg:px-8 lg:pt-[118px] xl:px-10 2xl:px-14">

        {/* =============================

            CHECKOUT HEADER

        ============================== */}

        <div className="flex flex-col gap-4 border-b border-black/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#F47822]">

              Secure Checkout

            </p>



            <h1

              style={{ fontFamily: DISPLAY_FONT }}

              className="mt-2 text-[48px] font-semibold leading-[0.9] tracking-[-0.045em] sm:text-[58px] lg:text-[66px]"

            >

              Checkout

            </h1>

          </div>



          <p className="text-[12px] font-semibold text-black/40 sm:text-right sm:text-[13px]">

            {checkoutItems.length} {checkoutItems.length === 1 ? "item" : "items"}

          </p>

        </div>



        {error && (

          <div className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-6 text-red-700">

            {error}

          </div>

        )}



        <form

          onSubmit={handleCheckout}

          className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_470px]"

        >

          <div className="min-w-0 space-y-6">

            {/* =============================

                ADDRESS

            ============================== */}

            <section className="rounded-[22px] border border-black/[0.07] bg-white p-5 shadow-[0_16px_46px_rgba(23,23,23,.04)] sm:p-6 lg:p-7">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#F47822]">

                    Delivery

                  </p>

                  <h2

                    style={{ fontFamily: DISPLAY_FONT }}

                    className="mt-1 text-[31px] font-semibold leading-none tracking-[-0.025em] sm:text-[36px]"

                  >

                    Choose Address

                  </h2>

                </div>



                {addresses.length > 0 && (

                  <button

                    type="button"

                    onClick={() => navigate("/account/addresses")}

                    className="shrink-0 rounded-full border border-[#F47822]/25 bg-[#FFF3EA] px-4 py-2.5 text-[10px] font-extrabold text-[#D95E0E] transition hover:border-[#F47822] hover:bg-[#F47822] hover:text-white"

                  >

                    + Add Address

                  </button>

                )}

              </div>



              {loading ? (

                <div className="mt-6 space-y-3">

                  <AddressSkeleton />

                  <AddressSkeleton />

                </div>

              ) : addresses.length === 0 ? (

                <div className="mt-6 rounded-[16px] border border-dashed border-black/15 bg-[#FCFAF7] px-5 py-7">

                  <p className="text-[13px] font-semibold text-black/45">

                    No saved address found.

                  </p>



                  <button

                    type="button"

                    onClick={() => navigate("/account/addresses")}

                    className="mt-4 text-[12px] font-extrabold text-[#F47822]"

                  >

                    + Add Address

                  </button>

                </div>

              ) : (

                <div className="mt-6 grid gap-3 lg:grid-cols-2">

                  {addresses.map((address) => {

                    const selected = addressId === address._id;



                    return (

                      <label

                        key={address._id}

                        className={`relative block cursor-pointer rounded-[18px] border p-5 transition duration-300 ${

                          selected

                            ? "border-[#F47822] bg-[#FFF8F2] shadow-[0_12px_28px_rgba(244,120,34,.08)]"

                            : "border-black/[0.08] bg-white hover:border-[#F47822]/45"

                        }`}

                      >

                        <div className="flex items-start gap-4">

                          <span

                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${

                              selected

                                ? "border-[#F47822]"

                                : "border-black/20"

                            }`}

                          >

                            {selected && (

                              <span className="h-2.5 w-2.5 rounded-full bg-[#F47822]" />

                            )}

                          </span>



                          <input

                            type="radio"

                            name="address"

                            checked={selected}

                            onChange={() => handleAddressSelection(address)}

                            className="sr-only"

                          />



                          <div className="min-w-0 flex-1">

                            <div className="flex flex-wrap items-center gap-2">

                              <p className="text-[14px] font-extrabold text-[#211D19]">

                                {address.label || "Address"}

                              </p>



                              {address.isDefault && (

                                <span className="rounded-full bg-[#F47822]/10 px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#F47822]">

                                  Default

                                </span>

                              )}

                            </div>



                            <p className="mt-3 text-[13px] font-bold text-[#2D2823]">

                              {address.fullName}

                            </p>



                            <p className="mt-2 text-[12px] font-medium leading-6 text-black/55">

                              {address.addressLine1}

                              {address.addressLine2 ? `, ${address.addressLine2}` : ""}

                              {address.landmark ? `, ${address.landmark}` : ""}

                              <br />

                              {address.city}, {address.state} {address.postalCode}

                            </p>



                            <p className="mt-2 text-[11px] font-semibold text-black/42">

                              {address.phone}

                            </p>

                          </div>



                          <button

                            type="button"

                            onClick={(event) => {

                              event.preventDefault();

                              navigate("/account/addresses");

                            }}

                            className="shrink-0 text-[10px] font-extrabold text-[#F47822] hover:text-[#171717]"

                          >

                            Edit

                          </button>

                        </div>

                      </label>

                    );

                  })}

                </div>

              )}

            </section>



            {/* =============================

                RECIPIENT

            ============================== */}

            <section className="rounded-[22px] border border-black/[0.07] bg-white p-5 shadow-[0_16px_46px_rgba(23,23,23,.04)] sm:p-6 lg:p-7">

              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#F47822]">

                Recipient

              </p>

              <h2

                style={{ fontFamily: DISPLAY_FONT }}

                className="mt-1 text-[31px] font-semibold leading-none tracking-[-0.025em] sm:text-[36px]"

              >

                Who is receiving it?

              </h2>



              <div className="mt-6 grid gap-4 lg:grid-cols-2">

                <CheckoutField label="Recipient Name">

                  <input

                    required

                    value={recipientName}

                    onChange={(event) => setRecipientName(event.target.value)}

                    className="h-full w-full bg-transparent text-[14px] font-semibold outline-none"

                  />

                </CheckoutField>



                <CheckoutField label="Recipient Phone">

                  <input

                    required

                    type="tel"

                    value={recipientPhone}

                    onChange={(event) => setRecipientPhone(event.target.value)}

                    className="h-full w-full bg-transparent text-[14px] font-semibold outline-none"

                  />

                </CheckoutField>

              </div>

            </section>



            {/* =============================

                DELIVERY ETA

            ============================== */}

            <section className="overflow-hidden rounded-[22px] border border-[#E5D8CB] bg-[#FFF9F3] shadow-[0_16px_46px_rgba(23,23,23,.035)]">

              <div className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-7">

                <div className="min-w-0">

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#F47822]">

                    Expected Delivery

                  </p>



                  {deliveryLoading ? (

                    <p className="mt-2 text-[16px] font-extrabold text-[#171717]">

                      Calculating delivery...

                    </p>

                  ) : deliveryEstimate?.expectedDeliveryDate ? (

                    <>

                      <p

                        style={{ fontFamily: DISPLAY_FONT }}

                        className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.025em] text-[#171717] sm:text-[40px]"

                      >

                        {formatExpectedDeliveryDate(

                          deliveryEstimate.expectedDeliveryDate

                        )}

                      </p>



                      <p className="mt-2 text-[12px] font-semibold text-black/42">

                        {deliveryEstimate.city || "Selected city"}

                        {deliveryEstimate.state ? `, ${deliveryEstimate.state}` : ""}

                        {deliveryEstimate.pincode ? ` · ${deliveryEstimate.pincode}` : ""}

                      </p>

                    </>

                  ) : (

                    <>

                      <p className="mt-2 text-[15px] font-extrabold text-amber-800">

                        Delivery estimate unavailable

                      </p>

                      <p className="mt-1 max-w-[760px] text-[12px] font-medium leading-5 text-amber-700/80">

                        {deliveryError ||

                          "Select a valid delivery address to calculate delivery."}

                      </p>

                    </>

                  )}

                </div>



                <div

                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${

                    deliveryEstimate?.expectedDeliveryDate

                      ? "bg-emerald-50 text-emerald-600"

                      : deliveryLoading

                        ? "bg-[#FFF1E8] text-[#F47822]"

                        : "bg-amber-50 text-amber-600"

                  }`}

                  aria-hidden="true"

                >

                  {deliveryEstimate?.expectedDeliveryDate ? (

                    <span className="text-[18px] font-black">✓</span>

                  ) : deliveryLoading ? (

                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />

                  ) : (

                    <span className="text-[17px] font-black">!</span>

                  )}

                </div>

              </div>

            </section>



            {/* =============================

                GIFT MESSAGE

            ============================== */}

            <section className="rounded-[22px] border border-black/[0.07] bg-white p-5 shadow-[0_16px_46px_rgba(23,23,23,.04)] sm:p-6 lg:p-7">

              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#F47822]">

                Personal Touch

              </p>

              <h2

                style={{ fontFamily: DISPLAY_FONT }}

                className="mt-1 text-[31px] font-semibold leading-none tracking-[-0.025em] sm:text-[36px]"

              >

                Add a Gift Message

              </h2>



              <textarea

                rows="4"

                maxLength="500"

                value={giftMessage}

                onChange={(event) => setGiftMessage(event.target.value)}

                placeholder="Write your message..."

                className="mt-6 w-full resize-none rounded-[16px] border border-black/[0.09] bg-[#FCFAF7] px-4 py-4 text-[14px] font-medium leading-6 outline-none transition placeholder:text-black/25 focus:border-[#F47822]"

              />



              <p className="mt-2 text-right text-[10px] font-semibold text-black/25">

                {giftMessage.length}/500

              </p>

            </section>

          </div>



          {/* =============================

              ORDER SUMMARY

          ============================== */}

          <aside className="h-fit overflow-hidden rounded-[22px] border border-black/[0.08] bg-white shadow-[0_18px_50px_rgba(23,23,23,.06)] xl:sticky xl:top-[106px]">

            <div className="px-5 py-6 sm:px-6 xl:px-7">

              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#F47822]">

                Your Order

              </p>

              <h2

                style={{ fontFamily: DISPLAY_FONT }}

                className="mt-1 text-[36px] font-semibold leading-none tracking-[-0.03em] sm:text-[40px]"

              >

                Order Summary

              </h2>



              <div className="mt-6 space-y-5">

                {checkoutItems.map((item) => (

                  <CheckoutCartItem

                    key={

                      item.itemType === "custom_hamper"

                        ? item.cartItemId

                        : item.sku?._id || item.cartItemId

                    }

                    item={item}

                  />

                ))}

              </div>



              <div className="mt-6 border-t border-black/[0.07] pt-5">

                <SummaryRow

                  label="Subtotal"

                  value={formatCurrency(checkoutSubtotal)}

                />



                {promoLoading && (

                  <SummaryRow label="Code" value="Checking..." />

                )}



                {!promoLoading &&

                  activePartnerReferral?.referralCode &&

                  partnerDiscountPercent > 0 && (

                    <SummaryRow

                      label={`Partner code (${activePartnerReferral.referralCode})`}

                      value={`-${formatCurrency(estimatedPartnerDiscount)}`}

                      green

                    />

                  )}



                {!promoLoading && activePromotion?.code && promotionQuoteLoading && (
                  <SummaryRow
                    label={`Promotion (${activePromotion.code})`}
                    value="Calculating..."
                  />
                )}

                {!promoLoading &&
                  activePromotion?.code &&
                  !promotionQuoteLoading &&
                  estimatedPromotionSavings > 0 && (
                    <SummaryRow
                      label={`Promotion (${activePromotion.code})`}
                      value={`-${formatCurrency(estimatedPromotionSavings)}`}
                      green
                    />
                  )}

                <SummaryRow label="Shipping" value="FREE" green />

              </div>



              {partnerReferral?.referralCode && !promoLoading && (
                <div className="mt-5 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">
                        Partner code applied
                      </p>
                      <p className="mt-1 truncate text-[13px] font-extrabold text-emerald-900">
                        {partnerReferral.referralCode}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold leading-5 text-emerald-800/75">
                        Remove this code before using another promo or partner code.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemovePartnerPromo}
                      className="shrink-0 text-[9px] font-extrabold uppercase tracking-[0.06em] text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {!partnerReferral?.referralCode && !promoLoading && (
                <div className="mt-5">
                  <PromoCodeField
                    value={promoCode}
                    onChange={setPromoCode}
                    onApplied={handleAppliedPromo}
                    onClear={handleClearPromo}
                    initialResult={appliedPromo}
                    disabled={false}
                  />
                </div>
              )}

              {activePromotion?.code && promotionQuote && (
                <div className="mt-4 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-semibold leading-5 text-emerald-800">
                  You save {formatCurrency(estimatedPromotionSavings)} with {activePromotion.code} on this checkout. The backend will verify the same offer again before creating the payment amount.
                </div>
              )}

              {promoWarning && (

                <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-semibold leading-5 text-amber-800">

                  {promoWarning}

                </div>

              )}



              <div className="mt-6 border-t border-black/[0.08] pt-5">

                <div className="flex items-end justify-between gap-4">

                  <p className="text-[15px] font-extrabold">Total</p>



                  <div className="text-right">

                    {estimatedPartnerDiscount + estimatedPromotionSavings > 0 && (

                      <p className="mb-1 text-[11px] font-semibold text-black/30 line-through">

                        {formatCurrency(checkoutSubtotal)}

                      </p>

                    )}



                    <p className="text-[31px] font-black tracking-[-0.04em] text-[#171717]">
                      {formatCurrency(estimatedCheckoutTotal)}
                    </p>

                    {activePromotion?.code && (
                      <p className="mt-1 text-[9px] font-semibold text-black/35">
                        Final coupon total is confirmed before payment.
                      </p>
                    )}

                  </div>

                </div>

              </div>

            </div>



            <div className="border-t border-black/[0.07] bg-[#FCFAF7] p-5 sm:px-6 xl:px-7">

              <button

                type="submit"

                disabled={

                  paying ||

                  loading ||

                  promoLoading ||

                  promotionQuoteLoading ||

                  deliveryLoading ||

                  !deliveryEstimate?.canCheckout ||

                  !deliveryEstimate?.expectedDeliveryDate ||

                  !addresses.length ||

                  (isBuyNow && !buyNowIntent)

                }

                className="flex h-[58px] w-full items-center justify-center rounded-[14px] bg-[#F47822] px-5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-50"

              >

                {paying ? "Processing..." : "Continue to Payment"}

              </button>



              <div className="mt-4 flex items-center justify-center gap-2 text-black/35">

                <LockIcon />

                <span className="text-[10px] font-semibold">

                  Secure payment

                </span>

              </div>

            </div>

          </aside>

        </form>

      </section>

    </main>

  );

};



const CheckoutCartItem = ({ item }) => {

  const isCustom = item.itemType === "custom_hamper";



  if (isCustom) {

    const container = item.customHamper?.container;

    const selected = item.customHamper?.items || [];

    const image = container?.images?.[0]?.url;



    return (

      <div className="flex items-start gap-4">

        <div className="flex h-[82px] w-[82px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#F4EFEA]">

          {image ? (

            <img

              src={image}

              alt={container?.name || "Custom Hamper"}

              className="h-full w-full object-cover"

            />

          ) : (

            <GiftIcon />

          )}

        </div>



        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <p className="text-[13px] font-extrabold leading-5 text-[#24201C]">

              Custom Hamper

            </p>



            <span className="rounded-full bg-[#FFF1E8] px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.07em] text-[#F47822]">

              Build Your Own

            </span>

          </div>



          <p className="mt-1 text-[11px] font-semibold text-black/42">

            {container?.name || "Custom Hamper Box"}

          </p>



          {selected.length > 0 && (

            <p className="mt-2 line-clamp-2 text-[10px] font-medium leading-5 text-black/35">

              {selected

                .slice(0, 3)

                .map(

                  (selection) =>

                    `${selection.component?.name || "Hamper item"} × ${selection.quantity}`

                )

                .join(" · ")}

              {selected.length > 3 ? ` · +${selected.length - 3} more` : ""}

            </p>

          )}



          <p className="mt-2 text-[10px] font-semibold text-black/35">

            Qty: {item.quantity}

          </p>

        </div>



        <p className="shrink-0 text-[13px] font-extrabold text-[#171717]">

          {formatCurrency(item.lineTotal)}

        </p>

      </div>

    );

  }



  const image =

    item.sku?.images?.[0]?.url ||

    item.product?.images?.[0]?.url;



  return (

    <div className="flex items-center gap-4">

      <div className="flex h-[82px] w-[82px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#F4EFEA]">

        {image ? (

          <img

            src={image}

            alt={item.product?.name || "Gift"}

            className="h-full w-full object-cover"

          />

        ) : (

          <GiftIcon />

        )}

      </div>



      <div className="min-w-0 flex-1">

        <p className="line-clamp-2 text-[13px] font-extrabold leading-5 text-[#24201C]">

          {item.product?.name || "Gift"}

        </p>



        {item.sku?.name && (

          <p className="mt-1 text-[10px] font-semibold text-black/38">

            {item.sku.name}

          </p>

        )}



        <p className="mt-2 text-[10px] font-semibold text-black/35">

          Qty: {item.quantity}

        </p>

      </div>



      <p className="shrink-0 text-[13px] font-extrabold text-[#171717]">

        {formatCurrency(item.lineTotal)}

      </p>

    </div>

  );

};



const CheckoutField = ({ label, children }) => (

  <label className="block">

    <span className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/42">

      {label}

    </span>



    <div className="mt-2 flex h-[54px] items-center rounded-[14px] border border-black/[0.1] bg-[#FCFAF7] px-4 transition focus-within:border-[#F47822] focus-within:bg-white">

      {children}

    </div>

  </label>

);



const SummaryRow = ({ label, value, green = false }) => (

  <div className="mb-4 flex items-center justify-between gap-4 last:mb-0">

    <span className="text-[12px] font-semibold text-black/48">{label}</span>



    <span

      className={`text-right text-[12px] font-extrabold ${

        green ? "text-emerald-600" : "text-[#171717]"

      }`}

    >

      {value}

    </span>

  </div>

);



const AddressSkeleton = () => (

  <div className="rounded-[18px] border border-black/[0.06] bg-white p-5">

    <div className="h-4 w-28 animate-pulse rounded bg-black/[0.07]" />

    <div className="mt-4 h-4 w-4/5 animate-pulse rounded bg-black/[0.04]" />

    <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-black/[0.04]" />

  </div>

);



const GiftIcon = () => (

  <svg

    viewBox="0 0 24 24"

    fill="none"

    stroke="currentColor"

    strokeWidth="1.5"

    strokeLinecap="round"

    strokeLinejoin="round"

    className="h-6 w-6 text-[#F47822]/50"

  >

    <path d="M4 10h16v10H4V10Z" />

    <path d="M3 7h18v4H3V7ZM12 7v13" />

  </svg>

);



const LockIcon = () => (

  <svg

    viewBox="0 0 24 24"

    fill="none"

    stroke="currentColor"

    strokeWidth="1.6"

    strokeLinecap="round"

    strokeLinejoin="round"

    className="h-4 w-4"

  >

    <rect x="5" y="10" width="14" height="10" rx="2" />

    <path d="M8 10V7a4 4 0 0 1 8 0v3" />

  </svg>

);



export default Checkout;
