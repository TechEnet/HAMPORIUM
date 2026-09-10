import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";

const Refunds = () => {
  const [refunds, setRefunds] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRefunds = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });
        if (status) params.set("status", status);

        const response = await api.get(`/refunds/mine?${params.toString()}`);
        setRefunds(response.data.refunds || []);
        setPagination(response.data.pagination || null);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || "Unable to load refunds"
        );
      } finally {
        setLoading(false);
      }
    };

    loadRefunds();
  }, [page, status]);

  return (
    <div className="mx-auto w-full max-w-[1200px] pb-12 text-[#171717]">
      <header className="border-b border-black/[0.07] pb-7">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
          Payments
        </p>
        <h1 className="mt-2 font-serif text-[42px] font-semibold leading-none">
          Refunds
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/45">
          Track full and partial refunds back to the original payment method.
        </p>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="h-11 rounded-xl border border-black/10 bg-white px-4 text-sm"
        >
          <option value="">All refund statuses</option>
          <option value="created">Created</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
        {loading ? (
          <p className="p-10 text-center text-sm text-black/40">Loading refunds...</p>
        ) : !refunds.length ? (
          <div className="p-10 text-center">
            <p className="font-bold">No refunds found.</p>
            <p className="mt-2 text-sm text-black/40">
              Approved cancellations and manual refunds will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {refunds.map((refund) => (
              <article key={refund._id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={refund.status} />
                      <StatusBadge status={refund.type} />
                    </div>

                    <p className="mt-3 text-sm font-black">
                      {refund.order?.orderNumber || "Order refund"}
                    </p>
                    <p className="mt-1 text-xs text-black/40">
                      Requested {formatDate(refund.createdAt, true)}
                    </p>

                    {refund.reason && (
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
                        {refund.reason}
                      </p>
                    )}

                    {refund.razorpayRefundId && (
                      <p className="mt-3 break-all text-[10px] text-black/35">
                        Razorpay refund: {refund.razorpayRefundId}
                      </p>
                    )}

                    {refund.errorDescription && (
                      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                        {refund.errorDescription}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">
                      Refund amount
                    </p>
                    <p className="mt-1 text-xl font-black text-[#F97316]">
                      {formatCurrency(refund.amount)}
                    </p>
                    {refund.order?._id && (
                      <Link
                        to={`/account/orders/${refund.order._id}`}
                        className="mt-3 inline-block text-xs font-bold text-[#F97316]"
                      >
                        View order →
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {pagination && pagination.pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-xl border px-4 py-2 text-xs disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-black/40">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            disabled={page >= pagination.pages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-xl border px-4 py-2 text-xs disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Refunds;
