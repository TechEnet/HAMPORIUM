import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";

const Refunds = () => {
  const [cancellations, setCancellations] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [reviewNotes, setReviewNotes] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [cancellationResponse, refundResponse] = await Promise.all([
        api.get("/refunds/admin/cancellations?status=requested&limit=100"),
        api.get("/refunds/admin?limit=100"),
      ]);

      setCancellations(cancellationResponse.data.orders || []);
      setRefunds(refundResponse.data.refunds || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load cancellation/refund operations"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const reviewCancellation = async (order, decision) => {
    if (!order?._id) return;

    const approved = window.confirm(
      decision === "approve"
        ? `Approve cancellation for ${order.orderNumber}? This can start a full refund.`
        : `Reject cancellation for ${order.orderNumber}?`
    );

    if (!approved) return;

    setWorkingId(order._id);
    setError("");
    setNotice("");

    try {
      const response = await api.patch(
        `/refunds/admin/cancellations/${order._id}/review`,
        {
          decision,
          note: String(reviewNotes[order._id] || "").trim(),
        }
      );

      setNotice(response.data.message || "Cancellation reviewed.");
      setReviewNotes((current) => ({ ...current, [order._id]: "" }));
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to review cancellation"
      );
    } finally {
      setWorkingId("");
    }
  };

  const stats = useMemo(
    () => ({
      requested: cancellations.length,
      processing: refunds.filter((item) =>
        ["created", "processing"].includes(item.status)
      ).length,
      completed: refunds.filter((item) => item.status === "completed").length,
      failed: refunds.filter((item) => item.status === "failed").length,
    }),
    [cancellations, refunds]
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-12 text-[#171717]">
      <header className="flex flex-col gap-4 rounded-[24px] bg-[#171717] p-6 text-white sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#D4AF37]">
            Commerce Operations
          </p>
          <h1 className="mt-2 font-serif text-[42px] font-semibold leading-none">
            Cancellations & Refunds
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">
            Review pre-dispatch cancellation requests and monitor Razorpay refund records.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="rounded-xl border border-white/15 px-5 py-3 text-xs font-bold transition hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-40"
        >
          Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Cancellation Requests" value={stats.requested} />
        <Stat label="Refund Processing" value={stats.processing} />
        <Stat label="Refund Completed" value={stats.completed} />
        <Stat label="Refund Failed" value={stats.failed} />
      </div>

      <section className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white">
        <div className="border-b border-black/[0.06] px-5 py-5 sm:px-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">
            Review Queue
          </p>
          <h2 className="mt-1 text-lg font-black">Cancellation requests</h2>
          <p className="mt-1 text-xs text-black/40">
            Approval is blocked by the backend after dispatch. Approved paid orders start the refund workflow automatically.
          </p>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-black/40">Loading requests...</p>
        ) : !cancellations.length ? (
          <p className="p-8 text-center text-sm text-black/40">No pending cancellation requests.</p>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {cancellations.map((order) => (
              <article key={order._id} className="p-5 sm:p-6">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={order.cancellation?.status} />
                      <StatusBadge status={order.paymentStatus} />
                    </div>

                    <Link
                      to={`/admin/orders/${order._id}`}
                      className="mt-3 inline-block text-base font-black transition hover:text-[#F97316]"
                    >
                      {order.orderNumber}
                    </Link>

                    <p className="mt-1 text-xs text-black/40">
                      {order.user?.name || order.user?.email || "Customer"} · {formatCurrency(order.totalAmount)}
                    </p>

                    <div className="mt-4 rounded-xl bg-[#FFF9F2] p-4">
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">
                        Customer reason
                      </p>
                      <p className="mt-2 text-sm leading-6 text-black/65">
                        {order.cancellation?.reason || "—"}
                      </p>
                      <p className="mt-2 text-[10px] text-black/30">
                        Requested {formatDate(order.cancellation?.requestedAt, true)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows="4"
                      value={reviewNotes[order._id] || ""}
                      onChange={(event) =>
                        setReviewNotes((current) => ({
                          ...current,
                          [order._id]: event.target.value,
                        }))
                      }
                      placeholder="Optional review note visible in the cancellation outcome"
                      className="w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-[#F97316]"
                    />

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={workingId === order._id}
                        onClick={() => reviewCancellation(order, "reject")}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-40"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={workingId === order._id}
                        onClick={() => reviewCancellation(order, "approve")}
                        className="rounded-xl bg-[#F97316] px-4 py-3 text-xs font-extrabold text-white transition hover:bg-[#171717] disabled:opacity-40"
                      >
                        {workingId === order._id ? "Working..." : "Approve + Refund"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white">
        <div className="border-b border-black/[0.06] px-5 py-5 sm:px-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">
            Finance Ledger
          </p>
          <h2 className="mt-1 text-lg font-black">Refund records</h2>
        </div>

        {!refunds.length ? (
          <p className="p-8 text-center text-sm text-black/40">No refund records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left">
              <thead className="bg-[#171717] text-[9px] uppercase tracking-wider text-white/55">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Gateway ID</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {refunds.map((refund) => (
                  <tr key={refund._id}>
                    <td className="px-5 py-4">
                      {refund.order?._id ? (
                        <Link
                          to={`/admin/orders/${refund.order._id}`}
                          className="text-xs font-black hover:text-[#F97316]"
                        >
                          {refund.order.orderNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-black/50">
                      {refund.user?.name || refund.user?.email || "—"}
                    </td>
                    <td className="px-5 py-4 text-xs font-black">
                      {formatCurrency(refund.amount)}
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={refund.type} /></td>
                    <td className="px-5 py-4"><StatusBadge status={refund.status} /></td>
                    <td className="max-w-[220px] truncate px-5 py-4 text-[10px] text-black/35">
                      {refund.razorpayRefundId || "—"}
                    </td>
                    <td className="px-5 py-4 text-[10px] text-black/35">
                      {formatDate(refund.createdAt, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
    <p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">{label}</p>
    <p className="mt-2 text-2xl font-black">{value}</p>
  </div>
);

export default Refunds;
