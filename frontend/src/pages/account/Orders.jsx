import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";
import { downloadOrderInvoice } from "../../utils/invoice.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const TABS = [
  { label: "All Orders", value: "all" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const getApiOrigin = () => {
  const baseURL = api.defaults?.baseURL || "";
  return baseURL.replace(/\/api\/?$/, "").replace(/\/$/, "");
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

  if (!image || typeof image !== "string") return "";

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:") ||
    image.startsWith("blob:")
  ) {
    return image;
  }

  if (image.startsWith("//")) return `https:${image}`;

  return API_ORIGIN
    ? `${API_ORIGIN}${image.startsWith("/") ? "" : "/"}${image}`
    : image;
};

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");

const formatExpectedDelivery = (value) => {
  if (!value) return "—";
  return formatDate(value);
};

const getFirstItem = (order) => order?.items?.[0] || null;

const getItemName = (item) =>
  item?.product?.name ||
  item?.name ||
  item?.productName ||
  "HAMPORIUM Order";

const getItemSlug = (item) =>
  item?.product?.slug || item?.slug || "";

const getItemImage = (item) => {
  if (!item) return "";

  const productImages = item?.product?.images;

  return resolveImage(
    (Array.isArray(productImages) ? productImages[0] : null) ||
      item?.product?.image ||
      item?.image ||
      item?.thumbnail
  );
};

