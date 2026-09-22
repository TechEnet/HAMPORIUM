import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import logo from "../assets/images/logo_dark.jpeg";

/* =========================================================
   TRANSPARENT LOGO
========================================================= */

const useTransparentLogo = (source) => {
  const [processedLogo, setProcessedLogo] =
    useState(source);

  useEffect(() => {
    if (!source) return undefined;

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
        const canvas =
          document.createElement("canvas");

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext(
          "2d",
          {
            willReadFrequently: true,
          }
        );

        if (!context) return;

        context.drawImage(image, 0, 0);

        const imageData =
          context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );

        const data = imageData.data;

        const width = canvas.width;
        const height = canvas.height;

        const visited =
          new Uint8Array(width * height);

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

          if (visited[pixelIndex]) {
            return;
          }

          const dataIndex =
            pixelIndex * 4;

          if (
            !isWhitePixel(
              data[dataIndex],
              data[dataIndex + 1],
              data[dataIndex + 2]
            )
          ) {
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
          pushPixel(
            x,
            height - 1
          );
        }

        for (
          let y = 0;
          y < height;
          y += 1
        ) {
          pushPixel(0, y);
          pushPixel(
            width - 1,
            y
          );
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

        if (!cancelled) {
          setProcessedLogo(
            canvas.toDataURL(
              "image/png"
            )
          );
        }
      } catch {
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

/* =========================================================
   NAV CLASS
========================================================= */

const navClass = ({
  isActive,
}) =>
  `
    group
    relative
    flex
    min-h-[42px]
    items-center
    gap-3
    px-6
    text-[12px]
    font-semibold
    tracking-[0.01em]
    transition-all
    duration-200

    ${
      isActive
        ? "bg-white/[0.07] text-white"
        : "text-white/50 hover:bg-white/[0.04] hover:text-white"
    }
  `;

/* =========================================================
   ACCOUNT LAYOUT
========================================================= */

const AccountLayout = () => {
  const {
    user,
    logout,
  } = useAuth();

  const navigate =
    useNavigate();

  const transparentLogo =
    useTransparentLogo(logo);

  const handleLogout =
    async () => {
      await logout();

      navigate("/");
    };

  return (
    <div
      className="
        min-h-screen
        bg-[#F7F6F3]
        text-[#171717]

        lg:grid
        lg:h-screen
        lg:min-h-0
        lg:grid-cols-[290px_minmax(0,1fr)]
        lg:overflow-hidden
      "
    >
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className="
          min-w-0
          bg-[#171717]
          text-white

          lg:h-screen
          lg:overflow-y-auto

          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        <div
          className="
            flex
            min-h-full
            flex-col
          "
        >
          {/* =================================================
              LOGO
          ================================================= */}

          <button
            type="button"
            onClick={() =>
              navigate("/")
            }
            className="
              group
              w-full
              shrink-0
              border-b
              border-white/[0.07]
              px-6
              py-5
              text-left
            "
          >
            <div
              className="
                flex
                items-center
                gap-3
              "
            >
              <img
                src={
                  transparentLogo
                }
                alt="HAMPORIUM"
                className="
                  h-[56px]
                  w-[72px]
                  shrink-0
                  object-contain
                  object-left

                  drop-shadow-[0_2px_7px_rgba(0,0,0,0.22)]

                  transition
                  duration-300

                  group-hover:scale-[1.025]
                "
              />

              <div
                className="
                  min-w-0
                "
              >
                <p
                  className="
                    font-serif
                    text-[18px]
                    font-semibold
                    tracking-[0.12em]
                    text-white
                  "
                >
                  HAMPORIUM
                </p>

                <div
                  className="
                    mt-1.5
                    flex
                    items-center
                    gap-2
                  "
                >
                  <span
                    className="
                      h-px
                      w-5
                      bg-[#D4AF37]
                    "
                  />

                  <p
                    className="
                      text-[7px]
                      font-bold
                      uppercase
                      tracking-[0.24em]
                      text-[#D4AF37]
                    "
                  >
                    Private Account
                  </p>
                </div>
              </div>
            </div>
          </button>

          {/* =================================================
              NAVIGATION
          ================================================= */}

          <nav
            className="
              flex-1
              pb-4
              pt-2
            "
          >
            <NavItem
              end
              to="/account"
              label="Dashboard"
              icon={<GridIcon />}
            />

            {/* ===============================================
                SHOPPING
            =============================================== */}

            <NavSection
              number="01"
              first
            >
              Shopping
            </NavSection>

            <NavItem
              to="/account/orders"
              label="My Orders"
              icon={<BagIcon />}
            />

            <NavItem
              to="/account/payments"
              label="Payments"
              icon={<CardIcon />}
            />

            <NavItem
              to="/account/reviews"
              label="My Reviews"
              icon={<StarIcon />}
            />

            {/* ===============================================
                CUSTOM & BULK GIFTING
            =============================================== */}

            <NavSection number="02">
              Custom & Bulk Gifting
            </NavSection>

            <NavItem
              to="/account/corporate/rfqs"
              label="Bulk Requests / RFQs"
              icon={
                <DocumentIcon />
              }
            />

            <NavItem
              to="/account/corporate/quotes"
              label="Quotations"
              icon={<QuoteIcon />}
            />

            {/* ===============================================
                MY ACCOUNT
            =============================================== */}

            <NavSection number="03">
              My Account
            </NavSection>

            <NavItem
              to="/account/profile"
              label="My Profile"
              icon={<UserIcon />}
            />

            <NavItem
              to="/account/addresses"
              label="Saved Addresses"
              icon={<PinIcon />}
            />

            <NavItem
              to="/account/refunds"
              label="Refunds"
              icon={<RefundIcon />}
            />

            <NavItem
              to="/account/support"
              label="Help & Support"
              icon={
                <SupportIcon />
              }
            />
          </nav>

          {/* =================================================
              USER FOOTER
          ================================================= */}

          <div
            className="
              shrink-0
              border-t
              border-white/[0.07]
              px-6
              py-4
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
                gap-3
              "
            >
              <div
                className="
                  min-w-0
                  flex-1
                "
              >
                <p
                  className="
                    truncate
                    font-serif
                    text-[14px]
                    font-semibold
                    text-white
                  "
                >
                  {user?.name ||
                    "Customer"}
                </p>

                <p
                  className="
                    mt-1
                    truncate
                    text-[9px]
                    font-medium
                    text-white/35
                  "
                >
                  {user?.email}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  handleLogout
                }
                title="Logout"
                aria-label="Logout"
                className="
                  group
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-white/[0.1]
                  text-white/35

                  transition

                  hover:border-red-400/30
                  hover:bg-red-500/[0.08]
                  hover:text-red-400
                "
              >
                <LogoutIcon />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* =====================================================
          PAGE CONTENT
      ===================================================== */}

      <main
        className="
          min-w-0
          bg-[#F7F6F3]

          lg:h-screen
          lg:overflow-y-auto
        "
      >
        <div
          className="
            w-full
            px-5
            py-6

            sm:px-8

            lg:px-10
            lg:py-8

            xl:px-12

            2xl:px-14
          "
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

/* =========================================================
   NAV ITEM
========================================================= */

const NavItem = ({
  to,
  label,
  icon,
  end = false,
}) => (
  <NavLink
    end={end}
    to={to}
    className={navClass}
  >
    {({ isActive }) => (
      <>
        <span
          className={`
            absolute
            bottom-2
            left-0
            top-2
            w-[3px]
            rounded-r-full
            transition

            ${
              isActive
                ? "bg-[#F97316]"
                : "bg-transparent"
            }
          `}
        />

        <span
          className={`
            flex
            h-7
            w-7
            shrink-0
            items-center
            justify-center
            transition

            ${
              isActive
                ? "text-[#F97316]"
                : "text-white/25 group-hover:text-[#D4AF37]"
            }
          `}
        >
          {icon}
        </span>

        <span
          className="
            truncate
          "
        >
          {label}
        </span>

        {isActive && (
          <span
            className="
              ml-auto
              h-1.5
              w-1.5
              rounded-full
              bg-[#D4AF37]
            "
          />
        )}
      </>
    )}
  </NavLink>
);

/* =========================================================
   NAV SECTION
========================================================= */

const NavSection = ({
  children,
  number,
  first = false,
}) => (
  <div
    className={`
      mb-1.5
      flex
      items-center
      gap-3
      px-6

      ${
        first
          ? "mt-3"
          : "mt-5"
      }
    `}
  >
    <span
      className="
        font-serif
        text-[10px]
        italic
        text-[#D4AF37]/80
      "
    >
      {number}
    </span>

    <span
      className="
        whitespace-nowrap
        text-[8px]
        font-bold
        uppercase
        tracking-[0.22em]
        text-white/25
      "
    >
      {children}
    </span>

    <span
      className="
        h-px
        flex-1
        bg-white/[0.07]
      "
    />
  </div>
);

/* =========================================================
   ICON BASE
========================================================= */

const Icon = ({
  children,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="
      h-[17px]
      w-[17px]
    "
    aria-hidden="true"
  >
    {children}
  </svg>
);

/* =========================================================
   ICONS
========================================================= */

const GridIcon = () => (
  <Icon>
    <rect
      x="4"
      y="4"
      width="6"
      height="6"
      rx="1"
    />

    <rect
      x="14"
      y="4"
      width="6"
      height="6"
      rx="1"
    />

    <rect
      x="4"
      y="14"
      width="6"
      height="6"
      rx="1"
    />

    <rect
      x="14"
      y="14"
      width="6"
      height="6"
      rx="1"
    />
  </Icon>
);

const BagIcon = () => (
  <Icon>
    <path d="M5 7h14l-1 13H6L5 7Z" />

    <path d="M9 9V5a3 3 0 0 1 6 0v4" />
  </Icon>
);

const CardIcon = () => (
  <Icon>
    <rect
      x="3"
      y="6"
      width="18"
      height="13"
      rx="2"
    />

    <path d="M3 10h18M7 15h4" />
  </Icon>
);

const StarIcon = () => (
  <Icon>
    <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
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

const UserIcon = () => (
  <Icon>
    <circle
      cx="12"
      cy="8"
      r="3.5"
    />

    <path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6" />
  </Icon>
);

const PinIcon = () => (
  <Icon>
    <path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z" />

    <circle
      cx="12"
      cy="9"
      r="2.4"
    />
  </Icon>
);

const RefundIcon = () => (
  <Icon>
    <path d="M7 7H4V4" />

    <path d="M4.5 7.5A8 8 0 1 1 4 14" />

    <path d="M8 12h8M12 8v8" />
  </Icon>
);

const SupportIcon = () => (
  <Icon>
    <path d="M4 5h16v11H8l-4 4V5Z" />

    <path d="M8 9h8M8 13h5" />
  </Icon>
);

const LogoutIcon = () => (
  <Icon>
    <path d="M10 5H5v14h5" />

    <path d="M14 8l4 4-4 4M18 12H9" />
  </Icon>
);

export default AccountLayout;