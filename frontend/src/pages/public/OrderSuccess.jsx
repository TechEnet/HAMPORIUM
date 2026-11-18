import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import OrderTaxSummary from "../../components/OrderTaxSummary.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";
import { downloadOrderInvoice } from "../../utils/invoice.js";

// HAMPORIUM order confirmation. UI-only: existing APIs, auth, payments and routes unchanged.
const ORDER_SUCCESS_CSS = `
/* HAMPORIUM / refined order receipt | single full-width editorial surface */
.hmp-os {
  --os-ink:#211f1c; --os-muted:#776e62; --os-quiet:#958776;
  --os-gold:#b79b6a; --os-gold-soft:#e7d8bf; --os-line:#e5dacc;
  --os-paper:#faf8f4; --os-orange:#e97120;
  background:var(--os-paper); color:var(--os-ink); min-height:100vh; width:100%;
  font-family:'Manrope',Arial,sans-serif; font-size:14px; line-height:1.6;
  overflow-wrap:anywhere; -webkit-font-smoothing:antialiased;
}
.hmp-os *, .hmp-os *::before, .hmp-os *::after { box-sizing:border-box; }
.hmp-os :where(h1,h2,h3,p,figure,dl,dd,dt) { margin:0; }
.hmp-os :where(a,button,summary):focus-visible { outline:2px solid #a37b40; outline-offset:3px; }
.hmp-os a { color:inherit; text-decoration:none; }
.hmp-os button { font:inherit; cursor:pointer; }
.hmp-os button:disabled { opacity:.55; cursor:not-allowed; }
.hmp-os .os-shell { width:100%; max-width:none; margin:0; padding:102px clamp(18px,4vw,80px) 64px; }

/* Unboxed confirmation hero: deliberate hierarchy and very little copy. */
.hmp-os .os-hero { position:relative; display:grid; grid-template-columns:minmax(0,1fr) auto;
  gap:28px; align-items:end; padding:13px 0 25px; }
.hmp-os .os-hero::before { content:''; position:absolute; top:0; left:0; height:2px; width:50px; background:var(--os-gold); }
.hmp-os .os-state { display:inline-flex; align-items:center; gap:9px; color:#286d55;
  font-size:12px; letter-spacing:.09em; text-transform:uppercase; font-weight:800; }
.hmp-os .os-state.is-pending { color:#9d6c27; }
.hmp-os .os-state-icon { width:24px; height:24px; flex:0 0 24px; display:grid; place-items:center;
  background:#e5f3eb; color:#287154; border-radius:50%; font-size:15px; line-height:1; }
.hmp-os .os-state.is-pending .os-state-icon { background:#f5e9d4; color:#9d6c27; }
.hmp-os .os-title { margin-top:11px !important; font-size:clamp(30px,2.6vw,41px) !important;
  font-family:'Manrope',Arial,sans-serif; font-weight:600 !important; line-height:1.2 !important;
  letter-spacing:-.045em; color:#211e1a; }
.hmp-os .os-subtitle { color:var(--os-muted); font-size:14px; margin-top:6px; }
.hmp-os .os-eta { text-align:right; padding:0 0 4px 24px; border-left:1px solid var(--os-line); }
.hmp-os .os-eta-label { font-size:11px; line-height:1.4; text-transform:uppercase; letter-spacing:.1em;
  color:#92784d; font-weight:800; }
.hmp-os .os-eta-value { margin-top:4px; font-size:20px; font-weight:700; white-space:nowrap;
  line-height:1.3; letter-spacing:-.025em; }

/* All journeys are accessible at the top, not buried beneath the receipt. */
.hmp-os .os-actions { display:flex; justify-content:space-between; align-items:center; gap:14px 22px;
  flex-wrap:wrap; padding:16px 0 19px; border-top:1px solid var(--os-line);
  border-bottom:1px solid var(--os-line); }
.hmp-os .os-actions-main, .hmp-os .os-actions-more { display:flex; flex-wrap:wrap; align-items:center; gap:9px 14px; }
.hmp-os .os-action { min-height:43px; display:inline-flex; justify-content:center; align-items:center; gap:8px;
  white-space:nowrap; padding:10px 16px; border:1px solid transparent; border-radius:7px;
  font-size:13px; font-weight:800; line-height:1.3; background:transparent;
  transition:background .2s,border-color .2s,color .2s,transform .2s; }
.hmp-os .os-action svg { width:16px; height:16px; flex:0 0 16px; }
.hmp-os .os-action.is-primary { background:#24211e; color:#fff; border-color:#24211e; }
.hmp-os .os-action.is-secondary { color:#40362d; border-color:#c9b89d; background:#fffcf6; }
.hmp-os .os-action.is-link { padding:9px 5px; color:#645646; }
.hmp-os .os-action:not(:disabled):hover { transform:translateY(-1px); }
.hmp-os .os-action.is-primary:not(:disabled):hover { background:#3a3026; border-color:#3a3026; }
.hmp-os .os-action.is-secondary:not(:disabled):hover { background:#f1eadf; }
.hmp-os .os-action.is-link:not(:disabled):hover { color:#ab7337; }
.hmp-os .os-alert { margin-top:11px; border-left:3px solid #c66d61; padding:9px 12px;
  color:#903b34; font-size:13px; background:#fcf0eb; }

/* One subtle tinted band (not a row of cards) for key receipt data. */
.hmp-os .os-receipt { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,.8fr) minmax(0,.95fr) minmax(0,.95fr);
  background:#f1eadf; padding:20px clamp(16px,2vw,30px); margin-top:21px; }
.hmp-os .os-metric { min-width:0; padding:0 clamp(12px,1.5vw,25px); border-left:1px solid #dfceb6; }
.hmp-os .os-metric:first-child { padding-left:0; border-left:0; }
.hmp-os .os-metric-label { display:block; font-size:11px; line-height:1.45; font-weight:800;
  color:#80705e; text-transform:uppercase; letter-spacing:.07em; }
.hmp-os .os-metric-value { display:block; margin-top:6px; color:#2c261f; font-weight:750; font-size:15px; line-height:1.4; }
.hmp-os .os-metric-value.is-order { font-size:13px; letter-spacing:.005em; overflow-wrap:anywhere; }
.hmp-os .os-metric-value.is-total { font-size:21px; letter-spacing:-.04em; }
.hmp-os .os-metric-status { margin-top:7px; display:inline-flex; max-width:100%; }

/* Open receipt sections, evenly spaced with hairline rules. */
.hmp-os .os-section { padding:29px 0 31px; border-bottom:1px solid var(--os-line); min-width:0; }
.hmp-os .os-section-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap;
  gap:8px 20px; margin-bottom:19px; }
.hmp-os .os-section-title { color:#28231e; font-size:22px !important; letter-spacing:-.03em;
  line-height:1.32 !important; font-weight:700 !important; font-family:'Manrope',Arial,sans-serif; }
.hmp-os .os-section-note { color:var(--os-muted); font-size:12px; }
.hmp-os .os-progress { display:grid; grid-template-columns:repeat(var(--os-count,6),minmax(0,1fr)); gap:0; }
.hmp-os .os-step { position:relative; min-width:0; }
.hmp-os .os-step:not(:last-child)::after { content:''; position:absolute; top:15px; left:31px; right:9px;
  height:2px; background:#e1d7ca; }
.hmp-os .os-step.is-complete:not(:last-child)::after { background:var(--os-gold); }
.hmp-os .os-step-dot { position:relative; z-index:1; display:grid; place-items:center; width:31px; height:31px;
  border:1.5px solid #d6c6b3; border-radius:50%; background:var(--os-paper);
  color:#8f8172; font-size:12px; font-weight:800; }
.hmp-os .os-step.is-complete .os-step-dot { background:#b79b6a; border-color:#b79b6a; color:#fff; }
.hmp-os .os-step-label { display:block; margin-top:10px; padding-right:8px; font-size:13px;
  font-weight:800; line-height:1.5; }
.hmp-os .os-step-date { display:block; margin-top:2px; padding-right:8px; font-size:11px;
  color:#8c8074; line-height:1.6; }
.hmp-os .os-empty { color:var(--os-muted); font-size:14px; }

/* One contiguous 2-column content area, no nested cards. */
.hmp-os .os-columns { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(300px,.85fr);
  gap:clamp(26px,3vw,58px); align-items:start; }
.hmp-os .os-columns > * { min-width:0; }
.hmp-os .os-side { border-left:1px solid var(--os-line); padding-left:clamp(26px,3vw,58px); }
.hmp-os .os-item { display:grid; grid-template-columns:78px minmax(0,1fr) auto; gap:14px;
  align-items:center; padding:17px 0; border-top:1px solid var(--os-line); }
.hmp-os .os-item:first-child { border-top:0; padding-top:2px; }
.hmp-os .os-photo { width:78px; height:78px; background:#f1e9dd; overflow:hidden; border-radius:5px; }
.hmp-os .os-photo img { width:100%; height:100%; display:block; object-fit:contain; }
.hmp-os .os-photo-fallback { display:grid; place-items:center; height:100%; color:#827666; font-size:12px; }
.hmp-os .os-item-name { font-size:14px; font-weight:800; line-height:1.55; }
.hmp-os .os-item-meta { font-size:12px; color:var(--os-muted); margin-top:3px; }
.hmp-os .os-item-total { white-space:nowrap; font-size:15px; font-weight:800; }
.hmp-os .os-detail { margin-bottom:15px; }
.hmp-os .os-detail:last-child { margin-bottom:0; }
.hmp-os .os-detail-name { font-size:12px; color:#806f5c; line-height:1.45; }
.hmp-os .os-detail-value { font-size:14px; color:#353027; line-height:1.65; margin-top:3px; font-weight:650; }
.hmp-os .os-detail-help { color:var(--os-muted); font-size:13px; margin-top:2px; }
.hmp-os .os-message { color:#615448; font-style:italic; white-space:pre-wrap; font-weight:500; }
.hmp-os .os-breakdown { margin-top:20px; border-top:1px solid var(--os-line); }
.hmp-os .os-breakdown summary { list-style:none; display:flex; justify-content:space-between;
  align-items:center; gap:10px; padding:15px 0; color:#4e3e2c; font-size:14px; font-weight:800; cursor:pointer; }
.hmp-os .os-breakdown summary::-webkit-details-marker { display:none; }
.hmp-os .os-breakdown summary svg { height:16px; width:16px; transform:rotate(90deg); transition:transform .2s; }
.hmp-os .os-breakdown[open] summary svg { transform:rotate(-90deg); }
.hmp-os .os-tax-component { width:100%; padding:3px 0 15px; }
.hmp-os .os-tax-component > * { width:100% !important; max-width:none !important;
  border:0 !important; border-radius:0 !important; box-shadow:none !important;
  background:transparent !important; margin:0 !important; padding:0 !important; }
.hmp-os .os-tax-component :where(p,span,dd,dt) { line-height:1.6; }
.hmp-os .os-error { max-width:520px; margin:10vh auto 0; text-align:center; }
.hmp-os .os-error h1 { font-size:29px !important; line-height:1.2; }
.hmp-os .os-error .os-action { margin-top:20px; }
.hmp-os .os-skeleton { background:#eae1d5; border-radius:4px; animation:osPulse 1.5s ease-in-out infinite; }
@keyframes osPulse { 50% { opacity:.52; } }
@media (max-width:1100px) {
  .hmp-os .os-columns { grid-template-columns:minmax(0,1.2fr) minmax(285px,.9fr); gap:25px; }
  .hmp-os .os-side { padding-left:25px; }
  .hmp-os .os-metric { padding-inline:15px; }
}
@media (max-width:860px) {
  .hmp-os .os-hero { grid-template-columns:1fr; gap:15px; }
  .hmp-os .os-eta { text-align:left; padding:0 0 0 15px; }
  .hmp-os .os-columns { grid-template-columns:1fr; gap:0; }
  .hmp-os .os-side { padding-left:0; border-left:0; }
  .hmp-os .os-receipt { grid-template-columns:repeat(2,minmax(0,1fr)); gap:15px 0; }
  .hmp-os .os-metric:nth-child(odd) { padding-left:0; border-left:0; }
  .hmp-os .os-metric:nth-child(n+3) { border-top:1px solid #dfceb6; padding-top:14px; }
}
@media (max-width:600px) {
  .hmp-os .os-shell { padding:87px 16px 40px; }
  .hmp-os .os-hero { padding-bottom:18px; }
  .hmp-os .os-title { font-size:30px !important; }
  .hmp-os .os-subtitle { font-size:13px; }
  .hmp-os .os-eta-value { font-size:18px; }
  .hmp-os .os-actions { padding:13px 0; gap:10px; }
  .hmp-os .os-actions-main { width:100%; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .hmp-os .os-actions-more { width:100%; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:3px; }
  .hmp-os .os-action { font-size:12px; white-space:normal; text-align:center; min-height:44px; padding:8px 9px; }
  .hmp-os .os-actions-more .os-action { font-size:12px; padding:7px 2px; }
  .hmp-os .os-receipt { margin-top:15px; padding:16px 14px; }
  .hmp-os .os-metric { padding-inline:10px; }
  .hmp-os .os-metric-label { font-size:10px; letter-spacing:.025em; }
  .hmp-os .os-metric-value.is-order { font-size:12px; }
  .hmp-os .os-metric-value.is-total { font-size:19px; }
  .hmp-os .os-section { padding:23px 0; }
  .hmp-os .os-section-head { margin-bottom:15px; }
  .hmp-os .os-section-title { font-size:19px !important; }
  .hmp-os .os-progress { grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 12px; }
  .hmp-os .os-step::after { display:none; }
  .hmp-os .os-step { display:flex; gap:9px; align-items:center; }
  .hmp-os .os-step-dot { flex:0 0 29px; width:29px; height:29px; }
  .hmp-os .os-step-content { min-width:0; }
  .hmp-os .os-step-label { margin-top:0; padding-right:0; font-size:12px; }
  .hmp-os .os-step-date { padding-right:0; font-size:10px; }
  .hmp-os .os-item { grid-template-columns:66px minmax(0,1fr) auto; gap:10px; }
  .hmp-os .os-photo { height:66px; width:66px; }
  .hmp-os .os-item-name { font-size:13px; }
  .hmp-os .os-item-meta { font-size:11px; }
  .hmp-os .os-item-total { font-size:13px; }
}
@media (max-width:380px) {
  .hmp-os .os-item { grid-template-columns:60px minmax(0,1fr); }
  .hmp-os .os-photo { width:60px; height:60px; }
  .hmp-os .os-item-total { grid-column:2; margin-top:-6px; }
  .hmp-os .os-actions-more { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media (prefers-reduced-motion:reduce) {
  .hmp-os *, .hmp-os *::before, .hmp-os *::after { animation:none !important; transition:none !important; }
}
`;

