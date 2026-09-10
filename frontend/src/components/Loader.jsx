import { useEffect, useState } from "react";

import logoLight from "../assets/images/logo_dark.jpeg";

// ======================================================
// PREPARE TRANSPARENT LOGO BEFORE IT IS EVER SHOWN
// ======================================================

const useTransparentLogo = (source) => {
  const [state, setState] = useState({
    src: "",
    ready: false,
  });

  useEffect(() => {
    if (!source) {
      setState({
        src: "",
        ready: false,
      });

      return undefined;
    }

    let cancelled = false;
    const image = new Image();

    const isWhitePixel = (r, g, b) => {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      return (
        r > 218 &&
        g > 218 &&
        b > 218 &&
        max - min < 30
      );
    };

    image.onload = () => {
      try {
        const canvas =
          document.createElement("canvas");

        canvas.width =
          image.naturalWidth;

        canvas.height =
          image.naturalHeight;

        const context =
          canvas.getContext("2d", {
            willReadFrequently: true,
          });

        if (!context) {
          if (!cancelled) {
            setState({
              src: "",
              ready: false,
            });
          }

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
            visited[pixelIndex]
          ) {
            return;
          }

          const dataIndex =
            pixelIndex * 4;

          const r =
            data[dataIndex];

          const g =
            data[dataIndex + 1];

          const b =
            data[dataIndex + 2];

          if (
            !isWhitePixel(
              r,
              g,
              b
            )
          ) {
            return;
          }

          visited[pixelIndex] = 1;

          queue.push(
            pixelIndex
          );
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

        const transparent =
          canvas.toDataURL(
            "image/png"
          );

        if (!cancelled) {
          setState({
            src: transparent,
            ready: true,
          });
        }
      } catch (error) {
        console.warn(
          "Loader logo transparency error:",
          error
        );

        /*
          Important:
          Never fall back to the original JPEG here,
          otherwise its white background can flash.
        */
        if (!cancelled) {
          setState({
            src: "",
            ready: false,
          });
        }
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        setState({
          src: "",
          ready: false,
        });
      }
    };

    image.src = source;

    return () => {
      cancelled = true;
    };
  }, [source]);

  return state;
};

// ======================================================
// LOADER
// ======================================================

const Loader = ({
  fullscreen = false,
}) => {
  const {
    src: transparentLogo,
    ready: logoReady,
  } = useTransparentLogo(
    logoLight
  );

  if (!fullscreen) {
    return (
      <div className="flex min-h-[180px] items-center justify-center bg-transparent">
        <div className="relative flex h-[88px] w-[180px] items-center justify-center">
          {logoReady && (
            <img
              src={transparentLogo}
              alt="HAMPORIUM"
              draggable="false"
              className="hp-mini-logo h-[62px] w-[150px] object-contain"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="hp-loader-root fixed inset-0 z-[9999] overflow-hidden bg-[#030303]">
      <style>
        {`
          @keyframes hpLogoEnter {
            0% {
              opacity: 0;
              transform:
                translate3d(
                  0,
                  10px,
                  0
                )
                scale(.965);
            }

            100% {
              opacity: 1;
              transform:
                translate3d(
                  0,
                  0,
                  0
                )
                scale(1);
            }
          }

          @keyframes hpLogoFloat {
            0%, 100% {
              transform:
                translate3d(
                  0,
                  0,
                  0
                );
            }

            50% {
              transform:
                translate3d(
                  0,
                  -4px,
                  0
                );
            }
          }

          @keyframes hpGlowPulse {
            0%, 100% {
              opacity: .22;
              transform:
                translate3d(
                  -50%,
                  -50%,
                  0
                )
                scale(.92);
            }

            50% {
              opacity: .48;
              transform:
                translate3d(
                  -50%,
                  -50%,
                  0
                )
                scale(1.06);
            }
          }

          @keyframes hpOrbit {
            to {
              transform:
                rotate(360deg);
            }
          }

          @keyframes hpOrbitReverse {
            to {
              transform:
                rotate(-360deg);
            }
          }

          .hp-loader-logo {
            backface-visibility:
              hidden;

            transform:
              translateZ(0);

            animation:
              hpLogoEnter .55s
              cubic-bezier(.16,1,.3,1)
              both,
              hpLogoFloat 2.8s
              ease-in-out .55s
              infinite;
          }

          .hp-loader-glow {
            animation:
              hpGlowPulse 2.9s
              ease-in-out infinite;
          }

          .hp-loader-orbit {
            animation:
              hpOrbit 12s
              linear infinite;
          }

          .hp-loader-orbit-reverse {
            animation:
              hpOrbitReverse 18s
              linear infinite;
          }

          .hp-mini-logo {
            animation:
              hpLogoFloat 2.8s
              ease-in-out infinite;
          }

          @media (
            prefers-reduced-motion:
            reduce
          ) {
            .hp-loader-logo,
            .hp-loader-glow,
            .hp-loader-orbit,
            .hp-loader-orbit-reverse,
            .hp-mini-logo {
              animation:
                none !important;
            }
          }
        `}
      </style>

      {/* Pure dark background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(212,175,55,.055), transparent 26%), linear-gradient(145deg,#020202 0%,#070503 52%,#020202 100%)",
        }}
      />

      {/* Only subtle atmosphere behind logo */}
      <span className="hp-loader-glow pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] rounded-full bg-[#D4AF37]/10 blur-[92px] sm:h-[390px] sm:w-[390px]" />

      <div className="relative z-10 flex min-h-[100svh] items-center justify-center px-5">
        <div className="relative flex h-[270px] w-[270px] items-center justify-center sm:h-[340px] sm:w-[340px]">
          {/* Very subtle premium motion only */}
          <span className="hp-loader-orbit pointer-events-none absolute inset-[18px] rounded-full border border-transparent border-t-[#D4AF37]/24 border-r-white/[0.025]" />

          <span className="hp-loader-orbit-reverse pointer-events-none absolute inset-[54px] rounded-full border border-transparent border-b-[#F97316]/14 border-l-white/[0.025]" />

          {/* 
            The JPEG itself is NEVER rendered.
            Logo appears only after the transparent PNG is ready,
            so there is no white flash at startup.
          */}
          {logoReady && (
            <img
              src={transparentLogo}
              alt="HAMPORIUM"
              draggable="false"
              className="hp-loader-logo relative z-10 h-[96px] w-[225px] object-contain drop-shadow-[0_12px_34px_rgba(0,0,0,.55)] sm:h-[118px] sm:w-[280px]"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Loader;
