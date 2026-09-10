import { useEffect, useMemo, useState } from "react";
import api from "../../api/api.js";


const STAGES = [
  "confirmed",
  "personalization",
  "assembly",
  "qc",
  "packing",
  "ready_to_ship",
  "on_hold",
  "cancelled",
];


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


const getJobs = (data = {}) =>
  data.productionJobs ||
  data.jobs ||
  data.items ||
  [];


const customerStage = (stage) => {
  if (["shipped"].includes(stage)) return "Dispatched";
  if (["delivered"].includes(stage)) return "Delivered";
  if (["ready_to_ship"].includes(stage)) return "Packed";
  if (["cancelled"].includes(stage)) return "Cancelled";
  if (["confirmed"].includes(stage)) return "Confirmed";
  return "Preparing";
};

const statusClass = (status) => {
  switch (status) {
    case "delivered":
      return "bg-emerald-50 text-emerald-700";
    case "shipped":
      return "bg-blue-50 text-blue-700";
    case "ready_to_ship":
      return "bg-violet-50 text-violet-700";
    case "qc":
      return "bg-amber-50 text-amber-700";
    case "on_hold":
      return "bg-red-50 text-red-700";
    case "cancelled":
      return "bg-gray-100 text-gray-500";
    default:
      return "bg-orange-50 text-[#F97316]";
  }
};


const emptyCreateForm = {
  sourceType: "order",
  sourceId: "",
  title: "",
  priority: "normal",
  dueDate: "",
  assignedTo: "",
  notes: "",

  itemName: "",
  sku: "",
  quantity: 1,
  personalizationRequired: false,
  personalizationDetails: "",
};


