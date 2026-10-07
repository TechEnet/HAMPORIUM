import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";

const IMAGES = {
  hero: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1800&q=82",
  event: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1600&q=82",
  dinner: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=82",
};

const partnerBenefits = [
  {
    icon: "briefcase",
    title: "Create client projects",
    text: "One workspace for every event, client or gifting brief.",
    image: IMAGES.event,
  },
  {
    icon: "lock",
    title: "Share private showcases",
    text: "Send polished OTP-protected presentations instead of PDFs.",
    image: IMAGES.hero,
  },
  {
    icon: "coins",
    title: "Track commissions",
    text: "See attributed orders, commission status and payouts clearly.",
    image: IMAGES.dinner,
  },
];

const steps = [
  ["01", "Apply", "Share your business details."],
  ["02", "Get approved", "HAMPORIUM reviews your application."],
  ["03", "Create projects", "Build and validate client gifting ideas."],
  ["04", "Share & earn", "Send showcases and track converted orders."],
];

const EventPartners = () => {
  const { user, partner } = useAuth();
  const isPartner = user?.roles?.includes("partner");
  const partnerPath = partner?.status === "approved" ? "/partner" : "/partner/status";

  return (
    <main className="ep-page min-h-screen overflow-hidden bg-[#F7F2EA] text-[#171717]">
      <style>{STYLES}</style>

      <section className="relative min-h-[88svh] overflow-hidden bg-[#11100E] text-white">
        <div className="absolute inset-0">
          <img
            src={IMAGES.hero}
            alt="Premium gift hamper"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,10,9,.96)_0%,rgba(11,10,9,.86)_42%,rgba(11,10,9,.34)_72%,rgba(11,10,9,.18)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.38)_80%,#11100E_100%)]" />
        </div>

        <div className="ep-glow ep-glow-a" />
        <div className="ep-glow ep-glow-b" />

        <div className="relative z-10 mx-auto flex min-h-[88svh] w-full max-w-[1720px] items-center px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid w-full gap-12 lg:grid-cols-[1fr_.86fr] lg:items-center xl:gap-20">
            <Reveal>
              <div className="max-w-[860px]">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#F2D36E] backdrop-blur-md">
                  HAMPORIUM Partner Network
                </span>

                <h1 className="mt-6 font-serif text-[48px] font-semibold leading-[0.92] tracking-[-0.05em] sm:text-[64px] lg:text-[76px] xl:text-[88px]">
                  Grow your client gifting
                  <span className="block text-[#E7C65F]">with HAMPORIUM.</span>
                </h1>

                <p className="mt-5 max-w-[650px] text-[15px] font-medium leading-7 text-white/68 sm:text-[17px]">
                  Create projects, share private client showcases and track your commissions from one place.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  {isPartner ? (
                    <Link to={partnerPath} className="ep-primary">
                      Open Partner Portal <Icon name="arrow" />
                    </Link>
                  ) : (
                    <>
                      <Link to="/partner/register" className="ep-primary">
                        Become a Partner <Icon name="arrow" />
                      </Link>
                      <Link to="/partner/login" className="ep-secondary">Partner Login</Link>
                    </>
                  )}
                </div>

                <div className="mt-10 grid max-w-[720px] grid-cols-3 overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.06] backdrop-blur-md">
                  <QuickValue icon="briefcase" label="Projects" />
                  <QuickValue icon="lock" label="Private showcases" />
                  <QuickValue icon="coins" label="Commission" />
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="relative mx-auto w-full max-w-[580px]">
                <div className="ep-float-card overflow-hidden rounded-[30px] border border-white/12 bg-white/[0.08] p-3 shadow-[0_30px_90px_rgba(0,0,0,.38)] backdrop-blur-xl">
                  <div className="relative overflow-hidden rounded-[24px]">
                    <img src={IMAGES.event} alt="Premium event gifting" className="h-[420px] w-full object-cover sm:h-[500px]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(11,10,9,.78)_100%)]" />
                    <div className="absolute bottom-5 left-5 right-5 rounded-[20px] border border-white/10 bg-black/45 p-4 backdrop-blur-md">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#F0CD67]">Live project</p>
                          <p className="mt-1 text-[18px] font-extrabold text-white">Client gifting showcase</p>
                        </div>
                        <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-[11px] font-bold text-emerald-300">Approved</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ep-chip ep-chip-one"><Icon name="lock" /> OTP protected</div>
                <div className="ep-chip ep-chip-two"><Icon name="coins" /> Commission tracked</div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-[#FFFDF9] py-16 sm:py-20 lg:py-24">
        <div className="mx-auto w-full max-w-[1720px] px-5 sm:px-8 lg:px-12 xl:px-16">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.15em] text-[#A16E1C]">What you get</p>
              <h2 className="mt-3 font-serif text-[38px] font-semibold leading-[1] tracking-[-0.04em] sm:text-[50px] lg:text-[58px]">
                Simple tools. Clear benefits.
              </h2>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {partnerBenefits.map((item, index) => (
              <Reveal key={item.title} delay={index * 80}>
                <article className="ep-benefit group relative min-h-[430px] overflow-hidden rounded-[30px] bg-[#171512] text-white">
                  <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]" loading="lazy" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,9,8,.08)_15%,rgba(10,9,8,.20)_46%,rgba(10,9,8,.92)_100%)]" />
                  <div className="relative z-10 flex h-full min-h-[430px] flex-col justify-end p-6 sm:p-7">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/30 text-[#EACB68] backdrop-blur-md">
                      <Icon name={item.icon} />
                    </span>
                    <h3 className="mt-5 text-[23px] font-extrabold tracking-[-0.03em]">{item.title}</h3>
                    <p className="mt-2 max-w-sm text-[14px] font-medium leading-6 text-white/68">{item.text}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F0E5D5] py-16 sm:py-20 lg:py-24">
        <div className="mx-auto grid w-full max-w-[1720px] gap-10 px-5 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:px-12 xl:px-16">
          <Reveal>
            <div className="overflow-hidden rounded-[32px] shadow-[0_24px_60px_rgba(65,42,10,.14)]">
              <img src={IMAGES.dinner} alt="Premium client gifting presentation" className="h-[420px] w-full object-cover sm:h-[540px] lg:h-[620px]" loading="lazy" />
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="lg:pl-8">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.15em] text-[#A16E1C]">Private client showcase</p>
              <h2 className="mt-3 max-w-[720px] font-serif text-[40px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[52px] lg:text-[60px]">
                Show the client exactly what they need to see.
              </h2>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <FeatureLine icon="lock" text="OTP protected link" />
                <FeatureLine icon="eye" text="Approved items only" />
                <FeatureLine icon="chat" text="Comments & changes" />
                <FeatureLine icon="check" text="Approve or enquire" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#FFFDF9] py-16 sm:py-20 lg:py-24">
        <div className="mx-auto w-full max-w-[1720px] px-5 sm:px-8 lg:px-12 xl:px-16">
          <Reveal>
            <div className="text-center">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.15em] text-[#A16E1C]">How it works</p>
              <h2 className="mt-3 font-serif text-[38px] font-semibold tracking-[-0.04em] sm:text-[50px]">Four simple steps.</h2>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {steps.map(([number, title, text], index) => (
              <Reveal key={number} delay={index * 70}>
                <article className="group h-full rounded-[26px] border border-black/[0.07] bg-[#F8F1E7] p-6 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_45px_rgba(70,44,8,.08)]">
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-[#171717] text-[12px] font-black text-[#E6C65F]">{number}</span>
                    <Icon name="arrow" className="text-black/20 transition group-hover:translate-x-1 group-hover:text-[#A16E1C]" />
                  </div>
                  <h3 className="mt-8 text-[19px] font-extrabold">{title}</h3>
                  <p className="mt-2 text-[14px] font-medium leading-6 text-black/50">{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#151310] py-16 text-white sm:py-20 lg:py-24">
        <div className="absolute inset-0 opacity-25">
          <img src={IMAGES.hero} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#151310_0%,rgba(21,19,16,.90)_55%,rgba(21,19,16,.68)_100%)]" />

        <div className="relative z-10 mx-auto flex w-full max-w-[1720px] flex-col items-start justify-between gap-8 px-5 sm:px-8 lg:flex-row lg:items-end lg:px-12 xl:px-16">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.15em] text-[#E5C55F]">Ready to partner?</p>
              <h2 className="mt-3 font-serif text-[42px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[54px] lg:text-[64px]">
                Bring the client. We help power the gifting.
              </h2>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="flex flex-wrap gap-3">
              {isPartner ? (
                <Link to={partnerPath} className="ep-primary">Open Partner Portal <Icon name="arrow" /></Link>
              ) : (
                <>
                  <Link to="/partner/register" className="ep-primary">Become a Partner <Icon name="arrow" /></Link>
                  <Link to="/partner/login" className="ep-secondary">Partner Login</Link>
                </>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
};

const Reveal = ({ children, delay = 0 }) => {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.style.setProperty("--ep-delay", `${delay}ms`);
        node.classList.add("ep-in");
        observer.disconnect();
      },
      { threshold: 0.12 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  return <div ref={ref} className="ep-reveal">{children}</div>;
};

const QuickValue = ({ icon, label }) => (
  <div className="flex min-h-[84px] items-center justify-center gap-2 border-r border-white/10 px-3 text-center last:border-r-0">
    <Icon name={icon} className="h-5 w-5 text-[#E6C65F]" />
    <span className="text-[12px] font-bold text-white/76 sm:text-[13px]">{label}</span>
  </div>
);

const FeatureLine = ({ icon, text }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white/65 px-4 py-4 backdrop-blur-sm">
    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#171717] text-[#E4C15C]">
      <Icon name={icon} className="h-4 w-4" />
    </span>
    <span className="text-[14px] font-bold text-black/72">{text}</span>
  </div>
);

const Icon = ({ name, className = "" }) => {
  const paths = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    briefcase: <><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    coins: <><ellipse cx="12" cy="7" rx="6" ry="3" /><path d="M6 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M6 11v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    chat: <><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12h6" /></>,
    check: <path d="m5 12 4 4L19 7" />,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-5 w-5 ${className}`}
      aria-hidden="true"
    >
      {paths[name] || paths.arrow}
    </svg>
  );
};

const STYLES = `
  .ep-page { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .ep-primary,.ep-secondary { display:inline-flex; min-height:50px; align-items:center; justify-content:center; gap:10px; border-radius:999px; padding:0 22px; font-size:13px; font-weight:800; transition:transform .3s ease,background .3s ease,color .3s ease,border-color .3s ease; }
  .ep-primary { background:#F97316; color:white; }
  .ep-primary:hover { transform:translateY(-2px); background:#fff; color:#171717; }
  .ep-secondary { border:1px solid rgba(255,255,255,.22); color:white; background:rgba(255,255,255,.03); }
  .ep-secondary:hover { transform:translateY(-2px); border-color:#E4C15C; color:#E4C15C; }
  .ep-reveal { opacity:0; transform:translateY(24px); transition:opacity .75s cubic-bezier(.22,1,.36,1) var(--ep-delay,0ms),transform .75s cubic-bezier(.22,1,.36,1) var(--ep-delay,0ms); }
  .ep-reveal.ep-in { opacity:1; transform:translateY(0); }
  .ep-glow { position:absolute; border-radius:999px; filter:blur(90px); pointer-events:none; }
  .ep-glow-a { width:340px; height:340px; left:-80px; top:20%; background:rgba(249,115,22,.14); animation:epPulse 7s ease-in-out infinite; }
  .ep-glow-b { width:280px; height:280px; right:5%; bottom:8%; background:rgba(212,175,55,.14); animation:epPulse 8s ease-in-out infinite reverse; }
  .ep-float-card { animation:epFloat 5.8s ease-in-out infinite; }
  .ep-chip { position:absolute; display:flex; align-items:center; gap:8px; border:1px solid rgba(255,255,255,.13); border-radius:999px; padding:10px 13px; background:rgba(9,9,8,.72); color:white; font-size:12px; font-weight:800; backdrop-filter:blur(16px); box-shadow:0 12px 30px rgba(0,0,0,.24); }
  .ep-chip-one { left:-14px; top:18%; animation:epChip 4.8s ease-in-out infinite; }
  .ep-chip-two { right:-10px; bottom:18%; animation:epChip 5.4s ease-in-out infinite reverse; }
  .ep-benefit { transition:transform .35s cubic-bezier(.22,1,.36,1),box-shadow .35s ease; }
  .ep-benefit:hover { transform:translateY(-5px); box-shadow:0 28px 70px rgba(32,23,10,.16); }
  @keyframes epFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes epChip { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes epPulse { 0%,100%{opacity:.58;transform:scale(1)} 50%{opacity:.9;transform:scale(1.08)} }
  @media (max-width:1023px) {
    .ep-chip-one { left:8px; }
    .ep-chip-two { right:8px; }
  }
  @media (max-width:639px) {
    .ep-primary,.ep-secondary { width:100%; }
    .ep-chip { font-size:11px; padding:8px 10px; }
    .ep-chip-one { left:6px; top:14%; }
    .ep-chip-two { right:6px; bottom:14%; }
  }
  @media (prefers-reduced-motion:reduce) {
    .ep-reveal { opacity:1!important; transform:none!important; transition:none!important; }
    .ep-float-card,.ep-chip,.ep-glow { animation:none!important; }
    .ep-benefit,.ep-benefit img,.ep-primary,.ep-secondary { transition:none!important; }
  }
`;

export default EventPartners;
