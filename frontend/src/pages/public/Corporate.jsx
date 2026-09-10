import { Link } from "react-router-dom";


const Corporate = () => {
  const useCases = [
    "Employee Gifting",
    "Client Appreciation",
    "Leadership Gifts",
    "Employee Onboarding",
    "Work Anniversaries",
    "Dealer & Partner Gifting",
    "Conferences & Offsites",
    "Festive & Diwali Campaigns",
  ];


  const steps = [
    {
      number: "01",
      title: "Tell us the requirement",
      text: "Share quantity, budget, recipients, delivery cities, branding and required date.",
    },
    {
      number: "02",
      title: "Receive your proposal",
      text: "Our team prepares your quotation with products, packaging, pricing and lead time.",
    },
    {
      number: "03",
      title: "Review proof & approve",
      text: "Review quotation versions, artwork and proof before commercial confirmation.",
    },
    {
      number: "04",
      title: "PO / payment & recipients",
      text: "Submit your PO or complete payment and upload validated recipient data.",
    },
  ];


  return (
    <div className="bg-white">
      <section className="overflow-hidden bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-28">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#F26522]">
              HAMPORIUM Business
            </p>

            <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Corporate gifting,
              <span className="text-[#F26522]">
                {" "}beautifully managed.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              From employee celebrations and client
              gifting to large festive campaigns,
              HAMPORIUM manages the complete journey
              from requirement to branded delivery.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/account/corporate/campaigns?new=1&type=corporate"
                className="inline-flex items-center justify-center rounded-xl bg-[#F26522] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#d95416]"
              >
                Build a Corporate Gifting Proposal
              </Link>

              <Link
                to="/gifts"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 transition hover:border-[#F26522] hover:text-[#F26522]"
              >
                Explore Gifts
              </Link>
            </div>
          </div>


          <div className="rounded-[32px] border border-orange-100 bg-white p-6 shadow-xl shadow-orange-100/50">
            <div className="rounded-3xl bg-slate-950 p-7 text-white">
              <p className="text-sm font-semibold text-orange-300">
                Business gifting workspace
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                One place for the entire campaign
              </h2>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  "RFQ & Requirements",
                  "Quotation Versions",
                  "Artwork & Proofs",
                  "Approvals",
                  "PO / Payment",
                  "Recipient Data",
                  "Campaign Status",
                  "Production Handoff",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-wider text-[#F26522]">
            Made for business
          </p>

          <h2 className="mt-3 text-3xl font-bold text-slate-950">
            Gifting for every business moment
          </h2>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-orange-200 hover:shadow-md"
            >
              <div className="mb-4 h-2 w-10 rounded-full bg-[#F26522]" />

              <h3 className="font-semibold text-slate-900">
                {item}
              </h3>
            </div>
          ))}
        </div>
      </section>


      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-[#F26522]">
              How it works
            </p>

            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Complex gifting without the complexity
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <span className="text-3xl font-black text-orange-100">
                  {step.number}
                </span>

                <h3 className="mt-4 font-bold text-slate-900">
                  {step.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="rounded-[32px] bg-[#F26522] px-7 py-12 text-center text-white md:px-12">
          <h2 className="text-3xl font-bold">
            Planning a bulk gifting campaign?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-orange-50">
            Start with your requirement. We will
            manage proposal, branding, proof,
            commercial confirmation and recipient
            data through your HAMPORIUM account.
          </p>

          <Link
            to="/account/corporate/campaigns?new=1&type=corporate"
            className="mt-7 inline-flex rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[#F26522] hover:bg-orange-50"
          >
            Start Corporate Campaign
          </Link>
        </div>
      </section>
    </div>
  );
};


export default Corporate;