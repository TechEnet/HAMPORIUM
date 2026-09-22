import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../../api/api.js";
import ReviewCard from "../../components/reviews/ReviewCard.jsx";
import ReviewForm from "../../components/reviews/ReviewForm.jsx";

const MyReviews = () => {
  const [reviews, setReviews] =
    useState([]);

  const [
    pagination,
    setPagination,
  ] = useState(null);

  const [page, setPage] =
    useState(1);

  const [loading, setLoading] =
    useState(true);

  const [
    editingId,
    setEditingId,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const response =
        await api.get(
          "/reviews/mine",
          {
            params: {
              page,
              limit: 20,
            },
          }
        );

      setReviews(
        response.data
          ?.reviews || []
      );

      setPagination(
        response.data
          ?.pagination ||
          null
      );
    } catch (
      requestError
    ) {
      setError(
        requestError.response
          ?.data?.message ||
          "Unable to load your reviews"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  const deleteReview =
    async (review) => {
      if (
        !window.confirm(
          "Delete this review?"
        )
      ) {
        return;
      }

      setError("");
      setNotice("");

      try {
        const response =
          await api.delete(
            `/reviews/${review._id}`
          );

        setNotice(
          response.data
            ?.message ||
            "Review deleted."
        );

        await load();
      } catch (
        requestError
      ) {
        setError(
          requestError.response
            ?.data?.message ||
            "Unable to delete review"
        );
      }
    };

  return (
    <main className="mx-auto w-full max-w-[1300px] pb-14 text-[#171717]">
      <header className="border-b border-black/[0.08] pb-7">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#A47718]">
          Your Feedback
        </p>

        <h1 className="mt-2 font-serif text-[48px] font-semibold leading-none tracking-[-0.035em]">
          My Reviews
        </h1>

        <p className="mt-4 max-w-2xl text-[14px] leading-6 text-black/45">
          Edit or remove feedback from your delivered purchases.
        </p>
      </header>

      {error && (
        <p className="mt-5 border-l-2 border-red-500 pl-4 text-[13px] font-semibold text-red-600">
          {error}
        </p>
      )}

      {notice && (
        <p className="mt-5 border-l-2 border-emerald-500 pl-4 text-[13px] font-semibold text-emerald-700">
          {notice}
        </p>
      )}

      <section className="mt-7">
        {loading ? (
          <div className="border-y border-black/[0.08] py-12 text-center text-[14px] text-black/40">
            Loading reviews...
          </div>
        ) : !reviews.length ? (
          <div className="border-y border-black/[0.08] py-14 text-center">
            <p className="text-[17px] font-extrabold">
              You have not posted a review yet.
            </p>

            <p className="mt-2 text-[14px] text-black/40">
              After an order is delivered, open its details to rate the purchased product or custom hamper.
            </p>

            <Link
              to="/account/orders"
              className="mt-6 inline-flex border-b border-[#F97316]/40 pb-1 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#F97316]"
            >
              View Delivered Orders →
            </Link>
          </div>
        ) : (
          <div>
            {reviews.map(
              (review) => (
                <div
                  key={
                    review._id
                  }
                  className="border-b border-black/[0.08] py-6"
                >
                  <ReviewCard
                    review={{
                      ...review,
                      product:
                        review.product ||
                        {
                          name:
                            review.targetName ||
                            "Custom Hamper",
                        },
                    }}
                    actions={
                      <div className="flex flex-wrap gap-4">
                        {review.product
                          ?.slug && (
                          <Link
                            to={`/products/${review.product.slug}`}
                            className="text-[11px] font-extrabold text-black/45 hover:text-[#F97316]"
                          >
                            Product
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setEditingId(
                              (
                                current
                              ) =>
                                current ===
                                review._id
                                  ? ""
                                  : review._id
                            )
                          }
                          className="text-[11px] font-extrabold text-[#F97316]"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteReview(
                              review
                            )
                          }
                          className="text-[11px] font-extrabold text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    }
                  />

                  {editingId ===
                    review._id && (
                    <div className="mt-4">
                      <ReviewForm
                        targetType={
                          review.targetType ||
                          "product"
                        }
                        productId={
                          review.product
                            ?._id ||
                          review.product ||
                          ""
                        }
                        orderId={
                          review.order
                            ?._id ||
                          review.order ||
                          ""
                        }
                        orderItemId={
                          review.orderItemId ||
                          ""
                        }
                        targetName={
                          review.targetName ||
                          review.product
                            ?.name ||
                          "Purchased item"
                        }
                        initialReview={
                          review
                        }
                        compact
                        onCancel={() =>
                          setEditingId(
                            ""
                          )
                        }
                        onSaved={async (
                          _saved,
                          message
                        ) => {
                          setNotice(
                            message ||
                              "Review updated."
                          );

                          setEditingId(
                            ""
                          );

                          await load();
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </section>

      {pagination?.pages >
        1 && (
        <div className="mt-7 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={
              page <= 1
            }
            onClick={() =>
              setPage(
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
            className={pageButtonClass}
          >
            Previous
          </button>

          <span className="text-[12px] font-semibold text-black/35">
            Page{" "}
            {
              pagination.page
            }{" "}
            of{" "}
            {
              pagination.pages
            }
          </span>

          <button
            type="button"
            disabled={
              page >=
              pagination.pages
            }
            onClick={() =>
              setPage(
                (
                  current
                ) =>
                  current +
                  1
              )
            }
            className={pageButtonClass}
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
};

const pageButtonClass =
  "border-b border-black/15 pb-1 text-[12px] font-extrabold disabled:opacity-30";

export default MyReviews;
