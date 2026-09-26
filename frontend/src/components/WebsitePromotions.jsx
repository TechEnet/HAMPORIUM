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

    const rowsFrom = (response) =>
      Array.isArray(response?.data?.promotions) ? response.data.promotions : [];

    const mergePromotions = (...groups) => {
      const byId = new Map();
      groups.flat().forEach((promotion) => {
        if (!promotion) return;
        const key = getPromotionId(promotion);
        if (!key) return;
        byId.set(key, { ...(byId.get(key) || {}), ...promotion });
      });

      return [...byId.values()].sort((a, b) => {
        const priorityDiff = Number(b?.priority || 0) - Number(a?.priority || 0);
        if (priorityDiff) return priorityDiff;
        return new Date(b?.updatedAt || b?.startsAt || 0).getTime() -
          new Date(a?.updatedAt || a?.startsAt || 0).getTime();
      });
    };

    const load = async () => {
      setLoading(true);

      // Public campaigns are always loaded directly. This prevents a stale or
      // expired auth session from hiding public ads on the homepage.
      const publicRequest = api.get("/promotions/public/website", {
        signal: controller.signal,
        timeout: 10000,
        params: { _ts: Date.now() },
      });

      // Signed-in visitors can additionally receive private/targeted offers.
      // A failure here must never erase the public campaign feed.
      const privateRequest = user
        ? api.get("/promotions/website", {
            signal: controller.signal,
            timeout: 10000,
            params: { _ts: Date.now() },
          })
        : Promise.resolve(null);

      const [publicResult, privateResult] = await Promise.allSettled([
        publicRequest,
        privateRequest,
      ]);

      if (!active) return;

      const publicRows =
        publicResult.status === "fulfilled" ? rowsFrom(publicResult.value) : [];
      const privateRows =
        privateResult.status === "fulfilled" && privateResult.value
          ? rowsFrom(privateResult.value)
          : [];

      setPromotions(mergePromotions(publicRows, privateRows));
      setLoading(false);
    };

    load().catch((error) => {
      if (!active || error?.code === "ERR_CANCELED") return;
      setPromotions([]);
      setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [user?._id, user?.id, user?.email]);

  return { promotions, loading };
};



const getPlacementPromotion = (promotions = [], placement) =>
  promotions.find((promotion) => {
    const display = getDisplay(promotion);
    return display.enabled !== false && Boolean(display?.[placement]);
  }) || null;

const getInteractivePromotion = (promotions = []) =>
  promotions.find((promotion) => {
    const display = getDisplay(promotion);
    return (
      display.enabled !== false &&
      (Boolean(display.popupAd) || Boolean(display.floatingAd))
    );
  }) || null;

const getAnnouncementPromotion = (promotions = []) =>
  promotions.find((promotion) => {
    const display = getDisplay(promotion);

    if (display.enabled === false || !display.announcementBar) return false;

    // Do not duplicate the same campaign as a top strip and a richer visual.
    if (display.homeBanner || display.popupAd || display.floatingAd) return false;

    return true;
  }) || null;

const campaignFrequency = (promotion) => {
  const value = getDisplay(promotion).adFrequency;
  return ["once_per_session", "once_per_day", "always"].includes(value)
    ? value
    : "once_per_session";
};

const campaignStorageKey = (promotion) => {
  const version = promotion?.updatedAt
    ? new Date(promotion.updatedAt).getTime()
    : promotion?.startsAt
      ? new Date(promotion.startsAt).getTime()
      : 0;

  return `hamporium:website-promotion:${getPromotionId(promotion)}:${version}`;
};

const todayStamp = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

const campaignWasSeen = (promotion) => {
  if (!promotion || typeof window === "undefined") return true;

  const frequency = campaignFrequency(promotion);
  const key = campaignStorageKey(promotion);

  try {
    if (frequency === "always") return false;
    if (frequency === "once_per_day") {
      return window.localStorage.getItem(key) === todayStamp();
    }
    return window.sessionStorage.getItem(key) === "seen";
  } catch {
    return false;
  }
};

const markCampaignSeen = (promotion) => {
  if (!promotion || typeof window === "undefined") return;

  const frequency = campaignFrequency(promotion);
  const key = campaignStorageKey(promotion);

  try {
    if (frequency === "once_per_day") {
      window.localStorage.setItem(key, todayStamp());
    } else if (frequency === "once_per_session") {
      window.sessionStorage.setItem(key, "seen");
    }
  } catch {
    // Storage can be blocked in private/restricted browser contexts. The ad
    // still works for the current page; it simply cannot persist frequency.
  }
};

