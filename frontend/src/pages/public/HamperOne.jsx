import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../../api/api.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1900&q=94";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1607344645866-009c320b63e0?auto=format&fit=crop&w=1200&q=90";

// ======================================================
// API IMAGE
// ======================================================

const getApiOrigin = () => {
  const baseURL =
    api.defaults?.baseURL ||
    "";

  return baseURL
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
};

const API_ORIGIN =
  getApiOrigin();

const resolveImage = (
  value
) => {
  if (!value) {
    return "";
  }

  let image = value;

  if (
    typeof image ===
    "object"
  ) {
    image =
      image.url ||
      image.secure_url ||
      image.src ||
      image.path ||
      "";
  }

  if (
    typeof image !==
      "string" ||
    !image
  ) {
    return "";
  }

  if (
    image.startsWith(
      "http://"
    ) ||
    image.startsWith(
      "https://"
    ) ||
    image.startsWith(
      "data:"
    ) ||
    image.startsWith(
      "blob:"
    )
  ) {
    return image;
  }

  if (
    image.startsWith("//")
  ) {
    return `https:${image}`;
  }

  return API_ORIGIN
    ? `${API_ORIGIN}${
        image.startsWith("/")
          ? ""
          : "/"
      }${image}`
    : image;
};

const getProductImage = (
  product
) => {
  const first =
    Array.isArray(
      product?.images
    )
      ? product.images[0]
      : null;

  return (
    resolveImage(first) ||
    FALLBACK_IMAGE
  );
};

// ======================================================
// HAMPER ONE
// ======================================================

