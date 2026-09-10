import { useEffect, useState } from "react";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";

const PartnerShowcases = () => {
  const [showcases, setShowcases] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await api.get("/showcases/admin/all", {
          params: status ? { status } : {},
        });
        setShowcases(response.data.showcases || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load partner showcases");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [status]);

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-black/[0.07] pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F97316]">Partner Network</p><h1 className="mt-2 font-serif text-[44px] font-semibold leading-none">Partner Showcases</h1><p className="mt-3 text-sm text-black/45">Operational visibility into private partner showcases and client feedback volume.</p></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-black/10 bg-white px-4 text-xs font-bold"><option value="">All statuses</option>{["draft", "active", "revoked", "expired", "archived"].map((value) => <option key={value} value={value}>{value}</option>)}</select></header>
      {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <section className="overflow-hidden rounded-[22px] border border-black/10 bg-white">{loading ? <div className="p-10 text-center text-sm text-black/40">Loading...</div> : showcases.map((showcase) => <article key={showcase._id} className="border-b border-black/[0.06] p-5 last:border-0"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap gap-2"><StatusBadge status={showcase.status} /><span className="text-[9px] font-black text-[#D4AF37]">{showcase.showcaseId}</span></div><p className="mt-2 font-black">{showcase.title}</p><p className="mt-1 text-xs text-black/40">{showcase.partner?.businessName || "Partner"} · {showcase.project?.projectId || "Project"} · {showcase.clientActions?.length || 0} action(s)</p></div><div className="text-xs text-black/35">{showcase.client?.email || ""}</div></div></article>)}{!loading && !showcases.length && <div className="p-10 text-center text-sm text-black/40">No showcases found.</div>}</section>
    </div>
  );
};

export default PartnerShowcases;
