import { useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { Notice, Panel, StatusPill, formatPartnerDate } from "../../components/partner/PartnerUI.jsx";

const copy = {
  applied: {
    title: "Application received.",
    text: "Your partner profile is waiting for HAMPORIUM review.",
  },
  under_review: {
    title: "Your application is under review.",
    text: "The HAMPORIUM team is reviewing your business, capabilities and commercial details.",
  },
  rejected: {
    title: "Application needs attention.",
    text: "Review the note below. You can keep your profile details current while discussing next steps with HAMPORIUM.",
  },
  suspended: {
    title: "Partner access is suspended.",
    text: "Project, referral and commission tools are temporarily unavailable.",
  },
};

const ApplicationStatus = () => {
  const { partner, refreshPartner } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  if (partner?.status === "approved") return <Navigate to="/partner" replace />;

  const content = copy[partner?.status] || copy.applied;

  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      await refreshPartner();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to refresh status");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl py-6">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F97316]">Partner Application</p>
      <h1 className="mt-3 font-serif text-[48px] font-semibold leading-[0.96] tracking-[-0.035em] sm:text-[62px]">{content.title}</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-black/50">{content.text}</p>

      {error && <div className="mt-5"><Notice type="error">{error}</Notice></div>}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-black/35">Current status</p>
              <div className="mt-2"><StatusPill value={partner?.status} /></div>
            </div>
            <button type="button" onClick={refresh} disabled={refreshing} className="rounded-xl bg-[#171717] px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-[#F97316] disabled:opacity-40">
              {refreshing ? "Refreshing..." : "Refresh status"}
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Info label="Partner ID" value={partner?.partnerId} />
            <Info label="Business" value={partner?.businessName} />
            <Info label="Submitted" value={formatPartnerDate(partner?.application?.submittedAt, true)} />
            <Info label="Verification" value={partner?.verification?.status || "pending"} />
          </div>

          {partner?.review?.note && (
            <div className="mt-6 rounded-xl border border-[#D4AF37]/30 bg-[#FFF9F2] p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-[#8B6B17]">HAMPORIUM review note</p>
              <p className="mt-2 text-sm leading-6 text-black/60">{partner.review.note}</p>
            </div>
          )}
        </Panel>

        <Panel className="bg-[#171717] text-white">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#D4AF37]">While you wait</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">Keep your partner profile accurate.</h2>
          <p className="mt-4 text-sm leading-6 text-white/45">You can update business details and documents. Projects, referrals and commissions unlock only after approval.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/partner/profile" className="inline-flex rounded-xl bg-[#F97316] px-5 py-3 text-xs font-black text-white">Review profile →</Link>
            <Link to="/partner/documents" className="inline-flex rounded-xl border border-white/15 px-5 py-3 text-xs font-black text-white">Upload documents →</Link>
          </div>
        </Panel>
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="rounded-xl bg-[#F8F6F2] p-4">
    <p className="text-[9px] font-black uppercase tracking-wider text-black/35">{label}</p>
    <p className="mt-1 text-sm font-black capitalize">{String(value || "—").replaceAll("_", " ")}</p>
  </div>
);

export default ApplicationStatus;
