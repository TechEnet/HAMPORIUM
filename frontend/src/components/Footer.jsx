// V144: first-scroll auto letter-wave; retain V143 orange wordmark and hover unchanged.
// V143: restore original orange big HAMPORIUM footer wordmark; retain V142 palette elsewhere.
// V141: Footer.jsx - responsive layout + modern thin geometric HAMPORIUM wordmark with letter hover.
// HAMPORIUM Footer - V15 | FIXED OXC PARSE ERROR | SINGLE DEFAULT EXPORT

// IMPORTANT: Replace the entire contents of src/components/Footer.jsx.

// Do not paste this below an existing Footer component.

// Sections: Company, Help. Homepage-only footer.



import { useEffect, useRef, useState } from "react";

import { Link, useLocation } from "react-router-dom";

import logoLight from "../assets/images/logo_dark.jpeg";



// Preserve the header-style transparent logo without changing its artwork.

// The processed result is cached so route changes do not decode it repeatedly.

const logoCache = new Map();



function useTransparentLogo(source) {

  const [processedLogo, setProcessedLogo] = useState(logoCache.get(source) || source);



  useEffect(() => {

    if (!source || logoCache.has(source)) {

      setProcessedLogo(logoCache.get(source) || source);

      return undefined;

    }



    let cancelled = false;

    const image = new Image();



    image.onload = () => {

      try {

        const width = image.naturalWidth;

        const height = image.naturalHeight;

        if (!width || !height) return;



        const canvas = document.createElement("canvas");

        canvas.width = width;

        canvas.height = height;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) return;

        ctx.drawImage(image, 0, 0);



        const data = ctx.getImageData(0, 0, width, height);

        const pixels = data.data;

        const visited = new Uint8Array(width * height);

        const queue = [];

        const isWhite = (r, g, b) =>

          r > 218 &&

          g > 218 &&

          b > 218 &&

          Math.max(r, g, b) - Math.min(r, g, b) < 28;



        const enqueue = (x, y) => {

          if (x < 0 || x >= width || y < 0 || y >= height) return;

          const index = y * width + x;

          if (visited[index]) return;

          const offset = index * 4;

          if (!isWhite(pixels[offset], pixels[offset + 1], pixels[offset + 2])) {

            return;

          }

          visited[index] = 1;

          queue.push(index);

        };



        for (let x = 0; x < width; x += 1) {

          enqueue(x, 0);

          enqueue(x, height - 1);

        }

        for (let y = 0; y < height; y += 1) {

          enqueue(0, y);

          enqueue(width - 1, y);

        }



        for (let head = 0; head < queue.length; head += 1) {

          const index = queue[head];

          const x = index % width;

          const y = Math.floor(index / width);

          pixels[index * 4 + 3] = 0;

          enqueue(x + 1, y);

          enqueue(x - 1, y);

          enqueue(x, y + 1);

          enqueue(x, y - 1);

        }



        ctx.putImageData(data, 0, 0);

        const transparent = canvas.toDataURL("image/png");

        logoCache.set(source, transparent);

        if (!cancelled) setProcessedLogo(transparent);

      } catch (error) {

        console.warn("Footer logo transparency processing failed:", error);

        if (!cancelled) setProcessedLogo(source);

      }

    };



    image.onerror = () => {

      if (!cancelled) setProcessedLogo(source);

    };

    image.src = source;



    return () => {

      cancelled = true;

      image.onload = null;

      image.onerror = null;

    };

  }, [source]);



  return processedLogo;

}



const FOOTER_LINKS = [

  {

    title: "Company",

    links: [

      { label: "About HAMPORIUM", to: "/about" },

      { label: "Our Story", to: "/about#our-story" },

      { label: "Privacy Policy", to: "/privacy-policy" },

      { label: "Terms & Conditions", to: "/terms" },

    ],

  },

  {

    title: "Help",

    links: [

      { label: "Contact Us", to: "/contact" },

      { label: "FAQs", to: "/faq" },

    ],

  },

];



const DISPLAY_FONT =

  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";



// Add your real brand profiles here. Empty URLs are intentionally non-clickable

// so visitors never end up on an unrelated social-media homepage.

const SOCIAL_LINKS = [

  { name: "Instagram", url: "" },

  { name: "Facebook", url: "" },

  { name: "YouTube", url: "" },

  { name: "LinkedIn", url: "" },

  { name: "WhatsApp", url: "" },

];



