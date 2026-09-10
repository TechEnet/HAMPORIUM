import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";
import CustomHamperRequestCard from "../../../components/CustomHamperRequestCard.jsx";

const emptyItem = () => ({
  productReference: "",
  name: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  personalization: "",
  packaging: "",
  moq: 0,
  stockStatus: "",
});

const paymentLabel = (status) =>
  String(status || "not_started")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const buildCustomHamperQuoteItem = (rfq) => {
  const request = rfq?.customHamperRequest;

  if (!request) return null;

  const itemSummary = (request.items || [])
    .map((item) => `${item.name} x${item.quantity}`)
    .join(", ");

  const decorationSummary = (request.decorations || [])
    .map((item) => `${item.name} x${item.quantity}`)
    .join(", ");

  const personalization = request.personalization?.enabled
    ? [
        request.personalization.message
          ? `Text: ${request.personalization.message}`
          : "",
        request.personalization.instructions
          ? `Instructions: ${request.personalization.instructions}`
          : "",
        (request.personalization.assets || []).length
          ? `${request.personalization.assets.length} artwork file(s)`
          : "",
      ]
        .filter(Boolean)
        .join(" | ")
    : "";

  return {
    productReference: request.containerCode || rfq.rfqId || "CUSTOM-HAMPER",
    name: `Custom Hamper - ${request.containerName || "Configured Hamper"}`,
    description: itemSummary
      ? `Customer configuration: ${itemSummary}`
      : "Customer-configured custom hamper",
    quantity: Math.max(1, Number(rfq.quantity || 1)),
    unitPrice: Number(request.indicativePricing?.total || 0),
    personalization,
    packaging: [
      request.containerName ? `Box: ${request.containerName}` : "",
      decorationSummary ? `Finishing: ${decorationSummary}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    moq: 0,
    stockStatus: "Customer configuration validated at RFQ submission",
  };
};

const RFQDetails = () => {
  const { id } = useParams();

  const [rfq, setRfq] = useState(null);
  const [quote, setQuote] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [priority, setPriority] = useState("normal");
  const [rfqStatus, setRfqStatus] = useState("submitted");
  const [nextAction, setNextAction] = useState("");
  const [promisedDate, setPromisedDate] = useState("");

  const [proofFile, setProofFile] = useState(null);
  const [proofTitle, setProofTitle] = useState("");
  const [selectedProof, setSelectedProof] = useState("");
  const [approvalTitle, setApprovalTitle] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const rfqResponse = await api.get(`/rfqs/${id}`);
      const currentRFQ = rfqResponse.data.rfq;

      setRfq(currentRFQ);
      setPriority(currentRFQ.priority || "normal");
      setRfqStatus(currentRFQ.status);
      setNextAction(currentRFQ.nextAction || "");
      setPromisedDate(
        currentRFQ.promisedDate
          ? new Date(currentRFQ.promisedDate)
              .toISOString()
              .slice(0, 10)
          : ""
      );

      try {
        const quoteResponse = await api.get(`/quotes/rfq/${id}`);
        setQuote(quoteResponse.data.quote);
      } catch (quoteError) {
        if (quoteError.response?.status === 404) {
          setQuote(null);
        } else {
          throw quoteError;
        }
      }

      const documentResponse = await api.get(
        `/documents/entity/rfq/${id}`
      );
      setDocuments(documentResponse.data.documents || []);

      const approvalResponse = await api.get("/approvals/admin/all");
      setApprovals(
        (approvalResponse.data.approvals || []).filter((approval) => {
          const rfqId =
            typeof approval.rfq === "string"
              ? approval.rfq
              : approval.rfq?._id;

          return rfqId === id;
        })
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load RFQ"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentVersion = useMemo(() => {
    if (!quote) return null;

    return quote.versions?.find(
      (version) =>
        version.versionNumber === quote.currentVersionNumber
    );
  }, [quote]);

  const activeProofs = useMemo(
    () =>
      documents.filter(
        (document) =>
          ["proof", "artwork", "sample"].includes(
            document.documentType
          ) && document.status === "active"
      ),
    [documents]
  );

  const isCustomHamperRFQ =
    rfq?.sourceType === "custom_hamper" &&
    Boolean(rfq?.customHamperRequest);

  const proofFlowAvailable =
    Boolean(quote?.acceptedVersionNumber) &&
    (!isCustomHamperRFQ || rfq?.commercialPaymentStatus === "paid");

  const updateOperations = async () => {
    try {
      setBusy(true);
      setError("");

      await api.patch(`/rfqs/${id}/admin`, {
        priority,
        status: rfqStatus,
        promisedDate: promisedDate || null,
        nextAction,
      });

      setSuccess("RFQ updated successfully.");
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update RFQ"
      );
    } finally {
      setBusy(false);
    }
  };

  const sendQuote = async () => {
    if (!quote) return;

    const confirmed = window.confirm(
      `Send Quote V${quote.currentVersionNumber} to the customer?`
    );

    if (!confirmed) return;

    try {
      setBusy(true);
      setError("");

      await api.post(`/quotes/${quote._id}/send`);
      setSuccess(
        `Quote V${quote.currentVersionNumber} sent successfully.`
      );
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to send quote"
      );
    } finally {
      setBusy(false);
    }
  };

  const uploadProof = async () => {
    if (!proofFile) {
      setError("Please select a proof file.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const formData = new FormData();
      formData.append("entityType", "rfq");
      formData.append("entityId", id);
      formData.append("documentType", "proof");
      formData.append("title", proofTitle || "Customer Proof");
      formData.append("file", proofFile);

      await api.post("/documents", formData);

      setProofFile(null);
      setProofTitle("");
      setSuccess("Proof uploaded successfully.");
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to upload proof"
      );
    } finally {
      setBusy(false);
    }
  };

  const replaceProof = (document) => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.webp";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        setBusy(true);
        setError("");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", document.title || "Revised Proof");

        await api.post(
          `/documents/${document._id}/replace`,
          formData
        );

        setSuccess("New proof version uploaded.");
        await loadData();
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to upload revised proof"
        );
      } finally {
        setBusy(false);
      }
    };

    input.click();
  };

  const createApproval = async () => {
    if (!quote?.acceptedVersionNumber) {
      setError(
        "The customer must accept the quote before proof approval."
      );
      return;
    }

    if (isCustomHamperRFQ && rfq.commercialPaymentStatus !== "paid") {
      setError(
        "For a bulk Custom Hamper, payment must complete before publishing production proof approval."
      );
      return;
    }

    if (!selectedProof) {
      setError("Please select the proof to send for approval.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      await api.post("/approvals", {
        rfqId: id,
        quoteId: quote._id,
        documentId: selectedProof,
        subjectType: "proof",
        title: approvalTitle || "Proof Approval",
        description:
          "Please review this proof and approve or request changes.",
      });

      setSelectedProof("");
      setApprovalTitle("");
      setSuccess("Approval request published successfully.");
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to create approval request"
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading RFQ...
      </div>
    );
  }

  if (!rfq) return null;

  const finalOrderId =
    rfq.order?._id ||
    rfq.order ||
    quote?.order?._id ||
    quote?.order ||
    "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#F26522]">
            {rfq.rfqId}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
            {rfq.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={rfq.status} />
            <span className="text-sm text-slate-500">
              {rfq.companyName}
            </span>
            {isCustomHamperRFQ && (
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-[#F26522]">
                Custom Hamper Bulk
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {finalOrderId && (
            <Link
              to={`/admin/orders/${finalOrderId}`}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Open Order
            </Link>
          )}
          <Link
            to="/admin/rfqs"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Back to RFQs
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InfoCard
          label="Customer"
          value={rfq.contactName}
          sub={rfq.contactEmail}
        />
        <InfoCard label="Quantity" value={rfq.quantity} />
        <InfoCard
          label={isCustomHamperRFQ ? "Commercial Payment" : "Budget / Gift"}
          value={
            isCustomHamperRFQ
              ? paymentLabel(rfq.commercialPaymentStatus)
              : `₹${Number(rfq.budgetPerGift || 0).toLocaleString("en-IN")}`
          }
        />
        <InfoCard
          label="Required Date"
          value={
            rfq.requiredDeliveryDate
              ? new Date(rfq.requiredDeliveryDate).toLocaleDateString("en-IN")
              : "—"
          }
        />
        <InfoCard label="Source" value={rfq.sourceType} />
      </div>

      {isCustomHamperRFQ && (
        <CustomHamperRequestCard
          request={rfq.customHamperRequest}
          quantity={rfq.quantity}
          title="Customer Requested Custom Hamper"
        />
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Customer Requirement
          </h2>
          <div className="mt-5 space-y-4 text-sm">
            <Row label="Objective" value={rfq.objective} />
            <Row label="Occasion" value={rfq.occasion} />
            <Row label="Recipients" value={rfq.recipientType} />
            <Row
              label="Locations"
              value={rfq.deliveryLocations?.join(", ")}
            />
            <Row
              label="Delivery Model"
              value={rfq.addressModel?.replaceAll("_", " ")}
            />
            <Row label="Packaging" value={rfq.packagingRequirements} />
            <Row
              label="Dietary"
              value={rfq.dietaryRequirements?.join(", ")}
            />
            <Row
              label="Personalization"
              value={rfq.personalizationRequirements}
            />
            <Row label="Notes" value={rfq.notes} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Operations
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#F26522]"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Status
              <select
                value={rfqStatus}
                onChange={(event) => setRfqStatus(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#F26522]"
              >
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="quoted">Quoted</option>
                <option value="quote_change_requested">
                  Quote Changes Requested
                </option>
                <option value="quote_accepted">Quote Accepted</option>
                <option value="proof_review">Proof Review</option>
                <option value="proof_change_requested">
                  Proof Changes Requested
                </option>
                <option value="approved">Approved</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Promised Date
              <input
                type="date"
                value={promisedDate}
                onChange={(event) => setPromisedDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#F26522]"
              />
            </label>

            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Next Action
              <input
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#F26522]"
              />
            </label>
          </div>

          <button
            onClick={updateOperations}
            disabled={busy}
            className="mt-5 rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95416] disabled:opacity-60"
          >
            Save Operations Update
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>

        {documents.length === 0 ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
            No documents uploaded.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => (
              <div
                key={document._id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="text-xs font-semibold uppercase text-[#F26522]">
                  {document.documentType}
                </p>
                <p className="mt-2 font-semibold text-slate-900">
                  {document.title || document.fileName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Version {document.version}
                </p>
                <div className="mt-3">
                  <StatusBadge status={document.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {document.url && (
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-[#F26522]"
                    >
                      Open
                    </a>
                  )}

                  {["proof", "artwork", "sample"].includes(
                    document.documentType
                  ) &&
                    document.status === "active" && (
                      <button
                        type="button"
                        onClick={() => replaceProof(document)}
                        className="text-sm font-semibold text-blue-600"
                      >
                        Upload New Version
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#F26522]">
              Commercial
            </p>
            <h2 className="text-xl font-bold text-slate-900">Quotation</h2>
          </div>

          {quote && (
            <Link
              to={`/admin/quotes/${quote._id}`}
              className="text-sm font-semibold text-[#F26522]"
            >
              Full Quote Details →
            </Link>
          )}
        </div>

        {!quote && (
          <QuoteEditor
            rfqId={id}
            rfq={rfq}
            mode="create"
            onSaved={loadData}
            onBusy={setBusy}
            onError={setError}
            onSuccess={setSuccess}
          />
        )}

        {quote && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{quote.quoteId}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Current Version V{quote.currentVersionNumber}
                </p>
              </div>
              <StatusBadge status={quote.status} />
            </div>

            {quote.status === "draft" && (
              <button
                onClick={sendQuote}
                disabled={busy}
                className="mt-5 rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95416]"
              >
                Send Quote V{quote.currentVersionNumber}
              </button>
            )}

            {quote.status === "sent" && (
              <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
                Quote sent. Waiting for customer response.
              </div>
            )}

            {quote.status === "accepted" && (
              <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                Quote V{quote.acceptedVersionNumber} accepted and locked.
                {isCustomHamperRFQ && (
                  <span className="ml-1">
                    Payment: {paymentLabel(rfq.commercialPaymentStatus)}.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {quote?.status === "change_requested" && (
          <>
            <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
              Customer requested changes to Quote V{quote.currentVersionNumber}.
              Create a revised version.
            </div>

            <QuoteEditor
              rfq={rfq}
              quote={quote}
              currentVersion={currentVersion}
              mode="revision"
              onSaved={loadData}
              onBusy={setBusy}
              onError={setError}
              onSuccess={setSuccess}
            />
          </>
        )}
      </section>

      {quote?.acceptedVersionNumber &&
        isCustomHamperRFQ &&
        rfq.commercialPaymentStatus !== "paid" && (
          <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
            <h2 className="font-semibold text-orange-900">
              Waiting for customer payment
            </h2>
            <p className="mt-2 text-sm leading-6 text-orange-700">
              The customer accepted the quote. The final Order and production job
              are created only after Razorpay confirms payment. Proof approval for
              this bulk Custom Hamper becomes available after payment.
            </p>
          </section>
        )}

      {proofFlowAvailable && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Upload Proof
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload customer-facing artwork or proof after commercial confirmation.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input
                value={proofTitle}
                onChange={(event) => setProofTitle(event.target.value)}
                placeholder="Proof title"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522]"
              />
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(event) =>
                  setProofFile(event.target.files?.[0] || null)
                }
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:font-semibold file:text-[#F26522]"
              />
            </div>

            <button
              onClick={uploadProof}
              disabled={busy}
              className="mt-4 rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95416]"
            >
              Upload Proof
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Publish Approval Request
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <select
                value={selectedProof}
                onChange={(event) => setSelectedProof(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522]"
              >
                <option value="">Select proof</option>
                {activeProofs.map((document) => (
                  <option key={document._id} value={document._id}>
                    {document.title || document.fileName} - V{document.version}
                  </option>
                ))}
              </select>

              <input
                value={approvalTitle}
                onChange={(event) => setApprovalTitle(event.target.value)}
                placeholder="Approval title"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522]"
              />
            </div>

            <button
              onClick={createApproval}
              disabled={busy}
              className="mt-4 rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95416]"
            >
              Publish Approval
            </button>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Approval History
        </h2>

        {approvals.length === 0 ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
            No approval requests yet.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {approvals.map((approval) => (
              <div
                key={approval._id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {approval.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {approval.subjectType} · Approval V{approval.version}
                  </div>
                </div>
                <StatusBadge status={approval.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const QuoteEditor = ({
  rfqId,
  rfq,
  quote,
  currentVersion,
  mode,
  onSaved,
  onBusy,
  onError,
  onSuccess,
}) => {
  const [items, setItems] = useState([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [freight, setFreight] = useState(0);
  const [taxRate, setTaxRate] = useState(18);
  const [leadTimeDays, setLeadTimeDays] = useState(14);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (currentVersion) {
      setItems(
        currentVersion.lineItems?.length
          ? currentVersion.lineItems.map((item) => ({
              productReference: item.productReference || "",
              name: item.name || "",
              description: item.description || "",
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              personalization: item.personalization || "",
              packaging: item.packaging || "",
              moq: item.moq || 0,
              stockStatus: item.stockStatus || "",
            }))
          : [emptyItem()]
      );

      setDiscount(currentVersion.discount || 0);
      setFreight(currentVersion.freight || 0);
      setTaxRate(currentVersion.taxRate || 18);
      setLeadTimeDays(currentVersion.leadTimeDays || 0);
      setPaymentTerms(currentVersion.paymentTerms || "");
      setValidUntil(
        currentVersion.validUntil
          ? new Date(currentVersion.validUntil)
              .toISOString()
              .slice(0, 10)
          : ""
      );
      setAssumptions((currentVersion.assumptions || []).join("\n"));
      setNotes(currentVersion.notes || "");
      return;
    }

    const customHamperItem = buildCustomHamperQuoteItem(rfq);

    if (customHamperItem) {
      setItems([customHamperItem]);
      setNotes(
        "Customer-built hamper configuration is attached to the RFQ. Review availability, production, branding, freight and tax before sending the final quote."
      );
    }
  }, [currentVersion, rfq]);

  const updateItem = (index, key, value) => {
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value,
            }
          : item
      )
    );
  };

  const subtotal = items.reduce(
    (total, item) =>
      total +
      Number(item.quantity || 0) *
        Number(item.unitPrice || 0),
    0
  );

  const taxable = Math.max(
    subtotal - Number(discount || 0) + Number(freight || 0),
    0
  );
  const tax = (taxable * Number(taxRate || 0)) / 100;
  const total = taxable + tax;

  const submit = async (event) => {
    event.preventDefault();

    try {
      onBusy(true);
      onError("");

      const payload = {
        lineItems: items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          moq: Number(item.moq || 0),
        })),
        discount: Number(discount || 0),
        freight: Number(freight || 0),
        taxRate: Number(taxRate || 0),
        currency: "INR",
        leadTimeDays: Number(leadTimeDays || 0),
        paymentTerms,
        validUntil: validUntil || null,
        assumptions: assumptions
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        notes,
      };

      if (mode === "create") {
        await api.post("/quotes", {
          rfqId,
          ...payload,
        });
        onSuccess("Quote V1 created.");
      } else {
        await api.post(`/quotes/${quote._id}/versions`, payload);
        onSuccess(`Quote V${quote.currentVersionNumber + 1} created.`);
      }

      await onSaved();
    } catch (requestError) {
      onError(
        requestError.response?.data?.message ||
          "Unable to save quotation"
      );
    } finally {
      onBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {mode === "create"
              ? "Create Quote V1"
              : `Create Quote V${quote.currentVersionNumber + 1}`}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Pricing will be recalculated by the backend before saving.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setItems((previous) => [...previous, emptyItem()])
          }
          className="rounded-xl border border-[#F26522] px-4 py-2.5 text-sm font-semibold text-[#F26522]"
        >
          + Add Item
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                Item {index + 1}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setItems((previous) =>
                      previous.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  className="text-sm font-semibold text-red-600"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <QuoteInput
                label="Product Reference"
                value={item.productReference}
                onChange={(value) =>
                  updateItem(index, "productReference", value)
                }
              />
              <QuoteInput
                label="Product Name *"
                value={item.name}
                required
                onChange={(value) => updateItem(index, "name", value)}
              />
              <QuoteInput
                label="Quantity *"
                type="number"
                min="1"
                required
                value={item.quantity}
                onChange={(value) => updateItem(index, "quantity", value)}
              />
              <QuoteInput
                label="Unit Price *"
                type="number"
                min="0"
                required
                value={item.unitPrice}
                onChange={(value) => updateItem(index, "unitPrice", value)}
              />
              <QuoteInput
                label="Packaging"
                value={item.packaging}
                onChange={(value) => updateItem(index, "packaging", value)}
              />
              <QuoteInput
                label="Personalization"
                value={item.personalization}
                onChange={(value) =>
                  updateItem(index, "personalization", value)
                }
              />
              <QuoteInput
                label="MOQ"
                type="number"
                min="0"
                value={item.moq}
                onChange={(value) => updateItem(index, "moq", value)}
              />
              <QuoteInput
                label="Stock Status"
                value={item.stockStatus}
                onChange={(value) => updateItem(index, "stockStatus", value)}
              />
            </div>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Description
              <textarea
                rows="3"
                value={item.description || ""}
                onChange={(event) =>
                  updateItem(index, "description", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F26522]"
              />
            </label>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <QuoteInput
          label="Discount"
          type="number"
          min="0"
          value={discount}
          onChange={setDiscount}
        />
        <QuoteInput
          label="Freight"
          type="number"
          min="0"
          value={freight}
          onChange={setFreight}
        />
        <QuoteInput
          label="Tax %"
          type="number"
          min="0"
          value={taxRate}
          onChange={setTaxRate}
        />
        <QuoteInput
          label="Lead Time Days"
          type="number"
          min="0"
          value={leadTimeDays}
          onChange={setLeadTimeDays}
        />
        <QuoteInput
          label="Valid Until"
          type="date"
          value={validUntil}
          onChange={setValidUntil}
        />
        <QuoteInput
          label="Payment Terms"
          value={paymentTerms}
          onChange={setPaymentTerms}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Assumptions
          <textarea
            rows="4"
            value={assumptions}
            onChange={(event) => setAssumptions(event.target.value)}
            placeholder="One assumption per line"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#F26522]"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Notes
          <textarea
            rows="4"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#F26522]"
          />
        </label>
      </div>

      <div className="mt-5 ml-auto max-w-md rounded-2xl bg-slate-50 p-5">
        <TotalRow label="Subtotal" value={subtotal} />
        <TotalRow label="Discount" value={-Number(discount || 0)} />
        <TotalRow label="Freight" value={Number(freight || 0)} />
        <TotalRow label="Tax" value={tax} />
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-4">
          <span className="font-semibold text-slate-900">Total</span>
          <span className="text-xl font-bold text-[#F26522]">
            ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <button
        type="submit"
        className="mt-5 rounded-xl bg-[#F26522] px-6 py-3 text-sm font-semibold text-white hover:bg-[#d95416]"
      >
        {mode === "create"
          ? "Create Quote V1"
          : `Create Quote V${quote.currentVersionNumber + 1}`}
      </button>
    </form>
  );
};

const QuoteInput = ({
  label,
  value,
  onChange,
  type = "text",
  ...props
}) => (
  <label className="text-sm font-medium text-slate-700">
    {label}
    <input
      {...props}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F26522] focus:ring-2 focus:ring-orange-100"
    />
  </label>
);

const TotalRow = ({ label, value }) => (
  <div className="flex justify-between py-2 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-slate-900">
      ₹{Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      })}
    </span>
  </div>
);

const InfoCard = ({ label, value, sub }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-2 font-bold text-slate-900">{value || "—"}</p>
    {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 last:border-0">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-slate-900">{value || "—"}</span>
  </div>
);

export default RFQDetails;
