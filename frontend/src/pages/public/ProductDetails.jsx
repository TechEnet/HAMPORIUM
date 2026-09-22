import { useEffect, useRef, useState, } from "react";
import { Link, useLocation, useNavigate, useParams, } from "react-router-dom";
import api from "../../api/api.js";
import formatCurrency from "../../utils/formatCurrency.js";
import { useAuth, } from "../../context/AuthContext.jsx";
import { useCart, } from "../../context/CartContext.jsx";
import { useDeliveryLocation, } from "../../context/LocationContext.jsx";
import { trackProductView, } from "../../utils/analytics.js";
import { saveBuyNowIntent, } from "../../utils/buyNow.js";
import { clearStoredPartnerReferral, getStoredPartnerReferral, storePartnerReferral, } from "../../utils/partnerReferral.js";
import ProductReviewsSection from "../../components/reviews/ProductReviewsSection.jsx";
import PromoCodeField from "../../components/PromoCodeField.jsx";
import {
    clearStoredAppliedPromotion,
    getStoredAppliedPromotion,
    normalizeAppliedCode,
    storeAppliedPromotion,
} from "../../utils/appliedPromo.js";
const DISPLAY_FONT = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const RECENT_KEY = "hamporium-recent-products";
const getGalleryUrl = (image) => {
    if (!image) {
        return "";
    }
    if (typeof image === "string") {
        return image;
    }
    return (image.url ||
        image.secure_url ||
        image.src ||
        image.location ||
        "");
};
const normalizeGalleryImage = (image) => {
    const url = getGalleryUrl(image);
    if (!url) {
        return null;
    }
    return {
        ...(typeof image === "object" ? image : {}),
        url,
        alt: typeof image === "object"
            ? image.alt || image.name || ""
            : "",
    };
};
/* =========================================================
   HELPERS
========================================================= */
const formatDateValue = (value) => {
    if (!value) {
        return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "—";
    }
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
};
const formatDimensions = (dimensions) => {
    if (!dimensions) {
        return "—";
    }
    const { length, width, height, unit, } = dimensions;
    if (length === undefined ||
        length === null ||
        width === undefined ||
        width === null ||
        height === undefined ||
        height === null) {
        return "—";
    }
    return `${length} × ${width} × ${height} ${unit || "cm"}`;
};
const formatWeightValue = (weight) => {
    if (!weight ||
        weight.value === null ||
        weight.value === undefined) {
        return "—";
    }
    const value = Number(weight.value);
    if (!Number.isFinite(value)) {
        return "—";
    }
    return `${value.toLocaleString("en-IN", {
        maximumFractionDigits: 3,
    })} ${weight.unit || "kg"}`;
};
const formatDaysValue = (value) => {
    if (value === null ||
        value === undefined ||
        value === "") {
        return "—";
    }
    const days = Number(value);
    if (!Number.isFinite(days)) {
        return "—";
    }
    return `${days} ${days === 1
        ? "day"
        : "days"}`;
};
const normalizePincode = (value) => String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);
const readLocalArray = (key) => {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value)
            ? value
            : [];
    }
    catch {
        return [];
    }
};
/* =========================================================
   PRODUCT DETAILS
========================================================= */
const ProductDetails = () => {
    const { slug, } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, } = useAuth();
    const { deliveryLocation, resolvePincode, detectCurrentLocation, } = useDeliveryLocation();
    const { addToCart, } = useCart();
    const trackedProductRef = useRef("");
    const autoDeliveryKeyRef = useRef("");
    /* =======================================================
       PRODUCT
    ======================================================= */
    const [product, setProduct,] = useState(null);
    const [selectedSku, setSelectedSku,] = useState(null);
    const [selectedImage, setSelectedImage,] = useState("");
    const [quantity, setQuantity,] = useState(1);
    const [loading, setLoading,] = useState(true);
    const [adding, setAdding,] = useState(false);
    const [buying, setBuying,] = useState(false);
    const [error, setError,] = useState("");
    const [activeInfoTab, setActiveInfoTab,] = useState("description");
    const [zoomImage, setZoomImage,] = useState("");
    const [shareMessage, setShareMessage,] = useState("");
    const [recentProducts, setRecentProducts,] = useState([]);
    const [reviewSummary, setReviewSummary,] = useState(null);
    /* =======================================================
       DELIVERY
    ======================================================= */
    const [deliveryPincode, setDeliveryPincode,] = useState(deliveryLocation
        ?.pincode ||
        "");
    const [deliveryChecking, setDeliveryChecking,] = useState(false);
    const [locationLoading, setLocationLoading,] = useState(false);
    const [deliveryResult, setDeliveryResult,] = useState(null);
    const [deliveryError, setDeliveryError,] = useState("");
    /* =======================================================
       PROMO / PARTNER CODE
       One secure code slot. Server decides the code type.
    ======================================================= */
    const [promoCode, setPromoCode,] = useState(() => {
        const storedPartner = getStoredPartnerReferral();
        const storedPromotion = getStoredAppliedPromotion();
        return normalizeAppliedCode(storedPartner?.referralCode || storedPromotion?.code || "");
    });
    const [appliedPromo, setAppliedPromo,] = useState(() => {
        const storedPartner = getStoredPartnerReferral();
        if (storedPartner?.referralCode) {
            const discount = Math.max(0, Math.min(100, Number(storedPartner.discountPercent || 0)));
            return {
                kind: "partner",
                code: normalizeAppliedCode(storedPartner.referralCode),
                title: storedPartner.businessName || "Partner benefit",
                detail: discount > 0
                    ? `${discount}% customer benefit on eligible products.`
                    : "Partner code accepted. Final eligibility is verified at checkout.",
                data: storedPartner,
            };
        }
        return getStoredAppliedPromotion();
    });

    /* =======================================================
       REVALIDATE SAVED CODE
       Stored browser values are never trusted as final authority.
    ======================================================= */
    useEffect(() => {
        let active = true;

        const revalidateSavedCode = async () => {
            const storedPartner = getStoredPartnerReferral();
            const storedPromotion = getStoredAppliedPromotion();
            const partnerCode = normalizeAppliedCode(storedPartner?.referralCode);
            const promotionCode = normalizeAppliedCode(storedPromotion?.code);

            // Never keep two code types active at once. If legacy/stale browser
            // data contains both, keep the explicit partner referral and remove
            // the normal promo selection. The customer can remove it in the UI.
            if (partnerCode && promotionCode) {
                clearStoredAppliedPromotion();
            }

            const code = partnerCode || promotionCode;
            if (!code) {
                if (active) {
                    setPromoCode("");
                    setAppliedPromo(null);
                }
                return;
            }

            try {
                const response = await api.post("/promotions/code/preview", { code });
                if (!active) return;

                if (!response.data?.valid || !["promotion", "partner"].includes(response.data?.kind)) {
                    throw new Error("This code is unavailable.");
                }

                if (response.data.kind === "promotion") {
                    const promotion = response.data.promotion;
                    if (!promotion?.code) throw new Error("This promo code is unavailable.");

                    const value = Math.max(0, Number(promotion.discount?.value || 0));
                    const discountText = promotion.discount?.type === "fixed"
                        ? `${formatCurrency(value)} off`
                        : `${value}% off`;
                    const restored = {
                        kind: "promotion",
                        code: normalizeAppliedCode(promotion.code),
                        title: promotion.name || "HAMPORIUM offer",
                        detail: discountText,
                        data: promotion,
                    };

                    clearStoredPartnerReferral();
                    storeAppliedPromotion(restored);
                    setPromoCode(restored.code);
                    setAppliedPromo(restored);
                    return;
                }

                const referral = response.data.referral;
                if (!referral?.referralCode) throw new Error("This partner code is unavailable.");

                const saved = storePartnerReferral({
                    ...storedPartner,
                    ...referral,
                    source: storedPartner?.source || "promo_code",
                });
                const discount = Math.max(0, Math.min(100, Number(referral.discountPercent || 0)));
                const restored = {
                    kind: "partner",
                    code: normalizeAppliedCode(referral.referralCode),
                    title: referral.businessName || "Partner benefit",
                    detail: discount > 0
                        ? `${discount}% customer benefit on eligible products.`
                        : "Partner code accepted. Final eligibility is verified at checkout.",
                    data: referral,
                };

                clearStoredAppliedPromotion();
                if (saved) storePartnerReferral(saved);
                setPromoCode(restored.code);
                setAppliedPromo(restored);
            }
            catch {
                if (!active) return;
                clearStoredPartnerReferral();
                clearStoredAppliedPromotion();
                setPromoCode("");
                setAppliedPromo(null);
            }
        };

        void revalidateSavedCode();
        return () => {
            active = false;
        };
    }, []);
    /* =======================================================
       LOAD PRODUCT
    ======================================================= */
    useEffect(() => {
        let active = true;
        const loadProduct = async () => {
            setLoading(true);
            setError("");
            setZoomImage("");
            autoDeliveryKeyRef.current = "";
            setDeliveryPincode(deliveryLocation
                ?.pincode ||
                "");
            setDeliveryResult(null);
            setDeliveryError("");
            try {
                const response = await api.get(`/catalog/products/${slug}`);
                const loadedProduct = response.data
                    ?.product;
                if (!active)
                    return;
                setProduct(loadedProduct ||
                    null);
                if (loadedProduct
                    ?.skus
                    ?.length) {
                    setSelectedSku(loadedProduct
                        .skus[0]);
                }
                else {
                    setSelectedSku(null);
                }
                setSelectedImage(getGalleryUrl(loadedProduct
                    ?.images?.[0]));
                setQuantity(1);
                setActiveInfoTab("description");
            }
            catch (requestError) {
                if (!active)
                    return;
                console.error("Product load error:", requestError);
                setProduct(null);
            }
            finally {
                if (active)
                    setLoading(false);
            }
        };
        void loadProduct();
        return () => { active = false; };
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
                const response = await api.get(`/reviews/product/${product._id}`, {
                    params: {
                        page: 1,
                        limit: 1,
                    },
                });
                if (!active) {
                    return;
                }
                setReviewSummary(response.data?.summary ||
                    null);
            }
            catch {
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
        if (!product?._id) {
            return;
        }
        const viewKey = String(product._id);
        if (trackedProductRef
            .current ===
            viewKey) {
            return;
        }
        trackedProductRef.current =
            viewKey;
        void trackProductView({
            productId: product._id,
            skuId: selectedSku?._id,
            productSlug: product.slug,
            productName: product.name,
            source: "product_detail",
            pagePath: `${location.pathname}${location.search}`,
            location: deliveryLocation,
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
        if (!product?.slug) {
            return;
        }
        const existing = readLocalArray(RECENT_KEY);
        const currentEntry = {
            slug: product.slug,
            name: product.name,
            image: getGalleryUrl(product
                .images?.[0]),
            price: product.minPrice ??
                0,
            category: product.category
                ?.name ||
                "",
        };
        const withoutCurrent = existing.filter((item) => item.slug !==
            product.slug);
        const next = [
            currentEntry,
            ...withoutCurrent,
        ].slice(0, 8);
        try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        }
        catch {
            // Private/restricted storage must not block the purchase page.
        }
        setRecentProducts(next.filter((item) => item.slug !==
            product.slug));
    }, [product]);
    /* =======================================================
       SKU
    ======================================================= */
    const selectSku = (sku) => {
        setSelectedSku(sku);
        setSelectedImage(getGalleryUrl(sku.images?.[0]) ||
            getGalleryUrl(product
                ?.images?.[0]));
        setError("");
        setDeliveryResult(null);
        setDeliveryError("");
        autoDeliveryKeyRef.current =
            "";
    };
    /* =======================================================
       DELIVERY CHECK
    ======================================================= */
    const checkDeliveryForPincode = async (rawPincode) => {
        const pincode = normalizePincode(rawPincode);
        setDeliveryPincode(pincode);
        setDeliveryError("");
        setDeliveryResult(null);
        if (!selectedSku?._id) {
            setDeliveryError("Please select a product option first.");
            return null;
        }
        if (!/^[1-9][0-9]{5}$/.test(pincode)) {
            setDeliveryError("Enter a valid 6-digit Indian pincode.");
            return null;
        }
        setDeliveryChecking(true);
        try {
            autoDeliveryKeyRef.current =
                `${selectedSku._id}:${pincode}`;
            if (deliveryLocation
                ?.pincode !==
                pincode) {
                await resolvePincode(pincode);
            }
            const response = await api.post("/delivery/check", {
                skuId: selectedSku._id,
                pincode,
            });
            const result = response.data
                ?.delivery ||
                null;
            setDeliveryResult(result);
            return result;
        }
        catch (requestError) {
            setDeliveryError(requestError
                .response?.data
                ?.message ||
                requestError
                    .message ||
                "Unable to check delivery right now.");
            return null;
        }
        finally {
            setDeliveryChecking(false);
        }
    };
    const handleDeliverySubmit = async (event) => {
        event.preventDefault();
        await checkDeliveryForPincode(deliveryPincode);
    };
    const handleDeliveryPincodeChange = (event) => {
        setDeliveryPincode(normalizePincode(event.target.value));
        setDeliveryResult(null);
        setDeliveryError("");
    };
    /* =======================================================
       CURRENT LOCATION
    ======================================================= */
    const handleUseCurrentLocation = async () => {
        setDeliveryError("");
        setDeliveryResult(null);
        setLocationLoading(true);
        try {
            const detected = await detectCurrentLocation();
            const detectedPincode = normalizePincode(detected?.pincode);
            if (!/^[1-9][0-9]{5}$/.test(detectedPincode)) {
                setDeliveryError("We found your location but could not detect its pincode. Please enter it manually.");
                return;
            }
            setDeliveryPincode(detectedPincode);
            await checkDeliveryForPincode(detectedPincode);
        }
        catch (requestError) {
            setDeliveryError(requestError
                ?.message ||
                requestError
                    ?.response
                    ?.data
                    ?.message ||
                "Unable to detect your delivery location. Please enter your pincode manually.");
        }
        finally {
            setLocationLoading(false);
        }
    };
    /* =======================================================
       SAVED LOCATION AUTO CHECK
    ======================================================= */
    useEffect(() => {
        const pincode = normalizePincode(deliveryLocation
            ?.pincode);
        if (!selectedSku?._id ||
            !/^[1-9][0-9]{5}$/.test(pincode)) {
            return;
        }
        const key = `${selectedSku._id}:${pincode}`;
        if (autoDeliveryKeyRef
            .current ===
            key) {
            return;
        }
        autoDeliveryKeyRef.current =
            key;
        setDeliveryPincode(pincode);
        void checkDeliveryForPincode(pincode);
    }, [
        selectedSku?._id,
        deliveryLocation
            ?.pincode,
    ]);
    /* =======================================================
       PROMO / PARTNER CODE
       Browser never guesses the code type. /promotions/code/preview does.
    ======================================================= */
    const handleAppliedPromo = async (result) => {
        if (!result?.code || !["promotion", "partner"].includes(result.kind)) return;

        if (result.kind === "promotion") {
            clearStoredPartnerReferral();
            storeAppliedPromotion(result);
            setAppliedPromo(result);
            setPromoCode(normalizeAppliedCode(result.code));
            return;
        }

        clearStoredAppliedPromotion();
        const referral = result.data || {};
        const saved = storePartnerReferral({
            ...referral,
            referralCode: result.code,
            source: "promo_code",
        });

        if (user && !user.roles?.includes("partner")) {
            try {
                await api.post("/partners/referrals/claim", {
                    referralCode: result.code,
                    source: "promo_code",
                });
            }
            catch (claimError) {
                if (![400, 404, 409].includes(claimError.response?.status)) {
                    console.error("Partner referral claim failed:", claimError);
                }
            }
        }

        setAppliedPromo({
            ...result,
            data: saved || referral,
        });
        setPromoCode(normalizeAppliedCode(result.code));
    };

    const handlePromoClear = async () => {
        const wasPartner = appliedPromo?.kind === "partner";

        clearStoredAppliedPromotion();
        clearStoredPartnerReferral();
        setAppliedPromo(null);
        setPromoCode("");

        if (wasPartner && user) {
            try {
                await api.delete("/partners/referrals/mine");
            }
            catch (requestError) {
                if (![404, 409].includes(requestError.response?.status)) {
                    console.error("Unable to clear partner referral:", requestError);
                }
            }
        }
    };
    /* =======================================================
       PURCHASE VALIDATION
    ======================================================= */
    const validatePurchase = () => {
        setError("");
        if (!user) {
            navigate("/login", {
                state: {
                    from: {
                        pathname: `/products/${slug}`,
                    },
                },
            });
            return false;
        }
        if (!selectedSku) {
            setError("Please select a product option.");
            return false;
        }
        if (selectedSku
            .deliveryEstimate
            ?.status ===
            "unavailable") {
            setError("This hamper is currently unavailable.");
            return false;
        }
        if (deliveryResult &&
            deliveryResult
                .serviceable ===
                false) {
            setError("Delivery is not available to the selected pincode.");
            return false;
        }
        if (deliveryResult &&
            deliveryResult
                .orderable ===
                false) {
            setError(deliveryResult
                .message ||
                "This hamper is currently unavailable.");
            return false;
        }
        return true;
    };
    /* =======================================================
       ADD TO CART
    ======================================================= */
    const handleAddToCart = async () => {
        if (!validatePurchase()) {
            return;
        }
        setAdding(true);
        try {
            await addToCart(selectedSku._id, quantity, {
                source: "product_detail",
                pagePath: `${location.pathname}${location.search}`,
                location: deliveryLocation,
            });
            navigate("/cart");
        }
        catch (requestError) {
            setError(requestError
                .response?.data
                ?.message ||
                "Unable to add item to cart");
        }
        finally {
            setAdding(false);
        }
    };
    /* =======================================================
       BUY NOW
    ======================================================= */
    const handleBuyNow = async () => {
        if (!validatePurchase()) {
            return;
        }
        setBuying(true);
        try {
            const intent = saveBuyNowIntent({
                skuId: selectedSku._id,
                quantity,
                productId: product._id,
                productSlug: product.slug,
                productName: product.name,
                skuName: selectedSku.name,
                skuCode: selectedSku.code,
                image: selectedSku
                    .images?.[0]
                    ?.url ||
                    product
                        .images?.[0]
                        ?.url ||
                    "",
                unitPrice: selectedSku.price,
                baseSellingPrice: selectedSku
                    .baseSellingPrice ??
                    selectedSku.price,
                taxEnabled: selectedSku
                    .taxEnabled !==
                    false,
                taxPercent: selectedSku
                    .taxPercent ??
                    0,
                hsnSac: selectedSku
                    .hsnSac ||
                    "",
                discount: selectedSku
                    .discount || {
                    enabled: false,
                    type: "percentage",
                    value: 0,
                },
                compareAtPrice: selectedSku
                    .compareAtPrice,
                optionValues: selectedSku
                    .optionValues ||
                    {},
                // Convenience only. Checkout and order creation revalidate
                // the selected code server-side before pricing/payment.
                promoCode: appliedPromo?.kind === "promotion"
                    ? appliedPromo.code
                    : "",
                partnerPromoCode: appliedPromo?.kind === "partner"
                    ? appliedPromo.code
                    : "",
            });
            if (!intent) {
                throw new Error("Unable to prepare Buy Now checkout");
            }
            navigate("/checkout?mode=buy-now");
        }
        catch (requestError) {
            setError(requestError
                .response?.data
                ?.message ||
                requestError
                    .message ||
                "Unable to continue to checkout");
        }
        finally {
            setBuying(false);
        }
    };
    /* =======================================================
       SHARE
    ======================================================= */
    const handleShare = async () => {
        if (!product) {
            return;
        }
        const shareData = {
            title: product.name,
            text: product
                .shortDescription ||
                `Check out ${product.name} on HAMPORIUM`,
            url: window.location
                .href,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
                return;
            }
            await navigator
                .clipboard
                .writeText(window.location
                .href);
            setShareMessage("Link copied");
            window.setTimeout(() => setShareMessage(""), 2000);
        }
        catch (shareError) {
            if (shareError?.name !==
                "AbortError") {
                setShareMessage("Unable to share");
                window.setTimeout(() => setShareMessage(""), 2000);
            }
        }
    };
    const pageRef = useRef(null);
    useEffect(() => {
        if (loading || !product?._id || !pageRef.current)
            return undefined;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (reduced.matches || typeof IntersectionObserver === "undefined")
            return undefined;
        const animations = new Set();
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting)
                    return;
                observer.unobserve(entry.target);
                if (typeof entry.target.animate !== "function")
                    return;
                const animation = entry.target.animate([
                    { opacity: 0.45, transform: "translateY(14px)" },
                    { opacity: 1, transform: "translateY(0)" },
                ], { duration: 650, easing: "cubic-bezier(.22,1,.36,1)" });
                animations.add(animation);
                animation.onfinish = () => animations.delete(animation);
            });
        }, { threshold: 0.06 });
        const stopMotion = (event) => { if (event.matches) {
            observer.disconnect();
            animations.forEach((animation) => animation.cancel());
        } };
        reduced.addEventListener?.("change", stopMotion);
        pageRef.current.querySelectorAll("[data-pd-reveal]").forEach((element) => observer.observe(element));
        return () => { observer.disconnect(); animations.forEach((animation) => animation.cancel()); reduced.removeEventListener?.("change", stopMotion); };
    }, [loading, product?._id]);
    if (loading)
        return <ProductDetailsSkeleton />;
    if (!product)
        return <ProductMissing />;
    /* =======================================================
       DERIVED DATA
    ======================================================= */
    const images = (() => {
        const skuImages = Array.isArray(selectedSku?.images)
            ? selectedSku.images
            : [];
        const productImages = Array.isArray(product?.images)
            ? product.images
            : [];
        const seen = new Set();
        return [
            ...skuImages,
            ...productImages,
        ]
            .map(normalizeGalleryImage)
            .filter((image) => {
            if (!image?.url ||
                seen.has(image.url)) {
                return false;
            }
            seen.add(image.url);
            return true;
        });
    })();
    const displayImage = images.some((image) => image.url ===
        selectedImage)
        ? selectedImage
        : images[0]?.url ||
            "";
    const deliveryEstimate = selectedSku
        ?.deliveryEstimate ||
        null;
    const skuUnavailable = deliveryEstimate
        ?.status ===
        "unavailable";
    const deliveryBlocked = Boolean(deliveryResult &&
        (deliveryResult
            .serviceable ===
            false ||
            deliveryResult
                .orderable ===
                false));
    const purchaseUnavailable = skuUnavailable ||
        deliveryBlocked;
    const hamperContents = Array.isArray(selectedSku
        ?.hamperContents)
        ? selectedSku
            .hamperContents
        : [];
    const selectedContainer = selectedSku
        ?.container &&
        typeof selectedSku
            .container ===
            "object"
        ? selectedSku
            .container
        : null;
    const hamperMetrics = selectedSku
        ?.hamperMetrics ||
        null;
    const hamperDimensions = hamperMetrics
        ?.dimensions ||
        selectedContainer
            ?.outerDimensions ||
        null;
    const hamperWeight = hamperMetrics
        ?.hamperWeight ||
        hamperMetrics
            ?.contentWeight ||
        null;
    /* =======================================================
       DELIVERY / EXPIRY
    ======================================================= */
    const earliestExpiryDate = selectedSku
        ?.earliestExpiryDate ||
        null;
    const dispatchReadyDate = deliveryEstimate
        ?.dispatchReadyDate ||
        null;
    const defaultExpectedDeliveryDate = deliveryEstimate
        ?.expectedDeliveryDate ||
        null;
    const locationExpectedDeliveryDate = deliveryResult
        ?.expectedDeliveryDate ||
        null;
    const expectedDeliveryDate = locationExpectedDeliveryDate ||
        defaultExpectedDeliveryDate;
    const productionLeadDays = deliveryEstimate
        ?.productionLeadDays;
    const courierDays = deliveryEstimate
        ?.courierDays ??
        deliveryEstimate
            ?.defaultCourierDays;
    const hasProductionLead = productionLeadDays !==
        null &&
        productionLeadDays !==
            undefined;
    const hasCourierDays = courierDays !==
        null &&
        courierDays !==
            undefined;
    const hasDeliveryFreshnessInfo = Boolean(earliestExpiryDate ||
        dispatchReadyDate ||
        expectedDeliveryDate ||
        hasProductionLead ||
        hasCourierDays);
    const actionBusy = adding ||
        buying;
    const activeImageIndex = Math.max(0, images.findIndex((image) => image.url ===
        displayImage));
    const reviewAverage = Number(reviewSummary
        ?.averageRating ||
        0);
    const reviewCount = Number(reviewSummary
        ?.totalReviews ||
        0);
    const selectedSizeEntry = Object.entries(selectedSku
        ?.optionValues ||
        {}).find(([key]) => String(key)
        .trim()
        .toLowerCase() ===
        "size");
    const selectedSize = selectedSizeEntry?.[1] ||
        selectedSku?.name ||
        "—";
    const selectedPrice = Number(selectedSku
        ?.price);
    const selectedComparePrice = Number(selectedSku
        ?.compareAtPrice);
    const discountPercent = Number.isFinite(selectedPrice) &&
        Number.isFinite(selectedComparePrice) &&
        selectedComparePrice >
            selectedPrice &&
        selectedComparePrice >
            0
        ? Math.round(((selectedComparePrice -
            selectedPrice) /
            selectedComparePrice) *
            100)
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
    const displayPrice = selectedSku?.price ?? product.minPrice;
    const hasPrice = hasNumericValue(displayPrice);
    const canPurchase = Boolean(selectedSku) && !purchaseUnavailable && !actionBusy;
    const contentItems = hamperContents.slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    const glanceFacts = [
        hamperContents.length > 0 ? { label: "Inside this hamper", value: `${hamperContents.length} listed items`, icon: <GiftIcon /> } : null,
        hamperDimensions ? { label: "Hamper dimensions", value: formatDimensions(hamperDimensions), icon: <SizeIcon /> } : null,
        hamperWeight ? { label: "Hamper weight", value: formatWeightValue(hamperWeight), icon: <BoxReadyIcon /> } : null,
    ].filter(Boolean);
    const deliverySummary = deliveryResult?.serviceable === true && deliveryResult?.orderable === true
        ? `Delivery available${deliveryResult.pincode ? ` to ${deliveryResult.pincode}` : ""}`
        : deliveryBlocked ? "Check another delivery pincode" : "Check delivery to your pincode";
    return (<main ref={pageRef} className="hp-luxe-product">
      <ProductPageStyles />
      <div className="lp-shell">
        <nav className="lp-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link><span aria-hidden="true">/</span>
          <Link to="/gifts">Gifts</Link><span aria-hidden="true">/</span>
          <span className="lp-current" aria-current="page">{product.name}</span>
        </nav>

        <section className="lp-hero" aria-label="Product details">
          <div className="lp-gallery" data-pd-reveal>
            <ProductGallery images={images} selectedImage={displayImage} onSelect={setSelectedImage} onZoom={setZoomImage} name={product.name}/>
            {glanceFacts.length > 0 && (<dl className="lp-facts">
                {glanceFacts.map((fact) => (<div key={fact.label} className="lp-fact">
                    {fact.icon}<div><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
                  </div>))}
              </dl>)}
          </div>

          <section className="lp-purchase" aria-labelledby="lp-product-title" data-pd-reveal>
            <div className="lp-purchase-top">
              <p className="lp-catalog-label">
                {product.category?.name || "HAMPORIUM"}
                {product.brand && <span>{product.brand}</span>}
              </p>
              <button type="button" className="lp-round" onClick={handleShare} aria-label="Share this product">
                <ShareIcon />
              </button>
            </div>
            <h1 id="lp-product-title" className="lp-title">{product.name}</h1>
            <div className="lp-summary-row">
              <span className={`lp-status ${purchaseUnavailable || !selectedSku ? "is-unavailable" : ""}`}>
                {!selectedSku ? "Option unavailable" : purchaseUnavailable ? "Currently unavailable" : "Available to order"}
              </span>
              <a className="lp-rating-link" href="#product-reviews">
                {reviewCount > 0 ? (<><span className="lp-star" aria-hidden="true">&#9733;</span><strong>{reviewAverage.toFixed(1)}</strong><span>({reviewCount} {reviewCount === 1 ? "review" : "reviews"})</span></>) : "Customer reviews"}
              </a>
            </div>
            {product.shortDescription && <ExpandableCopy key={product._id} text={product.shortDescription}/>}
            {shareMessage && <p role="status" className="lp-helper">{shareMessage}</p>}

            <div className="lp-price-block">
              <div className="lp-price-row">
                <p className="lp-price">{hasPrice ? formatCurrency(displayPrice) : "Price unavailable"}</p>
                {hasPrice && hasNumericValue(selectedSku?.compareAtPrice) && Number(selectedSku.compareAtPrice) > Number(displayPrice) && (<><del className="lp-compare">{formatCurrency(selectedSku.compareAtPrice)}</del>{discountPercent > 0 && <span className="lp-saving">{discountPercent}% off</span>}</>)}
              </div>
              {hasPrice && <p className="lp-tax">
                Inclusive of applicable taxes
                {selectedSku?.taxEnabled !== false && Number(selectedSku?.taxPercent || 0) > 0 ? ` \u00b7 GST ${selectedSku.taxPercent}%` : ""}
                {selectedSku?.hsnSac ? ` \u00b7 HSN/SAC ${selectedSku.hsnSac}` : ""}
              </p>}
            </div>

            {product.skus?.length > 1 && (<div>
                <div className="lp-label-row"><p id="lp-options-label" className="lp-label">Choose your option</p><p className="lp-variant-name">{selectedSku?.name}</p></div>
                <div className="lp-options" role="group" aria-labelledby="lp-options-label">
                  {product.skus.map((sku) => (<button key={sku._id} type="button" className="lp-option" aria-pressed={selectedSku?._id === sku._id} disabled={actionBusy} onClick={() => selectSku(sku)}>{sku.name}</button>))}
                </div>
              </div>)}

            <div className="lp-quantity-row">
              <div className="lp-quantity-left">
                <span id="lp-quantity-label" className="lp-label">Quantity</span>
                <div className="lp-stepper" role="group" aria-labelledby="lp-quantity-label">
                  <button type="button" disabled={quantity <= 1 || actionBusy} aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>&minus;</button>
                  <output aria-live="polite" aria-atomic="true">{quantity}</output>
                  <button type="button" disabled={quantity >= 99 || actionBusy} aria-label="Increase quantity" onClick={() => setQuantity((current) => Math.min(99, current + 1))}>+</button>
                </div>
              </div>
              {product.skus?.length <= 1 && selectedSku?.name && <p className="lp-variant-name">{selectedSize}</p>}
            </div>
            {error && <p role="alert" className="lp-feedback is-error">{error}</p>}
            <div className="lp-action-grid">
              <button type="button" className="lp-button lp-button-primary" disabled={!canPurchase} onClick={handleAddToCart} aria-busy={adding}>
                {adding ? <LoadingSpinner /> : <CartIcon />}{adding ? "Adding..." : purchaseUnavailable ? "Unavailable" : "Add to cart"}
              </button>
              <button type="button" className="lp-button lp-button-secondary" disabled={!canPurchase} onClick={handleBuyNow} aria-busy={buying}>
                {buying ? <LoadingSpinner /> : <BoltIcon />}{buying ? "Opening..." : purchaseUnavailable ? "Unavailable" : "Buy now"}
              </button>
            </div>

            <div className="lp-tools">
              <details className="lp-disclosure">
                <summary><DeliveryIcon /><span>{deliverySummary}</span><span className="lp-chevron"><ChevronIcon /></span></summary>
                <div className="lp-disclosure-body"><DeliveryChecker {...deliveryCheckerProps} idPrefix="lp-hero" compact/></div>
              </details>
              <details className="lp-disclosure">
                <summary><TicketIcon /><span>{appliedPromo?.code ? `${appliedPromo.kind === "partner" ? "Partner" : "Promo"} code: ${appliedPromo.code}` : "Have a promo or partner code?"}</span><span className="lp-chevron"><ChevronIcon /></span></summary>
                <div className="lp-disclosure-body">
                  <PromoCodeField
                    value={promoCode}
                    onChange={(value) => setPromoCode(normalizeAppliedCode(value))}
                    onApplied={handleAppliedPromo}
                    onClear={handlePromoClear}
                    initialResult={appliedPromo}
                    defaultOpen
                  />
                </div>
              </details>
            </div>
          </section>
        </section>

        <section className="lp-details" id="product-information" aria-labelledby="lp-details-title" data-pd-reveal>
          <div className="lp-section-head">
            <h2 id="lp-details-title" className="lp-heading">The finer <em>details.</em></h2>
            <p className="lp-helper">Everything about your selected hamper.</p>
          </div>
          <div className="lp-tablist" role="tablist" aria-label="Explore product information" onKeyDown={(event) => {
            const ids = ["description", "inside", "product", "delivery"];
            const current = ids.indexOf(activeInfoTab);
            let next;
            if (event.key === "ArrowRight")
                next = (current + 1) % ids.length;
            else if (event.key === "ArrowLeft")
                next = (current - 1 + ids.length) % ids.length;
            else if (event.key === "Home")
                next = 0;
            else if (event.key === "End")
                next = ids.length - 1;
            else
                return;
            event.preventDefault();
            setActiveInfoTab(ids[next]);
            event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
        }}>
            {[
            ["description", "Description"], ["inside", "What's inside"], ["product", "Product information"], ["delivery", "Delivery & returns"],
        ].map(([id, label]) => (<button key={id} type="button" role="tab" id={`lp-tab-${id}`} aria-controls={`lp-panel-${id}`} aria-selected={activeInfoTab === id} tabIndex={activeInfoTab === id ? 0 : -1} className="lp-tab" onClick={() => setActiveInfoTab(id)}>{label}</button>))}
          </div>
          <div key={`${selectedSku?._id}-${activeInfoTab}`} className="lp-tab-panel" role="tabpanel" id={`lp-panel-${activeInfoTab}`} aria-labelledby={`lp-tab-${activeInfoTab}`} tabIndex={0}>
            {activeInfoTab === "description" && (<div className="lp-description-grid">
                <div>
                  <p className="lp-eyebrow">The composition</p>
                  <h3 className="lp-subheading" style={{ marginTop: 12 }}>A closer look at your hamper.</h3>
                  <p className="lp-section-copy">{product.description || product.shortDescription || "Additional details are not listed for this hamper."}</p>
                  {selectedContainer?.name && <p className="lp-helper" style={{ marginTop: 18 }}><strong>Presented in:</strong> {selectedContainer.name}</p>}
                </div>
                <div>
                  <div className="lp-small-head"><h3 className="lp-subheading">Inside the hamper</h3>{contentItems.length > 0 && <span className="lp-helper">{contentItems.length} listed items</span>}</div>
                  {contentItems.length ? <div className="lp-inside-preview">{contentItems.slice(0, 4).map((item, index) => <InsidePreviewItem key={item._id || `preview-${index}`} item={item} component={typeof item.component === "object" ? item.component : null}/>)}</div> : <p className="lp-helper">No additional hamper contents are listed for this option.</p>}
                  {contentItems.length > 0 && <button type="button" className="lp-inline-link" onClick={() => { setActiveInfoTab("inside"); document.getElementById("lp-tab-inside")?.focus(); }}>Explore all items & details <ArrowIcon /></button>}
                </div>
              </div>)}
            {activeInfoTab === "inside" && (<>
                <div className="lp-small-head"><h3 className="lp-subheading">What's inside</h3><span className="lp-helper">{contentItems.length} listed items</span></div>
                {contentItems.length ? <div className="lp-content-grid">{contentItems.map((item, index) => <HamperContentItem key={item._id || `content-${index}`} item={item} component={typeof item.component === "object" ? item.component : null}/>)}</div> : <p className="lp-helper">No additional hamper contents are listed for this product.</p>}
              </>)}
            {activeInfoTab === "product" && (<div className="lp-info-grid">
                <div>
                  <h3 className="lp-subheading">Product information</h3>
                  <dl className="lp-info-table">
                    {product.category?.name && <LargeInfoRow label="Category" value={product.category.name}/>}
                    {product.brand && <LargeInfoRow label="Brand" value={product.brand}/>}
                    {selectedSku?.name && <LargeInfoRow label="Variant" value={selectedSku.name}/>}
                    {selectedSku?.code && <LargeInfoRow label="SKU" value={selectedSku.code}/>}
                    {selectedContainer?.name && <LargeInfoRow label="Hamper box" value={selectedContainer.name}/>}
                    <LargeInfoRow label="Hamper size" value={formatDimensions(hamperDimensions)}/>
                    <LargeInfoRow label="Hamper weight" value={formatWeightValue(hamperWeight)}/>
                    {selectedContainer?.material && <LargeInfoRow label="Box material" value={selectedContainer.material}/>}
                  </dl>
                </div>
                <div>
                  <h3 className="lp-subheading">Timing & freshness</h3>
                  {hasDeliveryFreshnessInfo ? <dl className="lp-info-table">
                    {earliestExpiryDate && <LargeInfoRow label="Earliest expiry" value={formatDateValue(earliestExpiryDate)}/>}
                    {dispatchReadyDate && <LargeInfoRow label="Dispatch ready" value={formatDateValue(dispatchReadyDate)}/>}
                    {expectedDeliveryDate && <LargeInfoRow label={locationExpectedDeliveryDate ? "Delivery to your location" : "Expected delivery"} value={formatDateValue(expectedDeliveryDate)}/>}
                    {hasProductionLead && <LargeInfoRow label="Production lead" value={formatDaysValue(productionLeadDays)}/>}
                    {hasCourierDays && <LargeInfoRow label="Courier time" value={formatDaysValue(courierDays)}/>}
                  </dl> : <p className="lp-helper" style={{ marginTop: 15 }}>Timing and freshness details have not been provided for this option.</p>}
                </div>
              </div>)}
            {activeInfoTab === "delivery" && (<div className="lp-delivery-grid">
                <div>
                  <DeliveryChecker {...deliveryCheckerProps} idPrefix="lp-details"/>
                  <div className="lp-support">
                    <h3 className="lp-subheading">Returns & support</h3>
                    <p className="lp-section-copy">Return and refund eligibility follows HAMPORIUM's order and refund policy. Final delivery estimates are confirmed for the selected pincode and hamper configuration.</p>
                    <Link className="lp-inline-link" to="/returns-refunds">View return policy <ArrowIcon /></Link>
                  </div>
                </div>
                {hasDeliveryFreshnessInfo && <DeliveryFreshnessSummary earliestExpiryDate={earliestExpiryDate} dispatchReadyDate={dispatchReadyDate} expectedDeliveryDate={expectedDeliveryDate} productionLeadDays={productionLeadDays} courierDays={courierDays} locationSpecific={Boolean(locationExpectedDeliveryDate)} unavailable={skuUnavailable}/>}
              </div>)}
          </div>
        </section>

        <section id="product-reviews" className="lp-reviews" aria-label="Customer reviews" data-pd-reveal>
          <ProductReviewsSection productId={product._id}/>
        </section>
        {recentProducts.length > 0 && (<section className="lp-recent" aria-labelledby="lp-recent-title" data-pd-reveal>
            <div className="lp-section-head">
              <div><p className="lp-eyebrow">Your recent discoveries</p><h2 id="lp-recent-title" className="lp-heading" style={{ marginTop: 8 }}>Worth another <em>look.</em></h2></div>
              <Link to="/gifts" className="lp-inline-link">All hampers <ArrowIcon /></Link>
            </div>
            <div className="lp-recent-grid">{recentProducts.slice(0, 4).map((item) => <RecentProductCard key={item.slug} item={item}/>)}</div>
          </section>)}
      </div>

      <div className="lp-mobile-bar" aria-label="Quick purchase">
        <div className="lp-mobile-price"><small>Per hamper</small><strong>{hasPrice ? formatCurrency(displayPrice) : "Ask for price"}</strong></div>
        <button type="button" className="lp-button lp-button-primary" onClick={handleAddToCart} disabled={!canPurchase}>{adding ? "Adding..." : purchaseUnavailable ? "Unavailable" : "Add to cart"}</button>
        <button type="button" className="lp-button lp-button-secondary" onClick={handleBuyNow} disabled={!canPurchase}>{buying ? "Opening..." : purchaseUnavailable ? "Unavailable" : "Buy now"}</button>
      </div>
      <ProductLightbox src={zoomImage} images={images} title={product.name} onClose={() => setZoomImage("")} onChange={(url) => { setSelectedImage(url); setZoomImage(url); }}/>
    </main>);
};
/* UI helpers. All product data and prices still come from the existing API. */
const hasNumericValue = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const ExpandableCopy = ({ text }) => {
    const [expanded, setExpanded] = useState(false);
    const long = String(text || "").length > 190;
    return <div className="lp-description"><p className={long && !expanded ? "is-clamped" : ""}>{text}</p>{long && <button type="button" className="lp-text-button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "Read less" : "Read more"}</button>}</div>;
};
const ProductGallery = ({ images, selectedImage, onSelect, onZoom, name }) => {
    const gestureRef = useRef(null);
    const lastSwipeRef = useRef(0);
    const index = Math.max(0, images.findIndex((image) => image.url === selectedImage));
    const step = (direction) => {
        if (images.length < 2)
            return;
        const next = (index + direction + images.length) % images.length;
        onSelect(images[next].url);
    };
    return <>
    <div className="lp-gallery-head"><span className="lp-eyebrow">The HAMPORIUM edit</span><span className="lp-count">{images.length > 0 ? `${String(index + 1).padStart(2, "0")} / ${String(images.length).padStart(2, "0")}` : "Product gallery"}</span></div>
    <div className="lp-stage" role="group" aria-label="Product image gallery" onKeyDown={(event) => {
            if (images.length < 2)
                return;
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                step(-1);
            }
            if (event.key === "ArrowRight") {
                event.preventDefault();
                step(1);
            }
        }}>
      <button type="button" className="lp-gallery-open" aria-label={`Enlarge ${name} image`} disabled={!selectedImage} onTouchStart={(event) => { const touch = event.touches[0]; gestureRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }} onTouchEnd={(event) => {
            const start = gestureRef.current;
            const end = event.changedTouches[0];
            gestureRef.current = null;
            if (!start || !end || images.length < 2)
                return;
            const dx = end.clientX - start.x;
            const dy = end.clientY - start.y;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.25) {
                lastSwipeRef.current = Date.now();
                step(dx < 0 ? 1 : -1);
            }
        }} onClick={() => { if (Date.now() - lastSwipeRef.current > 500)
        onZoom(selectedImage); }}>
        <div className="lp-stage-imagewrap"><GalleryImage src={selectedImage} alt={name}/></div>
      </button>
      {images.length > 0 && <span className="lp-image-counter" aria-live="polite" aria-atomic="true">{index + 1} / {images.length}</span>}
      {images.length > 1 && <>
        <button type="button" aria-label="Previous product image" className="lp-round lp-gallery-prev" onClick={() => step(-1)}><DirectionalArrow direction="left"/></button>
        <button type="button" aria-label="Next product image" className="lp-round lp-gallery-next" onClick={() => step(1)}><DirectionalArrow /></button>
      </>}
      {selectedImage && <button type="button" aria-label="Zoom product image" className="lp-round lp-zoom" onClick={() => onZoom(selectedImage)}><ZoomIcon /></button>}
    </div>
    {images.length > 1 && <div className="lp-thumbnails" aria-label="Choose an image">
      {images.map((image, imageIndex) => <button key={image.url} type="button" className="lp-thumbnail" aria-label={`View product image ${imageIndex + 1}`} aria-pressed={selectedImage === image.url} onClick={() => onSelect(image.url)}><SafeImage src={image.url} alt={image.alt || `${name}, view ${imageIndex + 1}`}/></button>)}
    </div>}
    <div className="lp-gallery-note"><span>{images.length > 1 ? "Explore every angle." : "A closer look, in every detail."}</span>{selectedImage && <button type="button" className="lp-text-button" onClick={() => onZoom(selectedImage)}>View full image <ZoomIcon /></button>}</div>
  </>;
};
/* Decode the requested image before crossfading; old requests cannot replace a newer selection. */
const GalleryImage = ({ src, alt }) => {
    const currentRef = useRef("");
    const [view, setView] = useState({ current: "", previous: "", failed: false });
    useEffect(() => {
        let cancelled = false;
        let fadeTimer;
        if (!src) {
            currentRef.current = "";
            setView({ current: "", previous: "", failed: false });
            return undefined;
        }
        const preload = new Image();
        preload.onload = async () => {
            try {
                if (preload.decode)
                    await preload.decode();
            }
            catch { /* onload already confirmed usable data. */ }
            if (cancelled)
                return;
            const previous = currentRef.current;
            currentRef.current = src;
            setView({ current: src, previous: previous === src ? "" : previous, failed: false });
            fadeTimer = window.setTimeout(() => { if (!cancelled)
                setView((state) => ({ ...state, previous: "" })); }, 600);
        };
        preload.onerror = () => { if (!cancelled) {
            currentRef.current = "";
            setView({ current: "", previous: "", failed: true });
        } };
        preload.src = src;
        return () => { cancelled = true; window.clearTimeout(fadeTimer); preload.onload = null; preload.onerror = null; };
    }, [src]);
    if (!view.current)
        return <div className="lp-placeholder"><GiftIcon /><span>{view.failed || !src ? "Image unavailable" : "Loading image..."}</span></div>;
    return <>
    {view.previous && <img src={view.previous} alt="" aria-hidden="true" className="lp-gallery-image"/>}
    <img key={view.current} src={view.current} alt={alt} className="lp-gallery-image lp-image-current" decoding="async"/>
  </>;
};
const ProductLightbox = ({ src, images, title, onClose, onChange }) => {
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const isOpen = Boolean(src);
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog || !isOpen)
            return undefined;
        const focusedBefore = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        const previousPadding = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (!dialog.open)
            dialog.showModal();
        document.body.style.overflow = "hidden";
        if (scrollbarWidth > 0)
            document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight || "0") + scrollbarWidth}px`;
        closeRef.current?.focus();
        return () => {
            if (dialog.open)
                dialog.close();
            document.body.style.overflow = previousOverflow;
            document.body.style.paddingRight = previousPadding;
            if (focusedBefore?.isConnected && typeof focusedBefore.focus === "function")
                focusedBefore.focus({ preventScroll: true });
        };
    }, [isOpen]);
    const index = Math.max(0, images.findIndex((image) => image.url === src));
    const step = (direction) => { if (images.length > 1)
        onChange(images[(index + direction + images.length) % images.length].url); };
    return <dialog ref={dialogRef} className="lp-lightbox" aria-labelledby="lp-modal-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
            if (event.target !== event.currentTarget)
                return;
            const box = event.currentTarget.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
                onClose();
        }} onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                step(-1);
            }
            if (event.key === "ArrowRight") {
                event.preventDefault();
                step(1);
            }
        }}>
    {isOpen && <div className="lp-modal-inner">
      <div className="lp-modal-head"><h2 id="lp-modal-title" className="lp-modal-title">{title}</h2><button ref={closeRef} type="button" className="lp-round" aria-label="Close image preview" onClick={onClose}><CloseIcon /></button></div>
      <SafeImage src={src} alt={title} className="lp-modal-image" loading="eager" largePlaceholder/>
      {images.length > 1 && <div className="lp-modal-controls"><button type="button" className="lp-round" aria-label="Previous zoom image" onClick={() => step(-1)}><DirectionalArrow direction="left"/></button><span>{index + 1} / {images.length}</span><button type="button" className="lp-round" aria-label="Next zoom image" onClick={() => step(1)}><DirectionalArrow /></button></div>}
    </div>}
  </dialog>;
};
const SafeImage = ({ src, alt = "", className = "", loading = "lazy", largePlaceholder = false }) => {
    const [failed, setFailed] = useState(false);
    useEffect(() => { setFailed(false); }, [src]);
    if (!src || failed)
        return <div className={`lp-placeholder ${className}`} role="img" aria-label={alt ? `${alt}: image unavailable` : "Image unavailable"}><GiftIcon />{largePlaceholder && <span>Image unavailable</span>}</div>;
    return <img src={src} alt={alt} className={className} loading={loading} decoding="async" onError={() => setFailed(true)}/>;
};
const InsidePreviewItem = ({ item, component }) => <div className="lp-preview-item">
  <span className="lp-item-thumb"><SafeImage src={getGalleryUrl(component?.images?.[0])} alt={item.displayName || component?.name || "Hamper item"}/></span>
  <div><p className="lp-item-name">{item.displayName || component?.name || "Hamper item"}</p><p className="lp-item-detail">{item.quantity} {item.unit || "pc"}</p>{component?.expiryDate && <p className="lp-item-detail">Best before {formatDateValue(component.expiryDate)}</p>}</div>
</div>;
const HamperContentItem = ({ item, component }) => {
    const metadata = [
        component?.dimensions ? ["Size", formatDimensions(component.dimensions)] : null,
        component?.weight ? ["Weight", formatWeightValue(component.weight)] : null,
        component?.dietary ? ["Dietary", component.dietary] : null,
        component?.expiryDate ? ["Expiry", formatDateValue(component.expiryDate)] : null,
        component?.expiryTracked && hasNumericValue(component?.shelfLifeDays) ? ["Shelf life", formatDaysValue(component.shelfLifeDays)] : null,
    ].filter(Boolean);
    return <details className="lp-content-item">
    <summary>
      <span className="lp-item-thumb"><SafeImage src={getGalleryUrl(component?.images?.[0])} alt={item.displayName || component?.name || "Hamper item"}/></span>
      <div><p className="lp-item-name">{item.displayName || component?.name || "Hamper item"}</p>{component?.brand && <p className="lp-item-detail">{component.brand}</p>}<p className="lp-item-detail">Qty {item.quantity} {item.unit || "pc"}{component?.expiryDate ? ` \u00b7 Best before ${formatDateValue(component.expiryDate)}` : ""}</p></div>
      <span className="lp-chevron"><ChevronIcon /></span>
    </summary>
    <div className="lp-content-body">{metadata.length ? <dl className="lp-meta-grid">{metadata.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="lp-helper">No additional specifications are listed for this item.</p>}</div>
  </details>;
};
const DeliveryChecker = ({ deliveryPincode, deliveryChecking, locationLoading, selectedSku, deliveryLocation, deliveryError, deliveryResult, handleDeliverySubmit, handleUseCurrentLocation, handleDeliveryPincodeChange, compact = false, idPrefix = "lp-delivery" }) => <div>
  {!compact && <h3 className="lp-subheading">Delivery & location</h3>}
  {deliveryLocation?.pincode && <p className="lp-helper">Saved pincode: {deliveryLocation.pincode}</p>}
  <form onSubmit={handleDeliverySubmit} className="lp-form-row">
    <div className="lp-input-wrap"><label className="lp-sr" htmlFor={`${idPrefix}-pincode`}>Delivery pincode</label><PinIcon /><input id={`${idPrefix}-pincode`} className="lp-input" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={deliveryPincode} onChange={handleDeliveryPincodeChange} placeholder="6-digit pincode" aria-invalid={Boolean(deliveryError)} aria-describedby={deliveryError ? `${idPrefix}-error` : undefined}/></div>
    <button type="submit" className="lp-button" disabled={deliveryChecking || locationLoading || !selectedSku} aria-busy={deliveryChecking}>{deliveryChecking ? <LoadingSpinner /> : "Check"}</button>
  </form>
  <div className="lp-form-foot"><button type="button" className="lp-text-button" disabled={locationLoading || deliveryChecking} onClick={handleUseCurrentLocation}>{locationLoading ? <LoadingSpinner /> : <LocateIcon />}{locationLoading ? "Detecting location..." : "Use current location"}</button></div>
  {deliveryError && <p className="lp-feedback is-error" id={`${idPrefix}-error`} role="alert">{deliveryError}</p>}
  {deliveryResult && <DeliveryResult delivery={deliveryResult}/>}
</div>;
const DeliveryResult = ({ delivery }) => {
    const available = delivery?.serviceable === true && delivery?.orderable === true;
    const place = [delivery?.city, delivery?.state].filter(Boolean).join(", ");
    return <div role="status" className={`lp-feedback ${available ? "is-success" : ""}`}>
    {available ? <><strong>Delivery available{place ? ` to ${place}` : ""}.</strong><br />{delivery.pincode ? `Pincode ${delivery.pincode}. ` : ""}{delivery.expectedDeliveryDate ? `Expected by ${formatDateValue(delivery.expectedDeliveryDate)}.` : ""}</> : delivery?.message || "Delivery is currently unavailable for this pincode."}
  </div>;
};
const DeliveryFreshnessSummary = ({ earliestExpiryDate, dispatchReadyDate, expectedDeliveryDate, productionLeadDays, courierDays, locationSpecific = false, unavailable = false }) => <div className="lp-freshness">
  <div className="lp-small-head"><h3 className="lp-subheading">Delivery & freshness</h3><CalendarIcon /></div>
  <p className="lp-helper">Current estimate for this hamper configuration.</p>
  <dl className="lp-info-table">
    {expectedDeliveryDate && <LargeInfoRow label={locationSpecific ? "Delivery to your location" : "Expected delivery"} value={formatDateValue(expectedDeliveryDate)}/>}
    {earliestExpiryDate && <LargeInfoRow label="Earliest expiry" value={formatDateValue(earliestExpiryDate)}/>}
    {dispatchReadyDate && <LargeInfoRow label="Dispatch ready" value={formatDateValue(dispatchReadyDate)}/>}
    {hasNumericValue(productionLeadDays) && <LargeInfoRow label="Production lead" value={formatDaysValue(productionLeadDays)}/>}
    {hasNumericValue(courierDays) && <LargeInfoRow label="Courier time" value={formatDaysValue(courierDays)}/>}
  </dl>
  {unavailable && <p className="lp-feedback">A reliable delivery estimate cannot currently be guaranteed because one or more required materials are unavailable.</p>}
</div>;
const LargeInfoRow = ({ label, value }) => <div className="lp-info-row"><dt>{label}</dt><dd>{value}</dd></div>;
const RecentProductCard = ({ item }) => <Link className="lp-recent-card" to={`/products/${item.slug}`}>
  <div className="lp-recent-image"><SafeImage src={item.image} alt={item.name}/></div>
  {item.category && <p className="lp-recent-category">{item.category}</p>}
  <h3 className="lp-recent-title">{item.name}</h3>
  <div className="lp-recent-footer"><span>{hasNumericValue(item.price) ? formatCurrency(item.price) : "View details"}</span><span aria-hidden="true"><ArrowIcon /></span></div>
</Link>;
const ProductDetailsSkeleton = () => <main className="hp-luxe-product" aria-busy="true" aria-label="Loading product">
  <ProductPageStyles /><div className="lp-shell">
    <div className="lp-skeleton lp-skeleton-line" style={{ width: 180, height: 12, marginBottom: 25 }}/>
    <div className="lp-hero"><div><div className="lp-skeleton lp-skeleton-image"/><div className="lp-skeleton lp-skeleton-line" style={{ marginTop: 20, width: "50%" }}/></div>
      <div className="lp-purchase"><div className="lp-skeleton lp-skeleton-line" style={{ width: "35%" }}/><div className="lp-skeleton lp-skeleton-line" style={{ height: 40 }}/><div className="lp-skeleton lp-skeleton-line" style={{ width: "70%", height: 34 }}/>{[1, 2, 3].map((n) => <div key={n} className="lp-skeleton lp-skeleton-line" style={{ width: `${100 - n * 7}%` }}/>)}<div className="lp-skeleton lp-skeleton-line" style={{ height: 44, width: "45%", marginTop: 30 }}/><div className="lp-skeleton lp-skeleton-line" style={{ height: 49, marginTop: 35 }}/></div>
    </div>
  </div>
</main>;
const ProductMissing = () => <main className="hp-luxe-product"><ProductPageStyles /><div className="lp-empty-state"><p className="lp-eyebrow">HAMPORIUM</p><h1 className="lp-heading">Product not found.</h1><p>This product is not currently available in our catalogue.</p><Link className="lp-button lp-button-secondary" to="/gifts">Back to gifts <ArrowIcon /></Link></div></main>;
const LoadingSpinner = () => <span className="lp-spinner" aria-hidden="true"><ClockIcon /></span>;
const DirectionalArrow = ({ direction = "right" }) => <span aria-hidden="true" style={direction === "left" ? { transform: "rotate(180deg)" } : undefined}><ArrowIcon /></span>;
const PRODUCT_PAGE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');

/* Scoped to this page. No global button, image or heading overrides. */
.hp-luxe-product {
  --lp-paper: #fbf8f3; --lp-white: #fffefb; --lp-ink: #2a241e;
  --lp-muted: #746a60; --lp-line: #e8dfd3; --lp-gold: #92703c;
  --lp-orange: #f47822; --lp-serif: 'Cormorant Garamond', Georgia, serif;
  --lp-ease: cubic-bezier(.22,1,.36,1);
  width: 100%; min-width: 0; min-height: 100vh; color: var(--lp-ink);
  background: radial-gradient(ellipse at 8% 0%, #f4e9d9 0, transparent 36%), var(--lp-paper);
  font-family: 'Manrope', Arial, sans-serif; font-size: 14px; line-height: 1.6;
}
.hp-luxe-product *, .lp-lightbox * { box-sizing: border-box; }
.hp-luxe-product :where(h1,h2,h3,h4,p,figure,dl,dd) { margin: 0; }
.hp-luxe-product :where(button,input,select,textarea), .lp-lightbox button { font: inherit; }
.hp-luxe-product button { cursor: pointer; }
.hp-luxe-product button:disabled { cursor: not-allowed; opacity: .48; }
.hp-luxe-product :where(a,button,input,summary):focus-visible, .lp-lightbox :focus-visible {
  outline: 2px solid #af681e; outline-offset: 4px;
}
.hp-luxe-product a { color: inherit; text-decoration: none; }
.hp-luxe-product .lp-icon, .lp-lightbox .lp-icon { display: block; width: 19px; height: 19px; flex: 0 0 auto; }
.hp-luxe-product .lp-shell { width: 100%; padding: 104px clamp(16px,3vw,64px) 64px; }
.hp-luxe-product .lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
.hp-luxe-product .lp-breadcrumb { display: flex; align-items: center; gap: 10px; margin-bottom: 23px; font-size: 12px; color: var(--lp-muted); min-width: 0; }
.hp-luxe-product .lp-breadcrumb a { flex-shrink: 0; transition: color .2s; }
.hp-luxe-product .lp-breadcrumb a:hover { color: #ad5416; }
.hp-luxe-product .lp-breadcrumb .lp-current { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--lp-ink); }
.hp-luxe-product .lp-hero { display: grid; grid-template-columns: minmax(0,1.15fr) minmax(390px,.85fr); gap: clamp(24px,3.2vw,64px); align-items: start; }
.hp-luxe-product .lp-gallery { min-width: 0; }
.hp-luxe-product .lp-gallery-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.hp-luxe-product .lp-eyebrow { display: inline-flex; align-items: center; gap: 10px; color: var(--lp-gold); font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.hp-luxe-product .lp-eyebrow::before { content: ''; width: 25px; height: 1px; background: #ba9459; }
.hp-luxe-product .lp-count { font-size: 12px; font-weight: 600; letter-spacing: .08em; color: var(--lp-muted); }
.hp-luxe-product .lp-stage { position: relative; overflow: hidden; width: 100%; height: clamp(320px,34vw,540px); background: #f0e7da; border-radius: 20px; isolation: isolate; box-shadow: 0 16px 40px -26px #6b4a2266; }
.hp-luxe-product .lp-stage::after { content: ''; position: absolute; inset: 10px; border: 1px solid #ffffff70; border-radius: 12px; pointer-events: none; z-index: 3; }
.hp-luxe-product .lp-gallery-open { position: absolute; inset: 0; display: block; width: 100%; height: 100%; border: 0; padding: 0; background: none; cursor: zoom-in; touch-action: pan-y pinch-zoom; }
.hp-luxe-product .lp-gallery-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.hp-luxe-product .lp-image-current { animation: lpImageIn .55s ease-out; }
.hp-luxe-product .lp-stage-imagewrap { position: absolute; inset: 0; transition: transform 1s var(--lp-ease); }
.hp-luxe-product .lp-placeholder { width: 100%; height: 100%; min-height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--lp-muted); background: #f1ebe2; font-size: 12px; }
.hp-luxe-product .lp-placeholder .lp-icon { width: 26px; height: 26px; color: #9e7943; }
.hp-luxe-product .lp-image-counter { position: absolute; top: 22px; left: 22px; z-index: 4; background: #fffefbed; padding: 6px 12px; border-radius: 30px; color: #4d443b; font-size: 12px; letter-spacing: .05em; pointer-events: none; }
.hp-luxe-product .lp-round, .lp-lightbox .lp-round { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 44px; height: 44px; padding: 0; border: 1px solid #d9ccbb; border-radius: 50%; background: #fffdf9; color: #4c3e2e; transition: background .25s, border-color .25s, transform .35s var(--lp-ease); }
.hp-luxe-product .lp-gallery-prev, .hp-luxe-product .lp-gallery-next, .hp-luxe-product .lp-zoom { position: absolute; z-index: 4; }
.hp-luxe-product .lp-gallery-prev { left: 20px; top: calc(50% - 22px); }
.hp-luxe-product .lp-gallery-next { right: 20px; top: calc(50% - 22px); }
.hp-luxe-product .lp-zoom { right: 20px; bottom: 20px; }
.hp-luxe-product .lp-thumbnails { display: flex; gap: 10px; overflow-x: auto; padding: 13px 2px 5px; scroll-snap-type: x proximity; scrollbar-width: thin; scrollbar-color: #d4bea0 transparent; }
.hp-luxe-product .lp-thumbnail { display: block; width: 64px; height: 64px; flex: 0 0 64px; border: 1px solid #d9cbb9; border-radius: 10px; padding: 3px; background: #fffdfa; overflow: hidden; scroll-snap-align: start; transition: border-color .25s, box-shadow .25s, transform .35s var(--lp-ease); }
.hp-luxe-product .lp-thumbnail img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }
.hp-luxe-product .lp-thumbnail[aria-pressed='true'] { border-color: #ae7434; box-shadow: 0 0 0 2px #b8842e23; }
.hp-luxe-product .lp-gallery-note { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-top: 12px; color: var(--lp-muted); font-size: 12px; }
.hp-luxe-product .lp-text-button { display: inline-flex; align-items: center; gap: 7px; border: 0; border-bottom: 1px solid #aa845651; padding: 2px 0; background: transparent; color: #755329; font-size: 12px; font-weight: 700; }
.hp-luxe-product .lp-facts { display: grid; grid-template-columns: repeat(auto-fit,minmax(120px,1fr)); gap: 16px; border-top: 1px solid var(--lp-line); margin-top: 19px; padding-top: 19px; }
.hp-luxe-product .lp-fact { display: flex; gap: 10px; min-width: 0; align-items: start; }
.hp-luxe-product .lp-fact > .lp-icon { color: #967442; margin-top: 3px; }
.hp-luxe-product .lp-fact dt { color: var(--lp-muted); font-size: 11px; margin-bottom: 3px; }
.hp-luxe-product .lp-fact dd { color: #4b4034; font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }

/* Light purchase surface: no forced height and no nested dark panel. */
.hp-luxe-product .lp-purchase { position: relative; min-width: 0; background: linear-gradient(160deg,#fffefb,#fffdf8 70%,#faf3e8); border: 1px solid #e6dbc9; border-radius: 20px; padding: clamp(20px,1.7vw,26px); box-shadow: 0 18px 45px -35px #76532169; }
.hp-luxe-product .lp-purchase::before { content: ''; position: absolute; top: -1px; left: 30px; right: 30px; height: 2px; background: linear-gradient(90deg,transparent,#c89e5d,transparent); }
.hp-luxe-product .lp-purchase-top { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 7px; }
.hp-luxe-product .lp-catalog-label { color: #8c6632; font-size: 11px; letter-spacing: .11em; text-transform: uppercase; font-weight: 800; overflow-wrap: anywhere; }
.hp-luxe-product .lp-catalog-label span { display: block; color: var(--lp-muted); letter-spacing: .06em; font-size: 10px; margin-top: 2px; }
.hp-luxe-product .lp-purchase-top .lp-round { width: 38px; height: 38px; background: transparent; }
.hp-luxe-product .lp-title { font-family: var(--lp-serif); font-size: clamp(34px,2.9vw,46px); line-height: 1; font-weight: 600; letter-spacing: -.025em; overflow-wrap: anywhere; }
.hp-luxe-product .lp-summary-row { display: flex; flex-wrap: wrap; align-items: center; gap: 9px 15px; margin-top: 12px; font-size: 12px; }
.hp-luxe-product .lp-status { display: inline-flex; gap: 7px; align-items: center; font-size: 11px; color: #27614d; font-weight: 700; }
.hp-luxe-product .lp-status::before { content: ''; width: 6px; height: 6px; flex-shrink: 0; border-radius: 50%; background: currentColor; }
.hp-luxe-product .lp-status.is-unavailable { color: #975020; }
.hp-luxe-product .lp-rating-link { display: inline-flex; align-items: center; gap: 6px; color: #5f5141; font-size: 12px; }
.hp-luxe-product .lp-star { color: #99712e; font-size: 14px; }
.hp-luxe-product .lp-description { color: #71675b; font-size: 14px; line-height: 1.65; margin-top: 11px; }
.hp-luxe-product .lp-description .is-clamped { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hp-luxe-product .lp-description .lp-text-button { margin-top: 4px; }
.hp-luxe-product .lp-price-block { margin-top: 13px; padding: 10px 0; border-top: 1px solid var(--lp-line); border-bottom: 1px solid var(--lp-line); }
.hp-luxe-product .lp-price-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; }
.hp-luxe-product .lp-price { font-size: clamp(28px,2.3vw,34px); font-weight: 700; letter-spacing: -.04em; line-height: 1.1; color: #30271f; }
.hp-luxe-product .lp-price del, .hp-luxe-product .lp-compare { color: #86786b; font-size: 14px; font-weight: 500; }
.hp-luxe-product .lp-saving { font-size: 11px; font-weight: 800; color: #874923; background: #faebdb; padding: 4px 8px; border-radius: 5px; letter-spacing: .02em; }
.hp-luxe-product .lp-tax { font-size: 11px; color: #776a5d; margin-top: 7px; line-height: 1.6; }
.hp-luxe-product .lp-label-row { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; margin: 12px 0 7px; }
.hp-luxe-product .lp-label { font-size: 12px; font-weight: 800; color: #514539; }
.hp-luxe-product .lp-variant-name { color: var(--lp-muted); font-size: 12px; text-align: right; overflow-wrap: anywhere; }
.hp-luxe-product .lp-options { display: flex; gap: 8px; flex-wrap: wrap; }
.hp-luxe-product .lp-option { min-height: 42px; padding: 9px 13px; border: 1px solid var(--lp-line); border-radius: 9px; background: #fffefb; color: #675646; font-size: 12px; font-weight: 700; transition: background .25s, border-color .25s; }
.hp-luxe-product .lp-option[aria-pressed='true'] { background: #f7efdf; color: #6f4b1f; border-color: #b38b55; }
.hp-luxe-product .lp-quantity-row { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-top: 12px; }
.hp-luxe-product .lp-quantity-left { display: flex; align-items: center; gap: 12px; }
.hp-luxe-product .lp-stepper { display: flex; align-items: center; border: 1px solid #e0d4c2; border-radius: 9px; background: #fffefb; overflow: hidden; }
.hp-luxe-product .lp-stepper button { width: 42px; height: 42px; padding: 0; border: 0; background: transparent; font-size: 21px; color: #65513c; }
.hp-luxe-product .lp-stepper output { min-width: 30px; text-align: center; font-weight: 700; font-size: 14px; }
.hp-luxe-product .lp-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
.hp-luxe-product .lp-button { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 49px; border-radius: 10px; padding: 12px 18px; border: 1px solid transparent; background: #fffdfa; color: #54422f; font-weight: 800; font-size: 13px; line-height: 1.2; transition: transform .35s var(--lp-ease), background .25s, box-shadow .35s; overflow: hidden; }
.hp-luxe-product .lp-button-primary { background: linear-gradient(120deg,#f47822,#e76915); color: #fff; box-shadow: 0 8px 18px -12px #be551b99; }
.hp-luxe-product .lp-button-secondary { color: #65441f; border-color: #b5925d; background: #fff9ed; }
.hp-luxe-product .lp-button-primary::after { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg,transparent 20%,#ffffff45,transparent 78%); transform: translateX(-120%); transition: transform .8s var(--lp-ease); pointer-events: none; }
.hp-luxe-product .lp-feedback { color: #82472c; border-left: 2px solid #b47647; background: #fff4e9; padding: 9px 12px; margin-top: 12px; font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
.hp-luxe-product .lp-feedback.is-error { color: #9b2929; background: #fff1ee; border-color: #cd7270; }
.hp-luxe-product .lp-feedback.is-success { color: #2a6049; background: #f1f7f0; border-color: #76a689; }
.hp-luxe-product .lp-tools { margin-top: 14px; border-top: 1px solid var(--lp-line); }
.hp-luxe-product .lp-disclosure { border-bottom: 1px solid var(--lp-line); }
.hp-luxe-product .lp-disclosure summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 11px; min-height: 46px; padding: 8px 0; font-size: 12px; font-weight: 700; color: #64503a; }
.hp-luxe-product summary::-webkit-details-marker { display: none; }
.hp-luxe-product .lp-disclosure summary > span:first-of-type { min-width: 0; flex: 1; }
.hp-luxe-product .lp-disclosure summary .lp-chevron { transition: transform .35s var(--lp-ease); }
.hp-luxe-product .lp-disclosure[open] summary .lp-chevron { transform: rotate(180deg); }
.hp-luxe-product .lp-disclosure-body { padding: 2px 0 16px; }
.hp-luxe-product .lp-disclosure[open] .lp-disclosure-body { animation: lpContentIn .35s ease-out; }
.hp-luxe-product .lp-form-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 9px; margin-top: 10px; }
.hp-luxe-product .lp-input-wrap { position: relative; min-width: 0; }
.hp-luxe-product .lp-input-wrap > .lp-icon { position: absolute; top: 14px; left: 13px; color: #9c7c54; pointer-events: none; }
.hp-luxe-product .lp-input { min-width: 0; width: 100%; height: 46px; border: 1px solid #e0d4c5; border-radius: 8px; color: #3b3026; background: #fffefa; font-size: 14px; padding: 0 12px 0 41px; transition: border-color .2s, box-shadow .2s; }
.hp-luxe-product .lp-input:focus { border-color: #b7894c; box-shadow: 0 0 0 3px #ba91541c; outline: none; }
.hp-luxe-product .lp-input::placeholder { color: #8a7a6a; font-weight: 400; }
.hp-luxe-product .lp-form-row .lp-button { min-height: 46px; font-size: 12px; padding: 9px 14px; background: #f3e5cb; color: #614721; }
.hp-luxe-product .lp-form-foot { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
.hp-luxe-product .lp-helper { color: #736556; font-size: 12px; line-height: 1.7; }
.hp-luxe-product .lp-applied { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-top: 12px; padding-left: 12px; border-left: 2px solid #8db398; }
.hp-luxe-product .lp-applied strong { display: block; font-size: 12px; color: #2c654c; overflow-wrap: anywhere; }
.hp-luxe-product .lp-applied .lp-helper { margin-top: 3px; }

/* The lower page remains light, with all product information accessible. */
.hp-luxe-product .lp-details { margin-top: 40px; border-top: 1px solid #ded2bf; padding-top: 24px; scroll-margin-top: 104px; }
.hp-luxe-product .lp-section-head { display: flex; justify-content: space-between; align-items: end; gap: 20px; margin-bottom: 18px; }
.hp-luxe-product .lp-heading { font-family: var(--lp-serif); font-size: clamp(31px,2.5vw,42px); font-weight: 600; line-height: 1.1; letter-spacing: -.02em; }
.hp-luxe-product .lp-heading em { color: #967242; font-weight: 500; }
.hp-luxe-product .lp-tablist { display: flex; gap: 4px; padding: 5px; background: #f0e9de; border: 1px solid #e5d9c8; border-radius: 12px; overflow-x: auto; scrollbar-width: thin; }
.hp-luxe-product .lp-tab { position: relative; min-width: max-content; flex: 1; min-height: 47px; padding: 10px 17px; border: 0; border-radius: 8px; color: #7b6a56; background: transparent; font-weight: 700; font-size: 13px; transition: background .25s, box-shadow .25s, color .25s; }
.hp-luxe-product .lp-tab[aria-selected='true'] { background: #fffefa; color: #694719; box-shadow: 0 3px 12px #52391409; }
.hp-luxe-product .lp-tab[aria-selected='true']::after { content: ''; position: absolute; height: 2px; background: #b99153; border-radius: 3px; bottom: 4px; left: 35%; right: 35%; animation: lpLineIn .4s var(--lp-ease); }
.hp-luxe-product .lp-tab-panel { margin-top: 16px; padding: clamp(20px,2.5vw,36px); border: 1px solid #e8dfd2; border-radius: 16px; background: #fffefb; min-height: 240px; animation: lpContentIn .4s ease-out; }
.hp-luxe-product .lp-description-grid { display: grid; grid-template-columns: minmax(0,.9fr) minmax(0,1.1fr); gap: clamp(25px,4vw,70px); }
.hp-luxe-product .lp-section-copy { margin-top: 15px; font-size: 14px; line-height: 1.95; color: #6b5f52; white-space: pre-line; overflow-wrap: anywhere; }
.hp-luxe-product .lp-subheading { font-family: var(--lp-serif); font-size: 29px; line-height: 1.12; font-weight: 600; }
.hp-luxe-product .lp-small-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
.hp-luxe-product .lp-inside-preview { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px 20px; }
.hp-luxe-product .lp-preview-item { display: flex; gap: 11px; align-items: center; min-width: 0; border-bottom: 1px solid #ece4d9; padding-bottom: 14px; }
.hp-luxe-product .lp-item-thumb { display: block; width: 64px; height: 64px; flex: 0 0 64px; background: #f3ecdf; border-radius: 10px; overflow: hidden; }
.hp-luxe-product .lp-item-thumb img { display: block; height: 100%; width: 100%; object-fit: cover; transition: transform .65s var(--lp-ease); }
.hp-luxe-product .lp-item-name { font-size: 13px; font-weight: 700; line-height: 1.55; color: #514336; overflow-wrap: anywhere; }
.hp-luxe-product .lp-item-detail { font-size: 12px; color: #7d6c59; line-height: 1.65; margin-top: 3px; }
.hp-luxe-product .lp-inline-link { display: inline-flex; align-items: center; gap: 9px; margin-top: 17px; color: #856032; font-size: 12px; font-weight: 800; border: 0; border-bottom: 1px solid #c9ae8655; padding: 3px 0; background: transparent; }
.hp-luxe-product .lp-content-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; align-items: start; }
.hp-luxe-product .lp-content-item { border: 1px solid #e8dfd2; border-radius: 12px; overflow: hidden; background: #fffefa; }
.hp-luxe-product .lp-content-item summary { list-style: none; display: flex; align-items: center; gap: 13px; padding: 15px; cursor: pointer; }
.hp-luxe-product .lp-content-item summary > div:nth-child(2) { flex: 1; min-width: 0; }
.hp-luxe-product .lp-content-item[open] > summary { background: #fcf8ef; }
.hp-luxe-product .lp-content-item .lp-chevron { transition: transform .3s ease; }
.hp-luxe-product .lp-content-item[open] .lp-chevron { transform: rotate(180deg); }
.hp-luxe-product .lp-content-body { padding: 14px 17px; border-top: 1px solid var(--lp-line); animation: lpContentIn .3s ease-out; }
.hp-luxe-product .lp-meta-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px 16px; }
.hp-luxe-product .lp-meta-grid dt { color: #7c6f60; font-size: 11px; }
.hp-luxe-product .lp-meta-grid dd { color: #45392e; font-weight: 600; font-size: 13px; overflow-wrap: anywhere; margin-top: 2px; }
.hp-luxe-product .lp-info-grid, .hp-luxe-product .lp-delivery-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: clamp(24px,4vw,64px); }
.hp-luxe-product .lp-info-table { margin-top: 16px; }
.hp-luxe-product .lp-info-row { display: grid; grid-template-columns: minmax(115px,.65fr) minmax(0,1fr); gap: 18px; padding: 12px 0; border-bottom: 1px solid #ece4d8; }
.hp-luxe-product .lp-info-row dt { color: #7b6b58; font-size: 12px; }
.hp-luxe-product .lp-info-row dd { color: #47392d; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.hp-luxe-product .lp-freshness { padding: 18px; border: 1px solid #e4d8c6; background: #fbf6ea; border-radius: 12px; }
.hp-luxe-product .lp-freshness .lp-small-head { margin-bottom: 10px; }
.hp-luxe-product .lp-support { margin-top: 24px; }
.hp-luxe-product .lp-reviews { margin-top: 36px; scroll-margin-top: 105px; }
.hp-luxe-product .lp-recent { margin-top: 40px; }
.hp-luxe-product .lp-recent-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 20px; }
.hp-luxe-product .lp-recent-card { display: flex; flex-direction: column; min-width: 0; background: transparent; }
.hp-luxe-product .lp-recent-image { position: relative; overflow: hidden; aspect-ratio: 1.4; border-radius: 13px; background: #f0e7da; }
.hp-luxe-product .lp-recent-image img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform .8s var(--lp-ease); }
.hp-luxe-product .lp-recent-title { font-family: var(--lp-serif); font-size: 26px; line-height: 1.08; font-weight: 600; margin-top: 12px; overflow-wrap: anywhere; }
.hp-luxe-product .lp-recent-category { margin-top: 11px; color: #8a663c; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.hp-luxe-product .lp-recent-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; border-top: 1px solid var(--lp-line); padding-top: 11px; margin-top: 12px; font-size: 16px; font-weight: 700; }
.hp-luxe-product .lp-recent-footer > span:last-child { border: 1px solid #d4c2a7; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; transition: background .3s, transform .3s; }
.hp-luxe-product .lp-mobile-bar { display: none; }
.hp-luxe-product .lp-empty-state { text-align: center; padding: 100px 20px; }
.hp-luxe-product .lp-empty-state .lp-heading { margin: 20px 0 15px; }
.hp-luxe-product .lp-empty-state .lp-button { margin-top: 24px; }
.hp-luxe-product .lp-skeleton { border-radius: 9px; background: #e8dfd1; animation: lpPulse 1.7s ease-in-out infinite; }
.hp-luxe-product .lp-skeleton-image { height: clamp(320px,34vw,540px); border-radius: 20px; }
.hp-luxe-product .lp-skeleton-line { height: 16px; margin-bottom: 17px; }
.hp-luxe-product .lp-spinner { animation: lpSpin .8s linear infinite; }

/* Native dialog stays above transformed/overflow-hidden page containers. */
.lp-lightbox { width: min(1100px,calc(100vw - 32px)); max-width: none; max-height: calc(100dvh - 32px); padding: 0; border: 1px solid #d6c5aa; border-radius: 16px; background: #fcf8ef; color: #30251b; box-shadow: 0 30px 100px #0005; font-family: 'Manrope',Arial,sans-serif; }
.lp-lightbox::backdrop { background: #27221ecf; }
.lp-lightbox[open] { animation: lpContentIn .25s ease-out; }
.lp-lightbox .lp-modal-inner { display: flex; flex-direction: column; padding: 16px; }
.lp-lightbox .lp-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding-bottom: 12px; }
.lp-lightbox .lp-modal-title { margin: 0; font-size: 14px; font-weight: 700; }
.lp-lightbox .lp-modal-image { display: block; max-width: 100%; width: 100%; height: min(68dvh,720px); object-fit: contain; }
.lp-lightbox .lp-modal-controls { display: flex; align-items: center; justify-content: center; gap: 20px; padding-top: 12px; font-size: 12px; }
.lp-lightbox .lp-placeholder { display: grid; place-items: center; height: 300px; }

@keyframes lpImageIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes lpContentIn { from { opacity: .65; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes lpLineIn { from { transform: scaleX(.2); } to { transform: scaleX(1); } }
@keyframes lpPulse { 50% { opacity: .55; } }
@keyframes lpSpin { to { transform: rotate(360deg); } }
@media (hover:hover) and (pointer:fine) {
  .hp-luxe-product .lp-gallery-open:hover .lp-stage-imagewrap { transform: scale(1.025); }
  .hp-luxe-product .lp-round:hover { background: #f7eddb; border-color: #b58a4e; }
  .hp-luxe-product .lp-thumbnail:hover { transform: translateY(-2px); border-color: #b18b56; }
  .hp-luxe-product .lp-button:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 10px 24px -16px #7e4a2166; }
  .hp-luxe-product .lp-button-primary:not(:disabled):hover::after { transform: translateX(120%); }
  .hp-luxe-product .lp-recent-card:hover img, .hp-luxe-product .lp-content-item:hover img { transform: scale(1.045); }
  .hp-luxe-product .lp-recent-card:hover .lp-recent-footer > span:last-child { background: #ecd8b5; transform: translateX(2px); }
}
@media (min-width:1600px) {
  .hp-luxe-product .lp-hero { grid-template-columns: minmax(0,1.05fr) minmax(0,.95fr); }
  .hp-luxe-product .lp-purchase { padding: 24px 30px; }
}
@media (max-width:1100px) {
  .hp-luxe-product .lp-hero { grid-template-columns: minmax(0,1fr) minmax(350px,1fr); gap: 22px; }
  .hp-luxe-product .lp-purchase { padding: 20px; }
  .hp-luxe-product .lp-title { font-size: 36px; }
  .hp-luxe-product .lp-stage { height: clamp(350px,42vw,480px); }
  .hp-luxe-product .lp-inside-preview { grid-template-columns: 1fr; }
}
@media (max-width:900px) {
  .hp-luxe-product .lp-shell { padding-top: 95px; }
  .hp-luxe-product .lp-hero { grid-template-columns: 1fr; gap: 23px; }
  .hp-luxe-product .lp-stage { height: clamp(300px,54vw,460px); }
  .hp-luxe-product .lp-purchase { padding: 24px; }
  .hp-luxe-product .lp-title { font-size: 40px; }
  .hp-luxe-product .lp-recent-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
}
@media (max-width:767px) {
  .hp-luxe-product { padding-bottom: calc(82px + env(safe-area-inset-bottom)); }
  .hp-luxe-product .lp-shell { padding: 90px 14px 34px; }
  .hp-luxe-product .lp-breadcrumb { margin-bottom: 16px; font-size: 11px; gap: 7px; }
  .hp-luxe-product .lp-gallery-head .lp-eyebrow { font-size: 10px; letter-spacing: .11em; }
  .hp-luxe-product .lp-gallery-head .lp-eyebrow::before { width: 16px; }
  .hp-luxe-product .lp-stage { height: auto; aspect-ratio: 1.18; border-radius: 15px; }
  .hp-luxe-product .lp-stage::after { inset: 7px; border-radius: 9px; }
  .hp-luxe-product .lp-gallery-prev { left: 11px; }
  .hp-luxe-product .lp-gallery-next { right: 11px; }
  .hp-luxe-product .lp-image-counter { top: 14px; left: 14px; }
  .hp-luxe-product .lp-zoom { right: 12px; bottom: 12px; }
  .hp-luxe-product .lp-facts { grid-template-columns: repeat(2,minmax(0,1fr)); padding-top: 14px; margin-top: 14px; }
  .hp-luxe-product .lp-purchase { border-radius: 16px; padding: 19px 17px; }
  .hp-luxe-product .lp-title { font-size: clamp(32px,8vw,40px); }
  .hp-luxe-product .lp-description { font-size: 14px; }
  .hp-luxe-product .lp-price { font-size: 31px; }
  .hp-luxe-product .lp-quantity-row { flex-wrap: wrap; }
  .hp-luxe-product .lp-input { font-size: 16px; }
  .hp-luxe-product .lp-description-grid, .hp-luxe-product .lp-info-grid, .hp-luxe-product .lp-delivery-grid, .hp-luxe-product .lp-content-grid { grid-template-columns: 1fr; gap: 24px; }
  .hp-luxe-product .lp-section-head { align-items: start; }
  .hp-luxe-product .lp-section-head > .lp-helper { display: none; }
  .hp-luxe-product .lp-details { margin-top: 28px; padding-top: 21px; }
  .hp-luxe-product .lp-tab { flex: 0 0 auto; font-size: 12px; min-height: 46px; padding-inline: 13px; }
  .hp-luxe-product .lp-tab-panel { padding: 19px 15px; }
  .hp-luxe-product .lp-inside-preview { grid-template-columns: 1fr; }
  .hp-luxe-product .lp-heading { font-size: 34px; }
  .hp-luxe-product .lp-recent-grid { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 14px; padding-bottom: 8px; scrollbar-width: thin; }
  .hp-luxe-product .lp-recent-card { flex: 0 0 76%; scroll-snap-align: start; }
  .hp-luxe-product .lp-mobile-bar { display: grid; grid-template-columns: minmax(80px,.75fr) 1fr 1fr; align-items: center; gap: 8px; position: fixed; bottom: 0; left: 0; right: 0; z-index: 45; background: #fffdf8f7; border-top: 1px solid #dbc7a8; padding: 11px 13px calc(11px + env(safe-area-inset-bottom)); box-shadow: 0 -6px 24px #5637180d; }
  .hp-luxe-product .lp-mobile-price { min-width: 0; }
  .hp-luxe-product .lp-mobile-price small { font-size: 10px; display: block; color: #7d6d5b; }
  .hp-luxe-product .lp-mobile-price strong { font-size: 16px; letter-spacing: -.035em; overflow-wrap: anywhere; }
  .hp-luxe-product .lp-mobile-bar .lp-button { padding: 9px 7px; min-height: 47px; font-size: 12px; }
  .lp-lightbox { width: calc(100vw - 18px); max-height: calc(100dvh - 22px); }
  .lp-lightbox .lp-modal-title { font-size: 12px; }
  .lp-lightbox .lp-modal-image { height: 60dvh; }
}
@media (max-width:360px) {
  .hp-luxe-product .lp-action-grid { gap: 7px; }
  .hp-luxe-product .lp-action-grid .lp-button { padding-inline: 9px; font-size: 12px; gap: 6px; }
  .hp-luxe-product .lp-form-row { grid-template-columns: minmax(0,1fr) 72px; }
  .hp-luxe-product .lp-info-row { grid-template-columns: 100px minmax(0,1fr); gap: 12px; }
}
@media (prefers-reduced-motion:reduce) {
  .hp-luxe-product *, .hp-luxe-product *::before, .hp-luxe-product *::after, .lp-lightbox, .lp-lightbox * {
    animation: none !important; transition: none !important; scroll-behavior: auto !important;
  }
}
`;
const ProductPageStyles = () => <style>{PRODUCT_PAGE_CSS}</style>;
/* =========================================================
   ICON BASE
========================================================= */
const IconBase = ({ children, className = "h-[18px] w-[18px]", }) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={`lp-icon ${className}`}>
    {children}
  </svg>);
