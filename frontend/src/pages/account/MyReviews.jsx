import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import ReviewCard from "../../components/reviews/ReviewCard.jsx";
import ReviewForm from "../../components/reviews/ReviewForm.jsx";

const MyReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/reviews/mine", {
        params: { page, limit: 20 },
      });
      setReviews(response.data?.reviews || []);
      setPagination(response.data?.pagination || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load your reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  const deleteReview = async (review) => {
    if (!window.confirm("Delete this review?")) return;
    setError("");
    setNotice("");

    try {
      const response = await api.delete(`/reviews/${review._id}`);
      setNotice(response.data?.message || "Review deleted.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to delete review");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1300px] pb-12 text-[#171717]">
      <header className="border-b border-black/[0.07] pb-7">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">Your Feedback</p>
        <h1 className="mt-2 font-serif text-[44px] font-semibold leading-none tracking-[-0.03em]">My Reviews</h1>
        <p className="mt-3 max-w-2xl text-[12px] leading-6 text-black/45">Edit or remove reviews you have posted after delivered purchases.</p>
      </header>

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <section className="mt-6">
        {loading ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-black/40">Loading reviews...</div>
        ) : !reviews.length ? (
          <div className="rounded-[22px] border border-dashed border-black/10 bg-white p-10 text-center">
            <p className="font-black">You have not posted a review yet.</p>
            <p className="mt-2 text-sm text-black/40">After an order is delivered, open the product or order details to rate it.</p>
            <Link to="/account/orders" className="mt-5 inline-flex rounded-xl bg-[#F97316] px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-white">View Delivered Orders</Link>
          </div>
        ) : (
          <div className="space-y-5">
            {reviews.map((review) => (
              <div key={review._id}>
                <ReviewCard
                  review={review}
                  actions={
                    <div className="flex gap-2">
                      {review.product?.slug && (
                        <Link to={`/products/${review.product.slug}`} className="rounded-lg border border-black/10 px-3 py-2 text-[9px] font-extrabold hover:border-[#F97316] hover:text-[#F97316]">Product</Link>
                      )}
                      <button type="button" onClick={() => setEditingId((current) => current === review._id ? "" : review._id)} className="rounded-lg border border-black/10 px-3 py-2 text-[9px] font-extrabold hover:border-[#F97316] hover:text-[#F97316]">Edit</button>
                      <button type="button" onClick={() => deleteReview(review)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-extrabold text-red-700">Delete</button>
                    </div>
                  }
                />

                {editingId === review._id && (
                  <div className="mt-3">
                    <ReviewForm
                      productId={review.product?._id || review.product}
                      orderId={review.order?._id || review.order}
                      initialReview={review}
                      compact
                      onCancel={() => setEditingId("")}
                      onSaved={async (_saved, message) => {
                        setNotice(message || "Review updated.");
                        setEditingId("");
                        await load();
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {pagination?.pages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className={pageButtonClass}>Previous</button>
          <span className="text-[10px] font-semibold text-black/35">Page {pagination.page} of {pagination.pages}</span>
          <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)} className={pageButtonClass}>Next</button>
        </div>
      )}
    </div>
  );
};

const pageButtonClass = "rounded-xl border border-black/10 px-4 py-2.5 text-[10px] font-extrabold disabled:opacity-30";

export default MyReviews;
