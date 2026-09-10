import { Link } from "react-router-dom";

const TypeformShell = ({
  eyebrow = "HAMPORIUM",
  title,
  description,
  step = 1,
  totalSteps = 1,
  children,
  sideTitle = "A smoother way to get started.",
  sideText = "Focused questions, clear progress and no clutter.",
  closeTo = "/",
  footer,
}) => {
  const progress = Math.max(0, Math.min(100, (Number(step) / Math.max(1, Number(totalSteps))) * 100));

  return (
    <section className="fixed inset-0 z-[250] overflow-y-auto bg-[#090909]/95 px-4 py-5 backdrop-blur-md sm:px-6">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-28 top-[15%] h-80 w-80 rounded-full bg-[#F97316]/20 blur-[120px]" />
        <div className="absolute -right-24 bottom-[8%] h-80 w-80 rounded-full bg-[#D4AF37]/15 blur-[120px]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100dvh-40px)] w-full max-w-[1220px] overflow-hidden rounded-[28px] border border-white/10 bg-[#FFF9F2] shadow-[0_35px_110px_rgba(0,0,0,.55)] lg:grid-cols-[0.38fr_0.62fr]">
        <Link
          to={closeTo}
          aria-label="Close"
          className="absolute right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-lg font-medium text-[#171717] transition hover:border-[#F97316] hover:bg-[#F97316] hover:text-white"
        >
          ×
        </Link>

        <aside className="relative hidden overflow-hidden bg-[#0A0A0A] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-28 -top-24 h-80 w-80 rounded-full bg-[#F97316]/25 blur-[105px]" />
            <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[#D4AF37]/15 blur-[105px]" />
            <div
              className="absolute inset-0 opacity-[0.1]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />
          </div>

          <Link to="/" className="relative z-10 text-lg font-black tracking-[0.12em]">
            HAMPORIUM
            <span className="mt-1 block text-[7px] uppercase tracking-[0.28em] text-[#D4AF37]">
              Expressing Love
            </span>
          </Link>

          <div className="relative z-10 max-w-[340px]">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#F97316]">
              {eyebrow}
            </p>
            <h2 className="mt-4 font-serif text-[46px] font-semibold leading-[0.94] tracking-[-0.035em]">
              {sideTitle}
            </h2>
            <p className="mt-5 text-[13px] leading-6 text-white/55">{sideText}</p>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.13em] text-white/35">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#F97316] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </aside>

        <main className="flex min-h-[720px] flex-col px-5 pb-7 pt-16 sm:px-8 lg:px-12 lg:py-10 xl:px-16">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.14em] text-black/35">
              <span>Step {step} of {totalSteps}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.07]">
              <div className="h-full bg-[#F97316] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div key={`${title}-${step}`} className="hamp-typeform-enter my-auto w-full max-w-[760px]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F97316]">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-serif text-[42px] font-semibold leading-[0.96] tracking-[-0.035em] text-[#171717] sm:text-[56px]">
              {title}
            </h1>
            {description && (
              <p className="mt-5 max-w-[680px] text-sm font-medium leading-7 text-black/50">
                {description}
              </p>
            )}

            <div className="mt-8">{children}</div>
            {footer && <div className="mt-7">{footer}</div>}
          </div>
        </main>
      </div>
    </section>
  );
};

export default TypeformShell;
