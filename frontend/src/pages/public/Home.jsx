import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link, useNavigate } from "react-router-dom";

import api from "../../api/api.js";
import Loader from "../../components/Loader.jsx";
import {
  PromotionAnnouncement,
  PromotionHomeBanner,
  PromotionProductBadge,
  findPromotionForProduct,
  useWebsitePromotions,
} from "../../components/WebsitePromotions.jsx";

import heroVideo from "../../assets/hmp.mp4";
import hamperOneLuxury from "../../assets/images/hamper_one_luxury.webp";
import storyImg1 from "../../assets/images/img1.png";
import storyImg2 from "../../assets/images/img2.png";
import storyImg3 from "../../assets/images/img3.png";

import journeySignature1 from "../../assets/images/journey_signature_1.webp";
import journeySignature2 from "../../assets/images/journey_signature_2.webp";
import journeyBuild1 from "../../assets/images/journey_build_1.webp";
import journeyBuild2 from "../../assets/images/journey_build_2.webp";
import journeyBulk1 from "../../assets/images/journey_bulk_1.webp";
import journeyBulk2 from "../../assets/images/journey_bulk_2.webp";
import giftConciergeBg from "../../assets/images/gift_concierge_bg.webp";

import bestsellerFestiveLuxury from "../../assets/images/bestseller_festive_luxury.webp";
import bestsellerExecutiveLuxury from "../../assets/images/bestseller_executive_luxury.webp";
import bestsellerWeddingLuxury from "../../assets/images/bestseller_wedding_luxury.webp";
import bestsellerGourmetLuxury from "../../assets/images/bestseller_gourmet_luxury.webp";
import bestsellerCelebrationLuxury from "../../assets/images/bestseller_celebration_luxury.webp";

// ======================================================
// FONT
// ======================================================

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

// ======================================================
// IMAGES
// ======================================================

const HOME_IMAGES = {
  hero:
    bestsellerExecutiveLuxury,

  festival:
    bestsellerFestiveLuxury,

  corporate:
    bestsellerExecutiveLuxury,

  wedding:
    bestsellerWeddingLuxury,

  curated:
    journeySignature1,

  why:
    storyImg3,

  bestseller1:
    bestsellerFestiveLuxury,

  bestseller2:
    bestsellerExecutiveLuxury,

  bestseller3:
    bestsellerWeddingLuxury,

  bestseller4:
    bestsellerGourmetLuxury,

  bestseller5:
    bestsellerCelebrationLuxury,

  custom:
    journeyBuild1,

  hamperOne:
    hamperOneLuxury,

  editorialCustom:
    journeyBuild2,

  hamperOneFeature:
    hamperOneLuxury,

  hamperOneSecondary:
    bestsellerCelebrationLuxury,

  editorialHover1:
    journeySignature2,

  editorialHover2:
    journeyBuild2,

  editorialHover3:
    journeyBulk2,

  journeySignature1:
    journeySignature1,

  journeySignature2:
    journeySignature2,

  journeyBuild1:
    journeyBuild1,

  journeyBuild2:
    journeyBuild2,

  journeyBulk1:
    journeyBulk1,

  journeyBulk2:
    journeyBulk2,

  momentBirthday:
    journeySignature1,

  momentAnniversary:
    journeyBuild2,

  finalCta:
    bestsellerCelebrationLuxury,

  storyCurated:
    storyImg1,

  storyPersonal:
    storyImg2,

  storyUnboxing:
    storyImg3,

  universalFallback:
    bestsellerExecutiveLuxury,
};

// ======================================================
// FALLBACK PRODUCT DATA
// ======================================================

const FALLBACK_PRODUCTS = [
  {
    _id: "fallback-home-1",
    name: "Golden Festive Delight",
    price: 2499,
    slug: "",
    image: HOME_IMAGES.bestseller1,
  },

  {
    _id: "fallback-home-2",
    name: "Corporate Executive Box",
    price: 3299,
    slug: "",
    image: HOME_IMAGES.bestseller2,
  },

  {
    _id: "fallback-home-3",
    name: "Royal Wedding Hamper",
    price: 5999,
    slug: "",
    image: HOME_IMAGES.bestseller3,
  },

  {
    _id: "fallback-home-4",
    name: "Luxury Gourmet Box",
    price: 4299,
    slug: "",
    image: HOME_IMAGES.bestseller4,
  },

  {
    _id: "fallback-home-5",
    name: "Celebration Signature Box",
    price: 2199,
    slug: "",
    image: HOME_IMAGES.bestseller5,
  },
];

// ======================================================
// HOMEPAGE INTERACTION OPTIONS
// ======================================================

// ======================================================
// SMART HOME NAVIGATION
// ======================================================

const GIFT_OCCASIONS = [
  {
    id: "birthday",
    label: "Birthday",
    search: "birthday",
    image: HOME_IMAGES.momentBirthday,
    icon: "✦",
    shortCopy:
      "Make their day extra special.",
  },
  {
    id: "anniversary",
    label: "Anniversary",
    search: "anniversary",
    image: HOME_IMAGES.momentAnniversary,
    icon: "♡",
    shortCopy:
      "Celebrate your forever.",
  },
  {
    id: "wedding",
    label: "Wedding",
    search: "wedding",
    image: HOME_IMAGES.wedding,
    icon: "◎",
    shortCopy:
      "For the big day and beyond.",
  },
  {
    id: "festive",
    label: "Festive",
    search: "festive",
    image: HOME_IMAGES.festival,
    icon: "◇",
    shortCopy:
      "Spread joy this season.",
  },
];

const GIFT_BUDGETS = [
  {
    id: "under-1500",
    label: "Under ₹1,500",
    maxPrice: 1500,
  },
  {
    id: "1500-3000",
    label: "₹1,500 – ₹3,000",
    minPrice: 1500,
    maxPrice: 3000,
  },
  {
    id: "3000-5000",
    label: "₹3,000 – ₹5,000",
    minPrice: 3000,
    maxPrice: 5000,
  },
  {
    id: "5000-plus",
    label: "₹5,000+",
    minPrice: 5000,
  },
];

const HOME_SECTION_NAV = [
  { id: "journey", label: "Journey" },
  // { id: "concierge", label: "Concierge" }, // Temporarily hidden
  { id: "bestsellers", label: "Bestsellers" },
  { id: "hamper-one", label: "HAMPER ONE" },
  { id: "brand", label: "Brand Story" },
  { id: "bulk", label: "Bulk Gifting" },
  { id: "finale", label: "Finale" },
];

const resolveProductImage = (
  product,
  fallback
) => {
  const candidates = [
    product?.images?.[0]?.url,
    product?.images?.[0],
    product?.image?.url,
    product?.image,
    product?.thumbnail?.url,
    product?.thumbnail,
    product?.skus?.[0]?.images?.[0]?.url,
    product?.skus?.[0]?.images?.[0],
    fallback,
  ];

  return (
    candidates.find(
      (value) =>
        typeof value === "string" &&
        value.trim()
    ) || fallback
  );
};

// ======================================================
// HOME
// ======================================================

