import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const getDisplay = (promotion) => promotion?.websiteDisplay || {};

const getPromotionId = (promotion) =>
  String(
    promotion?.id ||
      promotion?._id ||
      promotion?.code ||
      promotion?.name ||
      "offer"
  );

const getHeadline = (promotion) => {
  const display = getDisplay(promotion);

  return (
    display.headline ||
    promotion?.customerLabel ||
    promotion?.name ||
    "A thoughtful offer, made for you."
  );
};

const getMessage = (promotion) => {
  const display = getDisplay(promotion);

  if (display.message) return display.message;

  if (promotion?.code) {
    return `Use ${promotion.code} at checkout while this offer is live.`;
  }

  return "Your saving is applied automatically when this offer is eligible.";
};

const getOfferLabel = (promotion) => {
  if (promotion?.type === "automatic_sale") {
    const target = Number(
      promotion?.automaticBand?.targetDiscountPercent || 0
    );

    return target > 0 ? `${target}% OFF` : "SPECIAL OFFER";
  }

  if (promotion?.discount?.type === "fixed") {
    return `₹${Number(promotion?.discount?.value || 0).toLocaleString(
      "en-IN"
    )} OFF`;
  }

  const value = Number(promotion?.discount?.value || 0);
  return value > 0 ? `${value}% OFF` : "SPECIAL OFFER";
};

const getImage = (promotion, mobile = false) => {
  const display = getDisplay(promotion);

  if (mobile) {
    return display.mobileImage?.url || display.desktopImage?.url || "";
  }

  return display.desktopImage?.url || display.mobileImage?.url || "";
};

const isGenericCatalogueLink = (value) => {
  const link = String(value || "").trim();
  return !link || ["/gifts", "/gifts/", "#"].includes(link);
};

const getCampaignFallbackLink = (promotion) => {
  const text = [
    promotion?.name,
    promotion?.customerLabel,
    getDisplay(promotion)?.headline,
    getDisplay(promotion)?.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\bdiwali\b/.test(text)) return "/diwali";
  if (/\bwedding\b/.test(text)) return "/gifts?search=wedding";
  if (/\bcorporate\b/.test(text)) return "/gifts?search=corporate";
  if (/\bfestive\b/.test(text)) return "/gifts?search=festive";

  return "/gifts";
};

const getPromotionActionLink = (promotion) => {
  const display = getDisplay(promotion);
  const configured = String(display.buttonLink || "").trim();
  const scoped = String(promotion?.targetLink || "").trim();

  // A deliberately configured specific destination always wins.
  if (configured && !isGenericCatalogueLink(configured)) return configured;

  // Generic /gifts buttons should follow the actual promotion scope.
  if (scoped) return scoped;

  return configured || getCampaignFallbackLink(promotion);
};

const isInternalLink = (value) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

