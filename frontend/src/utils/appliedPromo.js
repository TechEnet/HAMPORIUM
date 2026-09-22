const STORAGE_KEY = "hamporium:applied-promotion:v1";

export const normalizeAppliedCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);

const canUseSessionStorage = () => {
  try {
    return typeof window !== "undefined" && Boolean(window.sessionStorage);
  } catch {
    return false;
  }
};

export const getStoredAppliedPromotion = () => {
  if (!canUseSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const code = normalizeAppliedCode(parsed?.code);

    if (!code || parsed?.kind !== "promotion") {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      kind: "promotion",
      code,
      title: String(parsed?.title || "HAMPORIUM offer").slice(0, 120),
      detail: String(parsed?.detail || "Offer code accepted.").slice(0, 240),
    };
  } catch {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage may be unavailable.
    }
    return null;
  }
};

export const storeAppliedPromotion = (result) => {
  if (!canUseSessionStorage()) return null;
  if (result?.kind !== "promotion") return null;

  const code = normalizeAppliedCode(result?.code);
  if (!code) return null;

  const safe = {
    kind: "promotion",
    code,
    title: String(result?.title || "HAMPORIUM offer").slice(0, 120),
    detail: String(result?.detail || "Offer code accepted.").slice(0, 240),
  };

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  } catch {
    return null;
  }
};

export const clearStoredAppliedPromotion = () => {
  if (!canUseSessionStorage()) return;

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable.
  }
};