function SocialIcon({ name }) {

  const shared = {

    width: 18,

    height: 18,

    viewBox: "0 0 24 24",

    fill: "none",

    stroke: "currentColor",

    strokeWidth: 1.8,

    strokeLinecap: "round",

    strokeLinejoin: "round",

    "aria-hidden": "true",

  };



  switch (name) {

    case "Instagram":

      return (

        <svg {...shared}>

          <rect x="2.5" y="2.5" width="19" height="19" rx="5" />

          <circle cx="12" cy="12" r="4.2" />

          <circle cx="17.7" cy="6.5" r="1" fill="currentColor" stroke="none" />

        </svg>

      );

    case "Facebook":

      return (

        <svg {...shared}>

          <path d="M15.6 4.5h-2.1c-2.4 0-3.6 1.5-3.6 3.9V11H7.6v3.3h2.3v6.2h3.5v-6.2h2.7l.4-3.3h-3.1V8.9c0-.8.3-1.2 1.3-1.2h1V4.5Z" />

        </svg>

      );

    case "YouTube":

      return (

        <svg {...shared}>

          <rect x="2.5" y="5.5" width="19" height="13" rx="4" />

          <path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" />

        </svg>

      );

    case "LinkedIn":

      return (

        <svg {...shared}>

          <rect x="3" y="9" width="3.4" height="11" />

          <circle cx="4.7" cy="5.1" r="1.6" />

          <path d="M10.2 20V9h3.4v1.6c.7-1.1 1.8-1.9 3.4-1.9 2.6 0 4 1.7 4 4.7V20h-3.4v-6c0-1.5-.5-2.4-1.9-2.4-1.4 0-2.1 1-2.1 2.4v6Z" />

        </svg>

      );

    default: // WhatsApp

      return (

        <svg {...shared}>

          <path d="M5.1 18.9 3.4 21l.8-4.2a9 9 0 1 1 3 3.1Z" />

          <path d="M9 8.1c-.4-.4-.8-.2-1 .1-.5.6-.5 1.5.1 2.6 1 1.9 2.7 3.6 4.8 4.5 1.2.5 2.1.4 2.6-.2.3-.4.3-.8-.2-1l-1.7-.8c-.3-.1-.5 0-.7.2l-.6.7c-1.2-.5-2.2-1.5-2.9-2.6l.6-.6c.3-.3.4-.6.2-.9Z" />

        </svg>

      );

  }

}



function SocialLinks() {

  return (

    <section aria-label="HAMPORIUM social media" className="min-w-0 text-left max-lg:pt-5 max-lg:text-center">

      <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#B79B6A]">

        Social Media

      </h2>

      <div className="flex flex-wrap items-center justify-start gap-2.5 max-lg:justify-center">

        {SOCIAL_LINKS.map(({ name, url }) => {

          const icon = <SocialIcon name={name} />;

          const baseClass = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#B79B6A]/25 bg-white/[0.045] text-[#F4DC9B] transition-[color,background-color,border-color,transform] duration-300";



          return url ? (

            <a

              key={name}

              href={url}

              target="_blank"

              rel="noopener noreferrer"

              aria-label={`HAMPORIUM on ${name} (opens in a new tab)`}

              title={name}

              className={`${baseClass} hover:-translate-y-0.5 hover:border-[#B79B6A] hover:bg-[#B79B6A] hover:text-[#161715] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#B79B6A]`}

            >

              {icon}

            </a>

          ) : (

            <span

              key={name}

              aria-label={`${name} profile not connected yet`}

              title={`${name} profile: add your URL in SOCIAL_LINKS`}

              className={`${baseClass} cursor-default opacity-65`}

            >

              {icon}

            </span>

          );

        })}

      </div>

      <Link

        to="/contact"

        className="group mt-4 inline-flex min-h-9 items-center gap-2 text-[12px] font-semibold text-white/65 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#B79B6A]"

      >

        Need assistance? <span className="text-[#B79B6A] transition-transform duration-200 group-hover:translate-x-1">↗</span>

      </Link>

    </section>

  );

}



function Brand({ logo }) {
  return (
    <div className="hp-footer-brand">
      <Link to="/" className="hp-footer-brand-link" aria-label="HAMPORIUM Home">
        <img src={logo} alt="" draggable="false" className="hp-footer-brand-icon" />
        <span style={{ fontFamily: DISPLAY_FONT }} className="hp-footer-brand-title">HAMPORIUM</span>
      </Link>
    </div>
  );
}

