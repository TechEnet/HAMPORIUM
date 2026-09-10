import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link, useNavigate } from "react-router-dom";

import api from "../../api/api.js";
import Loader from "../../components/Loader.jsx";

import heroVideo from "../../assets/hmp1.mp4";
import hamperOneLuxury from "../../assets/images/hamper_one_luxury.webp";
import reviewsLuxuryBg from "../../assets/images/reviews_luxury_bg.webp";
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
    "https://images.unsplash.com/photo-1783331256641-c147508169b0?auto=format&fit=crop&w=1900&q=92",

  festival:
    "https://images.unsplash.com/photo-1760602672748-6a570286ce73?auto=format&fit=crop&w=1300&q=90",

  corporate:
    "https://images.unsplash.com/photo-1783331256641-c147508169b0?auto=format&fit=crop&w=1300&q=90",

  wedding:
    "https://images.unsplash.com/photo-1774284235324-f0d55c371823?auto=format&fit=crop&w=1300&q=90",

  curated:
    "https://images.unsplash.com/photo-1629610306962-a8aa73153d0e?auto=format&fit=crop&w=1300&q=90",

  why:
    "https://images.unsplash.com/photo-1633870929971-891656f9a150?auto=format&fit=crop&w=1500&q=90",

  bestseller1:
    "https://images.unsplash.com/photo-1760602672748-6a570286ce73?auto=format&fit=crop&w=900&q=90",

  bestseller2:
    "https://images.unsplash.com/photo-1783331256641-c147508169b0?auto=format&fit=crop&w=900&q=90",

  bestseller3:
    "https://images.unsplash.com/photo-1774284235324-f0d55c371823?auto=format&fit=crop&w=900&q=90",

  bestseller4:
    "https://images.unsplash.com/photo-1658993813819-348c8efaa762?auto=format&fit=crop&w=900&q=90",

  bestseller5:
    "https://images.unsplash.com/photo-1769805222413-9422a0027c68?auto=format&fit=crop&w=900&q=90",

  custom:
    "https://images.unsplash.com/photo-1774284235324-f0d55c371823?auto=format&fit=crop&w=1600&q=92",

  hamperOne:
    "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1800&q=92",

  editorialCustom:
    "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1600&q=92",

  hamperOneFeature:
    "https://images.unsplash.com/photo-1658993813819-348c8efaa762?auto=format&fit=crop&w=1600&q=92",

  hamperOneSecondary:
    "https://images.unsplash.com/photo-1769805222413-9422a0027c68?auto=format&fit=crop&w=1400&q=92",

  editorialHover1:
    "https://images.unsplash.com/photo-1658993813819-348c8efaa762?auto=format&fit=crop&w=1500&q=92",

  editorialHover2:
    "https://images.unsplash.com/photo-1629610306962-a8aa73153d0e?auto=format&fit=crop&w=1500&q=92",

  editorialHover3:
    "https://images.unsplash.com/photo-1783331256641-c147508169b0?auto=format&fit=crop&w=1500&q=92",

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
    "https://images.unsplash.com/photo-1607344645866-009c320b63e0?auto=format&fit=crop&w=1500&q=92",

  momentAnniversary:
    "https://images.unsplash.com/photo-1513883049090-d0b7439799bf?auto=format&fit=crop&w=1500&q=92",

  finalCta:
    "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=1900&q=92",

  storyCurated:
    storyImg1,

  storyPersonal:
    storyImg2,

  storyUnboxing:
    storyImg3,

  universalFallback:
    "https://images.unsplash.com/photo-1783331256641-c147508169b0?auto=format&fit=crop&w=1400&q=88",
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
// HOMEPAGE REVIEW FALLBACKS
// ======================================================

