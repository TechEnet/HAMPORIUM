import { useEffect, useRef, useState } from "react";
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
// HEADER
// ======================================================

const Header = () => {
  const { user, partner, logout } = useAuth();
  const { cart } = useCart();

  const {
    deliveryLocation,
    locationLabel,
    locationLoading,
    locationError,
    resolvePincode,
    detectCurrentLocation,
    clearDeliveryLocation,
    setLocationError,
  } = useDeliveryLocation();

  const location = useLocation();
  const navigate = useNavigate();

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const accountRef = useRef(null);
  const desktopLocationRef = useRef(null);
  const mobileLocationTriggerRef = useRef(null);
  const mobileLocationPanelRef = useRef(null);

  const lastScrollYRef = useRef(0);
  const scrollFrameRef = useRef(0);

  const transparentLogo = useTransparentLogo(logoLight);

  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [homeIntroActive, setHomeIntroActive] = useState(
    location.pathname === "/"
  );

  const isHome = location.pathname === "/";
  const isHamperOne = location.pathname.startsWith("/hamper-one");
  const usesDarkHero = isHome || isHamperOne;
  const darkContent = !usesDarkHero || scrolledPastHero;

  const cartCount = Number(cart?.totalItems || 0);

  const isAdmin = user?.roles?.some((role) =>
    ["admin", "operations"].includes(role)
  );

  const isPartner = user?.roles?.includes("partner");

  const partnerPortalPath =
    partner?.status === "approved"
      ? "/partner"
      : "/partner/status";

  // Header never forces authentication for partner discovery.
  // Everyone first sees the partner information page.
  const becomePartnerPath = "/event-partners";

  const currentPagePath = `${location.pathname}${location.search || ""}`;

  const hamperMenuActive =
    location.pathname === "/gifts" ||
    location.pathname.startsWith("/custom-hamper") ||
    location.pathname.startsWith("/products");

  // ======================================================
  // SCROLL
  // ======================================================

  useEffect(() => {
    const panelsOpen =
      searchOpen ||
      accountOpen ||
      locationOpen ||
      mobileOpen ||
      mobileSearchOpen;

    const updateHeader = () => {
      scrollFrameRef.current = 0;

      const currentY = Math.max(
        0,
        window.scrollY || 0
      );

      const previousY =
        lastScrollYRef.current;

      const delta =
        currentY - previousY;

      setScrolledPastHero(
        currentY > 585
      );

      /*
        Header behavior:
        - always visible near the top
        - scrolling down hides it
        - scrolling up reveals it
        - keep it visible while any header panel/menu is open
        - small scroll noise is ignored to prevent flicker
      */
      if (
        currentY <= 72 ||
        panelsOpen
      ) {
        setHeaderHidden(false);
      } else if (
        Math.abs(delta) >= 6
      ) {
        setHeaderHidden(
          delta > 0
        );
      }

      lastScrollYRef.current =
        currentY;
    };

    const handleScroll = () => {
      if (
        scrollFrameRef.current
      ) {
        return;
      }

      scrollFrameRef.current =
        window.requestAnimationFrame(
          updateHeader
        );
    };

    lastScrollYRef.current =
      Math.max(
        0,
        window.scrollY || 0
      );

    updateHeader();

    window.addEventListener(
      "scroll",
      handleScroll,
      {
        passive: true,
      }
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );

      if (
        scrollFrameRef.current
      ) {
        window.cancelAnimationFrame(
          scrollFrameRef.current
        );

        scrollFrameRef.current = 0;
      }
    };
  }, [
    searchOpen,
    accountOpen,
    locationOpen,
    mobileOpen,
    mobileSearchOpen,
  ]);

  // ======================================================
  // ROUTE CHANGE
  // ======================================================

  useEffect(() => {
    setSearchOpen(false);
    setAccountOpen(false);
    setLocationOpen(false);
    setMobileOpen(false);
    setMobileSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setHeaderHidden(false);
    lastScrollYRef.current =
      Math.max(
        0,
        window.scrollY || 0
      );
  }, [location.pathname, location.search]);

  // ======================================================
  // HOME CINEMATIC INTRO
  // Header is hidden only during the FIRST hero-video playback.
  // After Home announces completion, it stays visible while video loops.
  // ======================================================

  useEffect(() => {
    if (!isHome) {
      setHomeIntroActive(false);
      return undefined;
    }

    setHomeIntroActive(true);

    const handleIntroState = (event) => {
      setHomeIntroActive(
        Boolean(event?.detail?.active)
      );
    };

    window.addEventListener(
      "hamporium:intro-state",
      handleIntroState
    );

    return () => {
      window.removeEventListener(
        "hamporium:intro-state",
        handleIntroState
      );
    };
  }, [isHome]);

  // ======================================================
  // OUTSIDE CLICK
  // ======================================================

  useEffect(() => {
    const handleOutside = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setSearchOpen(false);
      }

      if (
        accountRef.current &&
        !accountRef.current.contains(event.target)
      ) {
        setAccountOpen(false);
      }

      const insideDesktopLocation =
        desktopLocationRef.current?.contains(event.target);

      const insideMobileTrigger =
        mobileLocationTriggerRef.current?.contains(event.target);

      const insideMobilePanel =
        mobileLocationPanelRef.current?.contains(event.target);

      if (
        !insideDesktopLocation &&
        !insideMobileTrigger &&
        !insideMobilePanel
      ) {
        setLocationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
    };
  }, []);

  // ======================================================
  // ESCAPE
  // ======================================================

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;

      setSearchOpen(false);
      setAccountOpen(false);
      setLocationOpen(false);
      setMobileOpen(false);
      setMobileSearchOpen(false);
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // ======================================================
  // LIVE SEARCH
  // ======================================================

  useEffect(() => {
    const query = searchQuery.trim();
    const searchActive = searchOpen || mobileSearchOpen;

    if (!searchActive || query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let active = true;

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);

        const response = await api.get("/catalog/products", {
          params: {
            search: query,
            limit: 6,
          },
        });

        if (active) {
          setSearchResults(response.data.products || []);
        }
      } catch (error) {
        console.error("Header search error:", error);

        if (active) {
          setSearchResults([]);
        }
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, searchOpen, mobileSearchOpen]);

  // ======================================================
  // NOTIFICATION BADGE
  // ======================================================

  useEffect(() => {
    if (!user) {
      setNotificationUnread(0);
      return undefined;
    }

    let active = true;

    const loadUnread = async () => {
      try {
        const response = await api.get(
          "/notifications/mine?page=1&limit=1"
        );

        if (active) {
          setNotificationUnread(
            Number(response.data?.unread || 0)
          );
        }
      } catch {
        if (active) {
          setNotificationUnread(0);
        }
      }
    };

    void loadUnread();

    const timer = window.setInterval(loadUnread, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?._id, user?.id, location.pathname]);

  // ======================================================
  // LOCATION
  // ======================================================

  const toggleLocation = () => {
    setLocationError("");
    setLocationOpen((value) => !value);
    setSearchOpen(false);
    setAccountOpen(false);
    setMobileOpen(false);
    setMobileSearchOpen(false);
  };

  // ======================================================
  // SEARCH SUBMIT
  // ======================================================

  const submitSearch = (event, source = "desktop_header") => {
    event?.preventDefault?.();

    const query = searchQuery.trim();

    if (!query) {
      searchInputRef.current?.focus();
      return;
    }

    void trackSearchAnalytics({
      eventType: "search_submit",
      query,
      source,
      visibleResultCount: searchLoading
        ? null
        : searchResults.length,
      pagePath: currentPagePath,
      location: deliveryLocation,
    });

    setSearchOpen(false);
    setMobileSearchOpen(false);

    navigate(`/gifts?search=${encodeURIComponent(query)}`);
  };

  // ======================================================
  // PRODUCT CLICK
  // ======================================================

  const goToProduct = (product, source = "desktop_header") => {
    if (!product?.slug) return;

    const query = searchQuery.trim();

    if (query) {
      void trackSearchAnalytics({
        eventType: "search_result_click",
        query,
        source,
        visibleResultCount: searchResults.length,
        pagePath: currentPagePath,
        productId: product._id,
        productSlug: product.slug,
        productName: product.name,
        location: deliveryLocation,
      });
    }

    setSearchOpen(false);
    setMobileSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);

    navigate(`/products/${product.slug}`);
  };

  // ======================================================
  // POPULAR SEARCH
  // ======================================================

  const handlePopularSearch = (
    value,
    source = "desktop_header"
  ) => {
    void trackSearchAnalytics({
      eventType: "popular_search_click",
      query: value,
      source,
      pagePath: currentPagePath,
      location: deliveryLocation,
    });

    setSearchQuery(value);

    if (source === "mobile_header") {
      setMobileSearchOpen(true);
    } else {
      setSearchOpen(true);
    }

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // ======================================================
  // LOGOUT
  // ======================================================

  const handleLogout = async () => {
    await logout();
    setAccountOpen(false);
    navigate("/");
  };

  if (isHome && homeIntroActive) {
    return null;
  }

  return (
    <header
      className={`
        fixed inset-x-0 top-0 z-[100] w-full border-b bg-transparent
        transform-gpu will-change-transform
        transition-[transform,background-color,border-color,box-shadow]
        duration-500 ease-[cubic-bezier(.16,1,.3,1)]
        ${
          headerHidden
            ? "pointer-events-none -translate-y-[110%]"
            : "translate-y-0"
        }
        ${
          darkContent
            ? "border-black/[0.06] bg-white/95 shadow-[0_10px_35px_rgba(0,0,0,.07)] backdrop-blur-[14px]"
            : "border-transparent"
        }
      `}
    >

      {/* ==================================================
          DESKTOP
      =================================================== */}

      <div className="mx-auto hidden h-[82px] w-full max-w-[1640px] items-center px-5 min-[1180px]:flex xl:h-[84px] xl:px-8 2xl:px-10">
        <Link
          to="/"
          aria-label="HAMPORIUM Home"
          className="flex shrink-0 items-center"
        >
          <img
            src={transparentLogo}
            alt="HAMPORIUM"
            className="h-[58px] w-[138px] object-contain object-left drop-shadow-[0_2px_7px_rgba(0,0,0,0.22)] transition duration-300 hover:scale-[1.025] xl:h-[62px] xl:w-[148px] 2xl:w-[160px]"
          />
        </Link>

        <div className="min-w-[30px] flex-1" />

        <div className="flex shrink-0 items-center gap-1">
          {/* SEARCH */}

          <div
            ref={searchRef}
            className="relative w-[220px] shrink-0 xl:w-[270px] 2xl:w-[300px]"
          >
            <form
              onSubmit={(event) =>
                submitSearch(event, "desktop_header")
              }
              className={`
                relative flex h-[48px] w-full items-center overflow-hidden
                rounded-full border transition-all duration-300
                ${
                  searchOpen
                    ? darkContent
                      ? "border-[#F97316] bg-white shadow-[0_10px_35px_rgba(0,0,0,.12)]"
                      : "border-[#F97316]/80 bg-black/45 shadow-[0_12px_35px_rgba(0,0,0,.25)] backdrop-blur-xl"
                    : darkContent
                      ? "border-black/10 bg-white shadow-[0_5px_20px_rgba(0,0,0,.06)] hover:border-black/20"
                      : "border-white/20 bg-black/20 backdrop-blur-lg hover:border-white/35 hover:bg-black/30"
                }
              `}
            >
              <button
                type="submit"
                aria-label="Search"
                className="flex h-full w-11 shrink-0 items-center justify-center text-[#F97316]"
              >
                <SearchIcon />
              </button>

              <input
                ref={searchInputRef}
                value={searchQuery}
                onFocus={() => {
                  setSearchOpen(true);
                  setAccountOpen(false);
                  setLocationOpen(false);
                }}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
                type="search"
                autoComplete="off"
                placeholder="Search hampers..."
                className={`
                  h-full min-w-0 flex-1 bg-transparent pr-3 text-[13px]
                  font-semibold outline-none
                  ${
                    darkContent
                      ? "text-[#171717] placeholder:text-black/35"
                      : "text-white placeholder:text-white/45"
                  }
                `}
              />

              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    searchInputRef.current?.focus();
                  }}
                  className={`
                    mr-2 flex h-8 w-8 shrink-0 items-center justify-center
                    rounded-full transition
                    ${
                      darkContent
                        ? "text-black/35 hover:bg-black/[0.05] hover:text-black"
                        : "text-white/50 hover:bg-white/10 hover:text-white"
                    }
                  `}
                >
                  <CloseIcon small />
                </button>
              )}
            </form>

            {searchOpen && (
              <SearchDropdown
                query={searchQuery}
                loading={searchLoading}
                results={searchResults}
                source="desktop_header"
                goToProduct={goToProduct}
                submitSearch={submitSearch}
                onPopular={handlePopularSearch}
              />
            )}
          </div>

          {/* NAVIGATION */}

          <nav className="ml-2 flex h-[84px] shrink-0 items-center xl:ml-3">
            <DropdownNavItem
              label="HAMPERS"
              to="/gifts"
              items={HAMPER_DROPDOWN}
              active={hamperMenuActive}
              darkContent={darkContent}
            />

            <HeaderTextLink
              to="/hamper-one"
              label="HAMPER ONE"
              active={isHamperOne}
              darkContent={darkContent}
              premium
            />
          </nav>

          {/* LOCATION */}

          <div
            ref={desktopLocationRef}
            className="relative ml-2 shrink-0 xl:ml-3"
          >
            <button
              type="button"
              onClick={toggleLocation}
              aria-label="Select delivery location"
              className={`
                flex h-[48px] w-[145px] items-center gap-2 rounded-full
                border px-3 text-left transition-all duration-300 xl:w-[160px]
                2xl:w-[170px]
                ${
                  locationOpen
                    ? "border-[#F97316] bg-white shadow-[0_8px_25px_rgba(0,0,0,.10)]"
                    : darkContent
                      ? "border-black/10 bg-white shadow-[0_5px_20px_rgba(0,0,0,.05)] hover:border-[#F97316]/50"
                      : "border-white/20 bg-black/20 backdrop-blur-lg hover:border-[#F97316]/60 hover:bg-black/30"
                }
              `}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF1E8] text-[#F97316]">
                <LocationIcon />
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[9px] font-black uppercase tracking-[0.12em] ${
                    locationOpen || darkContent
                      ? "text-black/35"
                      : "text-white/55"
                  }`}
                >
                  Deliver to
                </span>

                <span
                  className={`mt-0.5 block truncate text-[11px] font-extrabold ${
                    locationOpen || darkContent
                      ? "text-[#171717]"
                      : "text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.8)]"
                  }`}
                >
                  {deliveryLocation
                    ? locationLabel
                    : "Select location"}
                </span>
              </span>

              <span
                className={`shrink-0 ${
                  locationOpen || darkContent
                    ? "text-black/30"
                    : "text-white/50"
                }`}
              >
                <ChevronDownIcon />
              </span>
            </button>

            {locationOpen && (
              <LocationPanel
                location={deliveryLocation}
                loading={locationLoading}
                error={locationError}
                resolvePincode={resolvePincode}
                detectCurrentLocation={detectCurrentLocation}
                clearLocation={clearDeliveryLocation}
                onComplete={() => setLocationOpen(false)}
              />
            )}
          </div>

          <div
            className={`mx-2 h-8 w-px shrink-0 ${
              darkContent
                ? "bg-black/10"
                : "bg-white/15"
            }`}
          />

          {/* ACCOUNT */}

          <div ref={accountRef} className="relative shrink-0">
            <HeaderIconButton
              darkContent={darkContent}
              label="Account"
              active={accountOpen}
              onClick={() => {
                setAccountOpen((value) => !value);
                setSearchOpen(false);
                setLocationOpen(false);
              }}
            >
              <AccountIcon />
            </HeaderIconButton>

            {accountOpen && (
              <AccountPanel
                user={user}
                isAdmin={isAdmin}
                isPartner={isPartner}
                partnerPortalPath={partnerPortalPath}
                becomePartnerPath={becomePartnerPath}
                handleLogout={handleLogout}
              />
            )}
          </div>

          {/* NOTIFICATIONS */}

          {user && (
            <HeaderNotifications
              darkContent={darkContent}
              unread={notificationUnread}
              onUnreadChange={setNotificationUnread}
            />
          )}

          {/* CART */}

          <Link
            to="/cart"
            aria-label="Cart"
            className={`
              relative flex h-11 w-11 shrink-0 items-center justify-center
              rounded-full transition duration-300
              ${
                darkContent
                  ? "text-[#171717] hover:bg-black/[0.05] hover:text-[#F97316]"
                  : "text-white drop-shadow-[0_2px_4px_rgba(0,0,0,.65)] hover:bg-white/10 hover:text-[#F97316]"
              }
            `}
          >
            <CartIcon />

            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#F97316] px-1 text-[9px] font-black leading-none text-white ring-2 ring-white">
                {cartCount > 99
                  ? "99+"
                  : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* ==================================================
          MOBILE / TABLET
      =================================================== */}

      <div className="min-[1180px]:hidden">
        <div className="flex h-[68px] items-center justify-between gap-2 px-3 min-[390px]:h-[72px] min-[390px]:px-4 sm:px-5 md:px-6">
          <Link
            to="/"
            aria-label="HAMPORIUM Home"
            className="block shrink-0"
          >
            <img
              src={transparentLogo}
              alt="HAMPORIUM"
              className="h-[42px] w-[104px] object-contain object-left min-[360px]:w-[112px] min-[420px]:h-[46px] min-[420px]:w-[124px] sm:w-[132px]"
            />
          </Link>

          <div className="flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1">
            <HeaderIconButton
              compact
              darkContent={darkContent}
              active={mobileSearchOpen}
              label="Search"
              onClick={() => {
                setMobileSearchOpen((value) => !value);
                setMobileOpen(false);
                setAccountOpen(false);
                setLocationOpen(false);

                setTimeout(() => {
                  searchInputRef.current?.focus();
                }, 80);
              }}
            >
              <SearchIcon />
            </HeaderIconButton>

            <div
              ref={mobileLocationTriggerRef}
              className="hidden min-[420px]:block"
            >
              <HeaderIconButton
                compact
                darkContent={darkContent}
                active={locationOpen}
                label="Location"
                onClick={toggleLocation}
              >
                <LocationIcon />
              </HeaderIconButton>
            </div>

            {user && (
              <HeaderNotifications
                mobile
                darkContent={darkContent}
                unread={notificationUnread}
                onUnreadChange={setNotificationUnread}
              />
            )}

            <Link
              to="/cart"
              aria-label="Cart"
              className={`relative flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10 ${
                darkContent
                  ? "text-[#171717]"
                  : "text-white"
              }`}
            >
              <CartIcon />

              {cartCount > 0 && (
                <span className="absolute right-0 top-0 flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#F97316] px-1 text-[8px] font-black text-white">
                  {cartCount > 99
                    ? "99+"
                    : cartCount}
                </span>
              )}
            </Link>

            <HeaderIconButton
              compact
              darkContent={darkContent}
              active={mobileOpen}
              label="Menu"
              onClick={() => {
                setMobileOpen((value) => !value);
                setMobileSearchOpen(false);
                setAccountOpen(false);
                setLocationOpen(false);
              }}
            >
              {mobileOpen
                ? <CloseIcon />
                : <MenuIcon />}
            </HeaderIconButton>
          </div>
        </div>

        {/* MOBILE SEARCH */}

        {mobileSearchOpen && (
          <div
            ref={searchRef}
            className="border-t border-black/[0.06] bg-[#FBF8F3] px-4 pb-5 pt-3 shadow-xl sm:px-6"
          >
            <form
              onSubmit={(event) =>
                submitSearch(event, "mobile_header")
              }
              className="flex h-[50px] items-center rounded-full border border-black/10 bg-[#FFF9F2]"
            >
              <button
                type="submit"
                className="flex h-full w-12 items-center justify-center text-[#F97316]"
              >
                <SearchIcon />
              </button>

              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search gifts, hampers..."
                className="min-w-0 flex-1 bg-transparent pr-4 text-[13px] font-semibold text-[#171717] outline-none placeholder:text-black/35"
              />
            </form>

            <div className="mt-3">
              <SearchDropdown
                mobile
                query={searchQuery}
                loading={searchLoading}
                results={searchResults}
                source="mobile_header"
                goToProduct={goToProduct}
                submitSearch={submitSearch}
                onPopular={handlePopularSearch}
              />
            </div>
          </div>
        )}

        {/* MOBILE LOCATION */}

        {locationOpen && (
          <div
            ref={mobileLocationPanelRef}
            className="border-t border-black/[0.06] bg-white px-3 pb-4 pt-3 shadow-xl min-[390px]:px-4 sm:px-6"
          >
            <LocationPanel
              mobile
              location={deliveryLocation}
              loading={locationLoading}
              error={locationError}
              resolvePincode={resolvePincode}
              detectCurrentLocation={detectCurrentLocation}
              clearLocation={clearDeliveryLocation}
              onComplete={() => setLocationOpen(false)}
            />
          </div>
        )}

        {/* MOBILE MENU */}

        {mobileOpen && (
          <div className="max-h-[calc(100dvh-68px)] overflow-y-auto overscroll-contain border-t border-black/[0.06] bg-white px-4 pb-8 pt-4 shadow-2xl min-[390px]:max-h-[calc(100dvh-72px)] sm:px-5">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setLocationOpen(true);
                setSearchOpen(false);
                setMobileSearchOpen(false);
                setAccountOpen(false);
              }}
              className="mb-4 flex w-full items-center justify-between border-y border-black/[0.07] bg-[#FBF8F3] px-1 py-4 text-left min-[420px]:hidden"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF1E8] text-[#F97316]">
                  <LocationIcon />
                </span>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-black/35">
                    Deliver to
                  </p>

                  <p className="mt-0.5 truncate text-[11px] font-extrabold text-[#171717]">
                    {deliveryLocation
                      ? locationLabel
                      : "Select location"}
                  </p>
                </div>
              </div>

              <span className="shrink-0 text-[#F97316]">
                →
              </span>
            </button>

            <MobileMenuGroup
              title="HAMPERS"
              subtitle="Shop ready-made or create your own"
              items={HAMPER_DROPDOWN}
            />

            <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-black/[0.08] pt-5">
              {user ? (
                <>
                  <Link
                    to="/account"
                    className="border border-black/10 px-4 py-3.5 text-center text-[12px] font-bold"
                  >
                    My Account
                  </Link>

                  {isPartner ? (
                    <Link
                      to={partnerPortalPath}
                      className="border border-[#D4AF37]/40 bg-[#FFF9F2] px-4 py-3 text-center text-[11px] font-bold text-[#9A7414]"
                    >
                      Partner Portal
                    </Link>
                  ) : (
                    <Link
                      to={becomePartnerPath}
                      className="border border-[#D4AF37]/40 bg-[#FFF9F2] px-4 py-3 text-center text-[11px] font-bold text-[#9A7414]"
                    >
                      Become a Partner
                    </Link>
                  )}

                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="border border-[#D4AF37]/40 bg-[#FFF9F2] px-4 py-3 text-center text-[11px] font-bold"
                    >
                      Admin
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="col-span-2 bg-[#171717] px-4 py-3 text-[11px] font-bold text-white"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="border border-black/10 px-4 py-3.5 text-center text-[12px] font-bold"
                  >
                    Login
                  </Link>

                  <Link
                    to="/signup"
                    className="bg-[#F47822] px-4 py-3.5 text-center text-[12px] font-bold text-white"
                  >
                    Sign Up
                  </Link>

                  <Link
                    to={becomePartnerPath}
                    className="col-span-2 border border-[#D4AF37]/40 bg-[#FFF9F2] px-4 py-3 text-center text-[11px] font-black text-[#9A7414] transition hover:bg-[#FFF4DE]"
                  >
                    Become a Partner
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

// ======================================================
// DESKTOP DROPDOWN NAV
// ======================================================

const DropdownNavItem = ({
  label,
  to,
  items,
  active,
  darkContent,
}) => {
  const allHampers =
    items.find(
      (item) =>
        !item.special &&
        item.to === "/gifts"
    );

  const builder =
    items.find(
      (item) =>
        item.special
    );

  const personalOrder =
    builder?.options?.find(
      (option) =>
        option.to ===
        "/custom-hamper"
    );

  const bulkOrder =
    builder?.options?.find(
      (option) =>
        option.to?.includes(
          "mode=bulk"
        )
    );

  const collections =
    items.filter(
      (item) =>
        !item.special &&
        item.to !== "/gifts"
    );

  const primaryActions = [
    allHampers && {
      index: "01",
      kicker: "Ready-made",
      label: "Shop Hampers",
      description:
        "Curated gifting, ready to send.",
      to: allHampers.to,
    },
    personalOrder && {
      index: "02",
      kicker: "Personal",
      label: "Build Your Own",
      description:
        "Choose every detail yourself.",
      to: personalOrder.to,
    },
    bulkOrder && {
      index: "03",
      kicker: "At scale",
      label: "Bulk & Events",
      description:
        "For teams, weddings and events.",
      to: bulkOrder.to,
    },
  ].filter(Boolean);

  return (
    <div className="group relative flex h-full items-center">
      <Link
        to={to}
        className={`
          flex h-full items-center gap-1.5 whitespace-nowrap px-3
          text-[11px] font-black tracking-[0.07em] transition
          xl:px-4 xl:text-[12px]
          ${
            active
              ? "text-[#F47822]"
              : darkContent
                ? "text-[#171717] hover:text-[#F47822]"
                : "text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.85)] hover:text-[#F47822]"
          }
        `}
      >
        {label}
        <ChevronSmall />
      </Link>

      {/* COMPACT EDITORIAL HAMPERS MENU */}
      <div
        className="
          pointer-events-none absolute left-1/2 top-[74px] z-[125]
          w-[790px] -translate-x-1/2 translate-y-3
          overflow-hidden rounded-[24px] border border-black/[0.08]
          bg-[#FCFAF7]/[0.99] opacity-0
          shadow-[0_28px_80px_rgba(0,0,0,.16)]
          backdrop-blur-xl transition duration-200
          group-hover:pointer-events-auto
          group-hover:translate-y-0
          group-hover:opacity-100
        "
      >
        <div className="h-[3px] w-full bg-gradient-to-r from-[#F47822] via-[#D4AF37] to-[#F47822]" />

        <div className="px-7 pb-6 pt-6">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F47822]">
                HAMPERS
              </p>

              <h3 className="mt-1.5 text-[25px] font-black tracking-[-0.035em] text-[#171717]">
                How would you like to gift?
              </h3>
            </div>

            <Link
              to="/gifts"
              className="shrink-0 pb-1 text-[11px] font-black text-[#F47822] transition hover:text-[#171717]"
            >
              View all →
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-3 border-y border-black/[0.08]">
            {primaryActions.map(
              (
                item,
                index
              ) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`group/path relative min-h-[168px] overflow-hidden py-5 ${
                    index > 0
                      ? "border-l border-black/[0.08] pl-6 pr-4"
                      : "pr-6"
                  }`}
                >
                  <span
                    className="
                      pointer-events-none absolute -right-1 top-0
                      text-[82px] font-black leading-none tracking-[-0.08em]
                      text-black/[0.035] transition duration-300
                      group-hover/path:text-[#F47822]/[0.075]
                    "
                  >
                    {item.index}
                  </span>

                  <div className="relative z-10">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#A57A15]">
                      {item.kicker}
                    </p>

                    <div className="mt-3 flex items-start justify-between gap-3">
                      <h4 className="text-[19px] font-black tracking-[-0.025em] text-[#171717] transition group-hover/path:text-[#F47822]">
                        {item.label}
                      </h4>

                      <span className="mt-0.5 shrink-0 text-[18px] text-[#D4AF37] transition group-hover/path:translate-x-1 group-hover/path:text-[#F47822]">
                        →
                      </span>
                    </div>

                    <p className="mt-2 max-w-[190px] text-[11px] font-medium leading-5 text-black/42">
                      {item.description}
                    </p>

                    <span className="mt-5 block h-[2px] w-8 bg-[#D4AF37]/65 transition-all duration-300 group-hover/path:w-14 group-hover/path:bg-[#F47822]" />
                  </div>
                </Link>
              )
            )}
          </div>

          {collections.length > 0 && (
            <div className="mt-5 flex items-start gap-5">
              <p className="shrink-0 pt-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-black/28">
                Collections
              </p>

              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {collections.map(
                  (entry) => (
                    <Link
                      key={entry.label}
                      to={entry.to}
                      className="group/collection relative text-[11px] font-bold text-black/52 transition hover:text-[#171717]"
                    >
                      {entry.label}

                      <span className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-[#F47822] transition-transform duration-200 group-hover/collection:scale-x-100" />
                    </Link>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ======================================================
// HAMPER ONE
// ======================================================

const HeaderTextLink = ({
  to,
  label,
  active,
  darkContent,
  premium = false,
}) => (
  <Link
    to={to}
    className={`
      flex h-full items-center whitespace-nowrap px-3 text-[10px]
      font-extrabold tracking-[0.055em] transition xl:px-3.5 xl:text-[11px]
      ${
        premium
          ? active
            ? "text-[#D4AF37]"
            : darkContent
              ? "text-[#9A7414] hover:text-[#D4AF37]"
              : "text-[#D4AF37] drop-shadow-[0_1px_4px_rgba(0,0,0,.85)] hover:text-[#F2DC94]"
          : active
            ? "text-[#F97316]"
            : darkContent
              ? "text-[#171717] hover:text-[#F97316]"
              : "text-white hover:text-[#F97316]"
      }
    `}
  >
    {label}
  </Link>
);

// ======================================================
// MOBILE PRIMARY
// ======================================================

const MobilePrimaryLink = ({
  to,
  title,
  subtitle,
  premium = false,
}) => (
  <Link
    to={to}
    className={`
      flex items-center justify-between rounded-[18px] border px-4 py-4
      ${
        premium
          ? "border-[#D4AF37]/40 bg-[#111111] text-white"
          : "border-[#F97316]/20 bg-[#FFF9F2] text-[#171717]"
      }
    `}
  >
    <div>
      <p
        className={`text-[12px] font-black ${
          premium
            ? "text-[#D4AF37]"
            : ""
        }`}
      >
        {title}
      </p>

      <p
        className={`mt-1 text-[9px] ${
          premium
            ? "text-white/45"
            : "text-black/40"
        }`}
      >
        {subtitle}
      </p>
    </div>

    <span
      className={
        premium
          ? "text-[#D4AF37]"
          : "text-[#F97316]"
      }
    >
      →
    </span>
  </Link>
);

// ======================================================
// LOCATION PANEL
// ======================================================

const LocationPanel = ({
  mobile = false,
  location,
  loading,
  error,
  resolvePincode,
  detectCurrentLocation,
  clearLocation,
  onComplete,
}) => {
  const [pincode, setPincode] =
    useState(
      location?.pincode || ""
    );

  const [localError, setLocalError] =
    useState("");

  useEffect(() => {
    setPincode(
      location?.pincode || ""
    );
  }, [location?.pincode]);

  const submitPincode =
    async (event) => {
      event.preventDefault();
      setLocalError("");

      try {
        await resolvePincode(
          pincode
        );

        onComplete?.();
      } catch (requestError) {
        setLocalError(
          requestError.message ||
            "Unable to verify this location."
        );
      }
    };

  const handleCurrentLocation =
    async () => {
      setLocalError("");

      try {
        await detectCurrentLocation();
        onComplete?.();
      } catch (requestError) {
        setLocalError(
          requestError.message ||
            "Unable to detect your location."
        );
      }
    };

  const displayError =
    localError || error;

  const currentPlace = [
    location?.city ||
      location?.district,
    location?.state,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={
        mobile
          ? "w-full bg-[#FBF8F3]"
          : "fixed inset-x-0 top-[82px] z-[130] border-y border-black/[0.07] bg-[#FBF8F3]/[0.985] shadow-[0_22px_60px_rgba(0,0,0,.12)] backdrop-blur-xl xl:top-[84px]"
      }
    >
      <div className="h-[2px] w-full bg-gradient-to-r from-[#F47822] via-[#D4AF37] to-[#F47822]" />

      <div
        className={
          mobile
            ? "px-1 py-1"
            : "mx-auto grid w-full max-w-[1560px] grid-cols-[0.95fr_1.25fr] px-8 2xl:px-10"
        }
      >
        {/* LEFT / CONTEXT */}
        <div
          className={
            mobile
              ? "border-b border-black/[0.07] px-1 pb-5 pt-3"
              : "border-r border-black/[0.07] py-7 pr-10"
          }
        >
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center text-[#F47822]">
              <LocationIcon />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F47822]">
                Delivery
              </p>

              <h3 className="mt-2 text-[22px] font-black tracking-[-0.025em] text-[#171717] sm:text-[24px]">
                Choose Delivery Location
              </h3>

              <p className="mt-2 max-w-[420px] text-[12px] font-medium leading-5 text-black/45 sm:text-[13px]">
                Check product availability and estimated delivery for your area.
              </p>

              {location && (
                <div className="mt-5 flex items-center gap-3 border-t border-black/[0.07] pt-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircleIcon />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                      Delivering to
                    </p>

                    <p className="mt-1 truncate text-[15px] font-black text-[#171717]">
                      {currentPlace ||
                        "India"}
                    </p>

                    <p className="mt-0.5 text-[11px] font-medium text-black/42">
                      Pincode{" "}
                      {location.pincode}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      clearLocation();
                      setPincode("");
                    }}
                    className="text-[10px] font-black uppercase tracking-[0.08em] text-black/35 transition hover:text-[#F47822]"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT / ACTIONS */}
        <div
          className={
            mobile
              ? "px-1 pb-2 pt-5"
              : "py-7 pl-10"
          }
        >
          <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
            {/* PINCODE LINE */}
            <form
              onSubmit={
                submitPincode
              }
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/38">
                  Enter Pincode
                </p>

                <span className="text-[9px] font-semibold text-black/28">
                  6 digits
                </span>
              </div>

              <div className="mt-3 flex min-h-[56px] items-center border-b-2 border-black/[0.12] transition focus-within:border-[#F47822]">
                <span className="flex w-10 shrink-0 items-center justify-center text-black/28">
                  <PinIcon />
                </span>

                <input
                  value={pincode}
                  onChange={(
                    event
                  ) => {
                    setPincode(
                      normalizePincode(
                        event.target.value
                      )
                    );

                    setLocalError("");
                  }}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  placeholder="Enter 6-digit pincode"
                  className="min-w-0 flex-1 bg-transparent py-3 text-[18px] font-black tracking-[0.05em] text-[#171717] outline-none placeholder:text-[13px] placeholder:font-semibold placeholder:tracking-normal placeholder:text-black/28"
                />

                <button
                  type="submit"
                  disabled={
                    loading ||
                    pincode.length !== 6
                  }
                  className="group flex h-11 min-w-[92px] items-center justify-center gap-2 bg-[#171717] px-4 text-[10px] font-black uppercase tracking-[0.09em] text-white transition hover:bg-[#F47822] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {loading
                    ? "Checking"
                    : "Apply"}

                  {!loading && (
                    <span className="transition group-hover:translate-x-0.5">
                      →
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* CURRENT LOCATION LINK */}
            <div className="lg:border-l lg:border-black/[0.07] lg:pl-7">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/38">
                Or detect automatically
              </p>

              <button
                type="button"
                disabled={loading}
                onClick={
                  handleCurrentLocation
                }
                className="group mt-3 flex w-full items-center justify-between gap-4 border-b border-black/[0.12] pb-3 text-left transition hover:border-[#F47822] disabled:opacity-45"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[#F47822]">
                    {loading
                      ? <SpinnerIcon />
                      : <LocateIcon />}
                  </span>

                  <span className="text-[14px] font-black text-[#171717] transition group-hover:text-[#F47822]">
                    {loading
                      ? "Detecting location..."
                      : "Use my current location"}
                  </span>
                </div>

                {!loading && (
                  <span className="text-[#D4AF37] transition group-hover:translate-x-1 group-hover:text-[#F47822]">
                    →
                  </span>
                )}
              </button>
            </div>
          </div>

          {displayError && (
            <div className="mt-4 border-l-[3px] border-red-500 pl-3">
              <p className="text-[10px] font-semibold leading-5 text-red-700">
                {displayError}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ======================================================
// SEARCH DROPDOWN
// ======================================================

const SearchDropdown = ({
  mobile = false,
  query,
  loading,
  results,
  source,
  goToProduct,
  submitSearch,
  onPopular,
}) => (
  <div
    className={
      mobile
        ? "overflow-hidden border border-black/10 bg-white"
        : "absolute left-0 right-0 top-[calc(100%+10px)] z-[120] overflow-hidden border border-black/10 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.16)]"
    }
  >
    {!query.trim() ? (
      <div className="p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">
          Popular Searches
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {POPULAR_SEARCHES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onPopular(item, source)}
              className="border border-black/10 bg-[#FFF9F2] px-4 py-2 text-[11px] font-bold transition hover:border-[#F97316] hover:text-[#F97316]"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    ) : (
      <div className="max-h-[380px] overflow-y-auto p-2">
        {loading ? (
          <SearchSkeleton />
        ) : results.length ? (
          results.map((product) => (
            <SearchResult
              key={product._id}
              product={product}
              onClick={() =>
                goToProduct(product, source)
              }
            />
          ))
        ) : (
          <button
            type="button"
            onClick={(event) =>
              submitSearch(event, source)
            }
            className="flex w-full items-center justify-between px-4 py-4 text-left transition hover:bg-[#FFF9F2]"
          >
            <div>
              <p className="text-[12px] font-black">
                Search all hampers
              </p>

              <p className="mt-1 text-[10px] text-black/40">
                "{query}"
              </p>
            </div>

            <span className="text-[#F97316]">→</span>
          </button>
        )}
      </div>
    )}
  </div>
);

// ======================================================
// SEARCH RESULT
// ======================================================

const SearchResult = ({ product, onClick }) => {
  const image = getProductImage(product);

  const productPrice =
    product?.minPrice ??
    product?.price ??
    product?.sellingPrice ??
    product?.salePrice;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 p-2.5 text-left transition hover:bg-[#FFF9F2]"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-[#FFF9F2]">
        {image ? (
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <GiftIcon />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-black">
          {product.name}
        </p>

        <p className="mt-1 truncate text-[9px] text-black/40">
          {product.category?.name || "HAMPORIUM"}
        </p>
      </div>

      {productPrice != null && (
        <p className="shrink-0 text-[11px] font-black text-[#F97316]">
          ₹{Number(productPrice).toLocaleString("en-IN")}
        </p>
      )}
    </button>
  );
};

// ======================================================
// SEARCH SKELETON
// ======================================================

const SearchSkeleton = () => (
  <div className="space-y-2 p-2">
    {[1, 2, 3].map((item) => (
      <div
        key={item}
        className="flex items-center gap-3 p-2"
      >
        <div className="h-12 w-12 animate-pulse bg-black/5" />

        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-1/2 animate-pulse bg-black/10" />
          <div className="h-2 w-1/3 animate-pulse bg-black/5" />
        </div>
      </div>
    ))}
  </div>
);

// ======================================================
// ACCOUNT PANEL
// ======================================================

const AccountPanel = ({
  user,
  isAdmin,
  isPartner,
  partnerPortalPath,
  becomePartnerPath,
  handleLogout,
}) => (
  <div className="absolute right-0 top-[calc(100%+14px)] w-[285px] overflow-hidden border border-black/10 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
    {!user ? (
      <div className="p-5">
        <p className="text-[14px] font-black">
          Welcome to HAMPORIUM
        </p>

        <p className="mt-2 text-[11px] leading-5 text-black/45">
          Login to manage orders and your account.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to="/login"
            className="border border-black/10 px-3 py-3 text-center text-[11px] font-bold transition hover:bg-[#FFF9F2]"
          >
            Login
          </Link>

          <Link
            to="/signup"
            className="bg-[#F97316] px-3 py-3 text-center text-[11px] font-bold text-white transition hover:bg-[#e86613]"
          >
            Sign Up
          </Link>
        </div>

        <div className="mt-4 border-t border-black/[0.07] pt-4">
          <Link
            to={becomePartnerPath}
            className="group flex w-full items-center justify-between border border-[#D4AF37]/35 bg-[#FFF9F2] px-4 py-3.5 transition hover:border-[#D4AF37] hover:bg-[#FFF4DE]"
          >
            <div>
              <p className="text-[11px] font-black text-[#9A7414]">
                Become a Partner
              </p>

              <p className="mt-1 text-[8px] font-medium text-black/35">
                Learn about the HAMPORIUM partner program
              </p>
            </div>

            <span className="text-[#D4AF37] transition group-hover:translate-x-1">
              →
            </span>
          </Link>

          <p className="mt-2 px-1 text-[9px] leading-4 text-black/35">
            See how partnership works before you register or log in.
          </p>
        </div>
      </div>
    ) : (
      <>
        <div className="border-b border-black/[0.07] bg-[#FFF9F2] p-4">
          <p className="truncate text-[13px] font-black">
            {user?.name || "My Account"}
          </p>

          {user?.email && (
            <p className="mt-1 truncate text-[10px] text-black/40">
              {user.email}
            </p>
          )}
        </div>

        <div className="p-2">
          <AccountLink to="/account" label="My Account" />
          <AccountLink to="/account/orders" label="My Orders" />
          <AccountLink to="/account/addresses" label="Saved Addresses" />
          <AccountLink to="/account/refunds" label="Refunds" />

          <div className="my-1 border-t border-black/[0.07]" />

          {isPartner ? (
            <AccountLink
              to={partnerPortalPath}
              label="Partner Portal"
              gold
            />
          ) : (
            <AccountLink
              to={becomePartnerPath}
              label="Become a Partner"
              gold
            />
          )}

          {isAdmin && (
            <AccountLink
              to="/admin"
              label="Admin Dashboard"
              gold
            />
          )}

          <div className="my-1 border-t border-black/[0.07]" />

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-between px-3 py-3 text-[11px] font-bold text-[#F97316] transition hover:bg-[#FFF7F0]"
          >
            Logout
            <span>→</span>
          </button>
        </div>
      </>
    )}
  </div>
);

const AccountLink = ({
  to,
  label,
  gold = false,
}) => (
  <Link
    to={to}
    className={`
      flex items-center justify-between px-3 py-3 text-[11px]
      font-bold transition
      ${
        gold
          ? "bg-[#D4AF37]/10 text-[#8B6813] hover:bg-[#D4AF37]/15"
          : "hover:bg-[#FFF9F2]"
      }
    `}
  >
    {label}

    <span
      className={
        gold
          ? "text-[#D4AF37]"
          : "text-black/20"
      }
    >
      →
    </span>
  </Link>
);

// ======================================================
// MOBILE GROUP
// ======================================================

const MobileMenuGroup = ({
  title,
  subtitle,
  items,
}) => {
  const allHampers =
    items.find(
      (item) =>
        !item.special &&
        item.to === "/gifts"
    );

  const builder =
    items.find(
      (item) =>
        item.special
    );

  const personalOrder =
    builder?.options?.find(
      (option) =>
        option.to ===
        "/custom-hamper"
    );

  const bulkOrder =
    builder?.options?.find(
      (option) =>
        option.to?.includes(
          "mode=bulk"
        )
    );

  const collections =
    items.filter(
      (item) =>
        !item.special &&
        item.to !== "/gifts"
    );

  const actions = [
    allHampers && {
      index: "01",
      label: "Shop Hampers",
      description:
        "Ready-to-gift collections.",
      to: allHampers.to,
    },
    personalOrder && {
      index: "02",
      label: "Build Your Own",
      description:
        "Create it your way.",
      to: personalOrder.to,
    },
    bulkOrder && {
      index: "03",
      label: "Bulk & Events",
      description:
        "Teams, weddings and events.",
      to: bulkOrder.to,
    },
  ].filter(Boolean);

  return (
    <div className="border-y border-black/[0.08] bg-white">
      <div className="flex items-end justify-between gap-4 py-4">
        <div>
          <p className="text-[15px] font-black tracking-[0.055em] text-[#171717]">
            {title}
          </p>

          <p className="mt-1 text-[11px] font-medium text-black/40">
            {subtitle}
          </p>
        </div>

        <Link
          to="/gifts"
          className="shrink-0 text-[11px] font-black text-[#F47822]"
        >
          View all →
        </Link>
      </div>

      <div className="border-t border-black/[0.07]">
        {actions.map(
          (
            item,
            index
          ) => (
            <Link
              key={item.label}
              to={item.to}
              className={`group/mobile-path relative flex min-h-[82px] items-center gap-4 overflow-hidden py-4 ${
                index > 0
                  ? "border-t border-black/[0.07]"
                  : ""
              }`}
            >
              <span className="w-7 shrink-0 text-[9px] font-black tracking-[0.12em] text-[#D4AF37]">
                {item.index}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-black text-[#171717]">
                  {item.label}
                </p>

                <p className="mt-1 text-[10px] font-medium text-black/38">
                  {item.description}
                </p>
              </div>

              <span className="shrink-0 text-[17px] text-[#F47822]">
                →
              </span>

              <span className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 text-[62px] font-black leading-none text-black/[0.025]">
                {item.index}
              </span>
            </Link>
          )
        )}
      </div>

      {collections.length > 0 && (
        <div className="border-t border-black/[0.07] py-4">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-black/28">
            Collections
          </p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-3">
            {collections.map(
              (item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="text-[11px] font-bold text-black/54"
                >
                  {item.label}
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ======================================================
// HEADER ICON BUTTON
// ======================================================

const HeaderIconButton = ({
  children,
  darkContent,
  label,
  onClick,
  active = false,
  compact = false,
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`
      flex items-center justify-center rounded-full
      transition duration-300
      ${
        compact
          ? "h-9 w-9 sm:h-10 sm:w-10"
          : "h-11 w-11"
      }
      ${
        active
          ? "bg-[#F97316] text-white"
          : darkContent
            ? "text-[#171717] hover:bg-black/[0.05] hover:text-[#F97316]"
            : "text-white hover:bg-white/10 hover:text-[#F97316]"
      }
    `}
  >
    {children}
  </button>
);

// ======================================================
// ICONS
// ======================================================

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-[21px] w-[21px]"
  >
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.25 4.25" />
  </svg>
);

const AccountIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className="h-[23px] w-[23px]"
  >
    <circle cx="12" cy="7.5" r="3.7" />
    <path d="M4.5 21c.7-4.6 3.2-6.7 7.5-6.7s6.8 2.1 7.5 6.7" />
  </svg>
);

const CartIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className="h-[23px] w-[23px]"
  >
    <path d="M3 4h2.1l2.1 9.4a2 2 0 0 0 2 1.6H17a2 2 0 0 0 1.9-1.4L21 7H6" />
    <circle cx="10" cy="20" r="1.15" />
    <circle cx="18" cy="20" r="1.15" />
  </svg>
);

const LocationIcon = ({ small = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={
      small
        ? "h-[13px] w-[13px]"
        : "h-[18px] w-[18px]"
    }
  >
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const PinIcon = () => <LocationIcon />;

const LocateIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-[17px] w-[17px]"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="h-4 w-4 text-emerald-600"
  >
    <circle cx="10" cy="10" r="8" />
    <path d="m6.5 10 2.2 2.2 4.8-5" />
  </svg>
);

const ChevronSmall = () => (
  <svg
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-3.5 w-3.5 transition group-hover:rotate-180"
  >
    <path d="m4 6.5 5 5 5-5" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-3 w-3"
  >
    <path d="m4 6.5 5 5 5-5" />
  </svg>
);

const MenuIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-6 w-6"
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const CloseIcon = ({ small = false }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    className={
      small
        ? "h-4 w-4"
        : "h-6 w-6"
    }
  >
    <path d="m5 5 10 10M15 5 5 15" />
  </svg>
);

const GiftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className="h-5 w-5"
  >
    <path d="M4 10h16v10H4V10Z" />
    <path d="M3 7h18v4H3V7ZM12 7v13" />
    <path d="M12 7H8.6A2.6 2.6 0 1 1 11 4.4L12 7Zm0 0h3.4A2.6 2.6 0 1 0 13 4.4L12 7Z" />
  </svg>
);

const SpinnerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="h-4 w-4 animate-spin"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="2"
      className="opacity-25"
    />

    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default Header;
