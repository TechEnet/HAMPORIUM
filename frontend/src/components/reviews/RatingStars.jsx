const RatingStars = ({
  value = 0,
  onChange,
  size = "md",
  readOnly = false,
  showValue = false,
}) => {
  const numericValue = Number(value || 0);
  const interactive = !readOnly && typeof onChange === "function";

  const sizeClass =
    size === "sm"
      ? "text-[15px]"
      : size === "lg"
        ? "text-[28px]"
        : "text-[20px]";

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5" aria-label={`${numericValue} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const active = numericValue >= star;

          if (interactive) {
            return (
              <button
                key={star}
                type="button"
                onClick={() => onChange(star)}
                aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
                className={`${sizeClass} leading-none transition hover:scale-110 ${
                  active ? "text-[#D4AF37]" : "text-black/15"
                }`}
              >
                ★
              </button>
            );
          }

          return (
            <span
              key={star}
              className={`${sizeClass} leading-none ${
                active ? "text-[#D4AF37]" : "text-black/15"
              }`}
            >
              ★
            </span>
          );
        })}
      </div>

      {showValue && (
        <span className="text-[11px] font-extrabold text-black/45">
          {numericValue ? numericValue.toFixed(1) : "0.0"}
        </span>
      )}
    </div>
  );
};

export default RatingStars;