const useTimedPromotion = (promotion, visible) => {
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const promotionId = getPromotionId(promotion);
  const display = getDisplay(promotion);
  const frequency = campaignFrequency(promotion);
  const delaySeconds = Math.max(0, Math.min(30, Number(display.adDelaySeconds ?? 2)));

  useEffect(() => {
    setShown(false);
    setDismissed(false);

    if (!visible || !promotion || campaignWasSeen(promotion)) return undefined;

    const timer = window.setTimeout(() => {
      markCampaignSeen(promotion);
      setShown(true);
    }, delaySeconds * 1000);

    return () => window.clearTimeout(timer);
  }, [visible, promotionId, frequency, delaySeconds]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setShown(false);
  }, []);

  return {
    shown: Boolean(visible && promotion && shown && !dismissed),
    dismiss,
  };
};

const useCopyPromotionCode = (promotion) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [getPromotionId(promotion)]);

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

  return { copied, copyCode };
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

const PromotionInlineHomeBanner = ({ promotion }) => {
  const { copied, copyCode } = useCopyPromotionCode(promotion);
  if (!promotion) return null;

  const display = getDisplay(promotion);
  const desktopImage = getImage(promotion, false);
  const mobileImage = getImage(promotion, true);
  const imagePosition = display.imagePosition || "center";
  const overlay = Math.max(0, Math.min(90, Number(display.overlayPercent ?? 38))) / 100;
  const actionLink = getPromotionActionLink(promotion);

  return (
    <section
      className={`hp-home-promo-banner hp-theme-${display.theme || "cream"}`}
      aria-label="Featured website offer"
    >
      <div className="hp-home-promo-banner-media" aria-hidden="true">
        {desktopImage || mobileImage ? (
          <picture>
            {mobileImage ? <source media="(max-width: 639px)" srcSet={mobileImage} /> : null}
            <img
              src={desktopImage || mobileImage}
              alt=""
              style={{ objectPosition: imagePosition }}
            />
          </picture>
        ) : (
          <div className="hp-home-promo-banner-fallback">✦</div>
        )}
        <div className="hp-home-promo-banner-overlay" style={{ opacity: overlay }} />
      </div>

      <div className="hp-home-promo-banner-copy">
        <span className="hp-home-promo-eyebrow">HAMPORIUM FEATURED OFFER</span>
        <span className="hp-home-promo-offer">{getOfferLabel(promotion)}</span>
        <h2>{getHeadline(promotion)}</h2>
        <p>{getMessage(promotion)}</p>

        <div className="hp-home-promo-actions">
          {promotion.code ? (
            <button type="button" className="hp-home-promo-code" onClick={copyCode}>
              <span>{copied ? "COPIED" : "USE CODE"}</span>
              <strong>{promotion.code}</strong>
            </button>
          ) : null}

          {display.buttonLabel ? (
            <SafeAction to={actionLink} className="hp-home-promo-cta">
              {display.buttonLabel} <span aria-hidden="true">→</span>
            </SafeAction>
          ) : null}
        </div>
      </div>
    </section>
  );
};

