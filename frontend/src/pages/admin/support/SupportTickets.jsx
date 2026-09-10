import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";
import formatDate from "../../../utils/formatDate.js";

const CATEGORIES = [
  "order_status",
  "delivery",
  "damaged_item",
  "missing_item",
  "payment",
  "cancellation",
  "refund",
  "invoice",
  "product",
  "other",
];

const SupportTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/support/admin", {
        params: {
          page,
          limit: 30,
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(category ? { category } : {}),
        },
      });
      setTickets(response.data?.tickets || []);
      setPagination(response.data?.pagination || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load support queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, status, priority, category]);

  const stats = useMemo(
    () => ({
      active: tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).length,
      waiting: tickets.filter((ticket) => ticket.status === "waiting_customer").length,
      urgent: tickets.filter((ticket) => ticket.priority === "urgent").length,
      resolved: tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length,
    }),
    [tickets]
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-12 text-[#171717]">
      <header className="flex flex-col gap-5 rounded-[24px] bg-[#171717] p-6 text-white lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#D4AF37]">Customer Care Operations</p>
          <h1 className="mt-2 font-serif text-[44px] font-semibold leading-none">Support Tickets</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">Resolve customer questions about orders, delivery, refunds, payments, invoices and products from one queue.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded-xl border border-white/15 px-5 py-3 text-xs font-bold transition hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-40">Refresh</button>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active" value={stats.active} />
        <Stat label="Waiting Customer" value={stats.waiting} />
        <Stat label="Urgent" value={stats.urgent} />
        <Stat label="Resolved / Closed" value={stats.resolved} />
      </div>

      <section className="grid gap-3 rounded-[20px] border border-black/[0.07] bg-white p-4 md:grid-cols-3">
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={filterClass}>
          <option value="">All statuses</option>
          {["open", "in_progress", "waiting_customer", "resolved", "closed"].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}
        </select>
        <select value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }} className={filterClass}>
          <option value="">All priorities</option>
          {["low", "normal", "high", "urgent"].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}
        </select>
        <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className={filterClass}>
          <option value="">All categories</option>
          {CATEGORIES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}
        </select>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white">
        {loading ? (
          <div className="p-10 text-center text-sm text-black/40">Loading support queue...</div>
        ) : !tickets.length ? (
          <div className="p-10 text-center text-sm text-black/40">No support tickets found.</div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {tickets.map((ticket) => (
              <Link key={ticket._id} to={`/admin/support/${ticket._id}`} className="grid gap-4 p-5 transition hover:bg-[#FFF9F2] md:grid-cols-[1fr_auto] sm:p-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={ticket.status} />
                    <StatusBadge status={ticket.priority} />
                    <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-wider text-black/45">{pretty(ticket.category)}</span>
                  </div>
                  <p className="mt-3 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#D4AF37]">{ticket.ticketNumber}</p>
                  <h2 className="mt-1 text-sm font-black">{ticket.subject}</h2>
                  <p className="mt-2 text-[10px] text-black/40">
                    {ticket.user?.name || ticket.user?.email || "Customer"}
                    {ticket.order?.orderNumber ? ` · ${ticket.order.orderNumber}` : ""}
                    {ticket.assignedTo?.name ? ` · Assigned to ${ticket.assignedTo.name}` : " · Unassigned"}
                  </p>
                </div>
                <div className="md:text-right">
                  <p className="text-[9px] font-semibold text-black/30">Updated</p>
                  <p className="mt-1 text-[10px] font-bold text-black/55">{formatDate(ticket.lastMessageAt, true)}</p>
                  <p className="mt-3 text-[10px] font-extrabold text-[#F97316]">Open Ticket →</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className={pageButtonClass}>Previous</button>
          <span className="text-[10px] font-semibold text-black/35">Page {pagination.page} of {pagination.pages}</span>
          <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)} className={pageButtonClass}>Next</button>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }) => <div className="rounded-2xl border border-black/[0.06] bg-white p-5"><p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
const pretty = (value = "") => String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
const filterClass = "h-11 rounded-xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#F97316]";
const pageButtonClass = "rounded-xl border border-black/10 px-4 py-2.5 text-[10px] font-extrabold disabled:opacity-30";

export default SupportTickets;