const SafeAction = ({ to, className = "", children, onClick }) => {
  if (!to) return null;

  if (isInternalLink(to)) {
    return (
      <Link to={to} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={to}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={onClick}
    >
      {children}
    </a>
  );
};

export const useWebsitePromotions = () => {
  const { user } = useAuth();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setLoading(true);

    const endpoint = user
      ? "/promotions/website"
      : "/promotions/public/website";

    api
      .get(endpoint, {
        signal: controller.signal,
        timeout: 10000,
      })
      .then((response) => {
        if (!active) return;

        setPromotions(
          Array.isArray(response.data?.promotions)
            ? response.data.promotions
            : []
        );
      })
      .catch((error) => {
        if (!active || error?.code === "ERR_CANCELED") return;
        setPromotions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [user?._id, user?.id, user?.email]);

  return { promotions, loading };
};

const getRichCampaignPromotion = (promotions = []) => {
  const enabled = promotions.filter(
    (promotion) => getDisplay(promotion).enabled !== false
  );

  return (
    enabled.find((promotion) => {
      const display = getDisplay(promotion);
      return display.homeBanner && Boolean(getImage(promotion));
    }) ||
    enabled.find((promotion) => {
      const display = getDisplay(promotion);
      return display.popupAd && Boolean(getImage(promotion));
    }) ||
    enabled.find((promotion) => {
      const display = getDisplay(promotion);
      return display.floatingAd && Boolean(getImage(promotion));
    }) ||
    enabled.find((promotion) => Boolean(getImage(promotion))) ||
    null
  );
};

const getAnnouncementPromotion = (promotions = []) => {
  const richCampaign = getRichCampaignPromotion(promotions);
  const richCampaignId = richCampaign ? getPromotionId(richCampaign) : "";

  return (
    promotions.find((promotion) => {
      const display = getDisplay(promotion);

      if (display.enabled === false || !display.announcementBar) return false;

      // If the same campaign already has a richer image ad, avoid showing
      // both a top strip and the side campaign at the same time.
      if (richCampaignId && getPromotionId(promotion) === richCampaignId) {
        return false;
      }

      return true;
    }) || null
  );
};

export const PromotionAnnouncement = ({ promotions = [], visible = true }) => {
  const promotion = useMemo(
    () => getAnnouncementPromotion(promotions),
    [promotions]
  );

  const [closed, setClosed] = useState(false);

  useEffect(() => {
    setClosed(false);
  }, [getPromotionId(promotion)]);

  if (!visible || !promotion || closed) return null;

  const display = getDisplay(promotion);

  return (
    <>
      <style>{PROMOTION_CSS}</style>
      <section className="hp-promo-strip" aria-label="Current offer">
        <div className="hp-promo-strip-shimmer" aria-hidden="true" />
        <div className="hp-promo-strip-inner">
          <span className="hp-promo-strip-mark">✦</span>
          <strong>{getHeadline(promotion)}</strong>
          <span className="hp-promo-strip-offer">{getOfferLabel(promotion)}</span>

          {promotion.code ? (
            <span className="hp-promo-strip-code">Use {promotion.code}</span>
          ) : null}

          {display.buttonLabel ? (
            <SafeAction
              to={getPromotionActionLink(promotion)}
              className="hp-promo-strip-link"
            >
              {display.buttonLabel} →
            </SafeAction>
          ) : null}

          <button
            type="button"
            className="hp-promo-strip-close"
            onClick={() => setClosed(true)}
            aria-label="Close offer"
          >
            ×
          </button>
        </div>
      </section>
    </>
  );
};

export const PromotionHomeBanner = ({ promotions = [], visible = true }) => {
  const promotion = useMemo(
    () => getRichCampaignPromotion(promotions),
    [promotions]
  );

  const [dismissed, setDismissed] = useState(false);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Reset only when the campaign changes. No storage is used, so a page
    // reload always allows the ad to appear again.
    setDismissed(false);
    setShown(false);
    setCopied(false);
  }, [getPromotionId(promotion)]);

  useEffect(() => {
    if (!visible || !promotion || dismissed) return undefined;

    let frame = 0;

    const check = () => {
      frame = 0;

      const viewport = Math.max(window.innerHeight || 0, 650);
      const passedHero = window.scrollY >= viewport * 0.82;

      if (passedHero) {
        setShown(true);
      } else {
        setShown(false);
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(check);
    };

    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [visible, promotion, dismissed]);

  const copyCode = useCallback(async () => {
    if (!promotion?.code) return;

    try {
      await navigator.clipboard.writeText(promotion.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [promotion?.code]);

  if (!visible || !promotion || dismissed) return null;

  const display = getDisplay(promotion);
  const desktopImage = getImage(promotion, false);
  const mobileImage = getImage(promotion, true);
  const imagePosition = display.imagePosition || "center";
  const actionLink = getPromotionActionLink(promotion);

  return (
    <>
      <style>{PROMOTION_CSS}</style>

      <aside
        className={`hp-section-side-ad ${shown ? "is-visible" : ""}`}
        aria-label="Featured offer"
        aria-hidden={!shown}
      >
        <div className="hp-section-side-ad-shell">
          <button
            type="button"
            className="hp-section-side-ad-close"
            onClick={() => setDismissed(true)}
            aria-label="Close offer"
          >
            <span>×</span>
          </button>

          <div className="hp-section-side-ad-art">
            <picture>
              {mobileImage ? (
                <source media="(max-width: 639px)" srcSet={mobileImage} />
              ) : null}
              {desktopImage ? (
                <img
                  src={desktopImage}
                  alt=""
                  style={{ objectPosition: imagePosition }}
                />
              ) : (
                <div className="hp-section-side-ad-fallback" aria-hidden="true">
                  ✦
                </div>
              )}
            </picture>

            <div className="hp-section-side-ad-vignette" />
            <div className="hp-section-side-ad-spark hp-spark-one" />
            <div className="hp-section-side-ad-spark hp-spark-two" />
            <div className="hp-section-side-ad-spark hp-spark-three" />

            <div className="hp-section-side-ad-seal">
              <span>{getOfferLabel(promotion)}</span>
            </div>
          </div>

          <div className="hp-section-side-ad-copy">
            <div className="hp-section-side-ad-brand">
              <span className="hp-section-side-ad-gift">✦</span>
              <span>HAMPORIUM</span>
            </div>

            <span className="hp-section-side-ad-kicker">CURATED OFFER</span>

            <h3>{getHeadline(promotion)}</h3>
            <p>{getMessage(promotion)}</p>

            <div className="hp-section-side-ad-actions">
              {promotion.code ? (
                <button
                  type="button"
                  className="hp-section-side-ad-code"
                  onClick={copyCode}
                  aria-label={`Copy promo code ${promotion.code}`}
                >
                  <span>{copied ? "COPIED" : "USE CODE"}</span>
                  <strong>{promotion.code}</strong>
                  <i aria-hidden="true">{copied ? "✓" : "⧉"}</i>
                </button>
              ) : null}

              {display.buttonLabel ? (
                <SafeAction
                  to={actionLink}
                  className="hp-section-side-ad-cta"
                >
                  <span>{display.buttonLabel}</span>
                  <b aria-hidden="true">→</b>
                </SafeAction>
              ) : null}
            </div>

            <div className="hp-section-side-ad-trust" aria-hidden="true">
              <span>Premium Quality</span>
              <span>Thoughtful Gifting</span>
              <span>Limited Time</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export const PromotionCheckoutNote = ({ promotions = [], hidden = false }) => {
  const promotion = useMemo(
    () =>
      promotions.find(
        (item) =>
          getDisplay(item).enabled !== false && getDisplay(item).checkoutNote
      ) || null,
    [promotions]
  );

  if (hidden || !promotion) return null;

  const display = getDisplay(promotion);
  const image = getImage(promotion, true);

  return (
    <>
      <style>{PROMOTION_CSS}</style>
      <div className="hp-checkout-offer">
        <div className="hp-checkout-offer-art">
          {image ? <img src={image} alt="" /> : <GiftIcon />}
          <span>{getOfferLabel(promotion)}</span>
        </div>

        <div className="hp-checkout-offer-copy">
          <small>AVAILABLE OFFER</small>
          <strong>{getHeadline(promotion)}</strong>
          <p>{getMessage(promotion)}</p>

          {promotion.code ? (
            <span className="hp-checkout-offer-code">
              Use code <b>{promotion.code}</b>
            </span>
          ) : null}
        </div>

        {display.buttonLabel ? (
          <SafeAction
            to={getPromotionActionLink(promotion)}
            className="hp-checkout-offer-link"
          >
            {display.buttonLabel} →
          </SafeAction>
        ) : null}
      </div>
    </>
  );
};

export const PromotionProductBadge = ({ promotion }) => {
  if (!promotion) return null;

  const display = getDisplay(promotion);
  if (!display.productBadge) return null;

  return (
    <>
      <style>{PROMOTION_CSS}</style>
      <span className="hp-product-promo-badge">
        {display.badgeText || getOfferLabel(promotion)}
      </span>
    </>
  );
};

export const findPromotionForProduct = (product, promotions = []) => {
  if (!product) return null;

  const productId = String(product?._id || product?.id || "");
  const categoryId = String(
    product?.category?._id || product?.category || ""
  );
  const collectionIds = new Set(
    (product?.collections || []).map((item) =>
      String(item?._id || item || "")
    )
  );

  return (
    promotions.find((promotion) => {
      const display = getDisplay(promotion);
      if (display.enabled === false || !display.productBadge) return false;

      const scope = promotion?.scope || {};
      if (scope.allSkus !== false) return true;

      const productIds = new Set(
        (scope.productIds || scope.products || []).map((item) =>
          String(item?._id || item || "")
        )
      );

      if (productId && productIds.has(productId)) return true;

      const categoryIds = new Set(
        (scope.categoryIds || scope.categories || []).map((item) =>
          String(item?._id || item || "")
        )
      );

      if (categoryId && categoryIds.has(categoryId)) return true;

      const promotionCollectionIds = new Set(
        (scope.collectionIds || scope.collections || []).map((item) =>
          String(item?._id || item || "")
        )
      );

      return [...collectionIds].some((id) => promotionCollectionIds.has(id));
    }) || null
  );
};

const GiftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 10h16v10H4V10Z" />
    <path d="M3 7h18v4H3V7ZM12 7v13" />
  </svg>
);

const PROMOTION_CSS = `
  .hp-promo-strip,
  .hp-section-side-ad,
  .hp-checkout-offer,
  .hp-product-promo-badge {
    box-sizing: border-box;
    font-family: 'Manrope', Arial, sans-serif;
  }

  /* --------------------------------------------------
     TOP STRIP
     Kept intentionally compact. Rich image campaigns do
     not duplicate themselves here.
  -------------------------------------------------- */
  .hp-promo-strip {
    position: relative;
    z-index: 40;
    overflow: hidden;
    border-bottom: 1px solid rgba(212,175,55,.24);
    background: #17120e;
    color: #fff8e9;
  }

  .hp-promo-strip-shimmer {
    position: absolute;
    inset: 0 auto 0 -25%;
    width: 22%;
    pointer-events: none;
    background: linear-gradient(90deg,transparent,rgba(255,234,173,.13),transparent);
    transform: skewX(-22deg);
    animation: hpPromoStripShine 7s ease-in-out infinite;
  }

  .hp-promo-strip-inner {
    min-height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 13px;
    padding: 8px 52px 8px 20px;
    font-size: 12px;
  }

  .hp-promo-strip-mark { color: #e2bd65; }
  .hp-promo-strip-offer { color: #f2cf78; font-weight: 800; }
  .hp-promo-strip-code { color: rgba(255,248,233,.68); font-weight: 700; }
  .hp-promo-strip-link {
    color: #fff4d4;
    font-weight: 800;
    text-decoration: none;
    border-bottom: 1px solid rgba(255,244,212,.5);
  }

  .hp-promo-strip-close {
    position: absolute;
    top: 50%;
    right: 15px;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    transform: translateY(-50%);
    border: 0;
    background: transparent;
    color: rgba(255,255,255,.72);
    font-size: 24px;
    cursor: pointer;
  }

  @keyframes hpPromoStripShine {
    0%, 35% { left: -25%; }
    70%, 100% { left: 125%; }
  }

  /* --------------------------------------------------
     AFTER-HERO SIDE CAMPAIGN
     No modal, no backdrop, no page blocking.
     It enters from the right only after the user has left
     the hero section. Closing it hides it until reload.
  -------------------------------------------------- */
  .hp-section-side-ad {
    position: fixed;
    right: clamp(16px, 2.4vw, 34px);
    bottom: clamp(18px, 3vw, 34px);
    z-index: 92;
    width: min(348px, calc(100vw - 28px));
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transform: translate3d(calc(100% + 60px), 18px, 0) scale(.96);
    filter: blur(8px);
    transition:
      transform .78s cubic-bezier(.16,1,.3,1),
      opacity .42s ease,
      filter .58s ease,
      visibility 0s linear .8s;
  }

  .hp-section-side-ad.is-visible {
    pointer-events: auto;
    opacity: 1;
    visibility: visible;
    transform: translate3d(0,0,0) scale(1);
    filter: blur(0);
    transition-delay: 0s;
  }

  .hp-section-side-ad-shell {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(224,185,101,.62);
    border-radius: 20px;
    background:
      radial-gradient(circle at 84% 8%, rgba(224,174,79,.13), transparent 26%),
      linear-gradient(145deg,#2c1a13 0%,#20130e 52%,#140d09 100%);
    color: #fff7e9;
    box-shadow:
      0 26px 64px rgba(15,8,4,.28),
      0 8px 22px rgba(15,8,4,.16),
      inset 0 1px 0 rgba(255,244,219,.13);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .hp-section-side-ad-shell::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    border-radius: inherit;
    box-shadow: inset 0 0 0 5px rgba(255,255,255,.018);
  }

  .hp-section-side-ad-close {
    position: absolute;
    z-index: 20;
    top: 12px;
    right: 12px;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255,246,226,.34);
    border-radius: 50%;
    background: rgba(255,250,240,.93);
    color: #24140e;
    cursor: pointer;
    box-shadow: 0 8px 22px rgba(0,0,0,.18);
    transition: transform .35s cubic-bezier(.16,1,.3,1), background .25s ease;
  }

  .hp-section-side-ad-close:hover {
    transform: rotate(7deg) scale(1.06);
    background: #fff;
  }

  .hp-section-side-ad-close span {
    font-size: 26px;
    font-weight: 300;
    line-height: 1;
  }

  .hp-section-side-ad-art {
    position: relative;
    height: 172px;
    overflow: hidden;
    border-bottom: 1px solid rgba(220,176,82,.22);
    background: #24140e;
  }

  .hp-section-side-ad-art picture,
  .hp-section-side-ad-art img {
    display: block;
    width: 100%;
    height: 100%;
  }

  .hp-section-side-ad-art img {
    object-fit: cover;
    transform: scale(1.025);
    animation: hpSideAdDrift 13s ease-in-out infinite alternate;
  }

  .hp-section-side-ad-fallback {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    font-family: Georgia, serif;
    font-size: 72px;
    color: #d7b65f;
    background:
      radial-gradient(circle at 50% 42%, rgba(214,174,89,.22), transparent 32%),
      linear-gradient(135deg,#311b12,#1a100b);
  }

  .hp-section-side-ad-vignette {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to top, rgba(17,8,3,.88) 0%, rgba(17,8,3,.08) 48%, rgba(17,8,3,.24) 100%),
      linear-gradient(90deg, rgba(12,6,3,.23), transparent 45%);
    pointer-events: none;
  }

  .hp-section-side-ad-seal {
    position: absolute;
    right: 16px;
    bottom: 14px;
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid rgba(255,220,137,.64);
    background:
      radial-gradient(circle at 30% 24%, #d27e56 0%, #a53f2c 54%, #6f2118 100%);
    color: #fff0cb;
    box-shadow:
      0 16px 28px rgba(0,0,0,.28),
      inset 0 1px 0 rgba(255,245,223,.24),
      0 0 0 7px rgba(210,158,83,.08);
    transform: rotate(4deg);
    animation: hpSideAdSealFloat 4.8s ease-in-out infinite;
  }

  .hp-section-side-ad-seal::before {
    content: '';
    position: absolute;
    inset: 6px;
    border: 1px dashed rgba(255,225,154,.45);
    border-radius: inherit;
    animation: hpSideAdSealSpin 22s linear infinite;
  }

  .hp-section-side-ad-seal span {
    position: relative;
    z-index: 2;
    width: 54px;
    text-align: center;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    line-height: .92;
  }

  .hp-section-side-ad-spark {
    position: absolute;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f5d786;
    box-shadow: 0 0 16px #eec568;
    opacity: .74;
    animation: hpSideSpark 2.9s ease-in-out infinite;
  }

  .hp-spark-one { left: 12%; top: 22%; animation-delay: -.5s; }
  .hp-spark-two { left: 65%; top: 17%; animation-delay: -1.4s; }
  .hp-spark-three { left: 47%; top: 63%; animation-delay: -2s; }

  .hp-section-side-ad-copy {
    position: relative;
    padding: 18px 18px 16px;
    background:
      radial-gradient(circle at 16% 0%, rgba(214,175,87,.11), transparent 28%),
      transparent;
  }

  .hp-section-side-ad-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #d8b968;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .21em;
  }

  .hp-section-side-ad-gift { font-size: 13px; }

  .hp-section-side-ad-kicker {
    display: block;
    margin-top: 12px;
    color: rgba(255,241,214,.58);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .18em;
  }

  .hp-section-side-ad-copy h3 {
    margin: 8px 0 0;
    max-width: 286px;
    color: #fff4dd;
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-size: clamp(28px, 2.35vw, 36px);
    font-weight: 600;
    line-height: .93;
    letter-spacing: -.035em;
  }

  .hp-section-side-ad-copy p {
    margin: 9px 0 0;
    max-width: 292px;
    color: rgba(255,242,218,.66);
    font-size: 11px;
    line-height: 1.55;
  }

  .hp-section-side-ad-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(126px, .78fr);
    gap: 10px;
    margin-top: 12px;
  }

  .hp-section-side-ad-code,
  .hp-section-side-ad-cta {
    min-height: 46px;
    border-radius: 11px;
  }

  .hp-section-side-ad-code {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 9px;
    border: 1px solid rgba(255,249,236,.78);
    padding: 0 10px;
    background: #fff9ed;
    color: #4a2118;
    cursor: pointer;
    box-shadow: 0 9px 22px rgba(0,0,0,.13);
  }

  .hp-section-side-ad-code::after {
    content: '';
    position: absolute;
    inset: -60% auto -60% -35%;
    width: 24%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.88), transparent);
    transform: skewX(-18deg);
    animation: hpSideCodeShine 5.8s ease-in-out infinite;
  }

  .hp-section-side-ad-code span {
    position: relative;
    z-index: 2;
    font-size: 7px;
    font-weight: 800;
    letter-spacing: .08em;
    color: #8b6a5b;
  }

  .hp-section-side-ad-code strong {
    position: relative;
    z-index: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #b5412f;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: .03em;
  }

  .hp-section-side-ad-code i {
    position: relative;
    z-index: 2;
    font-style: normal;
    color: #7b5b50;
  }

  .hp-section-side-ad-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 13px;
    text-decoration: none;
    background:
      linear-gradient(135deg,#f5dda0 0%,#d9ad55 54%,#b98632 100%);
    color: #2b170f;
    font-size: 11px;
    font-weight: 900;
    box-shadow:
      0 10px 22px rgba(170,115,37,.2),
      inset 0 1px 0 rgba(255,255,255,.58);
    transition: transform .35s cubic-bezier(.16,1,.3,1), filter .25s ease;
  }

  .hp-section-side-ad-cta:hover {
    transform: translateY(-2px);
    filter: brightness(1.04);
  }

  .hp-section-side-ad-cta b { font-size: 18px; }

  .hp-section-side-ad-trust {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 13px;
    padding-top: 12px;
    border-top: 1px solid rgba(224,184,96,.15);
    color: rgba(255,238,210,.45);
    font-size: 7px;
    font-weight: 700;
  }

  @keyframes hpSideAdDrift {
    from { transform: scale(1.025) translate3d(0,0,0); }
    to { transform: scale(1.075) translate3d(-5px,-2px,0); }
  }

  @keyframes hpSideAdSealFloat {
    0%,100% { transform: translateY(0) rotate(4deg); }
    50% { transform: translateY(-6px) rotate(1deg); }
  }

  @keyframes hpSideAdSealSpin { to { transform: rotate(360deg); } }

  @keyframes hpSideSpark {
    0%,100% { opacity:.22; transform: scale(.72); }
    50% { opacity:.95; transform: scale(1.24); }
  }

  @keyframes hpSideCodeShine {
    0%,55% { left:-35%; }
    78%,100% { left:135%; }
  }

  /* --------------------------------------------------
     CHECKOUT OFFER
  -------------------------------------------------- */
  .hp-checkout-offer {
    display: grid;
    grid-template-columns: 86px minmax(0,1fr) auto;
    align-items: center;
    gap: 16px;
    overflow: hidden;
    border: 1px solid rgba(212,175,55,.28);
    border-radius: 18px;
    padding: 13px;
    background: linear-gradient(135deg,#fffaf2,#fff7eb);
  }

  .hp-checkout-offer-art {
    position: relative;
    height: 74px;
    overflow: hidden;
    border-radius: 12px;
    background: #25160f;
    color: #d9b65e;
  }

  .hp-checkout-offer-art img,
  .hp-checkout-offer-art svg {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hp-checkout-offer-art svg { padding: 23px; }

  .hp-checkout-offer-art span {
    position: absolute;
    left: 7px;
    bottom: 7px;
    border: 1px solid rgba(255,255,255,.28);
    border-radius: 99px;
    padding: 4px 7px;
    background: rgba(20,12,7,.74);
    color: #ffe8a8;
    font-size: 7px;
    font-weight: 900;
  }

  .hp-checkout-offer-copy small {
    display: block;
    color: #b27329;
    font-size: 7px;
    font-weight: 900;
    letter-spacing: .12em;
  }

  .hp-checkout-offer-copy strong {
    display: block;
    margin-top: 4px;
    color: #2f231a;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 22px;
    line-height: 1;
  }

  .hp-checkout-offer-copy p {
    margin: 5px 0 0;
    color: #77695b;
    font-size: 10px;
    line-height: 1.55;
  }

  .hp-checkout-offer-code {
    display: inline-block;
    margin-top: 6px;
    color: #775a3d;
    font-size: 9px;
  }

  .hp-checkout-offer-code b { color: #b7442e; }

  .hp-checkout-offer-link {
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    border-radius: 10px;
    background: #211710;
    color: #fff3dc;
    text-decoration: none;
    font-size: 10px;
    font-weight: 800;
  }

  .hp-product-promo-badge {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    border: 1px solid rgba(207,159,57,.34);
    border-radius: 99px;
    padding: 0 10px;
    background: rgba(255,249,236,.94);
    color: #865419;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .06em;
    box-shadow: 0 7px 16px rgba(73,46,16,.08);
  }

  @media (max-width: 760px) {
    .hp-promo-strip-inner {
      justify-content: flex-start;
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: none;
    }

    .hp-promo-strip-inner::-webkit-scrollbar { display:none; }

    .hp-section-side-ad {
      right: 12px;
      left: 12px;
      bottom: 12px;
      width: auto;
      transform: translate3d(0, calc(100% + 60px), 0) scale(.97);
    }

    .hp-section-side-ad.is-visible {
      transform: translate3d(0,0,0) scale(1);
    }

    .hp-section-side-ad-shell {
      display: grid;
      grid-template-columns: 118px minmax(0,1fr);
      border-radius: 20px;
    }

    .hp-section-side-ad-art {
      height: 100%;
      min-height: 245px;
      border-bottom: 0;
      border-right: 1px solid rgba(220,176,82,.22);
    }

    .hp-section-side-ad-art img { animation-duration: 16s; }
    .hp-section-side-ad-seal {
      right: 10px;
      bottom: 12px;
      width: 70px;
      height: 70px;
    }
    .hp-section-side-ad-seal span { font-size: 17px; }

    .hp-section-side-ad-copy { padding: 20px 16px 15px; }
    .hp-section-side-ad-brand { font-size: 8px; }
    .hp-section-side-ad-kicker { margin-top: 12px; }
    .hp-section-side-ad-copy h3 { font-size: 30px; }
    .hp-section-side-ad-copy p {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      font-size: 10px;
    }

    .hp-section-side-ad-actions {
      grid-template-columns: 1fr;
      margin-top: 13px;
    }

    .hp-section-side-ad-code,
    .hp-section-side-ad-cta { min-height: 46px; }
    .hp-section-side-ad-trust { display:none; }

    .hp-checkout-offer {
      grid-template-columns: 68px minmax(0,1fr);
    }

    .hp-checkout-offer-art { height: 64px; }
    .hp-checkout-offer-link {
      grid-column: 1 / -1;
      justify-content: center;
    }
  }

  @media (max-width: 420px) {
    .hp-section-side-ad-shell {
      grid-template-columns: 102px minmax(0,1fr);
    }

    .hp-section-side-ad-art { min-height: 232px; }
    .hp-section-side-ad-copy h3 { font-size: 27px; }
    .hp-section-side-ad-close {
      width: 36px;
      height: 36px;
      top: 8px;
      right: 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hp-section-side-ad,
    .hp-section-side-ad-art img,
    .hp-section-side-ad-seal,
    .hp-section-side-ad-seal::before,
    .hp-section-side-ad-spark,
    .hp-section-side-ad-code::after,
    .hp-promo-strip-shimmer {
      animation: none !important;
      transition: none !important;
    }
  }
`;

export default PromotionAnnouncement;
