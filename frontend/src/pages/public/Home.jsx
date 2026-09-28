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
  const [giftRevealActive, setGiftRevealActive] = useState(false);
  const homeRef = useRef(null);
  const giftRevealTimerRef = useRef(null);
  const giftNavigatingRef = useRef(false);
  const reducedMotion = useMediaPreference("(prefers-reduced-motion: reduce)");
  const { promotions: websitePromotions } = useWebsitePromotions();

  const finishCinematicIntro = useCallback(() => setIntroFinished(true), []);
  useHomeEnhancements(homeRef, reducedMotion);

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

          /* ==============================================
             V71 · GPU-FRIENDLY ONE-TIME KINETIC TYPOGRAPHY
             Transform + opacity only: keeps the cinematic feel without
             blur/filter repaints during scroll on high-refresh displays.
          =============================================== */

          @keyframes hpKineticSectionIn {
            0% {
              opacity: 0;
              transform: translate3d(0, 34px, 0) scale(.975) skewY(.65deg);
              letter-spacing: -.052em;
            }

            64% {
              opacity: 1;
              transform: translate3d(0, -2px, 0) scale(1.002) skewY(0deg);
            }

            100% {
              opacity: 1;
              transform: translate3d(0, 0, 0) scale(1) skewY(0deg);
            }
          }

          @keyframes hpKineticAccentIn {
            0% {
              opacity: 0;
              transform: translate3d(-28px, 8px, 0) scale(.982) skewX(-2deg);
            }

            66% {
              opacity: 1;
              transform: translate3d(3px, 0, 0) scale(1.003) skewX(0deg);
            }

            100% {
              opacity: 1;
              transform: translate3d(0, 0, 0) scale(1) skewX(0deg);
            }
          }

          @keyframes hpKineticSubIn {
            0% {
              opacity: 0;
              transform: translate3d(var(--hp-kinetic-x, -14px), 14px, 0) scale(.99);
            }

            100% {
              opacity: 1;
              transform: translate3d(0, 0, 0) scale(1);
            }
          }

          @keyframes hpKineticCardIn {
            0% {
              opacity: 0;
              transform: translate3d(0, 10px, 0);
            }

            100% {
              opacity: 1;
              transform: translate3d(0, 0, 0);
            }
          }

          @keyframes hpKineticLineIn {
            0% { opacity: 0; transform: scaleX(0); }
            100% { opacity: .82; transform: scaleX(1); }
          }

          .hp-kinetic-heading {
            --hp-kinetic-x: -14px;
            position: relative;
            opacity: 0;
            filter: none !important;
            transform: translate3d(0, 18px, 0) scale(.99);
            transform-origin: left center;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            will-change: transform, opacity;
            overflow: visible !important;
            clip-path: none !important;
            -webkit-clip-path: none !important;
          }

          .hp-kinetic-heading[data-hp-kinetic-variant="section"] {
            transform: translate3d(0, 34px, 0) scale(.975) skewY(.65deg);
          }

          .hp-kinetic-heading[data-hp-kinetic-variant="sub"] {
            transform: translate3d(var(--hp-kinetic-x), 14px, 0) scale(.99);
          }

          .hp-kinetic-heading[data-hp-kinetic-variant="card"] {
            transform: translate3d(0, 10px, 0);
          }

          .hp-kinetic-heading.is-kinetic-visible[data-hp-kinetic-variant="section"] {
            animation: hpKineticSectionIn 760ms cubic-bezier(.16,1,.3,1) both;
          }

          .hp-kinetic-heading.is-kinetic-visible[data-hp-kinetic-variant="sub"],
          .hp-kinetic-heading.is-kinetic-visible[data-hp-kinetic-variant="standard"],
          .hp-kinetic-heading.is-kinetic-visible[data-hp-kinetic-variant="dialog"] {
            animation: hpKineticSubIn 560ms cubic-bezier(.16,1,.3,1) both;
          }

          .hp-kinetic-heading.is-kinetic-visible[data-hp-kinetic-variant="card"] {
            animation: hpKineticCardIn 440ms cubic-bezier(.16,1,.3,1) both;
          }

          .hp-kinetic-heading .hp-section-heading-accent {
            opacity: 0;
            filter: none !important;
            transform: translate3d(-28px, 8px, 0) scale(.982) skewX(-2deg);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            will-change: transform, opacity;
          }

          .hp-kinetic-heading.is-kinetic-visible .hp-section-heading-accent {
            animation: hpKineticAccentIn 760ms 70ms cubic-bezier(.16,1,.3,1) both;
          }

          .hp-kinetic-heading.hp-section-heading::after {
            content: "";
            display: block;
            width: clamp(54px, 6vw, 94px);
            height: 1px;
            margin-top: .24em;
            opacity: 0;
            transform: scaleX(0);
            transform-origin: left center;
            background: linear-gradient(90deg, #F47822 0%, #D4AF37 58%, transparent 100%);
          }

          .hp-kinetic-heading.hp-section-heading.is-kinetic-visible::after {
            animation: hpKineticLineIn 520ms 260ms cubic-bezier(.16,1,.3,1) both;
          }

          @media (max-width: 767px) {
            .hp-kinetic-heading[data-hp-kinetic-variant="section"] {
              transform: translate3d(0, 20px, 0) scale(.988);
            }

            .hp-kinetic-heading[data-hp-kinetic-variant="sub"],
            .hp-kinetic-heading[data-hp-kinetic-variant="standard"],
            .hp-kinetic-heading[data-hp-kinetic-variant="dialog"] {
              --hp-kinetic-x: -8px;
              transform: translate3d(var(--hp-kinetic-x), 10px, 0) scale(.995);
            }

            .hp-kinetic-heading[data-hp-kinetic-variant="card"] {
              transform: translate3d(0, 7px, 0);
            }

            .hp-kinetic-heading .hp-section-heading-accent {
              transform: translate3d(-16px, 5px, 0) scale(.99);
            }

            .hp-kinetic-heading.hp-section-heading::after {
              width: 56px;
              margin-top: .22em;
            }
          }

          /* ==============================================
             BESTSELLER HEADING · TEXT SAFE / NO DESCENDER CLIP
             The kinetic parent previously retained clip-path after reveal,
             which could crop letters such as g / y in the italic line.
          =============================================== */

          [data-home-section="bestsellers"] .hp-bestseller-section-title {
            max-width: 1320px;
            overflow: visible !important;
            padding-bottom: .16em;
            font-size: clamp(58px, 6.2vw, 106px);
            line-height: .92;
            letter-spacing: -.043em;
            text-wrap: balance;
          }

          [data-home-section="bestsellers"] .hp-bestseller-section-title.hp-kinetic-heading,
          [data-home-section="bestsellers"] .hp-bestseller-section-title.hp-kinetic-heading.is-kinetic-visible {
            clip-path: none !important;
            -webkit-clip-path: none !important;
          }

          [data-home-section="bestsellers"] .hp-bestseller-section-accent {
            display: block;
            margin-top: .07em;
            padding-bottom: .18em;
            overflow: visible;
            line-height: 1.02;
            letter-spacing: -.04em;
          }

          [data-home-section="bestsellers"] .hp-bestseller-heading-wrap {
            min-width: 0;
            max-width: 1380px;
          }

          @media (max-width: 1023px) {
            [data-home-section="bestsellers"] .hp-bestseller-section-title {
              max-width: 980px;
              padding-bottom: .18em;
              font-size: clamp(52px, 9.4vw, 82px);
              line-height: .94;
              letter-spacing: -.04em;
            }

            [data-home-section="bestsellers"] .hp-bestseller-section-accent {
              margin-top: .08em;
              padding-bottom: .20em;
              line-height: 1.04;
            }
          }

          @media (max-width: 639px) {
            [data-home-section="bestsellers"] {
              padding-top: 60px;
              padding-bottom: 66px;
            }

            [data-home-section="bestsellers"] .hp-bestseller-section-title {
              padding-bottom: .22em;
              font-size: clamp(46px, 13.2vw, 64px);
              line-height: .96;
              letter-spacing: -.035em;
            }

            [data-home-section="bestsellers"] .hp-bestseller-section-accent {
              margin-top: .1em;
              padding-bottom: .22em;
              line-height: 1.06;
              letter-spacing: -.032em;
            }

            [data-home-section="bestsellers"] .hp-bestseller-all-link {
              width: 100%;
              min-height: 54px;
              justify-content: space-between;
              padding-inline: 18px;
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
              gap: 8px;
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
              /*
                MOBILE JOURNEY GEOMETRY
                JS keeps these values synced to the rail's real client width,
                so the left peek, right peek and card-to-card spacing stay
                perfectly symmetrical even when the browser scrollbar changes
                the CSS viewport width.
              */
              --hp-journey-card-width: 74vw;
              --hp-journey-gap: 14px;
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
              column-gap: var(--hp-journey-gap);
              row-gap: 0;
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
              scale: var(--hp-journey-scroll-scale, .62);
              opacity: var(--hp-journey-scroll-opacity, .50);
              transform-origin:
                var(--hp-journey-scale-origin, center center);
              z-index: var(--hp-journey-z, 1);
              border-radius: 28px;
              transition:
                opacity .12s linear;
              will-change:
                scale, opacity;
              backface-visibility: hidden;
              -webkit-backface-visibility: hidden;
            }

            .hp-journey-grid >
            .is-mobile-active {
              opacity: var(--hp-journey-scroll-opacity, 1);
            }
          }

          @media (max-width: 639px) {
            .hp-journey-grid {
              --hp-journey-card-width: 74vw;
              --hp-journey-gap: 14px;
              column-gap: var(--hp-journey-gap);
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

          /* ==============================================
             BULK STEP VISUAL PREVIEW
             A visible image slice makes the interaction obvious.
             Hover expands the image across the full card; touch keeps
             the visual slice visible without relying on hover.
          =============================================== */

          [data-home-section="bulk"] .hp-bulk-step-card {
            isolation: isolate;
            background: #F3EEE6;
            border-color: rgba(23,23,23,.10);
            transition:
              border-color .38s ease,
              box-shadow .38s ease,
              transform .38s ease;
          }

          [data-home-section="bulk"] .hp-bulk-step-image {
            z-index: 0;
            opacity: 1 !important;
            clip-path: inset(0 0 0 62%);
            -webkit-clip-path: inset(0 0 0 62%);
            transform: scale(1.035);
            transform-origin: center;
            transition:
              clip-path .58s cubic-bezier(.22,.72,.2,1),
              -webkit-clip-path .58s cubic-bezier(.22,.72,.2,1),
              transform .72s cubic-bezier(.22,.72,.2,1);
            will-change: clip-path, transform;
          }

          [data-home-section="bulk"] .hp-bulk-step-image-overlay {
            background:
              linear-gradient(
                90deg,
                rgba(243,238,230,.98) 0%,
                rgba(243,238,230,.90) 30%,
                rgba(243,238,230,.38) 63%,
                rgba(10,9,8,.10) 100%
              );
            transition: background .42s ease;
          }

          [data-home-section="bulk"] .hp-bulk-step-content {
            width: min(58%, 310px);
            transition: width .42s ease;
          }

          [data-home-section="bulk"] .hp-bulk-step-title {
            position: relative;
            z-index: 2;
            margin-top: 0 !important;
            text-shadow: none;
            transition:
              color .34s ease,
              text-shadow .34s ease,
              transform .38s ease;
          }

          [data-home-section="bulk"] .hp-bulk-step-visual-cue {
            position: absolute;
            left: calc(100% + 18px);
            top: 50%;
            display: flex;
            width: 56px;
            height: 56px;
            align-items: center;
            justify-content: center;
            transform: translateY(-50%);
            border: 1px solid rgba(255,255,255,.50);
            border-radius: 999px;
            background: rgba(12,10,8,.34);
            box-shadow: 0 12px 28px rgba(0,0,0,.18);
            backdrop-filter: blur(7px);
            -webkit-backdrop-filter: blur(7px);
            transition:
              transform .38s ease,
              background .38s ease,
              border-color .38s ease;
          }

          [data-home-section="bulk"] .hp-bulk-step-visual-cue::before,
          [data-home-section="bulk"] .hp-bulk-step-visual-cue::after {
            content: "";
            position: absolute;
            background: #F3D06A;
          }

          [data-home-section="bulk"] .hp-bulk-step-visual-cue::before {
            width: 18px;
            height: 2px;
          }

          [data-home-section="bulk"] .hp-bulk-step-visual-cue::after {
            width: 7px;
            height: 7px;
            border-top: 2px solid #F3D06A;
            border-right: 2px solid #F3D06A;
            background: transparent;
            transform: translateX(5px) rotate(45deg);
          }

          @media (hover:hover) and (pointer:fine) {
            [data-home-section="bulk"] .hp-bulk-step-card:hover {
              border-color: rgba(212,175,55,.42);
              box-shadow: 0 26px 60px rgba(42,28,11,.18);
              transform: translateY(-3px);
            }

            [data-home-section="bulk"] .hp-bulk-step-card:hover .hp-bulk-step-image {
              clip-path: inset(0 0 0 0);
              -webkit-clip-path: inset(0 0 0 0);
              transform: scale(1.0);
            }

            [data-home-section="bulk"] .hp-bulk-step-card:hover .hp-bulk-step-image-overlay {
              background:
                linear-gradient(
                  90deg,
                  rgba(10,9,8,.74) 0%,
                  rgba(10,9,8,.60) 48%,
                  rgba(10,9,8,.42) 100%
                );
            }

            [data-home-section="bulk"] .hp-bulk-step-card:hover .hp-bulk-step-content {
              width: min(78%, 390px);
            }

            [data-home-section="bulk"] .hp-bulk-step-card:hover .hp-bulk-step-title {
              color: #FFF8EC !important;
              text-shadow: 0 10px 30px rgba(0,0,0,.42);
              transform: translateX(4px);
            }

            [data-home-section="bulk"] .hp-bulk-step-card:hover .hp-bulk-step-visual-cue {
              transform: translateY(-50%) translateX(5px);
              background: rgba(244,120,34,.86);
              border-color: rgba(255,255,255,.68);
            }
          }

          @media (max-width: 1023px), (hover:none), (pointer:coarse) {
            [data-home-section="bulk"] .hp-bulk-step-image {
              opacity: 1 !important;
              clip-path: inset(0 0 0 56%);
              -webkit-clip-path: inset(0 0 0 56%);
              transform: scale(1.02);
              will-change: auto;
            }

            [data-home-section="bulk"] .hp-bulk-step-image-overlay {
              background:
                linear-gradient(
                  90deg,
                  rgba(243,238,230,.98) 0%,
                  rgba(243,238,230,.88) 35%,
                  rgba(243,238,230,.24) 72%,
                  rgba(8,8,8,.08) 100%
                );
            }

            [data-home-section="bulk"] .hp-bulk-step-content {
              width: 56%;
            }

            [data-home-section="bulk"] .hp-bulk-step-title {
              color: #171717 !important;
            }

            [data-home-section="bulk"] .hp-bulk-step-visual-cue {
              left: calc(100% + 10px);
              width: 46px;
              height: 46px;
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
            .hp-home-v65 .hp-snap-rail:not(.hp-journey-grid) > *,
            .hp-home-v65 .hp-snap-rail:not(.hp-journey-grid) > .is-mobile-active {
              scale:1 !important; opacity:1 !important; will-change:auto !important;
            }

            .hp-home-v65 .hp-journey-grid > * {
              scale: var(--hp-journey-scroll-scale, .70) !important;
              opacity: var(--hp-journey-scroll-opacity, .58) !important;
              transform-origin: var(--hp-journey-scale-origin, center center) !important;
              z-index: var(--hp-journey-z, 1);
              will-change: scale, opacity !important;
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

          @media (prefers-reduced-motion: reduce) and (max-width: 1023px) {
            .hp-home-v65 .hp-journey-grid > * {
              scale: 1 !important;
              opacity: 1 !important;
            }
          }
          @media (prefers-reduced-motion:reduce) {
            .hp-home-v65 *, .hp-home-v65 *::before, .hp-home-v65 *::after,
            .hp-home-quick-dialog, .hp-home-quick-dialog * {
              animation:none !important; transition:none !important; scroll-behavior:auto !important;
            }
            .hp-home-v65 .hp-reveal, .hp-home-v65 .hp-story-line, .hp-home-v65 .hp-story-kicker {
              opacity:1 !important; filter:none !important; transform:none !important;
            }
            .hp-home-v65 .hp-kinetic-heading,
            .hp-home-v65 .hp-kinetic-heading .hp-section-heading-accent {
              opacity: 1 !important;
              filter: none !important;
              transform: none !important;
              clip-path: none !important;
              -webkit-clip-path: none !important;
              animation: none !important;
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

          /* ==================================================
             V76 · WAVE WATER FLUID SHADER
             GPU rendered wave refraction. No radial/circular mask.
             The shader itself fades into the untouched base image, so
             the interaction reads as flowing water bands instead of a lens.
          ================================================== */
          .hp-fluid-backdrop {
            position: absolute;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
            isolation: isolate;
            contain: paint;
          }

          .hp-fluid-image,
          .hp-fluid-canvas-wrap,
          .hp-fluid-canvas {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }

          .hp-fluid-image-base {
            z-index: 0;
            transform: translateZ(0);
            transition: transform .46s cubic-bezier(.22,1,.36,1);
          }

          .hp-fluid-canvas-wrap {
            z-index: 2;
            overflow: hidden;
            opacity: 0;
            pointer-events: none;
            transform: translateZ(0);
            transition: opacity .14s ease-out;
            will-change: opacity;
          }

          .hp-fluid-backdrop.is-fluid-active .hp-fluid-canvas-wrap {
            opacity: 1;
          }

          .hp-fluid-canvas {
            display: block;
            max-width: none;
            transform-origin: center center;
            pointer-events: none;
          }

          /* Small overscan prevents edge gaps while the wave bends the image. */
          @media (hover: hover) and (pointer: fine) {
            .hp-fluid-host:hover .hp-fluid-image-base {
              transform: translateZ(0) scale(1.008);
            }
          }

          @media (hover: none), (pointer: coarse), (max-width: 767px) {
            .hp-fluid-canvas-wrap {
              display: none !important;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .hp-fluid-canvas-wrap {
              display: none !important;
              transition: none !important;
            }
          }

          /* ==================================================
             V73 · HOME PERFORMANCE PASS
             Offscreen sections skip paint/layout work. Heavy decorative
             motion is reduced on touch/tablet where it gives little value.
          ================================================== */
          .hp-home-v65 [data-home-section="journey"],
          .hp-home-v65 [data-home-section="bestsellers"],
          .hp-home-v65 [data-home-section="hamper-one"],
          .hp-home-v65 [data-home-section="bulk"],
          .hp-home-v65 [data-home-section="finale"] {
            content-visibility: auto;
            contain-intrinsic-size: auto 900px;
          }

          .hp-home-v65 .hp-pointer-glow::before {
            display: none !important;
          }

          .hp-home-v65 .hp-offscreen .hp-fluid-canvas-wrap {
            opacity: 0 !important;
          }

          /* Fluid hosts are composited only while needed; no permanent cursor graphic. */
          @media (hover: hover) and (pointer: fine) {
            .hp-home-v65 .hp-fluid-host {
              transform: translateZ(0);
              backface-visibility: hidden;
              -webkit-backface-visibility: hidden;
            }
          }

          @media (max-width: 1023px), (hover: none), (pointer: coarse) {
            .hp-home-v65 .hp-ambient-float,
            .hp-home-v65 .hp-soft-spin,
            .hp-home-v65 .hp-badge-pulse,
            .hp-home-v65 .hp-luxury-drift,
            .hp-home-v65 .hp-final-drift,
            .hp-home-v65 .hp-luxury-line,
            .hp-home-v65 .hp-bulk-float {
              animation: none !important;
            }

            .hp-home-v65 .hp-journey-glow,
            .hp-home-v65 .hp-concierge-ambient,
            .hp-home-v65 .hp-luxury-glow,
            .hp-home-v65 .hp-review-glow {
              display: none !important;
            }

            .hp-home-v65 .hp-bestseller-card::before {
              mix-blend-mode: normal !important;
            }
          }

          /* ==================================================
             V67 · BULK STEPS MOBILE SWIPE FIX
             Keep desktop 2x2 grid. On phone/tablet the four
             steps become a real horizontal native scroll rail.
          ================================================== */
          @media (max-width: 1023px) {
            [data-home-section="bulk"] .hp-bulk-layout {
              display: block !important;
              min-height: 0 !important;
            }

            [data-home-section="bulk"] .hp-bulk-visual {
              min-height: clamp(390px, 62svh, 560px) !important;
            }

            [data-home-section="bulk"] .hp-bulk-flow {
              min-width: 0 !important;
              overflow: hidden;
            }

            [data-home-section="bulk"] .hp-bulk-rail {
              --hp-bulk-card-width: min(82vw, 390px);

              display: flex !important;
              flex-flow: row nowrap !important;
              align-items: stretch !important;
              justify-content: flex-start !important;

              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;

              overflow-x: auto !important;
              overflow-y: hidden !important;
              -webkit-overflow-scrolling: touch;
              overscroll-behavior-x: contain;
              overscroll-behavior-y: auto;
              touch-action: pan-x pan-y !important;

              gap: 12px !important;
              margin-top: 30px !important;
              padding: 14px 0 18px !important;

              scroll-snap-type: x mandatory !important;
              scroll-padding-inline: 0 !important;
              scroll-behavior: smooth;

              mask-image: none !important;
              -webkit-mask-image: none !important;
              scrollbar-width: none;
            }

            [data-home-section="bulk"] .hp-bulk-rail::-webkit-scrollbar {
              display: none;
            }

            [data-home-section="bulk"] .hp-bulk-rail > .hp-bulk-step-card {
              flex: 0 0 var(--hp-bulk-card-width) !important;
              width: var(--hp-bulk-card-width) !important;
              min-width: var(--hp-bulk-card-width) !important;
              max-width: var(--hp-bulk-card-width) !important;
              min-height: 255px !important;

              scroll-snap-align: start !important;
              scroll-snap-stop: always;

              padding: 22px !important;
              border: 1px solid rgba(23,23,23,.09);
              background: rgba(255,255,255,.26);
              scale: 1 !important;
              opacity: 1 !important;
              transform: none !important;
              will-change: auto !important;
            }

            [data-home-section="bulk"] .hp-bulk-step-title {
              margin-top: 34px !important;
              font-size: clamp(28px, 6.8vw, 34px) !important;
              line-height: .98 !important;
            }

            [data-home-section="bulk"] .hp-bulk-step-copy {
              max-width: 290px !important;
              font-size: 13px !important;
              line-height: 1.7 !important;
            }

            [data-home-section="bulk"] .hp-rail-mobile-only {
              display: flex !important;
              width: 100%;
              margin: 8px 0 0 !important;
              padding: 0 !important;
            }

            [data-home-section="bulk"] .hp-rail-mobile-only .hp-rail-track {
              max-width: none;
            }

            [data-home-section="bulk"] .hp-rail-mobile-only .hp-rail-arrows {
              flex-shrink: 0;
            }
          }

          /* ==============================================
             MOBILE BULK STEP TAP PREVIEW
             Touching a step focuses the card and expands the
             image exactly like desktop hover. Focus moves to the
             next card on the next tap, so only one stays expanded.
          =============================================== */

          @media (max-width: 1023px), (hover: none), (pointer: coarse) {
            [data-home-section="bulk"] .hp-bulk-step-card {
              -webkit-tap-highlight-color: transparent;
              cursor: pointer;
              outline: none;
            }

            [data-home-section="bulk"] .hp-bulk-step-card:focus,
            [data-home-section="bulk"] .hp-bulk-step-card:focus-visible {
              border-color: rgba(212,175,55,.46) !important;
              box-shadow: 0 22px 54px rgba(42,28,11,.18) !important;
            }

            [data-home-section="bulk"] .hp-bulk-step-card:focus .hp-bulk-step-image,
            [data-home-section="bulk"] .hp-bulk-step-card:focus-visible .hp-bulk-step-image {
              opacity: 1 !important;
              clip-path: inset(0 0 0 0) !important;
              -webkit-clip-path: inset(0 0 0 0) !important;
              transform: scale(1) !important;
            }

            [data-home-section="bulk"] .hp-bulk-step-card:focus .hp-bulk-step-image-overlay,
            [data-home-section="bulk"] .hp-bulk-step-card:focus-visible .hp-bulk-step-image-overlay {
              background:
                linear-gradient(
                  90deg,
                  rgba(10,9,8,.76) 0%,
                  rgba(10,9,8,.60) 48%,
                  rgba(10,9,8,.42) 100%
                ) !important;
            }

            [data-home-section="bulk"] .hp-bulk-step-card:focus .hp-bulk-step-content,
            [data-home-section="bulk"] .hp-bulk-step-card:focus-visible .hp-bulk-step-content {
              width: min(78%, 390px) !important;
            }

            [data-home-section="bulk"] .hp-bulk-step-card:focus .hp-bulk-step-title,
            [data-home-section="bulk"] .hp-bulk-step-card:focus-visible .hp-bulk-step-title {
              color: #FFF8EC !important;
              text-shadow: 0 10px 30px rgba(0,0,0,.44) !important;
              transform: translateX(4px);
            }

            [data-home-section="bulk"] .hp-bulk-step-card:focus .hp-bulk-step-visual-cue,
            [data-home-section="bulk"] .hp-bulk-step-card:focus-visible .hp-bulk-step-visual-cue {
              transform: translateY(-50%) translateX(5px) !important;
              background: rgba(244,120,34,.90) !important;
              border-color: rgba(255,255,255,.72) !important;
            }
          }

          @media (max-width: 639px) {
            [data-home-section="bulk"] .hp-bulk-visual {
              min-height: 410px !important;
            }

            [data-home-section="bulk"] .hp-bulk-flow {
              padding-left: 20px !important;
              padding-right: 20px !important;
              padding-top: 42px !important;
              padding-bottom: 48px !important;
            }

            [data-home-section="bulk"] .hp-bulk-rail {
              --hp-bulk-card-width: min(84vw, 350px);
              gap: 10px !important;
              margin-top: 26px !important;
            }

            [data-home-section="bulk"] .hp-bulk-rail > .hp-bulk-step-card {
              min-height: 240px !important;
              padding: 20px !important;
            }
          }


          /* ==============================================
             WHY HAMPORIUM · SIGNATURE STANDARD
             Cinematic image drift + refined glass promise cards.
          =============================================== */
          @keyframes hpWhyImageDrift {
            0%, 100% {
              transform: translate3d(0,0,0) scale(1.035);
            }

            50% {
              transform: translate3d(-0.8%, -0.6%, 0) scale(1.075);
            }
          }

          @keyframes hpWhyGlowFloat {
            0%, 100% {
              transform: translate3d(0,0,0) scale(.94);
              opacity: .48;
            }

            50% {
              transform: translate3d(0,-14px,0) scale(1.06);
              opacity: .78;
            }
          }

          @keyframes hpWhyStatusPulse {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(244,120,34,.18);
            }

            50% {
              box-shadow: 0 0 0 7px rgba(244,120,34,0);
            }
          }

          @keyframes hpWhySignatureLine {
            0%, 100% {
              transform: scaleX(.42);
              opacity: .48;
            }

            50% {
              transform: scaleX(1);
              opacity: 1;
            }
          }

          .hp-why-stage {
            isolation: isolate;
          }

          .hp-why-bg {
            transform: translate3d(0,0,0) scale(1.035);
            transform-origin: center center;
            animation: hpWhyImageDrift 18s ease-in-out infinite;
            will-change: transform;
          }

          .hp-why-glow {
            animation: hpWhyGlowFloat 7.2s ease-in-out infinite;
          }

          .hp-why-glow-b {
            animation-delay: -3.3s;
          }

          .hp-why-status-dot {
            animation: hpWhyStatusPulse 2.4s ease-out infinite;
          }

          .hp-why-signature-line {
            transform-origin: left center;
            animation: hpWhySignatureLine 3.6s ease-in-out infinite;
          }

          .hp-why-card {
            box-shadow:
              0 24px 60px rgba(0,0,0,.18),
              inset 0 1px 0 rgba(255,255,255,.035);
            transition:
              transform .62s cubic-bezier(.22,1,.36,1),
              border-color .42s ease,
              background-color .42s ease,
              box-shadow .52s ease;
          }

          .hp-why-card::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            border-radius: inherit;
            opacity: .55;
            background:
              radial-gradient(circle at 18% 12%, rgba(212,175,55,.10), transparent 26%),
              linear-gradient(135deg, rgba(255,255,255,.035), transparent 42%);
            transition: opacity .42s ease;
          }

          .hp-why-card::after {
            content: "";
            position: absolute;
            left: 18px;
            right: 18px;
            bottom: 0;
            height: 1px;
            opacity: .22;
            background: linear-gradient(90deg, transparent, #D4AF37, transparent);
            transform: scaleX(.58);
            transform-origin: center;
            transition:
              opacity .42s ease,
              transform .62s cubic-bezier(.22,1,.36,1);
          }

          .hp-why-card-shine {
            opacity: 0;
            transform: translateX(0) skewX(-18deg);
          }

          .hp-why-icon-shell {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.08),
              0 8px 24px rgba(0,0,0,.16);
            transition:
              transform .62s cubic-bezier(.22,1,.36,1),
              color .35s ease,
              border-color .35s ease,
              background-color .35s ease,
              box-shadow .35s ease;
          }

          .hp-why-card-rule {
            transform-origin: left center;
          }

          @media (hover:hover) and (pointer:fine) {
            .hp-why-card:hover {
              transform: translateY(-8px);
              border-color: rgba(212,175,55,.42);
              background-color: rgba(12,9,6,.52);
              box-shadow:
                0 34px 78px rgba(0,0,0,.30),
                0 0 0 1px rgba(212,175,55,.05),
                inset 0 1px 0 rgba(255,255,255,.06);
            }

            .hp-why-card:hover::before {
              opacity: 1;
            }

            .hp-why-card:hover::after {
              opacity: .72;
              transform: scaleX(1);
            }

            .hp-why-card:hover .hp-why-card-shine {
              opacity: 1;
              transform: translateX(520%) skewX(-18deg);
              transition:
                transform .95s cubic-bezier(.22,1,.36,1),
                opacity .18s ease;
            }

            .hp-why-card:hover .hp-why-icon-shell {
              transform: translateY(-3px) rotate(-4deg) scale(1.08);
              color: #F6C66A;
              border-color: rgba(244,120,34,.62);
              background: rgba(244,120,34,.10);
              box-shadow:
                0 12px 28px rgba(0,0,0,.22),
                0 0 0 6px rgba(244,120,34,.05);
            }

            .hp-why-card:hover .hp-why-card-rule {
              width: 74px;
              background: linear-gradient(90deg, #F47822, #D4AF37, transparent);
            }
          }

          @media (max-width: 639px) {
            .hp-why-stage {
              min-height: 0;
            }

            .hp-why-bg {
              object-position: 62% center;
              animation-duration: 22s;
            }

            .hp-why-card {
              min-height: 176px;
              padding: 16px;
              border-radius: 20px;
            }

            .hp-why-card h3 {
              overflow-wrap: normal;
              word-break: normal;
            }
          }

          @media (hover:none), (pointer:coarse) {
            .hp-why-card:hover {
              transform: none;
            }

            .hp-why-card-shine {
              display: none;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .hp-why-bg,
            .hp-why-glow,
            .hp-why-status-dot,
            .hp-why-signature-line {
              animation: none !important;
            }

            .hp-why-bg {
              transform: none !important;
            }
          }


          /* ==================================================
             V81 · SIGNATURE HAMPER ONE UNWRAP
             Premium interaction without extra libraries.
          ================================================== */

          @keyframes hpUnwrapHotspotPulse {
            0%, 100% {
              box-shadow:
                0 0 0 0 rgba(212,175,55,.24),
                0 12px 34px rgba(0,0,0,.28);
            }
            50% {
              box-shadow:
                0 0 0 10px rgba(212,175,55,0),
                0 16px 42px rgba(0,0,0,.34);
            }
          }

          @keyframes hpUnwrapPosterBreath {
            0%, 100% {
              transform: translate3d(0,0,0) scale(1);
            }
            50% {
              transform: translate3d(0,-4px,0) scale(1.006);
            }
          }

          .hp-unbox-poster-card {
            animation:
              hpUnwrapPosterBreath 7.5s
              ease-in-out infinite;
          }

          .hp-unbox-curtain {
            background:
              linear-gradient(
                90deg,
                rgba(255,255,255,.025),
                transparent 16%,
                rgba(212,175,55,.055) 48%,
                transparent 72%,
                rgba(0,0,0,.20)
              ),
              repeating-linear-gradient(
                90deg,
                #120d08 0 34px,
                #090705 34px 68px
              );
            box-shadow:
              inset 0 0 46px rgba(212,175,55,.06),
              0 0 42px rgba(0,0,0,.34);
          }

          .hp-unbox-curtain-left {
            transform-origin: left center;
          }

          .hp-unbox-curtain-right {
            transform-origin: right center;
          }

          .hp-unbox-ribbon {
            background:
              linear-gradient(
                90deg,
                #8f641f 0%,
                #d8b85e 22%,
                #f4dd91 50%,
                #c89535 78%,
                #7b5013 100%
              );
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.30),
              inset 0 -1px 0 rgba(73,42,6,.22),
              0 8px 24px rgba(0,0,0,.24);
          }

          .hp-unbox-hotspot.is-active {
            animation:
              hpUnwrapHotspotPulse 2.2s
              ease-out infinite;
          }

          @media (max-width: 767px) {
            .hp-unbox-poster-card {
              animation: none;
            }

            .hp-unbox-hotspot {
              width: 40px;
              height: 40px;
            }

          }

          @media (hover: none), (pointer: coarse) {
            .hp-unbox-hotspot.is-active {
              animation: none;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .hp-unbox-poster-card,
            .hp-unbox-hotspot.is-active {
              animation: none !important;
            }

            .hp-unbox-curtain,
            .hp-unbox-ribbon {
              transition: none !important;
            }
          }

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

        <CinematicHero onIntroComplete={finishCinematicIntro} />

        <PromotionAnnouncement
          promotions={websitePromotions}
          visible={introFinished}
        />

        <PromotionHomeBanner
          promotions={websitePromotions}
          visible
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
                    className="group relative min-h-[540px] overflow-hidden lg:min-h-[690px]"
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
                <div className="hp-bestseller-heading-wrap min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#F47822]">
                    CURATED BESTSELLERS
                  </p>

                  <h2 className="hp-section-heading hp-bestseller-section-title mt-5 text-[#171717]">
                    <span className="block">The Hampers Everyone</span>
                    <span className="hp-section-heading-accent hp-bestseller-section-accent text-[#9B741D]">
                      Keeps Coming Back For.
                    </span>
                  </h2>
                </div>

                <Link
                  to="/gifts"
                  className="hp-bestseller-all-link group mb-1 inline-flex h-[58px] w-fit items-center gap-5 border border-black/10 bg-white px-6 text-[12px] font-black uppercase tracking-[0.09em] text-[#171717] transition duration-300 hover:border-[#F47822] hover:bg-[#F47822] hover:text-white"
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
            HAMPER ONE · SIGNATURE UNWRAP EXPERIENCE
        =================================================== */}

        <HamperOneUnwrapExperience />

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
              className="hp-story-page hp-fluid-host group relative"
            >
              <div className="hp-story-sheet">
                <FluidBackdrop
                  src={item.image}
                  alt={`${item.titleLines.join(" ")} ${item.accentLines.join(" ")}`}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "low"}
                  style={{
                    objectPosition: item.objectPosition,
                  }}
                  imageClassName="object-cover"
                  strength={index === 1 ? 15 : 17}
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
            BULK / EVENT GIFTING · EDITORIAL FLOW
        =================================================== */}

        <section data-home-section="bulk" className="relative overflow-hidden bg-[#F3EEE6] text-[#171717]">
          <div className="hp-bulk-layout grid min-h-[850px] lg:grid-cols-[0.92fr_1.08fr]">
            {/* LEFT VISUAL */}
            <Reveal className="hp-bulk-visual hp-fluid-host relative min-h-[560px] overflow-hidden bg-[#15100C] lg:min-h-[850px]">
              <FluidBackdrop
                src={HOME_IMAGES.corporate}
                alt="Corporate and event gifting"
                imageClassName="object-cover object-center"
                strength={15}
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
            <div className="hp-bulk-flow relative flex flex-col justify-center px-5 py-14 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20">
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

              </Reveal>

              <InteractiveRail id="home-bulk-rail" label="Bulk gifting steps" className="hp-bulk-rail hp-mobile-rail hp-snap-rail mt-10 border-y border-black/10 lg:grid lg:grid-cols-2 lg:gap-0" controlsClass="hp-rail-mobile-only">
                {[
                  ["Build One Design", HOME_IMAGES.festival],
                  ["Choose Bulk Qty", HOME_IMAGES.wedding],
                  ["Receive Quotation", HOME_IMAGES.curated],
                  ["Pay After Approval", HOME_IMAGES.custom],
                ].map(([title, image], index) => (
                  <button
                    key={title}
                    type="button"
                    aria-label={`${title}. Tap to preview image`}
                    onClick={(event) => event.currentTarget.focus({ preventScroll: true })}
                    className={`hp-bulk-step-card group relative flex min-h-[210px] items-center overflow-hidden border-0 bg-transparent p-6 text-left appearance-none lg:min-h-[210px] ${
                      index % 2 === 0 ? "lg:border-r lg:border-black/10" : ""
                    } ${
                      index < 2 ? "lg:border-b lg:border-black/10" : ""
                    }`}
                  >
                    <div className="hp-bulk-step-image absolute inset-0">
                      <SmartImage
                        src={image}
                        alt=""
                        className="h-full w-full object-cover object-center"
                      />
                      <div className="hp-bulk-step-image-overlay absolute inset-0" />
                    </div>

                    <div className="hp-bulk-step-content relative z-10">
                      <h3
                        style={{ fontFamily: DISPLAY_FONT }}
                        className="hp-bulk-step-title text-[31px] font-semibold leading-[0.98] text-[#171717] transition sm:text-[34px]"
                      >
                        {title}
                      </h3>
                      <span className="hp-bulk-step-visual-cue" aria-hidden="true">
                        <span />
                      </span>
                    </div>
                  </button>
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

        <section data-home-section="finale" className="hp-final-parallax-zone hp-fluid-host hp-pointer-glow relative flex min-h-[82svh] items-center overflow-hidden bg-black text-white">
          <FluidBackdrop
            src={HOME_IMAGES.finalCta}
            alt="HAMPORIUM final gifting moment"
            imageClassName="hp-final-drift object-cover object-center opacity-[0.62]"
            strength={17}
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
// POINTER FLUID BACKDROP
// A lightweight local refraction lens for selected desktop backgrounds.
// It listens on its parent, so text/buttons above the image stay clickable.
// ======================================================

const FluidBackdrop = ({
  src,
  alt = "",
  imageClassName = "object-cover object-center",
  loading = "lazy",
  fetchPriority,
  decoding = "async",
  style,
  strength = 16,
}) => {
  const layerRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const rectRef = useRef(null);
  const activeRef = useRef(false);
  const readyRef = useRef(false);
  const startTimeRef = useRef(0);
  const previousPointerRef = useRef(null);
  const targetRef = useRef({
    x: 0.5,
    y: 0.5,
    velocityX: 0,
    velocityY: 0,
    amount: 0,
  });
  const currentRef = useRef({
    x: 0.5,
    y: 0.5,
    velocityX: 0,
    velocityY: 0,
    amount: 0,
  });

  useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    const host = layer?.parentElement;

    if (!layer || !canvas || !host || typeof window === "undefined") {
      return undefined;
    }

    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const coarsePointer = window.matchMedia?.(
      "(hover: none), (pointer: coarse)"
    ).matches;

    if (reducedMotion || coarsePointer) return undefined;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) return undefined;

    const vertexSource = `
      attribute vec2 a_position;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;

      uniform sampler2D u_texture;
      uniform vec2 u_resolution;
      uniform vec2 u_imageResolution;
      uniform vec2 u_mouse;
      uniform vec2 u_velocity;
      uniform vec2 u_objectPosition;
      uniform float u_time;
      uniform float u_amount;
      uniform float u_strength;

      vec2 coverUv(vec2 uv) {
        float screenAspect = u_resolution.x / max(u_resolution.y, 1.0);
        float imageAspect = u_imageResolution.x / max(u_imageResolution.y, 1.0);
        vec2 scale = vec2(1.0);
        vec2 offset = vec2(0.0);

        if (screenAspect > imageAspect) {
          scale.y = imageAspect / screenAspect;
          offset.y = (1.0 - u_objectPosition.y) * (1.0 - scale.y);
        } else {
          scale.x = screenAspect / imageAspect;
          offset.x = u_objectPosition.x * (1.0 - scale.x);
        }

        return uv * scale + offset;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        float aspect = u_resolution.x / max(u_resolution.y, 1.0);

        vec2 delta = uv - u_mouse;
        float x = delta.x * aspect;
        float y = delta.y;

        /*
          A flowing wave band instead of radial distance. The cursor becomes
          the origin of a soft horizontal water sheet that bends and trails.
        */
        float velocityTilt = clamp(
          u_velocity.y * 0.075 - u_velocity.x * 0.035,
          -0.10,
          0.10
        );

        float wavePath =
          y - velocityTilt * x
          + sin(x * 9.0 - u_time * 1.55) * 0.018
          + sin(x * 17.0 + u_time * 1.10) * 0.008;

        float bandDistance = abs(wavePath);
        float verticalEnvelope = 1.0 - smoothstep(0.035, 0.255, bandDistance);
        float horizontalEnvelope = 1.0 - smoothstep(0.14, 0.92, abs(x));
        float envelope = verticalEnvelope * horizontalEnvelope;
        envelope = envelope * envelope * (3.0 - 2.0 * envelope);

        /* Parallel travelling crests create a water-sheet / wake feel. */
        float phaseA = x * 33.0 - u_time * 7.4 + y * 7.0;
        float phaseB = x * 57.0 + u_time * 4.2 - y * 11.0 + 1.35;
        float phaseC = x * 18.0 - u_time * 2.45
          + sin(y * 24.0 + u_time * 1.2) * 1.4;

        float waveA = sin(phaseA);
        float waveB = sin(phaseB);
        float waveC = sin(phaseC);

        float strength = u_strength * u_amount;
        vec2 distortion = vec2(0.0);

        /* Most displacement is perpendicular to the crest, like surface water. */
        distortion.y += (
          waveA * 0.0110
          + waveB * 0.0042
          + waveC * 0.0028
        ) * envelope * strength;

        /* A smaller sideways shear stops the movement looking like a flat sine strip. */
        distortion.x += (
          cos(phaseA) * 0.0038
          + cos(phaseB) * 0.0018
        ) * envelope * strength / max(aspect, 0.7);

        /* Hand momentum pushes the whole wave sheet in the drag direction. */
        distortion += u_velocity * vec2(0.0075, 0.0115) * envelope * strength;

        /* Soft trailing wake below/above the main crest, still non-circular. */
        float wakeEnvelope =
          (1.0 - smoothstep(0.08, 0.34, abs(y)))
          * (1.0 - smoothstep(0.20, 0.86, abs(x)));
        float wake = sin(y * 74.0 - u_time * 5.4 + x * 12.0);
        distortion.y += wake * 0.0026 * wakeEnvelope * strength;

        vec2 displacedUv = clamp(uv + distortion, 0.001, 0.999);
        vec2 textureUv = coverUv(displacedUv);

        vec4 mainSample = texture2D(u_texture, textureUv);

        /* Subtle refraction along the wave crests. */
        vec2 chromaOffset = distortion * 0.13;
        vec4 redSample = texture2D(
          u_texture,
          coverUv(clamp(displacedUv + chromaOffset, 0.001, 0.999))
        );
        vec4 blueSample = texture2D(
          u_texture,
          coverUv(clamp(displacedUv - chromaOffset, 0.001, 0.999))
        );

        vec3 refracted = vec3(
          redSample.r,
          mainSample.g,
          blueSample.b
        );

        float chromaMix = envelope * u_amount * 0.105;
        vec3 color = mix(mainSample.rgb, refracted, chromaMix);

        /* Long highlights run with the crest instead of drawing a circular ring. */
        float caustic = (
          waveA * 0.58
          + waveB * 0.27
          + wake * 0.15
        ) * envelope * u_amount * 0.016;
        color += caustic;

        gl_FragColor = vec4(color, mainSample.a);
      }
    `;

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) return undefined;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return undefined;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      texture: gl.getUniformLocation(program, "u_texture"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
      imageResolution: gl.getUniformLocation(program, "u_imageResolution"),
      mouse: gl.getUniformLocation(program, "u_mouse"),
      velocity: gl.getUniformLocation(program, "u_velocity"),
      objectPosition: gl.getUniformLocation(program, "u_objectPosition"),
      time: gl.getUniformLocation(program, "u_time"),
      amount: gl.getUniformLocation(program, "u_amount"),
      strength: gl.getUniformLocation(program, "u_strength"),
    };

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(uniforms.texture, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    let imageWidth = 1;
    let imageHeight = 1;
    let objectPosition = [0.5, 0.5];
    let resizeObserver;
    let destroyed = false;

    const parsePositionPart = (value, axis) => {
      const normalized = String(value || "").trim().toLowerCase();
      if (!normalized) return 0.5;
      if (normalized === "center") return 0.5;
      if (axis === "x" && normalized === "left") return 0;
      if (axis === "x" && normalized === "right") return 1;
      if (axis === "y" && normalized === "top") return 0;
      if (axis === "y" && normalized === "bottom") return 1;
      if (normalized.endsWith("%")) {
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed)
          ? Math.max(0, Math.min(1, parsed / 100))
          : 0.5;
      }
      return 0.5;
    };

    const readObjectPosition = () => {
      const baseImage = layer.querySelector(".hp-fluid-image-base");
      if (!baseImage) return;

      const computed = window.getComputedStyle(baseImage);
      const raw = computed.objectPosition || "50% 50%";
      const parts = raw.split(/\s+/).filter(Boolean);
      const xPart = parts[0] || "50%";
      const yPart = parts[1] || "50%";

      objectPosition = [
        parsePositionPart(xPart, "x"),
        parsePositionPart(yPart, "y"),
      ];
    };

    const resizeCanvas = () => {
      const rect = host.getBoundingClientRect();
      rectRef.current = rect;

      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const quality = width >= 1600 ? 0.72 : width >= 1100 ? 0.82 : 0.95;
      const nextWidth = Math.max(1, Math.round(width * dpr * quality));
      const nextHeight = Math.max(1, Math.round(height * dpr * quality));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        gl.viewport(0, 0, nextWidth, nextHeight);
      }

      readObjectPosition();
    };

    const image = new Image();
    if (/^https?:/i.test(String(src || ""))) image.crossOrigin = "anonymous";
    image.decoding = "async";

    image.onload = () => {
      if (destroyed) return;

      imageWidth = Math.max(1, image.naturalWidth || image.width || 1);
      imageHeight = Math.max(1, image.naturalHeight || image.height || 1);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );

      readyRef.current = true;
      resizeCanvas();
    };

    image.onerror = () => {
      readyRef.current = false;
    };

    image.src = src;

    const draw = (timestamp) => {
      frameRef.current = 0;

      if (document.hidden || destroyed) return;

      const target = targetRef.current;
      const current = currentRef.current;

      const pointerEase = activeRef.current ? 0.20 : 0.12;
      const velocityEase = activeRef.current ? 0.16 : 0.10;
      const amountEase = activeRef.current ? 0.16 : 0.09;

      current.x += (target.x - current.x) * pointerEase;
      current.y += (target.y - current.y) * pointerEase;
      current.velocityX +=
        (target.velocityX - current.velocityX) * velocityEase;
      current.velocityY +=
        (target.velocityY - current.velocityY) * velocityEase;
      current.amount += (target.amount - current.amount) * amountEase;

      target.velocityX *= 0.82;
      target.velocityY *= 0.82;


      if (readyRef.current) {
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.imageResolution, imageWidth, imageHeight);
        gl.uniform2f(uniforms.mouse, current.x, current.y);
        gl.uniform2f(
          uniforms.velocity,
          current.velocityX,
          current.velocityY
        );
        gl.uniform2f(
          uniforms.objectPosition,
          objectPosition[0],
          objectPosition[1]
        );
        gl.uniform1f(
          uniforms.time,
          (timestamp - startTimeRef.current) / 1000
        );
        gl.uniform1f(uniforms.amount, current.amount);
        gl.uniform1f(
          uniforms.strength,
          Math.max(0.7, Math.min(1.7, Number(strength || 16) / 16))
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      const stillMoving =
        activeRef.current ||
        current.amount > 0.012 ||
        Math.abs(current.velocityX) > 0.002 ||
        Math.abs(current.velocityY) > 0.002 ||
        Math.abs(target.x - current.x) > 0.001 ||
        Math.abs(target.y - current.y) > 0.001;

      if (!activeRef.current && current.amount <= 0.02) {
        layer.classList.remove("is-fluid-active");
      }

      if (stillMoving) {
        frameRef.current = window.requestAnimationFrame(draw);
      }
    };

    const requestFrame = () => {
      if (!frameRef.current && !document.hidden) {
        frameRef.current = window.requestAnimationFrame(draw);
      }
    };

    const updatePointer = (event, first = false) => {
      const rect = rectRef.current;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      const x = Math.max(
        0,
        Math.min(1, (event.clientX - rect.left) / rect.width)
      );
      const y = Math.max(
        0,
        Math.min(1, 1 - (event.clientY - rect.top) / rect.height)
      );

      const previous = previousPointerRef.current;
      const dx = previous ? event.clientX - previous.x : 0;
      const dy = previous ? event.clientY - previous.y : 0;

      previousPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      targetRef.current.x = x;
      targetRef.current.y = y;
      targetRef.current.velocityX = Math.max(
        -1,
        Math.min(1, dx / 34)
      );
      targetRef.current.velocityY = Math.max(
        -1,
        Math.min(1, -dy / 34)
      );
      targetRef.current.amount = 1;

      if (first) {
        currentRef.current.x = x;
        currentRef.current.y = y;
        currentRef.current.velocityX = 0;
        currentRef.current.velocityY = 0;
        currentRef.current.amount = 0.22;
      }

      requestFrame();
    };

    const handleEnter = (event) => {
      resizeCanvas();
      activeRef.current = true;
      targetRef.current.amount = 1;
      startTimeRef.current = performance.now();
      layer.classList.add("is-fluid-active");
      updatePointer(event, true);
    };

    const handleMove = (event) => {
      if (!activeRef.current) {
        resizeCanvas();
        activeRef.current = true;
        targetRef.current.amount = 1;
        startTimeRef.current = performance.now();
        layer.classList.add("is-fluid-active");
      }
      updatePointer(event);
    };

    const handleLeave = () => {
      activeRef.current = false;
      targetRef.current.amount = 0;
      targetRef.current.velocityX *= 0.45;
      targetRef.current.velocityY *= 0.45;
      previousPointerRef.current = null;
      requestFrame();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (frameRef.current) {
          window.cancelAnimationFrame(frameRef.current);
          frameRef.current = 0;
        }
        return;
      }

      if (activeRef.current || currentRef.current.amount > 0.01) {
        requestFrame();
      }
    };

    resizeCanvas();

    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(host);
    } else {
      window.addEventListener("resize", resizeCanvas, { passive: true });
    }

    host.addEventListener("pointerenter", handleEnter, { passive: true });
    host.addEventListener("pointermove", handleMove, { passive: true });
    host.addEventListener("pointerleave", handleLeave, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      destroyed = true;
      readyRef.current = false;
      host.removeEventListener("pointerenter", handleEnter);
      host.removeEventListener("pointermove", handleMove);
      host.removeEventListener("pointerleave", handleLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
      resizeObserver?.disconnect();
      if (!window.ResizeObserver) {
        window.removeEventListener("resize", resizeCanvas);
      }
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
      gl.deleteTexture(texture);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [src, strength]);

  return (
    <div
      ref={layerRef}
      className="hp-fluid-backdrop"
      aria-hidden={alt ? undefined : true}
    >
      <SmartImage
        src={src}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding={decoding}
        style={style}
        className={`hp-fluid-image hp-fluid-image-base ${imageClassName}`}
      />

      <div className="hp-fluid-canvas-wrap" aria-hidden="true">
        <canvas
          ref={canvasRef}
          className={`hp-fluid-canvas ${imageClassName}`}
          style={style}
        />
      </div>
    </div>
  );
};



// ======================================================
// HAMPER ONE · SIGNATURE UNWRAP EXPERIENCE
// Minimal, bold and fully responsive. The section stays simple before
// interaction; supporting copy only appears inside the revealed image.
// ======================================================

const HamperOneUnwrapExperience = () => {
  const [opened, setOpened] = useState(false);

  const reveal = () => setOpened(true);

  return (
    <section
      data-home-section="hamper-one"
      className={`hp-hamper-one-section hp-fluid-host relative isolate overflow-hidden bg-[#060504] text-white ${
        opened ? "is-unwrapped" : ""
      }`}
    >
      <style>{`
        .hp-home-v65 .hp-hamper-one-wrap-design {
          position: absolute;
          inset: 18px;
          z-index: 54;
          overflow: hidden;
          border: 1px solid rgba(240,201,99,.26);
          border-radius: 24px;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.025),
            inset 0 0 34px rgba(212,175,55,.055);
          transition: opacity .58s ease, transform .78s cubic-bezier(.16,1,.3,1);
        }

        .hp-home-v65 .hp-hamper-one-wrap-design::before {
          content: "";
          position: absolute;
          inset: 9px;
          border: 1px solid rgba(212,175,55,.12);
          border-radius: 18px;
          background:
            linear-gradient(115deg, transparent 0 40%, rgba(255,236,173,.05) 46%, transparent 53%),
            repeating-linear-gradient(135deg, rgba(255,255,255,.015) 0 1px, transparent 1px 13px);
        }

        .hp-home-v65 .hp-hamper-one-wrap-design::after {
          content: "HAMPORIUM  ·  PRIVATE SERIES";
          position: absolute;
          left: 50%;
          bottom: 15px;
          transform: translateX(-50%);
          white-space: nowrap;
          color: rgba(244,211,106,.48);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .28em;
        }

        .hp-home-v65 .hp-hamper-one-wrap-corner {
          position: absolute;
          width: 34px;
          height: 34px;
          opacity: .72;
        }

        .hp-home-v65 .hp-hamper-one-wrap-corner::before,
        .hp-home-v65 .hp-hamper-one-wrap-corner::after {
          content: "";
          position: absolute;
          background: linear-gradient(90deg, #8f641f, #f4dd91, #a87522);
        }

        .hp-home-v65 .hp-hamper-one-wrap-corner::before {
          width: 100%;
          height: 1px;
        }

        .hp-home-v65 .hp-hamper-one-wrap-corner::after {
          width: 1px;
          height: 100%;
        }

        .hp-home-v65 .hp-hamper-one-wrap-corner-tl { left: 18px; top: 18px; }
        .hp-home-v65 .hp-hamper-one-wrap-corner-tr { right: 18px; top: 18px; transform: scaleX(-1); }
        .hp-home-v65 .hp-hamper-one-wrap-corner-bl { left: 18px; bottom: 18px; transform: scaleY(-1); }
        .hp-home-v65 .hp-hamper-one-wrap-corner-br { right: 18px; bottom: 18px; transform: scale(-1); }

        .hp-home-v65 .hp-hamper-one-wrap-motif {
          position: absolute;
          inset: 13px;
          border-radius: 20px;
          opacity: .7;
          background:
            radial-gradient(circle at 50% 50%, transparent 0 31%, rgba(244,221,145,.08) 31.3% 31.7%, transparent 32% 42%, rgba(212,175,55,.055) 42.3% 42.7%, transparent 43%),
            repeating-linear-gradient(45deg, transparent 0 22px, rgba(255,255,255,.018) 22px 23px, transparent 23px 45px),
            repeating-linear-gradient(-45deg, transparent 0 25px, rgba(212,175,55,.02) 25px 26px, transparent 26px 50px);
          box-shadow: inset 0 0 0 1px rgba(244,221,145,.04);
        }

        .hp-home-v65 .hp-hamper-one-wrap-jewel {
          position: absolute;
          z-index: 2;
          width: 8px;
          height: 8px;
          border: 1px solid rgba(247,223,149,.72);
          background: linear-gradient(135deg, #7c5015, #f2d77d 48%, #98651d);
          transform: rotate(45deg);
          box-shadow: 0 0 16px rgba(212,175,55,.22);
        }

        .hp-home-v65 .hp-hamper-one-wrap-jewel-a { left: 50%; top: 28px; margin-left: -4px; }
        .hp-home-v65 .hp-hamper-one-wrap-jewel-b { left: 50%; bottom: 30px; margin-left: -4px; }
        .hp-home-v65 .hp-hamper-one-wrap-jewel-c { left: 28px; top: 50%; margin-top: -4px; }
        .hp-home-v65 .hp-hamper-one-wrap-jewel-d { right: 28px; top: 50%; margin-top: -4px; }

        .hp-home-v65 .hp-hamper-one-tap-sign {
          position: absolute;
          z-index: 86;
          left: 50%;
          top: 22px;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 9px;
          border: 1px solid rgba(244,221,145,.38);
          border-radius: 999px;
          background: rgba(9,7,5,.74);
          padding: 10px 16px;
          color: #f5d972;
          box-shadow: 0 12px 32px rgba(0,0,0,.28);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .2em;
          text-transform: uppercase;
          pointer-events: none;
          transition: opacity .5s ease, transform .7s cubic-bezier(.16,1,.3,1);
        }

        .hp-home-v65 .hp-hamper-one-tap-sign::before {
          content: "✦";
          font-size: 10px;
          color: #f7df95;
        }

        .hp-home-v65 .hp-hamper-one-section.is-unwrapped .hp-hamper-one-tap-sign,
        .hp-home-v65 .hp-hamper-one-section.is-unwrapped .hp-hamper-one-wrap-design {
          opacity: 0;
          transform: translateX(-50%) scale(.97);
        }

        .hp-home-v65 .hp-hamper-one-section.is-unwrapped .hp-hamper-one-wrap-design {
          transform: scale(.985);
        }

        .hp-home-v65 .hp-hamper-one-section .hp-unbox-curtain {
          background:
            linear-gradient(90deg, rgba(255,255,255,.03), transparent 15%, rgba(212,175,55,.07) 48%, transparent 75%, rgba(0,0,0,.22)),
            repeating-linear-gradient(90deg, #120d08 0 28px, #090705 28px 56px),
            repeating-linear-gradient(135deg, rgba(244,221,145,.028) 0 1px, transparent 1px 12px);
          box-shadow:
            inset 0 0 50px rgba(212,175,55,.07),
            inset 0 0 0 1px rgba(244,221,145,.025),
            0 0 42px rgba(0,0,0,.34);
        }

        .hp-home-v65 .hp-hamper-one-section .hp-unbox-ribbon {
          background:
            linear-gradient(90deg, #7d5314 0%, #b98527 12%, #efd377 36%, #fff0b1 50%, #d5aa45 68%, #9a691d 88%, #70460d 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.42),
            inset 0 -1px 0 rgba(73,42,6,.28),
            0 8px 24px rgba(0,0,0,.26),
            0 0 22px rgba(212,175,55,.08);
        }

        @media (max-width: 639px) {
          .hp-home-v65 .hp-hamper-one-section {
            height: 100dvh;
            min-height: 100svh;
            max-height: 100dvh;
          }

          .hp-home-v65 .hp-hamper-one-stage {
            height: 100%;
            min-height: 0 !important;
            max-height: 100%;
          }

          .hp-home-v65 .hp-hamper-one-inner {
            height: 100%;
            min-height: 0 !important;
            align-items: stretch;
            padding: max(16px, env(safe-area-inset-top)) 16px max(14px, env(safe-area-inset-bottom));
          }

          .hp-home-v65 .hp-hamper-one-grid {
            height: 100%;
            min-height: 0;
            grid-template-rows: auto auto;
            align-content: center;
            gap: clamp(16px, 2.2svh, 22px);
          }

          .hp-home-v65 .hp-hamper-one-copy-block,
          .hp-home-v65 .hp-hamper-one-visual-wrap {
            min-height: 0;
          }

          .hp-home-v65 .hp-hamper-one-heading {
            font-size: clamp(56px, 15.5vw, 74px) !important;
            line-height: .82 !important;
            letter-spacing: -.045em !important;
          }

          .hp-home-v65 .hp-hamper-one-heading .hp-section-heading-accent {
            margin-top: .08em;
          }

          .hp-home-v65 .hp-hamper-one-actions {
            display: flex !important;
            margin-top: 20px !important;
          }

          .hp-home-v65 .hp-hamper-one-actions > * {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 60px !important;
            padding-inline: 18px !important;
            font-size: 10.5px !important;
            letter-spacing: .14em !important;
          }

          .hp-home-v65 .hp-hamper-one-actions > * > span:last-child {
            font-size: 21px !important;
          }

          .hp-home-v65 .hp-hamper-one-visual-wrap {
            width: min(82vw, 390px) !important;
            height: clamp(320px, 41svh, 420px) !important;
            margin-inline: auto;
            align-self: center;
          }

          .hp-home-v65 .hp-hamper-one-visual {
            height: 100%;
            min-height: 0 !important;
            border-radius: 22px !important;
          }

          .hp-home-v65 .hp-hamper-one-seal {
            width: 78px !important;
            height: 78px !important;
          }

          .hp-home-v65 .hp-hamper-one-reveal-panel {
            left: 12px !important;
            right: auto !important;
            bottom: 12px !important;
            width: min(68%, 238px) !important;
            max-width: 238px !important;
            padding: 12px !important;
            border-radius: 17px !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
          }

          .hp-home-v65 .hp-hamper-one-reveal-panel h3 {
            margin-top: 7px !important;
            font-size: 24px !important;
            line-height: .86 !important;
          }

          .hp-home-v65 .hp-hamper-one-reveal-panel a {
            min-height: 42px !important;
            margin-top: 11px !important;
            padding-inline: 12px !important;
            font-size: 8px !important;
            letter-spacing: .13em !important;
          }

          .hp-home-v65 .hp-hamper-one-wrap-design {
            inset: 10px !important;
            border-radius: 18px !important;
          }

          .hp-home-v65 .hp-hamper-one-tap-sign {
            top: 14px !important;
            padding: 8px 13px !important;
            font-size: 8px !important;
            letter-spacing: .17em !important;
          }
        }

        @media (max-width: 390px) and (max-height: 720px) {
          .hp-home-v65 .hp-hamper-one-inner {
            padding-top: 10px;
            padding-bottom: 10px;
          }

          .hp-home-v65 .hp-hamper-one-grid {
            gap: 10px;
          }

          .hp-home-v65 .hp-hamper-one-heading {
            font-size: 50px !important;
          }

          .hp-home-v65 .hp-hamper-one-actions {
            margin-top: 12px !important;
          }

          .hp-home-v65 .hp-hamper-one-actions > * {
            min-height: 54px !important;
            padding-inline: 14px !important;
            font-size: 9.5px !important;
          }

          .hp-home-v65 .hp-hamper-one-visual-wrap {
            width: min(78vw, 320px) !important;
            height: clamp(255px, 34svh, 305px) !important;
          }

          .hp-home-v65 .hp-hamper-one-reveal-tags {
            display: none;
          }
        }
      `}</style>

      <div className="hp-hamper-one-stage relative min-h-[760px] sm:min-h-[820px] lg:min-h-[900px]">
        <FluidBackdrop
          src={bestsellerCelebrationLuxury}
          alt="HAMPER ONE private collection atmosphere"
          loading="lazy"
          imageClassName="object-cover object-[62%_center] brightness-[.72] saturate-[1.08] contrast-[1.04] sm:object-center"
          strength={20}
        />

        <div className="pointer-events-none absolute inset-0 bg-black/34" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/82 via-black/42 to-black/12" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/54 via-transparent to-black/16" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_26%,rgba(244,120,34,.16),transparent_28%),radial-gradient(circle_at_76%_18%,rgba(212,175,55,.14),transparent_24%)]" />

        <div className="hp-hamper-one-inner relative z-10 mx-auto flex min-h-[760px] w-full max-w-[1920px] items-center px-5 py-14 sm:min-h-[820px] sm:px-8 sm:py-16 lg:min-h-[900px] lg:px-14 xl:px-20 2xl:px-24">
          <div className="hp-hamper-one-grid grid w-full items-center gap-8 lg:grid-cols-[.72fr_1.28fr] lg:gap-12 xl:gap-16">
            <Reveal className="hp-hamper-one-copy-block relative z-20">
              <div className="max-w-[650px]">
                <div className="hp-hamper-one-kicker flex items-center gap-4">
                  <span className="h-px w-10 bg-[#D4AF37] sm:w-14" />
                  <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#F4D36A] sm:text-[10px]">
                    HAMPORIUM · PRIVATE COLLECTION
                  </p>
                </div>

                <h2 className="hp-hamper-one-heading hp-section-heading mt-6 text-[#FFF8E8]">
                  HAMPER
                  <span className="hp-section-heading-accent text-[#D4AF37]">
                    ONE
                  </span>
                </h2>

                <div className="hp-hamper-one-actions mt-8 flex w-full sm:w-auto">
                  <Link
                    to="/hamper-one"
                    className="group inline-flex min-h-[64px] w-full items-center justify-between border border-white/18 bg-black/30 px-6 text-[11px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37]/60 hover:bg-black/48 hover:text-[#F0D06B] sm:w-auto sm:min-w-[285px]"
                  >
                    <span>Enter Hamper One</span>
                    <span className="text-[20px] transition duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </div>
              </div>
            </Reveal>

            <div className="hp-hamper-one-visual-wrap relative z-20 mx-auto w-full max-w-[980px]">
              <div
                role={!opened ? "button" : undefined}
                tabIndex={!opened ? 0 : -1}
                aria-label={!opened ? "Tap to unwrap Hamper One" : undefined}
                onClick={!opened ? reveal : undefined}
                onKeyDown={(event) => {
                  if (!opened && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    reveal();
                  }
                }}
                className={`hp-hamper-one-visual relative min-h-[520px] overflow-hidden rounded-[28px] border border-white/12 bg-black/24 shadow-[0_34px_100px_rgba(0,0,0,.38)] outline-none sm:min-h-[650px] lg:min-h-[710px] ${
                  !opened ? "cursor-pointer" : ""
                }`}
              >
                <SmartImage
                  src={hamperOneLuxury}
                  alt="HAMPER ONE revealed"
                  loading="lazy"
                  className={`absolute inset-0 h-full w-full object-cover object-[60%_center] transition duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] ${
                    opened ? "scale-100 brightness-[1.03] saturate-[1.08]" : "scale-[1.035] brightness-[.78]"
                  }`}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/64 via-transparent to-black/20" />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/8" />

                {/* Revealed copy stays intentionally tiny so the hamper image remains the hero. */}
                <div
                  className={`hp-hamper-one-reveal-panel absolute bottom-3 left-3 z-30 w-[min(72%,340px)] overflow-hidden rounded-[21px] border border-[#F4D36A]/22 bg-[linear-gradient(135deg,rgba(9,6,4,.78),rgba(18,11,6,.58))] p-4 shadow-[0_20px_54px_rgba(0,0,0,.34)] backdrop-blur-lg transition duration-700 sm:bottom-6 sm:left-6 sm:w-[360px] sm:p-5 ${
                    opened
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-8 opacity-0"
                  }`}
                >
                  <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[#D4AF37]/12 blur-3xl" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F4D36A]/70 to-transparent" />

                  <div className="relative z-10">
                    <p className="text-[7px] font-black uppercase tracking-[0.24em] text-[#F4D36A] sm:text-[8px]">
                      HAMPER ONE · REVEALED
                    </p>

                    <h3
                      style={{ fontFamily: DISPLAY_FONT }}
                      className="mt-2 text-[28px] font-semibold leading-[.88] tracking-[-.03em] text-[#FFF8EA] sm:text-[36px]"
                    >
                      Unwrapped.
                      <span className="block italic text-[#E9C754]">Unforgettable.</span>
                    </h3>

                    <Link
                      to="/hamper-one"
                      onClick={(event) => event.stopPropagation()}
                      className="group mt-4 inline-flex min-h-[46px] w-full items-center justify-between bg-[#D4AF37] px-4 text-[9px] font-black uppercase tracking-[0.14em] text-[#16110A] shadow-[0_12px_28px_rgba(212,175,55,.18)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#E8CD6E] sm:w-auto sm:min-w-[230px] sm:px-5 sm:text-[10px]"
                    >
                      <span>Discover Hamper One</span>
                      <span className="text-[18px] transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </Link>
                  </div>
                </div>

                {/* Poster cover */}
                <div
                  className={`absolute inset-0 z-40 transition duration-[900ms] ${
                    opened ? "pointer-events-none opacity-0" : "opacity-100"
                  }`}
                >
                  <SmartImage
                    src={bestsellerExecutiveLuxury}
                    alt="Wrapped HAMPER ONE poster"
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover object-[60%_center] brightness-[.72] saturate-[1.05]"
                  />

                  <div className="absolute inset-0 bg-black/36" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,224,150,.13),transparent_28%),linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.34))]" />

                  <div className="pointer-events-none absolute left-5 top-5 z-[66] rounded-full border border-[#E8CA72]/30 bg-black/36 px-4 py-2 text-[8px] font-black uppercase tracking-[0.22em] text-[#F4D36A] backdrop-blur-md sm:left-7 sm:top-7">
                    Private Series · 01
                  </div>

                  <div
                    className={`hp-hamper-one-wrap-design pointer-events-none absolute transition duration-700 ${
                      opened ? "opacity-0" : "opacity-100"
                    }`}
                    aria-hidden="true"
                  >
                    <span className="hp-hamper-one-wrap-motif" />
                    <span className="hp-hamper-one-wrap-corner hp-hamper-one-wrap-corner-tl" />
                    <span className="hp-hamper-one-wrap-corner hp-hamper-one-wrap-corner-tr" />
                    <span className="hp-hamper-one-wrap-corner hp-hamper-one-wrap-corner-bl" />
                    <span className="hp-hamper-one-wrap-corner hp-hamper-one-wrap-corner-br" />
                    <span className="hp-hamper-one-wrap-jewel hp-hamper-one-wrap-jewel-a" />
                    <span className="hp-hamper-one-wrap-jewel hp-hamper-one-wrap-jewel-b" />
                    <span className="hp-hamper-one-wrap-jewel hp-hamper-one-wrap-jewel-c" />
                    <span className="hp-hamper-one-wrap-jewel hp-hamper-one-wrap-jewel-d" />
                  </div>
                </div>

                {/* Curtain pair */}
                <div
                  className={`hp-unbox-curtain hp-unbox-curtain-left absolute inset-y-0 left-0 z-50 w-1/2 border-r border-[#D4AF37]/16 transition-transform duration-[1250ms] ease-[cubic-bezier(.16,1,.3,1)] ${
                    opened ? "-translate-x-[104%]" : "translate-x-0"
                  }`}
                />

                <div
                  className={`hp-unbox-curtain hp-unbox-curtain-right absolute inset-y-0 right-0 z-50 w-1/2 border-l border-[#D4AF37]/16 transition-transform duration-[1250ms] ease-[cubic-bezier(.16,1,.3,1)] ${
                    opened ? "translate-x-[104%]" : "translate-x-0"
                  }`}
                />

                {/* Ribbon */}
                <div
                  className={`hp-unbox-ribbon absolute left-1/2 top-0 z-[60] h-full w-8 -translate-x-1/2 transition-all duration-[850ms] ease-[cubic-bezier(.16,1,.3,1)] ${
                    opened ? "scale-y-0 opacity-0" : "scale-y-100 opacity-100"
                  }`}
                />

                <div
                  className={`hp-unbox-ribbon absolute left-0 top-1/2 z-[60] h-8 w-full -translate-y-1/2 transition-all duration-[850ms] ease-[cubic-bezier(.16,1,.3,1)] ${
                    opened ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
                  }`}
                />

                <div
                  className={`hp-hamper-one-tap-sign ${
                    opened ? "pointer-events-none opacity-0" : "opacity-100"
                  }`}
                  aria-hidden="true"
                >
                  Tap to unwrap
                </div>

                <button
                  type="button"
                  aria-label="Unwrap Hamper One"
                  onClick={(event) => {
                    event.stopPropagation();
                    reveal();
                  }}
                  className={`hp-hamper-one-seal absolute left-1/2 top-1/2 z-[80] grid h-[94px] w-[94px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#FFE8A5]/52 bg-[radial-gradient(circle_at_34%_28%,#F6E4A3_0%,#D4AF37_46%,#99641C_100%)] text-[#2B1B05] shadow-[0_22px_50px_rgba(0,0,0,.38)] transition-all duration-[780ms] ease-[cubic-bezier(.16,1,.3,1)] sm:h-[102px] sm:w-[102px] ${
                    opened
                      ? "pointer-events-none scale-50 rotate-[28deg] opacity-0"
                      : "scale-100 rotate-0 opacity-100"
                  }`}
                >
                  <span
                    style={{ fontFamily: DISPLAY_FONT }}
                    className="text-[30px] font-bold"
                  >
                    H
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
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

const useHomeEnhancements = (homeRef, reducedMotion) => {
  useEffect(() => {
    const root = homeRef.current;
    if (!root) return undefined;

    const sections = Array.from(root.querySelectorAll("[data-home-section]"));
    const stories = Array.from(root.querySelectorAll(".hp-story-page"));
    const progressFill = root.querySelector(".hp-scroll-progress > span");
    const heroStage = root.querySelector(".hp-hero-stage");
    const heroMotion = heroStage?.querySelector(".hp-hero-motion-layer");
    const heroDim = heroStage?.querySelector(".hp-hero-dim-layer");
    const heroLine = heroStage?.querySelector(".hp-hero-handoff-line");

    let frame = 0;
    let pageTravel = 1;
    let heroTravel = 1;
    let lastScrollY = -1;
    let heroSettled = false;

    const paint = () => {
      frame = 0;
      if (document.hidden) return;

      const y = Math.max(0, window.scrollY);
      if (Math.abs(y - lastScrollY) < 0.5) return;
      lastScrollY = y;

      if (progressFill) {
        const progress = Math.max(0, Math.min(1, y / pageTravel));
        progressFill.style.transform = `scaleX(${progress.toFixed(3)})`;
      }

      if (heroMotion && heroDim && heroLine) {
        if (y <= heroTravel * 1.12) {
          heroSettled = false;
          const p = Math.max(0, Math.min(1, y / heroTravel));
          const scale = reducedMotion ? 1 : 1 + p * 0.018;
          heroMotion.style.transform = `translateZ(0) scale(${scale.toFixed(3)})`;
          heroDim.style.opacity = (0.03 + p * 0.14).toFixed(3);
          heroLine.style.transform = `scaleX(${p.toFixed(3)})`;
        } else if (!heroSettled) {
          heroSettled = true;
          heroMotion.style.transform = reducedMotion
            ? "translateZ(0) scale(1)"
            : "translateZ(0) scale(1.018)";
          heroDim.style.opacity = "0.17";
          heroLine.style.transform = "scaleX(1)";
        }
      }
    };

    const schedule = () => {
      if (!frame && !document.hidden) {
        frame = window.requestAnimationFrame(paint);
      }
    };

    const measure = () => {
      pageTravel = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      heroTravel = Math.max(
        1,
        (heroStage?.offsetHeight || window.innerHeight) * 0.88
      );
      lastScrollY = -1;
      schedule();
    };

    const visibility = () => {
      root.dataset.pageHidden = String(document.hidden);
      if (!document.hidden) measure();
    };

    const resize = window.ResizeObserver ? new ResizeObserver(measure) : null;
    if (heroStage) resize?.observe(heroStage);
    resize?.observe(root);

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    measure();
    visibility();

    const ambientObserver = window.IntersectionObserver
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const isStory = entry.target.classList.contains("hp-story-page");

              if (!isStory) {
                entry.target.classList.toggle("hp-offscreen", !entry.isIntersecting);
              }

              if (entry.isIntersecting && isStory) {
                entry.target.classList.add("is-story-visible");
              }
            });
          },
          { rootMargin: "160px 0px", threshold: 0 }
        )
      : null;

    [...sections, ...stories].forEach((node) => ambientObserver?.observe(node));
    if (!ambientObserver || reducedMotion) {
      stories.forEach((node) => node.classList.add("is-story-visible"));
    }

    // One observer powers every heading reveal. Filters/blurs are intentionally
    // avoided so animations stay compositor-friendly.
    const kineticHeadingSelector =
      'h1:not(.sr-only), h2, h3, h4, [role="heading"]:not(.sr-only)';
    const kineticHeadingNodes = new Set();
    const kineticRevealTimers = new Map();
    const isMobileKinetic = window.matchMedia(
      "(max-width: 767px), (pointer: coarse)"
    ).matches;

    const revealKineticHeading = (heading) => {
      if (!heading || heading.dataset.hpKineticSeen === "true") return;
      heading.dataset.hpKineticSeen = "true";
      heading.classList.add("is-kinetic-visible");
    };

    const queueKineticReveal = (heading) => {
      if (!heading || heading.dataset.hpKineticSeen === "true") return;

      const frameId = window.requestAnimationFrame(() => {
        kineticRevealTimers.delete(heading);
        revealKineticHeading(heading);
      });
      kineticRevealTimers.set(heading, frameId);
    };

    const kineticHeadingObserver =
      !reducedMotion && window.IntersectionObserver
        ? new IntersectionObserver(
            (entries, observer) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                queueKineticReveal(entry.target);
                observer.unobserve(entry.target);
              });
            },
            {
              rootMargin: isMobileKinetic
                ? "0px 0px -1% 0px"
                : "0px 0px -8% 0px",
              threshold: isMobileKinetic ? 0.01 : 0.08,
            }
          )
        : null;

    const registerKineticHeading = (heading) => {
      if (!(heading instanceof HTMLElement)) return;
      if (!heading.matches(kineticHeadingSelector)) return;
      if (heading.classList.contains("sr-only")) return;
      if (kineticHeadingNodes.has(heading)) return;

      kineticHeadingNodes.add(heading);
      heading.classList.add("hp-kinetic-heading");

      let variant = "standard";
      if (heading.classList.contains("hp-section-heading")) variant = "section";
      else if (heading.classList.contains("hp-bestseller-title")) variant = "card";
      else if (heading.closest(".hp-home-quick-dialog")) variant = "dialog";
      else if (heading.matches("h3, h4")) variant = "sub";

      heading.dataset.hpKineticVariant = variant;

      if (variant === "sub") {
        const section = heading.closest("[data-home-section]");
        const peers = section
          ? Array.from(section.querySelectorAll("h3, h4")).filter(
              (node) => !node.classList.contains("sr-only")
            )
          : [];
        if (peers.indexOf(heading) % 2 === 1) {
          heading.style.setProperty("--hp-kinetic-x", "14px");
        }
      }

      if (reducedMotion || !kineticHeadingObserver) {
        revealKineticHeading(heading);
      } else {
        kineticHeadingObserver.observe(heading);
      }
    };

    root.querySelectorAll(kineticHeadingSelector).forEach(registerKineticHeading);

    // Batch async catalogue/modal headings into one animation frame instead of
    // scanning the subtree synchronously for every individual DOM mutation.
    const pendingMutationNodes = new Set();
    let mutationFrame = 0;
    const flushMutations = () => {
      mutationFrame = 0;
      pendingMutationNodes.forEach((node) => {
        registerKineticHeading(node);
        node.querySelectorAll?.(kineticHeadingSelector).forEach(registerKineticHeading);
      });
      pendingMutationNodes.clear();
    };

    const kineticMutationObserver = window.MutationObserver
      ? new MutationObserver((records) => {
          records.forEach((record) => {
            record.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) pendingMutationNodes.add(node);
            });
          });
          if (pendingMutationNodes.size && !mutationFrame) {
            mutationFrame = window.requestAnimationFrame(flushMutations);
          }
        })
      : null;

    kineticMutationObserver?.observe(root, { childList: true, subtree: true });

    return () => {
      resize?.disconnect();
      ambientObserver?.disconnect();
      kineticHeadingObserver?.disconnect();
      kineticMutationObserver?.disconnect();

      if (mutationFrame) window.cancelAnimationFrame(mutationFrame);
      pendingMutationNodes.clear();

      kineticRevealTimers.forEach((frameId) => window.cancelAnimationFrame(frameId));
      kineticRevealTimers.clear();

      kineticHeadingNodes.forEach((heading) => {
        heading.classList.remove("hp-kinetic-heading", "is-kinetic-visible");
        heading.style.removeProperty("--hp-kinetic-x");
        delete heading.dataset.hpKineticSeen;
        delete heading.dataset.hpKineticVariant;
      });

      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", visibility);
      [...sections, ...stories].forEach((node) => node.classList.remove("hp-offscreen"));
    };
  }, [homeRef, reducedMotion]);
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
    const isJourneyRail =
      node.classList.contains("hp-journey-grid") && window.innerWidth <= 1023;

    // Use the rail's REAL client width instead of 100vw for mobile geometry.
    // This prevents scrollbar / browser-chrome width differences from making the
    // left and right previews look uneven.
    if (isJourneyRail) {
      const railWidth = Math.max(1, node.clientWidth);
      const cardWidth = railWidth * 0.74;
      const sideSpace = Math.max(0, (railWidth - cardWidth) / 2);

      node.style.setProperty("--hp-journey-card-width", `${cardWidth.toFixed(2)}px`);
      node.style.setProperty("--hp-journey-side-space", `${sideSpace.toFixed(2)}px`);
      node.style.setProperty("--hp-journey-gap", "14px");
    } else {
      node.style.removeProperty("--hp-journey-card-width");
      node.style.removeProperty("--hp-journey-side-space");
      node.style.removeProperty("--hp-journey-gap");
    }

    let nearest = null;
    let distance = Infinity;

    items.forEach((item) => {
      /*
        IMPORTANT: calculate focus from the unscaled flex-box geometry.
        getBoundingClientRect() already includes the visual scale, which caused a
        feedback loop where the left/right gaps could look slightly different.
      */
      const baseWidth = Math.max(1, item.offsetWidth);
      const layoutLeft = rect.left + item.offsetLeft - node.scrollLeft;
      const itemCenter = layoutLeft + baseWidth / 2;
      const d = Math.abs(itemCenter - center);

      if (d < distance) {
        nearest = item;
        distance = d;
      }

      // Mobile journey cards continuously grow as they approach the viewport center.
      // Center card = 1.00, neighboring/off-center cards = down to 0.62.
      if (isJourneyRail) {
        const travel = Math.max(baseWidth * 0.96, rect.width * 0.58);
        const progress = Math.max(0, Math.min(1, 1 - d / travel));
        const eased = 1 - Math.pow(1 - progress, 2);
        const scale = 0.62 + 0.38 * eased;
        const opacity = 0.50 + 0.50 * eased;

        // Anchor the inner edge of each side card. With one shared gap variable,
        // previous -> active and active -> next now keep the same visual spacing.
        const origin =
          itemCenter > center + 2
            ? "left center"
            : itemCenter < center - 2
              ? "right center"
              : "center center";

        item.style.setProperty("--hp-journey-scroll-scale", scale.toFixed(4));
        item.style.setProperty("--hp-journey-scroll-opacity", opacity.toFixed(4));
        item.style.setProperty("--hp-journey-scale-origin", origin);
        item.style.setProperty("--hp-journey-z", String(Math.max(1, Math.round(eased * 10))));
      } else {
        item.style.removeProperty("--hp-journey-scroll-scale");
        item.style.removeProperty("--hp-journey-scroll-opacity");
        item.style.removeProperty("--hp-journey-scale-origin");
        item.style.removeProperty("--hp-journey-z");
      }
    });

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
