import { Link } from "react-router-dom";


const Diwali = () => {
  const categories = [
    "Employee Gifting",
    "Client Gifting",
    "Leadership Gifting",
    "Healthy & Wellness",
    "Gourmet",
    "Indian Artisanal",
    "Sustainable",
    "Personalized",
  ];


  const budgets = [
    "Under ₹1,500",
    "₹1,500 – ₹2,500",
    "₹2,500 – ₹5,000",
    "₹5,000+",
  ];


  return (
    <div className="bg-white">
      <section className="bg-gradient-to-br from-amber-50 via-orange-50 to-white">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center lg:py-28">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#F26522]">
            HAMPORIUM Diwali
          </p>

          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Thoughtful Diwali gifting for
            <span className="text-[#F26522]">
              {" "}people who matter.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Shop curated gifts for family and
            friends, or let HAMPORIUM manage your
            employee, client and business gifting
            campaign at scale.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/gifts"
              className="rounded-xl bg-[#F26522] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#d95416]"
            >
              Shop Diwali Gifts
            </Link>

            <Link
              to="/account/corporate/campaigns?new=1&type=diwali_bulk"
              className="rounded-xl border border-[#F26522] bg-white px-6 py-3.5 text-sm font-semibold text-[#F26522] hover:bg-orange-50"
            >
              Request Corporate Bulk Proposal
            </Link>
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold text-slate-950">
          Shop by budget
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {budgets.map((budget) => (
            <Link
              key={budget}
              to="/gifts"
              className="rounded-2xl border border-orange-100 bg-orange-50 p-6 text-center font-semibold text-slate-900 transition hover:-translate-y-1 hover:shadow-md"
            >
              {budget}
            </Link>
          ))}
        </div>
      </section>


      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-[#F26522]">
              Curated for every audience
            </p>

            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Diwali gifting collections
            </h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categories.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-white p-5 font-semibold text-slate-800"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 rounded-[32px] bg-slate-950 p-8 text-white lg:grid-cols-2 lg:p-12">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-orange-300">
              Corporate Diwali
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Hundreds of recipients?
              We manage the details.
            </h2>

            <p className="mt-4 leading-7 text-slate-300">
              Branding, quotation, artwork proof,
              PO/payment and spreadsheet recipient
              intake are managed through one
              business workspace.
            </p>
          </div>

          <div className="flex items-center lg:justify-end">
            <Link
              to="/account/corporate/campaigns?new=1&type=diwali_bulk"
              className="rounded-xl bg-[#F26522] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#d95416]"
            >
              Start Diwali Bulk Campaign
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};


export default Diwali;