const FALLBACK_HOME_REVIEWS = [
  {
    id: "fallback-review-1",
    name: "Priya Mehta",
    rating: 5,
    context: "Wedding Hamper",
    displayMessage:
      "Absolutely beautiful hamper and such thoughtful details.",
  },
  {
    id: "fallback-review-2",
    name: "Rohan Kapoor",
    rating: 5,
    context: "Corporate Gifting",
    displayMessage:
      "Elegant, premium and beautifully presented. Our clients loved it.",
  },
  {
    id: "fallback-review-3",
    name: "Aanya Sharma",
    rating: 5,
    context: "Birthday Hamper",
    displayMessage:
      "It felt personal, polished and genuinely special from the first look.",
  },
  {
    id: "fallback-review-4",
    name: "Meera Sinha",
    rating: 5,
    context: "Festive Hamper",
    displayMessage:
      "Beautiful presentation, thoughtful curation and a lovely unboxing experience.",
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

  const [giftOccasion, setGiftOccasion] =
    useState("birthday");

  const [giftBudget, setGiftBudget] =
    useState("1500-3000");

  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [customerReviews, setCustomerReviews] =
    useState([]);

  const [reviewsLoading, setReviewsLoading] =
    useState(true);

  const [activeReviewIndex, setActiveReviewIndex] =
    useState(0);

  const [introStage, setIntroStage] =
    useState("loading");

  const [heroVideoReady, setHeroVideoReady] =
    useState(false);

  const [introFinished, setIntroFinished] =
    useState(false);

  const heroVideoRef = useRef(null);
  const lastHeroVideoTimeRef = useRef(0);

  const reviewSlides = useMemo(() => {
    if (customerReviews.length) {
      return customerReviews.map((review, index) => ({
        ...review,
        id:
          review?._id ||
          review?.id ||
          `live-review-${index}`,
        name:
          review?.user?.name ||
          review?.customer?.name ||
          review?.userName ||
          review?.name ||
          "Verified Customer",
        context:
          review?.productName ||
          review?.product?.name ||
          "HAMPORIUM Hamper",
        rating: Math.max(
          1,
          Math.min(
            5,
            Number(review?.rating || 5)
          )
        ),
      }));
    }

    return FALLBACK_HOME_REVIEWS;
  }, [customerReviews]);

  // ======================================================
  // CINEMATIC INTRO / HEADER VISIBILITY
  // ======================================================

  useEffect(() => {
    document.documentElement.dataset.hamporiumIntro =
      "active";

    window.dispatchEvent(
      new CustomEvent(
        "hamporium:intro-state",
        {
          detail: {
            active: true,
          },
        }
      )
    );

    return () => {
      delete document.documentElement.dataset.hamporiumIntro;

      window.dispatchEvent(
        new CustomEvent(
          "hamporium:intro-state",
          {
            detail: {
              active: false,
            },
          }
        )
      );
    };
  }, []);

  useEffect(() => {
    if (!heroVideoReady) {
      return undefined;
    }

    const leaveTimer =
      window.setTimeout(() => {
        setIntroStage("leaving");
      }, 450);

    const playTimer =
      window.setTimeout(async () => {
        setIntroStage("hidden");

        const video =
          heroVideoRef.current;

        if (!video) return;

        try {
          video.currentTime = 0;

          await video.play();
        } catch (error) {
          console.warn(
            "Hero video autoplay was blocked:",
            error
          );
        }
      }, 1150);

    return () => {
      window.clearTimeout(
        leaveTimer
      );

      window.clearTimeout(
        playTimer
      );
    };
  }, [heroVideoReady]);

  const finishCinematicIntro = () => {
    setIntroFinished((finished) => {
      if (finished) {
        return finished;
      }

      delete document.documentElement.dataset.hamporiumIntro;

      window.dispatchEvent(
        new CustomEvent(
          "hamporium:intro-state",
          {
            detail: {
              active: false,
            },
          }
        )
      );

      return true;
    });
  };

  const handleHeroVideoTimeUpdate = (event) => {
    if (introFinished) {
      return;
    }

    const video =
      event.currentTarget;

    const duration =
      Number(video.duration || 0);

    const currentTime =
      Number(video.currentTime || 0);

    const previousTime =
      Number(
        lastHeroVideoTimeRef.current || 0
      );

    /*
      Native `loop` keeps the video playing smoothly and does not
      fire `ended`. We detect only the FIRST wrap from the end back
      to the beginning. At that moment the header is revealed, but
      the video itself is never paused/restarted by React.
    */
    if (
      duration > 0 &&
      previousTime > duration * 0.72 &&
      currentTime < duration * 0.28
    ) {
      finishCinematicIntro();
    }

    lastHeroVideoTimeRef.current =
      currentTime;
  };

  useEffect(() => {
    if (introFinished) {
      return undefined;
    }

    const revealHeaderOnScroll = () => {
      if (window.scrollY > 72) {
        finishCinematicIntro();
      }
    };

    revealHeaderOnScroll();

    window.addEventListener(
      "scroll",
      revealHeaderOnScroll,
      {
        passive: true,
      }
    );

    return () => {
      window.removeEventListener(
        "scroll",
        revealHeaderOnScroll
      );
    };
  }, [introFinished]);

  // ======================================================
  // MOBILE 70/30 SNAP RAIL ACTIVE CARD
  // ======================================================

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("IntersectionObserver" in window)
    ) {
      return undefined;
    }

    const mediaQuery =
      window.matchMedia(
        "(max-width: 1023px)"
      );

    let cleanupObservers = [];

    const setupRails = () => {
      cleanupObservers.forEach(
        (cleanup) => cleanup()
      );

      cleanupObservers = [];

      const rails =
        document.querySelectorAll(
          ".hp-snap-rail"
        );

      rails.forEach((rail) => {
        const items =
          Array.from(
            rail.children
          );

        if (!items.length) {
          return;
        }

        items.forEach((item) => {
          item.classList.remove(
            "is-mobile-active"
          );
        });

        items[0].classList.add(
          "is-mobile-active"
        );

        if (!mediaQuery.matches) {
          return;
        }

        const observer =
          new IntersectionObserver(
            (entries) => {
              entries.forEach(
                (entry) => {
                  if (
                    entry.intersectionRatio >=
                    0.68
                  ) {
                    items.forEach(
                      (item) => {
                        item.classList.remove(
                          "is-mobile-active"
                        );
                      }
                    );

                    entry.target.classList.add(
                      "is-mobile-active"
                    );
                  }
                }
              );
            },
            {
              root: rail,
              threshold: [
                0.3,
                0.5,
                0.68,
                0.8,
                1,
              ],
            }
          );

        items.forEach(
          (item) => {
            observer.observe(
              item
            );
          }
        );

        cleanupObservers.push(
          () => {
            observer.disconnect();
          }
        );
      });
    };

    const frame =
      window.requestAnimationFrame(
        setupRails
      );

    const handleChange = () => {
      setupRails();
    };

    mediaQuery.addEventListener?.(
      "change",
      handleChange
    );

    return () => {
      window.cancelAnimationFrame(
        frame
      );

      mediaQuery.removeEventListener?.(
        "change",
        handleChange
      );

      cleanupObservers.forEach(
        (cleanup) => cleanup()
      );
    };
  }, [
    loading,
    products.length,
  ]);

  // ======================================================
  // LOAD PRODUCTS
  // ======================================================

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response =
          await api.get(
            "/catalog/products?featured=true&limit=8"
          );

        setProducts(
          response.data.products || []
        );
      } catch (error) {
        console.error(
          "Home catalogue error:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  // ======================================================
  // HOMEPAGE CUSTOMER REVIEWS
  // Pull only a few public reviews from featured products.
  // ======================================================

  useEffect(() => {
    const reviewProducts = products
      .filter((product) => product?._id)
      .slice(0, 5);

    if (!reviewProducts.length) {
      setCustomerReviews([]);
      setReviewsLoading(false);
      return undefined;
    }

    let active = true;

    const loadCustomerReviews = async () => {
      try {
        setReviewsLoading(true);

        const results = await Promise.allSettled(
          reviewProducts.map(async (product) => {
            const response = await api.get(
              `/reviews/product/${product._id}`,
              {
                params: {
                  page: 1,
                  limit: 4,
                },
              }
            );

            const payload = response.data || {};

            const rows =
              payload.reviews ||
              payload.items ||
              payload.data?.reviews ||
              payload.data?.items ||
              (Array.isArray(payload.data)
                ? payload.data
                : []);

            if (!Array.isArray(rows)) {
              return [];
            }

            return rows.map((review) => ({
              ...review,
              productName:
                review.product?.name ||
                product.name ||
                "HAMPORIUM Hamper",
              productSlug:
                review.product?.slug ||
                product.slug ||
                "",
            }));
          })
        );

        if (!active) {
          return;
        }

        const flattened = results
          .filter(
            (result) =>
              result.status === "fulfilled"
          )
          .flatMap(
            (result) =>
              result.value || []
          );

        const unique = [];
        const seen = new Set();

        flattened.forEach((review, index) => {
          const key =
            review?._id ||
            review?.id ||
            `${review?.user?._id || review?.user?.name || "user"}-${review?.createdAt || index}`;

          if (
            seen.has(key) ||
            unique.length >= 3
          ) {
            return;
          }

          const message =
            review?.comment ||
            review?.review ||
            review?.content ||
            review?.message ||
            review?.text ||
            "";

          if (!String(message).trim()) {
            return;
          }

          seen.add(key);

          unique.push({
            ...review,
            displayMessage:
              String(message).trim(),
          });
        });

        setCustomerReviews(unique);
      } catch (error) {
        console.warn(
          "Homepage reviews error:",
          error
        );

        if (active) {
          setCustomerReviews([]);
        }
      } finally {
        if (active) {
          setReviewsLoading(false);
        }
      }
    };

    void loadCustomerReviews();

    return () => {
      active = false;
    };
  }, [products]);

  useEffect(() => {
    if (
      reviewsLoading ||
      reviewSlides.length <= 1
    ) {
      return undefined;
    }

    const timer =
      window.setInterval(() => {
        setActiveReviewIndex(
          (current) =>
            (current + 1) %
            reviewSlides.length
        );
      }, 4500);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    reviewsLoading,
    reviewSlides.length,
  ]);

  useEffect(() => {
    setActiveReviewIndex(
      (current) =>
        reviewSlides.length
          ? current %
            reviewSlides.length
          : 0
    );
  }, [reviewSlides.length]);

  // ======================================================
  // FIND THE RIGHT GIFT
  // ======================================================

  const handleFindGift = () => {
    const occasion =
      GIFT_OCCASIONS.find(
        (item) =>
          item.id ===
          giftOccasion
      );

    const budget =
      GIFT_BUDGETS.find(
        (item) =>
          item.id ===
          giftBudget
      );

    const params =
      new URLSearchParams();

    if (occasion?.search) {
      params.set(
        "search",
        occasion.search
      );
    }

    if (
      budget?.minPrice !==
        undefined
    ) {
      params.set(
        "minPrice",
        String(
          budget.minPrice
        )
      );
    }

    if (
      budget?.maxPrice !==
        undefined
    ) {
      params.set(
        "maxPrice",
        String(
          budget.maxPrice
        )
      );
    }

    navigate(
      `/gifts?${params.toString()}`
    );
  };

  const activeGiftOccasion =
    GIFT_OCCASIONS.find(
      (occasion) =>
        occasion.id ===
        giftOccasion
    ) ||
    GIFT_OCCASIONS[0];

  const activeBudgetIndex =
    Math.max(
      0,
      GIFT_BUDGETS.findIndex(
        (budget) =>
          budget.id ===
          giftBudget
      )
    );

  const activeBudget =
    GIFT_BUDGETS[
      activeBudgetIndex
    ];

  // ======================================================
  // LOVED PRODUCTS
  // ======================================================

  const lovedProducts =
    useMemo(() => {
      const images = [
        HOME_IMAGES.bestseller1,
        HOME_IMAGES.bestseller2,
        HOME_IMAGES.bestseller3,
        HOME_IMAGES.bestseller4,
        HOME_IMAGES.bestseller5,
      ];

      if (!products.length) {
        return FALLBACK_PRODUCTS;
      }

      return Array.from(
        { length: 5 },
        (_, index) => {
          const product =
            products[index];

          const fallback =
            FALLBACK_PRODUCTS[index];

          if (!product) {
            return fallback;
          }

          const price =
            Number(
              product.minPrice ??
                product.price ??
                product.sellingPrice ??
                product.salePrice ??
                fallback.price
            ) || fallback.price;

          return {
            ...fallback,
            ...product,

            _id:
              product._id ||
              fallback._id,

            name:
              product.name ||
              fallback.name,

            slug:
              product.slug || "",

            price,

            image:
              resolveProductImage(
                product,
                images[index]
              ),
          };
        }
      );
    }, [products]);

  return (
    <main className="w-full overflow-x-clip bg-[#faf7f3] text-[#111111]">
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
             BESTSELLER RUNWAY
          =============================================== */

          .hp-bestseller-runway {
            position: relative;
          }

          @media (min-width: 1024px) {
            .hp-bestseller-runway {
              display: flex !important;
              gap: 10px;
              align-items: stretch;
              overflow: hidden;
            }

            .hp-bestseller-runway >
            .hp-reveal {
              flex: 1 1 0%;
              min-width: 0;
              opacity: 1;
              transform: none;
              transition:
                flex .58s
                  cubic-bezier(.16,1,.3,1),
                opacity .32s ease;
            }

            .hp-bestseller-runway:hover >
            .hp-reveal {
              flex: .86 1 0%;
              opacity: .72;
            }

            .hp-bestseller-runway >
            .hp-reveal:hover {
              flex: 1.5 1 0%;
              opacity: 1;
              z-index: 4;
            }
          }

          .hp-bestseller-card {
            position: relative;
            isolation: isolate;
            overflow: hidden;
            min-height: 470px;
            background: #111;
          }

          .hp-bestseller-card img {
            transform:
              translateZ(0)
              scale(1.015);
            transition:
              transform .9s
                cubic-bezier(.16,1,.3,1),
              filter .45s ease;
            will-change: transform;
          }

          .hp-bestseller-card:hover img {
            transform:
              translateZ(0)
              scale(1.055);
          }

          .hp-bestseller-card::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 1;
            pointer-events: none;
            background:
              linear-gradient(
                to top,
                rgba(0,0,0,.90) 0%,
                rgba(0,0,0,.50) 28%,
                rgba(0,0,0,.05) 62%,
                rgba(0,0,0,.12) 100%
              );
          }

          .hp-bestseller-copy {
            position: absolute;
            inset: auto 0 0;
            z-index: 3;
            padding: 24px;
            transition:
              transform .4s
                cubic-bezier(.16,1,.3,1);
          }

          .hp-bestseller-card:hover
          .hp-bestseller-copy {
            transform:
              translateY(-4px);
          }

          .hp-bestseller-arrow {
            transition:
              transform .35s
                cubic-bezier(.16,1,.3,1),
              background-color .3s ease,
              color .3s ease;
          }

          .hp-bestseller-card:hover
          .hp-bestseller-arrow {
            transform:
              translateX(5px);
            background: #F47822;
            color: white;
          }

          @media (max-width: 1023px) {
            .hp-bestseller-card {
              height: clamp(420px, 62svh, 500px);
              min-height: 420px;
            }
          }

          @media (max-width: 1023px) {
            .hp-bestseller-runway {
              --hp-card-width: 76vw;
              --hp-side-space: calc((100vw - var(--hp-card-width)) / 2);

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
                24px !important;
              scroll-padding-inline: var(--hp-side-space);
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
                0 0
                var(--hp-card-width) !important;
              width:
                var(--hp-card-width) !important;
              max-width:
                var(--hp-card-width) !important;
              min-width: 0;
              scroll-snap-align: center;
              scroll-snap-stop: always;
              scale: .90 !important;
              opacity: .70 !important;
              transform-origin:
                center center;
              transition:
                scale .48s cubic-bezier(.16,1,.3,1),
                opacity .34s ease !important;
              will-change:
                scale, opacity;
            }

            .hp-bestseller-runway >
            .is-mobile-active {
              scale: 1 !important;
              opacity: 1 !important;
            }

            .hp-bestseller-runway .hp-bestseller-card {
              width: 100%;
              border-radius: 28px;
            }

            .hp-bestseller-runway .hp-bestseller-copy {
              padding:
                22px 20px
                24px;
            }
          }

          @media (max-width: 639px) {
            .hp-bestseller-runway {
              --hp-card-width: 78vw;
              gap: 12px !important;
            }

            .hp-bestseller-runway .hp-bestseller-card {
              border-radius: 26px;
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
              box-shadow: 0 0 0 0 rgba(249,115,22,.16);
            }

            50% {
              box-shadow: 0 0 0 14px rgba(249,115,22,0);
            }
          }

          .hp-reveal {
            opacity: 0;
            transform: translate3d(0, 34px, 0);
            transition:
              opacity .85s cubic-bezier(.22,1,.36,1),
              transform .85s cubic-bezier(.22,1,.36,1);
            will-change: opacity, transform;
          }

          .hp-reveal.is-visible {
            opacity: 1;
            transform: translate3d(0, 0, 0);
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
          }

          .hp-story-page {
            --hp-story-cut:
              clamp(
                52px,
                5.2vw,
                96px
              );

            position: sticky !important;
            position: -webkit-sticky !important;
            top: 0;
            width: 100%;
            height: 100vh;
            height: 100svh;
            min-height: 100vh;
            min-height: 100svh;
            overflow: hidden;

            /*
              The incoming page now has a diagonal top edge
              instead of a flat horizontal line.
            */
            clip-path:
              polygon(
                0 var(--hp-story-cut),
                100% 0,
                100% 100%,
                0 100%
              );
            -webkit-clip-path:
              polygon(
                0 var(--hp-story-cut),
                100% 0,
                100% 100%,
                0 100%
              );

            transform: none !important;
            opacity: 1 !important;
            transition: none !important;
          }

          /*
            PAGE 1 = clean full-screen canvas.
            No diagonal cut here, otherwise the clipped corner
            exposes the story-stack background before another page
            has arrived and looks like an empty black wedge.
          */
          .hp-story-page:nth-child(1) {
            z-index: 10;
            clip-path: none;
            -webkit-clip-path: none;
          }

          /*
            PAGE 2 + PAGE 3 are the incoming editorial sheets.
            These keep the diagonal top edge while sliding over
            the page underneath.
          */
          .hp-story-page:nth-child(2) {
            z-index: 20;
          }

          .hp-story-page:nth-child(3) {
            z-index: 30;
          }

          /*
            A small top shadow on the incoming page makes the
            bottom-to-top cover feel more cinematic without
            adding expensive scroll-linked JS animation.
          */
          .hamporium-home {
            overflow: visible;
          }

          /*
            Thin gold diagonal edge.
            This makes each incoming page feel like a premium
            editorial "sheet" sliding over the previous page.
          */
          .hp-story-page::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 12;
            pointer-events: none;
            background:
              linear-gradient(
                90deg,
                rgba(249,115,22,.95),
                rgba(212,175,55,.92),
                rgba(255,231,157,.62)
              );
            clip-path:
              polygon(
                0 var(--hp-story-cut),
                100% 0,
                100% 3px,
                0 calc(var(--hp-story-cut) + 3px)
              );
            -webkit-clip-path:
              polygon(
                0 var(--hp-story-cut),
                100% 0,
                100% 3px,
                0 calc(var(--hp-story-cut) + 3px)
              );
            opacity: .92;
          }

          /*
            Soft shadow just below the diagonal edge.
            No scroll-linked JS, so the sticky stack stays smooth.
          */
          .hp-story-page::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 8;
            pointer-events: none;
            background:
              linear-gradient(
                177deg,
                rgba(0,0,0,.28) 0%,
                rgba(0,0,0,.12) 5%,
                transparent 12%
              );
            opacity: .72;
          }

          /*
            First story page has no incoming edge treatment.
            The diagonal title-sheet effect begins with page 2.
          */
          .hp-story-page:nth-child(1)::before,
          .hp-story-page:nth-child(1)::after {
            display: none;
          }


          .hp-story-image {
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform:
              translateZ(0)
              scale(1);
            transform-origin:
              center center;
            will-change: auto;
            transition: none;
          }

          .hp-story-page:hover
          .hp-story-image {
            transform:
              translateZ(0)
              scale(1);
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
              opacity .42s
                cubic-bezier(.16,1,.3,1),
              transform .85s
                cubic-bezier(.16,1,.3,1);
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
            opacity: 0;
            transform:
              translateZ(0)
              scale(1.045);
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
              --hp-story-cut:
                clamp(
                  34px,
                  8vw,
                  58px
                );

              height: 100vh;
              height: 100svh;
              min-height: 100vh;
              min-height: 100svh;
            }

            .hp-story-image {
              transform:
                translateZ(0)
                scale(1);
            }

            .hp-story-page:hover
            .hp-story-image {
              transform:
                translateZ(0)
                scale(1);
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
                translate3d(0, 0, 0)
                scale(1.02);
            }

            50% {
              transform:
                translate3d(0, -8px, 0)
                scale(1.045);
            }
          }

          .hp-journey-glow {
            animation:
              hpJourneyGlow 5.6s
              ease-in-out infinite;
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
                repeat(
                  3,
                  minmax(0, 1fr)
                );
              transition:
                grid-template-columns
                .52s
                cubic-bezier(.16,1,.3,1);
            }

            .hp-journey-grid:has(
              > a:nth-child(1):hover
            ) {
              grid-template-columns:
                1.32fr .84fr .84fr;
            }

            .hp-journey-grid:has(
              > a:nth-child(2):hover
            ) {
              grid-template-columns:
                .84fr 1.32fr .84fr;
            }

            .hp-journey-grid:has(
              > a:nth-child(3):hover
            ) {
              grid-template-columns:
                .84fr .84fr 1.32fr;
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
                scale .48s
                  cubic-bezier(.16,1,.3,1),
                opacity .34s ease;
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
            .hp-concierge-card.is-active {
              animation: none !important;
            }
          }
        `}
      </style>

      <div className="hamporium-home pb-20 lg:pb-0">

        {/* ==================================================
            CINEMATIC BRAND LOADER
        =================================================== */}

        {introStage !== "hidden" && (
          <div
            className={`transition-all duration-700 ${
              introStage === "leaving"
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            }`}
          >
            <Loader
              fullscreen
              brand
              label="Preparing your HAMPORIUM experience"
            />
          </div>
        )}

        {/* ==================================================
            FULL SCREEN CINEMATIC VIDEO HERO
        =================================================== */}

        <section className="relative h-[100svh] min-h-[620px] w-full overflow-hidden bg-black">
          <video
            ref={heroVideoRef}
            muted
            loop
            playsInline
            preload="auto"
            onLoadedData={() => {
              setHeroVideoReady(true);
            }}
            onCanPlay={() => {
              setHeroVideoReady(true);
            }}
            onTimeUpdate={handleHeroVideoTimeUpdate}
            onError={() => {
              setHeroVideoReady(true);
              setIntroStage("hidden");
              finishCinematicIntro();
            }}
            style={{
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
            }}
            className={`absolute inset-0 h-full w-full transform-gpu object-cover object-center will-change-transform ${
              heroVideoReady
                ? "hp-hero-video-ready"
                : "scale-[1.03] opacity-0"
            }`}
            aria-label="HAMPORIUM luxury gifting showcase"
          >
            <source
              src={heroVideo}
              type="video/mp4"
            />
          </video>

          <div className="pointer-events-none absolute inset-0 bg-black/[0.03]" />

          <span className="sr-only">
            {introFinished
              ? "HAMPORIUM video continues playing"
              : "HAMPORIUM first video playback"}
          </span>
        </section>

        {/* ==================================================
            CHOOSE YOUR GIFTING JOURNEY
        =================================================== */}

        <section className="relative overflow-hidden bg-[#080706] px-4 py-16 text-white sm:px-6 lg:px-0 lg:py-0">
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

            <div className="hp-journey-grid hp-snap-rail">
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
            </div>
          </div>
        </section>


        {/* ==================================================
            HAMPORIUM GIFT CONCIERGE · CINEMATIC CODED UI
        =================================================== */}

        <section className="relative isolate overflow-hidden bg-[#090705] text-white">
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

                  <div className="hp-concierge-gift-box relative mx-auto h-[338px] w-[90%] rounded-[20px] border border-[#D4AF37]/55 bg-gradient-to-br from-[#26221D] via-[#0B0A09] to-[#191613] shadow-[0_44px_110px_rgba(0,0,0,.62)]">
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
                    <div className="absolute -left-[4%] -top-[10%] h-[19%] w-[108%] rounded-[17px] border border-[#D4AF37]/45 bg-gradient-to-b from-[#302A22] via-[#1A1713] to-[#0F0E0C] shadow-[0_14px_30px_rgba(0,0,0,.42)]" />

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

              <div className="hp-mobile-rail hp-snap-rail mt-6">
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
              </div>
            </div>

            {/* =============================================
                BUDGET CONTROL
            ============================================== */}

            <Reveal
              delay={120}
              className="relative z-20"
            >
              <div className="mx-auto mt-12 max-w-[1180px] rounded-[30px] border border-[#D4AF37]/28 bg-[#15110D]/90 p-5 shadow-[0_28px_78px_rgba(0,0,0,.38)] backdrop-blur-xl sm:p-6 lg:p-7">
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

                    <div className="mt-3 flex justify-between text-[10px] font-bold text-white/42">
                      <span>
                        ₹1,500
                      </span>

                      <span>
                        ₹5,000+
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleFindGift
                    }
                    className="hp-concierge-cta inline-flex h-[58px] items-center justify-center gap-5 rounded-full border border-[#FFD980]/35 bg-gradient-to-r from-[#F3BE4E] via-[#F2A933] to-[#F47822] px-7 text-[11px] font-black uppercase tracking-[0.1em] text-[#17110A] shadow-[0_14px_32px_rgba(244,120,34,.22)]"
                  >
                    Open My Matches

                    <span className="text-[18px]">
                      →
                    </span>
                  </button>
                </div>
              </div>
            </Reveal>

            {/* TRUST ROW */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[10px] font-bold text-white/50 sm:text-[11px]">
              <span>
                ✦ Curated with Care
              </span>

              <span className="hidden h-3 w-px bg-white/12 sm:block" />

              <span>
                ◇ Premium Quality
              </span>

              <span className="hidden h-3 w-px bg-white/12 sm:block" />

              <span>
                ✓ Secure & Reliable
              </span>
            </div>
          </div>
        </section>

        {/* ==================================================
            BEST SELLERS · EDITORIAL RUNWAY
        =================================================== */}

        <section className="relative overflow-hidden bg-[#F7F4EF] px-0 py-20 sm:px-6 lg:px-8 lg:py-24 xl:px-10 2xl:px-12">
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

            <div className="hp-mobile-rail hp-snap-rail hp-bestseller-runway mt-12 lg:mt-14">
              {loading ? (
                [1, 2, 3, 4, 5].map((item) => (
                  <ProductSkeleton key={item} />
                ))
              ) : (
                lovedProducts.map((product, index) => (
                  <Reveal
                    key={product._id}
                    delay={index * 55}
                  >
                    <LovedProductCard
                      product={product}
                    />
                  </Reveal>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ==================================================
            HAMPER ONE · LUXURY EDITORIAL
        =================================================== */}

        <section className="relative overflow-hidden bg-[#060606] text-white">
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
              className="relative min-h-[560px] overflow-hidden sm:min-h-[640px] lg:min-h-[760px]"
            >
              <img
                src={hamperOneLuxury}
                alt="HAMPER ONE luxury premium gift hamper"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-center"
                draggable="false"
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

        <section className="hp-story-stack relative bg-[#090807] text-white">
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
              className="hp-story-page group relative overflow-hidden bg-black"
            >
              <SmartImage
                src={item.image}
                alt={`${item.titleLines.join(" ")} ${item.accentLines.join(" ")}`}
                loading="lazy"
                fetchPriority="low"
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
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#FFD25A] sm:text-[12px] lg:text-[13px]">
                      {item.kicker}
                    </p>
                  </div>

                  <h2 className="hp-section-heading max-w-[1200px] text-white drop-shadow-[0_12px_42px_rgba(0,0,0,.68)]">
                    <span className="block">
                      {item.titleLines.map(
                        (line) => (
                          <span
                            key={line}
                            className="block"
                          >
                            {line}
                          </span>
                        )
                      )}
                    </span>

                    <span className="hp-section-heading-accent mt-5 text-[#F4D36A] drop-shadow-[0_10px_34px_rgba(0,0,0,.58)] sm:mt-6 lg:mt-7">
                      {item.accentLines.map(
                        (line) => (
                          <span
                            key={line}
                            className="block"
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
          ))}
        </section>

        {/* ==================================================
            WHY CHOOSE HAMPORIUM
        =================================================== */}

        <section className="relative w-full bg-[#F8F4EE] pb-24">
          <div className="relative w-full overflow-hidden bg-[#0B0B0B] px-0 py-10 text-white sm:py-12 lg:grid lg:grid-cols-[0.92fr_1.12fr] lg:items-stretch lg:gap-12 lg:py-14 xl:gap-16">
            <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 13% 8%, rgba(249,115,22,.16), transparent 22%), radial-gradient(circle at 88% 84%, rgba(212,175,55,.14), transparent 25%)" }} />
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

              <p className="mt-7 max-w-[610px] text-[15px] font-medium leading-7 text-white/62 sm:text-[16px]">
                Premium products, thoughtful personalisation and presentation designed to feel special from the first look.
              </p>

              <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
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

              <div className="absolute bottom-7 left-6 z-10 max-w-[360px] sm:bottom-9 sm:left-9">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#D4AF37]">THE HAMPORIUM PROMISE</p>
                <p style={{ fontFamily: DISPLAY_FONT }} className="mt-2 text-[30px] font-semibold leading-tight text-white">
                  Beautiful outside. Thoughtful inside.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ==================================================
            BULK / EVENT GIFTING · EDITORIAL FLOW
        =================================================== */}

        <section className="relative overflow-hidden bg-[#F3EEE6] text-[#171717]">
          <div className="grid min-h-[850px] lg:grid-cols-[0.92fr_1.08fr]">
            {/* LEFT VISUAL */}
            <Reveal className="relative min-h-[560px] overflow-hidden bg-[#15100C] lg:min-h-[850px]">
              <SmartImage
                src={HOME_IMAGES.corporate}
                alt="Corporate and event gifting"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/12 to-black/22" />

              <div className="absolute left-7 right-7 top-7 flex items-center justify-between sm:left-10 sm:right-10 sm:top-10">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/78">
                  BULK · EVENT · CORPORATE
                </p>
                <span className="h-px w-14 bg-[#D4AF37]" />
              </div>

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

                <p className="mt-5 max-w-[500px] text-[14px] font-medium leading-7 text-white/72 sm:text-[15px]">
                  Build one premium design, scale the quantity, add branding,
                  receive a quotation and move to payment only after approval.
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

              <div className="hp-mobile-rail hp-snap-rail mt-10 border-y border-black/10 lg:grid lg:grid-cols-2 lg:gap-0">
                {[
                  ["01", "Build One Design", "Choose the box, products, décor and personalisation.", HOME_IMAGES.festival],
                  ["02", "Choose Bulk Qty", "Set quantities for teams, weddings and large events.", HOME_IMAGES.wedding],
                  ["03", "Receive Quotation", "Review the final price or request changes before approval.", HOME_IMAGES.curated],
                  ["04", "Pay After Approval", "Production starts only after the accepted quote is paid.", HOME_IMAGES.custom],
                ].map(([step, title, copy, image], index) => (
                  <div
                    key={step}
                    className={`group relative min-h-[280px] overflow-hidden p-6 lg:min-h-[245px] ${
                      index % 2 === 0 ? "lg:border-r lg:border-black/10" : ""
                    } ${
                      index < 2 ? "lg:border-b lg:border-black/10" : ""
                    }`}
                  >
                    <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
                      <SmartImage
                        src={image}
                        alt=""
                        className="h-full w-full object-cover object-center"
                      />
                      <div className="absolute inset-0 bg-[#171717]/86" />
                    </div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#F47822] group-hover:text-[#F2D26B]">
                          STEP {step}
                        </span>
                        <span className="text-[22px] text-black/16 transition group-hover:text-white/55">→</span>
                      </div>

                      <h3
                        style={{ fontFamily: DISPLAY_FONT }}
                        className="mt-10 text-[30px] font-semibold leading-[0.95] text-[#171717] transition group-hover:text-white"
                      >
                        {title}
                      </h3>

                      <p className="mt-3 max-w-[270px] text-[13px] font-medium leading-6 text-black/50 transition group-hover:text-white/65">
                        {copy}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Reveal delay={160} className="mt-8 flex flex-wrap items-center gap-5">
                <Link
                  to="/custom-hamper?mode=bulk"
                  className="inline-flex h-[56px] items-center gap-5 bg-[#F47822] px-7 text-[12px] font-black uppercase tracking-[0.09em] text-white shadow-[0_18px_40px_rgba(249,115,22,.22)] transition hover:bg-[#DF6518]"
                >
                  Build & Request Quote
                  <span className="text-lg">→</span>
                </Link>

              </Reveal>
            </div>
          </div>
        </section>

        {/* ==================================================
            WHAT OUR CUSTOMERS SAY · SIMPLE LUXURY SLIDER
        =================================================== */}

        <section className="relative isolate overflow-hidden bg-[#090807] text-white">
          <img
            src={reviewsLuxuryBg}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
            draggable="false"
          />

          <div className="absolute inset-0 bg-black/18" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/38 via-black/14 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-black/8" />

          <div className="relative z-10 mx-auto grid min-h-[760px] w-full max-w-[1900px] items-center gap-12 px-5 py-20 sm:px-8 md:px-10 lg:grid-cols-[0.78fr_1.22fr] lg:px-12 xl:px-16 2xl:px-20">
            {/* LEFT */}
            <Reveal>
              <div className="max-w-[700px]">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#E8C66A]">
                  REAL PEOPLE. MEANINGFUL MOMENTS.
                </p>

                <h2 className="hp-section-heading mt-5 text-[#FFF8EA]">
                  What Our
                  <span className="hp-section-heading-accent text-[#D4AF37]">
                    Customers Say
                  </span>
                </h2>

                <p className="mt-7 text-[11px] font-black uppercase tracking-[0.2em] text-white/52">
                  Beautiful gifts. Brighter stories.
                </p>

                <span className="mt-8 block h-px w-16 bg-[#D4AF37]" />
              </div>
            </Reveal>

            {/* SINGLE REVIEW ONLY */}
            <Reveal delay={100}>
              {reviewsLoading ? (
                <div className="mx-auto min-h-[390px] max-w-[760px] animate-pulse rounded-[30px] border border-white/[0.12] bg-black/35 backdrop-blur-md" />
              ) : (
                <div className="relative mx-auto w-full max-w-[820px]">
                  <button
                    type="button"
                    aria-label="Previous review"
                    onClick={() =>
                      setActiveReviewIndex(
                        (current) =>
                          (current -
                            1 +
                            reviewSlides.length) %
                          reviewSlides.length
                      )
                    }
                    className="absolute left-0 top-1/2 z-20 hidden h-12 w-12 -translate-x-[135%] -translate-y-1/2 items-center justify-center rounded-full border border-[#D4AF37]/50 bg-black/18 text-[24px] text-[#F4D36A] backdrop-blur-md transition hover:bg-[#D4AF37] hover:text-black lg:flex"
                  >
                    ‹
                  </button>

                  <div className="relative overflow-hidden rounded-[30px] border border-[#D4AF37]/30 bg-black/22 px-6 py-10 shadow-[0_30px_90px_rgba(0,0,0,.22)] backdrop-blur-[10px] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#D4AF37]/10 blur-[80px]" />

                    <div className="relative z-10">
                      <div className="flex justify-center gap-1.5 text-[20px] tracking-[0.12em] text-[#F0CD71]">
                        {Array.from(
                          { length: 5 },
                          (_, index) => (
                            <span
                              key={index}
                              className={
                                index <
                                Number(
                                  reviewSlides[
                                    activeReviewIndex
                                  ]?.rating || 5
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

                      <p
                        style={{ fontFamily: DISPLAY_FONT }}
                        className="mx-auto mt-8 max-w-[650px] text-center text-[31px] font-semibold leading-[1.08] text-[#FFF8EA] sm:text-[38px] lg:text-[44px]"
                      >
                        “{
                          reviewSlides[
                            activeReviewIndex
                          ]?.displayMessage
                        }”
                      </p>

                      <div className="mt-9 flex items-center justify-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[17px] font-black text-[#F0D477]">
                          {String(
                            reviewSlides[
                              activeReviewIndex
                            ]?.name ||
                              "H"
                          )
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white">
                            {
                              reviewSlides[
                                activeReviewIndex
                              ]?.name
                            }
                          </p>

                          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/42">
                            {
                              reviewSlides[
                                activeReviewIndex
                              ]?.context
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Next review"
                    onClick={() =>
                      setActiveReviewIndex(
                        (current) =>
                          (current + 1) %
                          reviewSlides.length
                      )
                    }
                    className="absolute right-0 top-1/2 z-20 hidden h-12 w-12 translate-x-[135%] -translate-y-1/2 items-center justify-center rounded-full border border-[#D4AF37]/50 bg-black/18 text-[24px] text-[#F4D36A] backdrop-blur-md transition hover:bg-[#D4AF37] hover:text-black lg:flex"
                  >
                    ›
                  </button>

                  <div className="mt-7 flex items-center justify-center gap-2.5">
                    {reviewSlides.map(
                      (review, index) => (
                        <button
                          key={
                            review.id ||
                            index
                          }
                          type="button"
                          aria-label={`Show review ${
                            index + 1
                          }`}
                          onClick={() =>
                            setActiveReviewIndex(
                              index
                            )
                          }
                          className={`h-2.5 rounded-full transition-all duration-500 ${
                            index ===
                            activeReviewIndex
                              ? "w-8 bg-[#F0CD71]"
                              : "w-2.5 bg-white/22 hover:bg-white/38"
                          }`}
                        />
                      )
                    )}
                  </div>

                  <div className="mt-6 flex justify-center gap-3 lg:hidden">
                    <button
                      type="button"
                      aria-label="Previous review"
                      onClick={() =>
                        setActiveReviewIndex(
                          (current) =>
                            (current -
                              1 +
                              reviewSlides.length) %
                            reviewSlides.length
                        )
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-black/18 text-[22px] text-[#F4D36A]"
                    >
                      ‹
                    </button>

                    <button
                      type="button"
                      aria-label="Next review"
                      onClick={() =>
                        setActiveReviewIndex(
                          (current) =>
                            (current + 1) %
                            reviewSlides.length
                        )
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-black/18 text-[22px] text-[#F4D36A]"
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
            </Reveal>
          </div>
        </section>

        {/* ==================================================
            FINAL FULL-SCREEN CTA
        =================================================== */}

        <section className="relative flex min-h-[82svh] items-center overflow-hidden bg-black text-white">
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

              <p className="mt-7 max-w-[630px] text-[14px] font-semibold leading-7 text-white/62 sm:text-[15px]">
                Shop a signature hamper or build one from scratch. Either way, make the gesture feel considered.
              </p>

              <div className="mt-9 flex flex-wrap gap-4">
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

const Reveal = ({
  children,
  className = "",
  delay = 0,
}) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node) return undefined;

    if (
      typeof window === "undefined" ||
      !("IntersectionObserver" in window)
    ) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -7% 0px",
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`hp-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// ======================================================
// SMART IMAGE
// ======================================================

