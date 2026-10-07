import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { StatusPill } from "../components/partner/PartnerUI.jsx";
import logo from "../assets/images/logo_dark.jpeg";

const restrictedPrefixes = [
  "/partner/projects",
  "/partner/showcases",
  "/partner/client-actions",
  "/partner/orders",
  "/partner/commissions",
  "/partner/payouts",
  "/partner/supply",
  "/partner/analytics",
];

const approvedSections = [
  {
    title: "Client Work",
    items: [
      ["/partner/projects", "Projects", "▤"],
      ["/partner/showcases", "Showcases", "▣"],
      ["/partner/client-actions", "Client Actions", "✦"],
    ],
  },
  {
    title: "Commerce",
    items: [
      ["/partner/orders", "Attributed Orders", "□"],
      ["/partner/commissions", "Commissions", "₹"],
      ["/partner/payouts", "Payouts", "↗"],
    ],
  },
  {
    title: "Business",
    items: [
      ["/partner/supply", "Supply Workspace", "▦"],
      ["/partner/analytics", "Analytics", "⌁"],
      ["/partner/documents", "Documents", "▥"],
      ["/partner/profile", "Profile & Team", "○"],
    ],
  },
];

const pendingItems = [
  ["/partner/status", "Application Status", "◎", true],
  ["/partner/profile", "Business Profile", "◇"],
  ["/partner/documents", "Verification Documents", "▥"],
];

const useTransparentLogo = (source) => {
  const [processed, setProcessed] = useState(source);

  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        const visited = new Uint8Array(width * height);
        const queue = [];
        const isWhite = (r, g, b) => r > 218 && g > 218 && b > 218 && Math.max(r, g, b) - Math.min(r, g, b) < 28;

        const push = (x, y) => {
          if (x < 0 || y < 0 || x >= width || y >= height) return;
          const pixel = y * width + x;
          if (visited[pixel]) return;
          const index = pixel * 4;
          if (!isWhite(data[index], data[index + 1], data[index + 2])) return;
          visited[pixel] = 1;
          queue.push(pixel);
        };

        for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
        for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y); }

        for (let i = 0; i < queue.length; i += 1) {
          const pixel = queue[i];
          const x = pixel % width;
          const y = Math.floor(pixel / width);
          data[pixel * 4 + 3] = 0;
          push(x + 1, y);
          push(x - 1, y);
          push(x, y + 1);
          push(x, y - 1);
        }

        ctx.putImageData(imageData, 0, 0);
        if (!cancelled) setProcessed(canvas.toDataURL("image/png"));
      } catch {
        if (!cancelled) setProcessed(source);
      }
    };

    image.onerror = () => {
      if (!cancelled) setProcessed(source);
    };
    image.src = source;

    return () => { cancelled = true; };
  }, [source]);

  return processed;
};