const HamperOne = () => {
  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let active = true;

    const loadProducts =
      async () => {
        setLoading(true);

        setError("");

        try {
          /*
           * Product Master importer adds "hamper-one"
           * to Product.tags when HAMPER ONE? = Yes.
           *
           * Existing catalog search already searches tags,
           * so no new backend endpoint is required.
           */
          const response =
            await api.get(
              "/catalog/products",
              {
                params: {
                  search:
                    "hamper-one",

                  sort:
                    "featured",

                  limit: 12,
                },
              }
            );

          if (!active) {
            return;
          }

          setProducts(
            response.data
              .products ||
              []
          );
        } catch (
          requestError
        ) {
          if (!active) {
            return;
          }

          console.error(
            "HAMPER ONE products error:",
            requestError
          );

          setError(
            requestError
              .response?.data
              ?.message ||
              "Unable to load the HAMPER ONE collection."
          );
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main
      className="
        min-h-screen
        overflow-hidden
        bg-[#080808]
        text-[#F5F0E7]
      "
      style={{
        fontFamily:
          "'Manrope', Arial, sans-serif",
      }}
    >
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700;800&display=swap');
        `}
      </style>

      {/* ==================================================
          HERO
      ================================================== */}

      <section className="relative min-h-[740px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={
              HERO_IMAGE
            }
            alt=""
            className="h-full w-full object-cover object-center"
          />

          <div className="absolute inset-0 bg-black/52" />

          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/86 to-[#050505]/22" />

          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-black/20" />

          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 73% 43%, rgba(212,175,55,.15), transparent 27%)",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[740px] w-full max-w-[1600px] items-center px-5 pb-16 pt-[125px] sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-20">
          <div className="max-w-[760px]">
            <div className="flex items-center gap-4">
              <span className="h-px w-12 bg-[#D4AF37]" />

              <p className="text-[10px] font-extrabold uppercase tracking-[0.32em] text-[#D4AF37] sm:text-[11px]">
                HAMPORIUM PRIVATE COLLECTION
              </p>
            </div>

            <h1
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="mt-7 text-[74px] font-semibold leading-[0.75] tracking-[-0.035em] text-[#F2E5C0] sm:text-[96px] md:text-[112px] lg:text-[132px]"
            >
              HAMPER

              <span className="mt-3 block italic text-[#D4AF37]">
                ONE
              </span>
            </h1>

            <p
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="mt-8 text-[28px] font-medium italic leading-tight text-white/85 sm:text-[34px]"
            >
              Private gifting,
              <br />
              elevated.
            </p>

            <p className="mt-6 max-w-[590px] text-[14px] font-medium leading-7 text-white/58 sm:text-[16px]">
              An edit of rare, refined and signature
              hampers for moments where ordinary gifting
              is simply not enough.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#hamper-one-collection"
                className="inline-flex h-[54px] items-center gap-5 border border-[#D4AF37] bg-[#D4AF37] px-7 text-[10px] font-black uppercase tracking-[0.11em] text-[#111] transition hover:bg-[#e7ca66]"
              >
                Explore Collection

                <span>
                  ↓
                </span>
              </a>

              <Link
                to="/custom-hamper"
                className="inline-flex h-[54px] items-center gap-5 border border-white/20 bg-black/30 px-7 text-[10px] font-black uppercase tracking-[0.11em] text-white backdrop-blur-sm transition hover:border-[#D4AF37] hover:text-[#D4AF37]"
              >
                Create Bespoke
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-7 right-7 z-20 hidden items-center gap-3 text-[8px] font-bold uppercase tracking-[0.24em] text-white/35 sm:flex">
          <span className="h-px w-14 bg-[#D4AF37]/40" />

          HAMPER ONE
        </div>
      </section>

      {/* ==================================================
          PHILOSOPHY
      ================================================== */}

      <section className="border-y border-white/[0.08] bg-[#0D0D0D]">
        <div className="mx-auto grid w-full max-w-[1600px] md:grid-cols-2 xl:grid-cols-4">
          <LuxuryValue
            number="01"
            title="Rare Selection"
            text="An elevated edit of products chosen for exceptional gifting."
          />

          <LuxuryValue
            number="02"
            title="Signature Presentation"
            text="Premium boxes, considered details and an unmistakably refined finish."
          />

          <LuxuryValue
            number="03"
            title="Bespoke Direction"
            text="For gifting that needs to feel personal, distinctive and intentionally composed."
          />

          <LuxuryValue
            number="04"
            title="White-glove Mindset"
            text="A premium experience designed around important people and meaningful occasions."
            last
          />
        </div>
      </section>

      {/* ==================================================
          EDITORIAL
      ================================================== */}

      <section className="mx-auto grid w-full max-w-[1600px] gap-10 px-5 py-20 sm:px-8 md:px-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-12 xl:px-16 xl:py-28 2xl:px-20">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.27em] text-[#D4AF37]">
            THE HAMPER ONE EDIT
          </p>

          <h2
            style={{
              fontFamily:
                DISPLAY_FONT,
            }}
            className="mt-5 text-[50px] font-semibold leading-[0.92] tracking-[-0.025em] text-[#F2E5C0] sm:text-[66px]"
          >
            Designed for
            <span className="block italic text-[#D4AF37]">
              remarkable moments.
            </span>
          </h2>
        </div>

        <div className="border-l border-[#D4AF37]/30 pl-6 sm:pl-8 lg:pl-12">
          <p className="max-w-[700px] text-[15px] font-medium leading-8 text-white/55">
            HAMPER ONE sits apart from everyday
            gifting. It is the HAMPORIUM expression
            for higher-value, rare and highly considered
            gifting — where the selection, presentation
            and experience matter equally.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <EditorialStat
              value="Rare"
              label="Selections"
            />

            <EditorialStat
              value="Private"
              label="Experience"
            />

            <EditorialStat
              value="Signature"
              label="Presentation"
            />
          </div>
        </div>
      </section>

      {/* ==================================================
          COLLECTION
      ================================================== */}

      <section
        id="hamper-one-collection"
        className="bg-[#F2EDE2] text-[#171717]"
      >
        <div className="mx-auto w-full max-w-[1600px] px-5 py-20 sm:px-8 md:px-10 lg:px-12 xl:px-16 xl:py-24 2xl:px-20">
          <div className="flex flex-col gap-7 border-b border-black/[0.12] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-[#A88120]" />

                <p className="text-[10px] font-black uppercase tracking-[0.23em] text-[#8D6C18]">
                  HAMPER ONE COLLECTION
                </p>
              </div>

              <h2
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="mt-4 text-[48px] font-semibold leading-none tracking-[-0.03em] sm:text-[62px]"
              >
                The Private Edit
              </h2>

              <p className="mt-4 max-w-[690px] text-[13px] font-medium leading-6 text-black/48 sm:text-[14px]">
                Hampers tagged for HAMPER ONE in the
                Product Master appear here automatically.
              </p>
            </div>

            <Link
              to="/gifts"
              className="inline-flex w-fit items-center gap-3 border-b border-black/35 pb-1 text-[10px] font-black uppercase tracking-[0.1em] transition hover:border-[#A88120] hover:text-[#8D6C18]"
            >
              Browse Standard Collection
              <span>→</span>
            </Link>
          </div>

          {error && (
            <div className="mt-7 border-l-[3px] border-red-500 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="mt-8 grid gap-px bg-black/[0.08] sm:grid-cols-2 lg:grid-cols-3">
              {[
                1,
                2,
                3,
                4,
                5,
                6,
              ].map(
                (item) => (
                  <HamperOneSkeleton
                    key={item}
                  />
                )
              )}
            </div>
          ) : products.length ? (
            <div className="mt-8 grid gap-px bg-black/[0.08] sm:grid-cols-2 lg:grid-cols-3">
              {products.map(
                (
                  product,
                  index
                ) => (
                  <HamperOneProductCard
                    key={
                      product._id
                    }
                    product={
                      product
                    }
                    index={
                      index
                    }
                  />
                )
              )}
            </div>
          ) : (
            <div className="mt-8 border border-black/[0.1] bg-[#ECE5D7] px-6 py-16 text-center">
              <p
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="text-[34px] font-semibold"
              >
                The private edit is being prepared.
              </p>

              <p className="mx-auto mt-3 max-w-lg text-[12px] leading-6 text-black/45">
                Mark ready-made products as HAMPER ONE in
                Product Master and they will appear in
                this collection automatically.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ==================================================
          BESPOKE
      ================================================== */}

      <section className="relative overflow-hidden bg-[#090909]">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 85% 50%, rgba(212,175,55,.15), transparent 26%)",
          }}
        />

        <div className="relative z-10 mx-auto grid min-h-[420px] w-full max-w-[1600px] items-center gap-10 px-5 py-16 sm:px-8 md:px-10 lg:grid-cols-2 lg:px-12 xl:px-16 2xl:px-20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.27em] text-[#D4AF37]">
              BEYOND THE COLLECTION
            </p>

            <h2
              style={{
                fontFamily:
                  DISPLAY_FONT,
              }}
              className="mt-4 max-w-[650px] text-[48px] font-semibold leading-[0.92] tracking-[-0.03em] text-[#F2E5C0] sm:text-[62px]"
            >
              Make the gift
              <span className="block italic text-[#D4AF37]">
                distinctly yours.
              </span>
            </h2>
          </div>

          <div className="border-l border-white/12 pl-6 sm:pl-9">
            <p className="max-w-[610px] text-[14px] font-medium leading-7 text-white/52">
              Looking for something more personal?
              Begin with HAMPORIUM's build-your-own studio,
              or explore our managed Wedding and Corporate
              gifting experiences for larger requirements.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/custom-hamper"
                className="inline-flex h-[50px] items-center gap-4 bg-[#D4AF37] px-6 text-[10px] font-black uppercase tracking-[0.09em] text-[#111] transition hover:bg-[#e5ca68]"
              >
                Build Bespoke
                <span>→</span>
              </Link>

              <Link
                to="/weddings"
                className="inline-flex h-[50px] items-center gap-4 border border-white/18 px-6 text-[10px] font-black uppercase tracking-[0.09em] text-white transition hover:border-[#D4AF37] hover:text-[#D4AF37]"
              >
                Wedding Concierge
              </Link>

              <Link
                to="/corporate"
                className="inline-flex h-[50px] items-center gap-4 border border-white/18 px-6 text-[10px] font-black uppercase tracking-[0.09em] text-white transition hover:border-[#D4AF37] hover:text-[#D4AF37]"
              >
                Corporate Gifting
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

// ======================================================
// VALUE
// ======================================================

const LuxuryValue = ({
  number,
  title,
  text,
  last = false,
}) => (
  <div
    className={`
      min-h-[210px]
      px-6
      py-8

      md:px-8

      ${
        last
          ? ""
          : "border-b border-white/[0.08] md:border-r xl:border-b-0"
      }
    `}
  >
    <p className="text-[9px] font-black tracking-[0.18em] text-[#D4AF37]">
      {number}
    </p>

    <h3
      style={{
        fontFamily:
          DISPLAY_FONT,
      }}
      className="mt-5 text-[26px] font-semibold text-[#F2E5C0]"
    >
      {title}
    </h3>

    <p className="mt-3 max-w-[280px] text-[11px] font-medium leading-6 text-white/42">
      {text}
    </p>
  </div>
);

// ======================================================
// EDITORIAL STAT
// ======================================================

const EditorialStat = ({
  value,
  label,
}) => (
  <div className="border-t border-[#D4AF37]/25 pt-3">
    <p
      style={{
        fontFamily:
          DISPLAY_FONT,
      }}
      className="text-[25px] font-semibold text-[#D4AF37]"
    >
      {value}
    </p>

    <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">
      {label}
    </p>
  </div>
);

// ======================================================
// PRODUCT CARD
// ======================================================

const HamperOneProductCard = ({
  product,
  index,
}) => {
  const image =
    getProductImage(
      product
    );

  const price =
    Number(
      product.minPrice ??
        product.price ??
        0
    );

  return (
    <Link
      to={
        product.slug
          ? `/products/${product.slug}`
          : "/hamper-one"
      }
      className="group min-w-0 bg-[#F2EDE2] p-4 transition hover:bg-[#EAE1D1] sm:p-5"
    >
      <div className="relative aspect-[1/1.04] overflow-hidden bg-[#111]">
        <img
          src={image}
          alt={
            product.name
          }
          className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.035]"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        <div className="absolute left-4 top-4 border border-white/20 bg-black/55 px-3 py-1.5 backdrop-blur-sm">
          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#E6CB72]">
            HAMPER ONE
          </p>
        </div>

        <p className="absolute bottom-4 right-4 font-serif text-[12px] italic text-white/65">
          No.{" "}
          {String(
            index + 1
          ).padStart(
            2,
            "0"
          )}
        </p>
      </div>

      <div className="px-1 pb-2 pt-5">
        <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#8C6D1B]">
          {product.category
            ?.name ||
            "Private Collection"}
        </p>

        <h3
          style={{
            fontFamily:
              DISPLAY_FONT,
          }}
          className="mt-2 text-[27px] font-semibold leading-[1] tracking-[-0.02em] text-[#171717]"
        >
          {product.name}
        </h3>

        {product.shortDescription && (
          <p className="mt-3 line-clamp-2 text-[11px] font-medium leading-5 text-black/45">
            {
              product.shortDescription
            }
          </p>
        )}

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-black/[0.1] pt-4">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-black/30">
              From
            </p>

            <p className="mt-1 text-[15px] font-black text-[#171717]">
              ₹
              {price.toLocaleString(
                "en-IN"
              )}
            </p>
          </div>

          <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8C6D1B] transition group-hover:translate-x-1">
            View Piece →
          </span>
        </div>
      </div>
    </Link>
  );
};

// ======================================================
// SKELETON
// ======================================================

const HamperOneSkeleton = () => (
  <div className="bg-[#F2EDE2] p-5">
    <div className="aspect-square animate-pulse bg-black/10" />

    <div className="mt-5 h-2.5 w-24 animate-pulse bg-black/10" />

    <div className="mt-3 h-7 w-3/4 animate-pulse bg-black/10" />

    <div className="mt-4 h-3 w-full animate-pulse bg-black/[0.06]" />
  </div>
);

export default HamperOne;