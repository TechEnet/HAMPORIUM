// EXACT PATH: frontend/src/pages/admin/customerIntelligence/CustomerDetail.jsx
// REPLACE FILE

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../../api/api.js";
import { useAuth } from "../../../context/AuthContext.jsx";

const ROOT = "/customer-intelligence/admin/customers";
const font = "'Cormorant Garamond','Playfair Display',Georgia,serif";
const card = "rounded-[22px] border border-[#E9E0D5] bg-white shadow-[0_10px_30px_rgba(25,20,13,.035)]";
const money = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(v || 0));
const num = (v) => Number(v || 0).toLocaleString("en-IN");
const date = (v, time = false) => { if (!v) return "—"; const d = new Date(v); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(d); };
const human = (v) => String(v || "—").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
const fail = (e) => e?.response?.data?.message || "Unable to load data. Please try again.";
const sameId = (v) => v?._id || v?.id || "";
const tabs = [{ id: "overview", title: "Overview" }, { id: "orders", title: "Orders" }, { id: "payments", title: "Payments & Refunds" }, { id: "activity", title: "Activity" }, { id: "insights", title: "Insights" }, { id: "timeline", title: "Timeline" }, { id: "security", title: "Account Audit" }];
const empty = (label) => <div className="py-12 text-center text-[12px] text-black/40">{label}</div>;

