import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

const Approvals = () => {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/weddings/projects/${id}`);
      setProject(data.project);
      setApprovals(data.approvals || []);
    } catch (error) {
      setError(error.response?.data?.message || "Unable to load approvals.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const action = async (approval, type) => {
    try {
      setBusy(true);

      if (type === "approve") {
        await api.post(`/approvals/${approval._id}/approve`, {});
      }

      if (type === "changes") {
        const comment = window.prompt("Describe required changes.");
        if (!comment?.trim()) return;

        await api.post(`/approvals/${approval._id}/request-changes`, {
          comment,
        });
      }

      if (type === "comment") {
        const comment = window.prompt("Add comment.");
        if (!comment?.trim()) return;

        await api.post(`/approvals/${approval._id}/comment`, {
          comment,
        });
      }

      if (type === "call") {
        await api.post(`/approvals/${approval._id}/ask-for-call`, {
          comment: "Wedding customer requested a call.",
        });
      }

      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Approval action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!project) {
    return <div className="rounded-2xl border bg-white p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-4">
        <div>
          <p className="font-bold text-[#F26522]">{project.weddingProjectId}</p>
          <h1 className="text-3xl font-bold">Approvals</h1>
        </div>

        <Link
          to={`/account/weddings/${id}`}
          className="h-fit rounded-xl border px-4 py-2 text-sm font-semibold"
        >
          ← Project
        </Link>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {approvals.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">
          No approvals yet.
        </div>
      ) : (
        approvals.map((approval) => (
          <section
            key={approval._id}
            className="rounded-2xl border bg-white p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[#F26522]">
                  {approval.subjectType?.replaceAll("_", " ")} · Version{" "}
                  {approval.version}
                </p>

                <h2 className="mt-1 text-lg font-bold">{approval.title}</h2>

                <p className="mt-2 text-sm text-slate-500">
                  {approval.description}
                </p>
              </div>

              <StatusBadge status={approval.status} />
            </div>

            {approval.document?.url && (
              <a
                href={approval.document.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block font-semibold text-[#F26522]"
              >
                Open Document →
              </a>
            )}

            {approval.status === "pending" && (
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => action(approval, "approve")}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Approve
                </button>

                <button
                  disabled={busy}
                  onClick={() => action(approval, "changes")}
                  className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700"
                >
                  Request Changes
                </button>

                <button
                  disabled={busy}
                  onClick={() => action(approval, "comment")}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                >
                  Comment
                </button>

                <button
                  disabled={busy}
                  onClick={() => action(approval, "call")}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                >
                  Ask for Call
                </button>
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
};

const ErrorBox = ({ children }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
    {children}
  </div>
);

export default Approvals;