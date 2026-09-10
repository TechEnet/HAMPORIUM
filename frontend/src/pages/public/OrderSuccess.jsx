import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import OrderTaxSummary from "../../components/OrderTaxSummary.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";
import { downloadOrderInvoice } from "../../utils/invoice.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const OrderSuccess = () => {
  const { orderId } = useParams();

  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const orderResponse = await api.get(`/orders/${orderId}`);
        if (!active) return;

        const loadedOrder = orderResponse.data.order;
        setOrder(loadedOrder);

        try {
          const trackingResponse = await api.get(`/orders/${orderId}/tracking`);
          if (active) {
            setTracking(trackingResponse.data?.tracking || null);
          }
        } catch (trackingError) {
          if (trackingError.response?.status !== 404) {
            console.error("Unable to load initial tracking:", trackingError);
          }
          if (active) setTracking(null);
        }
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError.response?.data?.message ||
            "Unable to load order details"
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [orderId]);

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
      setInvoiceError(
        downloadError.message || "Unable to download invoice"
      );
    } finally {
      setInvoiceDownloading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-[#FFF9F2] px-5 pb-20 pt-[120px] sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20">
        <div className="mx-auto w-full max-w-[1080px]">
          <div className="flex flex-col items-center text-center">
            <div className="h-20 w-20 animate-pulse rounded-full bg-black/[0.07]" />
            <div className="mt-6 h-3 w-32 animate-pulse rounded-full bg-[#F97316]/20" />
            <div className="mt-4 h-10 w-[70%] max-w-[520px] animate-pulse rounded-lg bg-black/[0.08]" />
          </div>
          <div className="mt-10 h-[560px] animate-pulse rounded-[22px] bg-black/[0.05]" />
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF9F2] px-5 py-[120px]">
        <div className="w-full max-w-[560px] rounded-[22px] border border-black/[0.07] bg-white p-8 text-center shadow-[0_16px_45px_rgba(23,23,23,.07)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl font-bold text-red-500">
            !
          </div>
          <h1
            style={{ fontFamily: DISPLAY_FONT }}
            className="mt-5 text-[38px] font-semibold leading-none"
          >
            Unable to load order
          </h1>
          <p className="mt-4 text-[12px] font-semibold text-red-600">
            {error || "Order not found"}
          </p>
          <Link
            to="/account/orders"
            className="mt-7 inline-flex h-[46px] items-center justify-center rounded-full bg-[#F97316] px-6 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:bg-[#171717]"
          >
            View My Orders
          </Link>
        </div>
      </main>
    );
  }

  const paymentSuccessful = [
    "paid",
    "partially_refunded",
    "refunded",
  ].includes(order.paymentStatus);

  const expectedDelivery = tracking?.deliveryDate || order.deliveryDate;
  const timeline = (tracking?.timeline || []).filter(
    (entry) => entry.key !== "cancelled"
  );

  return (
    <main
      className="min-h-screen w-full bg-[#FFF9F2] text-[#171717]"
      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}
    >
      <section className="w-full px-5 pb-20 pt-[115px] sm:px-8 md:px-10 lg:px-12 lg:pt-[125px] xl:px-16 2xl:px-20">
        <div className="mx-auto w-full max-w-[1080px]">
          <div className="text-center">
            <div
              className={`mx-auto flex h-[82px] w-[82px] items-center justify-center rounded-full border-[5px] border-white text-[31px] font-bold text-white shadow-[0_15px_35px_rgba(23,23,23,.12)] ${
                paymentSuccessful ? "bg-emerald-600" : "bg-[#F97316]"
              }`}
            >
              {paymentSuccessful ? "✓" : "!"}
            </div>

            <p
              className={`mt-6 text-[10px] font-extrabold uppercase tracking-[0.2em] ${
                paymentSuccessful ? "text-emerald-600" : "text-[#F97316]"
              }`}
            >
              {paymentSuccessful ? "Payment Successful" : "Order Received"}
            </p>

            <h1
              style={{ fontFamily: DISPLAY_FONT }}
              className="mx-auto mt-3 max-w-[760px] text-[46px] font-semibold leading-[0.95] tracking-[-0.035em] sm:text-[56px] lg:text-[62px]"
            >
              {paymentSuccessful
                ? "Your gift order is confirmed."
                : "Your order has been created."}
            </h1>

            <p className="mt-4 text-[12px] font-medium text-black/45 sm:text-[13px]">
              Thank you for choosing HAMPORIUM.
            </p>
          </div>

          {expectedDelivery && (
            <div className="mx-auto mt-8 max-w-[760px] rounded-[20px] border border-[#D4AF37]/30 bg-white px-6 py-5 text-center shadow-[0_10px_30px_rgba(23,23,23,.04)]">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#8D6C18]">
                Expected Delivery
              </p>
              <p
                style={{ fontFamily: DISPLAY_FONT }}
                className="mt-2 text-[31px] font-semibold text-[#171717]"
              >
                {formatDate(expectedDelivery)}
              </p>
              <p className="mt-2 text-[10px] leading-5 text-black/40">
                This promise was calculated by HAMPORIUM from product readiness,
                production lead time and delivery destination. Live status below is
                updated only from real production and fulfilment events.
              </p>
            </div>
          )}

          <div className="mt-10 overflow-hidden rounded-[22px] border border-black/[0.07] bg-white shadow-[0_16px_45px_rgba(23,23,23,.065)]">
            <div className="grid gap-6 border-b border-black/[0.06] bg-[#171717] px-6 py-6 text-white sm:grid-cols-2 lg:grid-cols-4 lg:px-7">
              <SummaryInfo label="Order Number">{order.orderNumber}</SummaryInfo>
              <SummaryInfo label="Total">
                <span className="text-[#D4AF37]">
                  {formatCurrency(order.totalAmount)}
                </span>
              </SummaryInfo>
              <div>
                <SummaryLabel>Order Status</SummaryLabel>
                <div className="mt-2">
                  <StatusBadge status={tracking?.customerStatus || order.status} />
                </div>
              </div>
              <div>
                <SummaryLabel>Payment Status</SummaryLabel>
                <div className="mt-2">
                  <StatusBadge status={order.paymentStatus} />
                </div>
              </div>
            </div>

            {timeline.length > 0 && (
              <div className="border-b border-black/[0.06] px-6 py-6 lg:px-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#F97316]">
                      Live Order Progress
                    </p>
                    <h2
                      style={{ fontFamily: DISPLAY_FONT }}
                      className="mt-1 text-[27px] font-semibold"
                    >
                      What happens next
                    </h2>
                  </div>
                  {tracking?.production?.jobCode && (
                    <p className="text-[9px] font-bold text-black/35">
                      Production {tracking.production.jobCode}
                    </p>
                  )}
                </div>

                <div className="mt-6 grid gap-0 sm:grid-cols-5">
                  {timeline.map((entry, index) => (
                    <TimelineStep
                      key={entry.key}
                      entry={entry}
                      index={index}
                      last={index === timeline.length - 1}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-6 border-b border-black/[0.06] px-6 py-6 md:grid-cols-2 lg:px-7">
              <div>
                <SectionLabel>Recipient</SectionLabel>
                <p className="mt-3 text-[13px] font-extrabold">
                  {order.recipient?.fullName || "—"}
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-black/40">
                  {order.recipient?.phone || "—"}
                </p>
              </div>

              <div>
                <SectionLabel>Expected Delivery</SectionLabel>
                <p className="mt-3 text-[13px] font-extrabold text-[#F97316]">
                  {expectedDelivery ? formatDate(expectedDelivery) : "Calculating..."}
                </p>
              </div>
            </div>

            <div className="border-b border-black/[0.06] px-6 py-6 lg:px-7">
              <SectionLabel>Delivery Address</SectionLabel>
              <p className="mt-3 max-w-[760px] text-[12px] font-medium leading-6 text-black/50">
                {formatAddress(order.deliveryAddress)}
              </p>
            </div>

            {order.giftMessage && (
              <div className="border-b border-black/[0.06] bg-[#FFF9F2] px-6 py-6 lg:px-7">
                <SectionLabel>Gift Message</SectionLabel>
                <p
                  style={{ fontFamily: DISPLAY_FONT }}
                  className="mt-3 max-w-[760px] whitespace-pre-wrap text-[20px] font-medium italic leading-7 text-black/60"
                >
                  “{order.giftMessage}”
                </p>
              </div>
            )}

            <div className="px-6 py-6 lg:px-7">
              <SectionLabel>Ordered Items</SectionLabel>
              <div className="mt-5 divide-y divide-black/[0.06]">
                {(order.items || []).map((item, index) => (
                  <div
                    key={item.sku || item.product || `${index}`}
                    className="flex gap-4 py-4 first:pt-0 last:pb-0 sm:items-center"
                  >
                    <div className="h-[82px] w-[82px] shrink-0 overflow-hidden rounded-[12px] bg-[#F4EFE9]">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.productName || item.skuName || "Order item"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[9px] font-semibold text-black/25">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-extrabold leading-5">
                        {item.productName || item.skuName || "HAMPORIUM item"}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-black/35">
                        {item.skuName || item.skuCode || ""}
                      </p>
                      <p className="mt-2 text-[10px] font-medium text-black/45">
                        {formatCurrency(item.unitPrice)} × {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-[12px] font-extrabold">
                      {formatCurrency(item.lineTotal)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-[760px]">
            <OrderTaxSummary order={order} />
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {paymentSuccessful && (
              <button
                type="button"
                onClick={handleInvoiceDownload}
                disabled={invoiceDownloading}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[11px] border border-[#D4AF37] bg-[#D4AF37] px-7 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#171717] transition hover:bg-[#E2C75F] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {invoiceDownloading ? "Downloading..." : "Download Invoice"}
              </button>
            )}

            <Link
              to={`/account/orders/${order._id}`}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[11px] border border-[#171717] bg-[#171717] px-7 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:border-[#F97316] hover:bg-[#F97316]"
            >
              Full Tracking
            </Link>

            <Link
              to={`/account/support?orderId=${encodeURIComponent(order._id)}`}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[11px] border border-black/15 bg-white px-7 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#171717] transition hover:border-[#F97316] hover:text-[#F97316]"
            >
              Need Help?
            </Link>

            <Link
              to="/account/orders"
              className="inline-flex min-h-[48px] items-center justify-center rounded-[11px] bg-[#F97316] px-7 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:bg-[#171717]"
            >
              View My Orders
            </Link>

            <Link
              to="/gifts"
              className="inline-flex min-h-[48px] items-center justify-center rounded-[11px] border border-[#F97316] bg-transparent px-7 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#F97316] transition hover:bg-[#F97316] hover:text-white"
            >
              Continue Shopping
            </Link>
          </div>

          {invoiceError && (
            <p className="mt-3 text-center text-[10px] font-semibold text-red-600">
              {invoiceError}
            </p>
          )}
        </div>
      </section>
    </main>
  );
};

const TimelineStep = ({ entry, index, last }) => (
  <div className="relative pb-5 sm:pb-0 sm:text-center">
    {!last && (
      <span
        className={`absolute left-[13px] top-[26px] h-[calc(100%-14px)] w-px sm:left-[50%] sm:top-[13px] sm:h-px sm:w-full ${
          entry.completed ? "bg-[#F97316]" : "bg-black/10"
        }`}
      />
    )}
    <div
      className={`relative z-[1] flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-black sm:mx-auto ${
        entry.completed
          ? "border-[#F97316] bg-[#F97316] text-white"
          : "border-black/15 bg-white text-black/25"
      }`}
    >
      {entry.completed ? "✓" : index + 1}
    </div>
    <div className="ml-10 -mt-7 sm:ml-0 sm:mt-3">
      <p className="text-xs font-black">{entry.label}</p>
      <p className="mt-1 text-[9px] text-black/30">
        {entry.at
          ? formatDate(entry.at, true)
          : entry.completed
            ? "Completed"
            : "Pending"}
      </p>
    </div>
  </div>
);

const SummaryInfo = ({ label, children }) => (
  <div>
    <SummaryLabel>{label}</SummaryLabel>
    <div className="mt-2 text-[12px] font-extrabold text-white">
      {children}
    </div>
  </div>
);

const SummaryLabel = ({ children }) => (
  <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/35">
    {children}
  </p>
);

const SectionLabel = ({ children }) => (
  <h2
    style={{ fontFamily: DISPLAY_FONT }}
    className="text-[25px] font-semibold leading-none text-[#171717]"
  >
    {children}
  </h2>
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
  ]
    .filter(Boolean)
    .join(", ");
};

export default OrderSuccess;
