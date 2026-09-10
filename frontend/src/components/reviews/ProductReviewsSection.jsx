import { useCallback, useEffect, useState } from "react";

import api from "../../api/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import ReviewCard from "./ReviewCard.jsx";
import ReviewForm from "./ReviewForm.jsx";
import ReviewSummary from "./ReviewSummary.jsx";

const ProductReviewsSection = ({ productId }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadReviews = useCallback(async () => {
    if (!productId) return;

    setLoading(true);
    setError("");

    try {
      const response = await api.get(`/reviews/product/${productId}`, {
        params: { page, limit: 8 },
      });

      setReviews(response.data?.reviews || []);
      setSummary(response.data?.summary || null);
      setPagination(response.data?.pagination || null);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to load product reviews"
      );
    } finally {
      setLoading(false);
    }
  }, [productId, page]);

  const loadEligibility = useCallback(async () => {
    if (!user || !productId) {
      setEligibility(null);
      return;
    }

    try {
      const response = await api.get(`/reviews/eligibility/${productId}`);
      setEligibility(response.data?.eligibility || null);
    } catch {
      setEligibility(null);
    }
  }, [user?._id, user?.id, productId]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    void loadEligibility();
  }, [loadEligibility]);

  const handleSaved = async (_review, notice) => {
    setMessage(notice || "Review saved");
    await Promise.all([loadReviews(), loadEligibility()]);
  };

  return (
    <section id="reviews" className="mt-12 scroll-mt-[110px] border-t border-black/[0.08] pt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
            Customer Reviews
          </p>
          <h2 className="mt-2 font-serif text-[36px] font-semibold leading-none tracking-[-0.03em] text-[#171717]">
            Loved by real customers
          </h2>
          <p className="mt-3 max-w-2xl text-[12px] leading-6 text-black/45">
            Reviews can be submitted only after a verified HAMPORIUM order is delivered.
          </p>
        </div>
      </div>

      {message && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-semibold text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6">
        <ReviewSummary summary={summary} />
      </div>

      {eligibility?.eligible && (
        <div className="mt-6">
          <ReviewForm
            productId={productId}
            orderId={eligibility.orderId}
            initialReview={eligibility.existingReview || null}
            onSaved={handleSaved}
          />
        </div>
      )}

      {user && eligibility && !eligibility.eligible && (
        <div className="mt-6 rounded-[18px] border border-black/[0.06] bg-white px-5 py-4 text-[11px] font-medium leading-5 text-black/45">
          <span className="font-extrabold text-[#171717]">Want to review this product?</span>{" "}
          Rating opens automatically after your purchased order is marked delivered.
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="rounded-[18px] border border-black/[0.06] bg-white p-10 text-center text-sm text-black/35">
            Loading reviews...
          </div>
        ) : !reviews.length ? (
          <div className="rounded-[18px] border border-dashed border-black/10 bg-white p-10 text-center">
            <p className="text-[13px] font-black text-[#171717]">No reviews yet.</p>
            <p className="mt-2 text-[11px] text-black/40">
              Delivered customers will be able to share their experience here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {reviews.map((review) => (
              <ReviewCard key={review._id} review={review} />
            ))}
          </div>
        )}
      </div>

      {pagination?.pages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-xl border border-black/10 px-4 py-2.5 text-[10px] font-extrabold disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-[10px] font-semibold text-black/35">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.pages}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-xl border border-black/10 px-4 py-2.5 text-[10px] font-extrabold disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
};

export default ProductReviewsSection;
