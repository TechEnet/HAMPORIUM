import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../api/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useDeliveryLocation } from "../context/LocationContext.jsx";
import { trackSearchAnalytics } from "../utils/analytics.js";
import HeaderNotifications from "./HeaderNotifications.jsx";

import logoLight from "../assets/images/logo_dark.jpeg";

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

const normalizePincode = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);

// ======================================================
// LOGO BACKGROUND REMOVE
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

const Header = () => {
  const { user, partner, logout } = useAuth();
  const { cart } = useCart();
  const {
    deliveryLocation, locationLabel, locationLoading, locationError,
    resolvePincode, detectCurrentLocation, clearDeliveryLocation, setLocationError,
  } = useDeliveryLocation();
  const location = useLocation();
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const transparentLogo = useTransparentLogo(logoLight);
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
  const scrollFrameRef = useRef(0);
  const lastScrollYRef = useRef(0);
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
  const [homeIntroActive, setHomeIntroActive] = useState(location.pathname === "/");

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

  const clearHoverTimer = useCallback(() => {
    window.clearTimeout(hoverTimerRef.current);
  }, []);

  const closePanel = useCallback((restoreFocus = true) => {
    window.clearTimeout(hoverTimerRef.current);
    restoreFocusRef.current = restoreFocus;
    setPanel(null);
  }, []);

  const openPanel = (name, element) => {
    clearHoverTimer();
    if (element && !overlayRef.current?.contains(element)) triggerRef.current = element;
    restoreFocusRef.current = false;
    notificationsPinnedRef.current = false;
    setHeaderHidden(false);
    setLogoutError("");
    if (name === "location") setLocationError?.("");
    setPanel(name);
  };

  const togglePanel = (name, event) => {
    if (panel === name) closePanel();
    else openPanel(name, event?.currentTarget || document.activeElement);
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

  // Preserve Home's first-playback contract; there is intentionally no timeout
  // that could reveal the navigation on top of the cinematic intro.
  useEffect(() => {
    if (!isHome) {
      setHomeIntroActive(false);
      return undefined;
    }
    setHomeIntroActive(true);
    const onIntro = (event) => setHomeIntroActive(Boolean(event?.detail?.active));
    window.addEventListener("hamporium:intro-state", onIntro);
    return () => window.removeEventListener("hamporium:intro-state", onIntro);
  }, [isHome]);

  useEffect(() => {
    clearHoverTimer();
    restoreFocusRef.current = false;
    setPanel(null);
    setRenderedPanel(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setHeaderHidden(false);
    notificationsPinnedRef.current = false;
    lastScrollYRef.current = Math.max(0, window.scrollY || 0);
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
      const focusInside = headerRef.current?.contains(document.activeElement);
      if (y <= 72 || renderedPanel || notificationsPinnedRef.current || focusInside) {
        setHeaderHidden(false);
      } else if (Math.abs(delta) >= 6) {
        setHeaderHidden(delta > 0);
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
  }, [renderedPanel]);

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
    if (!desktop || event.pointerType !== "mouse" || (panel && panel !== "hampers")) return;
    clearHoverTimer();
    const element = event.currentTarget;
    hoverTimerRef.current = window.setTimeout(() => openPanel("hampers", element), 140);
  };
  const scheduleMenuClose = () => {
    clearHoverTimer();
    if (panel !== "hampers") return;
    hoverTimerRef.current = window.setTimeout(() => {
      // Keep keyboard-opened navigation visible while its links have focus.
      if (!panelRef.current?.contains(document.activeElement)) closePanel(false);
    }, 260);
  };
  const accountProps = {
    user, isAdmin, isPartner, partnerPortalPath, becomePartnerPath,
    handleLogout, logoutBusy, logoutError,
  };
  const panelTitle = {
    hampers: "Find your kind of gift.", search: "A thoughtful gift starts here.",
    location: "Where should we deliver?", account: user ? "Your account" : "Welcome to HAMPORIUM",
    menu: "Explore HAMPORIUM",
  }[renderedPanel];

  if (introHidden) return null;

  return (
    <>
      <style>{HEADER_CSS}</style>
      <header
        ref={headerRef}
        className={`hh-header ${darkContent ? "hh-light" : "hh-hero"} ${headerHidden ? "hh-hidden" : ""}`}
        onFocusCapture={() => setHeaderHidden(false)}
      >
        <div className="hh-bar">
          <Link to="/" className="hh-brand" aria-label="HAMPORIUM home" onClick={() => closePanel(false)}>
            <span className="hh-brand-mark"><img src={transparentLogo} alt="" /></span>
            <span className="hh-wordmark">HAMPORIUM<span className="hh-brand-caption">The art of thoughtful gifting</span></span>
          </Link>
          {desktop && (
            <nav className="hh-nav" aria-label="Primary navigation">
              <button
                ref={hamperTriggerRef} type="button"
                className={`hh-nav-link ${hamperMenuActive || panel === "hampers" ? "is-current" : ""}`}
                aria-expanded={panel === "hampers"} aria-controls={panel === "hampers" ? panelId : undefined}
                onClick={(event) => togglePanel("hampers", event)}
                onPointerEnter={scheduleMenuOpen} onPointerLeave={scheduleMenuClose}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault(); openPanel("hampers", event.currentTarget);
                    window.setTimeout(() => panelRef.current?.querySelector("a[href]")?.focus(), 40);
                  }
                }}
              >Hampers <Icon name="chevron" className={panel === "hampers" ? "hh-turn" : ""} /></button>
              <Link to="/hamper-one" className={`hh-private-link ${isHamperOne ? "is-current" : ""}`} aria-current={isHamperOne ? "page" : undefined} onClick={() => closePanel(false)}>
                <Icon name="spark" /><span>HAMPER <em>ONE</em><small>Private collection</small></span>
              </Link>
            </nav>
          )}
          <div className="hh-tools">
            <button ref={searchTriggerRef} type="button" className={`hh-search-trigger ${panel === "search" ? "is-open" : ""}`}
              aria-label="Search hampers" aria-expanded={panel === "search"} aria-controls={panel === "search" ? panelId : undefined}
              onClick={(event) => togglePanel("search", event)}>
              <Icon name="search" /><span>Find a thoughtful gift</span><kbd aria-hidden="true">/</kbd>
            </button>
            {desktop && (
              <button type="button" className={`hh-location-trigger ${panel === "location" ? "is-open" : ""}`}
                aria-label="Select delivery location" aria-expanded={panel === "location"} aria-controls={panel === "location" ? panelId : undefined}
                onClick={(event) => togglePanel("location", event)}>
                <Icon name="pin" /><span><small>Deliver to</small><strong>{deliveryLocation ? locationLabel || deliveryLocation.pincode : "Select location"}</strong></span><Icon name="chevron" />
              </button>
            )}
            <span className="hh-tools-divider" aria-hidden="true" />
            {desktop && (
              <ActionButton label="Account" active={panel === "account"} controls={panel === "account" ? panelId : undefined} onClick={(event) => togglePanel("account", event)}><Icon name="account" /></ActionButton>
            )}
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
            {!desktop && <ActionButton label="Open menu" active={panel === "menu"} controls={panel === "menu" ? panelId : undefined} onClick={(event) => togglePanel("menu", event)}><Icon name={panel === "menu" ? "close" : "menu"} /></ActionButton>}
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
              <div><p className="hh-eyebrow">{renderedPanel === "hampers" ? "Gifting, your way" : renderedPanel === "search" ? "Discover HAMPORIUM" : renderedPanel === "location" ? "Delivery location" : renderedPanel === "menu" ? "The gifting edit" : "HAMPORIUM"}</p>
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
              {renderedPanel === "location" && <LocationPanel
                location={deliveryLocation} loading={locationLoading} error={locationError}
                resolvePincode={resolvePincode} detectCurrentLocation={detectCurrentLocation}
                clearLocation={clearDeliveryLocation} clearError={() => setLocationError?.("")}
                onComplete={() => closePanel()} id={instanceId}
              />}
              {renderedPanel === "account" && <AccountPanel {...accountProps} />}
              {renderedPanel === "menu" && <MobileMenu
                {...accountProps} location={deliveryLocation} locationLabel={locationLabel}
                onLocation={() => openPanel("location")} onSearch={() => openPanel("search")}
              />}
            </div>
          </section>
        </div>, document.body
      )}
    </>
  );
};

