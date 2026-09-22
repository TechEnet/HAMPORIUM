import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const Dashboard = () => {
  const { user } = useAuth();

  const firstName =
    user?.name?.trim()?.split(/\s+/)?.[0] || "Customer";

  const fullName =
    user?.name?.trim() || "HAMPORIUM Customer";

  return (
    <main
      className="hd-dashboard w-full overflow-hidden text-[#171717]"
      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}
    >
      <style>{`
        .hd-dashboard {
          --hd-orange: #F47822;
          --hd-gold: #D4AF37;
          --hd-deep-gold: #A87912;
          --hd-ink: #171717;
          --hd-cream: #FFF9F1;
          --hd-line: rgba(23, 23, 23, 0.08);

          min-height: 100vh;

          background:
            radial-gradient(
              circle at 90% 7%,
              rgba(212, 175, 55, 0.08),
              transparent 24%
            ),
            radial-gradient(
              circle at 7% 45%,
              rgba(244, 120, 34, 0.035),
              transparent 24%
            ),
            linear-gradient(
              180deg,
              #fffdf9 0%,
              #faf5ee 100%
            );
        }

        /* =====================================================
           REVEAL
        ===================================================== */

        .hd-reveal {
          animation:
            hdReveal 0.7s
            cubic-bezier(0.22, 1, 0.36, 1)
            both;
        }

        .hd-delay-1 {
          animation-delay: 0.08s;
        }

        .hd-delay-2 {
          animation-delay: 0.16s;
        }

        @keyframes hdReveal {
          from {
            opacity: 0;
            transform: translate3d(0, 18px, 0);
          }

          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        /* =====================================================
           PREMIUM HERO
        ===================================================== */

        .hd-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;

          min-height: 430px;

          border:
            1px solid
            rgba(23, 23, 23, 0.055);

          background:
            linear-gradient(
              100deg,
              rgba(255,255,255,0.98) 0%,
              rgba(255,255,255,0.94) 42%,
              rgba(250,244,234,0.93) 100%
            );

          box-shadow:
            0 18px 65px rgba(53, 38, 20, 0.04);
        }

        .hd-hero::before {
          content: "";

          position: absolute;
          inset: 0;

          z-index: -5;

          background:
            linear-gradient(
              rgba(23,23,23,0.022) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(23,23,23,0.022) 1px,
              transparent 1px
            );

          background-size:
            48px 48px;

          mask-image:
            linear-gradient(
              90deg,
              transparent 0%,
              transparent 37%,
              black 70%,
              black 100%
            );
        }

        .hd-hero::after {
          content: "H";

          position: absolute;

          right: -36px;
          bottom: -128px;

          z-index: -4;

          color:
            rgba(187, 143, 38, 0.055);

          font-family: ${DISPLAY_FONT};
          font-size:
            clamp(
              330px,
              34vw,
              570px
            );

          font-style: italic;
          font-weight: 600;

          line-height: 0.75;

          pointer-events: none;
        }

        .hd-hero-glow {
          position: absolute;

          z-index: -3;

          right: 4%;
          top: 50%;

          width: 470px;
          height: 470px;

          transform:
            translateY(-50%);

          border-radius: 999px;

          background:
            radial-gradient(
              circle,
              rgba(241, 190, 64, 0.17) 0%,
              rgba(244, 120, 34, 0.055) 38%,
              transparent 71%
            );

          filter: blur(4px);

          pointer-events: none;
        }

        .hd-hero-glow::before {
          content: "";

          position: absolute;

          inset: 15%;

          border-radius: inherit;

          background:
            rgba(255, 255, 255, 0.45);

          filter: blur(45px);
        }

        /* =====================================================
           HERO TYPOGRAPHY
        ===================================================== */

        .hd-kicker-line {
          background:
            linear-gradient(
              90deg,
              var(--hd-orange),
              var(--hd-gold)
            );

          box-shadow:
            0 0 14px
            rgba(212, 175, 55, 0.25);
        }

        .hd-hero-title {
          text-wrap: balance;
        }

        .hd-gold-word {
          position: relative;

          display: inline-block;

          background:
            linear-gradient(
              125deg,
              #B17E10 0%,
              #D4AF37 48%,
              #A9740E 100%
            );

          -webkit-background-clip: text;
          background-clip: text;

          color: transparent;
        }

        .hd-gold-word::after {
          content: "";

          position: absolute;

          left: 5%;
          right: 3%;
          bottom: -4px;

          height: 1px;

          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(212,175,55,.55),
              transparent
            );
        }

        /* =====================================================
           HERO ART STAGE
        ===================================================== */

        .hd-art-stage {
          position: absolute;

          right:
            clamp(
              20px,
              4vw,
              76px
            );

          top: 50%;

          width:
            clamp(
              390px,
              38vw,
              610px
            );

          height:
            clamp(
              300px,
              29vw,
              430px
            );

          transform:
            translateY(-50%);

          pointer-events: none;
        }

        /* =====================================================
           ORBIT SYSTEM
        ===================================================== */

        .hd-orbit {
          position: absolute;

          border:
            1px solid
            rgba(190, 145, 34, 0.16);

          border-radius: 50%;
        }

        .hd-orbit-one {
          inset: 6% 7% 4% 9%;

          transform:
            rotate(-14deg);

          animation:
            hdOrbitOne 18s
            linear infinite;
        }

        .hd-orbit-two {
          inset: 15% 16% 11% 1%;

          border-color:
            rgba(244,120,34,0.10);

          transform:
            rotate(16deg);

          animation:
            hdOrbitTwo 24s
            linear infinite;
        }

        .hd-orbit-three {
          inset: 23% 4% 21% 24%;

          border-style: dashed;
          border-color:
            rgba(212,175,55,0.14);

          transform:
            rotate(-23deg);
        }

        @keyframes hdOrbitOne {
          to {
            transform:
              rotate(346deg);
          }
        }

        @keyframes hdOrbitTwo {
          to {
            transform:
              rotate(-344deg);
          }
        }

        /* =====================================================
           SPARKS
        ===================================================== */

        .hd-spark {
          position: absolute;

          z-index: 5;

          width: 7px;
          height: 7px;

          border-radius: 50%;

          background:
            #D6AE38;

          box-shadow:
            0 0 0 5px
              rgba(212,175,55,0.07),
            0 0 20px
              rgba(212,175,55,0.28);
        }

        .hd-spark-one {
          left: 17%;
          top: 17%;

          animation:
            hdSparkFloat 4.2s
            ease-in-out infinite;
        }

        .hd-spark-two {
          right: 7%;
          bottom: 27%;

          width: 5px;
          height: 5px;

          animation:
            hdSparkFloat 5.3s
            ease-in-out infinite reverse;
        }

        .hd-spark-three {
          right: 25%;
          top: 7%;

          width: 4px;
          height: 4px;

          background:
            #F47822;

          animation:
            hdSparkFloat 4.7s
            ease-in-out infinite;
        }

        @keyframes hdSparkFloat {
          0%,
          100% {
            transform:
              translateY(0)
              scale(1);
          }

          50% {
            transform:
              translateY(-9px)
              scale(1.2);
          }
        }

        /* =====================================================
           MAIN GIFT OBJECT
        ===================================================== */

        .hd-gift-shell {
          position: absolute;

          z-index: 4;

          left: 50%;
          top: 51%;

          width: 59%;
          height: 47%;

          transform:
            translate(-50%, -50%)
            rotate(-5deg)
            skewY(-1deg);

          border:
            1px solid
            rgba(155, 105, 34, 0.2);

          border-radius:
            12px;

          background:
            linear-gradient(
              140deg,
              #F8E8D0 0%,
              #FDF5E9 36%,
              #ECD0A8 100%
            );

          box-shadow:
            0 42px 65px
              rgba(79, 51, 20, 0.14),
            0 15px 25px
              rgba(79, 51, 20, 0.07),
            inset 0 1px 0
              rgba(255,255,255,0.92);
        }

        .hd-gift-shell::before {
          content: "";

          position: absolute;

          inset: 10px;

          border:
            1px solid
            rgba(255,255,255,0.6);

          border-radius:
            8px;

          pointer-events: none;
        }

        .hd-gift-shell::after {
          content: "";

          position: absolute;

          left: 4%;
          right: 4%;
          top: 8%;

          height: 34%;

          border-radius:
            9px 9px 50% 50%;

          background:
            linear-gradient(
              180deg,
              rgba(255,255,255,0.48),
              transparent
            );

          opacity: 0.8;
        }

        /* =====================================================
           RIBBON
        ===================================================== */

        .hd-ribbon-vertical {
          position: absolute;

          z-index: 4;

          top: -1px;
          bottom: -1px;

          left: 47%;

          width: 10%;

          background:
            linear-gradient(
              90deg,
              #C8941D 0%,
              #F0CF64 48%,
              #B98314 100%
            );

          box-shadow:
            inset 1px 0
              rgba(255,255,255,0.25),
            inset -1px 0
              rgba(94,58,6,0.11);
        }

        .hd-ribbon-horizontal {
          position: absolute;

          z-index: 5;

          left: -1px;
          right: -1px;

          top: 47%;

          height: 11%;

          background:
            linear-gradient(
              180deg,
              #EBCB5B,
              #B98617 62%,
              #D7AD35
            );

          box-shadow:
            0 2px 5px
              rgba(91,61,12,0.12);
        }

        /* =====================================================
           BOW
        ===================================================== */

        .hd-bow-center {
          position: absolute;

          z-index: 8;

          left: 52%;
          top: 51%;

          width: 46px;
          height: 46px;

          transform:
            translate(-50%, -50%);

          border-radius: 50%;

          background:
            radial-gradient(
              circle at 35% 30%,
              #F1D069,
              #BF8E1E 72%
            );

          box-shadow:
            0 10px 18px
              rgba(88,57,11,0.18);
        }

        .hd-bow-loop {
          position: absolute;

          z-index: 7;

          top: 38%;

          width: 82px;
          height: 45px;

          border:
            11px solid
            #E3BB46;

          border-radius:
            70% 54% 70% 54%;

          background:
            transparent;

          box-shadow:
            inset 0 0 0 1px
              rgba(255,255,255,0.15);
        }

        .hd-bow-left {
          right: 50%;

          transform:
            rotate(14deg);
        }

        .hd-bow-right {
          left: 52%;

          transform:
            rotate(-14deg)
            scaleX(-1);
        }

        /* =====================================================
           FLOATING LABELS
        ===================================================== */

        .hd-floating-card {
          position: absolute;

          z-index: 9;

          display: flex;
          align-items: center;

          min-height: 54px;

          border:
            1px solid
            rgba(23,23,23,0.08);

          background:
            rgba(255,255,255,0.83);

          backdrop-filter:
            blur(14px);

          box-shadow:
            0 14px 35px
              rgba(70,50,30,0.08);
        }

        .hd-card-top {
          right: 3%;
          top: 15%;

          padding:
            10px 15px;

          animation:
            hdFloatCard 5.2s
            ease-in-out infinite;
        }

        .hd-card-bottom {
          left: 5%;
          bottom: 15%;

          padding:
            10px 16px;

          animation:
            hdFloatCard 6s
            ease-in-out infinite reverse;
        }

        @keyframes hdFloatCard {
          0%,
          100% {
            transform:
              translateY(0);
          }

          50% {
            transform:
              translateY(-8px);
          }
        }

        .hd-card-number {
          display: flex;

          width: 29px;
          height: 29px;

          align-items: center;
          justify-content: center;

          margin-right: 10px;

          border:
            1px solid
            rgba(212,175,55,0.22);

          border-radius: 50%;

          font-family:
            Georgia,
            serif;

          font-size: 10px;
          font-style: italic;

          color:
            #B2831A;

          background:
            rgba(212,175,55,0.05);
        }

        .hd-card-eyebrow {
          font-size: 7px;
          font-weight: 800;

          letter-spacing: .19em;

          text-transform: uppercase;

          color:
            rgba(23,23,23,0.35);
        }

        .hd-card-title {
          margin-top: 2px;

          font-family: ${DISPLAY_FONT};

          font-size: 17px;
          font-weight: 600;

          line-height: 1;

          color:
            #191919;
        }

        /* =====================================================
           SMALL ART CAPTION
        ===================================================== */

        .hd-art-caption {
          position: absolute;

          z-index: 3;

          right: 5%;
          bottom: 2%;

          display: flex;
          align-items: center;

          gap: 10px;

          font-size: 7px;
          font-weight: 800;

          letter-spacing: .22em;

          text-transform: uppercase;

          color:
            rgba(23,23,23,0.27);
        }

        .hd-art-caption::before {
          content: "";

          width: 36px;
          height: 1px;

          background:
            linear-gradient(
              90deg,
              #D4AF37,
              transparent
            );
        }

        /* =====================================================
           CTA
        ===================================================== */

        .hd-cta {
          position: relative;

          overflow: hidden;

          transition:
            transform .38s
              cubic-bezier(.22,1,.36,1),
            background-color .3s ease,
            border-color .3s ease,
            color .3s ease,
            box-shadow .3s ease;
        }

        .hd-cta::after {
          content: "";

          position: absolute;
          inset: 0;

          background:
            linear-gradient(
              110deg,
              transparent 32%,
              rgba(255,255,255,.22) 50%,
              transparent 68%
            );

          transform:
            translateX(-140%);

          transition:
            transform .8s
            cubic-bezier(.16,1,.3,1);
        }

        .hd-cta:hover::after {
          transform:
            translateX(140%);
        }

        .hd-primary-cta:hover {
          transform:
            translateY(-3px);

          box-shadow:
            0 16px 30px
            rgba(244,120,34,0.17);
        }

        .hd-secondary-cta:hover {
          transform:
            translateX(3px);
        }

        /* =====================================================
           PANELS
        ===================================================== */

        .hd-account-panel,
        .hd-workspace {
          width: 100%;
          min-width: 0;
          min-height: 100%;
        }

        .hd-account-panel {
          background:
            rgba(255,255,255,.6);

          backdrop-filter:
            blur(10px);
        }

        /* =====================================================
           ACCOUNT ROW
        ===================================================== */

        .hd-account-row {
          position: relative;

          width: 100%;

          overflow: hidden;

          transition:
            transform .4s
              cubic-bezier(.22,1,.36,1),
            background-color .3s ease;
        }

        .hd-account-row::before {
          content: "";

          position: absolute;

          left: 0;
          bottom: 0;

          width: 0;
          height: 2px;

          background:
            linear-gradient(
              90deg,
              var(--hd-orange),
              var(--hd-gold)
            );

          transition:
            width .5s
            cubic-bezier(.22,1,.36,1);
        }

        .hd-account-row:hover {
          transform:
            translateX(4px);

          background:
            rgba(244,120,34,.03);
        }

        .hd-account-row:hover::before {
          width: 100%;
        }

        /* =====================================================
           WORKSPACE
        ===================================================== */

        .hd-workspace {
          position: relative;

          isolation: isolate;
          overflow: hidden;

          background:
            radial-gradient(
              circle at 86% 14%,
              rgba(212,175,55,.15),
              transparent 27%
            ),
            radial-gradient(
              circle at 8% 90%,
              rgba(244,120,34,.09),
              transparent 28%
            ),
            linear-gradient(
              145deg,
              #1c1915 0%,
              #0f0f0e 53%,
              #19140f 100%
            );
        }

        .hd-workspace::before {
          content: "";

          position: absolute;
          inset: 10px;

          z-index: -1;

          border:
            1px solid
            rgba(212,175,55,.1);

          pointer-events: none;
        }

        .hd-workspace::after {
          content: "GIFT";

          position: absolute;

          right: -18px;
          bottom: -32px;

          z-index: -2;

          color:
            rgba(212,175,55,.032);

          font-family:
            ${DISPLAY_FONT};

          font-size:
            clamp(
              110px,
              14vw,
              215px
            );

          font-style: italic;

          line-height: .72;

          pointer-events: none;
        }

        .hd-workspace-row {
          position: relative;

          width: 100%;

          overflow: hidden;

          transition:
            transform .4s
              cubic-bezier(.22,1,.36,1),
            background-color .3s ease;
        }

        .hd-workspace-row::before {
          content: "";

          position: absolute;

          left: 0;
          bottom: 0;

          width: 0;
          height: 2px;

          background:
            linear-gradient(
              90deg,
              var(--hd-orange),
              var(--hd-gold)
            );

          transition:
            width .5s
            cubic-bezier(.22,1,.36,1);
        }

        .hd-workspace-row:hover {
          transform:
            translateX(4px);

          background:
            rgba(255,255,255,.025);
        }

        .hd-workspace-row:hover::before {
          width: 100%;
        }

        .hd-workspace-icon {
          transition:
            transform .45s
              cubic-bezier(.22,1,.36,1),
            color .3s ease;
        }

        .hd-workspace-row:hover
        .hd-workspace-icon {
          transform:
            rotate(-5deg)
            scale(1.06);

          color:
            #F0D16A;
        }

        /* =====================================================
           ARROW
        ===================================================== */

        .hd-arrow {
          transition:
            transform .4s
              cubic-bezier(.22,1,.36,1),
            border-color .3s ease,
            background-color .3s ease,
            color .3s ease;
        }

        .hd-account-row:hover
        .hd-arrow,
        .hd-workspace-row:hover
        .hd-arrow {
          transform:
            translateX(3px);
        }

        /* =====================================================
           RESPONSIVE
        ===================================================== */

        @media (max-width: 1180px) {
          .hd-art-stage {
            right: -30px;

            width: 470px;

            opacity: .78;
          }
        }

        @media (max-width: 1023px) {
          .hd-hero {
            min-height: 390px;
          }

          .hd-art-stage {
            right: -110px;

            width: 440px;

            opacity: .42;
          }

          .hd-card-top,
          .hd-card-bottom,
          .hd-art-caption {
            display: none;
          }
        }

        @media (max-width: 767px) {
          .hd-hero {
            min-height: auto;
          }

          .hd-art-stage {
            position: relative;

            right: auto;
            top: auto;

            width: 100%;
            height: 230px;

            margin-top: 20px;

            transform: none;

            opacity: .82;
          }

          .hd-gift-shell {
            width: 58%;
            height: 48%;
          }

          .hd-hero::after {
            right: -45px;
            bottom: -80px;

            font-size: 300px;
          }

          .hd-hero-glow {
            right: -160px;

            width: 390px;
            height: 390px;
          }

          .hd-workspace::before {
            inset: 7px;
          }
        }

        @media (
          prefers-reduced-motion:
          reduce
        ) {
          .hd-reveal,
          .hd-orbit-one,
          .hd-orbit-two,
          .hd-spark,
          .hd-floating-card {
            animation:
              none !important;
          }

          .hd-account-row,
          .hd-workspace-row,
          .hd-workspace-icon,
          .hd-arrow,
          .hd-cta,
          .hd-cta::after {
            transition:
              none !important;
          }
        }
      `}</style>

      <div
        className="
          mx-auto
          w-full
          max-w-[1580px]
          px-4
          pb-10
          sm:px-6
          sm:pb-12
          lg:px-8
          xl:px-10
          2xl:px-12
        "
      >
        {/* =====================================================
            PREMIUM WELCOME HERO
        ===================================================== */}

        <section
          className="
            hd-hero
            hd-reveal
            mt-0
            w-full
          "
        >
          <div className="hd-hero-glow" />

          <div
            className="
              relative
              z-10
              flex
              min-h-[430px]
              w-full
              items-center
              px-6
              py-10
              sm:px-9
              lg:px-12
              xl:px-14
            "
          >
            {/* ===============================================
                LEFT CONTENT
            =============================================== */}

            <div
              className="
                relative
                z-20
                w-full
                max-w-[760px]
                lg:max-w-[58%]
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-4
                "
              >
                <span
                  className="
                    hd-kicker-line
                    h-px
                    w-12
                  "
                />

                <p
                  className="
                    text-[9px]
                    font-black
                    uppercase
                    tracking-[0.28em]
                    text-[#976D0E]
                  "
                >
                  My HAMPORIUM
                </p>
              </div>

              <h1
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="
                  hd-hero-title
                  mt-5
                  text-[clamp(58px,6.5vw,104px)]
                  font-semibold
                  leading-[0.77]
                  tracking-[-0.06em]
                  text-[#151515]
                "
              >
                Welcome,

                <span
                  className="
                    hd-gold-word
                    mt-1
                    block
                    italic
                  "
                >
                  {firstName}.
                </span>
              </h1>

              <div
                className="
                  mt-7
                  flex
                  max-w-[600px]
                  items-start
                  gap-4
                "
              >
                <span
                  className="
                    mt-[7px]
                    h-[5px]
                    w-[5px]
                    shrink-0
                    rounded-full
                    bg-[#D4AF37]
                  "
                />

                <p
                  className="
                    text-[12px]
                    font-semibold
                    leading-6
                    text-black/43
                    sm:text-[13px]
                  "
                >
                  Manage your orders,
                  payments, profile and
                  custom gifting from one
                  place.
                </p>
              </div>

              <div
                className="
                  mt-7
                  flex
                  flex-wrap
                  items-center
                  gap-x-6
                  gap-y-3
                "
              >
                <Link
                  to="/gifts"
                  className="
                    hd-cta
                    hd-primary-cta
                    inline-flex
                    min-h-[50px]
                    items-center
                    gap-5
                    border
                    border-[#171717]
                    bg-[#171717]
                    px-6
                    text-[9px]
                    font-black
                    uppercase
                    tracking-[0.14em]
                    text-white
                    hover:border-[#F47822]
                    hover:bg-[#F47822]
                  "
                >
                  Continue Shopping

                  <span
                    className="
                      text-[15px]
                    "
                  >
                    →
                  </span>
                </Link>

                <Link
                  to="/account/profile"
                  className="
                    hd-cta
                    hd-secondary-cta
                    inline-flex
                    min-h-[50px]
                    items-center
                    gap-4
                    border-b
                    border-black/20
                    px-2
                    text-[9px]
                    font-black
                    uppercase
                    tracking-[0.14em]
                    text-black/48
                    hover:border-[#D4AF37]
                    hover:text-[#A87912]
                  "
                >
                  View Profile

                  <span>
                    ↗
                  </span>
                </Link>
              </div>
            </div>

            {/* ===============================================
                RIGHT ART
            =============================================== */}

            <div
              className="hd-art-stage"
              aria-hidden="true"
            >
              <div className="hd-orbit hd-orbit-one" />
              <div className="hd-orbit hd-orbit-two" />
              <div className="hd-orbit hd-orbit-three" />

              <span className="hd-spark hd-spark-one" />
              <span className="hd-spark hd-spark-two" />
              <span className="hd-spark hd-spark-three" />

              {/* TOP FLOATING CARD */}

              <div className="hd-floating-card hd-card-top">
                <span className="hd-card-number">
                  01
                </span>

                <div>
                  <p className="hd-card-eyebrow">
                    Curated
                  </p>

                  <p className="hd-card-title">
                    Premium Gifting
                  </p>
                </div>
              </div>

              {/* MAIN GIFT */}

              <div className="hd-gift-shell">
                <span className="hd-ribbon-vertical" />
                <span className="hd-ribbon-horizontal" />

                <span className="hd-bow-loop hd-bow-left" />
                <span className="hd-bow-loop hd-bow-right" />
                <span className="hd-bow-center" />
              </div>

              {/* BOTTOM CARD */}

              <div className="hd-floating-card hd-card-bottom">
                <span className="hd-card-number">
                  H
                </span>

                <div>
                  <p className="hd-card-eyebrow">
                    Designed for
                  </p>

                  <p className="hd-card-title">
                    Every Moment
                  </p>
                </div>
              </div>

              <div className="hd-art-caption">
                The art of gifting
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            DASHBOARD CONTENT
        ===================================================== */}

        <section
          className="
            mt-7
            grid
            w-full
            items-stretch
            gap-5
            lg:grid-cols-[0.86fr_1.14fr]
            xl:gap-7
          "
        >
          {/* =================================================
              ACCOUNT
          ================================================= */}

          <div
            className="
              hd-account-panel
              hd-reveal
              hd-delay-1
              w-full
              border-y
              border-black/[0.08]
              px-4
              py-6
              sm:px-6
              lg:px-7
              lg:py-7
            "
          >
            <div
              className="
                flex
                w-full
                items-end
                justify-between
                gap-4
                border-b
                border-black/[0.07]
                pb-5
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
                    text-[8px]
                    font-black
                    uppercase
                    tracking-[0.18em]
                    text-[#B08A2E]
                  "
                >
                  Account
                </p>

                <h2
                  style={{
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                  className="
                    mt-1
                    text-[34px]
                    font-semibold
                    leading-none
                    tracking-[-0.035em]
                    sm:text-[38px]
                  "
                >
                  Your essentials
                </h2>
              </div>

              <span
                className="
                  hidden
                  max-w-[150px]
                  truncate
                  text-right
                  text-[8px]
                  font-black
                  uppercase
                  tracking-[0.12em]
                  text-black/25
                  sm:block
                "
              >
                {fullName}
              </span>
            </div>

            <nav className="w-full">
              <AccountRow
                to="/account/orders"
                number="01"
                title="My Orders"
                subtitle="Track deliveries and view your previous purchases"
                icon={<OrderIcon />}
              />

              <AccountRow
                to="/account/payments"
                number="02"
                title="Payments"
                subtitle="View payment records and transaction details"
                icon={<PaymentIcon />}
              />

              <AccountRow
                to="/account/profile"
                number="03"
                title="My Profile"
                subtitle="Manage your account and profile information"
                icon={<ProfileIcon />}
                last
              />
            </nav>
          </div>

          {/* =================================================
              GIFTING STUDIO
          ================================================= */}

          <div
            className="
              hd-workspace
              hd-reveal
              hd-delay-2
              w-full
              min-w-0
              px-5
              py-6
              text-white
              sm:px-7
              lg:px-8
              lg:py-7
              xl:px-9
            "
          >
            <div
              className="
                relative
                z-10
                w-full
                border-b
                border-white/[0.09]
                pb-6
              "
            >
              <div className="w-full">
                <div
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                  "
                >
                  <span
                    className="
                      h-px
                      w-8
                      shrink-0
                      bg-gradient-to-r
                      from-[#F47822]
                      to-[#D4AF37]
                    "
                  />

                  <p
                    className="
                      text-[8px]
                      font-black
                      uppercase
                      tracking-[0.19em]
                      text-[#D7B94F]
                    "
                  >
                    Gifting Studio
                  </p>
                </div>

                <h2
                  style={{
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                  className="
                    mt-3
                    w-full
                    max-w-none
                    text-[38px]
                    font-semibold
                    leading-[0.94]
                    tracking-[-0.045em]
                    text-[#F6E9C8]
                    sm:text-[46px]
                    lg:text-[48px]
                    xl:text-[52px]
                    2xl:text-[56px]
                  "
                >
                  Custom & Bulk{" "}

                  <span
                    className="
                      italic
                      text-[#D4AF37]
                    "
                  >
                    gifting.
                  </span>
                </h2>
              </div>
            </div>

            <div
              className="
                relative
                z-10
                w-full
              "
            >
              <WorkspaceRow
                to="/custom-hamper"
                title="Build Your Hamper"
                subtitle="Create your hamper and checkout instantly"
                icon={<GiftIcon />}
              />

              <WorkspaceRow
                to="/custom-hamper?mode=bulk"
                title="Start Bulk / Event Order"
                subtitle="Create a requirement and request a quotation"
                icon={<BulkIcon />}
              />

              <WorkspaceRow
                to="/account/corporate/rfqs"
                title="Bulk Requests"
                subtitle="Track your submitted gifting requirements"
                icon={<DocumentIcon />}
              />

              <WorkspaceRow
                to="/account/corporate/quotes"
                title="Quotations"
                subtitle="Review, accept or request quotation changes"
                icon={<QuoteIcon />}
                last
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

/* =========================================================
   ACCOUNT ROW
========================================================= */

const AccountRow = ({
  to,
  number,
  title,
  subtitle,
  icon,
  last = false,
}) => {
  return (
    <Link
      to={to}
      className={`
        hd-account-row
        group
        flex
        w-full
        min-h-[96px]
        items-center
        gap-4
        px-1
        py-4

        ${
          !last
            ? "border-b border-black/[0.07]"
            : ""
        }
      `}
    >
      <span
        className="
          w-7
          shrink-0
          font-serif
          text-[11px]
          italic
          text-[#B08A2E]
        "
      >
        {number}
      </span>

      <span
        className="
          flex
          h-11
          w-11
          shrink-0
          items-center
          justify-center
          border
          border-black/[0.07]
          bg-[#FFFCF8]
          text-black/40
          transition

          group-hover:border-[#F47822]/30
          group-hover:text-[#F47822]
        "
      >
        {icon}
      </span>

      <div
        className="
          min-w-0
          w-full
          flex-1
        "
      >
        <h3
          style={{
            fontFamily:
              DISPLAY_FONT,
          }}
          className="
            text-[24px]
            font-semibold
            leading-none
            tracking-[-0.02em]
            transition

            group-hover:text-[#F47822]
          "
        >
          {title}
        </h3>

        <p
          className="
            mt-2
            w-full
            text-[9px]
            font-semibold
            leading-4
            text-black/38
          "
        >
          {subtitle}
        </p>
      </div>

      <span
        className="
          hd-arrow
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-full
          border
          border-black/[0.09]
          text-black/30
          transition

          group-hover:border-[#F47822]
          group-hover:bg-[#F47822]
          group-hover:text-white
        "
      >
        <ArrowIcon />
      </span>
    </Link>
  );
};

/* =========================================================
   WORKSPACE ROW
========================================================= */

const WorkspaceRow = ({
  to,
  title,
  subtitle,
  icon,
  last = false,
}) => {
  return (
    <Link
      to={to}
      className={`
        hd-workspace-row
        group
        flex
        w-full
        min-h-[94px]
        items-center
        gap-5
        px-1
        py-3

        ${
          !last
            ? "border-b border-white/[0.09]"
            : ""
        }
      `}
    >
      <span
        className="
          hd-workspace-icon
          flex
          h-11
          w-11
          shrink-0
          items-center
          justify-center
          border
          border-[#D4AF37]/20
          bg-[#D4AF37]/[0.05]
          text-[#D4AF37]
        "
      >
        {icon}
      </span>

      <div
        className="
          min-w-0
          w-full
          flex-1
        "
      >
        <h3
          style={{
            fontFamily:
              DISPLAY_FONT,
          }}
          className="
            w-full
            text-[24px]
            font-semibold
            leading-none
            text-[#F7EBCB]
            transition
            sm:text-[25px]

            group-hover:text-[#E8C85C]
          "
        >
          {title}
        </h3>

        {subtitle && (
          <p
            className="
              mt-2
              w-full
              max-w-none
              text-[9px]
              font-medium
              leading-4
              text-white/36
              sm:text-[10px]
            "
          >
            {subtitle}
          </p>
        )}
      </div>

      <span
        className="
          hd-arrow
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-full
          border
          border-white/[0.10]
          text-white/30
          transition

          group-hover:border-[#D4AF37]/40
          group-hover:text-[#D4AF37]
        "
      >
        <ArrowIcon />
      </span>
    </Link>
  );
};

/* =========================================================
   ICON BASE
========================================================= */

const Icon = ({
  children,
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="
        h-[20px]
        w-[20px]
      "
      aria-hidden="true"
    >
      {children}
    </svg>
  );
};

/* =========================================================
   ICONS
========================================================= */

const OrderIcon = () => (
  <Icon>
    <path d="M5 7h14l-1 13H6L5 7Z" />

    <path d="M9 9V5a3 3 0 0 1 6 0v4" />
  </Icon>
);

const PaymentIcon = () => (
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

const ProfileIcon = () => (
  <Icon>
    <circle
      cx="12"
      cy="8"
      r="3.5"
    />

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
    className="
      h-4
      w-4
    "
    aria-hidden="true"
  >
    <path d="M5 10h9M11 7l3 3-3 3" />
  </svg>
);

export default Dashboard;