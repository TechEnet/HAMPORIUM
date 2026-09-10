import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";
import formatCurrency from "../../../utils/formatCurrency.js";
import formatDate from "../../../utils/formatDate.js";

const SupportTicketDetails = () => {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [keepInProgress, setKeepInProgress] = useState(false);
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("normal");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setError("");
    try {
      const response = await api.get(`/support/admin/${ticketId}`);
      const next = response.data?.ticket || null;
      setTicket(next);
      if (next) {
        setStatus(next.status || "open");
        setPriority(next.priority || "normal");
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load support ticket");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
  }, [ticketId]);

  const saveWorkflow = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api.patch(`/support/admin/${ticketId}`, { status, priority });
      setNotice(response.data?.message || "Support ticket updated.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update support ticket");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (reply.trim().length < 2) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post(`/support/admin/${ticketId}/replies`, {
        message: reply.trim(),
        keepInProgress,
      });
      setNotice(response.data?.message || "Reply sent.");
      setReply("");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to send reply");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="rounded-2xl border bg-white p-8">Loading support ticket...</div>;
  if (!ticket) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error || "Support ticket not found"}</div>;

  return (
    <div className="mx-auto w-full max-w-[1500px] pb-12 text-[#171717]">
      <Link to="/admin/support" className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#F97316]">← Back to Support Queue</Link>

      <section className="mt-5 overflow-hidden rounded-[26px] bg-[#171717] text-white">
        <div className="grid lg:grid-cols-[1.25fr_.75fr]">
          <div className="p-6 sm:p-8">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#D4AF37]">{ticket.ticketNumber}</p>
            <h1 className="mt-2 font-serif text-[42px] font-semibold leading-tight">{ticket.subject}</h1>
            <p className="mt-3 text-xs text-white/45">{pretty(ticket.category)} · Created {formatDate(ticket.createdAt, true)}</p>
            <div className="mt-5 flex flex-wrap gap-2"><StatusBadge status={ticket.status} /><StatusBadge status={ticket.priority} /></div>
          </div>
          <div className="grid grid-cols-2 border-t border-white/10 lg:border-l lg:border-t-0">
            <Hero label="Customer" value={ticket.user?.name || ticket.user?.email || "Customer"} />
            <Hero label="Assigned" value={ticket.assignedTo?.name || "Unassigned"} borderLeft />
            <Hero label="Order" value={ticket.order?.orderNumber || "—"} borderTop />
            <Hero label="Refund" value={ticket.refund?.status ? pretty(ticket.refund.status) : "—"} borderLeft borderTop />
          </div>
        </div>
      </section>

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_390px]">
        <section className="rounded-[22px] border border-black/[0.07] bg-white p-5 sm:p-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">Conversation</p>
          <h2 className="mt-1 text-lg font-black">Customer & HAMPORIUM</h2>

          <div className="mt-6 space-y-4">
            {(ticket.messages || []).map((message) => {
              const internal = message.role !== "customer";
              return (
                <div key={message._id || `${message.createdAt}-${message.message}`} className={`flex ${internal ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-[18px] px-4 py-3 ${internal ? "bg-[#171717] text-white" : "bg-[#FFF9F2] text-[#171717]"}`}>
                    <div className="flex flex-wrap gap-2">
                      <p className={`text-[9px] font-extrabold uppercase tracking-wider ${internal ? "text-[#D4AF37]" : "text-[#F97316]"}`}>{internal ? "HAMPORIUM" : ticket.user?.name || "Customer"}</p>
                      <span className={`text-[8px] ${internal ? "text-white/35" : "text-black/25"}`}>{formatDate(message.createdAt, true)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[12px] leading-6">{message.message}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {ticket.status !== "closed" && (
            <form onSubmit={sendReply} className="mt-7 border-t border-black/[0.07] pt-5">
              <label className="block">
                <span className="mb-2 block text-[9px] font-extrabold uppercase tracking-wider text-black/40">Reply to customer</span>
                <textarea rows="6" maxLength={5000} value={reply} onChange={(event) => setReply(event.target.value)} className="w-full resize-none rounded-xl border border-black/10 px-4 py-3 text-sm leading-6 outline-none focus:border-[#F97316]" placeholder="Write a clear support response..." />
              </label>
              <label className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-black/45">
                <input type="checkbox" checked={keepInProgress} onChange={(event) => setKeepInProgress(event.target.checked)} className="accent-[#F97316]" />
                Keep ticket In Progress after reply (otherwise waits for customer)
              </label>
              <button type="submit" disabled={busy || reply.trim().length < 2} className="mt-4 rounded-xl bg-[#F97316] px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white transition hover:bg-[#171717] disabled:opacity-40">{busy ? "Working..." : "Send Reply"}</button>
            </form>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-[22px] border border-black/[0.07] bg-white p-5">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#F97316]">Workflow</p>
            <h2 className="mt-1 text-base font-black">Manage ticket</h2>
            <label className="mt-4 block"><span className={labelClass}>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>{["open", "in_progress", "waiting_customer", "resolved", "closed"].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
            <label className="mt-4 block"><span className={labelClass}>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)} className={inputClass}>{["low", "normal", "high", "urgent"].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
            <button type="button" onClick={saveWorkflow} disabled={busy} className="mt-4 w-full rounded-xl bg-[#171717] px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white transition hover:bg-[#F97316] disabled:opacity-40">Save Workflow</button>
          </section>

          <section className="rounded-[22px] border border-black/[0.07] bg-white p-5">
            <p className={labelClass}>Customer</p>
            <p className="font-black">{ticket.user?.name || "—"}</p>
            <p className="mt-1 text-xs text-black/45">{ticket.user?.email || "—"}</p>
            <p className="mt-1 text-xs text-black/45">{ticket.user?.phone || "—"}</p>
          </section>

          {ticket.order && (
            <section className="rounded-[22px] border border-black/[0.07] bg-[#FFF9F2] p-5">
              <p className={labelClass}>Related Order</p>
              <Link to={`/admin/orders/${ticket.order._id}`} className="font-black text-[#F97316] hover:text-[#171717]">{ticket.order.orderNumber}</Link>
              <p className="mt-2 text-xs text-black/45">Order: {pretty(ticket.order.status)} · Payment: {pretty(ticket.order.paymentStatus)}</p>
              <p className="mt-2 text-sm font-black">{formatCurrency(ticket.order.totalAmount)}</p>
              {ticket.order.deliveryDate && <p className="mt-2 text-[10px] text-black/40">Expected delivery {formatDate(ticket.order.deliveryDate)}</p>}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};

const Hero = ({ label, value, borderLeft = false, borderTop = false }) => <div className={`flex min-h-[115px] flex-col justify-center p-5 ${borderLeft ? "border-l border-white/10" : ""} ${borderTop ? "border-t border-white/10" : ""}`}><p className="text-[9px] font-extrabold uppercase tracking-wider text-white/35">{label}</p><p className="mt-2 break-words text-sm font-black text-white">{value}</p></div>;
const pretty = (value = "") => String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
const labelClass = "mb-2 block text-[9px] font-extrabold uppercase tracking-wider text-black/40";
const inputClass = "h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#F97316]";

export default SupportTicketDetails;
