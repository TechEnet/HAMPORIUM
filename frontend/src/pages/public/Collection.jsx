import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "react-router-dom";

import api from "../../api/api.js";
import ProductCard from "../../components/ProductCard.jsx";

const Collection = () => {
  const { slug } =
    useParams();

  const [
    collection,
    setCollection,
  ] = useState(null);

  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    reviewMap,
    setReviewMap,
  ] = useState({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    let active = true;

    const loadCollection =
      async () => {
        setLoading(true);

        try {
          const [
            collectionResponse,
            productResponse,
          ] =
            await Promise.all([
              api.get(
                "/catalog/collections"
              ),

              api.get(
                `/catalog/products?collection=${encodeURIComponent(
                  slug
                )}`
              ),
            ]);

          if (!active) return;

          const found =
            (
              collectionResponse
                .data
                .collections ||
              []
            ).find(
              (item) =>
                item.slug ===
                slug
            );

          const loadedProducts =
            productResponse
              .data
              .products ||
            [];

          setCollection(
            found || null
          );

          setProducts(
            loadedProducts
          );

          /*
           * Load public review summary
           * for each product.
           *
           * Existing reviews API:
           *
           * GET /reviews/product/:productId
           *
           * response.summary:
           * {
           *   averageRating,
           *   totalReviews
           * }
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

          if (!active) return;

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
                result.value.data
                  ?.summary;

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
            "Collection load error:",
            error
          );
        } finally {
          if (active) {
            setLoading(
              false
            );
          }
        }
      };

    void loadCollection();

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="px-6 py-16 text-center">
        Loading collection...
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="px-6 py-16 text-center">
        <h1 className="text-3xl font-bold">
          Collection not found
        </h1>
      </div>
    );
  }

  return (
    <>
      <section className="bg-[#fff7f2] px-6 py-14">
        <div className="mx-auto max-w-7xl">
          <p className="font-semibold text-[#F26522]">
            Collection
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            {collection.name}
          </h1>

          {collection.description && (
            <p className="mt-4 max-w-2xl text-gray-600">
              {
                collection.description
              }
            </p>
          )}
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-7xl">
          {products.length ===
          0 ? (
            <p className="text-gray-500">
              Products will be
              added to this
              collection soon.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {products.map(
                (product) => {
                  const summary =
                    reviewMap[
                      product._id
                    ];

                  const hasReviews =
                    Number(
                      summary?.totalReviews ||
                        0
                    ) > 0;

                  return (
                    <div
                      key={
                        product._id
                      }
                      className="group relative min-w-0"
                    >
                      <ProductCard
                        product={{
                          ...product,

                          reviewSummary:
                            summary ||
                            null,

                          averageRating:
                            summary?.averageRating ||
                            0,

                          totalReviews:
                            summary?.totalReviews ||
                            0,
                        }}
                      />

                      {hasReviews && (
                        <div
                          className="
                            pointer-events-none
                            absolute
                            right-3
                            top-3
                            z-20
                            flex
                            items-center
                            gap-1.5
                            rounded-full
                            border
                            border-black/[0.06]
                            bg-white/95
                            px-2.5
                            py-1.5
                            shadow-[0_5px_18px_rgba(23,23,23,.10)]
                            backdrop-blur-md
                          "
                        >
                          <span className="text-[13px] leading-none text-[#D4AF37]">
                            ★
                          </span>

                          <span className="text-[10px] font-extrabold text-[#171717]">
                            {Number(
                              summary.averageRating
                            ).toFixed(
                              1
                            )}
                          </span>

                          <span className="text-[9px] font-semibold text-black/35">
                            (
                            {
                              summary.totalReviews
                            }
                            )
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default Collection;