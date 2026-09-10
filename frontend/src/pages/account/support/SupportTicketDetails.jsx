import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";
import formatDate from "../../../utils/formatDate.js";

const SupportTicketDetails = () => {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const threadEndRef = useRef(null);

  const load = async () => {
    setError("");
    try {
      const response = await api.get(`/support/mine/${ticketId}`);
      setTicket(response.data?.ticket || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load support request");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
  }, [ticketId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [ticket?.messages?.length]);

  const submitReply = async (event) => {
    event.preventDefault();
    if (reply.trim().length < 2) return;

    setSending(true);
    setError("");

    try {
      await api.post(`/support/mine/${ticketId}/replies`, {
        message: reply.trim(),
      });
      setReply("");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to send reply");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border bg-white p-8">Loading support request...</div>;
  }

  if (!ticket) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error || "Support request not found"}</div>;
  }

  const closed = ticket.status === "closed";

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-12 text-[#171717]">
      <Link to="/account/support" className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#F97316]">
        ← Back to Help & Support
      </Link>

      <section className="mt-5 overflow-hidden rounded-[26px] bg-[#171717] text-white">
        <div className="grid gap-0 lg:grid-cols-[1fr_330px]">
          <div className="p-6 sm:p-8">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#D4AF37]">{ticket.ticketNumber}</p>
            <h1 className="mt-2 font-serif text-[38px] font-semibold leading-tight sm:text-[46px]">{ticket.subject}</h1>
            <p className="mt-3 text-xs capitalize text-white/45">{String(ticket.category || "").replaceAll("_", " ")}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge status={ticket.status} />
              <StatusBadge status={ticket.priority} />
            </div>
          </div>

          <div className="border-t border-white/10 p-6 lg:border-l lg:border-t-0">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-white/35">Related Order</p>
            {ticket.order?._id ? (
              <Link to={`/account/orders/${ticket.order._id}`} className="mt-2 block font-black text-[#D4AF37] hover:text-[#F97316]">
                {ticket.order.orderNumber}
              </Link>
            ) : (
              <p className="mt-2 text-sm font-black">No order linked</p>
            )}
            <p className="mt-5 text-[9px] font-extrabold uppercase tracking-wider text-white/35">Last updated</p>
            <p className="mt-2 text-xs font-semibold text-white/60">{formatDate(ticket.lastMessageAt, true)}</p>
          </div>
        </div>
      </section>

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="mt-6 rounded-[22px] border border-black/[0.07] bg-white p-5 sm:p-6">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">Conversation</p>
          <h2 className="mt-1 text-lg font-black">Messages</h2>
        </div>

        <div className="mt-6 space-y-4">
          {(ticket.messages || []).map((message) => {
            const customer = message.role === "customer";
            return (
              <div key={message._id || `${message.createdAt}-${message.message}`} className={`flex ${customer ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-[18px] px-4 py-3 sm:max-w-[72%] ${customer ? "bg-[#F97316] text-white" : "bg-[#F5F2ED] text-[#171717]"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-[9px] font-extrabold uppercase tracking-wider ${customer ? "text-white/75" : "text-black/35"}`}>
                      {customer ? "You" : "HAMPORIUM Support"}
                    </p>
                    <span className={`text-[8px] ${customer ? "text-white/55" : "text-black/25"}`}>{formatDate(message.createdAt, true)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[12px] font-medium leading-6">{message.message}</p>
                </div>
              </div>
            );
          })}
          <div ref={threadEndRef} />
        </div>

        {!closed ? (
          <form onSubmit={submitReply} className="mt-7 border-t border-black/[0.07] pt-5">
            <label className="block">
              <span className="mb-2 block text-[9px] font-extrabold uppercase tracking-wider text-black/40">Reply</span>
              <textarea
                rows="5"
                maxLength={5000}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Write your reply..."
                className="w-full resize-none rounded-xl border border-black/10 px-4 py-3 text-sm leading-6 outline-none focus:border-[#F97316]"
              />
            </label>
            <button type="submit" disabled={sending || reply.trim().length < 2} className="mt-3 rounded-xl bg-[#171717] px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white transition hover:bg-[#F97316] disabled:opacity-40">
              {sending ? "Sending..." : "Send Reply"}
            </button>
          </form>
        ) : (
          <div className="mt-7 rounded-xl border border-black/[0.06] bg-[#FFF9F2] p-4 text-sm text-black/45">
            This support request is closed. Create a new request if you need more help.
          </div>
        )}
      </section>
    </div>
  );
};

export default SupportTicketDetails;
