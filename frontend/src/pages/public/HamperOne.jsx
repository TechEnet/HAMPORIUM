import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";

import api from "../../api/api.js";

import hamperFestiveHero from "../../assets/images/hamper_one_festive.webp";
import hamperExecutiveHero from "../../assets/images/hamper_one_executive.webp";
import hamperWeddingHero from "../../assets/images/hamper_one_wedding.webp";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const HERO_SLIDES = [
  {
    src: hamperFestiveHero,
    position: "62% 54%",
    eyebrow: "THE PRIVATE EDIT",
    title: "Rare Selection",
    copy: "A tighter, more elevated edit chosen for exceptional gifting.",
  },
  {
    src: hamperExecutiveHero,
    position: "64% 52%",
    eyebrow: "SIGNATURE PRESENTATION",
    title: "Composed To Impress",
    copy: "Premium finishing, restraint and visual detail from first glance to final reveal.",
  },
  {
    src: hamperWeddingHero,
    position: "66% 50%",
    eyebrow: "BESPOKE DIRECTION",
    title: "Made More Personal",
    copy: "An intentional expression shaped around the person, occasion and gesture.",
  },
];

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1607344645866-009c320b63e0?auto=format&fit=crop&w=1200&q=90";

const getApiOrigin = () => {
  const baseURL = api.defaults?.baseURL || "";
  return baseURL.replace(/\/api\/?$/, "").replace(/\/$/, "");
};

const API_ORIGIN = getApiOrigin();

const resolveImage = (value) => {
  if (!value) return "";

  let image = value;
  if (typeof image === "object") {
    image = image.url || image.secure_url || image.src || image.path || "";
  }

  if (typeof image !== "string" || !image) return "";

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:") ||
    image.startsWith("blob:")
  ) {
    return image;
  }

  if (image.startsWith("//")) return `https:${image}`;

  return API_ORIGIN
    ? `${API_ORIGIN}${image.startsWith("/") ? "" : "/"}${image}`
    : image;
};

const getProductImage = (product) => {
  const first = Array.isArray(product?.images) ? product.images[0] : null;
  return resolveImage(first) || FALLBACK_IMAGE;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reduced;
};

const ArrowIcon = ({ direction = "right" }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={direction === "down" ? "ho-icon-down" : ""}
  >
    <path d="M5 12h13" />
    <path d="m14 7 5 5-5 5" />
  </svg>
);

const StarMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.8c.7 5.4 3.1 7.8 8.5 8.5-5.4.7-7.8 3.1-8.5 8.5-.7-5.4-3.1-7.8-8.5-8.5 5.4-.7 7.8-3.1 8.5-8.5Z" />
  </svg>
);