const ActionButton = ({ label, active, controls, onClick, children }) => (
  <button type="button" className={`hh-action ${active ? "is-open" : ""}`} aria-label={label}
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
      <p className="hh-muted">The box, the gifts, the finishing touches.<br />Chosen by you.</p>
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

const LocationPanel = ({ location, loading, error, resolvePincode, detectCurrentLocation, clearLocation, clearError, onComplete, id }) => {
  const [pincode, setPincode] = useState(location?.pincode || "");
  const [localError, setLocalError] = useState("");
  const [operation, setOperation] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => setPincode(location?.pincode || ""), [location?.pincode]);
  const busy = loading || Boolean(operation);
  const displayError = localError || error;
  const run = async (kind, task) => {
    if (busy) return;
    setLocalError(""); clearError?.(); setOperation(kind);
    try { await task(); if (mounted.current) onComplete?.(); }
    catch (requestError) { if (mounted.current) setLocalError(requestError?.response?.data?.message || requestError.message || "Unable to verify your location."); }
    finally { if (mounted.current) setOperation(""); }
  };
  const submit = (event) => {
    event.preventDefault();
    if (!/^[1-9][0-9]{5}$/.test(pincode)) { setLocalError("Enter a valid 6-digit Indian pincode."); return; }
    void run("pincode", () => resolvePincode(pincode));
  };
  return (
    <div className="hh-location-content">
      <div className="hh-location-intro"><span className="hh-location-emblem"><Icon name="pin" /></span><p>Find availability and delivery estimates<br />for your area.</p></div>
      {location && <div className="hh-saved-location"><Icon name="check" /><div><small>Current delivery location</small><strong>{[location.city || location.district, location.state].filter(Boolean).join(", ") || "India"}</strong><span>{location.pincode}</span></div><button disabled={busy} type="button" onClick={() => { clearLocation(); clearError?.(); setPincode(""); setLocalError(""); }}>Clear</button></div>}
      <form onSubmit={submit} noValidate className="hh-pincode-form">
        <label htmlFor={`hh-pin-${id}`}>Pincode <span>6 digits</span></label>
        <div className={`hh-pincode-field ${displayError ? "has-error" : ""}`}><Icon name="pin" />
          <input id={`hh-pin-${id}`} value={pincode} onChange={(event) => { setPincode(normalizePincode(event.target.value)); setLocalError(""); clearError?.(); }} type="text" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="e.g. 226001" aria-invalid={Boolean(displayError)} aria-describedby={displayError ? `hh-pin-error-${id}` : undefined} />
          <button type="submit" className="hh-primary" disabled={busy || pincode.length !== 6}>{operation === "pincode" ? "Checking..." : "Apply"}<Icon name={operation === "pincode" ? "loader" : "arrow"} /></button>
        </div>
        {displayError && <p className="hh-error" role="alert" id={`hh-pin-error-${id}`}>{displayError}</p>}
      </form>
      <div className="hh-or"><span />or<span /></div>
      <button type="button" className="hh-detect" disabled={busy} onClick={() => void run("detect", detectCurrentLocation)}><Icon name={operation === "detect" ? "loader" : "locate"} /><span>{operation === "detect" ? "Detecting your location..." : "Use my current location"}</span><Icon name="arrow" /></button>
      <p className="hh-location-note">Your browser will ask for location permission.</p>
    </div>
  );
};

