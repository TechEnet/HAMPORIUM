import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../../api/api.js";

import hamperFestiveHero from "../../assets/images/hamper_one_festive.webp";
import hamperExecutiveHero from "../../assets/images/hamper_one_executive.webp";
import hamperWeddingHero from "../../assets/images/hamper_one_wedding.webp";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const HERO_IMAGE =
  hamperFestiveHero;

const HERO_SLIDES = [
  {
    src: hamperFestiveHero,
    position: "62% 54%",
  },
  {
    src: hamperExecutiveHero,
    position: "64% 52%",
  },
  {
    src: hamperWeddingHero,
    position: "66% 50%",
  },
];

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1607344645866-009c320b63e0?auto=format&fit=crop&w=1200&q=90";

// ======================================================
// API IMAGE
// ======================================================

const getApiOrigin = () => {
  const baseURL =
    api.defaults?.baseURL ||
    "";

  return baseURL
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
};

const API_ORIGIN =
  getApiOrigin();

const resolveImage = (
  value
) => {
  if (!value) {
    return "";
  }

  let image = value;

  if (
    typeof image ===
    "object"
  ) {
    image =
      image.url ||
      image.secure_url ||
      image.src ||
      image.path ||
      "";
  }

  if (
    typeof image !==
      "string" ||
    !image
  ) {
    return "";
  }

  if (
    image.startsWith(
      "http://"
    ) ||
    image.startsWith(
      "https://"
    ) ||
    image.startsWith(
      "data:"
    ) ||
    image.startsWith(
      "blob:"
    )
  ) {
    return image;
  }

  if (
    image.startsWith("//")
  ) {
    return `https:${image}`;
  }

  return API_ORIGIN
    ? `${API_ORIGIN}${
        image.startsWith("/")
          ? ""
          : "/"
      }${image}`
    : image;
};

const getProductImage = (
  product
) => {
  const first =
    Array.isArray(
      product?.images
    )
      ? product.images[0]
      : null;

  return (
    resolveImage(first) ||
    FALLBACK_IMAGE
  );
};

// ======================================================
// HAMPER ONE
// ======================================================

