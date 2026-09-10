import RatingStars from "./RatingStars.jsx";

const ReviewSummary = ({ summary }) => {
  const average = Number(summary?.averageRating || 0);
  const total = Number(summary?.totalReviews || 0);
  const distribution = summary?.distribution || {};

  return (
    <div className="grid gap-6 rounded-[22px] border border-black/[0.07] bg-[#FFF9F2] p-5 sm:grid-cols-[210px_minmax(0,1fr)] sm:p-6">
      <div className="flex flex-col justify-center border-b border-black/[0.06] pb-5 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
        <p className="font-serif text-[48px] font-semibold leading-none text-[#171717]">
          {average.toFixed(1)}
        </p>
        <div className="mt-3">
          <RatingStars value={Math.round(average)} readOnly size="md" />
        </div>
        <p className="mt-2 text-[10px] font-semibold text-black/40">
          Based on {total} verified review{total === 1 ? "" : "s"}
        </p>
      </div>

      <div className="space-y-2.5">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = Number(distribution?.[rating] || 0);
          const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={rating} className="grid grid-cols-[44px_minmax(0,1fr)_46px] items-center gap-3">
              <span className="text-[10px] font-bold text-black/45">{rating} ★</span>
              <div className="h-2 overflow-hidden rounded-full bg-black/[0.07]">
                <div
                  className="h-full rounded-full bg-[#D4AF37] transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-right text-[9px] font-bold text-black/35">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewSummary;
