import { Link, useNavigate } from "react-router-dom";

import { useCart } from "../../context/CartContext.jsx";
import formatCurrency from "../../utils/formatCurrency.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const Cart = () => {
  const navigate = useNavigate();
  const {
    cart,
    cartLoading,
    updateQuantity,
    updateCustomHamperQuantity,
    removeFromCart,
    removeCustomHamper,
  } = useCart();

  if (cartLoading) {
    return (
      <main className="min-h-screen bg-[#FBF8F4] px-5 pb-20 pt-[120px]">
        <div className="mx-auto max-w-[1500px] animate-pulse rounded-2xl bg-white p-10 text-sm text-black/35">
          Loading cart...
        </div>
      </main>
    );
  }

  if (!cart.items?.length) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FBF8F4] px-5 text-center">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
            HAMPORIUM
          </p>
          <h1 style={{ fontFamily: DISPLAY_FONT }} className="mt-3 text-[48px] font-semibold">
            Your cart is empty
          </h1>
          <p className="mt-3 text-sm text-black/40">
            Explore the collection and add something thoughtful.
          </p>
          <Link
            to="/gifts"
            className="mt-7 inline-flex rounded-xl bg-[#F97316] px-7 py-3 text-xs font-extrabold text-white transition hover:bg-[#171717]"
          >
            Explore Gifts
          </Link>
        </div>
      </main>
    );
  }

  const checkoutBlocked = Boolean(cart.hasUnavailableItems);

  return (
    <main className="min-h-screen bg-[#FBF8F4] pb-20 pt-[110px] text-[#171717]">
      <section className="mx-auto w-full max-w-[1540px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/[0.07] pb-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
              Shopping Bag
            </p>
            <h1 style={{ fontFamily: DISPLAY_FONT }} className="mt-1 text-[46px] font-semibold leading-none">
              Your Cart
            </h1>
          </div>
          <Link to="/gifts" className="text-xs font-bold text-[#F97316]">
            Continue shopping →
          </Link>
        </div>

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
            <div className="divide-y divide-black/[0.06]">
              {cart.items.map((item) =>
                item.itemType === "custom_hamper" ? (
                  <CustomHamperItem
                    key={item.cartItemId}
                    item={item}
                    updateQuantity={updateCustomHamperQuantity}
                    removeItem={removeCustomHamper}
                  />
                ) : (
                  <SkuItem
                    key={item.sku?._id || item.cartItemId}
                    item={item}
                    updateQuantity={updateQuantity}
                    removeItem={removeFromCart}
                  />
                )
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-black/[0.06] bg-white p-6 xl:sticky xl:top-[105px]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">
              Summary
            </p>
            <h2 style={{ fontFamily: DISPLAY_FONT }} className="mt-1 text-[30px] font-semibold">
              Order Summary
            </h2>

            <div className="mt-6 space-y-4">
              <SummaryRow
                label={`Subtotal (${cart.totalItems} ${cart.totalItems === 1 ? "item" : "items"})`}
                value={formatCurrency(cart.subtotal)}
              />
              <SummaryRow label="Shipping" value="FREE" accent />
            </div>

            <div className="mt-5 rounded-xl border border-[#D4AF37]/25 bg-[#FFF9F2] px-4 py-3 text-[10px] leading-5 text-black/50">
              Catalogue prices shown here include configured GST after any configured discount. The final taxable value and CGST/SGST or IGST split is recalculated and permanently snapshotted at checkout using the delivery state.
            </div>

            {cart.hasUnavailableItems && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] leading-5 text-red-700">
                One or more cart items are no longer orderable. Remove or rebuild them before checkout.
              </div>
            )}

            <div className="mt-6 border-t border-black/[0.07] pt-5">
              <SummaryRow label="Total Amount" value={formatCurrency(cart.subtotal)} strong />
            </div>

            <button
              type="button"
              disabled={checkoutBlocked}
              onClick={() => navigate("/checkout")}
              className="mt-6 h-[54px] w-full rounded-xl bg-[#F97316] px-5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/30"
            >
              Proceed to Checkout
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
};

