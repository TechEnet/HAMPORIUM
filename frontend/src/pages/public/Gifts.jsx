import {
  useEffect,
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import api from "../../api/api.js";

import ProductCard from "../../components/ProductCard.jsx";
import Pagination from "../../components/Pagination.jsx";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const emptyFilters = {
  search: "",
  category: "",
  collection: "",
  minPrice: "",
  maxPrice: "",
  featured: false,
  sort: "",
};

const CATEGORY_META = {
  "wedding-hampers": {
    eyebrow:
      "Wedding Collection",

    title:
      "Wedding Hampers",

    description:
      "Ready-made wedding hampers for welcome gifting, celebrations, family and meaningful beginnings.",
  },

  "corporate-hampers": {
    eyebrow:
      "Business Collection",

    title:
      "Corporate Hampers",

    description:
      "Ready-made gifting for employees, clients, leadership and professional occasions.",
  },

  "diwali-hampers": {
    eyebrow:
      "Festive Collection",

    title:
      "Diwali Hampers",

    description:
      "Curated festive hampers designed for memorable Diwali gifting.",
  },

  "birthday-hampers": {
    eyebrow:
      "Celebration Collection",

    title:
      "Birthday Hampers",

    description:
      "Thoughtful birthday hampers for celebrating the people who matter.",
  },

  "anniversary-hampers": {
    eyebrow:
      "Celebration Collection",

    title:
      "Anniversary Hampers",

    description:
      "Elegant hampers for anniversaries and meaningful milestones.",
  },

  "gourmet-hampers": {
    eyebrow:
      "Gourmet Collection",

    title:
      "Gourmet Hampers",

    description:
      "Curated gourmet gifting with premium food and beverage selections.",
  },

  "wellness-hampers": {
    eyebrow:
      "Wellness Collection",

    title:
      "Wellness Hampers",

    description:
      "Thoughtful wellness gifting designed for moments of care and calm.",
  },

  "thank-you-hampers": {
    eyebrow:
      "Thoughtful Gifting",

    title:
      "Thank You Hampers",

    description:
      "Beautiful ways to express appreciation through thoughtful gifting.",
  },

  "congratulations-hampers": {
    eyebrow:
      "Celebration Collection",

    title:
      "Congratulations Hampers",

    description:
      "Celebrate achievements and new beginnings with a curated hamper.",
  },

  "new-baby-hampers": {
    eyebrow:
      "New Beginnings",

    title:
      "New Baby Hampers",

    description:
      "Thoughtful gifts created to celebrate a beautiful new arrival.",
  },
};

// ======================================================
// CATALOGUE META
// ======================================================

const getCatalogueMeta = ({
  filters,
  categories,
}) => {
  if (
    filters.category
  ) {
    const known =
      CATEGORY_META[
        filters.category
      ];

    if (known) {
      return known;
    }

    const category =
      categories.find(
        (item) =>
          (
            item.slug ||
            item._id
          ) ===
          filters.category
      );

    if (category) {
      return {
        eyebrow:
          "Curated Collection",

        title:
          category.name,

        description:
          category.description ||
          `Explore our ${category.name.toLowerCase()} collection.`,
      };
    }
  }

  if (
    filters.collection
  ) {
    return {
      eyebrow:
        "Collection",

      title:
        "Curated Collection",

      description:
        "Explore hampers selected for this HAMPORIUM collection.",
    };
  }

  if (
    filters.search
  ) {
    return {
      eyebrow:
        "Search Results",

      title:
        `Results for “${filters.search}”`,

      description:
        "Products matching your search across the HAMPORIUM catalogue.",
    };
  }

  if (
    filters.featured
  ) {
    return {
      eyebrow:
        "HAMPORIUM Favourites",

      title:
        "Featured Hampers",

      description:
        "A curated edit of our highlighted and most-loved hampers.",
    };
  }

  return {
    eyebrow:
      "HAMPORIUM Collection",

    title:
      "All Gift Hampers",

    description:
      "Explore ready-made hampers across occasions, celebrations and gifting styles.",
  };
};

// ======================================================
// GIFTS
// ======================================================

const Gifts = () => {
  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams();

  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    reviewMap,
    setReviewMap,
  ] = useState({});

  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    collections,
    setCollections,
  ] = useState([]);

  const [
    pagination,
    setPagination,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    mobileFiltersOpen,
    setMobileFiltersOpen,
  ] = useState(false);

  const [
    filters,
    setFilters,
  ] = useState({
    search:
      searchParams.get(
        "search"
      ) || "",

    category:
      searchParams.get(
        "category"
      ) || "",

    collection:
      searchParams.get(
        "collection"
      ) || "",

    minPrice:
      searchParams.get(
        "minPrice"
      ) || "",

    maxPrice:
      searchParams.get(
        "maxPrice"
      ) || "",

    featured:
      searchParams.get(
        "featured"
      ) === "true",

    sort:
      searchParams.get(
        "sort"
      ) || "",
  });

  // ======================================================
  // URL -> FILTERS
  // ======================================================

  useEffect(() => {
    setFilters({
      search:
        searchParams.get(
          "search"
        ) || "",

      category:
        searchParams.get(
          "category"
        ) || "",

      collection:
        searchParams.get(
          "collection"
        ) || "",

      minPrice:
        searchParams.get(
          "minPrice"
        ) || "",

      maxPrice:
        searchParams.get(
          "maxPrice"
        ) || "",

      featured:
        searchParams.get(
          "featured"
        ) === "true",

      sort:
        searchParams.get(
          "sort"
        ) || "",
    });
  }, [searchParams]);

  // ======================================================
  // FILTER DATA
  // ======================================================

  useEffect(() => {
    const loadFilters =
      async () => {
        try {
          const [
            categoryResponse,
            collectionResponse,
          ] =
            await Promise.all(
              [
                api.get(
                  "/catalog/categories"
                ),

                api.get(
                  "/catalog/collections"
                ),
              ]
            );

          setCategories(
            categoryResponse
              .data
              .categories ||
              []
          );

          setCollections(
            collectionResponse
              .data
              .collections ||
              []
          );
        } catch (error) {
          console.error(
            "Gift filters error:",
            error
          );
        }
      };

    loadFilters();
  }, []);

  // ======================================================
  // PRODUCTS
  // ======================================================

  useEffect(() => {
    let active = true;

    const loadProducts =
      async () => {
        setLoading(true);

        try {
          const response =
            await api.get(
              `/catalog/products?${searchParams.toString()}`
            );

          const loadedProducts =
            response.data
              .products ||
              [];

          if (!active) {
            return;
          }

          setProducts(
            loadedProducts
          );

          setPagination(
            response.data
              .pagination ||
              null
          );

          /*
           * Public review summaries for the visible hamper cards.
           *
           * This keeps the catalogue UI working even before
           * rating summary is embedded directly in /catalog/products.
           */
          const ratingResults =
            await Promise.allSettled(
              loadedProducts.map(
                (product) =>
                  api.get(
                    `/reviews/product/${product._id}`,
                    {
                      params: {
                        page: 1,
                        limit: 1,
                      },
                    }
                  )
              )
            );

          if (!active) {
            return;
          }

          const nextReviewMap =
            {};

          ratingResults.forEach(
            (
              result,
              index
            ) => {
              const product =
                loadedProducts[
                  index
                ];

              if (
                !product?._id ||
                result.status !==
                  "fulfilled"
              ) {
                return;
              }

              const summary =
                result.value
                  .data
                  ?.summary ||
                null;

              if (!summary) {
                return;
              }

              nextReviewMap[
                product._id
              ] = {
                averageRating:
                  Number(
                    summary.averageRating ||
                      0
                  ),

                totalReviews:
                  Number(
                    summary.totalReviews ||
                      0
                  ),
              };
            }
          );

          setReviewMap(
            nextReviewMap
          );
        } catch (error) {
          console.error(
            "Products error:",
            error
          );

          if (active) {
            setProducts([]);
            setPagination(null);
            setReviewMap({});
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    void loadProducts();

    return () => {
      active = false;
    };
  }, [searchParams]);

  // ======================================================
  // APPLY
  // ======================================================

  const applyFilters =
    () => {
      const params =
        new URLSearchParams();

      Object.entries(
        filters
      ).forEach(
        ([key, value]) => {
          if (
            value !== "" &&
            value !== false
          ) {
            params.set(
              key,
              String(value)
            );
          }
        }
      );

      params.set(
        "page",
        "1"
      );

      setSearchParams(
        params
      );

      setMobileFiltersOpen(
        false
      );
    };

  // ======================================================
  // CLEAR
  // ======================================================

  const clearFilters =
    () => {
      setFilters(
        emptyFilters
      );

      setSearchParams({});

      setMobileFiltersOpen(
        false
      );
    };

  // ======================================================
  // SORT
  // ======================================================

  const changeSort = (
    value
  ) => {
    const params =
      new URLSearchParams(
        searchParams
      );

    if (value) {
      params.set(
        "sort",
        value
      );
    } else {
      params.delete(
        "sort"
      );
    }

    params.set(
      "page",
      "1"
    );

    setFilters(
      (current) => ({
        ...current,
        sort: value,
      })
    );

    setSearchParams(
      params
    );
  };

  // ======================================================
  // PAGE
  // ======================================================

  const changePage = (
    page
  ) => {
    const params =
      new URLSearchParams(
        searchParams
      );

    params.set(
      "page",
      String(page)
    );

    setSearchParams(
      params
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const totalProducts =
    Number(
      pagination?.total ||
        products.length ||
        0
    );

  const catalogueMeta =
    getCatalogueMeta({
      filters,
      categories,
    });

  return (
    <main
      className="min-h-screen w-full bg-[#FBF8F4] text-[#171717]"
      style={{
        fontFamily:
          "'Manrope', Arial, sans-serif",
      }}
    >
      <style>
        {`
          /* ==================================================
             HAMPORIUM · DESIGNER GIFT-WRAP CATALOGUE CARDS
             Whole catalogue card reads like a premium wrapped gift.
             ProductCard itself remains untouched, so its existing
             navigation, analytics, reviews and price logic are preserved.
          ================================================== */

          .hp-catalogue-gift {
            --wrap-paper-1: #FFF8EC;
            --wrap-paper-2: #EADBC2;
            --wrap-ink: #2A2119;
            --wrap-gold: #B98729;
            --wrap-gold-light: #F2D98A;
            --wrap-edge: rgba(169, 119, 34, .34);

            position: relative;
            isolation: isolate;
            min-width: 0;
            overflow: hidden;
            border-radius: 26px;
            padding: 13px 13px 17px;
            background:
              radial-gradient(
                circle at 18% 8%,
                rgba(255,255,255,.52),
                transparent 26%
              ),
              linear-gradient(
                145deg,
                var(--wrap-paper-1) 0%,
                var(--wrap-paper-2) 100%
              );
            border: 1px solid var(--wrap-edge);
            box-shadow:
              0 20px 48px rgba(38, 28, 16, .10),
              0 7px 18px rgba(38, 28, 16, .06),
              inset 0 1px 0 rgba(255,255,255,.62);
            transition:
              transform .62s cubic-bezier(.22,1,.36,1),
              box-shadow .62s ease,
              border-color .45s ease;
          }

          .hp-catalogue-gift::before {
            content: "";
            position: absolute;
            inset: 7px;
            z-index: 1;
            pointer-events: none;
            border-radius: 20px;
            border: 1px solid color-mix(
              in srgb,
              var(--wrap-edge) 76%,
              transparent
            );
          }

          .hp-catalogue-gift::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            opacity: .18;
            background-image:
              radial-gradient(
                rgba(255,255,255,.68) .55px,
                transparent .55px
              ),
              radial-gradient(
                rgba(96,62,18,.14) .45px,
                transparent .45px
              );
            background-size: 8px 8px;
            background-position: 0 0, 4px 4px;
            mix-blend-mode: soft-light;
          }

          .hp-catalogue-gift:hover {
            transform: translateY(-7px);
            border-color:
              color-mix(
                in srgb,
                var(--wrap-gold) 60%,
                transparent
              );
            box-shadow:
              0 32px 74px rgba(38, 28, 16, .16),
              0 10px 26px rgba(38, 28, 16, .08),
              inset 0 1px 0 rgba(255,255,255,.68);
          }

          /* Five refined wrapping-paper variations */
          .hp-catalogue-gift--0 {
            --wrap-paper-1: #FFF9EF;
            --wrap-paper-2: #E9D8B9;
            --wrap-gold: #B17B1F;
            --wrap-edge: rgba(177,123,31,.34);
          }

          .hp-catalogue-gift--1 {
            --wrap-paper-1: #F2F0E7;
            --wrap-paper-2: #CFD6C3;
            --wrap-gold: #9A7A2D;
            --wrap-edge: rgba(112,106,60,.28);
          }

          .hp-catalogue-gift--2 {
            --wrap-paper-1: #FFF3EE;
            --wrap-paper-2: #E8C8BD;
            --wrap-gold: #A86C48;
            --wrap-edge: rgba(151,91,59,.26);
          }

          .hp-catalogue-gift--3 {
            --wrap-paper-1: #FFF9EE;
            --wrap-paper-2: #DDD1BD;
            --wrap-gold: #A57623;
            --wrap-edge: rgba(150,108,37,.28);
          }

          .hp-catalogue-gift--4 {
            --wrap-paper-1: #F4F5F2;
            --wrap-paper-2: #CCD3D7;
            --wrap-gold: #9D782D;
            --wrap-edge: rgba(92,103,108,.25);
          }

          .hp-catalogue-gift-inner {
            position: relative;
            z-index: 3;
            overflow: hidden;
            border-radius: 18px;
            padding: 10px;
            background:
              rgba(255,255,255,.78);
            border: 1px solid rgba(255,255,255,.72);
            box-shadow:
              0 12px 28px rgba(31,22,12,.08),
              inset 0 1px 0 rgba(255,255,255,.92);
            backdrop-filter: blur(3px);
            -webkit-backdrop-filter: blur(3px);
            transition:
              transform .62s cubic-bezier(.22,1,.36,1),
              box-shadow .55s ease;
          }

          .hp-catalogue-gift:hover
          .hp-catalogue-gift-inner {
            transform: translateY(-2px);
            box-shadow:
              0 18px 36px rgba(31,22,12,.11),
              inset 0 1px 0 rgba(255,255,255,.96);
          }

          /* Satin bands sit on the OUTER package, not on product image */
          .hp-catalogue-wrap-ribbon-v,
          .hp-catalogue-wrap-ribbon-h {
            position: absolute;
            z-index: 2;
            pointer-events: none;
            display: block;
            border: 1px solid rgba(255,239,180,.28);
            background:
              linear-gradient(
                90deg,
                #81520D 0%,
                #C79330 22%,
                #F0D57E 49%,
                #C28B27 76%,
                #754809 100%
              );
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.30),
              0 4px 12px rgba(55,35,6,.14);
            opacity: .88;
          }

          .hp-catalogue-wrap-ribbon-v {
            top: 0;
            bottom: 0;
            left: 26px;
            width: 8px;
          }

          .hp-catalogue-wrap-ribbon-h {
            left: 0;
            right: 0;
            top: 26px;
            height: 8px;
            background:
              linear-gradient(
                180deg,
                #81520D 0%,
                #C79330 22%,
                #F0D57E 49%,
                #C28B27 76%,
                #754809 100%
              );
          }

          /* Small couture bow at package corner */
          .hp-catalogue-bow {
            position: absolute;
            z-index: 5;
            top: 13px;
            left: 13px;
            width: 42px;
            height: 38px;
            pointer-events: none;
            filter:
              drop-shadow(0 6px 9px rgba(40,24,3,.18));
            transition:
              transform .65s cubic-bezier(.22,1,.36,1);
          }

          .hp-catalogue-bow-loop,
          .hp-catalogue-bow-knot {
            position: absolute;
            display: block;
            border: 1px solid rgba(255,239,184,.34);
            background:
              linear-gradient(
                135deg,
                #F7E5A5 0%,
                #D0A03F 50%,
                #8F5D12 100%
              );
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.24);
          }

          .hp-catalogue-bow-loop {
            top: 7px;
            width: 21px;
            height: 15px;
          }

          .hp-catalogue-bow-loop-left {
            left: 0;
            border-radius: 76% 34% 68% 38%;
            transform: rotate(-31deg);
          }

          .hp-catalogue-bow-loop-right {
            right: 0;
            border-radius: 34% 76% 38% 68%;
            transform: rotate(31deg);
          }

          .hp-catalogue-bow-knot {
            z-index: 2;
            top: 9px;
            left: 50%;
            width: 14px;
            height: 14px;
            transform: translateX(-50%);
            border-radius: 999px;
          }

          .hp-catalogue-gift:hover
          .hp-catalogue-bow {
            transform:
              translate3d(1px,-2px,0)
              scale(1.06)
              rotate(-2deg);
          }

          /* Narrow foil corners make the package feel constructed */
          .hp-catalogue-corner {
            position: absolute;
            z-index: 4;
            width: 24px;
            height: 24px;
            pointer-events: none;
            opacity: .70;
          }

          .hp-catalogue-corner::before,
          .hp-catalogue-corner::after {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            display: block;
            background:
              linear-gradient(
                90deg,
                #F1D889,
                var(--wrap-gold)
              );
          }

          .hp-catalogue-corner::before {
            width: 20px;
            height: 1px;
          }

          .hp-catalogue-corner::after {
            width: 1px;
            height: 20px;
          }

          .hp-catalogue-corner-tr {
            top: 8px;
            right: 8px;
            transform: scaleX(-1);
          }

          .hp-catalogue-corner-bl {
            bottom: 8px;
            left: 8px;
            transform: scaleY(-1);
          }

          .hp-catalogue-corner-br {
            right: 8px;
            bottom: 8px;
            transform: scale(-1);
          }

          /* One soft sheen on hover — no loud animation */
          .hp-catalogue-sheen {
            position: absolute;
            z-index: 6;
            top: -20%;
            bottom: -20%;
            left: -32%;
            width: 14%;
            pointer-events: none;
            opacity: 0;
            transform: skewX(-18deg);
            background:
              linear-gradient(
                90deg,
                transparent,
                rgba(255,255,255,.10),
                rgba(255,244,200,.24),
                rgba(255,255,255,.08),
                transparent
              );
          }

          .hp-catalogue-gift:hover
          .hp-catalogue-sheen {
            opacity: 1;
            animation:
              hpCatalogueGiftSheen 1.05s
              cubic-bezier(.16,1,.3,1)
              both;
          }

          @keyframes hpCatalogueGiftSheen {
            from {
              transform:
                skewX(-18deg)
                translateX(0);
            }

            to {
              transform:
                skewX(-18deg)
                translateX(920%);
            }
          }

          @media (max-width: 639px) {
            .hp-catalogue-gift {
              border-radius: 22px;
              padding: 10px 10px 14px;
            }

            .hp-catalogue-gift::before {
              inset: 6px;
              border-radius: 17px;
            }

            .hp-catalogue-gift-inner {
              border-radius: 15px;
              padding: 8px;
            }

            .hp-catalogue-wrap-ribbon-v {
              left: 20px;
              width: 7px;
            }

            .hp-catalogue-wrap-ribbon-h {
              top: 20px;
              height: 7px;
            }

            .hp-catalogue-bow {
              top: 8px;
              left: 8px;
              transform: scale(.84);
            }

            .hp-catalogue-gift:hover {
              transform: none;
            }

            .hp-catalogue-gift:hover
            .hp-catalogue-gift-inner {
              transform: none;
            }

            .hp-catalogue-gift:hover
            .hp-catalogue-bow {
              transform: scale(.84);
            }

            .hp-catalogue-sheen {
              display: none;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .hp-catalogue-gift,
            .hp-catalogue-gift-inner,
            .hp-catalogue-bow {
              transition: none !important;
            }

            .hp-catalogue-sheen {
              display: none !important;
            }
          }

          /* ==================================================
             V2 · LUXURY FILTER STUDIO
             One refined editorial surface with readable type.
          ================================================== */

          .hp-filter-shell {
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(167, 118, 30, .18);
            border-radius: 28px;
            background:
              radial-gradient(
                circle at 14% 0%,
                rgba(244,120,34,.07),
                transparent 28%
              ),
              radial-gradient(
                circle at 100% 92%,
                rgba(212,175,55,.10),
                transparent 26%
              ),
              linear-gradient(
                160deg,
                rgba(255,252,247,.98) 0%,
                rgba(247,239,226,.96) 100%
              );
            box-shadow:
              0 24px 56px rgba(42,29,13,.08),
              inset 0 1px 0 rgba(255,255,255,.90);
          }

          .hp-filter-shell::before {
            content: "";
            position: absolute;
            inset: 8px;
            pointer-events: none;
            border: 1px solid rgba(180, 133, 46, .11);
            border-radius: 21px;
          }

          .hp-filter-shell::after {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: .20;
            background-image:
              radial-gradient(
                rgba(255,255,255,.7) .55px,
                transparent .55px
              ),
              radial-gradient(
                rgba(96,64,20,.10) .45px,
                transparent .45px
              );
            background-size: 8px 8px;
            background-position: 0 0, 4px 4px;
            mix-blend-mode: soft-light;
          }

          .hp-filter-inner {
            position: relative;
            z-index: 2;
            padding: 22px 20px 20px;
          }

          .hp-filter-head {
            position: relative;
            padding-bottom: 22px;
          }

          .hp-filter-head::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 1px;
            background:
              linear-gradient(
                90deg,
                #F47822 0%,
                #D4AF37 22%,
                rgba(23,23,23,.10) 58%,
                transparent 100%
              );
          }

          .hp-filter-kicker {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 7px;
            color: #A67820;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .19em;
            text-transform: uppercase;
          }

          .hp-filter-kicker::before {
            content: "";
            width: 18px;
            height: 1px;
            background: #F47822;
          }

          .hp-filter-title {
            margin: 0;
            color: #171717;
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
            font-size: 34px;
            font-weight: 700;
            line-height: .95;
            letter-spacing: -.025em;
          }

          .hp-filter-clear {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            border: 0;
            padding: 0;
            background: transparent;
            color: rgba(23,23,23,.48);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .02em;
            transition:
              color .25s ease,
              transform .25s ease;
          }

          .hp-filter-clear:hover {
            color: #F47822;
            transform: translateX(-2px);
          }

          .hp-filter-section {
            position: relative;
            padding: 22px 0;
            border-bottom: 1px solid rgba(23,23,23,.08);
          }

          .hp-filter-section:last-of-type {
            border-bottom: 0;
          }

          .hp-filter-section-head {
            margin-bottom: 14px;
          }

          .hp-filter-section-title {
            color: #171717;
            font-family:
              'Cormorant Garamond',
              'Playfair Display',
              Georgia,
              serif;
            font-size: 21px;
            font-weight: 700;
            line-height: 1;
            letter-spacing: -.015em;
          }

          .hp-filter-chevron {
            display: grid;
            place-items: center;
            width: 24px;
            height: 24px;
            border-radius: 999px;
            border: 1px solid rgba(23,23,23,.08);
            background: rgba(255,255,255,.58);
            color: rgba(23,23,23,.38);
          }

          .hp-filter-search {
            width: 100%;
            height: 48px;
            border-radius: 14px;
            border: 1px solid rgba(23,23,23,.10);
            background: rgba(255,255,255,.82);
            padding: 0 15px;
            color: #171717;
            font-size: 12px;
            font-weight: 650;
            outline: none;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.88);
            transition:
              border-color .28s ease,
              box-shadow .28s ease,
              background-color .28s ease;
          }

          .hp-filter-search::placeholder {
            color: rgba(23,23,23,.32);
            font-weight: 600;
          }

          .hp-filter-search:focus {
            border-color: rgba(244,120,34,.62);
            background: #fff;
            box-shadow:
              0 0 0 4px rgba(244,120,34,.08),
              inset 0 1px 0 rgba(255,255,255,.92);
          }

          .hp-filter-choice {
            position: relative;
            display: flex;
            min-height: 40px;
            cursor: pointer;
            align-items: center;
            gap: 11px;
            border-radius: 12px;
            padding: 7px 9px;
            margin: 2px -9px;
            transition:
              background-color .25s ease,
              transform .25s ease;
          }

          .hp-filter-choice:hover {
            background: rgba(255,255,255,.56);
            transform: translateX(2px);
          }

          .hp-filter-choice-input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
          }

          .hp-filter-radio {
            position: relative;
            display: grid;
            place-items: center;
            width: 18px;
            height: 18px;
            flex: 0 0 18px;
            border-radius: 999px;
            border: 1.5px solid rgba(23,23,23,.34);
            background: rgba(255,255,255,.72);
            transition:
              border-color .25s ease,
              box-shadow .25s ease,
              background-color .25s ease;
          }

          .hp-filter-radio::after {
            content: "";
            width: 8px;
            height: 8px;
            border-radius: inherit;
            background: #F47822;
            transform: scale(0);
            transition:
              transform .22s cubic-bezier(.22,1,.36,1);
          }

          .hp-filter-choice-input:checked
          + .hp-filter-radio {
            border-color: #F47822;
            background: #fff;
            box-shadow:
              0 0 0 4px rgba(244,120,34,.08);
          }

          .hp-filter-choice-input:checked
          + .hp-filter-radio::after {
            transform: scale(1);
          }

          .hp-filter-choice-label {
            min-width: 0;
            color: rgba(23,23,23,.68);
            font-size: 12px;
            font-weight: 700;
            line-height: 1.35;
            transition: color .24s ease;
          }

          .hp-filter-choice-input:checked
          ~ .hp-filter-choice-label {
            color: #E86C1C;
            font-weight: 800;
          }

          .hp-filter-price-label {
            margin: 0 0 7px;
            color: rgba(23,23,23,.38);
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .12em;
            text-transform: uppercase;
          }

          .hp-filter-price-box {
            display: flex;
            height: 46px;
            align-items: center;
            border-radius: 13px;
            border: 1px solid rgba(23,23,23,.10);
            background: rgba(255,255,255,.82);
            padding: 0 12px;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.88);
            transition:
              border-color .28s ease,
              box-shadow .28s ease,
              background-color .28s ease;
          }

          .hp-filter-price-box:focus-within {
            border-color: rgba(244,120,34,.60);
            background: #fff;
            box-shadow:
              0 0 0 4px rgba(244,120,34,.07);
          }

          .hp-filter-price-currency {
            margin-right: 5px;
            color: #A67820;
            font-size: 12px;
            font-weight: 800;
          }

          .hp-filter-price-input {
            min-width: 0;
            flex: 1;
            border: 0;
            background: transparent;
            color: #171717;
            font-size: 12px;
            font-weight: 750;
            outline: none;
          }

          .hp-filter-price-input::placeholder {
            color: rgba(23,23,23,.35);
          }

          .hp-filter-price-track {
            position: relative;
            margin-top: 17px;
            height: 2px;
            border-radius: 999px;
            background:
              linear-gradient(
                90deg,
                #F47822 0%,
                #D4AF37 100%
              );
            box-shadow:
              0 0 14px rgba(244,120,34,.12);
          }

          .hp-filter-price-track::before,
          .hp-filter-price-track::after {
            content: "";
            position: absolute;
            top: 50%;
            width: 10px;
            height: 10px;
            border-radius: 999px;
            border: 2px solid #FFF8EE;
            background: #F47822;
            box-shadow:
              0 3px 8px rgba(244,120,34,.22);
            transform: translateY(-50%);
          }

          .hp-filter-price-track::before {
            left: -1px;
          }

          .hp-filter-price-track::after {
            right: -1px;
            background: #D4AF37;
          }

          .hp-filter-featured {
            display: flex;
            cursor: pointer;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            border-radius: 14px;
            padding: 11px 12px;
            margin: 0 -3px;
            background: rgba(255,255,255,.48);
            border: 1px solid rgba(23,23,23,.06);
          }

          .hp-filter-featured-copy {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .hp-filter-featured-title {
            color: #171717;
            font-size: 12px;
            font-weight: 800;
          }

          .hp-filter-featured-note {
            color: rgba(23,23,23,.42);
            font-size: 9px;
            font-weight: 600;
          }

          .hp-filter-toggle-input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
          }

          .hp-filter-toggle {
            position: relative;
            width: 40px;
            height: 22px;
            flex: 0 0 40px;
            border-radius: 999px;
            background: rgba(23,23,23,.13);
            transition: background-color .28s ease;
          }

          .hp-filter-toggle::after {
            content: "";
            position: absolute;
            top: 3px;
            left: 3px;
            width: 16px;
            height: 16px;
            border-radius: 999px;
            background: #fff;
            box-shadow:
              0 3px 8px rgba(0,0,0,.16);
            transition:
              transform .28s cubic-bezier(.22,1,.36,1);
          }

          .hp-filter-toggle-input:checked
          + .hp-filter-toggle {
            background:
              linear-gradient(
                90deg,
                #F47822,
                #D4AF37
              );
          }

          .hp-filter-toggle-input:checked
          + .hp-filter-toggle::after {
            transform: translateX(18px);
          }

          .hp-filter-apply-wrap {
            padding-top: 20px;
          }

          .hp-filter-apply {
            position: relative;
            display: flex;
            width: 100%;
            height: 50px;
            overflow: hidden;
            align-items: center;
            justify-content: center;
            gap: 11px;
            border: 0;
            border-radius: 14px;
            background:
              linear-gradient(
                90deg,
                #171717 0%,
                #26211C 100%
              );
            color: #fff;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: .13em;
            text-transform: uppercase;
            box-shadow:
              0 16px 30px rgba(23,23,23,.14);
            transition:
              transform .32s cubic-bezier(.22,1,.36,1),
              box-shadow .32s ease,
              background-color .32s ease;
          }

          .hp-filter-apply::before {
            content: "";
            position: absolute;
            inset: 0 auto 0 -34%;
            width: 24%;
            transform: skewX(-18deg);
            background:
              linear-gradient(
                90deg,
                transparent,
                rgba(255,255,255,.22),
                transparent
              );
            transition:
              left .72s cubic-bezier(.22,1,.36,1);
          }

          .hp-filter-apply:hover {
            transform: translateY(-2px);
            background:
              linear-gradient(
                90deg,
                #F47822 0%,
                #E56A18 100%
              );
            box-shadow:
              0 18px 36px rgba(244,120,34,.22);
          }

          .hp-filter-apply:hover::before {
            left: 118%;
          }

          .hp-filter-apply-arrow {
            font-size: 17px;
            line-height: 1;
            transition:
              transform .32s cubic-bezier(.22,1,.36,1);
          }

          .hp-filter-apply:hover
          .hp-filter-apply-arrow {
            transform: translateX(4px);
          }

          @media (max-width: 1023px) {
            .hp-filter-shell {
              border-radius: 24px;
              box-shadow:
                0 18px 44px rgba(42,29,13,.10),
                inset 0 1px 0 rgba(255,255,255,.90);
            }

            .hp-filter-inner {
              padding: 20px 18px 18px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .hp-filter-choice,
            .hp-filter-clear,
            .hp-filter-apply,
            .hp-filter-apply::before,
            .hp-filter-apply-arrow,
            .hp-filter-toggle::after {
              transition: none !important;
            }
          }


          /* ==================================================
             V3 · FULL-WIDTH RESPONSIVE CATALOGUE
             Fluid spacing from small phones to wide desktops.
          ================================================== */

          .hp-catalogue-gift {
            width: 100%;
          }

          .hp-catalogue-gift-inner {
            width: 100%;
          }

          @media (min-width: 1536px) {
            .hp-catalogue-gift {
              border-radius: 24px;
              padding: 12px 12px 16px;
            }

            .hp-catalogue-gift-inner {
              border-radius: 17px;
              padding: 9px;
            }
          }

          @media (max-width: 1279px) {
            .hp-filter-inner {
              padding: 20px 17px 18px;
            }

            .hp-filter-title {
              font-size: 31px;
            }

            .hp-filter-section-title {
              font-size: 19px;
            }

            .hp-filter-choice-label {
              font-size: 11px;
            }
          }

          @media (max-width: 1023px) {
            .hp-catalogue-gift {
              min-width: 0;
            }
          }

          @media (max-width: 767px) {
            .hp-catalogue-gift {
              border-radius: 22px;
            }

            .hp-catalogue-gift-inner {
              border-radius: 15px;
            }
          }

          @media (max-width: 639px) {
            .hp-filter-shell {
              border-radius: 22px;
            }

            .hp-filter-inner {
              padding: 18px 15px 16px;
            }

            .hp-filter-title {
              font-size: 30px;
            }

            .hp-filter-section {
              padding: 19px 0;
            }

            .hp-filter-section-title {
              font-size: 19px;
            }

            .hp-filter-choice {
              min-height: 42px;
              padding: 8px 8px;
            }

            .hp-filter-choice-label {
              font-size: 12px;
            }

            .hp-filter-search {
              height: 46px;
              font-size: 12px;
            }

            .hp-filter-price-box {
              height: 44px;
            }

            .hp-filter-featured-title {
              font-size: 12px;
            }

            .hp-filter-featured-note {
              font-size: 9px;
            }

            .hp-filter-apply {
              height: 48px;
            }
          }

          @media (max-width: 380px) {
            .hp-filter-inner {
              padding-left: 13px;
              padding-right: 13px;
            }

            .hp-filter-title {
              font-size: 28px;
            }

            .hp-filter-choice-label {
              font-size: 11.5px;
            }

            .hp-catalogue-gift {
              padding: 9px 9px 13px;
            }
          }
        `}
      </style>

      <section className="w-full px-3 pb-14 pt-[96px] sm:px-4 sm:pb-16 sm:pt-[104px] md:px-5 lg:px-6 lg:pb-20 lg:pt-[112px] xl:px-7 2xl:px-8">
        {/* MOBILE FILTER */}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={() =>
              setMobileFiltersOpen(
                true
              )
            }
            className="flex h-[44px] items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#FFF9F0] px-4 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#171717] shadow-[0_8px_22px_rgba(31,22,12,.06)]"
          >
            <FilterIcon />

            Filters
          </button>

          <SortSelect
            value={
              filters.sort
            }
            onChange={
              changeSort
            }
          />
        </div>

        <div className="grid min-w-0 gap-0 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[295px_minmax(0,1fr)] 2xl:grid-cols-[310px_minmax(0,1fr)]">
          {/* SIDEBAR */}

          <aside className="hidden min-w-0 pr-4 lg:block xl:pr-6 2xl:pr-7">
            <div className="sticky top-[105px] max-h-[calc(100vh-125px)] overflow-y-auto pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterPanel
                filters={
                  filters
                }
                setFilters={
                  setFilters
                }
                categories={
                  categories
                }
                collections={
                  collections
                }
                onApply={
                  applyFilters
                }
                onClear={
                  clearFilters
                }
              />
            </div>
          </aside>

          {/* PRODUCT AREA */}

          <div className="min-w-0 lg:pl-5 xl:pl-7 2xl:pl-8">
            <div className="flex flex-col gap-5 border-b border-black/[0.08] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-[760px]">
                <div className="flex items-center gap-2">
                  <span className="h-px w-7 bg-[#F47822]" />

                  <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#F47822] sm:text-[10px]">
                    {
                      catalogueMeta.eyebrow
                    }
                  </p>
                </div>

                <h1
                  style={{
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                  className="mt-3 text-[38px] font-semibold leading-none tracking-[-0.035em] sm:text-[45px]"
                >
                  {
                    catalogueMeta.title
                  }
                </h1>

                <p className="mt-3 max-w-[700px] text-[12px] font-medium leading-6 text-black/45 sm:text-[13px]">
                  {
                    catalogueMeta.description
                  }
                </p>

                <p className="mt-3 text-[10px] font-medium text-black/35 sm:text-[11px]">
                  Showing{" "}
                  {products.length}{" "}
                  of{" "}
                  {totalProducts}{" "}
                  hampers
                </p>
              </div>

              <div className="hidden items-center gap-3 lg:flex">
                <SortSelect
                  value={
                    filters.sort
                  }
                  onChange={
                    changeSort
                  }
                />

                <div className="flex h-[42px] w-[42px] items-center justify-center border border-[#F47822]/30 bg-[#FFF5EC] text-[#F47822]">
                  <GridIcon />
                </div>
              </div>
            </div>

            <ActiveFilters
              filters={
                filters
              }
              categories={
                categories
              }
              collections={
                collections
              }
              onClear={
                clearFilters
              }
            />

            {loading ? (
              <div className="mt-5 grid items-start gap-x-3 gap-y-6 sm:grid-cols-2 md:gap-x-4 md:gap-y-8 xl:grid-cols-3 2xl:grid-cols-4 2xl:gap-x-5">
                {[
                  1,
                  2,
                  3,
                  4,
                  5,
                  6,
                ].map(
                  (item) => (
                    <ProductSkeleton
                      key={item}
                    />
                  )
                )}
              </div>
            ) : products.length ===
              0 ? (
              <div className="flex min-h-[420px] items-center justify-center border-b border-black/[0.08]">
                <div className="max-w-md text-center">
                  <p
                    style={{
                      fontFamily:
                        DISPLAY_FONT,
                    }}
                    className="text-[32px] font-semibold"
                  >
                    No hampers found
                  </p>

                  <p className="mt-3 text-[12px] leading-6 text-black/40">
                    We couldn't find products matching this collection or filter combination.
                  </p>

                  <button
                    type="button"
                    onClick={
                      clearFilters
                    }
                    className="mt-5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#F47822] hover:text-[#171717]"
                  >
                    Clear Filters →
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5 grid items-start gap-x-3 gap-y-6 sm:grid-cols-2 md:gap-x-4 md:gap-y-8 xl:grid-cols-3 2xl:grid-cols-4 2xl:gap-x-5">
                  {products.map(
                    (product, index) => {
                      const reviewSummary =
                        reviewMap[
                          product._id
                        ];

                      const totalReviews =
                        Number(
                          reviewSummary
                            ?.totalReviews ||
                            0
                        );

                      const averageRating =
                        Number(
                          reviewSummary
                            ?.averageRating ||
                            0
                        );

                      const wrapVariant =
                        index % 5;

                      return (
                        <div
                          key={
                            product._id
                          }
                          className={`hp-catalogue-gift hp-catalogue-gift--${wrapVariant}`}
                        >
                          <span
                            className="hp-catalogue-wrap-ribbon-v"
                            aria-hidden="true"
                          />

                          <span
                            className="hp-catalogue-wrap-ribbon-h"
                            aria-hidden="true"
                          />

                          <span
                            className="hp-catalogue-bow"
                            aria-hidden="true"
                          >
                            <span className="hp-catalogue-bow-loop hp-catalogue-bow-loop-left" />
                            <span className="hp-catalogue-bow-loop hp-catalogue-bow-loop-right" />
                            <span className="hp-catalogue-bow-knot" />
                          </span>

                          <span
                            className="hp-catalogue-corner hp-catalogue-corner-tr"
                            aria-hidden="true"
                          />

                          <span
                            className="hp-catalogue-corner hp-catalogue-corner-bl"
                            aria-hidden="true"
                          />

                          <span
                            className="hp-catalogue-corner hp-catalogue-corner-br"
                            aria-hidden="true"
                          />

                          <span
                            className="hp-catalogue-sheen"
                            aria-hidden="true"
                          />

                          <div className="hp-catalogue-gift-inner">
                            <ProductCard
                              product={{
                                ...product,
                                averageRating,
                                totalReviews,
                                reviewSummary:
                                  reviewSummary ||
                                  null,
                              }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                {pagination && (
                  <div className="mt-12 border-t border-black/[0.08] pt-8">
                    <Pagination
                      pagination={
                        pagination
                      }
                      onPageChange={
                        changePage
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* MOBILE DRAWER */}

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[300] lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() =>
              setMobileFiltersOpen(
                false
              )
            }
            className="absolute inset-0 bg-black/45"
          />

          <div className="absolute inset-y-0 left-0 w-[94%] max-w-[410px] overflow-y-auto bg-[#F7F0E5] px-3 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))] shadow-[24px_0_70px_rgba(0,0,0,.22)] sm:px-4">
            <div className="mb-3 flex items-center justify-between border-b border-black/[0.08] pb-4">
              <h2
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="text-[32px] font-semibold tracking-[-0.02em]"
              >
                Filters
              </h2>

              <button
                type="button"
                onClick={() =>
                  setMobileFiltersOpen(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white"
              >
                <CloseIcon />
              </button>
            </div>

            <FilterPanel
              filters={
                filters
              }
              setFilters={
                setFilters
              }
              categories={
                categories
              }
              collections={
                collections
              }
              onApply={
                applyFilters
              }
              onClear={
                clearFilters
              }
            />
          </div>
        </div>
      )}
    </main>
  );
};

// =========================================================
// FILTER PANEL
// =========================================================

const FilterPanel = ({
  filters,
  setFilters,
  categories,
  collections,
  onApply,
  onClear,
}) => (
  <div className="hp-filter-shell">
    <div className="hp-filter-inner">
      <div className="hp-filter-head">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="hp-filter-kicker">
              Refine The Edit
            </p>

            <h2 className="hp-filter-title">
              Find Your Gift
            </h2>
          </div>

          <button
            type="button"
            onClick={onClear}
            className="hp-filter-clear"
          >
            Clear
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>

      <FilterSection title="Search">
        <input
          type="search"
          value={filters.search}
          onChange={(event) =>
            setFilters(
              (current) => ({
                ...current,
                search:
                  event.target.value,
              })
            )
          }
          placeholder="Search hampers..."
          className="hp-filter-search"
        />
      </FilterSection>

      <FilterSection title="Categories">
        <FilterChoice
          label="All Hampers"
          checked={!filters.category}
          onChange={() =>
            setFilters(
              (current) => ({
                ...current,
                category: "",
              })
            )
          }
        />

        {categories.map(
          (category) => (
            <FilterChoice
              key={category._id}
              label={category.name}
              checked={
                filters.category ===
                (
                  category.slug ||
                  category._id
                )
              }
              onChange={() =>
                setFilters(
                  (current) => ({
                    ...current,
                    category:
                      category.slug ||
                      category._id,
                  })
                )
              }
            />
          )
        )}
      </FilterSection>

      <FilterSection title="Price Range">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <p className="hp-filter-price-label">
              Min
            </p>

            <div className="hp-filter-price-box">
              <span className="hp-filter-price-currency">
                ₹
              </span>

              <input
                type="number"
                min="0"
                value={
                  filters.minPrice
                }
                onChange={(event) =>
                  setFilters(
                    (current) => ({
                      ...current,
                      minPrice:
                        event.target.value,
                    })
                  )
                }
                placeholder="0"
                className="hp-filter-price-input"
              />
            </div>
          </div>

          <div>
            <p className="hp-filter-price-label">
              Max
            </p>

            <div className="hp-filter-price-box">
              <span className="hp-filter-price-currency">
                ₹
              </span>

              <input
                type="number"
                min="0"
                value={
                  filters.maxPrice
                }
                onChange={(event) =>
                  setFilters(
                    (current) => ({
                      ...current,
                      maxPrice:
                        event.target.value,
                    })
                  )
                }
                placeholder="10,000"
                className="hp-filter-price-input"
              />
            </div>
          </div>
        </div>

        <div
          className="hp-filter-price-track"
          aria-hidden="true"
        />
      </FilterSection>

      {collections.length > 0 && (
        <FilterSection title="Collections">
          <FilterChoice
            label="All Collections"
            checked={!filters.collection}
            onChange={() =>
              setFilters(
                (current) => ({
                  ...current,
                  collection: "",
                })
              )
            }
          />

          {collections.map(
            (collection) => (
              <FilterChoice
                key={collection._id}
                label={collection.name}
                checked={
                  filters.collection ===
                  (
                    collection.slug ||
                    collection._id
                  )
                }
                onChange={() =>
                  setFilters(
                    (current) => ({
                      ...current,
                      collection:
                        collection.slug ||
                        collection._id,
                    })
                  )
                }
              />
            )
          )}
        </FilterSection>
      )}

      <FilterSection title="Featured">
        <label className="hp-filter-featured">
          <span className="hp-filter-featured-copy">
            <span className="hp-filter-featured-title">
              Featured Hampers
            </span>

            <span className="hp-filter-featured-note">
              Show our curated highlights first.
            </span>
          </span>

          <input
            type="checkbox"
            checked={filters.featured}
            onChange={(event) =>
              setFilters(
                (current) => ({
                  ...current,
                  featured:
                    event.target.checked,
                })
              )
            }
            className="hp-filter-toggle-input"
          />

          <span
            className="hp-filter-toggle"
            aria-hidden="true"
          />
        </label>
      </FilterSection>

      <div className="hp-filter-apply-wrap">
        <button
          type="button"
          onClick={onApply}
          className="hp-filter-apply"
        >
          Apply Filters

          <span className="hp-filter-apply-arrow">
            →
          </span>
        </button>
      </div>
    </div>
  </div>
);

// =========================================================
// FILTER SECTION
// =========================================================

const FilterSection = ({
  title,
  children,
}) => (
  <div className="hp-filter-section">
    <div className="hp-filter-section-head flex items-center justify-between">
      <h3 className="hp-filter-section-title">
        {title}
      </h3>

      <span className="hp-filter-chevron">
        <ChevronUpIcon />
      </span>
    </div>

    <div className="space-y-1">
      {children}
    </div>
  </div>
);

// =========================================================
// FILTER CHOICE
// =========================================================

const FilterChoice = ({
  label,
  checked,
  onChange,
}) => (
  <label className="hp-filter-choice">
    <input
      type="radio"
      checked={checked}
      onChange={onChange}
      className="hp-filter-choice-input"
    />

    <span
      className="hp-filter-radio"
      aria-hidden="true"
    />

    <span className="hp-filter-choice-label">
      {label}
    </span>
  </label>
);

// =========================================================
// SORT
// =========================================================

const SortSelect = ({
  value,
  onChange,
}) => (
  <div className="relative w-full sm:w-auto">
    <select
      value={value}
      onChange={(
        event
      ) =>
        onChange(
          event.target
            .value
        )
      }
      className="h-[44px] w-full min-w-0 appearance-none rounded-full border border-[#D4AF37]/25 bg-[#FFF9F0] pl-4 pr-10 text-[10px] font-bold text-black/65 outline-none shadow-[0_8px_22px_rgba(31,22,12,.05)] transition focus:border-[#F47822] sm:w-auto sm:min-w-[185px]"
    >
      <option value="">
        Sort By: Newest
      </option>

      <option value="featured">
        Featured
      </option>

      <option value="price-low">
        Price: Low to High
      </option>

      <option value="price-high">
        Price: High to Low
      </option>

      <option value="name">
        Name: A–Z
      </option>
    </select>

    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35">
      <ChevronDownIcon />
    </span>
  </div>
);

// =========================================================
// ACTIVE FILTERS
// =========================================================

const ActiveFilters = ({
  filters,
  categories,
  collections,
  onClear,
}) => {
  const category =
    categories.find(
      (item) =>
        (
          item.slug ||
          item._id
        ) ===
        filters.category
    );

  const collection =
    collections.find(
      (item) =>
        (
          item.slug ||
          item._id
        ) ===
        filters.collection
    );

  const knownCategory =
    CATEGORY_META[
      filters.category
    ]?.title;

  const items = [
    filters.search &&
      `Search: ${filters.search}`,

    category?.name ||
      (
        filters.category
          ? knownCategory
          : ""
      ),

    collection?.name,

    filters.minPrice &&
      `From ₹${filters.minPrice}`,

    filters.maxPrice &&
      `Up to ₹${filters.maxPrice}`,

    filters.featured &&
      "Featured",
  ].filter(Boolean);

  if (!items.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] py-4">
      {items.map(
        (item) => (
          <span
            key={item}
            className="border border-black/[0.05] bg-white px-3 py-1.5 text-[9px] font-bold text-black/45"
          >
            {item}
          </span>
        )
      )}

      <button
        type="button"
        onClick={onClear}
        className="ml-1 text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#F47822]"
      >
        Clear All
      </button>
    </div>
  );
};

// =========================================================
// SKELETON
// =========================================================

const ProductSkeleton = () => (
  <div className="relative overflow-hidden rounded-[26px] border border-[#D7BE8A]/35 bg-gradient-to-br from-[#FFF9EF] to-[#E9DCC7] p-3 shadow-[0_18px_42px_rgba(38,28,16,.08)]">
    <span className="absolute left-6 top-0 bottom-0 w-2 bg-[#D4AF37]/25" />
    <span className="absolute left-0 right-0 top-6 h-2 bg-[#D4AF37]/25" />

    <div className="relative z-10 overflow-hidden rounded-[18px] border border-white/70 bg-white/75 p-2">
      <div className="aspect-[16/10] animate-pulse rounded-[14px] bg-black/[0.07]" />

      <div className="space-y-2.5 px-2 pb-3 pt-4">
        <div className="h-3 w-3/4 animate-pulse rounded bg-black/[0.08]" />

        <div className="h-3 w-1/3 animate-pulse rounded bg-black/[0.05]" />

        <div className="h-9 w-full animate-pulse rounded bg-black/[0.05]" />
      </div>
    </div>
  </div>
);

// =========================================================
// ICONS
// =========================================================

const FilterIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

const GridIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    className="h-[18px] w-[18px]"
  >
    <rect
      x="4"
      y="4"
      width="6"
      height="6"
    />

    <rect
      x="14"
      y="4"
      width="6"
      height="6"
    />

    <rect
      x="4"
      y="14"
      width="6"
      height="6"
    />

    <rect
      x="14"
      y="14"
      width="6"
      height="6"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className="h-4 w-4"
  >
    <path d="m5 7 5 5 5-5" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    className="h-3.5 w-3.5 text-black/30"
  >
    <path d="m5 12 5-5 5 5" />
  </svg>
);

const CloseIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className="h-4 w-4"
  >
    <path d="m5 5 10 10M15 5 5 15" />
  </svg>
);

export default Gifts;