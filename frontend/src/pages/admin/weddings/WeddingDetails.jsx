import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

const WeddingDetails = () => {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [events, setEvents] = useState([]);
  const [quote, setQuote] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [guests, setGuests] = useState([]);

  const [priority, setPriority] = useState("normal");
  const [promisedDate, setPromisedDate] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [conceptFile, setConceptFile] = useState(null);
  const [conceptTitle, setConceptTitle] = useState("");

  const [proofFile, setProofFile] = useState(null);
  const [proofType, setProofType] = useState("sample");

  const [milestone, setMilestone] = useState({
    title: "",
    amount: "",
    percentage: "",
    dueDate: "",
  });

  const [paymentIds, setPaymentIds] = useState({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/weddings/projects/${id}`);

      setProject(data.project);
      setEvents(data.events || []);
      setQuote(data.quote || null);
      setApprovals(data.approvals || []);

      setPriority(data.project.priority || "normal");
      setNextAction(data.project.nextAction || "");
      setInternalNotes(data.project.internalNotes || "");

      setPromisedDate(
        data.project.promisedDate
          ? new Date(data.project.promisedDate).toISOString().slice(0, 10)
          : ""
      );

      try {
        const guestResponse = await api.get(
          `/weddings/projects/${id}/guests`,
          { params: { limit: 50 } }
        );

        setGuests(guestResponse.data.guests || []);
      } catch {
        setGuests([]);
      }
    } catch (error) {
      setError(error.response?.data?.message || "Unable to load project.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveOperations = async () => {
    try {
      setBusy(true);

      await api.patch(`/weddings/projects/${id}/admin`, {
        priority,
        promisedDate: promisedDate || null,
        nextAction,
        internalNotes,
      });

      setSuccess("Wedding operations updated.");
      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to save operations.");
    } finally {
      setBusy(false);
    }
  };

  const uploadWeddingDocument = async (file, type, title) => {
    const formData = new FormData();

    formData.append("entityType", "wedding");
    formData.append("entityId", id);
    formData.append("documentType", type);
    formData.append("title", title);
    formData.append("file", file);

    const { data } = await api.post("/documents", formData);

    return data.document;
  };

  const publishConcept = async () => {
    if (!conceptFile) return;

    try {
      setBusy(true);
      setError("");

      const document = await uploadWeddingDocument(
        conceptFile,
        "concept",
        conceptTitle || "Wedding Concept"
      );

      await api.post(`/weddings/projects/${id}/concepts`, {
        documentId: document._id,
        title: conceptTitle || "Wedding Concept",
        description: "Wedding gifting concept for customer review.",
      });

      setConceptFile(null);
      setConceptTitle("");
      setSuccess("Wedding concept published.");

      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to publish concept.");
    } finally {
      setBusy(false);
    }
  };

  const publishProof = async () => {
    if (!proofFile) return;

    try {
      setBusy(true);
      setError("");

      const document = await uploadWeddingDocument(
        proofFile,
        proofType,
        `Wedding ${proofType}`
      );

      await api.post(`/weddings/projects/${id}/approvals`, {
        documentId: document._id,
        subjectType: proofType,
        title: `Wedding ${proofType} approval`,
        description: `Please review the wedding ${proofType}.`,
      });

      setProofFile(null);
      setSuccess(`${proofType} published for approval.`);

      await load();
    } catch (error) {
      setError(
        error.response?.data?.message || "Unable to publish sample / proof."
      );
    } finally {
      setBusy(false);
    }
  };

  const createMilestone = async () => {
    if (!milestone.title.trim()) return;

    try {
      setBusy(true);

      await api.post(`/weddings/projects/${id}/payment-milestones`, {
        title: milestone.title,
        amount: Number(milestone.amount || 0),
        percentage: Number(milestone.percentage || 0),
        dueDate: milestone.dueDate || null,
        required: true,
      });

      setMilestone({
        title: "",
        amount: "",
        percentage: "",
        dueDate: "",
      });

      setSuccess("Payment milestone created.");
      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to create milestone.");
    } finally {
      setBusy(false);
    }
  };

  const linkPayment = async (milestoneId) => {
    const paymentId = paymentIds[milestoneId];

    if (!paymentId?.trim()) return;

    try {
      setBusy(true);

      await api.post(
        `/weddings/projects/${id}/payment-milestones/${milestoneId}/link-payment`,
        { paymentId }
      );

      setSuccess("Payment linked.");
      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to link payment.");
    } finally {
      setBusy(false);
    }
  };

  const reviewGuests = async () => {
    try {
      setBusy(true);

      await api.post(`/weddings/projects/${id}/guests/review`);

      setSuccess("Wedding guest data approved.");
      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to approve guests.");
    } finally {
      setBusy(false);
    }
  };

  const allocateGuest = async (guest) => {
    const hotelName = window.prompt("Hotel", guest.hotelName || "");
    if (hotelName === null) return;

    const roomNumber = window.prompt("Room number", guest.roomNumber || "");
    if (roomNumber === null) return;

    const deliveryPoint = window.prompt(
      "Delivery point",
      guest.deliveryPoint || ""
    );

    if (deliveryPoint === null) return;

    try {
      await api.patch(
        `/weddings/projects/${id}/guests/${guest._id}/allocation`,
        {
          hotelName,
          roomNumber,
          deliveryPoint,
          deliveryStatus: "allocated",
        }
      );

      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to allocate guest.");
    }
  };

  const sync = async () => {
    await api.post(`/weddings/projects/${id}/sync`);
    await load();
  };

  if (!project) {
    return <div className="rounded-2xl border bg-white p-8">Loading...</div>;
  }

  const rfqId =
    typeof project.rfq === "string" ? project.rfq : project.rfq?._id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div>
          <p className="font-bold text-[#F26522]">
            {project.weddingProjectId}
          </p>

          <h1 className="mt-1 text-3xl font-bold">{project.projectTitle}</h1>

          <div className="mt-3">
            <StatusBadge status={project.status} />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={sync}
            className="rounded-xl border border-[#F26522] px-4 py-2 text-sm font-semibold text-[#F26522]"
          >
            Sync
          </button>

          <Link
            to="/admin/weddings"
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            ← Weddings
          </Link>
        </div>
      </div>

      {error && <Alert error>{error}</Alert>}
      {success && <Alert>{success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Guests" value={project.estimatedGuestCount || 0} />
        <Stat label="Events" value={events.length} />
        <Stat label="Concept V" value={project.currentConceptVersion || 0} />
        <Stat label="Next Action" value={project.nextAction || "—"} />
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-bold">Operations</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputClass}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <input
            type="date"
            value={promisedDate}
            onChange={(e) => setPromisedDate(e.target.value)}
            className={inputClass}
          />

          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="Next action"
            className={inputClass}
          />

          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Internal notes"
            className={inputClass}
          />
        </div>

        <button
          onClick={saveOperations}
          className="mt-4 rounded-xl bg-[#F26522] px-5 py-2.5 font-semibold text-white"
        >
          Save Operations
        </button>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-bold">Shared Commercial Workflow</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {rfqId ? (
            <Link
              to={`/admin/rfqs/${rfqId}`}
              className="rounded-xl bg-slate-50 p-4"
            >
              <p className="text-xs uppercase text-slate-400">RFQ</p>
              <p className="mt-2 font-bold">{project.rfq?.rfqId || "Open RFQ"}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-[#F26522]">
                Manage →
              </span>
            </Link>
          ) : (
            <Card title="RFQ" value="Not submitted" />
          )}

          {quote ? (
            <Link
              to={`/admin/quotes/${quote._id}`}
              className="rounded-xl bg-slate-50 p-4"
            >
              <p className="text-xs uppercase text-slate-400">Quote</p>
              <p className="mt-2 font-bold">
                {quote.quoteId} · V{quote.currentVersionNumber}
              </p>
              <span className="mt-3 inline-block text-sm font-semibold text-[#F26522]">
                Manage →
              </span>
            </Link>
          ) : (
            <Card title="Quote" value="Not created" />
          )}

          <Card title="Approvals" value={`${approvals.length} records`} />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-bold">Publish Wedding Concept</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={conceptTitle}
            onChange={(e) => setConceptTitle(e.target.value)}
            placeholder="Concept title"
            className={inputClass}
          />

          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => setConceptFile(e.target.files?.[0] || null)}
            className={inputClass}
          />

          <button
            onClick={publishConcept}
            disabled={!conceptFile || busy}
            className="rounded-xl bg-[#F26522] px-5 font-semibold text-white disabled:opacity-50"
          >
            Publish
          </button>
        </div>

        <div className="mt-5 divide-y">
          {project.concepts?.map((concept) => (
            <div
              key={concept._id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium">
                  V{concept.versionNumber} · {concept.title}
                </p>
              </div>

              <StatusBadge status={concept.status} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-bold">Sample / Proof Approval</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
          <select
            value={proofType}
            onChange={(e) => setProofType(e.target.value)}
            className={inputClass}
          >
            <option value="sample">Sample</option>
            <option value="proof">Proof</option>
            <option value="artwork">Artwork</option>
            <option value="specification">Specification</option>
          </select>

          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
            className={inputClass}
          />

          <button
            onClick={publishProof}
            disabled={!proofFile || busy}
            className="rounded-xl bg-[#F26522] px-5 font-semibold text-white disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-bold">Payment Milestones</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            placeholder="Milestone title"
            value={milestone.title}
            onChange={(e) =>
              setMilestone((p) => ({ ...p, title: e.target.value }))
            }
            className={inputClass}
          />

          <input
            type="number"
            placeholder="Amount"
            value={milestone.amount}
            onChange={(e) =>
              setMilestone((p) => ({ ...p, amount: e.target.value }))
            }
            className={inputClass}
          />

          <input
            type="number"
            placeholder="%"
            value={milestone.percentage}
            onChange={(e) =>
              setMilestone((p) => ({ ...p, percentage: e.target.value }))
            }
            className={inputClass}
          />

          <button
            onClick={createMilestone}
            disabled={!milestone.title || busy}
            className="rounded-xl bg-[#F26522] font-semibold text-white"
          >
            Add Milestone
          </button>
        </div>

        <div className="mt-5 divide-y">
          {project.paymentMilestones?.map((item) => (
            <div key={item._id} className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    ₹{Number(item.amount || 0).toLocaleString("en-IN")}
                  </p>
                </div>

                <StatusBadge status={item.status} />
              </div>

              {!item.payment && item.status !== "waived" && (
                <div className="mt-3 flex gap-2">
                  <input
                    placeholder="Existing Payment Mongo ID"
                    value={paymentIds[item._id] || ""}
                    onChange={(e) =>
                      setPaymentIds((p) => ({
                        ...p,
                        [item._id]: e.target.value,
                      }))
                    }
                    className={`${inputClass} flex-1`}
                  />

                  <button
                    onClick={() => linkPayment(item._id)}
                    className="rounded-xl border border-[#F26522] px-4 text-sm font-semibold text-[#F26522]"
                  >
                    Link Payment
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">Guest / Hotel Review</h2>
            <p className="mt-1 text-sm text-slate-500">
              Approve only after invalid rows are corrected.
            </p>
          </div>

          <button
            onClick={reviewGuests}
            disabled={
              busy ||
              !project.guestSummary?.total ||
              project.guestSummary?.invalid > 0 ||
              project.guestImportStatus === "approved"
            }
            className="rounded-xl bg-[#F26522] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Approve Guests
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Stat label="Total" value={project.guestSummary?.total || 0} />
          <Stat label="Valid" value={project.guestSummary?.valid || 0} />
          <Stat label="Invalid" value={project.guestSummary?.invalid || 0} />
          <Stat label="Allocated" value={project.guestSummary?.allocated || 0} />
        </div>

        <div className="mt-5 divide-y">
          {guests.map((guest) => (
            <div
              key={guest._id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{guest.name}</p>
                <p className="text-xs text-slate-500">
                  {guest.hotelName || "No hotel"}{" "}
                  {guest.roomNumber ? `· Room ${guest.roomNumber}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge status={guest.deliveryStatus} />

                <button
                  onClick={() => allocateGuest(guest)}
                  className="text-sm font-semibold text-[#F26522]"
                >
                  Allocate
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {project.status === "ready_for_production" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
          <h2 className="font-bold">Ready for Production ✅</h2>
          <p className="mt-2 text-sm">
            Wedding commercial approvals, required payments and guest data
            are complete.
          </p>
        </div>
      )}
    </div>
  );
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F26522]";

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <p className="text-xs uppercase text-slate-400">{label}</p>
    <p className="mt-1 font-bold">{value}</p>
  </div>
);

const Card = ({ title, value }) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <p className="text-xs uppercase text-slate-400">{title}</p>
    <p className="mt-2 font-bold">{value}</p>
  </div>
);

const Alert = ({ error, children }) => (
  <div
    className={
      error
        ? "rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
        : "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700"
    }
  >
    {children}
  </div>
);

export default WeddingDetails;