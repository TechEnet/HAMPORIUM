import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import formatDate from "../../utils/formatDate.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await api.get("/admin/dashboard");
        setData(response.data);
      } catch (error) {
        setError(
          error.response?.data?.message ||
            "Unable to load dashboard"
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const paidRate = useMemo(() => {
    const total = Number(data?.stats?.orders?.total || 0);
    const paid = Number(data?.stats?.orders?.paid || 0);

    if (!total) return 0;

    return Math.round((paid / total) * 100);
  }, [data]);

  const productActiveRate = useMemo(() => {
    const total = Number(data?.stats?.products?.total || 0);
    const active = Number(data?.stats?.products?.active || 0);

    if (!total) return 0;

    return Math.round((active / total) * 100);
  }, [data]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
        {error || "Unable to load dashboard"}
      </div>
    );
  }

  const { stats, recentOrders = [] } = data;

  const totalOrders = Number(stats?.orders?.total || 0);
  const paidOrders = Number(stats?.orders?.paid || 0);
  const pendingFulfilment = Number(
    stats?.orders?.pendingFulfilment || 0
  );

  const totalProducts = Number(stats?.products?.total || 0);
  const activeProducts = Number(stats?.products?.active || 0);
  const inactiveProducts = Math.max(
    totalProducts - activeProducts,
    0
  );

  const capturedPayments = Number(
    stats?.payments?.captured || 0
  );

  const totalUsers = Number(stats?.totalUsers || 0);

  return (
    <div
      className="mx-auto w-full max-w-[1600px] pb-12 text-[#171717]"
      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}
    >
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <header className="flex flex-col gap-6 border-b border-black/[0.07] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#F97316]" />

            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
              Admin Control Center
            </p>
          </div>

          <h1
            style={{ fontFamily: DISPLAY_FONT }}
            className="mt-2 text-[42px] font-semibold leading-[0.95] tracking-[-0.035em] sm:text-[50px]"
          >
            Dashboard
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/45">
            A clear overview of sales, orders, fulfilment,
            customers and catalogue health.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <QuickLink to="/admin/orders">
            Orders
          </QuickLink>

          <QuickLink to="/admin/catalog/products">
            Products
          </QuickLink>

          <QuickLink to="/admin/payments">
            Payments
          </QuickLink>

          <QuickLink
            to="/admin/production"
            primary
          >
            Production
          </QuickLink>
        </div>
      </header>

      {/* =====================================================
          BUSINESS OVERVIEW
      ===================================================== */}

      <section className="mt-7 overflow-hidden rounded-[28px] bg-[#171717] text-white shadow-[0_18px_55px_rgba(23,23,23,0.14)]">
        <div className="grid lg:grid-cols-[1.2fr_1fr]">
          <div className="relative overflow-hidden p-6 sm:p-8 lg:p-10">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/[0.04]" />
            <div className="absolute -right-8 -top-10 h-48 w-48 rounded-full border border-[#D4AF37]/10" />

            <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#D4AF37]">
              Total Revenue
            </p>

            <p className="mt-4 break-words text-[38px] font-black leading-none tracking-[-0.045em] sm:text-[48px] lg:text-[54px]">
              {formatCurrency(stats.totalRevenue || 0)}
            </p>

            <p className="mt-4 max-w-md text-xs leading-5 text-white/40">
              Revenue currently recorded by the HAMPORIUM
              admin dashboard.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              <OverviewTag>
                {paidOrders} paid orders
              </OverviewTag>

              <OverviewTag>
                {pendingFulfilment} pending fulfilment
              </OverviewTag>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-white/[0.08] lg:border-l lg:border-t-0">
            <HeroStat
              label="Total Orders"
              value={totalOrders}
              icon={<OrdersIcon />}
            />

            <HeroStat
              label="Customers"
              value={totalUsers}
              icon={<UsersIcon />}
              borderLeft
            />

            <HeroStat
              label="Products"
              value={totalProducts}
              icon={<ProductIcon />}
              borderTop
            />

            <HeroStat
              label="Captured Payments"
              value={capturedPayments}
              icon={<PaymentIcon />}
              borderLeft
              borderTop
            />
          </div>
        </div>
      </section>

      {/* =====================================================
          ACTION CENTER
      ===================================================== */}

      <section className="mt-7 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
        <SectionHeading
          eyebrow="Operations"
          title="Action Center"
          description="The most important areas that may need admin attention."
        />

        <div className="grid md:grid-cols-3">
          <ActionItem
            icon={<PackageIcon />}
            label="Pending Fulfilment"
            value={pendingFulfilment}
            description={
              pendingFulfilment > 0
                ? "Orders still waiting to move through fulfilment."
                : "No orders currently waiting for fulfilment."
            }
            to="/admin/orders"
            alert={pendingFulfilment > 0}
          />

          <ActionItem
            icon={<ProductIcon />}
            label="Inactive Products"
            value={inactiveProducts}
            description={
              inactiveProducts > 0
                ? "Products currently outside the active catalogue."
                : "All catalogue products are active."
            }
            to="/admin/catalog/products"
            borderLeft
          />

          <ActionItem
            icon={<PaymentIcon />}
            label="Captured Payments"
            value={capturedPayments}
            description="Successfully captured payments recorded by the system."
            to="/admin/payments"
            borderLeft
            gold
          />
        </div>
      </section>

      {/* =====================================================
          BUSINESS HEALTH
      ===================================================== */}

      <section className="mt-7 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
        <SectionHeading
          eyebrow="Performance"
          title="Business Health"
          description="Quick health indicators across orders and catalogue."
        />

        <div className="grid lg:grid-cols-2">
          <PerformanceBlock
            title="Order Payment Rate"
            value={`${paidRate}%`}
            progress={paidRate}
            description="Percentage of recorded orders currently marked as paid."
            stats={[
              ["Total Orders", totalOrders],
              ["Paid Orders", paidOrders],
              ["Pending Fulfilment", pendingFulfilment],
            ]}
          />

          <PerformanceBlock
            title="Catalogue Active Rate"
            value={`${productActiveRate}%`}
            progress={productActiveRate}
            description="Percentage of catalogue products currently active."
            stats={[
              ["Total Products", totalProducts],
              ["Active Products", activeProducts],
              ["Inactive", inactiveProducts],
            ]}
            borderLeft
            gold
          />
        </div>
      </section>

      {/* =====================================================
          RECENT ORDERS
      ===================================================== */}

      <section className="mt-7 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] px-5 py-5 sm:px-7">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#F97316]">
              Latest Activity
            </p>

            <h2
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-1 text-[27px] font-semibold leading-none tracking-[-0.02em]"
            >
              Recent Orders
            </h2>

            <p className="mt-2 text-xs text-black/40">
              Latest customer orders and payment state.
            </p>
          </div>

          <Link
            to="/admin/orders"
            className="group inline-flex items-center gap-2 rounded-xl border border-black/[0.08] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/55 transition hover:border-[#F97316] hover:text-[#F97316]"
          >
            View All Orders

            <span className="transition group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>

        {!recentOrders.length ? (
          <div className="flex min-h-[260px] items-center justify-center px-6 py-12">
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1E8] text-[#F97316]">
                <OrdersIcon />
              </span>

              <p className="mt-4 text-sm font-bold text-[#171717]">
                No orders yet
              </p>

              <p className="mt-1 text-xs text-black/35">
                New orders will appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[1.5fr_.75fr_.8fr_.8fr_60px] gap-5 bg-[#FAFAF9] px-7 py-3.5 lg:grid">
              <TableLabel>Order</TableLabel>
              <TableLabel>Total</TableLabel>
              <TableLabel>Status</TableLabel>
              <TableLabel>Payment</TableLabel>
              <TableLabel />
            </div>

            <div className="divide-y divide-black/[0.055]">
              {recentOrders.map((order) => (
                <div
                  key={order._id}
                  className="px-5 py-5 transition hover:bg-[#FFF9F2]/45 sm:px-7 lg:grid lg:grid-cols-[1.5fr_.75fr_.8fr_.8fr_60px] lg:items-center lg:gap-5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E8] text-[#F97316]">
                        <OrdersIcon />
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-[#171717]">
                          {order.orderNumber}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="truncate text-[10px] font-medium text-black/40">
                            {order.user?.name ||
                              order.user?.email ||
                              "Customer"}
                          </p>

                          <span className="h-1 w-1 rounded-full bg-black/15" />

                          <p className="text-[9px] text-black/30">
                            {formatDate(
                              order.createdAt,
                              true
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 lg:mt-0">
                    <MobileLabel>
                      Order Total
                    </MobileLabel>

                    <p className="text-xs font-extrabold text-[#171717]">
                      {formatCurrency(
                        order.totalAmount
                      )}
                    </p>
                  </div>

                  <div className="mt-4 lg:mt-0">
                    <MobileLabel>
                      Order Status
                    </MobileLabel>

                    <StatusBadge
                      status={order.status}
                    />
                  </div>

                  <div className="mt-4 lg:mt-0">
                    <MobileLabel>
                      Payment
                    </MobileLabel>

                    <StatusBadge
                      status={
                        order.paymentStatus
                      }
                    />
                  </div>

                  <div className="mt-4 lg:mt-0 lg:text-right">
                    <Link
                      to={`/admin/orders/${order._id}`}
                      aria-label={`View order ${order.orderNumber}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.08] text-black/35 transition hover:border-[#F97316] hover:bg-[#F97316] hover:text-white"
                    >
                      <ArrowIcon />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

/* =========================================================
   PAGE UI
========================================================= */

const SectionHeading = ({
  eyebrow,
  title,
  description,
}) => (
  <div className="border-b border-black/[0.06] px-5 py-5 sm:px-7">
    <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#F97316]">
      {eyebrow}
    </p>

    <h2
      style={{ fontFamily: DISPLAY_FONT }}
      className="mt-1 text-[27px] font-semibold leading-none tracking-[-0.02em]"
    >
      {title}
    </h2>

    <p className="mt-2 text-xs leading-5 text-black/40">
      {description}
    </p>
  </div>
);

/* =========================================================
   QUICK LINKS
========================================================= */

const QuickLink = ({
  to,
  children,
  primary = false,
}) => (
  <Link
    to={to}
    className={`inline-flex h-[40px] items-center justify-center rounded-xl px-4 text-[9px] font-extrabold uppercase tracking-[0.08em] transition ${
      primary
        ? "bg-[#171717] text-white hover:bg-[#F97316]"
        : "border border-black/[0.08] bg-white text-black/55 hover:border-[#F97316] hover:text-[#F97316]"
    }`}
  >
    {children}
  </Link>
);

/* =========================================================
   HERO
========================================================= */

const OverviewTag = ({ children }) => (
  <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.06em] text-white/55">
    {children}
  </span>
);

const HeroStat = ({
  label,
  value,
  icon,
  borderLeft = false,
  borderTop = false,
}) => (
  <div
    className={`flex min-h-[150px] flex-col justify-between p-5 sm:p-6 ${
      borderLeft ? "border-l border-white/[0.08]" : ""
    } ${
      borderTop ? "border-t border-white/[0.08]" : ""
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <p className="max-w-[110px] text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/35">
        {label}
      </p>

      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-[#F97316]">
        {icon}
      </span>
    </div>

    <p className="mt-5 text-[28px] font-black leading-none tracking-[-0.04em]">
      {value}
    </p>
  </div>
);

/* =========================================================
   ACTION CENTER
========================================================= */

const ActionItem = ({
  icon,
  label,
  value,
  description,
  to,
  borderLeft = false,
  alert = false,
  gold = false,
}) => (
  <Link
    to={to}
    className={`group relative p-5 transition hover:bg-[#FFF9F2]/50 sm:p-6 ${
      borderLeft
        ? "border-t border-black/[0.06] md:border-l md:border-t-0"
        : ""
    }`}
  >
    {alert && (
      <span className="absolute inset-y-0 left-0 w-[3px] bg-[#F97316]" />
    )}

    <div className="flex items-start justify-between gap-4">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          gold
            ? "bg-[#D4AF37]/10 text-[#A9812C]"
            : "bg-[#FFF1E8] text-[#F97316]"
        }`}
      >
        {icon}
      </span>

      <span className="text-black/20 transition group-hover:translate-x-1 group-hover:text-[#F97316]">
        →
      </span>
    </div>

    <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.09em] text-black/35">
      {label}
    </p>

    <p className="mt-2 text-[30px] font-black leading-none tracking-[-0.04em]">
      {value}
    </p>

    <p className="mt-3 max-w-xs text-[11px] leading-5 text-black/40">
      {description}
    </p>
  </Link>
);

/* =========================================================
   PERFORMANCE
========================================================= */

const PerformanceBlock = ({
  title,
  value,
  progress,
  description,
  stats,
  borderLeft = false,
  gold = false,
}) => (
  <div
    className={`p-5 sm:p-7 ${
      borderLeft
        ? "border-t border-black/[0.06] lg:border-l lg:border-t-0"
        : ""
    }`}
  >
    <div className="flex items-start justify-between gap-5">
      <div>
        <h3 className="text-sm font-extrabold text-[#171717]">
          {title}
        </h3>

        <p className="mt-2 max-w-md text-[11px] leading-5 text-black/40">
          {description}
        </p>
      </div>

      <p
        className={`shrink-0 text-[30px] font-black leading-none tracking-[-0.045em] ${
          gold
            ? "text-[#A9812C]"
            : "text-[#F97316]"
        }`}
      >
        {value}
      </p>
    </div>

    <div className="mt-6 h-[7px] overflow-hidden rounded-full bg-black/[0.05]">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          gold
            ? "bg-[#D4AF37]"
            : "bg-[#F97316]"
        }`}
        style={{
          width: `${Math.min(progress, 100)}%`,
        }}
      />
    </div>

    <div className="mt-6 grid grid-cols-3 divide-x divide-black/[0.07]">
      {stats.map(([label, statValue]) => (
        <CompactStat
          key={label}
          label={label}
          value={statValue}
        />
      ))}
    </div>
  </div>
);

const CompactStat = ({
  label,
  value,
}) => (
  <div className="px-3 first:pl-0 last:pr-0 sm:px-5">
    <p className="text-[8px] font-extrabold uppercase tracking-[0.09em] text-black/30">
      {label}
    </p>

    <p className="mt-2 text-[20px] font-black leading-none tracking-[-0.03em]">
      {value}
    </p>
  </div>
);

/* =========================================================
   TABLE
========================================================= */

const TableLabel = ({
  children,
}) => (
  <p className="text-[8px] font-extrabold uppercase tracking-[0.11em] text-black/30">
    {children}
  </p>
);

const MobileLabel = ({
  children,
}) => (
  <p className="mb-1.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-black/25 lg:hidden">
    {children}
  </p>
);

/* =========================================================
   LOADING
========================================================= */

const DashboardSkeleton = () => (
  <div className="mx-auto w-full max-w-[1600px]">
    <div className="animate-pulse border-b border-black/[0.06] pb-7">
      <div className="h-3 w-32 rounded bg-black/[0.04]" />
      <div className="mt-3 h-12 w-60 rounded-lg bg-black/[0.05]" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-black/[0.035]" />
    </div>

    <div className="mt-7 h-[320px] animate-pulse rounded-[28px] bg-[#171717]/95" />

    <div className="mt-7 h-[230px] animate-pulse rounded-[24px] bg-white" />

    <div className="mt-7 h-[300px] animate-pulse rounded-[24px] bg-white" />

    <div className="mt-7 h-[400px] animate-pulse rounded-[24px] bg-white" />
  </div>
);

/* =========================================================
   ICONS
========================================================= */

const IconBase = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[18px] w-[18px]"
  >
    {children}
  </svg>
);

const OrdersIcon = () => (
  <IconBase>
    <path d="M5 4h14v16H5V4Z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </IconBase>
);

const PackageIcon = () => (
  <IconBase>
    <path d="m12 3 8 4-8 4-8-4 8-4Z" />
    <path d="M4 7v10l8 4 8-4V7M12 11v10" />
  </IconBase>
);

const UsersIcon = () => (
  <IconBase>
    <circle cx="9" cy="8" r="3" />
    <circle cx="16.5" cy="9" r="2.2" />
    <path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6M14 14c3.4.1 5.4 1.8 6 5" />
  </IconBase>
);

const ProductIcon = () => (
  <IconBase>
    <path d="m12 3 8 4-8 4-8-4 8-4Z" />
    <path d="M4 7v10l8 4 8-4V7M12 11v10" />
  </IconBase>
);

const PaymentIcon = () => (
  <IconBase>
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2"
    />
    <path d="M3 10h18M7 15h4" />
  </IconBase>
);

const ArrowIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <path d="M6 10h8M11 7l3 3-3 3" />
  </svg>
);

export default Dashboard;