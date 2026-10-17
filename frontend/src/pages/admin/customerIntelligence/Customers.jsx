
// EXACT PATH: frontend/src/pages/admin/customerIntelligence/Customers.jsx
// ACTION: NEW - CUSTOMER 360 FRONTEND V1
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../../api/api.js";
import { useAuth } from "../../../context/AuthContext.jsx";

const ROOT = "/customer-intelligence/admin";
const font = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const date = (value) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";
const roles = [{ value: "all", label: "All accounts" }, { value: "customer", label: "Customer only" }, { value: "partner", label: "Partner only" }, { value: "both", label: "Customer + Partner" }];
const statuses = [{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "deleted", label: "Deleted" }];
const panel = "rounded-[22px] border border-[#E8E0D5] bg-white shadow-[0_14px_36px_rgba(28,23,16,.035)]";
const input = "h-11 w-full rounded-xl border border-black/10 bg-[#FCFAF6] px-4 text-[13px] font-medium text-[#231F19] outline-none transition focus:border-[#BF9253] focus:ring-2 focus:ring-[#BF9253]/10";
const num = (value) => Number(value || 0).toLocaleString("en-IN");

const labelRole = (value) => ({ customer: "Customer", partner: "Partner", both: "Customer + Partner" }[value] || "Customer");
const statusFor = (row) => row.isDeleted ? "Deleted" : row.isActive ? "Active" : "Suspended";
const pillClass = (status) => status === "Active" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : status === "Deleted" ? "bg-red-50 text-red-700 border-red-100" : "bg-amber-50 text-amber-800 border-amber-200";
const getError = (error) => error?.response?.data?.message || "Unable to load customer information. Please try again.";

function StatCard({ title, value, subtitle, accent = false }) {
  return <div className={`${panel} min-w-0 p-4 sm:p-5`}>
    <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-black/45">{title}</p>
    <p className={`mt-3 break-words text-[27px] font-extrabold tracking-tight sm:text-[31px] ${accent ? "text-[#AC7833]" : "text-[#181818]"}`}>{value}</p>
    <p className="mt-2 text-[11px] font-medium leading-5 text-black/40">{subtitle}</p>
  </div>;
}

