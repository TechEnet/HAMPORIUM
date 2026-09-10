import { useEffect, useMemo, useState } from "react";

import api from "../../api/api.js";
import {
  EmptyState,
  MetricCard,
  Notice,
  PageHeader,
  Panel,
  StatusPill,
  formatMoney,
  formatPartnerDate,
} from "../../components/partner/PartnerUI.jsx";

const Commissions = () => {
  const [commissions, setCommissions] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await api.get("/commissions/mine", {
          params: status ? { status } : {},
        });
        setCommissions(response.data.commissions || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load commissions");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [status]);

  const summary = useMemo(() => {
    const amount = (wanted) => commissions.filter((item) => item.status === wanted).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      total: commissions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      payable: amount("payable"),
      paid: amount("paid"),
    };
  }, [commissions]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Earnings"
        title="Commissions"
        description="Track automatic order attribution, eligibility, payable amounts, completed payouts and refund reversals."
        action={<select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-black/10 bg-white px-4 text-xs font-bold"><option value="">All statuses</option>{["potential", "attributed", "order_confirmed", "eligible", "payable", "paid", "reversed"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>}
      />

      {error && <Notice type="error">{error}</Notice>}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Loaded commission" value={formatMoney(summary.total)} />
        <MetricCard label="Payable" value={formatMoney(summary.payable)} />
        <MetricCard label="Paid" value={formatMoney(summary.paid)} />
      </div>

      {loading ? (
        <Panel>Loading commissions...</Panel>
      ) : !commissions.length ? (
        <EmptyState title="No commission records" text="Commission records appear when eligible partner-attributed orders are created or manually attributed by internal staff." />
      ) : (
        <Panel className="p-0">
          <div className="divide-y divide-black/[0.06]">
            {commissions.map((commission) => (
              <article key={commission._id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#D4AF37]">{commission.commissionId}</p>
                    <h2 className="mt-2 font-black">{commission.project?.title || "Partner commission"}</h2>
                    <p className="mt-1 text-xs text-black/40">Eligible value {formatMoney(commission.eligibleValue)} · {formatPartnerDate(commission.createdAt, true)}</p>
                    {commission.order?.orderNumber && <p className="mt-1 text-[10px] text-black/35">Order {commission.order.orderNumber}</p>}
                    <div className="mt-3 flex flex-wrap gap-2"><StatusPill value={commission.status} /><StatusPill value={commission.payoutStatus} /></div>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-2xl font-black text-[#F97316]">{formatMoney(commission.amount)}</p>
                    {commission.reversal?.reason && <p className="mt-2 max-w-sm text-xs leading-5 text-red-600">{commission.reversal.reason}</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
};

export default Commissions;
