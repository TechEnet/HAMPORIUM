import {
  useEffect,
  useState,
} from "react";

import {
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

import {
  StatusPill,
} from "../components/partner/PartnerUI.jsx";

import logo from "../assets/images/logo_dark.jpeg";


/* =========================================================
   TRANSPARENT LOGO
========================================================= */

const useTransparentLogo = (source) => {
  const [
    processedLogo,
    setProcessedLogo,
  ] = useState(source);


  useEffect(() => {
    if (!source) {
      return;
    }


    let cancelled = false;

    const image =
      new Image();


    const isWhitePixel = (
      r,
      g,
      b
    ) => {
      const max =
        Math.max(
          r,
          g,
          b
        );

      const min =
        Math.min(
          r,
          g,
          b
        );


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
          document.createElement(
            "canvas"
          );


        canvas.width =
          image.naturalWidth;

        canvas.height =
          image.naturalHeight;


        const context =
          canvas.getContext(
            "2d",
            {
              willReadFrequently:
                true,
            }
          );


        if (!context) {
          return;
        }


        context.drawImage(
          image,
          0,
          0
        );


        const imageData =
          context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );


        const data =
          imageData.data;

        const width =
          canvas.width;

        const height =
          canvas.height;


        const visited =
          new Uint8Array(
            width * height
          );

        const queue = [];


        const pushPixel = (
          x,
          y
        ) => {
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


          if (
            visited[
              pixelIndex
            ]
          ) {
            return;
          }


          const dataIndex =
            pixelIndex * 4;

          const r =
            data[dataIndex];

          const g =
            data[
              dataIndex + 1
            ];

          const b =
            data[
              dataIndex + 2
            ];


          if (
            !isWhitePixel(
              r,
              g,
              b
            )
          ) {
            return;
          }


          visited[
            pixelIndex
          ] = 1;


          queue.push(
            pixelIndex
          );
        };


        for (
          let x = 0;
          x < width;
          x += 1
        ) {
          pushPixel(
            x,
            0
          );

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
          pushPixel(
            0,
            y
          );

          pushPixel(
            width - 1,
            y
          );
        }


        let index = 0;


        while (
          index <
          queue.length
        ) {
          const pixelIndex =
            queue[index];

          index += 1;


          const x =
            pixelIndex %
            width;

          const y =
            Math.floor(
              pixelIndex /
                width
            );


          data[
            pixelIndex *
              4 +
              3
          ] = 0;


          pushPixel(
            x + 1,
            y
          );

          pushPixel(
            x - 1,
            y
          );

          pushPixel(
            x,
            y + 1
          );

          pushPixel(
            x,
            y - 1
          );
        }


        context.putImageData(
          imageData,
          0,
          0
        );


        const transparent =
          canvas.toDataURL(
            "image/png"
          );


        if (!cancelled) {
          setProcessedLogo(
            transparent
          );
        }

      } catch (error) {
        console.warn(
          "Partner logo transparency error:",
          error
        );


        if (!cancelled) {
          setProcessedLogo(
            source
          );
        }
      }
    };


    image.onerror = () => {
      if (!cancelled) {
        setProcessedLogo(
          source
        );
      }
    };


    image.src =
      source;


    return () => {
      cancelled =
        true;
    };
  }, [source]);


  return processedLogo;
};


/* =========================================================
   RESTRICTED PARTNER ROUTES
========================================================= */

const restrictedPrefixes = [
  "/partner/projects",
  "/partner/showcases",
  "/partner/client-actions",
  "/partner/orders",
  "/partner/commissions",
  "/partner/payouts",
  "/partner/analytics",
];


/* =========================================================
   PARTNER LAYOUT
========================================================= */

