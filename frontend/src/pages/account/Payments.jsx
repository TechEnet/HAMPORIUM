import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

/* =========================================================
   HELPERS
========================================================= */

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");

const getApiOrigin = () => {
  const baseURL = api.defaults?.baseURL || "";

  return baseURL
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
};

const API_ORIGIN = getApiOrigin();

const resolveImage = (value) => {
  if (!value) return "";

  let image = value;

  if (typeof image === "object") {
    image =
      image.url ||
      image.secure_url ||
      image.location ||
      image.src ||
      image.path ||
      "";
  }

  if (!image || typeof image !== "string") {
    return "";
  }

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:") ||
    image.startsWith("blob:")
  ) {
    return image;
  }

  if (image.startsWith("//")) {
    return `https:${image}`;
  }

  return API_ORIGIN
    ? `${API_ORIGIN}${image.startsWith("/") ? "" : "/"}${image}`
    : image;
};

/* =========================================================
   ORDER / PRODUCT HELPERS
========================================================= */

const getOrderItems = (payment) => {
  const items = payment?.order?.items;

  return Array.isArray(items)
    ? items
    : [];
};

const getFirstItem = (payment) =>
  getOrderItems(payment)[0] || null;

const getItemName = (item) => {
  if (!item) return "";

  return (
    item?.product?.name ||
    item?.productName ||
    item?.name ||
    item?.skuName ||
    item?.customHamper?.name ||
    ""
  );
};

const getItemImage = (item) => {
  if (!item) return "";

  const productImages =
    item?.product?.images;

  return resolveImage(
    (Array.isArray(productImages)
      ? productImages[0]
      : null) ||
      item?.product?.image ||
      item?.image ||
      item?.thumbnail ||
      ""
  );
};

const getPaymentProductName = (payment) => {
  const firstItem =
    getFirstItem(payment);

  const itemName =
    getItemName(firstItem);

  if (itemName) {
    return itemName;
  }

  return (
    payment?.order?.hamperName ||
    payment?.order?.productName ||
    payment?.productName ||
    "HAMPORIUM Order"
  );
};

const getExtraItemCount = (payment) => {
  const items =
    getOrderItems(payment);

  return Math.max(
    items.length - 1,
    0
  );
};

/* =========================================================
   PAYMENTS
========================================================= */

