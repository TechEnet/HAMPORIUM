import { Outlet, useNavigate } from "react-router-dom";

const ShowcaseLayout = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-[#FFF9F2] text-[#171717]">
      {/* HEADER */}
      <header className="sticky top-0 z-[100] w-full border-b border-black/[0.06] bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-[78px] w-full items-center justify-between gap-5 px-5 py-3 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#171717] text-[#F97316]">
              <GiftIcon />
            </span>

            <div>
              <h1 className="text-[16px] font-black tracking-[0.09em] text-[#171717] sm:text-[18px]">
                HAMPORIUM
              </h1>

              <p className="mt-0.5 text-[7px] font-extrabold uppercase tracking-[0.18em] text-[#D4AF37]">
                Private Client Showcase
              </p>
            </div>
          </button>

          <div className="hidden items-center gap-3 sm:flex">
            <span className="h-px w-8 bg-[#D4AF37]" />

            <span className="text-[8px] font-extrabold uppercase tracking-[0.15em] text-black/35">
              Curated for you
            </span>
          </div>
        </div>
      </header>

      {/* TOP STRIP */}
      <section className="relative overflow-hidden bg-[#171717] px-5 py-7 text-white sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20">
        <div className="pointer-events-none absolute -right-20 -top-24 h-[260px] w-[260px] rounded-full bg-[#F97316]/20 blur-[100px]" />

        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#F97316]">
              HAMPORIUM
            </p>

            <h2 className="mt-1 font-serif text-[28px] font-semibold leading-none sm:text-[34px]">
              Private Client Showcase
            </h2>
          </div>

          <p className="max-w-[400px] text-[10px] font-medium leading-5 text-white/40 sm:text-right">
            A curated presentation prepared exclusively for your gifting requirements.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <main className="w-full px-5 py-8 sm:px-8 md:px-10 lg:px-12 lg:py-10 xl:px-16 2xl:px-20">
        <div className="w-full rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-[0_10px_35px_rgba(23,23,23,.045)] sm:p-7 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const GiftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
  >
    <path d="M4 10h16v10H4V10Z" />
    <path d="M3 7h18v4H3V7ZM12 7v13" />
    <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" />
  </svg>
);

export default ShowcaseLayout;