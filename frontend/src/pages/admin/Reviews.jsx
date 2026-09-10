import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import RatingStars from "../../components/reviews/RatingStars.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import formatDate from "../../utils/formatDate.js";

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/reviews/admin/all", {
        params: { page, limit: 30, ...(status ? { status } : {}) },
      });
      setReviews(response.data?.reviews || []);
      setPagination(response.data?.pagination || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, status]);

  const stats = useMemo(() => ({
    published: reviews.filter((review) => review.status === "published").length,
    hidden: reviews.filter((review) => review.status === "hidden").length,
    verified: reviews.filter((review) => review.verifiedPurchase).length,
  }), [reviews]);

  const moderate = async (review, nextStatus) => {
    const note = window.prompt(`Optional moderation note for ${nextStatus}:`, review.moderation?.note || "") ?? null;
    if (note === null) return;

    setWorkingId(review._id);
    setError("");
    setNotice("");
    try {
      const response = await api.patch(`/reviews/admin/${review._id}/moderate`, {
        status: nextStatus,
        note,
      });
      setNotice(response.data?.message || "Review updated.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to moderate review");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-12 text-[#171717]">
      <header className="flex flex-col gap-4 rounded-[24px] bg-[#171717] p-6 text-white sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#D4AF37]">Trust & Quality</p>
          <h1 className="mt-2 font-serif text-[44px] font-semibold leading-none">Customer Reviews</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">Review verified-purchase feedback and hide inappropriate content without deleting customer history.</p>
        </div>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-white/15 bg-[#171717] px-4 text-sm text-white outline-none">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
        </select>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Published" value={stats.published} />
        <Stat label="Hidden" value={stats.hidden} />
        <Stat label="Verified Purchase" value={stats.verified} />
      </div>

      <section className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white">
        {loading ? (
          <div className="p-10 text-center text-sm text-black/40">Loading reviews...</div>
        ) : !reviews.length ? (
          <div className="p-10 text-center text-sm text-black/40">No reviews found.</div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {reviews.map((review) => (
              <article key={review._id} className="p-5 sm:p-6">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_250px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <RatingStars value={review.rating} readOnly size="sm" />
                      <StatusBadge status={review.status} />
                      {review.verifiedPurchase && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-extrabold uppercase text-emerald-700">Verified Purchase</span>}
                    </div>
                    <h2 className="mt-3 text-sm font-black">{review.title || review.product?.name || "Customer review"}</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/55">{review.comment}</p>
                    <p className="mt-3 text-[10px] text-black/35">
                      {review.user?.name || review.user?.email || "Customer"} · {review.product?.name || "Product"} · {formatDate(review.createdAt, true)}
                    </p>
                    {review.order?._id && <Link to={`/admin/orders/${review.order._id}`} className="mt-2 inline-block text-[10px] font-extrabold text-[#F97316]">Order {review.order.orderNumber} →</Link>}
                  </div>

                  <div className="flex flex-col justify-center gap-2 rounded-xl bg-[#FFF9F2] p-4">
                    <button type="button" disabled={workingId === review._id || review.status === "published"} onClick={() => moderate(review, "published")} className="rounded-xl bg-[#171717] px-4 py-3 text-[10px] font-extrabold text-white disabled:opacity-30">Publish</button>
                    <button type="button" disabled={workingId === review._id || review.status === "hidden"} onClick={() => moderate(review, "hidden")} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-extrabold text-red-700 disabled:opacity-30">Hide Review</button>
                    {review.moderation?.note && <p className="mt-2 text-[9px] leading-4 text-black/35">Note: {review.moderation.note}</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className={pageButtonClass}>Previous</button>
          <span className="text-[10px] font-semibold text-black/35">Page {pagination.page} of {pagination.pages}</span>
          <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)} className={pageButtonClass}>Next</button>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }) => <div className="rounded-2xl border border-black/[0.06] bg-white p-5"><p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
const pageButtonClass = "rounded-xl border border-black/10 px-4 py-2.5 text-[10px] font-extrabold disabled:opacity-30";

export default Reviews;
