import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");

const Refunds = () => {
  const [refunds, setRefunds] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadRefunds = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });

        if (status) {
          params.set("status", status);
        }

        const response = await api.get(
          `/refunds/mine?${params.toString()}`
        );

        if (!active) return;

        setRefunds(response.data.refunds || []);
        setPagination(response.data.pagination || null);
      } catch (requestError) {
        if (!active) return;

        setError(
          requestError.response?.data?.message ||
            "Unable to load refunds"
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadRefunds();

    return () => {
      active = false;
    };
  }, [page, status]);

  return (
    <main
      className="refunds-page mx-auto w-full max-w-[1400px] pb-16 text-[#181715]"
      style={{
        fontFamily: "'Manrope', Arial, sans-serif",
      }}
    >
      <style>{`
        .refunds-page {
          --refund-orange: #F47822;
          --refund-gold: #C49A2B;
          --refund-deep-gold: #916B17;
          --refund-ink: #181715;
        }

        .refunds-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }

        .refunds-hero::after {
          content: "↺";
          position: absolute;
          right: 1%;
          top: -62px;
          z-index: -1;

          font-family: ${DISPLAY_FONT};
          font-size: clamp(170px, 21vw, 300px);
          font-weight: 600;
          line-height: 1;

          color: rgba(196, 154, 43, .045);
          pointer-events: none;
        }

        .refunds-gold {
          background:
            linear-gradient(
              120deg,
              #936B16,
              #D1A83B 48%,
              #A67A1B
            );

          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .refund-row {
          position: relative;
          isolation: isolate;
        }

        .refund-row::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;

          background:
            linear-gradient(
              90deg,
              rgba(244,120,34,.024),
              rgba(196,154,43,.016),
              transparent 72%
            );

          opacity: 0;
          transition: opacity .35s ease;
        }

        .refund-row:hover::before {
          opacity: 1;
        }

        .refund-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;

          transition:
            color .3s ease,
            transform .3s cubic-bezier(.22,1,.36,1);
        }

        .refund-link::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -5px;

          width: 0;
          height: 1px;

          background:
            linear-gradient(
              90deg,
              var(--refund-orange),
              var(--refund-gold)
            );

          transition:
            width .35s cubic-bezier(.22,1,.36,1);
        }

        .refund-link:hover {
          color: var(--refund-orange);
          transform: translateX(2px);
        }

        .refund-link:hover::after {
          width: 100%;
        }

        @media (max-width: 767px) {
          .refunds-hero::after {
            right: -20px;
            top: -5px;
            font-size: 180px;
          }
        }
      `}</style>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="refunds-hero border-b border-black/[0.09] pb-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#916B17]">
              Payment History
            </p>

            <h1
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-2 text-[56px] font-semibold leading-[0.88] tracking-[-0.055em] sm:text-[70px]"
            >
              My{" "}
              <span className="refunds-gold italic">
                Refunds.
              </span>
            </h1>
          </div>

          <label>
            <span className="mb-1 block text-[10px] font-semibold text-black/35">
              Status
            </span>

            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-10 min-w-[185px] border-0 border-b border-black/[0.16] bg-transparent px-0 text-[12px] font-semibold text-black/65 outline-none focus:border-[#F47822]"
            >
              <option value="">All refunds</option>
              <option value="created">Created</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>
      </header>

      {error && (
        <p className="mt-5 border-l-2 border-red-500 pl-4 text-[12px] font-semibold text-red-600">
          {error}
        </p>
      )}

      {/* =====================================================
          REFUNDS
      ===================================================== */}

      {loading ? (
        <RefundsLoading />
      ) : !refunds.length ? (
        <EmptyRefunds />
      ) : (
        <section>
          {refunds.map((refund) => (
            <RefundRow
              key={refund._id}
              refund={refund}
            />
          ))}
        </section>
      )}

      {/* =====================================================
          PAGINATION
      ===================================================== */}

      {pagination && pagination.pages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-black/[0.09] pt-6">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() =>
              setPage((value) =>
                Math.max(1, value - 1)
              )
            }
            className="refund-link text-[11px] font-bold uppercase tracking-[0.08em] text-black/50 disabled:pointer-events-none disabled:opacity-25"
          >
            ← Previous
          </button>

          <span className="text-[11px] font-semibold text-black/35">
            {pagination.page} / {pagination.pages}
          </span>

          <button
            type="button"
            disabled={page >= pagination.pages}
            onClick={() =>
              setPage((value) => value + 1)
            }
            className="refund-link text-[11px] font-bold uppercase tracking-[0.08em] text-black/50 disabled:pointer-events-none disabled:opacity-25"
          >
            Next →
          </button>
        </div>
      )}
    </main>
  );
};

/* =========================================================
   REFUND ROW
========================================================= */

