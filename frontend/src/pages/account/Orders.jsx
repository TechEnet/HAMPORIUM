import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/api.js";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";
import { downloadOrderInvoice } from "../../utils/invoice.js";

const TABS = [
  { value: "all", label: "All orders" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const normalize = (value) => String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
const isIn = (value, values) => values.some((keyword) => normalize(value).includes(keyword));
const matchesTab = (status, tab) => {
  if (tab === "all") return true;
  if (tab === "processing") return isIn(status, ["processing", "confirmed", "pending", "placed"]);
  if (tab === "shipped") return isIn(status, ["shipped", "dispatched", "in transit", "out for delivery"]);
  return normalize(status).includes(tab);
};

const getApiOrigin = () => String(api.defaults?.baseURL || "").replace(/\/api\/?$/, "").replace(/\/$/, "");
const resolveImage = (value) => {
  const image = typeof value === "object" && value !== null
    ? value.url || value.secure_url || value.location || value.src || value.path || ""
    : value;
  if (typeof image !== "string" || !image) return "";
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  if (image.startsWith("//")) return `https:${image}`;
  const origin = getApiOrigin();
  return origin ? `${origin}${image.startsWith("/") ? "" : "/"}${image}` : image;
};
const firstItemOf = (order) => order?.items?.[0] || null;
const itemNameOf = (item) => item?.product?.name || item?.name || item?.productName || "HAMPORIUM Order";
const itemSlugOf = (item) => item?.product?.slug || item?.slug || "";
const itemImageOf = (item) => {
  const productImages = item?.product?.images;
  const firstImage = Array.isArray(productImages) ? productImages[0] : null;
  return resolveImage(firstImage || item?.product?.image || item?.image || item?.thumbnail);
};
const isInvoiceAvailable = (status) => isIn(status, [
  "paid", "captured", "completed", "success", "successful", "partially refunded", "refunded",
]);
const isTrackable = (status) => !isIn(status, ["cancelled", "canceled", "delivered", "returned"])
  && isIn(status, ["processing", "confirmed", "pending", "placed", "shipped", "dispatched", "in transit", "out for delivery"]);

const statusDetails = (value) => {
  const status = normalize(value);
  if (status.includes("delivered")) return { label: "Delivered", tone: "success", icon: "check" };
  if (status.includes("cancelled") || status.includes("canceled")) return { label: "Cancelled", tone: "danger", icon: "x" };
  if (status.includes("refund")) return { label: "Refunded", tone: "muted", icon: "rotate" };
  if (isIn(status, ["shipped", "dispatched", "in transit", "out for delivery"])) {
    return { label: status.includes("out for delivery") ? "Out for delivery" : "On the way", tone: "info", icon: "truck" };
  }
  if (isIn(status, ["processing", "confirmed", "pending", "placed"])) {
    return { label: status.includes("pending") ? "Pending" : "Processing", tone: "warning", icon: "clock" };
  }
  return { label: String(value || "Pending").replace(/[_-]/g, " "), tone: "muted", icon: "package" };
};

const Icon = ({ name, size = 18, className = "" }) => {
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.3 4.3"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    chevron: <path d="m9 5 7 7-7 7"/>,
    bag: <><path d="M4.5 8h15l-1 12h-13l-1-12Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    package: <><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z"/><path d="m3 7 9 4 9-4m-9 4v10"/></>,
    truck: <><path d="M2 5h12v12H2zM14 9h4l4 4v4h-8V9Z"/><circle cx="6.5" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    check: <path d="m4.5 12 5 5 10-10"/>,
    x: <path d="M6 6 18 18M18 6 6 18"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    rotate: <><path d="M3 10a9 9 0 1 1 2 7M3 5v5h5"/></>,
    receipt: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
    filter: <><path d="M4 7h16M7 12h10m-7 5h4"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.4 9a3 3 0 0 1 5.2 2c0 2-2.6 2-2.6 4"/><path d="M12 18h.01"/></>,
    close: <path d="M5 5 19 19M19 5 5 19"/>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 9a7 7 0 0 1 12-2l2 5M4 12l2 5a7 7 0 0 0 12-2"/></>,
    star: <path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.8Z"/>,
  };
  return <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.package}</svg>;
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const loadOrders = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/orders/my-orders", { signal: controller.signal });
        if (active) setOrders(Array.isArray(response.data?.orders) ? response.data.orders : []);
      } catch (requestError) {
        if (!active || requestError.code === "ERR_CANCELED") return;
        setError(requestError.response?.data?.message || "Couldn't load your orders. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadOrders();
    return () => { active = false; controller.abort(); };
  }, [retryKey]);

  const counts = useMemo(() => Object.fromEntries(
    TABS.map(({ value }) => [value, orders.filter((order) => matchesTab(order.status, value)).length]),
  ), [orders]);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (!matchesTab(order.status, activeTab)) return false;
      if (!query) return true;
      const text = [
        order.orderNumber, order._id,
        ...(order.items || []).flatMap((item) => [itemNameOf(item), item.product?.brand || ""]),
      ].join(" ").toLowerCase();
      return text.includes(query);
    }).sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "high") return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
      if (sortBy === "low") return Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [orders, activeTab, search, sortBy]);

  const clearFilters = useCallback(() => { setActiveTab("all"); setSearch(""); setSortBy("newest"); }, []);

  return (
    <main className="om-page">
      <style>{`
        .om-page { width:100%; min-width:0; max-width:100%; padding:8px 0 36px; color:#202124; font-family:Inter,Manrope,Arial,sans-serif; font-size:14px; }
        .om-page * { box-sizing:border-box; }
        .om-page button,.om-page input,.om-page select { font:inherit; }
        .om-page a { text-decoration:none; }
        .om-page a:focus-visible,.om-page button:focus-visible,.om-page input:focus-visible,.om-page select:focus-visible { outline:3px solid #c8a04c; outline-offset:3px; }
        .om-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; margin-bottom:21px; }
        .om-title { font-size:clamp(26px,2.7vw,32px); font-weight:750; letter-spacing:-.035em; line-height:1.25; margin:0; }
        .om-heading-sub { margin:5px 0 0; color:#6b7280; font-size:13px; line-height:1.5; }
        .om-header-links { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
        .om-link-action { display:inline-flex; align-items:center; gap:6px; padding:9px 12px; border-radius:7px; font-weight:650; font-size:13px; color:#455468; transition:background .2s,color .2s; }
        .om-link-action:hover { color:#97691c; background:#f7f0e4; }
        .om-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:15px; }
        .om-search { width:min(100%,490px); min-width:0; height:44px; display:flex; align-items:center; gap:10px; padding:0 13px; border:1px solid #dfe3e8; background:#fff; border-radius:8px; color:#7b8491; transition:border-color .2s,box-shadow .2s; }
        .om-search:focus-within { border-color:#b7944c; box-shadow:0 0 0 3px rgba(190,151,64,.11); }
        .om-search input { width:100%; min-width:0; height:100%; border:0; outline:0; color:#222b36; background:transparent; font-size:14px; }
        .om-search input::placeholder { color:#98a0aa; }
        .om-search button { background:transparent; border:0; display:grid; place-items:center; color:#8a9199; cursor:pointer; padding:5px; }
        .om-sort-wrap { display:flex; align-items:center; gap:9px; white-space:nowrap; color:#647180; font-size:13px; }
        .om-sort { min-width:158px; height:42px; border:1px solid #dfe3e8; border-radius:8px; background:white; padding:0 12px; color:#27313e; font-size:13px; font-weight:600; outline:0; cursor:pointer; }
        .om-tabs { display:flex; align-items:center; gap:4px; overflow-x:auto; scrollbar-width:none; border-bottom:1px solid #eceef0; margin:0 0 16px; }
        .om-tabs::-webkit-scrollbar { display:none; }
        .om-tab { position:relative; flex-shrink:0; display:flex; align-items:center; gap:7px; padding:13px 16px 14px; border:0; color:#6b7481; background:transparent; font-size:13px; font-weight:650; cursor:pointer; white-space:nowrap; }
        .om-tab:hover { color:#202124; }
        .om-tab.is-active { color:#1e2630; }
        .om-tab.is-active::after { content:""; position:absolute; height:3px; bottom:0; left:16px; right:16px; border-radius:3px 3px 0 0; background:#c79a3f; }
        .om-tab-count { display:inline-grid; place-items:center; min-width:20px; height:20px; padding:0 5px; border-radius:5px; background:#f1f2f4; color:#5d6878; font-size:11px; font-weight:700; }
        .om-tab.is-active .om-tab-count { background:#f6ead2; color:#966619; }
        .om-results { margin:0 0 12px; font-size:12.5px; color:#7a8490; }
        .om-list { display:grid; gap:13px; }
        .om-order { background:#fff; border:1px solid #e6e8ec; border-radius:11px; overflow:hidden; box-shadow:0 2px 8px rgba(28,36,45,.025); transition:box-shadow .2s,border-color .2s; }
        .om-order:hover { border-color:#d8dce2; box-shadow:0 6px 20px rgba(28,36,45,.06); }
        .om-order-head { display:flex; align-items:center; justify-content:space-between; gap:10px 18px; flex-wrap:wrap; padding:12px 18px; background:#f8f9fb; border-bottom:1px solid #eff0f2; }
        .om-order-head-left { display:flex; align-items:center; gap:8px 22px; flex-wrap:wrap; }
        .om-order-id { color:#323c47; font-size:13px; font-weight:750; overflow-wrap:anywhere; }
        .om-meta-sub { color:#7a8490; font-size:12.5px; font-weight:500; }
        .om-status { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:750; white-space:nowrap; }
        .om-status--success { color:#167146; background:#e8f7ed; }
        .om-status--info { color:#1669ab; background:#e9f3fc; }
        .om-status--warning { color:#946315; background:#fff4de; }
        .om-status--danger { color:#b33c3c; background:#fff0f0; }
        .om-status--muted { color:#596574; background:#f0f2f5; }
        /* Use the actual account content area; never squeeze all actions into a 185px rail. */
        .om-order { container-type:inline-size; }
        .om-order-body { display:grid; grid-template-columns:96px minmax(0,1fr) minmax(288px,330px); align-items:center; column-gap:clamp(18px,2.5vw,32px); row-gap:20px; padding:22px 24px; }
        .om-product-image { width:88px; height:88px; display:grid; place-items:center; border-radius:8px; background:#f6f5f2; border:1px solid #f0f0ee; overflow:hidden; color:#ad8740; }
        .om-product-image img { width:100%; height:100%; object-fit:contain; mix-blend-mode:multiply; transition:transform .25s; }
        .om-product-image:hover img { transform:scale(1.05); }
        .om-product-name { display:block; max-width:580px; color:#25303a; font-weight:700; font-size:15px; line-height:1.45; }
        .om-product-name:hover { color:#a47720; }
        .om-product-muted { margin:7px 0 0; color:#76818d; font-size:12.5px; line-height:1.5; }
        .om-price { margin:8px 0 0; color:#17202b; font-size:16px; font-weight:750; }
        .om-data { display:flex; flex-wrap:wrap; gap:6px 17px; margin-top:10px; color:#677382; font-size:12.5px; }
        .om-data strong { font-weight:700; color:#414d5b; }
        /* Main order CTA + clearly separated, evenly aligned secondary actions. */
        .om-actions { display:grid; grid-template-columns:minmax(0,1fr); gap:13px; align-self:center; justify-self:end; width:100%; min-width:0; }
        .om-primary { display:inline-flex; width:100%; min-height:46px; align-items:center; justify-content:center; gap:12px; padding:11px 15px; color:#fff !important; background:#222b36; border:1px solid #222b36; border-radius:8px; font-size:13.5px; font-weight:750; line-height:1.35; cursor:pointer; text-align:center; transition:background .2s,transform .2s,box-shadow .2s; }
        .om-primary:hover { background:#374457; box-shadow:0 6px 15px rgba(27,38,52,.12); transform:translateY(-1px); }
        .om-minor-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:12px; row-gap:10px; width:100%; min-width:0; }
        .om-actions .om-text-action { display:inline-flex; width:100%; min-width:0; min-height:42px; justify-content:center; align-items:center; gap:9px; padding:9px 11px; background:#f8f9fb; border:1px solid #e8ebf0; border-radius:7px; color:#365b7a; font-weight:650; font-size:13px; line-height:1.35; text-align:center; white-space:nowrap; cursor:pointer; transition:border-color .2s,background .2s,color .2s; }
        .om-actions .om-text-action svg { flex-shrink:0; }
        .om-actions .om-text-action:hover { color:#865f1f; background:#fbf7ef; border-color:#e9d8b6; text-decoration:none; }
        .om-actions .om-minor-actions > :only-child { grid-column:1/-1; }
        .om-actions .om-minor-actions > :nth-child(3):last-child { grid-column:1/-1; }
        .om-text-action { display:inline-flex; align-items:center; gap:7px; padding:3px 0; background:none; border:0; color:#28679b; font-weight:650; font-size:13px; cursor:pointer; }
        .om-text-action:hover { color:#a47520; text-decoration:underline; text-underline-offset:3px; }
        .om-text-action:disabled { opacity:.45; cursor:not-allowed; }
        .om-error { margin:8px 0 0; color:#b93b3b; font-size:12px; line-height:1.5; }
        .om-banner { padding:15px 18px; margin:0 0 16px; border:1px solid #efccca; background:#fff6f5; border-radius:8px; display:flex; flex-wrap:wrap; align-items:center; gap:12px; justify-content:space-between; color:#a33230; font-size:13px; }
        .om-empty { display:flex; min-height:270px; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:36px 16px; background:#fff; border:1px solid #e9ecef; border-radius:11px; }
        .om-empty-icon { height:60px; width:60px; border-radius:50%; display:grid; place-items:center; background:#faf4e9; color:#b18b42; margin-bottom:14px; }
        .om-empty h2 { margin:0; color:#293442; font-size:18px; font-weight:750; }
        .om-empty p { color:#788390; margin:9px 0 20px; font-size:13px; line-height:1.6; max-width:370px; }
        .om-skeleton { height:151px; background:linear-gradient(100deg,#f6f7f9 12%,#fff 28%,#f6f7f9 42%); background-size:200% 100%; border:1px solid #eceef1; border-radius:10px; animation:omShimmer 1.4s linear infinite; }
        @keyframes omShimmer { to { background-position:-200% 0; } }
        /* Container queries react to the width left AFTER the account sidebar. */
        @container (max-width:780px) {
          .om-order-body { grid-template-columns:88px minmax(0,1fr); align-items:start; gap:16px 20px; padding:18px 20px; }
          .om-actions { grid-column:1/-1; display:grid; grid-template-columns:minmax(175px,215px) minmax(0,1fr); align-items:start; column-gap:18px; }
          .om-minor-actions { column-gap:10px; row-gap:9px; }
        }
        @container (max-width:560px) {
          .om-order-body { grid-template-columns:78px minmax(0,1fr); gap:12px 14px; padding:15px 15px 17px; }
          .om-product-image { width:78px; height:78px; }
          .om-actions { grid-template-columns:minmax(0,1fr); gap:11px; }
          .om-primary { min-height:44px; }
          .om-minor-actions { column-gap:10px; row-gap:9px; }
          .om-actions .om-text-action { min-height:42px; }
        }
        @media(max-width:560px) { .om-page { padding-top:0; } .om-head { align-items:flex-start; margin-bottom:16px; } .om-heading-sub { font-size:12.5px; } .om-header-links { gap:0; } .om-link-action { padding:7px 9px 7px 0; } .om-toolbar { gap:10px; } .om-search { flex:1 1 100%; width:100%; } .om-sort-wrap { width:100%; justify-content:space-between; } .om-sort { flex:1; max-width:210px; } .om-tab { padding:12px 11px 13px; } .om-tab.is-active::after { left:11px; right:11px; } .om-order-head { padding:11px 13px; align-items:flex-start; } .om-order-head-left { align-items:flex-start; gap:4px 12px; flex-direction:column; } .om-product-name { font-size:14px; } .om-price { font-size:15px; } }
        @media(prefers-reduced-motion:reduce) { .om-page *, .om-page *::before, .om-page *::after { animation:none !important; transition:none !important; } }
      `}</style>

      <header className="om-head">
        <div>
          <h1 className="om-title">My Orders</h1>
          <p className="om-heading-sub">Track orders, check delivery status and manage purchases.</p>
        </div>
        <div className="om-header-links">
          <Link className="om-link-action" to="/account/support"><Icon name="help" size={16}/> Help & Support</Link>
          <Link className="om-link-action" to="/account/refunds">Returns & Refunds <Icon name="chevron" size={14}/></Link>
        </div>
      </header>

      <div className="om-toolbar">
        <label className="om-search" aria-label="Search orders">
          <Icon name="search" size={19}/>
          <input type="search" placeholder="Search by order ID or product name" value={search} onChange={(event) => setSearch(event.target.value)}/>
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><Icon name="close" size={15}/></button>}
        </label>
        <label className="om-sort-wrap">Sort by
          <select className="om-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="high">Price: high to low</option>
            <option value="low">Price: low to high</option>
          </select>
        </label>
      </div>

      <nav className="om-tabs" aria-label="Filter orders">
        {TABS.map((tab) => <button
          key={tab.value}
          type="button"
          aria-current={activeTab === tab.value ? "page" : undefined}
          className={`om-tab ${activeTab === tab.value ? "is-active" : ""}`}
          onClick={() => setActiveTab(tab.value)}
        >
          {tab.label}<span className="om-tab-count">{counts[tab.value] || 0}</span>
        </button>)}
      </nav>

      {error && <div className="om-banner" role="alert"><span>{error}</span><button className="om-text-action" type="button" onClick={() => setRetryKey((key) => key + 1)}><Icon name="refresh" size={16}/> Retry</button></div>}

      {loading ? (
        <div className="om-list" aria-label="Loading orders"><div className="om-skeleton"/><div className="om-skeleton"/><div className="om-skeleton"/></div>
      ) : error ? null : !orders.length ? (
        <EmptyOrders />
      ) : !visibleOrders.length ? (
        <div className="om-empty">
          <span className="om-empty-icon"><Icon name="search" size={25}/></span>
          <h2>No matching orders</h2>
          <p>Try another search or select a different order status.</p>
          <button className="om-primary" type="button" onClick={clearFilters}>Clear filters <Icon name="arrow" size={16}/></button>
        </div>
      ) : (
        <>
          <p className="om-results">Showing {visibleOrders.length} of {orders.length} orders</p>
          <div className="om-list">
            {visibleOrders.map((order) => <OrderRow key={order._id} order={order}/>)}
          </div>
        </>
      )}
    </main>
  );
};

