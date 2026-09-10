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

const Payouts = () => {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get("/payouts/mine");
        setPayouts(response.data.payouts || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load payouts");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const summary = useMemo(() => ({
    paid: payouts.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.netAmount || 0), 0),
    pending: payouts.filter((item) => ["pending", "processing", "held"].includes(item.status)).reduce((sum, item) => sum + Number(item.netAmount || 0), 0),
  }), [payouts]);

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Settlements" title="Payouts" description="Read-only payout history. HAMPORIUM Admin / Operations creates and processes payout batches from payable commissions." />
      {error && <Notice type="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Payout records" value={payouts.length} />
        <MetricCard label="In process / held" value={formatMoney(summary.pending)} />
        <MetricCard label="Paid" value={formatMoney(summary.paid)} />
      </div>

      {loading ? <Panel>Loading payouts...</Panel> : !payouts.length ? <EmptyState title="No payouts yet" text="Once commissions become payable and are batched by HAMPORIUM, settlement records will appear here." /> : (
        <div className="space-y-4">
          {payouts.map((payout) => (
            <Panel key={payout._id}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><StatusPill value={payout.status} /><span className="text-[10px] font-black text-[#D4AF37]">{payout.payoutId}</span></div>
                  <h2 className="mt-3 text-xl font-black">{formatMoney(payout.netAmount, payout.currency)}</h2>
                  <p className="mt-1 text-xs text-black/40">Gross {formatMoney(payout.grossAmount)} · Adjustment {formatMoney(payout.adjustmentAmount)} · {payout.commissions?.length || 0} commission(s)</p>
                  <p className="mt-2 text-[10px] text-black/35">Created {formatPartnerDate(payout.createdAt, true)}{payout.paidAt ? ` · Paid ${formatPartnerDate(payout.paidAt, true)}` : ""}</p>
                </div>
                <div className="lg:text-right">
                  <p className="text-[9px] font-black uppercase tracking-wider text-black/35">Reference</p>
                  <p className="mt-1 text-sm font-black">{payout.reference || "—"}</p>
                  <p className="mt-3 text-[9px] font-black uppercase tracking-wider text-black/35">Method</p>
                  <p className="mt-1 text-xs font-bold capitalize">{String(payout.paymentMethod || "bank_transfer").replaceAll("_", " ")}</p>
                </div>
              </div>
              {payout.note && <p className="mt-4 rounded-xl bg-[#FFF9F2] p-4 text-xs leading-5 text-black/55">{payout.note}</p>}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
};

export default Payouts;
