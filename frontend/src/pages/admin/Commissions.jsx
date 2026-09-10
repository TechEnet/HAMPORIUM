import { useEffect, useMemo, useState } from "react";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";

const Commissions = () => {
  const [commissions, setCommissions] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/commissions/admin/all", { params: status ? { status } : {} });
      setCommissions(response.data.commissions || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load commissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status]);

  const totals = useMemo(() => ({
    amount: commissions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    payable: commissions.filter((item) => item.status === "payable").reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }), [commissions]);

  const move = async (commission, nextStatus) => {
    try {
      await api.patch(`/commissions/admin/${commission._id}/status`, { status: nextStatus, note: `Moved to ${nextStatus} from Admin Console.` });
      setMessage(`Commission moved to ${nextStatus.replaceAll("_", " ")}.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update commission");
    }
  };

  const reverse = async (commission) => {
    const reason = window.prompt("Reversal reason");
    if (!reason) return;
    try {
      await api.post(`/commissions/admin/${commission._id}/reverse`, { reason });
      setMessage("Commission reversed.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to reverse commission");
    }
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-black/[0.07] pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F97316]">Partner Network</p><h1 className="mt-2 font-serif text-[44px] font-semibold leading-none">Commissions</h1><p className="mt-3 text-sm text-black/45">Eligibility, payable status, payout linkage and reversals.</p></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-black/10 bg-white px-4 text-xs font-bold"><option value="">All statuses</option>{["potential", "attributed", "order_confirmed", "eligible", "payable", "paid", "reversed"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></header>
      {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}{message && <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}
      <div className="grid gap-4 sm:grid-cols-3"><Stat label="Records" value={commissions.length} /><Stat label="Loaded amount" value={money(totals.amount)} /><Stat label="Payable" value={money(totals.payable)} /></div>
      <div className="overflow-hidden rounded-[22px] border border-black/10 bg-white">{loading ? <div className="p-10 text-center text-sm text-black/40">Loading...</div> : commissions.map((commission) => { const next = commission.status === "order_confirmed" ? "eligible" : commission.status === "eligible" ? "payable" : null; return <article key={commission._id} className="border-b border-black/[0.06] p-5 last:border-0"><div className="grid gap-5 lg:grid-cols-[1fr_auto_auto] lg:items-center"><div><p className="text-[9px] font-black text-[#D4AF37]">{commission.commissionId}</p><p className="mt-1 font-black">{commission.partner?.businessName || "Partner"}</p><p className="mt-1 text-xs text-black/40">{commission.project?.title || "Project"}{commission.order?.orderNumber ? ` · ${commission.order.orderNumber}` : ""}</p></div><div className="lg:text-right"><p className="text-lg font-black text-[#F97316]">{money(commission.amount)}</p><div className="mt-2 flex gap-2 lg:justify-end"><StatusBadge status={commission.status} /><StatusBadge status={commission.payoutStatus} /></div></div><div className="flex flex-wrap gap-2 lg:justify-end">{next && <button type="button" onClick={() => move(commission, next)} className="rounded-xl bg-[#171717] px-4 py-2.5 text-[10px] font-black text-white">Mark {next}</button>}{!['paid','reversed'].includes(commission.status) && <button type="button" onClick={() => reverse(commission)} className="rounded-xl border border-red-200 px-4 py-2.5 text-[10px] font-black text-red-600">Reverse</button>}{commission.status === "payable" && <a href="/admin/payouts" className="rounded-xl bg-[#F97316] px-4 py-2.5 text-[10px] font-black text-white">Create payout</a>}</div></div></article>; })}{!loading && !commissions.length && <div className="p-10 text-center text-sm text-black/40">No commissions found.</div>}</div>
    </div>
  );
};
const Stat = ({ label, value }) => <div className="rounded-2xl border border-black/[0.06] bg-white p-5"><p className="text-[9px] font-black uppercase tracking-wider text-black/35">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>;
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
export default Commissions;