const Brand = ({ image, onClick, partner, user, mobile = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group w-full text-left ${mobile ? "flex min-w-0 flex-1 items-center gap-2 pr-2" : "border-b border-white/[0.07] px-5 py-5 pr-14 lg:pr-5"}`}
  >
    <div className="flex min-w-0 items-center gap-2">
      <span className={`flex shrink-0 items-center justify-center ${mobile ? "h-11 w-9 sm:h-14 sm:w-11" : "h-14 w-11"}`}>
        <img src={image} alt="" className="block h-full w-full object-contain transition duration-300 group-hover:scale-[1.025]" />
      </span>
      <span className="min-w-0 flex-1 overflow-visible">
        <strong
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          className={`${mobile ? "text-[clamp(17px,5.2vw,24px)] text-[#252119]" : "text-[22px] text-white"} block whitespace-nowrap pb-0.5 font-semibold leading-[1.12] tracking-[0.04em]`}
        >
          HAMPORIUM
        </strong>
        <small className={`${mobile ? "text-[#71695D]" : "text-white/55"} mt-1 block whitespace-nowrap text-[10px] font-medium leading-[1.15]`}>
          The art of thoughtful gifting
        </small>
      </span>
    </div>

    {!mobile && (
      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <StatusPill value={partner?.status} />
        <p className="mt-3 truncate text-[12px] font-bold text-white/75">{partner?.businessName || user?.name || "HAMPORIUM Partner"}</p>
        {partner?.partnerId && <p className="mt-1 truncate text-[11px] font-medium tracking-[0.04em] text-white/30">{partner.partnerId}</p>}
      </div>
    )}
  </button>
);

const NavItem = ({ to, label, icon, end = false }) => (
  <NavLink
    end={end}
    to={to}
    className={({ isActive }) => `group relative flex min-h-11 items-center gap-3 px-6 text-[12px] font-semibold transition ${isActive ? "bg-white/[0.07] text-white" : "text-white/45 hover:bg-white/[0.04] hover:text-white"}`}
  >
    {({ isActive }) => (
      <>
        <span className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full ${isActive ? "bg-[#F97316]" : "bg-transparent"}`} />
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[12px] ${isActive ? "border-[#F97316]/30 bg-[#F97316]/10 text-[#F97316]" : "border-white/[0.06] text-white/25 group-hover:border-[#D4AF37]/20 group-hover:text-[#D4AF37]"}`}>{icon}</span>
        <span className="truncate">{label}</span>
        {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />}
      </>
    )}
  </NavLink>
);

const Section = ({ number, children, first = false }) => (
  <div className={`mb-1.5 flex items-center gap-3 px-6 ${first ? "mt-3" : "mt-5"}`}>
    <span className="font-serif text-[10px] italic text-[#D4AF37]/80">{number}</span>
    <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.22em] text-white/25">{children}</span>
    <span className="h-px flex-1 bg-white/[0.07]" />
  </div>
);

const PartnerLayout = () => {
  const { user, partner, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const transparentLogo = useTransparentLogo(logo);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const approved = partner?.status === "approved";
  const restricted = restrictedPrefixes.some((prefix) => location.pathname.startsWith(prefix));

  useEffect(() => setMobileMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileMenuOpen]);

  if (!approved && (location.pathname === "/partner" || restricted)) {
    return <Navigate to="/partner/status" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/partner/login", { replace: true });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F7F6F3] text-[#171717] lg:grid lg:h-screen lg:min-h-0 lg:grid-cols-[292px_minmax(0,1fr)] lg:overflow-hidden">
      <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-black/[0.07] bg-[#FFFDF9]/95 px-3.5 shadow-[0_8px_30px_rgba(30,22,12,.06)] backdrop-blur-xl sm:px-5 lg:hidden">
        <Brand image={transparentLogo} partner={partner} user={user} mobile onClick={() => navigate(approved ? "/partner" : "/partner/status")} />
        <button type="button" onClick={() => setMobileMenuOpen(true)} className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded-[14px] border border-[#D4AF37]/25 bg-[#171717] text-white" aria-label="Open partner navigation">
          <span className="h-[1.5px] w-[18px] bg-[#F4D574]" />
          <span className="h-[1.5px] w-[14px] translate-x-0.5 bg-white" />
          <span className="h-[1.5px] w-[18px] bg-[#F4D574]" />
        </button>
      </header>

      {mobileMenuOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] lg:hidden" />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-[min(88vw,326px)] overflow-y-auto bg-[#111] text-white shadow-[28px_0_70px_rgba(0,0,0,.30)] transition-transform duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:static lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <button type="button" onClick={() => setMobileMenuOpen(false)} className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[22px] text-white/70 lg:hidden">×</button>

        <div className="flex min-h-full flex-col">
          <Brand image={transparentLogo} partner={partner} user={user} onClick={() => navigate(approved ? "/partner" : "/partner/status")} />

          <nav className="flex-1 pb-3 pt-2">
            {!approved ? (
              <>
                <Section number="01" first>Before approval</Section>
                {pendingItems.map(([to, label, icon, end]) => <NavItem key={to} to={to} label={label} icon={icon} end={end} />)}
              </>
            ) : (
              <>
                <NavItem end to="/partner" label="Dashboard" icon="◈" />
                {approvedSections.map((section, index) => (
                  <div key={section.title}>
                    <Section number={String(index + 1).padStart(2, "0")} first={index === 0}>{section.title}</Section>
                    {section.items.map(([to, label, icon]) => <NavItem key={to} to={to} label={label} icon={icon} />)}
                  </div>
                ))}
              </>
            )}
          </nav>

          <div className="shrink-0 border-t border-white/[0.07] px-6 py-4">
            <p className="truncate font-serif text-[14px] font-semibold text-white">{user?.name || "Partner"}</p>
            <p className="mt-1 truncate text-[11px] font-medium text-white/35">{user?.email}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => navigate("/")} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-white/55 hover:text-white">Store</button>
              <button type="button" onClick={handleLogout} className="flex-1 rounded-lg border border-red-400/20 px-3 py-2 text-[11px] font-bold text-red-300 hover:bg-red-500/[0.08]">Logout</button>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 bg-[#F7F6F3] lg:h-screen lg:overflow-y-auto">
        <div className="w-full px-5 py-6 sm:px-8 lg:px-10 lg:py-8 xl:px-12 2xl:px-14">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default PartnerLayout;