const SmartImage = ({
  src,
  alt,
  className,
  loading = "lazy",
  fetchPriority,
  decoding = "async",
  style,
  draggable = "false",
}) => {
  const [imageSrc, setImageSrc] =
    useState(src);

  const [failed, setFailed] =
    useState(false);

  useEffect(() => {
    setImageSrc(src);
    setFailed(false);
  }, [src]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      className={className}
      style={style}
      draggable={draggable}
      onError={() => {
        if (!failed) {
          setFailed(true);

          setImageSrc(
            HOME_IMAGES.universalFallback
          );
        }
      }}
    />
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

const LovedProductCard = ({
  product,
}) => {
  const destination = product.slug
    ? `/products/${product.slug}`
    : "/gifts";

  return (
    <Link
      to={destination}
      className="hp-bestseller-card group block h-full"
    >
      <SmartImage
        src={product.image}
        alt={product.name}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      <div className="absolute left-5 top-5 z-[3]">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,.55)]">
          Most Loved
        </span>
      </div>

      <div className="hp-bestseller-copy">
        <span className="mb-4 block h-px w-12 bg-[#D4AF37]" />

        <h3
          style={{ fontFamily: DISPLAY_FONT }}
          className="max-w-[360px] text-[30px] font-bold leading-[0.92] tracking-[-0.03em] text-white sm:text-[34px]"
        >
          {product.name}
        </h3>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/48">
              Starting at
            </p>

            <p className="mt-1 text-[18px] font-black text-[#F6D46A]">
              ₹{Number(
                product.price || 0
              ).toLocaleString("en-IN")}
            </p>
          </div>

          <span className="hp-bestseller-arrow flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[20px] text-[#171717]">
            →
          </span>
        </div>
      </div>
    </Link>
  );
};