const SkuItem = ({ item, updateQuantity, removeItem }) => {
  const sku = item.sku || {};
  const product = item.product || {};
  const image = sku.images?.[0]?.url || product.images?.[0]?.url || "";

  return (
    <article className="p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-[130px_minmax(0,1fr)_auto] lg:items-center">
        <Link
          to={product.slug ? `/products/${product.slug}` : "/gifts"}
          className="h-[120px] w-[120px] overflow-hidden rounded-xl bg-[#F5F1EC] lg:h-[130px] lg:w-[130px]"
        >
          {image && <img src={image} alt={product.name || sku.name} className="h-full w-full object-cover" />}
        </Link>

        <div className="min-w-0">
          <Link
            to={product.slug ? `/products/${product.slug}` : "/gifts"}
            className="text-sm font-black transition hover:text-[#F97316]"
          >
            {product.name || sku.name || "HAMPORIUM item"}
          </Link>
          <p className="mt-1 text-xs text-black/40">{sku.name || sku.code || ""}</p>

          <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold text-black/40">
            {sku.baseSellingPrice !== undefined && (
              <span>Base {formatCurrency(sku.baseSellingPrice)}</span>
            )}
            {sku.taxEnabled !== false && Number(sku.taxPercent || 0) > 0 && (
              <span>GST {sku.taxPercent}%</span>
            )}
            {sku.hsnSac && <span>HSN/SAC {sku.hsnSac}</span>}
            {sku.discount?.enabled && (
              <span>
                Discount {sku.discount.value || 0}
                {sku.discount.type === "fixed" ? " INR" : "%"}
              </span>
            )}
          </div>

          <p className="mt-3 text-sm font-black">{formatCurrency(sku.price)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:justify-end">
          <Quantity
            quantity={item.quantity}
            onDecrease={() => updateQuantity(sku._id, item.quantity - 1)}
            onIncrease={() => updateQuantity(sku._id, item.quantity + 1)}
          />
          <p className="min-w-[100px] text-right text-sm font-black">
            {formatCurrency(item.lineTotal)}
          </p>
          <button
            type="button"
            onClick={() => removeItem(sku._id)}
            className="text-xs font-bold text-red-600"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
};

const CustomHamperItem = ({ item, updateQuantity, removeItem }) => {
  const custom = item.customHamper || {};
  const container = custom.container || {};
  const pricing = custom.pricing || {};
  const decorations = custom.decorations || [];
  const personalization = custom.personalization || null;
  const image = container.images?.[0]?.url || "";

  return (
    <article className="p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-[130px_minmax(0,1fr)_auto] lg:items-center">
        <Link to="/custom-hamper" className="h-[120px] w-[120px] overflow-hidden rounded-xl bg-[#171717] lg:h-[130px] lg:w-[130px]">
          {image && <img src={image} alt={container.name || "Custom Hamper"} className="h-full w-full object-cover" />}
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/custom-hamper" className="text-sm font-black hover:text-[#F97316]">
              Custom Hamper
            </Link>
            <span className="rounded-full bg-[#FFF1E8] px-2 py-1 text-[8px] font-black uppercase text-[#F97316]">
              Build Your Own
            </span>
          </div>
          <p className="mt-1 text-xs text-black/40">Box: {container.name || "Unavailable box"}</p>

          <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold text-black/40">
            {pricing.containerTaxPercent !== undefined && (
              <span>Box GST {pricing.containerTaxPercent || 0}%</span>
            )}
            {pricing.containerHsnSac && <span>Box HSN/SAC {pricing.containerHsnSac}</span>}
            {(pricing.items || []).length > 0 && <span>{pricing.items.length} priced content line(s)</span>}
            {(pricing.decorations || []).length > 0 && <span>{pricing.decorations.length} decoration line(s)</span>}
          </div>

          <div className="mt-3 space-y-1">
            {(custom.items || []).slice(0, 4).map((selection, index) => (
              <p key={selection.component?._id || selection.componentId || index} className="text-[10px] text-black/45">
                {selection.component?.name || "Hamper item"} × {selection.quantity}
              </p>
            ))}
          </div>

          {decorations.length > 0 && (
            <div className="mt-3 rounded-xl border border-[#D4AF37]/20 bg-[#FFF9F2] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8A6D15]">Decorative Finishing</p>
              <div className="mt-1.5 space-y-1">
                {decorations.slice(0, 4).map((selection, index) => (
                  <p key={selection.component?._id || selection.componentId || index} className="text-[10px] text-black/50">
                    {selection.component?.name || "Decoration"} × {selection.quantity}
                  </p>
                ))}
              </div>
              {pricing.decorationsTotal !== undefined && pricing.decorationsTotal !== null && (
                <p className="mt-2 text-[10px] font-bold text-[#8A6D15]">
                  Decoration total: {formatCurrency(pricing.decorationsTotal)} · No hamper capacity used
                </p>
              )}
            </div>
          )}

          {personalization?.enabled && (
            <div className="mt-3 rounded-xl border border-[#F97316]/15 bg-[#FFF7F0] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#F97316]">Personalisation</p>
                <span className="text-[9px] font-bold text-black/30">{personalization.assets?.length || 0} artwork file(s)</span>
              </div>

              {personalization.assets?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {personalization.assets.slice(0, 4).map((asset, index) => (
                    <a
                      key={asset.publicId || `${asset.url}-${index}`}
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white p-1.5 pr-2.5 transition hover:border-[#F97316]/40"
                    >
                      <img src={asset.url} alt="" className="h-9 w-9 rounded-md bg-[#F5F1EC] object-contain p-0.5" />
                      <span className="max-w-[130px] text-[9px] font-bold capitalize text-black/48">
                        {String(asset.type || "artwork").replaceAll("_", " ")} · {String(asset.placement || "other").replaceAll("_", " ")}
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {personalization.message && (
                <p className="mt-2 text-[10px] font-semibold leading-4 text-black/50"><strong>Text:</strong> {personalization.message}</p>
              )}
              {personalization.instructions && (
                <p className="mt-1 text-[10px] font-semibold leading-4 text-black/40"><strong>Instructions:</strong> {personalization.instructions}</p>
              )}
            </div>
          )}

          {!item.orderable && item.message && (
            <p className="mt-3 text-xs text-red-600">{item.message}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:justify-end">
          <Quantity
            quantity={item.quantity}
            onDecrease={() => updateQuantity(item.cartItemId, item.quantity - 1)}
            onIncrease={() => updateQuantity(item.cartItemId, item.quantity + 1)}
          />
          <p className="min-w-[100px] text-right text-sm font-black">
            {item.orderable ? formatCurrency(item.lineTotal) : "—"}
          </p>
          <button
            type="button"
            onClick={() => removeItem(item.cartItemId)}
            className="text-xs font-bold text-red-600"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
};

const Quantity = ({ quantity, onDecrease, onIncrease }) => (
  <div className="inline-flex h-10 items-center overflow-hidden rounded-lg border border-black/10">
    <button type="button" onClick={onDecrease} className="h-full w-10 text-lg hover:bg-[#FFF9F2]">−</button>
    <span className="flex h-full min-w-[42px] items-center justify-center border-x border-black/10 text-xs font-black">{quantity}</span>
    <button type="button" disabled={quantity >= 99} onClick={onIncrease} className="h-full w-10 text-lg hover:bg-[#FFF9F2] disabled:opacity-25">+</button>
  </div>
);

const SummaryRow = ({ label, value, accent = false, strong = false }) => (
  <div className="flex items-center justify-between gap-5">
    <span className={strong ? "text-sm font-black" : "text-xs text-black/45"}>{label}</span>
    <span className={`${strong ? "text-xl font-black" : "text-xs font-black"} ${accent ? "text-emerald-600" : ""}`}>{value}</span>
  </div>
);

export default Cart;
