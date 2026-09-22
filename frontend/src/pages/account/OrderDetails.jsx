import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import api from "../../api/api.js";
import OrderTaxSummary from "../../components/OrderTaxSummary.jsx";
import ReviewForm from "../../components/reviews/ReviewForm.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";
import { downloadOrderInvoice } from "../../utils/invoice.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");

const isCustomHamperOrderItem = (item) => {
  if (!item) {
    return false;
  }

  if (
    item.itemType ===
    "custom_hamper"
  ) {
    return true;
  }

  if (item.customHamper) {
    return true;
  }

  if (
    String(
      item.skuCode || ""
    )
      .trim()
      .toUpperCase() ===
    "CUSTOM-HAMPER"
  ) {
    return true;
  }

  const productName =
    String(
      item.productName ||
        ""
    ).toLowerCase();

  const skuName =
    String(
      item.skuName || ""
    ).toLowerCase();

  return (
    productName.includes(
      "custom hamper"
    ) ||
    skuName.includes(
      "custom hamper"
    )
  );
};

const getReviewTarget = (item) => {
  const productId =
    item?.product?._id ||
    item?.product ||
    item?.productId ||
    item?.sku?.product?._id ||
    item?.sku?.product ||
    "";

  if (productId) {
    return {
      targetType: "product",
      productId:
        String(productId),
    };
  }

  if (
    isCustomHamperOrderItem(
      item
    )
  ) {
    return {
      targetType:
        "custom_hamper",
      productId: "",
    };
  }

  return null;
};

const getReviewItemName = (item) =>
  item?.customHamper?.containerName ||
  item?.productName ||
  item?.product?.name ||
  item?.skuName ||
  "Purchased item";