function DesktopLinks() {

  return (

    <nav

      aria-label="Footer navigation"

      className="grid min-w-0 grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] gap-x-5 xl:gap-x-10"

    >

      {FOOTER_LINKS.map((group) => (

        <div key={group.title} className="min-w-0">

          <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#B79B6A]">

            {group.title}

          </h2>

          <ul className="flex flex-col gap-2.5">

            {group.links.map((link) => (

              <li key={link.label} className="min-w-0">

                <Link

                  to={link.to}

                  className="group inline-block max-w-full rounded-sm py-0.5 text-[13px] font-medium leading-[1.5] text-white/65 transition-colors duration-200 hover:text-[#FAF8F4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B79B6A] lg:text-[14px]"

                >

                  <span className="relative break-words">

                    {link.label}

                    <span

                      aria-hidden="true"

                      className="absolute -bottom-[3px] left-0 h-px w-full origin-left scale-x-0 bg-[#B79B6A] transition-transform duration-300 group-hover:scale-x-100"

                    />

                  </span>

                </Link>

              </li>

            ))}

          </ul>

        </div>

      ))}

    </nav>

  );

}



function MobileLinks() {

  const [openGroup, setOpenGroup] = useState("Company");



  return (

    <nav aria-label="Footer navigation" className="divide-y divide-white/10 border-y border-white/10">

      {FOOTER_LINKS.map((group) => {

        const isOpen = openGroup === group.title;

        const panelId = `hamporium-footer-panel-${group.title.toLowerCase()}`;



        return (

          <div key={group.title}>

            <button

              type="button"

              onClick={() => setOpenGroup(isOpen ? "" : group.title)}

              aria-expanded={isOpen}

              aria-controls={panelId}

              className="flex min-h-[54px] w-full items-center justify-between gap-4 bg-transparent py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B79B6A]"

            >

              <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#B79B6A]">

                {group.title}

              </span>

              <span

                aria-hidden="true"

                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[18px] leading-none transition-[transform,background-color,border-color] duration-300 ${

                  isOpen

                    ? "rotate-45 border-[#B79B6A] bg-[#B79B6A] text-black"

                    : "border-white/20 text-white/70"

                }`}

              >

                +

              </span>

            </button>



            <div

              id={panelId}

              aria-hidden={!isOpen}

              className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${

                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"

              }`}

            >

              <div className="min-h-0 overflow-hidden">

                <ul className="flex flex-col pb-3">

                  {group.links.map((link) => (

                    <li key={link.label}>

                      <Link

                        to={link.to}

                        tabIndex={isOpen ? 0 : -1}

                        className="flex min-h-[44px] items-center justify-between gap-3 rounded-sm border-t border-white/[0.055] py-2.5 text-[13px] font-medium text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B79B6A]"

                      >

                        <span>{link.label}</span>

                        <span aria-hidden="true" className="text-[#B79B6A]">→</span>

                      </Link>

                    </li>

                  ))}

                </ul>

              </div>

            </div>

          </div>

        );

      })}

    </nav>

  );

}