const PartnerLayout = () => {
  const {
    user,
    partner,
    logout,
  } = useAuth();


  const navigate =
    useNavigate();

  const location =
    useLocation();


  const transparentLogo =
    useTransparentLogo(
      logo
    );


  const approved =
    partner?.status ===
    "approved";


  const restricted =
    restrictedPrefixes.some(
      (prefix) =>
        location.pathname.startsWith(
          prefix
        )
    );


  /* ======================================================
     PENDING / NON-APPROVED ACCESS
  ====================================================== */

  if (
    !approved &&
    (
      location.pathname ===
        "/partner" ||
      restricted
    )
  ) {
    return (
      <Navigate
        to="/partner/status"
        replace
      />
    );
  }


  /* ======================================================
     LOGOUT
  ====================================================== */

  const handleLogout =
    async () => {
      await logout();


      navigate(
        "/partner/login",
        {
          replace: true,
        }
      );
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
        lg:grid-cols-[292px_minmax(0,1fr)]
        lg:overflow-hidden
      "
    >

      {/* ==================================================
          SIDEBAR
      =================================================== */}

      <aside
        className="
          min-w-0
          bg-[#111111]
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

          {/* ==================================================
              BRAND
          =================================================== */}

          <button
            type="button"
            onClick={() =>
              navigate(
                approved
                  ? "/partner"
                  : "/partner/status"
              )
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
                  flex-1
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
                    Partner Portal
                  </p>

                </div>

              </div>

            </div>


            {/* PARTNER INFO */}

            <div
              className="
                mt-5
                border-t
                border-white/[0.06]
                pt-4
              "
            >

              <StatusPill
                value={
                  partner?.status
                }
              />


              <p
                className="
                  mt-3
                  truncate
                  text-[12px]
                  font-bold
                  text-white/75
                "
              >
                {partner?.businessName ||
                  user?.name ||
                  "HAMPORIUM Partner"}
              </p>


              {partner?.partnerId && (
                <p
                  className="
                    mt-1
                    truncate
                    text-[9px]
                    font-medium
                    tracking-[0.04em]
                    text-white/30
                  "
                >
                  {partner.partnerId}
                </p>
              )}

            </div>

          </button>


          {/* ==================================================
              NAVIGATION
          =================================================== */}

          <nav
            className="
              flex-1
              pb-3
              pt-2
            "
          >

            {!approved ? (
              <>

                <Section
                  number="01"
                  first
                >
                  Application
                </Section>


                <NavItem
                  end
                  to="/partner/status"
                  label="Application Status"
                  icon="◎"
                />


                <NavItem
                  to="/partner/profile"
                  label="Partner Profile"
                  icon="◇"
                />


                <NavItem
                  to="/partner/documents"
                  label="Verification Documents"
                  icon="▥"
                />

              </>
            ) : (
              <>

                {/* DASHBOARD */}

                <NavItem
                  end
                  to="/partner"
                  label="Dashboard"
                  icon="◈"
                />


                {/* CLIENT WORK */}

                <Section
                  number="01"
                  first
                >
                  Client Work
                </Section>


                <NavItem
                  to="/partner/projects"
                  label="Projects"
                  icon="▤"
                />


                <NavItem
                  to="/partner/showcases"
                  label="Showcases"
                  icon="▣"
                />


                <NavItem
                  to="/partner/client-actions"
                  label="Client Actions"
                  icon="✦"
                />


                {/* COMMERCE */}

                <Section number="02">
                  Commerce
                </Section>


                <NavItem
                  to="/partner/orders"
                  label="Attributed Orders"
                  icon="□"
                />


                <NavItem
                  to="/partner/commissions"
                  label="Commissions"
                  icon="₹"
                />


                <NavItem
                  to="/partner/payouts"
                  label="Payouts"
                  icon="↗"
                />


                {/* BUSINESS */}

                <Section number="03">
                  Business
                </Section>


                <NavItem
                  to="/partner/analytics"
                  label="Analytics"
                  icon="⌁"
                />


                <NavItem
                  to="/partner/documents"
                  label="Documents"
                  icon="▥"
                />


                <NavItem
                  to="/partner/profile"
                  label="Profile & Team"
                  icon="○"
                />

              </>
            )}

          </nav>


          {/* ==================================================
              PARTNER USER + ACTIONS
          =================================================== */}

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
                min-w-0
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
                  "Partner"}
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


            <div
              className="
                mt-4
                flex
                gap-2
              "
            >

              <button
                type="button"
                onClick={() =>
                  navigate("/")
                }
                className="
                  flex-1
                  rounded-lg
                  border
                  border-white/10
                  px-3
                  py-2
                  text-[9px]
                  font-bold
                  text-white/55
                  transition

                  hover:border-[#D4AF37]/40
                  hover:bg-white/[0.04]
                  hover:text-white
                "
              >
                Store
              </button>


              <button
                type="button"
                onClick={
                  handleLogout
                }
                className="
                  flex-1
                  rounded-lg
                  border
                  border-red-400/20
                  px-3
                  py-2
                  text-[9px]
                  font-bold
                  text-red-300
                  transition

                  hover:border-red-400/40
                  hover:bg-red-500/[0.08]
                  hover:text-red-200
                "
              >
                Logout
              </button>

            </div>

          </div>

        </div>

      </aside>


      {/* ==================================================
          CONTENT
      =================================================== */}

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
    className={({
      isActive,
    }) =>
      `
        group
        relative
        flex
        min-h-[44px]
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
            : "text-white/45 hover:bg-white/[0.04] hover:text-white"
        }
      `
    }
  >

    {({
      isActive,
    }) => (
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
            rounded-lg
            border
            text-[12px]
            transition

            ${
              isActive
                ? "border-[#F97316]/30 bg-[#F97316]/10 text-[#F97316]"
                : "border-white/[0.06] text-white/25 group-hover:border-[#D4AF37]/20 group-hover:text-[#D4AF37]"
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
   SECTION
========================================================= */

const Section = ({
  number,
  children,
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


export default PartnerLayout;