const matchesTab = (status, tab) => {
  if (tab === "all") return true;

  const normalized = normalizeStatus(status);

  if (tab === "processing") {
    return [
      "processing",
      "confirmed",
      "pending",
      "placed",
    ].some((value) => normalized.includes(value));
  }

  if (tab === "shipped") {
    return [
      "shipped",
      "dispatched",
      "in transit",
      "out for delivery",
    ].some((value) => normalized.includes(value));
  }

  return normalized.includes(tab);
};

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
        const response = await api.get("/orders/my-orders");
        if (active) setOrders(response.data.orders || []);
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load orders"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadOrders();

    return () => {
      active = false;
    };
  }, []);

  const visibleOrders = useMemo(() => {
    const filtered = orders.filter((order) =>
      matchesTab(order.status, activeTab)
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }

      if (sortBy === "high") {
        return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
      }

      if (sortBy === "low") {
        return Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
      }

      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [orders, activeTab, sortBy]);

  if (loading) return <OrdersLoading />;

  return (
    <div
      className="mx-auto w-full max-w-[1420px] pb-12 text-[#171717]"
      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
            Account Orders
          </p>
          <h1
            style={{ fontFamily: DISPLAY_FONT }}
            className="mt-2 text-[42px] font-semibold leading-none tracking-[-0.035em] sm:text-[48px]"
          >
            My Orders
          </h1>
          <p className="mt-3 text-[12px] font-medium text-black/40">
            Track production, delivery, invoices and service requests from one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/account/support"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-black/10 px-4 text-[10px] font-extrabold uppercase tracking-[0.06em] transition hover:border-[#F97316] hover:text-[#F97316]"
          >
            Help & Support
          </Link>
          <Link
            to="/account/refunds"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-black/10 px-4 text-[10px] font-extrabold uppercase tracking-[0.06em] transition hover:border-[#F97316] hover:text-[#F97316]"
          >
            Refunds
          </Link>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-4 border-b border-black/[0.07] sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const active = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`relative shrink-0 pb-4 text-[11px] font-bold transition ${
                  active
                    ? "text-[#F97316]"
                    : "text-black/40 hover:text-[#171717]"
                }`}
              >
                {tab.label}
                <span
                  className={`absolute bottom-0 left-0 h-[2px] transition-all ${
                    active
                      ? "w-full bg-[#F97316]"
                      : "w-0 bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="pb-3">
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="h-[40px] rounded-[9px] border border-black/[0.08] bg-white px-3 text-[10px] font-bold text-black/55 outline-none transition focus:border-[#F97316]"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="high">Price: High to Low</option>
            <option value="low">Price: Low to High</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">
          {error}
        </div>
      )}

      {!orders.length ? (
        <EmptyOrders />
      ) : !visibleOrders.length ? (
        <div className="py-20 text-center">
          <p className="text-[12px] font-semibold text-black/35">
            No orders found in this section.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {visibleOrders.map((order) => (
            <OrderCard key={order._id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
};

const OrderCard = ({ order }) => {
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");

  const firstItem = getFirstItem(order);
  const totalItems =
    order.items?.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    ) || 0;

  const itemName = getItemName(firstItem);
  const itemImage = getItemImage(firstItem);
  const itemSlug = getItemSlug(firstItem);
  const extraItems = Math.max((order.items?.length || 0) - 1, 0);
  const status = normalizeStatus(order.status);
  const paymentStatus = normalizeStatus(order.paymentStatus);

  const delivered = status.includes("delivered");
  const cancelled = status.includes("cancelled");
  const trackable = !cancelled && [
    "processing",
    "confirmed",
    "pending",
    "placed",
    "shipped",
    "dispatched",
    "in transit",
    "out for delivery",
  ].some((value) => status.includes(value));

  const invoiceAvailable = [
    "paid",
    "captured",
    "completed",
    "success",
    "successful",
    "partially refunded",
    "refunded",
  ].some((value) => paymentStatus.includes(value));

  const handleInvoiceDownload = async () => {
    setInvoiceDownloading(true);
    setInvoiceError("");

    try {
      await downloadOrderInvoice({
        orderId: order._id,
        orderNumber: order.orderNumber,
      });
    } catch (requestError) {
      setInvoiceError(
        requestError.message || "Unable to download invoice"
      );
    } finally {
      setInvoiceDownloading(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-[20px] border border-black/[0.07] bg-white shadow-[0_5px_18px_rgba(23,23,23,.025)]">
      <div className="relative grid gap-5 border-b border-black/[0.06] px-5 py-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_.95fr_1fr_.9fr_30px] lg:items-center lg:px-6">
        <OrderMeta label="Order ID" value={order.orderNumber} strong />
        <OrderMeta label="Placed on" value={formatDate(order.createdAt)} />
        <OrderMeta label="Total" value={formatCurrency(order.totalAmount)} strong />
        <OrderMeta
          label="Expected Delivery"
          value={formatExpectedDelivery(order.deliveryDate)}
          accent={Boolean(order.deliveryDate)}
        />

        <div>
          <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
            Status
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={order.status} />
            {order.cancellation?.status &&
              order.cancellation.status !== "none" && (
                <StatusBadge
                  status={order.cancellation.status}
                  label={`Cancellation ${order.cancellation.status}`}
                />
              )}
          </div>
        </div>

        <Link
          to={`/account/orders/${order._id}`}
          aria-label={`View ${order.orderNumber}`}
          className="hidden h-8 w-8 items-center justify-center text-black/30 transition hover:translate-x-1 hover:text-[#F97316] lg:flex"
        >
          <ChevronIcon />
        </Link>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <div className="flex h-[92px] w-[118px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#F7F4EF]">
            {itemImage ? (
              <img
                src={itemImage}
                alt={itemName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[#F97316]">
                <GiftIcon />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-extrabold tracking-[-0.01em] text-[#171717] sm:text-[15px]">
              {itemName}
            </h2>
            <p className="mt-2 text-[10px] font-medium text-black/35">
              {totalItems} item{totalItems !== 1 ? "s" : ""}
            </p>
            {extraItems > 0 && (
              <p className="mt-1 text-[9px] font-medium text-black/30">
                +{extraItems} more product{extraItems !== 1 ? "s" : ""}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <PaymentStatus status={order.paymentStatus} />
              {order.checkoutMode === "quote" && (
                <span className="rounded-full bg-[#FFF1E8] px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.05em] text-[#F97316]">
                  Quote Order
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-[520px] sm:justify-end">
          {delivered && (
            <Link
              to={itemSlug ? `/products/${itemSlug}#reviews` : "/account/reviews"}
              className="inline-flex h-[42px] items-center justify-center rounded-[8px] border border-[#D4AF37]/55 bg-[#FFF9F2] px-4 text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#8D6C18] transition hover:bg-[#D4AF37] hover:text-[#171717]"
            >
              Rate & Review
            </Link>
          )}

          {delivered && (
            <Link
              to={itemSlug ? `/products/${itemSlug}` : "/gifts"}
              className="inline-flex h-[42px] items-center justify-center rounded-[8px] border border-[#F97316]/45 px-4 text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#F97316] transition hover:bg-[#F97316] hover:text-white"
            >
              Buy Again
            </Link>
          )}

          {trackable && (
            <Link
              to={`/account/orders/${order._id}`}
              className="inline-flex h-[42px] items-center justify-center rounded-[8px] border border-[#F97316]/45 px-4 text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#F97316] transition hover:bg-[#F97316] hover:text-white"
            >
              Track Order
            </Link>
          )}

          <Link
            to={`/account/support?orderId=${encodeURIComponent(order._id)}`}
            className="inline-flex h-[42px] items-center justify-center rounded-[8px] border border-black/[0.1] px-4 text-[9px] font-extrabold uppercase tracking-[0.06em] text-black/55 transition hover:border-[#171717] hover:text-[#171717]"
          >
            Need Help?
          </Link>

          {invoiceAvailable && (
            <button
              type="button"
              onClick={handleInvoiceDownload}
              disabled={invoiceDownloading}
              className="inline-flex h-[42px] items-center justify-center rounded-[8px] border border-[#D4AF37]/50 bg-[#FFF9F2] px-4 text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#8D6C18] transition hover:border-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {invoiceDownloading ? "Downloading..." : "Invoice PDF"}
            </button>
          )}

          <Link
            to={`/account/orders/${order._id}`}
            className="inline-flex h-[42px] items-center justify-center rounded-[8px] border border-black/[0.12] bg-white px-4 text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#171717] transition hover:border-[#171717] hover:bg-[#171717] hover:text-white"
          >
            View Details
          </Link>
        </div>
      </div>

      {invoiceError && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-2.5 text-[9px] font-semibold text-red-700 lg:px-6">
          {invoiceError}
        </div>
      )}
    </article>
  );
};

