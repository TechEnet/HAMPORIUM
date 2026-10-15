// V150 HEADER: match refreshed autoplay hero, no session-gated poster-only mode.
// V147 HEADER: fix search/account/notification/cart overlap at laptop/desktop widths.
// V140 brand palette and original header interaction preserved.
// EXACT PATH: frontend/src/components/Header.jsx
// ACTION: REPLACE - HAMPORIUM COMMON HEADER V139 (logo 20% smaller, click-pinned hampers menu, hamburger-style bow gift icon)
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../api/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useDeliveryLocation } from "../context/LocationContext.jsx";
import { trackSearchAnalytics } from "../utils/analytics.js";
import { trackCustomerActivity } from "../utils/customerActivity.js";
import HeaderNotifications from "./HeaderNotifications.jsx";

import logoLight from "../assets/images/logo_dark.jpeg";
// Optional assets: avoid Linux/Vercel build failures if one filename is missing.
const HEADER_HAMPER_ONE_ASSETS = import.meta.glob(
  "../assets/images/{hamperone.jpeg,hamperOne.jpeg}",
  { eager: true, query: "?url", import: "default" }
);
const hamperOneLogo =
  HEADER_HAMPER_ONE_ASSETS["../assets/images/hamperOne.jpeg"] ||
  HEADER_HAMPER_ONE_ASSETS["../assets/images/hamperone.jpeg"] || "";

// Avoid flashing the original JPEG white background while the logo is processed.
const TRANSPARENT_IMAGE = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http://www.w3.org/2000/svg%22%20width%3D%221%22%20height%3D%221%22/%3E";

// ======================================================
// API HELPERS
// ======================================================

const getApiOrigin = () => {
  const baseURL = api.defaults?.baseURL || "";

  return baseURL
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
};

const API_ORIGIN = getApiOrigin();

const resolveImage = (value) => {
  if (!value) return "";

  let image = value;

  if (typeof image === "object") {
    image =
      image.url ||
      image.secure_url ||
      image.location ||
      image.src ||
      image.path ||
      "";
  }

  if (!image || typeof image !== "string") return "";

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:") ||
    image.startsWith("blob:")
  ) {
    return image;
  }

  if (image.startsWith("//")) {
    return `https:${image}`;
  }

  return API_ORIGIN
    ? `${API_ORIGIN}${image.startsWith("/") ? "" : "/"}${image}`
    : image;
};

const getProductImage = (product) => {
  const firstImage = Array.isArray(product?.images)
    ? product.images[0]
    : null;

  return resolveImage(
    firstImage ||
      product?.image ||
      product?.thumbnail
  );
};

// ======================================================
// LOGO BACKGROUND REMOVE
// ======================================================

const useTransparentLogo = (source) => {
  const [processedLogo, setProcessedLogo] = useState(null);

  useEffect(() => {
    if (!source) return;

    let cancelled = false;
    const image = new Image();

    const isWhitePixel = (r, g, b) => {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      return r > 218 && g > 218 && b > 218 && max - min < 28;
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
        const visited = new Uint8Array(width * height);
        const queue = [];

        const pushPixel = (x, y) => {
          if (x < 0 || y < 0 || x >= width || y >= height) return;

          const pixelIndex = y * width + x;
          if (visited[pixelIndex]) return;

          const dataIndex = pixelIndex * 4;
          const r = data[dataIndex];
          const g = data[dataIndex + 1];
          const b = data[dataIndex + 2];

          if (!isWhitePixel(r, g, b)) return;

          visited[pixelIndex] = 1;
          queue.push(pixelIndex);
        };

        for (let x = 0; x < width; x += 1) {
          pushPixel(x, 0);
          pushPixel(x, height - 1);
        }

        for (let y = 0; y < height; y += 1) {
          pushPixel(0, y);
          pushPixel(width - 1, y);
        }

        let index = 0;

        while (index < queue.length) {
          const pixelIndex = queue[index];
          index += 1;

          const x = pixelIndex % width;
          const y = Math.floor(pixelIndex / width);

          data[pixelIndex * 4 + 3] = 0;

          pushPixel(x + 1, y);
          pushPixel(x - 1, y);
          pushPixel(x, y + 1);
          pushPixel(x, y - 1);
        }

        context.putImageData(imageData, 0, 0);

        const transparent = canvas.toDataURL("image/png");

        if (!cancelled) {
          setProcessedLogo(transparent);
        }
      } catch (error) {
        console.warn("Logo transparency error:", error);

        if (!cancelled) {
          setProcessedLogo(source);
        }
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        setProcessedLogo(source);
      }
    };

    image.src = source;

    return () => {
      cancelled = true;
    };
  }, [source]);

  return processedLogo;
};

// V139: remove transparent margins from the already de-backed Hamper One JPEG.
// Scaling its original, mostly empty canvas made the visible golden symbol
// significantly smaller than the centered HAMPORIUM mark.
const useTightlyCroppedLogo = (source) => {
  const [croppedLogo, setCroppedLogo] = useState(null);

  useEffect(() => {
    if (!source) {
      setCroppedLogo(null);
      return undefined;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      try {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        if (!width || !height) throw new Error("Empty Hamper One logo");

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Cannot crop logo");
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, width, height).data;
        let left = width;
        let top = height;
        let right = -1;
        let bottom = -1;

        // Ignore faint anti-aliased pixels so the actual mark defines bounds.
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4;
            if (data[i + 3] < 65) continue;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
        if (right < left || bottom < top) throw new Error("No visible Hamper One pixels");
        const pad = Math.max(1, Math.round(Math.min(width, height) * 0.006));
        left = Math.max(0, left - pad);
        top = Math.max(0, top - pad);
        right = Math.min(width - 1, right + pad);
        bottom = Math.min(height - 1, bottom + pad);
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = right - left + 1;
        croppedCanvas.height = bottom - top + 1;
        const crop = croppedCanvas.getContext("2d");
        if (!crop) throw new Error("Cannot render cropped logo");
        crop.drawImage(canvas, left, top, croppedCanvas.width, croppedCanvas.height,
          0, 0, croppedCanvas.width, croppedCanvas.height);
        if (!cancelled) setCroppedLogo(croppedCanvas.toDataURL("image/png"));
      } catch (error) {
        if (!cancelled) setCroppedLogo(source);
      }
    };
    image.onerror = () => { if (!cancelled) setCroppedLogo(source); };
    image.src = source;
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [source]);

  return croppedLogo || source;
};

// ======================================================
// NAVIGATION
// ======================================================

const HAMPER_DROPDOWN = [
  {
    label: "All Hampers",
    subtitle: "Explore the complete HAMPORIUM collection",
    to: "/gifts",
  },
  {
    label: "Build Your Personalised Hamper",
    subtitle: "Build it once, then choose personal checkout or bulk quotation",
    special: true,
    options: [
      {
        label: "Personal Order",
        subtitle: "Build your hamper and checkout normally",
        to: "/custom-hamper",
      },
      {
        label: "Bulk / Event Order",
        subtitle: "Build the same hamper and request a quotation",
        to: "/custom-hamper?mode=bulk",
      },
    ],
  },
  {
    label: "Diwali Hampers",
    subtitle: "Festive gifting for family, teams and clients",
    to: "/gifts?category=diwali-hampers",
  },
  {
    label: "Wedding Hampers",
    subtitle: "Elegant gifting for wedding celebrations",
    to: "/gifts?category=wedding-hampers",
  },
  {
    label: "Corporate Hampers",
    subtitle: "Ready-made gifts for teams and clients",
    to: "/gifts?category=corporate-hampers",
  },
  {
    label: "Festive Hampers",
    subtitle: "Curated gifting for festive moments",
    to: "/gifts?category=festive-hampers",
  },
  {
    label: "Premium Hampers",
    subtitle: "Elevated luxury gifting selections",
    to: "/gifts?category=premium-hampers",
  },
];

const POPULAR_SEARCHES = [
  "Wedding",
  "Corporate",
  "Diwali",
  "Festive",
  "Premium",
  "Custom Hamper",
];

// One search control, one morphing content slot: icon -> Find -> Gifts -> Explore.
// No search bar, second label, or independent animated line in the header.
const SEARCH_MORPH_WORDS = ["Find", "Gifts", "Explore", "Search"];