const Production = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedId, setSelectedId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [syncing, setSyncing] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [stageFilter, setStageFilter] =
    useState("");

  const [createOpen, setCreateOpen] =
    useState(false);

  const [createForm, setCreateForm] =
    useState(emptyCreateForm);

  const [saving, setSaving] =
    useState(false);

  const [stageValue, setStageValue] =
    useState("");

  const [stageNote, setStageNote] =
    useState("");

  const [qcNote, setQcNote] =
    useState("");


  const loadJobs = async ({
    preserveSelection = true,
  } = {}) => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get("/production", {
          params: { limit: 100 },
        });

      const list =
        getJobs(response.data);

      setJobs(list);

      if (
        !preserveSelection ||
        !selectedId ||
        !list.some(
          (job) =>
            job._id === selectedId
        )
      ) {
        setSelectedId(
          list[0]?._id || ""
        );
      }
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadJobs({
      preserveSelection: false,
    });
  }, []);


  const selectedJob =
    useMemo(
      () =>
        jobs.find(
          (job) =>
            job._id === selectedId
        ) || null,
      [jobs, selectedId]
    );


  useEffect(() => {
    setStageValue(
      selectedJob?.stage || ""
    );

    setStageNote("");
    setQcNote("");
  }, [selectedJob?._id]);


  const filteredJobs =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return jobs.filter((job) => {
        const matchesStage =
          !stageFilter ||
          job.stage === stageFilter;

        const searchable = [
          job.jobCode,
          job.title,
          job.sourceType,
          job.sourceId,
          job.customerUser?.name,
          job.customerUser?.email,
          job.assignedTo?.name,
          job.assignedTo?.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !query ||
          searchable.includes(query);

        return (
          matchesStage &&
          matchesSearch
        );
      });
    }, [
      jobs,
      search,
      stageFilter,
    ]);


  const stats =
    useMemo(
      () => ({
        total: jobs.length,

        active: jobs.filter(
          (job) =>
            ![
              "delivered",
              "cancelled",
            ].includes(job.stage)
        ).length,

        qc: jobs.filter(
          (job) =>
            job.stage === "qc"
        ).length,

        ready: jobs.filter(
          (job) =>
            job.stage ===
            "ready_to_ship"
        ).length,
      }),
      [jobs]
    );


  const handleCreateChange =
    (event) => {
      const {
        name,
        value,
        type,
        checked,
      } = event.target;

      setCreateForm((current) => ({
        ...current,

        [name]:
          type === "checkbox"
            ? checked
            : value,
      }));
    };


  const createJob = async (
    event
  ) => {
    event.preventDefault();

    if (
      !createForm.sourceType.trim() ||
      !createForm.sourceId.trim() ||
      !createForm.title.trim() ||
      !createForm.itemName.trim()
    ) {
      setError(
        "Source type, source ID, job title and item name are required."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        sourceType:
          createForm.sourceType.trim(),

        sourceId:
          createForm.sourceId.trim(),

        title:
          createForm.title.trim(),

        priority:
          createForm.priority,

        notes:
          createForm.notes.trim(),

        items: [
          {
            name:
              createForm.itemName.trim(),

            sku:
              createForm.sku.trim(),

            quantity:
              Math.max(
                1,
                Number(
                  createForm.quantity
                ) || 1
              ),

            personalizationRequired:
              createForm.personalizationRequired,

            personalizationDetails:
              createForm.personalizationDetails.trim(),
          },
        ],
      };

      if (createForm.dueDate) {
        payload.dueDate =
          createForm.dueDate;
      }

      if (
        createForm.assignedTo.trim()
      ) {
        payload.assignedTo =
          createForm.assignedTo.trim();
      }

      const response =
        await api.post(
          "/production",
          payload
        );

      setCreateForm(
        emptyCreateForm
      );

      setCreateOpen(false);

      await loadJobs({
        preserveSelection: false,
      });

      const created =
        response.data.productionJob ||
        response.data.job;

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


  const changeStage = async () => {
    if (
      !selectedJob ||
      !stageValue ||
      stageValue ===
        selectedJob.stage
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.patch(
        `/production/${selectedJob._id}/stage`,
        {
          stage: stageValue,
          note: stageNote.trim(),
        }
      );

      await loadJobs();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };


  const syncPaidOrders = async () => {
    try {
      setSyncing(true);
      setError("");
      setNotice("");

      const response =
        await api.post(
          "/production/sync-paid-orders",
          { limit: 500 }
        );

      const summary =
        response.data.summary || {};

      setNotice(
        `Paid-order sync complete: ${summary.created || 0} created, ${summary.existing || 0} already present, ${summary.failed || 0} failed.`
      );

      await loadJobs({
        preserveSelection: false,
      });
    } catch (err) {
      setError(getError(err));
    } finally {
      setSyncing(false);
    }
  };


  const submitQC = async (
    status
  ) => {
    if (!selectedJob) return;

    try {
      setSaving(true);
      setError("");

      await api.patch(
        `/production/${selectedJob._id}/qc`,
        {
          status,
          notes: qcNote.trim(),
        }
      );

      setQcNote("");

      await loadJobs();
    } catch (err) {
      setError(getError(err));
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
            Phase 9 · Operations
          </p>

          <h1 className="mt-2 text-2xl font-black">
            Production & QC
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Manage confirmed work through
            personalization, assembly, QC,
            packing and shipment readiness.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            type="button"
            disabled={syncing}
            onClick={syncPaidOrders}
            className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-xs font-extrabold text-white transition hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync Paid Orders"}
          </button>

          <button
            type="button"
            onClick={() =>
              setCreateOpen(true)
            }
            className="rounded-xl bg-[#F97316] px-5 py-3 text-xs font-extrabold text-white transition hover:bg-orange-600"
          >
            + Create Production Job
          </button>
        </div>

      </div>


      {/* ERROR */}

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

      {notice && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{notice}</span>

          <button
            type="button"
            onClick={() =>
              setNotice("")
            }
            className="font-bold"
          >
            ×
          </button>
        </div>
      )}


      {/* STATS */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <StatCard
          label="Total Jobs"
          value={stats.total}
        />

        <StatCard
          label="Active"
          value={stats.active}
        />

        <StatCard
          label="QC Due"
          value={stats.qc}
        />

        <StatCard
          label="Ready to Ship"
          value={stats.ready}
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
          placeholder="Search job, source, customer..."
          className="h-11 min-w-0 flex-1 rounded-xl border border-black/10 px-4 text-sm outline-none transition focus:border-[#F97316]"
        />

        <select
          value={stageFilter}
          onChange={(event) =>
            setStageFilter(
              event.target.value
            )
          }
          className="h-11 rounded-xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#F97316]"
        >
          <option value="">
            All stages
          </option>

          {[
            ...STAGES,
            "shipped",
            "delivered",
          ].map((item) => (
            <option
              key={item}
              value={item}
            >
              {pretty(item)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() =>
            loadJobs()
          }
          className="h-11 rounded-xl border border-black/10 px-5 text-xs font-extrabold transition hover:border-[#F97316] hover:text-[#F97316]"
        >
          Refresh
        </button>

      </div>


      {/* CONTENT */}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">

        {/* JOB LIST */}

        <div className="overflow-hidden rounded-[20px] border border-black/[0.06] bg-white">

          <div className="border-b border-black/[0.06] px-5 py-4">
            <p className="text-sm font-black">
              Production Queue
            </p>

            <p className="mt-1 text-[11px] text-black/45">
              {filteredJobs.length} job(s)
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-black/45">
              Loading production jobs...
            </div>
          ) : !filteredJobs.length ? (
            <div className="p-8 text-center text-sm text-black/45">
              No production jobs found.
            </div>
          ) : (
            <div className="max-h-[680px] divide-y divide-black/[0.05] overflow-y-auto">

              {filteredJobs.map(
                (job) => {
                  const active =
                    job._id ===
                    selectedId;

                  return (
                    <button
                      key={job._id}
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          job._id
                        )
                      }
                      className={`w-full p-5 text-left transition ${
                        active
                          ? "bg-[#FFF9F2]"
                          : "hover:bg-gray-50"
                      }`}
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#171717]">
                            {job.title ||
                              "Production Job"}
                          </p>

                          <p className="mt-1 truncate text-[10px] text-black/40">
                            {job.jobCode ||
                              job._id}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-extrabold ${statusClass(
                            job.stage
                          )}`}
                        >
                          {pretty(
                            job.stage
                          )}
                        </span>

                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">

                        <MiniValue
                          label="Source"
                          value={
                            job.sourceType
                          }
                        />

                        <MiniValue
                          label="Due"
                          value={formatDate(
                            job.dueDate
                          )}
                        />

                        <MiniValue
                          label="Priority"
                          value={
                            job.priority
                          }
                        />

                        <MiniValue
                          label="Items"
                          value={
                            job.items?.length ||
                            0
                          }
                        />

                      </div>

                    </button>
                  );
                }
              )}

            </div>
          )}

        </div>


        {/* DETAIL */}

        <div className="min-w-0">

          {!selectedJob ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-[20px] border border-dashed border-black/15 bg-white text-sm text-black/40">
              Select a production job.
            </div>
          ) : (
            <div className="space-y-5">

              <section className="rounded-[20px] border border-black/[0.06] bg-white p-6">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#F97316]">
                      Production Job
                    </p>

                    <h2 className="mt-2 text-xl font-black">
                      {selectedJob.title ||
                        "Production Job"}
                    </h2>

                    <p className="mt-1 break-all text-[10px] text-black/35">
                      {selectedJob.jobCode ||
                        selectedJob._id}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-extrabold ${statusClass(
                      selectedJob.stage
                    )}`}
                  >
                    {pretty(
                      selectedJob.stage
                    )}
                  </span>

                </div>


                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                  <Info
                    label="Source Type"
                    value={
                      selectedJob.sourceType
                    }
                  />

                  <Info
                    label="Source ID"
                    value={
                      selectedJob.sourceId
                    }
                  />

                  <Info
                    label="Customer-visible Stage"
                    value={customerStage(selectedJob.stage)}
                  />

                  <Info
                    label="Customer"
                    value={
                      selectedJob.customerUser?.name ||
                      selectedJob.customerUser?.email ||
                      "—"
                    }
                  />

                  <Info
                    label="Priority"
                    value={
                      selectedJob.priority
                    }
                  />

                  <Info
                    label="Due Date"
                    value={formatDate(
                      selectedJob.dueDate
                    )}
                  />

                  <Info
                    label="Assigned To"
                    value={
                      selectedJob.assignedTo
                        ?.name ||
                      selectedJob.assignedTo
                        ?.email ||
                      selectedJob.assignedTo ||
                      "Unassigned"
                    }
                  />

                  <Info
                    label="Created"
                    value={formatDate(
                      selectedJob.createdAt
                    )}
                  />

                </div>

                {selectedJob.notes && (
                  <div className="mt-5 rounded-xl bg-[#FFF9F2] p-4">
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">
                      Internal Notes
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/65">
                      {selectedJob.notes}
                    </p>
                  </div>
                )}

              </section>


              {/* STAGE ACTION */}

              {![
                "shipped",
                "delivered",
              ].includes(
                selectedJob.stage
              ) && (
                <section className="rounded-[20px] border border-black/[0.06] bg-white p-6">

                  <h3 className="text-sm font-black">
                    Move Production Stage
                  </h3>

                  <p className="mt-1 text-[11px] text-black/45">
                    Shipment dispatch and delivery are controlled from Fulfilment. Customer tracking automatically maps these internal stages to Confirmed, Preparing, Packed, Dispatched and Delivered.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)_auto]">

                    <select
                      value={stageValue}
                      onChange={(event) =>
                        setStageValue(
                          event.target.value
                        )
                      }
                      className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#F97316]"
                    >
                      {STAGES.map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {pretty(
                              item
                            )}
                          </option>
                        )
                      )}
                    </select>

                    <input
                      value={stageNote}
                      onChange={(event) =>
                        setStageNote(
                          event.target.value
                        )
                      }
                      placeholder="Optional status note"
                      className="h-11 rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#F97316]"
                    />

                    <button
                      type="button"
                      disabled={
                        saving ||
                        !stageValue ||
                        stageValue ===
                          selectedJob.stage
                      }
                      onClick={
                        changeStage
                      }
                      className="h-11 rounded-xl bg-[#171717] px-5 text-xs font-extrabold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Update
                    </button>

                  </div>

                </section>
              )}


              {/* QC */}

              {selectedJob.stage ===
                "qc" && (
                <section className="rounded-[20px] border border-amber-200 bg-amber-50/50 p-6">

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-700">
                    Quality Control
                  </p>

                  <h3 className="mt-2 text-base font-black">
                    Record QC Result
                  </h3>

                  <textarea
                    rows="3"
                    value={qcNote}
                    onChange={(event) =>
                      setQcNote(
                        event.target.value
                      )
                    }
                    placeholder="QC observation / defect / rework note"
                    className="mt-4 w-full rounded-xl border border-amber-200 bg-white p-3 text-sm outline-none focus:border-amber-500"
                  />

                  <div className="mt-3 flex flex-wrap gap-3">

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        submitQC(
                          "passed"
                        )
                      }
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
                    >
                      Pass QC
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        submitQC(
                          "failed"
                        )
                      }
                      className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
                    >
                      Fail QC
                    </button>

                  </div>

                </section>
              )}


              {/* ITEMS */}

              <section className="rounded-[20px] border border-black/[0.06] bg-white p-6">

                <h3 className="text-sm font-black">
                  Production Items
                </h3>

                <div className="mt-4 space-y-3">

                  {!selectedJob.items?.length ? (
                    <p className="text-sm text-black/40">
                      No items recorded.
                    </p>
                  ) : (
                    selectedJob.items.map(
                      (item, index) => (
                        <div
                          key={
                            item._id ||
                            index
                          }
                          className="rounded-xl border border-black/[0.07] p-4"
                        >
                          <div className="flex items-start justify-between gap-4">

                            <div>
                              <p className="text-sm font-bold">
                                {item.name ||
                                  item.productName ||
                                  item.title ||
                                  `Item ${
                                    index + 1
                                  }`}
                              </p>

                              <p className="mt-1 text-[10px] text-black/40">
                                SKU:{" "}
                                {item.sku ||
                                  "—"}
                              </p>
                            </div>

                            <span className="rounded-lg bg-gray-100 px-3 py-1 text-[10px] font-bold">
                              Qty{" "}
                              {item.quantity ||
                                1}
                            </span>

                          </div>

                          {(item.personalizationRequired ||
                            item.personalizationDetails) && (
                            <div className="mt-3 rounded-lg bg-[#FFF9F2] px-3 py-2 text-[11px] text-black/60">
                              <span className="font-bold text-[#F97316]">
                                Personalization:
                              </span>{" "}
                              {item.personalizationDetails ||
                                "Required"}
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <ItemStatus label="Assembly" value={item.assemblyStatus} />
                            <ItemStatus label="QC" value={item.qcStatus} />
                            <ItemStatus label="Packing" value={item.packingStatus} />
                          </div>

                          {item.notes && (
                            <p className="mt-3 text-[10px] leading-5 text-black/45">
                              {item.notes}
                            </p>
                          )}

                        </div>
                      )
                    )
                  )}

                </div>

              </section>


              {/* HISTORY */}

              <section className="rounded-[20px] border border-black/[0.06] bg-white p-6">

                <h3 className="text-sm font-black">
                  Status History
                </h3>

                <div className="mt-4 space-y-4">

                  {!selectedJob
                    .history
                    ?.length ? (
                    <p className="text-sm text-black/40">
                      No status history.
                    </p>
                  ) : (
                    [
                      ...selectedJob
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

                            <div className="min-w-0">
                              <p className="text-xs font-bold">
                                {pretty(
                                  history.stage ||
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
                                  history.at
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

      </div>


      {/* CREATE MODAL */}

      {createOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-4">

          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[22px] bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.06] bg-white px-6 py-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#F97316]">
                  Phase 9
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Create Production Job
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCreateOpen(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg"
              >
                ×
              </button>
            </div>


            <form
              onSubmit={createJob}
              className="space-y-6 p-6"
            >

              <div className="grid gap-4 sm:grid-cols-2">

                <Field
                  label="Source Type *"
                  name="sourceType"
                  value={
                    createForm.sourceType
                  }
                  onChange={
                    handleCreateChange
                  }
                  placeholder="order"
                />

                <Field
                  label="Source ID *"
                  name="sourceId"
                  value={
                    createForm.sourceId
                  }
                  onChange={
                    handleCreateChange
                  }
                  placeholder="MongoDB source ID"
                />

                <div className="sm:col-span-2">
                  <Field
                    label="Job Title *"
                    name="title"
                    value={
                      createForm.title
                    }
                    onChange={
                      handleCreateChange
                    }
                    placeholder="Corporate Diwali Hamper Production"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-black/45">
                    Priority
                  </label>

                  <select
                    name="priority"
                    value={
                      createForm.priority
                    }
                    onChange={
                      handleCreateChange
                    }
                    className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#F97316]"
                  >
                    <option value="low">
                      Low
                    </option>
                    <option value="normal">
                      Normal
                    </option>
                    <option value="high">
                      High
                    </option>
                    <option value="urgent">
                      Urgent
                    </option>
                  </select>
                </div>

                <Field
                  label="Due Date"
                  type="date"
                  name="dueDate"
                  value={
                    createForm.dueDate
                  }
                  onChange={
                    handleCreateChange
                  }
                />

                <div className="sm:col-span-2">
                  <Field
                    label="Assigned User ID"
                    name="assignedTo"
                    value={
                      createForm.assignedTo
                    }
                    onChange={
                      handleCreateChange
                    }
                    placeholder="Optional internal user ID"
                  />
                </div>

              </div>


              <div className="border-t border-black/[0.06] pt-6">

                <p className="text-sm font-black">
                  Initial Production Item
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">

                  <Field
                    label="Item Name *"
                    name="itemName"
                    value={
                      createForm.itemName
                    }
                    onChange={
                      handleCreateChange
                    }
                    placeholder="Premium Hamper"
                  />

                  <Field
                    label="SKU"
                    name="sku"
                    value={
                      createForm.sku
                    }
                    onChange={
                      handleCreateChange
                    }
                    placeholder="HMP-001"
                  />

                  <Field
                    label="Quantity"
                    type="number"
                    min="1"
                    name="quantity"
                    value={
                      createForm.quantity
                    }
                    onChange={
                      handleCreateChange
                    }
                  />

                  <label className="flex h-11 items-center gap-3 self-end rounded-xl border border-black/10 px-4 text-xs font-semibold">
                    <input
                      type="checkbox"
                      name="personalizationRequired"
                      checked={
                        createForm.personalizationRequired
                      }
                      onChange={
                        handleCreateChange
                      }
                    />

                    Personalization required
                  </label>

                  <div className="sm:col-span-2">
                    <Field
                      label="Personalization Details"
                      name="personalizationDetails"
                      value={
                        createForm.personalizationDetails
                      }
                      onChange={
                        handleCreateChange
                      }
                      placeholder="Names, logo, message, engraving..."
                    />
                  </div>

                </div>

              </div>


              <div>
                <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-black/45">
                  Internal Notes
                </label>

                <textarea
                  rows="3"
                  name="notes"
                  value={
                    createForm.notes
                  }
                  onChange={
                    handleCreateChange
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
                    : "Create Job"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
};


const StatCard = ({
  label,
  value,
}) => (
  <div className="rounded-[18px] border border-black/[0.06] bg-white p-5">
    <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/35">
      {label}
    </p>

    <p className="mt-2 text-2xl font-black text-[#171717]">
      {value}
    </p>
  </div>
);


const MiniValue = ({
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


const ItemStatus = ({
  label,
  value,
}) => (
  <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[9px] font-bold text-black/55">
    {label}: {pretty(value)}
  </span>
);


const Field = ({
  label,
  ...props
}) => (
  <label className="block">
    <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-black/45">
      {label}
    </span>

    <input
      {...props}
      className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none transition focus:border-[#F97316]"
    />
  </label>
);


export default Production;