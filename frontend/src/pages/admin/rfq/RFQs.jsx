import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";


const RFQs = () => {
  const [rfqs, setRfqs] =
    useState([]);

  const [status, setStatus] =
    useState("");

  const [priority, setPriority] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  useEffect(() => {
    const loadRFQs = async () => {
      try {
        setLoading(true);

        const { data } =
          await api.get(
            "/rfqs/admin/all",
            {
              params: {
                ...(status && {
                  status,
                }),

                ...(priority && {
                  priority,
                }),

                limit: 100,
              },
            }
          );

        setRfqs(data.rfqs || []);
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to load RFQs"
        );
      } finally {
        setLoading(false);
      }
    };

    loadRFQs();
  }, [status, priority]);


  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[#F26522]">
          Admin / Operations
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
          RFQ Queue
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Review submitted requirements and
          move them through quotation and
          approval.
        </p>
      </div>


      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <select
          value={status}
          onChange={(e) =>
            setStatus(
              e.target.value
            )
          }
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#F26522]"
        >
          <option value="">
            All Statuses
          </option>

          <option value="submitted">
            Submitted
          </option>

          <option value="under_review">
            Under Review
          </option>

          <option value="quoted">
            Quoted
          </option>

          <option value="quote_change_requested">
            Quote Change Requested
          </option>

          <option value="quote_accepted">
            Quote Accepted
          </option>

          <option value="proof_ready">
            Proof Ready
          </option>

          <option value="approval_pending">
            Approval Pending
          </option>

          <option value="proof_change_requested">
            Proof Change Requested
          </option>

          <option value="approved">
            Approved
          </option>

          <option value="cancelled">
            Cancelled
          </option>
        </select>


        <select
          value={priority}
          onChange={(e) =>
            setPriority(
              e.target.value
            )
          }
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#F26522]"
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
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  RFQ
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Company
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Requirement
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Qty
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Priority
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Status
                </th>

                <th className="px-5 py-4" />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    Loading RFQs...
                  </td>
                </tr>
              ) : rfqs.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    No RFQs found.
                  </td>
                </tr>
              ) : (
                rfqs.map((rfq) => (
                  <tr
                    key={rfq._id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">
                        {rfq.rfqId}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(
                          rfq.createdAt
                        ).toLocaleDateString(
                          "en-IN"
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {rfq.companyName ||
                        "—"}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {rfq.title}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {rfq.contactName}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {rfq.quantity}
                    </td>

                    <td className="px-5 py-4 text-sm font-medium capitalize text-slate-700">
                      {rfq.priority}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge
                        status={
                          rfq.status
                        }
                      />
                    </td>

                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/admin/rfqs/${rfq._id}`}
                        className="text-sm font-semibold text-[#F26522]"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


export default RFQs;