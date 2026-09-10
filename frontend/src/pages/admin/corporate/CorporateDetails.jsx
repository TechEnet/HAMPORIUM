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


const CorporateDetails = () => {
  const { id } = useParams();

  const [campaign, setCampaign] =
    useState(null);

  const [quote, setQuote] =
    useState(null);

  const [approvals, setApprovals] =
    useState([]);

  const [documents, setDocuments] =
    useState([]);

  const [recipients, setRecipients] =
    useState([]);

  const [priority, setPriority] =
    useState("normal");

  const [
    promisedDate,
    setPromisedDate,
  ] = useState("");

  const [nextAction, setNextAction] =
    useState("");

  const [
    internalNotes,
    setInternalNotes,
  ] = useState("");

  const [paymentId, setPaymentId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");


  const loadData =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const { data } =
          await api.get(
            `/corporate/campaigns/${id}`
          );

        setCampaign(
          data.campaign
        );

        setQuote(
          data.quote || null
        );

        setApprovals(
          data.approvals || []
        );

        setDocuments(
          data.documents || []
        );

        setPriority(
          data.campaign
            ?.priority ||
            "normal"
        );

        setNextAction(
          data.campaign
            ?.nextAction || ""
        );

        setInternalNotes(
          data.campaign
            ?.internalNotes || ""
        );

        setPromisedDate(
          data.campaign
            ?.promisedDate
            ? new Date(
                data.campaign
                  .promisedDate
              )
                .toISOString()
                .slice(0, 10)
            : ""
        );


        try {
          const recipientResponse =
            await api.get(
              `/corporate/campaigns/${id}/recipients`,
              {
                params: {
                  limit: 20,
                },
              }
            );

          setRecipients(
            recipientResponse.data
              .recipients || []
          );
        } catch {
          setRecipients([]);
        }
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to load corporate campaign."
        );
      } finally {
        setLoading(false);
      }
    }, [id]);


  useEffect(() => {
    loadData();
  }, [loadData]);


  const syncCampaign =
    async () => {
      try {
        setBusy(true);

        await api.post(
          `/corporate/campaigns/${id}/sync`
        );

        setSuccess(
          "Campaign synchronized."
        );

        await loadData();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to sync campaign."
        );
      } finally {
        setBusy(false);
      }
    };


  const saveOperations =
    async () => {
      try {
        setBusy(true);

        await api.patch(
          `/corporate/campaigns/${id}/admin`,
          {
            priority,

            promisedDate:
              promisedDate || null,

            nextAction,

            internalNotes,
          }
        );

        setSuccess(
          "Campaign operations updated."
        );

        await loadData();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to update campaign."
        );
      } finally {
        setBusy(false);
      }
    };


  const verifyPO =
    async (approved) => {
      const note =
        window.prompt(
          approved
            ? "Optional PO verification note"
            : "Why is this PO being rejected?"
        );

      if (note === null) {
        return;
      }

      try {
        setBusy(true);

        await api.patch(
          `/corporate/campaigns/${id}/po/verify`,
          {
            approved,
            note,
          }
        );

        setSuccess(
          approved
            ? "PO verified."
            : "PO rejected."
        );

        await loadData();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to verify PO."
        );
      } finally {
        setBusy(false);
      }
    };


  const linkPayment =
    async () => {
      if (!paymentId.trim()) {
        setError(
          "Enter an existing shared payment Mongo ID."
        );

        return;
      }

      try {
        setBusy(true);
        setError("");

        await api.post(
          `/corporate/campaigns/${id}/payment/link`,
          {
            paymentId:
              paymentId.trim(),
          }
        );

        setPaymentId("");

        setSuccess(
          "Payment linked successfully."
        );

        await loadData();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to link payment."
        );
      } finally {
        setBusy(false);
      }
    };


  const syncPayment =
    async () => {
      try {
        setBusy(true);

        await api.post(
          `/corporate/campaigns/${id}/payment/sync`
        );

        setSuccess(
          "Payment status synchronized."
        );

        await loadData();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to sync payment."
        );
      } finally {
        setBusy(false);
      }
    };


  const approveRecipients =
    async () => {
      if (
        !window.confirm(
          "Approve all valid recipient rows for production?"
        )
      ) {
        return;
      }

      try {
        setBusy(true);

        await api.post(
          `/corporate/campaigns/${id}/recipients/review`
        );

        setSuccess(
          "Recipient data approved."
        );

        await loadData();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to approve recipients."
        );
      } finally {
        setBusy(false);
      }
    };


  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading corporate campaign...
      </div>
    );
  }


  if (!campaign) {
    return null;
  }


  const rfq =
    campaign.rfq;

  const rfqId =
    typeof rfq === "string"
      ? rfq
      : rfq?._id;


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#F26522]">
            {campaign.campaignId}
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {campaign.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge
              status={
                campaign.workflowStatus
              }
            />

            <span className="text-sm text-slate-500">
              {campaign.organization
                ?.name}
            </span>
          </div>
        </div>


        <div className="flex flex-wrap gap-2">
          <button
            onClick={syncCampaign}
            disabled={busy}
            className="rounded-xl border border-[#F26522] px-4 py-2.5 text-sm font-semibold text-[#F26522]"
          >
            Sync Workflow
          </button>

          <Link
            to="/admin/corporate"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            ← Corporate
          </Link>
        </div>
      </div>


      {error && (
        <Alert error>
          {error}
        </Alert>
      )}

      {success && (
        <Alert>
          {success}
        </Alert>
      )}


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat
          label="Quantity"
          value={
            campaign.quantity
          }
        />

        <AdminStat
          label="Budget / Gift"
          value={`₹${Number(
            campaign.budgetPerGift ||
              0
          ).toLocaleString(
            "en-IN"
          )}`}
        />

        <AdminStat
          label="PO"
          value={
            campaign.po?.status ||
            "not_required"
          }
          badge
        />

        <AdminStat
          label="Payment"
          value={
            campaign.paymentInfo
              ?.status ||
            "not_required"
          }
          badge
        />
      </div>


      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Organization & Requirement
          </h2>

          <div className="mt-5 space-y-4">
            <Info
              label="Organization"
              value={
                campaign.organization
                  ?.name
              }
            />

            <Info
              label="GST"
              value={
                campaign.organization
                  ?.gstNumber
              }
            />

            <Info
              label="Campaign Type"
              value={
                campaign.campaignType ===
                "diwali_bulk"
                  ? "Diwali Bulk"
                  : "Corporate"
              }
            />

            <Info
              label="Objective"
              value={
                campaign.objective
              }
            />

            <Info
              label="Delivery Cities"
              value={
                campaign.deliveryCities
                  ?.join(", ")
              }
            />

            <Info
              label="Required Date"
              value={
                campaign.requiredDeliveryDate
                  ? new Date(
                      campaign.requiredDeliveryDate
                    ).toLocaleDateString(
                      "en-IN"
                    )
                  : "—"
              }
            />
          </div>
        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Operations
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Priority

              <select
                value={priority}
                onChange={(e) =>
                  setPriority(
                    e.target.value
                  )
                }
                className={inputClass}
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
            </label>


            <label className={labelClass}>
              Promised Date

              <input
                type="date"
                value={
                  promisedDate
                }
                onChange={(e) =>
                  setPromisedDate(
                    e.target.value
                  )
                }
                className={inputClass}
              />
            </label>


            <label className={`${labelClass} md:col-span-2`}>
              Next Action

              <input
                value={nextAction}
                onChange={(e) =>
                  setNextAction(
                    e.target.value
                  )
                }
                className={inputClass}
              />
            </label>


            <label className={`${labelClass} md:col-span-2`}>
              Internal Notes

              <textarea
                rows="4"
                value={
                  internalNotes
                }
                onChange={(e) =>
                  setInternalNotes(
                    e.target.value
                  )
                }
                className={inputClass}
              />
            </label>
          </div>

          <button
            onClick={
              saveOperations
            }
            disabled={busy}
            className="mt-4 rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white"
          >
            Save Operations
          </button>
        </section>
      </div>


      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">
          Shared Workflow
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {rfqId ? (
            <Link
              to={`/admin/rfqs/${rfqId}`}
              className="rounded-xl bg-slate-50 p-4"
            >
              <p className="text-xs uppercase text-slate-400">
                RFQ
              </p>

              <p className="mt-2 font-bold text-slate-900">
                {rfq?.rfqId ||
                  "Open RFQ"}
              </p>

              <span className="mt-3 inline-block text-sm font-semibold text-[#F26522]">
                Manage →
              </span>
            </Link>
          ) : (
            <WorkflowCard
              title="RFQ"
              value="Not submitted"
            />
          )}


          {quote ? (
            <Link
              to={`/admin/quotes/${quote._id}`}
              className="rounded-xl bg-slate-50 p-4"
            >
              <p className="text-xs uppercase text-slate-400">
                Quote
              </p>

              <p className="mt-2 font-bold text-slate-900">
                {quote.quoteId} · V
                {
                  quote.currentVersionNumber
                }
              </p>

              <span className="mt-3 inline-block text-sm font-semibold text-[#F26522]">
                Manage →
              </span>
            </Link>
          ) : (
            <WorkflowCard
              title="Quote"
              value="Not created"
            />
          )}


          <WorkflowCard
            title="Approvals"
            value={`${approvals.length} records`}
          />
        </div>
      </section>


      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Purchase Order
            </h2>

            <StatusBadge
              status={
                campaign.po?.status
              }
            />
          </div>

          {campaign.po?.document && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">
                {campaign.po
                  .document.title ||
                  campaign.po
                    .document.fileName}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Reference:{" "}
                {campaign.po
                  .referenceNumber ||
                  "—"}
              </p>

              {campaign.po.document
                .url && (
                <a
                  href={
                    campaign.po
                      .document.url
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm font-semibold text-[#F26522]"
                >
                  Open PO →
                </a>
              )}
            </div>
          )}


          {campaign.po?.status ===
            "submitted" && (
            <div className="mt-5 flex gap-3">
              <button
                onClick={() =>
                  verifyPO(true)
                }
                disabled={busy}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Verify PO
              </button>

              <button
                onClick={() =>
                  verifyPO(false)
                }
                disabled={busy}
                className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700"
              >
                Reject PO
              </button>
            </div>
          )}
        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Shared Payment
            </h2>

            <StatusBadge
              status={
                campaign.paymentInfo
                  ?.status
              }
            />
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Corporate does not create a
            second payment engine. Link the
            existing HAMPORIUM Payment
            record here.
          </p>


          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={paymentId}
              onChange={(e) =>
                setPaymentId(
                  e.target.value
                )
              }
              placeholder="Existing Payment Mongo ID"
              className={`${inputClass} flex-1`}
            />

            <button
              onClick={linkPayment}
              disabled={
                busy ||
                !paymentId.trim()
              }
              className="rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Link Payment
            </button>
          </div>


          {campaign.paymentInfo
            ?.payment && (
            <button
              onClick={syncPayment}
              disabled={busy}
              className="mt-3 rounded-xl border border-[#F26522] px-5 py-2.5 text-sm font-semibold text-[#F26522]"
            >
              Sync Payment Status
            </button>
          )}
        </section>
      </div>


      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Recipient Review
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Approve recipient data only
              when every imported row is
              valid.
            </p>
          </div>

          <button
            onClick={
              approveRecipients
            }
            disabled={
              busy ||
              !campaign.recipientSummary
                ?.total ||
              campaign.recipientSummary
                ?.invalid > 0 ||
              campaign.recipientImportStatus ===
                "approved"
            }
            className="rounded-xl bg-[#F26522] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Approve Recipient Data
          </button>
        </div>


        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <RecipientCount
            label="Total"
            value={
              campaign.recipientSummary
                ?.total || 0
            }
          />

          <RecipientCount
            label="Valid"
            value={
              campaign.recipientSummary
                ?.valid || 0
            }
          />

          <RecipientCount
            label="Invalid"
            value={
              campaign.recipientSummary
                ?.invalid || 0
            }
          />

          <RecipientCount
            label="Approved"
            value={
              campaign.recipientSummary
                ?.approved || 0
            }
          />
        </div>


        {recipients.length >
          0 && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className={thClass}>
                    Row
                  </th>

                  <th className={thClass}>
                    Recipient
                  </th>

                  <th className={thClass}>
                    City
                  </th>

                  <th className={thClass}>
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {recipients.map(
                  (recipient) => (
                    <tr
                      key={
                        recipient._id
                      }
                    >
                      <td className="px-4 py-3 text-sm">
                        {
                          recipient.rowNumber
                        }
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">
                          {recipient.name ||
                            "—"}
                        </p>

                        <p className="text-xs text-slate-400">
                          {recipient.phone}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-600">
                        {recipient.address
                          ?.city ||
                          "—"}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge
                          status={
                            recipient.status
                          }
                        />
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>


      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">
          Documents
        </h2>

        {documents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No documents.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {documents.map(
              (document) => (
                <div
                  key={
                    document._id
                  }
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-xs font-bold uppercase text-[#F26522]">
                    {
                      document.documentType
                    }
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {document.title ||
                      document.fileName}
                  </p>

                  {document.url && (
                    <a
                      href={
                        document.url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block text-sm font-semibold text-[#F26522]"
                    >
                      Open →
                    </a>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </section>


      {campaign.workflowStatus ===
        "ready_for_production" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
          <h2 className="text-lg font-bold">
            Ready for Production ✅
          </h2>

          <p className="mt-2 text-sm">
            Commercial confirmation and
            recipient data are complete.
            Phase 9 production workflow can
            consume this campaign.
          </p>
        </div>
      )}
    </div>
  );
};


const labelClass =
  "text-sm font-medium text-slate-700";

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F26522] focus:ring-2 focus:ring-orange-100";

const thClass =
  "px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500";


const AdminStat = ({
  label,
  value,
  badge = false,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </p>

    <div className="mt-2">
      {badge ? (
        <StatusBadge
          status={value}
        />
      ) : (
        <p className="font-bold text-slate-900">
          {value}
        </p>
      )}
    </div>
  </div>
);


const Info = ({
  label,
  value,
}) => (
  <div className="flex justify-between gap-5 border-b border-slate-100 pb-3">
    <span className="text-sm text-slate-500">
      {label}
    </span>

    <span className="text-right text-sm font-medium text-slate-900">
      {value || "—"}
    </span>
  </div>
);


const WorkflowCard = ({
  title,
  value,
}) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <p className="text-xs uppercase text-slate-400">
      {title}
    </p>

    <p className="mt-2 font-bold text-slate-900">
      {value}
    </p>
  </div>
);


const RecipientCount = ({
  label,
  value,
}) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <p className="text-xs uppercase text-slate-400">
      {label}
    </p>

    <p className="mt-1 text-xl font-bold text-slate-900">
      {value}
    </p>
  </div>
);


const Alert = ({
  error = false,
  children,
}) => (
  <div
    className={
      error
        ? "rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        : "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
    }
  >
    {children}
  </div>
);


export default CorporateDetails;