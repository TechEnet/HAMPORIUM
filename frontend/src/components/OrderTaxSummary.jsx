import formatCurrency from "../utils/formatCurrency.js";

const money = (value) => formatCurrency(Number(value || 0));

const TaxRow = ({ label, value, strong = false, accent = false }) => (
  <div className="flex items-center justify-between gap-5 py-2 text-sm">
    <span className={strong ? "font-bold text-[#171717]" : "text-black/45"}>
      {label}
    </span>
    <span
      className={`${strong ? "font-black" : "font-semibold"} ${
        accent ? "text-[#F97316]" : "text-[#171717]"
      }`}
    >
      {value}
    </span>
  </div>
);

const OrderTaxSummary = ({ order, compact = false, dark = false }) => {
  if (!order) return null;

  const hasTaxSnapshot =
    order.taxAmount !== undefined ||
    order.taxSummary?.totalTax !== undefined ||
    order.taxableAmount !== undefined;

  const baseSubtotal = Number(
    order.baseSubtotal ?? order.subtotal ?? order.totalAmount ?? 0
  );
  const discountAmount = Number(order.discountAmount || 0);
  const taxableAmount = Number(
    order.taxableAmount ?? Math.max(0, baseSubtotal - discountAmount)
  );
  const taxAmount = Number(
    order.taxAmount ?? order.taxSummary?.totalTax ?? 0
  );
  const shippingAmount = Number(order.shippingAmount || 0);
  const totalAmount = Number(order.totalAmount || 0);
  const taxType = order.taxSummary?.taxType || "";

  const wrapper = dark
    ? "rounded-xl border border-white/10 bg-white/[0.04] p-4"
    : "rounded-2xl border border-black/[0.07] bg-white p-5";

  return (
    <section className={wrapper}>
      {!compact && (
        <div className="mb-3">
          <p
            className={`text-[10px] font-extrabold uppercase tracking-[0.14em] ${
              dark ? "text-[#D4AF37]" : "text-[#F97316]"
            }`}
          >
            Tax Summary
          </p>
          <h3
            className={`mt-1 text-lg font-black ${
              dark ? "text-white" : "text-[#171717]"
            }`}
          >
            Order totals
          </h3>
        </div>
      )}

      <div className={dark ? "[&_*]:!text-white/75" : ""}>
        <TaxRow label="Base subtotal" value={money(baseSubtotal)} />

        {discountAmount > 0 && (
          <TaxRow label="Discount" value={`− ${money(discountAmount)}`} />
        )}

        {hasTaxSnapshot && (
          <>
            <TaxRow label="Taxable value" value={money(taxableAmount)} />

            {Number(order.taxSummary?.cgstAmount || 0) > 0 && (
              <TaxRow
                label="CGST"
                value={money(order.taxSummary.cgstAmount)}
              />
            )}

            {Number(order.taxSummary?.sgstAmount || 0) > 0 && (
              <TaxRow
                label="SGST"
                value={money(order.taxSummary.sgstAmount)}
              />
            )}

            {Number(order.taxSummary?.igstAmount || 0) > 0 && (
              <TaxRow
                label="IGST"
                value={money(order.taxSummary.igstAmount)}
              />
            )}

            <TaxRow
              label={taxType ? `GST (${String(taxType).toUpperCase()})` : "Total GST"}
              value={money(taxAmount)}
            />
          </>
        )}

        <TaxRow
          label="Shipping"
          value={shippingAmount > 0 ? money(shippingAmount) : "FREE"}
        />

        <div
          className={`mt-2 border-t pt-2 ${
            dark ? "border-white/10" : "border-black/[0.07]"
          }`}
        >
          <TaxRow
            label="Grand Total"
            value={money(totalAmount)}
            strong
            accent={!dark}
          />
        </div>
      </div>

      {!hasTaxSnapshot && (
        <p
          className={`mt-3 text-[10px] leading-5 ${
            dark ? "text-white/35" : "text-black/35"
          }`}
        >
          This is a legacy order without an authoritative GST snapshot. No tax
          split is being inferred on the frontend.
        </p>
      )}

      {hasTaxSnapshot && order.taxSummary?.destinationState && (
        <p
          className={`mt-3 text-[10px] leading-5 ${
            dark ? "text-white/35" : "text-black/35"
          }`}
        >
          GST destination: {order.taxSummary.destinationState}
          {order.taxSummary.sellerState
            ? ` · Seller state: ${order.taxSummary.sellerState}`
            : ""}
        </p>
      )}
    </section>
  );
};

export default OrderTaxSummary;
