import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

const Weddings = () => {
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const { data } = await api.get("/weddings/projects/admin/all", {
          params: {
            limit: 100,
            ...(status && { status }),
            ...(priority && { priority }),
          },
        });

        setProjects(data.projects || []);
      } catch (error) {
        setError(
          error.response?.data?.message ||
            "Unable to load wedding projects."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [status, priority]);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-bold text-[#F26522]">Admin / Operations</p>
        <h1 className="mt-1 text-3xl font-bold">Wedding Projects</h1>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectClass}
        >
          <option value="">All Statuses</option>
          {[
            "draft",
            "brief_submitted",
            "under_review",
            "concept_ready",
            "concept_change_requested",
            "concept_approved",
            "quote_in_progress",
            "quote_sent",
            "quote_change_requested",
            "quote_accepted",
            "sample_pending",
            "approval_pending",
            "proof_change_requested",
            "approved",
            "payment_pending",
            "payment_partial",
            "payment_confirmed",
            "guests_pending",
            "guests_review",
            "guests_ready",
            "ready_for_production",
            "cancelled",
          ].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={selectClass}
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <TH>Project</TH>
                <TH>Customer</TH>
                <TH>Wedding</TH>
                <TH>Guests</TH>
                <TH>Priority</TH>
                <TH>Status</TH>
                <TH />
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-10 text-center">
                    Loading...
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project._id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{project.projectTitle}</p>
                      <p className="text-xs text-slate-500">
                        {project.weddingProjectId}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm">
                      {project.owner?.name || project.owner?.email || "—"}
                    </td>

                    <td className="px-5 py-4 text-sm">
                      {project.coupleName || project.familyName || "—"}
                    </td>

                    <td className="px-5 py-4">{project.estimatedGuestCount}</td>

                    <td className="px-5 py-4 capitalize">{project.priority}</td>

                    <td className="px-5 py-4">
                      <StatusBadge status={project.status} />
                    </td>

                    <td className="px-5 py-4">
                      <Link
                        to={`/admin/weddings/${project._id}`}
                        className="font-semibold text-[#F26522]"
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

const selectClass =
  "rounded-xl border border-slate-300 px-4 py-2.5 text-sm capitalize";

const TH = ({ children }) => (
  <th className="px-5 py-4 text-left text-xs uppercase text-slate-500">
    {children}
  </th>
);

export default Weddings;