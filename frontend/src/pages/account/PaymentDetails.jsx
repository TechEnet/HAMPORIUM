import { useEffect, useState } from "react";
import {
  Link,
  useParams,
} from "react-router-dom";

import api from "../../api/api.js";
import OrderTaxSummary from "../../components/OrderTaxSummary.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");

const PaymentDetails = () => {
  const { paymentId } = useParams();

  const [payment, setPayment] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    const loadPayment = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(
          `/payments/my-payments/${paymentId}`
        );

        if (active) {
          setPayment(
            response.data.payment
          );
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load payment"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadPayment();

    return () => {
      active = false;
    };
  }, [paymentId]);

  if (loading) {
    return <PaymentDetailsLoading />;
  }

  if (!payment) {
    return (
      <div className="border-l-2 border-red-500 pl-4 text-[13px] font-semibold text-red-600">
        {error ||
          "Payment not found"}
      </div>
    );
  }

  return (
    <main
      className="payment-details mx-auto w-full max-w-[1320px] pb-16 text-[#181715]"
      style={{
        fontFamily:
          "'Manrope', Arial, sans-serif",
      }}
    >
      <style>{`
        .payment-details {
          --pd-orange: #F47822;
          --pd-gold: #C69A28;
          --pd-dark-gold: #916B17;
          --pd-ink: #181715;
        }

        .pd-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }

        .pd-hero::after {
          content: "₹";
          position: absolute;
          right: 3%;
          bottom: -90px;
          z-index: -1;

          font-family: ${DISPLAY_FONT};
          font-size: clamp(200px, 25vw, 370px);
          font-style: italic;
          font-weight: 600;

          line-height: 1;

          color: rgba(198,154,40,.05);
          pointer-events: none;
        }

        .pd-title-gold {
          background:
            linear-gradient(
              120deg,
              #9C7318,
              #D5AD3D 50%,
              #936A12
            );

          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .pd-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;

          transition:
            color .3s ease,
            transform .3s cubic-bezier(.22,1,.36,1);
        }

        .pd-link::after {
          content: "";
          position: absolute;

          left: 0;
          bottom: -5px;

          width: 0;
          height: 1px;

          background:
            linear-gradient(
              90deg,
              var(--pd-orange),
              var(--pd-gold)
            );

          transition:
            width .35s cubic-bezier(.22,1,.36,1);
        }

        .pd-link:hover {
          color: var(--pd-orange);
          transform: translateX(2px);
        }

        .pd-link:hover::after {
          width: 100%;
        }
      `}</style>

      {/* =====================================================
          BACK
      ===================================================== */}

      <Link
        to="/account/payments"
        className="pd-link text-[11px] font-extrabold uppercase tracking-[0.08em] text-black/45"
      >
        ← Payments
      </Link>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="pd-hero mt-7 border-y border-black/[0.09] py-9 sm:py-11">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#936B17]">
              Transaction
            </p>

            <h1
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="mt-2 text-[52px] font-semibold leading-[0.88] tracking-[-0.055em] sm:text-[66px]"
            >
              Payment{" "}
              <span className="pd-title-gold italic">
                Details.
              </span>
            </h1>

            <p className="mt-5 text-[12px] font-medium text-black/40">
              {formatDate(
                payment.createdAt,
                true
              )}
            </p>
          </div>

          <PaymentStatusText
            status={payment.status}
            large
          />
        </div>
      </section>

      {error && (
        <p className="mt-5 border-l-2 border-red-500 pl-4 text-[12px] font-semibold text-red-600">
          {error}
        </p>
      )}

      {/* =====================================================
          AMOUNT
      ===================================================== */}

      <section className="grid border-b border-black/[0.09] md:grid-cols-3">
        <HeroValue
          label="Amount"
          value={formatCurrency(
            payment.amount
          )}
        />

        <HeroValue
          label="Refunded"
          value={formatCurrency(
            payment.refundedAmount || 0
          )}
          border
        />

        <HeroValue
          label="Method"
          value={
            payment.method
              ? String(
                  payment.method
                ).replace(
                  /[_-]/g,
                  " "
                )
              : "—"
          }
          border
        />
      </section>

      {/* =====================================================
          DETAILS
      ===================================================== */}

      <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,.88fr)]">
        <section>
          <div className="flex items-end justify-between gap-4 border-b border-black/[0.09] pb-4">
            <h2
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="text-[32px] font-semibold tracking-[-0.025em]"
            >
              Transaction information
            </h2>
          </div>

          <div className="grid gap-x-10 gap-y-0 sm:grid-cols-2">
            <Info
              label="Provider"
              value={payment.provider || "—"}
            />

            <Info
              label="Payment ID"
              value={
                payment.razorpayPaymentId ||
                "—"
              }
            />

            <Info
              label="Order ID"
              value={
                payment.razorpayOrderId ||
                "—"
              }
            />

            <Info
              label="Paid At"
              value={
                payment.paidAt
                  ? formatDate(
                      payment.paidAt,
                      true
                    )
                  : "—"
              }
            />

            <Info
              label="Last Refund"
              value={
                payment.lastRefundAt
                  ? formatDate(
                      payment.lastRefundAt,
                      true
                    )
                  : "—"
              }
            />
          </div>

          {payment.errorDescription && (
            <p className="mt-6 border-l-2 border-red-500 pl-4 text-[12px] leading-6 text-red-600">
              {payment.errorDescription}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-7 border-t border-black/[0.09] pt-6">
            {payment.order?._id && (
              <Link
                to={`/account/orders/${payment.order._id}`}
                className="pd-link text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#181715]"
              >
                View order
                <span>→</span>
              </Link>
            )}

            <Link
              to="/account/refunds"
              className="pd-link text-[11px] font-extrabold uppercase tracking-[0.08em] text-black/45"
            >
              Refunds
              <span>↗</span>
            </Link>
          </div>
        </section>

        <aside>
          {payment.order ? (
            <div className="payment-tax-clean">
              <OrderTaxSummary
                order={payment.order}
              />
            </div>
          ) : (
            <p className="border-t border-black/[0.09] py-6 text-[12px] font-medium text-black/40">
              Tax information unavailable.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
};

/* =========================================================
   HERO VALUE
========================================================= */

const HeroValue = ({
  label,
  value,
  border = false,
}) => (
  <div
    className={`py-7 md:px-7 ${
      border
        ? "md:border-l md:border-black/[0.09]"
        : ""
    }`}
  >
    <p className="text-[10px] font-semibold text-black/35">
      {label}
    </p>

    <p
      style={{
        fontFamily:
          DISPLAY_FONT,
      }}
      className="mt-2 break-words text-[27px] font-semibold capitalize tracking-[-0.02em]"
    >
      {value}
    </p>
  </div>
);

/* =========================================================
   INFO
========================================================= */

const Info = ({
  label,
  value,
}) => (
  <div className="border-b border-black/[0.07] py-5">
    <p className="text-[10px] font-semibold text-black/35">
      {label}
    </p>

    <p className="mt-2 break-all text-[13px] font-semibold capitalize leading-6 text-black/70">
      {value}
    </p>
  </div>
);

/* =========================================================
   STATUS
========================================================= */

const PaymentStatusText = ({
  status,
  large = false,
}) => {
  const value =
    normalizeStatus(status);

  let dot = "bg-[#C69A28]";
  let color = "text-[#916B17]";

  if (
    value.includes("captured") ||
    value.includes("paid") ||
    value.includes("success")
  ) {
    dot = "bg-emerald-500";
    color = "text-emerald-700";
  } else if (
    value.includes("failed")
  ) {
    dot = "bg-red-500";
    color = "text-red-600";
  } else if (
    value.includes("authorized")
  ) {
    dot = "bg-blue-500";
    color = "text-blue-700";
  } else if (
    value.includes("refund")
  ) {
    dot = "bg-[#F47822]";
    color = "text-[#C75C10]";
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={`shrink-0 rounded-full ${dot} ${
          large
            ? "h-2.5 w-2.5"
            : "h-[7px] w-[7px]"
        }`}
      />

      <span
        className={`font-bold capitalize ${color} ${
          large
            ? "text-[14px]"
            : "text-[12px]"
        }`}
      >
        {String(
          status || "Pending"
        ).replace(/[_-]/g, " ")}
      </span>
    </div>
  );
};

/* =========================================================
   LOADING
========================================================= */

const PaymentDetailsLoading = () => (
  <div className="mx-auto w-full max-w-[1320px]">
    <div className="h-3 w-24 animate-pulse bg-black/[0.04]" />

    <div className="mt-8 border-y border-black/[0.07] py-10">
      <div className="h-14 w-72 animate-pulse bg-black/[0.05]" />
      <div className="mt-5 h-3 w-36 animate-pulse bg-black/[0.035]" />
    </div>

    <div className="grid border-b border-black/[0.07] md:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-[110px] animate-pulse border-black/[0.07] md:border-l first:md:border-l-0"
        />
      ))}
    </div>
  </div>
);

export default PaymentDetails;