const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const labelize = (value) =>
  String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const STATUS_GROUPS = {
  green: new Set([
    "paid",
    "captured",
    "completed",
    "delivered",
    "approved",
    "active",
    "published",
    "accepted",
    "passed",
    "payable",
    "eligible",
    "paid_out",
    "refunded",
    "verified",
    "client_approved",
    "order_attributed",
  ]),
  blue: new Set([
    "confirmed",
    "processing",
    "preparing",
    "dispatched",
    "shipped",
    "in_transit",
    "authorized",
    "processing_refund",
    "under_review",
    "submitted",
    "showcase_live",
    "client_review",
    "order_confirmed",
  ]),
  violet: new Set([
    "packed",
    "ready_to_ship",
    "out_for_delivery",
    "partially_refunded",
    "partial",
    "attributed",
    "potential",
  ]),
  amber: new Set([
    "pending",
    "pending_payment",
    "created",
    "requested",
    "cancellation_requested",
    "label_ready",
    "review",
    "draft",
    "on_hold",
    "held",
    "qc",
    "unread",
    "applied",
    "changes_requested",
    "client_price_approved",
    "enquiry",
    "not_due",
  ]),
  red: new Set([
    "failed",
    "payment_failed",
    "rejected",
    "returned",
    "cancelled",
    "error",
    "expired",
    "revoked",
    "suspended",
    "reversed",
  ]),
  gray: new Set(["none", "inactive", "archived", "read"]),
};

const groupClass = (status) => {
  if (STATUS_GROUPS.green.has(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (STATUS_GROUPS.blue.has(status)) return "border-blue-200 bg-blue-50 text-blue-700";
  if (STATUS_GROUPS.violet.has(status)) return "border-violet-200 bg-violet-50 text-violet-700";
  if (STATUS_GROUPS.amber.has(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (STATUS_GROUPS.red.has(status)) return "border-red-200 bg-red-50 text-red-700";
  if (STATUS_GROUPS.gray.has(status)) return "border-black/10 bg-black/[0.04] text-black/50";
  return "border-orange-200 bg-orange-50 text-[#F97316]";
};

const StatusBadge = ({ status, label, className = "" }) => {
  const normalized = normalize(status);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.06em] ${groupClass(
        normalized
      )} ${className}`}
    >
      {label || labelize(normalized || status)}
    </span>
  );
};

export default StatusBadge;
