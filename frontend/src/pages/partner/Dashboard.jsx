import { Link } from "react-router-dom";

import { usePartner } from "../../context/PartnerContext.jsx";
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

const PartnerDashboard = () => {
  const { dashboard, partnerLoading, partnerError, refreshDashboard } = usePartner();

  if (partnerLoading && !dashboard) {
    return <div className="rounded-2xl border bg-white p-8 text-sm text-black/40">Loading Partner Portal...</div>;
  }

  if (!dashboard) {
    return <Notice type="error">{partnerError || "Partner dashboard unavailable."}</Notice>;
  }

  const { partner, stats = {}, recentProjects = [], recentCommissions = [] } = dashboard;
  const referralUrl = partner?.referralCode
    ? `${window.location.origin}/?ref=${encodeURIComponent(partner.referralCode)}`
    : "";

  const copyReferral = async () => {
    if (referralUrl) await navigator.clipboard.writeText(referralUrl);
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Partner Dashboard"
        title={partner?.businessName || "Partner Workspace"}
        description={`Partner ID ${partner?.partnerId || "—"} · Manage client work, referral attribution and earnings.`}
        action={<button type="button" onClick={refreshDashboard} className="rounded-xl border border-black/10 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-wider hover:border-[#F97316]">Refresh</button>}
      />

      {partnerError && <Notice type="error">{partnerError}</Notice>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Projects" value={stats.projects?.active || 0} helper={`${stats.projects?.total || 0} total`} />
        <MetricCard label="Attributed Customers" value={stats.attributedCustomers || 0} />
        <MetricCard label="Attributed Orders" value={stats.attributedOrders || 0} />
        <MetricCard label="Payable Commission" value={formatMoney(stats.payableCommission || 0)} helper={`${formatMoney(stats.paidCommission || 0)} paid`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#F97316]">Recent Projects</p>
              <h2 className="mt-1 text-xl font-black">Client gifting work</h2>
            </div>
            <Link to="/partner/projects" className="text-xs font-black text-[#F97316]">View all →</Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentProjects.map((project) => (
              <Link key={project._id} to={`/partner/projects/${project._id}`} className="flex items-center justify-between gap-4 rounded-xl bg-[#FFF9F2] p-4 transition hover:-translate-y-0.5">
                <div>
                  <p className="font-black">{project.title}</p>
                  <p className="mt-1 text-[10px] text-black/40">{project.projectId} · {project.client?.name || "Client"}</p>
                </div>
                <StatusPill value={project.status} />
              </Link>
            ))}
            {!recentProjects.length && <EmptyState title="No projects yet" text="Create your first client gifting project when you are ready." />}
          </div>
        </Panel>

        <Panel className="bg-[#171717] text-white">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#D4AF37]">Your Referral Link</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">Persistent partner attribution</h2>
          <p className="mt-4 text-sm leading-6 text-white/45">A customer who validly claims your referral remains attributed for future eligible orders. They don’t need to enter the code every time.</p>
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[9px] uppercase tracking-wider text-white/30">Referral code</p>
            <p className="mt-1 text-lg font-black text-[#F97316]">{partner?.referralCode || "—"}</p>
            {referralUrl && <p className="mt-3 break-all text-[10px] leading-5 text-white/35">{referralUrl}</p>}
          </div>
          <button type="button" onClick={copyReferral} disabled={!referralUrl} className="mt-4 rounded-xl bg-[#F97316] px-5 py-3 text-xs font-black text-white disabled:opacity-40">Copy referral link</button>
        </Panel>
      </div>

      <Panel>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#F97316]">Commission Activity</p>
            <h2 className="mt-1 text-xl font-black">Latest earnings</h2>
          </div>
          <Link to="/partner/commissions" className="text-xs font-black text-[#F97316]">All commissions →</Link>
        </div>
        <div className="mt-5 divide-y divide-black/[0.06]">
          {recentCommissions.map((commission) => (
            <div key={commission._id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black">{commission.project?.title || commission.commissionId}</p>
                <p className="mt-1 text-[10px] text-black/35">Updated {formatPartnerDate(commission.updatedAt, true)}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill value={commission.status} />
                <p className="font-black text-[#F97316]">{formatMoney(commission.amount)}</p>
              </div>
            </div>
          ))}
          {!recentCommissions.length && <p className="py-7 text-sm text-black/40">No commission records yet.</p>}
        </div>
      </Panel>
    </div>
  );
};

export default PartnerDashboard;
