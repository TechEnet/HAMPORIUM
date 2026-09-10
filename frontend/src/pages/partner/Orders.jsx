import { useEffect, useState } from "react";

import api from "../../api/api.js";
import {
  EmptyState,
  Notice,
  PageHeader,
  Panel,
  StatusPill,
  formatMoney,
  formatPartnerDate,
} from "../../components/partner/PartnerUI.jsx";

const PartnerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/partners/orders", {
          params: { page, limit: 20, ...(status ? { status } : {}) },
        });
        setOrders(response.data.orders || []);
        setPagination(response.data.pagination || null);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load attributed orders");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [page, status]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Attribution"
        title="Attributed Orders"
        description="Privacy-safe order visibility for customers attributed to your partner relationship. Customer payment credentials and unnecessary private details are never exposed here."
        action={
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-black/10 bg-white px-4 text-xs font-bold">
            <option value="">All statuses</option>
            {["confirmed", "preparing", "packed", "dispatched", "delivered", "cancelled"].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        }
      />

      {error && <Notice type="error">{error}</Notice>}

      {loading ? (
        <Panel>Loading attributed orders...</Panel>
      ) : !orders.length ? (
        <EmptyState title="No attributed orders yet" text="Eligible paid orders will appear after a customer is persistently linked to your partner referral." />
      ) : (
        <Panel className="overflow-hidden p-0">
          <div className="divide-y divide-black/[0.06]">
            {orders.map((order) => (
              <article key={order._id} className="p-5 sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1.1fr_.8fr_.8fr_.9fr] lg:items-center">
                  <div>
                    <p className="font-black">{order.orderNumber}</p>
                    <p className="mt-1 text-[10px] text-black/35">{formatPartnerDate(order.createdAt, true)}</p>
                    <div className="mt-3 flex flex-wrap gap-2"><StatusPill value={order.status} /><StatusPill value={order.paymentStatus} /></div>
                  </div>
                  <Data label="Order total" value={formatMoney(order.totalAmount, order.currency)} />
                  <Data label="Eligible value" value={formatMoney(order.taxableAmount ?? order.subtotal, order.currency)} />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-black/35">Commission</p>
                    {order.commission ? <><p className="mt-1 font-black text-[#F97316]">{formatMoney(order.commission.amount)}</p><div className="mt-2"><StatusPill value={order.commission.status} /></div></> : <p className="mt-1 text-xs text-black/40">Pending</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-bold disabled:opacity-30">Previous</button>
          <span className="text-xs text-black/40">Page {pagination.page} of {pagination.pages}</span>
          <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-bold disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
};

const Data = ({ label, value }) => <div><p className="text-[9px] font-black uppercase tracking-wider text-black/35">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;

export default PartnerOrders;
