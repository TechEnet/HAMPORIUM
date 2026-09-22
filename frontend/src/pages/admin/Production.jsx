import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

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

const pretty = (value) =>
  String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const isDone = (value) =>
  ["done", "not_required"].includes(
    String(value || "").toLowerCase()
  );

const hasPersonalization = (job) =>
  (job?.items || []).some(
    (item) => item.personalizationRequired
  );

const firstStage = (job) =>
  hasPersonalization(job)
    ? "personalization"
    : "assembly";

const getStageLabel = (stage) => {
  switch (stage) {
    case "confirmed":
      return "Not Started";
    case "personalization":
      return "Personalisation";
    case "assembly":
      return "Preparing";
    case "qc":
      return "Quality Check";
    case "packing":
      return "Packing";
    case "ready_to_ship":
      return "Ready to Ship";
    case "shipped":
      return "Dispatched";
    case "delivered":
      return "Delivered";
    case "on_hold":
      return "On Hold";
    case "cancelled":
      return "Cancelled";
    default:
      return pretty(stage);
  }
};

const getOrderLabel = (job) => {
  const title = String(job?.title || "");

  const cleaned = title
    .replace(/^Order\s+/i, "")
    .replace(/\s+Production$/i, "")
    .trim();

  return cleaned || job?.jobCode || "Order";
};

const stageTone = (stage) => {
  if (stage === "delivered") {
    return {
      dot: "bg-emerald-500",
      text: "text-emerald-700",
      soft: "bg-emerald-50",
    };
  }

  if (stage === "ready_to_ship") {
    return {
      dot: "bg-emerald-500",
      text: "text-emerald-700",
      soft: "bg-emerald-50",
    };
  }

  if (stage === "shipped") {
    return {
      dot: "bg-blue-500",
      text: "text-blue-700",
      soft: "bg-blue-50",
    };
  }

  if (["cancelled", "on_hold"].includes(stage)) {
    return {
      dot: "bg-red-500",
      text: "text-red-600",
      soft: "bg-red-50",
    };
  }

  if (stage === "qc") {
    return {
      dot: "bg-amber-500",
      text: "text-amber-700",
      soft: "bg-amber-50",
    };
  }

  return {
    dot: "bg-[#F47822]",
    text: "text-[#B95713]",
    soft: "bg-[#FFF5EC]",
  };
};

