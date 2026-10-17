import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import OrderTaxSummary from "../../../components/OrderTaxSummary.jsx";
import StatusBadge from "../../../components/StatusBadge.jsx";
import formatCurrency from "../../../utils/formatCurrency.js";
import formatDate from "../../../utils/formatDate.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const STATUS_TRANSITIONS = {
  pending_payment: [],
  payment_failed: [],
  confirmed: ["processing"],
  processing: [],
  shipped: [],
  delivered: [],
  cancelled: [],
};

const OrderDetails = () => {
  const { orderId } = useParams();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  const loadOrder = async () => {
    const response = await api.get(`/admin/orders/${orderId}`);
    setOrder(response.data.order);
    return response.data.order;
  };


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        await loadOrder();
      } catch (requestError) {
        setOrder(null);
        setError(
          requestError.response?.data?.message || "Unable to load order"
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orderId]);

  const refresh = async () => {
    await loadOrder();
  };

  const updateStatus = async (status) => {
    if (!status) return;

    const confirmed = window.confirm(
      `Change order status to ${status.replaceAll("_", " ")}?`
    );
    if (!confirmed) return;

    setWorking(true);
    setError("");
    setNotice("");

    try {
      const response = await api.patch(`/admin/orders/${orderId}/status`, {
        status,
      });
      setNotice(response.data.message || "Order status updated.");
      await refresh();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to update order"
      );
    } finally {
      setWorking(false);
    }
  };

  const reviewCancellation = async (decision) => {
    const confirmed = window.confirm(
      decision === "approve"
        ? "Approve voluntary cancellation? This cancels the order WITHOUT initiating a payment refund. Confirm the customer acknowledged the policy."
        : "Reject this cancellation request?"
    );
    if (!confirmed) return;

    setWorking(true);
    setError("");
    setNotice("");

    try {
      const response = await api.patch(
        `/admin/orders/cancellations/${orderId}/review`,
        {
          decision,
          note: reviewNote.trim(),
        }
      );

      setNotice(response.data.message || "Cancellation reviewed.");
      setReviewNote("");
      await refresh();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to review cancellation"
      );
    } finally {
      setWorking(false);
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

  if (!order) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        {error || "Order not found"}
      </div>
    );
  }

  const nextStatuses = STATUS_TRANSITIONS[order.status] || [];
  const cancellation = order.cancellation || {};
  return (
    <div
      className="mx-auto w-full max-w-[1600px] pb-12 text-[#171717]"
      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/orders"
          className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#F97316]"
        >
          ← Back to Orders
        </Link>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/production"
            className="rounded-lg border border-black/10 px-3 py-2 text-[10px] font-bold hover:border-[#F97316] hover:text-[#F97316]"
          >
            Production
          </Link>
          <Link
            to="/admin/fulfilment"
            className="rounded-lg border border-black/10 px-3 py-2 text-[10px] font-bold hover:border-[#F97316] hover:text-[#F97316]"
          >
            Fulfilment
          </Link>
          <Link
            to="/admin/orders?queue=cancellations"
            className="rounded-lg bg-[#171717] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#F97316]"
          >
            Cancellation Queue
          </Link>
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-[28px] bg-[#171717] text-white">
        <div className="grid lg:grid-cols-[1.35fr_.65fr]">
          <div className="p-6 sm:p-8 lg:p-9">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#D4AF37]">
              Customer Order
            </p>
            <h1
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-2 text-[40px] font-semibold leading-none sm:text-[50px]"
            >
              {order.orderNumber}
            </h1>
            <p className="mt-3 text-xs text-white/40">
              Created {formatDate(order.createdAt, true)}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge status={order.status} />
              <StatusBadge status={order.paymentStatus} />
              {cancellation.status && cancellation.status !== "none" && (
                <StatusBadge
                  status={cancellation.status}
                  label={`Cancellation ${cancellation.status}`}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-white/10 lg:border-l lg:border-t-0">
            <HeroStat label="Order Total" value={formatCurrency(order.totalAmount)} />
            <HeroStat label="Items" value={itemCount} borderLeft />
            <HeroStat
              label="Delivery"
              value={order.deliveryDate ? formatDate(order.deliveryDate) : "—"}
              borderTop
            />
            <HeroStat
              label="Checkout"
              value={order.checkoutMode === "buy_now" ? "Buy Now" : "Cart"}
              borderLeft
              borderTop
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_430px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">
                  Order Workflow
                </p>
                <h2 className="mt-1 text-lg font-black">Order status</h2>
                <p className="mt-2 text-xs leading-5 text-black/40">
                  Production and shipment stages should normally be advanced from their dedicated operations screens.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {nextStatuses.length ? (
                  nextStatuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={working}
                      onClick={() => updateStatus(status)}
                      className="rounded-xl bg-[#F97316] px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-white transition hover:bg-[#171717] disabled:opacity-40"
                    >
                      Mark {status.replaceAll("_", " ")}
                    </button>
                  ))
                ) : (
                  <StatusBadge status={order.status} />
                )}
              </div>
            </div>
          </section>

          {cancellation.status === "requested" && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                    Action Required
                  </p>
                  <h2 className="mt-1 text-lg font-black">Cancellation request</h2>
                </div>
                <StatusBadge status="requested" />
              </div>

              {cancellation.customerAcknowledgedNoRefundAt && (
                <p className="mt-3 text-xs font-bold text-amber-800">Customer acknowledged the voluntary cancellation policy on {formatDate(cancellation.customerAcknowledgedNoRefundAt, true)}.</p>
              )}
              {!cancellation.customerAcknowledgedNoRefundAt && (
                <p className="mt-3 text-xs font-bold text-red-700">Legacy request: policy acknowledgement not recorded. Backend may reject approval.</p>
              )}
              <p className="mt-4 rounded-xl bg-white/70 p-4 text-sm leading-6 text-black/65">
                {cancellation.reason || "No reason supplied."}
              </p>

              <textarea
                rows="3"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Optional review note"
                className="mt-4 w-full rounded-xl border border-black/10 bg-white p-3 text-sm outline-none focus:border-[#F97316]"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => reviewCancellation("reject")}
                  className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-xs font-extrabold text-red-700 disabled:opacity-40"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => reviewCancellation("approve")}
                  className="rounded-xl bg-[#F97316] px-5 py-3 text-xs font-extrabold text-white transition hover:bg-[#171717] disabled:opacity-40"
                >
                  Approve Cancellation
                </button>
              </div>
            </section>
          )}

          {cancellation.status && cancellation.status !== "none" && cancellation.status !== "requested" && (
            <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#F97316]">Cancellation</p>
                  <h2 className="mt-1 text-lg font-black">Review outcome</h2>
                </div>
                <StatusBadge status={cancellation.status} />
              </div>
              <p className="mt-4 text-sm leading-6 text-black/55">
                <strong>Reason:</strong> {cancellation.reason || "—"}
              </p>
              {cancellation.reviewNote && (
                <p className="mt-2 text-sm leading-6 text-black/55">
                  <strong>Review note:</strong> {cancellation.reviewNote}
                </p>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">Items</p>
            <h2 className="mt-1 text-lg font-black">Order snapshot</h2>

            <div className="mt-5 divide-y divide-black/[0.06]">
              {(order.items || []).map((item, index) => (
                <div key={item.sku || item.product || index} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <p className="text-sm font-black">{item.productName || item.skuName || "Item"}</p>
                      <p className="mt-1 text-xs text-black/40">
                        {item.skuName || item.skuCode || ""} · Qty {item.quantity}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold text-black/35">
                        {item.taxableAmount !== undefined && (
                          <span>Taxable {formatCurrency(item.taxableAmount)}</span>
                        )}
                        {item.tax?.gstRate !== undefined && <span>GST {item.tax.gstRate}%</span>}
                        {item.tax?.hsnSac && <span>HSN/SAC {item.tax.hsnSac}</span>}
                      </div>
                    </div>
                    <p className="text-sm font-black">{formatCurrency(item.lineTotal)}</p>
                  </div>

                  {item.customHamper?.components?.length > 0 && (
                    <div className="mt-3 rounded-xl bg-[#FFF9F2] p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">Inside contents</p>
                      <div className="mt-1.5 space-y-1">
                        {item.customHamper.components.map((component, componentIndex) => (
                          <p key={component.component || `${component.code}-${componentIndex}`} className="text-[10px] text-black/50">
                            {component.name} × {component.quantity} · {formatCurrency(component.lineTotal)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.customHamper?.decorations?.length > 0 && (
                    <div className="mt-3 rounded-xl border border-[#D4AF37]/20 bg-[#FFFDF8] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#8A6D15]">Decorative finishing</p>
                        <span className="text-[9px] font-bold text-black/35">No capacity impact</span>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {item.customHamper.decorations.map((decoration, decorationIndex) => (
                          <p key={decoration.component || `${decoration.code}-${decorationIndex}`} className="text-[10px] text-black/50">
                            {decoration.name} × {decoration.quantity} · {formatCurrency(decoration.lineTotal)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.customHamper?.personalization?.enabled && (
                    <div className="mt-3 rounded-xl border border-[#F97316]/20 bg-[#FFF7F0] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#F97316]">Customer artwork / personalisation</p>
                        <span className="text-[9px] font-bold text-black/35">Production reference</span>
                      </div>

                      {item.customHamper.personalization.assets?.length > 0 && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {item.customHamper.personalization.assets.map((asset, assetIndex) => (
                            <a
                              key={`${asset.url}-${assetIndex}`}
                              href={asset.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white p-2 transition hover:border-[#F97316]/40"
                            >
                              <img src={asset.url} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-[#F5F1EC] object-contain p-1" />
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-black capitalize text-black/60">{String(asset.type || "artwork").replaceAll("_", " ")}</p>
                                <p className="mt-0.5 text-[9px] font-semibold capitalize text-black/35">Placement: {String(asset.placement || "other").replaceAll("_", " ")}</p>
                                {asset.fileName && <p className="mt-0.5 truncate text-[9px] text-black/30">{asset.fileName}</p>}
                                {asset.notes && <p className="mt-0.5 line-clamp-2 text-[9px] text-black/40">{asset.notes}</p>}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}

                      {item.customHamper.personalization.message && (
                        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[10px] leading-5 text-black/55"><strong>Text:</strong> {item.customHamper.personalization.message}</p>
                      )}
                      {item.customHamper.personalization.instructions && (
                        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[10px] leading-5 text-black/55"><strong>Production instructions:</strong> {item.customHamper.personalization.instructions}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>


        </div>

        <aside className="space-y-6">
          <OrderTaxSummary order={order} />

          <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#F97316]">Customer</p>
            <p className="mt-2 font-black">{order.user?.name || order.user?.email || "—"}</p>
            <p className="mt-1 text-xs text-black/40">{order.user?.email || ""}</p>

            <div className="mt-5 border-t border-black/[0.06] pt-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">Recipient</p>
              <p className="mt-2 text-sm font-black">{order.recipient?.fullName || "—"}</p>
              <p className="mt-1 text-xs text-black/40">{order.recipient?.phone || "—"}</p>
            </div>

            <div className="mt-5 border-t border-black/[0.06] pt-5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">Delivery Address</p>
              <p className="mt-2 text-sm leading-6 text-black/55">{formatAddress(order.deliveryAddress)}</p>
            </div>
          </section>

        </aside>
      </div>
    </div>
  );
};

const HeroStat = ({ label, value, borderLeft = false, borderTop = false }) => (
  <div className={`flex min-h-[112px] flex-col justify-center p-5 ${borderLeft ? "border-l border-white/10" : ""} ${borderTop ? "border-t border-white/10" : ""}`}>
    <p className="text-[9px] font-extrabold uppercase tracking-wider text-white/35">{label}</p>
    <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
  </div>
);

const formatAddress = (address) => {
  if (!address) return "—";
  return [
    address.fullName,
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ].filter(Boolean).join(", ");
};

export default OrderDetails;
