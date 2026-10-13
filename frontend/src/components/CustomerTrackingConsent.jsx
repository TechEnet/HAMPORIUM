// EXACT PATH: frontend/src/components/CustomerTrackingConsent.jsx
// ACTION: NEW - CUSTOMER 360 FRONTEND V1
import { useEffect, useState } from "react";
import api from "../api/api.js";
import { deleteCustomerActivityHistory, updateCustomerActivityConsent } from "../utils/customerActivity.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function CustomerTrackingConsent() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const id = user?.id || user?._id;
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    api.get("/customer-intelligence/me/consent")
      .then(r => { if (active) setEnabled(r.data?.consent?.analyticsEnabled === true); })
      .catch(e => { if (active) setError(e.response?.data?.message || "Unable to load activity settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  const toggle = async () => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { const result = await updateCustomerActivityConsent(!enabled); setEnabled(result?.analyticsEnabled === true); setMessage(!enabled ? "Activity analytics enabled. Only future website activity will be collected." : "Activity analytics disabled. No further browsing events will be collected."); }
    catch (e) { setError(e.response?.data?.message || e.message || "Unable to save preference."); }
    finally { setBusy(false); }
  };
  const deleteHistory = async () => {
    if (!deleteConfirm || busy) return;
    setBusy(true); setError(""); setMessage("");
    try { const result = await deleteCustomerActivityHistory(); setMessage(`${result?.deleted ?? 0} optional activity events removed. Order and payment history remains available.`); setDeleteConfirm(false); }
    catch (e) { setError(e.response?.data?.message || "Unable to clear activity history."); }
    finally { setBusy(false); }
  };
  return <section className="mt-9 rounded-[22px] border border-[#E4D9C9] bg-[#FFFCF7] p-5 sm:p-7" aria-labelledby="activity-privacy-title">
    <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#AD7D3B]">Your privacy choices</p>
    <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="max-w-[650px]"><h2 id="activity-privacy-title" className="font-serif text-[29px] font-semibold text-[#241F1B]">Website activity insights</h2><p className="mt-2 text-[12px] leading-6 text-black/55">With your permission, HAMPORIUM can remember submitted searches, viewed products and cart activity to understand gifting preferences. This is optional and off by default. Browsing events are retained for a limited period (normally 180 days). We do not use hidden GPS, keystroke logging, passwords or payment credentials.</p></div><button type="button" role="switch" aria-checked={enabled} disabled={loading || busy} onClick={toggle} className={`shrink-0 rounded-full px-5 py-3 text-[12px] font-bold text-white disabled:opacity-50 ${enabled ? "bg-emerald-700" : "bg-[#26221D]"}`}>{loading ? "Loading…" : busy ? "Saving…" : enabled ? "Enabled · Turn off" : "Disabled · Turn on"}</button></div>
    <p className="mt-3 text-[11px] leading-5 text-black/45">Account registration, security/login records, orders, invoices, refunds and required operational records are stored separately from optional browsing analytics.</p>
    {error && <p role="alert" className="mt-3 text-[12px] font-semibold text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-[12px] font-semibold text-emerald-800">{message}</p>}
    <div className="mt-5 border-t border-black/[.09] pt-4"><div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={() => setDeleteConfirm(v => !v)} className="text-[12px] font-bold text-red-700 underline underline-offset-4 disabled:opacity-50">Clear my optional browsing history</button>{deleteConfirm && <><span className="text-[11px] text-black/50">Remove tracked browsing events? This cannot be undone.</span><button type="button" disabled={busy} onClick={deleteHistory} className="rounded-lg bg-red-700 px-4 py-2 text-[11px] font-bold text-white">Confirm removal</button><button type="button" disabled={busy} onClick={() => setDeleteConfirm(false)} className="text-[11px] font-bold">Cancel</button></>}</div></div>
  </section>;
}
