import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import logoLight from "../assets/images/logo_dark.jpeg";

// ======================================================
// LOGO BACKGROUND REMOVE
// Same processing used by Header.jsx
// ======================================================

const useTransparentLogo = (source) => {
  const [processedLogo, setProcessedLogo] = useState(source);

  useEffect(() => {
    if (!source) return;

    let cancelled = false;
    const image = new Image();

    const isWhitePixel = (r, g, b) => {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      return (
        r > 218 &&
        g > 218 &&
        b > 218 &&
        max - min < 28
      );
    };

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext("2d", {
          willReadFrequently: true,
        });

        if (!context) return;

        context.drawImage(image, 0, 0);

        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );

        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        const visited = new Uint8Array(
          width * height
        );

        const queue = [];

        const pushPixel = (x, y) => {
          if (
            x < 0 ||
            y < 0 ||
            x >= width ||
            y >= height
          ) {
            return;
          }

          const pixelIndex =
            y * width + x;

          if (visited[pixelIndex]) return;

          const dataIndex =
            pixelIndex * 4;

          const r = data[dataIndex];
          const g = data[dataIndex + 1];
          const b = data[dataIndex + 2];

          if (!isWhitePixel(r, g, b)) {
            return;
          }

          visited[pixelIndex] = 1;
          queue.push(pixelIndex);
        };

        for (
          let x = 0;
          x < width;
          x += 1
        ) {
          pushPixel(x, 0);
          pushPixel(x, height - 1);
        }

        for (
          let y = 0;
          y < height;
          y += 1
        ) {
          pushPixel(0, y);
          pushPixel(width - 1, y);
        }

        let index = 0;

        while (
          index < queue.length
        ) {
          const pixelIndex =
            queue[index];

          index += 1;

          const x =
            pixelIndex % width;

          const y =
            Math.floor(
              pixelIndex / width
            );

          data[
            pixelIndex * 4 + 3
          ] = 0;

          pushPixel(x + 1, y);
          pushPixel(x - 1, y);
          pushPixel(x, y + 1);
          pushPixel(x, y - 1);
        }

        context.putImageData(
          imageData,
          0,
          0
        );

        const transparent =
          canvas.toDataURL(
            "image/png"
          );

        if (!cancelled) {
          setProcessedLogo(
            transparent
          );
        }
      } catch (error) {
        console.warn(
          "Logo transparency error:",
          error
        );

        if (!cancelled) {
          setProcessedLogo(
            source
          );
        }
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        setProcessedLogo(
          source
        );
      }
    };

    image.src = source;

    return () => {
      cancelled = true;
    };
  }, [source]);

  return processedLogo;
};

