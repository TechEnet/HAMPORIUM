// EXACT PATH: frontend/src/components/Loader.jsx
// HAMPORIUM Loader V153 - CODE-ONLY FIX.
// Uses the EXISTING logo_dark.jpeg. No PNGs, new assets, or image edits.
// Orange shield spins; white horse and HAMPORIUM lettering stay completely still.

import { useEffect, useState } from "react";
import logoDark from "../assets/images/logo_dark.jpeg";

// Keep a single decoded, preprocessed copy across page transitions and
// React StrictMode remounts. We never animate any canvas pixels with JS.
let layersPromise = null;
let cachedLayers = null;

const clamp01 = (n) => Math.max(0, Math.min(1, n));

function createLayersFromExistingLogo(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onerror = () => reject(new Error("Unable to load the existing HAMPORIUM logo"));

    img.onload = () => {
      try {
        // The source JPEG is 1264 x 1252. Processing a single downscaled
        // copy instead of 1.5 million pixels avoids a heavy main-thread pause.
        const maxSide = 640;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas not supported by this browser");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;

        // The original logo contains a single convex orange shield on white.
        // Find the shield's LEFT/RIGHT outline on each scanline. This prevents
        // white background from becoming part of the rotating image.
        const left = new Int32Array(height);
        const right = new Int32Array(height);
        left.fill(width);
        right.fill(-1);
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let orangePixels = 0;
        for (let y = 0; y < height; y += 1) {
          const row = y * width * 4;
          for (let x = 0; x < width; x += 1) {
            const i = row + x * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Orange pixels only; white horse, lettering and outer JPEG
            // backing MUST NOT be included in this rotating layer.
            if (r > 155 && r > g + 38 && g > b + 24 && g < 205 && b < 165) {
              if (x < left[y]) left[y] = x;
              if (x > right[y]) right[y] = x;
              rSum += r;
              gSum += g;
              bSum += b;
              orangePixels += 1;
            }
          }
        }
        if (!orangePixels) throw new Error("Orange shield not found in logo");

        const orangeR = Math.round(rSum / orangePixels);
        const orangeG = Math.round(gSum / orangePixels);
        const orangeB = Math.round(bSum / orangePixels);
        const shieldCanvas = document.createElement("canvas");
        const fixedCanvas = document.createElement("canvas");
        shieldCanvas.width = fixedCanvas.width = width;
        shieldCanvas.height = fixedCanvas.height = height;
        const shieldContext = shieldCanvas.getContext("2d");
        const fixedContext = fixedCanvas.getContext("2d");
        if (!shieldContext || !fixedContext) throw new Error("Unable to create logo layers");
        const shield = shieldContext.createImageData(width, height);
        const fixed = fixedContext.createImageData(width, height);

        for (let y = 0; y < height; y += 1) {
          const from = left[y];
          const to = right[y];
          if (to < from) continue;
          for (let x = from; x <= to; x += 1) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Draw a solid shield silhouette even beneath the white horse and
            // letters. Without this, rotating orange would have holes/jitter.
            shield.data[i] = orangeR;
            shield.data[i + 1] = orangeG;
            shield.data[i + 2] = orangeB;
            shield.data[i + 3] = 255;

            // Reconstruct the white original artwork ON A DIFFERENT canvas.
            // White antialiased edges are recovered from JPEG color mixing.
            // This entire canvas stays motionless while shield rotates.
            const whiteFromB = (b - orangeB) / Math.max(1, 255 - orangeB);
            const whiteFromG = (g - orangeG) / Math.max(1, 255 - orangeG);
            const alpha = clamp01(Math.min(whiteFromB, whiteFromG));
            if (alpha < 0.035) continue;
            fixed.data[i] = 255;
            fixed.data[i + 1] = 255;
            fixed.data[i + 2] = 255;
            fixed.data[i + 3] = Math.round(alpha * 255);
          }
        }
        shieldContext.putImageData(shield, 0, 0);
        fixedContext.putImageData(fixed, 0, 0);

        resolve({
          shieldUrl: shieldCanvas.toDataURL("image/png"),
          fixedUrl: fixedCanvas.toDataURL("image/png"),
        });
      } catch (error) {
        reject(error);
      }
    };
    img.src = src;
  });
}

function loadLogoOnce() {
  if (cachedLayers) return Promise.resolve(cachedLayers);
  if (!layersPromise) {
    layersPromise = createLayersFromExistingLogo(logoDark)
      .then((layers) => {
        cachedLayers = layers;
        return layers;
      })
      .catch((error) => {
        // Allow a retry on the next mount, rather than caching a broken state.
        layersPromise = null;
        throw error;
      });
  }
  return layersPromise;
}

