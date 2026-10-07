import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePartner } from "../../context/PartnerContext.jsx";
import { Notice, StatusPill, formatMoney, formatPartnerDate } from "../../components/partner/PartnerUI.jsx";

const PartnerDashboard = () => {
  const { dashboard, partnerLoading, partnerError, refreshDashboard } = usePartner();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (partnerLoading && !dashboard) return <p className="py-14 text-sm text-black/45">Loading workspace...</p>;
  if (!dashboard) return <Notice type="error">{partnerError || "Partner dashboard unavailable."}</Notice>;

  const { partner, stats = {}, recentProjects = [], recentCommissions = [] } = dashboard;
  const referralUrl = useMemo(() => {
    if (!partner?.referralCode || typeof window === "undefined") return "";
    return `${window.location.origin}/?ref=${encodeURIComponent(partner.referralCode)}`;
  }, [partner?.referralCode]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await Promise.resolve(refreshDashboard()); } finally { setRefreshing(false); }
  };

  const copyReferral = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setCopied(false); }
  };

  const actions = [
    ["01", "Client project", "Create a gifting brief", "/partner/projects"],
    ["02", "Referral earnings", "Track orders & commission", "/partner/orders"],
    ["03", "Supply workspace", "Catalogue, quotes & POs", "/partner/supply"],
  ];

  const metrics = [
    ["Active projects", stats.projects?.active || 0, "/partner/projects"],
    ["Attributed orders", stats.attributedOrders || 0, "/partner/orders"],
    ["Payable", formatMoney(stats.payableCommission || 0), "/partner/commissions"],
    ["Paid", formatMoney(stats.paidCommission || 0), "/partner/payouts"],
  ];

  return (
    <div className="min-w-0 space-y-9 text-[#1C1916]">
      {partnerError && <Notice type="error">{partnerError}</Notice>}

      <header className="border-b border-black/[0.08] pb-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold text-[#A76322]">Partner home</span>
              {partner?.status && <StatusPill value={partner.status} />}
            </div>
            <h1 className="mt-2 break-words font-serif text-[34px] font-semibold leading-tight tracking-[-0.025em] sm:text-[42px]">
              Welcome, {partner?.businessName || "Partner"}
            </h1>
          </div>
          <button onClick={refresh} disabled={refreshing} className="w-fit text-sm font-semibold text-black/45 transition hover:text-[#F97316] disabled:opacity-40">
            {refreshing ? "Refreshing..." : "Refresh ↻"}
          </button>
        </div>
      </header>

      <section className="grid border-y border-black/[0.08] sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, to], index) => (
          <Link key={label} to={to} className={`group py-5 sm:px-5 ${index ? "border-t border-black/[0.08] sm:border-l sm:border-t-0" : ""}`}>
            <p className="text-sm text-black/45">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] group-hover:text-[#B55D17]">{value}</p>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold">Start here</h2>
          <span className="text-sm text-black/35">Choose what you want to do</span>
        </div>
        <div className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
          {actions.map(([no, title, text, to]) => (
            <Link key={no} to={to} className="group grid gap-2 py-4 transition hover:bg-white/55 sm:grid-cols-[42px_minmax(0,1fr)_auto] sm:items-center sm:px-2">
              <span className="font-serif text-xl text-[#C79A37]">{no}</span>
              <div className="min-w-0 sm:flex sm:items-baseline sm:gap-3">
                <p className="text-[15px] font-semibold group-hover:text-[#B55D17]">{title}</p>
                <p className="text-sm text-black/40">{text}</p>
              </div>
              <span className="text-sm font-semibold text-[#F97316]">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <div>
          <div className="flex items-center justify-between border-b border-black/[0.08] pb-3">
            <h2 className="text-lg font-semibold">Recent projects</h2>
            <Link to="/partner/projects" className="text-sm font-semibold text-[#A85B1C]">View all</Link>
          </div>
          {recentProjects.length ? (
            <div className="divide-y divide-black/[0.07]">
              {recentProjects.slice(0, 4).map((project) => (
                <Link key={project._id} to={`/partner/projects/${project._id}`} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{project.title || "Untitled project"}</p>
                    <p className="mt-1 text-sm text-black/38">{project.client?.name || project.projectId || "Client project"}</p>
                  </div>
                  <StatusPill value={project.status} />
                </Link>
              ))}
            </div>
          ) : <Empty text="No projects yet." to="/partner/projects" action="Create project" />}
        </div>

        <div>
          <div className="flex items-center justify-between border-b border-black/[0.08] pb-3">
            <h2 className="text-lg font-semibold">Recent earnings</h2>
            <Link to="/partner/commissions" className="text-sm font-semibold text-[#A85B1C]">View all</Link>
          </div>
          {recentCommissions.length ? (
            <div className="divide-y divide-black/[0.07]">
              {recentCommissions.slice(0, 4).map((item) => (
                <Link key={item._id} to="/partner/commissions" className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{item.project?.title || item.commissionId || "Commission"}</p>
                    <p className="mt-1 text-sm text-black/38">{formatPartnerDate(item.updatedAt, true)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-[#B55D17]">{formatMoney(item.amount)}</p>
                    <div className="mt-1"><StatusPill value={item.status} /></div>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="py-6 text-sm text-black/40">No commission activity yet.</p>}
        </div>
      </section>

      <section className="flex flex-col gap-4 border-y border-black/[0.08] bg-[#171512] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="text-sm text-white/45">Referral code</p>
          <p className="mt-1 break-all font-mono text-lg font-semibold text-[#F4B45E]">{partner?.referralCode || "—"}</p>
        </div>
        <button onClick={copyReferral} disabled={!referralUrl} className="w-fit bg-[#F97316] px-4 py-2.5 text-sm font-semibold disabled:opacity-40">
          {copied ? "Link copied ✓" : "Copy referral link"}
        </button>
      </section>
    </div>
  );
};

const Empty = ({ text, to, action }) => (
  <div className="flex items-center justify-between gap-4 py-6 text-sm text-black/40">
    <span>{text}</span>
    <Link to={to} className="font-semibold text-[#A85B1C]">{action} →</Link>
  </div>
);

export default PartnerDashboard;
