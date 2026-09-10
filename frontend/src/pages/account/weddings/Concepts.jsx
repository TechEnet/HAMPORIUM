import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

const Concepts = () => {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/weddings/projects/${id}`);
      setProject(data.project);
    } catch (error) {
      setError(error.response?.data?.message || "Unable to load concepts.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (approvalId) => {
    try {
      setBusy(true);
      await api.post(`/approvals/${approvalId}/approve`, {});
      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to approve concept.");
    } finally {
      setBusy(false);
    }
  };

  const requestChanges = async (approvalId) => {
    const comment = window.prompt("What changes are required?");
    if (!comment?.trim()) return;

    try {
      setBusy(true);

      await api.post(`/approvals/${approvalId}/request-changes`, {
        comment,
      });

      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to request changes.");
    } finally {
      setBusy(false);
    }
  };

  if (!project) {
    return <div className="rounded-2xl border bg-white p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Header project={project} id={id} title="Wedding Concepts" />

      {error && <ErrorBox>{error}</ErrorBox>}

      {project.concepts?.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">
          HAMPORIUM has not published a wedding concept yet.
        </div>
      ) : (
        <div className="space-y-4">
          {[...project.concepts]
            .sort((a, b) => b.versionNumber - a.versionNumber)
            .map((concept) => (
              <section
                key={concept._id}
                className="rounded-2xl border bg-white p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#F26522]">
                      Version {concept.versionNumber}
                    </p>

                    <h2 className="mt-1 text-xl font-bold">{concept.title}</h2>

                    <p className="mt-2 text-sm text-slate-500">
                      {concept.description}
                    </p>
                  </div>

                  <StatusBadge status={concept.status} />
                </div>

                {concept.document?.url && (
                  <a
                    href={concept.document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-block font-semibold text-[#F26522]"
                  >
                    Open Concept Document →
                  </a>
                )}

                {concept.approval?.status === "pending" && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      disabled={busy}
                      onClick={() => approve(concept.approval._id)}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      Approve Concept
                    </button>

                    <button
                      disabled={busy}
                      onClick={() => requestChanges(concept.approval._id)}
                      className="rounded-xl border border-orange-300 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-700"
                    >
                      Request Changes
                    </button>
                  </div>
                )}

                {concept.changeRequest?.comment && (
                  <div className="mt-5 rounded-xl bg-orange-50 p-4 text-sm text-orange-700">
                    {concept.changeRequest.comment}
                  </div>
                )}
              </section>
            ))}
        </div>
      )}
    </div>
  );
};

const Header = ({ project, id, title }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <p className="font-bold text-[#F26522]">{project.weddingProjectId}</p>
      <h1 className="mt-1 text-3xl font-bold">{title}</h1>
    </div>

    <Link
      to={`/account/weddings/${id}`}
      className="rounded-xl border px-4 py-2 text-sm font-semibold"
    >
      ← Project
    </Link>
  </div>
);

const ErrorBox = ({ children }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
    {children}
  </div>
);

export default Concepts;