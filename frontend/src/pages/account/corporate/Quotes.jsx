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

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");

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

const Quotes = () => {
  const [quotes, setQuotes] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    const loadQuotes = async () => {
      try {
        setLoading(true);
        setError("");

        const { data } =
          await api.get(
            "/quotes/mine"
          );

        if (!active) {
          return;
        }

        setQuotes(
          data.quotes || []
        );
      } catch (
        requestError
      ) {
        if (!active) {
          return;
        }

        setError(
          requestError.response
            ?.data?.message ||
            "Unable to load quotations"
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadQuotes();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main
      className="quotes-page mx-auto w-full max-w-[1420px] pb-16 text-[#181715]"
      style={{
        fontFamily:
          "'Manrope', Arial, sans-serif",
      }}
    >
      <style>{`
        .quotes-page {
          --quote-orange: #F47822;
          --quote-gold: #C49A2B;
          --quote-deep-gold: #916B17;
          --quote-ink: #181715;
        }

        .quotes-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }

        .quotes-hero::after {
          content: "Q";
          position: absolute;
          right: 1%;
          top: -58px;
          z-index: -1;

          font-family: ${DISPLAY_FONT};
          font-size: clamp(180px, 22vw, 330px);
          font-style: italic;
          font-weight: 600;
          line-height: 1;

          color: rgba(196,154,43,.043);
          pointer-events: none;
        }

        .quotes-gold {
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

        .quote-row {
          position: relative;
          isolation: isolate;
        }

        .quote-row::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;

          background:
            linear-gradient(
              90deg,
              rgba(244,120,34,.026),
              rgba(196,154,43,.017),
              transparent 72%
            );

          opacity: 0;
          transition: opacity .35s ease;
        }

        .quote-row:hover::before {
          opacity: 1;
        }

        .quote-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;

          transition:
            color .3s ease,
            transform .3s cubic-bezier(.22,1,.36,1);
        }

        .quote-link::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -5px;

          width: 0;
          height: 1px;

          background:
            linear-gradient(
              90deg,
              var(--quote-orange),
              var(--quote-gold)
            );

          transition:
            width .35s cubic-bezier(.22,1,.36,1);
        }

        .quote-link:hover {
          color: var(--quote-orange);
          transform: translateX(2px);
        }

        .quote-link:hover::after {
          width: 100%;
        }

        @media (max-width: 767px) {
          .quotes-hero::after {
            right: -20px;
            top: 0;
            font-size: 190px;
          }
        }
      `}</style>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="quotes-hero border-b border-black/[0.09] pb-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#916B17]">
              Commercials
            </p>

            <h1
              style={{
                fontFamily: DISPLAY_FONT,
              }}
              className="mt-2 text-[56px] font-semibold leading-[0.88] tracking-[-0.055em] sm:text-[70px]"
            >
              My{" "}
              <span className="quotes-gold italic">
                Quotations.
              </span>
            </h1>

            <p className="mt-5 max-w-[620px] text-[12px] font-medium leading-6 text-black/40">
              Review current commercial proposals and previous quote versions.
            </p>
          </div>

          <Link
            to="/account/corporate/rfqs"
            className="quote-link w-fit text-[11px] font-extrabold uppercase tracking-[0.08em] text-black/50"
          >
            Bulk Requests
            <span>↗</span>
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
        <QuotesLoading />
      ) : quotes.length === 0 ? (
        <EmptyQuotes />
      ) : (
        <section>
          <div className="hidden grid-cols-[190px_minmax(300px,1.5fr)_120px_160px_auto] gap-8 border-b border-black/[0.09] py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/30 lg:grid">
            <span>Quotation</span>
            <span>Request</span>
            <span>Version</span>
            <span>Status</span>
            <span />
          </div>

          {quotes.map(
            (quote) => (
              <QuoteRow
                key={quote._id}
                quote={quote}
              />
            )
          )}
        </section>
      )}
    </main>
  );
};

/* =========================================================
   ROW
========================================================= */