const ActionArrow = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>;
const ReceiptIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
const TimelineStep = ({ entry, index }) => (
  <div className={`os-step ${entry.completed ? "is-complete" : ""}`}>
    <span className="os-step-dot" aria-label={entry.completed ? "Completed" : "Pending"}>{entry.completed ? "✓" : index + 1}</span>
    <div className="os-step-content">
      <strong className="os-step-label">{entry.label}</strong>
      <span className="os-step-date">{entry.at ? formatDate(entry.at, true) : entry.completed ? "Completed" : "Pending"}</span>
    </div>
  </div>
);
const formatAddress = (address, recipientName = "") => {
  if (!address) return "—";
  return [
    address.fullName && String(address.fullName).trim().toLowerCase() !== String(recipientName).trim().toLowerCase() ? address.fullName : null,
    address.addressLine1, address.addressLine2, address.landmark,
    address.city, address.state, address.postalCode, address.country,
  ].filter(Boolean).join(", ") || "—";
};

const OrderSuccess = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");

  // Keep the existing API/authorization flow unchanged.
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const orderResponse = await api.get(`/orders/${orderId}`);
        if (!active) return;
        setOrder(orderResponse.data.order);
        try {
          const trackingResponse = await api.get(`/orders/${orderId}/tracking`);
          if (active) setTracking(trackingResponse.data?.tracking || null);
        } catch (trackingError) {
          if (trackingError.response?.status !== 404) {
            console.error("Unable to load initial tracking:", trackingError);
          }
          if (active) setTracking(null);
        }
      } catch (requestError) {
        if (!active) return;
        setError(requestError.response?.data?.message || "Unable to load order details");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [orderId]);

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

  if (loading) {
    return <main className="hmp-os" aria-busy="true" aria-label="Loading order confirmation">
      <style>{ORDER_SUCCESS_CSS}</style>
      <div className="os-shell">
        <div className="os-skeleton" style={{ width: 185, height: 15, marginTop: 15 }} />
        <div className="os-skeleton" style={{ width: "55%", maxWidth: 570, height: 43, marginTop: 18 }} />
        <div className="os-skeleton" style={{ width: "100%", height: 66, marginTop: 32 }} />
        <div className="os-skeleton" style={{ width: "100%", height: 76, marginTop: 19 }} />
        <div className="os-skeleton" style={{ width: "100%", height: 145, marginTop: 23 }} />
      </div>
    </main>;
  }

  if (error || !order) {
    return <main className="hmp-os"><style>{ORDER_SUCCESS_CSS}</style>
      <div className="os-shell"><div className="os-error">
        <h1>Unable to load order</h1>
        <p role="alert" className="os-alert">{error || "Order not found"}</p>
        <Link to="/account/orders" className="os-action is-primary">View my orders <ActionArrow /></Link>
      </div></div>
    </main>;
  }

  // Presentation only; gateway/payment verification remains on the backend.
  const paymentSuccessful = ["paid", "partially_refunded", "refunded"].includes(order.paymentStatus);
  const expectedDelivery = tracking?.deliveryDate || order.deliveryDate;
  const timeline = (tracking?.timeline || []).filter((entry) => entry.key !== "cancelled");
  const items = order.items || [];

  return <main className="hmp-os">
    <style>{ORDER_SUCCESS_CSS}</style>
    <div className="os-shell">
      <header className="os-hero">
        <div>
          <p className={`os-state ${paymentSuccessful ? "" : "is-pending"}`}>
            <span className="os-state-icon" aria-hidden="true">{paymentSuccessful ? "✓" : "!"}</span>
            {paymentSuccessful ? "Payment successful" : "Order received"}
          </p>
          <h1 className="os-title">{paymentSuccessful ? "Order confirmed." : "Order placed."}</h1>
          <p className="os-subtitle">Thank you for shopping with HAMPORIUM.</p>
        </div>
        {expectedDelivery && <div className="os-eta">
          <p className="os-eta-label">Expected delivery</p>
          <p className="os-eta-value">{formatDate(expectedDelivery)}</p>
        </div>}
      </header>

      <nav className="os-actions" aria-label="Order actions">
        <div className="os-actions-main">
          <Link to={`/account/orders/${order._id}`} className="os-action is-primary">Track order <ActionArrow /></Link>
          <Link to="/gifts" className="os-action is-secondary">Continue shopping</Link>
        </div>
        <div className="os-actions-more">
          <Link to="/account/orders" className="os-action is-link">My orders</Link>
          {paymentSuccessful && <button type="button" className="os-action is-link" onClick={handleInvoiceDownload} disabled={invoiceDownloading} aria-busy={invoiceDownloading}>
            <ReceiptIcon />{invoiceDownloading ? "Downloading..." : "Invoice"}
          </button>}
          <Link to={`/account/support?orderId=${encodeURIComponent(order._id)}`} className="os-action is-link">Help</Link>
        </div>
      </nav>
      {invoiceError && <p className="os-alert" role="alert">{invoiceError}</p>}

      <section className="os-receipt" aria-label="Order summary">
        <div className="os-metric"><span className="os-metric-label">Order number</span><span className="os-metric-value is-order">{order.orderNumber}</span></div>
        <div className="os-metric"><span className="os-metric-label">Order total</span><span className="os-metric-value is-total">{formatCurrency(order.totalAmount)}</span></div>
        <div className="os-metric"><span className="os-metric-label">Order status</span><span className="os-metric-status"><StatusBadge status={tracking?.customerStatus || order.status} /></span></div>
        <div className="os-metric"><span className="os-metric-label">Payment</span><span className="os-metric-status"><StatusBadge status={order.paymentStatus} /></span></div>
      </section>

      <section className="os-section" aria-labelledby="os-timeline-title">
        <div className="os-section-head"><h2 className="os-section-title" id="os-timeline-title">Order progress</h2></div>
        {timeline.length ? <div className="os-progress" style={{ "--os-count": timeline.length }} aria-label="Order progress">
          {timeline.map((entry,index) => <TimelineStep key={entry.key || index} entry={entry} index={index} />)}
        </div> : <p className="os-empty">Tracking updates will appear here.</p>}
      </section>

      <div className="os-columns">
        <section className="os-section" aria-labelledby="os-items-title">
          <div className="os-section-head"><h2 className="os-section-title" id="os-items-title">Ordered items</h2><span className="os-section-note">{items.length} {items.length === 1 ? "item" : "items"}</span></div>
          <div>
            {items.map((item, index) => <div className="os-item" key={item.sku || item.product || index}>
              <div className="os-photo">{item.image
                ? <img src={item.image} alt={item.productName || item.skuName || "Ordered hamper"} loading="lazy" decoding="async" />
                : <div className="os-photo-fallback">No image</div>}</div>
              <div><p className="os-item-name">{item.productName || item.skuName || "HAMPORIUM item"}</p>
                <p className="os-item-meta">Qty {item.quantity} · {formatCurrency(item.unitPrice)} each</p></div>
              <p className="os-item-total">{formatCurrency(item.lineTotal)}</p>
            </div>)}
          </div>
        </section>

        <aside className="os-side" aria-label="Delivery and payment details">
          <section className="os-section" aria-labelledby="os-delivery-title">
            <div className="os-section-head"><h2 className="os-section-title" id="os-delivery-title">Delivery details</h2></div>
            <div className="os-detail"><p className="os-detail-name">Recipient</p>
              <p className="os-detail-value">{order.recipient?.fullName || "—"}</p>
              {order.recipient?.phone && <p className="os-detail-help">{order.recipient.phone}</p>}
            </div>
            <div className="os-detail"><p className="os-detail-name">Address</p>
              <p className="os-detail-value">{formatAddress(order.deliveryAddress, order.recipient?.fullName)}</p></div>
            {order.giftMessage && <div className="os-detail"><p className="os-detail-name">Gift message</p>
              <p className="os-detail-value os-message">“{order.giftMessage}”</p></div>}
          </section>
          <details className="os-breakdown">
            <summary>Price breakdown <ActionArrow /></summary>
            <div className="os-tax-component"><OrderTaxSummary order={order} /></div>
          </details>
        </aside>
      </div>
    </div>
  </main>;
};

export default OrderSuccess;
