import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link, useNavigate } from "react-router-dom";

import api from "../../api/api.js";

import hamperFestiveHero from "../../assets/images/hamper_one_festive.webp";
import hamperExecutiveHero from "../../assets/images/hamper_one_executive.webp";
import hamperWeddingHero from "../../assets/images/hamper_one_wedding.webp";
import hamperOneLuxury from "../../assets/images/hamper_one_luxury.webp";
import bestsellerCelebrationLuxury from "../../assets/images/bestseller_celebration_luxury.webp";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const HERO_SCENES = [
  {
    image: hamperOneLuxury,
    label: "THE PRIVATE SERIES",
    title: "The First Impression",
    note: "A composition designed to stop the room before it is even opened.",
    position: "62% 50%",
  },
  {
    image: hamperExecutiveHero,
    label: "THE SIGNATURE EDIT",
    title: "Quietly Impeccable",
    note: "Deep tones, precise finishing and a presentation that feels intentional.",
    position: "58% 52%",
  },
  {
    image: hamperWeddingHero,
    label: "THE PERSONAL EDIT",
    title: "Made To Be Remembered",
    note: "A more intimate expression for moments that deserve their own language.",
    position: "61% 50%",
  },
];

const STORY_CHAPTERS = [
  {
    number: "01",
    kicker: "SELECTION",
    title: "Nothing enters by accident.",
    copy: "Every object earns its place through taste, texture and how it contributes to the full reveal.",
    image: hamperFestiveHero,
    line: "CURATED WITH RESTRAINT",
    position: "center 50%",
  },
  {
    number: "02",
    kicker: "COMPOSITION",
    title: "The box is part of the gift.",
    copy: "Layering, spacing, ribbon, colour and proportion are treated as one visual composition — not an afterthought.",
    image: hamperExecutiveHero,
    line: "COMPOSED TO IMPRESS",
    position: "center 48%",
  },
  {
    number: "03",
    kicker: "REVEAL",
    title: "The moment opens slowly.",
    copy: "HAMPER ONE is designed around the pause before discovery — the detail that makes unboxing feel ceremonial.",
    image: hamperWeddingHero,
    line: "BUILT FOR THE REVEAL",
    position: "center 46%",
  },
];

const PRINCIPLES = [
  {
    number: "I",
    title: "Rare, not crowded",
    copy: "Fewer things. Better things. Every composition is edited until nothing feels unnecessary.",
    image: hamperFestiveHero,
  },
  {
    number: "II",
    title: "Luxury without noise",
    copy: "Material, proportion and finishing do the work — not excessive decoration.",
    image: hamperExecutiveHero,
  },
  {
    number: "III",
    title: "Personal by design",
    copy: "The occasion, person and gesture shape the final direction of the hamper.",
    image: hamperWeddingHero,
  },
];

const FALLBACK_IMAGE = hamperOneLuxury || bestsellerCelebrationLuxury;

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
  const candidates = [
    product?.images?.[0]?.url,
    product?.images?.[0],
    product?.image?.url,
    product?.image,
    product?.thumbnail?.url,
    product?.thumbnail,
    product?.skus?.[0]?.images?.[0]?.url,
    product?.skus?.[0]?.images?.[0],
  ];

  for (const candidate of candidates) {
    const image = resolveImage(candidate);
    if (image) return image;
  }

  return FALLBACK_IMAGE;
};

