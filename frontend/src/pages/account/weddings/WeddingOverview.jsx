import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

const WeddingOverview = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/weddings/projects/mine");
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
  }, []);

  const ready = projects.filter(
    (item) => item.status === "ready_for_production"
  ).length;

  const active = projects.filter(
    (item) => !["cancelled", "ready_for_production"].includes(item.status)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#F26522]">
            HAMPORIUM Weddings
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Wedding Workspace
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage briefs, events, concepts, quotations, approvals,
            payments and guests.
          </p>
        </div>

        <Link
          to="/account/weddings/brief"
          className="rounded-xl bg-[#F26522] px-5 py-3 text-center text-sm font-semibold text-white"
        >
          + New Wedding Brief
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Projects" value={projects.length} />
        <Stat label="Active Projects" value={active} />
        <Stat label="Production Ready" value={ready} />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="border-b p-5">
          <h2 className="font-bold text-slate-900">Wedding Projects</h2>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-slate-500">No wedding projects yet.</p>

            <Link
              to="/account/weddings/brief"
              className="mt-4 inline-block font-semibold text-[#F26522]"
            >
              Create your first Wedding Brief →
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {projects.map((project) => (
              <Link
                key={project._id}
                to={`/account/weddings/${project._id}`}
                className="grid gap-3 p-5 hover:bg-slate-50 md:grid-cols-[1.4fr_1fr_auto] md:items-center"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {project.projectTitle}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {project.weddingProjectId}
                    {project.coupleName ? ` · ${project.coupleName}` : ""}
                  </p>
                </div>

                <div className="text-sm text-slate-500">
                  {project.weddingStartDate
                    ? new Date(project.weddingStartDate).toLocaleDateString(
                        "en-IN"
                      )
                    : "Wedding date not set"}
                </div>

                <StatusBadge status={project.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="rounded-2xl border bg-white p-5">
    <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>
);

const Alert = ({ children }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
    {children}
  </div>
);

export default WeddingOverview;