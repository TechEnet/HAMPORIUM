import { Link } from "react-router-dom";

const Weddings = () => {
  const services = [
    "Welcome Hampers",
    "Room Hampers",
    "Wedding Favours",
    "VIP Family Gifts",
    "Bridesmaid & Groomsmen",
    "Return Favours",
    "Event Gifting",
    "Departure Gifts",
  ];

  const steps = [
    ["01", "Share your wedding brief", "Tell us your dates, destination, guests, budget, theme and gifting requirements."],
    ["02", "Review the concept", "HAMPORIUM prepares curated gifting concepts and presentation directions."],
    ["03", "Quote & sample approval", "Review commercial quotation, samples, artwork and proof versions."],
    ["04", "Guests & delivery", "Share guest, hotel and room data before production and event delivery."],
  ];

  return (
    <div className="bg-white">
      <section className="bg-gradient-to-br from-[#fff7f2] via-white to-rose-50 px-6 py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#F26522]">
              HAMPORIUM Weddings
            </p>

            <h1 className="mt-5 text-5xl font-bold leading-tight text-slate-950 md:text-6xl">
              Wedding gifting,
              <span className="text-[#F26522]"> beautifully managed.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              From welcome hampers and room gifting to family gifts,
              favours and personalized keepsakes — manage the complete
              wedding gifting programme with HAMPORIUM.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/account/weddings/brief"
                className="rounded-xl bg-[#F26522] px-6 py-3.5 font-semibold text-white hover:bg-[#dc551b]"
              >
                Start Wedding Brief
              </Link>

              <Link
                to="/gifts"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700 hover:border-[#F26522] hover:text-[#F26522]"
              >
                Explore Gifts
              </Link>
            </div>
          </div>

          <div className="rounded-[32px] border border-orange-100 bg-white p-6 shadow-xl shadow-orange-100/40">
            <div className="rounded-3xl bg-slate-950 p-8 text-white">
              <p className="text-sm font-semibold text-orange-300">
                Your private Wedding Workspace
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                From first brief to production-ready
              </h2>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Wedding Brief",
                  "Events",
                  "Concept Versions",
                  "Quotation",
                  "Sample & Proofs",
                  "Approvals",
                  "Payment Milestones",
                  "Guest / Hotel Data",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="font-semibold text-[#F26522]">Wedding Gifting</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-950">
          Thoughtful gifting across the celebration
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-4 h-2 w-10 rounded-full bg-[#F26522]" />
              <p className="font-semibold text-slate-900">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold">
            How HAMPORIUM Weddings works
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {steps.map(([number, title, text]) => (
              <div
                key={number}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <p className="text-3xl font-black text-orange-100">{number}</p>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="rounded-[32px] bg-[#F26522] p-10 text-center text-white">
          <h2 className="text-3xl font-bold">
            Planning your wedding gifting?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-orange-50">
            Create a private wedding project and manage your concept,
            quotation, approvals, payment milestones and guest information.
          </p>

          <Link
            to="/account/weddings/brief"
            className="mt-7 inline-flex rounded-xl bg-white px-6 py-3.5 font-bold text-[#F26522]"
          >
            Create Wedding Project
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Weddings;