const getProductPrice = (product) => {
  const value =
    product?.minPrice ??
    product?.price ??
    product?.sellingPrice ??
    product?.salePrice ??
    0;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

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

const ArrowIcon = ({ down = false }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={down ? "is-down" : ""}>
    <path d="M4 12h15" />
    <path d="m14 7 5 5-5 5" />
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.4c.72 5.7 3.3 8.28 9 9-5.7.72-8.28 3.3-9 9-.72-5.7-3.3-8.28-9-9 5.7-.72 8.28-3.3 9-9Z" />
  </svg>
);

const createRouteCurtain = (to, navigate, reducedMotion) => {
  if (reducedMotion || typeof document === "undefined") {
    navigate(to);
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "h1-route-curtain";
  overlay.innerHTML = `
    <div class="h1-route-panel h1-route-panel-left"></div>
    <div class="h1-route-panel h1-route-panel-right"></div>
    <div class="h1-route-line"></div>
    <div class="h1-route-seal"><span>H1</span></div>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add("is-closing"));
  });

  window.setTimeout(() => {
    navigate(to);
    overlay.classList.add("is-opening");
  }, 430);

  window.setTimeout(() => overlay.remove(), 860);
};

const CinematicLink = ({ to, children, className = "", reducedMotion, ...props }) => {
  const navigate = useNavigate();

  const handleClick = (event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target === "_blank"
    ) {
      return;
    }

    event.preventDefault();
    createRouteCurtain(to, navigate, reducedMotion);
  };

  return (
    <Link to={to} className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
};

const HamperOne = () => {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef(null);
  const pointerFrameRef = useRef(0);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [heroScene, setHeroScene] = useState(0);
  const [activeChapter, setActiveChapter] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
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
            "The private edit is taking a little longer to arrive."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    [...HERO_SCENES, ...STORY_CHAPTERS, ...PRINCIPLES].forEach((scene) => {
      const image = new Image();
      image.src = scene.image;
    });
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setIntroDone(true);
      return undefined;
    }

    const timer = window.setTimeout(() => setIntroDone(true), 1600);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setHeroScene((current) => (current + 1) % HERO_SCENES.length);
    }, 6200);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      root.style.setProperty("--h1-progress", String(Math.min(1, Math.max(0, progress))));
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
    const elements = Array.from(document.querySelectorAll("[data-h1-reveal]"));
    if (!elements.length) return undefined;

    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      elements.forEach((element) => element.classList.add("is-visible"));
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
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [loading, products.length, reducedMotion]);

  useEffect(() => {
    const chapters = Array.from(document.querySelectorAll("[data-h1-chapter]"));
    if (!chapters.length || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number(entry.target.getAttribute("data-h1-chapter"));
          if (Number.isFinite(index)) setActiveChapter(index);
        });
      },
      { threshold: 0.56, rootMargin: "-12% 0px -12% 0px" }
    );

    chapters.forEach((chapter) => observer.observe(chapter));
    return () => observer.disconnect();
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      if (reducedMotion) return;
      const host = event.currentTarget;
      const rect = host.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      if (pointerFrameRef.current) cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = requestAnimationFrame(() => {
        host.style.setProperty("--h1-mx", `${x}%`);
        host.style.setProperty("--h1-my", `${y}%`);
        host.style.setProperty("--h1-px", `${(x - 50) * 0.065}px`);
        host.style.setProperty("--h1-py", `${(y - 50) * 0.045}px`);
      });
    },
    [reducedMotion]
  );

  const heroProducts = useMemo(() => products.slice(0, 8), [products]);

  const jumpToCollection = () => {
    document.getElementById("h1-private-edit")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <main
      ref={rootRef}
      className="h1-page min-h-screen overflow-x-clip bg-[#070604] text-[#F8F0DC]"
      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700;800&display=swap');

        .h1-page {
          --gold:#D7B24A;
          --gold-bright:#F2DA82;
          --cream:#F8F0DC;
          --ink:#070604;
          --orange:#F47822;
          --ease:cubic-bezier(.16,1,.3,1);
          --h1-progress:0;
          --h1-mx:50%;
          --h1-my:50%;
          --h1-px:0px;
          --h1-py:0px;
          background:#070604;
          -webkit-font-smoothing:antialiased;
          text-rendering:optimizeLegibility;
        }

        .h1-page *, .h1-page *::before, .h1-page *::after { box-sizing:border-box; }
        .h1-page a, .h1-page button { -webkit-tap-highlight-color:transparent; }
        .h1-page :where(a,button):focus-visible { outline:2px solid var(--gold-bright); outline-offset:5px; }
        .h1-display { font-family:${DISPLAY_FONT}; }

        .h1-scroll-progress {
          position:fixed; inset:0 0 auto 0; z-index:200; height:2px;
          pointer-events:none; background:rgba(255,255,255,.025);
        }
        .h1-scroll-progress::after {
          content:""; display:block; width:100%; height:100%;
          transform:scaleX(var(--h1-progress)); transform-origin:left center;
          background:linear-gradient(90deg,var(--orange),var(--gold),var(--gold-bright));
          box-shadow:0 0 18px rgba(215,178,74,.36);
        }

        .h1-intro {
          position:fixed; inset:0; z-index:9999; display:grid; place-items:center;
          overflow:hidden; background:#070604; pointer-events:none;
          transition:opacity .5s ease .08s, visibility .5s ease .08s;
        }
        .h1-intro.is-done { opacity:0; visibility:hidden; }
        .h1-intro::before, .h1-intro::after {
          content:""; position:absolute; inset:0 50% 0 0; background:#0B0907;
          transform-origin:left center; animation:h1IntroLeft 1.42s .18s var(--ease) both;
        }
        .h1-intro::after {
          inset:0 0 0 50%; transform-origin:right center;
          animation-name:h1IntroRight;
        }
        .h1-intro-seal {
          position:relative; z-index:3; display:grid; width:112px; height:112px; place-items:center;
          border-radius:50%; border:1px solid rgba(245,220,150,.54);
          color:#291A05; font:700 38px/1 ${DISPLAY_FONT};
          background:radial-gradient(circle at 34% 28%,#FFF3B8 0%,#E6C55F 28%,#BD8422 62%,#664008 100%);
          box-shadow:0 24px 70px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,255,255,.5);
          animation:h1IntroSeal 1.18s .05s var(--ease) both;
        }
        .h1-intro-seal::after { content:""; position:absolute; inset:10px; border:1px dashed rgba(82,52,9,.44); border-radius:50%; }
        .h1-intro-copy { position:absolute; z-index:4; bottom:9vh; color:rgba(255,255,255,.42); font-size:8px; font-weight:900; letter-spacing:.24em; text-transform:uppercase; }
        @keyframes h1IntroSeal { 0%{opacity:0;transform:scale(.35) rotate(-28deg)} 58%{opacity:1;transform:scale(1.08) rotate(4deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes h1IntroLeft { 0%,58%{transform:translateX(0)} 100%{transform:translateX(-104%)} }
        @keyframes h1IntroRight { 0%,58%{transform:translateX(0)} 100%{transform:translateX(104%)} }

        .h1-hero {
          position:relative; min-height:100svh; overflow:hidden; isolation:isolate;
          display:flex; align-items:stretch; background:#070604;
        }
        .h1-hero-media { position:absolute; inset:0; z-index:-8; overflow:hidden; }
        .h1-hero-image {
          position:absolute; inset:-2.5%; width:105%; height:105%; object-fit:cover;
          opacity:0; filter:saturate(.82) contrast(1.08) brightness(.52);
          transform:translate3d(var(--h1-px),var(--h1-py),0) scale(1.055);
          transition:opacity 1.3s var(--ease), transform 6.8s var(--ease), filter 1.2s ease;
          will-change:opacity,transform;
        }
        .h1-hero-image.is-active {
          opacity:1; transform:translate3d(var(--h1-px),var(--h1-py),0) scale(1.115);
          filter:saturate(.96) contrast(1.05) brightness(.69);
        }
        .h1-hero-wash {
          position:absolute; inset:0; z-index:-7; pointer-events:none;
          background:
            linear-gradient(90deg,rgba(5,4,3,.98) 0%,rgba(5,4,3,.91) 29%,rgba(5,4,3,.55) 55%,rgba(5,4,3,.16) 80%,rgba(5,4,3,.30) 100%),
            linear-gradient(180deg,rgba(0,0,0,.18),transparent 47%,rgba(0,0,0,.72));
        }
        .h1-hero-wash::after {
          content:""; position:absolute; inset:0;
          background:radial-gradient(circle 410px at var(--h1-mx) var(--h1-my),rgba(255,225,132,.105),rgba(215,178,74,.025) 42%,transparent 72%);
        }
        .h1-grain { position:absolute; inset:0; z-index:-5; pointer-events:none; opacity:.07; background-image:radial-gradient(rgba(255,255,255,.9) .45px,transparent .45px); background-size:7px 7px; mix-blend-mode:soft-light; }
        .h1-hero-orbit {
          position:absolute; z-index:-3; right:-11vw; top:-13vw; width:min(56vw,820px); aspect-ratio:1; border-radius:50%;
          border:1px solid rgba(236,208,122,.13); box-shadow:0 0 0 48px rgba(215,178,74,.022),0 0 0 96px rgba(215,178,74,.016);
          animation:h1Orbit 22s linear infinite; pointer-events:none;
        }
        .h1-hero-orbit::before, .h1-hero-orbit::after { content:""; position:absolute; border-radius:50%; background:#E5C969; box-shadow:0 0 24px rgba(229,201,105,.55); }
        .h1-hero-orbit::before { width:8px;height:8px;top:14%;left:12%; }
        .h1-hero-orbit::after { width:5px;height:5px;right:10%;bottom:18%; }
        @keyframes h1Orbit { to{transform:rotate(360deg)} }

        .h1-hero-shell {
          width:100%; min-height:100svh; display:grid;
          grid-template-columns:minmax(0,1.15fr) minmax(320px,.44fr);
          gap:clamp(40px,6vw,100px); align-items:center;
          padding:clamp(118px,10vw,160px) clamp(22px,5vw,84px) clamp(76px,7vw,104px);
        }
        .h1-hero-copy { position:relative; max-width:1040px; }
        .h1-eyebrow { display:flex; align-items:center; gap:12px; color:var(--gold-bright); font-size:9px; font-weight:900; letter-spacing:.28em; text-transform:uppercase; }
        .h1-eyebrow::before { content:""; width:48px; height:1px; background:linear-gradient(90deg,var(--orange),var(--gold)); box-shadow:0 0 12px rgba(215,178,74,.28); }

        .h1-hero-title {
          margin:24px 0 0; max-width:1080px; color:#FBF2DD;
          font:600 clamp(98px,12.6vw,194px)/.64 ${DISPLAY_FONT}; letter-spacing:-.061em;
          text-shadow:0 34px 82px rgba(0,0,0,.34);
        }
        .h1-hero-title .h1-hero-one {
          display:flex; align-items:flex-end; gap:.1em; margin-top:.15em;
          color:var(--gold); font-style:italic; font-size:.55em; letter-spacing:-.05em;
        }
        .h1-hero-title .h1-hero-one small { margin:0 0 .12em .22em; color:rgba(255,255,255,.38); font-family:'Manrope',Arial,sans-serif; font-size:.11em; font-style:normal; font-weight:900; letter-spacing:.19em; text-transform:uppercase; }

        .h1-hero-deck { display:grid; grid-template-columns:minmax(0,1fr) minmax(180px,.46fr); gap:30px; max-width:850px; margin-top:38px; padding-top:26px; border-top:1px solid rgba(255,255,255,.11); }
        .h1-hero-deck p { margin:0; color:rgba(255,255,255,.62); font-size:13px; line-height:1.9; }
        .h1-hero-signature { padding-left:22px; border-left:1px solid rgba(215,178,74,.30); color:rgba(255,255,255,.42); font-size:8px; font-weight:900; line-height:1.9; letter-spacing:.14em; text-transform:uppercase; }

        .h1-actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:30px; }
        .h1-btn {
          position:relative; display:inline-flex; min-height:56px; align-items:center; justify-content:center; gap:18px;
          padding:0 26px; overflow:hidden; border:1px solid rgba(215,178,74,.38); color:#F8F0DC;
          background:rgba(10,8,5,.42); backdrop-filter:blur(10px); text-decoration:none;
          font-size:9px; font-weight:900; letter-spacing:.14em; text-transform:uppercase;
          transition:transform .45s var(--ease),border-color .35s ease,background .35s ease,color .35s ease,box-shadow .35s ease;
        }
        .h1-btn svg { width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.65;transition:transform .42s var(--ease); }
        .h1-btn svg.is-down { transform:rotate(90deg); }
        .h1-btn:hover { transform:translateY(-3px); border-color:#F0D67E; box-shadow:0 20px 48px rgba(0,0,0,.26); }
        .h1-btn:hover svg:not(.is-down) { transform:translateX(4px); }
        .h1-btn-gold { color:#171006; border-color:#F0D67E; background:linear-gradient(135deg,#F0D77F,#C99D31); }
        .h1-btn-gold::after { content:""; position:absolute; inset:-70% auto -70% -42%; width:22%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent); transform:skewX(-18deg); transition:transform .95s var(--ease); }
        .h1-btn-gold:hover::after { transform:translateX(720%) skewX(-18deg); }

        .h1-scene-nav { align-self:stretch; display:flex; flex-direction:column; justify-content:center; gap:10px; padding-top:34px; }
        .h1-scene-card {
          position:relative; min-height:126px; padding:18px 18px 16px; cursor:pointer; text-align:left;
          border:1px solid rgba(215,178,74,.13); color:#F7EDCF;
          background:linear-gradient(145deg,rgba(16,13,9,.74),rgba(9,8,7,.32)); backdrop-filter:blur(12px);
          transition:transform .55s var(--ease),border-color .35s ease,background .35s ease,opacity .35s ease;
        }
        .h1-scene-card::after { content:""; position:absolute; inset:7px; border:1px solid rgba(250,226,159,.055); pointer-events:none; }
        .h1-scene-card:not(.is-active) { opacity:.52; }
        .h1-scene-card.is-active { transform:translateX(-10px); opacity:1; border-color:rgba(215,178,74,.55); background:linear-gradient(145deg,rgba(33,26,15,.82),rgba(11,9,7,.54)); }
        .h1-scene-top { display:flex; align-items:center; justify-content:space-between; gap:16px; color:var(--gold); font-size:7px; font-weight:900; letter-spacing:.18em; }
        .h1-scene-card h3 { margin:18px 0 0; font:600 clamp(25px,2vw,35px)/.93 ${DISPLAY_FONT}; }
        .h1-scene-card p { margin:8px 0 0; color:rgba(255,255,255,.47); font-size:9px; line-height:1.65; }

        .h1-hero-foot { position:absolute; z-index:8; left:clamp(22px,5vw,84px); right:clamp(22px,5vw,84px); bottom:20px; display:flex; align-items:center; justify-content:space-between; gap:18px; color:rgba(255,255,255,.36); font-size:8px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
        .h1-scroll-cue { display:flex; align-items:center; gap:12px; }
        .h1-scroll-cue span { width:46px;height:1px;overflow:hidden;background:rgba(255,255,255,.12); }
        .h1-scroll-cue span::after { content:""; display:block; width:100%;height:100%;background:linear-gradient(90deg,var(--orange),var(--gold));transform-origin:left;animation:h1LinePulse 2.2s ease-in-out infinite; }
        @keyframes h1LinePulse { 0%,100%{transform:scaleX(.12);opacity:.35}50%{transform:scaleX(1);opacity:1} }

        .h1-ticker { position:relative; overflow:hidden; border-block:1px solid rgba(215,178,74,.15); background:#0B0907; }
        .h1-ticker-track { display:flex; width:max-content; animation:h1Ticker 38s linear infinite; }
        .h1-ticker-sequence { display:flex; flex:0 0 auto; }
        .h1-ticker-item { display:inline-flex; height:56px; align-items:center; gap:17px; padding-right:32px; color:rgba(248,238,211,.66); font-size:8px; font-weight:900; letter-spacing:.15em; text-transform:uppercase; white-space:nowrap; }
        .h1-ticker-item svg { width:10px;height:10px;fill:none;stroke:var(--gold);stroke-width:1.2; }
        @keyframes h1Ticker { to{transform:translate3d(-50%,0,0)} }

        .h1-manifesto { position:relative; overflow:hidden; color:#16120C; background:linear-gradient(180deg,#F7F0E5 0%,#ECE0CD 100%); }
        .h1-manifesto::before { content:"ONE"; position:absolute; right:-2vw; top:-5vw; color:rgba(123,89,23,.045); font:italic 700 29vw/.8 ${DISPLAY_FONT}; pointer-events:none; }
        .h1-manifesto-inner { position:relative; z-index:2; display:grid; grid-template-columns:minmax(0,.42fr) minmax(0,1.58fr); gap:clamp(38px,8vw,140px); align-items:end; padding:clamp(94px,9vw,150px) clamp(22px,6vw,96px); }
        .h1-manifesto-mark { position:relative; width:min(270px,70vw); aspect-ratio:1; display:grid; place-items:center; border-radius:50%; border:1px solid rgba(137,98,25,.28); }
        .h1-manifesto-mark::before, .h1-manifesto-mark::after { content:""; position:absolute; border-radius:50%; border:1px solid rgba(137,98,25,.14); }
        .h1-manifesto-mark::before { inset:14px; }
        .h1-manifesto-mark::after { inset:36px; }
        .h1-manifesto-mark strong { font:italic 600 88px/1 ${DISPLAY_FONT}; color:#8A6518; }
        .h1-manifesto-mark span { position:absolute; bottom:48px; font-size:7px; font-weight:900; letter-spacing:.22em; text-transform:uppercase; color:rgba(22,18,12,.46); }
        .h1-manifesto-kicker { color:#906815; font-size:8px; font-weight:900; letter-spacing:.22em; text-transform:uppercase; }
        .h1-manifesto-title { max-width:1120px; margin:22px 0 0; font:600 clamp(58px,6.7vw,112px)/.84 ${DISPLAY_FONT}; letter-spacing:-.045em; }
        .h1-manifesto-title em { color:#A4771E; font-weight:500; }
        .h1-manifesto-foot { display:grid; grid-template-columns:minmax(0,1fr) minmax(240px,.54fr); gap:34px; max-width:960px; margin-top:36px; padding-top:24px; border-top:1px solid rgba(21,17,11,.14); }
        .h1-manifesto-foot p { margin:0; color:rgba(20,16,10,.58); font-size:13px; line-height:1.9; }
        .h1-manifesto-foot small { padding-left:24px; border-left:1px solid rgba(143,104,24,.30); color:rgba(20,16,10,.48); font-size:8px; font-weight:900; line-height:1.9; letter-spacing:.12em; text-transform:uppercase; }

        .h1-story { position:relative; background:#070604; }
        .h1-story-nav {
          position:fixed; z-index:40; left:18px; top:50%; display:flex; flex-direction:column; gap:7px;
          transform:translateY(-50%); pointer-events:none; mix-blend-mode:screen;
        }
        .h1-story-dot { width:3px; height:18px; background:rgba(255,255,255,.16); transition:height .4s var(--ease),background .35s ease; }
        .h1-story-dot.is-active { height:44px; background:linear-gradient(180deg,var(--orange),var(--gold)); }
        .h1-story-page { position:sticky; top:0; height:100svh; min-height:620px; overflow:hidden; isolation:isolate; background:#080706; }
        .h1-story-page:nth-child(1){z-index:10}.h1-story-page:nth-child(2){z-index:20}.h1-story-page:nth-child(3){z-index:30}
        .h1-story-page:nth-child(n+2) { clip-path:polygon(0 7.2vw,100% 0,100% 100%,0 100%); }
        .h1-story-page:nth-child(n+2)::before { content:""; position:absolute; inset:0; z-index:8; pointer-events:none; background:linear-gradient(90deg,var(--orange),var(--gold),rgba(255,231,157,.72)); clip-path:polygon(0 7.2vw,100% 0,100% 3px,0 calc(7.2vw + 3px)); }
        .h1-story-image { position:absolute; inset:0; z-index:-5; width:100%;height:100%;object-fit:cover;filter:saturate(.85) contrast(1.04) brightness(.64);transform:scale(1.015); }
        .h1-story-overlay { position:absolute; inset:0; z-index:-4; background:linear-gradient(90deg,rgba(5,4,3,.95),rgba(5,4,3,.70) 42%,rgba(5,4,3,.16) 74%,rgba(5,4,3,.30)),linear-gradient(180deg,rgba(0,0,0,.10),transparent 48%,rgba(0,0,0,.74)); }
        .h1-story-frame { position:absolute; inset:18px; z-index:3; pointer-events:none; border:1px solid rgba(240,216,148,.13); }
        .h1-story-copy { position:absolute; z-index:5; left:clamp(30px,7vw,116px); right:clamp(30px,7vw,116px); bottom:clamp(48px,9vh,108px); max-width:900px; }
        .h1-story-number { color:rgba(215,178,74,.80); font:italic 500 clamp(42px,5vw,72px)/1 ${DISPLAY_FONT}; }
        .h1-story-kicker { margin:19px 0 0; color:var(--gold-bright); font-size:8px; font-weight:900; letter-spacing:.24em; text-transform:uppercase; }
        .h1-story-title { max-width:900px; margin:20px 0 0; color:#FAF0D7; font:600 clamp(58px,7.2vw,118px)/.82 ${DISPLAY_FONT}; letter-spacing:-.047em; text-wrap:balance; }
        .h1-story-bottom { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:30px; max-width:780px; margin-top:27px; padding-top:21px; border-top:1px solid rgba(255,255,255,.13); }
        .h1-story-bottom p { margin:0; color:rgba(255,255,255,.57); font-size:12px; line-height:1.85; }
        .h1-story-bottom span { color:var(--gold); font-size:7px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }

        .h1-collection { position:relative; overflow:hidden; background:linear-gradient(180deg,#0A0806,#070604 72%); }
        .h1-collection::before { content:"H1"; position:absolute; left:-3vw; top:-4vw; color:rgba(215,178,74,.035); font:italic 700 26vw/.8 ${DISPLAY_FONT}; pointer-events:none; }
        .h1-collection-inner { position:relative; z-index:2; padding:clamp(92px,8vw,132px) clamp(18px,5vw,82px); }
        .h1-section-head { display:grid; grid-template-columns:minmax(0,1.05fr) minmax(320px,.55fr); gap:clamp(28px,6vw,90px); align-items:end; padding-bottom:30px; border-bottom:1px solid rgba(255,255,255,.09); }
        .h1-section-kicker { color:var(--gold); font-size:8px; font-weight:900; letter-spacing:.23em; text-transform:uppercase; }
        .h1-section-title { margin:16px 0 0; color:#F7EACC; font:600 clamp(62px,7vw,112px)/.84 ${DISPLAY_FONT}; letter-spacing:-.046em; }
        .h1-section-title em { display:block; color:var(--gold); font-weight:500; }
        .h1-section-side { color:rgba(255,255,255,.49); font-size:11px; line-height:1.85; }
        .h1-section-side strong { display:block; margin-bottom:10px; color:#F2D982; font-size:8px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }

        .h1-product-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-top:32px; }
        .h1-product-card {
          --card-bg:#17130E; --card-bg-2:#2A2115; --card-accent:#D8B650;
          position:relative; min-width:0; overflow:hidden; border-radius:26px; padding:10px;
          color:#F6E9C7; text-decoration:none; background:linear-gradient(145deg,var(--card-bg-2),var(--card-bg));
          border:1px solid rgba(215,178,74,.20); box-shadow:0 22px 58px rgba(0,0,0,.24);
          transition:transform .7s var(--ease),box-shadow .5s ease,border-color .4s ease;
        }
        .h1-product-card:nth-child(4n+2){--card-bg:#102018;--card-bg-2:#203B2D;--card-accent:#E0C06C}
        .h1-product-card:nth-child(4n+3){--card-bg:#211117;--card-bg-2:#3A1E29;--card-accent:#E0AC71}
        .h1-product-card:nth-child(4n+4){--card-bg:#11192A;--card-bg-2:#233652;--card-accent:#D9BD72}
        .h1-product-card::before { content:""; position:absolute; inset:6px; z-index:1; border-radius:21px; border:1px solid rgba(249,224,153,.10); pointer-events:none; }
        .h1-product-card:hover { transform:translateY(-8px); border-color:rgba(215,178,74,.52); box-shadow:0 34px 86px rgba(0,0,0,.34); }
        .h1-product-sheen { position:absolute; z-index:10; top:-20%; bottom:-20%; left:-30%; width:13%; opacity:0; pointer-events:none; transform:skewX(-18deg); background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),rgba(255,235,167,.25),rgba(255,255,255,.05),transparent); }
        .h1-product-card:hover .h1-product-sheen { opacity:1; animation:h1Sheen 1s var(--ease) both; }
        @keyframes h1Sheen { to{transform:skewX(-18deg) translateX(1050%)} }
        .h1-product-media { position:relative; z-index:2; overflow:hidden; aspect-ratio:1/.78; border-radius:18px; background:#090807; border:1px solid rgba(242,216,142,.13); }
        .h1-product-media img { width:100%;height:100%;object-fit:cover;transform:scale(1.02);transition:transform 1.05s var(--ease),filter .6s ease; }
        .h1-product-card:hover .h1-product-media img { transform:scale(1.075);filter:saturate(1.05) contrast(1.02); }
        .h1-product-media::after { content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.02),transparent 55%,rgba(0,0,0,.58));pointer-events:none; }
        .h1-product-tag { position:absolute;z-index:5;left:14px;top:14px;display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,233,161,.21);background:rgba(8,8,8,.54);backdrop-filter:blur(8px);color:#F2D77D;font-size:6px;font-weight:900;letter-spacing:.14em;text-transform:uppercase; }
        .h1-product-index { position:absolute;z-index:5;right:13px;bottom:12px;color:rgba(255,255,255,.74);font:italic 500 13px/1 ${DISPLAY_FONT}; }
        .h1-product-body { position:relative;z-index:3;padding:16px 12px 12px; }
        .h1-product-category { margin:0;color:var(--card-accent);font-size:7px;font-weight:900;letter-spacing:.14em;text-transform:uppercase; }
        .h1-product-title { margin:8px 0 0;color:#F6E9C7;font:600 clamp(23px,1.6vw,30px)/.96 ${DISPLAY_FONT};letter-spacing:-.025em; }
        .h1-product-desc { margin:9px 0 0;color:rgba(255,255,255,.43);font-size:9px;line-height:1.65;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
        .h1-product-meta { display:flex;align-items:end;justify-content:space-between;gap:10px;margin-top:15px;padding-top:13px;border-top:1px solid rgba(255,255,255,.09); }
        .h1-product-price-label { margin:0;color:rgba(255,255,255,.30);font-size:6px;font-weight:900;letter-spacing:.12em;text-transform:uppercase; }
        .h1-product-price { margin:4px 0 0;color:var(--card-accent);font-size:16px;font-weight:900; }
        .h1-product-arrow { display:grid;width:35px;height:35px;place-items:center;border-radius:50%;border:1px solid rgba(232,204,118,.26);color:var(--card-accent);transition:transform .4s var(--ease),background .3s ease,color .3s ease; }
        .h1-product-arrow svg { width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.7; }
        .h1-product-card:hover .h1-product-arrow { transform:translateX(4px);background:var(--card-accent);color:#111; }

        .h1-skeleton { overflow:hidden;border-radius:26px;border:1px solid rgba(215,178,74,.13);background:#17130E;padding:10px; }
        .h1-skeleton-media { aspect-ratio:1/.78;border-radius:18px;background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.085),rgba(255,255,255,.035));background-size:220% 100%;animation:h1Skeleton 1.45s linear infinite; }
        .h1-skeleton-line { height:9px;margin-top:13px;background:rgba(255,255,255,.055); }
        @keyframes h1Skeleton { to{background-position:-220% 0} }
        .h1-empty { margin-top:32px;padding:70px 24px;border:1px solid rgba(215,178,74,.14);background:rgba(255,255,255,.018);text-align:center; }
        .h1-empty h3 { margin:0;color:#F4E7C6;font:600 42px/1 ${DISPLAY_FONT}; }
        .h1-empty p { max-width:520px;margin:14px auto 0;color:rgba(255,255,255,.45);font-size:11px;line-height:1.8; }
        .h1-error { margin-top:24px;padding:14px 16px;border-left:2px solid #D85A44;background:rgba(102,20,12,.22);color:#FFD6CE;font-size:11px;font-weight:700; }

        .h1-principles { position:relative; overflow:hidden; background:#EEE4D4; color:#17120B; }
        .h1-principles-inner { padding:clamp(88px,8vw,126px) clamp(18px,5vw,82px); }
        .h1-principles-head { display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.52fr);gap:clamp(30px,6vw,90px);align-items:end;margin-bottom:34px; }
        .h1-principles-title { margin:14px 0 0;font:600 clamp(60px,7vw,110px)/.84 ${DISPLAY_FONT};letter-spacing:-.045em; }
        .h1-principles-title em { display:block;color:#987018;font-weight:500; }
        .h1-principles-copy { color:rgba(23,18,11,.54);font-size:12px;line-height:1.9; }
        .h1-principles-grid { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);min-height:650px;overflow:hidden;border:1px solid rgba(85,59,15,.16);transition:grid-template-columns .72s var(--ease); }
        .h1-principles-grid:has(.h1-principle:nth-child(1):hover){grid-template-columns:minmax(0,1.38fr) minmax(0,.81fr) minmax(0,.81fr)}
        .h1-principles-grid:has(.h1-principle:nth-child(2):hover){grid-template-columns:minmax(0,.81fr) minmax(0,1.38fr) minmax(0,.81fr)}
        .h1-principles-grid:has(.h1-principle:nth-child(3):hover){grid-template-columns:minmax(0,.81fr) minmax(0,.81fr) minmax(0,1.38fr)}
        .h1-principle { position:relative;overflow:hidden;min-width:0;isolation:isolate;border-right:1px solid rgba(255,255,255,.18); }
        .h1-principle:last-child { border-right:0; }
        .h1-principle img { position:absolute;inset:0;z-index:-4;width:100%;height:100%;object-fit:cover;filter:saturate(.86) brightness(.60);transform:scale(1.02);transition:transform 1.15s var(--ease),filter .65s ease; }
        .h1-principle::after { content:"";position:absolute;inset:0;z-index:-3;background:linear-gradient(180deg,rgba(0,0,0,.06),transparent 32%,rgba(4,4,4,.82)); }
        .h1-principle:hover img { transform:scale(1.075);filter:saturate(1.02) brightness(.72); }
        .h1-principle-copy { position:absolute;left:clamp(20px,3vw,44px);right:clamp(20px,3vw,44px);bottom:clamp(24px,4vw,52px);color:#F8EDD0; }
        .h1-principle-number { color:var(--gold);font:italic 500 48px/1 ${DISPLAY_FONT}; }
        .h1-principle h3 { max-width:430px;margin:18px 0 0;font:600 clamp(34px,3.6vw,58px)/.9 ${DISPLAY_FONT};letter-spacing:-.035em; }
        .h1-principle p { max-width:430px;margin:16px 0 0;color:rgba(255,255,255,.56);font-size:11px;line-height:1.8;opacity:.76;transition:opacity .35s ease; }
        .h1-principle:hover p { opacity:1; }
        .h1-principle-line { display:block;width:54px;height:1px;margin-top:22px;background:linear-gradient(90deg,var(--orange),var(--gold));transform-origin:left;transition:transform .65s var(--ease); }
        .h1-principle:hover .h1-principle-line { transform:scaleX(2.8); }

        .h1-finale { position:relative;min-height:100svh;overflow:hidden;isolation:isolate;display:flex;align-items:center;background:#070604; }
        .h1-finale-bg { position:absolute;inset:0;z-index:-6;width:100%;height:100%;object-fit:cover;filter:saturate(.82) brightness(.42);transform:scale(1.04); }
        .h1-finale::after { content:"";position:absolute;inset:0;z-index:-5;background:linear-gradient(90deg,rgba(5,4,3,.98),rgba(5,4,3,.76) 50%,rgba(5,4,3,.24)),linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.70)); }
        .h1-finale-orbit { position:absolute;right:-11vw;top:50%;width:min(58vw,860px);aspect-ratio:1;transform:translateY(-50%);border:1px solid rgba(238,211,130,.15);border-radius:50%;box-shadow:0 0 0 56px rgba(215,178,74,.018),0 0 0 112px rgba(215,178,74,.012); }
        .h1-finale-orbit::before { content:"H1";position:absolute;inset:0;display:grid;place-items:center;color:rgba(239,214,137,.11);font:italic 700 clamp(120px,16vw,270px)/1 ${DISPLAY_FONT}; }
        .h1-finale-inner { width:100%;padding:clamp(94px,9vw,148px) clamp(22px,6vw,100px); }
        .h1-finale-title { max-width:1080px;margin:19px 0 0;color:#F8ECD0;font:600 clamp(72px,9.2vw,154px)/.77 ${DISPLAY_FONT};letter-spacing:-.052em; }
        .h1-finale-title em { display:block;color:var(--gold);font-weight:500; }
        .h1-finale-copy { max-width:640px;margin:28px 0 0;color:rgba(255,255,255,.56);font-size:12px;line-height:1.9; }
        .h1-finale-rule { width:min(560px,70vw);height:1px;margin-top:34px;background:linear-gradient(90deg,var(--orange),var(--gold) 58%,transparent); }

        [data-h1-reveal] { opacity:0;transform:translate3d(0,28px,0);transition:opacity .72s ease,transform .95s var(--ease); }
        [data-h1-reveal].is-visible { opacity:1;transform:translate3d(0,0,0); }
        [data-h1-reveal].h1-delay-1 { transition-delay:.08s; }
        [data-h1-reveal].h1-delay-2 { transition-delay:.16s; }

        .h1-route-curtain { position:fixed;inset:0;z-index:2147483000;pointer-events:auto;overflow:hidden;isolation:isolate; }
        .h1-route-panel { position:absolute;top:0;bottom:0;width:50.5%;background:linear-gradient(180deg,#120E09,#070604 55%,#0D0906);box-shadow:inset 0 0 80px rgba(215,178,74,.045);transition:transform .31s var(--ease); }
        .h1-route-panel::after { content:"";position:absolute;inset:12px;border:1px solid rgba(215,178,74,.14); }
        .h1-route-panel-left { left:0;transform:translateX(-104%); }
        .h1-route-panel-right { right:0;transform:translateX(104%); }
        .h1-route-line { position:absolute;z-index:4;left:0;right:0;top:50%;height:1px;opacity:0;transform:scaleX(0);background:linear-gradient(90deg,transparent,var(--orange),var(--gold),transparent); }
        .h1-route-seal { position:absolute;z-index:6;left:50%;top:50%;display:grid;width:78px;height:78px;place-items:center;border-radius:50%;border:1px solid rgba(255,236,169,.68);background:radial-gradient(circle at 34% 28%,#FFF1B1,#E7CD70 26%,#C3902E 58%,#724509 100%);color:#2A1A04;font:700 26px/1 ${DISPLAY_FONT};opacity:0;transform:translate(-50%,-50%) scale(.35) rotate(-25deg);box-shadow:0 18px 50px rgba(0,0,0,.46); }
        .h1-route-curtain.is-closing .h1-route-panel-left,.h1-route-curtain.is-closing .h1-route-panel-right{transform:translateX(0)}
        .h1-route-curtain.is-closing .h1-route-line{animation:h1RouteLine .28s .12s var(--ease) both}
        .h1-route-curtain.is-closing .h1-route-seal{animation:h1RouteSeal .30s .18s var(--ease) both}
        .h1-route-curtain.is-opening .h1-route-panel-left{transform:translateX(-104%);transition-duration:.34s}.h1-route-curtain.is-opening .h1-route-panel-right{transform:translateX(104%);transition-duration:.34s}.h1-route-curtain.is-opening .h1-route-line,.h1-route-curtain.is-opening .h1-route-seal{opacity:0;transition:opacity .12s ease}
        @keyframes h1RouteLine{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
        @keyframes h1RouteSeal{0%{opacity:0;transform:translate(-50%,-50%) scale(.35) rotate(-25deg)}70%{opacity:1;transform:translate(-50%,-50%) scale(1.08) rotate(3deg)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}

        @media (max-width:1279px) {
          .h1-product-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
          .h1-hero-shell { grid-template-columns:minmax(0,1fr) minmax(300px,.5fr); }
        }

        @media (max-width:1023px) {
          .h1-hero-shell { grid-template-columns:1fr;align-content:end;gap:30px;padding:112px 24px 68px; }
          .h1-scene-nav { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding-top:0; }
          .h1-scene-card { min-height:140px; }
          .h1-scene-card.is-active { transform:translateY(-5px); }
          .h1-manifesto-inner { grid-template-columns:1fr; }
          .h1-manifesto-mark { width:210px; }
          .h1-section-head,.h1-principles-head { grid-template-columns:1fr; }
          .h1-product-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .h1-principles-grid { display:flex;min-height:0;overflow-x:auto;gap:12px;padding:0 0 16px;border:0;scroll-snap-type:x mandatory;scrollbar-width:none; }
          .h1-principles-grid::-webkit-scrollbar { display:none; }
          .h1-principle { flex:0 0 76vw;min-height:620px;border:1px solid rgba(85,59,15,.16);scroll-snap-align:center;border-radius:24px; }
          .h1-story-nav { display:none; }
        }

        @media (max-width:767px) {
          .h1-scroll-progress { height:1px; }
          .h1-hero-image { object-position:62% center !important; }
          .h1-hero-wash { background:linear-gradient(180deg,rgba(5,4,3,.08) 0%,rgba(5,4,3,.25) 28%,rgba(5,4,3,.78) 62%,rgba(5,4,3,.98) 100%); }
          .h1-hero-wash::after,.h1-hero-orbit { display:none; }
          .h1-hero-shell { min-height:100svh;display:flex;flex-direction:column;justify-content:flex-end;padding:108px 16px 40px; }
          .h1-hero-title { font-size:clamp(78px,25vw,112px);line-height:.68; }
          .h1-hero-deck { grid-template-columns:1fr;gap:15px;margin-top:28px;padding-top:19px; }
          .h1-hero-deck p { font-size:11px;line-height:1.78; }
          .h1-hero-signature { padding-left:15px;font-size:7px; }
          .h1-actions { display:grid;grid-template-columns:1fr;width:100%; }
          .h1-btn { width:100%;min-height:54px; }
          .h1-scene-nav { display:flex;width:100%;overflow-x:auto;gap:9px;padding:2px 0 4px;scroll-snap-type:x mandatory;scrollbar-width:none; }
          .h1-scene-nav::-webkit-scrollbar { display:none; }
          .h1-scene-card { flex:0 0 78vw;min-height:132px;scroll-snap-align:start; }
          .h1-scene-card.is-active { transform:none; }
          .h1-hero-foot { display:none; }
          .h1-ticker-item { height:50px;font-size:7px;padding-right:25px; }

          .h1-manifesto-inner { padding:72px 16px;gap:38px; }
          .h1-manifesto-mark { width:170px; }
          .h1-manifesto-mark strong { font-size:64px; }
          .h1-manifesto-mark span { bottom:34px;font-size:6px; }
          .h1-manifesto-title { font-size:clamp(50px,14.5vw,72px);line-height:.88; }
          .h1-manifesto-foot { grid-template-columns:1fr;gap:18px; }
          .h1-manifesto-foot small { padding:17px 0 0;border-left:0;border-top:1px solid rgba(143,104,24,.28); }

          .h1-story-page { min-height:540px; }
          .h1-story-page:nth-child(n+2){clip-path:polygon(0 54px,100% 0,100% 100%,0 100%)}
          .h1-story-page:nth-child(n+2)::before{clip-path:polygon(0 54px,100% 0,100% 3px,0 57px)}
          .h1-story-copy { left:18px;right:18px;bottom:32px; }
          .h1-story-title { font-size:clamp(50px,14vw,70px);line-height:.86; }
          .h1-story-bottom { grid-template-columns:1fr;gap:14px;margin-top:19px;padding-top:15px; }
          .h1-story-bottom p { font-size:10px; }
          .h1-story-frame { inset:10px; }

          .h1-collection-inner { padding:72px 12px; }
          .h1-section-title { font-size:clamp(52px,15vw,74px); }
          .h1-product-grid { display:flex;gap:12px;overflow-x:auto;margin-left:-12px;margin-right:-12px;padding:4px 12px 18px;scroll-snap-type:x mandatory;scrollbar-width:none; }
          .h1-product-grid::-webkit-scrollbar { display:none; }
          .h1-product-card,.h1-skeleton { flex:0 0 82vw;max-width:360px;scroll-snap-align:center; }
          .h1-product-card:hover { transform:none; }
          .h1-product-card:hover .h1-product-media img { transform:scale(1.02);filter:none; }
          .h1-product-card:hover .h1-product-sheen { animation:none;opacity:0; }

          .h1-principles-inner { padding:68px 12px; }
          .h1-principles-title { font-size:clamp(52px,15vw,72px); }
          .h1-principle { flex-basis:84vw;min-height:540px; }
          .h1-principle h3 { font-size:42px; }
          .h1-finale { min-height:90svh; }
          .h1-finale-inner { padding:76px 16px; }
          .h1-finale-title { font-size:clamp(64px,19vw,94px); }
          .h1-finale-orbit { opacity:.52;right:-36vw;width:100vw; }
        }

        @media (prefers-reduced-motion:reduce) {
          .h1-page *, .h1-page *::before, .h1-page *::after { animation:none !important;transition:none !important;scroll-behavior:auto !important; }
          [data-h1-reveal] { opacity:1 !important;transform:none !important; }
          .h1-intro { display:none !important; }
        }
      `}</style>

      <div className={`h1-intro ${introDone ? "is-done" : ""}`} aria-hidden="true">
        <div className="h1-intro-seal">H1</div>
        <div className="h1-intro-copy">HAMPORIUM · PRIVATE SERIES</div>
      </div>

      <div className="h1-scroll-progress" aria-hidden="true" />

      <section
        className="h1-hero"
        onPointerMove={handlePointerMove}
        onPointerLeave={(event) => {
          event.currentTarget.style.setProperty("--h1-mx", "50%");
          event.currentTarget.style.setProperty("--h1-my", "50%");
          event.currentTarget.style.setProperty("--h1-px", "0px");
          event.currentTarget.style.setProperty("--h1-py", "0px");
        }}
      >
        <div className="h1-hero-media" aria-hidden="true">
          {HERO_SCENES.map((scene, index) => (
            <img
              key={scene.image}
              src={scene.image}
              alt=""
              style={{ objectPosition: scene.position }}
              className={`h1-hero-image ${heroScene === index ? "is-active" : ""}`}
              onLoad={() => index === 0 && setHeroReady(true)}
            />
          ))}
        </div>
        <div className="h1-hero-wash" aria-hidden="true" />
        <div className="h1-grain" aria-hidden="true" />
        <div className="h1-hero-orbit" aria-hidden="true" />

        <div className="h1-hero-shell">
          <div className={`h1-hero-copy ${heroReady ? "is-ready" : ""}`}>
            <p className="h1-eyebrow">HAMPORIUM · PRIVATE SERIES 01</p>

            <h1 className="h1-hero-title">
              HAMPER
              <span className="h1-hero-one">
                ONE
                <small>NOT A COLLECTION. A SIGNATURE.</small>
              </span>
            </h1>

            <div className="h1-hero-deck">
              <p>
                A private edit of HAMPORIUM&apos;s most considered hampers — built around
                rare selection, immaculate composition and an unforgettable reveal.
              </p>
              <div className="h1-hero-signature">
                NUMBERED EDIT
                <br />
                LIMITED FEEL
                <br />
                SIGNATURE FINISH
              </div>
            </div>

            <div className="h1-actions">
              <button type="button" className="h1-btn h1-btn-gold" onClick={jumpToCollection}>
                Enter The Private Edit
                <ArrowIcon down />
              </button>

              <CinematicLink
                to="/custom-hamper"
                className="h1-btn"
                reducedMotion={reducedMotion}
              >
                Create Your Own
                <ArrowIcon />
              </CinematicLink>
            </div>
          </div>

          <div className="h1-scene-nav" aria-label="HAMPER ONE visual chapters">
            {HERO_SCENES.map((scene, index) => (
              <button
                key={scene.title}
                type="button"
                className={`h1-scene-card ${heroScene === index ? "is-active" : ""}`}
                onClick={() => setHeroScene(index)}
              >
                <div className="h1-scene-top">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{heroScene === index ? "NOW" : scene.label}</span>
                </div>
                <h3>{scene.title}</h3>
                <p>{scene.note}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="h1-hero-foot" aria-hidden="true">
          <div className="h1-scroll-cue">
            <span />
            Scroll to enter the HAMPER ONE experience
          </div>
          <div>H1 · PRIVATE EDITION</div>
        </div>
      </section>

      <section className="h1-ticker" aria-hidden="true">
        <div className="h1-ticker-track">
          {[0, 1].map((sequence) => (
            <div className="h1-ticker-sequence" key={sequence}>
              {[
                "Rare Selection",
                "Signature Composition",
                "Private Gifting",
                "Refined Finishing",
                "Elevated Unboxing",
                "Made To Be Remembered",
                "HAMPER ONE",
              ].map((item) => (
                <div className="h1-ticker-item" key={`${sequence}-${item}`}>
                  {item}
                  <StarIcon />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="h1-manifesto">
        <div className="h1-manifesto-inner">
          <div className="h1-manifesto-mark" data-h1-reveal>
            <strong>1/1</strong>
            <span>PRIVATE MINDSET</span>
          </div>

          <div>
            <p className="h1-manifesto-kicker" data-h1-reveal>
              THE IDEA BEHIND HAMPER ONE
            </p>
            <h2 className="h1-manifesto-title" data-h1-reveal>
              Less catalogue. More <em>signature piece.</em>
            </h2>
            <div className="h1-manifesto-foot" data-h1-reveal>
              <p>
                HAMPER ONE is for gifting moments where ordinary choice is not enough.
                The selection is tighter, the presentation more deliberate, and the final
                composition is treated with the mindset of a designed object.
              </p>
              <small>
                HAMPORIUM PRIVATE SERIES
                <br />
                INDIA · 2026
              </small>
            </div>
          </div>
        </div>
      </section>

      <section className="h1-story">
        <div className="h1-story-nav" aria-hidden="true">
          {STORY_CHAPTERS.map((chapter, index) => (
            <span
              key={chapter.number}
              className={`h1-story-dot ${activeChapter === index ? "is-active" : ""}`}
            />
          ))}
        </div>

        {STORY_CHAPTERS.map((chapter, index) => (
          <article
            key={chapter.number}
            data-h1-chapter={index}
            className="h1-story-page"
          >
            <img
              src={chapter.image}
              alt=""
              aria-hidden="true"
              className="h1-story-image"
              style={{ objectPosition: chapter.position }}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
            <div className="h1-story-overlay" aria-hidden="true" />
            <div className="h1-story-frame" aria-hidden="true" />

            <div className="h1-story-copy">
              <span className="h1-story-number">{chapter.number}</span>
              <p className="h1-story-kicker">THE HAMPER ONE RITUAL · {chapter.kicker}</p>
              <h2 className="h1-story-title">{chapter.title}</h2>
              <div className="h1-story-bottom">
                <p>{chapter.copy}</p>
                <span>{chapter.line}</span>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section id="h1-private-edit" className="h1-collection">
        <div className="h1-collection-inner">
          <div className="h1-section-head">
            <div data-h1-reveal>
              <p className="h1-section-kicker">THE CURRENT PRIVATE EDIT</p>
              <h2 className="h1-section-title">
                Selected now.
                <em>Remembered later.</em>
              </h2>
            </div>

            <div className="h1-section-side" data-h1-reveal>
              <strong>HAMPER ONE COLLECTION</strong>
              Every product shown here comes from your live HAMPORIUM catalogue and keeps
              its real product route and pricing.
            </div>
          </div>

          {error && <div className="h1-error">{error}</div>}

          {loading ? (
            <div className="h1-product-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <HamperOneSkeleton key={index} />
              ))}
            </div>
          ) : heroProducts.length ? (
            <div className="h1-product-grid">
              {heroProducts.map((product, index) => (
                <HamperOneProductCard
                  key={product._id || product.slug || index}
                  product={product}
                  index={index}
                  reducedMotion={reducedMotion}
                />
              ))}
            </div>
          ) : (
            <div className="h1-empty" data-h1-reveal>
              <h3>The private edit is being composed.</h3>
              <p>
                Mark ready-made products for HAMPER ONE in Product Master and they will
                appear here automatically.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="h1-principles">
        <div className="h1-principles-inner">
          <div className="h1-principles-head">
            <div data-h1-reveal>
              <p className="h1-manifesto-kicker">THE H1 STANDARD</p>
              <h2 className="h1-principles-title">
                Three rules.
                <em>One point of view.</em>
              </h2>
            </div>
            <p className="h1-principles-copy" data-h1-reveal>
              Hover to open each principle on desktop. On mobile, swipe through the
              series like a private lookbook.
            </p>
          </div>

          <div className="h1-principles-grid" data-h1-reveal>
            {PRINCIPLES.map((principle) => (
              <article className="h1-principle" key={principle.number}>
                <img src={principle.image} alt="" aria-hidden="true" loading="lazy" />
                <div className="h1-principle-copy">
                  <span className="h1-principle-number">{principle.number}</span>
                  <h3>{principle.title}</h3>
                  <p>{principle.copy}</p>
                  <span className="h1-principle-line" aria-hidden="true" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="h1-finale">
        <img
          src={bestsellerCelebrationLuxury}
          alt=""
          aria-hidden="true"
          className="h1-finale-bg"
          loading="lazy"
          decoding="async"
        />
        <div className="h1-finale-orbit" aria-hidden="true" />

        <div className="h1-finale-inner">
          <div data-h1-reveal>
            <p className="h1-eyebrow">BEYOND THE PRIVATE EDIT</p>
            <h2 className="h1-finale-title">
              Make the next one
              <em>entirely yours.</em>
            </h2>
            <p className="h1-finale-copy">
              Start from a blank box and build a hamper around the person, the moment and
              your own point of view — with HAMPORIUM&apos;s build-your-own studio.
            </p>
            <div className="h1-finale-rule" aria-hidden="true" />

            <div className="h1-actions">
              <CinematicLink
                to="/custom-hamper"
                className="h1-btn h1-btn-gold"
                reducedMotion={reducedMotion}
              >
                Build A Bespoke Hamper
                <ArrowIcon />
              </CinematicLink>

              <CinematicLink
                to="/gifts"
                className="h1-btn"
                reducedMotion={reducedMotion}
              >
                Explore All Hampers
                <ArrowIcon />
              </CinematicLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

const HamperOneProductCard = ({ product, index, reducedMotion }) => {
  const image = getProductImage(product);
  const price = getProductPrice(product);
  const destination = product.slug ? `/products/${product.slug}` : "/gifts";

  return (
    <CinematicLink
      to={destination}
      reducedMotion={reducedMotion}
      className="h1-product-card"
      data-h1-reveal
    >
      <span className="h1-product-sheen" aria-hidden="true" />

      <div className="h1-product-media">
        <img
          src={image}
          alt={product.name || "HAMPER ONE hamper"}
          loading="lazy"
          decoding="async"
        />
        <span className="h1-product-tag">Private Edit</span>
        <span className="h1-product-index">No. {String(index + 1).padStart(2, "0")}</span>
      </div>

      <div className="h1-product-body">
        <p className="h1-product-category">
          {product.category?.name || "HAMPER ONE"}
        </p>
        <h3 className="h1-product-title">{product.name || "HAMPER ONE Hamper"}</h3>
        {product.shortDescription && (
          <p className="h1-product-desc">{product.shortDescription}</p>
        )}

        <div className="h1-product-meta">
          <div>
            <p className="h1-product-price-label">From</p>
            <p className="h1-product-price">
              {price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Private Edit"}
            </p>
          </div>
          <span className="h1-product-arrow" aria-hidden="true">
            <ArrowIcon />
          </span>
        </div>
      </div>
    </CinematicLink>
  );
};

const HamperOneSkeleton = () => (
  <div className="h1-skeleton">
    <div className="h1-skeleton-media" />
    <div className="px-2 pb-2 pt-3">
      <div className="h1-skeleton-line w-20" />
      <div className="h1-skeleton-line h-7 w-3/4" />
      <div className="h1-skeleton-line mt-4 h-px w-full" />
      <div className="mt-3 flex items-center justify-between">
        <div className="h1-skeleton-line mt-0 h-5 w-16" />
        <div className="h-8 w-8 rounded-full bg-white/[0.06]" />
      </div>
    </div>
  </div>
);

export default HamperOne;
 