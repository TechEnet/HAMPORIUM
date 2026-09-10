export const formatLabel = (value = "") =>
  String(value || "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const formatMoney = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export const formatPartnerDate = (value, withTime = false) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
};

const statusClass = (value) => {
  const status = String(value || "").toLowerCase();

  if (["approved", "active", "paid", "payable", "eligible", "client_approved", "order_attributed"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["rejected", "suspended", "failed", "cancelled", "revoked", "reversed", "expired"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (["under_review", "processing", "submitted", "client_review", "showcase_live"].includes(status)) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
};

export const StatusPill = ({ value, label, className = "" }) => (
  <span
    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] ${statusClass(
      value
    )} ${className}`}
  >
    {label || formatLabel(value)}
  </span>
);

export const PageHeader = ({ eyebrow = "Partner Portal", title, description, action }) => (
  <header className="flex flex-col gap-5 border-b border-black/[0.07] pb-7 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F97316]">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-serif text-[40px] font-semibold leading-none tracking-[-0.035em] sm:text-[48px]">
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/45">
          {description}
        </p>
      )}
    </div>
    {action}
  </header>
);

export const Panel = ({ children, className = "" }) => (
  <section className={`rounded-[22px] border border-black/[0.07] bg-white p-5 shadow-[0_10px_30px_rgba(23,23,23,.03)] sm:p-6 ${className}`}>
    {children}
  </section>
);

export const MetricCard = ({ label, value, helper = "" }) => (
  <div className="rounded-[18px] border border-black/[0.06] bg-white p-5">
    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-black/35">
      {label}
    </p>
    <p className="mt-2 text-2xl font-black text-[#171717]">{value}</p>
    {helper && <p className="mt-2 text-[10px] text-black/35">{helper}</p>}
  </div>
);

export const Notice = ({ children, type = "info" }) => {
  const classes =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-[#D4AF37]/30 bg-[#FFF9F2] text-[#6F5410]";

  return <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>{children}</div>;
};

export const EmptyState = ({ title, text, action }) => (
  <div className="rounded-[20px] border border-dashed border-black/10 bg-white p-10 text-center">
    <p className="font-black">{title}</p>
    {text && <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-black/40">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const Field = ({ label, children, helper = "" }) => (
  <label className="block">
    <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.1em] text-black/45">
      {label}
    </span>
    {children}
    {helper && <span className="mt-2 block text-[10px] leading-4 text-black/35">{helper}</span>}
  </label>
);

export const inputClass =
  "h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-[#171717] outline-none transition placeholder:text-black/25 focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/10";

export const textareaClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium leading-6 text-[#171717] outline-none transition placeholder:text-black/25 focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/10";