const Payments = () => {
  const [
    payments,
    setPayments,
  ] = useState([]);

  const [
    pagination,
    setPagination,
  ] = useState(null);

  const [page, setPage] =
    useState(1);

  const [
    status,
    setStatus,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let active = true;

    const loadPayments =
      async () => {
        setLoading(true);
        setError("");

        try {
          const params =
            new URLSearchParams({
              page: String(page),
              limit: "10",
            });

          if (status) {
            params.set(
              "status",
              status
            );
          }

          const response =
            await api.get(
              `/payments/my-payments?${params.toString()}`
            );

          if (!active) {
            return;
          }

          setPayments(
            response.data
              .payments || []
          );

          setPagination(
            response.data
              .pagination ||
              null
          );
        } catch (
          requestError
        ) {
          if (!active) {
            return;
          }

          setError(
            requestError
              .response
              ?.data
              ?.message ||
              "Unable to load payments"
          );
        } finally {
          if (active) {
            setLoading(
              false
            );
          }
        }
      };

    void loadPayments();

    return () => {
      active = false;
    };
  }, [page, status]);

  return (
    <main
      className="
        payments-page
        mx-auto
        w-full
        max-w-[1420px]
        pb-16
        text-[#181715]
      "
      style={{
        fontFamily:
          "'Manrope', Arial, sans-serif",
      }}
    >
      <style>{`
        .payments-page {
          --pay-orange: #F47822;
          --pay-gold: #C59A2A;
          --pay-dark-gold: #936B13;
          --pay-ink: #181715;
          --pay-line: rgba(24, 23, 21, .09);
        }

        .payments-heading {
          position: relative;
          isolation: isolate;
        }

        .payments-heading::after {
          content: "₹";

          position: absolute;

          right: 2%;
          top: -38px;

          z-index: -1;

          font-family: ${DISPLAY_FONT};
          font-size: clamp(
            150px,
            18vw,
            270px
          );

          font-style: italic;
          font-weight: 600;

          line-height: 1;

          color:
            rgba(
              197,
              154,
              42,
              .045
            );

          pointer-events: none;
        }

        .payments-gold {
          background:
            linear-gradient(
              125deg,
              #936B13,
              #D1AA3C 48%,
              #A67712
            );

          -webkit-background-clip:
            text;

          background-clip:
            text;

          color: transparent;
        }

        /* ================================================
           PAYMENT ROW
        ================================================ */

        .payment-row {
          position: relative;
          isolation: isolate;
        }

        .payment-row::before {
          content: "";

          position: absolute;
          inset: 0;

          z-index: -1;

          background:
            linear-gradient(
              90deg,
              rgba(
                244,
                120,
                34,
                .025
              ),
              rgba(
                197,
                154,
                42,
                .018
              ),
              transparent 75%
            );

          opacity: 0;

          transition:
            opacity .35s ease;
        }

        .payment-row:hover::before {
          opacity: 1;
        }

        /* ================================================
           IMAGE
        ================================================ */

        .payment-image {
          position: relative;
          overflow: hidden;

          background:
            linear-gradient(
              145deg,
              #F3EEE6,
              #FBF8F3
            );
        }

        .payment-image::after {
          content: "";

          position: absolute;
          inset: 0;

          border:
            1px solid
            rgba(
              24,
              23,
              21,
              .055
            );

          pointer-events: none;
        }

        .payment-image img {
          transition:
            transform .75s
            cubic-bezier(
              .16,
              1,
              .3,
              1
            );
        }

        .payment-row:hover
        .payment-image img {
          transform:
            scale(1.045);
        }

        /* ================================================
           LINKS
        ================================================ */

        .text-link {
          position: relative;

          display: inline-flex;
          align-items: center;

          gap: 8px;

          transition:
            color .28s ease,
            transform .32s
            cubic-bezier(
              .22,
              1,
              .36,
              1
            );
        }

        .text-link::after {
          content: "";

          position: absolute;

          left: 0;
          bottom: -5px;

          width: 0;
          height: 1px;

          background:
            linear-gradient(
              90deg,
              var(--pay-orange),
              var(--pay-gold)
            );

          transition:
            width .35s
            cubic-bezier(
              .22,
              1,
              .36,
              1
            );
        }

        .text-link:hover {
          color:
            var(--pay-orange);

          transform:
            translateX(2px);
        }

        .text-link:hover::after {
          width: 100%;
        }

        .payment-arrow {
          transition:
            transform .35s
            cubic-bezier(
              .22,
              1,
              .36,
              1
            );
        }

        .text-link:hover
        .payment-arrow {
          transform:
            translateX(4px);
        }

        .payment-name {
          transition:
            color .3s ease;
        }

        .payment-name:hover {
          color:
            var(--pay-dark-gold);
        }

        @media (
          max-width: 767px
        ) {
          .payments-heading::after {
            right: -20px;
            top: 0;

            font-size:
              180px;
          }
        }

        @media (
          prefers-reduced-motion:
          reduce
        ) {
          .payment-row::before,
          .payment-image img,
          .text-link,
          .text-link::after,
          .payment-arrow,
          .payment-name {
            transition:
              none !important;
          }
        }
      `}</style>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header
        className="
          payments-heading
          border-b
          border-black/[0.09]
          pb-7
        "
      >
        <div
          className="
            flex
            flex-col
            gap-6

            sm:flex-row
            sm:items-end
            sm:justify-between
          "
        >
          <div>
            <p
              className="
                text-[11px]
                font-bold
                uppercase
                tracking-[0.16em]
                text-[#9A7117]
              "
            >
              Payment History
            </p>

            <h1
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="
                mt-2
                text-[56px]
                font-semibold
                leading-[0.88]
                tracking-[-0.055em]

                sm:text-[70px]
              "
            >
              My{" "}

              <span
                className="
                  payments-gold
                  italic
                "
              >
                Payments.
              </span>
            </h1>
          </div>

          <div
            className="
              flex
              flex-wrap
              items-end
              gap-7
            "
          >
            <Link
              to="/account/refunds"
              className="
                text-link
                text-[11px]
                font-bold
                uppercase
                tracking-[0.08em]
                text-black/45
              "
            >
              Refunds

              <span>
                ↗
              </span>
            </Link>

            <label>
              <span
                className="
                  mb-1
                  block
                  text-[10px]
                  font-semibold
                  text-black/35
                "
              >
                Status
              </span>

              <select
                value={status}
                onChange={(
                  event
                ) => {
                  setStatus(
                    event.target
                      .value
                  );

                  setPage(1);
                }}
                className="
                  h-10
                  min-w-[165px]
                  border-0
                  border-b
                  border-black/[0.16]
                  bg-transparent
                  px-0
                  text-[12px]
                  font-semibold
                  text-black/65
                  outline-none

                  focus:border-[#F47822]
                "
              >
                <option value="">
                  All payments
                </option>

                <option value="created">
                  Created
                </option>

                <option value="authorized">
                  Authorized
                </option>

                <option value="captured">
                  Captured
                </option>

                <option value="failed">
                  Failed
                </option>

                <option value="partially_refunded">
                  Partially refunded
                </option>

                <option value="refunded">
                  Refunded
                </option>
              </select>
            </label>
          </div>
        </div>
      </header>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <p
          className="
            mt-5
            border-l-2
            border-red-500
            pl-4
            text-[12px]
            font-semibold
            text-red-600
          "
        >
          {error}
        </p>
      )}

      {/* =====================================================
          PAYMENTS
      ===================================================== */}

      {loading ? (
        <PaymentsLoading />
      ) : !payments.length ? (
        <EmptyPayments />
      ) : (
        <section>
          {payments.map(
            (payment) => (
              <PaymentRow
                key={
                  payment._id
                }
                payment={
                  payment
                }
              />
            )
          )}
        </section>
      )}

      {/* =====================================================
          PAGINATION
      ===================================================== */}

      {pagination &&
        pagination.totalPages >
          1 && (
          <div
            className="
              mt-8
              flex
              items-center
              justify-between
              border-t
              border-black/[0.09]
              pt-6
            "
          >
            <button
              type="button"
              disabled={
                !pagination.hasPreviousPage
              }
              onClick={() =>
                setPage(
                  (value) =>
                    value - 1
                )
              }
              className="
                text-link
                text-[11px]
                font-bold
                uppercase
                tracking-[0.08em]
                text-black/50

                disabled:pointer-events-none
                disabled:opacity-25
              "
            >
              ← Previous
            </button>

            <span
              className="
                text-[11px]
                font-semibold
                text-black/35
              "
            >
              {
                pagination.page
              }{" "}
              /{" "}
              {
                pagination.totalPages
              }
            </span>

            <button
              type="button"
              disabled={
                !pagination.hasNextPage
              }
              onClick={() =>
                setPage(
                  (value) =>
                    value + 1
                )
              }
              className="
                text-link
                text-[11px]
                font-bold
                uppercase
                tracking-[0.08em]
                text-black/50

                disabled:pointer-events-none
                disabled:opacity-25
              "
            >
              Next →
            </button>
          </div>
        )}
    </main>
  );
};