const PromotionPopupAd = ({ promotion, visible }) => {
  const { shown, dismiss } = useTimedPromotion(promotion, visible);
  const { copied, copyCode } = useCopyPromotionCode(promotion);

  useEffect(() => {
    if (!shown) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") dismiss();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shown, dismiss]);

  if (!promotion || !shown) return null;

  const display = getDisplay(promotion);
  const desktopImage = getImage(promotion, false);
  const mobileImage = getImage(promotion, true);
  const imagePosition = display.imagePosition || "center";
  const overlay = Math.max(0, Math.min(90, Number(display.overlayPercent ?? 38))) / 100;
  const actionLink = getPromotionActionLink(promotion);

  return (
    <div className="hp-promo-modal" role="dialog" aria-modal="true" aria-label="Featured offer">
      <button
        type="button"
        className="hp-promo-modal-backdrop"
        aria-label="Close offer"
        onClick={dismiss}
      />

      <div className="hp-promo-modal-card">
        <button type="button" className="hp-promo-modal-close" onClick={dismiss} aria-label="Close offer">
          ×
        </button>

        <div className="hp-promo-modal-art">
          {desktopImage || mobileImage ? (
            <picture>
              {mobileImage ? <source media="(max-width: 639px)" srcSet={mobileImage} /> : null}
              <img
                src={desktopImage || mobileImage}
                alt=""
                style={{ objectPosition: imagePosition }}
              />
            </picture>
          ) : (
            <div className="hp-promo-modal-fallback" aria-hidden="true">✦</div>
          )}
          <div className="hp-promo-modal-overlay" style={{ opacity: overlay }} />
          <div className="hp-promo-modal-badge">{getOfferLabel(promotion)}</div>
        </div>

        <div className="hp-promo-modal-copy">
          <span className="hp-promo-modal-brand">✦ HAMPORIUM</span>
          <span className="hp-promo-modal-kicker">CURATED OFFER</span>
          <h2>{getHeadline(promotion)}</h2>
          <p>{getMessage(promotion)}</p>

          <div className="hp-promo-modal-actions">
            {promotion.code ? (
              <button type="button" className="hp-promo-modal-code" onClick={copyCode}>
                <span>{copied ? "COPIED" : "USE CODE"}</span>
                <strong>{promotion.code}</strong>
                <i aria-hidden="true">{copied ? "✓" : "⧉"}</i>
              </button>
            ) : null}

            {display.buttonLabel ? (
              <SafeAction
                to={actionLink}
                className="hp-promo-modal-cta"
                onClick={dismiss}
              >
                <span>{display.buttonLabel}</span>
                <b aria-hidden="true">→</b>
              </SafeAction>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const PromotionFloatingAd = ({ promotion, visible }) => {
  const { shown, dismiss } = useTimedPromotion(promotion, visible);
  const { copied, copyCode } = useCopyPromotionCode(promotion);

  if (!promotion) return null;

  const display = getDisplay(promotion);
  const desktopImage = getImage(promotion, false);
  const mobileImage = getImage(promotion, true);
  const imagePosition = display.imagePosition || "center";
  const actionLink = getPromotionActionLink(promotion);
  const positionClass = display.floatingPosition === "bottom_left" ? "is-left" : "is-right";

  return (
    <aside
      className={`hp-section-side-ad ${positionClass} ${shown ? "is-visible" : ""}`}
      aria-label="Featured offer"
      aria-hidden={!shown}
    >
      <div className="hp-section-side-ad-shell">
        <button
          type="button"
          className="hp-section-side-ad-close"
          onClick={dismiss}
          aria-label="Close offer"
        >
          <span>×</span>
        </button>

        <div className="hp-section-side-ad-art">
          <picture>
            {mobileImage ? <source media="(max-width: 639px)" srcSet={mobileImage} /> : null}
            {desktopImage || mobileImage ? (
              <img
                src={desktopImage || mobileImage}
                alt=""
                style={{ objectPosition: imagePosition }}
              />
            ) : (
              <div className="hp-section-side-ad-fallback" aria-hidden="true">✦</div>
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
              <SafeAction to={actionLink} className="hp-section-side-ad-cta">
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
  );
};

export const PromotionHomeBanner = ({ promotions = [], visible = true }) => {
  const homeBanner = useMemo(
    () => getPlacementPromotion(promotions, "homeBanner"),
    [promotions]
  );
  const interactivePromotion = useMemo(
    () => getInteractivePromotion(promotions),
    [promotions]
  );

  const interactiveDisplay = getDisplay(interactivePromotion);
  const interactiveMode = interactiveDisplay.popupAd ? "popup" : "floating";

  return (
    <>
      <style>{PROMOTION_CSS}</style>

      {visible && homeBanner ? (
        <PromotionInlineHomeBanner promotion={homeBanner} />
      ) : null}

      {interactiveMode === "popup" ? (
        <PromotionPopupAd promotion={interactivePromotion} visible={visible} />
      ) : (
        <PromotionFloatingAd promotion={interactivePromotion} visible={visible} />
      )}
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
     INLINE HOME BANNER
  -------------------------------------------------- */
  .hp-home-promo-banner {
    position: relative;
    min-height: clamp(330px, 42vw, 560px);
    overflow: hidden;
    isolation: isolate;
    background: #17120e;
    color: #fff8e9;
  }

  .hp-home-promo-banner-media,
  .hp-home-promo-banner-media picture,
  .hp-home-promo-banner-media img,
  .hp-home-promo-banner-fallback {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .hp-home-promo-banner-media img {
    display: block;
    object-fit: cover;
  }

  .hp-home-promo-banner-fallback {
    display: grid;
    place-items: center;
    font-family: Georgia, serif;
    font-size: clamp(86px, 15vw, 220px);
    color: rgba(231,196,112,.72);
    background:
      radial-gradient(circle at 72% 38%, rgba(215,169,70,.28), transparent 28%),
      linear-gradient(135deg,#2d1b13,#15100d 66%,#24170f);
  }

  .hp-home-promo-banner-overlay {
    position: absolute;
    inset: 0;
    background: #090705;
  }

  .hp-home-promo-banner::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(90deg, rgba(8,6,5,.78) 0%, rgba(8,6,5,.58) 42%, rgba(8,6,5,.12) 76%, rgba(8,6,5,.22) 100%);
  }

  .hp-home-promo-banner-copy {
    position: relative;
    z-index: 2;
    width: min(1240px, calc(100% - 40px));
    min-height: inherit;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: clamp(52px, 7vw, 92px) 0;
  }

  .hp-home-promo-eyebrow {
    color: #e2bd65;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .19em;
  }

  .hp-home-promo-offer {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    margin-top: 18px;
    border: 1px solid rgba(255,225,151,.5);
    border-radius: 99px;
    padding: 0 12px;
    background: rgba(66,35,18,.5);
    color: #ffe3a2;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .08em;
  }

  .hp-home-promo-banner-copy h2 {
    max-width: 760px;
    margin: 20px 0 0;
    font-family: 'Cormorant Garamond','Playfair Display',Georgia,serif;
    font-size: clamp(45px, 6.4vw, 88px);
    font-weight: 600;
    line-height: .9;
    letter-spacing: -.045em;
  }

  .hp-home-promo-banner-copy p {
    max-width: 600px;
    margin: 20px 0 0;
    color: rgba(255,244,223,.76);
    font-size: clamp(13px, 1.2vw, 16px);
    line-height: 1.7;
  }

  .hp-home-promo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 26px;
  }

  .hp-home-promo-code,
  .hp-home-promo-cta {
    min-height: 50px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 11px;
    border-radius: 12px;
    padding: 0 18px;
    font-size: 11px;
    font-weight: 900;
    text-decoration: none;
  }

  .hp-home-promo-code {
    border: 1px solid rgba(255,246,227,.78);
    background: rgba(255,250,239,.95);
    color: #5d2c1f;
    cursor: pointer;
  }

  .hp-home-promo-code span { font-size: 7px; color: #85695f; letter-spacing: .08em; }
  .hp-home-promo-code strong { color: #b5412f; letter-spacing: .06em; }

  .hp-home-promo-cta {
    background: linear-gradient(135deg,#f5dda0,#d6a94e 56%,#b8832f);
    color: #29160f;
    box-shadow: 0 12px 26px rgba(105,66,17,.22);
  }

  /* --------------------------------------------------
     POPUP AD
  -------------------------------------------------- */
  .hp-promo-modal {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: 22px;
  }

  .hp-promo-modal-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(10,7,5,.64);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    cursor: default;
  }

  .hp-promo-modal-card {
    position: relative;
    z-index: 1;
    width: min(930px, calc(100vw - 34px));
    max-height: min(720px, calc(100vh - 34px));
    display: grid;
    grid-template-columns: minmax(300px, .92fr) minmax(0, 1.08fr);
    overflow: auto;
    border: 1px solid rgba(225,188,104,.64);
    border-radius: 24px;
    background: linear-gradient(145deg,#281912,#17100c 62%,#110c09);
    color: #fff8ea;
    box-shadow: 0 38px 110px rgba(5,3,2,.52), inset 0 1px 0 rgba(255,248,226,.12);
    animation: hpPromoModalIn .56s cubic-bezier(.16,1,.3,1) both;
  }

  .hp-promo-modal-close {
    position: absolute;
    z-index: 5;
    top: 14px;
    right: 14px;
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255,250,239,.38);
    border-radius: 50%;
    background: rgba(255,250,239,.94);
    color: #24140e;
    font-size: 27px;
    font-weight: 300;
    cursor: pointer;
    box-shadow: 0 10px 26px rgba(0,0,0,.22);
  }

  .hp-promo-modal-art {
    position: relative;
    min-height: 470px;
    overflow: hidden;
    background: #24140e;
  }

  .hp-promo-modal-art picture,
  .hp-promo-modal-art img,
  .hp-promo-modal-fallback {
    display: block;
    width: 100%;
    height: 100%;
  }

  .hp-promo-modal-art img {
    position: absolute;
    inset: 0;
    object-fit: cover;
  }

  .hp-promo-modal-fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-family: Georgia, serif;
    font-size: 120px;
    color: #d9b75f;
    background: radial-gradient(circle at 50% 42%,rgba(214,174,89,.23),transparent 31%),linear-gradient(135deg,#3a2116,#1b100b);
  }

  .hp-promo-modal-overlay {
    position: absolute;
    inset: 0;
    background: #090604;
  }

  .hp-promo-modal-badge {
    position: absolute;
    left: 18px;
    bottom: 18px;
    z-index: 2;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    border: 1px solid rgba(255,224,145,.58);
    border-radius: 99px;
    padding: 0 13px;
    background: rgba(40,21,13,.76);
    color: #ffe8ad;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
  }

  .hp-promo-modal-copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: clamp(42px, 6vw, 74px) clamp(28px, 5vw, 58px);
  }

  .hp-promo-modal-brand {
    color: #d7b764;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .22em;
  }

  .hp-promo-modal-kicker {
    margin-top: 22px;
    color: rgba(255,241,214,.52);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .18em;
  }

  .hp-promo-modal-copy h2 {
    margin: 12px 0 0;
    font-family: 'Cormorant Garamond','Playfair Display',Georgia,serif;
    font-size: clamp(42px, 5.2vw, 70px);
    font-weight: 600;
    line-height: .9;
    letter-spacing: -.045em;
  }

  .hp-promo-modal-copy p {
    margin: 18px 0 0;
    color: rgba(255,242,218,.67);
    font-size: 13px;
    line-height: 1.7;
  }

  .hp-promo-modal-actions {
    display: grid;
    grid-template-columns: minmax(0,1fr) minmax(140px,.8fr);
    gap: 10px;
    margin-top: 26px;
  }

  .hp-promo-modal-code,
  .hp-promo-modal-cta {
    min-height: 52px;
    border-radius: 12px;
  }

  .hp-promo-modal-code {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 9px;
    border: 1px solid rgba(255,249,236,.78);
    padding: 0 12px;
    background: #fff9ed;
    color: #4a2118;
    cursor: pointer;
  }

  .hp-promo-modal-code span { font-size: 7px; font-weight: 800; color: #8b6a5b; letter-spacing: .08em; }
  .hp-promo-modal-code strong { overflow:hidden; text-overflow:ellipsis; color:#b5412f; font-size:12px; font-weight:900; letter-spacing:.04em; }
  .hp-promo-modal-code i { font-style:normal; color:#7b5b50; }

  .hp-promo-modal-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 14px;
    background: linear-gradient(135deg,#f5dda0,#d9ad55 54%,#b98632);
    color: #2b170f;
    text-decoration: none;
    font-size: 11px;
    font-weight: 900;
  }

  .hp-promo-modal-cta b { font-size: 18px; }

  @keyframes hpPromoModalIn {
    from { opacity:0; transform:translateY(28px) scale(.965); filter:blur(5px); }
    to { opacity:1; transform:translateY(0) scale(1); filter:blur(0); }
  }

  /* Floating placement respects the admin-selected side. */
  .hp-section-side-ad.is-left {
    left: clamp(16px, 2.4vw, 34px);
    right: auto;
    transform: translate3d(calc(-100% - 60px), 18px, 0) scale(.96);
  }

  .hp-section-side-ad.is-left.is-visible {
    transform: translate3d(0,0,0) scale(1);
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
    .hp-home-promo-banner { min-height: 440px; }
    .hp-home-promo-banner::after { background: linear-gradient(0deg,rgba(8,6,5,.82),rgba(8,6,5,.28) 68%,rgba(8,6,5,.2)); }
    .hp-home-promo-banner-copy { width: min(100% - 30px, 640px); justify-content:flex-end; padding:56px 0 42px; }
    .hp-home-promo-banner-copy h2 { max-width: 92%; font-size: clamp(42px, 13vw, 62px); }
    .hp-home-promo-banner-copy p { max-width: 94%; font-size: 12px; }

    .hp-promo-modal { padding: 12px; }
    .hp-promo-modal-card {
      width: min(100%, 560px);
      max-height: calc(100vh - 24px);
      grid-template-columns: 1fr;
      border-radius: 20px;
    }
    .hp-promo-modal-art { min-height: 250px; max-height: 38vh; }
    .hp-promo-modal-copy { padding: 28px 20px 22px; }
    .hp-promo-modal-copy h2 { font-size: clamp(38px, 11vw, 54px); }
    .hp-promo-modal-copy p { font-size: 11px; margin-top: 12px; }
    .hp-promo-modal-actions { grid-template-columns: 1fr; margin-top: 18px; }



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

    .hp-section-side-ad.is-left {
      right: 12px;
      left: 12px;
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