// ======================================================
// PRODUCT SKELETON
// ======================================================

const ProductSkeleton = () => (
  <div className="h-[clamp(420px,62svh,500px)] min-h-[420px] animate-pulse bg-black/[0.07] lg:h-auto lg:min-h-[470px]" />
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
// CUSTOMER REVIEW ROW
// ======================================================

const CustomerReviewRow = ({
  review,
  featured = false,
}) => {
  const rating = Math.max(
    1,
    Math.min(
      5,
      Number(review?.rating || 5)
    )
  );

  const customerName =
    review?.user?.name ||
    review?.customer?.name ||
    review?.userName ||
    review?.name ||
    "Verified Customer";

  const firstLetter =
    String(customerName)
      .trim()
      .charAt(0)
      .toUpperCase() || "H";

  const dateValue =
    review?.createdAt ||
    review?.updatedAt;

  const reviewDate = dateValue
    ? new Date(dateValue).toLocaleDateString(
        "en-IN",
        {
          month: "short",
          year: "numeric",
        }
      )
    : "";

  return (
    <div className="group relative py-8 sm:py-10 lg:py-11">
      <div className="grid gap-6 sm:grid-cols-[145px_1fr] sm:items-start lg:grid-cols-[160px_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[12px] font-black text-[#E8CC73]">
              {firstLetter}
            </span>

            <div className="min-w-0">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.08em] text-white/75">
                {customerName}
              </p>

              <p className="mt-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#D4AF37]/75">
                Verified Purchase
              </p>
            </div>
          </div>

          <div className="mt-5 flex gap-1 text-[12px] text-[#D4AF37]">
            {Array.from(
              { length: 5 },
              (_, index) => (
                <span
                  key={index}
                  className={
                    index < rating
                      ? "opacity-100"
                      : "opacity-20"
                  }
                >
                  ★
                </span>
              )
            )}
          </div>
        </div>

        <div>
          <p
            style={{ fontFamily: DISPLAY_FONT }}
            className={`font-semibold leading-[1.08] text-[#FFF5DF] transition duration-300 group-hover:text-white ${
              featured
                ? "text-[31px] sm:text-[38px] lg:text-[42px]"
                : "text-[25px] sm:text-[30px]"
            }`}
          >
            “{review.displayMessage}”
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="h-px w-8 bg-[#F47822]" />

            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">
              {review.productName || "HAMPORIUM"}
            </p>

            {reviewDate && (
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/22">
                {reviewDate}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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

export default Home;