/* =========================================================
   ICONS
========================================================= */
const GiftIcon = () => (<IconBase>
    <path d="M4 9h16v11H4V9ZM12 9v11M4 13h16"/>

    <path d="M12 9C9 9 7 8 7 6.2 7 5 7.9 4 9.1 4c1.8 0 2.8 2.4 2.9 5ZM12 9c3 0 5-1 5-2.8C17 5 16.1 4 14.9 4c-1.8 0-2.8 2.4-2.9 5Z"/>
  </IconBase>);
const DeliveryIcon = () => (<IconBase>
    <path d="M3 6h11v10H3z"/>

    <path d="M14 9h4l3 3v4h-7z"/>

    <circle cx="7" cy="18" r="2"/>

    <circle cx="18" cy="18" r="2"/>
  </IconBase>);
const SizeIcon = () => (<IconBase>
    <path d="M5 19V5M5 5l3 3M5 5l-3 3"/>

    <path d="M5 19h14M19 19l-3-3M19 19l-3 3"/>
  </IconBase>);
const CartIcon = () => (<IconBase>
    <circle cx="9" cy="20" r="1"/>

    <circle cx="18" cy="20" r="1"/>

    <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H6"/>
  </IconBase>);
const BoltIcon = () => (<IconBase>
    <path d="M13 2 5 13h6l-1 9 9-13h-6V2Z"/>
  </IconBase>);
