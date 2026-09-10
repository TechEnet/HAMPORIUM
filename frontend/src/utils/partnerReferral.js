const STORAGE_KEY = "hamporium.partnerReferral";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);

const sanitizeReferral = (value = {}) => {
  const referralCode = normalizeCode(value.referralCode);
  if (!referralCode) return null;

  return {
    referralCode,
    partnerId: String(value.partnerId || "").trim(),
    businessName: String(value.businessName || "").trim(),
    discountPercent: Math.max(
      0,
      Math.min(100, Number(value.discountPercent || 0))
    ),
    projectId: value.projectId || null,
    showcaseId: value.showcaseId || null,
    source: String(value.source || "promo_code").trim() || "promo_code",
    capturedAt: Number(value.capturedAt || Date.now()),
  };
};

export const storePartnerReferral = (value) => {
  if (typeof window === "undefined") return null;

  const normalized = sanitizeReferral(value);
  if (!normalized) return null;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    return normalized;
  }

  return normalized;
};

export const getStoredPartnerReferral = () => {
  if (typeof window === "undefined") return null;

  const stored = safeParse(localStorage.getItem(STORAGE_KEY));
  const normalized = sanitizeReferral(stored || {});

  if (!normalized) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  if (
    !normalized.capturedAt ||
    Date.now() - Number(normalized.capturedAt) > MAX_AGE_MS
  ) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  return normalized;
};

export const clearStoredPartnerReferral = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export const getPartnerReferralStorageKey = () => STORAGE_KEY;
