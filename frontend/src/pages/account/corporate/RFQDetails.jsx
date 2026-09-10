import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";
import CustomHamperRequestCard from "../../../components/CustomHamperRequestCard.jsx";

const getEntityId = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    return value;
  }

  return value._id || "";
};

const paymentLabel = (status) => {
  if (!status || status === "not_started") return "Not started";
  return String(status)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const RFQDetails = () => {
  const { id } = useParams();

  const [rfq, setRfq] = useState(null);
  const [quote, setQuote] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [approvalComments, setApprovalComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const rfqResponse = await api.get(`/rfqs/${id}`);
      setRfq(rfqResponse.data.rfq);

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

      const approvalResponse = await api.get("/approvals/mine");
      setApprovals(
        (approvalResponse.data.approvals || []).filter(
          (approval) => getEntityId(approval.rfq) === id
        )
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

  const submitRFQ = async () => {
    try {
      setBusy(true);
      setError("");

      await api.post(`/rfqs/${id}/submit`);
      setSuccess("RFQ submitted successfully.");
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit RFQ"
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelRFQ = async () => {
    const reason = window.prompt("Reason for cancellation");

    if (reason === null) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this RFQ?"
    );

    if (!confirmed) return;

    try {
      setBusy(true);
      setError("");

      await api.post(`/rfqs/${id}/cancel`, { reason });
      setSuccess("RFQ cancelled.");
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to cancel RFQ"
      );
    } finally {
      setBusy(false);
    }
  };

  const setApprovalComment = (approvalId, value) => {
    setApprovalComments((previous) => ({
      ...previous,
      [approvalId]: value,
    }));
  };

  const approvalAction = async (approvalId, action) => {
    const comment = approvalComments[approvalId] || "";

    if (action === "request-changes" && !comment.trim()) {
      setError("Please describe the changes required.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      setSuccess("");

      if (action === "approve") {
        await api.post(`/approvals/${approvalId}/approve`, {
          comment,
        });
        setSuccess("Proof approved successfully.");
      }

      if (action === "request-changes") {
        await api.post(`/approvals/${approvalId}/request-changes`, {
          comment: comment.trim(),
        });
        setSuccess("Change request submitted.");
      }

      if (action === "comment") {
        if (!comment.trim()) return;

        await api.post(`/approvals/${approvalId}/comment`, {
          comment: comment.trim(),
        });
        setSuccess("Comment added.");
      }

      if (action === "call") {
        await api.post(`/approvals/${approvalId}/ask-for-call`, {
          comment:
            comment.trim() ||
            "Please call me regarding this proof.",
        });
        setSuccess("Call request submitted.");
      }

      setApprovalComment(approvalId, "");
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to complete action"
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

  if (!rfq) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        RFQ not found.
      </div>
    );
  }

  const cancellable = [
    "draft",
    "submitted",
    "under_review",
    "quoted",
    "quote_change_requested",
  ].includes(rfq.status);

  const isCustomHamperRFQ =
    rfq.sourceType === "custom_hamper" &&
    Boolean(rfq.customHamperRequest);

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
          {rfq.status === "draft" && (
            <button
              disabled={busy}
              onClick={submitRFQ}
              className="rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95416]"
            >
              Submit RFQ
            </button>
          )}

          {cancellable && (
            <button
              disabled={busy}
              onClick={cancelRFQ}
              className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Cancel RFQ
            </button>
          )}
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Quantity" value={rfq.quantity} />
        <InfoCard
          label={isCustomHamperRFQ ? "Payment" : "Budget / Gift"}
          value={
            isCustomHamperRFQ
              ? paymentLabel(rfq.commercialPaymentStatus)
              : `₹${Number(rfq.budgetPerGift || 0).toLocaleString("en-IN")}`
          }
        />
        <InfoCard
          label="Delivery Date"
          value={
            rfq.requiredDeliveryDate
              ? new Date(rfq.requiredDeliveryDate).toLocaleDateString("en-IN")
              : "Not set"
          }
        />
        <InfoCard label="Next Action" value={rfq.nextAction || "—"} />
      </div>

      {isCustomHamperRFQ && (
        <CustomHamperRequestCard
          request={rfq.customHamperRequest}
          quantity={rfq.quantity}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Requirement
          </h2>

          <div className="mt-5 space-y-4 text-sm">
            <Detail label="Objective" value={rfq.objective} />
            <Detail label="Occasion" value={rfq.occasion} />
            <Detail label="Recipients" value={rfq.recipientType} />
            <Detail
              label="Locations"
              value={rfq.deliveryLocations?.join(", ")}
            />
            <Detail
              label="Delivery Model"
              value={rfq.addressModel?.replaceAll("_", " ")}
            />
            <Detail label="Packaging" value={rfq.packagingRequirements} />
            <Detail
              label="Personalization"
              value={rfq.personalizationRequirements}
            />
            <Detail label="Notes" value={rfq.notes} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Quotation
          </h2>

          {!quote ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
              HAMPORIUM has not published a quotation yet.
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">
                    {quote.quoteId}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Current Version V{quote.currentVersionNumber}
                  </p>
                </div>
                <StatusBadge status={quote.status} />
              </div>

              <Link
                to={`/account/corporate/quotes/${quote._id}`}
                className="mt-5 inline-flex rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95416]"
              >
                {quote.status === "accepted" && !finalOrderId
                  ? "Review & Pay Quotation"
                  : "Review Quotation"}
              </Link>

              {finalOrderId && (
                <Link
                  to={`/account/orders/${finalOrderId}`}
                  className="ml-3 mt-5 inline-flex rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  View Order
                </Link>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Documents & Proofs
        </h2>

        {documents.length === 0 ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => (
              <div
                key={document._id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-[#F26522]">
                  {document.documentType}
                </div>
                <h3 className="mt-2 font-semibold text-slate-900">
                  {document.title || document.fileName}
                </h3>
                <div className="mt-1 text-xs text-slate-500">
                  Version {document.version}
                </div>
                <div className="mt-3">
                  <StatusBadge status={document.status} />
                </div>
                {document.url && (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-block text-sm font-semibold text-[#F26522]"
                  >
                    Open File →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Proof Approvals
        </h2>

        {approvals.length === 0 ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
            No approval request yet.
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {approvals.map((approval) => (
              <div
                key={approval._id}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#F26522]">
                      {approval.approvalId}
                    </p>
                    <h3 className="mt-1 font-semibold text-slate-900">
                      {approval.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {approval.subjectType} · Approval V{approval.version}
                    </p>
                  </div>
                  <StatusBadge status={approval.status} />
                </div>

                {approval.document && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {approval.document.title || approval.document.fileName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Document V{approval.document.version}
                    </p>
                    {approval.document.url && (
                      <a
                        href={approval.document.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-sm font-semibold text-[#F26522]"
                      >
                        Open Proof →
                      </a>
                    )}
                  </div>
                )}

                {approval.status === "pending" && (
                  <>
                    <textarea
                      rows="3"
                      value={approvalComments[approval._id] || ""}
                      onChange={(event) =>
                        setApprovalComment(
                          approval._id,
                          event.target.value
                        )
                      }
                      placeholder="Add approval note or requested changes..."
                      className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522] focus:ring-2 focus:ring-orange-100"
                    />

                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        disabled={busy}
                        onClick={() =>
                          approvalAction(approval._id, "approve")
                        }
                        className="rounded-xl bg-[#F26522] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#d95416]"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          approvalAction(approval._id, "request-changes")
                        }
                        className="rounded-xl border border-orange-300 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-700"
                      >
                        Request Changes
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          approvalAction(approval._id, "comment")
                        }
                        className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700"
                      >
                        Comment
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          approvalAction(approval._id, "call")
                        }
                        className="rounded-xl border border-[#F26522] px-5 py-2.5 text-sm font-semibold text-[#F26522]"
                      >
                        Ask for Call
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const InfoCard = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <p className="text-xs uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className="mt-2 text-lg font-bold text-slate-900">
      {value || "—"}
    </p>
  </div>
);

const Detail = ({ label, value }) => (
  <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 last:border-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-8">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-slate-900 sm:text-right">
      {value || "—"}
    </span>
  </div>
);

export default RFQDetails;
