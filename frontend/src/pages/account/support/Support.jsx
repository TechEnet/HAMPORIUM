import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";
import formatDate from "../../../utils/formatDate.js";

const CATEGORIES = [
  ["order_status", "Order status"],
  ["delivery", "Delivery issue"],
  ["damaged_item", "Damaged item"],
  ["missing_item", "Missing item"],
  ["payment", "Payment issue"],
  ["cancellation", "Cancellation"],
  ["refund", "Refund"],
  ["invoice", "Invoice"],
  ["product", "Product issue"],
  ["other", "Other"],
];

const Support = () => {
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get("orderId") || "";

  const [tickets, setTickets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    category: "order_status",
    subject: "",
    message: "",
    orderId: preselectedOrderId,
  });

  const loadTickets = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/support/mine", {
        params: {
          page,
          limit: 20,
          ...(status ? { status } : {}),
        },
      });

      setTickets(response.data?.tickets || []);
      setPagination(response.data?.pagination || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load support requests");
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await api.get("/orders/my-orders");
      setOrders(response.data?.orders || []);
    } catch {
      setOrders([]);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, [page, status]);

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    if (preselectedOrderId) {
      setForm((current) => ({ ...current, orderId: preselectedOrderId }));
    }
  }, [preselectedOrderId]);

  const stats = useMemo(
    () => ({
      open: tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).length,
      waiting: tickets.filter((ticket) => ticket.status === "waiting_customer").length,
      resolved: tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length,
    }),
    [tickets]
  );

  const submitTicket = async (event) => {
    event.preventDefault();

    if (form.subject.trim().length < 3) {
      setError("Subject must be at least 3 characters.");
      return;
    }

    if (form.message.trim().length < 5) {
      setError("Please explain your issue in at least 5 characters.");
      return;
    }

    setCreating(true);
    setError("");
    setNotice("");

    try {
      const response = await api.post("/support", {
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
        orderId: form.orderId || null,
      });

      setNotice(response.data?.message || "Support request submitted.");
      setForm({
        category: "order_status",
        subject: "",
        message: "",
        orderId: "",
      });
      setPage(1);
      await loadTickets();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to submit support request");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-12 text-[#171717]">
      <header className="flex flex-col gap-4 border-b border-black/[0.07] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
            Customer Care
          </p>
          <h1 className="mt-2 font-serif text-[44px] font-semibold leading-none tracking-[-0.03em]">
            Help & Support
          </h1>
          <p className="mt-3 max-w-2xl text-[12px] leading-6 text-black/45">
            Ask about an order, delivery, payment, cancellation, refund, invoice or product. Your conversation stays attached to one support ticket.
          </p>
        </div>

        <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#FFF9F2] px-5 py-4 text-[11px] leading-5 text-black/50">
          Future AI assistance can plug into this same ticket thread without changing the customer workflow.
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="h-fit rounded-[24px] border border-black/[0.07] bg-white p-5 shadow-[0_10px_30px_rgba(23,23,23,.035)] sm:p-6 xl:sticky xl:top-8">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">
            New Request
          </p>
          <h2 className="mt-1 text-lg font-black">How can we help?</h2>

          <form onSubmit={submitTicket} className="mt-5 space-y-4">
            <Field label="Issue type">
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className={inputClass}
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>

            <Field label="Related order (optional)">
              <select
                value={form.orderId}
                onChange={(event) => setForm((current) => ({ ...current, orderId: event.target.value }))}
                className={inputClass}
              >
                <option value="">No order selected</option>
                {orders.map((order) => (
                  <option key={order._id} value={order._id}>
                    {order.orderNumber} · {String(order.status || "").replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Subject">
              <input
                maxLength={180}
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                placeholder="Example: Package has not moved"
                className={inputClass}
              />
            </Field>

            <Field label="Message">
              <textarea
                rows="6"
                maxLength={5000}
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Tell us what happened and what you need help with..."
                className="w-full resize-none rounded-xl border border-black/10 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#F97316]"
              />
              <p className="mt-1 text-right text-[8px] font-semibold text-black/25">{form.message.length}/5000</p>
            </Field>

            <button
              type="submit"
              disabled={creating}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#F97316] px-5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:bg-[#171717] disabled:opacity-45"
            >
              {creating ? "Submitting..." : "Submit Support Request"}
            </button>
          </form>
        </section>

        <section>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Open / Active" value={stats.open} />
            <Stat label="Waiting for you" value={stats.waiting} />
            <Stat label="Resolved" value={stats.resolved} />
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-black/[0.07] bg-white p-4">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">Your Requests</p>
              <p className="mt-1 text-sm font-black">Conversation history</p>
            </div>

            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              className="h-10 rounded-xl border border-black/10 bg-white px-3 text-[10px] font-bold outline-none focus:border-[#F97316]"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_customer">Waiting Customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="mt-4 overflow-hidden rounded-[22px] border border-black/[0.07] bg-white">
            {loading ? (
              <div className="p-10 text-center text-sm text-black/40">Loading support requests...</div>
            ) : !tickets.length ? (
              <div className="p-10 text-center">
                <p className="text-sm font-black">No support requests yet.</p>
                <p className="mt-2 text-xs text-black/40">Create one whenever you need help.</p>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.06]">
                {tickets.map((ticket) => (
                  <Link
                    key={ticket._id}
                    to={`/account/support/${ticket._id}`}
                    className="block p-5 transition hover:bg-[#FFF9F2] sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={ticket.status} />
                          <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-wider text-black/45">
                            {String(ticket.category || "").replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="mt-3 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#D4AF37]">
                          {ticket.ticketNumber}
                        </p>
                        <h3 className="mt-1 text-sm font-black">{ticket.subject}</h3>
                        <p className="mt-2 text-[10px] text-black/40">
                          {ticket.order?.orderNumber ? `Order ${ticket.order.orderNumber} · ` : ""}
                          Last update {formatDate(ticket.lastMessageAt, true)}
                        </p>
                      </div>
                      <span className="text-[10px] font-extrabold text-[#F97316]">Open →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {pagination?.pages > 1 && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className={pageButtonClass}>Previous</button>
              <span className="text-[10px] font-semibold text-black/35">Page {pagination.page} of {pagination.pages}</span>
              <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)} className={pageButtonClass}>Next</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-2 block text-[9px] font-extrabold uppercase tracking-wider text-black/40">{label}</span>
    {children}
  </label>
);

const Stat = ({ label, value }) => (
  <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
    <p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">{label}</p>
    <p className="mt-2 text-2xl font-black">{value}</p>
  </div>
);

const inputClass = "h-11 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-[#F97316]";
const pageButtonClass = "rounded-xl border border-black/10 px-4 py-2.5 text-[10px] font-extrabold disabled:opacity-30";

export default Support;