const RefundRow = ({ refund }) => {
  const completed =
    normalizeStatus(refund.status).includes("completed");

  return (
    <article className="refund-row border-b border-black/[0.09] py-8 lg:py-9">
      <div className="grid gap-7 md:grid-cols-[minmax(260px,1.35fr)_minmax(180px,.8fr)_auto] md:items-center md:gap-10">
        {/* DETAILS */}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <RefundStatusText status={refund.status} />

            {refund.type && (
              <span className="text-[12px] font-semibold capitalize text-black/40">
                {String(refund.type).replace(/[_-]/g, " ")}
              </span>
            )}
          </div>

          <p
            style={{ fontFamily: DISPLAY_FONT }}
            className="mt-4 text-[29px] font-semibold leading-none tracking-[-0.025em]"
          >
            {refund.order?.orderNumber || "Order refund"}
          </p>

          <p className="mt-3 text-[11px] font-medium text-black/38">
            {formatDate(refund.createdAt, true)}
          </p>

          {refund.reason && (
            <p className="mt-4 max-w-[700px] text-[12px] leading-6 text-black/52">
              {refund.reason}
            </p>
          )}

          {refund.razorpayRefundId && (
            <p className="mt-4 break-all text-[10px] font-medium text-black/30">
              Refund ID · {refund.razorpayRefundId}
            </p>
          )}

          {refund.errorDescription && (
            <p className="mt-4 border-l-2 border-red-500 pl-4 text-[11px] leading-5 text-red-600">
              {refund.errorDescription}
            </p>
          )}
        </div>

        {/* AMOUNT */}

        <div>
          <p className="text-[10px] font-semibold text-black/35">
            Refund amount
          </p>

          <p
            style={{ fontFamily: DISPLAY_FONT }}
            className={`mt-1 text-[31px] font-semibold tracking-[-0.025em] ${
              completed
                ? "text-emerald-700"
                : "text-[#F47822]"
            }`}
          >
            {formatCurrency(refund.amount)}
          </p>
        </div>

        {/* ORDER LINK */}

        {refund.order?._id ? (
          <Link
            to={`/account/orders/${refund.order._id}`}
            className="refund-link w-fit text-[11px] font-extrabold uppercase tracking-[0.08em] text-black/55"
          >
            View order
            <span className="text-[15px]">→</span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </article>
  );
};

/* =========================================================
   STATUS
========================================================= */

const RefundStatusText = ({ status }) => {
  const value = normalizeStatus(status);

  let dot = "bg-[#C49A2B]";
  let color = "text-[#916B17]";

  if (value.includes("completed")) {
    dot = "bg-emerald-500";
    color = "text-emerald-700";
  } else if (value.includes("failed")) {
    dot = "bg-red-500";
    color = "text-red-600";
  } else if (value.includes("processing")) {
    dot = "bg-blue-500";
    color = "text-blue-700";
  } else if (value.includes("created")) {
    dot = "bg-[#F47822]";
    color = "text-[#C55A10]";
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`}
      />

      <span
        className={`text-[12px] font-bold capitalize ${color}`}
      >
        {String(status || "Created").replace(/[_-]/g, " ")}
      </span>
    </div>
  );
};

/* =========================================================
   EMPTY
========================================================= */

const EmptyRefunds = () => (
  <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden border-b border-black/[0.09] text-center">
    <span
      style={{ fontFamily: DISPLAY_FONT }}
      className="pointer-events-none absolute text-[250px] font-semibold italic leading-none text-[#C49A2B]/[0.04]"
    >
      ↺
    </span>

    <div className="relative z-10">
      <h2
        style={{ fontFamily: DISPLAY_FONT }}
        className="text-[42px] font-semibold tracking-[-0.035em]"
      >
        No refunds{" "}
        <span className="italic text-[#A77B1D]">
          yet.
        </span>
      </h2>

      <Link
        to="/account/orders"
        className="refund-link mt-7 text-[12px] font-extrabold uppercase tracking-[0.08em]"
      >
        View orders
        <span>→</span>
      </Link>
    </div>
  </div>
);

/* =========================================================
   LOADING
========================================================= */

const RefundsLoading = () => (
  <div>
    {[1, 2, 3].map((item) => (
      <div
        key={item}
        className="grid min-h-[170px] animate-pulse gap-7 border-b border-black/[0.07] py-8 md:grid-cols-[1.4fr_.8fr_90px]"
      >
        <div>
          <div className="h-3 w-36 bg-black/[0.04]" />
          <div className="mt-5 h-8 w-64 bg-black/[0.05]" />
          <div className="mt-5 h-3 w-52 bg-black/[0.035]" />
        </div>

        <div className="h-9 w-36 bg-black/[0.045]" />
        <div className="h-3 w-16 bg-black/[0.04]" />
      </div>
    ))}
  </div>
);

export default Refunds;
