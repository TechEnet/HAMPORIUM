
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import logo from "../assets/images/logo_dark.jpeg";

// Preserve the existing logo treatment: remove only the connected white backdrop.
function useTransparentLogo(source) {
  const [result, setResult] = useState(source);
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        const visited = new Uint8Array(width * height);
        const queue = [];
        const isBackdrop = (r, g, b) => r > 218 && g > 218 && b > 218 && Math.max(r, g, b) - Math.min(r, g, b) < 28;
        const push = (x, y) => {
          if (x < 0 || y < 0 || x >= width || y >= height) return;
          const pixel = y * width + x;
          if (visited[pixel]) return;
          const i = pixel * 4;
          if (!isBackdrop(pixels[i], pixels[i + 1], pixels[i + 2])) return;
          visited[pixel] = 1;
          queue.push(pixel);
        };
        for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
        for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
        for (let i = 0; i < queue.length; i++) {
          const pixel = queue[i];
          const x = pixel % width;
          const y = Math.floor(pixel / width);
          pixels[pixel * 4 + 3] = 0;
          push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
        }
        context.putImageData(imageData, 0, 0);
        if (!cancelled) setResult(canvas.toDataURL("image/png"));
      } catch {
        if (!cancelled) setResult(source);
      }
    };
    image.onerror = () => { if (!cancelled) setResult(source); };
    image.src = source;
    return () => { cancelled = true; };
  }, [source]);
  return result;
}

const GROUPS = [
  {
    id: "orders", title: "Orders", icon: "orders",
    items: [
      { label: "All orders", to: "/admin/orders" },
      { label: "Prepare orders", to: "/admin/production" },
      { label: "Ship & deliver", to: "/admin/fulfilment" },
      { label: "Payments", to: "/admin/payments" },
    ],
  },
  {
    id: "catalog", title: "Catalogue", icon: "catalog",
    items: [
      { label: "Catalogue overview", to: "/admin/studio", exact: true },
      { label: "Products & hampers", to: "/admin/catalog/products" },
      { label: "Inventory", to: "/admin/studio/inventory" },
      { label: "Excel import", to: "/admin/studio/import", exact: true },
    ],
  },
  {
    id: "marketing", title: "Marketing", icon: "marketing",
    items: [{ label: "Marketing overview", to: "/admin/studio/marketing", exact: true }],
  },
  {
    id: "business", title: "Bulk & custom", icon: "business",
    items: [
      { label: "RFQs", to: "/admin/rfqs" },
      { label: "Quotations", to: "/admin/quotes" },
      { label: "Artwork approvals", to: "/admin/approvals" },
    ],
  },
  {
    id: "customers", title: "Customers", icon: "users",
    items: [
      { label: "Customer intelligence", to: "/admin/customers", adminOnly: true },
      { label: "Reviews", to: "/admin/reviews" },
      { label: "Support tickets", to: "/admin/support" },
    ],
  },
  {
    id: "partners", title: "Partners", icon: "partners",
    items: [
      { label: "Partner accounts", to: "/admin/partners" },
      { label: "Showcases", to: "/admin/partner-showcases" },
      { label: "Commissions", to: "/admin/commissions" },
      { label: "Payouts", to: "/admin/payouts" },
    ],
  },
  {
    id: "insights", title: "Insights", icon: "analytics",
    items: [
      { label: "Demand insights", to: "/admin/studio/demand" },
      { label: "Search analytics", to: "/admin/analytics/search" },
    ],
  },
  {
    id: "advanced", title: "Advanced tools", icon: "settings",
    items: [
      { label: "Master Control", to: "/admin/master-control" },
      { label: "Excel field reference", to: "/admin/studio/excel-fields" },
      { label: "Action history", to: "/admin/studio/audit" },
    ],
  },
];

function groupForPath(path) {
  if (/^\/admin\/catalog(?:\/|$)/.test(path)) return "catalog";
  if (/^\/admin\/studio\/(occasions|campaigns|excel-sync|marketing)(?:\/|$)/.test(path)) return "marketing";
  if (/^\/admin\/studio\/(inventory|import)(?:\/|$)/.test(path) || path === "/admin/studio") return "catalog";
  if (/^\/admin\/studio\/(excel-fields|audit)(?:\/|$)/.test(path) || /^\/admin\/master-control(?:\/|$)/.test(path)) return "advanced";
  if (/^\/admin\/studio\/demand(?:\/|$)/.test(path) || /^\/admin\/analytics(?:\/|$)/.test(path)) return "insights";
  return GROUPS.find((group) => group.items.some((item) => path === item.to || path.startsWith(`${item.to}/`)))?.id ?? "";
}