const OrderMeta = ({ label, value, strong = false, accent = false }) => (
  <div className="min-w-0">
    <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
      {label}
    </p>
    <p
      className={`mt-2 truncate text-[11px] ${
        accent
          ? "font-extrabold text-[#F97316]"
          : strong
            ? "font-extrabold text-[#171717]"
            : "font-semibold text-black/60"
      }`}
    >
      {value || "—"}
    </p>
  </div>
);

const PaymentStatus = ({ status }) => {
  const value = normalizeStatus(status);
  const paid = [
    "paid",
    "captured",
    "completed",
    "success",
    "successful",
    "partially refunded",
    "refunded",
  ].some((item) => value.includes(item));

  if (paid) {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.05em] text-emerald-700">
        {value.includes("refund") ? "Paid / Refund" : "Paid"}
      </span>
    );
  }

  return <StatusBadge status={status} />;
};

const EmptyOrders = () => (
  <div className="flex min-h-[420px] flex-col items-center justify-center border-b border-black/[0.07] px-6 text-center">
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF1E8] text-[#F97316]">
      <GiftIcon />
    </span>
    <h2
      style={{ fontFamily: DISPLAY_FONT }}
      className="mt-5 text-[30px] font-semibold"
    >
      No orders yet
    </h2>
    <p className="mt-2 max-w-md text-sm text-black/40">
      Your paid retail and quote orders will appear here with their live delivery progress.
    </p>
    <Link
      to="/gifts"
      className="mt-6 inline-flex h-[44px] items-center justify-center rounded-[9px] bg-[#F97316] px-6 text-[9px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:bg-[#171717]"
    >
      Explore Gifts
    </Link>
  </div>
);

const OrdersLoading = () => (
  <div className="mx-auto w-full max-w-[1420px]">
    <div className="h-12 w-48 animate-pulse rounded-lg bg-black/[0.06]" />
    <div className="mt-3 h-3 w-64 animate-pulse rounded bg-black/[0.04]" />
    <div className="mt-8 h-[50px] animate-pulse border-b border-black/[0.06]" />
    <div className="mt-6 space-y-5">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-[220px] animate-pulse rounded-[20px] border border-black/[0.05] bg-white"
        />
      ))}
    </div>
  </div>
);

const ChevronIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
  >
    <path d="m7 4 6 6-6 6" />
  </svg>
);

const GiftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-7 w-7"
  >
    <path d="M4 10h16v10H4V10Z" />
    <path d="M3 7h18v4H3V7ZM12 7v13" />
    <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" />
  </svg>
);

export default Orders;
