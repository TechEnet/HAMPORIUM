import {
  useEffect,
  useState,
} from "react";

import api from "../../api/api.js";

const ReviewForm = ({
  productId = "",
  orderId = "",
  targetType = "product",
  targetName = "",
  initialReview = null,
  compact = false,
  onCancel,
  onSaved,
}) => {
  const [rating, setRating] =
    useState(
      Number(
        initialReview?.rating ||
          0
      )
    );

  const [title, setTitle] =
    useState(
      initialReview?.title ||
        ""
    );

  const [comment, setComment] =
    useState(
      initialReview?.comment ||
        ""
    );

  const [
    eligibility,
    setEligibility,
  ] = useState(
    initialReview
      ? {
          eligible: true,
          existingReview:
            initialReview,
        }
      : null
  );

  const [
    checking,
    setChecking,
  ] = useState(
    !initialReview
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const effectiveTargetType =
    initialReview
      ?.targetType ||
    targetType ||
    "product";

  useEffect(() => {
    if (initialReview) {
      setEligibility({
        eligible: true,
        existingReview:
          initialReview,
      });

      setChecking(false);
      return;
    }

    let active = true;

    const check =
      async () => {
        setChecking(true);
        setError("");

        try {
          let response;

          if (
            effectiveTargetType ===
            "custom_hamper"
          ) {
            if (!orderId) {
              throw new Error(
                "Order is missing for this custom hamper review."
              );
            }

            response =
              await api.get(
                `/reviews/eligibility/custom-hamper/${orderId}`
              );
          } else {
            if (!productId) {
              throw new Error(
                "Product is missing for this review."
              );
            }

            response =
              await api.get(
                `/reviews/eligibility/${productId}`
              );
          }

          if (!active) {
            return;
          }

          const next =
            response.data
              ?.eligibility ||
            null;

          setEligibility(
            next
          );

          if (
            next
              ?.existingReview
          ) {
            setRating(
              Number(
                next
                  .existingReview
                  .rating ||
                  0
              )
            );

            setTitle(
              next
                .existingReview
                .title ||
                ""
            );

            setComment(
              next
                .existingReview
                .comment ||
                ""
            );
          }
        } catch (
          requestError
        ) {
          if (!active) {
            return;
          }

          setEligibility({
            eligible: false,
          });

          setError(
            requestError.response
              ?.data?.message ||
              requestError.message ||
              "Unable to check review eligibility"
          );
        } finally {
          if (active) {
            setChecking(false);
          }
        }
      };

    void check();

    return () => {
      active = false;
    };
  }, [
    initialReview,
    effectiveTargetType,
    productId,
    orderId,
  ]);

  const submit =
    async (event) => {
      event.preventDefault();

      if (
        rating < 1 ||
        rating > 5
      ) {
        setError(
          "Please select a rating from 1 to 5."
        );

        return;
      }

      if (
        comment.trim().length <
        3
      ) {
        setError(
          "Please write at least 3 characters about your experience."
        );

        return;
      }

      setSubmitting(true);
      setError("");

      try {
        const existing =
          initialReview ||
          eligibility
            ?.existingReview;

        let response;

        if (
          existing?._id
        ) {
          response =
            await api.patch(
              `/reviews/${existing._id}`,
              {
                rating,
                title:
                  title.trim(),
                comment:
                  comment.trim(),
              }
            );
        } else {
          const payload = {
            targetType:
              effectiveTargetType,
            orderId,
            rating,
            title:
              title.trim(),
            comment:
              comment.trim(),
          };

          if (
            effectiveTargetType ===
            "product"
          ) {
            payload.productId =
              productId;
          }

          response =
            await api.post(
              "/reviews",
              payload
            );
        }

        const saved =
          response.data
            ?.review ||
          null;

        setEligibility(
          (current) => ({
            ...(current || {}),
            eligible: true,
            existingReview:
              saved ||
              existing ||
              null,
          })
        );

        onSaved?.(
          saved,
          response.data
            ?.message ||
            "Review saved."
        );
      } catch (
        requestError
      ) {
        setError(
          requestError.response
            ?.data?.message ||
            "Unable to save review"
        );
      } finally {
        setSubmitting(false);
      }
    };

  if (checking) {
    return (
      <div className="border-y border-black/[0.08] py-5 text-[13px] font-medium text-black/40">
        Checking review eligibility...
      </div>
    );
  }

  if (
    !initialReview &&
    eligibility &&
    !eligibility.eligible
  ) {
    return (
      <div className="border-l-2 border-amber-500 pl-4">
        <p className="text-[13px] font-bold text-amber-800">
          Review is not available yet.
        </p>

        <p className="mt-1 text-[12px] leading-5 text-black/45">
          Reviews are available only for delivered purchases.
        </p>

        {error && (
          <p className="mt-2 text-[12px] font-semibold text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={
        compact
          ? "border-t border-black/[0.08] pt-5"
          : "border-y border-black/[0.08] py-6"
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-[12px] font-extrabold uppercase tracking-[0.07em] text-[#906A16]">
            Your Rating
          </p>

          {targetName && (
            <p className="mt-1 text-[14px] font-semibold text-black/60">
              {targetName}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setRating(
                      value
                    )
                  }
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  className={`text-[30px] leading-none transition ${
                    value <= rating
                      ? "text-[#D4AF37]"
                      : "text-black/15 hover:text-[#D4AF37]/55"
                  }`}
                >
                  ★
                </button>
              )
            )}

            {rating > 0 && (
              <span className="ml-2 text-[13px] font-bold text-black/45">
                {rating}/5
              </span>
            )}
          </div>
        </div>

        <label className="block">
          <span className="text-[12px] font-bold text-black/45">
            Title{" "}
            <span className="font-medium text-black/25">
              optional
            </span>
          </span>

          <input
            value={title}
            onChange={(event) =>
              setTitle(
                event.target
                  .value
              )
            }
            maxLength="120"
            placeholder="A short summary"
            className="mt-2 h-11 w-full border-0 border-b border-black/[0.16] bg-transparent px-0 text-[14px] font-semibold outline-none placeholder:text-black/25 focus:border-[#F47822]"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-bold text-black/45">
            Your Review
          </span>

          <textarea
            rows={
              compact ? 4 : 5
            }
            value={comment}
            onChange={(event) =>
              setComment(
                event.target
                  .value
              )
            }
            maxLength="2000"
            placeholder="How was your order?"
            className="mt-2 w-full resize-none border-0 border-b border-black/[0.16] bg-transparent py-3 text-[14px] leading-6 outline-none placeholder:text-black/25 focus:border-[#F47822]"
          />
        </label>

        {error && (
          <p className="border-l-2 border-red-500 pl-3 text-[12px] font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-5">
          <button
            type="submit"
            disabled={
              submitting
            }
            className="min-h-[44px] bg-[#181715] px-6 text-[11px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:bg-[#F47822] disabled:opacity-40"
          >
            {submitting
              ? "Saving..."
              : eligibility
                    ?.existingReview ||
                  initialReview
                ? "Update Review"
                : "Publish Review"}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={
                onCancel
              }
              disabled={
                submitting
              }
              className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-black/45 transition hover:text-red-600 disabled:opacity-40"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
};

export default ReviewForm;