const OrderDetails = () => {
  const { orderId } =
    useParams();

  const [order, setOrder] =
    useState(null);

  const [tracking, setTracking] =
    useState(null);

  const [refunds, setRefunds] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    trackingLoading,
    setTrackingLoading,
  ] = useState(true);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [
    invoiceDownloading,
    setInvoiceDownloading,
  ] = useState(false);

  const [
    invoiceError,
    setInvoiceError,
  ] = useState("");

  const [
    cancellationReason,
    setCancellationReason,
  ] = useState("");

  const [
    cancellationWorking,
    setCancellationWorking,
  ] = useState(false);

  const [
    reviewingProductId,
    setReviewingProductId,
  ] = useState("");

  const loadOrder = async () => {
    const response =
      await api.get(
        `/orders/${orderId}`
      );

    setOrder(
      response.data.order
    );

    return response.data.order;
  };

  const loadTracking = async ({
    silent = false,
  } = {}) => {
    if (!silent) {
      setTrackingLoading(
        true
      );
    }

    try {
      const response =
        await api.get(
          `/orders/${orderId}/tracking`
        );

      setTracking(
        response.data
          .tracking || null
      );
    } catch (
      requestError
    ) {
      if (
        requestError.response
          ?.status !== 404
      ) {
        console.error(
          "Unable to load order tracking:",
          requestError
        );
      }

      if (!silent) {
        setTracking(null);
      }
    } finally {
      if (!silent) {
        setTrackingLoading(
          false
        );
      }
    }
  };

  const loadRefunds =
    async () => {
      try {
        const response =
          await api.get(
            "/refunds/mine?limit=100"
          );

        const list =
          response.data
            .refunds || [];

        setRefunds(
          list.filter(
            (refund) =>
              String(
                refund.order
                  ?._id ||
                  refund.order ||
                  ""
              ) ===
              String(orderId)
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
        const response =
          await api.get(
            `/orders/${orderId}`
          );

        if (!active) {
          return;
        }

        setOrder(
          response.data.order
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
            "Unable to load order"
        );
      } finally {
        if (active) {
          setLoading(
            false
          );
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (!order?._id) {
      return undefined;
    }

    void loadTracking();
    void loadRefunds();

    const terminal =
      [
        "delivered",
        "cancelled",
      ].includes(
        tracking?.customerStatus ||
          order.status
      );

    if (terminal) {
      return undefined;
    }

    const timer =
      window.setInterval(
        () => {
          void loadTracking({
            silent: true,
          });
        },
        60000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    order?._id,
    order?.status,
    tracking?.customerStatus,
  ]);

  const handleInvoiceDownload =
    async () => {
      if (!order?._id) {
        return;
      }

      setInvoiceDownloading(
        true
      );

      setInvoiceError("");

      try {
        await downloadOrderInvoice(
          {
            orderId:
              order._id,

            orderNumber:
              order.orderNumber,
          }
        );
      } catch (
        downloadError
      ) {
        setInvoiceError(
          downloadError.message ||
            "Unable to download invoice"
        );
      } finally {
        setInvoiceDownloading(
          false
        );
      }
    };

  const submitCancellation =
    async (event) => {
      event.preventDefault();

      const reason =
        cancellationReason.trim();

      if (
        reason.length < 5
      ) {
        setError(
          "Please enter a cancellation reason of at least 5 characters."
        );

        return;
      }

      if (
        !window.confirm(
          "Submit this cancellation request for admin review?"
        )
      ) {
        return;
      }

      setCancellationWorking(
        true
      );

      setError("");
      setNotice("");

      try {
        const response =
          await api.post(
            `/orders/${orderId}/cancellation`,
            {
              reason,
            }
          );

        setNotice(
          response.data
            .message ||
            "Cancellation request submitted."
        );

        setCancellationReason(
          ""
        );

        await Promise.all([
          loadOrder(),
          loadTracking(),
          loadRefunds(),
        ]);
      } catch (
        requestError
      ) {
        setError(
          requestError.response
            ?.data?.message ||
            "Unable to request cancellation"
        );
      } finally {
        setCancellationWorking(
          false
        );
      }
    };

  const itemCount =
    useMemo(
      () =>
        (
          order?.items || []
        ).reduce(
          (
            total,
            item
          ) =>
            total +
            Number(
              item.quantity ||
                0
            ),
          0
        ),
      [order?.items]
    );

  const reviewableItems =
    useMemo(() => {
      const seen = new Set();

      return (
        order?.items || []
      ).reduce(
        (
          list,
          item,
          index
        ) => {
          const target =
            getReviewTarget(
              item
            );

          if (!target) {
            return list;
          }

          const targetKey =
            target.targetType ===
            "product"
              ? `product:${target.productId}`
              : "custom_hamper:order";

          if (
            seen.has(
              targetKey
            )
          ) {
            return list;
          }

          seen.add(
            targetKey
          );

          list.push({
            key:
              item?._id ||
              `${targetKey}-${index}`,
            ...target,
            name:
              getReviewItemName(
                item
              ),
            image:
              item?.image ||
              item?.customHamper
                ?.containerImage ||
              "",
          });

          return list;
        },
        []
      );
    }, [order?.items]);

  useEffect(() => {
    if (!order?._id) {
      return undefined;
    }

    if (
      window.location.hash !==
      "#review-order"
    ) {
      return undefined;
    }

    const timer =
      window.setTimeout(
        () => {
          document
            .getElementById(
              "review-order"
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
        },
        80
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [order?._id]);

  if (loading) {
    return (
      <OrderDetailsLoading />
    );
  }

  if (
    error &&
    !order
  ) {
    return (
      <p className="border-l-2 border-red-500 pl-4 text-[13px] font-semibold text-red-600">
        {error}
      </p>
    );
  }

  if (!order) {
    return null;
  }

  const paymentSuccessful =
    [
      "paid",
      "partially_refunded",
      "refunded",
    ].includes(
      order.paymentStatus
    );

  const cancellation =
    order.cancellation || {};

  const customerStatus =
    tracking?.customerStatus ||
    order.status;

  const delivered =
    normalizeStatus(
      customerStatus
    ).includes(
      "delivered"
    ) ||
    normalizeStatus(
      order.status
    ).includes(
      "delivered"
    );

  const canRequestCancellation =
    [
      "paid",
      "partially_refunded",
    ].includes(
      order.paymentStatus
    ) &&
    ![
      "shipped",
      "delivered",
      "cancelled",
    ].includes(
      order.status
    ) &&
    ![
      "requested",
      "approved",
    ].includes(
      cancellation.status
    );

  return (
    <main
      className="order-details mx-auto w-full max-w-[1420px] pb-16 text-[#181715]"
      style={{
        fontFamily:
          "'Manrope', Arial, sans-serif",
      }}
    >
      <style>{`
        .order-details {
          --od-orange: #F47822;
          --od-gold: #C59B2C;
          --od-dark-gold: #906A16;
          --od-ink: #181715;
        }

        .od-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }

        .od-hero::after {
          content: "H";
          position: absolute;
          right: 0;
          bottom: -100px;
          z-index: -1;

          font-family: ${DISPLAY_FONT};
          font-size: clamp(230px, 30vw, 430px);
          font-style: italic;
          font-weight: 600;
          line-height: 1;

          color:
            rgba(197,155,44,.045);

          pointer-events: none;
        }

        .od-gold {
          background:
            linear-gradient(
              120deg,
              #966D16,
              #D3AA3C 50%,
              #987016
            );

          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .od-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;

          transition:
            color .3s ease,
            transform .3s cubic-bezier(.22,1,.36,1);
        }

        .od-link::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -5px;

          width: 0;
          height: 1px;

          background:
            linear-gradient(
              90deg,
              var(--od-orange),
              var(--od-gold)
            );

          transition:
            width .35s cubic-bezier(.22,1,.36,1);
        }

        .od-link:hover {
          color:
            var(--od-orange);

          transform:
            translateX(2px);
        }

        .od-link:hover::after {
          width: 100%;
        }

        .od-product-image img {
          transition:
            transform .7s
            cubic-bezier(.16,1,.3,1);
        }

        .od-product-image:hover img {
          transform:
            scale(1.04);
        }
      `}</style>

      {/* =====================================================
          TOP NAV
      ===================================================== */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/account/orders"
          className="od-link text-[11px] font-extrabold uppercase tracking-[0.08em] text-black/45"
        >
          ← My Orders
        </Link>

        <Link
          to={`/account/support?orderId=${order._id}`}
          className="od-link text-[11px] font-extrabold uppercase tracking-[0.08em] text-black/45"
        >
          Support ↗
        </Link>
      </div>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="od-hero mt-7 border-y border-black/[0.09] py-9 sm:py-11">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#906A16]">
              Order
            </p>

            <h1
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="mt-2 break-all text-[48px] font-semibold leading-[0.9] tracking-[-0.05em] sm:text-[62px]"
            >
              {order.orderNumber}
            </h1>

            <p className="mt-4 text-[12px] font-medium text-black/40">
              {formatDate(
                order.createdAt,
                true
              )}
            </p>

            <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
              <StatusText
                label="Order"
                status={
                  customerStatus
                }
              />

              <StatusText
                label="Payment"
                status={
                  order.paymentStatus
                }
              />

              {cancellation.status &&
                cancellation.status !==
                  "none" && (
                  <StatusText
                    label="Cancellation"
                    status={
                      cancellation.status
                    }
                  />
                )}
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-black/[0.09] sm:grid-cols-4 lg:grid-cols-2 lg:border-t-0">
            <HeroStat
              label="Total"
              value={formatCurrency(
                order.totalAmount
              )}
            />

            <HeroStat
              label="Items"
              value={itemCount}
              borderLeft
            />

            <HeroStat
              label="Delivery"
              value={
                order.deliveryDate
                  ? formatDate(
                      order.deliveryDate
                    )
                  : "—"
              }
              borderTop
            />

            <HeroStat
              label="Checkout"
              value={
                order.checkoutMode ===
                "buy_now"
                  ? "Buy Now"
                  : order.checkoutMode ===
                      "quote"
                    ? "Quote"
                    : "Cart"
              }
              borderLeft
              borderTop
            />
          </div>
        </div>
      </section>

      {/* =====================================================
          NOTICES
      ===================================================== */}

      {error && (
        <p className="mt-5 border-l-2 border-red-500 pl-4 text-[12px] font-semibold text-red-600">
          {error}
        </p>
      )}

      {notice && (
        <p className="mt-5 border-l-2 border-emerald-500 pl-4 text-[12px] font-semibold text-emerald-700">
          {notice}
        </p>
      )}

      {invoiceError && (
        <p className="mt-5 border-l-2 border-red-500 pl-4 text-[12px] font-semibold text-red-600">
          {invoiceError}
        </p>
      )}

      {/* =====================================================
          BODY
      ===================================================== */}

      <div className="mt-10 grid gap-12 xl:grid-cols-[minmax(0,1.3fr)_380px]">
        <div>
          <TrackingSection
            tracking={
              tracking
            }
            loading={
              trackingLoading
            }
            order={order}
          />

          {/* ===============================================
              ITEMS
          =============================================== */}

          <section className="mt-12 border-t border-black/[0.09] pt-8">
            <div className="flex flex-wrap items-end justify-between gap-5 border-b border-black/[0.09] pb-5">
              <h2
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="text-[38px] font-semibold tracking-[-0.03em]"
              >
                Order{" "}
                <span className="od-gold italic">
                  items.
                </span>
              </h2>

              {paymentSuccessful && (
                <button
                  type="button"
                  onClick={
                    handleInvoiceDownload
                  }
                  disabled={
                    invoiceDownloading
                  }
                  className="od-link text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#906A16] disabled:pointer-events-none disabled:opacity-35"
                >
                  {invoiceDownloading
                    ? "Downloading..."
                    : "Invoice ↓"}
                </button>
              )}
            </div>

            <div>
              {(order.items || []).map(
                (
                  item,
                  index
                ) => {
                  return (
                    <div
                      key={
                        item.sku ||
                        item.product ||
                        `${index}`
                      }
                      className="border-b border-black/[0.08]"
                    >
                      <OrderItem
                        item={item}
                      />


                    </div>
                  );
                }
              )}
            </div>
          </section>

          <ReviewSection
            delivered={delivered}
            order={order}
            reviewableItems={
              reviewableItems
            }
            reviewingProductId={
              reviewingProductId
            }
            setReviewingProductId={
              setReviewingProductId
            }
            setNotice={setNotice}
          />

          {/* ===============================================
              CANCELLATION
          =============================================== */}

          {(cancellation.status &&
            cancellation.status !==
              "none") ||
          canRequestCancellation ? (
            <CancellationSection
              cancellation={
                cancellation
              }
              canRequest={
                canRequestCancellation
              }
              reason={
                cancellationReason
              }
              setReason={
                setCancellationReason
              }
              working={
                cancellationWorking
              }
              onSubmit={
                submitCancellation
              }
            />
          ) : null}

          {/* ===============================================
              REFUNDS
          =============================================== */}

          {refunds.length > 0 && (
            <section className="mt-12 border-t border-black/[0.09] pt-8">
              <div className="flex items-end justify-between gap-5 border-b border-black/[0.09] pb-5">
                <h2
                  style={{
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                  className="text-[34px] font-semibold tracking-[-0.025em]"
                >
                  Refund history
                </h2>

                <Link
                  to="/account/refunds"
                  className="od-link text-[11px] font-bold text-[#F47822]"
                >
                  All refunds →
                </Link>
              </div>

              {refunds.map(
                (refund) => (
                  <div
                    key={
                      refund._id
                    }
                    className="flex flex-col gap-4 border-b border-black/[0.08] py-6 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <StatusText
                        status={
                          refund.status
                        }
                      />

                      <p className="mt-3 text-[12px] leading-6 text-black/45">
                        {refund.reason ||
                          "Refund"}{" "}
                        ·{" "}
                        {formatDate(
                          refund.createdAt,
                          true
                        )}
                      </p>
                    </div>

                    <p
                      style={{
                        fontFamily:
                          DISPLAY_FONT,
                      }}
                      className="text-[28px] font-semibold text-[#F47822]"
                    >
                      {formatCurrency(
                        refund.amount
                      )}
                    </p>
                  </div>
                )
              )}
            </section>
          )}
        </div>

        {/* =================================================
            SIDE INFORMATION
        ================================================= */}

        <aside>
          <div className="border-b border-black/[0.09] pb-8">
            <OrderTaxSummary
              order={order}
            />
          </div>

          <section className="border-b border-black/[0.09] py-8">
            <InfoTitle>
              Recipient
            </InfoTitle>

            <p className="mt-4 text-[15px] font-bold">
              {order.recipient
                ?.fullName ||
                "—"}
            </p>

            <p className="mt-1 text-[12px] font-medium text-black/45">
              {order.recipient
                ?.phone ||
                "—"}
            </p>
          </section>

          <section className="border-b border-black/[0.09] py-8">
            <InfoTitle>
              Delivery Address
            </InfoTitle>

            <p className="mt-4 text-[13px] leading-7 text-black/55">
              {formatAddress(
                order.deliveryAddress
              )}
            </p>
          </section>

          {order.giftMessage && (
            <section className="border-b border-black/[0.09] py-8">
              <InfoTitle>
                Gift Message
              </InfoTitle>

              <p className="mt-4 whitespace-pre-wrap text-[13px] leading-7 text-black/55">
                {
                  order.giftMessage
                }
              </p>
            </section>
          )}

          <section className="py-8">
            <InfoTitle>
              Need Help?
            </InfoTitle>

            <div className="mt-5 flex flex-col items-start gap-5">
              <Link
                to={`/account/support?orderId=${order._id}`}
                className="od-link text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#F47822]"
              >
                Order support →
              </Link>

              <Link
                to="/account/notifications"
                className="od-link text-[11px] font-bold text-black/50"
              >
                Notifications ↗
              </Link>

              <Link
                to="/account/refunds"
                className="od-link text-[11px] font-bold text-black/50"
              >
                Refunds ↗
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
};

/* =========================================================
   TRACKING
========================================================= */

const TrackingSection = ({
  tracking,
  loading,
  order,
}) => (
  <section>
    <div className="flex flex-wrap items-end justify-between gap-5 border-b border-black/[0.09] pb-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#906A16]">
          Delivery
        </p>

        <h2
          style={{
            fontFamily:
              DISPLAY_FONT,
          }}
          className="mt-1 text-[38px] font-semibold tracking-[-0.03em]"
        >
          Tracking
        </h2>
      </div>

      {tracking?.customerStatus && (
        <StatusText
          status={
            tracking.customerStatus
          }
        />
      )}
    </div>

    {loading ? (
      <p className="py-8 text-[13px] text-black/40">
        Loading tracking...
      </p>
    ) : !tracking ? (
      <p className="py-8 text-[13px] leading-6 text-black/40">
        Tracking will appear once
        your order enters
        fulfilment.
      </p>
    ) : (
      <>
        <div className="py-8">
          <div className="grid gap-7 sm:grid-cols-5">
            {(tracking.timeline || [])
              .filter(
                (entry) =>
                  entry.key !==
                  "cancelled"
              )
              .map(
                (
                  entry,
                  index
                ) => (
                  <div
                    key={
                      entry.key
                    }
                    className="relative"
                  >
                    <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                          entry.completed
                            ? "border-[#F47822] bg-[#F47822] text-white"
                            : "border-black/15 text-black/30"
                        }`}
                      >
                        {entry.completed
                          ? "✓"
                          : index +
                            1}
                      </span>

                      <div>
                        <p className="text-[12px] font-bold">
                          {
                            entry.label
                          }
                        </p>

                        <p className="mt-1 text-[10px] leading-4 text-black/35">
                          {entry.at
                            ? formatDate(
                                entry.at,
                                true
                              )
                            : entry.completed
                              ? "Completed"
                              : "Pending"}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}
          </div>
        </div>

        {tracking.production && (
          <div className="flex flex-wrap items-center gap-4 border-t border-black/[0.08] py-5">
            <p className="text-[11px] font-semibold text-black/40">
              Production
            </p>

            <StatusText
              status={
                tracking.production
                  .stage
              }
            />

            <span className="text-[11px] font-semibold text-black/40">
              {
                tracking.production
                  .jobCode
              }
            </span>
          </div>
        )}

        {(tracking.shipments || [])
          .length > 0 && (
          <div className="border-t border-black/[0.08]">
            {tracking.shipments.map(
              (shipment) => (
                <div
                  key={
                    shipment.id
                  }
                  className="border-b border-black/[0.08] py-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <StatusText
                        status={
                          shipment.status
                        }
                      />

                      <p className="mt-3 text-[13px] font-bold">
                        {shipment.carrier ||
                          "Courier pending"}
                      </p>

                      <p className="mt-2 text-[11px] leading-5 text-black/40">
                        {shipment.shipmentCode ||
                          shipment.id}

                        {shipment.trackingNumber
                          ? ` · ${shipment.trackingNumber}`
                          : ""}
                      </p>
                    </div>

                    {shipment.trackingUrl && (
                      <a
                        href={
                          shipment.trackingUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="od-link w-fit text-[11px] font-bold text-[#F47822]"
                      >
                        Courier tracking ↗
                      </a>
                    )}
                  </div>

                  {shipment.history
                    ?.length >
                    0 && (
                    <div className="mt-5 border-t border-black/[0.06] pt-4">
                      {shipment.history
                        .slice(-4)
                        .map(
                          (
                            entry,
                            index
                          ) => (
                            <p
                              key={`${entry.status}-${entry.at}-${index}`}
                              className="mt-2 text-[11px] leading-5 text-black/40 first:mt-0"
                            >
                              <strong className="font-semibold capitalize text-black/60">
                                {String(
                                  entry.status ||
                                    ""
                                ).replaceAll(
                                  "_",
                                  " "
                                )}
                              </strong>

                              {entry.location
                                ? ` · ${entry.location}`
                                : ""}

                              {entry.note
                                ? ` · ${entry.note}`
                                : ""}

                              {entry.at
                                ? ` · ${formatDate(
                                    entry.at,
                                    true
                                  )}`
                                : ""}
                            </p>
                          )
                        )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </>
    )}

    <p className="mt-4 text-[11px] font-medium text-black/35">
      Expected{" "}
      {order.deliveryDate
        ? formatDate(
            order.deliveryDate
          )
        : "delivery date pending"}
    </p>
  </section>
);

/* =========================================================
   ORDER ITEM
========================================================= */

const OrderItem = ({
  item,
}) => {
  const tax =
    item.tax || {};

  const components =
    item.customHamper
      ?.components || [];

  const decorations =
    item.customHamper
      ?.decorations || [];

  const personalization =
    item.customHamper
      ?.personalization;

  return (
    <article className="py-7">
      <div className="grid gap-6 sm:grid-cols-[108px_1fr]">
        <div className="od-product-image h-[108px] w-[108px] overflow-hidden bg-[#F3EFE8]">
          {item.image ? (
            <img
              src={item.image}
              alt={
                item.productName ||
                item.skuName
              }
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[30px] text-[#C59B2C]">
              H
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="text-[27px] font-semibold leading-none tracking-[-0.025em]"
              >
                {item.productName ||
                  item.skuName ||
                  "HAMPORIUM item"}
              </h3>

              <p className="mt-3 text-[11px] font-medium text-black/40">
                {item.skuName ||
                  item.skuCode ||
                  ""}

                {item.quantity
                  ? ` · Qty ${item.quantity}`
                  : ""}
              </p>
            </div>

            <p
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="text-[24px] font-semibold"
            >
              {formatCurrency(
                item.lineTotal
              )}
            </p>
          </div>

          {(item.taxableAmount !==
            undefined ||
            tax.gstRate !==
              undefined ||
            tax.hsnSac) && (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-black/40">
              {item.baseLineTotal !==
                undefined && (
                <span>
                  Base{" "}
                  {formatCurrency(
                    item.baseLineTotal
                  )}
                </span>
              )}

              {item.taxableAmount !==
                undefined && (
                <span>
                  Taxable{" "}
                  {formatCurrency(
                    item.taxableAmount
                  )}
                </span>
              )}

              {tax.gstRate !==
                undefined && (
                <span>
                  GST{" "}
                  {tax.gstRate}%
                </span>
              )}

              {tax.hsnSac && (
                <span>
                  HSN/SAC{" "}
                  {tax.hsnSac}
                </span>
              )}
            </div>
          )}

          {components.length > 0 && (
            <DetailsList
              title="Hamper contents"
              items={components}
            />
          )}

          {decorations.length > 0 && (
            <DetailsList
              title="Decorative finishing"
              items={
                decorations
              }
            />
          )}

          {personalization
            ?.enabled && (
            <div className="mt-5 border-l border-[#F47822]/35 pl-4">
              <p className="text-[11px] font-bold text-[#F47822]">
                Personalisation
              </p>

              {personalization.message && (
                <p className="mt-2 text-[12px] leading-6 text-black/50">
                  {
                    personalization.message
                  }
                </p>
              )}

              {personalization.instructions && (
                <p className="mt-1 text-[11px] leading-5 text-black/40">
                  {
                    personalization.instructions
                  }
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

/* =========================================================
   DETAILS LIST
========================================================= */

const DetailsList = ({
  title,
  items,
}) => (
  <div className="mt-5 border-t border-black/[0.06] pt-4">
    <p className="text-[11px] font-semibold text-black/38">
      {title}
    </p>

    <div className="mt-2">
      {items.map(
        (
          item,
          index
        ) => (
          <p
            key={
              item.component ||
              `${item.code}-${index}`
            }
            className="mt-1 text-[11px] leading-5 text-black/48 first:mt-0"
          >
            {item.name} ×{" "}
            {item.quantity}

            {item.lineTotal !==
            undefined
              ? ` · ${formatCurrency(
                  item.lineTotal
                )}`
              : ""}
          </p>
        )
      )}
    </div>
  </div>
);

/* =========================================================
   REVIEWS
========================================================= */

const ReviewSection = ({
  delivered,
  order,
  reviewableItems,
  reviewingProductId,
  setReviewingProductId,
  setNotice,
}) => {
  if (!delivered) {
    return null;
  }

  return (
    <section
      id="review-order"
      className="scroll-mt-8 mt-12 border-t border-black/[0.09] pt-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-black/[0.09] pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#906A16]">
            Delivered Order
          </p>

          <h2
            style={{
              fontFamily:
                DISPLAY_FONT,
            }}
            className="mt-1 text-[38px] font-semibold tracking-[-0.03em]"
          >
            Rate your{" "}
            <span className="od-gold italic">
              purchase.
            </span>
          </h2>
        </div>

        <Link
          to="/account/reviews"
          className="od-link text-[11px] font-bold text-black/50"
        >
          My reviews →
        </Link>
      </div>

      {reviewableItems.length === 0 ? (
        <div className="py-7">
          <p className="text-[14px] font-semibold text-black/65">
            No reviewable item was found in this delivered order.
          </p>

          <p className="mt-2 max-w-3xl text-[12px] leading-6 text-black/42">
            Please contact support if this order should contain a reviewable product or custom hamper.
          </p>
        </div>
      ) : (
        <div>
          {reviewableItems.map(
            (item) => {
              const reviewKey =
                item.targetType ===
                "product"
                  ? `product:${item.productId}`
                  : "custom_hamper:order";

              const open =
                reviewingProductId ===
                reviewKey;

              return (
                <div
                  key={item.key}
                  className="border-b border-black/[0.08] py-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p
                        style={{
                          fontFamily:
                            DISPLAY_FONT,
                        }}
                        className="text-[26px] font-semibold tracking-[-0.02em]"
                      >
                        {item.name}
                      </p>

                      <p className="mt-1 text-[12px] leading-5 text-black/40">
                        Share your experience with this delivered purchase.
                      </p>
                    </div>

                    {!open && (
                      <button
                        type="button"
                        onClick={() =>
                          setReviewingProductId(
                            reviewKey
                          )
                        }
                        className="od-link w-fit text-[12px] font-extrabold text-[#F47822]"
                      >
                        ★ Rate & Review
                      </button>
                    )}
                  </div>

                  {open && (
                    <div className="mt-5">
                      <ReviewForm
                        targetType={
                          item.targetType
                        }
                        productId={
                          item.productId
                        }
                        orderId={
                          order._id
                        }
                        targetName={
                          item.name
                        }
                        compact
                        onCancel={() =>
                          setReviewingProductId(
                            ""
                          )
                        }
                        onSaved={(
                          _review,
                          message
                        ) => {
                          setNotice(
                            message ||
                              "Review published."
                          );

                          setReviewingProductId(
                            ""
                          );
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}
    </section>
  );
};

/* =========================================================
   CANCELLATION
========================================================= */

const CancellationSection = ({
  cancellation,
  canRequest,
  reason,
  setReason,
  working,
  onSubmit,
}) => (
  <section className="mt-12 border-t border-black/[0.09] pt-8">
    <div className="flex flex-wrap items-end justify-between gap-5 border-b border-black/[0.09] pb-5">
      <h2
        style={{
          fontFamily:
            DISPLAY_FONT,
        }}
        className="text-[34px] font-semibold tracking-[-0.025em]"
      >
        Cancellation
      </h2>

      {cancellation?.status &&
        cancellation.status !==
          "none" && (
          <StatusText
            status={
              cancellation.status
            }
          />
        )}
    </div>

    {cancellation?.status &&
      cancellation.status !==
        "none" && (
        <div className="py-6">
          {cancellation.reason && (
            <p className="text-[13px] leading-6 text-black/55">
              {
                cancellation.reason
              }
            </p>
          )}

          {cancellation.reviewNote && (
            <p className="mt-3 text-[12px] leading-6 text-black/45">
              {
                cancellation.reviewNote
              }
            </p>
          )}

          {cancellation.requestedAt && (
            <p className="mt-3 text-[11px] text-black/35">
              {formatDate(
                cancellation.requestedAt,
                true
              )}
            </p>
          )}
        </div>
      )}

    {canRequest && (
      <form
        onSubmit={onSubmit}
        className="pt-6"
      >
        <label className="block">
          <span className="text-[11px] font-semibold text-black/45">
            Cancellation reason
          </span>

          <textarea
            rows="4"
            maxLength="1000"
            value={reason}
            onChange={(event) =>
              setReason(
                event.target.value
              )
            }
            placeholder="Tell us why you want to cancel."
            className="mt-3 w-full resize-none border-0 border-b border-black/[0.18] bg-transparent py-3 text-[13px] leading-6 outline-none focus:border-red-500"
          />
        </label>

        <button
          type="submit"
          disabled={working}
          className="od-link mt-5 text-[11px] font-bold text-red-600 disabled:pointer-events-none disabled:opacity-35"
        >
          {working
            ? "Submitting..."
            : "Request cancellation →"}
        </button>
      </form>
    )}
  </section>
);

/* =========================================================
   STATUS
========================================================= */

const StatusText = ({
  label,
  status,
}) => {
  const normalized =
    normalizeStatus(status);

  let dot =
    "bg-[#C59B2C]";

  let color =
    "text-[#906A16]";

  if (
    normalized.includes(
      "delivered"
    ) ||
    normalized.includes(
      "paid"
    ) ||
    normalized.includes(
      "captured"
    ) ||
    normalized.includes(
      "success"
    ) ||
    normalized.includes(
      "approved"
    )
  ) {
    dot =
      "bg-emerald-500";

    color =
      "text-emerald-700";
  } else if (
    normalized.includes(
      "cancel"
    ) ||
    normalized.includes(
      "failed"
    ) ||
    normalized.includes(
      "rejected"
    )
  ) {
    dot = "bg-red-500";
    color =
      "text-red-600";
  } else if (
    normalized.includes(
      "ship"
    ) ||
    normalized.includes(
      "dispatch"
    ) ||
    normalized.includes(
      "transit"
    )
  ) {
    dot =
      "bg-blue-500";

    color =
      "text-blue-700";
  } else if (
    normalized.includes(
      "processing"
    ) ||
    normalized.includes(
      "pending"
    ) ||
    normalized.includes(
      "confirmed"
    ) ||
    normalized.includes(
      "requested"
    )
  ) {
    dot =
      "bg-[#F47822]";

    color =
      "text-[#C55A10]";
  }

  return (
    <div>
      {label && (
        <p className="mb-2 text-[10px] font-semibold text-black/35">
          {label}
        </p>
      )}

      <div className="flex items-center gap-2">
        <span
          className={`h-[7px] w-[7px] shrink-0 rounded-full ${dot}`}
        />

        <span
          className={`text-[12px] font-bold capitalize ${color}`}
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
    </div>
  );
};

/* =========================================================
   HERO STAT
========================================================= */

const HeroStat = ({
  label,
  value,
  borderLeft = false,
  borderTop = false,
}) => (
  <div
    className={`min-w-0 py-5 lg:px-6 ${
      borderLeft
        ? "border-l border-black/[0.08]"
        : ""
    } ${
      borderTop
        ? "border-t border-black/[0.08]"
        : ""
    }`}
  >
    <p className="text-[10px] font-semibold text-black/35">
      {label}
    </p>

    <p className="mt-2 break-words text-[13px] font-bold text-black/75">
      {value}
    </p>
  </div>
);

/* =========================================================
   TITLE
========================================================= */

const InfoTitle = ({
  children,
}) => (
  <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#906A16]">
    {children}
  </p>
);

/* =========================================================
   ADDRESS
========================================================= */

const formatAddress = (
  address
) =>
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
      ]
        .filter(Boolean)
        .join(", ")
    : "—";

/* =========================================================
   LOADING
========================================================= */

const OrderDetailsLoading = () => (
  <div className="mx-auto w-full max-w-[1420px]">
    <div className="h-3 w-28 animate-pulse bg-black/[0.04]" />

    <div className="mt-8 border-y border-black/[0.07] py-10">
      <div className="h-14 w-80 max-w-full animate-pulse bg-black/[0.05]" />

      <div className="mt-5 h-3 w-44 animate-pulse bg-black/[0.035]" />
    </div>

    <div className="mt-10 grid gap-12 xl:grid-cols-[1fr_380px]">
      <div>
        <div className="h-10 w-52 animate-pulse bg-black/[0.045]" />

        <div className="mt-7 h-32 animate-pulse border-y border-black/[0.07]" />

        <div className="mt-12 h-10 w-44 animate-pulse bg-black/[0.045]" />
      </div>

      <div className="h-[330px] animate-pulse border-y border-black/[0.07]" />
    </div>
  </div>
);

export default OrderDetails;