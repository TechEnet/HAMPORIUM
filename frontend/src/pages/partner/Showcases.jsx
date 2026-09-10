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

const Showcases = () => {
  const [showcases, setShowcases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [shareLinks, setShareLinks] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/showcases/mine");
      setShowcases(response.data.showcases || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load showcases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(
    () => ({
      total: showcases.length,
      live: showcases.filter((item) => item.status === "active").length,
      actions: showcases.reduce((sum, item) => sum + Number(item.clientActions?.length || 0), 0),
    }),
    [showcases]
  );

  const publish = async (showcase) => {
    setWorkingId(showcase._id);
    setError("");
    setMessage("");
    try {
      const response = await api.post(`/showcases/${showcase._id}/publish`);
      const shareUrl = `${window.location.origin}${response.data.sharePath}`;
      setShareLinks((current) => ({ ...current, [showcase._id]: shareUrl }));
      setMessage("Secure showcase link generated.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to publish showcase");
    } finally {
      setWorkingId("");
    }
  };

  const revoke = async (showcase) => {
    if (!window.confirm("Revoke client access to this showcase?")) return;
    setWorkingId(showcase._id);
    setError("");
    try {
      await api.post(`/showcases/${showcase._id}/revoke`);
      setShareLinks((current) => ({ ...current, [showcase._id]: "" }));
      setMessage("Showcase access revoked.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to revoke showcase");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Client Experience"
        title="Private Showcases"
        description="Publish OTP-protected client selections after HAMPORIUM validates the project pricing."
      />

      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Mini label="Showcases" value={totals.total} />
        <Mini label="Live" value={totals.live} />
        <Mini label="Client actions" value={totals.actions} />
      </div>

      {loading ? (
        <Panel><p className="text-sm text-black/40">Loading showcases...</p></Panel>
      ) : !showcases.length ? (
        <EmptyState
          title="No showcases yet"
          text="A showcase can be created from a project after HAMPORIUM approves client pricing."
          action={<Link to="/partner/projects" className="font-black text-[#F97316]">Open projects →</Link>}
        />
      ) : (
        <div className="space-y-4">
          {showcases.map((showcase) => {
            const shareUrl = shareLinks[showcase._id] || "";
            return (
              <Panel key={showcase._id}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill value={showcase.status} />
                      <span className="text-[10px] font-bold text-black/35">{showcase.showcaseId}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-black">{showcase.title}</h2>
                    <p className="mt-1 text-xs text-black/40">
                      {showcase.project?.projectId || "Project"} · {showcase.project?.title || ""}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-black/40">
                      <span>{showcase.items?.length || 0} options</span>
                      <span>{showcase.clientActions?.length || 0} client actions</span>
                      <span>Expires {formatPartnerDate(showcase.expiresAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={workingId === showcase._id}
                      onClick={() => publish(showcase)}
                      className="rounded-xl bg-[#F97316] px-4 py-3 text-[10px] font-black text-white disabled:opacity-40"
                    >
                      {showcase.status === "active" ? "Regenerate link" : "Publish"}
                    </button>
                    {showcase.status === "active" && (
                      <button type="button" disabled={workingId === showcase._id} onClick={() => revoke(showcase)} className="rounded-xl border border-red-200 px-4 py-3 text-[10px] font-black text-red-600 disabled:opacity-40">
                        Revoke
                      </button>
                    )}
                    {showcase.project?._id && (
                      <Link to={`/partner/projects/${showcase.project._id}`} className="rounded-xl border border-black/10 px-4 py-3 text-[10px] font-black">Project</Link>
                    )}
                  </div>
                </div>

                {shareUrl && (
                  <div className="mt-5 rounded-xl border border-[#D4AF37]/30 bg-[#FFF9F2] p-4">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#8D6C18]">Secure client link</p>
                    <p className="mt-2 break-all text-xs font-semibold">{shareUrl}</p>
                    <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)} className="mt-3 text-xs font-black text-[#F97316]">Copy link</button>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Mini = ({ label, value }) => <div className="rounded-xl border border-black/[0.06] bg-white p-4"><p className="text-[9px] font-black uppercase tracking-wider text-black/35">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;

export default Showcases;
