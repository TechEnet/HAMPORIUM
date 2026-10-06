import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

let hamporiumTransitionLocked = false;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

const createTransitionOverlay = () => {
  const overlay = document.createElement("div");
  overlay.className = "hp-route-gift-transition";
  overlay.setAttribute("aria-hidden", "true");

  const style = document.createElement("style");
  style.textContent = `
    .hp-route-gift-transition {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      pointer-events: auto;
      overflow: hidden;
      background: transparent;
      isolation: isolate;
    }

    .hp-route-gift-transition .hp-route-wrap-panel {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 50.5%;
      background:
        radial-gradient(ellipse at 50% 0%, rgba(231,196,105,.055) 0 12%, transparent 13% 100%) 0 0/52px 76px,
        linear-gradient(115deg, rgba(255,255,255,.024), transparent 32%, rgba(212,175,55,.042) 52%, transparent 74%),
        linear-gradient(180deg,#100c08 0%,#080604 55%,#0d0906 100%);
      box-shadow: inset 0 0 60px rgba(212,175,55,.05);
      transition: transform 280ms cubic-bezier(.16,1,.3,1);
      will-change: transform;
    }

    .hp-route-gift-transition .hp-route-wrap-panel::after {
      content: "";
      position: absolute;
      inset: 12px;
      border: 1px solid rgba(212,175,55,.15);
      pointer-events: none;
    }

    .hp-route-gift-transition .hp-route-wrap-left {
      left: 0;
      transform: translate3d(-104%,0,0);
    }

    .hp-route-gift-transition .hp-route-wrap-right {
      right: 0;
      transform: translate3d(104%,0,0);
    }

    .hp-route-gift-transition.is-closing .hp-route-wrap-left,
    .hp-route-gift-transition.is-closing .hp-route-wrap-right {
      transform: translate3d(0,0,0);
    }

    .hp-route-gift-transition .hp-route-ribbon {
      position: absolute;
      z-index: 4;
      left: 0;
      right: 0;
      top: 50%;
      height: 30px;
      transform: translateY(-50%) scaleX(0);
      transform-origin: center;
      opacity: 0;
      border-block: 1px solid rgba(255,240,184,.28);
      background: linear-gradient(180deg,#70450c 0%,#d7ad43 25%,#fff0b0 50%,#d7ad43 75%,#70450c 100%);
      box-shadow: 0 7px 26px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.42);
    }

    .hp-route-gift-transition.is-closing .hp-route-ribbon {
      animation: hpRouteRibbonClose 250ms 105ms cubic-bezier(.16,1,.3,1) both;
    }

    .hp-route-gift-transition .hp-route-seal {
      position: absolute;
      z-index: 6;
      left: 50%;
      top: 50%;
      display: grid;
      width: 76px;
      height: 76px;
      place-items: center;
      border-radius: 50%;
      border: 1px solid rgba(255,235,165,.72);
      color: #291a05;
      font: 700 29px/1 'Cormorant Garamond',Georgia,serif;
      background: radial-gradient(circle at 34% 28%,#fff1b2 0%,#efd46f 24%,#d1a53b 52%,#936014 80%,#5d3908 100%);
      box-shadow: 0 18px 46px rgba(0,0,0,.46), inset 0 1px 0 rgba(255,255,255,.54);
      opacity: 0;
      transform: translate(-50%,-50%) scale(.38) rotate(-22deg);
    }

    .hp-route-gift-transition .hp-route-seal::after {
      content: "";
      position: absolute;
      inset: 9px;
      border: 1px dashed rgba(83,50,6,.45);
      border-radius: inherit;
    }

    .hp-route-gift-transition.is-closing .hp-route-seal {
      animation: hpRouteSealStamp 240ms 175ms cubic-bezier(.2,1.32,.34,1) both;
    }

    .hp-route-gift-transition.is-revealing .hp-route-wrap-left {
      transform: translate3d(-104%,0,0);
      transition-duration: 300ms;
    }

    .hp-route-gift-transition.is-revealing .hp-route-wrap-right {
      transform: translate3d(104%,0,0);
      transition-duration: 300ms;
    }

    .hp-route-gift-transition.is-revealing .hp-route-ribbon {
      opacity: 0;
      transform: translateY(-50%) scaleX(.72);
      transition: opacity 130ms ease, transform 220ms ease;
    }

    .hp-route-gift-transition.is-revealing .hp-route-seal {
      opacity: 0;
      transform: translate(-50%,-50%) scale(.72) rotate(18deg);
      transition: opacity 130ms ease, transform 220ms ease;
    }

    @keyframes hpRouteRibbonClose {
      from { opacity:0; transform:translateY(-50%) scaleX(0); }
      to { opacity:1; transform:translateY(-50%) scaleX(1); }
    }

    @keyframes hpRouteSealStamp {
      0% { opacity:0; transform:translate(-50%,-50%) scale(.38) rotate(-22deg); }
      68% { opacity:1; transform:translate(-50%,-50%) scale(1.08) rotate(3deg); }
      100% { opacity:1; transform:translate(-50%,-50%) scale(1) rotate(0); }
    }

    @media (max-width: 639px) {
      .hp-route-gift-transition .hp-route-ribbon { height: 24px; }
      .hp-route-gift-transition .hp-route-seal {
        width: 64px;
        height: 64px;
        font-size: 25px;
      }
    }
  `;

  const left = document.createElement("div");
  left.className = "hp-route-wrap-panel hp-route-wrap-left";

  const right = document.createElement("div");
  right.className = "hp-route-wrap-panel hp-route-wrap-right";

  const ribbon = document.createElement("div");
  ribbon.className = "hp-route-ribbon";

  const seal = document.createElement("div");
  seal.className = "hp-route-seal";
  seal.textContent = "H";

  overlay.append(style, left, right, ribbon, seal);
  return overlay;
};

