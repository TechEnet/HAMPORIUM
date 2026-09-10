import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const Dashboard = () => {
  const { user } = useAuth();

  const firstName =
    user?.name?.trim()?.split(/\s+/)?.[0] || "Customer";

  return (
    <div
      className="mx-auto w-full max-w-[1400px] text-[#171717]"
      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}
    >
      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <header className="flex flex-col gap-5 border-b border-black/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#B08A2E]">
            My Account
          </p>

          <h1
            style={{ fontFamily: DISPLAY_FONT }}
            className="mt-1 text-[44px] font-semibold leading-none tracking-[-0.04em] sm:text-[50px]"
          >
            Welcome, {firstName}
          </h1>
        </div>

        <Link
          to="/gifts"
          className="group inline-flex h-[42px] w-fit items-center gap-3 border-b border-[#171717] text-[10px] font-extrabold uppercase tracking-[0.09em] text-[#171717] transition hover:border-[#F97316] hover:text-[#F97316]"
        >
          Continue Shopping

          <span className="text-[14px] transition group-hover:translate-x-1">
            →
          </span>
        </Link>
      </header>

      {/* ======================================================
          MAIN ACCOUNT AREA
      ====================================================== */}

      <section className="mt-8 overflow-hidden border border-black/[0.07] bg-white lg:grid lg:grid-cols-[1.02fr_.98fr]">
        {/* ==================================================
            ACCOUNT LINKS
        ================================================== */}

        <div className="min-w-0 px-5 py-6 sm:px-7 lg:px-8 lg:py-8">
          <div className="mb-6 flex items-center justify-between border-b border-black/[0.07] pb-4">
            <h2
              style={{ fontFamily: DISPLAY_FONT }}
              className="text-[28px] font-semibold leading-none"
            >
              Account
            </h2>

            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-black/25">
              01
            </span>
          </div>

          <nav>
            <AccountRow
              to="/account/orders"
              number="01"
              title="My Orders"
              icon={<OrderIcon />}
            />

            <AccountRow
              to="/account/payments"
              number="02"
              title="Payments"
              icon={<PaymentIcon />}
            />

            <AccountRow
              to="/account/profile"
              number="03"
              title="My Profile"
              icon={<ProfileIcon />}
              last
            />
          </nav>
        </div>

        {/* ==================================================
            NEW CUSTOM + BULK FLOW
        ================================================== */}

        <div className="relative min-w-0 overflow-hidden bg-[#171717] px-5 py-6 text-white sm:px-7 lg:px-8 lg:py-8">
          <div className="pointer-events-none absolute -right-20 top-[-80px] h-56 w-56 rounded-full border border-[#D4AF37]/10" />
          <div className="pointer-events-none absolute -right-5 top-[-20px] h-32 w-32 rounded-full border border-[#F97316]/10" />

          <div className="relative">
            <div className="mb-6 flex items-center justify-between border-b border-white/[0.09] pb-4">
              <div>
                <h2
                  style={{ fontFamily: DISPLAY_FONT }}
                  className="text-[28px] font-semibold leading-none"
                >
                  Custom & Bulk Gifting
                </h2>

                <p className="mt-2 max-w-[430px] text-[10px] font-medium leading-5 text-white/40">
                  Build one hamper design, request bulk pricing and pay only after the final quotation is accepted.
                </p>
              </div>

              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#D4AF37]">
                02
              </span>
            </div>

            <WorkspaceRow
              to="/custom-hamper"
              title="Build Your Hamper"
              subtitle="Personal order with instant checkout"
              icon={<GiftIcon />}
            />

            <WorkspaceRow
              to="/custom-hamper?mode=bulk"
              title="Start Bulk / Event Order"
              subtitle="Design first, request quotation, pay after approval"
              icon={<BulkIcon />}
            />

            <WorkspaceRow
              to="/account/corporate/rfqs"
              title="Bulk Requests"
              subtitle="Track submitted custom hamper requests"
              icon={<DocumentIcon />}
            />

            <WorkspaceRow
              to="/account/corporate/quotes"
              title="Quotations"
              subtitle="Review, request changes, accept and pay"
              icon={<QuoteIcon />}
              last
            />
          </div>
        </div>
      </section>

      {/* ======================================================
          SHOP HAMPORIUM
      ====================================================== */}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-5 border-b border-black/[0.08] pb-4">
          <h2
            style={{ fontFamily: DISPLAY_FONT }}
            className="text-[30px] font-semibold leading-none"
          >
            Shop HAMPORIUM
          </h2>

          <Link
            to="/gifts"
            className="hidden text-[9px] font-extrabold uppercase tracking-[0.09em] text-[#F97316] transition hover:text-[#171717] sm:block"
          >
            View All →
          </Link>
        </div>

        <div className="grid border-b border-black/[0.08] sm:grid-cols-2 lg:grid-cols-4">
          <ShopLink
            to="/gifts"
            number="01"
            title="All Hampers"
          />

          <ShopLink
            to="/gifts?category=diwali-hampers"
            number="02"
            title="Diwali"
          />

          <ShopLink
            to="/gifts?category=wedding-hampers"
            number="03"
            title="Wedding"
          />

          <ShopLink
            to="/gifts?category=corporate-hampers"
            number="04"
            title="Corporate"
            last
          />
        </div>
      </section>
    </div>
  );
};

