import { useEffect, useMemo, useState } from "react";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";

const Payouts = () => {
  const [payouts, setPayouts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [payable, setPayable] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    partnerId: "",
    commissionIds: [],
    adjustmentAmount: "0",
    periodFrom: "",
    periodTo: "",
    note: "",
  });

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const response = await api.get("/payouts/admin/all", {
        params: status ? { status } : {},
      });
      setPayouts(response.data.payouts || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load payouts");
    } finally {
      setLoading(false);
    }
  };

  const loadPartners = async () => {
    try {
      const response = await api.get("/partners/admin/all", {
        params: { status: "approved" },
      });
      setPartners(response.data.partners || []);
    } catch (requestError) {
      console.error("Unable to load partners for payouts:", requestError);
    }
  };

  useEffect(() => {
    void loadPayouts();
  }, [status]);

  useEffect(() => {
    void loadPartners();
  }, []);

  useEffect(() => {
    if (!form.partnerId) {
      setPayable([]);
      setForm((current) => ({ ...current, commissionIds: [] }));
      return;
    }

    const load = async () => {
      try {
        const response = await api.get("/commissions/admin/all", {
          params: { partnerId: form.partnerId, status: "payable" },
        });
        setPayable(response.data.commissions || []);
        setForm((current) => ({ ...current, commissionIds: [] }));
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load payable commissions");
      }
    };

    void load();
  }, [form.partnerId]);

  const selectedGross = useMemo(
    () =>
      payable
        .filter((item) => form.commissionIds.includes(item._id))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [payable, form.commissionIds]
  );

  const createPayout = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.partnerId || !form.commissionIds.length) {
      setError("Select a partner and at least one payable commission.");
      return;
    }

    setBusy(true);
    try {
      const response = await api.post("/payouts/admin", {
        partnerId: form.partnerId,
        commissionIds: form.commissionIds,
        adjustmentAmount: Number(form.adjustmentAmount || 0),
        note: form.note,
        period: {
          from: form.periodFrom || null,
          to: form.periodTo || null,
        },
      });
      setMessage(response.data.message || "Payout created.");
      setForm({ partnerId: "", commissionIds: [], adjustmentAmount: "0", periodFrom: "", periodTo: "", note: "" });
      setPayable([]);
      await loadPayouts();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to create payout");
    } finally {
      setBusy(false);
    }
  };

  const updatePayout = async (payout, nextStatus) => {
    let reference = payout.reference || "";
    let note = payout.note || "";

    if (nextStatus === "paid") {
      reference = window.prompt("Payment / bank reference", reference) || "";
      if (!reference) return;
    }

    if (["held", "failed", "cancelled"].includes(nextStatus)) {
      note = window.prompt("Reason / note", note) || note;
    }

    setBusy(true);
    setError("");
    try {
      await api.patch(`/payouts/admin/${payout._id}`, {
        status: nextStatus,
        reference,
        paymentMethod: payout.paymentMethod || "bank_transfer",
        note,
      });
      setMessage(`Payout moved to ${nextStatus}.`);
      await loadPayouts();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update payout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-black/[0.07] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F97316]">Partner Settlements</p>
          <h1 className="mt-2 font-serif text-[44px] font-semibold leading-none">Payouts</h1>
          <p className="mt-3 text-sm text-black/45">Batch payable commissions, process settlement states and record payment references.</p>
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-black/10 bg-white px-4 text-xs font-bold">
          <option value="">All statuses</option>
          {["pending", "processing", "held", "paid", "failed", "cancelled"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

      <section className="rounded-[22px] border border-black/10 bg-white p-6">
        <p className="text-[9px] font-black uppercase tracking-wider text-[#F97316]">Create payout</p>
        <h2 className="mt-1 text-xl font-black">New settlement batch</h2>

        <form onSubmit={createPayout} className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="xl:col-span-2"><span className={labelClass}>Partner</span><select value={form.partnerId} onChange={(event) => setForm((current) => ({ ...current, partnerId: event.target.value }))} className={inputClass}><option value="">Select approved partner</option>{partners.map((partner) => <option key={partner._id} value={partner._id}>{partner.businessName} · {partner.partnerId}</option>)}</select></label>
            <label><span className={labelClass}>Period from</span><input type="date" value={form.periodFrom} onChange={(event) => setForm((current) => ({ ...current, periodFrom: event.target.value }))} className={inputClass} /></label>
            <label><span className={labelClass}>Period to</span><input type="date" value={form.periodTo} onChange={(event) => setForm((current) => ({ ...current, periodTo: event.target.value }))} className={inputClass} /></label>
          </div>

          {form.partnerId && (
            <div className="rounded-xl bg-[#FFF9F2] p-4">
              <div className="flex items-center justify-between gap-4"><p className="text-xs font-black">Payable commissions</p><p className="text-sm font-black text-[#F97316]">Selected {money(selectedGross)}</p></div>
              <div className="mt-3 space-y-2">
                {payable.map((commission) => (
                  <label key={commission._id} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-black/[0.06] bg-white p-3">
                    <div className="flex items-center gap-3"><input type="checkbox" checked={form.commissionIds.includes(commission._id)} onChange={(event) => setForm((current) => ({ ...current, commissionIds: event.target.checked ? [...current.commissionIds, commission._id] : current.commissionIds.filter((id) => id !== commission._id) }))} className="h-4 w-4 accent-[#F97316]" /><div><p className="text-xs font-black">{commission.commissionId}</p><p className="mt-1 text-[9px] text-black/35">{commission.project?.title || commission.order?.orderNumber || "Commission"}</p></div></div>
                    <p className="text-sm font-black">{money(commission.amount)}</p>
                  </label>
                ))}
                {!payable.length && <p className="text-xs text-black/40">No payable commissions for this partner.</p>}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
            <label><span className={labelClass}>Adjustment amount</span><input type="number" step="0.01" value={form.adjustmentAmount} onChange={(event) => setForm((current) => ({ ...current, adjustmentAmount: event.target.value }))} className={inputClass} /></label>
            <label><span className={labelClass}>Note</span><input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className={inputClass} /></label>
            <button disabled={busy || !form.commissionIds.length} className="h-12 rounded-xl bg-[#F97316] px-5 text-xs font-black text-white disabled:opacity-40">{busy ? "Working..." : "Create payout"}</button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-black/10 bg-white">
        {loading ? <div className="p-10 text-center text-sm text-black/40">Loading payouts...</div> : payouts.map((payout) => (
          <article key={payout._id} className="border-b border-black/[0.06] p-5 last:border-0">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
              <div><div className="flex flex-wrap gap-2"><StatusBadge status={payout.status} /><span className="text-[9px] font-black text-[#D4AF37]">{payout.payoutId}</span></div><p className="mt-2 font-black">{payout.partner?.businessName || "Partner"}</p><p className="mt-1 text-xs text-black/40">{payout.commissions?.length || 0} commission(s) · Reference {payout.reference || "—"}</p></div>
              <div className="lg:text-right"><p className="text-xl font-black text-[#F97316]">{money(payout.netAmount)}</p><p className="mt-1 text-[10px] text-black/35">Gross {money(payout.grossAmount)} · Adj {money(payout.adjustmentAmount)}</p></div>
              <div className="flex max-w-sm flex-wrap gap-2 lg:justify-end">{getNextStatuses(payout.status).map((nextStatus) => <button key={nextStatus} type="button" disabled={busy} onClick={() => updatePayout(payout, nextStatus)} className={`rounded-xl px-3 py-2 text-[9px] font-black ${nextStatus === "paid" ? "bg-emerald-600 text-white" : nextStatus === "failed" || nextStatus === "cancelled" ? "border border-red-200 text-red-600" : "bg-[#171717] text-white"}`}>{nextStatus.replaceAll("_", " ")}</button>)}</div>
            </div>
          </article>
        ))}{!loading && !payouts.length && <div className="p-10 text-center text-sm text-black/40">No payouts found.</div>}
      </section>
    </div>
  );
};

const getNextStatuses = (status) => {
  if (status === "paid") return [];
  if (status === "pending") return ["processing", "held", "cancelled"];
  if (status === "processing") return ["paid", "held", "failed"];
  if (status === "held") return ["processing", "cancelled"];
  if (["failed", "cancelled"].includes(status)) return [];
  return [];
};

const labelClass = "mb-2 block text-[9px] font-black uppercase tracking-wider text-black/40";
const inputClass = "h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#F97316]";
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));

export default Payouts;
