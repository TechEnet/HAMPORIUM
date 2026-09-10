import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPayments = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "10",
        });
        if (status) params.set("status", status);

        const response = await api.get(
          `/payments/my-payments?${params.toString()}`
        );

        setPayments(response.data.payments || []);
        setPagination(response.data.pagination || null);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || "Unable to load payments"
        );
      } finally {
        setLoading(false);
      }
    };

    loadPayments();
  }, [page, status]);

  return (
    <div className="mx-auto w-full max-w-[1200px] pb-12 text-[#171717]">
      <header className="flex flex-col gap-4 border-b border-black/[0.07] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
            Finance
          </p>
          <h1 className="mt-2 font-serif text-[42px] font-semibold leading-none">
            Payments
          </h1>
          <p className="mt-3 text-sm text-black/45">
            Payment attempts, captured amounts and refund progress.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/account/refunds"
            className="rounded-xl border border-black/10 px-4 py-2.5 text-xs font-bold transition hover:border-[#F97316] hover:text-[#F97316]"
          >
            Refunds
          </Link>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-xs"
          >
            <option value="">All statuses</option>
            <option value="created">Created</option>
            <option value="authorized">Authorized</option>
            <option value="captured">Captured</option>
            <option value="failed">Failed</option>
            <option value="partially_refunded">Partially refunded</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
        {loading ? (
          <p className="p-8 text-sm text-black/40">Loading payments...</p>
        ) : !payments.length ? (
          <p className="p-8 text-center text-sm text-black/40">No payments found.</p>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {payments.map((payment) => (
              <article key={payment._id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black">
                      {payment.order?.orderNumber || payment.receipt || "Payment"}
                    </p>
                    <p className="mt-1 text-xs text-black/40">
                      {formatDate(payment.createdAt, true)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge status={payment.status} />
                      {payment.method && <StatusBadge status={payment.method} />}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:items-end">
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-black">{formatCurrency(payment.amount)}</p>
                      {Number(payment.refundedAmount || 0) > 0 && (
                        <p className="mt-1 text-xs font-bold text-[#F97316]">
                          Refunded {formatCurrency(payment.refundedAmount)}
                        </p>
                      )}
                    </div>
                    <Link
                      to={`/account/payments/${payment._id}`}
                      className="text-xs font-bold text-[#F97316]"
                    >
                      Details →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            disabled={!pagination.hasPreviousPage}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-xl border px-4 py-2 text-xs disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-black/40">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={!pagination.hasNextPage}
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

export default Payments;
