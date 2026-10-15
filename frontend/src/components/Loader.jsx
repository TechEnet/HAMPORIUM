// HAMPORIUM Loader V151
// Replace: frontend/src/components/Loader.jsx
// - Fullscreen AND inline loaders are visually centered vertically/horizontally.
// - Brand mark is 30% larger than the original in both modes.
// - ONLY the orange shield rotates. White horse and HAMPORIUM letters stay fixed.
// - The source JPEG white background is removed before anything is displayed.
// - No other component or asset is required.

import { useEffect, useState } from "react";
import logoLight from "../assets/images/logo_dark.jpeg";

const loaderLogoCache = new Map();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function prepareLogoLayers(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onerror = () => reject(new Error("The HAMPORIUM logo could not be loaded"));

    image.onload = () => {
      try {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        if (!width || !height) throw new Error("Empty logo image");

        const inputCanvas = document.createElement("canvas");
        inputCanvas.width = width;
        inputCanvas.height = height;
        const inputContext = inputCanvas.getContext("2d", { willReadFrequently: true });
        if (!inputContext) throw new Error("Canvas not supported");

        inputContext.drawImage(image, 0, 0);
        const sourceImage = inputContext.getImageData(0, 0, width, height);
        const rgba = sourceImage.data;
        const pixelCount = width * height;
        const outside = new Uint8Array(pixelCount);
        const queue = new Int32Array(pixelCount);
        let head = 0;
        let tail = 0;

        // Only white/ivory pixels CONNECTED TO THE CANVAS EDGE are removed.
        // Enclosed white lettering and the horse are kept as original artwork.
        const backgroundPixel = (pos) => {
          const i = pos * 4;
          const r = rgba[i];
          const g = rgba[i + 1];
          const b = rgba[i + 2];
          return r > 211 && g > 211 && b > 211 &&
            Math.max(r, g, b) - Math.min(r, g, b) < 34;
        };

        const visit = (pos) => {
          if (outside[pos] || !backgroundPixel(pos)) return;
          outside[pos] = 1;
          queue[tail++] = pos;
        };

        for (let x = 0; x < width; x += 1) {
          visit(x);
          visit((height - 1) * width + x);
        }
        for (let y = 0; y < height; y += 1) {
          visit(y * width);
          visit(y * width + width - 1);
        }

        while (head < tail) {
          const pos = queue[head++];
          const x = pos % width;
          if (x > 0) visit(pos - 1);
          if (x + 1 < width) visit(pos + 1);
          if (pos >= width) visit(pos - width);
          if (pos + width < pixelCount) visit(pos + width);
        }

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        let orangeR = 0;
        let orangeG = 0;
        let orangeB = 0;
        let orangeCount = 0;
        let visibleCount = 0;

        for (let pos = 0; pos < pixelCount; pos += 1) {
          if (outside[pos]) {
            rgba[pos * 4 + 3] = 0;
            continue;
          }
          const i = pos * 4;
          const a = rgba[i + 3];
          if (a < 28) continue;
          const r = rgba[i];
          const g = rgba[i + 1];
          const b = rgba[i + 2];
          const x = pos % width;
          const y = Math.floor(pos / width);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          visibleCount += 1;

          // Measure the ORIGINAL orange rather than recoloring the brand logo.
          if (r > 153 && g > 45 && g < 211 && b < 155 && r > g + 33 && g > b + 9) {
            orangeR += r;
            orangeG += g;
            orangeB += b;
            orangeCount += 1;
          }
        }

        if (maxX < minX || maxY < minY || !orangeCount ||
          visibleCount < Math.min(pixelCount * 0.004, 20)) {
          throw new Error("Unable to separate the shield from its logo artwork");
        }

        const rBase = Math.round(orangeR / orangeCount);
        const gBase = Math.round(orangeG / orangeCount);
        const bBase = Math.round(orangeB / orangeCount);

        const shieldPixels = new Uint8ClampedArray(rgba.length);
        const artworkPixels = new Uint8ClampedArray(rgba.length);

        for (let pos = 0; pos < pixelCount; pos += 1) {
          if (outside[pos]) continue;
          const i = pos * 4;
          const a = rgba[i + 3];
          if (a < 10) continue;
          const r = rgba[i];
          const g = rgba[i + 1];
          const b = rgba[i + 2];

          // The complete shield silhouette, including the original art's holes,
          // is solid orange. It alone will be transformed by CSS.
          shieldPixels[i] = rBase;
          shieldPixels[i + 1] = gBase;
          shieldPixels[i + 2] = bBase;
          shieldPixels[i + 3] = a;

          // Recover anti-aliased light artwork by estimating how much white
          // was mixed with orange at horse/letter edges. Keep it stationary.
          const whiteViaBlue = (b - bBase - 6) / Math.max(1, 245 - bBase - 6);
          const whiteViaGreen = (g - gBase - 4) / Math.max(1, 247 - gBase - 4);
          let artworkAlpha = clamp(Math.min(whiteViaBlue, whiteViaGreen), 0, 1);
          if (r < 160 || g < gBase + 5) artworkAlpha = 0;
          if (artworkAlpha < 0.035) continue;
          artworkPixels[i] = 255;
          artworkPixels[i + 1] = 251;
          artworkPixels[i + 2] = 242;
          artworkPixels[i + 3] = Math.round(a * artworkAlpha);
        }

        // Crop BOTH canvases to exactly the same painted bounds so that
        // the visual shield is truly centered, not its empty JPEG margins.
        const pad = Math.max(2, Math.round(Math.min(width, height) * 0.018));
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(width - cropX, maxX - cropX + pad + 1);
        const cropH = Math.min(height - cropY, maxY - cropY + pad + 1);

        const layerToUrl = (pixels) => {
          const full = document.createElement("canvas");
          full.width = width;
          full.height = height;
          const ctx = full.getContext("2d");
          if (!ctx) throw new Error("Cannot paint logo layer");
          const layer = ctx.createImageData(width, height);
          layer.data.set(pixels);
          ctx.putImageData(layer, 0, 0);

          const cropped = document.createElement("canvas");
          cropped.width = cropW;
          cropped.height = cropH;
          const cropCtx = cropped.getContext("2d");
          if (!cropCtx) throw new Error("Cannot crop logo layer");
          cropCtx.drawImage(full, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          return cropped.toDataURL("image/png");
        };

        resolve({ shield: layerToUrl(shieldPixels), artwork: layerToUrl(artworkPixels) });
      } catch (error) {
        reject(error);
      }
    };

    image.src = source;
  });
}

