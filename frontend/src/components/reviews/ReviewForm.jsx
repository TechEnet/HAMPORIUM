import { useEffect, useState } from "react";

import api from "../../api/api.js";
import RatingStars from "./RatingStars.jsx";

const ReviewForm = ({
  productId,
  orderId = null,
  initialReview = null,
  onSaved,
  onCancel,
  compact = false,
}) => {
  const [rating, setRating] = useState(Number(initialReview?.rating || 0));
  const [title, setTitle] = useState(initialReview?.title || "");
  const [comment, setComment] = useState(initialReview?.comment || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRating(Number(initialReview?.rating || 0));
    setTitle(initialReview?.title || "");
    setComment(initialReview?.comment || "");
    setError("");
  }, [initialReview?._id, productId]);

  const submit = async (event) => {
    event.preventDefault();

    if (!rating) {
      setError("Please select a rating from 1 to 5 stars.");
      return;
    }

    if (comment.trim().length < 3) {
      setError("Review must be at least 3 characters.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let response;

      if (initialReview?._id) {
        response = await api.patch(`/reviews/${initialReview._id}`, {
          rating,
          title: title.trim(),
          comment: comment.trim(),
        });
      } else {
        response = await api.post("/reviews", {
          productId,
          orderId,
          rating,
          title: title.trim(),
          comment: comment.trim(),
        });
      }

      onSaved?.(response.data?.review || null, response.data?.message || "Review saved");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to save review"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className={`rounded-[20px] border border-[#F97316]/15 bg-[#FFF9F2] ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#F97316]">
            {initialReview?._id ? "Edit Review" : "Rate Your Purchase"}
          </p>
          <h3 className="mt-1 text-[15px] font-black text-[#171717]">
            How was your experience?
          </h3>
        </div>

        {initialReview?.verifiedPurchase && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-extrabold uppercase text-emerald-700">
            Verified Purchase
          </span>
        )}
      </div>

      <div className="mt-4">
        <RatingStars value={rating} onChange={setRating} size="lg" />
      </div>

      <div className="mt-4 grid gap-4">
        <label>
          <span className="mb-2 block text-[9px] font-extrabold uppercase tracking-wider text-black/40">
            Review title (optional)
          </span>
          <input
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Beautiful hamper, great quality..."
            className="h-11 w-full rounded-xl border border-black/10 bg-white px-4 text-[12px] outline-none transition focus:border-[#F97316]"
          />
        </label>

        <label>
          <span className="mb-2 block text-[9px] font-extrabold uppercase tracking-wider text-black/40">
            Your review
          </span>
          <textarea
            rows={compact ? 4 : 5}
            maxLength={2000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Tell other customers what you liked..."
            className="w-full resize-none rounded-xl border border-black/10 bg-white px-4 py-3 text-[12px] leading-6 outline-none transition focus:border-[#F97316]"
          />
          <span className="mt-1 block text-right text-[8px] font-semibold text-black/25">
            {comment.length}/2000
          </span>
        </label>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#F97316] px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white transition hover:bg-[#171717] disabled:opacity-45"
        >
          {saving ? "Saving..." : initialReview?._id ? "Update Review" : "Publish Review"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-black/10 bg-white px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-black/50 transition hover:border-black/25"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default ReviewForm;
