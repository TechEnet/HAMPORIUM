import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/api.js";
import OrderTaxSummary from "../../components/OrderTaxSummary.jsx";
import ReviewForm from "../../components/reviews/ReviewForm.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";
import { downloadOrderInvoice } from "../../utils/invoice.js";

// HAMPORIUM - Professional Order Details
// Uses the existing account routes, APIs, ReviewForm, and tax / invoice helpers.
// All widths are relative to the account content area (never the full viewport).

const normalizeStatus = (value) =>
  String(value || "").trim().toLowerCase().replace(/[_-]/g, " ");

const prettyStatus = (value) => {
  const raw = normalizeStatus(value);
  return raw ? raw.replace(/\b\w/g, (char) => char.toUpperCase()) : "Pending";
};

const getStatusTone = (status) => {
  const value = normalizeStatus(status);
  if (/cancel|fail|reject/.test(value)) return "danger";
  if (/deliver|paid|captur|success|approv|refund completed/.test(value)) return "success";
  if (/ship|dispatch|transit|out for delivery/.test(value)) return "info";
  if (/process|pending|confirm|placed|request/.test(value)) return "warning";
  return "neutral";
};

const getApiOrigin = () =>
  String(api.defaults?.baseURL || "").replace(/\/api\/?$/, "").replace(/\/$/, "");

const resolveImage = (value) => {
  const image = typeof value === "object" && value !== null
    ? value.secure_url || value.url || value.src || value.path || ""
    : value;
  if (typeof image !== "string" || !image) return "";
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  if (image.startsWith("//")) return `https:${image}`;
  const base = getApiOrigin();
  return base ? `${base}${image.startsWith("/") ? "" : "/"}${image}` : image;
};

const formatAddress = (address) =>
  address
    ? [
        address.fullName,
        address.addressLine1,
        address.addressLine2,
        address.landmark,
        address.city,
        address.state,
        address.postalCode,
        address.country,
      ].filter(Boolean).join(", ") || "Not provided"
    : "Not provided";

const isCustomHamperOrderItem = (item) => {
  if (!item) return false;
  return item.itemType === "custom_hamper" ||
    Boolean(item.customHamper) ||
    String(item.skuCode || "").trim().toUpperCase() === "CUSTOM-HAMPER" ||
    String(item.productName || "").toLowerCase().includes("custom hamper") ||
    String(item.skuName || "").toLowerCase().includes("custom hamper");
};

const getReviewTarget = (item) => {
  const rawProduct = item?.product?._id || item?.product || item?.productId ||
    item?.sku?.product?._id || item?.sku?.product || "";
  const productId = typeof rawProduct === "object" ? rawProduct?._id : rawProduct;
  if (productId) return { targetType: "product", productId: String(productId) };
  if (isCustomHamperOrderItem(item)) return { targetType: "custom_hamper", productId: "" };
  return null;
};

const getReviewItemName = (item) =>
  item?.customHamper?.containerName || item?.productName || item?.product?.name ||
  item?.skuName || "Purchased item";

const iconPaths = {
  back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h12" /></>,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 17v4h14v-4" /></>,
  receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  package: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="M3 7v10l9 5 9-5V7M12 12v10" /></>,
  truck: <><path d="M3 6h12v11H3zM15 10h4l3 4v3h-7z" /><circle cx="7.5" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.8.6-1.5 1.1-1.5 2.5" /><path d="M12 17h.01" /></>,
  star: <path d="m12 2 3 6 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.9 3 1.1-6.5L2.5 8.9 9 8l3-6Z" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5 9a7 7 0 0 1 12-3l3 6M4 12l3 6a7 7 0 0 0 12-3" /></>,
  shield: <><path d="m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6l8-4Z" /><path d="m9 12 2 2 4-4" /></>,
};

const Icon = ({ name, size = 19, className = "" }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className}>
    {iconPaths[name] || iconPaths.info}
  </svg>
);

const StatusBadge = ({ status, label }) => (
  <span className={`od2-status od2-status-${getStatusTone(status)}`}>
    <span className="od2-status-dot" />
    {label ? `${label}: ` : ""}{prettyStatus(status)}
  </span>
);