const FOOTER_LINKS = [
  {
    title: "Shop",
    links: [
      { label: "All Gifts", to: "/gifts" },
      { label: "Signature Hampers", to: "/gifts" },
      { label: "Build Your Own", to: "/custom-hamper" },
      { label: "Hamper One", to: "/hamper-one" },
    ],
  },
  {
    title: "Gifting",
    links: [
      { label: "Corporate Gifting", to: "/custom-hamper?mode=bulk" },
      { label: "Wedding Gifting", to: "/custom-hamper?mode=bulk" },
      { label: "Event Gifting", to: "/custom-hamper?mode=bulk" },
      { label: "Bulk Enquiries", to: "/custom-hamper?mode=bulk" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Contact Us", to: "/contact" },
      { label: "FAQs", to: "/faq" },
      { label: "Shipping & Delivery", to: "/shipping-delivery" },
      { label: "Returns & Refunds", to: "/returns-refunds" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About HAMPORIUM", to: "/about" },
      { label: "Our Story", to: "/about#our-story" },
      { label: "Privacy Policy", to: "/privacy-policy" },
      { label: "Terms & Conditions", to: "/terms" },
    ],
  },
];

const ACCOUNT_LINKS = [
  { label: "My Account", to: "/account" },
  { label: "My Orders", to: "/account/orders" },
  { label: "Saved Addresses", to: "/account/addresses" },
];

const Footer = () => {
  const { pathname } = useLocation();
  const year = new Date().getFullYear();
  const transparentLogo = useTransparentLogo(logoLight);

  const [openMobileGroup, setOpenMobileGroup] =
    useState("Shop");

  // Footer should appear only on the homepage.
  if (pathname !== "/") {
    return null;
  }

  const toggleMobileGroup = (title) => {
    setOpenMobileGroup((current) =>
      current === title
        ? ""
        : title
    );
  };

  return (
    <footer className="relative m-0 overflow-x-hidden bg-[#090807] p-0 text-white">
      {/* soft luxury ambient glow */}
      <div className="pointer-events-none absolute -left-24 top-20 h-[360px] w-[360px] rounded-full bg-[#F47822]/[0.06] blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 top-0 h-[420px] w-[420px] rounded-full bg-[#D4AF37]/[0.06] blur-[130px]" />

      {/* ==================================================
          MAIN FOOTER
      =================================================== */}
      <div className="relative mx-auto w-full max-w-[1900px] px-5 py-8 sm:px-8 sm:py-9 md:px-10 lg:px-12 lg:py-11 xl:px-16 2xl:px-20">
        {/* ==================================================
            MOBILE
        =================================================== */}
        <div className="sm:hidden">
          <div className="flex items-center justify-center border-b border-white/[0.08] pb-8">
            <Link
              to="/"
              aria-label="HAMPORIUM Home"
              className="inline-flex items-center justify-center gap-3"
            >
              <img
                src={transparentLogo}
                alt=""
                aria-hidden="true"
                className="h-[56px] w-[112px] object-contain object-center drop-shadow-[0_2px_7px_rgba(0,0,0,0.22)]"
                draggable="false"
              />

              <span
                style={{
                  fontFamily:
                    "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
                }}
                className="text-[26px] font-semibold tracking-[0.08em] text-white"
              >
                HAMPORIUM
              </span>
            </Link>
          </div>

          <div className="mt-3 divide-y divide-white/[0.08] border-b border-white/[0.08]">
            {[
              ...FOOTER_LINKS,
              {
                title: "Account",
                links: ACCOUNT_LINKS,
              },
            ].map((group) => {
              const isOpen =
                openMobileGroup ===
                group.title;

              return (
                <div key={group.title}>
                  <button
                    type="button"
                    onClick={() =>
                      toggleMobileGroup(
                        group.title
                      )
                    }
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">
                      {group.title}
                    </span>

                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-[18px] transition duration-300 ${
                        isOpen
                          ? "rotate-45 border-[#F47822] bg-[#F47822] text-black"
                          : "border-white/[0.12] text-white/55"
                      }`}
                    >
                      +
                    </span>
                  </button>

                  <div
                    className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="min-h-0">
                      <div className="flex flex-col pb-5">
                        {group.links.map(
                          (link) => (
                            <Link
                              key={
                                link.label
                              }
                              to={link.to}
                              className="flex items-center justify-between border-t border-white/[0.055] py-3.5 text-[13px] font-semibold text-white/62 transition hover:text-white"
                            >
                              <span>
                                {link.label}
                              </span>

                              <span className="text-[#F47822]">
                                →
                              </span>
                            </Link>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ==================================================
            TABLET / DESKTOP
        =================================================== */}
        <div className="hidden gap-10 sm:grid xl:grid-cols-[0.82fr_2.18fr] xl:gap-14 2xl:gap-16">
          {/* BRAND */}
          <div className="max-w-[540px]">
            <Link
              to="/"
              aria-label="HAMPORIUM Home"
              className="group inline-flex shrink-0 items-center gap-4"
            >
              <img
                src={transparentLogo}
                alt=""
                aria-hidden="true"
                className="h-[60px] w-[128px] object-contain object-left drop-shadow-[0_2px_7px_rgba(0,0,0,0.22)] transition duration-300 group-hover:scale-[1.025] lg:h-[64px] lg:w-[136px]"
                draggable="false"
              />

              <span
                style={{
                  fontFamily:
                    "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
                }}
                className="text-[28px] font-semibold tracking-[0.09em] text-white lg:text-[31px]"
              >
                HAMPORIUM
              </span>
            </Link>
          </div>

          {/* LINK COLUMNS */}
          <div className="grid grid-cols-3 gap-x-7 gap-y-10 lg:grid-cols-5 xl:gap-x-8">
            {FOOTER_LINKS.map((group) => (
              <div key={group.title}>
                <h3 className="text-[9px] font-black uppercase tracking-[0.24em] text-[#D4AF37]">
                  {group.title}
                </h3>

                <div className="mt-5 flex flex-col gap-3.5">
                  {group.links.map((link) => (
                    <Link
                      key={link.label}
                      to={link.to}
                      className="group w-fit text-[13px] font-medium text-white/52 transition duration-300 hover:text-white"
                    >
                      <span className="relative">
                        {link.label}

                        <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#F47822] transition-all duration-300 group-hover:w-full" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h3 className="text-[9px] font-black uppercase tracking-[0.24em] text-[#D4AF37]">
                Account
              </h3>

              <div className="mt-5 flex flex-col gap-3.5">
                {ACCOUNT_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="group w-fit text-[13px] font-medium text-white/52 transition duration-300 hover:text-white"
                  >
                    <span className="relative">
                      {link.label}

                      <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#F47822] transition-all duration-300 group-hover:w-full" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================
          BOTTOM
      =================================================== */}
      <div className="relative mx-auto w-full max-w-[1900px] px-5 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20">
        <div className="flex flex-col items-center gap-5 py-5 text-center sm:flex-row sm:items-center sm:justify-between sm:py-6 sm:text-left">
          <p className="text-[9px] font-semibold text-white/28 sm:text-[10px]">
            © {year} HAMPORIUM. All rights reserved.
          </p>

          <div className="grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:w-auto sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
            <Link
              to="/privacy-policy"
              className="text-center text-[8px] font-black uppercase tracking-[0.13em] text-white/32 transition hover:text-[#D4AF37] sm:text-left sm:text-[9px]"
            >
              Privacy
            </Link>

            <Link
              to="/terms"
              className="text-center text-[8px] font-black uppercase tracking-[0.13em] text-white/32 transition hover:text-[#D4AF37] sm:text-left sm:text-[9px]"
            >
              Terms
            </Link>

            <Link
              to="/shipping-delivery"
              className="text-center text-[8px] font-black uppercase tracking-[0.13em] text-white/32 transition hover:text-[#D4AF37] sm:text-left sm:text-[9px]"
            >
              Shipping
            </Link>

            <Link
              to="/returns-refunds"
              className="text-center text-[8px] font-black uppercase tracking-[0.13em] text-white/32 transition hover:text-[#D4AF37] sm:text-left sm:text-[9px]"
            >
              Refund Policy
            </Link>
          </div>
        </div>
      </div>

      {/* BIG WORDMARK · TRUE EDGE-TO-EDGE */}
      <div className="relative m-0 w-full overflow-hidden border-t border-white/[0.06] bg-[#090807] p-0">
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
            style={{
              fontFamily:
                "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
              fontSize: "138px",
              fontWeight: 600,
            }}
          >
            HAMPORIUM
          </text>
        </svg>
      </div>
    </footer>
  );
};

export default Footer;