export const runHamporiumUiTransition = (onCovered) => {
  if (typeof onCovered !== "function") return false;

  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    prefersReducedMotion()
  ) {
    onCovered();
    return true;
  }

  if (hamporiumTransitionLocked) return false;
  hamporiumTransitionLocked = true;

  const overlay = createTransitionOverlay();
  document.body.appendChild(overlay);

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      overlay.classList.add("is-closing");
    });
  });

  window.setTimeout(() => {
    try {
      onCovered();
    } finally {
      overlay.classList.add("is-revealing");
    }
  }, 390);

  window.setTimeout(() => {
    overlay.remove();
    hamporiumTransitionLocked = false;
  }, 730);

  return true;
};

export const runHamporiumRouteTransition = (to, navigate) => {
  if (typeof navigate !== "function") return false;
  return runHamporiumUiTransition(() => navigate(to));
};

const isModifiedClick = (event) =>
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey;

const shouldSkipAnchor = (anchor) => {
  if (!anchor) return true;
  if (anchor.hasAttribute("download")) return true;
  if (anchor.dataset?.hpNoTransition === "true") return true;
  if (anchor.target && anchor.target.toLowerCase() !== "_self") return true;

  const rawHref = anchor.getAttribute("href") || "";
  if (!rawHref || rawHref.startsWith("#")) return true;
  if (/^(mailto:|tel:|sms:|javascript:)/i.test(rawHref)) return true;

  return false;
};

/*
 * Mount this once INSIDE BrowserRouter/Router near the top of the app.
 * It gives normal internal links the same HAMPORIUM ribbon transition.
 */
const HamporiumNavigationTransition = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;

      const target = event.target;
      const anchor = target?.closest?.("a[href]");
      if (shouldSkipAnchor(anchor)) return;

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const destination = `${url.pathname}${url.search}${url.hash}`;
      if (!destination || destination === current) return;

      event.preventDefault();
      runHamporiumRouteTransition(destination, navigate);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [navigate]);

  return null;
};

export default HamporiumNavigationTransition;