// V140: responsive, viewport-safe footer with no 100vw scrollbar overflow.
// Homepage-only visibility, Company/Help links and social placeholders are unchanged.
export default function Footer() {
  const { pathname } = useLocation();
  const logo = useTransparentLogo(logoLight);
  const year = new Date().getFullYear();

  // V144: run the same letter-enlarge effect automatically ONCE, only when
  // the oversized wordmark enters the viewport. Hover stays interactive later.
  const wordmarkRef = useRef(null);
  const introTriggeredRef = useRef(false);
  const [introPlaying, setIntroPlaying] = useState(false);

  useEffect(() => {
    if (pathname !== "/" || introTriggeredRef.current) return undefined;

    const target = wordmarkRef.current;
    if (!target) return undefined;

    const startLetterSequence = () => {
      if (introTriggeredRef.current) return;
      introTriggeredRef.current = true;

      // Respect system reduced-motion preferences.
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      setIntroPlaying(true);
    };

    if (typeof IntersectionObserver === "undefined") {
      startLetterSequence();
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          startLetterSequence();
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -4% 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!introPlaying) return undefined;
    // 9 letters: last starts at 8*165ms, then completes in 720ms.
    const timer = window.setTimeout(() => setIntroPlaying(false), 2260);
    return () => window.clearTimeout(timer);
  }, [introPlaying]);

  if (pathname !== "/") return null;

  return (
    <footer className="hp-footer" aria-label="HAMPORIUM footer">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400&display=swap');
        .hp-footer, .hp-footer * { box-sizing: border-box; }
        .hp-footer {
          position: relative;
          isolation: isolate;
          display: block;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          margin: 0;
          overflow-x: clip;
          color: #fff;
          background: radial-gradient(ellipse at 0% 40%, rgba(183,155,106,.055), transparent 38%), radial-gradient(ellipse at 100% 10%, rgba(183,155,106,.045), transparent 38%), #161715;
        }
        .hp-footer-container { width: 100%; max-width: 1680px; margin-inline: auto; padding-inline: clamp(20px, 4.2vw, 100px); }
        .hp-footer-main {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.06fr) minmax(0, .96fr);
          align-items: start;
          gap: clamp(24px, 3.2vw, 70px);
          padding-block: clamp(35px, 4.2vw, 64px) clamp(26px, 3.3vw, 48px);
        }
        .hp-footer-main > * { min-width: 0; }
        .hp-footer-brand { min-width: 0; }
        .hp-footer-brand-link { display: inline-flex; align-items: center; gap: 10px; min-width: 0; max-width: 100%; text-decoration: none; }
        .hp-footer-brand-icon { width: clamp(49px, 4.7vw, 75px); height: clamp(65px, 6.5vw, 95px); flex: 0 0 auto; object-fit: contain; }
        .hp-footer-brand-title { min-width: 0; font-size: clamp(22px, 2.15vw, 36px); font-weight: 600; letter-spacing: .02em; line-height: 1; color: #FAF8F4; white-space: nowrap; }
        .hp-footer-brand-link:hover .hp-footer-brand-title { color: #f7e7ca; }
        .hp-footer-desktop-links { min-width: 0; }
        .hp-footer-mobile-links { display: none; }
        .hp-footer-social { min-width: 0; }
        .hp-footer-social section { text-align: left; }
        .hp-footer-social section > div { justify-content: flex-start; }
        .hp-footer-copyright { display: flex; align-items: center; justify-content: center; min-height: 49px; border-top: 1px solid rgba(255,255,255,.1); padding: 14px 0; text-align: center; }
        .hp-footer-copyright p { margin: 0; font-size: 11px; font-weight: 500; line-height: 1.6; letter-spacing: .02em; color: rgba(255,255,255,.52); }
        /* V141: crisp geometry inspired by HAMPORIUM's shield lettering.
           Individual characters animate independently and do not move the layout. */
        .hp-footer-wordmark { width: 100%; max-width: 100%; border-top: 1px solid rgba(255,255,255,.07); overflow: visible; }
        .hp-footer-wordmark-line {
          display: flex; align-items: flex-end; justify-content: space-between;
          width: 100%; min-width: 0; margin: 0;
          padding: clamp(13px, 1.4vw, 24px) clamp(6px, .9vw, 20px) clamp(9px, 1vw, 19px);
          color: #F47822;
          font-family: 'Montserrat', 'Avenir Next', 'Century Gothic', Arial, sans-serif;
          font-size: clamp(36px, 12.0vw, 240px);
          font-weight: 300; line-height: .86; letter-spacing: -.065em;
          white-space: nowrap; font-kerning: normal;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }
        .hp-footer-wordmark-letter {
          position: relative; display: inline-block; flex: 0 1 auto;
          min-width: 0; transform: translateZ(0) scale(1);
          transform-origin: 50% 80%;
          transition: transform .42s cubic-bezier(.2,.86,.26,1), color .3s ease;
          will-change: auto;
        }
        @media (hover:hover) and (pointer:fine) {
          .hp-footer-wordmark-letter:hover {
            z-index: 2; transform: translate3d(0,-.065em,0) scale(1.2);
            color: #FFA548;
          }
        }
        /* V144: first-scroll automatic H -> A -> M -> P -> O -> R -> I -> U -> M wave.
           Transform-only movement avoids layout shifts; the original hover
           effect is retained after this short, one-time sequence finishes. */
        @keyframes hpFooterFirstScrollLetter {
          0%, 100% { transform: translate3d(0,0,0) scale(1); color: #F47822; }
          38% { transform: translate3d(0,-.065em,0) scale(1.2); color: #FFA548; }
          65% { transform: translate3d(0,-.04em,0) scale(1.11); color: #FF923C; }
        }
        .hp-footer-wordmark.is-auto-playing .hp-footer-wordmark-letter {
          animation: hpFooterFirstScrollLetter 720ms cubic-bezier(.2,.86,.26,1) both;
          animation-delay: calc(var(--hp-letter-index) * 165ms);
          will-change: transform;
        }
        @media (min-width: 768px) and (max-width: 1199px) {
          .hp-footer-main {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 24px 36px;
          }
          .hp-footer-brand { grid-column: 1; }
          .hp-footer-desktop-links { grid-column: 2; grid-row: 1 / span 2; }
          .hp-footer-social { grid-column: 1; grid-row: 2; }
          .hp-footer-brand-title { font-size: clamp(22px, 2.6vw, 32px); }
          .hp-footer-social section { text-align: left; }
        }
        @media (max-width: 767px) {
          .hp-footer-container { padding-inline: clamp(16px, 5vw, 28px); }
          .hp-footer-main { display: flex; flex-direction: column; gap: 0; padding-block: 29px 25px; }
          .hp-footer-brand { align-self: center; width: 100%; margin-bottom: 20px; text-align: center; }
          .hp-footer-brand-link { justify-content: center; }
          .hp-footer-brand-icon { width: 49px; height: 64px; }
          .hp-footer-brand-title { font-size: clamp(23px, 6.2vw, 30px); letter-spacing: .005em; }
          .hp-footer-desktop-links { display: none; }
          .hp-footer-mobile-links { display: block; width: 100%; min-width: 0; }
          .hp-footer-social { width: 100%; padding-top: 6px; }
          .hp-footer-social section { text-align: center; }
          .hp-footer-social section > div { justify-content: center; }
          .hp-footer-copyright { min-height: 48px; padding-block: 12px; }
          .hp-footer-wordmark-line { font-size: clamp(35px, 11.8vw, 88px); padding: 14px 5px 12px; letter-spacing: -.075em; }
        }
        @media (max-width: 360px) {
          .hp-footer-wordmark-line { font-size: 11.5vw; letter-spacing: -.09em; }
          .hp-footer-brand-link { gap: 5px; }
          .hp-footer-brand-icon { width: 44px; height: 58px; }
          .hp-footer-brand-title { font-size: 21px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hp-footer *, .hp-footer *::before, .hp-footer *::after {
            animation: none !important; transition-duration: 0.01ms !important;
          }
        }

        /* V142 / FOOTER PALETTE: preserve individual letter hover and footer layout. */
        .hp-footer {
          color:#FAF8F4;
          background:radial-gradient(ellipse at 10% 0%,rgba(183,155,106,.09),transparent 46%),#161715;
        }
        /* Preserve the original orange oversized HAMPORIUM wordmark. */
        .hp-footer-wordmark-line { color:#F47822; }
        @media (hover:hover) and (pointer:fine) {
          .hp-footer-wordmark-letter:hover { color:#FFA548; }
        }
        .hp-footer-brand-title, .hp-footer-brand-link:hover .hp-footer-brand-title { color:#FAF8F4; }

      `}</style>

      <div className="hp-footer-container">
        <div className="hp-footer-main">
          <Brand logo={logo} />
          <div className="hp-footer-desktop-links"><DesktopLinks /></div>
          <div className="hp-footer-mobile-links"><MobileLinks /></div>
          <div className="hp-footer-social"><SocialLinks /></div>
        </div>
      </div>

      <div
        ref={wordmarkRef}
        className={`hp-footer-wordmark ${introPlaying ? "is-auto-playing" : ""}`}
        aria-label="HAMPORIUM"
      >
        <div className="hp-footer-wordmark-line" aria-hidden="true">
          {Array.from("HAMPORIUM").map((letter, index) => (
            <span
              className="hp-footer-wordmark-letter"
              style={{ "--hp-letter-index": index }}
              key={`${letter}-${index}`}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>

      {/* Copyright stays at the absolute end, beneath the large HAMPORIUM wordmark. */}
      <div className="hp-footer-copyright">
        <p>© {year} HAMPORIUM. All rights reserved.</p>
      </div>
    </footer>
  );
}