const ZoomIcon = () => (<IconBase>
    <circle cx="11" cy="11" r="6"/>

    <path d="m16 16 4 4M8 11h6M11 8v6"/>
  </IconBase>);
const ShareIcon = () => (<IconBase>
    <circle cx="18" cy="5" r="2.5"/>

    <circle cx="6" cy="12" r="2.5"/>

    <circle cx="18" cy="19" r="2.5"/>

    <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>
  </IconBase>);
const LocationIcon = () => (<IconBase>
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/>

    <circle cx="12" cy="10" r="2.5"/>
  </IconBase>);
const PinIcon = () => (<IconBase className="h-[17px] w-[17px]">
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/>

    <circle cx="12" cy="10" r="2"/>
  </IconBase>);
const LocateIcon = () => (<IconBase className="h-[16px] w-[16px]">
    <circle cx="12" cy="12" r="4"/>

    <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
  </IconBase>);
const PromoIcon = () => (<IconBase>
    <path d="M4 7h16v10H4V7Z"/>

    <path d="M9 7a3 3 0 0 1 6 0"/>

    <path d="M8 12h8"/>

    <path d="M12 9v6"/>
  </IconBase>);
const TicketIcon = () => (<IconBase className="h-[17px] w-[17px]">
    <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z"/>

    <path d="M12 8v8"/>
  </IconBase>);
