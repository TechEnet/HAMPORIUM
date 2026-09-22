import { useState } from "react";
import { Link } from "react-router-dom";

import { usePartner } from "../../context/PartnerContext.jsx";
import {
  EmptyState,
  Notice,
  StatusPill,
  formatMoney,
  formatPartnerDate,
} from "../../components/partner/PartnerUI.jsx";

const PartnerDashboard = () => {
  const {
    dashboard,
    partnerLoading,
    partnerError,
    refreshDashboard,
  } = usePartner();

  const [copied, setCopied] = useState(false);

  if (partnerLoading && !dashboard) {
    return (
      <div className="min-h-[320px] border-y border-black/[0.06] bg-[#FFFDF9] px-6 py-14 text-sm text-black/45">
        Loading partner dashboard...
      </div>
    );
  }

  if (!dashboard) {
    return (
      <Notice type="error">
        {partnerError || "Partner dashboard unavailable."}
      </Notice>
    );
  }

  const {
    partner,
    stats = {},
    recentProjects = [],
    recentCommissions = [],
  } = dashboard;

  const referralUrl =
    partner?.referralCode && typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${encodeURIComponent(partner.referralCode)}`
      : "";

  const copyReferral = async () => {
    if (!referralUrl) return;

    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const metrics = [
    {
      label: "Active projects",
      value: stats.projects?.active || 0,
      helper: `${stats.projects?.total || 0} total`,
    },
    {
      label: "Attributed customers",
      value: stats.attributedCustomers || 0,
      helper: "Customers linked to your work",
    },
    {
      label: "Attributed orders",
      value: stats.attributedOrders || 0,
      helper: "Orders carrying your attribution",
    },
    {
      label: "Payable commission",
      value: formatMoney(stats.payableCommission || 0),
      helper: `${formatMoney(stats.paidCommission || 0)} paid`,
      accent: true,
    },
  ];

  return (
    <div className="space-y-8">
      {partnerError && <Notice type="error">{partnerError}</Notice>}

      {/* =====================================================
          HERO / PARTNER SUMMARY
      ====================================================== */}
      <section className="relative overflow-hidden border-b border-black/[0.08] bg-[#FFFDF9] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[36%] lg:block"
          style={{
            background:
              "radial-gradient(circle at 70% 30%, rgba(212,175,55,.16), transparent 42%), linear-gradient(135deg, transparent, rgba(244,120,34,.055))",
          }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#B67824]">
                Partner workspace
              </span>

              {partner?.status && <StatusPill value={partner.status} />}
            </div>

            <h1 className="font-serif text-[38px] font-semibold leading-[0.98] tracking-[-0.025em] text-[#1E1B17] sm:text-[46px] lg:text-[58px]">
              {partner?.businessName || "Partner Workspace"}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-black/48">
              <span>
                Partner ID{" "}
                <strong className="font-semibold text-black/70">
                  {partner?.partnerId || "—"}
                </strong>
              </span>

              <span className="hidden h-1 w-1 rounded-full bg-black/20 sm:block" />

              <span>
                Track projects, referrals and earnings from one place.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/partner/projects"
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#1E1B17] bg-[#1E1B17] px-5 text-xs font-extrabold uppercase tracking-[0.08em] text-white transition hover:-translate-y-0.5 hover:bg-black"
            >
              View projects
              <ArrowIcon />
            </Link>

            <button
              type="button"
              onClick={refreshDashboard}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-black/10 bg-white px-5 text-xs font-extrabold uppercase tracking-[0.08em] text-[#332A20] transition hover:-translate-y-0.5 hover:border-[#C79824]/50 hover:bg-[#FFF8EC]"
            >
              <RefreshIcon />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================
          METRICS
      ====================================================== */}
      <section className="border-y border-black/[0.07] bg-white">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={[
                "relative px-6 py-6 sm:px-7",
                index > 0 ? "sm:border-l sm:border-black/[0.06]" : "",
                index > 1 ? "sm:border-t xl:border-t-0" : "",
                index === 1 ? "sm:border-t-0" : "",
              ].join(" ")}
            >
              {metric.accent && (
                <span
                  className="absolute left-0 top-0 h-full w-[3px] bg-[#F47822]"
                  aria-hidden="true"
                />
              )}

              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-black/38">
                {metric.label}
              </p>

              <p
                className={`mt-3 text-3xl font-semibold tracking-[-0.035em] ${
                  metric.accent ? "text-[#B55D17]" : "text-[#1E1B17]"
                }`}
              >
                {metric.value}
              </p>

              <p className="mt-2 text-xs leading-5 text-black/38">
                {metric.helper}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================
          PARTNER CODE + RECENT PROJECTS
      ====================================================== */}
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
        <section className="border-t border-black/[0.09] bg-white">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/[0.06] px-1 py-5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#B67824]">
                Recent projects
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.02em] text-[#1F1B17]">
                Client gifting work
              </h2>
            </div>

            <Link
              to="/partner/projects"
              className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#B55D17] transition hover:gap-3"
            >
              View all
              <ArrowIcon />
            </Link>
          </div>

          <div className="divide-y divide-black/[0.06]">
            {recentProjects.map((project) => (
              <Link
                key={project._id}
                to={`/partner/projects/${project._id}`}
                className="group grid gap-4 py-5 transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#D4AF37]" />

                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-extrabold text-[#241F19] transition group-hover:text-[#B55D17]">
                        {project.title}
                      </p>

                      <p className="mt-1.5 text-xs text-black/40">
                        {project.projectId || "Project"}
                        <span className="mx-2 text-black/20">•</span>
                        {project.client?.name || "Client"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <StatusPill value={project.status} />
                  <span className="text-[#A9823A] transition group-hover:translate-x-1">
                    <ArrowIcon />
                  </span>
                </div>
              </Link>
            ))}

            {!recentProjects.length && (
              <div className="py-5">
                <EmptyState
                  title="No projects yet"
                  text="Create your first client gifting project when you are ready."
                />
              </div>
            )}
          </div>
        </section>

        <section
          className="relative overflow-hidden border border-[#D7C5A3]/50 bg-[#181612] p-6 text-white sm:p-7"
          style={{
            boxShadow: "0 24px 55px -38px rgba(24,18,10,.65)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
            style={{ background: "#D4AF37" }}
            aria-hidden="true"
          />

          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#D9BD6C]">
                Your partner code
              </p>

              <span className="border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/45">
                Retail
              </span>
            </div>

            <h2 className="mt-5 max-w-[14ch] font-serif text-4xl font-semibold leading-[1.02] tracking-[-0.025em] text-[#FFF7E7]">
              Share your code.
              <span className="block text-[#D7B75E]">Earn when it is used.</span>
            </h2>

            <p className="mt-4 max-w-md text-[13px] leading-6 text-white/48">
              A normal retail commission is created only when your partner code
              is actually used on the paid order.
            </p>

            <div className="mt-7 border-y border-white/10 py-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">
                Partner code
              </p>

              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="break-all font-mono text-xl font-extrabold tracking-[0.06em] text-[#F47822]">
                  {partner?.referralCode || "—"}
                </p>

                {partner?.referralCode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!partner.referralCode) return;
                      void navigator.clipboard.writeText(partner.referralCode);
                    }}
                    className="shrink-0 border border-white/10 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white/65 transition hover:border-[#D4AF37]/50 hover:text-[#F1D884]"
                  >
                    Copy code
                  </button>
                )}
              </div>
            </div>

            {referralUrl && (
              <div className="mt-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">
                  Shareable link
                </p>

                <p className="mt-2 break-all text-[11px] leading-5 text-white/38">
                  {referralUrl}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={copyReferral}
              disabled={!referralUrl}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-[#F47822] px-5 text-xs font-extrabold uppercase tracking-[0.09em] text-white transition hover:-translate-y-0.5 hover:bg-[#E66A16] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? <CheckIcon /> : <LinkIcon />}
              {copied ? "Partner link copied" : "Copy partner link"}
            </button>

            <p className="mt-3 text-center text-[10px] leading-5 text-white/30">
              If the customer removes your code before payment, that retail
              order will not earn automatic commission.
            </p>
          </div>
        </section>
      </div>

      {/* =====================================================
          COMMISSION ACTIVITY
      ====================================================== */}
      <section className="border-t border-black/[0.09] bg-white">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/[0.06] py-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#B67824]">
              Commission activity
            </p>

            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.02em] text-[#1F1B17]">
              Latest earnings
            </h2>
          </div>

          <Link
            to="/partner/commissions"
            className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#B55D17] transition hover:gap-3"
          >
            All commissions
            <ArrowIcon />
          </Link>
        </div>

        {recentCommissions.length ? (
          <div className="divide-y divide-black/[0.06]">
            {recentCommissions.map((commission) => (
              <div
                key={commission._id}
                className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-extrabold text-[#241F19]">
                    {commission.project?.title ||
                      commission.commissionId ||
                      "Commission"}
                  </p>

                  <p className="mt-1.5 text-xs text-black/38">
                    Updated {formatPartnerDate(commission.updatedAt, true)}
                  </p>
                </div>

                <div className="sm:px-5">
                  <StatusPill value={commission.status} />
                </div>

                <p className="text-left text-lg font-extrabold tracking-[-0.02em] text-[#B55D17] sm:min-w-[120px] sm:text-right">
                  {formatMoney(commission.amount)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-sm text-black/40">
            No commission records yet.
          </div>
        )}
      </section>
    </div>
  );
};

const IconBase = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-4 w-4"
  >
    {children}
  </svg>
);

const ArrowIcon = () => (
  <IconBase>
    <path d="M5 12h14M14 7l5 5-5 5" />
  </IconBase>
);

const RefreshIcon = () => (
  <IconBase>
    <path d="M20 6v5h-5" />
    <path d="M4 18v-5h5" />
    <path d="M18.2 9A7 7 0 0 0 6.4 5.8L4 8" />
    <path d="M5.8 15A7 7 0 0 0 17.6 18.2L20 16" />
  </IconBase>
);

const LinkIcon = () => (
  <IconBase>
    <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
  </IconBase>
);

const CheckIcon = () => (
  <IconBase>
    <path d="m5 12 4 4L19 6" />
  </IconBase>
);

export default PartnerDashboard;
