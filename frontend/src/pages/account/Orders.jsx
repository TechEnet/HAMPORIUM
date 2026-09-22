import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";
import { downloadOrderInvoice } from "../../utils/invoice.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const TABS = [
  { label: "All", value: "all" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

/* =========================================================
   IMAGE HELPERS
========================================================= */

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
   ORDER HELPERS
========================================================= */

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");

const getFirstItem = (order) => order?.items?.[0] || null;

const getItemName = (item) =>
  item?.product?.name ||
  item?.name ||
  item?.productName ||
  "HAMPORIUM Order";

const getItemSlug = (item) =>
  item?.product?.slug ||
  item?.slug ||
  "";

const getItemImage = (item) => {
  if (!item) return "";

  const productImages = item?.product?.images;

  return resolveImage(
    (Array.isArray(productImages)
      ? productImages[0]
      : null) ||
      item?.product?.image ||
      item?.image ||
      item?.thumbnail
  );
};

const matchesTab = (status, tab) => {
  if (tab === "all") {
    return true;
  }

  const normalized =
    normalizeStatus(status);

  if (tab === "processing") {
    return [
      "processing",
      "confirmed",
      "pending",
      "placed",
    ].some((value) =>
      normalized.includes(value)
    );
  }

  if (tab === "shipped") {
    return [
      "shipped",
      "dispatched",
      "in transit",
      "out for delivery",
    ].some((value) =>
      normalized.includes(value)
    );
  }

  return normalized.includes(tab);
};

/* =========================================================
   PAGE
========================================================= */

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadOrders = async () => {
      try {
        const response =
          await api.get("/orders/my-orders");

        if (active) {
          setOrders(
            response.data.orders || []
          );
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load orders"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      active = false;
    };
  }, []);

  const visibleOrders = useMemo(() => {
    const filtered = orders.filter((order) =>
      matchesTab(
        order.status,
        activeTab
      )
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === "oldest") {
        return (
          new Date(a.createdAt) -
          new Date(b.createdAt)
        );
      }

      if (sortBy === "high") {
        return (
          Number(b.totalAmount || 0) -
          Number(a.totalAmount || 0)
        );
      }

      if (sortBy === "low") {
        return (
          Number(a.totalAmount || 0) -
          Number(b.totalAmount || 0)
        );
      }

      return (
        new Date(b.createdAt) -
        new Date(a.createdAt)
      );
    });
  }, [
    orders,
    activeTab,
    sortBy,
  ]);

  if (loading) {
    return <OrdersLoading />;
  }

  return (
    <main
      className="
        orders-page
        mx-auto
        w-full
        max-w-[1460px]
        pb-16
        text-[#181715]
      "
      style={{
        fontFamily:
          "'Manrope', Arial, sans-serif",
      }}
    >
      <style>{`
        .orders-page {
          --orange: #F47822;
          --gold: #C79824;
          --deep-gold: #967019;
          --ink: #181715;
          --muted: rgba(24, 23, 21, .48);
          --line: rgba(24, 23, 21, .09);
        }

        .orders-header {
          position: relative;
          isolation: isolate;
        }

        .orders-header::after {
          content: "H";
          position: absolute;
          right: 2%;
          top: -48px;
          z-index: -1;

          font-family: ${DISPLAY_FONT};
          font-size: clamp(150px, 17vw, 270px);
          font-style: italic;
          line-height: 1;

          color: rgba(199, 152, 36, .045);
          pointer-events: none;
        }

        .orders-gold {
          background:
            linear-gradient(
              120deg,
              #9D7419 0%,
              #D6AF42 48%,
              #A77A18 100%
            );

          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .orders-tab {
          position: relative;
          color: rgba(24, 23, 21, .42);

          transition:
            color .28s ease;
        }

        .orders-tab::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -1px;

          width: 0;
          height: 2px;

          background:
            linear-gradient(
              90deg,
              var(--orange),
              var(--gold)
            );

          transition:
            width .4s cubic-bezier(.22,1,.36,1);
        }

        .orders-tab:hover {
          color: var(--ink);
        }

        .orders-tab-active {
          color: var(--ink);
        }

        .orders-tab-active::after {
          width: 100%;
        }

        .order-row {
          position: relative;
          isolation: isolate;

          transition:
            transform .45s cubic-bezier(.22,1,.36,1);
        }

        .order-row::before {
          content: "";

          position: absolute;
          inset: 0;
          z-index: -1;

          background:
            linear-gradient(
              90deg,
              rgba(244,120,34,.025),
              rgba(199,152,36,.018),
              transparent 70%
            );

          opacity: 0;

          transition:
            opacity .4s ease;
        }

        .order-row:hover::before {
          opacity: 1;
        }

        .order-image {
          position: relative;
          overflow: hidden;

          background:
            linear-gradient(
              145deg,
              #F4EFE8,
              #FBF8F3
            );
        }

        .order-image::after {
          content: "";

          position: absolute;
          inset: 0;

          border:
            1px solid rgba(24,23,21,.05);

          pointer-events: none;
        }

        .order-image img {
          transition:
            transform .8s cubic-bezier(.16,1,.3,1);
        }

        .order-row:hover .order-image img {
          transform: scale(1.045);
        }

        .order-title {
          transition:
            color .3s ease;
        }

        .order-title:hover {
          color: var(--deep-gold);
        }

        .text-action {
          position: relative;

          display: inline-flex;
          align-items: center;
          gap: 7px;

          color: rgba(24,23,21,.48);

          transition:
            color .28s ease,
            transform .3s cubic-bezier(.22,1,.36,1);
        }

        .text-action::after {
          content: "";

          position: absolute;

          left: 0;
          bottom: -4px;

          width: 0;
          height: 1px;

          background:
            linear-gradient(
              90deg,
              var(--orange),
              var(--gold)
            );

          transition:
            width .35s cubic-bezier(.22,1,.36,1);
        }

        .text-action:hover {
          color: var(--orange);
          transform: translateY(-1px);
        }

        .text-action:hover::after {
          width: 100%;
        }

        .details-link {
          position: relative;

          display: inline-flex;
          align-items: center;

          gap: 11px;

          color: var(--ink);

          transition:
            color .3s ease,
            transform .35s cubic-bezier(.22,1,.36,1);
        }

        .details-link::before {
          content: "";

          position: absolute;

          left: 0;
          right: 0;
          bottom: -7px;

          height: 1px;

          background:
            var(--ink);

          transition:
            background .3s ease;
        }

        .details-link:hover {
          color: var(--orange);
          transform: translateX(3px);
        }

        .details-link:hover::before {
          background: var(--orange);
        }

        .details-arrow {
          transition:
            transform .35s cubic-bezier(.22,1,.36,1);
        }

        .details-link:hover .details-arrow {
          transform: translateX(4px);
        }

        .order-status-dot {
          width: 7px;
          height: 7px;

          border-radius: 999px;
          flex-shrink: 0;
        }

        .order-number {
          color: var(--deep-gold);
        }

        @media (max-width: 767px) {
          .orders-header::after {
            top: 5px;
            right: -20px;
            font-size: 180px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .orders-tab,
          .orders-tab::after,
          .order-row,
          .order-image img,
          .order-title,
          .text-action,
          .text-action::after,
          .details-link,
          .details-arrow {
            transition: none !important;
          }
        }
      `}</style>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header
        className="
          orders-header
          border-b
          border-black/[0.09]
          pb-7
        "
      >
        <div
          className="
            flex
            flex-col
            gap-5

            lg:flex-row
            lg:items-end
            lg:justify-between
          "
        >
          <div>
            <h1
              style={{
                fontFamily: DISPLAY_FONT,
              }}
              className="
                text-[54px]
                font-semibold
                leading-[0.88]
                tracking-[-0.055em]

                sm:text-[66px]
                lg:text-[76px]
              "
            >
              My{" "}

              <span
                className="
                  orders-gold
                  italic
                "
              >
                Orders.
              </span>
            </h1>
          </div>

          <div
            className="
              flex
              gap-7
              pb-1
            "
          >
            <Link
              to="/account/support"
              className="
                text-action
                text-[11px]
                font-bold
                uppercase
                tracking-[0.08em]
              "
            >
              Support
              <span>↗</span>
            </Link>

            <Link
              to="/account/refunds"
              className="
                text-action
                text-[11px]
                font-bold
                uppercase
                tracking-[0.08em]
              "
            >
              Refunds
              <span>↗</span>
            </Link>
          </div>
        </div>
      </header>

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section
        className="
          flex
          flex-col
          gap-5
          border-b
          border-black/[0.09]

          sm:flex-row
          sm:items-end
          sm:justify-between
        "
      >
        <div
          className="
            flex
            min-w-0
            gap-7
            overflow-x-auto

            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
          "
        >
          {TABS.map((tab) => {
            const active =
              activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() =>
                  setActiveTab(tab.value)
                }
                className={`
                  orders-tab
                  shrink-0
                  py-5
                  text-[12px]
                  font-bold

                  ${
                    active
                      ? "orders-tab-active"
                      : ""
                  }
                `}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="pb-4">
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(
                event.target.value
              )
            }
            className="
              h-10
              border-0
              border-b
              border-black/[0.15]
              bg-transparent
              px-1
              text-[11px]
              font-semibold
              text-black/55
              outline-none

              focus:border-[#F47822]
            "
          >
            <option value="newest">
              Newest first
            </option>

            <option value="oldest">
              Oldest first
            </option>

            <option value="high">
              Price: high to low
            </option>

            <option value="low">
              Price: low to high
            </option>
          </select>
        </div>
      </section>

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
          ORDERS
      ===================================================== */}

      {!orders.length ? (
        <EmptyOrders />
      ) : !visibleOrders.length ? (
        <div
          className="
            flex
            min-h-[320px]
            items-center
            justify-center
            border-b
            border-black/[0.09]
            text-center
          "
        >
          <h2
            style={{
              fontFamily:
                DISPLAY_FONT,
            }}
            className="
              text-[34px]
              font-semibold
              italic
              text-black/40
            "
          >
            No orders here.
          </h2>
        </div>
      ) : (
        <div>
          {visibleOrders.map(
            (order) => (
              <OrderRow
                key={order._id}
                order={order}
              />
            )
          )}
        </div>
      )}
    </main>
  );
};

/* =========================================================
   ORDER ROW
========================================================= */

const OrderRow = ({
  order,
}) => {
  const [
    invoiceDownloading,
    setInvoiceDownloading,
  ] = useState(false);

  const [
    invoiceError,
    setInvoiceError,
  ] = useState("");

  const firstItem =
    getFirstItem(order);

  const itemName =
    getItemName(firstItem);

  const itemImage =
    getItemImage(firstItem);

  const itemSlug =
    getItemSlug(firstItem);

  const totalItems =
    order.items?.reduce(
      (sum, item) =>
        sum +
        Number(
          item.quantity || 0
        ),
      0
    ) || 0;

  const extraItems = Math.max(
    (order.items?.length || 0) -
      1,
    0
  );

  const status =
    normalizeStatus(
      order.status
    );

  const paymentStatus =
    normalizeStatus(
      order.paymentStatus
    );

  const delivered =
    status.includes(
      "delivered"
    );

  const cancelled =
    status.includes(
      "cancelled"
    );

  const trackable =
    !cancelled &&
    [
      "processing",
      "confirmed",
      "pending",
      "placed",
      "shipped",
      "dispatched",
      "in transit",
      "out for delivery",
    ].some((value) =>
      status.includes(value)
    );

  const invoiceAvailable =
    [
      "paid",
      "captured",
      "completed",
      "success",
      "successful",
      "partially refunded",
      "refunded",
    ].some((value) =>
      paymentStatus.includes(
        value
      )
    );

  const handleInvoiceDownload =
    async () => {
      setInvoiceDownloading(true);
      setInvoiceError("");

      try {
        await downloadOrderInvoice({
          orderId: order._id,
          orderNumber:
            order.orderNumber,
        });
      } catch (
        requestError
      ) {
        setInvoiceError(
          requestError.message ||
            "Unable to download invoice"
        );
      } finally {
        setInvoiceDownloading(false);
      }
    };

  return (
    <article
      className="
        order-row
        border-b
        border-black/[0.09]
        py-8

        lg:py-10
      "
    >
      <div
        className="
          grid
          gap-6

          lg:grid-cols-[190px_minmax(250px,1.15fr)_minmax(420px,1.35fr)]
          lg:items-center
          lg:gap-10
        "
      >
        {/* =================================================
            PRODUCT IMAGE
        ================================================= */}

        <Link
          to={`/account/orders/${order._id}`}
          className="
            order-image
            block
            h-[220px]
            w-full

            sm:h-[200px]
            sm:w-[260px]

            lg:h-[150px]
            lg:w-[190px]
          "
        >
          {itemImage ? (
            <img
              src={itemImage}
              alt={itemName}
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
                text-[#B78920]
              "
            >
              <GiftIcon />
            </div>
          )}
        </Link>

        {/* =================================================
            PRODUCT INFO
        ================================================= */}

        <div
          className="
            min-w-0
          "
        >
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-x-3
              gap-y-1
            "
          >
            <span
              className="
                order-number
                text-[11px]
                font-bold
                tracking-[0.03em]
              "
            >
              {order.orderNumber}
            </span>

            <span
              className="
                text-black/20
              "
            >
              •
            </span>

            <span
              className="
                text-[11px]
                font-medium
                text-black/40
              "
            >
              {formatDate(
                order.createdAt
              )}
            </span>
          </div>

          <Link
            to={`/account/orders/${order._id}`}
          >
            <h2
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="
                order-title
                mt-3
                max-w-[560px]
                text-[32px]
                font-semibold
                leading-[0.98]
                tracking-[-0.03em]

                sm:text-[36px]
              "
            >
              {itemName}
            </h2>
          </Link>

          <p
            className="
              mt-4
              text-[12px]
              font-medium
              text-black/40
            "
          >
            {totalItems}{" "}
            item
            {totalItems !== 1
              ? "s"
              : ""}

            {extraItems > 0
              ? ` · +${extraItems} more`
              : ""}
          </p>

          {order.checkoutMode ===
            "quote" && (
            <p
              className="
                mt-3
                text-[11px]
                font-bold
                text-[#967019]
              "
            >
              Quote order
            </p>
          )}
        </div>

        {/* =================================================
            ORDER DETAILS
        ================================================= */}

        <div
          className="
            min-w-0
          "
        >
          <div
            className="
              grid
              grid-cols-2
              gap-x-8
              gap-y-6

              sm:grid-cols-4
            "
          >
            <OrderMeta
              label="Total"
              value={formatCurrency(
                order.totalAmount
              )}
              strong
            />

            <OrderMeta
              label="Delivery"
              value={
                order.deliveryDate
                  ? formatDate(
                      order.deliveryDate
                    )
                  : "—"
              }
              accent={
                Boolean(
                  order.deliveryDate
                )
              }
            />

            <StatusText
              status={order.status}
            />

            <PaymentText
              status={
                order.paymentStatus
              }
            />
          </div>

          {/* ===============================================
              ACTIONS
          =============================================== */}

          <div
            className="
              mt-7
              flex
              flex-wrap
              items-center
              gap-x-6
              gap-y-4
              border-t
              border-black/[0.07]
              pt-5
            "
          >
            {trackable && (
              <Link
                to={`/account/orders/${order._id}`}
                className="
                  text-action
                  text-[11px]
                  font-bold
                  text-[#F47822]
                "
              >
                Track order
              </Link>
            )}

            {delivered && (
              <Link
                to={
                  itemSlug
                    ? `/products/${itemSlug}`
                    : "/gifts"
                }
                className="
                  text-action
                  text-[11px]
                  font-bold
                "
              >
                Buy again
              </Link>
            )}

            {delivered && (
              <Link
                to={`/account/orders/${order._id}#review-order`}
                className="
                  text-action
                  text-[11px]
                  font-bold
                  text-[#F47822]
                "
              >
                Rate & Review
              </Link>
            )}

            {invoiceAvailable && (
              <button
                type="button"
                onClick={
                  handleInvoiceDownload
                }
                disabled={
                  invoiceDownloading
                }
                className="
                  text-action
                  text-[11px]
                  font-bold
                  text-[#967019]

                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                {invoiceDownloading
                  ? "Downloading..."
                  : "Invoice"}
              </button>
            )}

            <Link
              to={`/account/support?orderId=${encodeURIComponent(
                order._id
              )}`}
              className="
                text-action
                text-[11px]
                font-bold
              "
            >
              Help
            </Link>

            <Link
              to={`/account/orders/${order._id}`}
              className="
                details-link
                ml-auto
                text-[11px]
                font-extrabold
                uppercase
                tracking-[0.07em]
              "
            >
              View details

              <span
                className="
                  details-arrow
                  text-[16px]
                "
              >
                →
              </span>
            </Link>
          </div>
        </div>
      </div>

      {invoiceError && (
        <p
          className="
            mt-5
            text-[11px]
            font-semibold
            text-red-600

            lg:ml-[230px]
          "
        >
          {invoiceError}
        </p>
      )}
    </article>
  );
};

/* =========================================================
   META
========================================================= */

const OrderMeta = ({
  label,
  value,
  strong = false,
  accent = false,
}) => (
  <div
    className="
      min-w-0
    "
  >
    <p
      className="
        text-[10px]
        font-semibold
        text-black/35
      "
    >
      {label}
    </p>

    <p
      className={`
        mt-2
        truncate
        text-[13px]

        ${
          accent
            ? "font-bold text-[#F47822]"
            : strong
              ? "font-extrabold text-[#181715]"
              : "font-semibold text-black/65"
        }
      `}
    >
      {value || "—"}
    </p>
  </div>
);

/* =========================================================
   STATUS TEXT
========================================================= */

const StatusText = ({
  status,
}) => {
  const normalized =
    normalizeStatus(status);

  let dotClass =
    "bg-[#D4AF37]";

  let textClass =
    "text-[#8E6B1A]";

  let label =
    status || "Pending";

  if (
    normalized.includes(
      "delivered"
    )
  ) {
    dotClass =
      "bg-emerald-500";

    textClass =
      "text-emerald-700";
  } else if (
    normalized.includes(
      "cancelled"
    )
  ) {
    dotClass =
      "bg-red-500";

    textClass =
      "text-red-600";
  } else if (
    normalized.includes(
      "shipped"
    ) ||
    normalized.includes(
      "dispatch"
    ) ||
    normalized.includes(
      "transit"
    )
  ) {
    dotClass =
      "bg-blue-500";

    textClass =
      "text-blue-700";
  } else if (
    normalized.includes(
      "processing"
    ) ||
    normalized.includes(
      "confirmed"
    ) ||
    normalized.includes(
      "pending"
    ) ||
    normalized.includes(
      "placed"
    )
  ) {
    dotClass =
      "bg-[#F47822]";

    textClass =
      "text-[#C85C10]";
  }

  return (
    <div>
      <p
        className="
          text-[10px]
          font-semibold
          text-black/35
        "
      >
        Status
      </p>

      <div
        className="
          mt-2
          flex
          items-center
          gap-2
        "
      >
        <span
          className={`
            order-status-dot
            ${dotClass}
          `}
        />

        <span
          className={`
            text-[13px]
            font-bold
            capitalize
            ${textClass}
          `}
        >
          {String(label)
            .replace(
              /[_-]/g,
              " "
            )}
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   PAYMENT TEXT
========================================================= */

const PaymentText = ({
  status,
}) => {
  const normalized =
    normalizeStatus(status);

  const paid = [
    "paid",
    "captured",
    "completed",
    "success",
    "successful",
    "partially refunded",
    "refunded",
  ].some((value) =>
    normalized.includes(value)
  );

  return (
    <div>
      <p
        className="
          text-[10px]
          font-semibold
          text-black/35
        "
      >
        Payment
      </p>

      <div
        className="
          mt-2
          flex
          items-center
          gap-2
        "
      >
        <span
          className={`
            order-status-dot
            ${
              paid
                ? "bg-emerald-500"
                : "bg-[#D4AF37]"
            }
          `}
        />

        <span
          className={`
            text-[13px]
            font-bold
            capitalize

            ${
              paid
                ? "text-emerald-700"
                : "text-[#8E6B1A]"
            }
          `}
        >
          {paid
            ? normalized.includes(
                "refund"
              )
              ? "Refunded"
              : "Paid"
            : status
              ? String(status).replace(
                  /[_-]/g,
                  " "
                )
              : "Pending"}
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   EMPTY
========================================================= */

const EmptyOrders = () => (
  <div
    className="
      relative
      flex
      min-h-[460px]
      items-center
      justify-center
      overflow-hidden
      border-b
      border-black/[0.09]
      px-6
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
        text-[#D4AF37]/[0.04]
      "
    >
      H
    </span>

    <div
      className="
        relative
        z-10
      "
    >
      <GiftIcon />

      <h2
        style={{
          fontFamily:
            DISPLAY_FONT,
        }}
        className="
          mt-5
          text-[40px]
          font-semibold
          tracking-[-0.035em]
        "
      >
        No orders{" "}

        <span
          className="
            italic
            text-[#B78920]
          "
        >
          yet.
        </span>
      </h2>

      <Link
        to="/gifts"
        className="
          details-link
          mt-7
          text-[12px]
          font-extrabold
          uppercase
          tracking-[0.08em]
        "
      >
        Explore gifts

        <span
          className="
            details-arrow
            text-[16px]
          "
        >
          →
        </span>
      </Link>
    </div>
  </div>
);

/* =========================================================
   LOADING
========================================================= */

const OrdersLoading = () => (
  <div
    className="
      mx-auto
      w-full
      max-w-[1460px]
    "
  >
    <div
      className="
        h-16
        w-72
        max-w-full
        animate-pulse
        bg-black/[0.05]
      "
    />

    <div
      className="
        mt-8
        h-[60px]
        animate-pulse
        border-y
        border-black/[0.06]
      "
    />

    <div>
      {[1, 2, 3].map(
        (item) => (
          <div
            key={item}
            className="
              grid
              gap-8
              border-b
              border-black/[0.07]
              py-10

              sm:grid-cols-[190px_1fr]
            "
          >
            <div
              className="
                h-[150px]
                animate-pulse
                bg-black/[0.045]
              "
            />

            <div>
              <div
                className="
                  h-3
                  w-36
                  animate-pulse
                  bg-black/[0.04]
                "
              />

              <div
                className="
                  mt-5
                  h-10
                  w-80
                  max-w-full
                  animate-pulse
                  bg-black/[0.05]
                "
              />

              <div
                className="
                  mt-6
                  h-3
                  w-48
                  animate-pulse
                  bg-black/[0.035]
                "
              />
            </div>
          </div>
        )
      )}
    </div>
  </div>
);

/* =========================================================
   ICON
========================================================= */

const GiftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.45"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="
      mx-auto
      h-8
      w-8
      text-[#B78920]
    "
    aria-hidden="true"
  >
    <path d="M4 10h16v10H4V10Z" />

    <path d="M3 7h18v4H3V7ZM12 7v13" />

    <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" />
  </svg>
);

export default Orders;