const SectionHeading = ({ icon, title, action }) => (
  <div className="od2-section-heading">
    <div className="flex min-w-0 items-center gap-3">
      {icon && <span className="od2-heading-icon"><Icon name={icon} size={19} /></span>}
      <h2 className="od2-section-title">{title}</h2>
    </div>
    {action}
  </div>
);

const OrderDetails = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationWorking, setCancellationWorking] = useState(false);
  const [reviewingProductId, setReviewingProductId] = useState("");

  const loadOrder = useCallback(async () => {
    const response = await api.get(`/orders/${orderId}`);
    setOrder(response.data.order);
    return response.data.order;
  }, [orderId]);

  const loadTracking = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setTrackingLoading(true);
    try {
      const response = await api.get(`/orders/${orderId}/tracking`);
      setTracking(response.data.tracking || null);
    } catch (requestError) {
      if (requestError.response?.status !== 404) {
        console.error("Unable to load order tracking:", requestError);
      }
      if (!silent) setTracking(null);
    } finally {
      if (!silent) setTrackingLoading(false);
    }
  }, [orderId]);

  const loadRefunds = useCallback(async () => {
    try {
      const response = await api.get("/refunds/mine?limit=100");
      const list = response.data.refunds || [];
      setRefunds(list.filter((refund) =>
        String(refund.order?._id || refund.order || "") === String(orderId)
      ));
    } catch {
      setRefunds([]);
    }
  }, [orderId]);

  useEffect(() => {
    let active = true;
    setOrder(null);
    setTracking(null);
    setRefunds([]);
    setLoading(true);
    setTrackingLoading(true);
    setError("");
    setNotice("");
    api.get(`/orders/${orderId}`)
      .then((response) => { if (active) setOrder(response.data.order); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Unable to load order");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId]);

  useEffect(() => {
    if (!order?._id) return;
    void loadTracking();
    void loadRefunds();
  }, [order?._id, loadTracking, loadRefunds]);

  useEffect(() => {
    if (!order?._id) return undefined;
    const status = normalizeStatus(tracking?.customerStatus || order.status);
    if (status.includes("delivered") || status.includes("cancelled")) return undefined;
    const timer = window.setInterval(() => { void loadTracking({ silent: true }); }, 60000);
    return () => window.clearInterval(timer);
  }, [order?._id, order?.status, tracking?.customerStatus, loadTracking]);

  useEffect(() => {
    if (!order?._id || window.location.hash !== "#review-order") return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById("review-order")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [order?._id]);

  const itemCount = useMemo(() => (order?.items || []).reduce((sum, item) =>
    sum + Number(item.quantity || 0), 0), [order?.items]);

  const reviewableItems = useMemo(() => {
    const seen = new Set();
    return (order?.items || []).reduce((list, item, index) => {
      const target = getReviewTarget(item);
      if (!target) return list;
      const key = target.targetType === "product" ? `product:${target.productId}` : "custom_hamper:order";
      if (seen.has(key)) return list;
      seen.add(key);
      list.push({
        key: item?._id || `${key}-${index}`,
        ...target,
        name: getReviewItemName(item),
        image: item?.image || item?.customHamper?.containerImage || "",
      });
      return list;
    }, []);
  }, [order?.items]);

  const handleInvoiceDownload = async () => {
    if (!order?._id) return;
    setInvoiceDownloading(true);
    setInvoiceError("");
    try {
      await downloadOrderInvoice({ orderId: order._id, orderNumber: order.orderNumber });
    } catch (downloadError) {
      setInvoiceError(downloadError.message || "Unable to download invoice");
    } finally {
      setInvoiceDownloading(false);
    }
  };

  const submitCancellation = async (event) => {
    event.preventDefault();
    const reason = cancellationReason.trim();
    if (reason.length < 5) {
      setError("Please enter a cancellation reason of at least 5 characters.");
      return;
    }
    if (!window.confirm("Submit this cancellation request for admin review?")) return;
    setCancellationWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post(`/orders/${orderId}/cancellation`, { reason });
      setNotice(response.data.message || "Cancellation request submitted.");
      setCancellationReason("");
      await Promise.all([loadOrder(), loadTracking(), loadRefunds()]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to request cancellation");
    } finally {
      setCancellationWorking(false);
    }
  };

  if (loading) return <OrderDetailsLoading />;
  if (!order) return (
    <div className="od2-error-screen" role="alert">
      <Icon name="info" size={30} />
      <h1>Order details unavailable</h1>
      <p>{error || "We couldn't find this order."}</p>
      <Link to="/account/orders" className="od2-primary">Back to my orders <Icon name="arrow" size={17} /></Link>
    </div>
  );

  const paymentSuccessful = ["paid", "partially_refunded", "refunded"].includes(order.paymentStatus);
  const cancellation = order.cancellation || {};
  const customerStatus = tracking?.customerStatus || order.status;
  const delivered = normalizeStatus(customerStatus).includes("delivered") ||
    normalizeStatus(order.status).includes("delivered");
  const canRequestCancellation = ["paid", "partially_refunded"].includes(order.paymentStatus) &&
    !["shipped", "delivered", "cancelled"].includes(order.status) &&
    !["requested", "approved"].includes(cancellation.status);
  const cancellationVisible = (cancellation.status && cancellation.status !== "none") || canRequestCancellation;

  return (
    <main className="od2-root w-full min-w-0 pb-12">
      <style>{`
        .od2-root{color:#232831;font-family:'Manrope',Inter,Arial,sans-serif;font-size:14px;line-height:1.55;overflow-x:clip}
        .od2-root *{box-sizing:border-box}
        .od2-root a,.od2-root button{transition:background-color .2s,color .2s,border-color .2s,box-shadow .2s}
        .od2-root a:focus-visible,.od2-root button:focus-visible,.od2-root summary:focus-visible,.od2-root textarea:focus-visible{outline:3px solid #f4a569;outline-offset:3px}
        .od2-muted{color:#666e78}
        .od2-light{color:#7d848b}
        .od2-top{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:18px}
        .od2-simple-link{display:inline-flex;align-items:center;gap:8px;font-weight:700;color:#415064;font-size:13px;text-decoration:none}
        .od2-simple-link:hover{color:#da6b19}
        .od2-headline{font-weight:800;font-size:clamp(27px,3vw,36px);letter-spacing:-.04em;line-height:1.25;margin:0}
        .od2-id{font-size:13px;color:#5b6470;overflow-wrap:anywhere;font-weight:600}
        .od2-primary{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:#232b36;color:#fff;border:1px solid #232b36;border-radius:9px;padding:11px 17px;font-size:13px;font-weight:700;text-decoration:none;min-height:44px}
        .od2-primary:hover{background:#111820;color:#fff}
        .od2-outline{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#fff;color:#29323d;border:1px solid #dfe2e6;border-radius:9px;padding:10px 14px;font-size:13px;font-weight:700;min-height:42px;text-decoration:none}
        .od2-outline:hover{border-color:#ee9d52;color:#bb5b16;background:#fff9f3}
        .od2-outline:disabled,.od2-primary:disabled{opacity:.48;cursor:not-allowed}
        .od2-status{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:800;line-height:1.35;white-space:normal}
        .od2-status-dot{width:7px;height:7px;flex:none;border-radius:50%;background:currentColor}
        .od2-status-success{color:#116340;background:#e8f7ee}
        .od2-status-danger{color:#b42325;background:#fff0f0}
        .od2-status-info{color:#1c5ca8;background:#eaf2ff}
        .od2-status-warning{color:#9e5710;background:#fff4e3}
        .od2-status-neutral{color:#515d6b;background:#f0f1f3}
        .od2-summary{background:#f8f9fa;border:1px solid #eaeced;border-radius:12px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;padding:20px 24px;margin:22px 0 28px}
        .od2-meta-label{color:#67707a;font-size:12px;font-weight:600;margin-bottom:5px}
        .od2-meta-value{font-size:15px;font-weight:800;line-height:1.45;overflow-wrap:anywhere}
        .od2-section{min-width:0;margin-bottom:26px}
        .od2-section-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:17px}
        .od2-section-title{font-weight:800;font-size:19px;line-height:1.35;letter-spacing:-.025em;margin:0}
        .od2-heading-icon{display:inline-flex;align-items:center;justify-content:center;color:#ca6d24;background:#fff3e8;width:34px;height:34px;border-radius:9px;flex:none}
        .od2-surface{background:#fff;border:1px solid #e9ebef;border-radius:12px;padding:22px}
        .od2-content{display:grid;grid-template-columns:minmax(0,1fr) 335px;align-items:start;gap:22px}
        .od2-main-column,.od2-aside{min-width:0}
        .od2-step-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
        .od2-step{min-width:0;position:relative;padding-top:7px}
        .od2-step:not(:last-child):after{content:'';height:2px;position:absolute;top:18px;left:38px;right:-2px;background:#e7e9eb}
        .od2-step.od2-step-done:not(:last-child):after{background:#64a782}
        .od2-step-circle{width:25px;height:25px;border-radius:50%;border:2px solid #d8dde2;display:flex;align-items:center;justify-content:center;color:#7b8490;background:#fff;position:relative;z-index:1;font-size:11px;font-weight:800}
        .od2-step-done .od2-step-circle{background:#198154;border-color:#198154;color:#fff}
        .od2-step-name{font-size:12px;font-weight:800;margin-top:12px;line-height:1.5;overflow-wrap:break-word}
        .od2-step-time{font-size:11px;color:#7a818a;margin-top:4px;line-height:1.5}
        .od2-disclosure{border-top:1px solid #eef0f2;margin-top:19px;padding-top:12px}
        .od2-disclosure summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:15px;padding:6px 0;cursor:pointer;color:#415064;font-weight:700;font-size:13px}
        .od2-disclosure summary::-webkit-details-marker{display:none}
        .od2-disclosure summary svg{transition:transform .2s}
        .od2-disclosure[open] summary svg{transform:rotate(180deg)}
        .od2-item{display:grid;grid-template-columns:90px minmax(0,1fr) auto;align-items:start;gap:17px;padding:19px 0}
        .od2-item+.od2-item{border-top:1px solid #f0f1f3}
        .od2-item-image{width:90px;height:90px;object-fit:cover;border-radius:9px;border:1px solid #eeece8;background:#f8f4ef}
        .od2-item-fallback{width:90px;height:90px;border-radius:9px;background:#fcf5e9;display:flex;justify-content:center;align-items:center;color:#bd873d}
        .od2-item-title{font-size:15px;font-weight:800;line-height:1.5;margin:0 0 5px}
        .od2-item-price{font-size:16px;line-height:1.4;font-weight:800;white-space:nowrap}
        .od2-item-meta{font-size:12px;color:#68717b;line-height:1.7}
        .od2-small-heading{font-size:13px;font-weight:800;color:#36404e}
        .od2-details-line{font-size:12px;color:#66717b;line-height:1.7;margin-top:4px}
        .od2-aside-panel{background:#fff;border:1px solid #e9ebef;border-radius:12px;padding:21px}
        .od2-aside-title{font-size:15px;font-weight:800;display:flex;align-items:center;gap:9px;margin:0 0 14px}
        .od2-aside-block+.od2-aside-block{margin-top:23px;padding-top:21px;border-top:1px solid #eef0f2}
        .od2-aside-copy{font-size:13px;color:#53606d;line-height:1.8;overflow-wrap:anywhere}
        .od2-notice{border-radius:9px;padding:12px 15px;font-size:13px;font-weight:600;margin:12px 0}
        .od2-notice-error{background:#fff2f0;color:#a92825}
        .od2-notice-success{background:#edf9f0;color:#17643b}
        .od2-error-screen{padding:70px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;color:#57616b}
        .od2-error-screen h1{font-size:24px;font-weight:800;color:#232831}
        .od2-error-screen .od2-primary{margin-top:15px}
        .od2-loading{width:100%;animation:od2Pulse 1.4s ease-in-out infinite alternate;background:#f0f1f3;border-radius:8px}
        @keyframes od2Pulse{to{opacity:.48}}
        @media(max-width:1180px){.od2-content{grid-template-columns:minmax(0,1fr) 300px;gap:16px}.od2-surface{padding:18px}.od2-aside-panel{padding:17px}}
        @media(max-width:990px){.od2-content{grid-template-columns:minmax(0,1fr)}.od2-aside{position:static}.od2-aside-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}.od2-aside-block+.od2-aside-block{margin:0;padding:0;border:0}.od2-aside-block:first-child{grid-column:1/-1}}
        @media(max-width:640px){.od2-headline{font-size:27px}.od2-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 12px;padding:17px;margin:18px 0 24px}.od2-surface{padding:17px 14px}.od2-section{margin-bottom:21px}.od2-step-grid{display:flex;flex-direction:column;gap:0;padding:2px 0}.od2-step{padding:1px 0 18px 41px;min-height:62px}.od2-step:not(:last-child):after{height:auto;width:2px;left:12px;top:28px;bottom:0;right:auto}.od2-step-circle{position:absolute;top:1px;left:0}.od2-step-name{margin-top:0;font-size:13px}.od2-step-time{font-size:12px}.od2-item{grid-template-columns:70px minmax(0,1fr);gap:12px}.od2-item-image,.od2-item-fallback{width:70px;height:70px}.od2-item-price{grid-column:2;white-space:normal;margin-top:-6px}.od2-aside-panel{display:block;padding:17px}.od2-aside-block+.od2-aside-block{margin-top:20px;padding-top:18px;border-top:1px solid #eef0f2}}
        @media(prefers-reduced-motion:reduce){.od2-root *{animation:none!important;transition:none!important}}
      `}</style>

      <nav className="od2-top" aria-label="Order navigation">
        <Link to="/account/orders" className="od2-simple-link"><Icon name="back" size={17} /> All orders</Link>
        <Link to={`/account/support?orderId=${encodeURIComponent(order._id)}`} className="od2-simple-link">
          <Icon name="help" size={17} /> Get help
        </Link>
      </nav>

      <header className="flex min-w-0 flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="od2-headline">Order details</h1>
          <p className="od2-id mt-2">Order #{order.orderNumber || order._id}</p>
          <p className="od2-muted mt-1 text-[13px]">Placed on {formatDate(order.createdAt, true)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={customerStatus} />
          {paymentSuccessful && (
            <button type="button" className="od2-outline" onClick={handleInvoiceDownload} disabled={invoiceDownloading}>
              <Icon name="download" size={17} /> {invoiceDownloading ? "Downloading..." : "Download invoice"}
            </button>
          )}
        </div>
      </header>

      <div className="od2-summary" aria-label="Order summary">
        <Meta label="Order total" value={formatCurrency(order.totalAmount)} />
        <Meta label="Items ordered" value={`${itemCount} ${itemCount === 1 ? "item" : "items"}`} />
        <Meta label="Estimated delivery" value={order.deliveryDate ? formatDate(order.deliveryDate) : "To be confirmed"} />
        <Meta label="Payment" value={<StatusBadge status={order.paymentStatus} />} />
      </div>

      {error && <div className="od2-notice od2-notice-error" role="alert">{error}</div>}
      {notice && <div className="od2-notice od2-notice-success" role="status">{notice}</div>}
      {invoiceError && <div className="od2-notice od2-notice-error" role="alert">{invoiceError}</div>}

      <div className="od2-content">
        <div className="od2-main-column">
          <section className="od2-section" aria-label="Delivery tracking">
            <SectionHeading icon="truck" title="Delivery & tracking" />
            <div className="od2-surface">
              <TrackingSection tracking={tracking} loading={trackingLoading} order={order} customerStatus={customerStatus} />
            </div>
          </section>

          <section className="od2-section" aria-label="Purchased items">
            <SectionHeading icon="package" title={`Items in this order (${itemCount})`} />
            <div className="od2-surface">
              {(order.items || []).length ? (order.items || []).map((item, index) => (
                <OrderItem key={item._id || `${item.sku || item.product || "item"}-${index}`} item={item} />
              )) : <p className="od2-muted">No item details are available for this order.</p>}
            </div>
          </section>

          {delivered && (
            <ReviewSection
              order={order}
              reviewableItems={reviewableItems}
              reviewingProductId={reviewingProductId}
              setReviewingProductId={setReviewingProductId}
              setNotice={setNotice}
            />
          )}

          {cancellationVisible && (
            <CancellationSection
              cancellation={cancellation}
              canRequest={canRequestCancellation}
              reason={cancellationReason}
              setReason={setCancellationReason}
              working={cancellationWorking}
              onSubmit={submitCancellation}
            />
          )}

          {refunds.length > 0 && <RefundsSection refunds={refunds} />}
        </div>

        <aside className="od2-aside" aria-label="Order payment and delivery information">
          <div className="od2-aside-panel">
            <section className="od2-aside-block">
              <h2 className="od2-aside-title"><Icon name="receipt" size={19} /> Payment summary</h2>
              <OrderTaxSummary order={order} />
            </section>
            <section className="od2-aside-block">
              <h2 className="od2-aside-title"><Icon name="user" size={19} /> Recipient</h2>
              <p className="font-bold text-[14px]">{order.recipient?.fullName || "Not provided"}</p>
              <p className="od2-aside-copy mt-1">{order.recipient?.phone || "Phone not provided"}</p>
            </section>
            <section className="od2-aside-block">
              <h2 className="od2-aside-title"><Icon name="location" size={19} /> Delivery address</h2>
              <p className="od2-aside-copy">{formatAddress(order.deliveryAddress)}</p>
            </section>
            {order.giftMessage && (
              <section className="od2-aside-block">
                <h2 className="od2-aside-title"><Icon name="star" size={19} /> Gift message</h2>
                <p className="od2-aside-copy whitespace-pre-wrap">{order.giftMessage}</p>
              </section>
            )}
            <section className="od2-aside-block">
              <h2 className="od2-aside-title"><Icon name="help" size={19} /> Need assistance?</h2>
              <div className="flex flex-col items-start gap-3">
                <Link className="od2-simple-link" to={`/account/support?orderId=${encodeURIComponent(order._id)}`}>Order support <Icon name="arrow" size={16} /></Link>
                <Link className="od2-simple-link" to="/account/refunds">Refunds <Icon name="arrow" size={16} /></Link>
                <Link className="od2-simple-link" to="/account/notifications">Notifications <Icon name="arrow" size={16} /></Link>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
};

const Meta = ({ label, value }) => (
  <div className="min-w-0">
    <p className="od2-meta-label">{label}</p>
    <div className="od2-meta-value">{value}</div>
  </div>
);

const TrackingSection = ({ tracking, loading, order, customerStatus }) => {
  const timeline = (tracking?.timeline || []).filter((entry) => entry.key !== "cancelled");
  const shipments = tracking?.shipments || [];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <p className="od2-small-heading">Current status</p>
          <p className="od2-muted mt-1 text-[13px]">Track your order progress and shipment updates.</p>
        </div>
        <StatusBadge status={customerStatus} />
      </div>
      {loading ? (
        <p className="od2-muted py-5">Loading tracking details...</p>
      ) : !tracking ? (
        <div className="flex items-start gap-3 rounded-lg bg-[#f8f9fa] p-4">
          <Icon name="clock" size={20} className="shrink-0 mt-0.5 text-[#ca7d33]" />
          <p className="od2-muted text-[13px]">Tracking information will appear as your order moves through fulfilment.</p>
        </div>
      ) : (
        <>
          {timeline.length > 0 && (
            <div className="od2-step-grid">
              {timeline.map((entry, index) => (
                <div key={entry.key || index} className={`od2-step ${entry.completed ? "od2-step-done" : ""}`}>
                  <span className="od2-step-circle">{entry.completed ? <Icon name="check" size={15} /> : index + 1}</span>
                  <p className="od2-step-name">{entry.label}</p>
                  <p className="od2-step-time">{entry.at ? formatDate(entry.at, true) : entry.completed ? "Completed" : "Pending"}</p>
                </div>
              ))}
            </div>
          )}
          {tracking.production && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-[#f8f9fa] px-4 py-3">
              <span className="od2-small-heading">Production</span>
              <StatusBadge status={tracking.production.stage} />
              {tracking.production.jobCode && <span className="od2-muted text-[12px]">{tracking.production.jobCode}</span>}
            </div>
          )}
          {shipments.length > 0 && (
            <details className="od2-disclosure">
              <summary>Courier and shipment details <Icon name="chevron" size={18} /></summary>
              <div className="mt-3 space-y-4">
                {shipments.map((shipment, index) => (
                  <div className="rounded-lg bg-[#f8f9fa] p-4" key={shipment.id || index}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-[13px]">{shipment.carrier || "Courier pending"}</p>
                      <StatusBadge status={shipment.status} />
                    </div>
                    {(shipment.trackingNumber || shipment.shipmentCode || shipment.id) &&
                      <p className="od2-muted mt-2 break-all text-[12px]">Tracking: {shipment.trackingNumber || shipment.shipmentCode || shipment.id}</p>}
                    {shipment.trackingUrl && (
                      <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer"
                        className="od2-simple-link mt-3">Track with courier <Icon name="arrow" size={15} /></a>
                    )}
                    {shipment.history?.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {shipment.history.slice(-4).map((event, eventIndex) => (
                          <p className="od2-details-line" key={`${event.status}-${event.at}-${eventIndex}`}>
                            <strong className="font-bold text-[#4a5563]">{prettyStatus(event.status)}</strong>
                            {event.location ? ` - ${event.location}` : ""}
                            {event.note ? ` - ${event.note}` : ""}
                            {event.at ? ` - ${formatDate(event.at, true)}` : ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
      <p className="od2-muted mt-5 flex items-center gap-2 text-[12px]">
        <Icon name="calendar" size={16} />
        {order.deliveryDate ? `Expected delivery: ${formatDate(order.deliveryDate)}` : "Delivery date will be updated soon"}
      </p>
    </div>
  );
};

const OrderItem = ({ item }) => {
  const tax = item.tax || {};
  const components = item.customHamper?.components || [];
  const decorations = item.customHamper?.decorations || [];
  const personalization = item.customHamper?.personalization;
  const image = resolveImage(item.image || item.product?.image || item.customHamper?.containerImage);
  const name = item.productName || item.skuName || item.customHamper?.containerName || "HAMPORIUM item";
  const hasTax = item.baseLineTotal !== undefined || item.taxableAmount !== undefined ||
    tax.gstRate !== undefined || Boolean(tax.hsnSac);
  return (
    <article className="od2-item">
      {image ? <img src={image} alt={name} className="od2-item-image" loading="lazy" /> :
        <div className="od2-item-fallback"><Icon name="package" size={27} /></div>}
      <div className="min-w-0">
        <h3 className="od2-item-title">{name}</h3>
        <p className="od2-item-meta">
          {item.skuName || item.skuCode || ""}
          {(item.skuName || item.skuCode) && item.quantity ? " | " : ""}
          Qty: {item.quantity || 1}
        </p>
        {hasTax && (
          <details className="od2-disclosure">
            <summary>Price and tax breakdown <Icon name="chevron" size={16} /></summary>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {item.baseLineTotal !== undefined && <span className="od2-details-line">Base: {formatCurrency(item.baseLineTotal)}</span>}
              {item.taxableAmount !== undefined && <span className="od2-details-line">Taxable: {formatCurrency(item.taxableAmount)}</span>}
              {tax.gstRate !== undefined && <span className="od2-details-line">GST: {tax.gstRate}%</span>}
              {tax.hsnSac && <span className="od2-details-line">HSN/SAC: {tax.hsnSac}</span>}
            </div>
          </details>
        )}
        {(components.length > 0 || decorations.length > 0) && (
          <details className="od2-disclosure">
            <summary>View hamper contents <Icon name="chevron" size={16} /></summary>
            {components.length > 0 && <DetailsList title="Hamper contents" items={components} />}
            {decorations.length > 0 && <DetailsList title="Decorative finishing" items={decorations} />}
          </details>
        )}
        {personalization?.enabled && (personalization.message || personalization.instructions) && (
          <div className="mt-4 rounded-lg bg-[#fff9ef] p-3">
            <p className="od2-small-heading">Personalisation</p>
            {personalization.message && <p className="od2-aside-copy mt-1">{personalization.message}</p>}
            {personalization.instructions && <p className="od2-aside-copy mt-1">{personalization.instructions}</p>}
          </div>
        )}
      </div>
      <p className="od2-item-price">{formatCurrency(item.lineTotal)}</p>
    </article>
  );
};

const DetailsList = ({ title, items }) => (
  <div className="mt-3">
    <p className="od2-small-heading">{title}</p>
    <div className="mt-1 space-y-1">
      {items.map((item, index) => (
        <p key={`${item.component || item.code || item.name || "detail"}-${index}`} className="od2-details-line">
          {item.name || "Item"} x {item.quantity || 1}
          {item.lineTotal !== undefined ? ` - ${formatCurrency(item.lineTotal)}` : ""}
        </p>
      ))}
    </div>
  </div>
);

const ReviewSection = ({ order, reviewableItems, reviewingProductId, setReviewingProductId, setNotice }) => (
  <section id="review-order" className="od2-section scroll-mt-8">
    <SectionHeading icon="star" title="Rate and review" action={
      <Link className="od2-simple-link" to="/account/reviews">My reviews <Icon name="arrow" size={16} /></Link>
    } />
    <div className="od2-surface">
      {reviewableItems.length === 0 ? (
        <p className="od2-muted text-[13px]">No reviewable item was found in this delivered order. Contact support if you need help.</p>
      ) : reviewableItems.map((item) => {
        const reviewKey = item.targetType === "product" ? `product:${item.productId}` : "custom_hamper:order";
        const open = reviewingProductId === reviewKey;
        return (
          <div className="py-3 first:pt-0 last:pb-0" key={item.key}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-[14px]">{item.name}</p>
                <p className="od2-muted text-[12px] mt-1">Share your experience with this purchase.</p>
              </div>
              {!open && <button type="button" className="od2-outline" onClick={() => setReviewingProductId(reviewKey)}>
                <Icon name="star" size={17} /> Rate & review
              </button>}
            </div>
            {open && (
              <div className="mt-5">
                <ReviewForm
                  targetType={item.targetType}
                  productId={item.productId}
                  orderId={order._id}
                  targetName={item.name}
                  compact
                  onCancel={() => setReviewingProductId("")}
                  onSaved={(_review, message) => {
                    setNotice(message || "Review published.");
                    setReviewingProductId("");
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </section>
);

const CancellationSection = ({ cancellation, canRequest, reason, setReason, working, onSubmit }) => (
  <section className="od2-section">
    <SectionHeading icon="info" title="Cancellation" />
    <div className="od2-surface">
      {cancellation?.status && cancellation.status !== "none" && (
        <div className="mb-4">
          <StatusBadge status={cancellation.status} />
          {cancellation.reason && <p className="od2-aside-copy mt-3">Reason: {cancellation.reason}</p>}
          {cancellation.reviewNote && <p className="od2-aside-copy mt-2">Review note: {cancellation.reviewNote}</p>}
          {cancellation.requestedAt && <p className="od2-muted mt-2 text-[12px]">Requested on {formatDate(cancellation.requestedAt, true)}</p>}
        </div>
      )}
      {canRequest && (
        <form onSubmit={onSubmit}>
          <label htmlFor="od2-cancellation-reason" className="block font-bold text-[13px] mb-2">Reason for cancellation</label>
          <textarea id="od2-cancellation-reason" rows={3} maxLength={1000} value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Tell us why you want to cancel this order."
            className="w-full rounded-lg border border-[#dce0e3] bg-white p-3 text-[14px] leading-6 text-[#232831] outline-none focus:border-[#d98033] resize-y" />
          <button type="submit" className="od2-outline mt-3" disabled={working}>
            {working ? "Submitting request..." : "Request cancellation"}
            <Icon name="arrow" size={16} />
          </button>
        </form>
      )}
    </div>
  </section>
);

const RefundsSection = ({ refunds }) => (
  <section className="od2-section">
    <SectionHeading icon="refresh" title="Refund history" action={
      <Link to="/account/refunds" className="od2-simple-link">View all <Icon name="arrow" size={15} /></Link>
    } />
    <div className="od2-surface">
      {refunds.map((refund, index) => (
        <div key={refund._id || index} className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <StatusBadge status={refund.status} />
            <p className="od2-muted mt-2 text-[12px]">{refund.reason || "Refund"} - {formatDate(refund.createdAt, true)}</p>
          </div>
          <p className="font-extrabold text-[15px]">{formatCurrency(refund.amount)}</p>
        </div>
      ))}
    </div>
  </section>
);

const OrderDetailsLoading = () => (
  <div className="w-full min-w-0 pb-12" aria-label="Loading order details" role="status">
    <div className="h-5 w-28 animate-pulse rounded bg-[#eef0f2]" />
    <div className="mt-7 h-10 w-64 max-w-full animate-pulse rounded bg-[#eef0f2]" />
    <div className="mt-6 h-24 w-full animate-pulse rounded-xl bg-[#f2f3f5]" />
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_335px]">
      <div>
        <div className="h-52 w-full animate-pulse rounded-xl bg-[#f2f3f5]" />
        <div className="mt-5 h-44 w-full animate-pulse rounded-xl bg-[#f2f3f5]" />
      </div>
      <div className="h-80 w-full animate-pulse rounded-xl bg-[#f2f3f5]" />
    </div>
  </div>
);

export default OrderDetails;