const OrderRow = ({ order }) => {
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const firstItem = firstItemOf(order);
  const itemName = itemNameOf(firstItem);
  const itemImage = itemImageOf(firstItem);
  const itemSlug = itemSlugOf(firstItem);
  const totalItems = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const extraItems = Math.max((order.items?.length || 0) - 1, 0);
  const status = statusDetails(order.status);
  const delivered = isIn(order.status, ["delivered"]);
  const trackable = isTrackable(order.status);
  const invoiceAvailable = isInvoiceAvailable(order.paymentStatus);
  const paid = isInvoiceAvailable(order.paymentStatus) && !isIn(order.paymentStatus, ["refund"]);
  const orderLink = `/account/orders/${order._id}`;

  const downloadInvoice = async () => {
    if (invoiceDownloading) return;
    setInvoiceDownloading(true);
    setInvoiceError("");
    try {
      await downloadOrderInvoice({ orderId: order._id, orderNumber: order.orderNumber });
    } catch (requestError) {
      setInvoiceError(requestError?.message || "Unable to download invoice.");
    } finally {
      setInvoiceDownloading(false);
    }
  };

  return (
    <article className="om-order">
      <div className="om-order-head">
        <div className="om-order-head-left">
          <span className="om-order-id">Order #{order.orderNumber || String(order._id || "").slice(-8)}</span>
          <span className="om-meta-sub">Placed on {order.createdAt ? formatDate(order.createdAt) : "—"}</span>
        </div>
        <span className={`om-status om-status--${status.tone}`}><Icon name={status.icon} size={15}/>{status.label}</span>
      </div>
      <div className="om-order-body">
        <Link className="om-product-image" to={orderLink} aria-label={`View ${itemName}`}>
          {itemImage ? <img src={itemImage} alt={itemName} loading="lazy"/> : <Icon name="bag" size={34}/>}
        </Link>
        <div style={{ minWidth: 0 }}>
          <Link className="om-product-name" to={orderLink}>{itemName}</Link>
          <p className="om-product-muted">{totalItems} {totalItems === 1 ? "item" : "items"}{extraItems ? ` · +${extraItems} more products` : ""}{order.checkoutMode === "quote" ? " · Quote order" : ""}</p>
          <p className="om-price">{formatCurrency(order.totalAmount || 0)}</p>
          <div className="om-data">
            {order.deliveryDate && <span><strong>Delivery:</strong> {formatDate(order.deliveryDate)}</span>}
            <span><strong>Payment:</strong> {paid ? "Paid" : order.paymentStatus ? String(order.paymentStatus).replace(/[_-]/g, " ") : "Pending"}</span>
          </div>
        </div>
        <div className="om-actions">
          <Link className="om-primary" to={orderLink}>{trackable ? "Track order" : "View order details"}<Icon name="arrow" size={15}/></Link>
          <div className="om-minor-actions">
            {delivered && <Link className="om-text-action" to={itemSlug ? `/products/${itemSlug}` : "/gifts"}><Icon name="refresh" size={16}/>Buy again</Link>}
            {delivered && <Link className="om-text-action" to={`${orderLink}#review-order`}><Icon name="star" size={16}/>Rate & review</Link>}
            {invoiceAvailable && <button className="om-text-action" type="button" disabled={invoiceDownloading} onClick={downloadInvoice}><Icon name="receipt" size={16}/>{invoiceDownloading ? "Downloading..." : "Invoice"}</button>}
            <Link className="om-text-action" to={`/account/support?orderId=${encodeURIComponent(order._id)}`}><Icon name="help" size={16}/>Help</Link>
          </div>
          {invoiceError && <p className="om-error" role="alert">{invoiceError}</p>}
        </div>
      </div>
    </article>
  );
};

const EmptyOrders = () => (
  <div className="om-empty">
    <span className="om-empty-icon"><Icon name="bag" size={29}/></span>
    <h2>You haven't placed any orders yet</h2>
    <p>Discover gifts and hampers for your next special occasion.</p>
    <Link className="om-primary" to="/gifts">Explore gifts <Icon name="arrow" size={16}/></Link>
  </div>
);

export default Orders;
