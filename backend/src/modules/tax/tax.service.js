const DISCOUNT_TYPES = ["percentage", "fixed"];

export const roundMoney = (value) =>
  Number(Number(value || 0).toFixed(2));

const cleanState = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const normalizeTaxPercent = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") {
    return Math.min(100, Math.max(0, Number(fallback || 0)));
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
};

export const normalizeDiscountConfig = (value = {}, fallback = {}) => {
  const source = value && typeof value === "object" ? value : {};
  const previous = fallback && typeof fallback === "object" ? fallback : {};

  const enabled =
    source.enabled === undefined
      ? Boolean(previous.enabled)
      : Boolean(source.enabled);

  const type = DISCOUNT_TYPES.includes(source.type)
    ? source.type
    : DISCOUNT_TYPES.includes(previous.type)
      ? previous.type
      : "percentage";

  const rawValue =
    source.value === undefined || source.value === null || source.value === ""
      ? Number(previous.value || 0)
      : Number(source.value);

  const normalizedValue = Number.isFinite(rawValue)
    ? Math.max(0, rawValue)
    : 0;

  return {
    enabled,
    type,
    value: type === "percentage" ? Math.min(100, normalizedValue) : normalizedValue,
  };
};

export const validateDiscountConfig = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    return "discount must be an object";
  }

  if (value.type !== undefined && !DISCOUNT_TYPES.includes(value.type)) {
    return "discount.type must be percentage or fixed";
  }

  if (value.enabled !== undefined && typeof value.enabled !== "boolean") {
    return "discount.enabled must be true or false";
  }

  if (value.value !== undefined && value.value !== null && value.value !== "") {
    const parsed = Number(value.value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return "discount.value must be a non-negative number";
    }

    const type = value.type || "percentage";
    if (type === "percentage" && parsed > 100) {
      return "percentage discount cannot exceed 100";
    }
  }

  return null;
};

export const calculateDiscountAmount = ({
  baseAmount,
  discount,
  quantity = 1,
}) => {
  const base = roundMoney(baseAmount);
  const qty = Math.max(1, Number(quantity || 1));
  const normalized = normalizeDiscountConfig(discount);

  if (!normalized.enabled || normalized.value <= 0 || base <= 0) return 0;

  const requested =
    normalized.type === "fixed"
      ? roundMoney(normalized.value * qty)
      : roundMoney((base * normalized.value) / 100);

  return roundMoney(Math.min(base, Math.max(0, requested)));
};

export const resolveTaxMode = (destinationState = "") => {
  const sellerState = String(process.env.HAMPORIUM_GST_STATE || "").trim();
  const destination = String(destinationState || "").trim();

  if (!sellerState || !destination) {
    return {
      mode: "unconfigured",
      sellerState,
      destinationState: destination,
    };
  }

  return {
    mode:
      cleanState(sellerState) === cleanState(destination)
        ? "intrastate"
        : "interstate",
    sellerState,
    destinationState: destination,
  };
};

export const calculateTaxSplit = ({
  taxableAmount,
  taxPercent,
  taxEnabled = true,
  destinationState = "",
}) => {
  const taxable = roundMoney(taxableAmount);
  const rate = taxEnabled ? normalizeTaxPercent(taxPercent) : 0;
  const totalTax = roundMoney((taxable * rate) / 100);
  const resolved = resolveTaxMode(destinationState);

  if (rate <= 0 || totalTax <= 0) {
    return {
      taxType: "none",
      sellerState: resolved.sellerState,
      destinationState: resolved.destinationState,
      gstRate: rate,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      totalTax: 0,
    };
  }

  if (resolved.mode === "intrastate") {
    const cgstAmount = roundMoney(totalTax / 2);
    const sgstAmount = roundMoney(totalTax - cgstAmount);

    return {
      taxType: "intrastate",
      sellerState: resolved.sellerState,
      destinationState: resolved.destinationState,
      gstRate: rate,
      cgstRate: rate / 2,
      cgstAmount,
      sgstRate: rate / 2,
      sgstAmount,
      igstRate: 0,
      igstAmount: 0,
      totalTax,
    };
  }

  if (resolved.mode === "interstate") {
    return {
      taxType: "interstate",
      sellerState: resolved.sellerState,
      destinationState: resolved.destinationState,
      gstRate: rate,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: rate,
      igstAmount: totalTax,
      totalTax,
    };
  }

  return {
    taxType: "unconfigured",
    sellerState: resolved.sellerState,
    destinationState: resolved.destinationState,
    gstRate: rate,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    totalTax,
  };
};