const CalendarIcon = () => (<IconBase>
    <rect x="4" y="5" width="16" height="15" rx="1"/>

    <path d="M8 3v4M16 3v4M4 10h16"/>
  </IconBase>);
const FreshnessIcon = () => (<IconBase>
    <path d="M12 21c5-3 7-7 7-12-5 0-8 2-10 6"/>

    <path d="M12 21C7 18 5 14 5 9c4 0 7 1.5 9 5"/>

    <path d="M12 21v-7"/>
  </IconBase>);
const ClockIcon = () => (<IconBase>
    <circle cx="12" cy="12" r="8"/>

    <path d="M12 7v5l3 2"/>
  </IconBase>);
const BoxReadyIcon = () => (<IconBase>
    <path d="m12 3 8 4-8 4-8-4 8-4Z"/>

    <path d="M4 7v10l8 4 8-4V7"/>

    <path d="M12 11v10"/>

    <path d="m16 12 1.5 1.5L21 10"/>
  </IconBase>);
const ChevronIcon = () => (<IconBase className="h-4 w-4">
    <path d="m6 9 6 6 6-6"/>
  </IconBase>);
const CloseIcon = () => (<IconBase>
    <path d="m6 6 12 12M18 6 6 18"/>
  </IconBase>);
const InfoIcon = () => (<IconBase>
    <circle cx="12" cy="12" r="9"/>

    <path d="M12 11v5M12 8h.01"/>
  </IconBase>);
const SuccessIcon = () => (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
    <path d="m5 10 3 3 7-7"/>
  </svg>);
const SpinnerIcon = () => (<svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-25"/>

    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-90"/>
  </svg>);
const ArrowIcon = () => (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lp-icon" aria-hidden="true" focusable="false">
    <path d="M5 10h10M12 7l3 3-3 3"/>
  </svg>);
export default ProductDetails;