const LOADER_CSS = `
  .hp-loader-v153, .hp-loader-v153 * { box-sizing: border-box; }
  .hp-loader-v153 {
    display: grid; place-items: center; isolation: isolate;
    width: 100%; margin: 0; overflow: hidden;
    background: #FAF8F4;
  }
  .hp-loader-v153.hp-loader-page {
    position: relative; min-height: 100vh; min-height: 100svh;
  }
  .hp-loader-v153.hp-loader-fullscreen {
    position: fixed; inset: 0; z-index: 9999;
    min-height: 100vh; min-height: 100svh; background: #161715;
  }
  .hp-loader-v153 .hp-loader-center {
    display: grid; place-items: center; width: 100%; min-height: 100%;
    padding: 16px;
  }
  /* 30% larger visible logo compared with V151 (81 / 125 / 154px).
     The JPEG logo is square, so width AND height must match! */
  .hp-loader-v153 .hp-loader-mark {
    position: relative; width: 106px; height: 106px;
    aspect-ratio: 1; flex-shrink: 0; isolation: isolate;
    perspective: 1100px; contain: layout style;
  }
  .hp-loader-v153.hp-loader-fullscreen .hp-loader-mark {
    width: 163px; height: 163px;
  }
  @media (min-width: 640px) {
    .hp-loader-v153.hp-loader-fullscreen .hp-loader-mark {
      width: 201px; height: 201px;
    }
  }
  .hp-loader-v153 .hp-loader-shield,
  .hp-loader-v153 .hp-loader-static {
    position: absolute; inset: 0; display: block;
    width: 100%; height: 100%; object-fit: contain;
    pointer-events: none; user-select: none; -webkit-user-drag: none;
    background: none; border: 0;
  }
  .hp-loader-v153 .hp-loader-shield {
    z-index: 1; transform-origin: 50% 50%;
    backface-visibility: visible; will-change: transform;
    animation: hpShieldSpinV153 3.1s linear infinite;
  }
  .hp-loader-v153 .hp-loader-static {
    z-index: 2; transform: none !important; animation: none !important;
    will-change: auto;
  }
  /* On the pale inline-loader background, keep white lettering legible
     even at the instant the rotating shield is edge-on. */
  .hp-loader-v153.hp-loader-page .hp-loader-static {
    filter: drop-shadow(0 0 1px rgba(30, 25, 20, .5));
  }
  @keyframes hpShieldSpinV153 {
    from { transform: rotateY(0deg) translateZ(0); }
    to { transform: rotateY(360deg) translateZ(0); }
  }
  .hp-loader-v153 .hp-loader-fallback {
    display: grid; place-items: center; width: 100%; height: 100%;
    color: #453E36; font: 700 13px/1.3 Montserrat, Arial, sans-serif;
    letter-spacing: .14em; text-align: center;
  }
  .hp-loader-v153.hp-loader-fullscreen .hp-loader-fallback { color: #FAF8F4; }
  @media (prefers-reduced-motion: reduce) {
    .hp-loader-v153 .hp-loader-shield {
      animation: none !important; will-change: auto;
    }
  }
`;

export default function Loader({ fullscreen = false }) {
  const [layers, setLayers] = useState(() => cachedLayers);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (cachedLayers) {
      setLayers(cachedLayers);
      return undefined;
    }
    let alive = true;
    void loadLogoOnce()
      .then((result) => { if (alive) setLayers(result); })
      .catch((error) => {
        console.warn("HAMPORIUM loader:", error);
        if (alive) setLoadFailed(true);
      });
    return () => { alive = false; };
  }, []);

  return (
    <div
      className={`hp-loader-v153 ${fullscreen ? "hp-loader-fullscreen" : "hp-loader-page"}`}
      role="status"
      aria-label="Loading HAMPORIUM"
      aria-busy="true"
    >
      <style>{LOADER_CSS}</style>
      <div className="hp-loader-center">
        <div className="hp-loader-mark" aria-hidden="true">
          {layers ? (
            <>
              <img className="hp-loader-shield" src={layers.shieldUrl} alt="" draggable={false} />
              <img className="hp-loader-static" src={layers.fixedUrl} alt="" draggable={false} />
            </>
          ) : loadFailed ? (
            <span className="hp-loader-fallback">HAMPORIUM</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
