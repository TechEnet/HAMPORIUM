import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../../../api/api.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
};

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");

const RFQs = () => {
  const [rfqs, setRfqs] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadRFQs = async () => {
    try {
      setLoading(true);
      setError("");

      const { data } =
        await api.get("/rfqs/mine");

      setRfqs(data.rfqs || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load RFQs"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRFQs();
  }, []);

  return (
    <main
      className="rfqs-page mx-auto w-full max-w-[1420px] pb-16 text-[#181715]"
      style={{
        fontFamily:
          "'Manrope', Arial, sans-serif",
      }}
    >
      <style>{`
        .rfqs-page {
          --rfq-orange: #F47822;
          --rfq-gold: #C49A2B;
          --rfq-deep-gold: #916B17;
          --rfq-ink: #181715;
        }

        .rfq-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }

        .rfq-hero::after {
          content: "RFQ";
          position: absolute;
          right: 0;
          top: -32px;
          z-index: -1;

          font-family: ${DISPLAY_FONT};
          font-size: clamp(110px, 15vw, 220px);
          font-style: italic;
          font-weight: 600;
          line-height: .85;

          color: rgba(196,154,43,.042);
          pointer-events: none;
        }

        .rfq-gold {
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

        .rfq-row {
          position: relative;
          isolation: isolate;
        }

        .rfq-row::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;

          background:
            linear-gradient(
              90deg,
              rgba(244,120,34,.026),
              rgba(196,154,43,.017),
              transparent 74%
            );

          opacity: 0;
          transition: opacity .35s ease;
        }

        .rfq-row:hover::before {
          opacity: 1;
        }

        .rfq-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;

          transition:
            color .3s ease,
            transform .3s cubic-bezier(.22,1,.36,1);
        }

        .rfq-link::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -5px;

          width: 0;
          height: 1px;

          background:
            linear-gradient(
              90deg,
              var(--rfq-orange),
              var(--rfq-gold)
            );

          transition:
            width .35s cubic-bezier(.22,1,.36,1);
        }

        .rfq-link:hover {
          color: var(--rfq-orange);
          transform: translateX(2px);
        }

        .rfq-link:hover::after {
          width: 100%;
        }

        .rfq-primary {
          position: relative;
          overflow: hidden;
          transition:
            transform .3s cubic-bezier(.22,1,.36,1),
            background-color .3s ease;
        }

        .rfq-primary::after {
          content: "";
          position: absolute;
          inset: 0;

          background:
            linear-gradient(
              110deg,
              transparent 33%,
              rgba(255,255,255,.22) 50%,
              transparent 67%
            );

          transform: translateX(-140%);
          transition: transform .7s cubic-bezier(.16,1,.3,1);
        }

        .rfq-primary:hover {
          transform: translateY(-2px);
        }

        .rfq-primary:hover::after {
          transform: translateX(140%);
        }

        @media (max-width: 767px) {
          .rfq-hero::after {
            right: -20px;
            top: 5px;
            font-size: 130px;
          }
        }
      `}</style>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="rfq-hero border-b border-black/[0.09] pb-8">
        <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#916B17]">
              Business Gifting
            </p>

            <h1
              style={{
                fontFamily: DISPLAY_FONT,
              }}
              className="mt-2 text-[56px] font-semibold leading-[0.88] tracking-[-0.055em] sm:text-[70px]"
            >
              Bulk{" "}
              <span className="rfq-gold italic">
                Requests.
              </span>
            </h1>

            <p className="mt-5 max-w-[620px] text-[12px] font-medium leading-6 text-black/40">
              Track your bulk, event and corporate gifting requirements.
            </p>
          </div>

          <Link
            to="/account/corporate/rfqs/new"
            className="rfq-primary inline-flex min-h-[46px] w-fit items-center justify-center gap-4 bg-[#181715] px-6 text-[10px] font-extrabold uppercase tracking-[0.09em] text-white hover:bg-[#F47822]"
          >
            New Request
            <span className="text-[16px]">→</span>
          </Link>
        </div>
      </header>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <p className="mt-5 border-l-2 border-red-500 pl-4 text-[12px] font-semibold text-red-600">
          {error}
        </p>
      )}

      {/* =====================================================
          CONTENT
      ===================================================== */}

      {loading ? (
        <RFQsLoading />
      ) : rfqs.length === 0 ? (
        <EmptyRFQs />
      ) : (
        <section>
          <div className="hidden grid-cols-[190px_minmax(280px,1.4fr)_130px_170px_150px_auto] gap-8 border-b border-black/[0.09] py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/30 lg:grid">
            <span>Request</span>
            <span>Requirement</span>
            <span>Quantity</span>
            <span>Delivery</span>
            <span>Status</span>
            <span />
          </div>

          {rfqs.map((rfq) => (
            <RFQRow
              key={rfq._id}
              rfq={rfq}
            />
          ))}
        </section>
      )}
    </main>
  );
};

/* =========================================================
   ROW
========================================================= */

