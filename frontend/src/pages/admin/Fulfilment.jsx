import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const formatDate = (
  value,
  includeTime = false
) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  });
};

const getError = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong.";

const pretty = (value) =>
  String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const isDelayed = (shipment) => {
  const expected =
    shipment?.productionJob?.expectedDeliveryDate;

  if (!expected) return false;

  if (shipment.status === "delivered") {
    return false;
  }

  return new Date() > new Date(expected);
};

const getStatusLabel = (status) => {
  switch (status) {
    case "created":
    case "label_ready":
      return "Ready to Dispatch";
    case "dispatched":
      return "Dispatched";
    case "in_transit":
      return "In Transit";
    case "out_for_delivery":
      return "Out for Delivery";
    case "delivered":
      return "Delivered";
    case "failed":
      return "Delivery Failed";
    case "returned":
      return "Returned";
    case "cancelled":
      return "Cancelled";
    default:
      return pretty(status);
  }
};

const statusTone = (status) => {
  if (status === "delivered") {
    return {
      dot: "bg-emerald-500",
      text: "text-emerald-700",
      soft: "bg-emerald-50",
    };
  }

  if (
    [
      "dispatched",
      "in_transit",
      "out_for_delivery",
    ].includes(status)
  ) {
    return {
      dot: "bg-blue-500",
      text: "text-blue-700",
      soft: "bg-blue-50",
    };
  }

  if (
    [
      "failed",
      "returned",
      "cancelled",
    ].includes(status)
  ) {
    return {
      dot: "bg-red-500",
      text: "text-red-600",
      soft: "bg-red-50",
    };
  }

  return {
    dot: "bg-[#F47822]",
    text: "text-[#B95713]",
    soft: "bg-[#FFF5EC]",
  };
};

