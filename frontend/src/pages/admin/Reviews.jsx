import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../../api/api.js";
import RatingStars from "../../components/reviews/RatingStars.jsx";
import formatDate from "../../utils/formatDate.js";

const Reviews = () => {
  const [reviews, setReviews] =
    useState([]);

  const [
    pagination,
    setPagination,
  ] = useState(null);

  const [status, setStatus] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [loading, setLoading] =
    useState(true);

  const [
    workingId,
    setWorkingId,
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
          "/reviews/admin/all",
          {
            params: {
              page,
              limit: 30,
              ...(status
                ? {
                    status,
                  }
                : {}),
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
          "Unable to load reviews"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, status]);

  const stats =
    useMemo(
      () => ({
        published:
          reviews.filter(
            (review) =>
              review.status ===
              "published"
          ).length,

        hidden:
          reviews.filter(
            (review) =>
              review.status ===
              "hidden"
          ).length,

        verified:
          reviews.filter(
            (review) =>
              review.verifiedPurchase
          ).length,
      }),
      [reviews]
    );

  const moderate =
    async (
      review,
      nextStatus
    ) => {
      const note =
        window.prompt(
          `Optional moderation note for ${nextStatus}:`,
          review.moderation
            ?.note ||
            ""
        ) ?? null;

      if (note === null) {
        return;
      }

      setWorkingId(
        review._id
      );

      setError("");
      setNotice("");

      try {
        const response =
          await api.patch(
            `/reviews/admin/${review._id}/moderate`,
            {
              status:
                nextStatus,
              note,
            }
          );

        setNotice(
          response.data
            ?.message ||
            "Review updated."
        );

        await load();
      } catch (
        requestError
      ) {
        setError(
          requestError.response
            ?.data?.message ||
            "Unable to moderate review"
        );
      } finally {
        setWorkingId("");
      }
    };

  return (
    <main className="mx-auto w-full max-w-[1500px] pb-14 text-[#171717]">
      <header className="border-b border-black/[0.08] pb-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#A47718]">
              Trust & Quality
            </p>

            <h1 className="mt-2 font-serif text-[50px] font-semibold leading-none tracking-[-0.035em]">
              Customer Reviews
            </h1>

            <p className="mt-4 max-w-2xl text-[14px] leading-6 text-black/45">
              Review verified-purchase feedback for catalogue products and custom hampers.
            </p>
          </div>

          <select
            value={status}
            onChange={(
              event
            ) => {
              setStatus(
                event.target
                  .value
              );

              setPage(1);
            }}
            className="h-11 border-0 border-b border-black/[0.14] bg-transparent px-1 text-[13px] font-semibold outline-none"
          >
            <option value="">
              All statuses
            </option>

            <option value="published">
              Published
            </option>

            <option value="hidden">
              Hidden
            </option>
          </select>
        </div>
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

      <section className="grid grid-cols-3 border-b border-black/[0.08]">
        <Stat
          label="Published"
          value={
            stats.published
          }
        />

        <Stat
          label="Hidden"
          value={
            stats.hidden
          }
        />

        <Stat
          label="Verified"
          value={
            stats.verified
          }
        />
      </section>

      <section>
        {loading ? (
          <div className="border-b border-black/[0.08] py-12 text-center text-[14px] text-black/40">
            Loading reviews...
          </div>
        ) : !reviews.length ? (
          <div className="border-b border-black/[0.08] py-12 text-center text-[14px] text-black/40">
            No reviews found.
          </div>
        ) : (
          reviews.map(
            (review) => {
              const reviewName =
                review.product
                  ?.name ||
                review.targetName ||
                (
                  review.targetType ===
                  "custom_hamper"
                    ? "Custom Hamper"
                    : "Purchased item"
                );

              return (
                <article
                  key={
                    review._id
                  }
                  className="border-b border-black/[0.08] py-7"
                >
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_200px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-4">
                        <RatingStars
                          value={
                            review.rating
                          }
                          readOnly
                          size="sm"
                        />

                        <span
                          className={`flex items-center gap-2 text-[12px] font-bold ${
                            review.status ===
                            "published"
                              ? "text-emerald-700"
                              : "text-black/45"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              review.status ===
                              "published"
                                ? "bg-emerald-500"
                                : "bg-black/25"
                            }`}
                          />

                          {review.status}
                        </span>

                        {review.verifiedPurchase && (
                          <span className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#A47718]">
                            Verified Purchase
                          </span>
                        )}

                        {review.targetType ===
                          "custom_hamper" && (
                          <span className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#F47822]">
                            Custom Hamper
                          </span>
                        )}
                      </div>

                      <h2 className="mt-4 text-[16px] font-extrabold">
                        {review.title ||
                          reviewName ||
                          "Customer review"}
                      </h2>

                      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-black/55">
                        {
                          review.comment
                        }
                      </p>

                      <p className="mt-4 text-[12px] text-black/38">
                        {review.user
                          ?.name ||
                          review.user
                            ?.email ||
                          "Customer"}{" "}
                        ·{" "}
                        {
                          reviewName
                        }{" "}
                        ·{" "}
                        {formatDate(
                          review.createdAt,
                          true
                        )}
                      </p>

                      {review.order
                        ?._id && (
                        <Link
                          to={`/admin/orders/${review.order._id}`}
                          className="mt-3 inline-flex text-[11px] font-extrabold text-[#F97316]"
                        >
                          Order{" "}
                          {
                            review.order
                              .orderNumber
                          }{" "}
                          →
                        </Link>
                      )}
                    </div>

                    <div className="flex flex-col justify-center gap-4 border-l border-black/[0.08] pl-6">
                      <button
                        type="button"
                        disabled={
                          workingId ===
                            review._id ||
                          review.status ===
                            "published"
                        }
                        onClick={() =>
                          moderate(
                            review,
                            "published"
                          )
                        }
                        className="text-left text-[11px] font-extrabold uppercase tracking-[0.06em] text-emerald-700 disabled:opacity-30"
                      >
                        Publish
                      </button>

                      <button
                        type="button"
                        disabled={
                          workingId ===
                            review._id ||
                          review.status ===
                            "hidden"
                        }
                        onClick={() =>
                          moderate(
                            review,
                            "hidden"
                          )
                        }
                        className="text-left text-[11px] font-extrabold uppercase tracking-[0.06em] text-red-600 disabled:opacity-30"
                      >
                        Hide Review
                      </button>

                      {review.moderation
                        ?.note && (
                        <p className="text-[11px] leading-5 text-black/35">
                          Note:{" "}
                          {
                            review.moderation
                              .note
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            }
          )
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

const Stat = ({
  label,
  value,
}) => (
  <div className="border-r border-black/[0.08] py-5 last:border-r-0 sm:px-5 sm:first:pl-0">
    <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-black/35">
      {label}
    </p>

    <p className="mt-1 font-serif text-[30px] font-semibold">
      {value}
    </p>
  </div>
);

const pageButtonClass =
  "border-b border-black/15 pb-1 text-[12px] font-extrabold disabled:opacity-30";

export default Reviews;