function Icon({ type, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {type === "orders" && <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 5V3h8v2M8 10h8M8 14h6"/></>}
      {type === "catalog" && <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/></>}
      {type === "marketing" && <><path d="m3 10 12-5v14L3 14zM15 8l5-2v12l-5-2M6 14l2 6h3l-2-6"/></>}
      {type === "business" && <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/></>}
      {type === "users" && <><circle cx="9" cy="8" r="3"/><path d="M2.5 21v-2a6.5 6.5 0 0 1 13 0v2M17 11a3 3 0 0 0 0-6M18 15a5 5 0 0 1 3.5 5v1"/></>}
      {type === "partners" && <><path d="M2 11 9 4l4 3 3-2 6 6-8 9-4-3-3 2-5-5"/><path d="m9 12 3 3 4-4"/></>}
      {type === "analytics" && <><path d="M3 20V4M3 20h18M7 16l4-5 4 3 5-8"/></>}
      {type === "settings" && <><circle cx="12" cy="12" r="3"/><path d="M4 12H2m20 0h-2M12 4V2m0 20v-2M6 6 4.5 4.5M19.5 19.5 18 18M18 6l1.5-1.5M4.5 19.5 6 18"/></>}
      {type === "dashboard" && <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>}
      {type === "chevron" && <path d="m7 10 5 5 5-5"/>}
      {type === "logout" && <><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M16 17l5-5-5-5M21 12H9"/></>}
      {type === "menu" && <path d="M4 7h16M4 12h16M4 17h16"/>}
      {type === "close" && <path d="M5 5l14 14M19 5 5 19"/>}
    </svg>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const brandLogo = useTransparentLogo(logo);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => groupForPath(location.pathname));
  const isAdmin = user?.roles?.includes("admin");

  useEffect(() => { setExpanded(groupForPath(location.pathname)); setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, [mobileOpen]);

  const handleLogout = async () => { await logout(); navigate("/"); };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#26221D] lg:grid lg:h-screen lg:min-h-0 lg:grid-cols-[258px_minmax(0,1fr)] lg:overflow-hidden">
      <header className="sticky top-0 z-40 flex h-[64px] items-center justify-between border-b border-[#E7E2DA] bg-[#FFFEFC] px-4 lg:hidden">
        <button type="button" onClick={() => navigate("/admin")} className="flex items-center gap-3" aria-label="Go to admin dashboard">
          <img src={brandLogo} alt="" className="h-10 w-9 object-contain"/>
          <span className="font-serif text-xl font-semibold tracking-[.06em]">HAMPORIUM</span>
        </button>
        <button type="button" aria-label="Open admin menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E8E0D5] text-[#231F1B]"><Icon type="menu" size={21}/></button>
      </header>
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-black/55 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"/>}
      <aside onClickCapture={(event) => { if (event.target.closest("a[href]")) setMobileOpen(false); }} className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,290px)] flex-col bg-[#191817] text-white shadow-2xl transition-transform duration-200 lg:static lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[85px] shrink-0 items-center justify-between border-b border-white/10 px-5">
          <button type="button" onClick={() => navigate("/admin")} className="flex min-w-0 items-center gap-3 text-left" aria-label="HAMPORIUM admin dashboard">
            <img src={brandLogo} alt="" className="h-12 w-10 shrink-0 object-contain"/>
            <span className="min-w-0"><strong className="block font-serif text-[20px] font-semibold tracking-[.055em]">HAMPORIUM</strong><small className="block text-[10px] tracking-[.08em] text-white/45">ADMIN WORKSPACE</small></span>
          </button>
          <button className="rounded-lg p-2 text-white/70 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><Icon type="close"/></button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin] [scrollbar-color:#45413c_transparent]" aria-label="Admin navigation">
          <NavLink end to="/admin" className={({isActive})=>`flex min-h-[43px] items-center gap-3 rounded-xl px-3.5 text-[13px] font-semibold transition ${isActive?'bg-[#343029] text-[#E7C18B]':'text-white/70 hover:bg-white/[.06] hover:text-white'}`}>
            <Icon type="dashboard"/><span>Dashboard</span>
          </NavLink>
          <div className="my-3 h-px bg-white/10"/>
          {GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.adminOnly || isAdmin);
            if (!items.length) return null;
            const open = expanded === group.id;
            const selected = groupForPath(location.pathname) === group.id;
            return (
              <div key={group.id}>
                <button type="button" aria-expanded={open} aria-controls={`admin-menu-${group.id}`} onClick={() => setExpanded(open?'':group.id)} className={`flex min-h-[43px] w-full items-center gap-3 rounded-xl px-3.5 text-left text-[13px] font-semibold transition ${selected?'text-[#E7C18B]': 'text-white/75'} hover:bg-white/[.06] hover:text-white`}>
                  <Icon type={group.icon}/><span className="flex-1">{group.title}</span>
                  <span className={`text-white/40 transition-transform duration-200 ${open?'rotate-180':''}`}><Icon type="chevron" size={15}/></span>
                </button>
                {open && <div id={`admin-menu-${group.id}`} className="ml-[20px] mb-2 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                  {items.map((item) => <NavLink key={item.to} end={Boolean(item.exact)} to={item.to} className={({isActive})=>`block rounded-lg px-3 py-2.5 text-[12px] transition ${isActive?'bg-[#383127] font-semibold text-[#F4D2A3]':'text-white/55 hover:bg-white/[.06] hover:text-white'}`}>{item.label}</NavLink>)}
                </div>}
              </div>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 px-4 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#40372B] font-serif text-sm text-[#E7C18B]">{String(user?.name||'A').slice(0,1).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold">{user?.name||'Administrator'}</p><p className="truncate text-[10px] text-white/45">{user?.email||'Admin account'}</p></div>
          <button type="button" onClick={handleLogout} aria-label="Log out" title="Log out" className="rounded-lg p-2 text-white/55 hover:bg-white/[.08] hover:text-white"><Icon type="logout"/></button>
        </div>
      </aside>
      <div role="main" className="min-w-0 overflow-x-hidden bg-[#F8F7F4] lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-[1900px] px-4 py-5 sm:px-7 sm:py-7 lg:px-9 lg:py-8"><Outlet/></div>
      </div>
    </div>
  );
}