const Fulfilment = () => {
  const [shipments, setShipments] =
    useState([]);

  const [selectedId, setSelectedId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [working, setWorking] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [courier, setCourier] =
    useState({
      carrier: "",
      trackingNumber: "",
    });

  const loadShipments = async ({
    preserveSelection = true,
  } = {}) => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/fulfilment",
        {
          params: {
            limit: 100,
            sourceType: "order",
          },
        }
      );

      const list =
        response.data.shipments || [];

      setShipments(list);

      if (
        !preserveSelection ||
        !selectedId ||
        !list.some(
          (shipment) =>
            shipment._id === selectedId
        )
      ) {
        setSelectedId(
          list[0]?._id || ""
        );
      }
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadShipments({
      preserveSelection: false,
    });
  }, []);

  const selectedShipment = useMemo(
    () =>
      shipments.find(
        (shipment) =>
          shipment._id === selectedId
      ) || null,
    [shipments, selectedId]
  );

  useEffect(() => {
    if (!selectedShipment) return;

    setCourier({
      carrier:
        selectedShipment.carrier || "",
      trackingNumber:
        selectedShipment.trackingNumber || "",
    });
  }, [selectedShipment?._id]);

  const filteredShipments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return shipments;

    return shipments.filter((shipment) =>
      [
        shipment.shipmentCode,
        shipment.trackingNumber,
        shipment.recipientName,
        shipment.sourceId,
        shipment.productionJob?.jobCode,
        shipment.customerUser?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [shipments, search]);

  const summary = useMemo(
    () => ({
      total: shipments.length,
      ready: shipments.filter((item) =>
        ["created", "label_ready"].includes(
          item.status
        )
      ).length,
      moving: shipments.filter((item) =>
        [
          "dispatched",
          "in_transit",
          "out_for_delivery",
        ].includes(item.status)
      ).length,
      delayed: shipments.filter(
        (item) => isDelayed(item)
      ).length,
    }),
    [shipments]
  );

  const run = async (action) => {
    try {
      setWorking(true);
      setError("");
      setMessage("");

      const response = await action();

      setMessage(
        response?.data?.message ||
          "Updated successfully."
      );

      await loadShipments();
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setWorking(false);
    }
  };

  const saveAndDispatch = async () => {
    if (!selectedShipment) return;

    const carrier = courier.carrier.trim();
    const trackingNumber =
      courier.trackingNumber.trim();

    if (!carrier || !trackingNumber) {
      setError(
        "Enter courier name and AWB / tracking number."
      );
      return;
    }

    await run(async () => {
      await api.patch(
        `/fulfilment/${selectedShipment._id}`,
        {
          carrier,
          trackingNumber,
          trackingUrl: "",
        }
      );

      return api.post(
        `/fulfilment/${selectedShipment._id}/dispatch`,
        {}
      );
    });
  };

  const moveStatus = async (status) => {
    if (!selectedShipment) return;

    await run(() =>
      api.patch(
        `/fulfilment/${selectedShipment._id}/status`,
        {
          status,
        }
      )
    );
  };

  const markDelivered = async () => {
    if (!selectedShipment) return;

    await run(() =>
      api.post(
        `/fulfilment/${selectedShipment._id}/deliver`,
        {}
      )
    );
  };

  return (
    <main
      className="mx-auto w-full max-w-[1500px] pb-16 text-[#181715]"
      style={{
        fontFamily: "'Manrope', Arial, sans-serif",
      }}
    >
      {/* HEADER */}

      <header className="border-b border-black/[0.08] pb-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.13em] text-[#9A7118]">
              Delivery
            </p>

            <h1
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-2 text-[48px] font-semibold leading-none tracking-[-0.045em] sm:text-[58px]"
            >
              Ship &{" "}
              <span className="italic text-[#B18422]">
                Deliver
              </span>
            </h1>

            <p className="mt-4 max-w-[720px] text-[15px] leading-7 text-black/52">
              Packed orders come here automatically. Add the courier and AWB number, dispatch the parcel and keep the delivery status updated.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              loadShipments()
            }
            className="w-fit border-b border-black/20 pb-1 text-[13px] font-extrabold uppercase tracking-[0.06em] text-black/55 transition hover:border-[#F47822] hover:text-[#F47822]"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* MESSAGES */}

      {error && (
        <div className="mt-5 border-l-[3px] border-red-500 pl-4">
          <p className="text-[14px] font-semibold leading-6 text-red-600">
            {error}
          </p>
        </div>
      )}

      {message && (
        <div className="mt-5 border-l-[3px] border-emerald-500 pl-4">
          <p className="text-[14px] font-semibold leading-6 text-emerald-700">
            {message}
          </p>
        </div>
      )}

      {/* SUMMARY */}

      <section className="grid grid-cols-2 border-b border-black/[0.08] md:grid-cols-4">
        <SummaryStat
          label="All Deliveries"
          value={summary.total}
        />

        <SummaryStat
          label="Ready to Dispatch"
          value={summary.ready}
        />

        <SummaryStat
          label="In Delivery"
          value={summary.moving}
        />

        <SummaryStat
          label="Delayed"
          value={summary.delayed}
          danger={summary.delayed > 0}
        />
      </section>

      {/* SEARCH */}

      <section className="border-b border-black/[0.08] py-5">
        <div className="flex items-end gap-4">
          <div className="min-w-0 flex-1">
            <label className="text-[12px] font-bold uppercase tracking-[0.06em] text-black/38">
              Search Deliveries
            </label>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Customer, shipment code, order or AWB"
              className="mt-2 h-11 w-full border-0 border-b border-black/[0.15] bg-transparent px-0 text-[15px] font-semibold outline-none placeholder:text-black/25 focus:border-[#F47822]"
            />
          </div>

          <p className="hidden pb-3 text-[13px] font-semibold text-black/35 sm:block">
            {filteredShipments.length} shown
          </p>
        </div>
      </section>

      {/* WORKSPACE */}

      <div className="grid gap-8 pt-7 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* LEFT */}

        <section className="min-w-0 xl:border-r xl:border-black/[0.08] xl:pr-8">
          <div className="mb-4">
            <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-black/45">
              Delivery Queue
            </p>

            <p className="mt-1 text-[13px] leading-5 text-black/38">
              Select a delivery to continue.
            </p>
          </div>

          {loading ? (
            <div className="border-y border-black/[0.08] py-10 text-[14px] text-black/45">
              Loading deliveries...
            </div>
          ) : !filteredShipments.length ? (
            <div className="border-y border-black/[0.08] py-10">
              <p className="text-[17px] font-extrabold">
                No deliveries waiting
              </p>

              <p className="mt-2 text-[14px] leading-6 text-black/42">
                Packed orders will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="border-t border-black/[0.08]">
              {filteredShipments.map(
                (shipment) => {
                  const active =
                    shipment._id ===
                    selectedId;

                  return (
                    <button
                      key={shipment._id}
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          shipment._id
                        )
                      }
                      className={`w-full border-b border-black/[0.08] py-5 text-left transition ${
                        active
                          ? "border-l-[3px] border-l-[#F47822] bg-[#FFF9F2] pl-5 pr-3"
                          : "px-1 hover:bg-black/[0.018]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-[16px] font-extrabold">
                            {shipment.recipientName ||
                              "Customer"}
                          </p>

                          <p className="mt-1 truncate text-[13px] font-medium text-black/42">
                            {shipment.shipmentCode}
                          </p>
                        </div>

                        <DeliveryStatus
                          status={
                            shipment.status
                          }
                        />
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4">
                        <QueueMeta
                          label="Deliver By"
                          value={formatDate(
                            shipment
                              .productionJob
                              ?.expectedDeliveryDate
                          )}
                        />

                        <QueueMeta
                          label="AWB"
                          value={
                            shipment.trackingNumber ||
                            "Not added"
                          }
                        />
                      </div>

                      {isDelayed(
                        shipment
                      ) && (
                        <p className="mt-4 border-l-2 border-red-500 pl-3 text-[12px] font-extrabold text-red-600">
                          Delivery delayed
                        </p>
                      )}
                    </button>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* RIGHT */}

        <section className="min-w-0">
          {!selectedShipment ? (
            <EmptySelection
              title="Select a delivery"
              text="Choose a delivery from the left to continue."
            />
          ) : (
            <>
              <DeliveryHeader
                shipment={selectedShipment}
              />

              {isDelayed(
                selectedShipment
              ) && (
                <div className="border-b border-black/[0.08] py-5">
                  <p className="border-l-[3px] border-red-500 pl-4 text-[14px] font-semibold leading-6 text-red-600">
                    Expected delivery date has passed. Please prioritise this order.
                  </p>
                </div>
              )}

              <DeliveryProgress
                status={
                  selectedShipment.status
                }
              />

              <NextDeliveryAction
                shipment={
                  selectedShipment
                }
                courier={courier}
                setCourier={setCourier}
                working={working}
                onDispatch={
                  saveAndDispatch
                }
                onMove={moveStatus}
                onDeliver={
                  markDelivered
                }
              />

              <DeliveryAddress
                shipment={
                  selectedShipment
                }
              />

              <DeliveryTimeline
                shipment={
                  selectedShipment
                }
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
};

const DeliveryHeader = ({
  shipment,
}) => (
  <section className="border-b border-black/[0.08] pb-7">
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#9A7118]">
          {shipment.shipmentCode}
        </p>

        <h2
          style={{
            fontFamily: DISPLAY_FONT,
          }}
          className="mt-2 text-[40px] font-semibold leading-none tracking-[-0.03em] sm:text-[46px]"
        >
          {shipment.recipientName ||
            "Delivery"}
        </h2>

        {shipment.recipientPhone && (
          <p className="mt-2 text-[15px] font-semibold text-black/50">
            {shipment.recipientPhone}
          </p>
        )}
      </div>

      <DeliveryStatus
        status={shipment.status}
        large
      />
    </div>

    <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
      <Detail
        label="Expected Delivery"
        value={formatDate(
          shipment.productionJob
            ?.expectedDeliveryDate
        )}
      />

      <Detail
        label="Courier"
        value={
          shipment.carrier ||
          "Not added"
        }
      />

      <Detail
        label="AWB"
        value={
          shipment.trackingNumber ||
          "Not added"
        }
      />

      <Detail
        label="Delivered"
        value={formatDate(
          shipment.deliveredAt,
          true
        )}
      />
    </div>

    {shipment.sourceId && (
      <Link
        to={`/admin/orders/${shipment.sourceId}`}
        className="mt-6 inline-flex items-center gap-2 border-b border-[#F47822]/40 pb-1 text-[13px] font-extrabold uppercase tracking-[0.05em] text-[#F47822] transition hover:border-[#181715] hover:text-[#181715]"
      >
        View Full Order
        <span>→</span>
      </Link>
    )}
  </section>
);

const DeliveryProgress = ({
  status,
}) => {
  const rank = {
    created: 0,
    label_ready: 0,
    dispatched: 1,
    in_transit: 2,
    out_for_delivery: 3,
    delivered: 4,
  };

  const current =
    rank[status] ?? 0;

  const steps = [
    "Ready",
    "Dispatched",
    "In Transit",
    "Out for Delivery",
    "Delivered",
  ];

  return (
    <section className="border-b border-black/[0.08] py-7">
      <p className="mb-5 text-[13px] font-extrabold uppercase tracking-[0.07em] text-black/42">
        Delivery Progress
      </p>

      <div className="grid gap-3 sm:grid-cols-5">
        {steps.map((step, index) => {
          const complete =
            current >= index;

          const active =
            current === index;

          return (
            <div key={step}>
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-extrabold ${
                    complete
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : active
                        ? "border-[#F47822] text-[#F47822]"
                        : "border-black/15 text-black/30"
                  }`}
                >
                  {complete ? "✓" : index + 1}
                </span>

                <span
                  className={`text-[13px] font-bold ${
                    complete
                      ? "text-black/70"
                      : active
                        ? "text-[#B95713]"
                        : "text-black/35"
                  }`}
                >
                  {step}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const NextDeliveryAction = ({
  shipment,
  courier,
  setCourier,
  working,
  onDispatch,
  onMove,
  onDeliver,
}) => {
  const status = shipment.status;

  if (
    ["created", "label_ready"].includes(
      status
    )
  ) {
    return (
      <section className="border-b border-black/[0.08] py-7">
        <ActionEyebrow>
          Next Action
        </ActionEyebrow>

        <h3 className="mt-2 text-[22px] font-extrabold">
          Add courier and dispatch
        </h3>

        <p className="mt-2 max-w-[700px] text-[14px] leading-6 text-black/50">
          After booking the parcel, enter the courier name and the AWB / tracking number provided by the courier.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Field
            label="Courier"
            value={courier.carrier}
            onChange={(value) =>
              setCourier(
                (current) => ({
                  ...current,
                  carrier: value,
                })
              )
            }
            placeholder="Delhivery, Blue Dart, DTDC..."
          />

          <Field
            label="AWB / Tracking Number"
            value={
              courier.trackingNumber
            }
            onChange={(value) =>
              setCourier(
                (current) => ({
                  ...current,
                  trackingNumber: value,
                })
              )
            }
            placeholder="Enter courier tracking number"
          />
        </div>

        <button
          type="button"
          disabled={working}
          onClick={onDispatch}
          className="mt-6 min-h-[48px] bg-[#181715] px-7 text-[13px] font-extrabold uppercase tracking-[0.05em] text-white transition hover:bg-[#F47822] disabled:opacity-40"
        >
          Save & Dispatch
        </button>
      </section>
    );
  }

  if (status === "dispatched") {
    return (
      <ActionBlock
        title="Parcel has been dispatched"
        text="When the courier starts moving the parcel through its network, update it to In Transit."
        button="Mark In Transit"
        working={working}
        onClick={() =>
          onMove("in_transit")
        }
      />
    );
  }

  if (status === "in_transit") {
    return (
      <ActionBlock
        title="Parcel is in transit"
        text="When the parcel goes with the delivery executive for the final delivery, update it to Out for Delivery."
        button="Mark Out for Delivery"
        working={working}
        onClick={() =>
          onMove(
            "out_for_delivery"
          )
        }
      />
    );
  }

  if (
    status ===
    "out_for_delivery"
  ) {
    return (
      <ActionBlock
        success
        title="Parcel is out for delivery"
        text="Mark delivered only after you have confirmation that the customer received the parcel."
        button="Mark Delivered"
        working={working}
        onClick={onDeliver}
      />
    );
  }

  if (status === "delivered") {
    return (
      <section className="border-b border-black/[0.08] py-7">
        <ActionEyebrow>
          Delivery Complete
        </ActionEyebrow>

        <h3 className="mt-2 text-[22px] font-extrabold text-emerald-700">
          Order delivered successfully
        </h3>

        <p className="mt-2 text-[14px] leading-6 text-black/50">
          The order is marked delivered and the customer has been updated.
        </p>
      </section>
    );
  }

  if (status === "failed") {
    return (
      <section className="border-b border-black/[0.08] py-7">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-red-600">
          Delivery Issue
        </p>

        <h3 className="mt-2 text-[22px] font-extrabold">
          Delivery failed
        </h3>

        <div className="mt-5 flex flex-wrap gap-4">
          <button
            type="button"
            disabled={working}
            onClick={() =>
              onMove(
                "out_for_delivery"
              )
            }
            className="min-h-[48px] bg-[#181715] px-6 text-[13px] font-extrabold uppercase tracking-[0.05em] text-white disabled:opacity-40"
          >
            Retry Delivery
          </button>

          <button
            type="button"
            disabled={working}
            onClick={() =>
              onMove("returned")
            }
            className="min-h-[48px] px-2 text-[13px] font-extrabold uppercase tracking-[0.05em] text-red-600 disabled:opacity-40"
          >
            Mark Returned
          </button>
        </div>
      </section>
    );
  }

  return null;
};

const ActionBlock = ({
  title,
  text,
  button,
  onClick,
  working,
  success = false,
}) => (
  <section className="border-b border-black/[0.08] py-7">
    <ActionEyebrow>
      Next Action
    </ActionEyebrow>

    <h3 className="mt-2 text-[22px] font-extrabold">
      {title}
    </h3>

    <p className="mt-2 max-w-[700px] text-[14px] leading-6 text-black/50">
      {text}
    </p>

    <button
      type="button"
      disabled={working}
      onClick={onClick}
      className={`mt-5 min-h-[48px] px-7 text-[13px] font-extrabold uppercase tracking-[0.05em] text-white disabled:opacity-40 ${
        success
          ? "bg-emerald-600"
          : "bg-[#181715]"
      }`}
    >
      {button}
    </button>
  </section>
);

const DeliveryAddress = ({
  shipment,
}) => (
  <section className="border-b border-black/[0.08] py-7">
    <p className="text-[13px] font-extrabold uppercase tracking-[0.07em] text-black/42">
      Delivery Address
    </p>

    <p className="mt-3 max-w-[760px] text-[15px] font-medium leading-7 text-black/58">
      {formatAddress(
        shipment.shippingAddress
      )}
    </p>
  </section>
);

const DeliveryTimeline = ({
  shipment,
}) => {
  if (!shipment.history?.length) {
    return null;
  }

  return (
    <section className="pt-7">
      <div className="border-b border-black/[0.08] pb-4">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.07em] text-black/42">
          Timeline
        </p>

        <h3
          style={{
            fontFamily: DISPLAY_FONT,
          }}
          className="mt-1 text-[34px] font-semibold tracking-[-0.02em]"
        >
          Delivery Updates
        </h3>
      </div>

      <div>
        {[...shipment.history]
          .reverse()
          .map(
            (
              entry,
              index
            ) => (
              <div
                key={`${entry.status}-${entry.at}-${index}`}
                className="grid gap-4 border-b border-black/[0.07] py-5 sm:grid-cols-[180px_minmax(0,1fr)]"
              >
                <div>
                  <p className="text-[14px] font-extrabold">
                    {getStatusLabel(
                      entry.status
                    )}
                  </p>

                  <p className="mt-1 text-[12px] font-medium text-black/35">
                    {formatDate(
                      entry.at,
                      true
                    )}
                  </p>
                </div>

                <p className="text-[13px] leading-6 text-black/48">
                  {entry.note ||
                    "Status updated."}
                </p>
              </div>
            )
          )}
      </div>
    </section>
  );
};

const DeliveryStatus = ({
  status,
  large = false,
}) => {
  const tone =
    statusTone(status);

  return (
    <div
      className={`inline-flex shrink-0 items-center gap-2 rounded-full ${tone.soft} ${
        large
          ? "px-3.5 py-2"
          : "px-2.5 py-1.5"
      }`}
    >
      <span
        className={`rounded-full ${tone.dot} ${
          large
            ? "h-2.5 w-2.5"
            : "h-2 w-2"
        }`}
      />

      <span
        className={`font-extrabold ${tone.text} ${
          large
            ? "text-[13px]"
            : "text-[12px]"
        }`}
      >
        {getStatusLabel(status)}
      </span>
    </div>
  );
};

const SummaryStat = ({
  label,
  value,
  danger = false,
}) => (
  <div className="border-r border-black/[0.08] py-5 pr-4 last:border-r-0 md:px-5 md:first:pl-0">
    <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-black/35">
      {label}
    </p>

    <p
      style={{
        fontFamily: DISPLAY_FONT,
      }}
      className={`mt-1 text-[32px] font-semibold leading-none ${
        danger
          ? "text-red-600"
          : ""
      }`}
    >
      {value}
    </p>
  </div>
);

const QueueMeta = ({
  label,
  value,
}) => (
  <div>
    <p className="text-[12px] font-semibold text-black/35">
      {label}
    </p>

    <p className="mt-1 truncate text-[13px] font-bold text-black/62">
      {value}
    </p>
  </div>
);

const Detail = ({
  label,
  value,
}) => (
  <div>
    <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-black/35">
      {label}
    </p>

    <p className="mt-2 break-words text-[15px] font-semibold leading-5 text-black/70">
      {value}
    </p>
  </div>
);

const Field = ({
  label,
  value,
  onChange,
  placeholder,
}) => (
  <label className="block">
    <span className="text-[13px] font-bold text-black/48">
      {label}
    </span>

    <input
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
      placeholder={placeholder}
      className="mt-2 h-12 w-full border-0 border-b border-black/[0.15] bg-transparent px-0 text-[15px] font-semibold outline-none placeholder:text-black/25 focus:border-[#F47822]"
    />
  </label>
);

const ActionEyebrow = ({ children }) => (
  <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#A65B1C]">
    {children}
  </p>
);

const EmptySelection = ({
  title,
  text,
}) => (
  <div className="flex min-h-[420px] items-center justify-center border-y border-black/[0.08] text-center">
    <div>
      <p
        style={{
          fontFamily: DISPLAY_FONT,
        }}
        className="text-[36px] font-semibold"
      >
        {title}
      </p>

      <p className="mt-2 text-[14px] leading-6 text-black/42">
        {text}
      </p>
    </div>
  </div>
);

const formatAddress = (address) =>
  address
    ? [
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postalCode,
        address.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "—";

export default Fulfilment;