function CustomerCard({ item }) {
  const id = item.id || item._id;
  const status = statusFor(item);
  return <Link to={`/admin/customers/${id}`} className="group block border-b border-black/[.055] p-4 transition hover:bg-[#FFFAF1] sm:p-5 last:border-b-0">
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#201D19] font-serif text-xl font-bold text-[#D8B474]">{(item.name || "?").slice(0, 1).toUpperCase()}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-[13px] font-extrabold text-[#241F1B] group-hover:text-[#AD7430]">{item.name || "Customer"}</h3><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${pillClass(status)}`}>{status}</span></div>
        <p className="mt-1 break-all text-[11px] text-black/50">{item.email}</p>
        <p className="mt-1 text-[10px] text-black/35">{labelRole(item.roleType)} · Joined {date(item.createdAt)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#FAF8F4] p-3 text-center">
          <div><p className="text-[9px] text-black/45">Orders</p><p className="mt-1 text-[14px] font-extrabold">{num(item.metrics?.totalOrders)}</p></div>
          <div><p className="text-[9px] text-black/45">Paid value</p><p className="mt-1 break-words text-[12px] font-extrabold">{money(item.metrics?.paidOrderValue)}</p></div>
        </div>
      </div>
      <span className="mt-1 text-[20px] text-[#BBA98F] group-hover:translate-x-1 group-hover:text-[#AD7430]">→</span>
    </div>
  </Link>;
}

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin");
  const [params, setParams] = useSearchParams();
  const role = roles.some(x => x.value === params.get("roleType")) ? params.get("roleType") : "all";
  const status = statuses.some(x => x.value === params.get("status")) ? params.get("status") : "all";
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  const search = params.get("search") || "";
  const [draft, setDraft] = useState(search);
  const [overview, setOverview] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [reload, setReload] = useState(0);

  const setFilter = (changes) => { const next = new URLSearchParams(params); Object.entries(changes).forEach(([key, val]) => { if (!val || (val === "all" && key !== "search")) next.delete(key); else next.set(key, String(val)); }); if (!("page" in changes)) next.delete("page"); setParams(next); };
  useEffect(() => setDraft(search), [search]);
  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    api.get(`${ROOT}/overview`).then(r => { if (live) setOverview(r.data.overview); }).catch(e => { if (live) setError(getError(e)); });
    return () => { live = false; };
  }, [isAdmin, reload]);
  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    setBusy(true); setError("");
    api.get(`${ROOT}/customers`, { params: { page, limit: 20, roleType: role, status, search }, signal: controller.signal })
      .then(r => setData(r.data))
      .catch(e => { if (e?.code !== "ERR_CANCELED") setError(getError(e)); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [page, role, status, search, reload, isAdmin]);
  const customers = data?.customers || [];
  const counts = useMemo(() => [
    { title: "Unique accounts", value: num(overview?.registeredUsers), subtitle: "Customers & partners together" },
    { title: "Active accounts", value: num(overview?.activeUsers), subtitle: "Accounts with access" },
    { title: "Total orders", value: num(overview?.orders?.totalOrders), subtitle: `${num(overview?.orders?.paidOrders)} paid orders` },
    { title: "Cancelled orders", value: num(overview?.orders?.cancelledOrders), subtitle: "Recorded cancellations" },
    { title: "Paid order value", value: money(overview?.orders?.paidOrderValue), subtitle: "Recorded paid order value", accent: true },
  ], [overview]);
  if (!isAdmin) return <div className="rounded-2xl bg-white p-8 text-sm text-red-700">Only Admin accounts can open Customer Intelligence.</div>;
  return <main className="mx-auto max-w-[1660px] pb-14" style={{ fontFamily: "'Manrope',Arial,sans-serif" }}>
    <section className="relative overflow-hidden rounded-[25px] bg-[#191917] px-5 py-7 text-white sm:px-8 sm:py-9 lg:px-10">
      <div className="pointer-events-none absolute -right-16 -top-32 h-80 w-80 rounded-full border border-[#D5AA6D]/20" />
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#D2AD78]">HAMPORIUM / CUSTOMER 360°</p>
      <div className="mt-3 flex flex-col items-start justify-between gap-5 md:flex-row md:items-end">
        <div><h1 className="text-[43px] font-semibold leading-none sm:text-[56px]" style={{ fontFamily: font }}>Customer <em className="text-[#D7B47D]">Intelligence.</em></h1><p className="mt-3 max-w-xl text-[12px] leading-6 text-white/55">Every customer and partner, one account. Real orders, payments, delivery addresses and website activity insights.</p></div>
        <button type="button" onClick={() => setReload(v => v + 1)} className="rounded-xl border border-white/25 px-5 py-3 text-[11px] font-bold text-white transition hover:bg-white/10">↻ Refresh data</button>
      </div>
    </section>
    <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-3">{counts.map(card => <StatCard key={card.title} {...card} />)}</section>
    <section className={`${panel} mt-6 overflow-hidden`}>
      <div className="border-b border-black/[.06] px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#B28448]">Account directory</p><h2 className="mt-1 text-[31px] font-semibold" style={{ fontFamily: font }}>Customer & Partner Records</h2><p className="mt-1 text-[12px] text-black/45">Filter, search and open the complete customer history.</p></div><p className="text-[11px] font-semibold text-black/45">{num(data?.total)} matching accounts</p></div>
        <form className="mt-5 grid gap-3 md:grid-cols-[minmax(180px,1fr)_180px_160px_auto]" onSubmit={e => { e.preventDefault(); setFilter({ search: draft.trim(), page: 1 }); }}>
          <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-black/50">Search account</span><input aria-label="Search customer name, email or phone" className={input} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Name, email or phone" /></label>
          <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-black/50">Role</span><select className={input} value={role} onChange={e => setFilter({ roleType: e.target.value })}>{roles.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-black/50">Status</span><select className={input} value={status} onChange={e => setFilter({ status: e.target.value })}>{statuses.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
          <button type="submit" className="h-11 self-end rounded-xl bg-[#201B17] px-5 text-[12px] font-bold text-white transition hover:bg-[#AF7A38]">Search</button>
        </form>
      </div>
      {error && <div role="alert" className="m-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">{error}</div>}
      {busy && <div role="status" className="px-6 py-12 text-center text-sm text-black/45">Loading customer records…</div>}
      {!busy && !customers.length && <div className="px-6 py-14 text-center"><p className="font-semibold">No matching accounts</p><p className="mt-2 text-[12px] text-black/45">Try another search or filter.</p></div>}
      {!busy && customers.length > 0 && <>
        <div className="md:hidden">{customers.map(c => <CustomerCard key={c.id || c._id} item={c} />)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[780px] text-left"><thead className="bg-[#FAF8F4] text-[10px] font-bold uppercase tracking-[.1em] text-black/40"><tr>{["Customer", "Role / Location", "Orders", "Paid value", "Status", ""].map(x => <th key={x} className="px-4 py-4 first:pl-6">{x}</th>)}</tr></thead><tbody className="divide-y divide-black/[.05]">{customers.map(item => { const state = statusFor(item); return <tr key={item.id || item._id} className="text-[12px] transition hover:bg-[#FFFAF3]"><td className="min-w-[190px] py-4 pl-6 pr-3"><Link className="font-extrabold text-[#252019] hover:text-[#B5803C]" to={`/admin/customers/${item.id || item._id}`}>{item.name}</Link><p className="mt-1 max-w-[220px] truncate text-[11px] text-black/40">{item.email}</p><p className="mt-1 text-[10px] text-black/35">Joined {date(item.createdAt)}</p></td><td className="px-4"><p className="font-semibold">{labelRole(item.roleType)}</p><p className="mt-1 text-[11px] text-black/40">{[item.location?.city, item.location?.state].filter(Boolean).join(", ") || "No saved location"}</p></td><td className="px-4 font-bold">{num(item.metrics?.totalOrders)}<p className="mt-1 font-normal text-black/35">{num(item.metrics?.cancelledOrders)} cancelled</p></td><td className="px-4 font-bold">{money(item.metrics?.paidOrderValue)}</td><td className="px-4"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${pillClass(state)}`}>{state}</span></td><td className="pr-5 text-right"><Link className="rounded-lg border border-black/10 px-3 py-2 text-[11px] font-extrabold hover:border-[#AD793D] hover:text-[#AD793D]" to={`/admin/customers/${item.id || item._id}`}>View →</Link></td></tr>; })}</tbody></table></div>
      </>}
      <div className="flex items-center justify-between gap-3 border-t border-black/[.06] px-5 py-4"><p className="text-[11px] text-black/40">Page {data?.page || page} of {Math.max(1, data?.totalPages || 1)}</p><div className="flex gap-2"><button type="button" disabled={busy || page <= 1} onClick={() => setFilter({ page: page - 1 })} className="rounded-lg border border-black/10 px-4 py-2 text-xs font-bold disabled:opacity-35">← Previous</button><button type="button" disabled={busy || page >= (data?.totalPages || 1)} onClick={() => setFilter({ page: page + 1 })} className="rounded-lg border border-black/10 px-4 py-2 text-xs font-bold disabled:opacity-35">Next →</button></div></div>
    </section>
    <p className="mt-4 text-[11px] leading-5 text-black/35">Financial counts use existing Order and Payment records. Website activity appears from newly recorded visits when tracking is active. Previously unrecorded browsing cannot be restored.</p>
  </main>;
}
