// EXACT PATH: frontend/src/pages/public/CampaignLanding.jsx
// HAMPORIUM Campaign Landing V8 - quiet-luxury, full-bleed, Tailwind-only.
// Existing campaign, occasion, product and checkout APIs remain unchanged.

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/api.js";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function getImage(product) {
  const first = Array.isArray(product?.images) ? product.images[0] : null;
  return typeof first === "string" ? first : first?.url || first?.secure_url || "";
}

function getPrice(value) {
  if (value === null || value === undefined || value === "") return "View details";
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? inr.format(amount) : "View details";
}

function getOccasionId(value) {
  return typeof value === "string" ? value : value?._id || "";
}

function GiftCard({ product }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!product?._id || !product?.slug) return null;

  const image = getImage(product);
  return (
    <Link
      to={`/products/${encodeURIComponent(product.slug)}`}
      className="group block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-[#927348] focus-visible:ring-offset-4"
      aria-label={`View ${product.name || "gift"}`}
    >
      <div className="relative aspect-[4/4.75] overflow-hidden bg-[#ECE9E3]">
        {image && !imageFailed ? (
          <img
            src={image}
            alt={product.name || "HAMPORIUM gift"}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.055] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#E9E3D9] to-[#CFC3B1]">
            <span className="font-serif text-[clamp(80px,10vw,150px)] font-light text-[#A99B88]/60" aria-hidden="true">H</span>
          </div>
        )}
        <span
          aria-hidden="true"
          className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#FAF8F4] text-xl text-[#2B241D] shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 motion-reduce:transition-none"
        >
          ↗
        </span>
      </div>
      <div className="flex items-start justify-between gap-4 pb-3 pt-4 sm:pt-5">
        <h3 className="min-w-0 max-w-[75%] font-serif text-[clamp(21px,2.1vw,30px)] font-normal leading-[1.15] tracking-[-0.025em] text-[#2B261F] transition-colors duration-300 group-hover:text-[#926B42]">
          {product.name || "Thoughtful gifting"}
        </h3>
        <span className="shrink-0 pt-1 text-right text-xs font-medium text-[#756759] sm:text-sm">
          {getPrice(product.minPrice)}
        </span>
      </div>
    </Link>
  );
}