function useLogoLayers(source) {
  const [layers, setLayers] = useState(() => loaderLogoCache.get(source) || null);

  useEffect(() => {
    if (!source) return undefined;
    let active = true;
    const cached = loaderLogoCache.get(source);
    if (cached) {
      setLayers(cached);
      return undefined;
    }

    prepareLogoLayers(source).then((result) => {
      loaderLogoCache.set(source, result);
      if (active) setLayers(result);
    }).catch((error) => {
      console.warn("HAMPORIUM loader artwork:", error);
      // Intentionally don't flash the original JPEG's white backing.
      if (active) setLayers({ shield: "", artwork: "" });
    });

    return () => { active = false; };
  }, [source]);

  return layers;
}

const LOADER_STYLES = `
  .hp-loader-v151 {
    --hp-loader-ink: #403A32;
    --hp-loader-paper: #FAF8F4;
    --hp-loader-gold: #B79B6A;
    box-sizing: border-box;
    display: grid;
    place-items: center;
    width: 100%;
    margin: 0;
    isolation: isolate;
    overflow: hidden;
  }
  .hp-loader-v151 * { box-sizing: border-box; }

  /* Non-fullscreen mode was only 180px high; now it centers in a full page. */
  .hp-loader-v151.hp-loader-page {
    position: relative;
    min-height: 100vh;
    min-height: 100svh;
    background: var(--hp-loader-paper);
  }
  .hp-loader-v151.hp-loader-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 9999;
    min-height: 100vh;
    min-height: 100svh;
    background: #161715;
  }

  /* Exact viewport middle on both axes, even on unusually tall displays. */
  .hp-loader-v151 .hp-loader-center {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    min-height: 100%;
    padding: clamp(8px, 2.5vw, 20px);
  }
  .hp-loader-v151 .hp-loader-mark {
    display: block;
    position: relative;
    flex: none;
    width: 195px;  /* previous mini width 150px: +30% */
    height: 81px;  /* previous mini height 62px: +30% */
    perspective: 900px;
    transform-style: preserve-3d;
  }
  .hp-loader-v151.hp-loader-fullscreen .hp-loader-mark {
    width: 293px;  /* previous fullscreen width 225px: +30% */
    height: 125px; /* previous fullscreen height 96px: +30% */
  }
  @media (min-width: 640px) {
    .hp-loader-v151.hp-loader-fullscreen .hp-loader-mark {
      width: 364px; /* previous desktop width 280px: +30% */
      height: 154px;/* previous desktop height 118px: +30% */
    }
  }
  .hp-loader-v151 .hp-loader-shield,
  .hp-loader-v151 .hp-loader-fixed-art {
    display: block;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    background: transparent;
    border: 0;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
  }
  .hp-loader-v151 .hp-loader-shield {
    z-index: 1;
    transform-origin: 50% 50%;
    backface-visibility: visible;
    animation: hpLoaderShieldRotate 2.8s linear infinite;
  }
  .hp-loader-v151 .hp-loader-fixed-art {
    z-index: 2;
    transform: none !important;
    animation: none !important;
    filter: none !important;
  }
  @keyframes hpLoaderShieldRotate {
    0% { transform: rotateY(0deg); }
    100% { transform: rotateY(360deg); }
  }
  .hp-loader-v151 .hp-loader-text-fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font: 500 15px/1.25 Montserrat, Arial, sans-serif;
    letter-spacing: .16em;
    color: var(--hp-loader-ink);
  }
  .hp-loader-v151.hp-loader-fullscreen .hp-loader-text-fallback { color: #FAF8F4; }
  @media (prefers-reduced-motion: reduce) {
    .hp-loader-v151 .hp-loader-shield { animation: none !important; }
  }
`;

const Loader = ({ fullscreen = false }) => {
  const layers = useLogoLayers(logoLight);

  return (
    <div
      className={`hp-loader-v151 ${fullscreen ? "hp-loader-fullscreen" : "hp-loader-page"}`}
      role="status"
      aria-label="Loading HAMPORIUM"
      aria-busy="true"
    >
      <style>{LOADER_STYLES}</style>
      <div className="hp-loader-center">
        <div className="hp-loader-mark" aria-hidden="true">
          {layers?.shield ? (
            <>
              <img className="hp-loader-shield" src={layers.shield} alt="" draggable={false} />
              <img className="hp-loader-fixed-art" src={layers.artwork} alt="" draggable={false} />
            </>
          ) : layers ? (
            <span className="hp-loader-text-fallback">HAMPORIUM</span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Loader;