const HamperOne = () => {
  const reducedMotion = useReducedMotion();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [heroSlide, setHeroSlide] = useState(0);
  const [ritualActive, setRitualActive] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [heroReady, setHeroReady] = useState(false);

  const rootRef = useRef(null);
  const pointerFrameRef = useRef(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadProducts = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/catalog/products", {
          params: {
            search: "hamper-one",
            sort: "featured",
            limit: 12,
          },
          signal: controller.signal,
          timeout: 12000,
        });

        if (!active) return;
        setProducts(Array.isArray(response.data?.products) ? response.data.products : []);
      } catch (requestError) {
        if (!active || requestError?.code === "ERR_CANCELED") return;
        console.error("HAMPER ONE products error:", requestError);
        setError(
          requestError.response?.data?.message ||
            "Unable to load the HAMPER ONE collection."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProducts();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    HERO_SLIDES.forEach((slide) => {
      const image = new Image();
      image.src = slide.src;
    });
  }, []);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const interval = window.setInterval(() => {
      setHeroSlide((current) => (current + 1) % HERO_SLIDES.length);
    }, 5200);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      setScrollProgress(clamp(progress, 0, 1));
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll("[data-ho-ritual-trigger]"));
    if (!targets.length || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number(entry.target.getAttribute("data-ho-ritual-trigger"));
          if (Number.isFinite(index)) setRitualActive(index);
        });
      },
      { threshold: 0.52, rootMargin: "-16% 0px -16% 0px" }
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const items = Array.from(document.querySelectorAll(".ho-reveal"));
    if (!items.length) return undefined;

    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      items.forEach((item) => item.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -7% 0px" }
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [loading, products.length, reducedMotion]);

  const handleHeroPointerMove = useCallback((event) => {
    if (reducedMotion || !rootRef.current) return;

    const host = event.currentTarget;
    const rect = host.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    if (pointerFrameRef.current) cancelAnimationFrame(pointerFrameRef.current);
    pointerFrameRef.current = requestAnimationFrame(() => {
      host.style.setProperty("--ho-pointer-x", `${x}%`);
      host.style.setProperty("--ho-pointer-y", `${y}%`);
      host.style.setProperty("--ho-parallax-x", `${(x - 50) * 0.08}px`);
      host.style.setProperty("--ho-parallax-y", `${(y - 50) * 0.06}px`);
    });
  }, [reducedMotion]);

  const heroProducts = useMemo(() => {
    return [
      products[0] || null,
      products[1] || null,
      products[2] || null,
      products[3] || null,
    ];
  }, [products]);

  const ritualSlides = useMemo(
    () => [
      {
        number: "01",
        eyebrow: "THE SELECTION",
        title: "Rare Selection",
        accent: "chosen with restraint.",
        body: "A tighter edit of gifts selected for exceptional moments, not an endless catalogue.",
        foot: "CURATED WITH RESTRAINT",
        image: getProductImage(heroProducts[0] || {}) || HERO_SLIDES[0].src,
      },
      {
        number: "02",
        eyebrow: "THE PRESENTATION",
        title: "Signature Presentation",
        accent: "composed to impress.",
        body: "Finishing, packaging and visual balance are treated as part of the gift itself.",
        foot: "FINISHED TO IMPRESS",
        image: getProductImage(heroProducts[1] || {}) || HERO_SLIDES[1].src,
      },
      {
        number: "03",
        eyebrow: "THE PERSONAL TOUCH",
        title: "Bespoke Direction",
        accent: "made more personal.",
        body: "A more intentional expression shaped around the person, occasion and gesture.",
        foot: "MADE MORE PERSONAL",
        image: getProductImage(heroProducts[2] || {}) || HERO_SLIDES[2].src,
      },
      {
        number: "04",
        eyebrow: "THE EXPERIENCE",
        title: "White-glove Mindset",
        accent: "handled with care.",
        body: "Every touchpoint is considered as part of one private, premium gifting journey.",
        foot: "PRIVATE EXPERIENCE",
        image: getProductImage(heroProducts[3] || {}) || HERO_SLIDES[0].src,
      },
    ],
    [heroProducts]
  );

  const currentRitual = ritualSlides[ritualActive] || ritualSlides[0];

  const handleCollectionJump = () => {
    document.getElementById("hamper-one-collection")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <main
      ref={rootRef}
      className="ho-page min-h-screen overflow-x-clip bg-[#080706] text-[#F8F0DC]"
      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700;800&display=swap');

        .ho-page {
          --ho-gold:#D8B651;
          --ho-gold-2:#F0D982;
          --ho-orange:#F47822;
          --ho-cream:#F8F0DC;
          --ho-ink:#080706;
          --ho-ease:cubic-bezier(.16,1,.3,1);
          --ho-pointer-x:50%;
          --ho-pointer-y:50%;
          background:
            radial-gradient(circle at 20% 10%, rgba(212,175,55,.045), transparent 30%),
            #080706;
        }

        .ho-page *, .ho-page *::before, .ho-page *::after { box-sizing:border-box; }
        .ho-page a, .ho-page button { -webkit-tap-highlight-color:transparent; }
        .ho-page :where(a,button):focus-visible { outline:2px solid #F0D982; outline-offset:5px; }
        .ho-display { font-family:${DISPLAY_FONT}; }
        .ho-no-select { user-select:none; -webkit-user-select:none; }

        .ho-progress {
          position:fixed;
          top:0; left:0; right:0;
          z-index:160;
          height:2px;
          pointer-events:none;
          background:rgba(255,255,255,.03);
        }
        .ho-progress > span {
          display:block;
          width:100%; height:100%;
          transform:scaleX(var(--ho-progress,0));
          transform-origin:left center;
          background:linear-gradient(90deg,#F47822,#D8B651 52%,#F0D982);
          box-shadow:0 0 14px rgba(216,182,81,.34);
          will-change:transform;
        }

        .ho-reveal {
          opacity:0;
          transform:translate3d(0,26px,0);
          transition:opacity .72s ease, transform .92s var(--ho-ease);
        }
        .ho-reveal.is-visible { opacity:1; transform:translate3d(0,0,0); }
        .ho-delay-1 { transition-delay:.07s; }
        .ho-delay-2 { transition-delay:.14s; }
        .ho-delay-3 { transition-delay:.21s; }

        /* HERO */
        .ho-hero {
          --ho-parallax-x:0px;
          --ho-parallax-y:0px;
          position:relative;
          min-height:100svh;
          isolation:isolate;
          overflow:hidden;
          background:#070604;
        }
        .ho-hero-media { position:absolute; inset:0; z-index:-6; overflow:hidden; }
        .ho-hero-slide {
          position:absolute;
          inset:-2.4%;
          width:104.8%; height:104.8%;
          object-fit:cover;
          opacity:0;
          filter:saturate(.94) contrast(1.03) brightness(.76);
          transform:translate3d(var(--ho-parallax-x),var(--ho-parallax-y),0) scale(1.045);
          transition:opacity 1.25s var(--ho-ease), transform 6.4s var(--ho-ease), filter 1.2s ease;
          will-change:opacity,transform;
        }
        .ho-hero-slide.is-active {
          opacity:1;
          transform:translate3d(var(--ho-parallax-x),var(--ho-parallax-y),0) scale(1.095);
          filter:saturate(1.01) contrast(1.045) brightness(.86);
        }
        .ho-hero-overlay {
          position:absolute; inset:0; z-index:-5; pointer-events:none;
          background:
            linear-gradient(90deg,rgba(3,3,3,.97) 0%,rgba(3,3,3,.88) 27%,rgba(5,4,3,.54) 52%,rgba(6,5,4,.19) 78%,rgba(4,4,4,.32) 100%),
            linear-gradient(180deg,rgba(0,0,0,.22),transparent 42%,rgba(0,0,0,.72));
        }
        .ho-hero-overlay::after {
          content:"";
          position:absolute; inset:0;
          background:radial-gradient(circle 360px at var(--ho-pointer-x) var(--ho-pointer-y),rgba(255,219,122,.09),rgba(216,182,81,.025) 40%,transparent 72%);
          opacity:.9;
        }
        .ho-grain {
          position:absolute; inset:0; z-index:-4; pointer-events:none;
          opacity:.07;
          background-image:radial-gradient(rgba(255,255,255,.9) .48px,transparent .48px);
          background-size:7px 7px;
          mix-blend-mode:soft-light;
        }
        .ho-hero-glint {
          position:absolute;
          z-index:-2;
          top:-18%; right:-9%;
          width:min(48vw,720px);
          aspect-ratio:1;
          border-radius:50%;
          background:conic-gradient(from 190deg,transparent 0 22%,rgba(255,228,147,.10) 31%,transparent 42% 100%);
          filter:blur(4px);
          animation:hoGlint 13s linear infinite;
          pointer-events:none;
        }
        @keyframes hoGlint { to { transform:rotate(360deg); } }

        .ho-hero-inner {
          min-height:100svh;
          display:grid;
          grid-template-columns:minmax(0,.94fr) minmax(360px,.66fr);
          align-items:center;
          gap:clamp(34px,6vw,96px);
          padding:clamp(118px,10vw,156px) clamp(22px,5vw,88px) clamp(60px,6vw,92px);
        }
        .ho-hero-copy { max-width:840px; }
        .ho-kicker {
          display:flex; align-items:center; gap:12px;
          color:#F0D982;
          font-size:9px; font-weight:900; letter-spacing:.27em; text-transform:uppercase;
        }
        .ho-kicker::before {
          content:""; width:46px; height:1px;
          background:linear-gradient(90deg,#F47822,#D8B651);
          box-shadow:0 0 12px rgba(216,182,81,.25);
        }
        .ho-hero-title {
          margin:25px 0 0;
          max-width:920px;
          font-family:${DISPLAY_FONT};
          font-size:clamp(92px,11.6vw,188px);
          font-weight:600;
          line-height:.68;
          letter-spacing:-.058em;
          color:#FAF0D9;
          text-shadow:0 28px 70px rgba(0,0,0,.32);
        }
        .ho-hero-title span {
          display:block;
          margin-top:.19em;
          color:#D8B651;
          font-style:italic;
          font-size:.52em;
          letter-spacing:-.045em;
          text-shadow:0 14px 44px rgba(216,182,81,.16);
        }
        .ho-hero-deck {
          display:grid;
          grid-template-columns:minmax(0,1fr) minmax(190px,.48fr);
          gap:28px;
          align-items:end;
          max-width:820px;
          margin-top:38px;
          padding-top:27px;
          border-top:1px solid rgba(255,255,255,.10);
        }
        .ho-hero-deck p {
          margin:0;
          color:rgba(255,255,255,.64);
          font-size:14px;
          line-height:1.9;
        }
        .ho-hero-micro {
          padding-left:24px;
          border-left:1px solid rgba(216,182,81,.30);
          color:rgba(255,255,255,.45);
          font-size:9px;
          font-weight:800;
          line-height:1.8;
          letter-spacing:.12em;
          text-transform:uppercase;
        }
        .ho-actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:31px; }
        .ho-btn {
          position:relative;
          display:inline-flex;
          min-height:56px;
          align-items:center;
          justify-content:center;
          gap:20px;
          padding:0 26px;
          overflow:hidden;
          border:1px solid rgba(216,182,81,.42);
          color:#F8F0DC;
          background:rgba(10,8,5,.44);
          backdrop-filter:blur(10px);
          text-decoration:none;
          font-size:9px;
          font-weight:900;
          letter-spacing:.14em;
          text-transform:uppercase;
          transition:transform .48s var(--ho-ease),border-color .35s ease,background .35s ease,color .35s ease,box-shadow .35s ease;
        }
        .ho-btn svg { width:17px; height:17px; fill:none; stroke:currentColor; stroke-width:1.7; transition:transform .45s var(--ho-ease); }
        .ho-btn:hover { transform:translateY(-3px); border-color:#E7CD79; box-shadow:0 18px 42px rgba(0,0,0,.23); }
        .ho-btn:hover svg { transform:translateX(4px); }
        .ho-btn-primary { background:linear-gradient(135deg,#E6CA6D,#C99F32); color:#171007; border-color:#E9D17E; }
        .ho-btn-primary::after {
          content:""; position:absolute; inset:-70% auto -70% -36%; width:22%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.52),transparent);
          transform:skewX(-18deg);
          transition:transform .9s var(--ho-ease);
        }
        .ho-btn-primary:hover::after { transform:translateX(660%) skewX(-18deg); }

        .ho-hero-side {
          align-self:stretch;
          display:flex;
          flex-direction:column;
          justify-content:center;
          gap:18px;
          padding-top:40px;
        }
        .ho-hero-side-card {
          position:relative;
          overflow:hidden;
          min-height:180px;
          padding:20px 20px 18px;
          border:1px solid rgba(216,182,81,.18);
          background:linear-gradient(145deg,rgba(15,13,10,.76),rgba(11,10,8,.38));
          backdrop-filter:blur(14px);
          box-shadow:0 24px 58px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.025);
          transition:transform .62s var(--ho-ease),border-color .4s ease,background .4s ease;
        }
        .ho-hero-side-card::before {
          content:"";
          position:absolute; inset:8px;
          border:1px solid rgba(245,220,151,.08);
          pointer-events:none;
        }
        .ho-hero-side-card.is-active { transform:translateX(-8px); border-color:rgba(216,182,81,.52); background:linear-gradient(145deg,rgba(29,24,15,.84),rgba(13,11,8,.58)); }
        .ho-hero-side-index { display:flex; align-items:center; justify-content:space-between; gap:12px; color:#D8B651; font-size:8px; font-weight:900; letter-spacing:.18em; }
        .ho-hero-side-card h3 { margin:22px 0 0; font:600 clamp(28px,2.25vw,40px)/.96 ${DISPLAY_FONT}; color:#F8EDCF; }
        .ho-hero-side-card p { margin:11px 0 0; max-width:360px; color:rgba(255,255,255,.50); font-size:10px; line-height:1.75; }
        .ho-hero-side-card button {
          position:absolute; inset:0; width:100%; height:100%; border:0; background:transparent; cursor:pointer;
        }

        .ho-hero-foot {
          position:absolute; left:clamp(22px,5vw,88px); right:clamp(22px,5vw,88px); bottom:22px;
          z-index:10;
          display:flex; align-items:center; justify-content:space-between; gap:18px;
          color:rgba(255,255,255,.40);
          font-size:8px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
        }
        .ho-scroll-cue { display:flex; align-items:center; gap:11px; }
        .ho-scroll-cue span { width:42px; height:1px; overflow:hidden; background:rgba(255,255,255,.12); }
        .ho-scroll-cue span::after { content:""; display:block; width:100%; height:100%; background:linear-gradient(90deg,#F47822,#D8B651); animation:hoScrollLine 2.2s ease-in-out infinite; transform-origin:left; }
        @keyframes hoScrollLine { 0%,100%{transform:scaleX(.15);opacity:.4} 50%{transform:scaleX(1);opacity:1} }

        /* MARQUEE */
        .ho-marquee {
          position:relative;
          overflow:hidden;
          border-block:1px solid rgba(216,182,81,.16);
          background:#0B0907;
        }
        .ho-marquee-track { display:flex; width:max-content; animation:hoMarquee 42s linear infinite; will-change:transform; }
        .ho-marquee-seq { display:flex; flex:0 0 auto; }
        .ho-marquee-item {
          display:inline-flex; height:58px; align-items:center; gap:18px; padding-right:34px;
          color:rgba(248,236,204,.70); font-size:9px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; white-space:nowrap;
        }
        .ho-marquee-item svg { width:10px; height:10px; fill:none; stroke:#D8B651; stroke-width:1.3; }
        @keyframes hoMarquee { to { transform:translate3d(-50%,0,0); } }

        /* RITUAL */
        .ho-ritual { position:relative; background:#090807; border-bottom:1px solid rgba(255,255,255,.06); }
        .ho-ritual-shell { display:grid; grid-template-columns:minmax(0,1.12fr) minmax(360px,.88fr); }
        .ho-ritual-stage {
          position:sticky;
          top:0;
          height:100svh;
          overflow:hidden;
          isolation:isolate;
          border-right:1px solid rgba(216,182,81,.12);
          background:#090807;
        }
        .ho-ritual-image { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0; transform:scale(1.055); filter:saturate(.88) brightness(.72); transition:opacity 1s var(--ho-ease),transform 1.35s var(--ho-ease),filter .8s ease; }
        .ho-ritual-image.is-active { opacity:1; transform:scale(1.01); filter:saturate(1.02) brightness(.86); }
        .ho-ritual-stage::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,rgba(0,0,0,.14),rgba(0,0,0,.03) 48%,rgba(0,0,0,.40)),linear-gradient(180deg,rgba(0,0,0,.08),transparent 55%,rgba(0,0,0,.72)); pointer-events:none; }
        .ho-ritual-frame { position:absolute; inset:18px; z-index:4; pointer-events:none; border:1px solid rgba(245,220,151,.16); }
        .ho-ritual-stage-copy { position:absolute; z-index:6; left:clamp(26px,5vw,78px); right:clamp(26px,5vw,78px); bottom:clamp(46px,8vh,90px); }
        .ho-ritual-stage-copy .ho-kicker { color:#F2D77D; }
        .ho-ritual-stage-title { max-width:760px; margin:18px 0 0; font:600 clamp(56px,6vw,98px)/.84 ${DISPLAY_FONT}; letter-spacing:-.045em; color:#FBF1D8; }
        .ho-ritual-stage-title em { display:block; color:#D8B651; font-weight:500; }
        .ho-ritual-stage-foot { display:flex; align-items:center; justify-content:space-between; gap:18px; max-width:660px; margin-top:24px; padding-top:18px; border-top:1px solid rgba(255,255,255,.12); color:rgba(255,255,255,.52); font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
        .ho-ritual-stage-foot strong { color:#F1D77E; font-weight:900; }
        .ho-ritual-triggers { position:relative; }
        .ho-ritual-trigger {
          min-height:92svh;
          display:flex;
          flex-direction:column;
          justify-content:center;
          padding:clamp(52px,7vw,100px) clamp(26px,5vw,72px);
          border-bottom:1px solid rgba(255,255,255,.07);
          background:linear-gradient(180deg,#0B0A08,#090807);
        }
        .ho-ritual-trigger:last-child { border-bottom:0; }
        .ho-ritual-num { color:rgba(216,182,81,.68); font:italic 500 54px/1 ${DISPLAY_FONT}; }
        .ho-ritual-trigger h3 { max-width:520px; margin:24px 0 0; color:#F4E7C6; font:600 clamp(43px,4vw,68px)/.9 ${DISPLAY_FONT}; letter-spacing:-.035em; }
        .ho-ritual-trigger h3 em { display:block; color:#D8B651; font-weight:500; }
        .ho-ritual-trigger p { max-width:530px; margin:24px 0 0; color:rgba(255,255,255,.50); font-size:13px; line-height:1.9; }
        .ho-ritual-trigger-line { width:100%; max-width:430px; height:1px; margin-top:34px; background:linear-gradient(90deg,rgba(216,182,81,.80),rgba(216,182,81,.08),transparent); transform:scaleX(.28); transform-origin:left; transition:transform .8s var(--ho-ease); }
        .ho-ritual-trigger.is-active .ho-ritual-trigger-line { transform:scaleX(1); }

        /* ATELIER */
        .ho-atelier {
          position:relative;
          overflow:hidden;
          background:
            radial-gradient(circle at 86% 12%,rgba(216,182,81,.11),transparent 30%),
            linear-gradient(180deg,#0B0907,#080706 72%);
        }
        .ho-atelier::before { content:"H1"; position:absolute; right:-2vw; top:-3vw; color:rgba(216,182,81,.035); font:italic 600 24vw/.8 ${DISPLAY_FONT}; pointer-events:none; }
        .ho-atelier-inner { position:relative; z-index:2; padding:clamp(78px,7vw,118px) clamp(20px,5vw,84px); }
        .ho-section-head { display:grid; grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr); align-items:end; gap:clamp(28px,5vw,80px); margin-bottom:42px; }
        .ho-section-title { margin:17px 0 0; max-width:780px; color:#F3E6C3; font:600 clamp(58px,6vw,100px)/.85 ${DISPLAY_FONT}; letter-spacing:-.045em; }
        .ho-section-title span { display:block; color:#D8B651; font-style:italic; }
        .ho-section-copy { max-width:690px; padding-left:28px; border-left:1px solid rgba(216,182,81,.28); color:rgba(255,255,255,.53); font-size:13px; line-height:1.95; }

        .ho-atelier-grid { display:grid; grid-template-columns:minmax(0,1.36fr) minmax(280px,.64fr); gap:14px; min-height:690px; }
        .ho-atelier-main, .ho-atelier-small { position:relative; overflow:hidden; border:1px solid rgba(216,182,81,.17); background:#111; }
        .ho-atelier-main::before, .ho-atelier-small::before { content:""; position:absolute; inset:10px; z-index:3; pointer-events:none; border:1px solid rgba(244,218,146,.12); }
        .ho-atelier-main img, .ho-atelier-small img { width:100%; height:100%; object-fit:cover; transform:scale(1.02); transition:transform 1.2s var(--ho-ease),filter .7s ease; }
        .ho-atelier-main:hover img, .ho-atelier-small:hover img { transform:scale(1.065); filter:saturate(1.04) contrast(1.02); }
        .ho-atelier-main::after, .ho-atelier-small::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,.04),transparent 44%,rgba(0,0,0,.72)); pointer-events:none; }
        .ho-atelier-side { display:grid; grid-template-rows:minmax(0,1fr) minmax(0,1fr); gap:14px; }
        .ho-atelier-caption { position:absolute; z-index:5; left:24px; right:24px; bottom:22px; display:flex; align-items:end; justify-content:space-between; gap:14px; }
        .ho-atelier-caption p { margin:0; color:#F6EBCB; font:italic 500 clamp(25px,2.2vw,38px)/1 ${DISPLAY_FONT}; }
        .ho-atelier-caption span { color:rgba(255,255,255,.54); font:italic 500 13px/1 ${DISPLAY_FONT}; }

        /* COLLECTION */
        .ho-collection { position:relative; overflow:hidden; color:#171717; background:linear-gradient(180deg,#F7F2E9 0%,#EEE5D6 100%); }
        .ho-collection::before { content:""; position:absolute; left:-12%; top:2%; width:48vw; aspect-ratio:1; border-radius:50%; background:radial-gradient(circle,rgba(216,182,81,.18),transparent 68%); filter:blur(22px); pointer-events:none; }
        .ho-collection-inner { position:relative; z-index:2; padding:clamp(78px,7vw,112px) clamp(16px,4.5vw,76px); }
        .ho-collection-head { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:28px; align-items:end; padding-bottom:30px; border-bottom:1px solid rgba(23,23,23,.11); }
        .ho-collection-title { margin:13px 0 0; font:600 clamp(62px,6.5vw,106px)/.84 ${DISPLAY_FONT}; letter-spacing:-.045em; color:#171717; }
        .ho-collection-sub { max-width:720px; margin:17px 0 0; color:rgba(23,23,23,.50); font-size:12px; font-weight:600; line-height:1.82; }
        .ho-text-link { display:inline-flex; align-items:center; gap:10px; padding-bottom:5px; border-bottom:1px solid rgba(23,23,23,.28); color:#171717; text-decoration:none; font-size:8px; font-weight:900; letter-spacing:.11em; text-transform:uppercase; transition:gap .32s ease,color .32s ease,border-color .32s ease; }
        .ho-text-link:hover { gap:15px; color:#8A6518; border-color:#A47B1F; }

        .ho-products { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin-top:30px; }
        .ho-product {
          --p-bg:#17130E; --p-bg2:#272015; --p-accent:#D6AF51;
          position:relative; min-width:0; overflow:hidden; border-radius:24px;
          color:#F5E8C7; text-decoration:none;
          background:linear-gradient(145deg,var(--p-bg2),var(--p-bg));
          border:1px solid rgba(122,89,26,.22);
          box-shadow:0 20px 48px rgba(43,31,15,.12);
          transition:transform .72s var(--ho-ease),box-shadow .52s ease,border-color .42s ease;
        }
        .ho-product:nth-child(4n+2){--p-bg:#102018;--p-bg2:#1D3528;--p-accent:#D5B865}
        .ho-product:nth-child(4n+3){--p-bg:#1D1115;--p-bg2:#351D26;--p-accent:#DAAC6E}
        .ho-product:nth-child(4n+4){--p-bg:#101726;--p-bg2:#1F3049;--p-accent:#CDB06D}
        .ho-product::before { content:""; position:absolute; inset:7px; z-index:1; border-radius:18px; border:1px solid rgba(237,209,135,.12); pointer-events:none; }
        .ho-product:hover { transform:translateY(-7px); border-color:rgba(170,124,34,.44); box-shadow:0 30px 66px rgba(39,28,14,.18); }
        .ho-product-media { position:relative; z-index:2; aspect-ratio:1/.72; margin:11px 11px 0; overflow:hidden; border-radius:15px; background:#080808; border:1px solid rgba(237,210,143,.14); }
        .ho-product-media img { width:100%; height:100%; object-fit:cover; transform:scale(1.015); transition:transform 1.05s var(--ho-ease),filter .6s ease; }
        .ho-product:hover .ho-product-media img { transform:scale(1.065); filter:saturate(1.035) contrast(1.02); }
        .ho-product-media::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,.03),transparent 58%,rgba(0,0,0,.52)); }
        .ho-product-tag { position:absolute; z-index:5; top:18px; left:18px; display:inline-flex; min-height:25px; align-items:center; padding:0 10px; border-radius:99px; border:1px solid rgba(255,237,170,.22); background:rgba(8,8,8,.56); backdrop-filter:blur(8px); color:#F0D57C; font-size:6px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
        .ho-product-number { position:absolute; z-index:5; right:17px; bottom:13px; color:rgba(255,255,255,.72); font:italic 500 13px/1 ${DISPLAY_FONT}; }
        .ho-product-seal { position:absolute; z-index:6; right:16px; top:16px; display:grid; width:38px; height:38px; place-items:center; border-radius:50%; border:1px solid rgba(255,235,162,.44); background:radial-gradient(circle at 34% 30%,#F3DD99,#BC8429 58%,#6E4208); color:#FFF0B9; font:700 15px/1 ${DISPLAY_FONT}; box-shadow:0 8px 18px rgba(0,0,0,.22); transition:transform .55s var(--ho-ease); }
        .ho-product:hover .ho-product-seal { transform:rotate(8deg) scale(1.05); }
        .ho-product-body { position:relative; z-index:3; padding:18px 18px 18px; }
        .ho-product-category { margin:0; color:var(--p-accent); font-size:7px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
        .ho-product-title { margin:8px 0 0; color:#F6E9C7; font:600 clamp(24px,1.65vw,31px)/.96 ${DISPLAY_FONT}; letter-spacing:-.028em; }
        .ho-product-desc { margin:10px 0 0; color:rgba(255,255,255,.43); font-size:9px; line-height:1.65; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .ho-product-meta { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:16px; padding-top:13px; border-top:1px solid rgba(255,255,255,.09); }
        .ho-product-price-label { margin:0; color:rgba(255,255,255,.30); font-size:6px; font-weight:900; letter-spacing:.11em; text-transform:uppercase; }
        .ho-product-price { margin:4px 0 0; color:#F0D982; font-size:16px; font-weight:900; }
        .ho-product-arrow { display:grid; width:34px; height:34px; place-items:center; border-radius:50%; border:1px solid rgba(233,204,119,.27); color:#F0D982; transition:transform .4s var(--ho-ease),background .3s ease,color .3s ease; }
        .ho-product-arrow svg { width:15px; height:15px; fill:none; stroke:currentColor; stroke-width:1.7; }
        .ho-product:hover .ho-product-arrow { transform:translateX(4px); color:#111; background:#D8B651; }
        .ho-product-sheen { position:absolute; z-index:8; top:-20%; bottom:-20%; left:-25%; width:13%; opacity:0; pointer-events:none; transform:skewX(-18deg); background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),rgba(255,236,169,.22),rgba(255,255,255,.05),transparent); }
        .ho-product:hover .ho-product-sheen { opacity:1; animation:hoSheen 1s var(--ho-ease) both; }
        @keyframes hoSheen { to { transform:skewX(-18deg) translateX(980%); } }

        .ho-skeleton { overflow:hidden; border-radius:24px; border:1px solid rgba(216,182,81,.14); background:#17140F; padding:11px; }
        .ho-skeleton-media { aspect-ratio:1/.72; border-radius:15px; background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.08),rgba(255,255,255,.035)); background-size:220% 100%; animation:hoSkeleton 1.5s linear infinite; }
        .ho-skeleton-line { height:9px; margin-top:14px; background:rgba(255,255,255,.06); }
        @keyframes hoSkeleton { to { background-position:-220% 0; } }

        /* FINALE */
        .ho-finale { position:relative; min-height:92svh; overflow:hidden; isolation:isolate; display:flex; align-items:center; background:#080706; }
        .ho-finale-bg { position:absolute; inset:0; z-index:-4; width:100%; height:100%; object-fit:cover; filter:saturate(.90) brightness(.47); transform:scale(1.04); }
        .ho-finale::after { content:""; position:absolute; inset:0; z-index:-3; background:linear-gradient(90deg,rgba(5,4,3,.97),rgba(5,4,3,.80) 48%,rgba(5,4,3,.36)),linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.68)); }
        .ho-finale-inner { width:100%; padding:clamp(90px,9vw,140px) clamp(22px,6vw,100px); }
        .ho-finale-title { max-width:1080px; margin:20px 0 0; color:#F7EBCB; font:600 clamp(72px,9vw,150px)/.78 ${DISPLAY_FONT}; letter-spacing:-.05em; }
        .ho-finale-title span { display:block; color:#D8B651; font-style:italic; }
        .ho-finale-copy { max-width:650px; margin:28px 0 0; color:rgba(255,255,255,.58); font-size:13px; line-height:1.9; }
        .ho-finale-rule { width:min(520px,64vw); height:1px; margin-top:36px; background:linear-gradient(90deg,#F47822,#D8B651 56%,transparent); }

        @media (max-width:1279px) {
          .ho-products { grid-template-columns:repeat(3,minmax(0,1fr)); }
          .ho-hero-inner { grid-template-columns:minmax(0,1fr) minmax(320px,.72fr); }
        }

        @media (max-width:1023px) {
          .ho-hero-inner { grid-template-columns:1fr; gap:36px; padding:116px 24px 72px; }
          .ho-hero-copy { max-width:820px; }
          .ho-hero-side { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); padding-top:0; }
          .ho-hero-side-card { min-height:158px; }
          .ho-hero-side-card.is-active { transform:translateY(-5px); }
          .ho-hero-foot { position:relative; left:auto; right:auto; bottom:auto; margin:-34px 24px 0; padding-bottom:28px; }

          .ho-ritual-shell { grid-template-columns:1fr; }
          .ho-ritual-stage { position:relative; height:72svh; min-height:560px; border-right:0; border-bottom:1px solid rgba(216,182,81,.12); }
          .ho-ritual-triggers { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
          .ho-ritual-trigger { min-height:0; padding:48px 28px; }

          .ho-section-head { grid-template-columns:1fr; gap:28px; }
          .ho-section-copy { max-width:760px; }
          .ho-atelier-grid { grid-template-columns:1fr; min-height:0; }
          .ho-atelier-main { min-height:560px; }
          .ho-atelier-side { grid-template-columns:1fr 1fr; grid-template-rows:none; }
          .ho-atelier-small { min-height:350px; }

          .ho-collection-head { grid-template-columns:1fr; align-items:start; }
          .ho-products { grid-template-columns:repeat(2,minmax(0,1fr)); }
        }

        @media (max-width:767px) {
          .ho-progress { height:1px; }
          .ho-hero { min-height:100svh; }
          .ho-hero-slide { object-position:64% center !important; transform:scale(1.06); }
          .ho-hero-slide.is-active { transform:scale(1.08); }
          .ho-hero-overlay { background:linear-gradient(180deg,rgba(4,4,4,.12) 0%,rgba(4,4,4,.30) 28%,rgba(4,4,4,.76) 62%,rgba(4,4,4,.98) 100%); }
          .ho-hero-overlay::after { display:none; }
          .ho-hero-glint { display:none; }
          .ho-hero-inner { min-height:100svh; display:flex; flex-direction:column; justify-content:flex-end; padding:106px 16px 38px; }
          .ho-hero-title { font-size:clamp(72px,25vw,108px); line-height:.72; }
          .ho-hero-deck { grid-template-columns:1fr; gap:14px; margin-top:29px; padding-top:20px; }
          .ho-hero-deck p { font-size:12px; line-height:1.78; }
          .ho-hero-micro { padding:0 0 0 16px; font-size:8px; }
          .ho-actions { display:grid; grid-template-columns:1fr; width:100%; margin-top:25px; }
          .ho-btn { width:100%; min-height:54px; }
          .ho-hero-side { width:100%; display:flex; gap:10px; overflow-x:auto; padding:4px 0 2px; scroll-snap-type:x mandatory; scrollbar-width:none; }
          .ho-hero-side::-webkit-scrollbar { display:none; }
          .ho-hero-side-card { flex:0 0 78vw; min-height:142px; scroll-snap-align:start; }
          .ho-hero-side-card.is-active { transform:none; }
          .ho-hero-side-card h3 { font-size:29px; }
          .ho-hero-foot { display:none; }

          .ho-marquee-item { height:50px; padding-right:26px; font-size:8px; letter-spacing:.11em; }

          .ho-ritual-stage { height:68svh; min-height:470px; }
          .ho-ritual-stage-copy { left:18px; right:18px; bottom:28px; }
          .ho-ritual-stage-title { font-size:clamp(47px,13vw,66px); }
          .ho-ritual-stage-foot { margin-top:18px; padding-top:13px; font-size:7px; }
          .ho-ritual-triggers { display:flex; overflow-x:auto; gap:10px; padding:14px 14px 18px; scroll-snap-type:x mandatory; scrollbar-width:none; background:#090807; }
          .ho-ritual-triggers::-webkit-scrollbar { display:none; }
          .ho-ritual-trigger { flex:0 0 82vw; min-height:340px; padding:32px 24px; border:1px solid rgba(216,182,81,.14); scroll-snap-align:center; }
          .ho-ritual-num { font-size:40px; }
          .ho-ritual-trigger h3 { font-size:42px; }
          .ho-ritual-trigger p { font-size:11px; line-height:1.75; }

          .ho-atelier-inner { padding:64px 14px; }
          .ho-section-title { font-size:clamp(52px,15vw,72px); }
          .ho-section-copy { padding:18px 0 0; border-left:0; border-top:1px solid rgba(216,182,81,.25); font-size:12px; line-height:1.82; }
          .ho-atelier-main { min-height:430px; }
          .ho-atelier-side { grid-template-columns:1fr; }
          .ho-atelier-small { min-height:300px; }
          .ho-atelier-caption { left:18px; right:18px; bottom:17px; }
          .ho-atelier-caption p { font-size:28px; }

          .ho-collection-inner { padding:62px 12px; }
          .ho-collection-title { font-size:clamp(54px,16vw,74px); }
          .ho-products { display:flex; gap:12px; overflow-x:auto; margin-left:-12px; margin-right:-12px; padding:4px 12px 18px; scroll-snap-type:x mandatory; scrollbar-width:none; }
          .ho-products::-webkit-scrollbar { display:none; }
          .ho-product, .ho-skeleton { flex:0 0 82vw; max-width:360px; scroll-snap-align:center; }
          .ho-product:hover { transform:none; }
          .ho-product:hover .ho-product-media img { transform:scale(1.015); filter:none; }
          .ho-product:hover .ho-product-seal { transform:none; }
          .ho-product:hover .ho-product-arrow { transform:none; }
          .ho-product:hover .ho-product-sheen { animation:none; opacity:0; }

          .ho-finale { min-height:88svh; }
          .ho-finale-inner { padding:78px 16px; }
          .ho-finale-title { font-size:clamp(65px,20vw,96px); }
          .ho-finale-copy { font-size:12px; line-height:1.8; }
        }

        @media (prefers-reduced-motion:reduce) {
          .ho-page *, .ho-page *::before, .ho-page *::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; }
          .ho-reveal { opacity:1 !important; transform:none !important; }
        }
      `}</style>

      <div className="ho-progress" aria-hidden="true">
        <span style={{ "--ho-progress": scrollProgress }} />
      </div>

      <section
        className="ho-hero"
        onPointerMove={handleHeroPointerMove}
        onPointerLeave={(event) => {
          event.currentTarget.style.setProperty("--ho-pointer-x", "50%");
          event.currentTarget.style.setProperty("--ho-pointer-y", "50%");
          event.currentTarget.style.setProperty("--ho-parallax-x", "0px");
          event.currentTarget.style.setProperty("--ho-parallax-y", "0px");
        }}
      >
        <div className="ho-hero-media" aria-hidden="true">
          {HERO_SLIDES.map((slide, index) => (
            <img
              key={slide.src}
              src={slide.src}
              alt=""
              style={{ objectPosition: slide.position }}
              className={`ho-hero-slide ${heroSlide === index ? "is-active" : ""}`}
              onLoad={() => index === 0 && setHeroReady(true)}
            />
          ))}
        </div>

        <div className="ho-hero-overlay" aria-hidden="true" />
        <div className="ho-grain" aria-hidden="true" />
        <div className="ho-hero-glint" aria-hidden="true" />

        <div className="ho-hero-inner">
          <div className={`ho-hero-copy ${heroReady ? "ho-reveal is-visible" : "ho-reveal"}`}>
            <p className="ho-kicker">HAMPORIUM PRIVATE COLLECTION</p>

            <h1 className="ho-hero-title">
              HAMPER
              <span>ONE</span>
            </h1>

            <div className="ho-hero-deck">
              <p>
                A rare edit of signature hampers for moments where the gift itself
                needs to feel exceptional — curated, presented and experienced as one.
              </p>
              <div className="ho-hero-micro">
                PRIVATE GIFTING
                <br />
                ELEVATED
              </div>
            </div>

            <div className="ho-actions">
              <button type="button" className="ho-btn ho-btn-primary" onClick={handleCollectionJump}>
                Explore The Private Edit
                <ArrowIcon direction="down" />
              </button>

              <Link to="/custom-hamper" className="ho-btn">
                Create Bespoke
                <ArrowIcon />
              </Link>
            </div>
          </div>

          <div className="ho-hero-side" aria-label="HAMPER ONE highlights">
            {HERO_SLIDES.map((slide, index) => (
              <article
                key={slide.title}
                className={`ho-hero-side-card ${heroSlide === index ? "is-active" : ""}`}
              >
                <div className="ho-hero-side-index">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{heroSlide === index ? "NOW" : "VIEW"}</span>
                </div>
                <h3>{slide.title}</h3>
                <p>{slide.copy}</p>
                <button
                  type="button"
                  aria-label={`Show ${slide.title}`}
                  onClick={() => setHeroSlide(index)}
                />
              </article>
            ))}
          </div>
        </div>

        <div className="ho-hero-foot" aria-hidden="true">
          <div className="ho-scroll-cue">
            <span />
            Scroll to enter the private experience
          </div>
          <div>H1 · PRIVATE SERIES</div>
        </div>
      </section>

      <section className="ho-marquee" aria-hidden="true">
        <div className="ho-marquee-track">
          {[0, 1].map((sequence) => (
            <div className="ho-marquee-seq" key={sequence}>
              {[
                "Rare Selections",
                "Signature Presentation",
                "Bespoke Direction",
                "Private Gifting",
                "Refined Finishing",
                "Elevated Unboxing",
                "HAMPER ONE",
              ].map((item) => (
                <div className="ho-marquee-item" key={`${sequence}-${item}`}>
                  {item}
                  <StarMark />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="ho-ritual">
        <div className="ho-ritual-shell">
          <div className="ho-ritual-stage">
            {ritualSlides.map((slide, index) => (
              <img
                key={`${slide.number}-${slide.image}`}
                src={slide.image}
                alt=""
                className={`ho-ritual-image ${ritualActive === index ? "is-active" : ""}`}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            ))}
            <div className="ho-ritual-frame" aria-hidden="true" />

            <div className="ho-ritual-stage-copy">
              <p className="ho-kicker">THE HAMPER ONE STANDARD</p>
              <h2 className="ho-ritual-stage-title">
                {currentRitual.title}
                <em>{currentRitual.accent}</em>
              </h2>
              <div className="ho-ritual-stage-foot">
                <strong>{currentRitual.number} / 04</strong>
                <span>{currentRitual.foot}</span>
              </div>
            </div>
          </div>

          <div className="ho-ritual-triggers">
            {ritualSlides.map((slide, index) => (
              <article
                key={slide.number}
                data-ho-ritual-trigger={index}
                className={`ho-ritual-trigger ${ritualActive === index ? "is-active" : ""}`}
                onMouseEnter={() => setRitualActive(index)}
                onFocus={() => setRitualActive(index)}
                tabIndex={0}
              >
                <span className="ho-ritual-num">{slide.number}</span>
                <p className="ho-kicker" style={{ marginTop: 22 }}>{slide.eyebrow}</p>
                <h3>
                  {slide.title}
                  <em>{slide.accent}</em>
                </h3>
                <p>{slide.body}</p>
                <span className="ho-ritual-trigger-line" aria-hidden="true" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ho-atelier">
        <div className="ho-atelier-inner">
          <div className="ho-section-head">
            <div className="ho-reveal">
              <p className="ho-kicker">THE PRIVATE ATELIER</p>
              <h2 className="ho-section-title">
                Composed like
                <span>a signature piece.</span>
              </h2>
            </div>

            <p className="ho-section-copy ho-reveal ho-delay-1">
              HAMPER ONE is built around restraint, rarity and presentation. Every
              composition is considered as a complete experience — from the first
              visual impression to the final reveal.
            </p>
          </div>

          <div className="ho-atelier-grid">
            <div className="ho-atelier-main ho-reveal">
              <img
                src={getProductImage(products[0] || {}) || HERO_SLIDES[0].src}
                alt={products[0]?.name || "HAMPER ONE signature composition"}
                loading="lazy"
                decoding="async"
              />
              <div className="ho-atelier-caption">
                <p>Every detail earns its place.</p>
                <span>01</span>
              </div>
            </div>

            <div className="ho-atelier-side">
              <div className="ho-atelier-small ho-reveal ho-delay-1">
                <img
                  src={getProductImage(products[1] || {}) || HERO_SLIDES[1].src}
                  alt={products[1]?.name || "HAMPER ONE detail"}
                  loading="lazy"
                  decoding="async"
                />
                <div className="ho-atelier-caption">
                  <p>Luxury without excess.</p>
                  <span>02</span>
                </div>
              </div>

              <div className="ho-atelier-small ho-reveal ho-delay-2">
                <img
                  src={getProductImage(products[2] || {}) || HERO_SLIDES[2].src}
                  alt={products[2]?.name || "HAMPER ONE presentation"}
                  loading="lazy"
                  decoding="async"
                />
                <div className="ho-atelier-caption">
                  <p>Made for remarkable moments.</p>
                  <span>03</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="hamper-one-collection" className="ho-collection">
        <div className="ho-collection-inner">
          <div className="ho-collection-head">
            <div className="ho-reveal">
              <p className="ho-kicker" style={{ color: "#9D7318" }}>HAMPER ONE COLLECTION</p>
              <h2 className="ho-collection-title">The Private Edit</h2>
              <p className="ho-collection-sub">
                Hampers tagged for HAMPER ONE in Product Master appear here automatically.
              </p>
            </div>

            <Link to="/gifts" className="ho-text-link ho-reveal ho-delay-1">
              Browse Standard Collection
              <span>→</span>
            </Link>
          </div>

          {error && (
            <div className="mt-7 border-l-[3px] border-red-500 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="ho-products">
              {Array.from({ length: 8 }).map((_, index) => (
                <HamperOneSkeleton key={index} />
              ))}
            </div>
          ) : products.length ? (
            <div className="ho-products">
              {products.map((product, index) => (
                <HamperOneProductCard
                  key={product._id || product.slug || index}
                  product={product}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 border border-black/[0.1] bg-[#E8DFCF] px-6 py-16 text-center ho-reveal">
              <p className="ho-display text-[36px] font-semibold">
                The private edit is being prepared.
              </p>
              <p className="mx-auto mt-3 max-w-lg text-[12px] leading-6 text-black/45">
                Mark ready-made products as HAMPER ONE in Product Master and they will appear here automatically.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="ho-finale">
        <img
          className="ho-finale-bg"
          src={HERO_SLIDES[1].src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
        />
        <div className="ho-finale-inner">
          <div className="ho-reveal">
            <p className="ho-kicker">BEYOND THE PRIVATE EDIT</p>
            <h2 className="ho-finale-title">
              Make the gift
              <span>distinctly yours.</span>
            </h2>
            <p className="ho-finale-copy">
              Begin with HAMPORIUM&apos;s build-your-own studio, or explore our managed
              Wedding and Corporate gifting experiences for larger requirements.
            </p>
            <div className="ho-finale-rule" aria-hidden="true" />

            <div className="ho-actions">
              <Link to="/custom-hamper" className="ho-btn ho-btn-primary">
                Build Bespoke
                <ArrowIcon />
              </Link>
              <Link to="/weddings" className="ho-btn">
                Wedding Concierge
                <ArrowIcon />
              </Link>
              <Link to="/corporate" className="ho-btn">
                Corporate Gifting
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

const HamperOneProductCard = ({ product, index }) => {
  const image = getProductImage(product);
  const price = Number(
    product.minPrice ?? product.price ?? product.sellingPrice ?? product.salePrice ?? 0
  );

  const destination = product.slug ? `/products/${product.slug}` : "/hamper-one";

  return (
    <Link to={destination} className="ho-product ho-reveal">
      <span className="ho-product-sheen" aria-hidden="true" />

      <div className="ho-product-media">
        <img src={image} alt={product.name || "HAMPER ONE hamper"} loading="lazy" decoding="async" />
        <span className="ho-product-tag">Private Edit</span>
        <span className="ho-product-seal">H1</span>
        <span className="ho-product-number">No. {String(index + 1).padStart(2, "0")}</span>
      </div>

      <div className="ho-product-body">
        <p className="ho-product-category">
          {product.category?.name || "Private Collection"}
        </p>
        <h3 className="ho-product-title">{product.name || "HAMPER ONE Hamper"}</h3>

        {product.shortDescription && (
          <p className="ho-product-desc">{product.shortDescription}</p>
        )}

        <div className="ho-product-meta">
          <div>
            <p className="ho-product-price-label">From</p>
            <p className="ho-product-price">
              {price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Private Edit"}
            </p>
          </div>
          <span className="ho-product-arrow" aria-hidden="true">
            <ArrowIcon />
          </span>
        </div>
      </div>
    </Link>
  );
};

const HamperOneSkeleton = () => (
  <div className="ho-skeleton">
    <div className="ho-skeleton-media" />
    <div className="px-2 pb-2 pt-4">
      <div className="ho-skeleton-line w-20" />
      <div className="ho-skeleton-line h-7 w-3/4" />
      <div className="ho-skeleton-line mt-4 h-px w-full" />
      <div className="mt-3 flex items-center justify-between">
        <div className="ho-skeleton-line mt-0 h-5 w-16" />
        <div className="h-8 w-8 rounded-full bg-white/[0.07]" />
      </div>
    </div>
  </div>
);

export default HamperOne;