/* =========================================================
   PAYMENT ROW
========================================================= */

const PaymentRow = ({
  payment,
}) => {
  const firstItem =
    getFirstItem(payment);

  const productName =
    getPaymentProductName(
      payment
    );

  const productImage =
    getItemImage(firstItem);

  const extraItems =
    getExtraItemCount(
      payment
    );

  const refunded =
    Number(
      payment.refundedAmount ||
        0
    ) > 0;

  const orderNumber =
    payment.order
      ?.orderNumber ||
    payment.receipt ||
    "Payment";

  return (
    <article
      className="
        payment-row
        border-b
        border-black/[0.09]
        py-8

        lg:py-9
      "
    >
      <div
        className="
          grid
          gap-6

          md:grid-cols-[110px_minmax(250px,1.4fr)_minmax(160px,.75fr)_auto]
          md:items-center
          md:gap-8

          lg:grid-cols-[130px_minmax(300px,1.5fr)_minmax(180px,.75fr)_auto]
        "
      >
        {/* ===============================================
            IMAGE
        =============================================== */}

        <Link
          to={
            payment.order?._id
              ? `/account/orders/${payment.order._id}`
              : `/account/payments/${payment._id}`
          }
          className="
            payment-image
            block
            h-[150px]
            w-full

            sm:h-[130px]
            sm:w-[170px]

            md:h-[100px]
            md:w-[110px]

            lg:h-[110px]
            lg:w-[130px]
          "
        >
          {productImage ? (
            <img
              src={
                productImage
              }
              alt={
                productName
              }
              className="
                h-full
                w-full
                object-cover
              "
            />
          ) : (
            <div
              className="
                flex
                h-full
                w-full
                items-center
                justify-center
              "
            >
              <span
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="
                  text-[38px]
                  font-semibold
                  italic
                  text-[#C59A2A]
                "
              >
                H
              </span>
            </div>
          )}
        </Link>

        {/* ===============================================
            PRODUCT / HAMPER
        =============================================== */}

        <div
          className="
            min-w-0
          "
        >
          <p
            className="
              text-[11px]
              font-semibold
              text-[#936B13]
            "
          >
            {orderNumber}
          </p>

          <Link
            to={
              payment.order?._id
                ? `/account/orders/${payment.order._id}`
                : `/account/payments/${payment._id}`
            }
          >
            <h2
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="
                payment-name
                mt-2
                max-w-[540px]
                text-[27px]
                font-semibold
                leading-[1]
                tracking-[-0.025em]

                sm:text-[30px]
              "
            >
              {productName}
            </h2>
          </Link>

          <div
            className="
              mt-3
              flex
              flex-wrap
              items-center
              gap-x-3
              gap-y-2
            "
          >
            <p
              className="
                text-[11px]
                font-medium
                text-black/40
              "
            >
              {formatDate(
                payment.createdAt,
                true
              )}
            </p>

            {extraItems >
              0 && (
              <>
                <span className="text-black/20">
                  •
                </span>

                <p
                  className="
                    text-[11px]
                    font-semibold
                    text-black/40
                  "
                >
                  +
                  {
                    extraItems
                  }{" "}
                  more{" "}
                  {extraItems ===
                  1
                    ? "item"
                    : "items"}
                </p>
              </>
            )}
          </div>

          <div
            className="
              mt-3
              flex
              flex-wrap
              items-center
              gap-x-5
              gap-y-2
            "
          >
            <PaymentStatusText
              status={
                payment.status
              }
            />

            {payment.method && (
              <p
                className="
                  text-[12px]
                  font-semibold
                  capitalize
                  text-black/45
                "
              >
                {String(
                  payment.method
                ).replace(
                  /[_-]/g,
                  " "
                )}
              </p>
            )}
          </div>
        </div>

        {/* ===============================================
            AMOUNT
        =============================================== */}

        <div>
          <p
            className="
              text-[10px]
              font-semibold
              text-black/35
            "
          >
            Amount
          </p>

          <p
            style={{
              fontFamily:
                DISPLAY_FONT,
            }}
            className="
              mt-1
              text-[30px]
              font-semibold
              tracking-[-0.025em]
              text-[#181715]
            "
          >
            {formatCurrency(
              payment.amount
            )}
          </p>

          {refunded && (
            <p
              className="
                mt-2
                text-[12px]
                font-semibold
                text-[#F47822]
              "
            >
              {formatCurrency(
                payment.refundedAmount
              )}{" "}
              refunded
            </p>
          )}
        </div>

        {/* ===============================================
            DETAILS
        =============================================== */}

        <Link
          to={`/account/payments/${payment._id}`}
          className="
            text-link
            w-fit
            text-[11px]
            font-extrabold
            uppercase
            tracking-[0.08em]
            text-black/55
          "
        >
          Details

          <span
            className="
              payment-arrow
              text-[16px]
            "
          >
            →
          </span>
        </Link>
      </div>
    </article>
  );
};

/* =========================================================
   PAYMENT STATUS
========================================================= */

const PaymentStatusText = ({
  status,
}) => {
  const value =
    normalizeStatus(status);

  let dot =
    "bg-[#C59A2A]";

  let text =
    "text-[#936B13]";

  if (
    value.includes(
      "captured"
    ) ||
    value.includes(
      "paid"
    ) ||
    value.includes(
      "success"
    )
  ) {
    dot =
      "bg-emerald-500";

    text =
      "text-emerald-700";
  } else if (
    value.includes(
      "failed"
    )
  ) {
    dot =
      "bg-red-500";

    text =
      "text-red-600";
  } else if (
    value.includes(
      "authorized"
    )
  ) {
    dot =
      "bg-blue-500";

    text =
      "text-blue-700";
  } else if (
    value.includes(
      "refund"
    )
  ) {
    dot =
      "bg-[#F47822]";

    text =
      "text-[#C75D11]";
  }

  return (
    <div
      className="
        flex
        items-center
        gap-2
      "
    >
      <span
        className={`
          h-[7px]
          w-[7px]
          shrink-0
          rounded-full
          ${dot}
        `}
      />

      <span
        className={`
          text-[12px]
          font-bold
          capitalize
          ${text}
        `}
      >
        {String(
          status ||
            "Pending"
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

const EmptyPayments = () => (
  <div
    className="
      relative
      flex
      min-h-[420px]
      items-center
      justify-center
      overflow-hidden
      border-b
      border-black/[0.09]
      text-center
    "
  >
    <span
      style={{
        fontFamily:
          DISPLAY_FONT,
      }}
      className="
        pointer-events-none
        absolute
        text-[260px]
        font-semibold
        italic
        leading-none
        text-[#C59A2A]/[0.04]
      "
    >
      ₹
    </span>

    <div
      className="
        relative
        z-10
      "
    >
      <h2
        style={{
          fontFamily:
            DISPLAY_FONT,
        }}
        className="
          text-[42px]
          font-semibold
          tracking-[-0.035em]
        "
      >
        No payments{" "}

        <span
          className="
            italic
            text-[#A87C1D]
          "
        >
          yet.
        </span>
      </h2>

      <Link
        to="/gifts"
        className="
          text-link
          mt-7
          text-[12px]
          font-extrabold
          uppercase
          tracking-[0.08em]
        "
      >
        Explore gifts

        <span>
          →
        </span>
      </Link>
    </div>
  </div>
);

/* =========================================================
   LOADING
========================================================= */

const PaymentsLoading = () => (
  <div>
    {[1, 2, 3, 4].map(
      (item) => (
        <div
          key={item}
          className="
            grid
            min-h-[150px]
            animate-pulse
            gap-6
            border-b
            border-black/[0.07]
            py-8

            md:grid-cols-[130px_1fr_180px_80px]
          "
        >
          <div
            className="
              h-[110px]
              bg-black/[0.045]
            "
          />

          <div>
            <div
              className="
                h-3
                w-36
                bg-black/[0.04]
              "
            />

            <div
              className="
                mt-4
                h-8
                w-72
                max-w-full
                bg-black/[0.055]
              "
            />

            <div
              className="
                mt-4
                h-3
                w-40
                bg-black/[0.035]
              "
            />
          </div>

          <div
            className="
              h-9
              w-36
              bg-black/[0.045]
            "
          />

          <div
            className="
              h-3
              w-16
              bg-black/[0.04]
            "
          />
        </div>
      )
    )}
  </div>
);

export default Payments;