function Stat({ label, value, hint }) { return <div className={`${card} p-4 sm:p-5`}><p className="text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{label}</p><p className="mt-3 break-words text-[23px] font-extrabold text-[#251D17] sm:text-[29px]">{value}</p>{hint && <p className="mt-2 text-[11px] text-black/40">{hint}</p>}</div>; }
function Pair({ title, value }) { return <div className="min-w-0 border-b border-black/[.06] py-3 last:border-none"><dt className="text-[10px] font-bold uppercase tracking-[.08em] text-black/35">{title}</dt><dd className="mt-1 break-words text-[12px] font-semibold text-[#24201C]">{value ?? "—"}</dd></div>; }
function Status({ children }) { const s = String(children || "").toLowerCase(); const cls = s === "active" || s === "paid" || s === "captured" || s === "completed" ? "bg-emerald-50 text-emerald-800" : s.includes("refund") || s.includes("cancel") || s.includes("delete") || s === "failed" ? "bg-red-50 text-red-700" : "bg-[#F8F0DF] text-[#89621B]"; return <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${cls}`}>{human(children)}</span>; }
function Pager({ data, page, onPage }) { const total = Math.max(1, Number(data?.totalPages || 1)); return <div className="flex items-center justify-between gap-3 border-t border-black/[.07] pt-4 text-[11px] text-black/45"><span>{num(data?.total)} records · Page {page} / {total}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-black/10 px-3 py-2 disabled:opacity-40">← Back</button><button disabled={page >= total} onClick={() => onPage(page + 1)} className="rounded-lg border border-black/10 px-3 py-2 disabled:opacity-40">Next →</button></div></div>; }
function Section({ title, eyebrow, children }) { return <section className={`${card} min-w-0 p-5 sm:p-6`}><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#AD834C]">{eyebrow}</p><h2 className="mt-1 mb-4 text-[29px] font-semibold" style={{ fontFamily: font }}>{title}</h2>{children}</section>; }
function AccountDialog({ action, customer, busy, error, onClose, onSubmit, partnerImpactCount }) {
  const dialogRef = useRef(null);
  const [reason, setReason] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmPartnerImpact, setConfirmPartnerImpact] = useState(false);
  const deleting = action === "delete";
  const needsPartnerConfirm = deleting && (customer.roleType === "partner" || customer.roleType === "both" || (partnerImpactCount || 0) > 0);
  const valid = reason.trim().length >= 10 && (!deleting || (confirmEmail.trim().toLowerCase() === String(customer.email).toLowerCase() && (!needsPartnerConfirm || confirmPartnerImpact)));
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) { e.preventDefault(); onClose(); }
      if (e.key !== "Tab") return;
      const elements = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), textarea:not([disabled]), input:not([disabled])') || [])];
      if (!elements.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && typeof previousFocus.focus === "function") previousFocus.focus();
    };
  }, [busy, onClose]);
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 px-3 py-8" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="c360-action-title" className="max-h-full w-full max-w-[510px] overflow-y-auto rounded-[24px] bg-[#FFFCF8] p-5 shadow-2xl sm:p-7">
      <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#BA8844]">Admin account control</p>
      <h2 id="c360-action-title" className="mt-2 text-[34px] font-semibold" style={{ fontFamily: font }}>{human(action)} account</h2>
      <p className="mt-2 text-[12px] leading-6 text-black/55"><strong>{customer.name}</strong> · {customer.email}</p>
      <p className="mt-4 rounded-xl bg-[#F7EFE1] p-3 text-[11px] leading-5 text-[#65543E]">{action === "suspend" ? "This blocks sign-in immediately and invalidates existing sessions. Financial records remain intact." : action === "reactivate" ? "This restores account access. Deleted accounts cannot be reactivated." : "This permanently disables account access, anonymizes the profile and removes saved browsing and addresses. Historic orders, payments, invoices and partner business records remain for accounting and legal retention."}</p>
      <form onSubmit={(e) => { e.preventDefault(); if (valid && !busy) onSubmit({ reason: reason.trim(), confirmEmail: confirmEmail.trim(), confirmPartnerImpact }); }} className="mt-5 space-y-4">
        <label className="block"><span className="text-[11px] font-bold">Reason (minimum 10 characters)</span><textarea rows={3} maxLength={500} autoFocus required value={reason} onChange={e => setReason(e.target.value)} placeholder="Documented reason for this account action" className="mt-2 w-full resize-y rounded-xl border border-black/15 bg-white p-3 text-[12px] outline-none focus:border-[#BD8747]" /></label>
        {deleting && <label className="block"><span className="text-[11px] font-bold">Type the exact customer email to confirm</span><input value={confirmEmail} autoComplete="off" onChange={e => setConfirmEmail(e.target.value)} placeholder={customer.email} className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-[12px] outline-none focus:border-[#BD8747]" /></label>}
        {needsPartnerConfirm && <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900"><input type="checkbox" className="mt-1 accent-amber-800" checked={confirmPartnerImpact} onChange={e => setConfirmPartnerImpact(e.target.checked)} /><span>I understand this account may be linked to {partnerImpactCount || "one or more"} partner business record(s). Business records, KYC and commissions are not automatically deleted, and a separate partner review may be required.</span></label>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-[11px] text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-black/10 pt-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-black/10 px-5 py-3 text-[12px] font-bold">Cancel</button><button type="submit" disabled={!valid || busy} className={`rounded-xl px-5 py-3 text-[12px] font-bold text-white disabled:opacity-40 ${deleting ? "bg-red-700" : "bg-[#211C17]"}`}>{busy ? "Processing…" : deleting ? "Confirm Delete Account" : `Confirm ${human(action)}`}</button></div>
      </form>
    </div>
  </div>;
}

export default function CustomerDetail() {
  const { customerId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState("");
  const [page, setPage] = useState(1);
  const [activityType, setActivityType] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [action, setAction] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [partnerImpactCount, setPartnerImpactCount] = useState(0);
  const loadDetail = useCallback(async (signal) => { const r = await api.get(`${ROOT}/${customerId}`, { signal }); return r.data; }, [customerId]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController(); setLoading(true); setError("");
    loadDetail(controller.signal).then(setDetail).catch(e => { if (e?.code !== "ERR_CANCELED") setError(fail(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [loadDetail, refreshKey, isAdmin]);
  useEffect(() => { setPage(1); setData(null); setActivityType(""); }, [tab, customerId]);
  useEffect(() => {
    if (!isAdmin || tab === "overview" || !detail) return;
    const controller = new AbortController(); setTabLoading(true); setTabError("");
    const endpoint = ({ orders: "orders", payments: "payments", activity: "activity", insights: "insights", timeline: "timeline", security: "account-actions" })[tab];
    api.get(`${ROOT}/${customerId}/${endpoint}`, { params: { ...(tab === "orders" || tab === "payments" || tab === "activity" || tab === "security" ? { page, limit: 15 } : {}), ...(tab === "activity" && activityType ? { type: activityType } : {}) }, signal: controller.signal })
      .then(r => setData(r.data)).catch(e => { if (e?.code !== "ERR_CANCELED") setTabError(fail(e)); }).finally(() => { if (!controller.signal.aborted) setTabLoading(false); });
    return () => controller.abort();
  }, [customerId, detail, tab, page, activityType, refreshKey, isAdmin]);
  const customer = detail?.customer;
  const metrics = detail?.metrics || {};
  const locked = customer?.isDeleted;
  const accountStatus = locked ? "Deleted" : customer?.isActive ? "Active" : "Suspended";
  const totalRefund = Number(metrics.refundAmount || 0);
  const latest = useMemo(() => (Array.isArray(detail?.recentOrders) ? detail.recentOrders : []), [detail]);
  const closeAction = useCallback(() => { if (!actionBusy) { setAction(""); setActionError(""); setPartnerImpactCount(0); } }, [actionBusy]);
  const submitAction = async (payload) => {
    if (actionBusy || !action) return;
    setActionBusy(true); setActionError("");
    try {
      const url = `${ROOT}/${customerId}`;
      if (action === "delete") await api.delete(url, { data: payload });
      else await api.post(`${url}/${action}`, { reason: payload.reason });
      setAction(""); setPartnerImpactCount(0); setRefreshKey(v => v + 1); setTab("overview");
    } catch (e) {
      if (e?.response?.data?.code === "PARTNER_IMPACT_CONFIRMATION_REQUIRED") setPartnerImpactCount(Number(e.response.data.partnerRecords) || 1);
      setActionError(fail(e));
    } finally { setActionBusy(false); }
  };
  if (!isAdmin) return <p className="p-8 text-red-700">Only Admin accounts can access Customer Intelligence.</p>;
  if (loading) return <div role="status" className={`${card} p-10 text-center text-sm`}>Loading customer profile…</div>;
  if (error || !customer) return <div className={`${card} p-7`}><p className="text-[13px] text-red-700">{error || "Customer not found"}</p><Link className="mt-4 inline-block font-bold text-[#AF7937]" to="/admin/customers">← Back to customers</Link></div>;
  return <main className="mx-auto max-w-[1660px] pb-16 text-[#24201B]" style={{ fontFamily: "'Manrope',Arial,sans-serif" }}>
    <Link to="/admin/customers" className="inline-flex items-center gap-2 text-[12px] font-bold text-[#A07538] hover:underline">← All customers</Link>
    <div className="relative mt-4 overflow-hidden rounded-[25px] bg-[#201C18] p-5 text-white sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-[#D8AC70]/20" />
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#D2AA70]">Customer 360 / Single Account History</p>
      <div className="mt-5 flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#D3AC6B]/35 bg-white/5 font-serif text-4xl text-[#D9BC8A]">{(customer.name || "?").charAt(0).toUpperCase()}</div><div className="min-w-0"><h1 className="break-words text-[36px] font-semibold leading-none sm:text-[48px]" style={{ fontFamily: font }}>{customer.name}</h1><p className="mt-2 break-all text-[12px] text-white/55">{customer.email}</p><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-[#D4AE75]/15 px-2.5 py-1 text-[10px] font-bold text-[#D8B77F]">{customer.roleType === "both" ? "Customer + Partner" : customer.roleType === "partner" ? "Partner" : "Customer"}</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/75">{accountStatus}</span></div></div></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setRefreshKey(v => v + 1)} className="rounded-xl border border-white/20 px-4 py-2.5 text-[11px] font-bold hover:bg-white/10">↻ Refresh</button>{!locked && (customer.isActive ? <button type="button" onClick={() => setAction("suspend")} className="rounded-xl border border-orange-300/45 px-4 py-2.5 text-[11px] font-bold text-orange-200 hover:bg-orange-500/10">Suspend</button> : <button type="button" onClick={() => setAction("reactivate")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-[11px] font-bold">Reactivate</button>)}{!locked && <button type="button" onClick={() => setAction("delete")} className="rounded-xl border border-red-400/50 px-4 py-2.5 text-[11px] font-bold text-red-200 hover:bg-red-900/30">Delete account</button>}</div>
      </div>
    </div>
    <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4"><Stat label="Total orders" value={num(metrics.totalOrders)} hint={`${num(metrics.paidOrders)} paid`} /><Stat label="Cancelled" value={num(metrics.cancelledOrders)} hint={`${num(metrics.cancellationRequests)} cancellation requests`} /><Stat label="Paid order value" value={money(metrics.paidOrderValue)} hint="Before refunds" /><Stat label="Refunded amount" value={money(totalRefund)} hint={`${num(metrics.refundedOrders)} refunded orders`} /></section>
    <nav aria-label="Customer details tabs" className="mt-6 flex w-full gap-1.5 overflow-x-auto border-b border-black/10 pb-2 [scrollbar-width:thin]">{tabs.map(t => <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} className={`shrink-0 rounded-xl px-4 py-3 text-[11px] font-bold transition ${tab === t.id ? "bg-[#211D18] text-[#EBCFA4]" : "text-black/55 hover:bg-white hover:text-[#A36F2D]"}`}>{t.title}</button>)}</nav>
    <div className="mt-5 space-y-4">
      {tab === "overview" && <>
        <div className="grid gap-4 xl:grid-cols-2"><Section eyebrow="Identity" title="Customer profile"><dl className="grid grid-cols-2 gap-x-4"><Pair title="Name" value={customer.name} /><Pair title="Phone" value={customer.phone || "Not provided"} /><Pair title="Email verified" value={customer.emailVerified ? "Yes" : "No"} /><Pair title="Joined" value={date(customer.createdAt, true)} /><Pair title="Last login" value={date(customer.lastLoginAt, true)} /><Pair title="Account status" value={accountStatus} /><Pair title="Saved location" value={[detail.location?.city, detail.location?.state].filter(Boolean).join(", ") || "Not provided"} /><Pair title="Behavior analytics" value={detail.analyticsConsent ? "Customer opted in" : "Not enabled"} /></dl></Section><Section eyebrow="Delivery" title="Saved addresses">{(detail.addresses || []).length ? <div className="space-y-2">{detail.addresses.map(a => <div key={a._id} className="rounded-xl bg-[#FBF8F2] p-4 text-[12px]"><p className="font-extrabold">{a.label || "Address"} {a.isDefault && <span className="ml-2 text-[10px] font-bold text-[#AF7937]">Default</span>}</p><p className="mt-2 leading-6 text-black/60">{[a.fullName, a.addressLine1, a.addressLine2, a.landmark, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(", ")}</p><p className="mt-1 text-black/45">Phone: {a.phone || "—"}</p></div>)}</div> : empty("No saved delivery address. Location is not inferred from IP or GPS.")}</Section></div>
        <div className="grid gap-4 xl:grid-cols-2"><Section eyebrow="Partner relationship" title="Linked businesses">{(detail.partnerRecords || []).length ? <div className="space-y-3">{detail.partnerRecords.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF7F0] p-4 text-[12px]"><div><p className="font-extrabold">{p.businessName || p.partnerId || "Partner business"}</p><p className="mt-1 text-[11px] text-black/50">{p.partnerId} · {human(p.relationship)}</p></div><Status>{p.status}</Status></div>)}</div> : empty("No linked partner business found.")}</Section><Section eyebrow="Latest purchases" title="Recent orders">{latest.length ? <div className="space-y-2">{latest.map(o => <Link key={o._id} to={`/admin/orders/${o._id}`} className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF8F4] p-3 text-[12px] hover:bg-[#F4EAD7]"><div><p className="font-extrabold">{o.orderNumber}</p><p className="mt-1 text-[10px] text-black/40">{date(o.createdAt)} · {human(o.status)}</p></div><p className="font-bold">{money(o.totalAmount)}</p></Link>)}</div> : empty("No orders yet.")}</Section></div>
        <p className="text-[11px] leading-5 text-black/40">Delivered count: {metrics.deliveredSupported ? num(metrics.deliveredOrders) : "Unavailable until fulfilment status integration"}. Partner shopping uses this same User ID; it is never counted as a second customer.</p>
      </>}
      {tab !== "overview" && <section className={`${card} p-4 sm:p-6`}>
        {tabLoading && <p role="status" className="py-9 text-center text-[12px] text-black/45">Loading {tab}…</p>}
        {tabError && <div role="alert" className="mb-3 rounded-xl bg-red-50 p-4 text-[12px] text-red-700">{tabError}</div>}
        {!tabLoading && !tabError && tab === "orders" && <>
          <h2 className="mb-4 text-[28px] font-semibold" style={{ fontFamily: font }}>Order history</h2>{(data?.orders || []).length ? <div className="space-y-3">{data.orders.map(o => <div key={o._id} className="rounded-xl border border-black/[.07] p-4"><div className="flex flex-wrap justify-between gap-3"><Link to={`/admin/orders/${o._id}`} className="text-[13px] font-extrabold text-[#946626] hover:underline">{o.orderNumber} ↗</Link><p className="font-bold">{money(o.totalAmount)}</p></div><div className="mt-2 flex flex-wrap items-center gap-2"><Status>{o.status}</Status><Status>{o.paymentStatus}</Status><span className="text-[11px] text-black/45">{date(o.createdAt, true)} · {human(o.checkoutMode)}</span></div><p className="mt-2 text-[11px] text-black/55">{(o.items || []).slice(0, 4).map(i => `${i.productName || i.skuName || "Gift"} × ${i.quantity}`).join(" · ") || "Items unavailable"}</p>{o.cancellation?.status && o.cancellation.status !== "none" && <div className="mt-3 rounded-lg bg-orange-50 p-3 text-[11px] text-orange-900">Cancellation: {human(o.cancellation.status)}{o.cancellation.reason ? ` — ${o.cancellation.reason}` : ""}</div>}</div>)}</div> : empty("No recorded orders.")}<Pager data={data} page={page} onPage={setPage} />
        </>}
        {!tabLoading && !tabError && tab === "payments" && <><h2 className="mb-4 text-[28px] font-semibold" style={{ fontFamily: font }}>Payments & recorded refunds</h2>{(data?.payments || []).length ? <div className="space-y-3">{data.payments.map(p => <div key={p._id} className="flex flex-col justify-between gap-3 rounded-xl border border-black/[.07] p-4 sm:flex-row"><div><p className="text-[12px] font-extrabold">{money(p.amount)} <span className="ml-1 text-[10px] font-normal text-black/45">{human(p.sourceType || "order")}</span></p><p className="mt-1 text-[11px] text-black/45">{date(p.createdAt, true)} · {human(p.method || "Online")}</p><div className="mt-2"><Status>{p.status}</Status></div></div><div className="text-left sm:text-right"><p className="text-[12px] font-bold text-red-700">Refunded {money(p.refundedAmount)}</p><p className="mt-1 text-[10px] text-black/45">Last refund: {date(p.lastRefundAt)}</p></div></div>)}</div> : empty("No payment history.")}<Pager data={data} page={page} onPage={setPage} /><p className="mt-3 text-[11px] text-black/40">Refund amounts come from saved Payment records. Detailed refund case information requires the Refund module integration.</p></>}
        {!tabLoading && !tabError && tab === "activity" && <><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-[28px] font-semibold" style={{ fontFamily: font }}>Website activity</h2><select aria-label="Filter activity events" value={activityType} onChange={e => { setActivityType(e.target.value); setPage(1); }} className="rounded-lg border border-black/10 bg-[#FCFAF6] px-3 py-2 text-xs"><option value="">All activity</option>{["account_created", "email_verified", "signed_in", "search_submitted", "product_viewed", "cart_item_added", "cart_item_removed", "builder_started", "hamper_configured", "checkout_started"].map(x => <option key={x} value={x}>{human(x)}</option>)}</select></div>{(data?.events || []).length ? <div className="divide-y divide-black/[.06]">{data.events.map(e => <div key={e._id} className="flex gap-3 py-4"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#B48A4E]"/><div className="min-w-0"><p className="text-[12px] font-bold">{human(e.type)}</p><p className="mt-1 break-words text-[11px] text-black/55">{e.searchQuery ? `Search: ${e.searchQuery}` : e.pagePath || (e.productId ? `Product: ${e.productId}` : e.source)}</p><p className="mt-1 text-[10px] text-black/35">{date(e.createdAt, true)}</p></div></div>)}</div> : empty(detail.analyticsConsent ? "No tracked activity yet." : "Behavior tracking is disabled until the customer opts in. Account/auth events may still appear.")}<Pager data={data} page={page} onPage={setPage} /></>}
        {!tabLoading && !tabError && tab === "insights" && <><h2 className="mb-4 text-[28px] font-semibold" style={{ fontFamily: font }}>What this customer explores</h2><Link to="/admin/analytics/search" className="mb-4 inline-flex text-[12px] font-extrabold text-[#946624] underline underline-offset-4">Open Business Search Analytics →</Link><div className="mb-5 rounded-xl bg-[#FBF5E9] p-4 text-[12px] text-[#82602E]">{num(data?.insights?.totalTrackedEvents)} recorded events · Consent: {detail.analyticsConsent ? "Enabled" : "Not enabled"}</div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-black/[.06] p-4"><h3 className="mb-4 text-[13px] font-extrabold">Top submitted searches</h3>{(data?.insights?.topSearches || []).length ? data.insights.topSearches.map((row, idx) => <div key={`${row.query}-${idx}`} className="mb-3"><div className="flex justify-between gap-3 text-[11px]"><span className="truncate font-semibold">{row.query}</span><strong>{num(row.count)}</strong></div><div className="mt-1 h-1.5 rounded bg-black/5"><div className="h-full rounded bg-[#C59B61]" style={{ width: `${Math.round(100 * Number(row.count || 0) / Number(data.insights.topSearches[0]?.count || 1))}%` }} /></div></div>) : empty("No customer-linked search events. Aggregate searches are available in Business Analytics. Customer-linked tracking begins only after valid opt-in.")}</div><div className="rounded-xl border border-black/[.06] p-4"><h3 className="mb-4 text-[13px] font-extrabold">Most viewed products</h3>{(data?.insights?.topViewedProducts || []).length ? data.insights.topViewedProducts.map((row, idx) => <div key={`${row.productId}-${idx}`} className="mb-3"><div className="flex justify-between gap-3 text-[11px]"><span className="min-w-0 truncate font-semibold">{row.name || String(row.productId)}</span><strong>{num(row.views)} views</strong></div><div className="mt-1 h-1.5 rounded bg-black/5"><div className="h-full rounded bg-[#D6AD6B]" style={{ width: `${Math.round(100 * Number(row.views || 0) / Number(data.insights.topViewedProducts[0]?.views || 1))}%` }} /></div></div>) : empty("No product views recorded.")}</div></div></>}
        {!tabLoading && !tabError && tab === "timeline" && <><h2 className="mb-4 text-[28px] font-semibold" style={{ fontFamily: font }}>Customer journey</h2>{(data?.timeline || []).length ? <ol className="ml-2 border-l border-[#DBBF95] pl-6">{data.timeline.map((x, index) => <li key={`${x.kind}-${x.at}-${index}`} className="relative pb-5 last:pb-0"><span className="absolute -left-[29px] top-[4px] h-2 w-2 rounded-full bg-[#BA8749]"/><p className="text-[12px] font-extrabold">{x.label || human(x.kind)} {x.orderNumber ? `· ${x.orderNumber}` : ""}</p><p className="mt-1 text-[11px] text-black/50">{[x.query ? `Search: ${x.query}` : "", x.reason || "", x.amount != null ? money(x.amount) : "", x.refundedAmountToDate ? `Refund to date: ${money(x.refundedAmountToDate)}` : ""].filter(Boolean).join(" · ")}</p><p className="mt-1 text-[10px] text-black/35">{date(x.at, true)}</p></li>)}</ol> : empty("No timeline history.")}<p className="mt-5 text-[11px] text-black/40">{data?.note}</p></>}
        {!tabLoading && !tabError && tab === "security" && <><h2 className="mb-4 text-[28px] font-semibold" style={{ fontFamily: font }}>Account action audit</h2>{(data?.actions || []).length ? <div className="space-y-3">{data.actions.map(x => <div key={x._id} className="rounded-xl border border-black/[.08] p-4"><div className="flex items-center justify-between gap-2"><p className="text-[12px] font-extrabold">{human(x.action)}</p><Status>{x.status}</Status></div><p className="mt-2 text-[11px] text-black/65">{x.reason}</p><p className="mt-2 text-[10px] text-black/40">{date(x.completedAt || x.createdAt, true)} · Actor ID: {x.actor || "—"}</p></div>)}</div> : empty("No account moderation history.")}<Pager data={data} page={page} onPage={setPage} /></>}
      </section>}
    </div>
    {action && <AccountDialog key={action} action={action} customer={customer} busy={actionBusy} error={actionError} partnerImpactCount={partnerImpactCount} onClose={closeAction} onSubmit={submitAction} />}
  </main>;
}
