import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";


const Corporate = () => {
  const [campaigns, setCampaigns] =
    useState([]);

  const [
    workflowStatus,
    setWorkflowStatus,
  ] = useState("");

  const [
    campaignType,
    setCampaignType,
  ] = useState("");

  const [priority, setPriority] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  useEffect(() => {
    const loadCampaigns =
      async () => {
        try {
          setLoading(true);
          setError("");

          const { data } =
            await api.get(
              "/corporate/campaigns/admin/all",
              {
                params: {
                  ...(workflowStatus && {
                    workflowStatus,
                  }),

                  ...(campaignType && {
                    campaignType,
                  }),

                  ...(priority && {
                    priority,
                  }),

                  limit: 100,
                },
              }
            );

          setCampaigns(
            data.campaigns ||
              []
          );
        } catch (error) {
          setError(
            error.response?.data
              ?.message ||
              "Unable to load corporate campaigns."
          );
        } finally {
          setLoading(false);
        }
      };

    loadCampaigns();
  }, [
    workflowStatus,
    campaignType,
    priority,
  ]);


  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-[#F26522]">
          Admin / Operations
        </p>

        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          Corporate Campaigns
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Organizations, Corporate
          campaigns, Diwali bulk,
          PO/payment and recipient
          readiness.
        </p>
      </div>


      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <select
          value={campaignType}
          onChange={(e) =>
            setCampaignType(
              e.target.value
            )
          }
          className={selectClass}
        >
          <option value="">
            All Types
          </option>

          <option value="corporate">
            Corporate
          </option>

          <option value="diwali_bulk">
            Diwali Bulk
          </option>
        </select>


        <select
          value={workflowStatus}
          onChange={(e) =>
            setWorkflowStatus(
              e.target.value
            )
          }
          className={selectClass}
        >
          <option value="">
            All Statuses
          </option>

          <option value="draft">
            Draft
          </option>

          <option value="rfq_submitted">
            RFQ Submitted
          </option>

          <option value="quote_in_progress">
            Quote In Progress
          </option>

          <option value="quote_sent">
            Quote Sent
          </option>

          <option value="quote_change_requested">
            Quote Changes
          </option>

          <option value="quote_accepted">
            Quote Accepted
          </option>

          <option value="approval_pending">
            Approval Pending
          </option>

          <option value="approved">
            Approved
          </option>

          <option value="po_pending">
            PO Pending
          </option>

          <option value="payment_pending">
            Payment Pending
          </option>

          <option value="recipients_review">
            Recipient Review
          </option>

          <option value="ready_for_production">
            Ready for Production
          </option>
        </select>


        <select
          value={priority}
          onChange={(e) =>
            setPriority(
              e.target.value
            )
          }
          className={selectClass}
        >
          <option value="">
            All Priorities
          </option>

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


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}


      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Campaign",
                  "Organization",
                  "Type",
                  "Quantity",
                  "Priority",
                  "Status",
                  "",
                ].map(
                  (heading) => (
                    <th
                      key={
                        heading ||
                        "actions"
                      }
                      className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="p-10 text-center text-sm text-slate-500"
                  >
                    Loading campaigns...
                  </td>
                </tr>
              ) : campaigns.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="p-10 text-center text-sm text-slate-500"
                  >
                    No corporate campaigns found.
                  </td>
                </tr>
              ) : (
                campaigns.map(
                  (campaign) => (
                    <tr
                      key={
                        campaign._id
                      }
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {
                            campaign.title
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            campaign.campaignId
                          }
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {campaign
                            .organization
                            ?.name ||
                            "—"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {campaign
                            .organization
                            ?.organizationId ||
                            ""}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {campaign.campaignType ===
                        "diwali_bulk"
                          ? "Diwali Bulk"
                          : "Corporate"}
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-slate-700">
                        {
                          campaign.quantity
                        }
                      </td>

                      <td className="px-5 py-4 text-sm capitalize text-slate-700">
                        {
                          campaign.priority
                        }
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={
                            campaign.workflowStatus
                          }
                        />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/admin/corporate/${campaign._id}`}
                          className="text-sm font-semibold text-[#F26522]"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


const selectClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#F26522]";


export default Corporate;