const AccountPanel = ({ user, isAdmin, isPartner, partnerPortalPath, becomePartnerPath, handleLogout, logoutBusy, logoutError }) => (
  <div className="hh-account-content">
    {user ? <><div className="hh-account-profile"><span>{String(user.name || "H").slice(0, 1).toUpperCase()}</span><div><strong>{user.name || "My Account"}</strong>{user.email && <small>{user.email}</small>}</div></div>
      <div className="hh-account-links">{[["/account", "My Account", "account"], ["/account/orders", "My Orders", "bag"], ["/account/addresses", "Saved Addresses", "pin"], ["/account/refunds", "Refunds", "refund"]].map(([to, label, icon]) => <Link key={to} to={to}><Icon name={icon} /><span>{label}</span><Icon name="arrow" /></Link>)}</div></>
      : <><p className="hh-muted">Your orders, saved addresses and thoughtful gifts. All in one place.</p><div className="hh-auth-actions"><Link to="/login" className="hh-secondary">Login</Link><Link to="/signup" className="hh-primary">Sign up <Icon name="arrow" /></Link></div></>}
    <Link to={isPartner ? partnerPortalPath : becomePartnerPath} className="hh-partner-link"><Icon name="handshake" /><span><strong>{isPartner ? "Partner Portal" : "Become a Partner"}</strong><small>{isPartner ? "Your partnership with HAMPORIUM" : "Discover the HAMPORIUM partner program"}</small></span><Icon name="arrow" /></Link>
    {isAdmin && <Link to="/admin" className="hh-admin-link">Admin Dashboard <Icon name="arrow" /></Link>}
    {user && <button type="button" className="hh-logout" disabled={logoutBusy} onClick={handleLogout}>{logoutBusy ? "Signing out..." : "Logout"}<Icon name="logout" /></button>}
    {logoutError && <p className="hh-error" role="alert">{logoutError}</p>}
  </div>
);

