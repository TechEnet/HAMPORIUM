// EXACT PATH: frontend/src/components/WebsiteCampaigns.jsx
// HAMPORIUM V11 - Tailwind-only campaign advertisement.
// Uses the existing HAMPORIUM palette: charcoal, ivory, champagne gold.
// No product publication, checkout, import or campaign API changes.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api.js";

const viewedCampaigns = new Set();

function analyticsAllowed() {
  try {
    return JSON.parse(
      localStorage.getItem("hamporium_cookie_preferences_v2") || "null"
    )?.analytics === true;
  } catch {
    return false;
  }
}

function trackCampaign(id, type, placement) {
  if (!id || !analyticsAllowed()) return;
  void api
    .post(`/marketing-studio/public/campaigns/${id}/events`, {
      type,
      placement,
    })
    .catch(() => {});
}

export default function WebsiteCampaigns({ placement = "home_hero" }) {
  const [campaigns, setCampaigns] = useState([]);
  const [imageFailed, setImageFailed] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/marketing-studio/public/campaigns", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setCampaigns(
            Array.isArray(data?.campaigns) ? data.campaigns : []
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCampaigns([]);
      });
    return () => controller.abort();
  }, []);

  // Only the public campaign API decides whether a campaign is eligible.
  // Unpublished products do not hide an approved campaign advertisement.
  const campaign = campaigns.find(
    (item) =>
      item?.slug &&
      item?.bannerImage &&
      Array.isArray(item.placement) &&
      item.placement.includes(placement)
  );

  useEffect(() => {
    setImageFailed(false);
  }, [campaign?._id, campaign?.bannerImage]);

  useEffect(() => {
    if (!campaign?._id || typeof IntersectionObserver === "undefined") {
      return;
    }
    const target = sectionRef.current;
    if (!target) return;

    const seenKey = `${campaign._id}:${placement}`;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5
          ) &&
          !viewedCampaigns.has(seenKey) &&
          analyticsAllowed()
        ) {
          viewedCampaigns.add(seenKey);
          trackCampaign(campaign._id, "impression", placement);
          observer.disconnect();
        }
      },
      { threshold: [0.5] }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [campaign?._id, placement]);

  if (!campaign) return null;

  // Keep the campaign's saved headline. Only replace internal placeholder names
  // that do not read naturally in customer-facing advertising.
  const campaignName = String(campaign.name || "").trim();
  const suppliedHeadline = String(campaign.headline || "").trim();
  const isDiwali = /\bdiwali\b/i.test(`${campaignName} ${suppliedHeadline} ${campaign.slug || ""}`);
  const rawTitle = suppliedHeadline || campaignName || "The HAMPORIUM Edit";
  const placeholderDiwaliTitle = /^diwali\s+(?:campaign|promotion|sale)(?:\s+20\d{2})?$/i.test(rawTitle);
  const title = isDiwali && placeholderDiwaliTitle ? "Make This Diwali Unforgettable." : rawTitle;
  const kicker = isDiwali ? "DIWALI CAMPAIGN IS LIVE" : "A SPECIAL HAMPORIUM CAMPAIGN";
  const tagline = isDiwali
    ? "Celebrate Big. Gift Beautifully."
    : "Extraordinary gifts. Unforgettable moments.";
  const buttonText = String(campaign.buttonText || "").trim() || (isDiwali ? "Explore Diwali Gifts" : "Explore the Collection");
  const destination = `/campaigns/${encodeURIComponent(campaign.slug)}`;

  return (
    <section
      ref={sectionRef}
      aria-label={`Featured HAMPORIUM campaign: ${campaignName || title}`}
      className="relative isolate w-full overflow-hidden bg-[#EAE5DB] py-9 text-[#161715] sm:py-12 lg:py-[60px]"
    >
      <div className="mx-auto w-full max-w-[2000px] px-3 sm:px-7 xl:px-[4vw]">
        <Link
          to={destination}
          onClick={() => trackCampaign(campaign._id, "click", placement)}
          aria-label={`Explore ${campaignName || title}`}
          className="group relative isolate block w-full overflow-hidden bg-[#161715] shadow-[0_16px_50px_rgba(22,23,21,.2)] outline-none transition-shadow duration-500 hover:shadow-[0_24px_65px_rgba(22,23,21,.28)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#B79B6A]"
        >
          {/* Strong campaign photography, not a second home hero. */}
          <div className="relative h-[270px] overflow-hidden bg-[#403A32] sm:h-[350px] lg:absolute lg:inset-0 lg:h-full">
            {!imageFailed ? (
              <picture className="block h-full w-full">
                {campaign.mobileImage && (
                  <source media="(max-width: 639px)" srcSet={campaign.mobileImage} />
                )}
                <img
                  src={campaign.bannerImage}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover object-center transition-transform duration-[1200ms] ease-out group-hover:scale-[1.035] motion-reduce:transition-none lg:object-[66%_center]"
                />
              </picture>
            ) : (
              <div className="h-full w-full bg-[radial-gradient(ellipse_at_75%_40%,#B79B6A_0%,#403A32_55%,#161715_100%)]" />
            )}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#161715]/35 to-transparent lg:bg-gradient-to-r lg:from-[#161715]/35 lg:via-transparent lg:to-transparent"
            />
            <span className="absolute right-4 top-4 bg-[#FAF8F4] px-4 py-2.5 text-[13px] font-extrabold uppercase tracking-[.08em] text-[#161715] shadow-lg sm:right-7 sm:top-7 sm:px-5 sm:text-[15px]">
              SPECIAL CAMPAIGN <span className="ml-1 text-[#A68655]">✦</span>
            </span>
          </div>

          {/* The ivory poster is deliberately distinct from normal homepage sections. */}
          <div className="relative z-10 -mt-9 mx-3 mb-3 border-l-[6px] border-[#B79B6A] bg-[#FAF8F4] px-6 py-9 shadow-[0_18px_45px_rgba(0,0,0,.19)] sm:-mt-12 sm:mx-6 sm:mb-6 sm:px-10 sm:py-11 lg:my-[50px] lg:ml-[5vw] lg:mr-auto lg:flex lg:min-h-[450px] lg:w-[min(49%,690px)] lg:flex-col lg:justify-center lg:px-[clamp(36px,3.4vw,72px)] lg:py-14 lg:shadow-[15px_20px_55px_rgba(0,0,0,.24)] xl:min-h-[500px]">
            <p className="text-[15px] font-black uppercase leading-tight tracking-[.08em] text-[#987443] sm:text-[18px] lg:text-[19px]">
              {kicker}
            </p>
            <h2 className="mt-4 max-w-[640px] break-words font-serif text-[clamp(39px,4.5vw,80px)] font-bold leading-[1.04] tracking-[-.045em] text-[#161715] [text-wrap:balance] sm:mt-6">
              {title}
            </h2>
            <p className="mt-5 max-w-[570px] text-[19px] font-extrabold leading-[1.3] text-[#403A32] sm:mt-7 sm:text-[clamp(22px,2vw,28px)]">
              {tagline}
            </p>
            <div className="mt-8 sm:mt-10">
              <span className="inline-flex min-h-[54px] items-center justify-center gap-5 bg-[#161715] px-6 py-4 text-[14px] font-extrabold leading-snug text-[#FAF8F4] transition-colors duration-300 group-hover:bg-[#403A32] sm:min-h-[60px] sm:gap-7 sm:px-8 sm:text-[16px]">
                {buttonText}
                <span
                  aria-hidden="true"
                  className="text-2xl font-bold leading-none text-[#D8B77C] transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
                >
                  ↗
                </span>
              </span>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