const QuoteRow = ({
  quote,
}) => (
  <article className="quote-row border-b border-black/[0.09] py-7 lg:py-8">
    <div className="grid gap-6 lg:grid-cols-[190px_minmax(300px,1.5fr)_120px_160px_auto] lg:items-center lg:gap-8">
      {/* QUOTE */}

      <div>
        <p className="text-[11px] font-bold text-[#916B17]">
          {quote.quoteId}
        </p>

        {quote.createdAt && (
          <p className="mt-2 text-[11px] font-medium text-black/35">
            {formatDate(
              quote.createdAt
            )}
          </p>
        )}
      </div>

      {/* RFQ */}

      <div className="min-w-0">
        <Link
          to={`/account/corporate/quotes/${quote._id}`}
        >
          <h2
            style={{
              fontFamily: DISPLAY_FONT,
            }}
            className="text-[28px] font-semibold leading-[0.96] tracking-[-0.025em] transition hover:text-[#916B17]"
          >
            {quote.rfq?.title ||
              "Corporate Quotation"}
          </h2>
        </Link>

        {quote.rfq?.rfqId && (
          <p className="mt-2 text-[11px] font-medium text-black/40">
            {quote.rfq.rfqId}
          </p>
        )}
      </div>

      {/* VERSION */}

      <div>
        <span className="mb-2 block text-[10px] font-semibold text-black/30 lg:hidden">
          Version
        </span>

        <p
          style={{
            fontFamily:
              DISPLAY_FONT,
          }}
          className="text-[22px] font-semibold text-black/70"
        >
          V{quote.currentVersionNumber || 1}
        </p>
      </div>

      {/* STATUS */}

      <div>
        <span className="mb-2 block text-[10px] font-semibold text-black/30 lg:hidden">
          Status
        </span>

        <QuoteStatus
          status={quote.status}
        />
      </div>

      {/* ACTION */}

      <Link
        to={`/account/corporate/quotes/${quote._id}`}
        className="quote-link w-fit text-[11px] font-extrabold uppercase tracking-[0.08em] text-black/55 lg:justify-self-end"
      >
        Review
        <span className="text-[15px]">→</span>
      </Link>
    </div>
  </article>
);

/* =========================================================
   STATUS
========================================================= */

const QuoteStatus = ({
  status,
}) => {
  const value =
    normalizeStatus(status);

  let dot =
    "bg-[#C49A2B]";

  let color =
    "text-[#916B17]";

  if (
    value.includes("accepted") ||
    value.includes("paid") ||
    value.includes("completed")
  ) {
    dot =
      "bg-emerald-500";

    color =
      "text-emerald-700";
  } else if (
    value.includes("rejected") ||
    value.includes("expired") ||
    value.includes("cancel")
  ) {
    dot =
      "bg-red-500";

    color =
      "text-red-600";
  } else if (
    value.includes("sent") ||
    value.includes("review")
  ) {
    dot =
      "bg-blue-500";

    color =
      "text-blue-700";
  } else if (
    value.includes("change") ||
    value.includes("draft") ||
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
        ).replace(
          /[_-]/g,
          " "
        )}
      </span>
    </div>
  );
};

/* =========================================================
   EMPTY
========================================================= */

const EmptyQuotes = () => (
  <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden border-b border-black/[0.09] text-center">
    <span
      style={{
        fontFamily:
          DISPLAY_FONT,
      }}
      className="pointer-events-none absolute text-[260px] font-semibold italic leading-none text-[#C49A2B]/[0.04]"
    >
      Q
    </span>

    <div className="relative z-10">
      <h2
        style={{
          fontFamily:
            DISPLAY_FONT,
        }}
        className="text-[42px] font-semibold tracking-[-0.035em]"
      >
        No quotations{" "}
        <span className="italic text-[#A77B1D]">
          yet.
        </span>
      </h2>

      <p className="mx-auto mt-3 max-w-[430px] text-[12px] leading-6 text-black/38">
        Your quotation will appear here after HAMPORIUM reviews a submitted bulk request.
      </p>

      <Link
        to="/account/corporate/rfqs"
        className="quote-link mt-7 text-[12px] font-extrabold uppercase tracking-[0.08em]"
      >
        View requests
        <span>→</span>
      </Link>
    </div>
  </div>
);
 
/* =========================================================
   LOADING
========================================================= */

const QuotesLoading = () => (
  <div>
    {[1, 2, 3].map(
      (item) => (
        <div
          key={item}
          className="grid min-h-[145px] animate-pulse gap-6 border-b border-black/[0.07] py-8 lg:grid-cols-[190px_1.5fr_120px_160px_80px]"
        >
          <div>
            <div className="h-3 w-32 bg-black/[0.04]" />
            <div className="mt-4 h-3 w-24 bg-black/[0.03]" />
          </div>

          <div>
            <div className="h-8 w-72 max-w-full bg-black/[0.05]" />
            <div className="mt-4 h-3 w-32 bg-black/[0.035]" />
          </div>

          <div className="h-6 w-10 bg-black/[0.04]" />
          <div className="h-4 w-20 bg-black/[0.035]" />
          <div className="h-4 w-16 bg-black/[0.035]" />
        </div>
      )
    )}
  </div>
);

export default Quotes;
