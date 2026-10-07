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
  compact = false,
}) => {
  const safeStep = Math.max(1, Number(step) || 1);
  const safeTotalSteps = Math.max(1, Number(totalSteps) || 1);
  const hasProgress = safeTotalSteps > 1;
  const progress = hasProgress
    ? Math.max(
        0,
        Math.min(100, ((safeStep - 1) / (safeTotalSteps - 1)) * 100)
      )
    : 0;

  return (
    <section className="fixed inset-0 z-[250] overflow-y-auto bg-[#090909]/82 px-3 py-4 backdrop-blur-sm sm:px-5 sm:py-5">
      <style>{`
        @keyframes hamporiumHamperFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-1.2deg); }
          50% { transform: translate3d(0, -9px, 0) rotate(1deg); }
        }
        @keyframes hamporiumHamperGlow {
          0%, 100% { opacity: .32; transform: scale(.94); }
          50% { opacity: .8; transform: scale(1.08); }
        }
        @keyframes hamporiumRibbon {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes hamporiumSparkle {
          0%, 100% { opacity: .22; transform: translateY(0) scale(.75); }
          50% { opacity: 1; transform: translateY(-5px) scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hamporium-hamper-float,
          .hamporium-hamper-glow,
          .hamporium-hamper-ribbon,
          .hamporium-hamper-sparkle { animation: none !important; }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[18%] h-64 w-64 rounded-full bg-[#F97316]/08 blur-[110px]" />
        <div className="absolute -right-20 bottom-[10%] h-64 w-64 rounded-full bg-[#D4AF37]/06 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-32px)] w-full items-center justify-center sm:min-h-[calc(100dvh-40px)]">
        <div
          className={`relative grid overflow-hidden rounded-[24px] border border-white/10 bg-[#FFF9F2] shadow-[0_28px_90px_rgba(0,0,0,.52)] ${
            compact
              ? "w-[min(94vw,820px)] lg:grid-cols-[250px_minmax(0,1fr)]"
              : "w-[min(94vw,874px)] lg:grid-cols-[280px_minmax(0,1fr)]"
          }`}
        >
          <Link
            to={closeTo}
            aria-label="Close"
            className="absolute right-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[18px] font-medium text-[#171717] transition hover:border-[#F97316] hover:bg-[#F97316] hover:text-white"
          >
            ×
          </Link>

          <aside
            className={`relative hidden overflow-hidden bg-[#0A0A0A] text-white lg:flex lg:flex-col lg:justify-between ${
              compact ? "lg:h-[480px] lg:min-h-0 p-5" : "min-h-[506px] p-6"
            }`}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-[#F97316]/22 blur-[95px]" />
              <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#D4AF37]/12 blur-[95px]" />
              <div
                className="absolute inset-0 opacity-[0.08]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
            </div>

            <Link to="/" className="relative z-10 text-[17px] font-black tracking-[0.12em]">
              HAMPORIUM
              <span className="mt-1 block text-[9px] uppercase tracking-[0.22em] text-[#D4AF37]">
                Expressing Love
              </span>
            </Link>

            <div
              className={`relative z-10 mx-auto my-1 w-full ${
                compact ? "max-w-[190px]" : "max-w-[220px]"
              }`}
            >
              <HamperVisual compact={compact} />
            </div>

            <div className="relative z-10 max-w-[235px]">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F97316]">
                {eyebrow}
              </p>
              <h2
                className={`mt-2 font-serif font-semibold leading-[1] tracking-[-0.035em] ${
                  compact ? "text-[23px]" : "text-[26px]"
                }`}
              >
                {sideTitle}
              </h2>
            </div>

            {hasProgress && (
              <div className="relative z-10">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.11em] text-white/38">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#F97316] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </aside>

          <main
            className={`flex flex-col px-5 pb-6 pt-14 sm:px-7 ${
              compact
                ? "lg:h-[480px] lg:min-h-0 lg:overflow-y-auto lg:px-7 lg:py-6"
                : "min-h-[506px] lg:px-8 lg:py-7"
            }`}
          >
            {hasProgress && (
              <div className="mb-5 lg:hidden">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.12em] text-black/38">
                  <span>Step {safeStep} of {safeTotalSteps}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.07]">
                  <div
                    className="h-full bg-[#F97316] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div
              key={`${title}-${step}`}
              className={`hamp-typeform-enter my-auto w-full ${
                compact ? "max-w-[390px]" : "max-w-[410px]"
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F97316]">
                {eyebrow}
              </p>
              <h1
                className={`mt-2.5 font-serif font-semibold leading-[0.96] tracking-[-0.035em] text-[#171717] ${
                  compact ? "text-[30px] sm:text-[35px]" : "text-[34px] sm:text-[40px]"
                }`}
              >
                {title}
              </h1>
              {description && (
                <p className="mt-3.5 max-w-[400px] text-[13px] font-medium leading-6 text-black/52">
                  {description}
                </p>
              )}

              <div className="mt-5">{children}</div>
              {footer && <div className="mt-5">{footer}</div>}
            </div>
          </main>
        </div>
      </div>
    </section>
  );
};

const HamperVisual = ({ compact = false }) => (
  <div className={`relative w-full ${compact ? "h-[118px]" : "h-[142px]"}`} aria-hidden="true">
    <div
      className="hamporium-hamper-glow absolute left-1/2 top-1/2 h-28 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F5A23A]/30 blur-3xl"
      style={{ animation: "hamporiumHamperGlow 4.8s ease-in-out infinite" }}
    />

    <svg
      viewBox="0 0 320 210"
      className="hamporium-hamper-float relative z-10 h-full w-full overflow-visible drop-shadow-[0_22px_24px_rgba(0,0,0,.45)]"
      style={{ animation: "hamporiumHamperFloat 5.4s ease-in-out infinite" }}
    >
      <defs>
        <linearGradient id="hamp-box" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2117" />
          <stop offset="0.55" stopColor="#100d0a" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
        <linearGradient id="hamp-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3D37A" />
          <stop offset="0.45" stopColor="#D69A31" />
          <stop offset="1" stopColor="#8F5B13" />
        </linearGradient>
        <linearGradient id="hamp-cream" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF8E9" />
          <stop offset="1" stopColor="#DCC9A4" />
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="187" rx="108" ry="14" fill="#000" opacity=".35" />

      <g>
        <path d="M54 72 158 34l108 38-107 41Z" fill="#201812" stroke="#6f5126" strokeWidth="2" />
        <path d="m54 72 105 41v76L54 146Z" fill="url(#hamp-box)" stroke="#5f4726" strokeWidth="2" />
        <path d="m266 72-107 41v76l107-44Z" fill="#090807" stroke="#5f4726" strokeWidth="2" />

        <path d="M74 80 159 50l87 30-87 32Z" fill="#130f0c" stroke="#C28A2C" strokeOpacity=".55" strokeWidth="2" />
        <path d="M89 84 159 59l70 24-70 26Z" fill="#24170d" opacity=".96" />

        <g>
          <rect x="99" y="58" width="31" height="45" rx="8" fill="url(#hamp-cream)" />
          <rect x="104" y="51" width="21" height="11" rx="4" fill="url(#hamp-gold)" />
          <rect x="105" y="74" width="19" height="3" rx="1.5" fill="#9B6A22" opacity=".65" />
        </g>

        <g>
          <rect x="143" y="51" width="34" height="50" rx="8" fill="#5f2d1a" />
          <rect x="148" y="45" width="24" height="10" rx="4" fill="#221610" />
          <circle cx="160" cy="77" r="11" fill="url(#hamp-gold)" />
          <circle cx="160" cy="77" r="5" fill="#4a2b16" />
        </g>

        <g>
          <rect x="189" y="62" width="40" height="37" rx="8" fill="#E7D0A7" />
          <path d="M189 79h40" stroke="#B27A29" strokeWidth="4" />
          <path d="M208 62v37" stroke="#B27A29" strokeWidth="4" />
        </g>

        <path d="M159 111v78" stroke="url(#hamp-gold)" strokeWidth="10" opacity=".9" />
        <path d="M54 112 159 153l107-43" stroke="#C7892E" strokeWidth="7" opacity=".68" />

        <g
          className="hamporium-hamper-ribbon"
          style={{ transformOrigin: "160px 116px", animation: "hamporiumRibbon 3.8s ease-in-out infinite" }}
        >
          <path d="M160 119c-18-25-44-18-42-3 2 13 20 14 42 7Z" fill="url(#hamp-gold)" />
          <path d="M160 119c18-25 44-18 42-3-2 13-20 14-42 7Z" fill="url(#hamp-gold)" />
          <circle cx="160" cy="119" r="10" fill="#E9B84F" />
          <path d="m157 126-20 36 17-7 10 14 5-42Z" fill="#B8741E" />
          <path d="m164 126 19 36-16-7-11 14-3-42Z" fill="#CF8B25" />
        </g>
      </g>
    </svg>

    <span
      className="hamporium-hamper-sparkle absolute right-7 top-5 z-20 h-2.5 w-2.5 rotate-45 bg-[#F7D778] shadow-[0_0_12px_#F7D778]"
      style={{ animation: "hamporiumSparkle 2.8s ease-in-out infinite" }}
    />
    <span
      className="hamporium-hamper-sparkle absolute left-8 top-12 z-20 h-1.5 w-1.5 rotate-45 bg-[#F97316] shadow-[0_0_10px_#F97316]"
      style={{ animation: "hamporiumSparkle 3.3s .6s ease-in-out infinite" }}
    />
  </div>
);

export default TypeformShell;
