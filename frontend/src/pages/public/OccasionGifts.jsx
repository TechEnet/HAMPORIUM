
// EXACT PATH: frontend/src/pages/public/OccasionGifts.jsx
// Tailwind-only. Uses the existing published-occasion API; no catalog updates.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/api.js";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
function imageOf(product) {
  const first = Array.isArray(product?.images) ? product.images[0] : null;
  return typeof first === "string" ? first : first?.url || first?.secure_url || "";
}
function priceOf(value) {
  if (value === null || value === undefined || value === "") return "View details";
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? rupees.format(amount) : "View details";
}

function GiftCard({ product, index }) {
  if (!product?._id || !product?.slug) return null;
  const image = imageOf(product);
  return (
    <Link to={`/products/${encodeURIComponent(product.slug)}`} className="group block min-w-0 overflow-hidden border border-[#E8E1D7] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(44,34,24,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BD9560]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#EDE7DF]">
        {image ? <img src={image} alt={product.name || "Gift hamper"} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 motion-reduce:transition-none group-hover:scale-[1.045]" /> : <div className="flex h-full items-center justify-center font-serif text-5xl text-[#A38760]">H</div>}
        <span className="absolute left-4 top-4 bg-[#FBF8F3]/95 px-3 py-2 text-[10px] tracking-[.22em] text-[#6E604D]">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.19em] text-[#A4875D]">Curated gifting</p>
        <h3 className="mt-2 line-clamp-2 font-serif text-[23px] leading-tight text-[#241E18]">{product.name || "Gift hamper"}</h3>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#EEE8DF] pt-4"><span className="text-sm font-medium text-[#40352B]">{priceOf(product.minPrice)}</span><span className="text-xs font-semibold text-[#8D673F]">Discover ↗</span></div>
      </div>
    </Link>
  );
}

export default function OccasionGifts() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError("");
    api.get(`/marketing-studio/public/occasions/${encodeURIComponent(slug)}/products`, { signal: controller.signal })
      .then(({ data: payload }) => { if (!controller.signal.aborted) setData(payload); })
      .catch((caught) => {
        if (controller.signal.aborted || caught.code === "ERR_CANCELED") return;
        setError(caught.response?.status === 404 ? "This gifting collection isn't available yet." : "We couldn't load this collection right now.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug]);

  const products = Array.isArray(data?.products) ? data.products : [];
  const name = data?.occasion?.name || "Shop by Occasion";
  const cover = imageOf(products[0]);

  return (
    <main className="min-h-[75vh] bg-[#F8F6F2] pb-20 text-[#28221C]">
      <div className="mx-auto max-w-[1440px] px-4 pt-7 sm:px-8 lg:px-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[.15em] text-[#817465]">
          <Link to="/" className="hover:text-[#6E4C2C]">Home</Link><span>/</span>
          <Link to="/gifts" className="hover:text-[#6E4C2C]">Gifting</Link><span>/</span><span className="text-[#3B3026]">Occasions</span>
        </nav>
        {loading ? (
          <div role="status" className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-[#75695E]"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#DCCBB3] border-t-[#8D6D47] motion-reduce:animate-none" />Finding thoughtful gifts…</div>
        ) : error ? (
          <section className="mx-auto my-14 max-w-[720px] border border-[#E9E0D4] bg-white px-7 py-20 text-center sm:px-14">
            <span className="text-2xl text-[#B78A57]">✦</span><p className="mt-5 text-[10px] font-semibold uppercase tracking-[.24em] text-[#AC865C]">HAMPORIUM / Occasions</p>
            <h1 className="mt-5 font-serif text-[clamp(34px,5vw,55px)] leading-tight">{error}</h1>
            <p className="mt-4 text-sm leading-7 text-[#827467]">Discover more ways to gift something meaningful.</p>
            <Link to="/gifts" className="mt-8 inline-flex items-center gap-6 bg-[#28211B] px-7 py-4 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[#66513A]">Explore all gifts <span>↗</span></Link>
          </section>
        ) : (
          <>
            <header className="mt-6 grid min-h-[490px] overflow-hidden bg-[#EAE1D4] lg:grid-cols-2">
              <div className="flex flex-col justify-center px-8 py-14 sm:px-14 lg:px-20">
                <p className="text-[10px] font-bold uppercase tracking-[.26em] text-[#9B774A]">✦ &nbsp; HAMPORIUM / THE OCCASION EDIT</p>
                <h1 className="mt-6 font-serif text-[clamp(47px,5.8vw,84px)] font-normal leading-[.99] tracking-[-.045em] [text-wrap:balance]">{name}</h1>
                <div className="mt-7 h-px w-24 bg-[#B38C5D]" />
                <p className="mt-6 max-w-[465px] text-sm leading-7 text-[#766A5E] sm:text-[15px]">Every occasion deserves something meaningful. Discover gifts selected for moments worth celebrating.</p>
                <a href="#occasion-gifts" className="mt-9 inline-flex w-fit items-center gap-7 bg-[#28211B] px-6 py-4 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#685039]">Discover gifts <span className="text-lg font-normal">↗</span></a>
              </div>
              <div className="relative min-h-[340px] overflow-hidden bg-[#CFC3B0] lg:min-h-[490px]">
                {cover ? <img src={cover} alt="" decoding="async" className="h-full w-full object-cover" /> : <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#AD9778] via-[#DAC9AC] to-[#887052] text-center text-[#FFF5E5]"><span className="font-serif text-[140px] font-light leading-none">H</span><span className="text-[10px] tracking-[.36em]">HAMPORIUM</span></div>}
                <span aria-hidden="true" className="absolute bottom-6 right-6 border border-white/60 bg-[#20180F]/65 px-4 py-3 text-center text-[10px] font-medium tracking-[.22em] text-white backdrop-blur-sm">THE ART<br />OF GIVING</span>
              </div>
            </header>
            <section id="occasion-gifts" className="scroll-mt-12 pb-8 pt-14 sm:pt-20" aria-labelledby="occasion-gifts-heading">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-5 border-b border-[#E6DCD0] pb-7">
                <div><p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#AD8858]">A gift for the moment</p><h2 id="occasion-gifts-heading" className="mt-3 font-serif text-[clamp(34px,4vw,56px)] leading-tight">{products.length ? "Made to be remembered." : "Explore more ways to give."}</h2><p className="mt-2 max-w-[650px] text-sm leading-7 text-[#796D61]">{products.length ? "Available hampers chosen for this occasion." : "There are no available hampers linked to this occasion right now. Discover our wider gifting collection."}</p></div>
                <Link to="/gifts" className="border-b border-[#B39468] pb-1 text-xs font-semibold uppercase tracking-wider text-[#765936]">All gifts ↗</Link>
              </div>
              {products.length ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map((product, index) => <GiftCard key={product._id || index} product={product} index={index} />)}</div> : <div className="flex flex-col items-start justify-between gap-7 border border-[#E4D9C9] bg-[#F0E8DD] p-8 sm:flex-row sm:items-center sm:p-12"><div><p className="text-[10px] font-semibold uppercase tracking-[.23em] text-[#A78354]">The art of giving</p><h3 className="mt-3 font-serif text-3xl sm:text-4xl">The perfect gesture is waiting.</h3><p className="mt-3 max-w-xl text-sm leading-7 text-[#746454]">Browse the full HAMPORIUM collection for more gifts.</p></div><Link to="/gifts" className="inline-flex shrink-0 items-center gap-7 bg-[#29221B] px-6 py-4 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#6A5138]">Shop all gifts <span>↗</span></Link></div>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