const HamperOne = () => {
  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    heroSlide,
    setHeroSlide,
  ] = useState(0);

  const [
    signatureActive,
    setSignatureActive,
  ] = useState(0);

  useEffect(() => {
    let active = true;

    const loadProducts =
      async () => {
        setLoading(true);

        setError("");

        try {
          /*
           * Product Master importer adds "hamper-one"
           * to Product.tags when HAMPER ONE? = Yes.
           *
           * Existing catalog search already searches tags,
           * so no new backend endpoint is required.
           */
          const response =
            await api.get(
              "/catalog/products",
              {
                params: {
                  search:
                    "hamper-one",

                  sort:
                    "featured",

                  limit: 12,
                },
              }
            );

          if (!active) {
            return;
          }

          setProducts(
            response.data
              .products ||
              []
          );
        } catch (
          requestError
        ) {
          if (!active) {
            return;
          }

          console.error(
            "HAMPER ONE products error:",
            requestError
          );

          setError(
            requestError
              .response?.data
              ?.message ||
              "Unable to load the HAMPER ONE collection."
          );
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const interval =
      setInterval(
        () => {
          setSignatureActive(
            (current) =>
              (current + 1) % 4
          );
        },
        3400
      );

    return () => {
      clearInterval(
        interval
      );
    };
  }, []);

  useEffect(() => {
    if (
      typeof Image !==
      "undefined"
    ) {
      HERO_SLIDES.forEach(
        (slide) => {
          const image =
            new Image();

          image.src =
            slide.src;
        }
      );
    }

    const interval =
      setInterval(
        () => {
          setHeroSlide(
            (current) =>
              (
                current + 1
              ) %
              HERO_SLIDES.length
          );
        },
        3000
      );

    return () => {
      clearInterval(
        interval
      );
    };
  }, []);

  useEffect(() => {
    const elements =
      document.querySelectorAll(
        ".ho-reveal"
      );

    if (
      typeof IntersectionObserver ===
      "undefined"
    ) {
      elements.forEach(
        (element) =>
          element.classList.add(
            "ho-in"
          )
      );

      return undefined;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          entries.forEach(
            (entry) => {
              if (
                entry.isIntersecting
              ) {
                entry.target.classList.add(
                  "ho-in"
                );

                observer.unobserve(
                  entry.target
                );
              }
            }
          );
        },
        {
          threshold: 0.14,
          rootMargin:
            "0px 0px -7% 0px",
        }
      );

    elements.forEach(
      (element) =>
        observer.observe(
          element
        )
    );

    return () => {
      observer.disconnect();
    };
  }, [
    loading,
    products.length,
  ]);

  return (
    <main
      className="min-h-screen overflow-x-clip bg-[#070706] text-[#F7F0DF]"
      style={{
        fontFamily:
          "'Manrope', Arial, sans-serif",
      }}
    >
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700;800&display=swap');

          :root {
            --ho-gold: #D4AF37;
            --ho-orange: #F47822;
            --ho-cream: #F5E8C5;
            --ho-ink: #080807;
          }

          .ho-display {
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
          }

          .ho-reveal {
            opacity: 0;
            transform:
              translate3d(
                0,
                34px,
                0
              );
            transition:
              opacity .85s ease,
              transform .95s
              cubic-bezier(.22,1,.36,1);
          }

          .ho-reveal.ho-in {
            opacity: 1;
            transform:
              translate3d(
                0,
                0,
                0
              );
          }

          .ho-reveal-delay-1 {
            transition-delay: .08s;
          }

          .ho-reveal-delay-2 {
            transition-delay: .16s;
          }

          .ho-reveal-delay-3 {
            transition-delay: .24s;
          }

          /* ==============================================
             HERO · V5 PRIVATE EDIT
          =============================================== */

          .ho-hero {
            position: relative;
            min-height: 100svh;
            overflow: hidden;
            isolation: isolate;
            background:
              radial-gradient(
                circle at 82% 24%,
                rgba(212,175,55,.18),
                transparent 34%
              ),
              linear-gradient(
                135deg,
                #050505 0%,
                #0A0908 34%,
                #130D0A 68%,
                #070706 100%
              );
          }

          .ho-hero-bg {
            position: absolute;
            inset: 0;
            z-index: -4;
          }

          .ho-hero-bg img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            filter:
              saturate(.92)
              contrast(.96)
              brightness(.48);
            transform: scale(1.06);
            animation:
              hoHeroBreath 18s ease-in-out
              infinite alternate;
          }

          @keyframes hoHeroBreath {
            from {
              transform: scale(1.04);
            }

            to {
              transform: scale(1.11);
            }
          }

          .ho-hero-bg::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              linear-gradient(
                90deg,
                rgba(4,4,4,.98) 0%,
                rgba(4,4,4,.92) 28%,
                rgba(5,5,5,.68) 53%,
                rgba(5,5,5,.35) 76%,
                rgba(5,5,5,.76) 100%
              ),
              linear-gradient(
                180deg,
                rgba(0,0,0,.28),
                transparent 38%,
                rgba(5,5,5,.88)
              );
          }

          .ho-hero-noise {
            position: absolute;
            inset: 0;
            z-index: -3;
            pointer-events: none;
            opacity: .14;
            background-image:
              radial-gradient(
                rgba(255,255,255,.62) .52px,
                transparent .52px
              );
            background-size: 7px 7px;
            mix-blend-mode: soft-light;
          }

          .ho-hero-glow {
            position: absolute;
            z-index: -2;
            inset: auto auto 6% -8%;
            width: min(42vw, 560px);
            aspect-ratio: 1;
            border-radius: 999px;
            background:
              radial-gradient(
                circle,
                rgba(212,175,55,.18),
                rgba(244,120,34,.08) 40%,
                transparent 72%
              );
            filter: blur(30px);
            pointer-events: none;
          }

          .ho-hero-grid {
            display: grid;
            min-height: 100svh;
            grid-template-columns:
              minmax(0,.88fr)
              minmax(0,1.12fr);
            align-items: center;
            gap: clamp(34px, 4.2vw, 78px);
            padding:
              clamp(118px,11vw,156px)
              clamp(20px,4.5vw,78px)
              clamp(68px,6vw,92px);
          }

          .ho-kicker {
            display: flex;
            align-items: center;
            gap: 11px;
            color: var(--ho-gold);
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .27em;
            text-transform: uppercase;
          }

          .ho-kicker::before {
            content: "";
            width: 42px;
            height: 1px;
            background:
              linear-gradient(
                90deg,
                var(--ho-orange),
                var(--ho-gold)
              );
          }

          .ho-hero-copy-block {
            max-width: 640px;
          }

          .ho-hero-chip-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 18px;
          }

          .ho-hero-chip {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            min-height: 34px;
            padding: 0 13px;
            border: 1px solid rgba(212,175,55,.24);
            background: rgba(255,255,255,.04);
            backdrop-filter: blur(10px);
            color: rgba(255,255,255,.70);
            font-size: 8px;
            font-weight: 900;
            letter-spacing: .16em;
            text-transform: uppercase;
          }

          .ho-hero-chip::before {
            content: "✦";
            color: var(--ho-gold);
            font-size: 9px;
          }

          .ho-hero-title {
            margin: 22px 0 0;
            color: #F4E8C9;
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
            font-size:
              clamp(72px,8vw,126px);
            font-weight: 600;
            line-height: .78;
            letter-spacing: -.05em;
            text-wrap: balance;
          }

          .ho-hero-title span {
            display: block;
            margin-top: .14em;
            color: var(--ho-gold);
            font-size:
              clamp(40px,3.4vw,58px);
            font-style: italic;
            line-height: .96;
            text-shadow:
              0 14px 48px
              rgba(212,175,55,.15);
          }

          .ho-hero-copy {
            max-width: 560px;
            margin-top: 20px;
            color: rgba(255,255,255,.58);
            font-size: 13px;
            font-weight: 500;
            line-height: 1.9;
          }

          .ho-hero-points {
            display: grid;
            grid-template-columns:
              repeat(3,minmax(0,1fr));
            gap: 12px;
            max-width: 620px;
            margin-top: 28px;
          }

          .ho-hero-point {
            min-height: 108px;
            padding: 18px 16px;
            border: 1px solid rgba(212,175,55,.18);
            background:
              linear-gradient(
                180deg,
                rgba(255,255,255,.05),
                rgba(255,255,255,.015)
              );
            backdrop-filter: blur(10px);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.03);
          }

          .ho-hero-point strong {
            display: block;
            color: #F3E6C1;
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size: 24px;
            font-weight: 600;
            line-height: 1;
          }

          .ho-hero-point span {
            display: block;
            margin-top: 10px;
            color: rgba(255,255,255,.48);
            font-size: 10px;
            font-weight: 700;
            line-height: 1.65;
          }

          .ho-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 30px;
          }

          .ho-action-primary,
          .ho-action-secondary {
            display: inline-flex;
            height: 54px;
            align-items: center;
            justify-content: center;
            gap: 15px;
            padding: 0 24px;
            text-decoration: none;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .13em;
            text-transform: uppercase;
            transition:
              transform .38s
              cubic-bezier(.22,1,.36,1),
              background-color .3s ease,
              border-color .3s ease,
              color .3s ease,
              box-shadow .3s ease;
          }

          .ho-action-primary {
            color: #111;
            border: 1px solid var(--ho-gold);
            background: var(--ho-gold);
            box-shadow:
              0 14px 30px
              rgba(212,175,55,.12);
          }

          .ho-action-primary:hover {
            transform: translateY(-3px);
            background: #E6CA6D;
            box-shadow:
              0 19px 36px
              rgba(212,175,55,.19);
          }

          .ho-action-secondary {
            color: #fff;
            border:
              1px solid rgba(255,255,255,.18);
            background:
              rgba(0,0,0,.27);
            backdrop-filter: blur(10px);
          }

          .ho-action-secondary:hover {
            transform: translateY(-3px);
            color: #ECD17A;
            border-color:
              rgba(212,175,55,.58);
          }

          .ho-hero-visual {
            position: relative;
            width: min(100%, 820px);
            margin-left: auto;
          }

          .ho-hero-stage {
            position: relative;
            min-height: 640px;
            padding: 32px 0 34px 48px;
          }

          .ho-hero-stage::before {
            content: "";
            position: absolute;
            right: 2%;
            top: 7%;
            width: min(46vw, 560px);
            aspect-ratio: 1;
            border-radius: 999px;
            border: 1px solid rgba(212,175,55,.10);
            box-shadow:
              inset 0 0 0 26px rgba(212,175,55,.03);
          }

          .ho-hero-main-card {
            position: relative;
            z-index: 2;
            overflow: hidden;
            border: 1px solid rgba(212,175,55,.24);
            background:
              linear-gradient(
                145deg,
                rgba(255,255,255,.05),
                rgba(255,255,255,.015)
              );
            box-shadow:
              0 36px 92px rgba(0,0,0,.40);
            backdrop-filter: blur(8px);
          }

          .ho-hero-main-card::before {
            content: "";
            position: absolute;
            inset: 12px;
            z-index: 3;
            pointer-events: none;
            border: 1px solid rgba(243,218,149,.13);
          }

          .ho-hero-main-media {
            position: relative;
            height: 520px;
            overflow: hidden;
            background: #101010;
          }

          .ho-hero-main-media::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              linear-gradient(
                to top,
                rgba(0,0,0,.62),
                rgba(0,0,0,.08) 52%,
                transparent
              );
          }

          .ho-hero-main-media img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            transition:
              transform 1.25s cubic-bezier(.22,1,.36,1),
              filter .45s ease;
          }

          .ho-hero-main-card:hover .ho-hero-main-media img {
            transform: scale(1.06);
            filter: saturate(1.03);
          }

          .ho-hero-main-copy {
            position: absolute;
            z-index: 4;
            left: 28px;
            right: 28px;
            bottom: 24px;
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 16px;
          }

          .ho-hero-main-copy p:first-child {
            color: #F0D67C;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: .16em;
            text-transform: uppercase;
          }

          .ho-hero-main-copy h2 {
            margin-top: 8px;
            max-width: 360px;
            color: rgba(255,255,255,.92);
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size:
              clamp(28px,2.3vw,40px);
            font-weight: 600;
            line-height: .96;
          }

          .ho-hero-main-copy span {
            color: rgba(255,255,255,.56);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .18em;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .ho-hero-floating-note {
            position: absolute;
            z-index: 4;
            top: 0;
            right: 0;
            width: min(270px, 34vw);
            padding: 18px 20px;
            border: 1px solid rgba(212,175,55,.22);
            background:
              linear-gradient(
                180deg,
                rgba(14,13,11,.95),
                rgba(14,13,11,.78)
              );
            box-shadow:
              0 22px 60px rgba(0,0,0,.28);
            backdrop-filter: blur(14px);
          }

          .ho-hero-floating-note p:first-child {
            color: var(--ho-gold);
            font-size: 7px;
            font-weight: 900;
            letter-spacing: .16em;
            text-transform: uppercase;
          }

          .ho-hero-floating-note h3 {
            margin-top: 12px;
            color: #F2E5C1;
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size: 28px;
            font-weight: 600;
            line-height: .96;
          }

          .ho-hero-floating-note p:last-child {
            margin-top: 10px;
            color: rgba(255,255,255,.54);
            font-size: 10px;
            line-height: 1.7;
          }

          .ho-hero-detail-card {
            position: absolute;
            z-index: 5;
            left: 0;
            bottom: 0;
            display: grid;
            grid-template-columns: 108px 1fr;
            align-items: center;
            gap: 16px;
            width: min(400px, 78%);
            padding: 14px;
            border: 1px solid rgba(212,175,55,.22);
            background:
              linear-gradient(
                145deg,
                rgba(11,11,10,.96),
                rgba(16,14,12,.88)
              );
            box-shadow:
              0 20px 56px rgba(0,0,0,.38);
            backdrop-filter: blur(14px);
          }

          .ho-hero-detail-thumb {
            overflow: hidden;
            border: 1px solid rgba(212,175,55,.12);
            background: #121212;
            aspect-ratio: .95 / .92;
          }

          .ho-hero-detail-thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition:
              transform 1.05s cubic-bezier(.22,1,.36,1);
          }

          .ho-hero-detail-card:hover .ho-hero-detail-thumb img {
            transform: scale(1.07);
          }

          .ho-hero-detail-copy p:first-child {
            color: rgba(255,255,255,.46);
            font-size: 8px;
            font-weight: 900;
            letter-spacing: .16em;
            text-transform: uppercase;
          }

          .ho-hero-detail-copy h3 {
            margin-top: 9px;
            color: #F2E5C0;
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size: 27px;
            font-weight: 600;
            line-height: .98;
          }

          .ho-hero-detail-copy p:last-child {
            margin-top: 9px;
            color: rgba(255,255,255,.53);
            font-size: 10px;
            line-height: 1.7;
          }

          .ho-hero-badge {
            position: absolute;
            z-index: 5;
            right: 22px;
            bottom: 26px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 116px;
            min-height: 40px;
            padding: 0 18px;
            border: 1px solid rgba(212,175,55,.24);
            background: rgba(255,255,255,.07);
            backdrop-filter: blur(10px);
            color: #F8EECF;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: .18em;
            text-transform: uppercase;
          }

          /* ==============================================
             MOVING PRIVATE STRIP
          =============================================== */

          .ho-ticker {
            position: relative;
            overflow: hidden;
            border-top:
              1px solid rgba(212,175,55,.20);
            border-bottom:
              1px solid rgba(212,175,55,.20);
            background:
              linear-gradient(
                90deg,
                #0B0A08 0%,
                #12100C 50%,
                #0B0A08 100%
              );
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.02),
              inset 0 -1px 0 rgba(255,255,255,.015);
          }

          .ho-ticker::before,
          .ho-ticker::after {
            content: "";
            position: absolute;
            top: 0;
            bottom: 0;
            z-index: 3;
            width: clamp(24px, 5vw, 92px);
            pointer-events: none;
          }

          .ho-ticker::before {
            left: 0;
            background:
              linear-gradient(
                90deg,
                #0B0A08 0%,
                rgba(11,10,8,.88) 28%,
                rgba(11,10,8,0) 100%
              );
          }

          .ho-ticker::after {
            right: 0;
            background:
              linear-gradient(
                270deg,
                #0B0A08 0%,
                rgba(11,10,8,.88) 28%,
                rgba(11,10,8,0) 100%
              );
          }

          .ho-ticker-track {
            display: flex;
            width: max-content;
            min-width: max-content;
            transform:
              translate3d(0,0,0);
            backface-visibility: hidden;
            perspective: 1000px;
            will-change: transform;
            animation:
              hoTicker 48s linear infinite;
          }

          .ho-ticker-sequence {
            display: flex;
            flex: 0 0 auto;
            width: max-content;
            min-width: max-content;
          }

          .ho-ticker-item {
            display: inline-flex;
            flex: 0 0 auto;
            height: 56px;
            align-items: center;
            gap: 16px;
            padding: 0 34px 0 0;
            color:
              rgba(248,236,204,.84);
            font-family:
              'Manrope',
              Arial,
              sans-serif;
            font-size: 10px;
            font-weight: 700;
            line-height: 1;
            letter-spacing: .135em;
            text-transform: uppercase;
            white-space: nowrap;
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
          }

          .ho-ticker-item span {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #D4AF37;
            font-size: 10px;
            line-height: 1;
            opacity: .94;
            transform: translateY(-.5px);
          }

          @keyframes hoTicker {
            0% {
              transform:
                translate3d(0,0,0);
            }

            100% {
              transform:
                translate3d(-50%,0,0);
            }
          }

          /* ==============================================
             HAMPER ONE · PRIVATE SIGNATURES · V11
          =============================================== */

          .ho-values {
            position: relative;
            overflow: hidden;
            background:
              radial-gradient(
                circle at 15% 12%,
                rgba(244,120,34,.08),
                transparent 28%
              ),
              radial-gradient(
                circle at 84% 82%,
                rgba(212,175,55,.10),
                transparent 32%
              ),
              linear-gradient(
                180deg,
                #090908 0%,
                #0D0B09 52%,
                #080807 100%
              );
            border-bottom:
              1px solid rgba(255,255,255,.07);
          }

          .ho-values::before {
            content: "PRIVATE";
            position: absolute;
            right: -2vw;
            top: -2vw;
            color:
              rgba(212,175,55,.027);
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size: 17vw;
            font-style: italic;
            line-height: .82;
            pointer-events: none;
          }

          .ho-values::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            height: 1px;
            background:
              linear-gradient(
                90deg,
                transparent,
                #F47822 12%,
                #D4AF37 38%,
                rgba(212,175,55,.14) 70%,
                transparent
              );
          }

          .ho-signatures-shell {
            position: relative;
            z-index: 2;
            padding:
              clamp(68px,6.4vw,102px)
              clamp(16px,4vw,70px)
              clamp(72px,6.5vw,108px);
          }

          .ho-signatures-head {
            display: grid;
            grid-template-columns:
              minmax(0,.92fr)
              minmax(0,1.08fr);
            gap: clamp(30px,5vw,78px);
            align-items: end;
            margin-bottom: 34px;
          }

          .ho-signatures-kicker {
            display: flex;
            align-items: center;
            gap: 11px;
            color: #D4AF37;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .25em;
            text-transform: uppercase;
          }

          .ho-signatures-kicker::before {
            content: "";
            width: 42px;
            height: 1px;
            background:
              linear-gradient(
                90deg,
                #F47822,
                #D4AF37
              );
          }

          .ho-signatures-title {
            margin-top: 17px;
            color: #F3E6C3;
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
            font-size:
              clamp(52px,5.1vw,82px);
            font-weight: 600;
            line-height: .88;
            letter-spacing: -.04em;
          }

          .ho-signatures-title span {
            display: block;
            color: #D4AF37;
            font-style: italic;
          }

          .ho-signatures-copy {
            max-width: 690px;
            padding-left: 28px;
            border-left:
              1px solid rgba(212,175,55,.27);
            color:
              rgba(255,255,255,.54);
            font-size: 13px;
            line-height: 1.92;
          }

          .ho-signatures-rail {
            display: flex;
            gap: 12px;
            min-height: 560px;
          }

          .ho-signature-panel {
            position: relative;
            flex: .76 1 0%;
            min-width: 0;
            opacity: 1 !important;
            visibility: visible !important;
            transform:
              translate3d(0,0,0);
            overflow: hidden;
            cursor: pointer;
            border:
              1px solid rgba(212,175,55,.15);
            background: #10100F;
            box-shadow:
              0 20px 50px rgba(0,0,0,.16);
            transition:
              flex .95s
              cubic-bezier(.22,1,.36,1),
              transform .62s
              cubic-bezier(.22,1,.36,1),
              border-color .5s ease,
              box-shadow .5s ease,
              filter .5s ease;
          }

          .ho-signature-panel.is-active {
            flex: 1.62 1 0%;
            transform:
              translate3d(0,-6px,0);
            border-color:
              rgba(212,175,55,.45);
            box-shadow:
              0 34px 78px rgba(0,0,0,.26),
              0 0 0 1px rgba(212,175,55,.08);
          }

          .ho-signature-panel:not(.is-active) {
            filter:
              saturate(.84)
              brightness(.86);
          }

          .ho-signature-panel:not(.is-active)
          .ho-signature-title {
            color:
              rgba(247,235,203,.86);
          }

          .ho-signature-panel:not(.is-active)
          .ho-signature-foot {
            opacity: .52;
          }

          .ho-signature-panel::before {
            content: "";
            position: absolute;
            inset: 9px;
            z-index: 3;
            pointer-events: none;
            border:
              1px solid rgba(245,220,151,.12);
            transition:
              border-color .45s ease;
          }

          .ho-signature-panel.is-active::before {
            border-color:
              rgba(245,220,151,.24);
          }

          .ho-signature-media {
            position: absolute;
            inset: 0;
            overflow: hidden;
          }

          .ho-signature-media img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            transform: scale(1.035);
            filter:
              saturate(.86)
              brightness(.72);
            transition:
              transform 1.25s
              cubic-bezier(.22,1,.36,1),
              filter .72s ease;
          }

          .ho-signature-panel.is-active {
            filter: none;
          }

          .ho-signature-panel.is-active
          .ho-signature-media img {
            transform: scale(1.085);
            filter:
              saturate(1.04)
              brightness(.96);
          }

          .ho-signature-media::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              linear-gradient(
                180deg,
                rgba(0,0,0,.16) 0%,
                rgba(0,0,0,.04) 34%,
                rgba(0,0,0,.68) 72%,
                rgba(0,0,0,.94) 100%
              );
          }

          .ho-signature-panel::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 2;
            pointer-events: none;
            opacity: 0;
            background:
              linear-gradient(
                120deg,
                transparent 20%,
                rgba(255,242,193,.10) 43%,
                transparent 66%
              );
            transform: translateX(-75%);
          }

          .ho-signature-panel.is-active::after {
            opacity: 1;
            animation:
              hoSignatureLight 1.5s
              cubic-bezier(.22,1,.36,1)
              both;
          }

          @keyframes hoSignatureLight {
            from {
              transform: translateX(-75%);
            }

            to {
              transform: translateX(125%);
            }
          }

          .ho-signature-top {
            position: absolute;
            z-index: 5;
            top: 24px;
            left: 24px;
            right: 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .ho-signature-number {
            color: #F2D67C;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: .20em;
          }

          .ho-signature-state {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color:
              rgba(255,255,255,.54);
            font-size: 7px;
            font-weight: 900;
            letter-spacing: .15em;
            text-transform: uppercase;
            opacity: 0;
            transform: translateY(-5px);
            transition:
              opacity .45s ease,
              transform .45s ease;
          }

          .ho-signature-state::before {
            content: "";
            width: 18px;
            height: 1px;
            background: #D4AF37;
          }

          .ho-signature-panel.is-active
          .ho-signature-state {
            opacity: 1;
            transform: translateY(0);
          }

          .ho-signature-copy {
            position: absolute;
            z-index: 5;
            left: 24px;
            right: 24px;
            bottom: 24px;
          }

          .ho-signature-label {
            color: #F0D57B;
            font-size: 7px;
            font-weight: 900;
            letter-spacing: .16em;
            text-transform: uppercase;
          }

          .ho-signature-title {
            max-width: 420px;
            margin-top: 10px;
            color: #F7EBCB;
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
            font-size:
              clamp(30px,2.6vw,46px);
            font-weight: 600;
            line-height: .94;
            letter-spacing: -.025em;
            transition:
              transform .58s
              cubic-bezier(.22,1,.36,1);
          }

          .ho-signature-panel.is-active
          .ho-signature-title {
            transform: translateY(-4px);
          }

          .ho-signature-description {
            max-width: 430px;
            max-height: 0;
            margin-top: 0;
            overflow: hidden;
            color:
              rgba(255,255,255,.58);
            font-size: 11px;
            line-height: 1.72;
            opacity: 0;
            transform: translateY(10px);
            transition:
              max-height .65s
              cubic-bezier(.22,1,.36,1),
              opacity .5s ease,
              transform .58s
              cubic-bezier(.22,1,.36,1),
              margin-top .45s ease;
          }

          .ho-signature-panel.is-active
          .ho-signature-description {
            max-height: 100px;
            margin-top: 12px;
            opacity: 1;
            transform: translateY(0);
          }

          .ho-signature-foot {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-top: 18px;
            padding-top: 15px;
            border-top:
              1px solid rgba(255,255,255,.11);
            opacity: .72;
          }

          .ho-signature-foot span:first-child {
            color:
              rgba(255,255,255,.43);
            font-size: 7px;
            font-weight: 900;
            letter-spacing: .13em;
            text-transform: uppercase;
          }

          .ho-signature-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #D4AF37;
            box-shadow:
              0 0 18px
              rgba(212,175,55,.42);
          }

          .ho-signatures-progress {
            display: grid;
            grid-template-columns:
              repeat(4,minmax(0,1fr));
            gap: 8px;
            margin-top: 16px;
          }

          .ho-signatures-progress button {
            position: relative;
            height: 3px;
            overflow: hidden;
            border: 0;
            padding: 0;
            background:
              rgba(255,255,255,.10);
            cursor: pointer;
          }

          .ho-signatures-progress button::after {
            content: "";
            position: absolute;
            inset: 0;
            transform: scaleX(0);
            transform-origin: left;
            background:
              linear-gradient(
                90deg,
                #F47822,
                #D4AF37
              );
          }

          .ho-signatures-progress button.is-active::after {
            animation:
              hoSignatureProgress 3.4s
              linear both;
          }

          @keyframes hoSignatureProgress {
            to {
              transform: scaleX(1);
            }
          }

          @media (max-width: 1023px) {
            .ho-signatures-head {
              grid-template-columns: 1fr;
              gap: 25px;
            }

            .ho-signatures-copy {
              max-width: 760px;
            }

            .ho-signatures-rail {
              min-height: 500px;
            }

            .ho-signature-panel {
              flex: .72 1 0%;
            }

            .ho-signature-panel.is-active {
              flex: 1.45 1 0%;
            }
          }

          @media (max-width: 767px) {
            .ho-signatures-shell {
              padding:
                58px 0
                62px;
            }

            .ho-signatures-head {
              padding: 0 16px;
              margin-bottom: 26px;
            }

            .ho-signatures-title {
              font-size:
                clamp(46px,13vw,64px);
            }

            .ho-signatures-copy {
              padding:
                19px 0 0;
              border-left: 0;
              border-top:
                1px solid rgba(212,175,55,.24);
              font-size: 12px;
              line-height: 1.8;
            }

            .ho-signatures-rail {
              width: 100%;
              min-height: 0;
              overflow-x: auto;
              overflow-y: hidden;
              gap: 12px;
              padding:
                6px 16px
                14px;
              scroll-snap-type:
                x mandatory;
              scrollbar-width: none;
              -webkit-overflow-scrolling: touch;
            }

            .ho-signatures-rail::-webkit-scrollbar {
              display: none;
            }

            .ho-signature-panel,
            .ho-signature-panel.is-active {
              flex:
                0 0
                min(82vw, 390px);
              width:
                min(82vw, 390px);
              min-width:
                min(82vw, 390px);
              height: 470px;
              transform: none;
              scroll-snap-align: center;
            }

            .ho-signature-media img,
            .ho-signature-panel.is-active
            .ho-signature-media img {
              transform: scale(1.05);
              filter:
                saturate(.98)
                brightness(.88);
            }

            .ho-signature-description,
            .ho-signature-panel.is-active
            .ho-signature-description {
              max-height: 100px;
              margin-top: 11px;
              opacity: 1;
              transform: none;
            }

            .ho-signature-state,
            .ho-signature-panel.is-active
            .ho-signature-state {
              opacity: 1;
              transform: none;
            }

            .ho-signature-title {
              font-size: 34px;
            }

            .ho-signatures-progress {
              margin:
                2px 16px 0;
            }
          }

          /* ==============================================
             EDITORIAL
          =============================================== */

          /* ==============================================
             PRIVATE EDITORIAL GALLERY · V4
          =============================================== */

          .ho-editorial {
            position: relative;
            overflow: hidden;
            background:
              linear-gradient(
                180deg,
                #090908 0%,
                #0D0B09 48%,
                #080807 100%
              );
          }

          .ho-editorial::before {
            content: "01";
            position: absolute;
            left: -2vw;
            top: 1vw;
            color:
              rgba(212,175,55,.035);
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size: 30vw;
            font-style: italic;
            line-height: .72;
            pointer-events: none;
          }

          .ho-editorial::after {
            content: "";
            position: absolute;
            right: -12%;
            top: 4%;
            width: 44vw;
            aspect-ratio: 1;
            border-radius: 999px;
            background:
              radial-gradient(
                circle,
                rgba(212,175,55,.12),
                transparent 68%
              );
            filter: blur(24px);
            pointer-events: none;
          }

          .ho-editorial-wrap {
            position: relative;
            z-index: 2;
            padding:
              clamp(72px, 7vw, 112px)
              clamp(20px, 4.5vw, 78px);
          }

          .ho-editorial-head {
            display: grid;
            grid-template-columns:
              minmax(0, .82fr)
              minmax(0, 1.18fr);
            align-items: end;
            gap: 54px;
            margin-bottom: 42px;
          }

          .ho-editorial-title {
            margin-top: 17px;
            max-width: 700px;
            color: #F2E5C0;
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size:
              clamp(52px, 5vw, 80px);
            font-weight: 600;
            line-height: .88;
            letter-spacing: -.04em;
          }

          .ho-editorial-title span {
            display: block;
            color: var(--ho-gold);
            font-style: italic;
          }

          .ho-editorial-intro {
            position: relative;
            max-width: 700px;
            padding:
              18px 0 2px 28px;
            border-left:
              1px solid rgba(212,175,55,.30);
            color:
              rgba(255,255,255,.56);
            font-size: 13px;
            font-weight: 500;
            line-height: 1.95;
          }

          .ho-editorial-intro::before {
            content: "";
            position: absolute;
            left: -1px;
            top: 18px;
            width: 1px;
            height: 62px;
            background:
              linear-gradient(
                to bottom,
                #F47822,
                #D4AF37,
                transparent
              );
          }

          .ho-editorial-stage {
            display: grid;
            grid-template-columns:
              minmax(0, 1.32fr)
              minmax(310px, .68fr);
            gap: 18px;
            min-height: 560px;
          }

          .ho-editorial-main {
            position: relative;
            overflow: hidden;
            min-height: 560px;
            border:
              1px solid rgba(212,175,55,.20);
            background: #111;
            box-shadow:
              0 28px 74px rgba(0,0,0,.22);
          }

          .ho-editorial-main::before {
            content: "";
            position: absolute;
            inset: 10px;
            z-index: 3;
            pointer-events: none;
            border:
              1px solid rgba(243,218,149,.15);
          }

          .ho-editorial-main img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            transform: scale(1.015);
            transition:
              transform 1.2s cubic-bezier(.22,1,.36,1),
              filter .7s ease;
          }

          .ho-editorial-main:hover img {
            transform: scale(1.055);
            filter:
              saturate(1.04)
              contrast(1.03);
          }

          .ho-editorial-main::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              linear-gradient(
                180deg,
                rgba(0,0,0,.06),
                transparent 48%,
                rgba(0,0,0,.66) 100%
              );
            pointer-events: none;
          }

          .ho-editorial-main-copy {
            position: absolute;
            z-index: 5;
            left: 28px;
            right: 28px;
            bottom: 26px;
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 18px;
          }

          .ho-editorial-main-copy p:first-child {
            color: #F0D67C;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: .16em;
            text-transform: uppercase;
          }

          .ho-editorial-main-copy p:last-child {
            margin-top: 7px;
            max-width: 460px;
            color: rgba(255,255,255,.86);
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size:
              clamp(24px,2.2vw,36px);
            font-style: italic;
            line-height: 1;
          }

          .ho-editorial-main-number {
            flex: 0 0 auto;
            color:
              rgba(255,255,255,.50);
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size: 16px;
            font-style: italic;
          }

          .ho-editorial-side {
            display: grid;
            grid-template-rows:
              minmax(0, 1.05fr)
              minmax(0, .95fr);
            gap: 18px;
          }

          .ho-editorial-side-image {
            position: relative;
            overflow: hidden;
            min-height: 0;
            border:
              1px solid rgba(212,175,55,.18);
            background: #111;
          }

          .ho-editorial-side-image::before {
            content: "";
            position: absolute;
            inset: 8px;
            z-index: 3;
            pointer-events: none;
            border:
              1px solid rgba(243,218,149,.13);
          }

          .ho-editorial-side-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition:
              transform 1.15s cubic-bezier(.22,1,.36,1);
          }

          .ho-editorial-side-image:hover img {
            transform: scale(1.06);
          }

          .ho-editorial-side-image::after {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(
                to top,
                rgba(0,0,0,.48),
                transparent 55%
              );
          }

          .ho-editorial-side-number {
            position: absolute;
            z-index: 4;
            right: 18px;
            bottom: 14px;
            color:
              rgba(255,255,255,.62);
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size: 13px;
            font-style: italic;
          }

          .ho-editorial-manifesto {
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 0;
            padding: 24px;
            border:
              1px solid rgba(212,175,55,.18);
            background:
              linear-gradient(
                145deg,
                rgba(212,175,55,.055),
                rgba(255,255,255,.018)
              );
          }

          .ho-editorial-manifesto::after {
            content: "H1";
            position: absolute;
            right: -14px;
            bottom: -24px;
            color:
              rgba(212,175,55,.055);
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size: 150px;
            font-style: italic;
            line-height: .75;
            pointer-events: none;
          }

          .ho-editorial-manifesto-kicker {
            color: var(--ho-gold);
            font-size: 7px;
            font-weight: 900;
            letter-spacing: .17em;
            text-transform: uppercase;
          }

          .ho-editorial-manifesto-title {
            max-width: 330px;
            margin-top: 16px;
            color: #F2E5C0;
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size:
              clamp(30px,2.5vw,42px);
            font-weight: 600;
            line-height: .92;
            letter-spacing: -.025em;
          }

          .ho-editorial-manifesto-title span {
            color: var(--ho-gold);
            font-style: italic;
          }

          .ho-editorial-principles {
            position: relative;
            z-index: 2;
            display: grid;
            gap: 0;
            margin-top: 24px;
            border-top:
              1px solid rgba(255,255,255,.08);
          }

          .ho-editorial-principle {
            display: grid;
            grid-template-columns:
              28px 1fr;
            gap: 12px;
            align-items: center;
            padding: 11px 0;
            border-bottom:
              1px solid rgba(255,255,255,.08);
            transition:
              padding-left .35s ease,
              color .35s ease;
          }

          .ho-editorial-principle:hover {
            padding-left: 5px;
          }

          .ho-editorial-principle span:first-child {
            color: #D4AF37;
            font-size: 7px;
            font-weight: 900;
            letter-spacing: .12em;
          }

          .ho-editorial-principle span:last-child {
            color:
              rgba(255,255,255,.58);
            font-size: 10px;
            font-weight: 700;
          }

          .ho-editorial-footline {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            margin-top: 18px;
            color:
              rgba(255,255,255,.36);
            font-size: 7px;
            font-weight: 900;
            letter-spacing: .14em;
            text-transform: uppercase;
          }

          .ho-editorial-footline::before {
            content: "";
            flex: 1;
            height: 1px;
            background:
              linear-gradient(
                90deg,
                #D4AF37,
                transparent
              );
          }

          .ho-collection {
            position: relative;
            overflow: hidden;
            color: #171717;
            background:
              linear-gradient(
                180deg,
                #F5EFE5 0%,
                #EEE5D6 100%
              );
          }

          .ho-collection::before {
            content: "";
            position: absolute;
            left: -9%;
            top: 3%;
            width: 46vw;
            aspect-ratio: 1;
            border-radius: 999px;
            background:
              radial-gradient(
                circle,
                rgba(212,175,55,.14),
                transparent 68%
              );
            filter: blur(20px);
            pointer-events: none;
          }

          .ho-collection-inner {
            position: relative;
            z-index: 2;
            padding:
              clamp(72px,6vw,102px)
              clamp(16px,4vw,66px);
          }

          .ho-collection-head {
            display: grid;
            grid-template-columns:
              minmax(0,1fr)
              auto;
            align-items: end;
            gap: 28px;
            padding-bottom: 28px;
            border-bottom:
              1px solid rgba(23,23,23,.11);
          }

          .ho-collection-title {
            margin-top: 12px;
            color: #171717;
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size:
              clamp(54px,5.4vw,86px);
            font-weight: 600;
            line-height: .87;
            letter-spacing: -.043em;
          }

          .ho-collection-sub {
            max-width: 680px;
            margin-top: 15px;
            color:
              rgba(23,23,23,.48);
            font-size: 12px;
            font-weight: 600;
            line-height: 1.8;
          }

          .ho-standard-link {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding-bottom: 4px;
            border-bottom:
              1px solid rgba(23,23,23,.28);
            color: #171717;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: .11em;
            text-decoration: none;
            text-transform: uppercase;
            transition:
              gap .32s ease,
              color .32s ease,
              border-color .32s ease;
          }

          .ho-standard-link:hover {
            gap: 15px;
            color: #8D6817;
            border-color: #A88120;
          }

          .ho-product-grid {
            display: grid;
            grid-template-columns:
              repeat(4,minmax(0,1fr));
            gap: 16px;
            margin-top: 28px;
          }

          /* ==============================================
             COMPACT PRIVATE-EDITION CARD
          =============================================== */

          .ho-product-card {
            --card-1: #14120F;
            --card-2: #211D16;
            --card-accent: #D1AA4D;
            --card-accent-2: #F2D67D;

            position: relative;
            min-width: 0;
            overflow: hidden;
            border-radius: 22px;
            color: #F4E7C5;
            text-decoration: none;
            background:
              linear-gradient(
                145deg,
                var(--card-2),
                var(--card-1)
              );
            border:
              1px solid rgba(212,175,55,.22);
            box-shadow:
              0 18px 42px
              rgba(39,28,14,.12);
            transition:
              transform .72s
              cubic-bezier(.22,1,.36,1),
              box-shadow .55s ease,
              border-color .45s ease;
          }

          .ho-product-card--1 {
            --card-1: #0F1915;
            --card-2: #1B2D24;
            --card-accent: #CFAD5A;
          }

          .ho-product-card--2 {
            --card-1: #1B1115;
            --card-2: #321A22;
            --card-accent: #D9A866;
          }

          .ho-product-card--3 {
            --card-1: #101622;
            --card-2: #1D2B42;
            --card-accent: #C6A35C;
          }

          .ho-product-card:hover {
            transform:
              translateY(-7px);
            border-color:
              rgba(212,175,55,.48);
            box-shadow:
              0 28px 62px
              rgba(39,28,14,.19);
          }

          .ho-product-card::before {
            content: "";
            position: absolute;
            inset: 7px;
            z-index: 1;
            pointer-events: none;
            border-radius: 16px;
            border:
              1px solid rgba(237,209,135,.14);
          }

          .ho-product-media {
            position: relative;
            z-index: 2;
            aspect-ratio: 1 / .70;
            margin: 11px 11px 0;
            overflow: hidden;
            border-radius: 14px;
            background: #080808;
            border:
              1px solid rgba(237,210,143,.15);
          }

          .ho-product-media img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            transition:
              transform 1.1s
              cubic-bezier(.22,1,.36,1),
              filter .6s ease;
          }

          .ho-product-card:hover
          .ho-product-media img {
            transform: scale(1.06);
            filter:
              saturate(1.04)
              contrast(1.03);
          }

          .ho-product-media::after {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(
                180deg,
                rgba(0,0,0,.04),
                transparent 55%,
                rgba(0,0,0,.42)
              );
          }

          .ho-product-spine {
            position: absolute;
            z-index: 5;
            top: 18px;
            left: 18px;
            display: inline-flex;
            height: 24px;
            align-items: center;
            gap: 7px;
            padding: 0 9px;
            border:
              1px solid rgba(255,237,170,.22);
            border-radius: 999px;
            background:
              rgba(8,8,8,.58);
            backdrop-filter: blur(8px);
            color: #F0D57C;
            font-size: 6px;
            font-weight: 900;
            letter-spacing: .14em;
            text-transform: uppercase;
          }

          .ho-product-spine::before {
            content: "";
            width: 5px;
            height: 5px;
            border-radius: 999px;
            background: var(--card-accent);
            box-shadow:
              0 0 12px
              rgba(212,175,55,.40);
          }

          .ho-product-number {
            position: absolute;
            z-index: 5;
            right: 18px;
            bottom: 13px;
            color:
              rgba(255,255,255,.74);
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size: 12px;
            font-style: italic;
          }

          .ho-product-seal {
            position: absolute;
            z-index: 6;
            right: 16px;
            top: 16px;
            display: grid;
            width: 38px;
            height: 38px;
            place-items: center;
            border-radius: 999px;
            border:
              1px solid rgba(255,235,162,.42);
            background:
              radial-gradient(
                circle at 34% 30%,
                #F0DA91,
                #BA8125 60%,
                #6B4007
              );
            color: #FFF0B9;
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size: 16px;
            font-weight: 700;
            box-shadow:
              0 8px 18px
              rgba(0,0,0,.22);
            transition:
              transform .55s
              cubic-bezier(.22,1,.36,1);
          }

          .ho-product-card:hover
          .ho-product-seal {
            transform:
              rotate(8deg)
              scale(1.05);
          }

          .ho-product-body {
            position: relative;
            z-index: 3;
            padding: 17px 18px 17px;
          }

          .ho-product-category {
            color: var(--card-accent);
            font-size: 7px;
            font-weight: 900;
            letter-spacing: .14em;
            text-transform: uppercase;
          }

          .ho-product-title {
            margin-top: 7px;
            color: #F6E9C7;
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size:
              clamp(24px,1.6vw,31px);
            font-weight: 600;
            line-height: .96;
            letter-spacing: -.028em;
          }

          .ho-product-desc {
            margin-top: 10px;
            color:
              rgba(255,255,255,.43);
            font-size: 9px;
            line-height: 1.65;
          }

          .ho-product-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-top: 15px;
            padding-top: 13px;
            border-top:
              1px solid rgba(255,255,255,.09);
          }

          .ho-product-price-label {
            color:
              rgba(255,255,255,.30);
            font-size: 6px;
            font-weight: 900;
            letter-spacing: .11em;
            text-transform: uppercase;
          }

          .ho-product-price {
            margin-top: 3px;
            color: var(--card-accent-2);
            font-size: 16px;
            font-weight: 900;
          }

          .ho-product-link {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            color: var(--card-accent-2);
            font-size: 7px;
            font-weight: 900;
            letter-spacing: .08em;
            text-transform: uppercase;
          }

          .ho-product-link span {
            display: grid;
            width: 30px;
            height: 30px;
            place-items: center;
            border-radius: 999px;
            border:
              1px solid rgba(233,204,119,.27);
            background:
              rgba(255,255,255,.035);
            transition:
              transform .4s
              cubic-bezier(.22,1,.36,1),
              background-color .3s ease,
              color .3s ease;
          }

          .ho-product-card:hover
          .ho-product-link span {
            transform:
              translateX(4px);
            color: #111;
            background: var(--ho-gold);
          }

          .ho-card-line {
            position: absolute;
            z-index: 7;
            left: 0;
            bottom: 0;
            width: 0;
            height: 2px;
            background:
              linear-gradient(
                90deg,
                var(--ho-orange),
                var(--ho-gold)
              );
            transition:
              width .75s
              cubic-bezier(.22,1,.36,1);
          }

          .ho-product-card:hover
          .ho-card-line {
            width: 100%;
          }

          .ho-product-sheen {
            position: absolute;
            z-index: 8;
            top: -20%;
            bottom: -20%;
            left: -28%;
            width: 13%;
            opacity: 0;
            pointer-events: none;
            transform:
              skewX(-18deg);
            background:
              linear-gradient(
                90deg,
                transparent,
                rgba(255,255,255,.06),
                rgba(255,236,169,.22),
                rgba(255,255,255,.05),
                transparent
              );
          }

          .ho-product-card:hover
          .ho-product-sheen {
            opacity: 1;
            animation:
              hoCardSheen 1s
              cubic-bezier(.16,1,.3,1)
              both;
          }

          @keyframes hoCardSheen {
            to {
              transform:
                skewX(-18deg)
                translateX(980%);
            }
          }

          /* ==============================================
             BESPOKE
          =============================================== */

          .ho-bespoke {
            position: relative;
            overflow: hidden;
            background:
              linear-gradient(
                120deg,
                #080807,
                #0C0A08
              );
          }

          .ho-bespoke::before {
            content: "";
            position: absolute;
            right: -12%;
            top: 50%;
            width: 50vw;
            aspect-ratio: 1;
            transform: translateY(-50%);
            border-radius: 999px;
            background:
              radial-gradient(
                circle,
                rgba(212,175,55,.16),
                transparent 67%
              );
            filter: blur(25px);
          }

          .ho-bespoke-grid {
            position: relative;
            z-index: 2;
            display: grid;
            min-height: 410px;
            grid-template-columns:
              minmax(0,1fr)
              minmax(0,1fr);
            align-items: center;
            gap: 52px;
            padding:
              clamp(60px,5.5vw,84px)
              clamp(20px,4.5vw,78px);
          }

          .ho-bespoke-title {
            margin-top: 14px;
            max-width: 650px;
            color: #F2E5C0;
            font-family:
              'Cormorant Garamond',
              Georgia,
              serif;
            font-size:
              clamp(50px,4.6vw,74px);
            font-weight: 600;
            line-height: .90;
            letter-spacing: -.034em;
          }

          .ho-bespoke-title span {
            display: block;
            color: var(--ho-gold);
            font-style: italic;
          }

          .ho-bespoke-copy {
            padding-left: 31px;
            border-left:
              1px solid rgba(255,255,255,.11);
          }

          .ho-bespoke-copy p {
            max-width: 610px;
            color:
              rgba(255,255,255,.52);
            font-size: 13px;
            line-height: 1.9;
          }

          /* ==============================================
             RESPONSIVE
          =============================================== */

          @media (max-width: 1279px) {
            .ho-product-grid {
              grid-template-columns:
                repeat(3,minmax(0,1fr));
            }
          }

          @media (max-width: 1199px) {
            .ho-editorial-stage {
              grid-template-columns:
                minmax(0,1.15fr)
                minmax(280px,.85fr);
              min-height: 500px;
            }

            .ho-editorial-main {
              min-height: 500px;
            }
          }

          @media (max-width: 1023px) {
            .ho-hero {
              min-height: auto;
            }

            .ho-hero-grid {
              min-height: auto;
              grid-template-columns: 1fr;
              gap: 48px;
              padding:
                118px 24px
                68px;
            }

            .ho-hero-copy-block {
              max-width: none;
            }

            .ho-hero-points {
              max-width: none;
            }

            .ho-hero-visual {
              width: 100%;
              margin: 0;
            }

            .ho-hero-stage {
              min-height: 0;
              padding: 34px 0 0;
            }

            .ho-hero-floating-note {
              width: min(260px, 46vw);
            }

            .ho-hero-detail-card {
              width: min(430px, 84%);
            }

            .ho-editorial-head {
              grid-template-columns: 1fr;
              gap: 28px;
            }

            .ho-editorial-intro {
              max-width: 760px;
            }

            .ho-editorial-stage {
              grid-template-columns: 1fr;
              min-height: 0;
            }

            .ho-editorial-main {
              min-height: 460px;
            }

            .ho-editorial-side {
              grid-template-columns:
                minmax(0,1fr)
                minmax(0,1fr);
              grid-template-rows: none;
            }

            .ho-editorial-side-image,
            .ho-editorial-manifesto {
              min-height: 320px;
            }

            .ho-editorial-grid {
              grid-template-columns: 1fr;
              gap: 36px;
              padding:
                70px 24px;
            }

            .ho-editorial-copy {
              padding-left: 24px;
            }

            .ho-collection-head {
              grid-template-columns: 1fr;
              align-items: start;
            }

            .ho-product-grid {
              grid-template-columns:
                repeat(2,minmax(0,1fr));
            }

            .ho-bespoke-grid {
              grid-template-columns: 1fr;
              gap: 34px;
              padding:
                66px 24px;
            }
          }

          @media (max-width: 767px) {
            .ho-hero-grid {
              padding:
                104px 16px
                54px;
              gap: 32px;
            }

            .ho-hero-chip-row {
              gap: 8px;
            }

            .ho-hero-chip {
              min-height: 32px;
              padding: 0 11px;
              letter-spacing: .12em;
            }

            .ho-hero-title {
              font-size:
                clamp(58px,20vw,88px);
              line-height: .82;
            }

            .ho-hero-title span {
              font-size:
                clamp(31px,8.2vw,44px);
            }

            .ho-hero-copy {
              font-size: 12px;
              line-height: 1.82;
            }

            .ho-hero-points {
              grid-template-columns: 1fr;
              gap: 10px;
            }

            .ho-hero-point {
              min-height: 0;
            }

            .ho-actions {
              display: grid;
              grid-template-columns: 1fr;
            }

            .ho-action-primary,
            .ho-action-secondary {
              width: 100%;
            }

            .ho-hero-stage {
              padding: 0;
            }

            .ho-hero-stage::before {
              display: none;
            }

            .ho-hero-main-media {
              height: 350px;
            }

            .ho-hero-main-copy {
              left: 18px;
              right: 18px;
              bottom: 18px;
              flex-direction: column;
              align-items: start;
            }

            .ho-hero-main-copy h2 {
              font-size: 30px;
            }

            .ho-hero-main-copy span {
              font-size: 8px;
              white-space: normal;
            }

            .ho-hero-floating-note {
              position: relative;
              top: auto;
              right: auto;
              width: 100%;
              margin-top: 12px;
            }

            .ho-hero-detail-card {
              position: relative;
              left: auto;
              bottom: auto;
              grid-template-columns: 88px 1fr;
              width: 100%;
              margin-top: 12px;
            }

            .ho-hero-detail-copy h3 {
              font-size: 24px;
            }

            .ho-hero-badge {
              right: 14px;
              bottom: 14px;
              min-width: 98px;
              min-height: 34px;
              padding: 0 14px;
              font-size: 7px;
            }

            .ho-editorial-wrap {
              padding:
                58px 14px;
            }

            .ho-editorial-head {
              margin-bottom: 28px;
            }

            .ho-editorial-title {
              font-size:
                clamp(46px,13vw,64px);
            }

            .ho-editorial-intro {
              padding:
                18px 0 0;
              border-left: 0;
              border-top:
                1px solid rgba(212,175,55,.24);
              font-size: 12px;
              line-height: 1.8;
            }

            .ho-editorial-intro::before {
              display: none;
            }

            .ho-editorial-main {
              min-height: 360px;
            }

            .ho-editorial-main-copy {
              left: 18px;
              right: 18px;
              bottom: 18px;
            }

            .ho-editorial-main-copy p:last-child {
              font-size: 26px;
            }

            .ho-editorial-side {
              grid-template-columns: 1fr;
            }

            .ho-editorial-side-image,
            .ho-editorial-manifesto {
              min-height: 300px;
            }

            .ho-editorial-manifesto {
              padding: 20px;
            }

            .ho-ticker-item {
              height: 50px;
              gap: 13px;
              padding-right: 26px;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: .105em;
            }

            .ho-ticker-item span {
              font-size: 9px;
            }

            .ho-editorial-grid {
              padding:
                60px 17px;
            }

            .ho-editorial-title {
              font-size:
                clamp(46px,13vw,64px);
            }

            .ho-editorial-copy {
              padding:
                22px 0 0;
              border-left: 0;
              border-top:
                1px solid rgba(212,175,55,.24);
            }

            .ho-editorial-copy > p {
              font-size: 12px;
              line-height: 1.8;
            }

            .ho-stat-grid {
              grid-template-columns: 1fr;
              gap: 9px;
            }

            .ho-stat {
              min-height: 82px;
            }

            .ho-collection-inner {
              padding:
                60px 12px;
            }

            .ho-collection-title {
              font-size:
                clamp(48px,14vw,66px);
            }

            .ho-product-grid {
              grid-template-columns: 1fr;
              gap: 14px;
            }

            .ho-product-card {
              border-radius: 19px;
            }

            .ho-product-card:hover {
              transform: none;
            }

            .ho-product-media {
              aspect-ratio: 1 / .62;
              margin: 9px 9px 0;
              border-radius: 12px;
            }

            .ho-product-body {
              padding:
                15px 16px 16px;
            }

            .ho-product-title {
              font-size: 28px;
            }

            .ho-product-card:hover
            .ho-product-media img {
              transform: none;
              filter: none;
            }

            .ho-product-card:hover
            .ho-product-seal {
              transform: none;
            }

            .ho-product-sheen {
              display: none;
            }

            .ho-bespoke-grid {
              padding:
                60px 17px;
            }

            .ho-bespoke-title {
              font-size:
                clamp(46px,13vw,64px);
            }

            .ho-bespoke-copy {
              padding:
                22px 0 0;
              border-left: 0;
              border-top:
                1px solid rgba(255,255,255,.11);
            }
          }

          @media (max-width: 380px) {
            .ho-ticker-item {
              height: 48px;
              gap: 11px;
              padding-right: 22px;
              font-size: 8.5px;
              letter-spacing: .09em;
            }

            .ho-hero-grid {
              padding-left: 13px;
              padding-right: 13px;
            }

            .ho-hero-title {
              font-size: 66px;
            }

            .ho-product-title {
              font-size: 26px;
            }

            .ho-product-link {
              gap: 5px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .ho-signatures-progress button.is-active::after,
            .ho-signature-panel.is-active::after {
              animation: none !important;
            }

            .ho-signature-panel,
            .ho-signature-media img,
            .ho-signature-title,
            .ho-signature-description,
            .ho-signature-state {
              transition: none !important;
            }

            .ho-reveal {
              opacity: 1 !important;
              transform: none !important;
              transition: none !important;
            }

            .ho-hero-bg img,
            .ho-ticker-track {
              animation: none !important;
            }

            .ho-product-card,
            .ho-product-media img,
            .ho-product-link span,
            .ho-product-seal,
            .ho-stat,
            .ho-hero-main-media img,
            .ho-hero-detail-thumb img {
              transition: none !important;
            }

            .ho-product-sheen {
              display: none !important;
            }
          }

          /* ==============================================
             HAMPER ONE · V6 CLEAN 3-IMAGE HERO
          =============================================== */

          .ho-v6-hero {
            position: relative;
            min-height: 100svh;
            overflow: hidden;
            isolation: isolate;
            background: #050505;
          }

          .ho-v6-slides {
            position: absolute;
            inset: 0;
            z-index: -4;
            overflow: hidden;
            background: #0A0908;
          }

          .ho-v6-slide {
            position: absolute;
            inset: -2%;
            width: 104%;
            height: 104%;
            object-fit: cover;
            object-position: center;
            opacity: 0;
            transform: scale(1.035);
            filter:
              saturate(.96)
              contrast(1.02)
              brightness(.96);
            transition:
              opacity 1.35s
              cubic-bezier(.22,1,.36,1),
              transform 4.6s
              cubic-bezier(.22,1,.36,1),
              filter 1.35s ease;
            will-change:
              opacity,
              transform;
          }

          .ho-v6-slide.is-active {
            opacity: 1;
            transform: scale(1.065);
            filter:
              saturate(1.02)
              contrast(1.035)
              brightness(1);
          }

          .ho-v6-overlay {
            position: absolute;
            inset: 0;
            z-index: -3;
            pointer-events: none;
            background:
              linear-gradient(
                90deg,
                rgba(4,4,4,.96) 0%,
                rgba(4,4,4,.90) 30%,
                rgba(4,4,4,.62) 52%,
                rgba(4,4,4,.30) 74%,
                rgba(4,4,4,.18) 100%
              ),
              linear-gradient(
                180deg,
                rgba(0,0,0,.20) 0%,
                transparent 42%,
                rgba(4,4,4,.58) 100%
              );
          }

          .ho-v6-overlay::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(
                circle at 70% 50%,
                transparent 0%,
                transparent 28%,
                rgba(0,0,0,.12) 62%,
                rgba(0,0,0,.36) 100%
              );
          }

          .ho-v6-noise {
            position: absolute;
            inset: 0;
            z-index: -2;
            pointer-events: none;
            opacity: .08;
            background-image:
              radial-gradient(
                rgba(255,255,255,.58) .5px,
                transparent .5px
              );
            background-size: 7px 7px;
            mix-blend-mode: soft-light;
          }

          .ho-v6-inner {
            display: flex;
            min-height: 100svh;
            align-items: center;
            padding:
              clamp(124px,11vw,158px)
              clamp(20px,5vw,86px)
              clamp(68px,6vw,92px);
          }

          .ho-v6-copy {
            width: min(100%, 720px);
          }

          .ho-v6-kicker {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #D4AF37;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: .29em;
            text-transform: uppercase;
          }

          .ho-v6-kicker::before {
            content: "";
            width: 44px;
            height: 1px;
            background:
              linear-gradient(
                90deg,
                #F47822,
                #D4AF37
              );
          }

          .ho-v6-title {
            margin: 27px 0 0;
            color: #F6EBCF;
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
            font-size:
              clamp(78px,10vw,150px);
            font-weight: 600;
            line-height: .73;
            letter-spacing: -.052em;
            text-shadow:
              0 14px 48px
              rgba(0,0,0,.20);
          }

          .ho-v6-title span {
            display: block;
            margin-top: .16em;
            color: #D4AF37;
            font-style: italic;
            text-shadow:
              0 18px 50px
              rgba(212,175,55,.16);
          }

          .ho-v6-tagline {
            margin-top: 34px;
            color:
              rgba(255,255,255,.92);
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
            font-size:
              clamp(30px,2.6vw,44px);
            font-style: italic;
            font-weight: 500;
            line-height: 1.02;
          }

          .ho-v6-description {
            max-width: 610px;
            margin-top: 22px;
            color:
              rgba(255,255,255,.66);
            font-size: 14px;
            font-weight: 500;
            line-height: 1.9;
          }

          .ho-v6-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 32px;
          }

          .ho-v6-primary,
          .ho-v6-secondary {
            display: inline-flex;
            min-height: 54px;
            align-items: center;
            justify-content: center;
            gap: 15px;
            padding: 0 24px;
            text-decoration: none;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .13em;
            text-transform: uppercase;
            transition:
              transform .38s
              cubic-bezier(.22,1,.36,1),
              background-color .3s ease,
              border-color .3s ease,
              color .3s ease,
              box-shadow .3s ease;
          }

          .ho-v6-primary {
            color: #111;
            border: 1px solid #D4AF37;
            background: #D4AF37;
            box-shadow:
              0 14px 30px
              rgba(212,175,55,.13);
          }

          .ho-v6-primary:hover {
            transform: translateY(-3px);
            background: #E7CB70;
            box-shadow:
              0 20px 38px
              rgba(212,175,55,.20);
          }

          .ho-v6-secondary {
            color: #fff;
            border:
              1px solid rgba(255,255,255,.22);
            background:
              rgba(6,6,6,.32);
            backdrop-filter: blur(8px);
          }

          .ho-v6-secondary:hover {
            transform: translateY(-3px);
            color: #ECD17A;
            border-color:
              rgba(212,175,55,.62);
          }

          @media (max-width: 1023px) {
            .ho-v6-hero {
              min-height: auto;
            }

            .ho-v6-inner {
              min-height: 94svh;
              padding:
                120px 24px
                70px;
            }

            .ho-v6-copy {
              width: min(100%, 670px);
            }

            .ho-v6-slide {
              object-position: 62% center;
            }
          }

          @media (max-width: 767px) {
            .ho-v6-inner {
              min-height: 100svh;
              align-items: flex-end;
              padding:
                108px 16px
                54px;
            }

            .ho-v6-slide {
              object-position: 64% center;
              transform: scale(1.06);
            }

            .ho-v6-slide.is-active {
              transform: scale(1.065);
            }

            .ho-v6-overlay {
              background:
                linear-gradient(
                  180deg,
                  rgba(4,4,4,.16) 0%,
                  rgba(4,4,4,.30) 27%,
                  rgba(4,4,4,.73) 62%,
                  rgba(4,4,4,.97) 100%
                );
            }

            .ho-v6-kicker {
              font-size: 8px;
              letter-spacing: .22em;
            }

            .ho-v6-kicker::before {
              width: 34px;
            }

            .ho-v6-title {
              margin-top: 20px;
              font-size:
                clamp(68px,23vw,102px);
              line-height: .76;
            }

            .ho-v6-tagline {
              margin-top: 26px;
              font-size:
                clamp(28px,8.5vw,38px);
            }

            .ho-v6-description {
              max-width: 520px;
              margin-top: 18px;
              font-size: 12px;
              line-height: 1.82;
            }

            .ho-v6-actions {
              display: grid;
              grid-template-columns: 1fr;
              gap: 10px;
              margin-top: 26px;
            }

            .ho-v6-primary,
            .ho-v6-secondary {
              width: 100%;
              min-height: 52px;
            }
          }

          @media (max-width: 380px) {
            .ho-v6-inner {
              padding-left: 13px;
              padding-right: 13px;
            }

            .ho-v6-title {
              font-size: 64px;
            }

            .ho-v6-tagline {
              font-size: 27px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .ho-v6-slide {
              transition:
                opacity .15s linear !important;
              transform:
                scale(1.04) !important;
            }
          }

        `}
      </style>

      {/* ==================================================
          HERO
      ================================================== */}

      <section className="ho-v6-hero">
        <div
          className="ho-v6-slides"
          aria-hidden="true"
        >
          {HERO_SLIDES.map(
            (
              slide,
              index
            ) => (
              <img
                key={slide.src}
                src={slide.src}
                alt=""
                style={{
                  objectPosition:
                    slide.position,
                }}
                className={`ho-v6-slide ${
                  heroSlide ===
                  index
                    ? "is-active"
                    : ""
                }`}
              />
            )
          )}
        </div>

        <div
          className="ho-v6-overlay"
          aria-hidden="true"
        />

        <div
          className="ho-v6-noise"
          aria-hidden="true"
        />

        <div className="ho-v6-inner">
          <div className="ho-v6-copy ho-reveal ho-in">
            <p className="ho-v6-kicker">
              HAMPORIUM PRIVATE COLLECTION
            </p>

            <h1 className="ho-v6-title">
              HAMPER
              <span>ONE</span>
            </h1>

            <p className="ho-v6-tagline">
              Private gifting,
              <br />
              elevated.
            </p>

            <p className="ho-v6-description">
              A rare edit of signature hampers for
              moments where the gift itself needs to
              feel exceptional.
            </p>

            <div className="ho-v6-actions">
              <a
                href="#hamper-one-collection"
                className="ho-v6-primary"
              >
                Explore The Edit
                <span>↓</span>
              </a>

              <Link
                to="/custom-hamper"
                className="ho-v6-secondary"
              >
                Create Bespoke
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          PRIVATE TICKER
      ================================================== */}

      <section
        className="ho-ticker"
        aria-hidden="true"
      >
        <div className="ho-ticker-track">
          {[1, 2].map(
            (sequence) => (
              <div
                className="ho-ticker-sequence"
                key={sequence}
              >
                {[
                  "HAMPER ONE",
                  "Private Collection",
                  "Rare Selections",
                  "Signature Presentation",
                  "Curated Luxury",
                  "Bespoke Gifting",
                  "Private Editions",
                  "Refined Finishing",
                  "Elevated Unboxing",
                  "Made For Remarkable Moments",
                  "HAMPORIUM Private Series",
                  "Thoughtfully Composed",
                ].map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      className="ho-ticker-item"
                      key={`${sequence}-${index}-${item}`}
                    >
                      {item}
                      <span>✦</span>
                    </div>
                  )
                )}
              </div>
            )
          )}
        </div>
      </section>

      {/* ==================================================
          PRIVATE SIGNATURES
      ================================================== */}

      <section className="ho-values">
        <div className="ho-signatures-shell">
          <div className="ho-signatures-head">
            <div className="ho-reveal">
              <p className="ho-signatures-kicker">
                THE HAMPER ONE STANDARD
              </p>

              <h2 className="ho-signatures-title">
                Four signatures.
                <span>
                  One private standard.
                </span>
              </h2>
            </div>

            <p className="ho-signatures-copy ho-reveal ho-reveal-delay-1">
              HAMPER ONE is not defined by one product.
              It is defined by the way selection,
              presentation, personalisation and service
              move together as one premium experience.
            </p>
          </div>

          <div
            className="ho-signatures-rail"
            onMouseLeave={() =>
              setSignatureActive(
                (current) =>
                  current
              )
            }
          >
            <LuxurySignature
              index={0}
              active={
                signatureActive === 0
              }
              number="01"
              label="The Selection"
              title="Rare Selection"
              text="A tighter, more elevated edit chosen for exceptional gifting."
              foot="Curated with restraint"
              image={
                getProductImage(
                  products[0] || {}
                ) ||
                HERO_SLIDES[0].src
              }
              onActivate={() =>
                setSignatureActive(0)
              }
            />

            <LuxurySignature
              index={1}
              active={
                signatureActive === 1
              }
              number="02"
              label="The Presentation"
              title="Signature Presentation"
              text="Premium finishing, packaging and visual detail designed to make the first impression count."
              foot="Finished to impress"
              image={
                getProductImage(
                  products[1] || {}
                ) ||
                HERO_SLIDES[1].src
              }
              onActivate={() =>
                setSignatureActive(1)
              }
            />

            <LuxurySignature
              index={2}
              active={
                signatureActive === 2
              }
              number="03"
              label="The Personal Touch"
              title="Bespoke Direction"
              text="A more intentional expression shaped around the person, occasion and gesture."
              foot="Made more personal"
              image={
                getProductImage(
                  products[2] || {}
                ) ||
                HERO_SLIDES[2].src
              }
              onActivate={() =>
                setSignatureActive(2)
              }
            />

            <LuxurySignature
              index={3}
              active={
                signatureActive === 3
              }
              number="04"
              label="The Experience"
              title="White-glove Mindset"
              text="A refined gifting journey where every touchpoint is treated with the same level of care."
              foot="Handled with care"
              image={
                getProductImage(
                  products[3] || {}
                ) ||
                HERO_SLIDES[0].src
              }
              onActivate={() =>
                setSignatureActive(3)
              }
            />
          </div>

          <div className="ho-signatures-progress">
            {[0, 1, 2, 3].map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`Show private signature ${item + 1}`}
                  className={
                    signatureActive ===
                    item
                      ? "is-active"
                      : ""
                  }
                  onClick={() =>
                    setSignatureActive(
                      item
                    )
                  }
                />
              )
            )}
          </div>
        </div>
      </section>

      {/* ==================================================
          EDITORIAL
      ================================================== */}

      <section className="ho-editorial">
        <div className="ho-editorial-wrap">
          <div className="ho-editorial-head">
            <div className="ho-reveal">
              <p className="ho-kicker">
                THE HAMPER ONE EDIT
              </p>

              <h2 className="ho-editorial-title">
                Composed like
                <span>
                  a signature piece.
                </span>
              </h2>
            </div>

            <div className="ho-editorial-intro ho-reveal ho-reveal-delay-1">
              HAMPER ONE is built around restraint,
              rarity and presentation. Every composition
              is considered as a complete experience —
              from the first visual impression to the
              final reveal.
            </div>
          </div>

          <div className="ho-editorial-stage">
            <div className="ho-editorial-main ho-reveal">
              <img
                src={
                  getProductImage(
                    products[0] || {}
                  )
                }
                alt={
                  products[0]?.name ||
                  "HAMPER ONE signature composition"
                }
              />

              <div className="ho-editorial-main-copy">
                <div>
                  <p>
                    Signature Composition
                  </p>

                  <p>
                    A private edit where
                    every detail earns its place.
                  </p>
                </div>

                <span className="ho-editorial-main-number">
                  01
                </span>
              </div>
            </div>

            <div className="ho-editorial-side">
              <div className="ho-editorial-side-image ho-reveal ho-reveal-delay-1">
                <img
                  src={
                    getProductImage(
                      products[1] ||
                      products[0] ||
                      {}
                    )
                  }
                  alt={
                    products[1]?.name ||
                    "HAMPER ONE detail"
                  }
                />

                <span className="ho-editorial-side-number">
                  02
                </span>
              </div>

              <div className="ho-editorial-manifesto ho-reveal ho-reveal-delay-2">
                <div>
                  <p className="ho-editorial-manifesto-kicker">
                    PRIVATE PRINCIPLES
                  </p>

                  <h3 className="ho-editorial-manifesto-title">
                    Luxury without
                    <span>
                      excess.
                    </span>
                  </h3>
                </div>

                <div className="ho-editorial-principles">
                  <div className="ho-editorial-principle">
                    <span>01</span>
                    <span>
                      Rare, considered selections
                    </span>
                  </div>

                  <div className="ho-editorial-principle">
                    <span>02</span>
                    <span>
                      Signature presentation
                    </span>
                  </div>

                  <div className="ho-editorial-principle">
                    <span>03</span>
                    <span>
                      A private gifting experience
                    </span>
                  </div>
                </div>

                <div className="ho-editorial-footline">
                  HAMPER ONE · PRIVATE SERIES
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          COLLECTION
      ================================================== */}

      <section
        id="hamper-one-collection"
        className="ho-collection"
      >
        <div className="ho-collection-inner">
          <div className="ho-collection-head">
            <div className="ho-reveal">
              <p className="ho-kicker">
                HAMPER ONE COLLECTION
              </p>

              <h2 className="ho-collection-title">
                The Private Edit
              </h2>

              <p className="ho-collection-sub">
                Hampers tagged for HAMPER ONE in Product
                Master appear here automatically.
              </p>
            </div>

            <Link
              to="/gifts"
              className="ho-standard-link ho-reveal ho-reveal-delay-1"
            >
              Browse Standard Collection
              <span>→</span>
            </Link>
          </div>

          {error && (
            <div className="mt-7 border-l-[3px] border-red-500 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="ho-product-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(
                (item) => (
                  <HamperOneSkeleton
                    key={item}
                  />
                )
              )}
            </div>
          ) : products.length ? (
            <div className="ho-product-grid">
              {products.map(
                (
                  product,
                  index
                ) => (
                  <HamperOneProductCard
                    key={product._id}
                    product={product}
                    index={index}
                  />
                )
              )}
            </div>
          ) : (
            <div className="mt-8 border border-black/[0.1] bg-[#E8DFCF] px-6 py-16 text-center ho-reveal">
              <p className="ho-display text-[36px] font-semibold">
                The private edit is being prepared.
              </p>

              <p className="mx-auto mt-3 max-w-lg text-[12px] leading-6 text-black/45">
                Mark ready-made products as HAMPER ONE
                in Product Master and they will appear
                here automatically.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ==================================================
          BESPOKE
      ================================================== */}

      <section className="ho-bespoke">
        <div className="ho-bespoke-grid">
          <div className="ho-reveal">
            <p className="ho-kicker">
              BEYOND THE COLLECTION
            </p>

            <h2 className="ho-bespoke-title">
              Make the gift
              <span>
                distinctly yours.
              </span>
            </h2>
          </div>

          <div className="ho-bespoke-copy ho-reveal ho-reveal-delay-1">
            <p>
              Looking for something more personal?
              Begin with HAMPORIUM&apos;s build-your-own
              studio, or explore our managed Wedding and
              Corporate gifting experiences for larger
              requirements.
            </p>

            <div className="ho-actions">
              <Link
                to="/custom-hamper"
                className="ho-action-primary"
              >
                Build Bespoke
                <span>→</span>
              </Link>

              <Link
                to="/weddings"
                className="ho-action-secondary"
              >
                Wedding Concierge
              </Link>

              <Link
                to="/corporate"
                className="ho-action-secondary"
              >
                Corporate Gifting
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

// ======================================================
// PRIVATE SIGNATURE
// ======================================================

const LuxurySignature = ({
  active,
  number,
  label,
  title,
  text,
  foot,
  image,
  onActivate,
}) => (
  <article
    className={`ho-signature-panel ${
      active
        ? "is-active"
        : ""
    }`}
    onMouseEnter={onActivate}
    onFocus={onActivate}
    tabIndex="0"
  >
    <div className="ho-signature-media">
      <img
        src={image}
        alt={title}
        loading="lazy"
        decoding="async"
      />
    </div>

    <div className="ho-signature-top">
      <span className="ho-signature-number">
        {number}
      </span>

      <span className="ho-signature-state">
        HAMPER ONE
      </span>
    </div>

    <div className="ho-signature-copy">
      <p className="ho-signature-label">
        {label}
      </p>

      <h3 className="ho-signature-title">
        {title}
      </h3>

      <p className="ho-signature-description">
        {text}
      </p>

      <div className="ho-signature-foot">
        <span>
          {foot}
        </span>

        <span
          className="ho-signature-dot"
          aria-hidden="true"
        />
      </div>
    </div>
  </article>
);

// ======================================================
// EDITORIAL STAT
// ======================================================

const EditorialStat = ({
  value,
  label,
}) => (
  <div className="ho-stat">
    <p className="ho-stat-value">
      {value}
    </p>

    <p className="ho-stat-label">
      {label}
    </p>
  </div>
);

// ======================================================
// PRODUCT CARD
// ======================================================

const HamperOneProductCard = ({
  product,
  index,
}) => {
  const image =
    getProductImage(
      product
    );

  const price =
    Number(
      product.minPrice ??
        product.price ??
        0
    );

  const variant =
    Number(index || 0) % 4;

  const delayClass =
    [
      "",
      "ho-reveal-delay-1",
      "ho-reveal-delay-2",
      "ho-reveal-delay-3",
    ][index % 4];

  return (
    <Link
      to={
        product.slug
          ? `/products/${product.slug}`
          : "/hamper-one"
      }
      className={`ho-product-card ho-product-card--${variant} ho-reveal ${delayClass}`}
    >
      <span
        className="ho-product-sheen"
        aria-hidden="true"
      />

      <span
        className="ho-card-line"
        aria-hidden="true"
      />

      <div className="ho-product-media">
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          decoding="async"
        />

        <span className="ho-product-spine">
          Private Edit
        </span>

        <span className="ho-product-seal">
          H1
        </span>

        <span className="ho-product-number">
          No.{" "}
          {String(
            index + 1
          ).padStart(
            2,
            "0"
          )}
        </span>
      </div>

      <div className="ho-product-body">
        <p className="ho-product-category">
          {product.category
            ?.name ||
            "Private Collection"}
        </p>

        <h3 className="ho-product-title">
          {product.name}
        </h3>

        {product.shortDescription && (
          <p className="ho-product-desc line-clamp-2">
            {
              product.shortDescription
            }
          </p>
        )}

        <div className="ho-product-meta">
          <div>
            <p className="ho-product-price-label">
              From
            </p>

            <p className="ho-product-price">
              ₹
              {price.toLocaleString(
                "en-IN"
              )}
            </p>
          </div>

          <span className="ho-product-link">
            View
            <span>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
};

// ======================================================
// SKELETON
// ======================================================

const HamperOneSkeleton = () => (
  <div className="overflow-hidden rounded-[22px] border border-[#D4AF37]/15 bg-[#17140F] p-[11px]">
    <div className="aspect-[1/.70] animate-pulse rounded-[14px] bg-white/[0.07]" />

    <div className="px-2 pb-2 pt-4">
      <div className="h-2 w-20 animate-pulse bg-white/[0.08]" />

      <div className="mt-3 h-7 w-3/4 animate-pulse bg-white/[0.08]" />

      <div className="mt-4 h-px w-full bg-white/[0.06]" />

      <div className="mt-3 flex items-center justify-between">
        <div className="h-5 w-16 animate-pulse bg-white/[0.07]" />

        <div className="h-8 w-8 animate-pulse rounded-full bg-white/[0.07]" />
      </div>
    </div>
  </div>
);

export default HamperOne;