const RFQRow = ({ rfq }) => (
  <article className="rfq-row border-b border-black/[0.09] py-7 lg:py-8">
    <div className="grid gap-6 lg:grid-cols-[190px_minmax(280px,1.4fr)_130px_170px_150px_auto] lg:items-center lg:gap-8">
      {/* REQUEST */}

      <div>
        <p className="text-[11px] font-bold text-[#916B17]">
          {rfq.rfqId}
        </p>

        <p className="mt-2 text-[11px] font-medium text-black/35">
          {formatDate(rfq.createdAt)}
        </p>
      </div>

      {/* REQUIREMENT */}

      <div className="min-w-0">
        <Link
          to={`/account/corporate/rfqs/${rfq._id}`}
        >
          <h2
            style={{
              fontFamily: DISPLAY_FONT,
            }}
            className="text-[28px] font-semibold leading-[0.96] tracking-[-0.025em] transition hover:text-[#916B17]"
          >
            {rfq.title || "Bulk Gifting Requirement"}
          </h2>
        </Link>

        {rfq.companyName && (
          <p className="mt-2 text-[11px] font-medium text-black/40">
            {rfq.companyName}
          </p>
        )}
      </div>

      {/* QUANTITY */}

      <Meta
        label="Quantity"
        value={rfq.quantity || "—"}
      />

      {/* DELIVERY */}

      <Meta
        label="Delivery"
        value={formatDate(
          rfq.requiredDeliveryDate
        )}
      />

      {/* STATUS */}

      <div>
        <span className="mb-2 block text-[10px] font-semibold text-black/30 lg:hidden">
          Status
        </span>

        <RFQStatus
          status={rfq.status}
        />
      </div>

      {/* ACTION */}

      <Link
        to={`/account/corporate/rfqs/${rfq._id}`}
        className="rfq-link w-fit text-[11px] font-extrabold uppercase tracking-[0.08em] text-black/55 lg:justify-self-end"
      >
        View
        <span className="text-[15px]">→</span>
      </Link>
    </div>
  </article>
);

/* =========================================================
   META
========================================================= */

const Meta = ({
  label,
  value,
}) => (
  <div>
    <span className="mb-2 block text-[10px] font-semibold text-black/30 lg:hidden">
      {label}
    </span>

    <p className="text-[12px] font-semibold text-black/60">
      {value}
    </p>
  </div>
);

/* =========================================================
   STATUS
========================================================= */

const RFQStatus = ({ status }) => {
  const value =
    normalizeStatus(status);

  let dot =
    "bg-[#C49A2B]";

  let color =
    "text-[#916B17]";

  if (
    value.includes("approved") ||
    value.includes("accepted") ||
    value.includes("completed")
  ) {
    dot =
      "bg-emerald-500";

    color =
      "text-emerald-700";
  } else if (
    value.includes("rejected") ||
    value.includes("cancel")
  ) {
    dot =
      "bg-red-500";

    color =
      "text-red-600";
  } else if (
    value.includes("quoted") ||
    value.includes("review")
  ) {
    dot =
      "bg-blue-500";

    color =
      "text-blue-700";
  } else if (
    value.includes("draft") ||
    value.includes("submitted") ||
    value.includes("pending")
  ) {
    dot =
      "bg-[#F47822]";

    color =
      "text-[#C55A10]";
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`}
      />

      <span
        className={`text-[12px] font-bold capitalize ${color}`}
      >
        {String(
          status || "Pending"
        ).replace(/[_-]/g, " ")}
      </span>
    </div>
  );
};

/* =========================================================
   EMPTY
========================================================= */

const EmptyRFQs = () => (
  <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden border-b border-black/[0.09] text-center">
    <span
      style={{
        fontFamily: DISPLAY_FONT,
      }}
      className="pointer-events-none absolute text-[190px] font-semibold italic leading-none text-[#C49A2B]/[0.04]"
    >
      RFQ
    </span>

    <div className="relative z-10">
      <h2
        style={{
          fontFamily: DISPLAY_FONT,
        }}
        className="text-[42px] font-semibold tracking-[-0.035em]"
      >
        No requests{" "}
        <span className="italic text-[#A77B1D]">
          yet.
        </span>
      </h2>

      <p className="mx-auto mt-3 max-w-[420px] text-[12px] leading-6 text-black/38">
        Create a bulk gifting request and your commercial quotation will appear once reviewed.
      </p>

      <Link
        to="/account/corporate/rfqs/new"
        className="rfq-link mt-7 text-[12px] font-extrabold uppercase tracking-[0.08em]"
      >
        Create request
        <span>→</span>
      </Link>
    </div>
  </div>
);

/* =========================================================
   LOADING
========================================================= */

const RFQsLoading = () => (
  <div>
    {[1, 2, 3].map((item) => (
      <div
        key={item}
        className="grid min-h-[150px] animate-pulse gap-6 border-b border-black/[0.07] py-8 lg:grid-cols-[190px_1.4fr_130px_170px_150px_70px]"
      >
        <div>
          <div className="h-3 w-32 bg-black/[0.04]" />
          <div className="mt-4 h-3 w-24 bg-black/[0.03]" />
        </div>

        <div className="h-8 w-72 max-w-full bg-black/[0.05]" />
        <div className="h-4 w-16 bg-black/[0.035]" />
        <div className="h-4 w-24 bg-black/[0.035]" />
        <div className="h-4 w-20 bg-black/[0.035]" />
        <div className="h-4 w-14 bg-black/[0.035]" />
      </div>
    ))}
  </div>
);

export default RFQs;