export const calculateCatalogPricing = ({
  baseSellingPrice,
  taxPercent = 0,
  taxEnabled = true,
  discount = {},
}) => {
  const basePrice = roundMoney(baseSellingPrice);
  const normalizedDiscount = normalizeDiscountConfig(discount);
  const discountAmount = calculateDiscountAmount({
    baseAmount: basePrice,
    discount: normalizedDiscount,
    quantity: 1,
  });
  const taxableValue = roundMoney(basePrice - discountAmount);
  const gstRate = taxEnabled ? normalizeTaxPercent(taxPercent) : 0;
  const taxAmount = roundMoney((taxableValue * gstRate) / 100);
  const undiscountedTax = roundMoney((basePrice * gstRate) / 100);

  return {
    baseSellingPrice: basePrice,
    discount: normalizedDiscount,
    discountAmount,
    taxableValue,
    taxEnabled: Boolean(taxEnabled),
    taxPercent: gstRate,
    taxAmount,
    price: roundMoney(taxableValue + taxAmount),
    priceBeforeDiscount: roundMoney(basePrice + undiscountedTax),
  };
};

export const calculateTaxLine = ({
  baseUnitPrice,
  quantity = 1,
  taxPercent = 0,
  hsnSac = "",
  taxEnabled = true,
  discount = {},
  destinationState = "",
}) => {
  const qty = Math.max(1, Number(quantity || 1));
  const basePrice = roundMoney(baseUnitPrice);
  const baseLineTotal = roundMoney(basePrice * qty);
  const normalizedDiscount = normalizeDiscountConfig(discount);
  const discountAmount = calculateDiscountAmount({
    baseAmount: baseLineTotal,
    discount: normalizedDiscount,
    quantity: qty,
  });
  const taxableValue = roundMoney(baseLineTotal - discountAmount);
  const split = calculateTaxSplit({
    taxableAmount: taxableValue,
    taxPercent,
    taxEnabled,
    destinationState,
  });
  const lineTotal = roundMoney(taxableValue + split.totalTax);

  return {
    baseUnitPrice: basePrice,
    baseLineTotal,
    discount: normalizedDiscount,
    discountAmount,
    taxableValue,
    tax: {
      hsnSac: String(hsnSac || "").trim(),
      ...split,
    },
    unitPrice: roundMoney(lineTotal / qty),
    lineTotal,
  };
};

export const aggregateTaxLines = (lines = []) => {
  const result = {
    baseSubtotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalTax: 0,
    subtotal: 0,
  };

  for (const line of lines) {
    result.baseSubtotal = roundMoney(
      result.baseSubtotal + Number(line?.baseLineTotal || 0)
    );
    result.discountAmount = roundMoney(
      result.discountAmount + Number(line?.discountAmount || 0)
    );
    result.taxableAmount = roundMoney(
      result.taxableAmount + Number(line?.taxableValue || 0)
    );
    result.cgstAmount = roundMoney(
      result.cgstAmount + Number(line?.tax?.cgstAmount || 0)
    );
    result.sgstAmount = roundMoney(
      result.sgstAmount + Number(line?.tax?.sgstAmount || 0)
    );
    result.igstAmount = roundMoney(
      result.igstAmount + Number(line?.tax?.igstAmount || 0)
    );
    result.totalTax = roundMoney(
      result.totalTax + Number(line?.tax?.totalTax || 0)
    );
    result.subtotal = roundMoney(
      result.subtotal + Number(line?.lineTotal || 0)
    );
  }

  return result;
};