export default function CampaignLanding() {
  const { slug } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [products, setProducts] = useState([]);
  const [occasion, setOccasion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true);
    setFailed(false);
    setCampaign(null);
    setProducts([]);
    setOccasion(null);
    setBannerFailed(false);

    async function load() {
      try {
        const response = await api.get("/marketing-studio/public/campaigns", { signal });
        if (signal.aborted) return;

        const list = Array.isArray(response.data?.campaigns) ? response.data.campaigns : [];
        const current = list.find((entry) => entry?.slug === slug) || null;
        setCampaign(current);
        if (!current) return;

        const featured = Array.isArray(current.products) ? current.products : [];
        if (featured.length) {
          setProducts(featured);
          return;
        }

        // Only published/available catalog items are returned by public APIs.
        // A missing or unpublished occasion never hides an active campaign.
        const linkedId = getOccasionId(current.occasion);
        if (!linkedId) return;
        try {
          const occasionResponse = await api.get("/marketing-studio/public/occasions", { signal });
          if (signal.aborted) return;
          const choices = Array.isArray(occasionResponse.data?.occasions)
            ? occasionResponse.data.occasions
            : [];
          const match = choices.find((item) => String(item._id) === String(linkedId));
          if (!match?.slug) return;
          setOccasion(match);
          const collection = await api.get(
            `/marketing-studio/public/occasions/${encodeURIComponent(match.slug)}/products`,
            { signal }
          );
          if (!signal.aborted) {
            setProducts(Array.isArray(collection.data?.products) ? collection.data.products : []);
          }
        } catch {
          // Optional fallback only.
        }
      } catch {
        if (!signal.aborted) setFailed(true);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [slug]);

  const headline = campaign?.headline || campaign?.name || "The HAMPORIUM Edit";
  const hasBanner = !!campaign?.bannerImage && !bannerFailed;

  if (loading) {
    return (
      <main className="flex min-h-[80svh] items-center justify-center bg-[#211E1A] text-[#EEE7DC]" role="status" aria-live="polite">
        <div className="flex items-center gap-4">
          <span className="h-5 w-5 animate-spin rounded-full border border-[#BCA37D]/40 border-t-[#D8B88B] motion-reduce:animate-none" />
          <span className="text-[10px] uppercase tracking-[0.3em]">HAMPORIUM</span>
        </div>
      </main>
    );
  }

  if (failed || !campaign) {
    return (
      <main className="flex min-h-[80svh] flex-col items-center justify-center bg-[#F8F6F1] px-5 text-center text-[#2B241E]">
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#A88660]">HAMPORIUM</p>
        <h1 className="mt-6 max-w-[680px] font-serif text-[clamp(38px,6vw,76px)] leading-[1.02] tracking-[-0.04em]">A little more to discover.</h1>
        <Link to="/gifts" className="mt-9 inline-flex items-center gap-5 border-b border-[#5B4735] pb-2 text-[11px] font-semibold uppercase tracking-[0.14em]">Explore all gifts <span aria-hidden="true">↗</span></Link>
      </main>
    );
  }

  return (
    <main className="w-full min-w-0 overflow-x-clip bg-[#F9F7F3] text-[#29241F]">
      {/* An edge-to-edge campaign image with only the essentials on top. */}
      <header className="relative isolate flex h-[82svh] min-h-[560px] max-h-[1000px] w-full flex-col overflow-hidden bg-[#251F1B] text-white sm:h-[88svh] sm:min-h-[640px]">
        <div className="absolute inset-0" aria-hidden="true">
          {hasBanner ? (
            <picture className="block h-full w-full">
              {campaign.mobileImage && <source media="(max-width: 639px)" srcSet={campaign.mobileImage} />}
              <img
                src={campaign.bannerImage}
                alt=""
                fetchPriority="high"
                decoding="async"
                onError={() => setBannerFailed(true)}
                className="h-full w-full object-cover object-center sm:object-[center_42%]"
              />
            </picture>
          ) : (
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_75%_35%,#695642_0%,#312820_50%,#171411_100%)]" />
          )}
        </div>

        {/* Soft contrast for the headline; keep most of the artwork visible. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/20 sm:bg-gradient-to-r sm:from-black/65 sm:via-black/20 sm:to-transparent" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent sm:hidden" aria-hidden="true" />

        <div className="relative z-10 flex items-center justify-between px-6 pt-7 sm:px-[5vw] sm:pt-9 lg:px-[6vw]">
          <Link to="/" className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/90 transition-colors hover:text-white focus-visible:underline">HAMPORIUM</Link>
          <Link to="/gifts" className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.17em] text-white/75 transition-colors hover:text-white focus-visible:underline">All gifts <span aria-hidden="true">↗</span></Link>
        </div>

        <div className="relative z-10 mt-auto w-full px-6 pb-14 sm:px-[5vw] sm:pb-20 lg:px-[6vw] lg:pb-[9vh]">
          <div className="mb-5 flex items-center gap-3 sm:mb-7">
            <span className="h-px w-8 bg-[#E0C5A0]" aria-hidden="true" />
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-[#E7D4B6]">The gifting edit</p>
          </div>
          <h1 className="max-w-[820px] break-words font-serif text-[clamp(45px,6.5vw,112px)] font-normal leading-[0.98] tracking-[-0.045em] [text-wrap:balance]">
            {headline}
          </h1>
          <a href="#collection" className="group mt-8 inline-flex items-center gap-6 border-b border-white/80 pb-2.5 text-[11px] font-medium uppercase tracking-[0.19em] transition-colors hover:border-[#E9CE9E] hover:text-[#F0D7B0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:mt-10">
            Explore the collection
            <span className="text-lg leading-none transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      {/* No slogan strips, breadcrumbs or long descriptions: focus on the gifts. */}
      <section
        id="collection"
        aria-labelledby="collection-heading"
        className="w-full scroll-mt-6 px-5 pb-24 pt-16 sm:px-[5vw] sm:pb-28 sm:pt-24 lg:px-[6vw] lg:pb-32"
      >
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5 sm:mb-12">
          <div>
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.26em] text-[#9D815F]">HAMPORIUM / CURATED</p>
            <h2 id="collection-heading" className="font-serif text-[clamp(40px,5vw,80px)] font-normal leading-[1] tracking-[-0.045em]">
              {products.length ? "The Collection" : "More to Explore"}
            </h2>
          </div>
          <Link to="/gifts" className="inline-flex items-center gap-3 border-b border-[#988064] pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#735D47] transition-colors hover:text-[#2B241E]">
            All gifts <span aria-hidden="true">↗</span>
          </Link>
        </div>

        {products.length ? (
          <div className="grid grid-cols-1 gap-x-5 gap-y-9 min-[520px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 2xl:gap-x-7">
            {products.map((product) => <GiftCard key={product._id} product={product} />)}
          </div>
        ) : (
          <div className="flex min-h-[310px] flex-col items-center justify-center border-y border-[#DCD5CA] py-16 text-center">
            <h3 className="font-serif text-[clamp(31px,4vw,55px)] font-normal tracking-[-0.035em] text-[#342C24]">Something beautiful is coming.</h3>
            <p className="mt-3 text-sm text-[#85786A]">Selected gifts are not available online yet.</p>
            <Link to="/gifts" className="mt-8 inline-flex items-center gap-4 border-b border-[#806449] pb-2 text-[11px] uppercase tracking-[0.17em] text-[#654D36]">Browse gifts <span aria-hidden="true">↗</span></Link>
          </div>
        )}

        {occasion?.slug && (
          <div className="mt-14 border-t border-[#E4DFD6] pt-6 sm:mt-20">
            <Link to={`/occasions/${encodeURIComponent(occasion.slug)}`} className="inline-flex items-center gap-4 text-xs text-[#6D5841] transition-colors hover:text-[#2C251D]">
              Explore {occasion.name} gifts <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
