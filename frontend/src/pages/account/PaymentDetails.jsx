import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../api/api.js";
import OrderTaxSummary from "../../components/OrderTaxSummary.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";

const PaymentDetails = () => {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPayment = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(`/payments/my-payments/${paymentId}`);
        setPayment(response.data.payment);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || "Unable to load payment"
        );
      } finally {
        setLoading(false);
      }
    };

    loadPayment();
  }, [paymentId]);

  if (loading) return <div>Loading payment...</div>;

  if (!payment) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-red-700">
        {error || "Payment not found"}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] pb-12 text-[#171717]">
      <Link to="/account/payments" className="text-xs font-bold text-[#F97316]">
        ← Back to Payments
      </Link>

      <section className="mt-5 rounded-2xl bg-[#171717] p-6 text-white sm:p-8">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#D4AF37]">
          Payment Transaction
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[42px] font-semibold leading-none">
              Payment Details
            </h1>
            <p className="mt-3 text-xs text-white/40">
              {formatDate(payment.createdAt, true)}
            </p>
          </div>
          <StatusBadge status={payment.status} />
        </div>
      </section>

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/[0.07] bg-white p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Info label="Amount" value={formatCurrency(payment.amount)} />
            <Info label="Refunded" value={formatCurrency(payment.refundedAmount || 0)} />
            <Info label="Method" value={payment.method || "—"} />
            <Info label="Provider" value={payment.provider || "—"} />
            <Info label="Razorpay Payment ID" value={payment.razorpayPaymentId || "—"} />
            <Info label="Razorpay Order ID" value={payment.razorpayOrderId || "—"} />
            <Info label="Paid At" value={payment.paidAt ? formatDate(payment.paidAt, true) : "—"} />
            <Info label="Last Refund" value={payment.lastRefundAt ? formatDate(payment.lastRefundAt, true) : "—"} />
          </div>

          {payment.errorDescription && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {payment.errorDescription}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {payment.order?._id && (
              <Link
                to={`/account/orders/${payment.order._id}`}
                className="rounded-xl bg-[#171717] px-4 py-3 text-xs font-bold text-white hover:bg-[#F97316]"
              >
                View Order
              </Link>
            )}
            <Link
              to="/account/refunds"
              className="rounded-xl border border-black/10 px-4 py-3 text-xs font-bold hover:border-[#F97316] hover:text-[#F97316]"
            >
              Refunds
            </Link>
          </div>
        </section>

        {payment.order ? (
          <OrderTaxSummary order={payment.order} />
        ) : (
          <div className="rounded-2xl border border-black/[0.07] bg-white p-6 text-sm text-black/40">
            Order tax snapshot unavailable.
          </div>
        )}
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div>
    <p className="text-[9px] font-extrabold uppercase tracking-wider text-black/35">{label}</p>
    <p className="mt-1 break-all text-sm font-black capitalize">{value}</p>
  </div>
);

export default PaymentDetails;
