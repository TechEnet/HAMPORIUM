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
      <section className="mx-auto w-full max-w-[1640px] px-4 pb-16 pt-[105px] sm:px-6 lg:px-8 lg:pb-20 lg:pt-[112px] xl:px-10">
        {/* MOBILE FILTER */}

        <div className="mb-5 flex items-center justify-between lg:hidden">
          <button
            type="button"
            onClick={() =>
              setMobileFiltersOpen(
                true
              )
            }
            className="flex h-[42px] items-center gap-2 border border-black/10 bg-white px-4 text-[10px] font-extrabold uppercase tracking-[0.08em]"
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

        <div className="grid min-w-0 lg:grid-cols-[245px_minmax(0,1fr)] xl:grid-cols-[265px_minmax(0,1fr)]">
          {/* SIDEBAR */}

          <aside className="hidden min-w-0 border-r border-black/[0.08] pr-6 lg:block xl:pr-7">
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

          <div className="min-w-0 lg:pl-7 xl:pl-9">
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
              <div className="mt-6 grid items-start gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
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
                <div className="mt-6 grid items-start gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map(
                    (product) => {
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

                      return (
                        <ProductCard
                          key={
                            product._id
                          }
                          product={{
                            ...product,
                            averageRating,
                            totalReviews,
                            reviewSummary:
                              reviewSummary ||
                              null,
                          }}
                        />
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

          <div className="absolute inset-y-0 left-0 w-[88%] max-w-[360px] overflow-y-auto bg-[#FBF8F4] px-5 pb-8 pt-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-black/[0.08] pb-4">
              <h2
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="text-[27px] font-semibold"
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
  <div>
    <div className="flex items-center justify-between py-3">
      <h2 className="text-[12px] font-extrabold text-[#171717]">
        Filters
      </h2>

      <button
        type="button"
        onClick={onClear}
        className="text-[9px] font-bold text-black/35 transition hover:text-[#F47822]"
      >
        Clear All
      </button>
    </div>

    <FilterSection title="Search">
      <input
        type="search"
        value={
          filters.search
        }
        onChange={(
          event
        ) =>
          setFilters(
            (current) => ({
              ...current,
              search:
                event.target
                  .value,
            })
          )
        }
        placeholder="Search hampers..."
        className="h-[42px] w-full border border-black/10 bg-white px-3 text-[10px] font-semibold outline-none placeholder:text-black/30 focus:border-[#F47822]"
      />
    </FilterSection>

    <FilterSection title="Categories">
      <FilterChoice
        label="All Hampers"
        checked={
          !filters.category
        }
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
            key={
              category._id
            }
            label={
              category.name
            }
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
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-black/30">
            Min
          </p>

          <div className="flex h-[40px] items-center border border-black/10 bg-white px-3">
            <span className="mr-1 text-[10px] text-black/35">
              ₹
            </span>

            <input
              type="number"
              min="0"
              value={
                filters.minPrice
              }
              onChange={(
                event
              ) =>
                setFilters(
                  (current) => ({
                    ...current,
                    minPrice:
                      event.target
                        .value,
                  })
                )
              }
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold outline-none"
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-black/30">
            Max
          </p>

          <div className="flex h-[40px] items-center border border-black/10 bg-white px-3">
            <span className="mr-1 text-[10px] text-black/35">
              ₹
            </span>

            <input
              type="number"
              min="0"
              value={
                filters.maxPrice
              }
              onChange={(
                event
              ) =>
                setFilters(
                  (current) => ({
                    ...current,
                    maxPrice:
                      event.target
                        .value,
                  })
                )
              }
              placeholder="10,000"
              className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[#F47822]" />

        <span className="h-[2px] flex-1 bg-[#F47822]" />

        <span className="h-2 w-2 rounded-full bg-[#F47822]" />
      </div>
    </FilterSection>

    {collections.length >
      0 && (
      <FilterSection title="Collections">
        <FilterChoice
          label="All Collections"
          checked={
            !filters.collection
          }
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
              key={
                collection._id
              }
              label={
                collection.name
              }
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
      <label className="flex cursor-pointer items-center gap-3 py-1.5">
        <input
          type="checkbox"
          checked={
            filters.featured
          }
          onChange={(
            event
          ) =>
            setFilters(
              (current) => ({
                ...current,
                featured:
                  event.target
                    .checked,
              })
            )
          }
          className="h-4 w-4 accent-[#F47822]"
        />

        <span className="text-[10px] font-semibold text-black/55">
          Featured Hampers
        </span>
      </label>
    </FilterSection>

    <div className="border-t border-black/[0.08] pt-5">
      <button
        type="button"
        onClick={
          onApply
        }
        className="flex h-[44px] w-full items-center justify-center bg-[#171717] text-[9px] font-extrabold uppercase tracking-[0.1em] text-white transition hover:bg-[#F47822]"
      >
        Apply Filters
      </button>
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
  <div className="border-t border-black/[0.08] py-5">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[10px] font-extrabold text-[#171717]">
        {title}
      </h3>

      <ChevronUpIcon />
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
  <label className="group flex cursor-pointer items-center gap-3 py-1.5">
    <input
      type="radio"
      checked={checked}
      onChange={onChange}
      className="h-3.5 w-3.5 accent-[#F47822]"
    />

    <span
      className={`text-[10px] font-semibold transition ${
        checked
          ? "text-[#F47822]"
          : "text-black/50 group-hover:text-[#171717]"
      }`}
    >
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
  <div className="relative">
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
      className="h-[42px] min-w-[175px] appearance-none border border-black/[0.08] bg-white pl-4 pr-10 text-[9px] font-bold text-black/55 outline-none transition focus:border-[#F47822]"
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
  <div className="overflow-hidden bg-white">
    <div className="aspect-[16/10] animate-pulse bg-black/[0.07]" />

    <div className="space-y-2.5 px-3 pb-4 pt-3">
      <div className="h-3 w-3/4 animate-pulse rounded bg-black/[0.08]" />

      <div className="h-3 w-1/3 animate-pulse rounded bg-black/[0.05]" />

      <div className="h-9 w-full animate-pulse rounded bg-black/[0.05]" />
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