/* =========================================================
   ACCOUNT ROW
========================================================= */

const AccountRow = ({
  to,
  number,
  title,
  icon,
  last = false,
}) => (
  <Link
    to={to}
    className={`group flex min-h-[82px] items-center gap-4 transition ${
      !last ? "border-b border-black/[0.07]" : ""
    }`}
  >
    <span className="w-6 shrink-0 font-serif text-[10px] italic text-[#B08A2E]">
      {number}
    </span>

    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-black/35 transition group-hover:text-[#F97316]">
      {icon}
    </span>

    <h3
      style={{ fontFamily: DISPLAY_FONT }}
      className="min-w-0 flex-1 text-[23px] font-semibold transition group-hover:translate-x-1 group-hover:text-[#F97316]"
    >
      {title}
    </h3>

    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-black/30 transition group-hover:border-[#F97316] group-hover:bg-[#F97316] group-hover:text-white">
      <ArrowIcon />
    </span>
  </Link>
);

/* =========================================================
   WORKSPACE ROW
========================================================= */

const WorkspaceRow = ({
  to,
  title,
  subtitle,
  icon,
  last = false,
}) => (
  <Link
    to={to}
    className={`group flex min-h-[86px] items-center gap-4 transition ${
      !last ? "border-b border-white/[0.09]" : ""
    }`}
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[#D4AF37]">
      {icon}
    </span>

    <div className="min-w-0 flex-1">
      <h3
        style={{ fontFamily: DISPLAY_FONT }}
        className="text-[22px] font-semibold text-white/90 transition group-hover:translate-x-1 group-hover:text-[#F97316]"
      >
        {title}
      </h3>

      {subtitle && (
        <p className="mt-1 text-[9px] font-medium leading-4 text-white/35">
          {subtitle}
        </p>
      )}
    </div>

    <span className="text-white/25 transition group-hover:translate-x-1 group-hover:text-[#F97316]">
      →
    </span>
  </Link>
);

/* =========================================================
   SHOP LINK
========================================================= */

const ShopLink = ({
  to,
  number,
  title,
  last = false,
}) => (
  <Link
    to={to}
    className={`group relative min-h-[120px] py-6 transition sm:px-5 ${
      !last ? "sm:border-r sm:border-black/[0.08]" : ""
    }`}
  >
    <span className="font-serif text-[10px] italic text-[#D4AF37]">
      {number}
    </span>

    <div className="mt-5 flex items-end justify-between gap-3">
      <h3
        style={{ fontFamily: DISPLAY_FONT }}
        className="text-[23px] font-semibold transition group-hover:text-[#F97316]"
      >
        {title}
      </h3>

      <span className="mb-1 text-black/20 transition group-hover:translate-x-1 group-hover:text-[#F97316]">
        →
      </span>
    </div>

    <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#F97316] transition-all duration-300 group-hover:w-full" />
  </Link>
);

/* =========================================================
   ICON BASE
========================================================= */

const Icon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.55"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[20px] w-[20px]"
  >
    {children}
  </svg>
);

const OrderIcon = () => (
  <Icon>
    <path d="M5 7h14l-1 13H6L5 7Z" />
    <path d="M9 9V5a3 3 0 0 1 6 0v4" />
  </Icon>
);

const PaymentIcon = () => (
  <Icon>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18M7 15h4" />
  </Icon>
);

const ProfileIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6" />
  </Icon>
);

const GiftIcon = () => (
  <Icon>
    <path d="M4 10h16v10H4V10Z" />
    <path d="M3 7h18v4H3V7ZM12 7v13" />
    <path d="M12 7H8.6A2.6 2.6 0 1 1 11 4.4L12 7Zm0 0h3.4A2.6 2.6 0 1 0 13 4.4L12 7Z" />
  </Icon>
);

const BulkIcon = () => (
  <Icon>
    <path d="M5 5h6v6H5V5ZM13 5h6v6h-6V5ZM5 13h6v6H5v-6ZM13 13h6v6h-6v-6Z" />
  </Icon>
);

const DocumentIcon = () => (
  <Icon>
    <path d="M6 3h8l4 4v14H6V3Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
);

const QuoteIcon = () => (
  <Icon>
    <path d="M5 5h14v14H5V5Z" />
    <path d="M8 9h8M8 13h5M8 16h3" />
  </Icon>
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
    <path d="M5 10h9M11 7l3 3-3 3" />
  </svg>
);

export default Dashboard;
