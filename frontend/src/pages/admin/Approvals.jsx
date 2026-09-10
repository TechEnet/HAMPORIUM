import {
  useEffect,
  useState,
} from "react";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";


const Approvals = () => {
  const [approvals, setApprovals] =
    useState([]);

  const [
    selectedApproval,
    setSelectedApproval,
  ] = useState(null);

  const [status, setStatus] =
    useState("");

  const [
    subjectType,
    setSubjectType,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  const loadApprovals =
    async () => {
      try {
        setLoading(true);

        const { data } =
          await api.get(
            "/approvals/admin/all",
            {
              params: {
                ...(status && {
                  status,
                }),

                ...(subjectType && {
                  subjectType,
                }),
              },
            }
          );

        setApprovals(
          data.approvals || []
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to load approvals"
        );
      } finally {
        setLoading(false);
      }
    };


  useEffect(() => {
    loadApprovals();
  }, [status, subjectType]);


  const openApproval =
    async (id) => {
      try {
        setDetailLoading(true);

        const { data } =
          await api.get(
            `/approvals/${id}`
          );

        setSelectedApproval(
          data.approval
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to load approval"
        );
      } finally {
        setDetailLoading(false);
      }
    };


  const cancelApproval =
    async () => {
      if (!selectedApproval) {
        return;
      }

      const note =
        window.prompt(
          "Reason for cancelling this approval"
        );

      if (note === null) {
        return;
      }

      try {
        await api.patch(
          `/approvals/${selectedApproval._id}/cancel`,
          {
            note,
          }
        );

        setSelectedApproval(
          null
        );

        await loadApprovals();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to cancel approval"
        );
      }
    };


  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[#F26522]">
          Admin / Operations
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
          Approvals
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Monitor proof, artwork and
          customer approval decisions.
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

          <option value="pending">
            Pending
          </option>

          <option value="approved">
            Approved
          </option>

          <option value="changes_requested">
            Changes Requested
          </option>

          <option value="cancelled">
            Cancelled
          </option>
        </select>


        <select
          value={subjectType}
          onChange={(e) =>
            setSubjectType(
              e.target.value
            )
          }
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#F26522]"
        >
          <option value="">
            All Types
          </option>

          <option value="proof">
            Proof
          </option>

          <option value="artwork">
            Artwork
          </option>

          <option value="sample">
            Sample
          </option>

          <option value="specification">
            Specification
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
                  Approval
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  RFQ
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Type
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Version
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Reviewer
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
                    className="p-10 text-center text-sm text-slate-500"
                  >
                    Loading approvals...
                  </td>
                </tr>
              ) : approvals.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="p-10 text-center text-sm text-slate-500"
                  >
                    No approvals found.
                  </td>
                </tr>
              ) : (
                approvals.map(
                  (approval) => (
                    <tr
                      key={
                        approval._id
                      }
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {
                            approval.approvalId
                          }
                        </div>

                        <div className="text-xs text-slate-500">
                          {
                            approval.title
                          }
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm">
                        {approval.rfq
                          ?.rfqId ||
                          "—"}
                      </td>

                      <td className="px-5 py-4 text-sm capitalize">
                        {
                          approval.subjectType
                        }
                      </td>

                      <td className="px-5 py-4 text-sm">
                        V
                        {
                          approval.version
                        }
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {approval
                            .reviewer
                            ?.name ||
                            "—"}
                        </div>

                        <div className="text-xs text-slate-500">
                          {approval
                            .reviewer
                            ?.email}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={
                            approval.status
                          }
                        />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() =>
                            openApproval(
                              approval._id
                            )
                          }
                          className="text-sm font-semibold text-[#F26522]"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>


      {detailLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading approval details...
        </div>
      )}


      {selectedApproval &&
        !detailLoading && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#F26522]">
                  {
                    selectedApproval.approvalId
                  }
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {
                    selectedApproval.title
                  }
                </h2>

                <div className="mt-3">
                  <StatusBadge
                    status={
                      selectedApproval.status
                    }
                  />
                </div>
              </div>

              {selectedApproval.status ===
                "pending" && (
                <button
                  onClick={
                    cancelApproval
                  }
                  className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700"
                >
                  Cancel Approval
                </button>
              )}
            </div>


            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Info
                label="RFQ"
                value={
                  selectedApproval.rfq
                    ?.rfqId
                }
              />

              <Info
                label="Subject"
                value={
                  selectedApproval.subjectType
                }
              />

              <Info
                label="Approval Version"
                value={`V${selectedApproval.version}`}
              />

              <Info
                label="Quote Version"
                value={
                  selectedApproval.quoteVersion
                    ? `V${selectedApproval.quoteVersion}`
                    : "—"
                }
              />
            </div>


            {selectedApproval.document && (
              <div className="mt-6 rounded-xl bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase text-[#F26522]">
                  Linked Document
                </p>

                <p className="mt-2 font-semibold text-slate-900">
                  {selectedApproval
                    .document.title ||
                    selectedApproval
                      .document.fileName}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Document V
                  {
                    selectedApproval
                      .document.version
                  }
                </p>

                {selectedApproval
                  .document.url && (
                  <a
                    href={
                      selectedApproval
                        .document.url
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-block text-sm font-semibold text-[#F26522]"
                  >
                    Open Document →
                  </a>
                )}
              </div>
            )}


            {selectedApproval.decision
              ?.action && (
              <div className="mt-6 rounded-xl border border-slate-200 p-5">
                <p className="font-semibold text-slate-900">
                  Customer Decision
                </p>

                <p className="mt-2 text-sm text-slate-700">
                  {selectedApproval
                    .decision.comment ||
                    selectedApproval
                      .decision.action}
                </p>
              </div>
            )}


            <div className="mt-6">
              <h3 className="font-semibold text-slate-900">
                Activity
              </h3>

              {selectedApproval
                .activities?.length >
              0 ? (
                <div className="mt-3 space-y-3">
                  {[
                    ...selectedApproval.activities,
                  ]
                    .reverse()
                    .map(
                      (activity) => (
                        <div
                          key={
                            activity._id
                          }
                          className="rounded-xl bg-slate-50 p-4"
                        >
                          <p className="text-xs font-semibold uppercase text-[#F26522]">
                            {activity.action.replaceAll(
                              "_",
                              " "
                            )}
                          </p>

                          {activity.comment && (
                            <p className="mt-2 text-sm text-slate-700">
                              {
                                activity.comment
                              }
                            </p>
                          )}

                          <p className="mt-2 text-xs text-slate-400">
                            {new Date(
                              activity.createdAt
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </p>
                        </div>
                      )
                    )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No activity yet.
                </p>
              )}
            </div>
          </section>
        )}
    </div>
  );
};


const Info = ({
  label,
  value,
}) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-slate-400">
      {label}
    </p>

    <p className="mt-1 font-semibold capitalize text-slate-900">
      {value || "—"}
    </p>
  </div>
);


export default Approvals;