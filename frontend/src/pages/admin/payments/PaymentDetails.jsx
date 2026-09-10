import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";
import OrderTaxSummary from "../../../components/OrderTaxSummary.jsx";

import formatCurrency from "../../../utils/formatCurrency.js";
import formatDate from "../../../utils/formatDate.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const PaymentDetails = () => {
  const { paymentId } = useParams();

  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPayment = async () => {
      try {
        const response = await api.get(
          `/admin/payments/${paymentId}`
        );

        setPayment(response.data.payment);
      } catch (error) {
        setError(
          error.response?.data?.message ||
            "Unable to load payment"
        );
      }
    };

    loadPayment();
  }, [paymentId]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
        {error}
      </div>
    );
  }

  if (!payment) {
    return <PaymentDetailsSkeleton />;
  }

  return (
    <div
      className="mx-auto w-full max-w-[1500px] pb-12 text-[#171717]"
      style={{
        fontFamily: "'Manrope', Arial, sans-serif",
      }}
    >
      {/* =====================================================
          BACK
      ===================================================== */}

      <Link
        to="/admin/payments"
        className="group inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/40 transition hover:text-[#F97316]"
      >
        <span className="transition group-hover:-translate-x-0.5">
          ←
        </span>

        Back to Payments
      </Link>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="mt-5 overflow-hidden rounded-[28px] bg-[#171717] text-white shadow-[0_18px_55px_rgba(23,23,23,0.14)]">
        <div className="grid lg:grid-cols-[1.35fr_.65fr]">
          <div className="relative overflow-hidden p-6 sm:p-8 lg:p-9">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full border border-white/[0.04]" />

            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border border-[#D4AF37]/10" />

            <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#D4AF37]">
              Payment Transaction
            </p>

            <h1
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-2 text-[38px] font-semibold leading-none tracking-[-0.035em] sm:text-[46px]"
            >
              Payment Details
            </h1>

            <p className="mt-3 text-xs font-medium text-white/40">
              {formatDate(
                payment.createdAt,
                true
              )}
            </p>

            <div className="mt-6">
              <StatusBadge
                status={payment.status}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-white/[0.08] lg:border-l lg:border-t-0">
            <HeroStat
              label="Amount"
              value={formatCurrency(
                payment.amount
              )}
            />

            <HeroStat
              label="Status"
              value={
                payment.status
                  ?.replaceAll("_", " ") ||
                "-"
              }
              borderLeft
              small
              capitalize
            />

            <HeroStat
              label="Method"
              value={
                payment.method || "-"
              }
              borderTop
              small
              capitalize
            />

            <HeroStat
              label="Provider"
              value={
                payment.provider || "-"
              }
              borderTop
              borderLeft
              small
              capitalize
            />
          </div>
        </div>
      </section>

      {Number(payment.refundedAmount || 0) > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-violet-600">Refunded Amount</p>
            <p className="mt-1 text-lg font-black text-violet-800">{formatCurrency(payment.refundedAmount)}</p>
          </div>
          <Link to="/admin/refunds" className="rounded-xl bg-[#171717] px-4 py-2.5 text-[10px] font-extrabold text-white hover:bg-[#F97316]">
            Refund Operations
          </Link>
        </div>
      )}

      {/* =====================================================
          TRANSACTION OVERVIEW
      ===================================================== */}

      <section className="mt-6 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
        <SectionHeader
          eyebrow="Transaction"
          title="Payment Overview"
          description="Core payment information recorded by HAMPORIUM."
        />

        <div className="grid md:grid-cols-3">
          <SummaryBlock
            icon={<MoneyIcon />}
            label="Amount"
            value={formatCurrency(
              payment.amount
            )}
          />

          <SummaryBlock
            icon={<CardIcon />}
            label="Method"
            value={
              payment.method || "-"
            }
            capitalize
            borderLeft
          />

          <SummaryBlock
            icon={<GatewayIcon />}
            label="Provider"
            value={
              payment.provider || "-"
            }
            capitalize
            borderLeft
          />
        </div>
      </section>

      {/* =====================================================
          CUSTOMER + ORDER
      ===================================================== */}

      <section className="mt-6 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
        <SectionHeader
          eyebrow="Reference"
          title="Customer & Order"
          description="Customer account and order connected to this payment."
        />

        <div className="grid md:grid-cols-2">
          <InfoSection
            icon={<CustomerIcon />}
            title="Customer"
          >
            <InfoRow
              label="Name"
              value={
                payment.user?.name || "-"
              }
            />

            <InfoRow
              label="Email"
              value={
                payment.user?.email || "-"
              }
            />
          </InfoSection>

          <InfoSection
            icon={<OrderIcon />}
            title="Linked Order"
            borderLeft
          >
            <div>
              <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
                Order Number
              </p>

              {payment.order?._id ? (
                <Link
                  to={`/admin/orders/${payment.order._id}`}
                  className="group mt-2 inline-flex items-center gap-2 text-sm font-extrabold text-[#F97316] transition hover:text-[#171717]"
                >
                  {payment.order.orderNumber}

                  <span className="transition group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              ) : (
                <p className="mt-2 text-sm font-bold text-[#171717]">
                  -
                </p>
              )}
            </div>

            {payment.receipt && (
              <InfoRow
                label="Receipt"
                value={payment.receipt}
                breakAll
              />
            )}
          </InfoSection>
        </div>
      </section>

      {payment.order && (
        <div className="mt-6">
          <OrderTaxSummary order={payment.order} />
        </div>
      )}

      {/* =====================================================
          GATEWAY REFERENCES
      ===================================================== */}

      <section className="mt-6 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
        <SectionHeader
          eyebrow="Gateway"
          title="Razorpay References"
          description="Provider identifiers stored for transaction reconciliation and support."
        />

        <div className="divide-y divide-black/[0.06]">
          <ReferenceRow
            label="Razorpay Order ID"
            value={
              payment.razorpayOrderId || "-"
            }
          />

          <ReferenceRow
            label="Razorpay Payment ID"
            value={
              payment.razorpayPaymentId ||
              "-"
            }
          />
        </div>
      </section>

      {/* =====================================================
          FAILURE
      ===================================================== */}

      {payment.errorDescription && (
        <section className="mt-6 overflow-hidden rounded-[24px] border border-red-200 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
          <div className="flex gap-4 border-b border-red-100 bg-red-50 px-5 py-5 sm:px-7">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-red-600">
              <FailureIcon />
            </span>

            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-red-500">
                Transaction Failure
              </p>

              <h2
                style={{
                  fontFamily: DISPLAY_FONT,
                }}
                className="mt-1 text-[26px] font-semibold leading-none text-red-800"
              >
                Payment Failure
              </h2>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {payment.errorCode && (
              <div className="mb-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
                  Error Code
                </p>

                <span className="mt-2 inline-flex rounded-lg bg-red-50 px-3 py-2 font-mono text-xs font-bold text-red-700">
                  {payment.errorCode}
                </span>
              </div>
            )}

            <div>
              <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
                Gateway Message
              </p>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-red-700">
                {payment.errorDescription}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          FOOTER RECORD
      ===================================================== */}

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-[#FAFAF9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
            Transaction Record
          </p>

          <p className="mt-1 text-[11px] text-black/40">
            Payment ID:{" "}
            <span className="font-mono font-semibold text-black/55">
              {payment._id}
            </span>
          </p>
        </div>

        <Link
          to="/admin/payments"
          className="inline-flex items-center justify-center rounded-xl border border-black/[0.08] bg-white px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-black/50 transition hover:border-[#F97316] hover:text-[#F97316]"
        >
          Back to Payments
        </Link>
      </div>
    </div>
  );
};

/* =========================================================
   UI
========================================================= */

const SectionHeader = ({
  eyebrow,
  title,
  description,
}) => (
  <div className="border-b border-black/[0.06] px-5 py-5 sm:px-7">
    <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#F97316]">
      {eyebrow}
    </p>

    <h2
      style={{ fontFamily: DISPLAY_FONT }}
      className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.02em]"
    >
      {title}
    </h2>

    {description && (
      <p className="mt-2 max-w-2xl text-xs leading-5 text-black/40">
        {description}
      </p>
    )}
  </div>
);

