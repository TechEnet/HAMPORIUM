import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../api/api.js";
import OrderTaxSummary from "../../components/OrderTaxSummary.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import ReviewForm from "../../components/reviews/ReviewForm.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";
import { downloadOrderInvoice } from "../../utils/invoice.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

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

  const loadOrder = async () => {
    const response = await api.get(`/orders/${orderId}`);
    setOrder(response.data.order);
    return response.data.order;
  };

  const loadTracking = async ({ silent = false } = {}) => {
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
  };

  const loadRefunds = async () => {
    try {
      const response = await api.get("/refunds/mine?limit=100");
      const list = response.data.refunds || [];
      setRefunds(
        list.filter(
          (refund) =>
            String(refund.order?._id || refund.order || "") === String(orderId)
        )
      );
    } catch {
      setRefunds([]);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(`/orders/${orderId}`);
        if (!active) return;
        setOrder(response.data.order);
      } catch (requestError) {
        if (!active) return;
        setError(requestError.response?.data?.message || "Unable to load order");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (!order?._id) return undefined;

    void loadTracking();
    void loadRefunds();

    const terminal = ["delivered", "cancelled"].includes(
      tracking?.customerStatus || order.status
    );

    if (terminal) return undefined;

    const timer = window.setInterval(() => {
      void loadTracking({ silent: true });
    }, 60000);

    return () => window.clearInterval(timer);
  }, [order?._id, order?.status, tracking?.customerStatus]);

  const handleInvoiceDownload = async () => {
    if (!order?._id) return;
    setInvoiceDownloading(true);
    setInvoiceError("");

    try {
      await downloadOrderInvoice({
        orderId: order._id,
        orderNumber: order.orderNumber,
      });
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

    if (!window.confirm("Submit this cancellation request for admin review?")) {
      return;
    }

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

  const itemCount = useMemo(
    () =>
      (order?.items || []).reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      ),
    [order?.items]
  );

  if (loading) {
    return <div className="rounded-2xl border bg-white p-8">Loading order...</div>;
  }

  if (error && !order) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
  }

  if (!order) return null;

  const paymentSuccessful = ["paid", "partially_refunded", "refunded"].includes(
    order.paymentStatus
  );
  const cancellation = order.cancellation || {};
  const customerStatus = tracking?.customerStatus || order.status;
  const delivered = customerStatus === "delivered" || order.status === "delivered";
  const canRequestCancellation =
    ["paid", "partially_refunded"].includes(order.paymentStatus) &&
    !["shipped", "delivered", "cancelled"].includes(order.status) &&
    !["requested", "approved"].includes(cancellation.status);

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-12 text-[#171717]" style={{ fontFamily: "'Manrope', Arial, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/account/orders" className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#F97316]">← Back to My Orders</Link>
        <Link to={`/account/support?orderId=${order._id}`} className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.06em] transition hover:border-[#F97316] hover:text-[#F97316]">Need Help?</Link>
      </div>

      <section className="mt-5 overflow-hidden rounded-[26px] bg-[#171717] text-white">
        <div className="grid lg:grid-cols-[1.3fr_.7fr]">
          <div className="p-6 sm:p-8">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#D4AF37]">Your Order</p>
            <h1 style={{ fontFamily: DISPLAY_FONT }} className="mt-2 text-[40px] font-semibold leading-none sm:text-[50px]">{order.orderNumber}</h1>
            <p className="mt-3 text-xs text-white/40">Placed {formatDate(order.createdAt, true)}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge status={customerStatus} />
              <StatusBadge status={order.paymentStatus} />
              {cancellation.status && cancellation.status !== "none" && <StatusBadge status={cancellation.status} label={`Cancellation ${cancellation.status}`} />}
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-white/10 lg:border-l lg:border-t-0">
            <HeroStat label="Total" value={formatCurrency(order.totalAmount)} />
            <HeroStat label="Items" value={itemCount} borderLeft />
            <HeroStat label="Expected Delivery" value={order.deliveryDate ? formatDate(order.deliveryDate) : "—"} borderTop />
            <HeroStat label="Checkout" value={order.checkoutMode === "buy_now" ? "Buy Now" : order.checkoutMode === "quote" ? "Quote" : "Cart"} borderLeft borderTop />
          </div>
        </div>
      </section>

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
      {invoiceError && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{invoiceError}</div>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <div className="space-y-6">
          <TrackingCard tracking={tracking} loading={trackingLoading} order={order} />

          <section className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">Order Items</p><h2 className="mt-1 text-lg font-black">What you ordered</h2></div>
              {paymentSuccessful && <button type="button" onClick={handleInvoiceDownload} disabled={invoiceDownloading} className="rounded-xl border border-[#D4AF37]/40 bg-[#FFF9F2] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#8D6C18] transition hover:bg-[#D4AF37] hover:text-[#171717] disabled:opacity-40">{invoiceDownloading ? "Downloading..." : "Download Invoice"}</button>}
            </div>

            <div className="mt-5 divide-y divide-black/[0.06]">
              {(order.items || []).map((item, index) => {
                const productId = item.product?._id || item.product || "";
                return (
                  <div key={item.sku || item.product || `${index}`}>
                    <OrderItem item={item} />

                    {delivered && productId && (
                      <div className="pb-5">
                        {reviewingProductId === String(productId) ? (
                          <ReviewForm
                            productId={productId}
                            orderId={order._id}
                            compact
                            onCancel={() => setReviewingProductId("")}
                            onSaved={(_review, message) => {
                              setNotice(message || "Review published.");
                              setReviewingProductId("");
                            }}
                          />
                        ) : (
                          <button type="button" onClick={() => setReviewingProductId(String(productId))} className="rounded-xl border border-[#F97316]/30 bg-[#FFF9F2] px-4 py-2.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#F97316] transition hover:bg-[#F97316] hover:text-white">★ Rate & Review</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {(cancellation.status && cancellation.status !== "none") || canRequestCancellation ? (
            <CancellationCard cancellation={cancellation} canRequest={canRequestCancellation} reason={cancellationReason} setReason={setCancellationReason} working={cancellationWorking} onSubmit={submitCancellation} />
          ) : null}

          {refunds.length > 0 && (
            <section className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">Refunds</p><h2 className="mt-1 text-lg font-black">Refund history</h2></div><Link to="/account/refunds" className="text-xs font-bold text-[#F97316]">All refunds →</Link></div>
              <div className="mt-4 space-y-3">
                {refunds.map((refund) => <div key={refund._id} className="flex flex-col gap-3 rounded-xl bg-[#FFF9F2] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap gap-2"><StatusBadge status={refund.status} /><StatusBadge status={refund.type} /></div><p className="mt-2 text-xs text-black/45">{refund.reason || "Refund"} · {formatDate(refund.createdAt, true)}</p></div><p className="text-lg font-black text-[#F97316]">{formatCurrency(refund.amount)}</p></div>)}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <OrderTaxSummary order={order} />

          <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">Recipient</p>
            <p className="mt-2 font-black">{order.recipient?.fullName || "—"}</p>
            <p className="mt-1 text-sm text-black/45">{order.recipient?.phone || "—"}</p>
            <div className="mt-5 border-t border-black/[0.06] pt-5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">Delivery Address</p><p className="mt-2 text-sm leading-6 text-black/55">{formatAddress(order.deliveryAddress)}</p></div>
            {order.giftMessage && <div className="mt-5 border-t border-black/[0.06] pt-5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">Gift Message</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/55">{order.giftMessage}</p></div>}
          </section>

          <section className="rounded-2xl bg-[#171717] p-5 text-white">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#D4AF37]">Need assistance?</p>
            <p className="mt-2 text-sm leading-6 text-white/55">Order, delivery, payment or refund questions can be handled in a support ticket tied to this order.</p>
            <div className="mt-4 grid gap-2">
              <Link to={`/account/support?orderId=${order._id}`} className="rounded-xl bg-[#F97316] px-4 py-3 text-center text-xs font-bold text-white transition hover:bg-white hover:text-[#171717]">Get Help With This Order</Link>
              <Link to="/account/notifications" className="rounded-xl border border-white/10 px-4 py-3 text-center text-xs font-bold transition hover:border-[#F97316] hover:text-[#F97316]">Notifications</Link>
              <Link to="/account/refunds" className="rounded-xl border border-white/10 px-4 py-3 text-center text-xs font-bold transition hover:border-[#F97316] hover:text-[#F97316]">Refunds</Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

const TrackingCard = ({ tracking, loading, order }) => (
  <section className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">Delivery Progress</p><h2 className="mt-1 text-lg font-black">Track your order</h2><p className="mt-2 text-[10px] text-black/40">Expected delivery {order.deliveryDate ? formatDate(order.deliveryDate) : "is being calculated"}. Statuses come from production and fulfilment, not from a fake timer.</p></div>
      {tracking?.customerStatus && <StatusBadge status={tracking.customerStatus} />}
    </div>

    {loading ? (
      <p className="mt-6 text-sm text-black/40">Loading tracking...</p>
    ) : !tracking ? (
      <p className="mt-6 text-sm text-black/40">Tracking will appear after the paid order enters production.</p>
    ) : (
      <>
        <div className="mt-6 grid gap-0 sm:grid-cols-5">
          {(tracking.timeline || []).filter((entry) => entry.key !== "cancelled").map((entry, index, list) => (
            <div key={entry.key} className="relative pb-5 sm:pb-0 sm:text-center">
              {index < list.length - 1 && <span className={`absolute left-[13px] top-[26px] h-[calc(100%-14px)] w-px sm:left-[50%] sm:top-[13px] sm:h-px sm:w-full ${entry.completed ? "bg-[#F97316]" : "bg-black/10"}`} />}
              <div className={`relative z-[1] flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-black sm:mx-auto ${entry.completed ? "border-[#F97316] bg-[#F97316] text-white" : "border-black/15 bg-white text-black/25"}`}>{entry.completed ? "✓" : index + 1}</div>
              <div className="ml-10 -mt-7 sm:ml-0 sm:mt-3"><p className="text-xs font-black">{entry.label}</p><p className="mt-1 text-[9px] text-black/30">{entry.at ? formatDate(entry.at, true) : entry.completed ? "Completed" : "Pending"}</p></div>
            </div>
          ))}
        </div>

        {tracking.production && <div className="mt-6 rounded-xl border border-black/[0.06] bg-[#FFF9F2] p-4"><p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">Production</p><div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={tracking.production.stage} /><span className="text-[10px] font-bold text-black/45">{tracking.production.jobCode}</span></div></div>}

        {(tracking.shipments || []).length > 0 && <div className="mt-6 space-y-3 border-t border-black/[0.06] pt-5">{tracking.shipments.map((shipment) => <div key={shipment.id} className="rounded-xl bg-[#FFF9F2] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={shipment.status} /><span className="text-xs font-black">{shipment.carrier || "Courier not assigned"}</span></div><p className="mt-2 text-[10px] text-black/40">{shipment.shipmentCode || shipment.id}{shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ""}</p></div>{shipment.trackingUrl && <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#171717] px-4 py-2.5 text-[10px] font-extrabold text-white transition hover:bg-[#F97316]">Courier Tracking ↗</a>}</div>{shipment.history?.length > 0 && <div className="mt-3 space-y-1 border-t border-black/[0.05] pt-3">{shipment.history.slice(-4).map((entry, index) => <p key={`${entry.status}-${entry.at}-${index}`} className="text-[9px] leading-4 text-black/40"><strong className="text-black/60">{String(entry.status || "").replaceAll("_", " ")}</strong>{entry.location ? ` · ${entry.location}` : ""}{entry.note ? ` · ${entry.note}` : ""}{entry.at ? ` · ${formatDate(entry.at, true)}` : ""}</p>)}</div>}</div>)}</div>}
      </>
    )}
  </section>
);

const CancellationCard = ({ cancellation, canRequest, reason, setReason, working, onSubmit }) => <section className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">Cancellation</p><h2 className="mt-1 text-lg font-black">Cancellation request</h2></div>{cancellation?.status && cancellation.status !== "none" && <StatusBadge status={cancellation.status} />}</div>{cancellation?.status && cancellation.status !== "none" && <div className="mt-4 rounded-xl bg-[#FFF9F2] p-4 text-sm leading-6 text-black/55">{cancellation.reason && <p><strong>Reason:</strong> {cancellation.reason}</p>}{cancellation.reviewNote && <p className="mt-2"><strong>Review note:</strong> {cancellation.reviewNote}</p>}{cancellation.requestedAt && <p className="mt-2 text-[10px] text-black/35">Requested {formatDate(cancellation.requestedAt, true)}</p>}</div>}{canRequest && <form onSubmit={onSubmit} className="mt-5"><label className="block"><span className="mb-2 block text-[10px] font-extrabold uppercase tracking-wider text-black/40">Why do you want to cancel?</span><textarea rows="4" maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tell us the reason for your cancellation request." className="w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-[#F97316]" /></label><p className="mt-2 text-[10px] leading-5 text-black/35">Requests are reviewed before dispatch. Approval can start a refund to the original payment method.</p><button type="submit" disabled={working} className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-40">{working ? "Submitting..." : "Request Cancellation"}</button></form>}</section>;

const OrderItem = ({ item }) => {
  const tax = item.tax || {};
  const components = item.customHamper?.components || [];
  const decorations = item.customHamper?.decorations || [];
  const personalization = item.customHamper?.personalization;
  return <article className="py-5 first:pt-0 last:pb-0"><div className="flex gap-4"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#F5F1EC]">{item.image ? <img src={item.image} alt={item.productName || item.skuName} className="h-full w-full object-cover" /> : null}</div><div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-black">{item.productName || item.skuName || "HAMPORIUM item"}</p><p className="mt-1 text-xs text-black/40">{item.skuName || item.skuCode || ""} · Qty {item.quantity}</p></div><p className="font-black">{formatCurrency(item.lineTotal)}</p></div>{(item.taxableAmount !== undefined || tax.gstRate !== undefined || tax.hsnSac) && <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold text-black/40">{item.baseLineTotal !== undefined && <span>Base {formatCurrency(item.baseLineTotal)}</span>}{item.taxableAmount !== undefined && <span>Taxable {formatCurrency(item.taxableAmount)}</span>}{tax.gstRate !== undefined && <span>GST {tax.gstRate}%</span>}{tax.hsnSac && <span>HSN/SAC {tax.hsnSac}</span>}</div>}{components.length > 0 && <div className="mt-3 rounded-xl bg-[#FFF9F2] p-3"><p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">Custom hamper contents</p><div className="mt-2 space-y-1">{components.map((component, index) => <p key={component.component || `${component.code}-${index}`} className="text-[10px] text-black/50">{component.name} × {component.quantity} · {formatCurrency(component.lineTotal)}</p>)}</div></div>}{decorations.length > 0 && <div className="mt-3 rounded-xl border border-[#D4AF37]/20 bg-[#FFFDF8] p-3"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#8A6D15]">Decorative finishing</p><div className="mt-2 space-y-1">{decorations.map((decoration, index) => <p key={decoration.component || `${decoration.code}-${index}`} className="text-[10px] text-black/50">{decoration.name} × {decoration.quantity} · {formatCurrency(decoration.lineTotal)}</p>)}</div></div>}{personalization?.enabled && <div className="mt-3 rounded-xl border border-[#F97316]/15 bg-[#FFF7F0] p-3"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#F97316]">Your personalisation</p>{personalization.message && <p className="mt-2 text-[10px] leading-5 text-black/50"><strong>Text:</strong> {personalization.message}</p>}{personalization.instructions && <p className="mt-1 text-[10px] leading-5 text-black/45"><strong>Instructions:</strong> {personalization.instructions}</p>}</div>}</div></div></article>;
};

const HeroStat = ({ label, value, borderLeft = false, borderTop = false }) => <div className={`flex min-h-[110px] flex-col justify-center p-5 ${borderLeft ? "border-l border-white/10" : ""} ${borderTop ? "border-t border-white/10" : ""}`}><p className="text-[9px] font-extrabold uppercase tracking-wider text-white/35">{label}</p><p className="mt-2 break-words text-sm font-black text-white">{value}</p></div>;
const formatAddress = (address) => address ? [address.fullName, address.addressLine1, address.addressLine2, address.landmark, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(", ") : "—";

export default OrderDetails;
