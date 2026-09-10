import RatingStars from "./RatingStars.jsx";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const ReviewCard = ({ review, actions = null }) => {
  const userName = review?.user?.name || "HAMPORIUM Customer";

  return (
    <article className="rounded-[18px] border border-black/[0.07] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <RatingStars value={review?.rating || 0} readOnly size="sm" />

            {review?.verifiedPurchase && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.07em] text-emerald-700">
                Verified Purchase
              </span>
            )}
          </div>

          <p className="mt-3 text-[12px] font-extrabold text-[#171717]">
            {userName}
          </p>

          <p className="mt-1 text-[9px] font-semibold text-black/30">
            {formatDate(review?.createdAt)}
          </p>
        </div>

        {actions}
      </div>

      {review?.title && (
        <h3 className="mt-4 text-[14px] font-black text-[#171717]">
          {review.title}
        </h3>
      )}

      <p className="mt-2 whitespace-pre-wrap text-[12px] font-medium leading-6 text-black/55">
        {review?.comment || ""}
      </p>
    </article>
  );
};

export default ReviewCard;
