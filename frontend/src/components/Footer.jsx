// HAMPORIUM Footer - V15 | FIXED OXC PARSE ERROR | SINGLE DEFAULT EXPORT
// IMPORTANT: Replace the entire contents of src/components/Footer.jsx.
// Do not paste this below an existing Footer component.
// Sections: Company, Help. Homepage-only footer.

import { useEffect, useState } from "react";
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
      <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#E6BF58]">
        Social Media
      </h2>
      <div className="flex flex-wrap items-center justify-start gap-2.5 max-lg:justify-center">
        {SOCIAL_LINKS.map(({ name, url }) => {
          const icon = <SocialIcon name={name} />;
          const baseClass = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E6BF58]/25 bg-white/[0.045] text-[#F4DC9B] transition-[color,background-color,border-color,transform] duration-300";

          return url ? (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`HAMPORIUM on ${name} (opens in a new tab)`}
              title={name}
              className={`${baseClass} hover:-translate-y-0.5 hover:border-[#F47822] hover:bg-[#F47822] hover:text-[#090807] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#F47822]`}
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
        className="group mt-4 inline-flex min-h-9 items-center gap-2 text-[12px] font-semibold text-white/65 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#F47822]"
      >
        Need assistance? <span className="text-[#F47822] transition-transform duration-200 group-hover:translate-x-1">↗</span>
      </Link>
    </section>
  );
}

function Brand({ logo }) {
  return (
    <div className="min-w-0 max-md:flex max-md:flex-col max-md:items-center lg:-translate-x-5 xl:-translate-x-6">
      <Link
        to="/"
        aria-label="HAMPORIUM Home"
        className="group inline-flex max-w-full items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F47822]"
      >
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          draggable="false"
          className="-mr-[15px] h-[54px] w-[97px] shrink-0 object-contain object-center md:-mr-[24px] md:h-[68px] md:w-[127px]"
        />
        <span
          style={{ fontFamily: DISPLAY_FONT }}
          className="min-w-0 whitespace-nowrap text-[23px] font-semibold leading-none tracking-[0.045em] text-[#FFF8EB] transition-colors duration-300 group-hover:text-white md:text-[26px] md:tracking-[0.055em] lg:text-[30px]"
        >
          HAMPORIUM
        </span>
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
          <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#E6BF58]">
            {group.title}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {group.links.map((link) => (
              <li key={link.label} className="min-w-0">
                <Link
                  to={link.to}
                  className="group inline-block max-w-full rounded-sm py-0.5 text-[13px] font-medium leading-[1.5] text-white/65 transition-colors duration-200 hover:text-[#FFF6E3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F47822] lg:text-[14px]"
                >
                  <span className="relative break-words">
                    {link.label}
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-[3px] left-0 h-px w-full origin-left scale-x-0 bg-[#F47822] transition-transform duration-300 group-hover:scale-x-100"
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
              className="flex min-h-[54px] w-full items-center justify-between gap-4 bg-transparent py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F47822]"
            >
              <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#E6BF58]">
                {group.title}
              </span>
              <span
                aria-hidden="true"
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[18px] leading-none transition-[transform,background-color,border-color] duration-300 ${
                  isOpen
                    ? "rotate-45 border-[#F47822] bg-[#F47822] text-black"
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
                        className="flex min-h-[44px] items-center justify-between gap-3 rounded-sm border-t border-white/[0.055] py-2.5 text-[13px] font-medium text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F47822]"
                      >
                        <span>{link.label}</span>
                        <span aria-hidden="true" className="text-[#F47822]">→</span>
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

export default function Footer() {
  const { pathname } = useLocation();
  const logo = useTransparentLogo(logoLight);
  const year = new Date().getFullYear();

  // Existing behavior: footer appears on the homepage only.
  if (pathname !== "/") return null;

  return (
    <footer
      className="relative isolate w-full max-w-none overflow-hidden bg-[#090807] text-white"
      style={{
        // Break out of any centered/max-width App parent, keeping the footer viewport-wide.
        width: "100vw",
        maxWidth: "none",
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
        backgroundImage:
          "radial-gradient(ellipse at 0% 40%, rgba(244,120,34,.055), transparent 38%), radial-gradient(ellipse at 100% 10%, rgba(212,175,55,.045), transparent 38%)",
      }}
    >
      <div className="w-full max-w-none px-4 sm:px-5 md:px-8 lg:px-[clamp(64px,6.5vw,140px)]">
        {/* Three aligned groups: brand | Company + Help | Social Media. */}
        <div className="hidden items-start gap-y-7 py-9 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.2fr)_minmax(0,0.95fr)] lg:gap-x-8 xl:gap-x-12">
          <Brand logo={logo} />
          <DesktopLinks />
          <SocialLinks />
        </div>

        <div className="py-7 lg:hidden">
          <div className="mb-5 flex justify-center text-center">
            <Brand logo={logo} />
          </div>
          <MobileLinks />
          <SocialLinks />
        </div>

        {/* Copyright remains centered with no extra action on the right. */}
        <div className="flex items-center justify-center border-t border-white/10 py-3 text-center sm:py-4">
          <p className="text-[10px] font-medium tracking-[0.02em] text-white/45 sm:text-[11px]">
            © {year} HAMPORIUM. All rights reserved.
          </p>
        </div>
      </div>

      {/* Original full-bleed wordmark geometry: absolutely no horizontal inset. */}
      <div className="m-0 w-full overflow-hidden border-t border-white/[0.07] p-0">
        <svg
          aria-hidden="true"
          viewBox="0 0 1000 150"
          preserveAspectRatio="none"
          className="block h-[10.5vw] min-h-[46px] max-h-[190px] w-full"
        >
          <text
            x="2"
            y="134"
            textLength="996"
            lengthAdjust="spacingAndGlyphs"
            fill="#F47822"
            style={{ fontFamily: DISPLAY_FONT, fontSize: "138px", fontWeight: 600 }}
          >
            HAMPORIUM
          </text>
        </svg>
      </div>
    </footer>
  );
}
