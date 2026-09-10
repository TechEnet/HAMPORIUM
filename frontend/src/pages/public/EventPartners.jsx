import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";

const EventPartners = () => {
  const { user, partner } = useAuth();

  const isPartner = user?.roles?.includes("partner");
  const partnerPath = partner?.status === "approved" ? "/partner" : "/partner/status";

  return (
    <main className="min-h-screen bg-[#FFF9F2]">
      <section className="bg-[#171717] px-6 py-24 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
            HAMPORIUM Partners
          </p>

          <h1 className="mt-4 max-w-4xl font-serif text-5xl font-semibold leading-[0.95] sm:text-6xl lg:text-7xl">
            Create memorable gifting experiences with HAMPORIUM.
          </h1>

          <p className="mt-6 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
            Event planners, wedding planners, gifting curators, suppliers and agencies can build client projects, share secure private showcases and track attributed commissions from a dedicated partner workspace.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {isPartner ? (
              <Link
                to={partnerPath}
                className="inline-flex rounded-full bg-[#F97316] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-white hover:text-[#171717]"
              >
                Open Partner Portal
              </Link>
            ) : (
              <>
                <Link
                  to="/partner/register"
                  className="inline-flex rounded-full bg-[#F97316] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-white hover:text-[#171717]"
                >
                  Become a Partner
                </Link>

                <Link
                  to="/partner/login"
                  className="inline-flex rounded-full border border-white/20 px-7 py-3.5 text-sm font-bold text-white transition hover:border-[#D4AF37] hover:text-[#D4AF37]"
                >
                  Partner Login
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          <StepCard
            number="01"
            title="Apply once"
            text="Complete your business profile, capabilities, service areas and verification information in one guided application."
          />
          <StepCard
            number="02"
            title="Create client projects"
            text="Submit gifting requirements, get client pricing validated by HAMPORIUM and publish secure OTP-protected showcases."
          />
          <StepCard
            number="03"
            title="Track earnings"
            text="See attributed orders, commission eligibility, payout status and partner analytics without exposing internal HAMPORIUM economics to clients."
          />
        </div>

        <div className="mt-10 rounded-[28px] border border-[#D4AF37]/30 bg-white p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F97316]">
            Partner approval
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-[#171717]">
            Your portal unlocks after review.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-black/50">
            Registration creates a partner application. Projects, referral activation, commissions and payouts remain restricted until HAMPORIUM approves the account.
          </p>
        </div>
      </section>
    </main>
  );
};

const StepCard = ({ number, title, text }) => (
  <div className="rounded-3xl border border-black/10 bg-white p-6">
    <span className="text-sm font-black text-[#D4AF37]">{number}</span>
    <h2 className="mt-3 text-xl font-black text-[#171717]">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-black/50">{text}</p>
  </div>
);

export default EventPartners;