const HeroStat = ({
  label,
  value,
  borderLeft = false,
  borderTop = false,
  small = false,
  capitalize = false,
}) => (
  <div
    className={`flex min-h-[125px] flex-col justify-between p-5 ${
      borderLeft
        ? "border-l border-white/[0.08]"
        : ""
    } ${
      borderTop
        ? "border-t border-white/[0.08]"
        : ""
    }`}
  >
    <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-white/35">
      {label}
    </p>

    <p
      className={`mt-4 font-black leading-tight tracking-[-0.03em] text-white ${
        small
          ? "text-[14px]"
          : "text-[20px] sm:text-[23px]"
      } ${capitalize ? "capitalize" : ""}`}
    >
      {value}
    </p>
  </div>
);

const SummaryBlock = ({
  icon,
  label,
  value,
  capitalize = false,
  borderLeft = false,
}) => (
  <div
    className={`p-5 sm:p-7 ${
      borderLeft
        ? "border-t border-black/[0.06] md:border-l md:border-t-0"
        : ""
    }`}
  >
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF1E8] text-[#F97316]">
      {icon}
    </span>

    <p className="mt-5 text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
      {label}
    </p>

    <p
      className={`mt-2 text-xl font-black tracking-[-0.03em] text-[#171717] ${
        capitalize ? "capitalize" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

const InfoSection = ({
  icon,
  title,
  children,
  borderLeft = false,
}) => (
  <div
    className={`p-5 sm:p-7 ${
      borderLeft
        ? "border-t border-black/[0.06] md:border-l md:border-t-0"
        : ""
    }`}
  >
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1E8] text-[#F97316]">
        {icon}
      </span>

      <p className="text-sm font-extrabold text-[#171717]">
        {title}
      </p>
    </div>

    <div className="mt-6 space-y-5">
      {children}
    </div>
  </div>
);

const InfoRow = ({
  label,
  value,
  breakAll = false,
}) => (
  <div>
    <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
      {label}
    </p>

    <p
      className={`mt-1.5 text-sm font-bold text-[#171717] ${
        breakAll ? "break-all" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

const ReferenceRow = ({
  label,
  value,
}) => (
  <div className="px-5 py-5 sm:px-7">
    <div className="grid gap-3 lg:grid-cols-[220px_1fr] lg:items-center">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-black/30">
        {label}
      </p>

      <div className="rounded-xl bg-[#FAFAF9] px-4 py-3">
        <p className="break-all font-mono text-xs font-semibold text-black/65">
          {value}
        </p>
      </div>
    </div>
  </div>
);

/* =========================================================
   LOADING
========================================================= */

const PaymentDetailsSkeleton = () => (
  <div className="mx-auto w-full max-w-[1500px] animate-pulse pb-12">
    <div className="h-4 w-32 rounded bg-black/[0.04]" />

    <div className="mt-5 h-[260px] rounded-[28px] bg-[#171717]/95" />

    <div className="mt-6 h-[220px] rounded-[24px] bg-white" />

    <div className="mt-6 h-[250px] rounded-[24px] bg-white" />

    <div className="mt-6 h-[220px] rounded-[24px] bg-white" />
  </div>
);

/* =========================================================
   ICONS
========================================================= */

const IconBase = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[18px] w-[18px]"
  >
    {children}
  </svg>
);

const MoneyIcon = () => (
  <IconBase>
    <circle cx="12" cy="12" r="8" />
    <path d="M8 8h8M8 11h8M12 8v9M9 14c1 2 2.4 3 5 3" />
  </IconBase>
);

const CardIcon = () => (
  <IconBase>
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2"
    />
    <path d="M3 10h18M7 15h4" />
  </IconBase>
);

const GatewayIcon = () => (
  <IconBase>
    <path d="M4 7h16v10H4z" />
    <path d="M8 4v3M16 4v3M8 17v3M16 17v3" />
  </IconBase>
);

const CustomerIcon = () => (
  <IconBase>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.6-4.5 3-7 7-7s6.4 2.5 7 7" />
  </IconBase>
);

const OrderIcon = () => (
  <IconBase>
    <path d="M5 4h14v16H5V4Z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </IconBase>
);

const FailureIcon = () => (
  <IconBase>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </IconBase>
);

export default PaymentDetails;