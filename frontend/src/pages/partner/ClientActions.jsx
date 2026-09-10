import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import {
  EmptyState,
  Notice,
  PageHeader,
  Panel,
  StatusPill,
  formatPartnerDate,
} from "../../components/partner/PartnerUI.jsx";

const ClientActions = () => {
  const [showcases, setShowcases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get("/showcases/mine");
        setShowcases(response.data.showcases || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load client actions");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const actions = useMemo(
    () =>
      showcases
        .flatMap((showcase) =>
          (showcase.clientActions || []).map((action) => ({
            ...action,
            showcaseId: showcase._id,
            showcaseCode: showcase.showcaseId,
            showcaseTitle: showcase.title,
            project: showcase.project,
          }))
        )
        .filter((action) => !filter || action.action === filter)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [showcases, filter]
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Client Feedback"
        title="Client Actions"
        description="See shortlist activity, comments, change requests, approvals and enquiries recorded inside secure showcases."
        action={
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 rounded-xl border border-black/10 bg-white px-4 text-xs font-bold">
            <option value="">All actions</option>
            {["shortlist", "unshortlist", "comment", "request_change", "approve", "enquire"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
        }
      />

      {error && <Notice type="error">{error}</Notice>}

      {loading ? (
        <Panel>Loading client actions...</Panel>
      ) : !actions.length ? (
        <EmptyState title="No client actions found" text="Actions will appear here when a client reviews a private showcase." />
      ) : (
        <Panel>
          <div className="divide-y divide-black/[0.06]">
            {actions.map((action) => (
              <article key={`${action.showcaseId}-${action._id}`} className="py-5 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill value={action.action} />
                      <span className="text-[10px] text-black/35">{formatPartnerDate(action.createdAt, true)}</span>
                    </div>
                    <h2 className="mt-3 font-black">{action.showcaseTitle}</h2>
                    <p className="mt-1 text-xs text-black/40">{action.project?.projectId || "Project"} · {action.project?.title || ""}</p>
                    {action.comment && <p className="mt-3 max-w-3xl rounded-xl bg-[#FFF9F2] p-4 text-sm leading-6 text-black/60">{action.comment}</p>}
                  </div>
                  {action.project?._id && <Link to={`/partner/projects/${action.project._id}`} className="text-xs font-black text-[#F97316]">Open project →</Link>}
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
};

export default ClientActions;