const Home = () => {
  const navigate = useNavigate();
  const [giftOccasion, setGiftOccasion] = useState("birthday");
  const [giftBudget, setGiftBudget] = useState("1500-3000");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueAttempt, setCatalogueAttempt] = useState(0);
  const [introFinished, setIntroFinished] = useState(false);
  const [activeHomeSection, setActiveHomeSection] = useState("journey");
  const [giftRevealActive, setGiftRevealActive] = useState(false);
  const homeRef = useRef(null);
  const giftRevealTimerRef = useRef(null);
  const giftNavigatingRef = useRef(false);
  const reducedMotion = useMediaPreference("(prefers-reduced-motion: reduce)");
  const { promotions: websitePromotions } = useWebsitePromotions();

  const finishCinematicIntro = useCallback(() => setIntroFinished(true), []);
  useHomeEnhancements(homeRef, reducedMotion, setActiveHomeSection);

  // The existing catalogue endpoint and filter contract are retained.
  // A stale response never overwrites a newer request or an unmounted page.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setCatalogueError("");
    api.get("/catalog/products?featured=true&limit=8", {
      signal: controller.signal,
      timeout: 12000,
    }).then((response) => {
      if (active) setProducts(Array.isArray(response.data?.products) ? response.data.products : []);
    }).catch((error) => {
      if (active && error?.code !== "ERR_CANCELED") {
        setCatalogueError("The collection is taking a little longer to load.");
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [catalogueAttempt]);


  useEffect(() => () => window.clearTimeout(giftRevealTimerRef.current), []);

  // Real query parameters, not an invented recommendation endpoint.
  const handleFindGift = () => {
    if (giftNavigatingRef.current) return;
    const occasion = GIFT_OCCASIONS.find((item) => item.id === giftOccasion);
    const budget = GIFT_BUDGETS.find((item) => item.id === giftBudget);
    const params = new URLSearchParams();
    if (occasion?.search) params.set("search", occasion.search);
    if (budget?.minPrice !== undefined) params.set("minPrice", String(budget.minPrice));
    if (budget?.maxPrice !== undefined) params.set("maxPrice", String(budget.maxPrice));
    giftNavigatingRef.current = true;
    setGiftRevealActive(true);
    window.clearTimeout(giftRevealTimerRef.current);
    giftRevealTimerRef.current = window.setTimeout(() => {
      navigate(`/gifts?${params.toString()}`);
      giftNavigatingRef.current = false;
      setGiftRevealActive(false);
    }, reducedMotion ? 0 : 520);
  };

  const activeGiftOccasion = GIFT_OCCASIONS.find((item) => item.id === giftOccasion) || GIFT_OCCASIONS[0];
  const activeBudgetIndex = Math.max(0, GIFT_BUDGETS.findIndex((item) => item.id === giftBudget));
  const activeBudget = GIFT_BUDGETS[activeBudgetIndex];

  const lovedProducts = useMemo(() => {
    const campaignImages = [HOME_IMAGES.bestseller1, HOME_IMAGES.bestseller2,
      HOME_IMAGES.bestseller3, HOME_IMAGES.bestseller4, HOME_IMAGES.bestseller5];
    if (!products.length) {
      // Campaign tiles are navigation, not purchasable inventory or live prices.
      return FALLBACK_PRODUCTS.map((product) => ({ ...product, price: null, editorial: true }));
    }
    return products.slice(0, 8).map((product, index) => {
      const value = product.minPrice ?? product.price ?? product.sellingPrice ?? product.salePrice;
      const price = value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
      return {
        ...product, _id: product._id || product.slug || `product-${index}`,
        name: product.name || "HAMPORIUM Hamper", slug: product.slug || "", price,
        image: campaignImages[index] || resolveProductImage(product, campaignImages[index % campaignImages.length]),
        detailImage: resolveProductImage(product, campaignImages[index % campaignImages.length]),
      };
    });
  }, [products]);

  return (
    <main className="hp-home-v65 w-full overflow-x-clip bg-[#faf7f3] text-[#111111]">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600&family=Manrope:wght@400;500;600;700;800&display=swap');

          .hamporium-home {
            font-family: 'Manrope', Arial, sans-serif;
          }

          /* ==============================================
             UNIVERSAL HOME SECTION HEADING
             Same font, same scale, same weight everywhere.
          =============================================== */

          .hp-section-heading {
            width: 100%;
            max-width: none;
            margin: 0;
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
            font-size:
              clamp(
                64px,
                7vw,
                112px
              );
            font-weight: 700;
            line-height: .86;
            letter-spacing: -.046em;
            text-wrap: balance;
          }

          .hp-section-heading-accent {
            display: block;
            margin-top: .045em;
            font: inherit;
            font-style: italic;
            line-height: .88;
            letter-spacing: -.044em;
          }

          @media (max-width: 1023px) {
            .hp-section-heading {
              font-size:
                clamp(
                  58px,
                  10.5vw,
                  88px
                );
              line-height: .88;
              letter-spacing: -.043em;
            }
          }

          @media (max-width: 639px) {
            .hp-section-heading {
              font-size:
                clamp(
                  50px,
                  14.5vw,
                  68px
                );
              line-height: .9;
              letter-spacing: -.04em;
            }
          }

          /* ==============================================
             V61 · LUXURY GIFT-BOX BESTSELLER CARDS
             Whole card = premium wrapped gift package.
             Product photography sits inside a framed window.
          =============================================== */

          .hp-bestseller-runway {
            position: relative;
          }

          .hp-bestseller-card {
            --gift-paper: #F2E7D7;
            --gift-paper-2: #FFF8EC;
            --gift-ink: #231A12;
            --gift-muted: rgba(35,26,18,.55);
            --gift-accent: #A8771E;
            --gift-edge: rgba(170,120,31,.38);
            --gift-ribbon-1: #F9E5A4;
            --gift-ribbon-2: #D2A03C;
            --gift-ribbon-3: #8F5C12;

            position: relative;
            display: flex;
            min-height: 415px;
            height: 100%;
            overflow: hidden;
            isolation: isolate;
            border-radius: 28px;
            padding: 14px;
            background:
              linear-gradient(
                145deg,
                var(--gift-paper-2) 0%,
                var(--gift-paper) 58%,
                color-mix(in srgb, var(--gift-paper) 88%, #000 12%) 100%
              );
            color: var(--gift-ink);
            border: 1px solid var(--gift-edge);
            box-shadow:
              0 26px 58px rgba(31,22,12,.14),
              0 8px 24px rgba(31,22,12,.08),
              inset 0 1px 0 rgba(255,255,255,.44);
            transition:
              transform .62s cubic-bezier(.22,1,.36,1),
              box-shadow .62s ease,
              border-color .52s ease;
          }

          .hp-bestseller-card::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            opacity: .20;
            background-image:
              radial-gradient(rgba(255,255,255,.56) .5px, transparent .5px),
              radial-gradient(rgba(87,57,17,.12) .45px, transparent .45px);
            background-position: 0 0, 4px 4px;
            background-size: 8px 8px;
            mix-blend-mode: soft-light;
          }

          .hp-bestseller-card::after {
            content: "";
            position: absolute;
            inset: 8px;
            z-index: 1;
            pointer-events: none;
            border-radius: 22px;
            border: 1px solid color-mix(in srgb, var(--gift-edge) 82%, transparent);
            box-shadow:
              inset 0 0 0 1px rgba(255,255,255,.05);
          }

          .hp-bestseller-card:hover {
            transform: translateY(-6px);
            border-color:
              color-mix(in srgb, var(--gift-accent) 64%, transparent);
            box-shadow:
              0 36px 84px rgba(31,22,12,.20),
              0 12px 30px rgba(31,22,12,.10),
              inset 0 1px 0 rgba(255,255,255,.48);
          }

          .hp-gift-variant-0 {
            --gift-paper: #E9DCC6;
            --gift-paper-2: #FFF9EE;
            --gift-ink: #2A2119;
            --gift-muted: rgba(42,33,25,.54);
            --gift-accent: #AA7720;
            --gift-edge: rgba(166,116,27,.38);
          }

          .hp-gift-variant-1 {
            --gift-paper: #173127;
            --gift-paper-2: #244638;
            --gift-ink: #FFF7E5;
            --gift-muted: rgba(255,247,229,.52);
            --gift-accent: #E3BE66;
            --gift-edge: rgba(227,190,102,.42);
            --gift-ribbon-1: #FFE7A2;
            --gift-ribbon-2: #D3A241;
            --gift-ribbon-3: #85560F;
          }

          .hp-gift-variant-2 {
            --gift-paper: #D7A99A;
            --gift-paper-2: #F0C7B8;
            --gift-ink: #2E1915;
            --gift-muted: rgba(46,25,21,.52);
            --gift-accent: #9B5E2D;
            --gift-edge: rgba(126,73,38,.30);
            --gift-ribbon-1: #F7D8C9;
            --gift-ribbon-2: #D58F78;
            --gift-ribbon-3: #8E4E3B;
          }

          .hp-gift-variant-3 {
            --gift-paper: #EFE4CF;
            --gift-paper-2: #FFF9ED;
            --gift-ink: #251D15;
            --gift-muted: rgba(37,29,21,.52);
            --gift-accent: #B4822B;
            --gift-edge: rgba(174,127,42,.34);
          }

          .hp-gift-variant-4 {
            --gift-paper: #17263E;
            --gift-paper-2: #243B5B;
            --gift-ink: #FFF7E7;
            --gift-muted: rgba(255,247,231,.50);
            --gift-accent: #E2BC63;
            --gift-edge: rgba(226,188,99,.40);
          }

          .hp-gift-package {
            position: relative;
            z-index: 2;
            display: grid;
            grid-template-rows: minmax(0, 1fr) auto;
            gap: 0;
            width: 100%;
            min-height: inherit;
            border-radius: 20px;
            overflow: hidden;
          }

          .hp-gift-product-window {
            position: relative;
            z-index: 3;
            min-height: 260px;
            overflow: hidden;
            border-radius: 16px;
            border: 1px solid color-mix(in srgb, var(--gift-edge) 78%, transparent);
            background: rgba(0,0,0,.08);
            box-shadow:
              0 14px 28px rgba(20,14,8,.10),
              inset 0 1px 0 rgba(255,255,255,.10);
          }

          .hp-gift-product-window img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            transform: translateZ(0) scale(1.015);
            transition:
              transform 1.12s cubic-bezier(.22,1,.36,1),
              filter .68s ease;
            will-change: transform;
          }

          .hp-bestseller-card:hover
          .hp-gift-product-window img {
            transform: translateZ(0) scale(1.055);
            filter: saturate(1.025) contrast(1.015);
          }

          .hp-gift-product-window::after {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(
                to top,
                rgba(0,0,0,.34) 0%,
                rgba(0,0,0,.08) 28%,
                transparent 58%
              );
          }

          .hp-gift-wrap-layer {
            position: absolute;
            inset: 0;
            z-index: 1;
            pointer-events: none;
          }

          .hp-wrap-ribbon {
            position: absolute;
            display: block;
            border: 1px solid rgba(255,238,174,.22);
            background:
              linear-gradient(
                90deg,
                var(--gift-ribbon-3) 0%,
                var(--gift-ribbon-2) 24%,
                var(--gift-ribbon-1) 50%,
                var(--gift-ribbon-2) 76%,
                var(--gift-ribbon-3) 100%
              );
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.24),
              0 6px 18px rgba(42,25,5,.16);
          }

          .hp-wrap-ribbon-v {
            top: 0;
            bottom: 0;
            width: 18px;
            left: 20%;
          }

          .hp-wrap-ribbon-h {
            left: 0;
            right: 0;
            top: 14%;
            height: 14px;
            background:
              linear-gradient(
                180deg,
                var(--gift-ribbon-3) 0%,
                var(--gift-ribbon-2) 24%,
                var(--gift-ribbon-1) 50%,
                var(--gift-ribbon-2) 76%,
                var(--gift-ribbon-3) 100%
              );
          }

          .hp-wrap-ribbon-diagonal {
            display: none;
            top: 28px;
            right: -48px;
            width: 180px;
            height: 17px;
            transform: rotate(42deg);
          }

          .hp-wrap-bow {
            position: absolute;
            left: calc(20% - 32px);
            top: calc(14% - 28px);
            width: 74px;
            height: 62px;
            filter:
              drop-shadow(0 9px 12px rgba(41,24,4,.20));
            transition:
              transform .72s cubic-bezier(.22,1,.36,1),
              filter .55s ease;
          }

          .hp-wrap-bow-loop,
          .hp-wrap-bow-knot,
          .hp-wrap-bow-tail {
            position: absolute;
            display: block;
            border: 1px solid rgba(255,239,180,.30);
            background:
              linear-gradient(
                135deg,
                var(--gift-ribbon-1) 0%,
                var(--gift-ribbon-2) 52%,
                var(--gift-ribbon-3) 100%
              );
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.24),
              0 5px 12px rgba(35,20,3,.15);
          }

          .hp-wrap-bow-loop {
            top: 7px;
            width: 35px;
            height: 24px;
          }

          .hp-wrap-bow-loop-left {
            left: 1px;
            border-radius: 75% 34% 68% 38%;
            transform: rotate(-30deg);
          }

          .hp-wrap-bow-loop-right {
            right: 1px;
            border-radius: 34% 75% 38% 68%;
            transform: rotate(30deg);
          }

          .hp-wrap-bow-knot {
            z-index: 3;
            top: 11px;
            left: 50%;
            width: 22px;
            height: 21px;
            transform: translateX(-50%);
            border-radius: 50%;
          }

          .hp-wrap-bow-tail {
            top: 28px;
            width: 17px;
            height: 31px;
            clip-path:
              polygon(
                0 0,
                100% 0,
                88% 100%,
                50% 80%,
                12% 100%
              );
          }

          .hp-wrap-bow-tail-left {
            left: 19px;
            transform: rotate(7deg);
          }

          .hp-wrap-bow-tail-right {
            right: 19px;
            transform: rotate(-7deg);
          }

          .hp-wrap-seal {
            display: none;
            position: absolute;
            z-index: 4;
            top: 29px;
            right: 26px;
            width: 42px;
            height: 42px;
            border-radius: 999px;
            align-items: center;
            justify-content: center;
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
            font-size: 18px;
            font-weight: 700;
            color: #FFF0BC;
            background:
              radial-gradient(
                circle at 34% 28%,
                #F0D985 0%,
                #C3902D 45%,
                #81500B 100%
              );
            border: 1px solid rgba(255,235,163,.50);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.24),
              0 9px 18px rgba(0,0,0,.18);
          }

          /* Different wrapping styles like a curated gift collection. */
          .hp-gift-variant-0 .hp-wrap-ribbon-v {
            left: 17%;
          }

          .hp-gift-variant-0 .hp-wrap-ribbon-h {
            top: 12%;
          }

          .hp-gift-variant-0 .hp-wrap-bow {
            left: calc(17% - 32px);
            top: calc(12% - 30px);
          }

          .hp-gift-variant-1 .hp-wrap-ribbon-v,
          .hp-gift-variant-1 .hp-wrap-ribbon-h,
          .hp-gift-variant-1 .hp-wrap-bow {
            display: none;
          }

          .hp-gift-variant-1 .hp-wrap-ribbon-diagonal,
          .hp-gift-variant-1 .hp-wrap-seal {
            display: flex;
          }

          .hp-gift-variant-2 .hp-wrap-ribbon-v {
            left: 19%;
          }

          .hp-gift-variant-2 .hp-wrap-ribbon-h {
            top: 13%;
          }

          .hp-gift-variant-2 .hp-wrap-bow {
            left: calc(19% - 32px);
            top: calc(13% - 29px);
          }

          .hp-gift-variant-3 .hp-wrap-ribbon-v,
          .hp-gift-variant-3 .hp-wrap-ribbon-h,
          .hp-gift-variant-3 .hp-wrap-bow {
            display: none;
          }

          .hp-gift-variant-3 .hp-wrap-ribbon-diagonal {
            display: block;
            left: -50px;
            right: auto;
            top: 31px;
            transform: rotate(-42deg);
          }

          .hp-gift-variant-3 .hp-wrap-seal {
            display: flex;
            top: 31px;
            right: 24px;
          }

          .hp-gift-variant-4 .hp-wrap-ribbon-v {
            left: auto;
            right: 17%;
          }

          .hp-gift-variant-4 .hp-wrap-ribbon-h {
            top: 12%;
          }

          .hp-gift-variant-4 .hp-wrap-bow {
            left: auto;
            right: calc(17% - 34px);
            top: calc(12% - 30px);
          }

          .hp-bestseller-card:hover .hp-wrap-bow {
            transform:
              translate3d(0,-2px,0)
              scale(1.045)
              rotate(-1deg);
            filter:
              drop-shadow(0 12px 15px rgba(41,24,4,.24));
          }

          .hp-bestseller-copy {
            position: relative;
            z-index: 4;
            display: flex;
            min-height: 132px;
            flex-direction: column;
            justify-content: flex-end;
            padding: 16px 12px 8px;
            color: var(--gift-ink);
            transition:
              transform .66s cubic-bezier(.22,1,.36,1);
          }

          .hp-bestseller-card:hover
          .hp-bestseller-copy {
            transform: translateY(-3px);
          }

          .hp-bestseller-line {
            display: block;
            width: 48px;
            height: 1px;
            margin-bottom: 11px;
            background: var(--gift-accent);
            opacity: .92;
          }

          .hp-bestseller-title {
            max-width: 100%;
            margin: 0;
            color: var(--gift-ink);
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
            font-size: clamp(24px, 1.75vw, 31px);
            font-weight: 700;
            line-height: .94;
            letter-spacing: -.03em;
          }

          .hp-bestseller-meta {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 14px;
            margin-top: 12px;
          }

          .hp-bestseller-price-label {
            margin: 0;
            color: var(--gift-muted);
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .13em;
            text-transform: uppercase;
          }

          .hp-bestseller-price {
            margin: 5px 0 0;
            color: var(--gift-accent);
            font-size: 19px;
            font-weight: 900;
          }

          .hp-bestseller-arrow {
            display: flex;
            width: 42px;
            height: 42px;
            flex-shrink: 0;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            border: 1px solid color-mix(in srgb, var(--gift-accent) 62%, transparent);
            background:
              color-mix(in srgb, var(--gift-paper-2) 86%, transparent);
            color: var(--gift-ink);
            font-size: 21px;
            box-shadow:
              0 9px 18px rgba(19,13,8,.08);
            transition:
              transform .58s cubic-bezier(.22,1,.36,1),
              background-color .42s ease,
              color .42s ease,
              border-color .42s ease;
          }

          .hp-bestseller-card:hover
          .hp-bestseller-arrow {
            transform: translateX(4px);
            border-color: #F47822;
            background: #F47822;
            color: #fff;
          }

          @media (max-width: 1023px) {
            .hp-bestseller-runway {
              --hp-card-width: 76vw;
              --hp-side-space:
                calc((100vw - var(--hp-card-width)) / 2);

              display: flex !important;
              width: 100vw;
              max-width: 100vw !important;
              margin-left: 50%;
              transform: translateX(-50%);
              overflow-x: auto;
              overflow-y: hidden;
              gap: 14px !important;
              padding:
                14px var(--hp-side-space)
                26px !important;
              scroll-padding-inline:
                var(--hp-side-space);
              scroll-snap-type: x mandatory;
              scroll-behavior: smooth;
              overscroll-behavior-inline: contain;
              -webkit-overflow-scrolling: touch;
              scrollbar-width: none;
              mask-image: none !important;
              -webkit-mask-image: none !important;
            }

            .hp-bestseller-runway::-webkit-scrollbar {
              display: none;
            }

            .hp-bestseller-runway > * {
              flex:
                0 0 var(--hp-card-width) !important;
              width:
                var(--hp-card-width) !important;
              max-width:
                var(--hp-card-width) !important;
              min-width: 0;
              scroll-snap-align: center;
              scroll-snap-stop: always;
              scale: .92 !important;
              opacity: .74 !important;
              transform-origin: center center;
              transition:
                scale .62s cubic-bezier(.22,1,.36,1),
                opacity .48s ease !important;
              will-change: scale, opacity;
            }

            .hp-bestseller-runway > .is-mobile-active {
              scale: 1 !important;
              opacity: 1 !important;
            }

            .hp-bestseller-card {
              min-height: 375px;
              border-radius: 26px;
            }

            .hp-gift-product-window {
              min-height: 230px;
            }

            .hp-bestseller-copy {
              min-height: 132px;
              padding: 15px 10px 8px;
            }

            .hp-bestseller-title {
              font-size: 27px;
            }

            .hp-bestseller-card:hover {
              transform: none;
            }

            .hp-bestseller-card:hover
            .hp-wrap-bow {
              transform: none;
            }

            .hp-bestseller-card:hover
            .hp-gift-product-window img {
              transform: translateZ(0) scale(1.015);
              filter: none;
            }
          }

          @media (max-width: 639px) {
            .hp-bestseller-runway {
              --hp-card-width: 80vw;
              gap: 12px !important;
            }

            .hp-bestseller-card {
              min-height: 350px;
              padding: 11px;
              border-radius: 24px;
            }

            .hp-bestseller-card::after {
              inset: 6px;
              border-radius: 20px;
            }

            .hp-gift-package {
              border-radius: 18px;
            }

            .hp-gift-product-window {
              min-height: 210px;
              border-radius: 14px;
            }

            .hp-bestseller-copy {
              min-height: 128px;
              padding: 14px 9px 7px;
            }

            .hp-bestseller-title {
              font-size: 28px;
            }

            .hp-bestseller-arrow {
              width: 43px;
              height: 43px;
              font-size: 20px;
            }

            .hp-wrap-ribbon-v {
              width: 15px;
            }

            .hp-wrap-ribbon-h {
              height: 12px;
            }

            .hp-wrap-bow {
              scale: .88;
            }
          }

          @keyframes hpHeroReveal {
            0% {
              transform: scale(1.015);
              opacity: .35;
            }

            100% {
              transform: scale(1);
              opacity: 1;
            }
          }





          .hp-hero-video-ready {
            animation:
              hpHeroReveal 1.45s
              cubic-bezier(.22,1,.36,1)
              both;
          }

          @keyframes hpAmbientFloat {
            0%, 100% {
              transform: translate3d(0, 0, 0) scale(1);
            }

            50% {
              transform: translate3d(0, -14px, 0) scale(1.025);
            }
          }

          @keyframes hpSoftSpin {
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes hpBadgePulse {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(244,120,34,.16);
            }

            50% {
              box-shadow: 0 0 0 14px rgba(244,120,34,0);
            }
          }

          .hp-reveal, .hp-reveal.is-visible {
            opacity: 1;
            transform: none;
          }

          .hp-premium-card {
            transform: translateZ(0);
            transition:
              transform .55s cubic-bezier(.22,1,.36,1);
          }

          .hp-premium-card:hover {
            transform: translateY(-6px);
          }

          .hp-shine {
            position: relative;
            isolation: isolate;
          }

          .hp-shine::after {
            content: '';
            position: absolute;
            inset: -35% auto -35% -52%;
            z-index: 4;
            width: 34%;
            pointer-events: none;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,.34),
              transparent
            );
            transform: skewX(-18deg);
            transition: left .9s cubic-bezier(.22,1,.36,1);
          }

          .hp-shine:hover::after {
            left: 122%;
          }

          .hp-ambient-float {
            animation: hpAmbientFloat 6s ease-in-out infinite;
          }

          .hp-soft-spin {
            animation: hpSoftSpin 18s linear infinite;
          }

          .hp-badge-pulse {
            animation: hpBadgePulse 2.4s ease-out infinite;
          }

          .hp-image-zoom img {
            transition:
              transform 1.1s cubic-bezier(.22,1,.36,1),
              filter .7s ease;
          }

          .hp-image-zoom:hover img {
            transform: scale(1.075);
            filter: saturate(1.08) contrast(1.03);
          }

          .hp-noise {
            background-image:
              radial-gradient(rgba(255,255,255,.16) .55px, transparent .55px);
            background-size: 5px 5px;
          }

          .hp-editorial-panel {
            position: relative;
            overflow: hidden;
            isolation: isolate;
          }

          .hp-editorial-panel img {
            transform: translateZ(0) scale(1.015);
            backface-visibility: hidden;
            will-change: transform, opacity;
          }

          .hp-editorial-base,
          .hp-editorial-hover {
            backface-visibility: hidden;
            transform: translateZ(0) scale(1.015);
            will-change: opacity, transform;
            transition:
              opacity .34s cubic-bezier(.16,1,.3,1),
              transform .58s cubic-bezier(.16,1,.3,1);
          }

          .hp-editorial-base {
            opacity: 1;
          }

          .hp-editorial-hover {
            opacity: 0;
            transform: translateZ(0) scale(1.055);
          }

          .hp-editorial-panel:hover .hp-editorial-base {
            opacity: 0;
            transform: translateZ(0) scale(1.045);
          }

          .hp-editorial-panel:hover .hp-editorial-hover {
            opacity: 1;
            transform: translateZ(0) scale(1.015);
          }

          @media (min-width: 1024px) {
            .hp-editorial-flex {
              display: grid !important;
              grid-template-columns:
                minmax(0, 1fr)
                minmax(0, 1fr)
                minmax(0, 1fr);
              grid-template-rows: minmax(0, 1fr) !important;
              align-items: stretch;
              overflow: hidden;
              isolation: isolate;
              transition:
                grid-template-columns .48s
                cubic-bezier(.16,1,.3,1);
            }

            /*
              Real width expansion without scaling/distorting text.
              :has() is supported by current Chrome/Edge/Safari/Firefox.
              Browsers without it simply keep the stable 3-column layout.
            */
            .hp-editorial-flex:has(
              > .hp-editorial-panel:nth-child(1):hover
            ) {
              grid-template-columns:
                minmax(0, 1.34fr)
                minmax(0, .83fr)
                minmax(0, .83fr);
            }

            .hp-editorial-flex:has(
              > .hp-editorial-panel:nth-child(2):hover
            ) {
              grid-template-columns:
                minmax(0, .83fr)
                minmax(0, 1.34fr)
                minmax(0, .83fr);
            }

            .hp-editorial-flex:has(
              > .hp-editorial-panel:nth-child(3):hover
            ) {
              grid-template-columns:
                minmax(0, .83fr)
                minmax(0, .83fr)
                minmax(0, 1.34fr);
            }

            .hp-editorial-flex > .hp-editorial-panel {
              min-width: 0;
              min-height: 100%;
              height: 100%;
              backface-visibility: hidden;
              transition:
                opacity .26s ease;
            }

            .hp-editorial-flex:hover > .hp-editorial-panel {
              opacity: .76;
            }

            .hp-editorial-flex > .hp-editorial-panel:hover {
              z-index: 5;
              opacity: 1;
            }

            .hp-editorial-flex > .hp-editorial-panel::before {
              content: "";
              position: absolute;
              inset: 0;
              z-index: 4;
              pointer-events: none;
              background:
                linear-gradient(
                  90deg,
                  rgba(0,0,0,.07),
                  transparent 20%,
                  transparent 80%,
                  rgba(0,0,0,.07)
                );
              opacity: 0;
              transition: opacity .26s ease;
            }

            .hp-editorial-flex > .hp-editorial-panel:hover::before {
              opacity: 1;
            }
          }


          .hp-editorial-word {
            text-shadow: 0 3px 26px rgba(0,0,0,.22);
          }

          .hp-frameless-item {
            transition:
              transform .55s cubic-bezier(.22,1,.36,1),
              opacity .35s ease;
          }

          .hp-frameless-item:hover {
            transform: translateY(-6px);
          }

          .hp-frameless-line {
            transform-origin: left center;
            transition: transform .55s cubic-bezier(.22,1,.36,1);
          }

          .group:hover .hp-frameless-line {
            transform: scaleX(1.55);
          }

          @keyframes hpQuoteFloat {
            0%, 100% {
              transform: translate3d(0, 0, 0);
              opacity: .10;
            }

            50% {
              transform: translate3d(0, -10px, 0);
              opacity: .18;
            }
          }

          @keyframes hpReviewGlow {
            0%, 100% {
              opacity: .18;
              transform: scale(.92);
            }

            50% {
              opacity: .38;
              transform: scale(1.05);
            }
          }

          .hp-quote-float {
            animation:
              hpQuoteFloat 6.8s
              ease-in-out infinite;
          }

          .hp-review-glow {
            animation:
              hpReviewGlow 6s
              ease-in-out infinite;
          }

          @keyframes hpLuxuryDrift {
            0%, 100% {
              transform: translate3d(0, 0, 0) scale(1);
            }

            50% {
              transform: translate3d(0, -12px, 0) scale(1.025);
            }
          }

          @keyframes hpLuxuryGlow {
            0%, 100% {
              opacity: .25;
              transform: scale(.9);
            }

            50% {
              opacity: .62;
              transform: scale(1.08);
            }
          }

          @keyframes hpLuxuryLine {
            0% {
              transform: scaleX(.2);
              opacity: .4;
            }

            50% {
              transform: scaleX(1);
              opacity: 1;
            }

            100% {
              transform: scaleX(.2);
              opacity: .4;
            }
          }

          @keyframes hpBulkFloat {
            0%, 100% {
              transform: translateY(0);
            }

            50% {
              transform: translateY(-8px);
            }
          }

          .hp-luxury-drift {
            animation:
              hpLuxuryDrift 6.5s
              ease-in-out infinite;
          }

          .hp-luxury-glow {
            animation:
              hpLuxuryGlow 5.2s
              ease-in-out infinite;
          }

          .hp-luxury-line {
            transform-origin: left center;
            animation:
              hpLuxuryLine 3.2s
              ease-in-out infinite;
          }

          .hp-bulk-float {
            animation:
              hpBulkFloat 5.8s
              ease-in-out infinite;
          }

          .hp-editorial-title {
            text-shadow:
              0 4px 22px rgba(0,0,0,.78),
              0 1px 2px rgba(0,0,0,.72);
          }

          .hp-editorial-kicker {
            text-shadow:
              0 2px 12px rgba(0,0,0,.82);
          }

          /* ==============================================
             MOBILE / TABLET 70 / 30 SNAP RAILS
          =============================================== */

          .hp-mobile-rail,
          .hp-editorial-mobile-rail {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .hp-mobile-rail::-webkit-scrollbar,
          .hp-editorial-mobile-rail::-webkit-scrollbar {
            display: none;
          }

          @media (max-width: 1023px) {
            .hp-snap-rail {
              scroll-behavior: smooth;
              scroll-snap-type: x mandatory;
              overscroll-behavior-inline: contain;
              -webkit-overflow-scrolling: touch;
              touch-action: pan-x pan-y;
            }

            .hp-mobile-rail {
              display: flex !important;
              width: 100%;
              max-width: none !important;
              overflow-x: auto;
              overflow-y: hidden;
              gap: 10px;
              padding:
                18px 0
                24px;
            }

            /*
              70% current card + about 30% of the next card visible.
              We use the individual CSS scale property so it does
              not fight with Reveal's transform animation.
            */
            .hp-mobile-rail > * {
              flex:
                0 0
                calc(70% - 5px);
              width:
                calc(70% - 5px);
              min-width: 0;
              scroll-snap-align: start;
              scroll-snap-stop: always;
              scale: .88;
              opacity: .68;
              transform-origin:
                center center;
              transition:
                scale .46s
                  cubic-bezier(.16,1,.3,1),
                opacity .34s ease;
              will-change:
                scale, opacity;
            }

            .hp-mobile-rail >
            .is-mobile-active {
              scale: 1;
              opacity: 1;
            }

            .hp-editorial-mobile-rail {
              display: flex !important;
              width: 100%;
              min-height: 0 !important;
              overflow-x: auto;
              overflow-y: hidden;
              gap: 10px;
              padding:
                12px 0
                20px;
            }

            .hp-editorial-mobile-rail >
            .hp-editorial-panel {
              flex:
                0 0
                calc(70% - 5px);
              width:
                calc(70% - 5px);
              min-height: 72svh;
              height: 72svh;
              scroll-snap-align: start;
              scroll-snap-stop: always;
              scale: .88;
              opacity: .68;
              transform-origin:
                center center;
              transition:
                scale .46s
                  cubic-bezier(.16,1,.3,1),
                opacity .34s ease;
              will-change:
                scale, opacity;
            }

            .hp-editorial-mobile-rail >
            .hp-editorial-panel.is-mobile-active {
              scale: 1;
              opacity: 1;
            }

            /*
              Touch devices keep the default image.
              Image A/B swapping remains desktop-only.
            */
            .hp-editorial-mobile-rail
            .hp-editorial-panel:hover
            .hp-editorial-base {
              opacity: 1;
              transform:
                translateZ(0)
                scale(1.015);
            }

            .hp-editorial-mobile-rail
            .hp-editorial-panel:hover
            .hp-editorial-hover {
              opacity: 0;
              transform:
                translateZ(0)
                scale(1.055);
            }

            /*
              Small right fade = visual hint that another card exists.
              No text hint required.
            */
            .hp-mobile-rail,
            .hp-editorial-mobile-rail {
              mask-image:
                linear-gradient(
                  90deg,
                  #000 0%,
                  #000 95%,
                  transparent 100%
                );
            }
          }

          @media (max-width: 639px) {
            .hp-mobile-rail,
            .hp-editorial-mobile-rail {
              gap: 8px;
            }

            .hp-mobile-rail > *,
            .hp-editorial-mobile-rail >
            .hp-editorial-panel {
              flex-basis:
                calc(70% - 4px);
              width:
                calc(70% - 4px);
            }

            .hp-editorial-mobile-rail >
            .hp-editorial-panel {
              min-height: 68svh;
              height: 68svh;
            }
          }

          @media (min-width: 1024px) {
            .hp-mobile-rail > *,
            .hp-editorial-mobile-rail >
            .hp-editorial-panel {
              scale: 1;
              opacity: 1;
            }
          }


          @media (max-width: 1023px) {
            .hp-mobile-rail .hp-image-zoom:hover img {
              transform: none;
              filter: none;
            }

            .hp-mobile-rail .hp-premium-card:hover,
            .hp-mobile-rail .hp-frameless-item:hover {
              transform: none;
            }
          }


          /* ==============================================
             NEXT-LEVEL HOMEPAGE INTERACTIONS
          =============================================== */

          /* ==============================================
             FULL-SCREEN STORY + JOURNEY IMAGE SWAPS
          =============================================== */

          /* ==============================================
             FULL-SCREEN STICKY STORY STACK
             Scroll happens in the document, but visually the
             screen stays pinned while the next page rises over it.
          =============================================== */

          .hp-story-stack {
            position: relative;
            isolation: isolate;
            overflow: visible !important;
            background: #090807;
          }

          /*
            Smooth sticky hand-off + original diagonal editorial cut.

            IMPORTANT: the sticky page itself stays rectangular and transparent.
            The diagonal clip lives on an inner painted sheet instead. This keeps
            the original diagonal reveal while avoiding the common sticky +
            clip-path compositor flicker that caused the image to glitch.
          */
          .hp-story-page {
            --hp-story-cut: clamp(52px, 5.2vw, 96px);
            position: sticky !important;
            position: -webkit-sticky !important;
            top: 0;
            width: 100%;
            height: 100vh;
            height: 100svh;
            min-height: 100vh;
            min-height: 100svh;
            overflow: visible;
            isolation: isolate;
            background: transparent !important;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            transform: translate3d(0,0,0);
            -webkit-transform: translate3d(0,0,0);
            opacity: 1 !important;
            transition: none !important;
          }

          .hp-story-page:nth-child(1) { z-index: 10; }
          .hp-story-page:nth-child(2) { z-index: 20; }
          .hp-story-page:nth-child(3) { z-index: 30; }

          /*
            The visual sheet is the only clipped layer. Keeping clip-path off the
            sticky element makes Chrome/Edge/Safari much more stable during fast
            scroll and trackpad momentum.
          */
          .hp-story-sheet {
            position: absolute;
            inset: 0;
            overflow: hidden;
            isolation: isolate;
            contain: paint;
            background: #000;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            transform: translate3d(0,0,0);
            -webkit-transform: translate3d(0,0,0);
            clip-path: none;
            -webkit-clip-path: none;
          }

          .hp-story-page:nth-child(n+2) .hp-story-sheet {
            clip-path: polygon(
              0 var(--hp-story-cut),
              100% 0,
              100% 100%,
              0 100%
            );
            -webkit-clip-path: polygon(
              0 var(--hp-story-cut),
              100% 0,
              100% 100%,
              0 100%
            );
          }

          /* Keep the original gold diagonal edge on incoming pages. */
          .hp-story-sheet::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 12;
            pointer-events: none;
            background: linear-gradient(
              90deg,
              rgba(244,120,34,.95),
              rgba(212,175,55,.92),
              rgba(255,231,157,.62)
            );
            clip-path: polygon(
              0 var(--hp-story-cut),
              100% 0,
              100% 3px,
              0 calc(var(--hp-story-cut) + 3px)
            );
            -webkit-clip-path: polygon(
              0 var(--hp-story-cut),
              100% 0,
              100% 3px,
              0 calc(var(--hp-story-cut) + 3px)
            );
            opacity: .92;
          }

          /* Soft depth under the diagonal edge, matching the original look. */
          .hp-story-sheet::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 8;
            pointer-events: none;
            background: linear-gradient(
              177deg,
              rgba(0,0,0,.28) 0%,
              rgba(0,0,0,.12) 5%,
              transparent 12%
            );
            opacity: .72;
          }

          .hp-story-page:nth-child(1) .hp-story-sheet::before,
          .hp-story-page:nth-child(1) .hp-story-sheet::after {
            display: none;
          }

          .hamporium-home {
            overflow: visible;
          }

          .hp-story-image {
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: translate3d(0,0,0) scale(1.001);
            -webkit-transform: translate3d(0,0,0) scale(1.001);
            transform-origin: center center;
            will-change: transform;
            transition: none !important;
            image-rendering: auto;
          }

          .hp-story-page:hover
          .hp-story-image {
            transform: translate3d(0,0,0) scale(1.001);
          }

          .hp-journey-base,
          .hp-journey-hover {
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            transform:
              translateZ(0)
              scale(1.015);
            will-change:
              opacity, transform;
            transition:
              opacity .88s
                cubic-bezier(.22,1,.36,1),
              transform 1.18s
                cubic-bezier(.22,1,.36,1);
          }

          .hp-journey-base {
            opacity: 1;
          }

          .hp-journey-hover {
            opacity: 0;
            transform:
              translateZ(0)
              scale(1.06);
          }

          .hp-journey-grid > a:hover
          .hp-journey-base {
            opacity: 1;
            transform:
              translateZ(0)
              scale(1.035);
          }

          .hp-journey-grid > a:hover
          .hp-journey-hover {
            opacity: 1;
            transform:
              translateZ(0)
              scale(1.015);
          }

          @media (max-width: 1023px) {
            .hp-story-page {
              height: 100svh;
              min-height: 100svh;
            }

            .hp-story-image,
            .hp-story-page:hover .hp-story-image {
              transform: translate3d(0,0,0) scale(1.001);
              -webkit-transform: translate3d(0,0,0) scale(1.001);
            }

            .hp-journey-grid > a:hover
            .hp-journey-base {
              opacity: 1;
              transform:
                translateZ(0)
                scale(1.015);
            }

            .hp-journey-grid > a:hover
            .hp-journey-hover {
              opacity: 0;
              transform:
                translateZ(0)
                scale(1.06);
            }

            .hp-journey-grid >
            .is-mobile-active
            .hp-journey-base {
              opacity: 0;
              transform:
                translateZ(0)
                scale(1.035);
            }

            .hp-journey-grid >
            .is-mobile-active
            .hp-journey-hover {
              opacity: 1;
              transform:
                translateZ(0)
                scale(1.015);
            }
          }


          @keyframes hpJourneyGlow {
            0%, 100% {
              opacity: .16;
              transform: scale(.92);
            }

            50% {
              opacity: .34;
              transform: scale(1.06);
            }
          }

          @keyframes hpFinalDrift {
            0%, 100% {
              transform:
                translate3d(
                  var(--hp-final-x, 0px),
                  var(--hp-final-y, 0px),
                  0
                )
                scale(1.025);
            }

            50% {
              transform:
                translate3d(
                  var(--hp-final-x, 0px),
                  calc(var(--hp-final-y, 0px) - 8px),
                  0
                )
                scale(1.045);
            }
          }

          .hp-journey-glow {
            opacity: .24;
            animation: none;
          }

          .hp-final-drift {
            animation:
              hpFinalDrift 10s
              ease-in-out infinite;
          }

          @media (min-width: 1024px) {
            .hp-journey-grid {
              display: grid;
              grid-template-columns:
                minmax(0, 1fr)
                minmax(0, 1fr)
                minmax(0, 1fr);
              transition:
                grid-template-columns
                1.02s
                cubic-bezier(.22,1,.36,1);
            }

            /*
              Keep the exact same grid-track syntax in every state.
              Browsers can now interpolate the tracks instead of jumping
              between repeat(...) and explicit fr values.
            */
            .hp-journey-grid:has(
              > a:nth-child(1):hover
            ) {
              grid-template-columns:
                minmax(0, 1.28fr)
                minmax(0, .86fr)
                minmax(0, .86fr);
            }

            .hp-journey-grid:has(
              > a:nth-child(2):hover
            ) {
              grid-template-columns:
                minmax(0, .86fr)
                minmax(0, 1.28fr)
                minmax(0, .86fr);
            }

            .hp-journey-grid:has(
              > a:nth-child(3):hover
            ) {
              grid-template-columns:
                minmax(0, .86fr)
                minmax(0, .86fr)
                minmax(0, 1.28fr);
            }
          }

          @media (max-width: 1023px) {
            .hp-journey-grid {
              --hp-journey-card-width: 76vw;
              --hp-journey-side-space:
                calc(
                  (100vw - var(--hp-journey-card-width)) / 2
                );

              display: flex !important;
              width: 100vw;
              max-width: 100vw !important;
              margin-left: 50%;
              transform: translateX(-50%);
              overflow-x: auto;
              overflow-y: hidden;
              gap: 14px;
              padding:
                10px var(--hp-journey-side-space)
                20px;
              scroll-padding-inline:
                var(--hp-journey-side-space);
              scroll-snap-type:
                x mandatory;
              scroll-behavior: smooth;
              overscroll-behavior-inline:
                contain;
              -webkit-overflow-scrolling:
                touch;
              scrollbar-width: none;
              mask-image: none !important;
              -webkit-mask-image: none !important;
            }

            .hp-journey-grid::-webkit-scrollbar {
              display: none;
            }

            .hp-journey-grid > * {
              flex:
                0 0
                var(--hp-journey-card-width);
              width:
                var(--hp-journey-card-width);
              max-width:
                var(--hp-journey-card-width);
              min-width: 0;
              scroll-snap-align: center;
              scroll-snap-stop: always;
              scale: .90;
              opacity: .70;
              transform-origin:
                center center;
              border-radius: 28px;
              transition:
                scale .62s
                  cubic-bezier(.22,1,.36,1),
                opacity .48s ease;
              will-change:
                scale, opacity;
            }

            .hp-journey-grid >
            .is-mobile-active {
              scale: 1;
              opacity: 1;
            }
          }

          @media (max-width: 639px) {
            .hp-journey-grid {
              --hp-journey-card-width: 78vw;
              gap: 12px;
            }

            .hp-journey-grid > * {
              border-radius: 26px;
            }
          }

          /* ==============================================
             GIFT CONCIERGE · CODED CINEMATIC UI
          =============================================== */

          @keyframes hpConciergeAmbient {
            0%, 100% {
              opacity: .28;
              transform: scale(.94);
            }

            50% {
              opacity: .64;
              transform: scale(1.08);
            }
          }

          @keyframes hpConciergeBoxFloat {
            0%, 100% {
              transform:
                translateY(0)
                rotateY(0deg);
            }

            50% {
              transform:
                translateY(-10px)
                rotateY(-1.8deg);
            }
          }

          @keyframes hpConciergeBowFloat {
            0%, 100% {
              transform:
                translateX(-50%)
                rotate(-2deg);
            }

            50% {
              transform:
                translateX(-50%)
                translateY(-5px)
                rotate(2deg);
            }
          }

          @keyframes hpConciergeSelectedPulse {
            0%, 100% {
              box-shadow:
                0 0 0 0
                rgba(244,120,34,.15),
                0 20px 50px
                rgba(0,0,0,.18);
            }

            50% {
              box-shadow:
                0 0 0 9px
                rgba(244,120,34,0),
                0 26px 68px
                rgba(0,0,0,.3);
            }
          }

          @keyframes hpConciergeCtaShine {
            0% {
              transform:
                translateX(-180%)
                skewX(-18deg);
            }

            100% {
              transform:
                translateX(430%)
                skewX(-18deg);
            }
          }

          .hp-concierge-ambient {
            animation:
              hpConciergeAmbient 5.8s
              ease-in-out infinite;
          }

          .hp-concierge-card {
            position: relative;
            isolation: isolate;
            overflow: hidden;
            transition:
              transform .45s
                cubic-bezier(.16,1,.3,1),
              border-color .3s ease,
              box-shadow .3s ease,
              opacity .3s ease;
          }

          .hp-concierge-card:hover {
            transform:
              translateY(-10px)
              scale(1.02);
            border-color:
              rgba(244,120,34,.75);
            box-shadow:
              0 28px 70px
              rgba(0,0,0,.36);
          }

          .hp-concierge-card.is-active {
            border-color:
              rgba(244,120,34,.98);
            outline:
              1px solid
              rgba(255,214,112,.34);
            outline-offset: 3px;
            animation:
              hpConciergeSelectedPulse 2.35s
              ease-out infinite;
          }

          .hp-concierge-card img {
            transition:
              transform .85s
                cubic-bezier(.16,1,.3,1),
              filter .5s ease;
          }

          .hp-concierge-card:hover img,
          .hp-concierge-card.is-active img {
            transform:
              scale(1.075);
            filter:
              saturate(1.06)
              contrast(1.03);
          }

          .hp-concierge-gift-stage {
            perspective: 1100px;
          }

          .hp-concierge-gift-box {
            animation:
              hpConciergeBoxFloat 6s
              ease-in-out infinite;
            transform-style:
              preserve-3d;
          }

          .hp-concierge-bow {
            animation:
              hpConciergeBowFloat 5.4s
              ease-in-out infinite;
          }

          .hp-concierge-range {
            appearance: none;
            -webkit-appearance: none;
            width: 100%;
            height: 4px;
            border-radius: 999px;
            outline: none;
            background:
              linear-gradient(
                to right,
                #E8C45D 0%,
                #F47822
                var(--hp-range-progress),
                rgba(255,255,255,.18)
                var(--hp-range-progress),
                rgba(255,255,255,.18)
                100%
              );
          }

          .hp-concierge-range::-webkit-slider-thumb {
            appearance: none;
            -webkit-appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 999px;
            border:
              3px solid #FFF7E9;
            background: #F47822;
            box-shadow:
              0 0 0 7px
              rgba(244,120,34,.13),
              0 8px 22px
              rgba(244,120,34,.36);
            cursor: pointer;
          }

          .hp-concierge-range::-moz-range-thumb {
            width: 24px;
            height: 24px;
            border-radius: 999px;
            border:
              3px solid #FFF7E9;
            background: #F47822;
            box-shadow:
              0 0 0 7px
              rgba(244,120,34,.13),
              0 8px 22px
              rgba(244,120,34,.36);
            cursor: pointer;
          }

          .hp-concierge-cta {
            position: relative;
            isolation: isolate;
            overflow: hidden;
            transition:
              transform .32s
                cubic-bezier(.16,1,.3,1),
              box-shadow .32s ease,
              background-color .32s ease;
          }

          .hp-concierge-cta::after {
            content: "";
            position: absolute;
            inset:
              -50% auto
              -50% -38%;
            width: 24%;
            pointer-events: none;
            background:
              linear-gradient(
                90deg,
                transparent,
                rgba(255,255,255,.42),
                transparent
              );
            transform:
              skewX(-18deg);
          }

          .hp-concierge-cta:hover {
            transform:
              translateY(-3px);
            box-shadow:
              0 18px 46px
              rgba(244,120,34,.28);
          }

          .hp-concierge-cta:hover::after {
            animation:
              hpConciergeCtaShine .82s
              cubic-bezier(.16,1,.3,1);
          }

          @media (max-width: 1023px) {
            .hp-concierge-card:hover {
              transform: none;
            }
          }

          /* ==============================================
             V51 · CINEMATIC INTERACTION SYSTEM
          =============================================== */

          .hamporium-home {
            --hp-scroll-progress: 0;
            --hp-hero-scale: 1;
            --hp-hero-dim: 0;
            --hp-hero-line-scale: 0;
            --hp-journey-shift: 0px;
          }

          .hp-scroll-progress {
            position: fixed;
            inset: 0 0 auto 0;
            z-index: 140;
            height: 2px;
            pointer-events: none;
            opacity: 0;
            transition: opacity .35s ease;
          }

          .hp-scroll-progress.is-visible {
            opacity: 1;
          }

          .hp-scroll-progress > span {
            display: block;
            width: 100%;
            height: 100%;
            transform: scaleX(var(--hp-scroll-progress));
            transform-origin: left center;
            background: linear-gradient(
              90deg,
              #F47822 0%,
              #D4AF37 100%
            );
            box-shadow:
              0 0 12px rgba(244,120,34,.34);
            will-change: transform;
          }

          .hp-hero-stage {
            isolation: isolate;
          }

          .hp-hero-motion-layer {
            position: absolute;
            inset: 0;
            transform:
              translateZ(0)
              scale(var(--hp-hero-scale));
            transform-origin: center center;
            will-change: transform;
          }

          .hp-hero-dim-layer {
            position: absolute;
            inset: 0;
            z-index: 3;
            pointer-events: none;
            background: #000;
            opacity:
              calc(.03 + var(--hp-hero-dim));
            will-change: opacity;
          }

          .hp-hero-handoff-line {
            position: absolute;
            z-index: 8;
            left: 0;
            right: 0;
            bottom: 0;
            height: 2px;
            pointer-events: none;
            transform:
              scaleX(var(--hp-hero-line-scale));
            transform-origin: left center;
            background:
              linear-gradient(
                90deg,
                transparent 0%,
                #F47822 18%,
                #D4AF37 62%,
                transparent 100%
              );
            box-shadow:
              0 0 18px rgba(212,175,55,.36);
            will-change: transform;
          }

          .hp-journey-handoff {
            transform:
              translate3d(
                0,
                var(--hp-journey-shift),
                0
              );
            will-change: transform;
          }

          .hp-section-navigator {
            position: fixed;
            z-index: 120;
            right: 22px;
            top: 50%;
            transform: translateY(-50%);
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
            pointer-events: none;
            opacity: 0;
            transition: opacity .4s ease;
          }

          .hp-section-navigator.is-visible {
            opacity: 1;
          }

          .hp-section-nav-button {
            pointer-events: auto;
            display: flex;
            min-height: 28px;
            align-items: center;
            justify-content: flex-end;
            gap: 9px;
            border: 0;
            padding: 0;
            color: rgba(255,255,255,.42);
            background: transparent;
            cursor: pointer;
          }

          .hp-section-nav-label {
            max-width: 0;
            overflow: hidden;
            white-space: nowrap;
            opacity: 0;
            transform: translateX(8px);
            transition:
              max-width .35s cubic-bezier(.16,1,.3,1),
              opacity .24s ease,
              transform .35s cubic-bezier(.16,1,.3,1);
            border: 1px solid rgba(255,255,255,.10);
            background: rgba(8,7,6,.78);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            box-shadow: 0 10px 30px rgba(0,0,0,.14);
          }

          .hp-section-nav-button:hover
          .hp-section-nav-label,
          .hp-section-nav-button.is-active
          .hp-section-nav-label {
            max-width: 150px;
            opacity: 1;
            transform: translateX(0);
            padding: 6px 9px;
          }

          .hp-section-nav-index {
            font-size: 8px;
            font-weight: 900;
            letter-spacing: .12em;
            color: rgba(255,255,255,.34);
            transition: color .25s ease;
          }

          .hp-section-nav-dot {
            position: relative;
            width: 7px;
            height: 7px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,.44);
            background: rgba(8,7,6,.55);
            transition:
              transform .32s cubic-bezier(.16,1,.3,1),
              border-color .25s ease,
              background-color .25s ease,
              box-shadow .25s ease;
          }

          .hp-section-nav-button.is-active {
            color: #F4D36A;
          }

          .hp-section-nav-button.is-active
          .hp-section-nav-index {
            color: #F4D36A;
          }

          .hp-section-nav-button.is-active
          .hp-section-nav-dot {
            transform: scale(1.45);
            border-color: #F47822;
            background: #F47822;
            box-shadow:
              0 0 0 5px rgba(244,120,34,.10),
              0 0 16px rgba(244,120,34,.42);
          }

          .hp-pointer-glow::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 4;
            pointer-events: none;
            opacity:
              var(--hp-pointer-opacity, 0);
            background:
              radial-gradient(
                circle 220px at
                var(--hp-pointer-x, 50%)
                var(--hp-pointer-y, 50%),
                rgba(244,120,34,.075) 0%,
                rgba(212,175,55,.03) 40%,
                transparent 72%
              );
            transition: opacity .5s ease;
          }

          .hp-concierge-lid {
            transform-origin: 50% 100%;
            transition:
              transform .62s cubic-bezier(.16,1,.3,1),
              box-shadow .42s ease;
          }

          .hp-concierge-reveal-glow {
            position: absolute;
            z-index: 18;
            left: 50%;
            top: 17%;
            width: 46%;
            aspect-ratio: 1;
            border-radius: 999px;
            pointer-events: none;
            opacity: 0;
            transform:
              translate(-50%, -50%)
              scale(.45);
            background:
              radial-gradient(
                circle,
                rgba(255,238,164,.96) 0%,
                rgba(244,120,34,.42) 28%,
                rgba(212,175,55,.14) 52%,
                transparent 74%
              );
            filter: blur(12px);
          }

          @keyframes hpConciergeGiftBurst {
            0% {
              opacity: 0;
              transform:
                translate(-50%, -50%)
                scale(.42);
            }

            42% {
              opacity: .92;
            }

            100% {
              opacity: 0;
              transform:
                translate(-50%, -50%)
                scale(1.55);
            }
          }

          @keyframes hpConciergeBowRelease {
            0% {
              transform:
                translateX(-50%)
                rotate(-2deg);
            }

            55% {
              transform:
                translateX(-50%)
                translateY(-18px)
                rotate(5deg)
                scale(1.035);
            }

            100% {
              transform:
                translateX(-50%)
                translateY(-10px)
                rotate(1deg);
            }
          }

          .hp-concierge-gift-box.is-opening
          .hp-concierge-lid {
            transform:
              translateY(-20px)
              rotateX(12deg)
              scaleX(1.015);
            box-shadow:
              0 22px 42px rgba(0,0,0,.48),
              0 -6px 24px rgba(212,175,55,.12);
          }

          .hp-concierge-gift-box.is-opening
          .hp-concierge-bow {
            animation:
              hpConciergeBowRelease .68s
              cubic-bezier(.16,1,.3,1)
              both;
          }

          .hp-concierge-gift-box.is-opening
          .hp-concierge-reveal-glow {
            animation:
              hpConciergeGiftBurst .72s
              cubic-bezier(.16,1,.3,1)
              both;
          }

          .hp-concierge-screen-flare {
            position: absolute;
            z-index: 6;
            inset: 0;
            pointer-events: none;
            opacity: 0;
            background:
              radial-gradient(
                circle at 50% 56%,
                rgba(244,120,34,.15),
                rgba(212,175,55,.08) 24%,
                transparent 54%
              );
            transition: opacity .28s ease;
          }

          .is-gift-revealing
          .hp-concierge-screen-flare {
            opacity: 1;
          }

          .hp-concierge-cta:disabled {
            cursor: wait;
          }

          .hp-story-kicker,
          .hp-story-line {
            opacity: 0;
            filter: blur(5px);
            transform: translate3d(0, 34px, 0);
            transition:
              opacity .7s cubic-bezier(.22,1,.36,1),
              transform .92s cubic-bezier(.16,1,.3,1),
              filter .72s ease;
          }

          .hp-story-page.is-story-visible
          .hp-story-kicker,
          .hp-story-page.is-story-visible
          .hp-story-line {
            opacity: 1;
            filter: blur(0);
            transform: translate3d(0, 0, 0);
            transition-delay:
              var(--hp-story-delay, 0ms);
          }

          .hp-hamper-one-image {
            clip-path: inset(0 100% 0 0);
            -webkit-clip-path: inset(0 100% 0 0);
            transform: scale(1.045);
            transform-origin: center center;
            transition:
              clip-path 1.18s cubic-bezier(.16,1,.3,1),
              -webkit-clip-path 1.18s cubic-bezier(.16,1,.3,1),
              transform 1.55s cubic-bezier(.16,1,.3,1);
          }

          .hp-hamper-one-visual.is-visible
          .hp-hamper-one-image {
            clip-path: inset(0 0 0 0);
            -webkit-clip-path: inset(0 0 0 0);
            transform: scale(1);
          }

          .hp-hamper-one-curtain-line {
            position: absolute;
            z-index: 24;
            top: 0;
            bottom: 0;
            left: 0;
            width: 1px;
            pointer-events: none;
            opacity: 0;
            background:
              linear-gradient(
                to bottom,
                transparent 0%,
                #F3DB8C 16%,
                #D4AF37 50%,
                #F47822 84%,
                transparent 100%
              );
            box-shadow:
              0 0 18px rgba(212,175,55,.5);
          }

          @keyframes hpHamperOneCurtainSweep {
            0% {
              left: 0;
              opacity: 0;
            }

            12% {
              opacity: 1;
            }

            86% {
              opacity: 1;
            }

            100% {
              left: 100%;
              opacity: 0;
            }
          }

          .hp-hamper-one-visual.is-visible
          .hp-hamper-one-curtain-line {
            animation:
              hpHamperOneCurtainSweep 1.18s
              .05s cubic-bezier(.16,1,.3,1)
              both;
          }

          @keyframes hpReviewCardEnter {
            0% {
              opacity: 0;
              transform: translate3d(0, 18px, 0);
              filter: blur(4px);
            }

            100% {
              opacity: 1;
              transform: translate3d(0, 0, 0);
              filter: blur(0);
            }
          }

          @keyframes hpReviewStarIn {
            0% {
              opacity: 0;
              transform: translateY(8px) scale(.72);
            }

            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .hp-review-enter {
            animation:
              hpReviewCardEnter .62s
              cubic-bezier(.16,1,.3,1)
              both;
          }

          .hp-review-star {
            opacity: 0;
            animation:
              hpReviewStarIn .42s
              cubic-bezier(.16,1,.3,1)
              forwards;
          }

          .hp-final-parallax-zone {
            --hp-final-x: 0px;
            --hp-final-y: 0px;
          }

          @media (max-width: 1279px) {
            .hp-section-navigator {
              display: none !important;
            }
          }

          @media (max-width: 1023px) {
            .hp-journey-handoff {
              transform: none;
            }

            .hp-pointer-glow::before {
              display: none;
            }
          }



          .hamporium-home {
            padding-bottom: 0 !important;
            margin-bottom: 0 !important;
          }

          .hamporium-home > section:last-of-type {
            margin-bottom: 0 !important;
          }

          /* ==============================================
             V54 · MOBILE BULK RAIL FIX
             Keep the original card treatment and horizontal
             70/30 swipe rail. Touch devices must not retain
             desktop :hover styling after a tap.
          =============================================== */

          @media (max-width: 1023px) {
            [data-home-section="bulk"] .hp-mobile-rail {
              --hp-bulk-card-width: min(76vw, 420px);

              display: flex !important;
              width: 100% !important;
              max-width: none !important;
              overflow-x: auto !important;
              overflow-y: hidden !important;
              gap: 12px !important;
              padding: 14px 0 20px !important;
              scroll-padding-inline: 0;
              scroll-snap-type: x mandatory;
              scroll-behavior: smooth;
              overscroll-behavior-inline: contain;
              -webkit-overflow-scrolling: touch;
              scrollbar-width: none;
              mask-image: none !important;
              -webkit-mask-image: none !important;
            }

            [data-home-section="bulk"] .hp-mobile-rail::-webkit-scrollbar {
              display: none;
            }

            [data-home-section="bulk"] .hp-mobile-rail >
            .hp-bulk-step-card {
              flex: 0 0 var(--hp-bulk-card-width) !important;
              width: var(--hp-bulk-card-width) !important;
              max-width: var(--hp-bulk-card-width) !important;
              min-width: 0 !important;
              min-height: 280px;
              scroll-snap-align: start;
              scroll-snap-stop: always;
            }
          }

          @media (max-width: 639px) {
            [data-home-section="bulk"] .hp-mobile-rail {
              --hp-bulk-card-width: 78vw;
              gap: 10px !important;
            }
          }

          @media (hover: none), (pointer: coarse) {
            .hp-bulk-step-card .hp-bulk-step-image {
              opacity: 0 !important;
            }

            .hp-bulk-step-card .hp-bulk-step-kicker {
              color: #F47822 !important;
            }

            .hp-bulk-step-card .hp-bulk-step-arrow {
              color: rgba(0,0,0,.16) !important;
            }

            .hp-bulk-step-card .hp-bulk-step-title {
              color: #171717 !important;
            }

            .hp-bulk-step-card .hp-bulk-step-copy {
              color: rgba(0,0,0,.50) !important;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .hp-hero-motion-layer,
            .hp-journey-handoff,
            .hp-hamper-one-image,
            .hp-story-kicker,
            .hp-story-line {
              transform: none !important;
              transition: none !important;
            }

            .hp-hamper-one-image {
              clip-path: none !important;
              -webkit-clip-path: none !important;
            }

            .hp-story-kicker,
            .hp-story-line {
              opacity: 1 !important;
            }

            .hp-hamper-one-curtain-line,
            .hp-concierge-reveal-glow {
              display: none !important;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .hp-editorial-flex > .hp-editorial-panel,
            .hp-editorial-base,
            .hp-editorial-hover,
            .hp-story-image,
            .hp-journey-base,
            .hp-journey-hover {
              transition: none !important;
            }

            .hp-hero-video-ready,
            .hp-ambient-float,
            .hp-soft-spin,
            .hp-badge-pulse,
            .hp-journey-glow,
            .hp-moment-line,
            .hp-final-drift,
            .hp-concierge-ambient,
            .hp-concierge-gift-box,
            .hp-concierge-bow,
            .hp-concierge-card.is-active,
            .hp-review-enter,
            .hp-review-star,
            .hp-final-drift {
              animation: none !important;
            }
          }
          /* ==================================================
             V65 / SIGNATURE MOTION
             Scoped refinements; the approved visual identity stays intact.
          ================================================== */
          .hp-home-v65 { --hp-motion-ease: cubic-bezier(.22,1,.36,1); }
          .hp-home-v65 *, .hp-home-quick-dialog * { box-sizing: border-box; }
          .hp-home-v65 :where(button, a, input):focus-visible,
          .hp-home-quick-dialog :where(button, a):focus-visible {
            outline: 2px solid #F47822; outline-offset: 5px;
          }
          .hp-home-v65 button:disabled { cursor: not-allowed; }
          .hp-home-v65 [data-home-section] { scroll-margin-top: 86px; }
          .hp-home-v65 .hp-image-fallback {
            display: grid; place-items: center;
            background: radial-gradient(ellipse at 30% 20%, #d5b98e, #70604a);
            color: #fff4dc;
          }
          .hp-home-v65 .hp-image-fallback > span { opacity: .7; }
          .hp-home-v65 .hp-image-fallback svg { width: 48px; height: 48px; }
          .hp-home-v65 .hp-reveal { will-change: auto; }
          .hp-home-v65 .hp-story-kicker, .hp-home-v65 .hp-story-line {
            opacity: 1; filter: none; transform: none;
          }
          .hp-home-v65 .hp-story-page.is-story-visible .hp-story-line {
            animation: hpStoryLineEnter .8s var(--hp-motion-ease) both;
            animation-delay: var(--hp-story-delay, 0ms);
          }
          @keyframes hpStoryLineEnter {
            from { opacity: .25; transform: translate3d(0,18px,0); }
            to { opacity: 1; transform: translate3d(0,0,0); }
          }
          .hp-home-v65 .hp-hamper-one-image {
            clip-path: none; -webkit-clip-path: none; will-change: auto;
          }
          .hp-home-v65 .hp-story-image {
            will-change: transform;
            transform: translate3d(0,0,0) scale(1.001);
            -webkit-transform: translate3d(0,0,0) scale(1.001);
          }
          .hp-home-v65 .hp-story-page {
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }
          .hp-home-v65 .hp-concierge-card.is-active { animation: none; }
          .hp-home-v65 .hp-concierge-card {
            transition: transform .7s var(--hp-motion-ease), border-color .4s ease, box-shadow .4s ease;
          }
          .hp-home-v65 .hp-concierge-card:hover { transform: translateY(-5px); }
          .hp-home-v65 .hp-concierge-card img { filter: none !important; }
          .hp-home-v65 .hp-journey-base { opacity: 1 !important; }
          .hp-home-v65 .hp-journey-base, .hp-home-v65 .hp-journey-hover {
            will-change: auto; transition: opacity .8s ease, transform 1.2s var(--hp-motion-ease);
          }
          .hp-home-v65 .hp-journey-hover:not([data-loaded="true"]) { opacity: 0 !important; }
          .hp-home-v65 .hp-gift-product-window img { will-change: auto; filter: none !important; }
          .hp-home-v65 .hp-editorial-base, .hp-home-v65 .hp-editorial-hover { will-change: auto; }
          .hp-home-v65 .hp-offscreen *, .hp-home-v65 [data-page-hidden="true"] * {
            animation-play-state: paused !important;
          }
          .hp-home-v65 .hp-offscreen::before, .hp-home-v65 .hp-offscreen::after {
            animation-play-state: paused !important;
          }
          .hp-home-v65 .hp-concierge-ambient, .hp-home-v65 .hp-review-glow,
          .hp-home-v65 .hp-luxury-glow { animation: none; opacity: .2; }

          /* Video stays full bleed. Controls do not cover the film. */
          .hp-intro-loading { transition: opacity .42s ease; }
          .hp-intro-loading.is-leaving { opacity: 0; pointer-events: none; }
          .hp-intro-skip {
            position: fixed; top: max(22px, env(safe-area-inset-top)); right: 28px;
            z-index: 10001; min-height: 44px; padding: 0 20px; border-radius: 99px;
            border: 1px solid #d5b86470; background: #15120de8; color: #fff4dc;
            font: 600 12px/1 'Manrope',Arial,sans-serif; display: flex; align-items: center; gap: 16px;
          }
          .hp-hero-poster, .hp-hero-film {
            position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center;
          }
          .hp-hero-film { opacity: 0; transition: opacity .85s ease; }
          .hp-hero-film.is-ready { opacity: 1; }
          .hp-hero-controls {
            position: absolute; bottom: max(26px, env(safe-area-inset-bottom)); left: clamp(18px,4vw,70px);
            right: clamp(18px,4vw,70px); z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px;
          }
          .hp-hero-controls button {
            display: inline-flex; align-items: center; gap: 13px; padding: 0 17px; min-height: 44px;
            background: #12110dbf; color: #fff9e8; border: 1px solid #fff4d430; border-radius: 99px;
            font-size: 12px; font-weight: 650; backdrop-filter: blur(5px); transition: background .3s ease;
          }
          .hp-hero-controls button:hover { background: #211c13; }
          .hp-hero-controls svg { width: 16px; height: 16px; }
          .hp-hero-fallback-copy {
            position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
            padding: 110px clamp(24px,5vw,88px); color: #fff4dc;
            background: linear-gradient(90deg,#070604ed,#07060499 50%,#07060420);
          }
          .hp-hero-fallback-copy > p { font-size: 12px; letter-spacing: .24em; color: #edc868; }
          .hp-hero-fallback-copy h2 { margin: 24px 0; max-width: 900px; font: 600 clamp(40px,5.5vw,94px)/.99 'Cormorant Garamond',Georgia,serif; }
          .hp-hero-fallback-copy h2 em { color: #edc868; }
          .hp-hero-fallback-copy a { min-height: 48px; display: inline-flex; align-items:center; gap: 28px; padding: 0 24px; background: #f47822; color: white; font-size: 13px; font-weight: 700; }

          /* Navigable carousels: native scroll; no wheel or touch hijack. */
          .hp-home-v65 .hp-rail-controls {
            display: flex; gap: 22px; align-items: center; min-width: 0; margin: 20px 0 0;
            color: #655747; font-size: 12px; letter-spacing: .06em; font-weight: 600;
          }
          .hp-home-v65 .hp-rail-controls p { margin: 0; white-space: nowrap; }
          .hp-home-v65 .hp-rail-controls p > span { color: #30261c; }
          .hp-home-v65 .hp-rail-controls-dark { color: #b6ac9a; }
          .hp-home-v65 .hp-rail-controls-dark p > span { color: #f6e7c6; }
          .hp-home-v65 .hp-rail-track { flex: 1; max-width: 230px; height: 2px; background: #ad997c30; }
          .hp-home-v65 .hp-rail-track > span { height: 100%; display: block; background: #b98d2a; transition: width .5s var(--hp-motion-ease); }
          .hp-home-v65 .hp-rail-arrows { margin-left: auto; display: flex; gap: 9px; }
          .hp-home-v65 .hp-rail-arrows button {
            display: grid; place-items: center; width: 46px; height: 46px; border: 1px solid #a989593d;
            border-radius: 50%; color: #3a2b1a; background: #fffaf2; transition: color .3s ease, background .3s ease, border-color .3s ease;
          }
          .hp-home-v65 .hp-rail-controls-dark button { background: #fff6e409; color: #f1d582; border-color: #d4af3752; }
          .hp-home-v65 .hp-rail-arrows button:not(:disabled):hover { background: #302319; color: #fff6e7; border-color: #302319; }
          .hp-home-v65 .hp-rail-arrows button:disabled { opacity: .3; }
          .hp-home-v65 .hp-snap-rail { position: relative; }
          .hp-home-v65 .hp-snap-rail:focus-visible { outline: 2px solid #c9913b; outline-offset: 5px; }
          .hp-home-v65 .hp-collection-interactive { margin-top: clamp(26px,3.5vw,52px); }
          .hp-home-v65 .hp-bestseller-runway {
            display: flex !important; gap: 18px !important; width: 100% !important; max-width: 100% !important;
            overflow-x: auto; overflow-y: hidden; margin: 0; padding: 8px 0 14px !important; transform: none;
            scroll-behavior: smooth; scroll-snap-type: x mandatory; scrollbar-width: none;
            -webkit-overflow-scrolling: touch; overscroll-behavior-inline: contain; scroll-padding-inline: 0;
          }
          .hp-home-v65 .hp-bestseller-runway::-webkit-scrollbar { display: none; }
          .hp-home-v65 .hp-bestseller-runway > * {
            flex: 0 0 calc((100% - 54px) / 4) !important; width: calc((100% - 54px) / 4) !important;
            max-width: calc((100% - 54px) / 4) !important; min-width: 0;
            scale: 1 !important; opacity: 1 !important; transform: none !important; scroll-snap-align: start;
          }
          .hp-home-v65 .hp-bestseller-card { min-height: 0; height: 408px; padding: 12px; display: block; border-radius: 24px; }
          .hp-home-v65 .hp-gift-package { min-height: 0; height: 100%; display: grid; grid-template-rows: minmax(0,1fr) auto; text-decoration: none; }
          .hp-home-v65 .hp-gift-product-window { min-height: 0; border-radius: 14px; }
          .hp-home-v65 .hp-bestseller-copy { min-height: 146px; padding: 15px 9px 5px; }
          .hp-home-v65 .hp-bestseller-title { font-size: clamp(25px,1.85vw,32px); line-height: 1.01; }
          .hp-home-v65 .hp-bestseller-price-label { font-size: 10px; letter-spacing: .10em; }
          .hp-home-v65 .hp-bestseller-price { font-size: 19px; line-height: 1.3; }
          .hp-home-v65 .hp-bestseller-copy .hp-bestseller-line { margin-bottom: 9px; }
          .hp-home-v65 .hp-bestseller-meta { margin-top: 12px; }
          .hp-home-v65 .hp-bestseller-card:hover { transform: translateY(-3px); }
          .hp-home-v65 .hp-bestseller-card:hover .hp-bestseller-copy { transform: none; }
          .hp-home-v65 .hp-quick-look {
            position: absolute; top: 22px; right: 22px; z-index: 6; display: inline-flex; align-items: center; gap: 7px;
            min-height: 38px; border: 1px solid #ead9bc; padding: 0 12px; border-radius: 99px;
            background: #fffaf1f0; color: #332819; font: 700 11px/1 'Manrope',Arial,sans-serif;
            opacity: 0; transform: translateY(5px); transition: opacity .28s ease, transform .4s var(--hp-motion-ease);
          }
          .hp-home-v65 .hp-quick-look svg { width: 16px; height: 16px; }
          .hp-home-v65 .hp-bestseller-card:hover .hp-quick-look,
          .hp-home-v65 .hp-bestseller-card:focus-within .hp-quick-look { opacity: 1; transform: none; }
          .hp-home-v65 .hp-collection-notice { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 14px 0; color: #72573c; font-size: 13px; }
          .hp-home-v65 .hp-collection-notice button { text-decoration: underline; min-height: 44px; font-weight: 750; }

          /* Concierge: clear choices, not extra marketing boxes. */
          .hp-home-v65 .hp-concierge-selection {
            padding: 0 0 18px; margin: 0 0 20px; border-bottom: 1px solid #e4c98426;
            font-size: 13px; line-height: 1.6; color: #f8e8c7;
          }
          .hp-home-v65 .hp-concierge-selection > span:first-child { color: #c0b29c; margin-right: 18px; font-size: 11px; letter-spacing: .07em; }
          .hp-home-v65 .hp-budget-steps { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 7px; margin-top: 18px; }
          .hp-home-v65 .hp-budget-steps button {
            min-height: 44px; border-radius: 7px; border: 1px solid #fff3d424; padding: 8px 5px; font-size: 11px;
            color: #d9cdb8; line-height: 1.5; font-weight: 650; background: #ffffff04; transition: color .25s ease, background .25s ease, border-color .25s ease;
          }
          .hp-home-v65 .hp-budget-steps button.is-selected { color: #ffda89; border-color: #d4af378c; background: #d4af3715; }
          .hp-home-v65 .hp-budget-steps button:hover { background: #d4af3720; }
          .hp-home-v65 .hp-concierge-range { min-height: 7px; cursor: pointer; }
          .hp-home-v65 .hp-concierge-range:focus-visible { outline: 2px solid #f47822; outline-offset: 10px; }
          .hp-home-v65 .hp-concierge-cta { min-width: 200px; font-size: 12px; transition: transform .4s var(--hp-motion-ease), box-shadow .3s ease; }
          .hp-home-v65 .hp-concierge-cta:not(:disabled):hover { transform: translateY(-2px); }

          /* Read-only preview. Native dialog supplies the top layer and focus trap. */
          .hp-home-quick-dialog {
            box-sizing: border-box; width: min(920px,calc(100vw - 32px)); max-height: calc(100dvh - 40px);
            padding: 0; margin: auto; overflow: auto; border: 1px solid #d6c5ab; border-radius: 18px;
            background: #fffcf8; color: #26201a; box-shadow: 0 28px 100px #0005;
            font-family: 'Manrope',Arial,sans-serif;
          }
          .hp-home-quick-dialog[open] { animation: hpQuickOpen .3s var(--hp-motion-ease,cubic-bezier(.22,1,.36,1)); }
          .hp-home-quick-dialog::backdrop { background: #100d0bbd; backdrop-filter: blur(5px); }
          @keyframes hpQuickOpen { from { opacity:.4; transform: translateY(12px); } to { opacity:1; transform: none; } }
          .hp-quick-layout { display: grid; grid-template-columns: 1fr 1fr; }
          .hp-quick-photo { min-width: 0; height: 485px; background: #f1eade; padding: 18px; }
          .hp-quick-photo img { width:100%; height:100%; object-fit:contain; }
          .hp-quick-copy { min-width: 0; align-self: center; padding: 48px 36px 36px; }
          .hp-quick-eyebrow { color: #987129; font-size: 10px; font-weight: 750; letter-spacing: .14em; }
          .hp-quick-copy h2 { margin: 15px 0 18px; font: 600 clamp(32px,3vw,48px)/1.02 'Cormorant Garamond',Georgia,serif; }
          .hp-quick-description { font-size: 14px; line-height:1.8; color:#6b5d4f; }
          .hp-quick-price { margin: 20px 0 10px; font-size: 27px; font-weight: 750; }
          .hp-quick-note { color:#756957; font-size:12px; line-height:1.7; padding-top:14px; border-top:1px solid #e6dccf; }
          .hp-quick-link { display:flex; justify-content:space-between; align-items:center; min-height:50px; padding:0 20px; margin-top:24px; background:#f47822; color:#fff; font-size:13px; font-weight:750; text-decoration:none; border-radius:6px; }
          .hp-quick-continue { display:block; min-height:44px; margin:8px auto 0; color:#776a59; background:transparent; border:0; font-size:12px; }
          .hp-quick-close { position:absolute; top:12px; right:12px; z-index:3; display:grid; place-items:center; width:42px; height:42px; border-radius:50%; background:#fffdf8; border:1px solid #ddd0bc; color:#3a2b20; }

          @media (min-width:1024px) {
            .hp-home-v65 .hp-rail-mobile-only { display:none; }
            .hp-home-v65 .hp-journey-grid > a { min-width:0; }
          }
          @media (hover:hover) and (pointer:fine) and (min-width:1024px) {
            .hp-home-v65 .hp-journey-grid:has(>a:focus-visible) { transition: grid-template-columns .95s var(--hp-motion-ease); }
            .hp-home-v65 .hp-journey-grid:has(>a:nth-child(1):focus-visible) { grid-template-columns: minmax(0,1.28fr) minmax(0,.86fr) minmax(0,.86fr); }
            .hp-home-v65 .hp-journey-grid:has(>a:nth-child(2):focus-visible) { grid-template-columns: minmax(0,.86fr) minmax(0,1.28fr) minmax(0,.86fr); }
            .hp-home-v65 .hp-journey-grid:has(>a:nth-child(3):focus-visible) { grid-template-columns: minmax(0,.86fr) minmax(0,.86fr) minmax(0,1.28fr); }
            .hp-home-v65 .hp-journey-grid > a:focus-visible .hp-journey-hover[data-loaded="true"] { opacity:1; transform:scale(1.015); }
          }
          @media (max-width:1023px) {
            .hp-home-v65 .hp-snap-rail > *, .hp-home-v65 .hp-snap-rail > .is-mobile-active {
              scale:1 !important; opacity:1 !important; will-change:auto !important;
            }
            .hp-home-v65 .hp-quick-look { opacity:1; transform:none; }
            .hp-home-v65 .hp-bestseller-runway { padding:8px 16px 16px !important; gap:14px !important; scroll-padding-inline:16px; }
            .hp-home-v65 .hp-bestseller-runway > * { flex-basis:calc((100% - 14px) / 2) !important; width:calc((100% - 14px) / 2) !important; max-width:calc((100% - 14px) / 2) !important; }
            .hp-home-v65 .hp-rail-mobile-only, .hp-home-v65 .hp-bestseller-controls { margin-inline:16px; }
            .hp-home-v65 .hp-section-heading { overflow-wrap:normal; }
          }
          @media (max-width:639px) {
            .hp-home-v65 .hp-hero-stage { min-height:560px; }
            .hp-home-v65 .hp-hero-controls { bottom:22px; left:14px; right:14px; }
            .hp-home-v65 .hp-hero-controls button { font-size:11px; gap:8px; padding-inline:12px; }
            .hp-home-v65 .hp-film-toggle span { display:none; }
            .hp-home-v65 .hp-intro-skip { top:18px; right:16px; }
            .hp-home-v65 .hp-rail-controls { gap:14px; }
            .hp-home-v65 .hp-rail-arrows button { width:44px; height:44px; }
            .hp-home-v65 .hp-rail-track { max-width:100px; }
            .hp-home-v65 .hp-bestseller-runway > * { flex-basis:min(82vw,360px) !important; width:min(82vw,360px) !important; max-width:min(82vw,360px) !important; }
            .hp-home-v65 .hp-bestseller-card { height:392px; }
            .hp-home-v65 .hp-bestseller-title { font-size:29px; }
            .hp-home-v65 .hp-bestseller-copy { min-height:139px; }
            .hp-home-v65 .hp-budget-steps { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
            .hp-home-v65 .hp-budget-steps button { font-size:12px; }
            .hp-home-v65 .hp-concierge-selection > span:first-child { display:block; margin-bottom:4px; }
            .hp-home-v65 .hp-concierge-cta { width:100%; }
            .hp-home-quick-dialog { width:calc(100vw - 24px); max-height:calc(100dvh - 24px); border-radius:14px; }
            .hp-quick-layout { grid-template-columns:1fr; }
            .hp-quick-photo { height:250px; padding:14px; }
            .hp-quick-copy { padding:24px; }
            .hp-quick-copy h2 { font-size:34px; }
          }
          @media (hover:none), (pointer:coarse) {
            .hp-home-v65 .hp-quick-look { opacity:1; transform:none; }
            .hp-home-v65 .hp-bestseller-card:hover { transform:none; }
            .hp-home-v65 .hp-concierge-card:hover { transform:none; }
          }
          @media (prefers-reduced-motion:reduce) {
            .hp-home-v65 *, .hp-home-v65 *::before, .hp-home-v65 *::after,
            .hp-home-quick-dialog, .hp-home-quick-dialog * {
              animation:none !important; transition:none !important; scroll-behavior:auto !important;
            }
            .hp-home-v65 .hp-reveal, .hp-home-v65 .hp-story-line, .hp-home-v65 .hp-story-kicker {
              opacity:1 !important; filter:none !important; transform:none !important;
            }
          }



          /* ==================================================
             V66 · GIFT COUTURE BESTSELLERS
             Keep the original wrapped-gift card concept, but make
             the packaging feel richer, more decorative and collectible.
          ================================================== */
          .hp-home-v65 .hp-bestseller-card {
            --gift-jewel: color-mix(in srgb, var(--gift-accent) 78%, #fff 22%);
            --gift-deep: color-mix(in srgb, var(--gift-paper) 70%, #000 30%);
            overflow: hidden;
            border-color: color-mix(in srgb, var(--gift-edge) 88%, transparent);
            box-shadow:
              0 30px 68px rgba(31,22,12,.15),
              0 10px 28px rgba(31,22,12,.08),
              inset 0 1px 0 rgba(255,255,255,.50),
              inset 0 0 0 1px rgba(255,255,255,.08);
          }

          .hp-home-v65 .hp-bestseller-card::before {
            opacity: .42;
            background-image:
              radial-gradient(circle at 20% 16%, rgba(255,255,255,.28) 0 1px, transparent 1.4px),
              radial-gradient(circle at 78% 72%, rgba(93,60,16,.10) 0 .8px, transparent 1.1px),
              repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 1px, transparent 1px 8px);
            background-size: 18px 18px, 15px 15px, auto;
            mix-blend-mode: soft-light;
          }

          .hp-home-v65 .hp-bestseller-card::after {
            inset: 7px;
            border-radius: 19px;
            border: 1px solid color-mix(in srgb, var(--gift-accent) 58%, transparent);
            box-shadow:
              inset 0 0 0 1px rgba(255,255,255,.12),
              inset 0 0 22px rgba(255,255,255,.035);
          }

          .hp-home-v65 .hp-bestseller-card:hover {
            transform: translateY(-7px) scale(1.004);
            box-shadow:
              0 42px 90px rgba(31,22,12,.22),
              0 15px 32px rgba(31,22,12,.10),
              inset 0 1px 0 rgba(255,255,255,.54);
          }

          /* The ribbon stays the hero decorative language, now with satin stitching. */
          .hp-home-v65 .hp-gift-wrap-layer {
            z-index: 4;

            /*
              Keep the decorative wrapping on the photographic gift area only.
              The vertical ribbon used to continue through the title / CTA area,
              which made the copy look crossed out. The wrap now ends cleanly
              at the image-to-copy seam while the card still reads as a gift box.
            */
            bottom: 154px;
            overflow: hidden;
            border-radius: 19px 19px 13px 13px;
          }

          .hp-home-v65 .hp-wrap-ribbon {
            border-color: rgba(255,238,174,.30);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.40),
              inset 0 -1px 0 rgba(72,42,3,.18),
              0 5px 14px rgba(42,25,5,.16);
          }

          .hp-home-v65 .hp-wrap-ribbon::before,
          .hp-home-v65 .hp-wrap-ribbon::after {
            content: "";
            position: absolute;
            pointer-events: none;
            opacity: .52;
          }

          .hp-home-v65 .hp-wrap-ribbon-v::before,
          .hp-home-v65 .hp-wrap-ribbon-v::after {
            top: 0;
            bottom: 0;
            width: 1px;
            background: repeating-linear-gradient(to bottom, rgba(255,249,219,.78) 0 4px, transparent 4px 8px);
          }

          .hp-home-v65 .hp-wrap-ribbon-v::before { left: 3px; }
          .hp-home-v65 .hp-wrap-ribbon-v::after { right: 3px; }

          .hp-home-v65 .hp-wrap-ribbon-h::before,
          .hp-home-v65 .hp-wrap-ribbon-h::after,
          .hp-home-v65 .hp-wrap-ribbon-diagonal::before,
          .hp-home-v65 .hp-wrap-ribbon-diagonal::after {
            left: 0;
            right: 0;
            height: 1px;
            background: repeating-linear-gradient(to right, rgba(255,249,219,.74) 0 4px, transparent 4px 8px);
          }

          .hp-home-v65 .hp-wrap-ribbon-h::before,
          .hp-home-v65 .hp-wrap-ribbon-diagonal::before { top: 3px; }
          .hp-home-v65 .hp-wrap-ribbon-h::after,
          .hp-home-v65 .hp-wrap-ribbon-diagonal::after { bottom: 3px; }

          .hp-home-v65 .hp-wrap-bow {
            width: 82px;
            height: 68px;
            filter:
              drop-shadow(0 12px 14px rgba(41,24,4,.25))
              drop-shadow(0 2px 2px rgba(255,255,255,.14));
          }

          .hp-home-v65 .hp-wrap-bow-loop {
            width: 39px;
            height: 27px;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.40),
              inset 0 -5px 12px rgba(90,51,4,.16),
              0 6px 12px rgba(35,20,3,.16);
          }

          .hp-home-v65 .hp-wrap-bow-knot {
            width: 25px;
            height: 24px;
            box-shadow:
              inset 0 2px 5px rgba(255,255,255,.34),
              inset 0 -5px 9px rgba(76,43,5,.20),
              0 7px 13px rgba(35,20,3,.18);
          }

          .hp-home-v65 .hp-wrap-bow-knot::after {
            content: "";
            position: absolute;
            inset: 5px;
            border-radius: 50%;
            border: 1px solid rgba(255,247,208,.46);
            box-shadow: inset 0 0 7px rgba(255,255,255,.22);
          }

          .hp-home-v65 .hp-wrap-bow-tail {
            top: 31px;
            height: 35px;
          }

          .hp-home-v65 .hp-bestseller-card:hover .hp-wrap-bow {
            transform: translate3d(0,-3px,0) scale(1.06) rotate(-1.5deg);
          }

          /* Fine gold filigree corners around the gift package. */
          .hp-home-v65 .hp-gift-corner {
            position: absolute;
            z-index: 5;
            width: 34px;
            height: 34px;
            opacity: .68;
            filter: drop-shadow(0 2px 7px rgba(91,56,8,.16));
          }

          .hp-home-v65 .hp-gift-corner::before,
          .hp-home-v65 .hp-gift-corner::after {
            content: "";
            position: absolute;
            background: linear-gradient(90deg, transparent, var(--gift-jewel));
          }

          .hp-home-v65 .hp-gift-corner::before {
            width: 29px;
            height: 1px;
          }

          .hp-home-v65 .hp-gift-corner::after {
            width: 1px;
            height: 29px;
            background: linear-gradient(180deg, transparent, var(--gift-jewel));
          }

          .hp-home-v65 .hp-gift-corner-tl { top: 16px; left: 16px; transform: rotate(180deg); }
          .hp-home-v65 .hp-gift-corner-tr { top: 16px; right: 16px; transform: rotate(-90deg); }
          .hp-home-v65 .hp-gift-corner-bl { bottom: 16px; left: 16px; transform: rotate(90deg); }
          .hp-home-v65 .hp-gift-corner-br { bottom: 16px; right: 16px; }

          /* Tiny jewellery-like sparkles make each card feel hand-finished. */
          .hp-home-v65 .hp-gift-sparkle {
            position: absolute;
            z-index: 5;
            color: var(--gift-jewel);
            font-family: Georgia, serif;
            line-height: 1;
            text-shadow: 0 0 10px color-mix(in srgb, var(--gift-accent) 44%, transparent);
            opacity: .64;
            transition: transform .55s var(--hp-motion-ease), opacity .35s ease;
          }

          .hp-home-v65 .hp-gift-sparkle-a { top: 23px; right: 54px; font-size: 12px; }
          .hp-home-v65 .hp-gift-sparkle-b { bottom: 62px; left: 24px; font-size: 9px; }
          .hp-home-v65 .hp-gift-sparkle-c { bottom: 25px; right: 58px; font-size: 11px; }

          .hp-home-v65 .hp-bestseller-card:hover .hp-gift-sparkle-a { transform: translateY(-2px) rotate(16deg) scale(1.18); opacity: 1; }
          .hp-home-v65 .hp-bestseller-card:hover .hp-gift-sparkle-b { transform: translate(-1px,-2px) rotate(-12deg) scale(1.15); opacity: .9; }
          .hp-home-v65 .hp-bestseller-card:hover .hp-gift-sparkle-c { transform: translate(1px,-2px) rotate(12deg) scale(1.15); opacity: .9; }

          .hp-home-v65 .hp-gift-product-window {
            border-color: color-mix(in srgb, var(--gift-accent) 54%, transparent);
            box-shadow:
              0 16px 30px rgba(20,14,8,.12),
              0 0 0 4px color-mix(in srgb, var(--gift-paper-2) 76%, transparent),
              0 0 0 5px color-mix(in srgb, var(--gift-accent) 22%, transparent),
              inset 0 1px 0 rgba(255,255,255,.13);
          }

          .hp-home-v65 .hp-gift-product-window::before {
            content: "";
            position: absolute;
            inset: 8px;
            z-index: 2;
            border: 1px solid rgba(255,244,216,.26);
            border-radius: 10px;
            pointer-events: none;
            box-shadow: inset 0 0 0 1px rgba(0,0,0,.04);
          }

          .hp-home-v65 .hp-gift-product-window::after {
            z-index: 1;
            background:
              linear-gradient(to top, rgba(0,0,0,.32) 0%, rgba(0,0,0,.06) 30%, transparent 58%),
              linear-gradient(115deg, rgba(255,239,189,.12) 0%, transparent 28%, transparent 72%, rgba(255,255,255,.08) 100%);
          }

          .hp-home-v65 .hp-gift-image-charm {
            position: absolute;
            z-index: 3;
            right: 13px;
            bottom: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            min-height: 31px;
            padding: 0 10px 0 6px;
            border: 1px solid rgba(255,236,176,.44);
            border-radius: 999px;
            background: rgba(22,16,10,.54);
            color: #FFF4D6;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            box-shadow: 0 8px 20px rgba(0,0,0,.18);
            font-size: 8px;
            font-weight: 800;
            letter-spacing: .14em;
            text-transform: uppercase;
          }

          .hp-home-v65 .hp-gift-image-charm > span {
            display: grid;
            place-items: center;
            width: 19px;
            height: 19px;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 30%, #F7E3A0, #C38F2D 56%, #76500F 100%);
            color: #2B1A05;
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.42);
          }

          .hp-home-v65 .hp-bestseller-copy {
            position: relative;
            overflow: hidden;
            padding: 16px 10px 7px;
          }

          .hp-home-v65 .hp-bestseller-copy::before {
            content: "";
            position: absolute;
            inset: auto -18px -40px auto;
            width: 112px;
            height: 112px;
            border-radius: 50%;
            border: 1px solid color-mix(in srgb, var(--gift-accent) 15%, transparent);
            box-shadow:
              0 0 0 9px color-mix(in srgb, var(--gift-accent) 4%, transparent),
              0 0 0 22px color-mix(in srgb, var(--gift-accent) 3%, transparent);
            pointer-events: none;
          }

          .hp-home-v65 .hp-bestseller-copy-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 9px;
          }

          .hp-home-v65 .hp-bestseller-copy-head .hp-bestseller-line {
            margin: 0;
            flex: 0 0 48px;
          }

          .hp-home-v65 .hp-gift-mini-mark {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: var(--gift-muted);
            font-size: 8px;
            font-weight: 900;
            letter-spacing: .13em;
            text-transform: uppercase;
          }

          .hp-home-v65 .hp-gift-mini-mark::before {
            content: "";
            width: 16px;
            height: 1px;
            background: color-mix(in srgb, var(--gift-accent) 55%, transparent);
          }

          .hp-home-v65 .hp-bestseller-title {
            position: relative;
            z-index: 1;
            text-shadow: 0 1px 0 rgba(255,255,255,.04);
          }

          .hp-home-v65 .hp-bestseller-meta {
            position: relative;
            z-index: 1;
            padding-top: 11px;
            border-top: 1px solid color-mix(in srgb, var(--gift-accent) 18%, transparent);
          }

          .hp-home-v65 .hp-bestseller-arrow {
            position: relative;
            overflow: hidden;
            box-shadow:
              0 9px 18px rgba(19,13,8,.09),
              inset 0 0 0 4px color-mix(in srgb, var(--gift-accent) 5%, transparent);
          }

          .hp-home-v65 .hp-bestseller-arrow::after {
            content: "";
            position: absolute;
            inset: 5px;
            border-radius: 50%;
            border: 1px solid color-mix(in srgb, var(--gift-accent) 19%, transparent);
          }

          /* Individual cards keep their original palette, but get unique decorative personality. */
          .hp-home-v65 .hp-gift-variant-0 .hp-gift-corner,
          .hp-home-v65 .hp-gift-variant-3 .hp-gift-corner { opacity: .82; }

          .hp-home-v65 .hp-gift-variant-1 .hp-gift-image-charm,
          .hp-home-v65 .hp-gift-variant-4 .hp-gift-image-charm {
            background: rgba(5,12,9,.68);
            border-color: rgba(231,199,112,.46);
          }

          .hp-home-v65 .hp-gift-variant-2 .hp-gift-image-charm {
            background: rgba(74,31,23,.46);
          }

          .hp-home-v65 .hp-wrap-seal {
            width: 46px;
            height: 46px;
            border: 1px solid rgba(255,239,180,.64);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.34),
              inset 0 -5px 12px rgba(92,55,8,.20),
              0 10px 20px rgba(0,0,0,.20),
              0 0 0 4px rgba(212,175,55,.07);
          }

          .hp-home-v65 .hp-wrap-seal::after {
            content: "";
            position: absolute;
            inset: 6px;
            border-radius: 50%;
            border: 1px dashed rgba(255,241,191,.46);
          }

          @media (max-width: 1023px) {
            .hp-home-v65 .hp-gift-corner { width: 29px; height: 29px; }
            .hp-home-v65 .hp-gift-corner::before { width: 24px; }
            .hp-home-v65 .hp-gift-corner::after { height: 24px; }
            .hp-home-v65 .hp-gift-image-charm { right: 11px; bottom: 11px; }
            .hp-home-v65 .hp-gift-sparkle-b { display: none; }
          }

          @media (max-width: 639px) {
            .hp-home-v65 .hp-gift-wrap-layer {
              bottom: 147px;
              border-radius: 17px 17px 12px 12px;
            }

            .hp-home-v65 .hp-gift-corner-tl,
            .hp-home-v65 .hp-gift-corner-tr { top: 13px; }
            .hp-home-v65 .hp-gift-corner-bl,
            .hp-home-v65 .hp-gift-corner-br { bottom: 13px; }
            .hp-home-v65 .hp-gift-corner-tl,
            .hp-home-v65 .hp-gift-corner-bl { left: 13px; }
            .hp-home-v65 .hp-gift-corner-tr,
            .hp-home-v65 .hp-gift-corner-br { right: 13px; }
            .hp-home-v65 .hp-gift-image-charm {
              min-height: 28px;
              padding-right: 8px;
              font-size: 7px;
            }
            .hp-home-v65 .hp-gift-image-charm > span { width: 17px; height: 17px; font-size: 10px; }
            .hp-home-v65 .hp-gift-mini-mark { font-size: 7px; }
          }

          @media (hover:none), (pointer:coarse) {
            .hp-home-v65 .hp-bestseller-card:hover { transform: none; }
            .hp-home-v65 .hp-bestseller-card:hover .hp-gift-sparkle { transform: none; }
          }

          @media (prefers-reduced-motion: reduce) {
            .hp-home-v65 .hp-gift-sparkle,
            .hp-home-v65 .hp-wrap-bow { transition: none !important; }
          }

          .hp-home-v65 .hp-bestseller-title { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; overflow-wrap:anywhere; }
          .hp-quick-copy h2 { overflow-wrap:anywhere; }

        `}
      </style>

      <div ref={homeRef} className="hamporium-home">
        <div
          className={`hp-scroll-progress ${
            introFinished
              ? "is-visible"
              : ""
          }`}
          aria-hidden="true"
        >
          <span />
        </div>

        <HomeSectionNavigator
          activeSection={activeHomeSection}
          visible={introFinished}
        />

        <CinematicHero onIntroComplete={finishCinematicIntro} />

        <PromotionAnnouncement
          promotions={websitePromotions}
          visible={introFinished}
        />

        <PromotionHomeBanner
          promotions={websitePromotions}
          visible={introFinished}
        />

        {/* ==================================================
            CHOOSE YOUR GIFTING JOURNEY
        =================================================== */}

        <section data-home-section="journey" className="hp-pointer-glow relative overflow-hidden bg-[#080706] px-4 py-16 text-white sm:px-6 lg:px-0 lg:py-0">
          <div className="hp-journey-glow pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D4AF37]/10 blur-[125px]" />

          <div className="relative z-10 mx-auto max-w-[1800px] lg:max-w-none">
            <Reveal className="px-1 pb-9 sm:px-3 lg:px-14 lg:pb-12 lg:pt-14 xl:px-20">
              <div className="max-w-[1050px]">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#F47822]">
                  START HERE
                </p>

                <h2 className="hp-section-heading mt-5 text-[#FFF4DC]">
                  How Do You Want
                  <span className="hp-section-heading-accent text-[#D4AF37]">
                    To Gift Today?
                  </span>
                </h2>
              </div>
            </Reveal>

            <InteractiveRail id="home-journey-rail" label="Ways to gift" className="hp-journey-grid hp-snap-rail" controlsClass="hp-rail-controls-dark hp-rail-mobile-only">
              {[
                {
                  label: "01 · READY TO GIFT",
                  title: "Shop Signature Hampers",
                  copy:
                    "Ready-made premium hampers.",
                  image:
                    HOME_IMAGES.journeySignature1,
                  hoverImage:
                    HOME_IMAGES.journeySignature2,
                  to: "/gifts",
                  cta: "Shop Hampers",
                },
                {
                  label: "02 · MADE BY YOU",
                  title: "Build Your Own Hamper",
                  copy:
                    "Create it your way.",
                  image:
                    HOME_IMAGES.journeyBuild1,
                  hoverImage:
                    HOME_IMAGES.journeyBuild2,
                  to: "/custom-hamper",
                  cta: "Start Building",
                },
                {
                  label: "03 · SCALE IT UP",
                  title: "Bulk & Event Gifting",
                  copy:
                    "For teams, weddings and events.",
                  image:
                    HOME_IMAGES.journeyBulk1,
                  hoverImage:
                    HOME_IMAGES.journeyBulk2,
                  to: "/custom-hamper?mode=bulk",
                  cta: "Plan Bulk Gifting",
                },
              ].map(
                (
                  item,
                  index
                ) => (
                  <Link
                    key={
                      item.label
                    }
                    to={
                      item.to
                    }
                    className="group relative min-h-[590px] overflow-hidden lg:min-h-[690px]"
                  >
                    <SmartImage
                      src={
                        item.image
                      }
                      alt={
                        item.title
                      }
                      loading={
                        index === 0
                          ? "eager"
                          : "lazy"
                      }
                      fetchPriority={
                        index === 0
                          ? "high"
                          : "low"
                      }
                      className="hp-journey-base absolute inset-0 h-full w-full object-cover object-center"
                    />

                    <SmartImage
                      src={
                        item.hoverImage
                      }
                      alt=""
                      loading="lazy"
                      fetchPriority="low"
                      className="hp-journey-hover absolute inset-0 h-full w-full object-cover object-center"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/14 to-black/8" />

                    <div className="absolute inset-x-0 top-0 p-6 sm:p-8">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/78">
                        {
                          item.label
                        }
                      </p>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-10">
                      <span className="block h-px w-12 bg-[#D4AF37]" />

                      <h3
                        style={{
                          fontFamily:
                            DISPLAY_FONT,
                        }}
                        className="mt-5 max-w-[500px] text-[38px] font-semibold leading-[0.92] text-white sm:text-[46px] lg:text-[52px]"
                      >
                        {
                          item.title
                        }
                      </h3>

                      <p className="mt-4 max-w-[420px] text-[15px] font-medium leading-7 text-white/72">
                        {
                          item.copy
                        }
                      </p>

                      <div className="mt-7 flex items-center justify-between border-t border-white/15 pt-5">
                        <span className="text-[12px] font-black uppercase tracking-[0.11em] text-[#F1D574]">
                          {
                            item.cta
                          }
                        </span>

                        <span className="text-[26px] transition group-hover:translate-x-1 group-hover:text-[#F47822]">
                          →
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              )}
            </InteractiveRail>
          </div>
        </section>


        {/* ==================================================
            HAMPORIUM GIFT CONCIERGE · CINEMATIC CODED UI
            TEMPORARILY HIDDEN — change false to true to restore.
        =================================================== */}

        {false && (
        <section data-home-section="concierge" className={`hp-pointer-glow relative isolate overflow-hidden bg-[#090705] text-white ${giftRevealActive ? "is-gift-revealing" : ""}`}>
          {/* CLEAN BACKGROUND IMAGE ONLY */}
          <img
            src={giftConciergeBg}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable="false"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
          />

          <div className="pointer-events-none absolute inset-0 bg-black/28" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/46 via-black/12 to-black/62" />
          <div className="hp-concierge-screen-flare" aria-hidden="true" />

          <div className="hp-concierge-ambient pointer-events-none absolute left-1/2 top-[50%] h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F47822]/12 blur-[140px]" />

          <div className="relative z-10 mx-auto w-full max-w-[1900px] px-5 py-20 sm:px-8 lg:px-10 lg:py-24 xl:px-14 2xl:px-16">
            {/* HEADING */}
            <Reveal>
              <div className="mx-auto max-w-[980px] text-center">
                <div className="flex items-center justify-center gap-3">
                  <span className="h-px w-10 bg-[#D4AF37]" />

                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#F4D36A] sm:text-[11px]">
                    HAMPORIUM GIFT CONCIERGE
                  </p>

                  <span className="h-px w-10 bg-[#D4AF37]" />
                </div>

                <h2 className="hp-section-heading mt-5 text-white">
                  Tell Us The Moment.
                  <span className="hp-section-heading-accent text-[#D4AF37]">
                    We&apos;ll Handle The Gift.
                  </span>
                </h2>

                <p className="mx-auto mt-5 max-w-[690px] text-[14px] font-medium leading-7 text-white/68 sm:text-[15px]">
                  Pick the occasion, choose your budget, and we&apos;ll surface hampers that feel right for the moment.
                </p>
              </div>
            </Reveal>

            {/* =============================================
                DESKTOP · ARCH CARDS + CENTER GIFT BOX
            ============================================== */}

            <div className="mt-12 hidden items-end gap-4 lg:grid lg:grid-cols-[0.84fr_0.84fr_1.24fr_0.84fr_0.84fr] xl:gap-5">
              {GIFT_OCCASIONS.slice(
                0,
                2
              ).map(
                (
                  occasion,
                  index
                ) => {
                  const active =
                    occasion.id ===
                    giftOccasion;

                  return (
                    <button
                      key={
                        occasion.id
                      }
                      type="button"
                      onClick={() =>
                        setGiftOccasion(
                          occasion.id
                        )
                      }
                      aria-pressed={
                        active
                      }
                      className={`hp-concierge-card ${
                        active
                          ? "is-active"
                          : ""
                      } min-h-[455px] rounded-t-[999px] rounded-b-[28px] border border-[#D4AF37]/32 bg-black/30 text-left backdrop-blur-[2px] ${
                        index === 0
                          ? "translate-y-5"
                          : ""
                      }`}
                    >
                      <SmartImage
                        src={
                          occasion.image
                        }
                        alt={`${occasion.label} gifting`}
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/96 via-black/28 to-black/10" />

                      <div className="absolute left-1/2 top-5 z-10 -translate-x-1/2">
                        <span className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.13em] backdrop-blur-md ${
                          active
                            ? "border-[#F47822]/70 bg-[#F47822]/18 text-[#FFD57A]"
                            : "border-white/14 bg-black/18 text-white/42"
                        }`}>
                          {active
                            ? "Selected"
                            : String(index + 1).padStart(2, "0")}
                        </span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-center xl:p-6">
                        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/20 text-[18px] text-white backdrop-blur-sm">
                          {
                            occasion.icon
                          }
                        </span>

                        <h3
                          style={{
                            fontFamily:
                              DISPLAY_FONT,
                          }}
                          className="mt-4 text-[34px] font-semibold italic leading-none text-white xl:text-[39px]"
                        >
                          {
                            occasion.label
                          }
                        </h3>

                        <p className="mx-auto mt-3 max-w-[175px] text-[12px] font-medium leading-5 text-white/68">
                          {
                            occasion.shortCopy
                          }
                        </p>

                        <span
                          className={`mx-auto mt-5 flex h-9 w-9 items-center justify-center rounded-full border text-[17px] transition ${
                            active
                              ? "border-[#F47822] bg-[#F47822] text-white"
                              : "border-white/30 bg-black/20 text-white"
                          }`}
                        >
                          →
                        </span>
                      </div>
                    </button>
                  );
                }
              )}

              {/* CENTRAL GIFT BOX · PREMIUM CODED VERSION */}
              <div className="hp-concierge-gift-stage flex min-h-[520px] items-center justify-center">
                <div className="relative w-full max-w-[470px]">
                  <div className="pointer-events-none absolute left-1/2 top-[47%] h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D4AF37]/10 blur-[80px]" />

                  <div className={`hp-concierge-gift-box ${
                      giftRevealActive
                        ? "is-opening"
                        : ""
                    } relative mx-auto h-[338px] w-[90%] rounded-[20px] border border-[#D4AF37]/55 bg-gradient-to-br from-[#26221D] via-[#0B0A09] to-[#191613] shadow-[0_44px_110px_rgba(0,0,0,.62)]`}>
                    {/* subtle embossed texture */}
                    <div
                      className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.09]"
                      style={{
                        backgroundImage:
                          "radial-gradient(rgba(255,255,255,.7) .55px, transparent .55px)",
                        backgroundSize:
                          "6px 6px",
                      }}
                    />

                    {/* lid */}
                    <div className="hp-concierge-lid absolute -left-[4%] -top-[10%] h-[19%] w-[108%] rounded-[17px] border border-[#D4AF37]/45 bg-gradient-to-b from-[#302A22] via-[#1A1713] to-[#0F0E0C] shadow-[0_14px_30px_rgba(0,0,0,.42)]" />

                    {/* horizontal ribbon */}
                    <div className="absolute left-0 top-[16%] h-[17%] w-full bg-gradient-to-b from-[#F6E1A1] via-[#C29135] to-[#784D12] shadow-[inset_0_1px_0_rgba(255,255,255,.28)]" />

                    {/* vertical ribbon */}
                    <div className="absolute left-1/2 top-[-10%] h-[110%] w-[18%] -translate-x-1/2 bg-gradient-to-r from-[#6F4510] via-[#F0D47D] to-[#805514] shadow-[0_0_18px_rgba(212,175,55,.16)]" />

                    {/* ribbon highlight */}
                    <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[110%] w-[3%] -translate-x-1/2 bg-white/14 blur-[2px]" />

                    {/* coded bow */}
                    <div className="hp-concierge-bow absolute left-1/2 top-[-24%] z-20 h-[132px] w-[246px] -translate-x-1/2">
                      <span className="absolute left-[6%] top-[21%] h-[76px] w-[108px] -rotate-[28deg] rounded-[62%_40%_60%_40%] border border-[#F7E2A0]/65 bg-gradient-to-br from-[#F4DC90] via-[#C18B2D] to-[#72470F] shadow-[0_16px_30px_rgba(0,0,0,.28)]" />

                      <span className="absolute right-[6%] top-[21%] h-[76px] w-[108px] rotate-[28deg] rounded-[40%_62%_40%_60%] border border-[#F7E2A0]/65 bg-gradient-to-bl from-[#F4DC90] via-[#C18B2D] to-[#72470F] shadow-[0_16px_30px_rgba(0,0,0,.28)]" />

                      <span className="absolute left-1/2 top-[36%] h-[60px] w-[64px] -translate-x-1/2 rounded-full border border-[#F7E2A0]/75 bg-gradient-to-br from-[#F4D981] via-[#BD8427] to-[#744A11] shadow-[0_12px_22px_rgba(0,0,0,.3)]" />
                    </div>

                    <div
                      className="hp-concierge-reveal-glow"
                      aria-hidden="true"
                    />

                    {/* readable brand plaque */}
                    <div className="absolute left-1/2 top-[55%] z-10 w-[76%] -translate-x-1/2 rounded-[16px] border border-[#D4AF37]/42 bg-[#080706]/92 px-5 py-5 text-center shadow-[0_16px_34px_rgba(0,0,0,.42)] backdrop-blur-sm">
                      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/38 bg-[#D4AF37]/10 text-[13px] text-[#F4D36A]">
                        ✦
                      </div>

                      <p
                        style={{
                          fontFamily:
                            DISPLAY_FONT,
                          textShadow:
                            "0 2px 18px rgba(212,175,55,.22)",
                        }}
                        className="text-[31px] font-bold leading-none tracking-[0.07em] text-[#FFE8A3] xl:text-[34px]"
                      >
                        HAMPORIUM
                      </p>

                      <div className="mx-auto mt-3 h-px w-12 bg-[#D4AF37]/45" />

                      <p className="mt-2 text-[8px] font-black uppercase tracking-[0.24em] text-[#F5D778]">
                        More Than A Gift
                      </p>
                    </div>
                  </div>

                  <div className="mx-auto mt-2 h-5 w-[74%] rounded-[50%] bg-black/65 blur-md" />

                  {/* selected moment pill */}
                  <div className="mt-5 flex justify-center">
                    <div className="inline-flex items-center gap-3 rounded-full border border-[#D4AF37]/28 bg-black/24 px-4 py-2.5 backdrop-blur-md">
                      <span className="h-2 w-2 rounded-full bg-[#F47822] shadow-[0_0_14px_rgba(244,120,34,.65)]" />

                      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#F4D36A]">
                        Selected
                      </span>

                      <span
                        style={{
                          fontFamily:
                            DISPLAY_FONT,
                        }}
                        className="text-[22px] font-semibold italic leading-none text-white"
                      >
                        {
                          activeGiftOccasion.label
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {GIFT_OCCASIONS.slice(
                2
              ).map(
                (
                  occasion,
                  index
                ) => {
                  const active =
                    occasion.id ===
                    giftOccasion;

                  return (
                    <button
                      key={
                        occasion.id
                      }
                      type="button"
                      onClick={() =>
                        setGiftOccasion(
                          occasion.id
                        )
                      }
                      aria-pressed={
                        active
                      }
                      className={`hp-concierge-card ${
                        active
                          ? "is-active"
                          : ""
                      } min-h-[455px] rounded-t-[999px] rounded-b-[28px] border border-[#D4AF37]/32 bg-black/30 text-left backdrop-blur-[2px] ${
                        index === 1
                          ? "translate-y-5"
                          : ""
                      }`}
                    >
                      <SmartImage
                        src={
                          occasion.image
                        }
                        alt={`${occasion.label} gifting`}
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/96 via-black/28 to-black/10" />

                      <div className="absolute left-1/2 top-5 z-10 -translate-x-1/2">
                        <span className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.13em] backdrop-blur-md ${
                          active
                            ? "border-[#F47822]/70 bg-[#F47822]/18 text-[#FFD57A]"
                            : "border-white/14 bg-black/18 text-white/42"
                        }`}>
                          {active
                            ? "Selected"
                            : String(index + 3).padStart(2, "0")}
                        </span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-center xl:p-6">
                        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/20 text-[18px] text-white backdrop-blur-sm">
                          {
                            occasion.icon
                          }
                        </span>

                        <h3
                          style={{
                            fontFamily:
                              DISPLAY_FONT,
                          }}
                          className="mt-4 text-[34px] font-semibold italic leading-none text-white xl:text-[39px]"
                        >
                          {
                            occasion.label
                          }
                        </h3>

                        <p className="mx-auto mt-3 max-w-[175px] text-[12px] font-medium leading-5 text-white/68">
                          {
                            occasion.shortCopy
                          }
                        </p>

                        <span
                          className={`mx-auto mt-5 flex h-9 w-9 items-center justify-center rounded-full border text-[17px] transition ${
                            active
                              ? "border-[#F47822] bg-[#F47822] text-white"
                              : "border-white/30 bg-black/20 text-white"
                          }`}
                        >
                          →
                        </span>
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            {/* =============================================
                MOBILE / TABLET
            ============================================== */}

            <div className="mt-10 lg:hidden">
              <div className="mx-auto max-w-[420px] text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#F4D36A]">
                  Selected Moment
                </p>

                <p
                  style={{
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                  className="mt-2 text-[38px] font-semibold italic text-white"
                >
                  {
                    activeGiftOccasion.label
                  }
                </p>
              </div>

              <InteractiveRail id="home-occasions-rail" label="Gift occasions" className="hp-mobile-rail hp-snap-rail mt-6" controlsClass="hp-rail-controls-dark">
                {GIFT_OCCASIONS.map(
                  (
                    occasion
                  ) => {
                    const active =
                      occasion.id ===
                      giftOccasion;

                    return (
                      <button
                        key={
                          occasion.id
                        }
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setGiftOccasion(
                            occasion.id
                          )
                        }
                        className={`hp-concierge-card ${
                          active
                            ? "is-active"
                            : ""
                        } relative min-h-[410px] overflow-hidden rounded-t-[999px] rounded-b-[26px] border border-[#D4AF37]/30 bg-black/34`}
                      >
                        <SmartImage
                          src={
                            occasion.image
                          }
                          alt={
                            occasion.label
                          }
                          className="absolute inset-0 h-full w-full object-cover object-center"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/96 via-black/20 to-black/8" />

                        <div className="absolute inset-x-0 bottom-0 z-10 p-6 text-center">
                          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white">
                            {
                              occasion.icon
                            }
                          </span>

                          <h3
                            style={{
                              fontFamily:
                                DISPLAY_FONT,
                            }}
                            className="mt-4 text-[39px] font-semibold italic leading-none text-white"
                          >
                            {
                              occasion.label
                            }
                          </h3>

                          <p className="mx-auto mt-3 max-w-[210px] text-[13px] font-medium leading-6 text-white/66">
                            {
                              occasion.shortCopy
                            }
                          </p>
                        </div>
                      </button>
                    );
                  }
                )}
              </InteractiveRail>
            </div>

            {/* =============================================
                BUDGET CONTROL
            ============================================== */}

            <Reveal
              delay={120}
              className="relative z-20"
            >
              <div className="mx-auto mt-12 max-w-[1180px] rounded-[30px] border border-[#D4AF37]/28 bg-[#15110D]/90 p-5 shadow-[0_28px_78px_rgba(0,0,0,.38)] backdrop-blur-xl sm:p-6 lg:p-7">
                <p className="hp-concierge-selection" aria-live="polite" aria-atomic="true">
                  <span>Your selection</span> {activeGiftOccasion.label} <span aria-hidden="true"> / </span> {activeBudget.label}
                </p>
                <div className="grid gap-6 lg:grid-cols-[0.72fr_1.35fr_auto] lg:items-center">
                  <div>
                    <p
                      style={{
                        fontFamily:
                          DISPLAY_FONT,
                      }}
                      className="text-[29px] font-semibold leading-none text-white sm:text-[33px]"
                    >
                      Set Your Budget
                    </p>

                    <p className="mt-2 text-[12px] font-medium text-white/48">
                      Slide to set the range that feels right.
                    </p>
                  </div>

                  <div>
                    <div className="mb-4 flex justify-center">
                      <span className="rounded-full border border-white/10 bg-black/42 px-3 py-1.5 text-[11px] font-black text-[#F4D36A]">
                        {
                          activeBudget?.label
                        }
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={
                        GIFT_BUDGETS.length -
                        1
                      }
                      step="1"
                      value={
                        activeBudgetIndex
                      }
                      onChange={(
                        event
                      ) => {
                        const next =
                          GIFT_BUDGETS[
                            Number(
                              event
                                .target
                                .value
                            )
                          ];

                        if (next) {
                          setGiftBudget(
                            next.id
                          );
                        }
                      }}
                      aria-label="Gift budget"
                      aria-valuetext={activeBudget.label}
                      className="hp-concierge-range"
                      style={{
                        "--hp-range-progress": `${
                          (
                            activeBudgetIndex /
                            Math.max(
                              1,
                              GIFT_BUDGETS.length -
                                1
                            )
                          ) * 100
                        }%`,
                      }}
                    />

                    <div className="hp-budget-steps" role="group" aria-label="Budget ranges">
                      {GIFT_BUDGETS.map((budget) => (
                        <button key={budget.id} type="button" aria-pressed={giftBudget === budget.id}
                          className={giftBudget === budget.id ? "is-selected" : ""}
                          onClick={() => setGiftBudget(budget.id)}>{budget.label}</button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleFindGift
                    }
                    disabled={giftRevealActive}
                    aria-busy={giftRevealActive}
                    className="hp-concierge-cta inline-flex h-[58px] items-center justify-center gap-5 rounded-full border border-[#FFD980]/35 bg-gradient-to-r from-[#F3BE4E] via-[#F2A933] to-[#F47822] px-7 text-[11px] font-black uppercase tracking-[0.1em] text-[#17110A] shadow-[0_14px_32px_rgba(244,120,34,.22)]"
                  >
                    {giftRevealActive
                      ? "Revealing Your Matches"
                      : "Open My Matches"}

                    <span className="text-[18px]">
                      →
                    </span>
                  </button>
                </div>
              </div>
            </Reveal>

          </div>
        </section>
        )}

        {/* ==================================================
            BEST SELLERS · EDITORIAL RUNWAY
        =================================================== */}

        <section data-home-section="bestsellers" className="relative overflow-hidden bg-[#F7F4EF] px-0 py-20 sm:px-6 lg:px-8 lg:py-24 xl:px-10 2xl:px-12">
          <div className="mx-auto w-full max-w-[1900px]">
            <Reveal className="px-4 sm:px-0">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#F47822]">
                    CURATED BESTSELLERS
                  </p>

                  <h2 className="hp-section-heading mt-5 text-[#171717]">
                    The Hampers Everyone
                    <span className="hp-section-heading-accent text-[#9B741D]">
                      Keeps Coming Back For.
                    </span>
                  </h2>
                </div>

                <Link
                  to="/gifts"
                  className="group mb-1 inline-flex h-[58px] w-fit items-center gap-5 border border-black/10 bg-white px-6 text-[12px] font-black uppercase tracking-[0.09em] text-[#171717] transition duration-300 hover:border-[#F47822] hover:bg-[#F47822] hover:text-white"
                >
                  Explore All Hampers
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171717] text-white transition duration-300 group-hover:translate-x-1 group-hover:bg-white group-hover:text-[#F47822]">
                    →
                  </span>
                </Link>
              </div>
            </Reveal>

            <BestsellerCollection
              products={lovedProducts}
              promotions={websitePromotions}
              loading={loading}
              error={catalogueError}
              onRetry={() => setCatalogueAttempt((attempt) => attempt + 1)}
            />
          </div>
        </section>

        {/* ==================================================
            HAMPER ONE · LUXURY EDITORIAL
        =================================================== */}

        <section data-home-section="hamper-one" className="hp-pointer-glow relative overflow-hidden bg-[#060606] text-white">
          <div className="pointer-events-none absolute left-[10%] top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-[#D4AF37]/[0.06] blur-[120px]" />

          <div className="mx-auto grid min-h-[760px] w-full max-w-[1920px] lg:grid-cols-[0.72fr_1.28fr]">
            {/* COPY */}
            <Reveal className="relative z-10 flex flex-col justify-center px-5 py-16 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20">
              <div className="flex items-center gap-4">
                <span className="h-px w-14 bg-[#D4AF37]" />

                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#D4AF37]">
                  Private Collection
                </p>
              </div>

              <h2 className="hp-section-heading mt-8 text-[#FFF4D8]">
                HAMPER
                <span className="hp-section-heading-accent text-[#D4AF37]">
                  ONE
                </span>
              </h2>

              <p
                style={{ fontFamily: DISPLAY_FONT }}
                className="mt-8 max-w-[610px] text-[29px] font-semibold leading-[1.02] text-white sm:text-[34px] lg:text-[38px]"
              >
                For moments that deserve
                <span className="block italic text-[#F0D06B]">
                  something unforgettable.
                </span>
              </p>

              <p className="mt-6 max-w-[520px] text-[15px] font-medium leading-7 text-white/58 sm:text-[16px]">
                Our most elevated ready-to-gift hamper, curated for unforgettable occasions.
              </p>

              <Link
                to="/hamper-one"
                className="group mt-9 inline-flex h-[58px] w-fit items-center gap-6 bg-[#D4AF37] px-7 text-[12px] font-black uppercase tracking-[0.1em] text-[#111] transition duration-300 hover:bg-[#E8CD6E]"
              >
                Enter Hamper One

                <span className="transition duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </Reveal>

            {/* PREMIUM HAMPER VISUAL */}
            <Reveal
              delay={100}
              className="hp-hamper-one-visual relative min-h-[560px] overflow-hidden sm:min-h-[640px] lg:min-h-[760px]"
            >
              <img
                src={hamperOneLuxury}
                alt="HAMPER ONE luxury premium gift hamper"
                loading="lazy"
                decoding="async"
                className="hp-hamper-one-image absolute inset-0 h-full w-full object-cover object-center"
                draggable="false"
              />

              <div
                className="hp-hamper-one-curtain-line"
                aria-hidden="true"
              />

              <div className="absolute inset-0 bg-gradient-to-r from-[#060606]/36 via-transparent to-transparent lg:from-[#060606]/24" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-black/10" />

              <div className="absolute left-5 top-5 z-10 border border-white/15 bg-black/25 px-4 py-3 backdrop-blur-md sm:left-8 sm:top-8">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/72">
                  HAMPORIUM · PRIVATE SERIES
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ==================================================
            HAMPORIUM BRAND STORY · FULL-SCREEN SCROLL PAGES
        =================================================== */}

        <section data-home-section="brand" className="hp-story-stack hp-pointer-glow relative bg-[#090807] text-white">
          {[
            {
              kicker: "CURATED WITH INTENTION",
              titleLines: ["Every", "Product"],
              accentLines: ["Earns Its", "Place."],
              image: HOME_IMAGES.storyCurated,
              align: "left",
              objectPosition: "center 48%",
            },
            {
              kicker: "DETAILS MAKE IT PERSONAL",
              titleLines: ["Thoughtful", "Details"],
              accentLines: ["Change The", "Feeling."],
              image: HOME_IMAGES.storyPersonal,
              align: "left",
              objectPosition: "center 50%",
            },
            {
              kicker: "PRESENTATION MATTERS",
              titleLines: ["The", "Unboxing"],
              accentLines: ["Is Part Of", "The Gift."],
              image: HOME_IMAGES.storyUnboxing,
              align: "left",
              objectPosition: "center 48%",
            },
          ].map((item, index) => (
            <div
              key={item.kicker}
              className="hp-story-page group relative"
            >
              <div className="hp-story-sheet">
                <SmartImage
                  src={item.image}
                  alt={`${item.titleLines.join(" ")} ${item.accentLines.join(" ")}`}
                  loading="eager"
                  fetchPriority={index === 0 ? "high" : "auto"}
                  decoding="async"
                  style={{
                    objectPosition:
                      item.objectPosition,
                  }}
                  className="hp-story-image absolute inset-0 h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-transparent to-black/3" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/42 via-black/5 to-transparent" />

                <div
                  className={`absolute inset-x-0 bottom-0 z-10 p-6 pb-12 sm:p-10 sm:pb-16 lg:p-14 lg:pb-20 xl:p-20 xl:pb-24 2xl:p-24 2xl:pb-28 ${
                    item.align === "right"
                      ? "lg:flex lg:justify-end"
                      : ""
                  }`}
                >
                  <div
                    className={`w-full max-w-[1200px] ${
                      item.align === "right"
                        ? "lg:ml-auto lg:text-right"
                        : ""
                    }`}
                  >
                    <div
                      className={`mb-5 flex items-center gap-3 ${
                        item.align === "right"
                          ? "lg:justify-end"
                          : ""
                      }`}
                    >
                      <span className="h-[2px] w-14 bg-[#F47822] sm:w-16" />
                      <p className="hp-story-kicker text-[11px] font-black uppercase tracking-[0.28em] text-[#FFD25A] sm:text-[12px] lg:text-[13px]"
                        style={{ "--hp-story-delay": "40ms" }}>
                        {item.kicker}
                      </p>
                    </div>

                    <h2 className="hp-section-heading max-w-[1200px] text-white drop-shadow-[0_12px_42px_rgba(0,0,0,.68)]">
                      <span className="block">
                        {item.titleLines.map(
                          (line, lineIndex) => (
                            <span
                              key={line}
                              className="hp-story-line block"
                              style={{
                                "--hp-story-delay": `${
                                  120 + lineIndex * 95
                                }ms`,
                              }}
                            >
                              {line}
                            </span>
                          )
                        )}
                      </span>

                      <span className="hp-section-heading-accent mt-5 text-[#F4D36A] drop-shadow-[0_10px_34px_rgba(0,0,0,.58)] sm:mt-6 lg:mt-7">
                        {item.accentLines.map(
                          (line, lineIndex) => (
                            <span
                              key={line}
                              className="hp-story-line block"
                              style={{
                                "--hp-story-delay": `${
                                  330 + lineIndex * 105
                                }ms`,
                              }}
                            >
                              {line}
                            </span>
                          )
                        )}
                      </span>
                    </h2>
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-7 right-6 z-10 hidden items-center gap-3 text-[8px] font-black uppercase tracking-[0.18em] text-white/35 lg:flex">
                  <span>
                    {String(index + 1).padStart(2, "0")} / 03
                  </span>
                  <span className="h-px w-10 bg-[#D4AF37]/50" />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ==================================================
            WHY CHOOSE HAMPORIUM
        =================================================== */}

        <section className="relative w-full bg-[#F8F4EE]">
          <div className="relative w-full overflow-hidden bg-[#0B0B0B] px-0 py-10 text-white sm:py-12 lg:grid lg:grid-cols-[0.92fr_1.12fr] lg:items-stretch lg:gap-12 lg:py-14 xl:gap-16">
            <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 13% 8%, rgba(244,120,34,.16), transparent 22%), radial-gradient(circle at 88% 84%, rgba(212,175,55,.14), transparent 25%)" }} />
            <div className="hp-noise pointer-events-none absolute inset-0 opacity-[0.07]" />

            <Reveal className="relative z-10 flex flex-col justify-center px-5 py-4 sm:px-8 lg:px-10 lg:py-8">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.08] px-4 py-2 text-[11px] font-black uppercase tracking-[0.17em] text-[#E5C45E]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F47822]" />
                WHY HAMPORIUM
              </div>

              <h2 className="hp-section-heading mt-5 text-[#FFF8EC]">
                We Don&apos;t Just Pack Gifts.
                <span className="hp-section-heading-accent text-[#D4AF37]">
                  We Frame Moments.
                </span>
              </h2>

              <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <PromiseCard
                  icon={<GiftIcon />}
                  title="Premium Curation"
                />
                <PromiseCard
                  icon={<HeartIcon />}
                  title="Personal Touch"
                />
                <PromiseCard
                  icon={<ShieldIcon />}
                  title="Gift-Ready"
                />
                <PromiseCard
                  icon={<BulkIcon />}
                  title="Bulk Ready"
                />
              </div>
            </Reveal>

            <Reveal delay={140} className="relative z-10 mt-8 min-h-[460px] lg:mt-0 lg:min-h-[610px]">
              <div className="hp-image-zoom absolute inset-0 overflow-hidden bg-[#181818]">
                <SmartImage
                  src={HOME_IMAGES.why}
                  alt="Luxury gift hamper"
                  className="h-full w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/10" />
              </div>

            </Reveal>
          </div>
        </section>

        {/* ==================================================
            BULK / EVENT GIFTING · EDITORIAL FLOW
        =================================================== */}

        <section data-home-section="bulk" className="relative overflow-hidden bg-[#F3EEE6] text-[#171717]">
          <div className="grid min-h-[850px] lg:grid-cols-[0.92fr_1.08fr]">
            {/* LEFT VISUAL */}
            <Reveal className="relative min-h-[560px] overflow-hidden bg-[#15100C] lg:min-h-[850px]">
              <SmartImage
                src={HOME_IMAGES.corporate}
                alt="Corporate and event gifting"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/12 to-black/22" />

              <div className="absolute bottom-8 left-7 right-7 sm:bottom-11 sm:left-10 sm:right-10">
                <p
                  style={{ fontFamily: DISPLAY_FONT }}
                  className="max-w-[620px] text-[46px] font-semibold leading-[0.9] tracking-[-0.04em] text-white sm:text-[56px] lg:text-[64px]"
                >
                  Big moments.
                  <span className="block italic text-[#F1D77B]">
                    One beautiful gifting system.
                  </span>
                </p>

              </div>
            </Reveal>

            {/* RIGHT FLOW */}
            <div className="relative flex flex-col justify-center px-5 py-14 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20">
              <div className="pointer-events-none absolute right-[-90px] top-[8%] h-[320px] w-[320px] rounded-full bg-[#D4AF37]/10 blur-[100px]" />

              <Reveal>
                <div className="flex items-center gap-3">
                  <span className="h-px w-12 bg-[#F47822]" />
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#F47822]">
                    HOW BULK GIFTING WORKS
                  </p>
                </div>

                <h2 className="hp-section-heading mt-5 text-[#171717]">
                  Build First.
                  <span className="hp-section-heading-accent text-[#9A7414]">
                    Quote Next.
                  </span>
                </h2>

                <p className="mt-5 max-w-[650px] text-[15px] font-medium leading-7 text-black/56">
                  Create one design, choose the quantity, review your quote and pay only after approval.
                </p>
              </Reveal>

              <InteractiveRail id="home-bulk-rail" label="Bulk gifting steps" className="hp-mobile-rail hp-snap-rail mt-10 border-y border-black/10 lg:grid lg:grid-cols-2 lg:gap-0" controlsClass="hp-rail-mobile-only">
                {[
                  ["01", "Build One Design", "Choose the box, products, décor and personalisation.", HOME_IMAGES.festival],
                  ["02", "Choose Bulk Qty", "Set quantities for teams, weddings and large events.", HOME_IMAGES.wedding],
                  ["03", "Receive Quotation", "Review the final price or request changes before approval.", HOME_IMAGES.curated],
                  ["04", "Pay After Approval", "Production starts only after the accepted quote is paid.", HOME_IMAGES.custom],
                ].map(([step, title, copy, image], index) => (
                  <div
                    key={step}
                    className={`hp-bulk-step-card group relative min-h-[280px] overflow-hidden p-6 lg:min-h-[245px] ${
                      index % 2 === 0 ? "lg:border-r lg:border-black/10" : ""
                    } ${
                      index < 2 ? "lg:border-b lg:border-black/10" : ""
                    }`}
                  >
                    <div className="hp-bulk-step-image absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
                      <SmartImage
                        src={image}
                        alt=""
                        className="h-full w-full object-cover object-center"
                      />
                      <div className="absolute inset-0 bg-[#171717]/86" />
                    </div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <span className="hp-bulk-step-kicker text-[9px] font-black uppercase tracking-[0.18em] text-[#F47822] group-hover:text-[#F2D26B]">
                          STEP {step}
                        </span>
                        <span className="hp-bulk-step-arrow text-[22px] text-black/16 transition group-hover:text-white/55">→</span>
                      </div>

                      <h3
                        style={{ fontFamily: DISPLAY_FONT }}
                        className="hp-bulk-step-title mt-10 text-[30px] font-semibold leading-[0.95] text-[#171717] transition group-hover:text-white"
                      >
                        {title}
                      </h3>

                      <p className="hp-bulk-step-copy mt-3 max-w-[270px] text-[13px] font-medium leading-6 text-black/50 transition group-hover:text-white/65">
                        {copy}
                      </p>
                    </div>
                  </div>
                ))}
              </InteractiveRail>

              <Reveal delay={160} className="mt-8 flex flex-wrap items-center gap-5">
                <Link
                  to="/custom-hamper?mode=bulk"
                  className="inline-flex h-[56px] items-center gap-5 bg-[#F47822] px-7 text-[12px] font-black uppercase tracking-[0.09em] text-white shadow-[0_18px_40px_rgba(244,120,34,.22)] transition hover:bg-[#DF6518]"
                >
                  Build & Request Quote
                  <span className="text-lg">→</span>
                </Link>

              </Reveal>
            </div>
          </div>
        </section>

        {/* ==================================================
            FINAL FULL-SCREEN CTA
        =================================================== */}

        <section data-home-section="finale" className="hp-final-parallax-zone hp-pointer-glow relative flex min-h-[82svh] items-center overflow-hidden bg-black text-white">
          <SmartImage
            src={
              HOME_IMAGES.finalCta
            }
            alt="HAMPORIUM final gifting moment"
            className="hp-final-drift absolute inset-0 h-full w-full object-cover object-center opacity-[0.62]"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/58 to-black/24" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-transparent to-black/28" />

          <Reveal className="relative z-10 w-full px-5 py-20 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20">
            <div className="max-w-[1050px]">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#F47822]">
                HAMPORIUM
              </p>

              <h2 className="hp-section-heading mt-5 text-white">
                A Gift Should Never
                <span className="hp-section-heading-accent text-[#D4AF37]">
                  Feel Ordinary.
                </span>
              </h2>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/gifts"
                  className="inline-flex h-[58px] items-center gap-5 bg-white px-7 text-[12px] font-black uppercase tracking-[0.09em] text-[#171717] transition hover:bg-[#F47822] hover:text-white"
                >
                  Shop Hampers
                  <span className="text-lg">
                    →
                  </span>
                </Link>

                <Link
                  to="/custom-hamper"
                  className="inline-flex h-[58px] items-center gap-5 border border-white/28 bg-black/20 px-7 text-[12px] font-black uppercase tracking-[0.09em] text-white backdrop-blur-sm transition hover:border-[#D4AF37] hover:text-[#D4AF37]"
                >
                  Build Yours
                  <span className="text-lg">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

      </div>
    </main>
  );
};

// ======================================================
// HOME SECTION NAVIGATOR
// ======================================================

const HomeSectionNavigator = ({
  activeSection,
  visible,
}) => {
  const handleNavigate = (id) => {
    const node =
      document.querySelector(
        `[data-home-section="${id}"]`
      );

    if (!node) {
      return;
    }

    const reducedMotion =
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    node.scrollIntoView({
      behavior: reducedMotion
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  return (
    <nav
      className={`hp-section-navigator hidden xl:flex ${
        visible
          ? "is-visible"
          : ""
      }`}
      aria-label="Homepage sections"
    >
      {HOME_SECTION_NAV.map(
        (item, index) => {
          const active =
            item.id ===
            activeSection;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                handleNavigate(
                  item.id
                )
              }
              aria-label={`Go to ${item.label}`}
              aria-current={
                active
                  ? "true"
                  : undefined
              }
              className={`hp-section-nav-button ${
                active
                  ? "is-active"
                  : ""
              }`}
            >
              <span className="hp-section-nav-label text-[9px] font-black uppercase tracking-[0.13em]">
                {item.label}
              </span>

              <span className="hp-section-nav-index">
                {String(
                  index + 1
                ).padStart(
                  2,
                  "0"
                )}
              </span>

              <span
                className="hp-section-nav-dot"
                aria-hidden="true"
              />
            </button>
          );
        }
      )}
    </nav>
  );
};

// ======================================================
// SCROLL REVEAL
// ======================================================

const Reveal = ({ children, className = "", delay = 0 }) => {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let animation;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(node);
      // Animate only after intersection. Base CSS always remains visible.
      // Never animate a focused control, and never gate content on image load.
      if (node.contains(document.activeElement)) return;
      animation = node.animate?.([
        { opacity: 0.18, transform: "translate3d(0,18px,0)" },
        { opacity: 1, transform: "translate3d(0,0,0)" },
      ], { duration: 660, delay: Math.min(delay, 140), easing: "cubic-bezier(.22,1,.36,1)" });
    }, { threshold: 0.01, rootMargin: "0px 0px 70px 0px" });
    const revealFocused = () => animation?.cancel();
    node.addEventListener("focusin", revealFocused);
    observer.observe(node);
    return () => { observer.disconnect(); animation?.cancel(); node.removeEventListener("focusin", revealFocused); };
  }, [delay]);
  return <div ref={ref} className={`hp-reveal is-visible ${className}`}>{children}</div>;
};

const SmartImage = ({ src, alt = "", className = "", loading = "lazy", fetchPriority,
  decoding = "async", style, draggable = false, fallback = HOME_IMAGES.universalFallback }) => {
  const ref = useRef(null);
  const [failedSource, setFailedSource] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const imageSrc = !src || failedSource === src ? fallback : src;
  useEffect(() => {
    setUnavailable(false);
    if (ref.current) ref.current.dataset.loaded = ref.current.complete && ref.current.naturalWidth > 0 ? "true" : "false";
  }, [imageSrc]);
  if (unavailable) return (
    <span role={alt ? "img" : undefined} aria-label={alt ? `${alt} - image unavailable` : undefined}
      aria-hidden={alt ? undefined : true} className={`hp-image-fallback ${className}`} style={style}>
      <span aria-hidden="true"><GiftIcon /></span>
    </span>
  );
  return <img ref={ref} src={imageSrc} alt={alt} loading={loading} fetchPriority={fetchPriority}
    decoding={decoding} className={className} style={style} draggable={draggable}
    onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
    onError={() => { if (imageSrc !== fallback) setFailedSource(src); else setUnavailable(true); }} />;
};

// ======================================================
// HAMPORIUM PROMISE
// ======================================================

const PromiseCard = ({
  icon,
  title,
}) => (
  <div className="group min-h-[112px]">
    <div className="flex items-center gap-3 text-[#F47822]">
      <span className="transition duration-300 group-hover:scale-110">
        {icon}
      </span>

      <span className="h-px flex-1 bg-white/10" />
    </div>

    <p
      style={{ fontFamily: DISPLAY_FONT }}
      className="mt-4 text-[24px] font-semibold leading-[0.95] text-[#F8EBC8] sm:text-[27px]"
    >
      {title}
    </p>
  </div>
);

// ======================================================
// PRODUCT CARD
// ======================================================

const LovedProductCard = ({ product, index = 0, onPreview, promotion }) => {
  const destination = product.slug ? `/products/${product.slug}` : "/gifts";
  return (
    <article className={`hp-bestseller-card hp-gift-variant-${index % 5} group`}>
      <PromotionProductBadge promotion={promotion} />

      <div className="hp-gift-wrap-layer" aria-hidden="true">
        <span className="hp-wrap-ribbon hp-wrap-ribbon-v" />
        <span className="hp-wrap-ribbon hp-wrap-ribbon-h" />
        <span className="hp-wrap-ribbon hp-wrap-ribbon-diagonal" />

        <span className="hp-wrap-bow">
          <span className="hp-wrap-bow-loop hp-wrap-bow-loop-left" />
          <span className="hp-wrap-bow-loop hp-wrap-bow-loop-right" />
          <span className="hp-wrap-bow-knot" />
          <span className="hp-wrap-bow-tail hp-wrap-bow-tail-left" />
          <span className="hp-wrap-bow-tail hp-wrap-bow-tail-right" />
        </span>

        <span className="hp-wrap-seal">H</span>

        <span className="hp-gift-corner hp-gift-corner-tl" />
        <span className="hp-gift-corner hp-gift-corner-tr" />
        <span className="hp-gift-corner hp-gift-corner-bl" />
        <span className="hp-gift-corner hp-gift-corner-br" />

        <span className="hp-gift-sparkle hp-gift-sparkle-a">✦</span>
        <span className="hp-gift-sparkle hp-gift-sparkle-b">◆</span>
        <span className="hp-gift-sparkle hp-gift-sparkle-c">✦</span>
      </div>

      <Link to={destination} className="hp-gift-package" aria-label={`View ${product.name}`}>
        <div className="hp-gift-product-window">
          <SmartImage
            src={product.image}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />

          <span className="hp-gift-image-charm" aria-hidden="true">
            <span>H</span>
            Signature
          </span>
        </div>

        <div className="hp-bestseller-copy">
          <div className="hp-bestseller-copy-head" aria-hidden="true">
            <span className="hp-bestseller-line" />
            <span className="hp-gift-mini-mark">Curated gift</span>
          </div>

          <h3 className="hp-bestseller-title">{product.name}</h3>

          <div className="hp-bestseller-meta">
            <div>
              <p className="hp-bestseller-price-label">
                {product.editorial ? "Explore this style" : "Starting at"}
              </p>
              <p className="hp-bestseller-price">
                {product.price !== null
                  ? formatHomePrice(product.price)
                  : product.editorial
                    ? "View collection"
                    : "View options"}
              </p>
            </div>

            <span className="hp-bestseller-arrow" aria-hidden="true">
              &#8594;
            </span>
          </div>
        </div>
      </Link>

      {!product.editorial && (
        <button
          type="button"
          className="hp-quick-look"
          aria-label={`Preview ${product.name}`}
          onClick={onPreview}
        >
          <HomeControlIcon type="eye" />
          <span>Quick look</span>
        </button>
      )}
    </article>
  );
};

// ======================================================
// PRODUCT SKELETON
// ======================================================

const ProductSkeleton = () => (
  <div className="min-h-[350px] animate-pulse rounded-[26px] border border-black/[0.06] bg-black/[0.06] lg:min-h-[415px]" />
);

// ======================================================
// BULK FEATURE
// ======================================================

const CorporateFeature = ({
  step,
  icon,
  title,
  subtitle,
}) => (
  <div className="group relative min-h-[190px] pt-5">
    <div className="absolute left-0 right-0 top-0 h-px bg-white/10">
      <span className="hp-frameless-line block h-full w-12 bg-[#D4AF37]/80" />
    </div>

    <div className="flex items-center justify-between gap-3">
      <span className="text-[#D4AF37] transition duration-300 group-hover:scale-110 group-hover:text-[#F47822]">
        {icon}
      </span>

      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">
        STEP {step}
      </span>
    </div>

    <div className="pt-10">
      <p style={{ fontFamily: DISPLAY_FONT }} className="text-[27px] font-semibold leading-tight text-white">
        {title}
      </p>

      <p className="mt-3 max-w-[270px] text-[11px] font-medium leading-5 text-white/42">
        {subtitle}
      </p>
    </div>
  </div>
);

// ======================================================
// ICON BASE
// ======================================================

const IconBase = ({
  children,
  size = "h-8 w-8",
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.55"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={size}
  >
    {children}
  </svg>
);

// ======================================================
// ICONS
// ======================================================

const GiftIcon = () => (
  <IconBase size="h-6 w-6">
    <path d="M4 10h16v10H4V10Z" />
    <path d="M3 7h18v4H3V7ZM12 7v13" />
    <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" />
  </IconBase>
);

const ShieldIcon = () => (
  <IconBase>
    <path d="M12 3 20 6v6c0 4.6-2.8 7.7-8 9-5.2-1.3-8-4.4-8-9V6l8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </IconBase>
);

const PeopleIcon = () => (
  <IconBase>
    <circle cx="9" cy="8" r="3" />
    <circle cx="16.5" cy="9" r="2.2" />
    <path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6" />
    <path d="M14 14c3.4.1 5.4 1.8 6 5" />
  </IconBase>
);

const HeartIcon = () => (
  <IconBase>
    <path d="M20 8.5c0 5-8 10.5-8 10.5S4 13.5 4 8.5A4.5 4.5 0 0 1 12 5a4.5 4.5 0 0 1 8 3.5Z" />
  </IconBase>
);

const ClientIcon = () => (
  <IconBase>
    <path d="M5 7h14v12H5V7Z" />
    <path d="M9 7V5h6v2" />
    <path d="M9 12h6M9 15h4" />
  </IconBase>
);

const SatisfactionIcon = () => (
  <IconBase>
    <path d="M12 3 20 6v6c0 4.6-2.8 7.7-8 9-5.2-1.3-8-4.4-8-9V6l8-3Z" />
    <circle cx="12" cy="12" r="2.5" />
  </IconBase>
);

const BulkIcon = () => (
  <IconBase>
    <path d="M5 5h6v6H5V5ZM13 5h6v6h-6V5ZM5 13h6v6H5v-6ZM13 13h6v6h-6v-6Z" />
  </IconBase>
);

// ======================================================
// SIGNATURE MOTION: LOCAL HELPERS (no animation dependency)
// ======================================================
const formatHomePrice = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(Number(value));

const useMediaPreference = (query) => {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);
  return matches;
};

const useHomeEnhancements = (homeRef, reducedMotion, setActiveSection) => {
  useEffect(() => {
    const root = homeRef.current;
    if (!root) return undefined;
    const sections = Array.from(root.querySelectorAll("[data-home-section]"));
    const stories = Array.from(root.querySelectorAll(".hp-story-page"));
    let frame = 0;
    let pointerFrame = 0;
    let lastPointerNode = null;
    let pointer = null;
    let pageTravel = 1;
    let heroTravel = 1;
    const paint = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const p = Math.max(0, Math.min(1, y / heroTravel));
      root.style.setProperty("--hp-scroll-progress", Math.min(1, y / pageTravel).toFixed(4));
      root.style.setProperty("--hp-hero-scale", reducedMotion ? "1" : (1 + p * 0.025).toFixed(4));
      root.style.setProperty("--hp-hero-dim", (p * 0.18).toFixed(4));
      root.style.setProperty("--hp-hero-line-scale", p.toFixed(4));
    };
    const schedule = () => { if (!frame && !document.hidden) frame = window.requestAnimationFrame(paint); };
    const measure = () => {
      pageTravel = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      heroTravel = Math.max(1, (root.querySelector(".hp-hero-stage")?.offsetHeight || window.innerHeight) * 0.85);
      schedule();
    };
    const visibility = () => { root.dataset.pageHidden = String(document.hidden); if (!document.hidden) measure(); };
    const resize = window.ResizeObserver ? new ResizeObserver(measure) : null;
    resize?.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    measure(); visibility();

    const inBand = new Map();
    const navigationObserver = window.IntersectionObserver ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => inBand.set(entry.target, entry.isIntersecting));
      const active = sections.filter((section) => inBand.get(section)).at(-1);
      if (active) setActiveSection(active.dataset.homeSection);
    }, { rootMargin: "-22% 0px -54% 0px", threshold: [0, 0.01, 0.2] }) : null;
    sections.forEach((section) => navigationObserver?.observe(section));
    const ambientObserver = window.IntersectionObserver ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const isStory = entry.target.classList.contains("hp-story-page");

        // Sticky story pages stay compositor-stable. Do not repeatedly toggle
        // hp-offscreen on them while they overlap during the diagonal hand-off.
        if (!isStory) {
          entry.target.classList.toggle("hp-offscreen", !entry.isIntersecting);
        }

        if (entry.isIntersecting && isStory) {
          entry.target.classList.add("is-story-visible");
        }
      });
    }, { rootMargin: "220px 0px", threshold: 0 }) : null;
    [...sections, ...stories].forEach((node) => ambientObserver?.observe(node));
    if (!ambientObserver || reducedMotion) stories.forEach((node) => node.classList.add("is-story-visible"));

    const paintPointer = () => {
      pointerFrame = 0;
      if (!pointer || !lastPointerNode) return;
      const rect = lastPointerNode.getBoundingClientRect();
      lastPointerNode.style.setProperty("--hp-pointer-x", `${pointer.x - rect.left}px`);
      lastPointerNode.style.setProperty("--hp-pointer-y", `${pointer.y - rect.top}px`);
      lastPointerNode.style.setProperty("--hp-pointer-opacity", "0.65");
      if (lastPointerNode.classList.contains("hp-final-parallax-zone")) {
        lastPointerNode.style.setProperty("--hp-final-x", `${((pointer.x - rect.left) / rect.width - 0.5) * 6}px`);
        lastPointerNode.style.setProperty("--hp-final-y", `${((pointer.y - rect.top) / rect.height - 0.5) * 4}px`);
      }
    };
    const clearPointer = () => {
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      lastPointerNode?.style.setProperty("--hp-pointer-opacity", "0");
      lastPointerNode?.style.setProperty("--hp-final-x", "0px");
      lastPointerNode?.style.setProperty("--hp-final-y", "0px");
      lastPointerNode = null;
    };
    const onPointer = (event) => {
      if (event.pointerType !== "mouse") return;
      const node = event.target.closest(".hp-pointer-glow");
      if (lastPointerNode !== node) { clearPointer(); lastPointerNode = node; }
      if (!node) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!pointerFrame) pointerFrame = requestAnimationFrame(paintPointer);
    };
    if (!reducedMotion && window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
      root.addEventListener("pointermove", onPointer, { passive: true });
      root.addEventListener("pointerleave", clearPointer);
    }
    return () => {
      resize?.disconnect(); navigationObserver?.disconnect(); ambientObserver?.disconnect();
      window.cancelAnimationFrame(frame); clearPointer();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", visibility);
      root.removeEventListener("pointermove", onPointer); root.removeEventListener("pointerleave", clearPointer);
      [...sections, ...stories].forEach((node) => node.classList.remove("hp-offscreen"));
    };
  }, [homeRef, reducedMotion, setActiveSection]);
};

const CinematicHero = ({ onIntroComplete }) => {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const completeRef = useRef(false);
  const manualPauseRef = useRef(false);
  const insideRef = useRef(true);
  const reducedMotion = useMediaPreference("(prefers-reduced-motion: reduce)");
  const [saveData] = useState(() => typeof navigator !== "undefined" && Boolean(navigator.connection?.saveData));
  const [seen] = useState(() => { try { return sessionStorage.getItem("hamporium:home-intro-seen") === "1"; } catch { return false; } });
  const [phase, setPhase] = useState(seen ? "hidden" : "loading");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(true);
  const [playRequested, setPlayRequested] = useState(false);
  const [finished, setFinished] = useState(false);
  const allowVideo = playRequested || (!reducedMotion && !saveData);
  const notify = useCallback((active) => {
    if (active) document.documentElement.dataset.hamporiumIntro = "active";
    else delete document.documentElement.dataset.hamporiumIntro;
    window.dispatchEvent(new CustomEvent("hamporium:intro-state", { detail: { active } }));
  }, []);
  const finish = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    setFinished(true); setPhase("hidden"); notify(false); onIntroComplete();
    try { sessionStorage.setItem("hamporium:home-intro-seen", "1"); } catch { /* Storage may be unavailable. */ }
  }, [notify, onIntroComplete]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (completeRef.current) notify(false);
      else if (seen || !allowVideo) finish();
      else notify(true);
    });

    const escapeIntro = (event) => {
      if (event.key === "Escape") finish();
    };

    // Any intentional scroll means the visitor wants to move on. Finish the
    // intro immediately so the global Header can become visible.
    const onScroll = () => {
      if (window.scrollY > 12) finish();
    };

    // This timeout only protects against a video that never becomes playable.
    // It does NOT stop a video that is already playing, so the header remains
    // hidden for the full first playback.
    const loadFailSafe = window.setTimeout(() => {
      if (!videoRef.current?.readyState) {
        setFailed(true);
        finish();
      }
    }, 12000);

    const loaderWait = window.setTimeout(() => setPhase("hidden"), 2200);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", escapeIntro);
    onScroll();

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(loadFailSafe);
      window.clearTimeout(loaderWait);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", escapeIntro);
      notify(false);
    };
  }, [seen, allowVideo, finish, notify]);

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !allowVideo || failed || manualPauseRef.current || document.hidden || !insideRef.current) return;
    const promise = video.play();
    promise?.catch(() => { setPaused(true); finish(); });
  }, [allowVideo, failed, finish]);
  useEffect(() => {
    if (!ready) return undefined;
    setPhase((current) => current === "loading" ? "leaving" : current);
    const timer = window.setTimeout(() => { setPhase("hidden"); tryPlay(); }, seen ? 0 : 420);
    return () => window.clearTimeout(timer);
  }, [ready, seen, tryPlay]);

  useEffect(() => {
    const update = () => {
      if (document.hidden || !insideRef.current || !allowVideo) videoRef.current?.pause();
      else if (ready) tryPlay();
    };
    const observer = window.IntersectionObserver ? new IntersectionObserver(([entry]) => {
      insideRef.current = entry.isIntersecting; update();
    }, { threshold: 0.03 }) : null;
    if (stageRef.current) observer?.observe(stageRef.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", update); videoRef.current?.pause(); };
  }, [allowVideo, ready, tryPlay]);

  const toggle = () => {
    if (!paused && allowVideo) {
      // Pausing the first-play film is treated as opting out of the intro.
      manualPauseRef.current = true;
      videoRef.current?.pause();
      finish();
      return;
    }

    manualPauseRef.current = false;
    setPlayRequested(true);

    // If this is still the first intro, keep the Header hidden while playback
    // resumes. Returning visitors keep their normal visible Header.
    if (!completeRef.current) notify(true);

    if (allowVideo) tryPlay();
  };
  const explore = () => { finish(); document.querySelector('[data-home-section="journey"]')?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }); };
  return <>
    {phase !== "hidden" && allowVideo && <div className={`hp-intro-loading ${phase === "leaving" ? "is-leaving" : ""}`}>
      <Loader fullscreen brand label="Preparing your HAMPORIUM experience" />
    </div>}
    {!finished && <button type="button" className="hp-intro-skip" onClick={finish}>Skip intro <span aria-hidden="true">&#8594;</span></button>}
    <section ref={stageRef} className="hp-hero-stage relative h-[100svh] min-h-[620px] w-full overflow-hidden bg-black" aria-label="HAMPORIUM gifting showcase">
      <h1 className="sr-only">HAMPORIUM - curated hampers and personalised gifting</h1>
      <div className="hp-hero-motion-layer">
        <img src={HOME_IMAGES.hero} alt="" aria-hidden="true" fetchPriority="high" className="hp-hero-poster" />
        {allowVideo && !failed && <video ref={videoRef} muted playsInline preload={seen ? "metadata" : "auto"}
          poster={HOME_IMAGES.hero} onLoadedData={() => setReady(true)} onCanPlay={() => setReady(true)}
          onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
          onEnded={finish}
          onError={() => { setFailed(true); finish(); }}
          className={`hp-hero-film ${ready ? "is-ready" : ""}`} aria-label="HAMPORIUM luxury gifting film">
          <source src={heroVideo} type="video/mp4" />
        </video>}
        <div className="hp-hero-dim-layer" />
      </div>
      {(failed || !allowVideo || (!ready && phase === "hidden")) && <div className="hp-hero-fallback-copy">
        <p>HAMPORIUM</p><h2>A little thought.<br /><em>An unforgettable gift.</em></h2>
        <Link to="/gifts" onClick={finish}>Explore hampers <span aria-hidden="true">&#8594;</span></Link>
      </div>}
      <div className="hp-hero-controls">
        <button type="button" className="hp-film-explore" onClick={explore}>Explore the collection <span aria-hidden="true">&#8595;</span></button>
        {!failed && <button type="button" onClick={toggle} className="hp-film-toggle" aria-label={paused ? "Play brand film" : "Pause brand film"}>
          <HomeControlIcon type={paused ? "play" : "pause"} /><span>{paused ? "Play film" : "Pause film"}</span>
        </button>}
      </div>
      <div className="hp-hero-handoff-line" aria-hidden="true" />
    </section>
  </>;
};

const InteractiveRail = ({ id, label, className = "", controlsClass = "", children, showStatus = true }) => {
  const ref = useRef(null);
  const frame = useRef(0);
  const reducedMotion = useMediaPreference("(prefers-reduced-motion: reduce)");
  const [range, setRange] = useState({ start: 1, end: 1, total: 0, prev: false, next: false });
  const measure = useCallback(() => {
    frame.current = 0;
    const node = ref.current;
    if (!node) return;
    const items = Array.from(node.children);
    const rect = node.getBoundingClientRect();
    const visible = items.map((item, index) => {
      const r = item.getBoundingClientRect();
      return Math.max(0, Math.min(r.right, rect.right) - Math.max(r.left, rect.left)) / Math.max(1, r.width) > 0.6 ? index : -1;
    }).filter((index) => index >= 0);
    const next = { start: visible.length ? visible[0] + 1 : 1, end: visible.length ? visible.at(-1) + 1 : 1,
      total: items.length, prev: node.scrollLeft > 3, next: node.scrollWidth - node.clientWidth - node.scrollLeft > 3 };
    setRange((old) => Object.keys(next).every((key) => old[key] === next[key]) ? old : next);
    const center = rect.left + rect.width / 2;
    let nearest = null;
    let distance = Infinity;
    items.forEach((item) => { const r = item.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - center); if (d < distance) { nearest = item; distance = d; } });
    items.forEach((item) => item.classList.toggle("is-mobile-active", item === nearest));
  }, []);
  const schedule = useCallback(() => { if (!frame.current) frame.current = requestAnimationFrame(measure); }, [measure]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const resize = window.ResizeObserver ? new ResizeObserver(schedule) : null;
    resize?.observe(node); Array.from(node.children).forEach((child) => resize?.observe(child));
    node.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
    return () => { resize?.disconnect(); cancelAnimationFrame(frame.current); frame.current = 0; node.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [children, schedule]);
  const move = (direction) => {
    const node = ref.current;
    if (!node) return;
    const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
    const child = node.firstElementChild;
    const stride = (child?.getBoundingClientRect().width || node.clientWidth) + gap;
    const target = direction === "start" ? 0 : direction === "end" ? node.scrollWidth : node.scrollLeft + direction * stride;
    node.scrollTo({ left: target, behavior: reducedMotion ? "auto" : "smooth" });
  };
  return <>
    <div id={id} ref={ref} className={className} role="region" aria-label={label} tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const command = { ArrowLeft: -1, ArrowRight: 1, Home: "start", End: "end" }[event.key];
        if (command === undefined) return;
        event.preventDefault(); move(command);
      }}>
      {children}
    </div>
    <div className={`hp-rail-controls ${controlsClass}`}>
      {showStatus && <p aria-live="polite" aria-atomic="true"><span>{String(range.start).padStart(2,"0")}{range.end > range.start ? ` - ${String(range.end).padStart(2,"0")}` : ""}</span> / {String(range.total).padStart(2,"0")}</p>}
      <span className="hp-rail-track" aria-hidden="true"><span style={{ width: `${range.total ? range.end / range.total * 100 : 0}%` }} /></span>
      <div className="hp-rail-arrows">
        <button type="button" aria-label={`Previous ${label.toLowerCase()}`} aria-controls={id} disabled={!range.prev} onClick={() => move(-1)}><HomeControlIcon type="previous" /></button>
        <button type="button" aria-label={`Next ${label.toLowerCase()}`} aria-controls={id} disabled={!range.next} onClick={() => move(1)}><HomeControlIcon type="next" /></button>
      </div>
    </div>
  </>;
};

const BestsellerCollection = ({ products, promotions, loading, error, onRetry }) => {
  const [preview, setPreview] = useState(null);
  return <div className="hp-collection-interactive">
    {error && <div className="hp-collection-notice" role="status"><span>{error}</span><button type="button" onClick={onRetry} disabled={loading}>Try again</button></div>}
    <InteractiveRail id="home-bestseller-rail" label="Hampers" className="hp-snap-rail hp-bestseller-runway" controlsClass="hp-bestseller-controls">
      {loading ? Array.from({ length: 4 }, (_, i) => <ProductSkeleton key={i} />) : products.map((product, index) => (
        <div className="hp-bestseller-cell" key={product._id}>
          <LovedProductCard
            product={product}
            index={index}
            promotion={findPromotionForProduct(product, promotions)}
            onPreview={() => setPreview(product)}
          />
        </div>
      ))}
    </InteractiveRail>
    {preview && <HomeQuickLook product={preview} onClose={() => setPreview(null)} />}
  </div>;
};

const HomeQuickLook = ({ product, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    const focusBefore = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal();
    return () => {
      node?.close(); document.body.style.overflow = previousOverflow;
      if (focusBefore instanceof HTMLElement && focusBefore.isConnected) focusBefore.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className="hp-home-quick-dialog" aria-labelledby="hp-quick-title" onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => {
      const r = event.currentTarget.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose();
    }}>
    <button type="button" autoFocus className="hp-quick-close" aria-label="Close product preview" onClick={onClose}><HomeControlIcon type="close" /></button>
    <div className="hp-quick-layout">
      <div className="hp-quick-photo"><SmartImage src={product.detailImage || product.image} alt={product.name} loading="eager" className="h-full w-full object-contain" /></div>
      <div className="hp-quick-copy">
        <p className="hp-quick-eyebrow">HAMPORIUM / QUICK LOOK</p>
        <h2 id="hp-quick-title">{product.name}</h2>
        {product.shortDescription && <p className="hp-quick-description">{product.shortDescription}</p>}
        <p className="hp-quick-price">{product.price !== null ? formatHomePrice(product.price) : "View available options"}</p>
        <p className="hp-quick-note">Explore the contents, available options and delivery details on the product page.</p>
        <Link to={product.slug ? `/products/${product.slug}` : "/gifts"} className="hp-quick-link" onClick={onClose}>View full details <span aria-hidden="true">&#8594;</span></Link>
        <button type="button" className="hp-quick-continue" onClick={onClose}>Continue exploring</button>
      </div>
    </div>
  </dialog>;
};

const HomeControlIcon = ({ type }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {type === "next" && <path d="M4 12h15m-6-6 6 6-6 6" />}
    {type === "previous" && <path d="M20 12H5m6-6-6 6 6 6" />}
    {type === "pause" && <><path d="M9 6v12M15 6v12" strokeWidth="2.2" /></>}
    {type === "play" && <path d="m9 5 10 7-10 7Z" />}
    {type === "close" && <path d="m6 6 12 12M18 6 6 18" />}
    {type === "eye" && <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>
);

export default Home;
