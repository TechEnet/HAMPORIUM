const BUY_NOW_KEY = "hamporium-buy-now-intent";
const BUY_NOW_TTL_MS = 2 * 60 * 60 * 1000;

const safeQuantity = (value) => {
  const quantity = Number(value);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return 1;
  }

  return quantity;
};

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const sanitizeDiscount = (value) => {
  if (!value || typeof value !== "object") {
    return {
      enabled: false,
      type: "percentage",
      value: 0,
    };
  }

  return {
    enabled: Boolean(value.enabled),
    type: value.type === "fixed" ? "fixed" : "percentage",
    value: Math.max(0, safeNumber(value.value, 0)),
  };
};

const sanitizeIntent = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const skuId = String(value.skuId || "").trim();

  if (!skuId) {
    return null;
  }

  return {
    skuId,
    quantity: safeQuantity(value.quantity),
    productId: String(value.productId || "").trim(),
    productSlug: String(value.productSlug || "").trim(),
    productName: String(value.productName || "").trim(),
    skuName: String(value.skuName || "").trim(),
    skuCode: String(value.skuCode || "").trim(),
    image: String(value.image || "").trim(),

    // Display-only checkout snapshot. The backend always recalculates and
    // persists the authoritative GST/order snapshot before payment.
    unitPrice: safeNumber(value.unitPrice, 0),
    baseSellingPrice: safeNumber(
      value.baseSellingPrice ?? value.unitPrice,
      0
    ),
    taxEnabled: value.taxEnabled !== false,
    taxPercent: Math.max(0, safeNumber(value.taxPercent, 0)),
    hsnSac: String(value.hsnSac || "").trim(),
    discount: sanitizeDiscount(value.discount),

    compareAtPrice:
      value.compareAtPrice === null || value.compareAtPrice === undefined
        ? null
        : safeNumber(value.compareAtPrice, 0),

    optionValues:
      value.optionValues && typeof value.optionValues === "object"
        ? value.optionValues
        : {},

    createdAt: Number(value.createdAt) || Date.now(),
  };
};

export const saveBuyNowIntent = (intent) => {
  const normalized = sanitizeIntent({
    ...intent,
    createdAt: Date.now(),
  });

  if (!normalized) {
    return null;
  }

  try {
    window.sessionStorage.setItem(
      BUY_NOW_KEY,
      JSON.stringify(normalized)
    );
  } catch {
    return normalized;
  }

  return normalized;
};

export const getBuyNowIntent = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(BUY_NOW_KEY);

    if (!raw) {
      return null;
    }

    const parsed = sanitizeIntent(JSON.parse(raw));

    if (!parsed) {
      window.sessionStorage.removeItem(BUY_NOW_KEY);
      return null;
    }

    if (Date.now() - parsed.createdAt > BUY_NOW_TTL_MS) {
      window.sessionStorage.removeItem(BUY_NOW_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const clearBuyNowIntent = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(BUY_NOW_KEY);
  } catch {
    // Ignore storage failures.
  }
};