const MobileMenu = ({ location, locationLabel, onLocation, onSearch, ...accountProps }) => (
  <div className="hh-menu-content">
    <button type="button" onClick={onSearch} className="hh-menu-search"><Icon name="search" /><span>Search for the perfect gift</span><Icon name="arrow" /></button>
    <nav aria-label="Mobile primary navigation" className="hh-mobile-nav">
      <Link to="/gifts" className="hh-mobile-major"><span className="hh-index">01</span><span>Shop hampers<small>Ready-to-gift collections</small></span><Icon name="arrow" /></Link>
      <div className="hh-mobile-build"><div><span className="hh-index">02</span><span>Build your own<small>Create it your way</small></span><Icon name="gift" /></div>
        <div className="hh-mobile-order-links">{BUILDER_OPTIONS.map((item) => <Link key={item.to} to={item.to}>{item.label}<Icon name="arrow" /></Link>)}</div>
      </div>
      <Link to="/hamper-one" className="hh-mobile-private"><Icon name="spark" /><span><small>Private collection</small>HAMPER <em>ONE</em></span><Icon name="arrow" /></Link>
    </nav>
    <div className="hh-mobile-collections"><p className="hh-eyebrow">Explore the collections</p><div>{COLLECTIONS.map((item) => <Link key={item.to} to={item.to}>{item.label.replace(" Hampers", "")}<Icon name="arrow" /></Link>)}</div></div>
    <button type="button" className="hh-menu-location" onClick={onLocation}><Icon name="pin" /><span><small>Deliver to</small><strong>{location ? locationLabel || location.pincode : "Select your location"}</strong></span><Icon name="arrow" /></button>
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

export default Header;

const HEADER_CSS = `
/* HAMPORIUM / Pearl Navigation. All styles are scoped to this component. */
.hh-header,.hh-overlay { --hh-paper:#fffcf7; --hh-soft:#f5efe5; --hh-line:#e6ddcf; --hh-ink:#252119; --hh-muted:#71695d; --hh-gold:#957020; --hh-orange:#f47822; --hh-ease:cubic-bezier(.22,1,.36,1); --hh-height:84px; font-family:'Manrope',Arial,sans-serif; font-size:14px; line-height:1.5; -webkit-font-smoothing:antialiased; }
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
.hh-header { position:fixed; inset:0 0 auto; width:100%; z-index:100; transition:transform .48s var(--hh-ease),background-color .35s ease,box-shadow .35s ease; border-bottom:1px solid transparent; }
.hh-header::after { content:''; position:absolute; bottom:-1px; left:0; width:100%; height:1px; background:linear-gradient(90deg,transparent,#b18a434a 25%,#b18a4390 50%,#b18a434a 75%,transparent); pointer-events:none; }
.hh-light { color:var(--hh-ink); background:rgba(255,252,247,.97); border-bottom-color:#ede5d9; box-shadow:0 5px 24px #35261007; }
.hh-hero { color:#fff8e7; background:linear-gradient(180deg,#0e0c0a70,#0e0c0a38); }
@supports (backdrop-filter:blur(12px)) { .hh-header { backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); } }
.hh-hidden { transform:translateY(-110%); pointer-events:none; }
.hh-bar { width:100%; height:var(--hh-height); display:flex; align-items:center; gap:clamp(14px,1.6vw,32px); padding-inline:clamp(20px,2.4vw,56px); }
.hh-brand { display:flex; align-items:center; gap:10px; flex:0 0 auto; }
.hh-brand-mark { display:flex; width:54px; height:64px; align-items:center; justify-content:center; }
.hh-brand-mark img { display:block; width:100%; height:100%; object-fit:contain; transition:transform .6s var(--hh-ease); }
.hh-wordmark { font-family:'Cormorant Garamond',Georgia,serif; font-size:25px; letter-spacing:.065em; font-weight:600; line-height:1; white-space:nowrap; }
.hh-brand-caption { display:block; margin-top:7px; color:var(--hh-muted); font-family:'Manrope',Arial,sans-serif; font-size:9px; font-weight:500; letter-spacing:.035em; }
.hh-hero .hh-brand-caption { color:#e5ded0bd; }
.hh-nav { display:flex; align-self:stretch; align-items:center; gap:clamp(14px,1.6vw,28px); margin-left:clamp(6px,1.4vw,22px); }
.hh-nav-link { position:relative; display:inline-flex; height:100%; align-items:center; gap:8px; padding:0 2px; border:0; color:inherit; background:transparent; font-weight:600!important; font-size:14px!important; white-space:nowrap; }
.hh-nav-link::after { content:''; position:absolute; bottom:17px; left:0; right:0; height:1px; transform:scaleX(0); transform-origin:left; background:var(--hh-orange); transition:transform .42s var(--hh-ease); }
.hh-nav-link.is-current::after,.hh-nav-link:hover::after { transform:scaleX(1); }
.hh-nav-link .hh-icon { width:14px; height:14px; }
.hh-icon.hh-turn { transform:rotate(180deg); }
.hh-private-link { display:flex; align-items:center; gap:9px; position:relative; padding-left:22px; border-left:1px solid #a8894f40; white-space:nowrap; }
.hh-private-link>.hh-icon { width:17px; height:17px; color:#9b7422; }
.hh-private-link>span { font-size:12px; font-weight:600; letter-spacing:.06em; line-height:1.2; }
.hh-private-link em { color:#916b1b; font-family:Georgia,serif; font-size:15px; font-weight:400; }
.hh-private-link small { display:block; margin-top:5px; color:var(--hh-muted); font-size:9px; font-weight:400; letter-spacing:.045em; }
.hh-private-link.is-current>span { color:#977023; }
.hh-hero .hh-private-link em,.hh-hero .hh-private-link>.hh-icon { color:#e0c173; }
.hh-hero .hh-private-link small { color:#e9e1cfbf; }
.hh-tools { min-width:0; display:flex; align-items:center; gap:6px; margin-left:auto; }
.hh-search-trigger { display:flex; align-items:center; gap:10px; min-width:0; width:clamp(240px,22vw,390px); height:44px; padding:0 12px; border:1px solid #e8dfd1; border-radius:9px; color:var(--hh-muted); background:#f5f0e8; transition:border-color .3s,background .3s,box-shadow .3s; }
.hh-search-trigger>.hh-icon { width:18px; height:18px; color:#98732f; }
.hh-search-trigger>span { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:12px; text-align:left; }
.hh-search-trigger kbd { display:flex; align-items:center; justify-content:center; width:22px; height:24px; margin-left:auto; border:1px solid #d9cebc; border-radius:4px; font-family:inherit; font-size:12px; background:#fffaf2; }
.hh-search-trigger:hover,.hh-search-trigger.is-open { border-color:#c5a76f; box-shadow:0 0 0 3px #bb904c0c; background:#fff9ef; }
.hh-hero .hh-search-trigger { border-color:#ffffff30; background:#ffffff0b; color:#fff4e0; }
.hh-hero .hh-search-trigger>.hh-icon { color:#e7c983; }
.hh-hero .hh-search-trigger kbd { border-color:#ffffff25; background:#ffffff0b; }
.hh-location-trigger { display:flex; align-items:center; min-width:0; width:clamp(145px,13vw,205px); gap:9px; height:44px; margin-left:6px; padding:0 10px; border:0; border-radius:9px; background:transparent; color:inherit; transition:background .3s; }
.hh-location-trigger>.hh-icon:first-child { color:#a67b35; width:20px; }
.hh-location-trigger>.hh-icon:last-child { width:13px; height:13px; }
.hh-location-trigger>span { flex:1; min-width:0; text-align:left; line-height:1.3; }
.hh-location-trigger small { display:block; font-size:10px; font-weight:500; color:var(--hh-muted); }
.hh-location-trigger strong { display:block; margin-top:3px; font-size:12px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.hh-location-trigger:hover,.hh-location-trigger.is-open { background:#b9955320; }
.hh-hero .hh-location-trigger small { color:#e8e0d0bd; }
.hh-tools-divider { flex:0 0 1px; height:24px; margin-inline:5px; background:#aa8e5838; }
.hh-action { position:relative; display:flex; align-items:center; justify-content:center; width:42px; height:44px; flex:0 0 auto; border:0; border-radius:50%; color:inherit; background:transparent; transition:background .3s,color .3s,transform .4s var(--hh-ease); }
.hh-action:hover,.hh-action.is-open { color:#9a6328; background:#f1e5d1; }
.hh-hero .hh-action:hover { color:#f3cf7c; background:#ffffff10; }
.hh-count { position:absolute; top:1px; right:-1px; display:grid; place-items:center; min-width:17px; height:17px; padding-inline:4px; border-radius:50px; background:#ec721c; color:white; font-size:10px; font-weight:700; line-height:1; animation:hh-count-in .35s var(--hh-ease); }
.hh-notifications { display:flex; align-items:center; flex:0 0 auto; color:inherit; }
.hh-notifications>button,.hh-notifications>div>button { min-width:40px; min-height:44px; }

/* Shared panel positioning lives outside the transformed header. */
.hh-overlay { position:fixed; inset:0; z-index:101; pointer-events:none; color:var(--hh-ink); }
.hh-backdrop { position:absolute; inset:var(--hh-height) 0 0; pointer-events:auto; background:#1c180f26; animation:hh-fade-in .25s ease both; }
.hh-panel { position:absolute; top:calc(var(--hh-height) + 12px); left:24px; right:24px; margin-inline:auto; display:flex; flex-direction:column; pointer-events:auto; width:calc(100% - 48px); max-width:1180px; max-height:calc(100dvh - var(--hh-height) - 32px); border:1px solid #c6aa793d; border-radius:18px; background:var(--hh-paper); box-shadow:0 24px 70px #27201526,0 3px 12px #2720150a; outline:none; overflow:hidden; animation:hh-panel-in .44s var(--hh-ease) both; }
.hh-panel::before { content:''; position:absolute; left:0; right:0; top:0; height:2px; background:linear-gradient(90deg,#f47822,#d5b775 48%,#f4782220); z-index:1; }
.hh-panel-top { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; flex:0 0 auto; padding:25px 30px 21px; border-bottom:1px solid var(--hh-line); }
.hh-eyebrow { color:#947024; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.15em; line-height:1.5; }
.hh-panel-top h2 { margin-top:7px; color:var(--hh-ink); font-family:'Cormorant Garamond',Georgia,serif; font-size:33px; font-weight:500; letter-spacing:-.025em; line-height:1.13; }
.hh-close { display:grid; place-items:center; width:38px; height:38px; padding:0; flex:0 0 auto; border:1px solid #e0d6c7; border-radius:50%; background:transparent; color:#736650; transition:background .3s,color .3s,transform .35s var(--hh-ease); }
.hh-close:hover { background:#eee4d5; color:#252119; transform:rotate(90deg); }
.hh-close .hh-icon { width:17px; height:17px; }
.hh-panel-body { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:#cbbb9d transparent; }
.hh-panel-search { max-width:920px; }
.hh-panel-account { width:360px; left:auto; right:clamp(24px,4vw,90px); margin:0; }
.hh-panel-account .hh-panel-top h2 { font-size:27px; }
.hh-panel-location { max-width:530px; right:clamp(24px,4vw,90px); left:auto; margin:0; }
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
.hh-choice-row small { display:block; margin-top:4px; color:var(--hh-muted); font-size:12px; }
.hh-choice-row>.hh-icon { width:17px; color:#ae8b45; }
.hh-choice-row:hover,.hh-collection-links a:hover { color:#ba641e; }
.hh-choice-row:hover>.hh-icon { transform:translateX(4px); }
.hh-collection-links { margin-top:15px; }
.hh-collection-links a { display:flex; align-items:center; gap:12px; min-height:49px; border-bottom:1px solid var(--hh-line); font-weight:500; transition:color .3s; }
.hh-collection-links a:last-child { border-bottom:0; }
.hh-index { color:#a3844d; font-size:10px; letter-spacing:.06em; flex:0 0 auto; }
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
.hh-search-bespoke>span { display:flex; align-items:center; gap:13px; margin-top:12px; font-size:12px; color:#806435; }
.hh-search-bespoke>span>.hh-icon { width:16px; }
.hh-search-meta { display:flex; align-items:center; justify-content:space-between; gap:16px; margin:23px 0 12px; }
.hh-search-meta>span:last-child { color:var(--hh-muted); font-size:12px; }
.hh-result-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
.hh-result { display:flex; width:100%; align-items:center; min-width:0; gap:13px; border:0; background:transparent; color:var(--hh-ink); padding:12px 8px; text-align:left; border-radius:7px; transition:background .3s; }
.hh-result:hover { background:#f5ecdd; }.hh-result>.hh-icon { color:#a4864f; width:16px; }
.hh-result-image { display:block; width:65px; height:70px; flex-shrink:0; background:#efe6d9; border-radius:5px; overflow:hidden; }
.hh-result-image img { width:100%; height:100%; display:block; object-fit:cover; transition:transform .6s var(--hh-ease); }.hh-result:hover img { transform:scale(1.05); }
.hh-image-placeholder { display:grid; place-items:center; width:100%; height:100%; color:#aa8a4c; }
.hh-result-copy { display:flex; flex:1; min-width:0; flex-direction:column; gap:3px; }.hh-result-copy small { color:#867b68; font-size:10px; }.hh-result-copy strong { font-size:13px; font-weight:600; line-height:1.5; overflow-wrap:anywhere; }.hh-result-price { color:#9a692f; font-size:12px; font-weight:600; margin-top:3px; }
.hh-view-results { display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:6px; width:calc(100% + 60px); margin:20px -30px 0; padding:16px 24px; border:0; border-top:1px solid var(--hh-line); background:#f6f0e5; color:#5b503c; font-size:13px; }.hh-view-results strong { max-width:50%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.hh-view-results>.hh-icon { width:17px; margin-left:8px; }
.hh-search-empty { padding:28px 12px; display:flex; flex-direction:column; align-items:center; gap:9px; text-align:center; color:#645a49; }.hh-search-empty>.hh-icon { color:#b29a6b; margin-bottom:7px; }.hh-search-empty span { font-size:13px; }
.hh-search-hint { margin-top:13px!important; }
.hh-search-skeleton { display:flex; align-items:center; gap:13px; padding:12px 8px; }.hh-search-skeleton>span { width:65px; height:70px; border-radius:5px; background:#ede3d3; }.hh-search-skeleton>div { flex:1; }.hh-search-skeleton i { display:block; height:9px; width:80%; border-radius:3px; background:#e7dccb; margin-bottom:10px; }.hh-search-skeleton i+i { width:48%; }.hh-search-skeleton { animation:hh-breathe 1.5s ease-in-out infinite alternate; }

/* Location and account. */
.hh-location-content { padding:24px 30px 28px; }
.hh-location-intro { display:flex; align-items:center; gap:17px; padding-bottom:23px; }
.hh-location-emblem { width:62px; height:62px; flex-shrink:0; border-radius:50%; display:grid; place-items:center; color:#a47a31; background:#f0e6d5; border:1px solid #dcc9a7; box-shadow:inset 0 0 0 6px #f9f3e9; }
.hh-location-emblem>.hh-icon { width:26px; height:26px; }
.hh-location-intro p { color:var(--hh-muted); font-size:13px; line-height:1.8; }
.hh-saved-location { display:flex; align-items:center; gap:12px; padding:14px; background:#f0f2e9; border:1px solid #dce2d1; border-radius:7px; margin-bottom:24px; }.hh-saved-location>.hh-icon { color:#5b7555; width:18px; }.hh-saved-location>div { min-width:0; flex:1; }.hh-saved-location small { display:block; color:#53704d; font-size:10px; }.hh-saved-location strong { display:block; font-size:14px; font-weight:600; overflow-wrap:anywhere; margin-top:3px; }.hh-saved-location span { color:#6c7464; font-size:12px; }.hh-saved-location button { border:0; background:transparent; color:#597153; font-size:12px; }
.hh-pincode-form label { display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:10px; }.hh-pincode-form label span { font-weight:400; color:#837869; font-size:11px; }
.hh-pincode-field { display:flex; align-items:center; gap:10px; min-height:58px; border:1px solid #ddd0ba; border-radius:8px; padding:5px 6px 5px 12px; background:white; }.hh-pincode-field:focus-within { border-color:#aa8141; box-shadow:0 0 0 3px #a87b3a0c; }.hh-pincode-field.has-error { border-color:#bb5142; }
.hh-pincode-field>.hh-icon { width:18px; color:#9d814f; }.hh-pincode-field input { width:100%; min-width:0; flex:1; border:0; outline:none; padding:6px 0; background:transparent; color:var(--hh-ink); font-size:17px; font-weight:500; letter-spacing:.05em; }.hh-pincode-field input:focus-visible { outline:none; }.hh-pincode-field input::placeholder { font-size:14px; letter-spacing:0; color:#9a8e7b; }
.hh-primary,.hh-secondary { display:inline-flex; min-height:45px; align-items:center; justify-content:center; gap:12px; padding:11px 18px; border:1px solid #ba853e; border-radius:6px; font-size:13px; font-weight:600; color:#fff!important; background:#a57230; transition:background .3s,transform .35s var(--hh-ease); }
.hh-primary:hover { background:#895a24; }.hh-primary>.hh-icon { width:15px; height:15px; }
.hh-secondary { color:#554a39!important; background:transparent; border-color:#ddd1bd; }.hh-secondary:hover { background:#f0e4d0; }
.hh-or { display:flex; align-items:center; gap:13px; margin-block:21px; color:#9a8b75; font-size:12px; }.hh-or>span { height:1px; background:#e6dac8; flex:1; }
.hh-detect { display:flex; align-items:center; gap:12px; width:100%; min-height:50px; background:#f5ede0; padding:12px 15px; border:1px solid #e5d6bc; border-radius:7px; color:#796037; font-size:13px; font-weight:600; transition:background .3s; }.hh-detect:hover { background:#eddeca; }.hh-detect>span { flex:1; text-align:left; }.hh-detect>.hh-icon:last-child { width:17px; }
.hh-location-note { margin-top:13px!important; font-size:11px; text-align:center; color:#887966; }
.hh-error { margin-top:12px!important; color:#a02b24; font-size:12px; line-height:1.7; }
.hh-account-content { padding:22px 25px; }.hh-account-profile { display:flex; align-items:center; gap:13px; padding-bottom:18px; border-bottom:1px solid var(--hh-line); }.hh-account-profile>span { display:grid; place-items:center; width:46px; height:46px; border-radius:50%; background:#eee1c9; color:#8f682d; font:400 26px Georgia,serif; flex-shrink:0; }.hh-account-profile>div { min-width:0; }.hh-account-profile strong { display:block; overflow-wrap:anywhere; font-weight:600; font-size:15px; }.hh-account-profile small { display:block; overflow-wrap:anywhere; color:#857663; font-size:12px; margin-top:3px; }
.hh-account-links { padding-block:8px 12px; }.hh-account-links a { display:flex; align-items:center; gap:12px; min-height:47px; font-size:13px; border-radius:5px; padding:8px 2px; transition:background .3s; }.hh-account-links a:hover { background:#f5ecdd; }.hh-account-links a>span { flex:1; }.hh-account-links .hh-icon { width:17px; height:17px; color:#937b51; }.hh-account-links a>.hh-icon:last-child { width:14px; }
.hh-auth-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:19px 0 22px; }
.hh-partner-link { display:flex; align-items:center; gap:12px; border:1px solid #e3d3b6; border-radius:7px; padding:13px 12px; background:#f6efdf; }.hh-partner-link>.hh-icon { color:#9c793c; width:19px; height:19px; }.hh-partner-link>.hh-icon:last-child { width:14px; }.hh-partner-link>span { flex:1; }.hh-partner-link strong { display:block; font-size:12px; font-weight:600; }.hh-partner-link small { display:block; color:#837156; font-size:10px; line-height:1.6; margin-top:3px; }.hh-partner-link:hover { background:#efe2c9; }
.hh-admin-link,.hh-logout { display:flex; justify-content:space-between; align-items:center; width:100%; border:0; border-top:1px solid var(--hh-line); padding:14px 3px 0; background:transparent; margin-top:15px; font-size:12px; }.hh-logout { color:#a05e32; }.hh-admin-link>.hh-icon,.hh-logout>.hh-icon { width:16px; height:16px; }

/* Mobile navigation is a scrollable dialog, with all desktop routes retained. */
.hh-menu-content { padding:0 22px 24px; }
.hh-menu-search { display:flex; align-items:center; width:100%; gap:12px; min-height:48px; border:1px solid #e4d7c2; background:#f4ecdf; border-radius:8px; color:#76684f; padding:10px 12px; font-size:13px; margin:20px 0 9px; }.hh-menu-search>span { flex:1; text-align:left; }.hh-menu-search>.hh-icon:last-child { width:16px; }
.hh-mobile-major,.hh-mobile-build>div:first-child { display:flex; align-items:center; gap:15px; min-height:88px; border-bottom:1px solid var(--hh-line); }.hh-mobile-major>span:nth-child(2),.hh-mobile-build>div:first-child>span:nth-child(2) { flex:1; font:400 29px/1.05 'Cormorant Garamond',Georgia,serif; }.hh-mobile-major small,.hh-mobile-build small { display:block; font:400 12px/1.4 'Manrope',Arial,sans-serif; color:var(--hh-muted); margin-top:7px; }.hh-mobile-major .hh-icon,.hh-mobile-build>div:first-child>.hh-icon { color:#ae8b45; width:18px; height:18px; }
.hh-mobile-build>div:first-child { border-bottom:0; }.hh-mobile-order-links { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:0 0 20px 27px; }.hh-mobile-order-links a { display:flex; align-items:center; justify-content:space-between; gap:7px; min-height:42px; padding:8px 0; color:#7b5e32; font-size:12px; border-top:1px solid var(--hh-line); }.hh-mobile-order-links a>.hh-icon { width:14px; height:14px; }
.hh-mobile-private { display:flex; align-items:center; gap:14px; padding:18px; border:1px solid #d8c19a; border-radius:7px; background:linear-gradient(110deg,#f2e7d2,#fbf5e9); margin:0 0 25px; }.hh-mobile-private>span { flex:1; font-family:Georgia,serif; font-size:22px; letter-spacing:.03em; }.hh-mobile-private small { display:block; font-family:'Manrope',Arial,sans-serif; text-transform:uppercase; color:#8c703e; font-size:9px; letter-spacing:.14em; margin-bottom:4px; }.hh-mobile-private em { color:#997127; }.hh-mobile-private>.hh-icon { color:#ad8441; width:19px; height:19px; }.hh-mobile-private>.hh-icon:last-child { width:17px; }
.hh-mobile-collections>div { display:grid; grid-template-columns:1fr 1fr; gap:0 22px; margin-top:10px; }.hh-mobile-collections a { display:flex; align-items:center; justify-content:space-between; min-height:45px; border-bottom:1px solid var(--hh-line); font-size:13px; }.hh-mobile-collections a>.hh-icon { width:14px; height:14px; color:#ae8b45; }
.hh-menu-location { display:flex; align-items:center; gap:13px; width:100%; min-height:72px; border:0; border-block:1px solid #e1d4bc; padding:14px 0; background:transparent; margin-top:23px; color:var(--hh-ink); }.hh-menu-location>span { flex:1; text-align:left; min-width:0; }.hh-menu-location small { display:block; font-size:11px; color:#907c5d; }.hh-menu-location strong { display:block; font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:4px; }.hh-menu-location>.hh-icon { color:#a58041; width:18px; }
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
  .hh-bar { gap:16px; padding-inline:24px; }.hh-wordmark { font-size:22px; }.hh-brand { gap:7px; }.hh-brand-caption { font-size:8px; }.hh-brand-mark { width:46px; height:60px; }.hh-nav { margin-left:0; gap:17px; }.hh-private-link { padding-left:16px; }.hh-tools { gap:3px; }.hh-search-trigger { width:240px; }.hh-search-trigger kbd { display:none; }.hh-location-trigger { width:145px; margin-left:2px; padding-inline:7px; }.hh-tools-divider { margin-inline:3px; }.hh-action { width:40px; }
}
@media (max-width:1179px) {
  .hh-header,.hh-overlay { --hh-height:72px; }
  .hh-bar { padding-inline:22px; gap:10px; }
  .hh-wordmark { font-size:24px; }.hh-brand-mark { width:46px; height:56px; }.hh-brand-caption { font-size:8px; }
  .hh-search-trigger { width:44px; height:44px; justify-content:center; padding:0; border:0; background:transparent; }.hh-search-trigger>span,.hh-search-trigger kbd,.hh-tools-divider { display:none; }.hh-search-trigger>.hh-icon { width:21px; height:21px; color:inherit; }
  .hh-hero .hh-search-trigger { border:0; background:transparent; }.hh-hero .hh-search-trigger>.hh-icon { color:inherit; }
  .hh-tools { gap:5px; }.hh-action { width:44px; height:44px; }.hh-notifications { max-width:46px; }
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
  .hh-bar { padding-inline:14px; gap:8px; }.hh-brand { gap:6px; }.hh-brand-mark { width:38px; height:50px; }.hh-wordmark { font-size:19px; letter-spacing:.04em; }.hh-brand-caption { font-size:7.3px; letter-spacing:0; }.hh-tools { gap:0; }
  .hh-panel-top { padding:22px 20px 18px; gap:12px; }.hh-panel-top h2 { font-size:28px; }.hh-panel-top .hh-eyebrow { font-size:9px; }.hh-panel-location .hh-panel-top h2 { font-size:29px; }
  .hh-close { width:36px; height:36px; }
  .hh-search-panel-content { padding:20px 17px 0; }.hh-search-form { gap:9px; min-height:54px; padding-left:12px; }.hh-search-form input { font-size:16px; }.hh-search-form input::placeholder { font-size:14px; }.hh-search-form>.hh-icon { width:18px; height:18px; }.hh-search-submit { width:36px; height:38px; }
  .hh-search-discover { grid-template-columns:1fr; gap:20px; padding-block:24px; }.hh-search-bespoke { border-left:0; border-top:1px solid var(--hh-line); padding:21px 0 0; }.hh-search-bespoke>.hh-icon { display:none; }.hh-search-bespoke strong { font-size:24px; }.hh-search-bespoke>span { margin-top:8px; }
  .hh-result-grid { grid-template-columns:1fr; gap:0; }.hh-result { padding-inline:0; }.hh-result-copy strong { font-size:14px; }.hh-result-copy small { font-size:11px; }.hh-result-price { font-size:13px; }.hh-search-meta { gap:8px; }.hh-search-meta .hh-eyebrow { font-size:9px; }.hh-view-results { width:calc(100% + 34px); margin-inline:-17px; padding:16px; }.hh-location-content { padding:21px 20px 24px; }.hh-location-intro { gap:13px; }.hh-location-intro p { font-size:12px; }.hh-location-emblem { width:52px; height:52px; }.hh-pincode-field { gap:7px; }.hh-pincode-field .hh-primary { gap:6px; padding-inline:14px; }.hh-primary { min-height:44px; }
}
@media (max-width:389px) {
  .hh-bar { padding-inline:12px; gap:4px; }.hh-wordmark { font-size:17px; }.hh-brand-caption { display:none; }.hh-brand-mark { width:34px; height:46px; }.hh-action,.hh-search-trigger { width:40px; height:44px; }.hh-notifications { max-width:40px; }.hh-notifications>button,.hh-notifications>div>button { max-width:40px; min-width:36px; }.hh-brand { gap:5px; }
  .hh-panel-top h2 { font-size:26px; }.hh-location-intro p br { display:none; }.hh-menu-content { padding-inline:18px; }.hh-mobile-order-links { gap:9px; }.hh-mobile-order-links a { font-size:11px; }.hh-mobile-major>span:nth-child(2),.hh-mobile-build>div:first-child>span:nth-child(2) { font-size:27px; }
}
@media (max-width:349px) {
  .hh-brand-mark { display:none; }.hh-wordmark { font-size:17px; }.hh-bar { padding-inline:12px; }.hh-location-content { padding-inline:16px; }.hh-pincode-field .hh-primary { padding-inline:10px; }.hh-pincode-field>.hh-icon { display:none; }.hh-panel-top { padding-inline:16px; }.hh-mobile-order-links { grid-template-columns:1fr; gap:0; }.hh-mobile-order-links a { font-size:12px; }
}
@media (prefers-reduced-motion:reduce) {
  .hh-header,.hh-header *,.hh-overlay *,.hh-header::after,.hh-overlay *::before,.hh-overlay *::after { animation:none!important; transition:none!important; scroll-behavior:auto!important; }
}

`;
