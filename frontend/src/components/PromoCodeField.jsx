import { useEffect, useState } from "react";

import api from "../api/api.js";

const normalizeCode = (value) =>
  String(value || "").trim().toUpperCase().slice(0, 40);

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const describePromotion = (promotion) => {
  if (!promotion) return "Offer code accepted.";

  const value = Math.max(0, Number(promotion.discount?.value || 0));
  const discount =
    promotion.discount?.type === "fixed"
      ? `${money(value)} off`
      : `${value}% off`;

  const minimum = Math.max(0, Number(promotion.minOrderValue || 0));
  const cap = Math.max(0, Number(promotion.maxDiscountAmount || 0));

  const parts = [discount];
  if (minimum > 0) parts.push(`minimum order ${money(minimum)}`);
  if (cap > 0) parts.push(`maximum saving ${money(cap)}`);

  return parts.join(" · ");
};

const describePartner = (referral) => {
  const discount = Math.max(
    0,
    Math.min(100, Number(referral?.discountPercent || 0))
  );

  if (discount > 0) {
    return `${discount}% customer benefit on eligible products.`;
  }

  return "Partner code accepted. Final eligibility is verified at checkout.";
};

const PromoCodeField = ({
  value = "",
  onChange,
  onApplied,
  onClear,
  initialResult = null,
  disabled = false,
  defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(initialResult || null);

  useEffect(() => {
    setResult(initialResult || null);
  }, [initialResult?.kind, initialResult?.code]);

  const updateValue = (nextValue) => {
    setError("");

    if (!result) {
      onChange?.(String(nextValue || "").toUpperCase().slice(0, 40));
    }
  };

  const apply = async () => {
    if (disabled || checking || result) return;

    const code = normalizeCode(value);

    if (!code) {
      setError("Enter a promo or partner code.");
      return;
    }

    setChecking(true);
    setError("");

    try {
      // The authenticated backend is the only authority that classifies the
      // entered code. The browser never guesses whether it is a HAMPORIUM
      // promotion or a partner referral.
      const response = await api.post("/promotions/code/preview", { code });
      const kind = response.data?.kind;

      if (!response.data?.valid || !["promotion", "partner"].includes(kind)) {
        throw new Error("This code is unavailable.");
      }

      if (kind === "promotion") {
        const promotion = response.data?.promotion;

        if (!promotion?.code) {
          throw new Error("This promo code is unavailable.");
        }

        const next = {
          kind: "promotion",
          code: normalizeCode(promotion.code || code),
          title: promotion.name || "HAMPORIUM offer",
          detail: describePromotion(promotion),
          data: promotion,
        };

        setResult(next);
        onChange?.(next.code);
        onApplied?.(next);
        return;
      }

      const referral = response.data?.referral;

      if (!referral?.referralCode) {
        throw new Error("This partner code is unavailable.");
      }

      const next = {
        kind: "partner",
        code: normalizeCode(referral.referralCode || code),
        title: referral.businessName || "Partner benefit",
        detail: describePartner(referral),
        data: referral,
      };

      setResult(next);
      onChange?.(next.code);
      onApplied?.(next);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to check this code right now. Please try again."
      );
    } finally {
      setChecking(false);
    }
  };

  const clear = () => {
    if (checking) return;

    setError("");
    setResult(null);
    onChange?.("");
    onClear?.();
  };

  const handleInputKeyDown = (event) => {
    if (event.key !== "Enter") return;

    // This component can live inside Checkout's main <form>. Prevent Enter
    // from submitting that outer form while the customer is applying a code.
    event.preventDefault();
    event.stopPropagation();
    void apply();
  };

  return (
    <section className="border-y border-[#DCCDB8]/70 bg-[#FFFCF7]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-1 py-5 text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-[#8B6B42]"
          >
            <TicketIcon />
          </span>

          <span className="text-[15px] font-extrabold text-[#4A3726] sm:text-[16px]">
            Have a promo or partner code?
          </span>
        </span>

        <span
          aria-hidden="true"
          className={`shrink-0 text-[#6C533A] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <ChevronIcon />
        </span>
      </button>

      {open && (
        <div className="pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Promo or partner code</span>

              <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#A88355]">
                <TicketIcon />
              </span>

              <input
                value={value}
                onChange={(event) => updateValue(event.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={disabled || checking || Boolean(result)}
                maxLength={40}
                autoComplete="off"
                spellCheck="false"
                inputMode="text"
                placeholder="Enter your code"
                className="h-[58px] w-full rounded-[14px] border border-[#DCCDB8] bg-white pl-14 pr-4 text-[15px] font-semibold uppercase tracking-[0.02em] text-[#251C15] outline-none transition placeholder:normal-case placeholder:font-medium placeholder:text-black/30 focus:border-[#B98A4B] focus:ring-2 focus:ring-[#D4AF37]/10 disabled:cursor-not-allowed disabled:bg-[#FAF6EF]"
              />
            </label>

            {result ? (
              <button
                type="button"
                onClick={clear}
                disabled={disabled || checking}
                className="h-[58px] shrink-0 rounded-[14px] border border-[#DCCDB8] bg-white px-7 text-[13px] font-extrabold text-[#7A5125] transition hover:border-[#B98A4B] hover:bg-[#FFF8EE] disabled:opacity-50"
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void apply()}
                disabled={disabled || checking || !normalizeCode(value)}
                className="h-[58px] shrink-0 rounded-[14px] bg-[#F3E2BF] px-8 text-[13px] font-extrabold text-[#5B3D18] transition hover:bg-[#E9D09F] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {checking ? "Checking..." : "Apply"}
              </button>
            )}
          </div>

          {result && (
            <div className="mt-4 border-l-[3px] border-emerald-500 bg-emerald-50/70 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-emerald-800">
                  {result.kind === "partner"
                    ? "Partner code applied"
                    : "Promo code applied"}
                </p>

                <span className="text-[12px] font-extrabold text-emerald-900">
                  {result.code}
                </span>
              </div>

              <p className="mt-1 text-[11px] font-medium leading-5 text-emerald-900/70">
                {result.detail}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 border-l-[3px] border-red-400 bg-red-50 px-4 py-3 text-[12px] font-semibold leading-5 text-red-700">
              {error}
            </div>
          )}

          <p className="mt-3 text-[10px] font-medium leading-5 text-black/35">
            One code can be used per order. Final item eligibility, customer
            savings and protected margin are checked again securely before the
            payment amount is created.
          </p>
        </div>
      )}
    </section>
  );
};

const TicketIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3.5 7.5h17v3a2.5 2.5 0 0 0 0 5v3h-17v-3a2.5 2.5 0 0 0 0-5v-3Z" />
    <path d="M9 7.5v11" strokeDasharray="2 2" />
  </svg>
);

const ChevronIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default PromoCodeField;