const useSearchMorph = (reduceMotion) => {
  const [stage, setStage] = useState({ phase: "icon", word: 0, letters: 0 });

  // Restore the initial icon when switching from animated desktop to compact screens.
  // Also prevents returning to a half-typed word when the desktop width returns.
  useEffect(() => {
    if (!reduceMotion) return;
    setStage((previous) =>
      previous.phase === "icon" && previous.word === 0 && previous.letters === 0
        ? previous
        : { phase: "icon", word: 0, letters: 0 }
    );
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const currentWord = SEARCH_MORPH_WORDS[stage.word];
    const delay = stage.phase === "icon" ? 1750
      : stage.phase === "typing" ? (stage.letters >= currentWord.length ? 1250 : 115)
        : stage.letters > 0 ? 72 : 300;

    const timer = window.setTimeout(() => {
      setStage((previous) => {
        const word = SEARCH_MORPH_WORDS[previous.word];
        if (previous.phase === "icon") return { ...previous, phase: "typing", letters: 0 };
        if (previous.phase === "typing") {
          return previous.letters >= word.length
            ? { ...previous, phase: "erasing" }
            : { ...previous, letters: previous.letters + 1 };
        }
        return previous.letters > 0
          ? { ...previous, letters: previous.letters - 1 }
          : { phase: "icon", word: (previous.word + 1) % SEARCH_MORPH_WORDS.length, letters: 0 };
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [reduceMotion, stage.phase, stage.word, stage.letters]);

  if (reduceMotion || stage.phase === "icon") {
    return { icon: true, text: "" };
  }
  return {
    icon: false,
    text: SEARCH_MORPH_WORDS[stage.word].slice(0, stage.letters),
  };
};

// ======================================================
// PEARL NAVIGATION
// One responsive header and one active panel. Existing API contracts,
// route destinations, referral discovery and intro event are retained.
// ======================================================
const DESKTOP_QUERY = "(min-width: 1180px)";
const PANEL_EXIT_MS = 220;

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
};

// V137: Gift-box / hamburger hybrid: 3 gilded bars on a real little gift
// box, topped by a tied satin bow. Same desktop hover + click menu trigger.
const GiftHamperArt = () => (
  <svg className="hh-gift-art" viewBox="0 0 80 74" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="hh-v137-gift-face" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FAEACB" />
        <stop offset=".55" stopColor="#E3BE7C" />
        <stop offset="1" stopColor="#BD8545" />
      </linearGradient>
      <linearGradient id="hh-v137-gift-lid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFF3D9" />
        <stop offset=".55" stopColor="#EFCB8D" />
        <stop offset="1" stopColor="#B98342" />
      </linearGradient>
      <linearGradient id="hh-v137-gift-gold" x1="0" y1="0" x2="1" y2=".6">
        <stop offset="0" stopColor="#8E5727" />
        <stop offset=".36" stopColor="#DDAE62" />
        <stop offset=".67" stopColor="#FFF1C6" />
        <stop offset="1" stopColor="#A56B30" />
      </linearGradient>
    </defs>
    <ellipse cx="40" cy="68" rx="27" ry="3.5" fill="#080504" opacity=".2" />
    <g className="hh-gift-box">
      <rect x="14" y="28" width="52" height="36" rx="4" fill="url(#hh-v137-gift-face)" stroke="#9A6934" strokeWidth="1.3" />
      <path d="M18 31H62V35H18Z" fill="#FFF3D4" opacity=".32" />
      <path d="M19 61H61" stroke="#94602C" strokeOpacity=".33" strokeWidth="1.2" />
      <g className="hh-gift-hamburger-bars" strokeLinecap="round">
        <path className="hh-gift-bar" d="M26 38H54" stroke="#8A572A" strokeWidth="5.8" />
        <path className="hh-gift-bar" d="M26 38H54" stroke="#FFF0C4" strokeWidth="2.2" />
        <path className="hh-gift-bar" d="M26 47H54" stroke="#8A572A" strokeWidth="5.8" />
        <path className="hh-gift-bar" d="M26 47H54" stroke="#FFF0C4" strokeWidth="2.2" />
        <path className="hh-gift-bar" d="M26 56H54" stroke="#8A572A" strokeWidth="5.8" />
        <path className="hh-gift-bar" d="M26 56H54" stroke="#FFF0C4" strokeWidth="2.2" />
      </g>
      <path d="M17.5 34V58" stroke="#FFF9E5" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" />
    </g>
    <g className="hh-gift-lid">
      <path d="M12 26Q12 23 16 23H64Q68 23 68 26V31Q68 33 65 33H15Q12 33 12 31Z"
        fill="url(#hh-v137-gift-lid)" stroke="#95652D" strokeWidth="1.2" />
      <path d="M16 25H64" stroke="#FFF5D5" strokeWidth="1.5" opacity=".8" strokeLinecap="round" />
      <path d="M36 23H44V33H36Z" fill="url(#hh-v137-gift-gold)" opacity=".9" />
      {/* Left bow loop, secured to lid with a polished center knot. */}
      <path d="M40 20C35 17 26 18 23 15C17 10 18 4 24 5C32 5 36 15 40 20Z"
        fill="url(#hh-v137-gift-gold)" stroke="#8C5A28" strokeWidth="1.1" />
      <path d="M40 20C45 17 54 18 57 15C63 10 62 4 56 5C48 5 44 15 40 20Z"
        fill="url(#hh-v137-gift-gold)" stroke="#8C5A28" strokeWidth="1.1" />
      <path d="M26 9C33 10 35 16 39 19M54 9C47 10 45 16 41 19"
        fill="none" stroke="#FFF7D9" strokeWidth="1.6" opacity=".8" strokeLinecap="round" />
      <path d="M39 22C33 25 30 28 26 28L29 22L36 19Z" fill="#B4813B" stroke="#9A6B31" strokeWidth=".6" />
      <path d="M41 22C47 25 50 28 54 28L51 22L44 19Z" fill="#C49247" stroke="#9A6B31" strokeWidth=".6" />
      <path d="M36.7 18Q40 15.6 43.3 18L44.5 22Q40 25.5 35.5 22Z"
        fill="url(#hh-v137-gift-gold)" stroke="#885521" strokeWidth="1.05" />
      <path d="M37.5 19Q40 17.5 42.5 19" stroke="#FFF7DF" strokeWidth="1.15" fill="none" strokeLinecap="round" />
    </g>
  </svg>
);

// V133: original horse is static within the authentic logo image.
// V111: sculpted satin scroll with physical rolled ends and flowing edges.
// Kept as vectors so the ribbon remains sharp on retina/mobile screens.
// V120: Full-bleed gold silk reaches both viewport edges, backed by a precisely matching static wave.
// It fills the space between the main header and every ribbon dip, so the
// header and ribbon look like ONE continuous, wavy piece of fabric.
// It intentionally does not move with the untie animation.
const HhConnectedHeaderWave = ({ side = "left" }) => (
  <svg className={`hh-connected-wave-art ${side === "right" ? "hh-v111-flipped" : ""}`}
    viewBox="0 0 900 150" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path className="hh-connected-wave-fill"
      d="M0 0 H900 V120
         C753 90 659 91 553 118
         C436 148 329 146 228 113
         C165 94 123 94 87 105
         C58 108 31 116 0 118 Z" />
  </svg>
);

// V125: a genuine V-NOTCHED / fishtail cut in the fabric outline itself.
// Both outer ends are mirrored by the existing flipped-right SVG class;
// no painted-on arrow or folded-ring graphic at the ends.
// The wave profile, width, thickness, colour and reveal animation stay V124.
const HhSculptedRibbon = ({ side = "left" }) => {
  const fillId = `hh-v125-silk-${side}`;
  const foldId = `hh-v125-fold-${side}`;
  const lightId = `hh-v125-glow-${side}`;
  const clipId = `hh-v125-v-notch-clip-${side}`;
  // Notice the LAST two segments: L78 81 L0 45.
  // They cut a deep open V into the left outer edge; right edge is mirrored.
  // Unlike the old V124 ornament, this V is cut from the real ribbon silhouette.
  const bandD = `M0 45
    C28 35 56 31 87 34 C132 29 169 44 236 64
    C323 89 423 80 541 49 C655 18 741 18 900 48
    L900 120 C753 90 659 91 553 118
    C436 148 329 146 228 113 C165 94 123 94 87 105
    C58 108 31 116 0 118
    L78 81 Z`;

  return (
    <svg className={`hh-v111-scroll-art ${side === "right" ? "hh-v111-flipped" : ""}`}
      viewBox="0 0 900 150" preserveAspectRatio="none" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a66b27" />
          <stop offset=".13" stopColor="#eed08a" />
          <stop offset=".33" stopColor="#ffecad" />
          <stop offset=".58" stopColor="#dca950" />
          <stop offset=".82" stopColor="#b27b30" />
          <stop offset="1" stopColor="#794916" />
        </linearGradient>
        <linearGradient id={foldId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#734117" stopOpacity=".13" />
          <stop offset=".50" stopColor="#85531e" stopOpacity=".36" />
          <stop offset="1" stopColor="#fff0b7" stopOpacity=".14" />
        </linearGradient>
        <linearGradient id={lightId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d3" stopOpacity=".13" />
          <stop offset=".38" stopColor="#fff7d0" stopOpacity=".27" />
          <stop offset=".78" stopColor="#754415" stopOpacity=".12" />
          <stop offset="1" stopColor="#4e2a11" stopOpacity=".18" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={bandD} />
        </clipPath>
      </defs>
      {/* The V is an actual transparent notch, with clean sharply-cut tips. */}
      <path d={bandD} fill={`url(#${fillId})`}
        stroke="#9b6426" strokeWidth="2.1" strokeLinejoin="round" />
      <g clipPath={`url(#${clipId})`}>
        <path d={bandD} fill={`url(#${lightId})`} />
        {/* Satin pressed folds, restrained so the fishtail silhouette stays clear. */}
        <path d="M0 45 Q46 48 94 64 L117 100 Q75 86 0 118 L78 81 Z"
          fill={`url(#${foldId})`} opacity=".40" />
        <path d="M0 48 C28 39 57 36 87 39 C132 34 168 49 236 69
          C323 94 423 85 541 54 C655 23 741 23 900 53"
          fill="none" stroke="#fff3c4" strokeOpacity=".79" strokeWidth="2.7" />
        <path d="M0 109 C31 107 58 99 87 97 C123 86 165 87 228 105
          C329 138 436 140 553 110 C659 83 753 82 900 112"
          fill="none" stroke="#683d13" strokeOpacity=".50" strokeWidth="2.8" />
      </g>
      {/* Fine piping follows the two diagonal V-cut edges, not an applied graphic. */}
      <path d="M1 46 L78 81 L1 117"
        fill="none" stroke="#704112" strokeOpacity=".52" strokeWidth="1.7"
        strokeLinejoin="miter" />
      <path d="M3 48 L72 81 L3 115"
        fill="none" stroke="#fff0b6" strokeOpacity=".55" strokeWidth="1.15"
        strokeLinejoin="miter" />
    </svg>
  );
};

// V128: center-tied silk bow with physically staged knot, wing and tail release.
// It stays fully tied during the opening hold, then releases with the two ribbon halves.
const HhCeremonialBow = () => (
  <span className="hh-ceremony-bow" aria-hidden="true">
    <svg viewBox="0 0 176 112" className="hh-ceremony-bow-art" focusable="false">
      <defs>
        <linearGradient id="hh-v127-bow-satin" x1="0" x2=".85" y1="0" y2="1">
          <stop offset="0" stopColor="#85501D" />
          <stop offset=".24" stopColor="#E2B95F" />
          <stop offset=".48" stopColor="#FFF1BD" />
          <stop offset=".69" stopColor="#D8A650" />
          <stop offset="1" stopColor="#86521A" />
        </linearGradient>
        <linearGradient id="hh-v127-bow-shadow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#603914" />
          <stop offset=".48" stopColor="#D5A34B" />
          <stop offset="1" stopColor="#693B0D" />
        </linearGradient>
        <linearGradient id="hh-v127-bow-knot" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#9D6823" />
          <stop offset=".37" stopColor="#FFF1C0" />
          <stop offset=".72" stopColor="#E3B45A" />
          <stop offset="1" stopColor="#794616" />
        </linearGradient>
      </defs>
      <g className="hh-ceremony-bow-tail-left">
        <path d="M83 54 C65 59 55 74 38 107 L49 98 L63 109 C66 85 80 68 91 59Z"
          fill="url(#hh-v127-bow-satin)" stroke="#82501E" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M80 59 C61 78 59 93 55 100" fill="none" stroke="#FFF0BA" strokeWidth="2" opacity=".68" />
      </g>
      <g className="hh-ceremony-bow-tail-right">
        <path d="M93 54 C111 59 121 74 138 107 L127 98 L113 109 C110 85 96 68 85 59Z"
          fill="url(#hh-v127-bow-satin)" stroke="#82501E" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M96 59 C115 78 117 93 121 100" fill="none" stroke="#FFF0BA" strokeWidth="2" opacity=".68" />
      </g>
      <g className="hh-ceremony-bow-wing-left">
        <path d="M86 51 C66 33 39 14 22 25 C6 37 13 61 30 67 C47 73 72 62 86 56Z"
          fill="url(#hh-v127-bow-satin)" stroke="#8C5B24" strokeWidth="1.8" />
        <path d="M80 51 C65 44 44 30 28 34 C19 36 22 53 33 57 C48 62 66 58 80 53Z"
          fill="url(#hh-v127-bow-shadow)" opacity=".34" />
        <path d="M77 50 C56 37 37 29 24 35" fill="none" stroke="#FFF5CC" strokeOpacity=".8" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M73 54 C52 66 37 66 26 59" fill="none" stroke="#73431B" strokeOpacity=".5" strokeWidth="1.8" />
      </g>
      <g className="hh-ceremony-bow-wing-right">
        <path d="M90 51 C110 33 137 14 154 25 C170 37 163 61 146 67 C129 73 104 62 90 56Z"
          fill="url(#hh-v127-bow-satin)" stroke="#8C5B24" strokeWidth="1.8" />
        <path d="M96 51 C111 44 132 30 148 34 C157 36 154 53 143 57 C128 62 110 58 96 53Z"
          fill="url(#hh-v127-bow-shadow)" opacity=".34" />
        <path d="M99 50 C120 37 139 29 152 35" fill="none" stroke="#FFF5CC" strokeOpacity=".8" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M103 54 C124 66 139 66 150 59" fill="none" stroke="#73431B" strokeOpacity=".5" strokeWidth="1.8" />
      </g>
      <g className="hh-ceremony-bow-knot">
        <path d="M80 43 C84 40 92 40 96 43 L101 57 C98 65 91 69 86 67 C81 66 77 61 76 56Z"
          fill="url(#hh-v127-bow-knot)" stroke="#88531D" strokeWidth="1.5" />
        <path d="M81 46 C87 44 93 44 96 46" fill="none" stroke="#FFF3C5" strokeWidth="2" strokeLinecap="round" />
        <path d="M80 59 C85 63 92 64 97 59" fill="none" stroke="#9A6628" strokeOpacity=".6" strokeWidth="1.5" />
      </g>
    </svg>
  </span>
);

// V136: Extract the original HAMPORIUM logo into 2 clean layers:
// 1) a correctly shaped orange shield silhouette
// 2) the stationary white horse + HAMPORIUM lettering artwork
// This avoids the distorted shield shape seen in V135.
const useShieldOnlyLayers = (source) => {
  const [layers, setLayers] = useState(null);

  useEffect(() => {
    if (!source) {
      setLayers(null);
      return undefined;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      try {
        const w = image.naturalWidth;
        const h = image.naturalHeight;
        if (!w || !h) throw new Error("Empty logo");

        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = w;
        sourceCanvas.height = h;

        const sourceContext = sourceCanvas.getContext("2d", {
          willReadFrequently: true,
        });

        if (!sourceContext) throw new Error("Canvas unavailable");

        sourceContext.drawImage(image, 0, 0);
        const input = sourceContext.getImageData(0, 0, w, h).data;

        const shieldCanvas = document.createElement("canvas");
        shieldCanvas.width = w;
        shieldCanvas.height = h;

        const artCanvas = document.createElement("canvas");
        artCanvas.width = w;
        artCanvas.height = h;

        const shieldContext = shieldCanvas.getContext("2d");
        const artContext = artCanvas.getContext("2d");

        if (!shieldContext || !artContext) throw new Error("Canvas unavailable");

        const shield = shieldContext.createImageData(w, h);
        const art = artContext.createImageData(w, h);

        let orangeR = 0;
        let orangeG = 0;
        let orangeB = 0;
        let orangeCount = 0;
        let solidPixelCount = 0;

        const isOrangeShieldPixel = (r, g, b, a) => {
          if (a < 40) return false;
          return r > 150 && g > 50 && g < 210 && b < 150 && r > g + 35 && g > b + 8;
        };

        const isWhiteArtworkPixel = (r, g, b, a) => {
          if (a < 40) return false;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          return max > 182 && min > 132 && max - min < 78;
        };

        for (let i = 0; i < input.length; i += 4) {
          const r = input[i];
          const g = input[i + 1];
          const b = input[i + 2];
          const a = input[i + 3];

          if (a > 28) {
            solidPixelCount += 1;
          }

          if (isOrangeShieldPixel(r, g, b, a)) {
            orangeR += r;
            orangeG += g;
            orangeB += b;
            orangeCount += 1;
          }
        }

        if (solidPixelCount < Math.max(50, w * h * 0.02) || orangeCount < Math.max(25, solidPixelCount * 0.08)) {
          throw new Error("Shield color mask not identifiable");
        }

        const fillR = Math.round(orangeR / orangeCount);
        const fillG = Math.round(orangeG / orangeCount);
        const fillB = Math.round(orangeB / orangeCount);

        for (let i = 0; i < input.length; i += 4) {
          const r = input[i];
          const g = input[i + 1];
          const b = input[i + 2];
          const a = input[i + 3];

          if (a > 28) {
            shield.data[i] = fillR;
            shield.data[i + 1] = fillG;
            shield.data[i + 2] = fillB;
            shield.data[i + 3] = a;
          }

          if (isWhiteArtworkPixel(r, g, b, a)) {
            art.data[i] = 255;
            art.data[i + 1] = 252;
            art.data[i + 2] = 242;
            art.data[i + 3] = a;
          }
        }

        shieldContext.putImageData(shield, 0, 0);
        artContext.putImageData(art, 0, 0);

        if (!cancelled) {
          setLayers({
            shield: shieldCanvas.toDataURL("image/png"),
            artwork: artCanvas.toDataURL("image/png"),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setLayers(null);
        }
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        setLayers(null);
      }
    };

    image.src = source;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [source]);

  return layers;
};

const Header = () => {
  const { user, partner, logout } = useAuth();
  const { cart } = useCart();
  const { deliveryLocation } = useDeliveryLocation();
  const location = useLocation();
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const compactDesktop = useMediaQuery("(max-width: 1379px)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Static magnifying-glass icon on mobile/tablet (<1180px).
  // Desktop retains the existing Find / Gifts / Explore typing animation.
  // Disabling the hook also stops its animation timer on compact devices.
  const searchMorph = useSearchMorph(reduceMotion || !desktop || compactDesktop);
  const transparentLogo = useTransparentLogo(logoLight);
  const processedHamperOneLogo = useTransparentLogo(hamperOneLogo);
  const sizedHamperOneLogo = useTightlyCroppedLogo(processedHamperOneLogo);
  const shieldLayers = useShieldOnlyLayers(transparentLogo);
  const [logoIntroStarted, setLogoIntroStarted] = useState(false);
  const [logoIntroDone, setLogoIntroDone] = useState(false);
  const logoPlayedRef = useRef(false);
  const instanceId = useId().replace(/:/g, "");
  const panelId = `hh-panel-${instanceId}`;

  const headerRef = useRef(null);
  const panelRef = useRef(null);
  const overlayRef = useRef(null);
  const searchInputRef = useRef(null);
  const triggerRef = useRef(null);
  const hamperTriggerRef = useRef(null);
  const searchTriggerRef = useRef(null);
  const hoverTimerRef = useRef(0);
  const hampersPinnedRef = useRef(false);
  const scrollFrameRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const mobileScrollTravelRef = useRef(0);
  // First user scroll dismisses the film gate; keep navigation visible briefly
  // before ordinary down-hide/up-show scroll behavior resumes.
  const introRevealUntilRef = useRef(0);
  const restoreFocusRef = useRef(false);
  const notificationsRef = useRef(null);
  const notificationsPinnedRef = useRef(false);
  const [panel, setPanel] = useState(null);
  const [renderedPanel, setRenderedPanel] = useState(null);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchRetry, setSearchRetry] = useState(0);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [homeIntroActive, setHomeIntroActive] = useState(() =>
    location.pathname === "/" && (typeof window === "undefined" || window.scrollY <= 12)
  );

  const isHome = location.pathname === "/";
  const isHamperOne = location.pathname.startsWith("/hamper-one");
  const isAdmin = Boolean(user?.roles?.some((role) => ["admin", "operations"].includes(role)));
  const isPartner = Boolean(user?.roles?.includes("partner"));
  const partnerPortalPath = partner?.status === "approved" ? "/partner" : "/partner/status";
  const becomePartnerPath = "/event-partners";
  const currentPagePath = `${location.pathname}${location.search || ""}`;
  const hamperMenuActive = location.pathname === "/gifts" ||
    location.pathname.startsWith("/custom-hamper") || location.pathname.startsWith("/products");
  const cartCount = Math.max(0, Number(cart?.totalItems) || 0);
  const darkContent = !(isHome || isHamperOne) || scrolledPastHero || Boolean(renderedPanel);
  const source = desktop ? "desktop_header" : "mobile_header";
  const introHidden = isHome && homeIntroActive;
  const isModal = !desktop && Boolean(renderedPanel);

  // V135: one shield-only spin when the logo's layers are ready.
  // Horse/wordmark stay visible and fixed, even throughout the spin.
  useEffect(() => {
    if (introHidden || reduceMotion || logoPlayedRef.current || !shieldLayers?.shield) return undefined;
    logoPlayedRef.current = true;
    setLogoIntroStarted(true);
    return undefined;
  }, [introHidden, reduceMotion, shieldLayers?.shield]);

  useEffect(() => {
    if (!logoIntroStarted) return undefined;
    const timer = window.setTimeout(() => setLogoIntroDone(true), 1800);
    return () => window.clearTimeout(timer);
  }, [logoIntroStarted]);

  const headerIntroPhase = reduceMotion || logoIntroDone
    ? "hh-intro-done"
    : logoIntroStarted ? "hh-intro-running" : "hh-intro-pending";

  const clearHoverTimer = useCallback(() => {
    window.clearTimeout(hoverTimerRef.current);
  }, []);

  const closePanel = useCallback((restoreFocus = true) => {
    window.clearTimeout(hoverTimerRef.current);
    hampersPinnedRef.current = false;
    restoreFocusRef.current = restoreFocus;
    setPanel(null);
  }, []);

  const openPanel = (name, element) => {
    clearHoverTimer();
    if (name !== "hampers") hampersPinnedRef.current = false;
    if (element && !overlayRef.current?.contains(element)) triggerRef.current = element;
    restoreFocusRef.current = false;
    notificationsPinnedRef.current = false;
    setHeaderHidden(false);
    setLogoutError("");
    setPanel(name);
  };

  const togglePanel = (name, event) => {
    if (panel === name) closePanel();
    else openPanel(name, event?.currentTarget || document.activeElement);
  };

  // Hover opens a temporary preview. A real click PINS the menu open, even
  // when the pointer leaves the icon or the dropdown. Clicking again closes.
  // If hover already opened it, first click pins rather than toggling closed.
  const handleHamperMenuClick = (event) => {
    event.preventDefault();
    clearHoverTimer();
    if (panel === "hampers" && hampersPinnedRef.current) {
      closePanel(false);
      return;
    }
    hampersPinnedRef.current = true;
    openPanel("hampers", event.currentTarget);
  };

  // Keep the outgoing panel mounted just long enough for its exit transition.
  useEffect(() => {
    if (panel) {
      setRenderedPanel(panel);
      return undefined;
    }
    const timer = window.setTimeout(() => setRenderedPanel(null), reduceMotion ? 0 : PANEL_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [panel, reduceMotion]);

  // Intro lifecycle is owned by Home. Listen before syncing its current state
  // so a quick Skip, a cached session or a scroll during loading cannot leave
  // the common header hidden indefinitely.
  useEffect(() => {
    if (!isHome) {
      setHomeIntroActive(false);
      introRevealUntilRef.current = 0;
      return undefined;
    }
    const onIntro = (event) => {
      const active = Boolean(event?.detail?.active) && window.scrollY <= 12;
      setHomeIntroActive(active);
      if (!active) {
        const reason = event?.detail?.reason;
        if (reason === "scroll" || reason === "skip" || reason === "explore") {
          introRevealUntilRef.current = performance.now() + 1100;
        }
        setHeaderHidden(false);
        mobileScrollTravelRef.current = 0;
        lastScrollYRef.current = Math.max(0, window.scrollY || 0);
      }
    };
    window.addEventListener("hamporium:intro-state", onIntro);
    // Each page visit/reload starts the film again. Never read V149's
    // sessionStorage seen flag: it caused a poster-only hero on refresh.
    // The Home component sends the authoritative start/stop event.
    setHomeIntroActive(window.scrollY <= 12);
    return () => window.removeEventListener("hamporium:intro-state", onIntro);
  }, [isHome]);

  useEffect(() => {
    clearHoverTimer();
    hampersPinnedRef.current = false;
    restoreFocusRef.current = false;
    setPanel(null);
    setRenderedPanel(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setHeaderHidden(false);
    notificationsPinnedRef.current = false;
    lastScrollYRef.current = Math.max(0, window.scrollY || 0);
    mobileScrollTravelRef.current = 0;
    introRevealUntilRef.current = 0;
  }, [location.pathname, location.search, clearHoverTimer]);

  // Close the outgoing viewport's panel before switching desktop/mobile layouts.
  useEffect(() => {
    restoreFocusRef.current = false;
    setPanel(null);
    setRenderedPanel(null);
    setHeaderHidden(false);
    clearHoverTimer();
  }, [desktop, clearHoverTimer]);

  useEffect(() => {
    const update = () => {
      scrollFrameRef.current = 0;
      const y = Math.max(0, window.scrollY || 0);
      const delta = y - lastScrollYRef.current;
      setScrolledPastHero(y > 585);
      // First scroll during an unfinished film: show the header immediately.
      // Subsequent scrolling uses exactly the old directional behavior.
      if (isHome && homeIntroActive && y > 12) {
        setHomeIntroActive(false);
        introRevealUntilRef.current = performance.now() + 1100;
        mobileScrollTravelRef.current = 0;
        setHeaderHidden(false);
        lastScrollYRef.current = y;
        return;
      }
      const focusInside = headerRef.current?.contains(document.activeElement);
      // On touchscreens a tapped header button can keep focus indefinitely.
      // Do not let that stale focus pin the mobile header in view.
      const justDismissedIntro = isHome && performance.now() < introRevealUntilRef.current;
      const mustStayVisible = y <= 76 || justDismissedIntro || Boolean(renderedPanel) ||
        notificationsPinnedRef.current || (desktop && focusInside);
      if (mustStayVisible) {
        mobileScrollTravelRef.current = 0;
        setHeaderHidden(false);
      } else if (desktop) {
        // Preserve the existing desktop behavior.
        if (Math.abs(delta) >= 6) setHeaderHidden(delta > 0);
      } else if (Math.abs(delta) >= 1) {
        // Small directional threshold prevents mobile jitter on touch scroll.
        const travel = mobileScrollTravelRef.current;
        mobileScrollTravelRef.current =
          (travel === 0 || Math.sign(travel) === Math.sign(delta))
            ? travel + delta : delta;
        if (mobileScrollTravelRef.current >= 12) {
          setHeaderHidden(true);
          mobileScrollTravelRef.current = 0;
        } else if (mobileScrollTravelRef.current <= -9) {
          setHeaderHidden(false);
          mobileScrollTravelRef.current = 0;
        }
      }
      lastScrollYRef.current = y;
    };
    const onScroll = () => {
      if (!scrollFrameRef.current) scrollFrameRef.current = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = 0;
    };
  }, [renderedPanel, desktop, isHome, homeIntroActive]);

  useEffect(() => {
    const onPointer = (event) => {
      if (!notificationsRef.current?.contains(event.target)) notificationsPinnedRef.current = false;
      if (!panel || isModal) return;
      if (!headerRef.current?.contains(event.target) && !overlayRef.current?.contains(event.target)) {
        closePanel(false);
      }
    };
    const onFocus = (event) => {
      if (!panel || isModal) return;
      if (!headerRef.current?.contains(event.target) && !overlayRef.current?.contains(event.target)) {
        closePanel(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
    };
  }, [panel, isModal, closePanel]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        closePanel();
        notificationsPinnedRef.current = false;
        return;
      }
      const target = event.target;
      const editing = target instanceof HTMLElement &&
        (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName));
      const shortcut = ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") ||
        (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey);
      if (shortcut && !editing && !introHidden) {
        event.preventDefault();
        triggerRef.current = searchTriggerRef.current;
        setHeaderHidden(false);
        setPanel("search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePanel, introHidden]);

  // Mobile panels are actual dialogs: background inertness, scroll lock,
  // focus trapping and focus restoration are managed together.
  useEffect(() => {
    if (!renderedPanel || introHidden) return undefined;
    const modal = !desktop;
    const node = panelRef.current;
    const overlay = overlayRef.current;
    if (!node || !overlay) return undefined;
    let frame = 0;
    const savedOverflow = document.body.style.overflow;
    const savedPadding = document.body.style.paddingRight;
    const siblings = [];
    const makeInert = (element) => {
      if (!(element instanceof HTMLElement) || element === overlay || element.contains(overlay)) return;
      if (siblings.some(([saved]) => saved === element)) return;
      siblings.push([element, element.inert]);
      element.inert = true;
    };
    let mutation;
    const focusables = () => Array.from(node.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]'
    )).filter((item) => item.getClientRects().length && item.getAttribute("aria-hidden") !== "true");
    const trap = (event) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); node.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    if (modal) {
      Array.from(document.body.children).forEach(makeInert);
      mutation = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach(makeInert)));
      mutation.observe(document.body, { childList: true });
      const gutter = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (gutter > 0) document.body.style.paddingRight = `${gutter}px`;
      document.addEventListener("keydown", trap);
    }
    frame = window.requestAnimationFrame(() => {
      if (renderedPanel === "search") searchInputRef.current?.focus({ preventScroll: true });
      else if (modal) (focusables()[0] || node).focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      mutation?.disconnect();
      document.removeEventListener("keydown", trap);
      if (modal) {
        document.body.style.overflow = savedOverflow;
        document.body.style.paddingRight = savedPadding;
        siblings.forEach(([element, inert]) => { element.inert = inert; });
      }
      if (restoreFocusRef.current && triggerRef.current?.isConnected && triggerRef.current.getClientRects().length) {
        triggerRef.current.focus({ preventScroll: true });
        restoreFocusRef.current = false;
      }
    };
  }, [renderedPanel, desktop, introHidden]);

  // Preserve search contract; discard stale responses rather than showing
  // a previous query's results under the next query.
  useEffect(() => {
    const query = searchQuery.trim();
    if (panel !== "search" || query.length < 2) {
      setSearchResults([]); setSearchLoading(false); setSearchError("");
      return undefined;
    }
    let active = true;
    setSearchResults([]); setSearchError(""); setSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get("/catalog/products", { params: { search: query, limit: 6 } });
        if (active) setSearchResults(Array.isArray(response.data?.products) ? response.data.products : []);
      } catch {
        if (active) { setSearchResults([]); setSearchError("Search is taking a moment. Please try again."); }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 280);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchQuery, panel, searchRetry]);

  useEffect(() => {
    if (!user) { setNotificationUnread(0); return undefined; }
    let active = true;
    const load = async () => {
      try {
        const response = await api.get("/notifications/mine?page=1&limit=1");
        if (active) setNotificationUnread(Math.max(0, Number(response.data?.unread) || 0));
      } catch { if (active) setNotificationUnread(0); }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?._id, user?.id, location.pathname]);

  useEffect(() => () => window.clearTimeout(hoverTimerRef.current), []);

  const submitSearch = (event) => {
    event?.preventDefault?.();
    const query = searchQuery.trim();
    if (!query) { searchInputRef.current?.focus(); return; }
    void trackSearchAnalytics({
      eventType: "search_submit", query, source,
      visibleResultCount: searchLoading ? null : searchResults.length,
      pagePath: currentPagePath, location: deliveryLocation,
    });
    void trackCustomerActivity("search_submitted", { query, path: currentPagePath });
    closePanel(false);
    navigate(`/gifts?search=${encodeURIComponent(query)}`);
  };

  const goToProduct = (product) => {
    if (!product?.slug) return;
    const query = searchQuery.trim();
    if (query) void trackSearchAnalytics({
      eventType: "search_result_click", query, source,
      visibleResultCount: searchResults.length, pagePath: currentPagePath,
      productId: product._id, productSlug: product.slug, productName: product.name,
      location: deliveryLocation,
    });
    closePanel(false);
    navigate(`/products/${product.slug}`);
  };

  const handlePopularSearch = (value) => {
    void trackSearchAnalytics({
      eventType: "popular_search_click", query: value, source,
      pagePath: currentPagePath, location: deliveryLocation,
    });
    setSearchQuery(value);
    searchInputRef.current?.focus();
  };

  const handleLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true); setLogoutError("");
    try {
      await logout();
      closePanel(false);
      navigate("/");
    } catch { setLogoutError("Unable to sign out. Please try again."); }
    finally { setLogoutBusy(false); }
  };

  const scheduleMenuOpen = (event) => {
    if (!desktop || event.pointerType !== "mouse" || panel === "hampers" || (panel && panel !== "hampers")) return;
    clearHoverTimer();
    const element = event.currentTarget;
    hoverTimerRef.current = window.setTimeout(() => openPanel("hampers", element), 140);
  };
  const scheduleMenuClose = () => {
    clearHoverTimer();
    if (panel !== "hampers" || hampersPinnedRef.current) return;
    hoverTimerRef.current = window.setTimeout(() => {
      // Keep keyboard-opened navigation visible while its links have focus.
      if (!hampersPinnedRef.current && !panelRef.current?.contains(document.activeElement)) closePanel(false);
    }, 260);
  };
  const accountProps = {
    user, isAdmin, isPartner, partnerPortalPath, becomePartnerPath,
    handleLogout, logoutBusy, logoutError,
  };
  const panelTitle = {
    hampers: "Find your kind of gift.", search: "A thoughtful gift starts here.",
    account: user ? "Your account" : "Welcome to HAMPORIUM",
    menu: "Explore HAMPORIUM",
  }[renderedPanel];

  if (introHidden) return null;

  return (
    <>
      <style>{HEADER_CSS}</style>
      <header
        ref={headerRef}
        className={`hh-header ${darkContent ? "hh-light" : "hh-hero"} ${headerIntroPhase} ${headerHidden ? "hh-hidden" : ""}`}
        onFocusCapture={() => setHeaderHidden(false)}
      >
        <div className="hh-bar">
          {desktop ? (
            <nav className="hh-nav" aria-label="Primary navigation">
              <button
                ref={hamperTriggerRef} type="button"
                className={`hh-nav-link hh-gift-trigger ${hamperMenuActive ? "is-current" : ""} ${panel === "hampers" ? "is-open" : ""}`}
                aria-expanded={panel === "hampers"} aria-controls={panel === "hampers" ? panelId : undefined}
                onClick={handleHamperMenuClick}
                onPointerEnter={scheduleMenuOpen} onPointerLeave={scheduleMenuClose}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault(); hampersPinnedRef.current = true; openPanel("hampers", event.currentTarget);
                    window.setTimeout(() => panelRef.current?.querySelector("a[href]")?.focus(), 40);
                  }
                }}
                aria-label="Browse hampers" title="Explore hampers"
              ><GiftHamperArt /><span className="hh-sr-only">Browse hampers</span></button>
              <Link to="/hamper-one" className={`hh-private-link ${isHamperOne ? "is-current" : ""}`} aria-current={isHamperOne ? "page" : undefined} aria-label="Hamper One private collection" onClick={() => closePanel(false)}>
                <img src={sizedHamperOneLogo || TRANSPARENT_IMAGE} className="hh-hamperone-image" alt="HAMPER ONE" loading="eager" draggable="false" />
              </Link>
            </nav>
          ) : (
            <ActionButton label="Open menu" className="hh-mobile-menu-trigger" active={panel === "menu"}
              controls={panel === "menu" ? panelId : undefined}
              onClick={(event) => togglePanel("menu", event)}>
              {panel === "menu" ? <Icon name="close" /> : <GiftHamperArt />}
            </ActionButton>
          )}

          <Link
            to="/" className="hh-brand" aria-label="HAMPORIUM home"
            onClick={() => closePanel(false)}
          >
            <span className="hh-brand-mark">
              <span className={`hh-logo-sequence ${headerIntroPhase === "hh-intro-running" ? "hh-logo-animating" : "hh-logo-idle"}`}>
                {shieldLayers?.shield && shieldLayers?.artwork ? (
                  <span className="hh-logo-split" aria-hidden="true">
                    <span className="hh-logo-shield"><img src={shieldLayers.shield} alt="" draggable="false" /></span>
                    <span className="hh-logo-fixed-art"><img src={shieldLayers.artwork} alt="" draggable="false" /></span>
                  </span>
                ) : (
                  <span className="hh-logo-full" aria-hidden="true"><img src={transparentLogo || logoLight} alt="" draggable="false" /></span>
                )}
              </span>
            </span>
          </Link>

          <div className="hh-tools">
            <button ref={searchTriggerRef} type="button"
              className={`hh-search-trigger ${panel === "search" ? "is-open" : ""}`}
              aria-label="Find a gift - open search" aria-expanded={panel === "search"}
              aria-controls={panel === "search" ? panelId : undefined}
              onClick={(event) => togglePanel("search", event)}>
              <span className="hh-search-morph" aria-hidden="true">
                {searchMorph.icon ? (
                  <span className="hh-search-morph-icon" key="icon"><Icon name="search" /></span>
                ) : (
                  <span className="hh-search-morph-word" key="word">
                    {searchMorph.text}<i className="hh-search-morph-caret" />
                  </span>
                )}
              </span>
            </button>

            <button type="button" className={`hh-account-trigger hh-action ${panel === "account" ? "is-open" : ""}`}
              aria-label={user ? "Account" : "Login"} aria-expanded={panel === "account"}
              aria-controls={panel === "account" ? panelId : undefined}
              onClick={(event) => togglePanel("account", event)}>
              <Icon name="account" />
              <span className="hh-account-label">{user ? "Account" : "Login"}</span>
            </button>

            {user && (
              <div className="hh-notifications" ref={notificationsRef}
                onPointerDownCapture={() => { closePanel(false); notificationsPinnedRef.current = true; setHeaderHidden(false); }}
                onFocusCapture={() => { notificationsPinnedRef.current = true; setHeaderHidden(false); }}>
                <HeaderNotifications mobile={!desktop} darkContent={darkContent} unread={notificationUnread} onUnreadChange={setNotificationUnread} />
              </div>
            )}

            <Link to="/cart" className="hh-action hh-cart" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`} onClick={() => closePanel(false)}>
              <Icon name="bag" />
              {cartCount > 0 && <span className="hh-count" key={cartCount}>{cartCount > 99 ? "99+" : cartCount}</span>}
            </Link>
          </div>
        </div>
      </header>

      {renderedPanel && typeof document !== "undefined" && createPortal(
        <div ref={overlayRef} className={`hh-overlay ${desktop ? "hh-desktop-overlay" : "hh-mobile-overlay"} ${panel ? "is-visible" : "is-leaving"} hh-overlay-${renderedPanel}`}>
          <div className="hh-backdrop" aria-hidden="true" onPointerDown={() => closePanel()} />
          <section
            ref={panelRef} id={panelId} tabIndex={-1}
            className={`hh-panel hh-panel-${renderedPanel}`}
            role={isModal ? "dialog" : "region"} aria-modal={isModal ? "true" : undefined}
            aria-labelledby={`${panelId}-title`}
            onPointerEnter={renderedPanel === "hampers" ? clearHoverTimer : undefined}
            onPointerLeave={renderedPanel === "hampers" ? scheduleMenuClose : undefined}
            onClickCapture={(event) => {
              if (event.target.closest("a[href]")) closePanel(false);
            }}
          >
            <div className="hh-panel-top">
              <div><p className="hh-eyebrow">{renderedPanel === "hampers" ? "Gifting, your way" : renderedPanel === "search" ? "Discover HAMPORIUM" : renderedPanel === "menu" ? "The gifting edit" : "HAMPORIUM"}</p>
                <h2 id={`${panelId}-title`}>{panelTitle}</h2></div>
              <button type="button" className="hh-close" onClick={() => closePanel()} aria-label="Close panel"><Icon name="close" /></button>
            </div>
            <div className="hh-panel-body">
              {renderedPanel === "hampers" && <HamperMenu />}
              {renderedPanel === "search" && <SearchPanel
                inputRef={searchInputRef} query={searchQuery} setQuery={setSearchQuery}
                results={searchResults} loading={searchLoading} error={searchError}
                retry={() => setSearchRetry((value) => value + 1)}
                submitSearch={submitSearch} goToProduct={goToProduct} onPopular={handlePopularSearch}
                id={instanceId}
              />}
              {renderedPanel === "account" && <AccountPanel {...accountProps} />}
              {renderedPanel === "menu" && <MobileMenu
                hamperOneLogoSrc={sizedHamperOneLogo || TRANSPARENT_IMAGE}
                {...accountProps}
                notificationUnread={notificationUnread} onUnreadChange={setNotificationUnread}
                onSearch={() => openPanel("search")}
              />}
            </div>
          </section>
        </div>, document.body
      )}
    </>
  );
};

const ActionButton = ({ label, className = "", active, controls, onClick, children }) => (
  <button type="button" className={`hh-action ${className} ${active ? "is-open" : ""}`} aria-label={label}
    aria-expanded={Boolean(active)} aria-controls={controls} onClick={onClick}>{children}</button>
);

const COLLECTIONS = HAMPER_DROPDOWN.filter((item) => !item.special && item.to !== "/gifts");
const BUILDER_OPTIONS = HAMPER_DROPDOWN.find((item) => item.special)?.options || [];

const HamperMenu = () => (
  <div className="hh-mega-grid">
    <Link className="hh-shop-feature" to="/gifts">
      <ParcelArt />
      <div><p className="hh-eyebrow">The ready-made edit</p><h3>Beautifully chosen.<br /><em>Ready to gift.</em></h3>
        <span className="hh-text-link">Shop all hampers <Icon name="arrow" /></span></div>
    </Link>
    <div className="hh-mega-create">
      <p className="hh-eyebrow">Make it personal</p><h3>Build your own hamper</h3>
      {BUILDER_OPTIONS.map((item, index) => (
        <Link to={item.to} key={item.to} className="hh-choice-row">
          <span className="hh-choice-icon"><Icon name={index ? "stack" : "gift"} /></span>
          <span><strong>{item.label}</strong><small>{index ? "Request a quotation" : "Build & checkout"}</small></span><Icon name="arrow" />
        </Link>
      ))}
    </div>
    <div className="hh-mega-collections">
      <p className="hh-eyebrow">Shop by collection</p>
      <div className="hh-collection-links">
        {COLLECTIONS.map((item, index) => (
          <Link key={item.to} to={item.to}><span className="hh-index">{String(index + 1).padStart(2, "0")}</span><span>{item.label}</span><Icon name="arrow" /></Link>
        ))}
      </div>
    </div>
  </div>
);

// CSS-only packaging detail; no external image, font or animation package.
const ParcelArt = () => (
  <div className="hh-parcel-scene" aria-hidden="true">
    <div className="hh-parcel-shadow" /><div className="hh-parcel-back" />
    <div className="hh-parcel"><span className="hh-parcel-lid" /><span className="hh-ribbon-v" /><span className="hh-ribbon-h" /><span className="hh-bow-left" /><span className="hh-bow-right" /><span className="hh-bow-knot" /><span className="hh-parcel-seal">H</span></div>
  </div>
);

const SearchPanel = ({ inputRef, query, setQuery, results, loading, error, retry, submitSearch, goToProduct, onPopular, id }) => {
  const resultRef = useRef(null);
  const ready = query.trim().length >= 2;
  return (
    <div className="hh-search-panel-content">
      <form role="search" onSubmit={submitSearch} className="hh-search-form">
        <Icon name="search" />
        <label className="hh-sr-only" htmlFor={`hh-search-${id}`}>Search hampers</label>
        <input id={`hh-search-${id}`} ref={inputRef} type="search" autoComplete="off"
          value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try wedding, Diwali or a favourite gift..."
          onKeyDown={(event) => { if (event.key === "ArrowDown" && results.length) { event.preventDefault(); resultRef.current?.querySelector("button")?.focus(); } }} />
        {query && <button type="button" className="hh-clear-search" aria-label="Clear search" onClick={() => { setQuery(""); inputRef.current?.focus(); }}><Icon name="close" /></button>}
        <button className="hh-search-submit" type="submit" aria-label="Search all hampers"><Icon name="arrow" /></button>
      </form>
      {!ready ? (
        <div className="hh-search-discover">
          <div><p className="hh-eyebrow">Explore an occasion</p><div className="hh-popular">
            {POPULAR_SEARCHES.map((item) => <button key={item} type="button" onClick={() => onPopular(item)}>{item}<Icon name="arrow" /></button>)}
          </div>{query && <p className="hh-muted hh-search-hint" role="status">Type at least 2 characters to see suggestions.</p>}</div>
          <Link to="/custom-hamper" className="hh-search-bespoke"><Icon name="gift" /><strong>A gift, your way.</strong><span>Build your own hamper <Icon name="arrow" /></span></Link>
        </div>
      ) : (
        <div className="hh-search-results" aria-busy={loading}>
          <div className="hh-search-meta"><span className="hh-eyebrow">{loading ? "Finding your gift" : "Matching hampers"}</span><span aria-live="polite">{loading ? "Searching..." : error ? "Search unavailable" : `${results.length} suggestion${results.length === 1 ? "" : "s"}`}</span></div>
          {loading ? <div className="hh-result-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="hh-search-skeleton" aria-hidden="true"><span /><div><i /><i /></div></div>)}</div>
            : error ? <div className="hh-search-empty" role="status"><p>{error}</p><button type="button" className="hh-text-link" onClick={retry}>Try again <Icon name="arrow" /></button></div>
              : results.length ? <div ref={resultRef} className="hh-result-grid">{results.map((product, index) => <SearchResult key={product._id || product.slug || index} product={product} onClick={() => goToProduct(product)} />)}</div>
                : <div className="hh-search-empty"><Icon name="search" /><p>No matching suggestions yet.</p><span>Try a different occasion or browse the full collection.</span></div>}
          <button type="button" className="hh-view-results" onClick={submitSearch}>Search all hampers for <strong>{query.trim()}</strong><Icon name="arrow" /></button>
        </div>
      )}
    </div>
  );
};

const SearchResult = ({ product, onClick }) => {
  const image = getProductImage(product);
  const rawPrice = product?.minPrice ?? product?.price ?? product?.sellingPrice ?? product?.salePrice;
  const hasPrice = rawPrice != null && rawPrice !== "" && Number.isFinite(Number(rawPrice));
  return (
    <button type="button" className="hh-result" disabled={!product.slug} onClick={onClick}>
      <span className="hh-result-image"><HeaderImage src={image} alt={product.name || "Hamper"} /></span>
      <span className="hh-result-copy"><small>{product.category?.name || "HAMPORIUM"}</small><strong>{product.name}</strong>
        {hasPrice && <span className="hh-result-price">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(rawPrice))}</span>}
      </span><Icon name="arrow" />
    </button>
  );
};
const HeaderImage = ({ src, alt }) => {
  const [failedSource, setFailedSource] = useState("");
  return src && failedSource !== src
    ? <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailedSource(src)} />
    : <span className="hh-image-placeholder" aria-label={alt}><Icon name="gift" /></span>;
};

const AccountPanel = ({ user, isAdmin, isPartner, partnerPortalPath, becomePartnerPath, handleLogout, logoutBusy, logoutError }) => {
  const dashboardPath = isAdmin ? "/admin" : isPartner ? partnerPortalPath : "/account";
  return (
    <div className={`hh-account-content ${user ? "hh-account-compact" : ""}`}>
      {user ? (
        <>
          <nav className="hh-account-quick-links" aria-label="Account shortcuts">
            <Link to={dashboardPath} className="hh-account-quick-link hh-account-quick-dashboard">
              <span className="hh-account-quick-icon"><Icon name="account" /></span>
              <strong>{isAdmin ? "Admin Dashboard" : "My Dashboard"}</strong>
              <Icon name="arrow" />
            </Link>
            <Link to={isPartner ? partnerPortalPath : becomePartnerPath} className="hh-account-quick-link hh-account-quick-partner">
              <span className="hh-account-quick-icon"><Icon name="handshake" /></span>
              <strong>{isPartner ? "Partner Portal" : "Become a Partner"}</strong>
              <Icon name="arrow" />
            </Link>
          </nav>
          <div className="hh-account-signout-wrap">
            <button type="button" className="hh-account-signout" disabled={logoutBusy} onClick={handleLogout}>
              <Icon name="logout" /> {logoutBusy ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="hh-auth-actions">
            <Link to="/login" className="hh-secondary">Login</Link>
            <Link to="/signup" className="hh-primary">Sign up <Icon name="arrow" /></Link>
          </div>
          <Link to={becomePartnerPath} className="hh-partner-link">
            <Icon name="handshake" />
            <span><strong>Become a Partner</strong><small>Discover the HAMPORIUM partner program</small></span>
            <Icon name="arrow" />
          </Link>
        </>
      )}
      {logoutError && <p className="hh-error" role="alert">{logoutError}</p>}
    </div>
  );
};

const MobileMenu = ({ hamperOneLogoSrc, notificationUnread, onUnreadChange, onSearch, ...accountProps }) => (
  <div className="hh-menu-content">
    <button type="button" onClick={onSearch} className="hh-menu-search"><Icon name="search" /><span>Search for the perfect gift</span><Icon name="arrow" /></button>
    <nav aria-label="Mobile primary navigation" className="hh-mobile-nav">
      <Link to="/gifts" className="hh-mobile-major"><span className="hh-index">01</span><span>Shop hampers</span><Icon name="arrow" /></Link>
      <div className="hh-mobile-build"><div><span className="hh-index">02</span><span>Build your own</span><Icon name="gift" /></div>
        <div className="hh-mobile-order-links">{BUILDER_OPTIONS.map((item) => <Link key={item.to} to={item.to}>{item.label}<Icon name="arrow" /></Link>)}</div>
      </div>
      <Link to="/hamper-one" className="hh-mobile-private" aria-label="Hamper One private collection">
        <img src={hamperOneLogoSrc} className="hh-hamperone-image hh-hamperone-mobile-image" alt="HAMPER ONE" loading="lazy" draggable="false" />
        <Icon name="arrow" />
      </Link>
    </nav>
    <div className="hh-mobile-collections"><p className="hh-eyebrow">Explore the collections</p><div>{COLLECTIONS.map((item) => <Link key={item.to} to={item.to}>{item.label.replace(" Hampers", "")}<Icon name="arrow" /></Link>)}</div></div>
    {accountProps.user && (
      <div className="hh-menu-notifications">
        <span>Notifications</span>
        <HeaderNotifications mobile darkContent unread={notificationUnread} onUnreadChange={onUnreadChange} />
      </div>
    )}
    <AccountPanel {...accountProps} />
  </div>
);

const Icon = ({ name, className = "" }) => {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    arrow: <path d="M4 12h15m-5-5 5 5-5 5" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    account: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 21v-1a7.5 7.5 0 0 1 15 0v1" /></>,
    bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2.3" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h11" /></>,
    spark: <path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z" />,
    gift: <><path d="M4 10h16v10H4zM3 7h18v4H3zM12 7v13" /><path d="M12 7H8a2.5 2.5 0 1 1 2.5-2.5L12 7Zm0 0h4a2.5 2.5 0 1 0-2.5-2.5L12 7Z" /></>,
    stack: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></>,
    locate: <><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    refund: <><path d="M4 9a8 8 0 1 1-1 8M3 4v6h6" /><path d="M14.5 8H10v4h3a2 2 0 0 1 0 4h-3M12 6v2m0 8v2" /></>,
    handshake: <><path d="m3 8 4-3 5 2 5-2 4 3-2 8-5 4-9-5-2-7Z" /><path d="m12 7-4 4 3 2 3-3 5 6M6 16l3-3m0 6 3-3" /></>,
    logout: <><path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4" /></>,
    loader: <><circle cx="12" cy="12" r="9" opacity=".18" /><path d="M12 3a9 9 0 0 1 9 9" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={`hh-icon ${name === "loader" ? "hh-spin" : ""} ${className}`} aria-hidden="true" focusable="false">{paths[name] || paths.gift}</svg>;
};

// V104: One common HAMPORIUM header for all routes, including /hamper-one.
export default Header;

const HEADER_CSS = `
/* V146: HAMPORIUM official 5-tone palette. */

/* HAMPORIUM / Pearl Navigation. All styles are scoped to this component. */
.hh-header,.hh-overlay { --hh-paper:#fffcf7; --hh-soft:#f5efe5; --hh-line:#e6ddcf; --hh-ink:#252119; --hh-muted:#71695d; --hh-gold:#957020; --hh-orange:#B79B6A; --hh-ease:cubic-bezier(.22,1,.36,1); --hh-height:84px; font-family:'Manrope',Arial,sans-serif; font-size:14px; line-height:1.5; -webkit-font-smoothing:antialiased; }
.hh-header *,.hh-overlay * { box-sizing:border-box; }
.hh-header a,.hh-overlay a { text-decoration:none; color:inherit; }
.hh-header button,.hh-overlay button,.hh-overlay input { font:inherit; }
.hh-header button,.hh-overlay button { cursor:pointer; }
.hh-header button,.hh-overlay button { -webkit-tap-highlight-color:transparent; }
.hh-header button:disabled,.hh-overlay button:disabled { cursor:not-allowed; opacity:.5; }
.hh-header :where(button,a,input):focus-visible,.hh-overlay :where(button,a,input):focus-visible { outline:2px solid #b37928; outline-offset:4px; }
.hh-overlay :where(h2,h3,p) { margin:0; }
.hh-header .hh-icon,.hh-overlay .hh-icon { width:21px; height:21px; display:block; flex:0 0 auto; transition:transform .35s var(--hh-ease); }
.hh-sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
/* V122: same as V121, but ribbon and matching wavy border are 20% thinner.
   V121: luxury espresso surface with the V120 full-width wavy satin border.
   V120: truly edge-to-edge satin ribbon forms the HEADER'S WAVY BOTTOM.
   No straight border, no gradient fade, no transparent holes in the dips.
   The solid body joins a precisely curved fixed SVG backing edge. */
.hh-header {
  --hh-v113-logo-height:141.96px;
  --hh-v113-logo-half-height:70.98px;
  --hh-v113-top-pad:1.5px;
  --hh-v113-ribbon-tuck:73.7px;
  --hh-v127-ribbon-height:24.8832px;
  --hh-v127-bow-offset:14px;
  --hh-connected-surface:#161715;
  position:fixed; inset:0 0 auto; width:100%; z-index:100;
  overflow:visible; background:#161715; border:0; box-shadow:none;
  transition:transform .48s var(--hh-ease),background-color .35s ease,box-shadow .35s ease;
}
.hh-header::after { display:none !important; content:none !important; }
/* V121: warm espresso base, champagne typography, burnished brass details.
   The same surface feeds the wavy SVG and backing -- no white/light seam. */
.hh-light,.hh-hero {
  --hh-connected-surface:#161715;
  --hh-ink:#f5e9d7;
  color:#f5e9d7;
  background:#161715;
  box-shadow:none;
}
.hh-header .hh-private-link { border-left-color:rgba(230,190,112,.32); }
.hh-header .hh-private-link > span,
.hh-header .hh-private-link.is-current > span { color:#f6e7d0; }
.hh-header .hh-private-link em,
.hh-header .hh-private-link > .hh-icon { color:#e6ba69; }
.hh-header .hh-private-link small { color:#cbb69b; }
.hh-header .hh-search-morph-icon { color:#e8c18a; }
.hh-header .hh-search-morph-word { color:#f2e2cc; }
.hh-header .hh-search-morph-caret { background:#efbe70; }
.hh-header .hh-action:hover,.hh-header .hh-action.is-open { color:#f2cc88; background:rgba(235,192,121,.12); }
.hh-header .hh-nav-link { color:#f5e9d7; }
.hh-header .hh-gift-trigger:focus-visible { outline-color:#e3b86c; }
.hh-header .hh-account-label { color:#f5e9d7; }
.hh-header .hh-search-trigger { color:#f5e9d7; }
.hh-header .hh-count { background:#c87438; }
/* V135: ribbon, bow and curved backing completely removed.
   A single solid espresso surface is the header's clean edge. */
.hh-bar::before { content:none !important; display:none !important; }
.hh-hidden { /* Hide the badge overhanging BELOW the standard height, too. */
  transform:translateY(calc(-110% - 125px)); pointer-events:none;
}
.hh-bar { position:relative; width:100%; height:var(--hh-height); display:flex; align-items:center; justify-content:space-between; gap:18px; padding-inline:clamp(22px,3vw,60px); }

/* V138: anchor the visible orange shield close to the TOP of the header.
   V137 reduced the badge artwork by 20% but retained the former, taller
   logo's center coordinates; this accidentally pushed the visible shield
   underneath the header's dark bottom edge. Keep the logo's dimensions,
   header height, horizontal centering and shield-only spin unchanged.
   The responsive optical lift compensates for the image's transparent top
   padding and is scaled with the badge at each breakpoint. */
.hh-brand { position:absolute; z-index:6; left:50%;
  --hh-logo-optical-lift:20px;
  top:calc(var(--hh-v113-top-pad) + var(--hh-v113-logo-half-height) + env(safe-area-inset-top, 0px) - 10px - var(--hh-logo-optical-lift));
  transform:translate(-50%,-50%); display:flex; align-items:center;
  justify-content:center; flex:0 0 auto; isolation:isolate;
}
/* No artificial hanging strip above the logo. The ribbon disappears behind its LOWER EDGE. */
.hh-brand::before,.hh-brand::after { content:none !important; display:none !important; }
.hh-brand-mark { display:flex; position:relative; z-index:5; width:83.824px; height:109.568px; align-items:center; justify-content:center; overflow:visible; isolation:isolate; background:none; filter:drop-shadow(0 3px 4px #0a07081a); }
/* V136: correctly shaped shield alone turns. Horse and lettering remain FIXED.
   Logo dimensions and header placement remain unchanged. */
.hh-logo-sequence,.hh-logo-shield,.hh-logo-fixed-art,.hh-logo-full,.hh-logo-split {
  position:absolute; inset:0; display:block;
}
.hh-logo-sequence { position:relative; width:100%; height:100%; opacity:1; visibility:visible; perspective:850px; }
.hh-logo-sequence img { display:block; width:100%; height:100%; object-fit:contain; }
.hh-logo-split { isolation:isolate; }
.hh-logo-shield { z-index:1; transform-origin:50% 50%; backface-visibility:visible; transform-style:preserve-3d; }
.hh-logo-fixed-art { z-index:2; pointer-events:none; }
.hh-logo-full { z-index:1; }
.hh-header.hh-intro-running .hh-logo-shield {
  animation:hh-v135-shield-spin 1.5s cubic-bezier(.3,.15,.2,1) .12s 1 both;
}
.hh-header.hh-intro-done .hh-logo-shield { transform:rotateY(360deg); }
@keyframes hh-v135-shield-spin {
  0% { transform:rotateY(0deg); }
  100% { transform:rotateY(360deg); }
}

/* V128: real untie choreography -- knot loosens first, loops unfurl
   into slim bands and release sideways, tails follow, then ribbon halves
   draw out from the centre. Nothing pops/disappears at the first frame. */
.hh-ceremony-bow {
  position:absolute; z-index:5; left:50%;
  top:calc(var(--hh-v113-top-pad) + var(--hh-v113-logo-height) - var(--hh-v113-ribbon-tuck) + env(safe-area-inset-top, 0px) + var(--hh-v127-bow-offset));
  width:clamp(102px,9.5vw,142px); height:auto; aspect-ratio:176/112;
  transform:translate(-50%,-50%); pointer-events:none;
  filter:drop-shadow(0 4px 5px rgba(40,19,4,.3));
}
.hh-ceremony-bow-art { display:block; width:100%; height:100%; overflow:visible; }
.hh-ceremony-bow-wing-left,.hh-ceremony-bow-wing-right,
.hh-ceremony-bow-tail-left,.hh-ceremony-bow-tail-right,
.hh-ceremony-bow-knot { transform-box:fill-box; }
.hh-ceremony-bow-wing-left { transform-origin:right 58%; }
.hh-ceremony-bow-wing-right { transform-origin:left 58%; }
.hh-ceremony-bow-tail-left { transform-origin:right 2%; }
.hh-ceremony-bow-tail-right { transform-origin:left 2%; }
.hh-ceremony-bow-knot { transform-origin:center; }
.hh-header.hh-intro-running .hh-ceremony-bow-wing-left {
  animation:hh-v128-bow-loop-left 1.30s cubic-bezier(.3,.65,.27,1) .79s both;
}
.hh-header.hh-intro-running .hh-ceremony-bow-wing-right {
  animation:hh-v128-bow-loop-right 1.30s cubic-bezier(.3,.65,.27,1) .79s both;
}
.hh-header.hh-intro-running .hh-ceremony-bow-tail-left {
  animation:hh-v128-bow-tail-left 1.27s cubic-bezier(.26,.72,.28,1) .84s both;
}
.hh-header.hh-intro-running .hh-ceremony-bow-tail-right {
  animation:hh-v128-bow-tail-right 1.27s cubic-bezier(.26,.72,.28,1) .84s both;
}
.hh-header.hh-intro-running .hh-ceremony-bow-knot {
  animation:hh-v128-bow-knot 1.17s cubic-bezier(.2,.72,.25,1) .72s both;
}
.hh-header.hh-intro-done .hh-ceremony-bow { display:none; }
@keyframes hh-v128-bow-loop-left {
  0%,20% { transform:translate(0,0) rotate(0deg) scale(1); opacity:1; }
  35% { transform:translate(-3px,-1px) rotate(-9deg) scale(1.08,.95); opacity:1; }
  62% { transform:translate(-18px,-2px) rotate(-14deg) scale(1.28,.53); opacity:1; }
  82% { transform:translate(-40px,-1px) rotate(-6deg) scale(1.40,.22); opacity:.85; }
  100% { transform:translate(-61px,0) rotate(0deg) scale(1.50,.12); opacity:0; }
}
@keyframes hh-v128-bow-loop-right {
  0%,20% { transform:translate(0,0) rotate(0deg) scale(1); opacity:1; }
  35% { transform:translate(3px,-1px) rotate(9deg) scale(1.08,.95); opacity:1; }
  62% { transform:translate(18px,-2px) rotate(14deg) scale(1.28,.53); opacity:1; }
  82% { transform:translate(40px,-1px) rotate(6deg) scale(1.40,.22); opacity:.85; }
  100% { transform:translate(61px,0) rotate(0deg) scale(1.50,.12); opacity:0; }
}
@keyframes hh-v128-bow-tail-left {
  0%,22% { transform:rotate(0deg) translate(0,0); opacity:1; }
  48% { transform:rotate(13deg) translate(-2px,0); opacity:1; }
  78% { transform:rotate(48deg) translate(-12px,8px) scaleY(.77); opacity:.75; }
  100% { transform:rotate(67deg) translate(-28px,15px) scaleY(.45); opacity:0; }
}
@keyframes hh-v128-bow-tail-right {
  0%,22% { transform:rotate(0deg) translate(0,0); opacity:1; }
  48% { transform:rotate(-13deg) translate(2px,0); opacity:1; }
  78% { transform:rotate(-48deg) translate(12px,8px) scaleY(.77); opacity:.75; }
  100% { transform:rotate(-67deg) translate(28px,15px) scaleY(.45); opacity:0; }
}
@keyframes hh-v128-bow-knot {
  0%,25% { opacity:1; transform:scale(1) rotate(0deg); }
  48% { opacity:1; transform:scale(1.10,.84) rotate(-9deg); }
  72% { opacity:1; transform:translateY(4px) scale(.77,.58) rotate(-17deg); }
  100% { opacity:0; transform:translateY(14px) scale(.38,.34) rotate(-22deg); }
}

.hh-nav { display:flex; align-self:stretch; align-items:center; gap:clamp(15px,2vw,29px); flex:0 1 auto; margin-left:0; position:relative; z-index:1; }
.hh-nav-link { position:relative; display:inline-flex; height:100%; align-items:center; gap:8px; padding:0 2px; border:0; color:inherit; background:transparent; font-weight:650!important; font-size:14px!important; white-space:nowrap; }
.hh-nav-link::after { content:''; position:absolute; bottom:17px; left:0; right:0; height:1px; transform:scaleX(0); transform-origin:left; background:var(--hh-orange); transition:transform .42s var(--hh-ease); }
.hh-nav-link.is-current::after,.hh-nav-link:hover::after { transform:scaleX(1); }
.hh-nav-link .hh-icon { width:14px; height:14px; }
.hh-icon.hh-turn { transform:rotate(180deg); }
/* V137: hamburger-line gift box with luxe tied bow; click-pinned dropdown. */
.hh-header .hh-gift-trigger { display:flex; align-items:center; justify-content:center; width:72px; min-width:72px; height:72px; padding:0; position:relative; margin-inline:-7px 0; border:0; background:transparent; outline-offset:2px; }
.hh-gift-art { display:block; width:64px; height:60px; overflow:visible; filter:drop-shadow(0 2px 2px #3d26151c); transition:transform .5s var(--hh-ease); }
.hh-gift-trigger:hover .hh-gift-art,.hh-gift-trigger:focus-visible .hh-gift-art,.hh-gift-trigger.is-open .hh-gift-art { transform:translateY(-3px) scale(1.045); }
.hh-gift-lid { transform-origin:40px 25px; transition:transform .42s var(--hh-ease); }
.hh-gift-trigger:hover .hh-gift-lid,.hh-gift-trigger:focus-visible .hh-gift-lid,.hh-gift-trigger.is-open .hh-gift-lid { transform:translateY(-2.5px); }
.hh-gift-hamburger-bars { transform-origin:40px 47px; transition:transform .42s var(--hh-ease); }
.hh-gift-trigger:hover .hh-gift-hamburger-bars,.hh-gift-trigger.is-open .hh-gift-hamburger-bars { transform:scaleX(1.07); }
.hh-header .hh-gift-trigger::after { content:''; position:absolute; width:7px; height:7px; bottom:7px; border-radius:50%; background:#C39A52; box-shadow:0 0 0 4px #D2B37525; opacity:0; transform:scale(.4); transition:opacity .3s,transform .3s; }
.hh-header .hh-gift-trigger.is-open::after { opacity:1; transform:scale(1); }
.hh-header .hh-gift-trigger:hover::after,.hh-header .hh-gift-trigger.is-current::after { transform:scaleX(1); }
.hh-mobile-menu-trigger .hh-gift-art { width:40px; height:40px; }

.hh-private-link { display:flex; align-items:center; gap:9px; position:relative; padding-left:22px; border-left:1px solid #a8894f40; white-space:nowrap; }
.hh-private-link>.hh-icon { width:17px; height:17px; color:#9b7422; }
.hh-private-link>span { font-size:12px; font-weight:650; letter-spacing:.06em; line-height:1.2; }
.hh-private-link em { color:#916b1b; font-family:Georgia,serif; font-size:15px; font-weight:400; }
.hh-private-link small { display:block; margin-top:5px; color:var(--hh-muted); font-size:12px; font-weight:500; letter-spacing:.025em; }
.hh-private-link.is-current>span { color:#977023; }
.hh-hero .hh-private-link em,.hh-hero .hh-private-link>.hh-icon { color:#e0c173; }
.hh-hero .hh-private-link small { color:#e9e1cfbf; }
.hh-header .hh-private-link { min-height:72px; padding-left:18px; }
.hh-hamperone-image { display:block; width:clamp(118px,11vw,158px); height:65px; max-width:100%; object-fit:contain; object-position:center; border-radius:0; background:transparent; mix-blend-mode:normal; }
.hh-header .hh-private-link:hover .hh-hamperone-image { filter:brightness(1.08); }
.hh-mobile-private .hh-hamperone-mobile-image { width:min(210px,70%); height:85px; object-position:left center; }
.hh-mobile-private { justify-content:space-between; }
.hh-tools { min-width:0; display:flex; align-items:center; gap:8px; margin-left:auto; position:relative; z-index:1; }
/* One compact, clickable, morphing search symbol: never a pill, input or search bar. */
.hh-search-trigger { display:flex; align-items:center; justify-content:center; flex:0 0 76px; width:76px; height:44px; padding:0; border:0!important; border-radius:0!important; color:inherit; background:transparent!important; box-shadow:none!important; outline-offset:4px; transition:color .3s var(--hh-ease); }
.hh-search-morph { display:flex; align-items:center; justify-content:center; width:100%; height:44px; white-space:nowrap; }
.hh-search-morph-icon { display:flex; align-items:center; justify-content:center; color:#a57a31; animation:hh-morph-appear .3s var(--hh-ease) both; }
.hh-search-morph-icon>.hh-icon { width:22px; height:22px; }
.hh-search-morph-word { display:inline-flex; align-items:center; justify-content:center; min-width:0; color:inherit; font-size:14px; line-height:1; font-weight:700; letter-spacing:.01em; animation:hh-morph-appear .26s var(--hh-ease) both; }
.hh-search-morph-caret { display:inline-block; flex:0 0 2px; height:16px; width:2px; margin-left:2px; background:#b68033; animation:hh-morph-blink .75s steps(1,end) infinite; }
.hh-search-trigger:hover,.hh-search-trigger.is-open { color:#a36b28; }
.hh-search-trigger:hover .hh-search-morph-icon,.hh-search-trigger.is-open .hh-search-morph-icon { color:#c18a3c; }
.hh-hero .hh-search-morph-icon { color:#edd092; }
.hh-hero .hh-search-morph-caret { background:#f4d48b; }
.hh-hero .hh-search-trigger:hover,.hh-hero .hh-search-trigger.is-open { color:#f4d48b; }
@keyframes hh-morph-appear { from { opacity:.25; transform:translateY(3px); } to { opacity:1; transform:translateY(0); } }
@keyframes hh-morph-blink { 0%,49% { opacity:1; } 50%,100% { opacity:0; } }
.hh-action { position:relative; display:flex; align-items:center; justify-content:center; width:42px; height:44px; flex:0 0 auto; border:0; border-radius:50%; color:inherit; background:transparent; transition:background .3s,color .3s,transform .4s var(--hh-ease); }
.hh-action:hover,.hh-action.is-open { color:#9a6328; background:#f1e5d1; }
.hh-hero .hh-action:hover { color:#f3cf7c; background:#ffffff10; }
.hh-account-trigger { width:auto; gap:7px; padding:0 10px; border-radius:99px; }
.hh-account-label { font-size:13px; font-weight:650; white-space:nowrap; }
.hh-count { position:absolute; top:0; right:-2px; display:grid; place-items:center; min-width:18px; height:18px; padding-inline:4px; border-radius:50px; background:#B79B6A; color:white; font-size:11px; font-weight:700; line-height:1; animation:hh-count-in .35s var(--hh-ease); }
.hh-notifications { display:flex; align-items:center; flex:0 0 auto; color:inherit; }
.hh-notifications>button,.hh-notifications>div>button { min-width:40px; min-height:44px; }
.hh-mobile-menu-trigger { display:none; }

/* Shared panel positioning lives outside the transformed header. */
.hh-overlay { position:fixed; inset:0; z-index:101; pointer-events:none; color:var(--hh-ink); }
.hh-backdrop { position:absolute; inset:var(--hh-height) 0 0; pointer-events:auto; background:#1c180f26; animation:hh-fade-in .25s ease both; }
.hh-panel { position:absolute; top:calc(var(--hh-height) + 12px); left:24px; right:24px; margin-inline:auto; display:flex; flex-direction:column; pointer-events:auto; width:calc(100% - 48px); max-width:1180px; max-height:calc(100dvh - var(--hh-height) - 32px); border:1px solid #c6aa793d; border-radius:18px; background:var(--hh-paper); box-shadow:0 24px 70px #27201526,0 3px 12px #2720150a; outline:none; overflow:hidden; animation:hh-panel-in .44s var(--hh-ease) both; }
.hh-panel::before { content:''; position:absolute; left:0; right:0; top:0; height:2px; background:linear-gradient(90deg,#B79B6A,#d5b775 48%,#f4782220); z-index:1; }
.hh-panel-top { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; flex:0 0 auto; padding:25px 30px 21px; border-bottom:1px solid var(--hh-line); }
.hh-eyebrow { color:#947024; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.11em; line-height:1.45; }
.hh-panel-top h2 { margin-top:7px; color:var(--hh-ink); font-family:'Cormorant Garamond',Georgia,serif; font-size:33px; font-weight:500; letter-spacing:-.025em; line-height:1.13; }
.hh-close { display:grid; place-items:center; width:38px; height:38px; padding:0; flex:0 0 auto; border:1px solid #e0d6c7; border-radius:50%; background:transparent; color:#736650; transition:background .3s,color .3s,transform .35s var(--hh-ease); }
.hh-close:hover { background:#eee4d5; color:#252119; transform:rotate(90deg); }
.hh-close .hh-icon { width:17px; height:17px; }
.hh-panel-body { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:#cbbb9d transparent; }
.hh-panel-search { max-width:920px; }
.hh-panel-account { width:360px; left:auto; right:clamp(24px,4vw,90px); margin:0; }
.hh-panel-account .hh-panel-top h2 { font-size:27px; }
.hh-panel-location .hh-panel-top h2 { font-size:32px; }
.hh-overlay.is-leaving .hh-panel { animation:hh-panel-out .22s ease both; pointer-events:none; }
.hh-overlay.is-leaving .hh-backdrop { animation:hh-fade-out .22s ease both; pointer-events:none; }

/* The Hampers disclosure: editorial columns, not a wall of cards. */
.hh-mega-grid { display:grid; grid-template-columns:.93fr 1.07fr 1fr; gap:0; }
.hh-shop-feature { position:relative; padding:4px 28px 24px; overflow:hidden; background:linear-gradient(150deg,#f7f1e7,#ede1cb80); }
.hh-shop-feature h3 { margin-top:8px; font-family:'Cormorant Garamond',Georgia,serif; font-size:30px; font-weight:500; line-height:1.06; letter-spacing:-.025em; }
.hh-shop-feature h3 em { color:#9c7730; }
.hh-text-link { display:inline-flex; align-items:center; gap:12px; min-height:44px; margin-top:11px; border:0; padding:0; background:transparent; color:var(--hh-ink); font-size:13px; font-weight:600; }
.hh-text-link .hh-icon { width:17px; }
.hh-shop-feature:hover .hh-text-link .hh-icon { transform:translateX(5px); }
.hh-mega-create,.hh-mega-collections { padding:27px 28px; border-left:1px solid var(--hh-line); }
.hh-mega-create h3 { margin:8px 0 9px; font-family:'Cormorant Garamond',Georgia,serif; font-size:26px; font-weight:500; line-height:1.15; letter-spacing:-.015em; }
.hh-muted { color:var(--hh-muted); font-size:13px; line-height:1.7; }
.hh-choice-row { display:flex; align-items:center; gap:13px; padding:16px 0; border-top:1px solid var(--hh-line); margin-top:18px; transition:color .3s; }
.hh-choice-row+.hh-choice-row { margin-top:0; }
.hh-choice-icon { color:#b6863f; }
.hh-choice-row>span:nth-child(2) { flex:1; }
.hh-choice-row strong { display:block; font-size:14px; font-weight:600; }
.hh-choice-row small { display:block; margin-top:4px; color:var(--hh-muted); font-size:13px; }
.hh-choice-row>.hh-icon { width:17px; color:#ae8b45; }
.hh-choice-row:hover,.hh-collection-links a:hover { color:#ba641e; }
.hh-choice-row:hover>.hh-icon { transform:translateX(4px); }
.hh-collection-links { margin-top:15px; }
.hh-collection-links a { display:flex; align-items:center; gap:12px; min-height:49px; border-bottom:1px solid var(--hh-line); font-weight:500; transition:color .3s; }
.hh-collection-links a:last-child { border-bottom:0; }
.hh-index { color:#a3844d; font-size:12px; letter-spacing:.05em; flex:0 0 auto; }
.hh-collection-links a>span:nth-child(2) { flex:1; }
.hh-collection-links .hh-icon { width:15px; color:#ae8b45; }
.hh-collection-links a:hover .hh-icon { transform:translateX(3px); }

/* Small gift-box accent, built in CSS rather than another download. */
.hh-parcel-scene { height:137px; position:relative; width:196px; margin-inline:auto; pointer-events:none; }
.hh-parcel-shadow { position:absolute; bottom:13px; left:38px; width:146px; height:16px; border-radius:50%; background:#67502d30; filter:blur(8px); }
.hh-parcel-back { position:absolute; width:108px; height:74px; left:25px; top:33px; transform:rotate(-10deg); border:1px solid #d8c6a5; border-radius:3px; background:linear-gradient(135deg,#e7d8bb,#c7b28b); }
.hh-parcel { position:absolute; width:122px; height:88px; left:59px; top:30px; transform:rotate(7deg); border:1px solid #b18c54; border-radius:4px; background:linear-gradient(135deg,#ead9b3,#d6be8f); box-shadow:8px 8px 14px #73572518,inset -5px 0 0 #b5976b30; transition:transform .7s var(--hh-ease); }
.hh-shop-feature:hover .hh-parcel { transform:translateY(-4px) rotate(3deg); }
.hh-parcel-lid { position:absolute; inset:-4px -4px auto; height:14px; background:linear-gradient(180deg,#f2e7cb,#dcc79e); border:1px solid #b8945e; border-radius:3px; box-shadow:0 3px 4px #7b603515; }
.hh-ribbon-v { position:absolute; top:-5px; bottom:-1px; left:46px; width:13px; background:linear-gradient(90deg,#895624,#b88142 40%,#dfb674 60%,#8d592b); }
.hh-ribbon-h { position:absolute; top:29px; left:-1px; right:-1px; height:11px; background:linear-gradient(180deg,#8e5b2a,#d2a364 60%,#8b5426); }
.hh-bow-left,.hh-bow-right { position:absolute; top:18px; width:28px; height:17px; border:1px solid #a27742; background:linear-gradient(145deg,#edd4a0,#b18750); border-radius:80% 40% 65% 40%; box-shadow:0 2px 2px #73532b30; }
.hh-bow-left { left:26px; transform:rotate(20deg); }.hh-bow-right { left:52px; transform:rotate(-30deg) scaleX(-1); }
.hh-bow-knot { position:absolute; width:13px; height:12px; border-radius:4px; left:46px; top:27px; background:linear-gradient(110deg,#c89b5d,#f0dbaa,#bc894a); }
.hh-parcel-seal { position:absolute; bottom:12px; right:14px; display:grid; place-items:center; width:20px; height:20px; border:1px solid #9b7641; border-radius:50%; color:#886230; font:italic 13px Georgia,serif; }

/* Search */
.hh-search-panel-content { padding:24px 30px 0; }
.hh-search-form { display:flex; align-items:center; gap:13px; min-height:58px; border:1px solid #d6c3a1; border-radius:10px; background:#fff; padding:6px 8px 6px 17px; box-shadow:0 4px 14px #9f784908; }
.hh-search-form:focus-within { border-color:#b58a43; box-shadow:0 0 0 3px #b9914b0c; }
.hh-search-form>.hh-icon { color:#ab8143; }
.hh-search-form input { width:100%; min-width:0; flex:1; border:0; outline:none; padding:8px 0; background:transparent; color:var(--hh-ink); font-size:16px; }
.hh-search-form input:focus-visible { outline:none; }
.hh-search-form input::-webkit-search-cancel-button { display:none; }
.hh-search-form input::placeholder { color:#8a8073; }
.hh-search-submit,.hh-clear-search { display:grid; place-items:center; width:42px; height:42px; flex-shrink:0; border:0; border-radius:6px; background:#f0e5d2; color:#81571f; }
.hh-clear-search { background:transparent; color:#796e5b; width:30px; }.hh-clear-search .hh-icon { width:16px; }
.hh-search-submit:hover { background:#e2cda6; }
.hh-search-discover { display:grid; grid-template-columns:1.5fr .85fr; gap:26px; padding-block:27px; }
.hh-popular { display:flex; flex-wrap:wrap; gap:9px; margin-top:16px; }
.hh-popular button { display:inline-flex; align-items:center; gap:13px; min-height:40px; border:1px solid #e5dccc; background:transparent; color:#4b4234; border-radius:5px; padding:9px 12px; font-size:13px; transition:background .3s,border-color .3s; }
.hh-popular button:hover { background:#f5ead8; border-color:#c1a26c; }
.hh-popular .hh-icon { width:13px; height:13px; color:#ae8b45; }
.hh-search-bespoke { border-left:1px solid var(--hh-line); display:flex; flex-direction:column; justify-content:center; padding-left:25px; }
.hh-search-bespoke>.hh-icon { color:#a78644; margin-bottom:12px; width:25px; height:25px; }
.hh-search-bespoke strong { font:400 25px/1.2 'Cormorant Garamond',Georgia,serif; }
.hh-search-bespoke>span { display:flex; align-items:center; gap:13px; margin-top:12px; font-size:13px; color:#806435; }
.hh-search-bespoke>span>.hh-icon { width:16px; }
.hh-search-meta { display:flex; align-items:center; justify-content:space-between; gap:16px; margin:23px 0 12px; }
.hh-search-meta>span:last-child { color:var(--hh-muted); font-size:13px; }
.hh-result-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
.hh-result { display:flex; width:100%; align-items:center; min-width:0; gap:13px; border:0; background:transparent; color:var(--hh-ink); padding:12px 8px; text-align:left; border-radius:7px; transition:background .3s; }
.hh-result:hover { background:#f5ecdd; }.hh-result>.hh-icon { color:#a4864f; width:16px; }
.hh-result-image { display:block; width:65px; height:70px; flex-shrink:0; background:#efe6d9; border-radius:5px; overflow:hidden; }
.hh-result-image img { width:100%; height:100%; display:block; object-fit:cover; transition:transform .6s var(--hh-ease); }.hh-result:hover img { transform:scale(1.05); }
.hh-image-placeholder { display:grid; place-items:center; width:100%; height:100%; color:#aa8a4c; }
.hh-result-copy { display:flex; flex:1; min-width:0; flex-direction:column; gap:3px; }.hh-result-copy small { color:#867b68; font-size:12px; }.hh-result-copy strong { font-size:14px; font-weight:600; line-height:1.5; overflow-wrap:anywhere; }.hh-result-price { color:#9a692f; font-size:13px; font-weight:600; margin-top:3px; }
.hh-view-results { display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:6px; width:calc(100% + 60px); margin:20px -30px 0; padding:16px 24px; border:0; border-top:1px solid var(--hh-line); background:#f6f0e5; color:#5b503c; font-size:13px; }.hh-view-results strong { max-width:50%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.hh-view-results>.hh-icon { width:17px; margin-left:8px; }
.hh-search-empty { padding:28px 12px; display:flex; flex-direction:column; align-items:center; gap:9px; text-align:center; color:#645a49; }.hh-search-empty>.hh-icon { color:#b29a6b; margin-bottom:7px; }.hh-search-empty span { font-size:13px; }
.hh-search-hint { margin-top:13px!important; }
.hh-search-skeleton { display:flex; align-items:center; gap:13px; padding:12px 8px; }.hh-search-skeleton>span { width:65px; height:70px; border-radius:5px; background:#ede3d3; }.hh-search-skeleton>div { flex:1; }.hh-search-skeleton i { display:block; height:9px; width:80%; border-radius:3px; background:#e7dccb; margin-bottom:10px; }.hh-search-skeleton i+i { width:48%; }.hh-search-skeleton { animation:hh-breathe 1.5s ease-in-out infinite alternate; }

/* Location and account. */
.hh-primary,.hh-secondary { display:inline-flex; min-height:45px; align-items:center; justify-content:center; gap:12px; padding:11px 18px; border:1px solid #B79B6A; border-radius:6px; font-size:13px; font-weight:600; color:#fff!important; background:#B79B6A; transition:background .3s,transform .35s var(--hh-ease); }
.hh-primary:hover { background:#895a24; }.hh-primary>.hh-icon { width:15px; height:15px; }
.hh-secondary { color:#554a39!important; background:transparent; border-color:#ddd1bd; }.hh-secondary:hover { background:#f0e4d0; }
.hh-error { margin-top:12px!important; color:#a02b24; font-size:13px; line-height:1.65; }
.hh-account-content { padding:22px 25px; }.hh-account-profile { display:flex; align-items:center; gap:13px; padding-bottom:18px; border-bottom:1px solid var(--hh-line); }.hh-account-profile>span { display:grid; place-items:center; width:46px; height:46px; border-radius:50%; background:#eee1c9; color:#8f682d; font:400 26px Georgia,serif; flex-shrink:0; }.hh-account-profile>div { min-width:0; }.hh-account-profile strong { display:block; overflow-wrap:anywhere; font-weight:600; font-size:15px; }.hh-account-profile small { display:block; overflow-wrap:anywhere; color:#857663; font-size:12px; margin-top:3px; }
.hh-account-links { padding-block:8px 12px; }.hh-account-links a { display:flex; align-items:center; gap:12px; min-height:47px; font-size:13px; border-radius:5px; padding:8px 2px; transition:background .3s; }.hh-account-links a:hover { background:#f5ecdd; }.hh-account-links a>span { flex:1; }.hh-account-links .hh-icon { width:17px; height:17px; color:#937b51; }.hh-account-links a>.hh-icon:last-child { width:14px; }
.hh-auth-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:19px 0 22px; }
.hh-partner-link { display:flex; align-items:center; gap:12px; border:1px solid #e3d3b6; border-radius:7px; padding:13px 12px; background:#f6efdf; }.hh-partner-link>.hh-icon { color:#9c793c; width:19px; height:19px; }.hh-partner-link>.hh-icon:last-child { width:14px; }.hh-partner-link>span { flex:1; }.hh-partner-link strong { display:block; font-size:13px; font-weight:600; }.hh-partner-link small { display:block; color:#837156; font-size:12px; line-height:1.5; margin-top:3px; }.hh-partner-link:hover { background:#efe2c9; }
.hh-admin-link,.hh-logout { display:flex; justify-content:space-between; align-items:center; width:100%; border:0; border-top:1px solid var(--hh-line); padding:14px 3px 0; background:transparent; margin-top:15px; font-size:13px; }.hh-logout { color:#a05e32; }.hh-admin-link>.hh-icon,.hh-logout>.hh-icon { width:16px; height:16px; }

/* V32 - Compact logged-in account: only two prominent actions. */
.hh-account-compact { padding:18px 20px 12px; }
.hh-account-quick-links { display:grid; gap:10px; }
.hh-account-quick-link { display:flex; align-items:center; min-width:0; gap:13px; min-height:62px; padding:13px 14px; border:1px solid #e7ddca; border-radius:12px; background:#fffdf8; color:var(--hh-ink); transition:background .25s ease,border-color .25s ease,transform .25s var(--hh-ease); }
.hh-account-quick-link:hover { transform:translateY(-2px); border-color:#caac75; background:#FAF8F4; }
.hh-account-quick-link strong { flex:1; min-width:0; font-size:14px; font-weight:700; line-height:1.3; }
.hh-account-quick-icon { display:grid; place-items:center; width:37px; height:37px; flex:0 0 37px; border-radius:11px; background:#f4e9d6; color:#97702e; }
.hh-account-quick-link>.hh-icon { width:17px; height:17px; color:#a48451; }
.hh-account-quick-partner { background:#f5ecdc; border-color:#e3d2b2; }
.hh-account-quick-partner .hh-account-quick-icon { background:#ead6b3; }
.hh-account-signout-wrap { display:flex; justify-content:flex-end; padding-top:7px; }
.hh-account-signout { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:36px; border:0; border-radius:7px; padding:6px 9px; background:transparent; color:#8e8170; font-size:11px; font-weight:600; transition:color .2s ease,background .2s ease; }
.hh-account-signout:hover { color:#9a6328; background:#f5ecdf; }
.hh-account-signout .hh-icon { width:14px; height:14px; }
.hh-menu-content>.hh-account-content.hh-account-compact { padding:14px 0 0; }

/* Mobile navigation is a scrollable dialog, with all desktop routes retained. */
.hh-menu-content { padding:0 22px 24px; }
.hh-menu-search { display:flex; align-items:center; width:100%; gap:12px; min-height:48px; border:1px solid #e4d7c2; background:#f4ecdf; border-radius:8px; color:#76684f; padding:10px 12px; font-size:13px; margin:20px 0 9px; }.hh-menu-search>span { flex:1; text-align:left; }.hh-menu-search>.hh-icon:last-child { width:16px; }
.hh-mobile-major,.hh-mobile-build>div:first-child { display:flex; align-items:center; gap:15px; min-height:88px; border-bottom:1px solid var(--hh-line); }.hh-mobile-major>span:nth-child(2),.hh-mobile-build>div:first-child>span:nth-child(2) { flex:1; font:400 29px/1.05 'Cormorant Garamond',Georgia,serif; }.hh-mobile-major small,.hh-mobile-build small { display:block; font:400 12px/1.4 'Manrope',Arial,sans-serif; color:var(--hh-muted); margin-top:7px; }.hh-mobile-major .hh-icon,.hh-mobile-build>div:first-child>.hh-icon { color:#ae8b45; width:18px; height:18px; }
.hh-mobile-build>div:first-child { border-bottom:0; }.hh-mobile-order-links { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:0 0 20px 27px; }.hh-mobile-order-links a { display:flex; align-items:center; justify-content:space-between; gap:7px; min-height:42px; padding:8px 0; color:#7b5e32; font-size:13px; border-top:1px solid var(--hh-line); }.hh-mobile-order-links a>.hh-icon { width:14px; height:14px; }
.hh-mobile-private { display:flex; align-items:center; gap:14px; padding:18px; border:1px solid #d8c19a; border-radius:7px; background:linear-gradient(110deg,#f2e7d2,#fbf5e9); margin:0 0 25px; }.hh-mobile-private>span { flex:1; font-family:Georgia,serif; font-size:22px; letter-spacing:.03em; }.hh-mobile-private small { display:block; font-family:'Manrope',Arial,sans-serif; text-transform:uppercase; color:#8c703e; font-size:12px; letter-spacing:.10em; margin-bottom:4px; }.hh-mobile-private em { color:#997127; }.hh-mobile-private>.hh-icon { color:#ad8441; width:19px; height:19px; }.hh-mobile-private>.hh-icon:last-child { width:17px; }
.hh-mobile-collections>div { display:grid; grid-template-columns:1fr 1fr; gap:0 22px; margin-top:10px; }.hh-mobile-collections a { display:flex; align-items:center; justify-content:space-between; min-height:45px; border-bottom:1px solid var(--hh-line); font-size:13px; }.hh-mobile-collections a>.hh-icon { width:14px; height:14px; color:#ae8b45; }
.hh-menu-notifications { display:none; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:13px 0; border-block:1px solid var(--hh-line); margin-top:18px; }
.hh-menu-notifications>span { font-size:13px; font-weight:600; }
.hh-menu-content>.hh-account-content { padding:22px 0 0; }

@keyframes hh-panel-in { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
@keyframes hh-panel-out { to { opacity:0; transform:translateY(-6px); } }
@keyframes hh-fade-in { from { opacity:0; } to { opacity:1; } }
@keyframes hh-fade-out { to { opacity:0; } }
@keyframes hh-count-in { from { transform:scale(.78); } to { transform:scale(1); } }
@keyframes hh-breathe { from { opacity:.5; } to { opacity:1; } }
@keyframes hh-spin { to { transform:rotate(360deg); } }
.hh-spin { animation:hh-spin .85s linear infinite; }

@media (min-width:1180px) and (max-width:1319px) {
  .hh-bar { gap:12px; padding-inline:24px; }
  .hh-nav { gap:16px; }
  .hh-private-link { padding-left:16px; }
  .hh-tools { gap:3px; }
  .hh-search-trigger { width:66px; flex-basis:66px; }
  .hh-account-trigger { gap:5px; padding-inline:7px; }
  .hh-action { width:40px; }
}
@media (max-width:1179px) {
  .hh-header,.hh-overlay { --hh-height:72px; }
  .hh-header { --hh-v113-logo-height:125.06px; --hh-v113-logo-half-height:62.53px; --hh-v113-top-pad:6.3px; --hh-v113-ribbon-tuck:61.5px; --hh-v127-ribbon-height:19.3536px; --hh-v127-bow-offset:11px; }
  .hh-satin-ribbon-left,.hh-satin-ribbon-right,.hh-header-wave-left,.hh-header-wave-right { height:var(--hh-v127-ribbon-height); }
  .hh-bar { padding-inline:20px; gap:10px; }
  .hh-mobile-menu-trigger { display:flex; width:44px; height:44px; }
  .hh-brand { --hh-logo-optical-lift:22px; }
  .hh-brand-mark { width:71.656px; height:96.048px; }
  .hh-search-trigger { width:46px; flex-basis:46px; height:44px; }
  /* Mobile/tablet: search is a fixed clickable icon, without typing or caret. */
  .hh-search-morph-icon { animation:none; }
  .hh-search-morph-word, .hh-search-morph-caret { display:none; }
  .hh-search-morph-word { font-size:11px; letter-spacing:-.035em; }
  .hh-search-morph-caret { height:13px; }
  .hh-search-trigger:hover,.hh-search-trigger.is-open { color:#9a6328; }
  .hh-hero .hh-search-trigger:hover { color:#f3cf7c; }
  .hh-tools { margin-left:auto; gap:3px; }
  .hh-action { width:44px; height:44px; }
  .hh-account-trigger { padding:0; border-radius:50%; }
  .hh-account-label { display:none; }
  .hh-notifications { max-width:46px; }
  .hh-mobile-overlay .hh-backdrop { inset:0; background:#17130c65; }
  .hh-mobile-overlay .hh-panel { top:calc(var(--hh-height) + 10px); left:12px; right:12px; width:calc(100% - 24px); max-width:700px; max-height:calc(100dvh - var(--hh-height) - 26px); margin-inline:auto; border-radius:16px; }
  .hh-mobile-overlay.hh-overlay-menu .hh-panel { top:0; right:0; left:auto; width:min(100%,460px); height:100dvh; max-height:100dvh; margin:0; border-radius:0; animation:hh-drawer-in .42s var(--hh-ease) both; }
  .hh-mobile-overlay.hh-overlay-menu.is-leaving .hh-panel { animation:hh-drawer-out .22s ease both; }
  .hh-overlay-menu .hh-panel-top { padding-top:max(24px,env(safe-area-inset-top)); }
  .hh-mobile-overlay .hh-panel-body { padding-bottom:env(safe-area-inset-bottom,0px); }
  .hh-panel-account,.hh-panel-location { max-width:530px!important; }
  .hh-menu-content { padding-bottom:max(26px,env(safe-area-inset-bottom)); }
}
@keyframes hh-drawer-in { from { opacity:.6; transform:translateX(35px); } to { opacity:1; transform:translateX(0); } }
@keyframes hh-drawer-out { to { opacity:0; transform:translateX(24px); } }
@media (max-width:639px) {
  .hh-header { --hh-v113-logo-height:111.54px; --hh-v113-logo-half-height:55.77px; --hh-v113-top-pad:5.6px; --hh-v113-ribbon-tuck:49.2px; --hh-v127-ribbon-height:14.7456px; --hh-v127-bow-offset:8px; }
  .hh-satin-ribbon-left,.hh-satin-ribbon-right,.hh-header-wave-left,.hh-header-wave-right { height:var(--hh-v127-ribbon-height); }
  .hh-ribbon-stage { --hh-untie-distance:clamp(44px,14vw,62px); }
  .hh-bar { padding-inline:13px; gap:6px; }
  /* Small phones: avoid covering search/account controls with side loops. */
  .hh-ceremony-bow { width:102px; }
  .hh-brand { --hh-logo-optical-lift:15.6px; }
  .hh-brand-mark { width:58.136px; height:85.232px; }
  .hh-tools { gap:0; }
  .hh-action { width:40px; height:44px; }
  .hh-search-trigger { width:43px; flex-basis:43px; }
  .hh-mobile-menu-trigger { width:40px; }
  .hh-panel-top { padding:22px 20px 18px; gap:12px; }.hh-panel-top h2 { font-size:28px; }.hh-panel-top .hh-eyebrow { font-size:12px; }.hh-panel-location .hh-panel-top h2 { font-size:29px; }
  .hh-close { width:36px; height:36px; }
  .hh-search-panel-content { padding:20px 17px 0; }.hh-search-form { gap:9px; min-height:54px; padding-left:12px; }.hh-search-form input { font-size:16px; }.hh-search-form input::placeholder { font-size:14px; }.hh-search-form>.hh-icon { width:18px; height:18px; }.hh-search-submit { width:36px; height:38px; }
  .hh-search-discover { grid-template-columns:1fr; gap:20px; padding-block:24px; }.hh-search-bespoke { border-left:0; border-top:1px solid var(--hh-line); padding:21px 0 0; }.hh-search-bespoke>.hh-icon { display:none; }.hh-search-bespoke strong { font-size:24px; }.hh-search-bespoke>span { margin-top:8px; }
  .hh-result-grid { grid-template-columns:1fr; gap:0; }.hh-result { padding-inline:0; }.hh-result-copy strong { font-size:14px; }.hh-result-copy small { font-size:12px; }.hh-result-price { font-size:13px; }.hh-search-meta { gap:8px; }.hh-search-meta .hh-eyebrow { font-size:12px; }.hh-view-results { width:calc(100% + 34px); margin-inline:-17px; padding:16px; }.hh-location-content { padding:21px 20px 24px; }.hh-location-intro { gap:13px; }.hh-location-intro p { font-size:13px; }.hh-location-emblem { width:52px; height:52px; }.hh-pincode-field { gap:7px; }.hh-pincode-field .hh-primary { gap:6px; padding-inline:14px; }.hh-primary { min-height:44px; }
}
@media (max-width:399px) {
  .hh-header .hh-notifications { display:none; }
  .hh-menu-notifications { display:flex; }
}
@media (max-width:389px) {
  .hh-bar { padding-inline:11px; gap:4px; }
  .hh-brand { --hh-logo-optical-lift:15.6px; }
  .hh-brand-mark { width:58.136px; height:85.232px; }
  .hh-action { width:38px; height:44px; }
  .hh-search-trigger { width:40px; flex-basis:40px; }
  .hh-search-morph-word { font-size:10px; }
  .hh-mobile-menu-trigger { width:38px; }
  .hh-notifications { max-width:38px; }
  .hh-notifications>button,.hh-notifications>div>button { max-width:38px; min-width:36px; }
  .hh-panel-top h2 { font-size:26px; }.hh-location-intro p br { display:none; }.hh-menu-content { padding-inline:18px; }.hh-mobile-order-links { gap:9px; }.hh-mobile-order-links a { font-size:12px; }.hh-mobile-major>span:nth-child(2),.hh-mobile-build>div:first-child>span:nth-child(2) { font-size:27px; }
}
@media (max-width:349px) {
  .hh-header { --hh-v113-logo-height:108.16px; --hh-v113-logo-half-height:54.08px; --hh-v113-top-pad:5.5px; --hh-v113-ribbon-tuck:27.8px; --hh-v127-ribbon-height:14.7456px; --hh-v127-bow-offset:8px; }
  .hh-bar { padding-inline:8px; }
  .hh-brand { --hh-logo-optical-lift:15px; }
  .hh-brand-mark { width:55.432px; height:82.528px; }
  .hh-search-trigger { width:38px; flex-basis:38px; }
  .hh-search-morph-word { font-size:9.4px; }
  .hh-panel-top { padding-inline:16px; }
  .hh-mobile-order-links { grid-template-columns:1fr; gap:0; }
  .hh-mobile-order-links a { font-size:12px; }
}
/* V139: THREE MATCHED RESPONSIVE LOGO FOOTPRINTS.
   The center badge stays exactly the same size/position as V138.
   Hamper One artwork and the bow-topped gift burger share its breakpoint
   width; neither is stretched nor allowed below the header edge. */
.hh-header, .hh-overlay {
  --hh-v139-logo-width:83.824px;
  --hh-v139-logo-height:109.568px;
  --hh-v139-side-height:min(calc(var(--hh-height) - 8px), var(--hh-v139-logo-height));
}
.hh-header .hh-brand-mark {
  width:var(--hh-v139-logo-width);
  height:var(--hh-v139-logo-height);
}
.hh-header .hh-gift-trigger {
  width:var(--hh-v139-logo-width);
  min-width:var(--hh-v139-logo-width);
  height:var(--hh-height);
  margin-inline:0;
  padding:0;
  flex:0 0 var(--hh-v139-logo-width);
}
.hh-header .hh-gift-trigger .hh-gift-art {
  width:var(--hh-v139-logo-width);
  height:var(--hh-v139-side-height);
  max-height:calc(var(--hh-height) - 8px);
  flex:0 0 auto;
}
.hh-header .hh-private-link {
  min-height:var(--hh-height);
  padding-left:clamp(10px,1.35vw,18px);
}
.hh-header .hh-private-link .hh-hamperone-image {
  width:var(--hh-v139-logo-width);
  height:var(--hh-v139-side-height);
  max-height:calc(var(--hh-height) - 8px);
  max-width:none;
  object-fit:contain;
  object-position:center;
}
@media (max-width:1179px) {
  .hh-header, .hh-overlay {
    --hh-v139-logo-width:71.656px;
    --hh-v139-logo-height:96.048px;
  }
  .hh-header .hh-mobile-menu-trigger {
    width:var(--hh-v139-logo-width);
    min-width:var(--hh-v139-logo-width);
    height:var(--hh-height);
    flex:0 0 var(--hh-v139-logo-width);
    padding:0;
  }
  .hh-header .hh-mobile-menu-trigger .hh-gift-art {
    width:var(--hh-v139-logo-width);
    height:var(--hh-v139-side-height);
    max-height:calc(var(--hh-height) - 8px);
    max-width:100%;
  }
  .hh-overlay .hh-mobile-private .hh-hamperone-mobile-image {
    width:var(--hh-v139-logo-width);
    height:var(--hh-v139-side-height);
    max-width:100%;
    object-fit:contain;
    object-position:left center;
  }
}
@media (max-width:639px) {
  .hh-header, .hh-overlay {
    --hh-v139-logo-width:58.136px;
    --hh-v139-logo-height:85.232px;
  }
}
@media (max-width:349px) {
  .hh-header, .hh-overlay {
    --hh-v139-logo-width:55.432px;
    --hh-v139-logo-height:82.528px;
  }
}

@media (prefers-reduced-motion:reduce) {
  .hh-logo-sequence { opacity:1!important; visibility:visible!important; transform:none!important; filter:none!important; }
  .hh-logo-shield { animation:none!important; transform:none!important; }
  .hh-logo-horse { transform:none!important; }
  .hh-satin-ribbon-left,.hh-satin-ribbon-right { transform:none!important; }
  .hh-ceremony-bow { display:none!important; }
  .hh-header,.hh-header *,.hh-overlay *,.hh-header::after,.hh-overlay *::before,.hh-overlay *::after { animation:none!important; transition:none!important; scroll-behavior:auto!important; }
}


/* V146 / HEADER BRAND PALETTE: scoped and after legacy CSS. */
.hh-header, .hh-overlay {
  --hh-paper:#FAF8F4; --hh-soft:#E8E1D6;
  --hh-line:rgba(64,58,50,.15); --hh-ink:#403A32;
  --hh-muted:rgba(64,58,50,.72); --hh-gold:#B79B6A;
  --hh-orange:#B79B6A; --hh-connected-surface:#161715;
}
.hh-header, .hh-header-shell, .hh-bar { border-color:rgba(183,155,106,.24); }
.hh-header { background:#161715; }
.hh-header .hh-nav-link, .hh-header .hh-action { color:#FAF8F4; }
.hh-header .hh-nav-link::after, .hh-panel::before { background:#B79B6A; }
.hh-overlay .hh-panel, .hh-overlay .hh-account-quick-link { background:#FAF8F4; color:#403A32; }
.hh-overlay .hh-view-results { background:#E8E1D6; color:#403A32; }
.hh-overlay .hh-primary, .hh-overlay .hh-secondary { background:#B79B6A; color:#161715!important; border-color:#B79B6A; }
.hh-overlay .hh-primary:hover, .hh-overlay .hh-secondary:hover { background:#403A32; color:#FAF8F4!important; border-color:#403A32; }
.hh-header .hh-count { background:#B79B6A; color:#161715; }
.hh-header :is(a,button,input):focus-visible, .hh-overlay :is(a,button,input):focus-visible { outline-color:#B79B6A; }


/* ==============================================================
   V147 / RESPONSIVE HEADER TOOLS: NO SEARCH / ACCOUNT COLLISION
   The animated Search word is wider than its former fixed 76px slot.
   Give the desktop word its own unshrinkable track, and never let
   the Account label squeeze into notifications or the cart.
   The screen <1380px keeps search as the classic clickable icon;
   the typewriter effect remains for large desktop displays.
   =============================================================== */
.hh-header .hh-bar {
  min-width:0;
  box-sizing:border-box;
}
.hh-header .hh-nav {
  flex:0 0 auto;
  min-width:0;
}
.hh-header .hh-tools {
  display:flex;
  flex:0 0 auto;
  flex-shrink:0 !important;
  width:max-content;
  min-width:max-content;
  max-width:calc(50% - 55px);
  align-items:center;
  justify-content:flex-end;
  gap:clamp(6px,.75vw,12px);
  white-space:nowrap;
}
.hh-header .hh-search-trigger {
  display:flex;
  flex:0 0 128px;
  width:128px;
  min-width:128px;
  max-width:128px;
  height:46px;
  padding:0 7px;
  justify-content:center;
  align-items:center;
  overflow:hidden;
}
.hh-header .hh-search-morph {
  display:flex;
  justify-content:center;
  align-items:center;
  width:100%;
  max-width:100%;
  min-width:0;
  overflow:hidden;
}
.hh-header .hh-search-morph-word {
  max-width:100%;
  min-width:0;
  white-space:nowrap;
  font-size:14px !important;
  font-weight:400 !important;
  letter-spacing:.025em !important;
  line-height:1.2 !important;
  text-transform:none !important;
}
.hh-header .hh-account-trigger {
  display:inline-flex;
  flex:0 0 auto;
  flex-shrink:0 !important;
  width:auto;
  min-width:116px;
  max-width:none;
  height:46px;
  gap:9px;
  justify-content:center;
  align-items:center;
  padding:0 12px;
  white-space:nowrap;
  overflow:hidden;
}
.hh-header .hh-account-label {
  display:block;
  flex:0 0 auto;
  width:auto;
  max-width:none;
  font-family:var(--hmp-font, 'Montserrat', Arial, sans-serif) !important;
  font-size:12px !important;
  font-weight:400 !important;
  letter-spacing:.065em !important;
  line-height:1.25 !important;
  white-space:nowrap;
}
.hh-header .hh-notifications {
  display:flex;
  flex:0 0 46px;
  width:46px;
  min-width:46px;
  max-width:46px;
  justify-content:center;
  align-items:center;
  overflow:visible;
}
.hh-header .hh-notifications > button,
.hh-header .hh-notifications > div > button {
  display:flex;
  width:44px;
  min-width:44px;
  height:44px;
  align-items:center;
  justify-content:center;
  padding:0;
}
.hh-header .hh-cart {
  display:flex;
  flex:0 0 46px;
  width:46px;
  min-width:46px;
  max-width:46px;
  height:46px;
  align-items:center;
  justify-content:center;
}
.hh-header .hh-action > .hh-icon,
.hh-header .hh-search-morph-icon > .hh-icon {
  width:22px;
  height:22px;
  flex:0 0 22px;
}
/* Laptop: proper icon-only search, no hidden half-typed word or cursor. */
@media (min-width:1180px) and (max-width:1379px) {
  .hh-header .hh-bar { padding-inline:clamp(18px,2.1vw,30px); }
  .hh-header .hh-tools { gap:6px; }
  .hh-header .hh-search-trigger {
    flex:0 0 46px;
    width:46px;
    min-width:46px;
    max-width:46px;
    padding:0;
  }
  .hh-header .hh-search-morph-word,
  .hh-header .hh-search-morph-caret { display:none !important; }
  .hh-header .hh-account-trigger { min-width:106px; padding-inline:8px; gap:7px; }
}
/* Mobile/tablet: text labels stay hidden and all icons get distinct hit zones. */
@media (max-width:1179px) {
  .hh-header .hh-tools {
    flex:0 0 auto;
    min-width:0;
    max-width:calc(50% - 40px);
    gap:3px;
  }
  .hh-header .hh-search-trigger {
    flex:0 0 44px;
    width:44px;
    min-width:44px;
    max-width:44px;
    height:44px;
    padding:0;
  }
  .hh-header .hh-account-trigger {
    flex:0 0 44px;
    width:44px;
    min-width:44px;
    max-width:44px;
    height:44px;
    padding:0;
    border-radius:50%;
  }
  .hh-header .hh-account-label { display:none !important; }
  .hh-header .hh-notifications { flex-basis:44px; width:44px; min-width:44px; max-width:44px; }
  .hh-header .hh-cart { flex-basis:44px; width:44px; min-width:44px; max-width:44px; height:44px; }
}
@media (max-width:639px) {
  .hh-header .hh-tools { gap:1px; max-width:calc(50% - 33px); }
  .hh-header .hh-search-trigger,
  .hh-header .hh-account-trigger,
  .hh-header .hh-cart {
    flex-basis:36px;
    width:36px;
    min-width:36px;
    max-width:36px;
  }
  .hh-header .hh-notifications {
    flex-basis:36px;
    width:36px;
    min-width:36px;
    max-width:36px;
  }
  .hh-header .hh-notifications > button,
  .hh-header .hh-notifications > div > button { width:36px; min-width:36px; }
}
@media (max-width:399px) {
  .hh-header .hh-notifications { display:none !important; }
}


/* V148: center HAMPORIUM badge ONLY. 5% shorter vertically (roughly
   2.5px removed from its visible top and bottom at desktop size).
   Keep horizontal width, center position, header spacing and all other icons intact. */
.hh-header .hh-brand-mark {
  transform: scaleY(.95);
  transform-origin: 50% 50%;
}

`;
