import { useEffect, useMemo, useState } from "react";
import api from "../../api/api.js";


const pretty = (value) =>
  String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );


const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};


const getError = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong.";


const getShipments = (data = {}) =>
  data.shipments ||
  data.fulfilments ||
  data.items ||
  [];


const getProductionJobs = (data = {}) =>
  data.productionJobs ||
  data.jobs ||
  data.items ||
  [];


const statusClass = (status) => {
  switch (status) {
    case "delivered":
      return "bg-emerald-50 text-emerald-700";
    case "dispatched":
    case "in_transit":
      return "bg-blue-50 text-blue-700";
    case "out_for_delivery":
      return "bg-violet-50 text-violet-700";
    case "failed":
    case "returned":
      return "bg-red-50 text-red-700";
    case "cancelled":
      return "bg-gray-100 text-gray-500";
    case "label_ready":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-orange-50 text-[#F97316]";
  }
};


const emptyForm = {
  productionJob: "",

  recipientName: "",
  recipientPhone: "",

  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",

  carrier: "",
  trackingNumber: "",
  trackingUrl: "",

  notes: "",
};


const Fulfilment = () => {
  const [shipments, setShipments] =
    useState([]);

  const [productionJobs, setProductionJobs] =
    useState([]);

  const [selectedId, setSelectedId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [createOpen, setCreateOpen] =
    useState(false);

  const [form, setForm] =
    useState(emptyForm);

  const [trackingForm, setTrackingForm] =
    useState({
      carrier: "",
      trackingNumber: "",
      trackingUrl: "",
      notes: "",
    });

  const [actionNote, setActionNote] =
    useState("");


  const loadData = async ({
    preserveSelection = true,
  } = {}) => {
    try {
      setLoading(true);
      setError("");

      const [
        shipmentResponse,
        productionResponse,
      ] = await Promise.all([
        api.get("/fulfilment"),
        api.get("/production"),
      ]);

      const shipmentList =
        getShipments(
          shipmentResponse.data
        );

      const jobs =
        getProductionJobs(
          productionResponse.data
        );

      setShipments(
        shipmentList
      );

      setProductionJobs(
        jobs
      );

      if (
        !preserveSelection ||
        !selectedId ||
        !shipmentList.some(
          (item) =>
            item._id === selectedId
        )
      ) {
        setSelectedId(
          shipmentList[0]?._id ||
            ""
        );
      }
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData({
      preserveSelection: false,
    });
  }, []);


  const selected =
    useMemo(
      () =>
        shipments.find(
          (shipment) =>
            shipment._id ===
            selectedId
        ) || null,
      [shipments, selectedId]
    );


  useEffect(() => {
    if (!selected) return;

    setTrackingForm({
      carrier:
        selected.carrier || "",

      trackingNumber:
        selected.trackingNumber ||
        "",

      trackingUrl:
        selected.trackingUrl ||
        "",

      notes:
        selected.notes || "",
    });

    setActionNote("");
  }, [selected?._id]);


  const readyJobs =
    useMemo(
      () =>
        productionJobs.filter(
          (job) =>
            [
              "ready_to_ship",
              "shipped",
            ].includes(job.stage)
        ),
      [productionJobs]
    );


  const filteredShipments =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return shipments.filter(
        (shipment) => {
          const matchesStatus =
            !statusFilter ||
            shipment.status ===
              statusFilter;

          const recipient =
            shipment.recipientName ||
            shipment.recipient?.name ||
            "";

          const searchable = [
            shipment.shipmentCode,
            shipment.trackingNumber,
            shipment.carrier,
            recipient,
            shipment.productionJob
              ?.title,
            shipment.productionJob
              ?.jobCode,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            searchable.includes(
              query
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      shipments,
      search,
      statusFilter,
    ]);


  const stats =
    useMemo(
      () => ({
        total:
          shipments.length,

        dispatchDue:
          shipments.filter(
            (item) =>
              [
                "created",
                "label_ready",
              ].includes(
                item.status
              )
          ).length,

        moving:
          shipments.filter(
            (item) =>
              [
                "dispatched",
                "in_transit",
                "out_for_delivery",
              ].includes(
                item.status
              )
          ).length,

        exceptions:
          shipments.filter(
            (item) =>
              [
                "failed",
                "returned",
              ].includes(
                item.status
              )
          ).length,
      }),
      [shipments]
    );


  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };


  const createShipment = async (
    event
  ) => {
    event.preventDefault();

    if (
      !form.productionJob ||
      !form.recipientName.trim() ||
      !form.line1.trim() ||
      !form.city.trim() ||
      !form.state.trim() ||
      !form.postalCode.trim()
    ) {
      setError(
        "Production job, recipient name and complete delivery address are required."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        productionJob:
          form.productionJob,

        recipientName:
          form.recipientName.trim(),

        recipientPhone:
          form.recipientPhone.trim(),

        shippingAddress: {
          line1:
            form.line1.trim(),

          line2:
            form.line2.trim(),

          city:
            form.city.trim(),

          state:
            form.state.trim(),

          postalCode:
            form.postalCode.trim(),

          country:
            form.country.trim() ||
            "India",
        },

        carrier:
          form.carrier.trim(),

        trackingNumber:
          form.trackingNumber.trim(),

        trackingUrl:
          form.trackingUrl.trim(),

        notes:
          form.notes.trim(),
      };

      const response =
        await api.post(
          "/fulfilment",
          payload
        );

      setForm(emptyForm);
      setCreateOpen(false);

      await loadData({
        preserveSelection: false,
      });

      const created =
        response.data.shipment ||
        response.data.fulfilment;

      if (created?._id) {
        setSelectedId(
          created._id
        );
      }
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };


  const saveTracking =
    async () => {
      if (!selected) return;

      try {
        setSaving(true);
        setError("");

        await api.patch(
          `/fulfilment/${selected._id}`,
          {
            carrier:
              trackingForm.carrier.trim(),

            trackingNumber:
              trackingForm.trackingNumber.trim(),

            trackingUrl:
              trackingForm.trackingUrl.trim(),

            notes:
              trackingForm.notes.trim(),
          }
        );

        await loadData();
      } catch (err) {
        setError(
          getError(err)
        );
      } finally {
        setSaving(false);
      }
    };


  const changeStatus =
    async (status) => {
      if (!selected) return;

      try {
        setSaving(true);
        setError("");

        await api.patch(
          `/fulfilment/${selected._id}/status`,
          {
            status,
            note:
              actionNote.trim(),
          }
        );

        setActionNote("");

        await loadData();
      } catch (err) {
        setError(
          getError(err)
        );
      } finally {
        setSaving(false);
      }
    };


  const dispatchShipment =
    async () => {
      if (!selected) return;

      if (
        !trackingForm.carrier.trim() ||
        !trackingForm.trackingNumber.trim()
      ) {
        setError(
          "Carrier and tracking number are required before dispatch."
        );

        return;
      }

      try {
        setSaving(true);
        setError("");

        await api.patch(
          `/fulfilment/${selected._id}`,
          {
            carrier:
              trackingForm.carrier.trim(),

            trackingNumber:
              trackingForm.trackingNumber.trim(),

            trackingUrl:
              trackingForm.trackingUrl.trim(),

            notes:
              trackingForm.notes.trim(),
          }
        );

        await api.post(
          `/fulfilment/${selected._id}/dispatch`,
          {
            carrier:
              trackingForm.carrier.trim(),

            trackingNumber:
              trackingForm.trackingNumber.trim(),

            trackingUrl:
              trackingForm.trackingUrl.trim(),

            note:
              actionNote.trim(),
          }
        );

        setActionNote("");

        await loadData();
      } catch (err) {
        setError(
          getError(err)
        );
      } finally {
        setSaving(false);
      }
    };


  const deliverShipment =
    async () => {
      if (!selected) return;

      try {
        setSaving(true);
        setError("");

        await api.post(
          `/fulfilment/${selected._id}/deliver`,
          {
            note:
              actionNote.trim(),
          }
        );

        setActionNote("");

        await loadData();
      } catch (err) {
        setError(
          getError(err)
        );
      } finally {
        setSaving(false);
      }
    };


  return (
    <div className="space-y-6 pb-12">

      {/* HEADER */}

      <div className="flex flex-col gap-4 rounded-[22px] bg-[#171717] p-6 text-white sm:flex-row sm:items-center sm:justify-between">

        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#D4AF37]">
            Phase 9 · Logistics
          </p>

          <h1 className="mt-2 text-2xl font-black">
            Fulfilment
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Create shipments, assign tracking, dispatch orders and close delivery exceptions. Retail customers see a simplified Confirmed → Preparing → Packed → Dispatched → Delivered timeline.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setCreateOpen(true)
          }
          className="rounded-xl bg-[#F97316] px-5 py-3 text-xs font-extrabold text-white transition hover:bg-orange-600"
        >
          + Create Shipment
        </button>

      </div>


      {error && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="font-bold"
          >
            ×
          </button>
        </div>
      )}


      {/* STATS */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Shipments"
          value={stats.total}
        />

        <Stat
          label="Dispatch Due"
          value={
            stats.dispatchDue
          }
        />

        <Stat
          label="In Transit"
          value={stats.moving}
        />

        <Stat
          label="Exceptions"
          value={
            stats.exceptions
          }
        />
      </div>


      {/* FILTERS */}

      <div className="flex flex-col gap-3 rounded-[18px] border border-black/[0.06] bg-white p-4 sm:flex-row">

        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search recipient, tracking, carrier..."
          className="h-11 min-w-0 flex-1 rounded-xl border border-black/10 px-4 text-sm outline-none focus:border-[#F97316]"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
          className="h-11 rounded-xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#F97316]"
        >
          <option value="">
            All statuses
          </option>

          {[
            "created",
            "label_ready",
            "dispatched",
            "in_transit",
            "out_for_delivery",
            "delivered",
            "failed",
            "returned",
            "cancelled",
          ].map((status) => (
            <option
              key={status}
              value={status}
            >
              {pretty(status)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() =>
            loadData()
          }
          className="h-11 rounded-xl border border-black/10 px-5 text-xs font-extrabold transition hover:border-[#F97316] hover:text-[#F97316]"
        >
          Refresh
        </button>

      </div>


      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">

        {/* LIST */}

        <div className="overflow-hidden rounded-[20px] border border-black/[0.06] bg-white">

          <div className="border-b border-black/[0.06] px-5 py-4">
            <p className="text-sm font-black">
              Shipment Queue
            </p>

            <p className="mt-1 text-[11px] text-black/45">
              {filteredShipments.length} shipment(s)
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-black/40">
              Loading shipments...
            </div>
          ) : !filteredShipments.length ? (
            <div className="p-8 text-center text-sm text-black/40">
              No shipments found.
            </div>
          ) : (
            <div className="max-h-[680px] divide-y divide-black/[0.05] overflow-y-auto">

              {filteredShipments.map(
                (shipment) => (
                  <button
                    key={
                      shipment._id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedId(
                        shipment._id
                      )
                    }
                    className={`w-full p-5 text-left transition ${
                      selectedId ===
                      shipment._id
                        ? "bg-[#FFF9F2]"
                        : "hover:bg-gray-50"
                    }`}
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {shipment.recipientName ||
                            shipment
                              .recipient
                              ?.name ||
                            "Shipment"}
                        </p>

                        <p className="mt-1 truncate text-[10px] text-black/40">
                          {shipment.shipmentCode ||
                            shipment._id}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-extrabold ${statusClass(
                          shipment.status
                        )}`}
                      >
                        {pretty(
                          shipment.status
                        )}
                      </span>

                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
                      <Mini
                        label="Carrier"
                        value={
                          shipment.carrier
                        }
                      />

                      <Mini
                        label="Tracking"
                        value={
                          shipment.trackingNumber
                        }
                      />

                      <Mini
                        label="City"
                        value={
                          shipment
                            .shippingAddress
                            ?.city
                        }
                      />

                      <Mini
                        label="Created"
                        value={formatDate(
                          shipment.createdAt
                        )}
                      />
                    </div>

                  </button>
                )
              )}

            </div>
          )}

        </div>


        {/* DETAIL */}

        {!selected ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-[20px] border border-dashed border-black/15 bg-white text-sm text-black/40">
            Select a shipment.
          </div>
        ) : (
          <div className="space-y-5">

            <section className="rounded-[20px] border border-black/[0.06] bg-white p-6">

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#F97316]">
                    Shipment
                  </p>

                  <h2 className="mt-2 text-xl font-black">
                    {selected.recipientName ||
                      selected.recipient
                        ?.name ||
                      "Shipment"}
                  </h2>

                  <p className="mt-1 break-all text-[10px] text-black/35">
                    {selected.shipmentCode ||
                      selected._id}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold ${statusClass(
                    selected.status
                  )}`}
                >
                  {pretty(
                    selected.status
                  )}
                </span>
              </div>


              <div className="mt-6 grid gap-4 sm:grid-cols-2">

                <Info
                  label="Production Job"
                  value={
                    selected
                      .productionJob
                      ?.title ||
                    selected
                      .productionJob
                      ?.jobCode ||
                    selected.productionJob
                  }
                />

                <Info
                  label="Source"
                  value={
                    selected.sourceType
                      ? `${pretty(selected.sourceType)} · ${selected.sourceId || "—"}`
                      : selected.sourceId || "—"
                  }
                />

                <Info
                  label="Phone"
                  value={
                    selected.recipientPhone ||
                    selected.recipient
                      ?.phone
                  }
                />

                <Info
                  label="Carrier"
                  value={
                    selected.carrier
                  }
                />

                <Info
                  label="Tracking Number"
                  value={
                    selected.trackingNumber
                  }
                />

                <Info
                  label="Dispatched"
                  value={formatDate(
                    selected.dispatchedAt
                  )}
                />

                <Info
                  label="Delivered"
                  value={formatDate(
                    selected.deliveredAt
                  )}
                />

              </div>


              <div className="mt-5 rounded-xl bg-[#FFF9F2] p-4">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">
                  Delivery Address
                </p>

                <p className="mt-2 text-sm leading-6 text-black/65">
                  {[
                    selected
                      .shippingAddress
                      ?.line1,
                    selected
                      .shippingAddress
                      ?.line2,
                    selected
                      .shippingAddress
                      ?.city,
                    selected
                      .shippingAddress
                      ?.state,
                    selected
                      .shippingAddress
                      ?.postalCode,
                    selected
                      .shippingAddress
                      ?.country,
                  ]
                    .filter(Boolean)
                    .join(", ") ||
                    "—"}
                </p>
              </div>

            </section>


            {/* TRACKING */}

            {![
              "delivered",
              "returned",
              "cancelled",
            ].includes(
              selected.status
            ) && (
              <section className="rounded-[20px] border border-black/[0.06] bg-white p-6">

                <h3 className="text-sm font-black">
                  Carrier & Tracking
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">

                  <Field
                    label="Carrier"
                    value={
                      trackingForm.carrier
                    }
                    onChange={(event) =>
                      setTrackingForm(
                        (current) => ({
                          ...current,
                          carrier:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                  />

                  <Field
                    label="Tracking Number"
                    value={
                      trackingForm.trackingNumber
                    }
                    onChange={(event) =>
                      setTrackingForm(
                        (current) => ({
                          ...current,
                          trackingNumber:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                  />

                  <div className="sm:col-span-2">
                    <Field
                      label="Tracking URL"
                      value={
                        trackingForm.trackingUrl
                      }
                      onChange={(event) =>
                        setTrackingForm(
                          (current) => ({
                            ...current,
                            trackingUrl:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-wider text-black/40">
                        Internal Notes
                      </span>

                      <textarea
                        rows="3"
                        value={
                          trackingForm.notes
                        }
                        onChange={(
                          event
                        ) =>
                          setTrackingForm(
                            (
                              current
                            ) => ({
                              ...current,
                              notes:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                        className="w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-[#F97316]"
                      />
                    </label>
                  </div>

                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={
                    saveTracking
                  }
                  className="mt-4 rounded-xl border border-black/10 px-5 py-2.5 text-xs font-extrabold transition hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-50"
                >
                  Save Tracking
                </button>

              </section>
            )}


            {/* ACTIONS */}

            {!["delivered", "cancelled"].includes(selected.status) && (
              <section className="rounded-[20px] border border-black/[0.06] bg-white p-6">

                <h3 className="text-sm font-black">
                  Shipment Actions
                </h3>

                <input
                  value={actionNote}
                  onChange={(event) =>
                    setActionNote(
                      event.target.value
                    )
                  }
                  placeholder="Optional operational note"
                  className="mt-4 h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#F97316]"
                />

                <div className="mt-4 flex flex-wrap gap-2">

                  {selected.status ===
                    "created" && (
                    <ActionButton
                      disabled={
                        saving
                      }
                      onClick={() =>
                        changeStatus(
                          "label_ready"
                        )
                      }
                    >
                      Label Ready
                    </ActionButton>
                  )}

                  {[
                    "created",
                    "label_ready",
                  ].includes(
                    selected.status
                  ) && (
                    <ActionButton
                      primary
                      disabled={
                        saving
                      }
                      onClick={
                        dispatchShipment
                      }
                    >
                      Dispatch
                    </ActionButton>
                  )}

                  {[
                    "dispatched",
                    "in_transit",
                  ].includes(
                    selected.status
                  ) && (
                    <ActionButton
                      disabled={
                        saving
                      }
                      onClick={() =>
                        changeStatus(
                          "in_transit"
                        )
                      }
                    >
                      In Transit
                    </ActionButton>
                  )}

                  {[
                    "dispatched",
                    "in_transit",
                  ].includes(
                    selected.status
                  ) && (
                    <ActionButton
                      disabled={
                        saving
                      }
                      onClick={() =>
                        changeStatus(
                          "out_for_delivery"
                        )
                      }
                    >
                      Out for Delivery
                    </ActionButton>
                  )}

                  {[
                    "dispatched",
                    "in_transit",
                    "out_for_delivery",
                  ].includes(
                    selected.status
                  ) && (
                    <ActionButton
                      success
                      disabled={
                        saving
                      }
                      onClick={
                        deliverShipment
                      }
                    >
                      Mark Delivered
                    </ActionButton>
                  )}

                  {![
                    "delivered",
                    "returned",
                  ].includes(
                    selected.status
                  ) && (
                    <ActionButton
                      danger
                      disabled={
                        saving
                      }
                      onClick={() =>
                        changeStatus(
                          "failed"
                        )
                      }
                    >
                      Delivery Failed
                    </ActionButton>
                  )}

                  {selected.status ===
                    "failed" && (
                    <ActionButton
                      danger
                      disabled={
                        saving
                      }
                      onClick={() =>
                        changeStatus(
                          "returned"
                        )
                      }
                    >
                      Returned
                    </ActionButton>
                  )}

                </div>

              </section>
            )}


            {selected.trackingUrl && (
              <a
                href={
                  selected.trackingUrl
                }
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-[18px] bg-[#171717] px-5 py-4 text-xs font-extrabold text-white transition hover:bg-[#F97316]"
              >
                Open Courier Tracking
                <span>↗</span>
              </a>
            )}


            {/* HISTORY */}

            <section className="rounded-[20px] border border-black/[0.06] bg-white p-6">

              <h3 className="text-sm font-black">
                Shipment History
              </h3>

              <div className="mt-4 space-y-4">

                {!selected.history
                  ?.length ? (
                  <p className="text-sm text-black/40">
                    No shipment history.
                  </p>
                ) : (
                  [
                    ...selected
                      .history,
                  ]
                    .reverse()
                    .map(
                      (
                        history,
                        index
                      ) => (
                        <div
                          key={
                            history._id ||
                            index
                          }
                          className="flex gap-3"
                        >
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#F97316]" />

                          <div>
                            <p className="text-xs font-bold">
                              {pretty(
                                history.status
                              )}
                            </p>

                            {history.note && (
                              <p className="mt-1 text-[11px] leading-5 text-black/50">
                                {
                                  history.note
                                }
                              </p>
                            )}

                            <p className="mt-1 text-[9px] text-black/30">
                              {formatDate(
                                history.at ||
                                  history.changedAt ||
                                  history.createdAt
                              )}
                            </p>
                          </div>
                        </div>
                      )
                    )
                )}

              </div>

            </section>

          </div>
        )}

      </div>


      {/* CREATE SHIPMENT */}

      {createOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-4">

          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[22px] bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.06] bg-white px-6 py-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#F97316]">
                  Fulfilment
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Create Shipment
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCreateOpen(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
              >
                ×
              </button>
            </div>


            <form
              onSubmit={
                createShipment
              }
              className="space-y-6 p-6"
            >

              <div>
                <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-black/45">
                  Production Job *
                </label>

                <select
                  name="productionJob"
                  value={
                    form.productionJob
                  }
                  onChange={
                    handleChange
                  }
                  className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#F97316]"
                >
                  <option value="">
                    Select ready job
                  </option>

                  {readyJobs.map(
                    (job) => (
                      <option
                        key={
                          job._id
                        }
                        value={
                          job._id
                        }
                      >
                        {job.title ||
                          job.productionId ||
                          job._id}
                      </option>
                    )
                  )}
                </select>

                {!readyJobs.length && (
                  <p className="mt-2 text-[10px] text-amber-700">
                    No production job is currently
                    ready to ship.
                  </p>
                )}
              </div>


              <div className="grid gap-4 sm:grid-cols-2">

                <Input
                  label="Recipient Name *"
                  name="recipientName"
                  value={
                    form.recipientName
                  }
                  onChange={
                    handleChange
                  }
                />

                <Input
                  label="Recipient Phone"
                  name="recipientPhone"
                  value={
                    form.recipientPhone
                  }
                  onChange={
                    handleChange
                  }
                />

                <div className="sm:col-span-2">
                  <Input
                    label="Address Line 1 *"
                    name="line1"
                    value={
                      form.line1
                    }
                    onChange={
                      handleChange
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <Input
                    label="Address Line 2"
                    name="line2"
                    value={
                      form.line2
                    }
                    onChange={
                      handleChange
                    }
                  />
                </div>

                <Input
                  label="City *"
                  name="city"
                  value={
                    form.city
                  }
                  onChange={
                    handleChange
                  }
                />

                <Input
                  label="State *"
                  name="state"
                  value={
                    form.state
                  }
                  onChange={
                    handleChange
                  }
                />

                <Input
                  label="Pincode *"
                  name="postalCode"
                  value={
                    form.postalCode
                  }
                  onChange={
                    handleChange
                  }
                />

                <Input
                  label="Country"
                  name="country"
                  value={
                    form.country
                  }
                  onChange={
                    handleChange
                  }
                />

              </div>


              <div className="border-t border-black/[0.06] pt-6">

                <p className="text-sm font-black">
                  Courier Details
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">

                  <Input
                    label="Carrier"
                    name="carrier"
                    value={
                      form.carrier
                    }
                    onChange={
                      handleChange
                    }
                  />

                  <Input
                    label="Tracking Number"
                    name="trackingNumber"
                    value={
                      form.trackingNumber
                    }
                    onChange={
                      handleChange
                    }
                  />

                  <div className="sm:col-span-2">
                    <Input
                      label="Tracking URL"
                      name="trackingUrl"
                      value={
                        form.trackingUrl
                      }
                      onChange={
                        handleChange
                      }
                    />
                  </div>

                </div>

              </div>


              <div>
                <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-black/45">
                  Notes
                </label>

                <textarea
                  name="notes"
                  rows="3"
                  value={form.notes}
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-[#F97316]"
                />
              </div>


              <div className="flex justify-end gap-3 border-t border-black/[0.06] pt-5">

                <button
                  type="button"
                  onClick={() =>
                    setCreateOpen(false)
                  }
                  className="rounded-xl border border-black/10 px-5 py-3 text-xs font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#F97316] px-6 py-3 text-xs font-extrabold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Creating..."
                    : "Create Shipment"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
};


const Stat = ({
  label,
  value,
}) => (
  <div className="rounded-[18px] border border-black/[0.06] bg-white p-5">
    <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">
      {label}
    </p>

    <p className="mt-2 text-2xl font-black">
      {value}
    </p>
  </div>
);


const Mini = ({
  label,
  value,
}) => (
  <div>
    <p className="text-black/35">
      {label}
    </p>

    <p className="mt-0.5 truncate font-bold text-black/65">
      {pretty(value)}
    </p>
  </div>
);


const Info = ({
  label,
  value,
}) => (
  <div>
    <p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">
      {label}
    </p>

    <p className="mt-1 break-words text-xs font-bold text-black/70">
      {pretty(value)}
    </p>
  </div>
);


const Field = ({
  label,
  ...props
}) => (
  <label className="block">
    <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-wider text-black/40">
      {label}
    </span>

    <input
      {...props}
      className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#F97316]"
    />
  </label>
);


const Input = ({
  label,
  ...props
}) => (
  <label className="block">
    <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-black/45">
      {label}
    </span>

    <input
      {...props}
      className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#F97316]"
    />
  </label>
);


const ActionButton = ({
  children,
  primary,
  success,
  danger,
  ...props
}) => {
  let style =
    "border border-black/10 bg-white text-[#171717] hover:border-[#F97316] hover:text-[#F97316]";

  if (primary) {
    style =
      "bg-[#F97316] text-white";
  }

  if (success) {
    style =
      "bg-emerald-600 text-white";
  }

  if (danger) {
    style =
      "bg-red-50 text-red-700 hover:bg-red-600 hover:text-white";
  }

  return (
    <button
      type="button"
      {...props}
      className={`rounded-xl px-4 py-2.5 text-[10px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40 ${style}`}
    >
      {children}
    </button>
  );
};


export default Fulfilment;