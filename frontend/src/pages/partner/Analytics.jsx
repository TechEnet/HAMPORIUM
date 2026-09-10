import { useEffect, useMemo, useState } from "react";

import api from "../../api/api.js";
import {
  MetricCard,
  Notice,
  PageHeader,
  Panel,
  StatusPill,
  formatMoney,
} from "../../components/partner/PartnerUI.jsx";

const Analytics = () => {
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/partners/analytics", { params: { days } });
        setAnalytics(response.data.analytics || null);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load partner analytics");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [days]);

  const commissionRows = useMemo(
    () => Object.entries(analytics?.commissionByStatus || {}),
    [analytics]
  );
  const payoutRows = useMemo(
    () => Object.entries(analytics?.payoutByStatus || {}),
    [analytics]
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        description="Partner-attributed customers, projects, showcases, orders, revenue, commissions and payouts for the selected period."
        action={
          <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="h-11 rounded-xl border border-black/10 bg-white px-4 text-xs font-bold">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
        }
      />

      {error && <Notice type="error">{error}</Notice>}

      {loading ? (
        <Panel>Loading analytics...</Panel>
      ) : analytics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Attributed customers" value={analytics.attributedCustomers || 0} />
            <MetricCard label="Orders" value={analytics.orders || 0} />
            <MetricCard label="Revenue" value={formatMoney(analytics.revenue)} />
            <MetricCard label="Referral conversion" value={`${Number(analytics.conversion || 0).toFixed(2)}%`} />
            <MetricCard label="Projects created" value={analytics.projects || 0} />
            <MetricCard label="Showcases created" value={analytics.showcases || 0} />
            <MetricCard label="Commission basis" value={formatMoney(analytics.eligibleValue)} />
            <MetricCard label="Period" value={`${analytics.period?.days || days} days`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#F97316]">Commission Mix</p>
              <h2 className="mt-1 text-xl font-black">By status</h2>
              <div className="mt-5 space-y-3">
                {commissionRows.map(([status, row]) => (
                  <div key={status} className="flex items-center justify-between gap-4 rounded-xl bg-[#FFF9F2] p-4">
                    <div><StatusPill value={status} /><p className="mt-2 text-[10px] text-black/35">{row.count} record(s)</p></div>
                    <p className="font-black text-[#F97316]">{formatMoney(row.amount)}</p>
                  </div>
                ))}
                {!commissionRows.length && <p className="text-sm text-black/40">No commission activity in this period.</p>}
              </div>
            </Panel>

            <Panel>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#F97316]">Payout Mix</p>
              <h2 className="mt-1 text-xl font-black">By status</h2>
              <div className="mt-5 space-y-3">
                {payoutRows.map(([status, row]) => (
                  <div key={status} className="flex items-center justify-between gap-4 rounded-xl bg-[#FFF9F2] p-4">
                    <div><StatusPill value={status} /><p className="mt-2 text-[10px] text-black/35">{row.count} payout(s)</p></div>
                    <p className="font-black text-[#F97316]">{formatMoney(row.amount)}</p>
                  </div>
                ))}
                {!payoutRows.length && <p className="text-sm text-black/40">No payout activity in this period.</p>}
              </div>
            </Panel>
          </div>
        </>
      ) : (
        <Notice>No analytics available.</Notice>
      )}
    </div>
  ); 
};

export default Analytics;
