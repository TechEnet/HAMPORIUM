
// PATH: frontend/src/components/CustomerTrackingConsent.jsx
// Legacy component name retained so parent pages don't need to be edited.
// No dedicated opt-in consent UI: show an activity-data notice and user control.
import { useEffect, useState } from "react";
import api from "../api/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { configureCustomerActivityUser, deleteCustomerActivityHistory, updateCustomerActivityConsent } from "../utils/customerActivity.js";

export default function CustomerTrackingConsent() {
  const { user } = useAuth();
  const id = user?.id || user?._id || "";
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    configureCustomerActivityUser(user);
    const ctrl = new AbortController();
    setLoading(true);
    api.get("/customer-intelligence/me/consent", { signal: ctrl.signal })
      .then((r) => setEnabled(r.data?.consent?.analyticsEnabled === true))
      .catch((e) => { if (e.code !== "ERR_CANCELED") setError(e.response?.data?.message || "Unable to load activity settings."); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [id]);

  const changeTracking = async () => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const next = await updateCustomerActivityConsent(!enabled);
      const active = next?.analyticsEnabled === true;
      setEnabled(active);
      setMessage(active ? "Website activity recording resumed for future visits." : "Customer-linked website activity recording paused.");
    } catch (e) { setError(e.response?.data?.message || e.message || "Unable to save preference."); }
    finally { setBusy(false); }
  };
  const clearHistory = async () => {
    if (!confirmDelete || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await deleteCustomerActivityHistory();
      setEnabled(false); setConfirmDelete(false);
      setMessage(`${result?.deleted ?? 0} browsing events deleted. Recording stays paused until resumed. Orders and payments remain.`);
    } catch (e) { setError(e.response?.data?.message || "Unable to clear website history."); }
    finally { setBusy(false); }
  };

  if (!id) return null;
  return <section className="mt-9 rounded-[22px] border border-[#E4D9C9] bg-[#FFFCF7] p-5 sm:p-7" aria-labelledby="activity-history-title">
    <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#AD7D3B]">Account activity data</p>
    <h2 id="activity-history-title" className="mt-2 font-serif text-[29px] font-semibold text-[#241F1B]">Website activity history</h2>
    <p className="mt-2 max-w-[720px] text-[12px] leading-6 text-black/55">When you are signed in, HAMPORIUM records basic searches, product views and shopping actions for customer service and gifting insights. This is disclosed in our privacy policy. It excludes passwords, payment credentials and precise GPS. History is kept for a limited period (normally 180 days). Your cookie analytics preference is also respected.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={changeTracking} disabled={loading || busy} className="rounded-xl border border-black/15 bg-white px-4 py-2.5 text-[12px] font-bold text-[#241F1B] disabled:opacity-45">{loading ? "Loading…" : busy ? "Saving…" : enabled ? "Pause activity recording" : "Resume activity recording"}</button>
      <button type="button" onClick={() => setConfirmDelete(v => !v)} disabled={busy || loading} className="text-[12px] font-bold text-red-700 underline underline-offset-4 disabled:opacity-45">Clear my browsing history</button>
    </div>
    {confirmDelete && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-red-50 p-3 text-[12px]"><span>Delete saved browsing events and pause further recording?</span><button onClick={clearHistory} disabled={busy} className="rounded-lg bg-red-700 px-3 py-2 font-bold text-white">Delete history</button><button onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button></div>}
    {error && <p role="alert" className="mt-3 text-[12px] text-red-700">{error}</p>}
    {message && <p role="status" className="mt-3 text-[12px] text-emerald-700">{message}</p>}
  </section>;
}