const Production = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [qcNote, setQcNote] = useState("");

  const loadJobs = async ({
    preserveSelection = true,
  } = {}) => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/production", {
        params: {
          limit: 100,
          sourceType: "order",
        },
      });

      const list =
        response.data.jobs ||
        response.data.productionJobs ||
        [];

      setJobs(list);

      if (
        !preserveSelection ||
        !selectedId ||
        !list.some(
          (job) => job._id === selectedId
        )
      ) {
        setSelectedId(list[0]?._id || "");
      }
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs({
      preserveSelection: false,
    });
  }, []);

  const selectedJob = useMemo(
    () =>
      jobs.find(
        (job) => job._id === selectedId
      ) || null,
    [jobs, selectedId]
  );

  useEffect(() => {
    setQcNote("");
  }, [selectedJob?._id]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return jobs;

    return jobs.filter((job) =>
      [
        getOrderLabel(job),
        job.jobCode,
        job.sourceId,
        job.customerUser?.name,
        job.customerUser?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [jobs, search]);

  const summary = useMemo(
    () => ({
      total: jobs.length,
      waiting: jobs.filter(
        (job) => job.stage === "confirmed"
      ).length,
      active: jobs.filter((job) =>
        [
          "personalization",
          "assembly",
          "qc",
          "packing",
        ].includes(job.stage)
      ).length,
      ready: jobs.filter(
        (job) => job.stage === "ready_to_ship"
      ).length,
    }),
    [jobs]
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

      await loadJobs();
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setWorking(false);
    }
  };

  const startOrder = async () => {
    if (!selectedJob) return;

    await run(() =>
      api.patch(
        `/production/${selectedJob._id}/stage`,
        {
          stage: firstStage(selectedJob),
          note: "Order preparation started.",
        }
      )
    );
  };

  const completeItemStep = async (
    item,
    field
  ) => {
    if (!selectedJob || !item?._id) {
      return;
    }

    await run(() =>
      api.patch(
        `/production/${selectedJob._id}/items/${item._id}`,
        {
          [field]: "done",
        }
      )
    );
  };

  const submitQC = async (status) => {
    if (!selectedJob) return;

    await run(() =>
      api.patch(
        `/production/${selectedJob._id}/qc`,
        {
          status,
          notes: qcNote.trim(),
        }
      )
    );

    setQcNote("");
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
              Order Preparation
            </p>

            <h1
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-2 text-[48px] font-semibold leading-none tracking-[-0.045em] sm:text-[58px]"
            >
              Prepare{" "}
              <span className="italic text-[#B18422]">
                Orders
              </span>
            </h1>

            <p className="mt-4 max-w-[720px] text-[15px] leading-7 text-black/52">
              Paid orders come here automatically. Prepare the items, run quality check, pack the order and send it for delivery.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadJobs()}
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
          label="All Orders"
          value={summary.total}
        />

        <SummaryStat
          label="Not Started"
          value={summary.waiting}
        />

        <SummaryStat
          label="In Preparation"
          value={summary.active}
        />

        <SummaryStat
          label="Ready to Ship"
          value={summary.ready}
        />
      </section>

      {/* SEARCH */}

      <section className="border-b border-black/[0.08] py-5">
        <div className="flex items-end gap-4">
          <div className="min-w-0 flex-1">
            <label className="text-[12px] font-bold uppercase tracking-[0.06em] text-black/38">
              Search Orders
            </label>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Order number, customer or job code"
              className="mt-2 h-11 w-full border-0 border-b border-black/[0.15] bg-transparent px-0 text-[15px] font-semibold outline-none placeholder:text-black/25 focus:border-[#F47822]"
            />
          </div>

          <p className="hidden pb-3 text-[13px] font-semibold text-black/35 sm:block">
            {filteredJobs.length} shown
          </p>
        </div>
      </section>

      {/* WORKSPACE */}

      <div className="grid gap-8 pt-7 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* LEFT */}

        <section className="min-w-0 xl:border-r xl:border-black/[0.08] xl:pr-8">
          <div className="mb-4">
            <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-black/45">
              Orders to Prepare
            </p>

            <p className="mt-1 text-[13px] leading-5 text-black/38">
              Select an order to continue.
            </p>
          </div>

          {loading ? (
            <div className="border-y border-black/[0.08] py-10 text-[14px] text-black/45">
              Loading orders...
            </div>
          ) : !filteredJobs.length ? (
            <div className="border-y border-black/[0.08] py-10">
              <p className="text-[17px] font-extrabold">
                No orders waiting
              </p>

              <p className="mt-2 text-[14px] leading-6 text-black/42">
                New paid orders will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="border-t border-black/[0.08]">
              {filteredJobs.map((job) => {
                const active =
                  job._id === selectedId;

                return (
                  <button
                    key={job._id}
                    type="button"
                    onClick={() =>
                      setSelectedId(job._id)
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
                          {getOrderLabel(job)}
                        </p>

                        <p className="mt-1 truncate text-[13px] font-medium text-black/42">
                          {job.customerUser?.name ||
                            job.customerUser?.email ||
                            job.jobCode}
                        </p>
                      </div>

                      <SimpleStatus
                        stage={job.stage}
                      />
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <QueueMeta
                        label="Dispatch By"
                        value={formatDate(
                          job.dueDate
                        )}
                      />

                      <QueueMeta
                        label="Deliver By"
                        value={formatDate(
                          job.expectedDeliveryDate
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* RIGHT */}

        <section className="min-w-0">
          {!selectedJob ? (
            <EmptySelection
              title="Select an order"
              text="Choose an order from the left to start or continue preparation."
            />
          ) : (
            <>
              <OrderHeader
                job={selectedJob}
              />

              <ProductionProgress
                stage={selectedJob.stage}
              />

              <NextAction
                job={selectedJob}
                working={working}
                qcNote={qcNote}
                setQcNote={setQcNote}
                onStart={startOrder}
                onQC={submitQC}
              />

              <ItemsSection
                job={selectedJob}
                working={working}
                onComplete={
                  completeItemStep
                }
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
};

const OrderHeader = ({ job }) => (
  <section className="border-b border-black/[0.08] pb-7">
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#9A7118]">
          {job.jobCode}
        </p>

        <h2
          style={{
            fontFamily: DISPLAY_FONT,
          }}
          className="mt-2 break-words text-[38px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[44px]"
        >
          {getOrderLabel(job)}
        </h2>

        <p className="mt-2 text-[15px] font-semibold text-black/50">
          {job.customerUser?.name ||
            job.customerUser?.email ||
            "Customer"}
        </p>
      </div>

      <SimpleStatus
        stage={job.stage}
        large
      />
    </div>

    <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
      <Detail
        label="Dispatch By"
        value={formatDate(job.dueDate)}
      />

      <Detail
        label="Expected Delivery"
        value={formatDate(
          job.expectedDeliveryDate
        )}
      />

      <Detail
        label="Items"
        value={job.items?.length || 0}
      />

      <Detail
        label="Current Step"
        value={getStageLabel(job.stage)}
      />
    </div>

    {job.sourceId && (
      <Link
        to={`/admin/orders/${job.sourceId}`}
        className="mt-6 inline-flex items-center gap-2 border-b border-[#F47822]/40 pb-1 text-[13px] font-extrabold uppercase tracking-[0.05em] text-[#F47822] transition hover:border-[#181715] hover:text-[#181715]"
      >
        View Full Order
        <span>→</span>
      </Link>
    )}
  </section>
);

const ProductionProgress = ({ stage }) => {
  const rank = {
    confirmed: 0,
    personalization: 1,
    assembly: 1,
    qc: 2,
    packing: 3,
    ready_to_ship: 4,
    shipped: 4,
    delivered: 4,
  };

  const current = rank[stage] ?? 0;

  const steps = [
    "Prepare",
    "Quality Check",
    "Pack",
    "Ready to Ship",
  ];

  return (
    <section className="border-b border-black/[0.08] py-7">
      <p className="mb-5 text-[13px] font-extrabold uppercase tracking-[0.07em] text-black/42">
        Order Progress
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const complete =
            current >= stepNumber;
          const active =
            current === index ||
            (stage === "confirmed" && index === 0);

          return (
            <div
              key={step}
              className="relative"
            >
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
                  {complete ? "✓" : stepNumber}
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

const NextAction = ({
  job,
  working,
  qcNote,
  setQcNote,
  onStart,
  onQC,
}) => {
  if (job.stage === "confirmed") {
    return (
      <section className="border-b border-black/[0.08] py-7">
        <ActionEyebrow>
          Next Action
        </ActionEyebrow>

        <h3 className="mt-2 text-[22px] font-extrabold">
          Start preparing this order
        </h3>

        <p className="mt-2 max-w-[680px] text-[14px] leading-6 text-black/50">
          Start when your team is ready to work on this order.
        </p>

        <button
          type="button"
          disabled={working}
          onClick={onStart}
          className="mt-5 min-h-[48px] bg-[#181715] px-7 text-[13px] font-extrabold uppercase tracking-[0.05em] text-white transition hover:bg-[#F47822] disabled:opacity-40"
        >
          Start Preparation
        </button>
      </section>
    );
  }

  if (job.stage === "qc") {
    return (
      <section className="border-b border-black/[0.08] py-7">
        <ActionEyebrow>
          Next Action
        </ActionEyebrow>

        <h3 className="mt-2 text-[22px] font-extrabold">
          Check order quality
        </h3>

        <p className="mt-2 max-w-[680px] text-[14px] leading-6 text-black/50">
          Confirm the right items, quantities, personalisation and packaging before packing.
        </p>

        <textarea
          rows="3"
          value={qcNote}
          onChange={(event) =>
            setQcNote(event.target.value)
          }
          placeholder="Optional QC note"
          className="mt-5 w-full resize-none border-0 border-b border-black/[0.15] bg-transparent py-3 text-[14px] outline-none placeholder:text-black/25 focus:border-[#F47822]"
        />

        <div className="mt-5 flex flex-wrap gap-4">
          <button
            type="button"
            disabled={working}
            onClick={() =>
              onQC("passed")
            }
            className="min-h-[48px] bg-emerald-600 px-6 text-[13px] font-extrabold uppercase tracking-[0.05em] text-white disabled:opacity-40"
          >
            Pass Quality Check
          </button>

          <button
            type="button"
            disabled={working}
            onClick={() =>
              onQC("failed")
            }
            className="min-h-[48px] px-2 text-[13px] font-extrabold uppercase tracking-[0.05em] text-red-600 disabled:opacity-40"
          >
            Fail QC
          </button>
        </div>
      </section>
    );
  }

  if (job.stage === "ready_to_ship") {
    return (
      <section className="border-b border-black/[0.08] py-7">
        <ActionEyebrow>
          Preparation Complete
        </ActionEyebrow>

        <h3 className="mt-2 text-[22px] font-extrabold text-emerald-700">
          Order is ready to ship
        </h3>

        <p className="mt-2 max-w-[680px] text-[14px] leading-6 text-black/50">
          A delivery record has been created automatically. Continue from Ship & Deliver.
        </p>

        <Link
          to="/admin/fulfilment"
          className="mt-5 inline-flex items-center gap-2 border-b border-[#F47822]/40 pb-1 text-[13px] font-extrabold uppercase tracking-[0.05em] text-[#F47822]"
        >
          Go to Ship & Deliver
          <span>→</span>
        </Link>
      </section>
    );
  }

  if (
    ["shipped", "delivered"].includes(job.stage)
  ) {
    return (
      <section className="border-b border-black/[0.08] py-7">
        <p className="text-[15px] font-semibold leading-6 text-black/55">
          Preparation is complete. Delivery updates are handled from Ship & Deliver.
        </p>
      </section>
    );
  }

  return (
    <section className="border-b border-black/[0.08] py-7">
      <ActionEyebrow>
        Next Action
      </ActionEyebrow>

      <h3 className="mt-2 text-[22px] font-extrabold">
        Complete the current item steps
      </h3>

      <p className="mt-2 max-w-[680px] text-[14px] leading-6 text-black/50">
        Use the action beside each item below. The next stage updates automatically.
      </p>
    </section>
  );
};

const ItemsSection = ({
  job,
  working,
  onComplete,
}) => (
  <section className="pt-7">
    <div className="flex items-end justify-between border-b border-black/[0.08] pb-4">
      <div>
        <p className="text-[13px] font-extrabold uppercase tracking-[0.07em] text-black/42">
          Order Contents
        </p>

        <h3
          style={{
            fontFamily: DISPLAY_FONT,
          }}
          className="mt-1 text-[34px] font-semibold tracking-[-0.02em]"
        >
          Items
        </h3>
      </div>

      <span className="text-[13px] font-semibold text-black/38">
        {job.items?.length || 0} total
      </span>
    </div>

    {(job.items || []).map(
      (item, index) => (
        <ItemRow
          key={item._id || index}
          item={item}
          stage={job.stage}
          working={working}
          onComplete={onComplete}
        />
      )
    )}
  </section>
);

const ItemRow = ({
  item,
  stage,
  working,
  onComplete,
}) => {
  let field = "";
  let action = "";
  let completionLabel = "";

  if (
    stage === "personalization" &&
    item.personalizationRequired &&
    !isDone(item.personalizationStatus)
  ) {
    field = "personalizationStatus";
    action = "Personalisation Done";
  }

  if (
    stage === "assembly" &&
    !isDone(item.assemblyStatus)
  ) {
    field = "assemblyStatus";
    action = "Prepared";
  }

  if (
    stage === "packing" &&
    !isDone(item.packingStatus)
  ) {
    field = "packingStatus";
    action = "Packed";
  }

  if (stage === "qc") {
    completionLabel = "Ready for QC";
  }

  if (
    ["ready_to_ship", "shipped", "delivered"].includes(
      stage
    )
  ) {
    completionLabel = "Complete";
  }

  return (
    <article className="border-b border-black/[0.07] py-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_130px_200px] md:items-center">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold leading-6">
            {item.name || "Item"}
          </p>

          <p className="mt-1 text-[13px] font-medium text-black/42">
            Qty {item.quantity || 1}
            {item.sku
              ? ` · ${item.sku}`
              : ""}
          </p>

          {item.personalizationRequired &&
            item.personalizationDetails && (
              <p className="mt-3 max-w-3xl whitespace-pre-wrap text-[13px] leading-6 text-black/48">
                {item.personalizationDetails}
              </p>
            )}
        </div>

        <div className="text-[13px] font-semibold text-black/45">
          {completionLabel}
        </div>

        <div className="md:text-right">
          {field && (
            <button
              type="button"
              disabled={working}
              onClick={() =>
                onComplete(item, field)
              }
              className="text-[13px] font-extrabold text-[#F47822] transition hover:text-[#181715] disabled:opacity-40"
            >
              Mark {action} →
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

const SimpleStatus = ({
  stage,
  large = false,
}) => {
  const tone = stageTone(stage);

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
        {getStageLabel(stage)}
      </span>
    </div>
  );
};

const SummaryStat = ({
  label,
  value,
}) => (
  <div className="border-r border-black/[0.08] py-5 pr-4 last:border-r-0 md:px-5 md:first:pl-0">
    <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-black/35">
      {label}
    </p>

    <p
      style={{
        fontFamily: DISPLAY_FONT,
      }}
      className="mt-1 text-[32px] font-semibold leading-none"
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

    <p className="mt-1 text-[13px] font-bold text-black/62">
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

export default Production;
