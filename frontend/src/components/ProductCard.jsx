
import {
  Link,
  useLocation,
} from "react-router-dom";

import formatCurrency from "../utils/formatCurrency.js";
import {
  useDeliveryLocation,
} from "../context/LocationContext.jsx";
import {
  trackSearchAnalytics,
} from "../utils/analytics.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const toMoneyNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) &&
    number >= 0
    ? number
    : null;
};

const resolveCardPricing = (product) => {
  const backendPricing = product?.pricingSummary;

  const sellingPrice =
    toMoneyNumber(backendPricing?.sellingPrice) ??
    toMoneyNumber(product?.cardPrice) ??
    toMoneyNumber(product?.minPrice) ??
    toMoneyNumber(product?.price);

  const compareAtPrice =
    toMoneyNumber(backendPricing?.compareAtPrice) ??
    toMoneyNumber(product?.compareAtPrice) ??
    toMoneyNumber(product?.minCompareAtPrice) ??
    toMoneyNumber(product?.mrp) ??
    toMoneyNumber(product?.minMrp);

  const validCompareAtPrice =
    compareAtPrice !== null &&
    sellingPrice !== null &&
    compareAtPrice > sellingPrice
      ? compareAtPrice
      : null;

  const calculatedDiscountAmount =
    validCompareAtPrice !== null
      ? Number((validCompareAtPrice - sellingPrice).toFixed(2))
      : 0;

  const calculatedDiscountPercent =
    validCompareAtPrice !== null &&
    validCompareAtPrice > 0
      ? Math.round(
          ((validCompareAtPrice - sellingPrice) /
            validCompareAtPrice) * 100
        )
      : 0;

  const discountAmount =
    toMoneyNumber(backendPricing?.discountAmount) ??
    toMoneyNumber(product?.discountAmount) ??
    calculatedDiscountAmount;

  const discountPercent =
    Number(
      backendPricing?.discountPercent ??
        product?.discountPercent ??
        calculatedDiscountPercent
    ) || 0;

  return {
    sellingPrice,
    compareAtPrice: validCompareAtPrice,
    discountAmount: validCompareAtPrice ? discountAmount : 0,
    discountPercent: validCompareAtPrice
      ? Math.max(0, Math.round(discountPercent))
      : 0,
  };
};

// Show genuine catalogue copy only. Never manufacture the same default
// sentence for every hamper card; mobile Gifts.jsx already deliberately
// passes an empty shortDescription to keep its two-column cards compact.
const getCardDescription = (value) => {
  const description = typeof value === "string" ? value.trim() : "";
  if (!description) return "";

  const normalized = description
    .replace(/\s+/g, " ")
    .replace(/[.!\s]+$/g, "")
    .toLowerCase();

  if (
    normalized === "a thoughtfully curated hamporium gift hamper" ||
    normalized === "a thoughtfully curated gift hamper"
  ) {
    return "";
  }

  return description;
};

const ProductCard = ({ product }) => {
  const location = useLocation();

  const { deliveryLocation } = useDeliveryLocation();

  const image = product.images?.[0]?.url;

  const averageRating = Number(
    product.reviewSummary?.averageRating ??
      product.averageRating ??
      0
  );

  const totalReviews = Number(
    product.reviewSummary?.totalReviews ??
      product.totalReviews ??
      0
  );

  const hasReviews = averageRating > 0 && totalReviews > 0;

  const searchParams = new URLSearchParams(location.search);
  const activeSearch = searchParams.get("search")?.trim() || "";

  const handleProductClick = () => {
    if (!activeSearch) return;

    void trackSearchAnalytics({
      eventType: "search_result_click",
      query: activeSearch,
      source: "catalog_search_grid",
      pagePath: `${location.pathname}${location.search}`,
      productId: product._id,
      productSlug: product.slug,
      productName: product.name,
      location: deliveryLocation,
    });
  };

  const samePrice =
    Number(product.minPrice) === Number(product.maxPrice);

  const hasPrice = Number.isFinite(Number(product.minPrice));

  const cardPricing = resolveCardPricing(product);

  const hasDiscount =
    cardPricing.compareAtPrice !== null &&
    cardPricing.discountPercent > 0;

  const cardDescription = getCardDescription(product.shortDescription);

  return (
    <Link
      to={`/products/${product.slug}`}
      onClick={handleProductClick}
      className="hp-card-root group flex h-full min-w-0 flex-col bg-transparent transition duration-300"
    >
      {/* IMAGE */}
      <div className="hp-card-media relative aspect-[16/10] w-full overflow-hidden bg-[#F1ECE5]">
        {image ? (
          <img
            src={image}
            alt={product.images?.[0]?.alt || product.name}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.035]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-semibold text-black/25">
            No image
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 via-black/[0.05] to-transparent" />

        {hasReviews && (
          <div
            className="absolute bottom-2.5 right-2.5 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/65 bg-white/95 px-2.5 py-1 shadow-[0_7px_20px_rgba(0,0,0,0.14)] backdrop-blur-md"
            aria-label={`${averageRating.toFixed(1)} out of 5 from ${totalReviews} reviews`}
          >
            <span className="text-[11px] leading-none text-[#D4AF37]">★</span>
            <span className="text-[9px] font-black leading-none text-[#171717]">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-[8px] font-bold leading-none text-black/35">
              ({totalReviews})
            </span>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="hp-card-content flex flex-1 flex-col pb-1 pt-3.5">
        <div className="min-h-[16px]">
          {product.category?.name && (
            <p className="hp-card-category text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#F47822]">
              {product.category.name}
            </p>
          )}
        </div>

        <h3
          style={{ fontFamily: DISPLAY_FONT }}
          className="hp-card-title mt-1.5 min-h-[44px] line-clamp-2 text-[22px] font-semibold leading-[1.06] tracking-[-0.025em] text-[#171717]"
        >
          {product.name}
        </h3>

        {/* Unique, real short descriptions only; no repeated fallback. */}
        {cardDescription && (
          <p className="hp-card-description mt-2 min-h-[46px] line-clamp-2 text-[13px] font-medium leading-[1.65] text-black/52 sm:text-[13.5px]">
            {cardDescription}
          </p>
        )}

        {/* PRICE */}
        <div className="hp-card-price-block mt-auto border-t border-black/[0.06] pt-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {hasPrice ? (
              samePrice ? (
                <p className="hp-card-price text-[19px] font-black tracking-[-0.025em] text-[#171717]">
                  {formatCurrency(product.minPrice)}
                </p>
              ) : (
                <p className="hp-card-price text-[18px] font-black tracking-[-0.025em] text-[#171717]">
                  {formatCurrency(product.minPrice)}
                  <span className="mx-1 text-black/25">–</span>
                  {formatCurrency(product.maxPrice)}
                </p>
              )
            ) : (
              <p className="text-[13px] font-extrabold text-[#171717]">
                View pricing
              </p>
            )}

            {hasDiscount && (
              <>
                <span className="text-[10px] font-semibold text-black/30 line-through">
                  {formatCurrency(cardPricing.compareAtPrice)}
                </span>
                <span className="inline-flex items-center rounded-full bg-[#FFF4E8] px-2 py-1 text-[8px] font-black uppercase tracking-[0.04em] text-[#E85D04]">
                  {cardPricing.discountPercent}% OFF
                </span>
              </>
            )}
          </div>

          {hasDiscount && cardPricing.discountAmount > 0 && (
            <p className="mt-1.5 text-[10px] font-bold text-emerald-700">
              You save {formatCurrency(cardPricing.discountAmount)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
