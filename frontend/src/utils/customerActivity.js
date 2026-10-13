// EXACT PATH: frontend/src/utils/customerActivity.js
// REPLACE FILE

import api from "../api/api.js";

// Customer 360 only. Existing commerce analytics remains unchanged.
// Browser events are never uploaded until the user explicitly opts in.
let currentUserId = "";
let consent = null;
let loadingConsent = null;
let pending = [];
let flushTimer = null;
const recent = new Map();
const ALLOWED = new Set([
  "search_submitted", "product_viewed", "cart_item_added",
  "cart_item_removed", "wishlist_item_added", "wishlist_item_removed",
  "builder_started", "hamper_configured", "checkout_started",
]);

const sameId = (user) => String(user?.id || user?._id || "");
const short = (value, limit) => String(value ?? "").trim().slice(0, limit);
const cleanPath = (path) => {
  const p = short(path || (typeof window !== "undefined" ? window.location.pathname : ""), 240)
    .split("?")[0].split("#")[0];
  return p.startsWith("/") && !p.startsWith("//") ? p : "";
};

export function configureCustomerActivityUser(user) {
  const nextId = sameId(user);
  if (currentUserId === nextId) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  pending = [];
  recent.clear();
  currentUserId = nextId;
  consent = null;
  loadingConsent = null;
}

export async function readCustomerActivityConsent() {
  if (!currentUserId) return false;
  if (consent !== null) return consent;
  if (loadingConsent) return loadingConsent;
  const userAtStart = currentUserId;
  loadingConsent = api.get("/customer-intelligence/me/consent")
    .then(({ data }) => {
      const enabled = data?.consent?.analyticsEnabled === true;
      if (userAtStart === currentUserId) consent = enabled;
      return userAtStart === currentUserId && enabled;
    })
    .catch(() => false)
    .finally(() => { if (userAtStart === currentUserId) loadingConsent = null; });
  return loadingConsent;
}

export async function updateCustomerActivityConsent(enabled) {
  if (!currentUserId) throw new Error("Sign in first.");
  const id = currentUserId;
  const response = await api.put("/customer-intelligence/me/consent", { analyticsEnabled: enabled === true });
  if (id === currentUserId) {
    consent = response.data?.consent?.analyticsEnabled === true;
    if (!consent) { pending = []; if (flushTimer) clearTimeout(flushTimer); flushTimer = null; recent.clear(); }
  }
  return response.data?.consent;
}

export async function deleteCustomerActivityHistory() {
  if (!currentUserId) throw new Error("Sign in first.");
  pending = [];
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  recent.clear();
  const { data } = await api.delete("/customer-intelligence/me/activity");
  return data;
}

async function flush() {
  flushTimer = null;
  if (!pending.length || !currentUserId || consent !== true) { pending = []; return; }
  const owner = currentUserId;
  const batch = pending.splice(0, 20);
  try {
    await api.post("/customer-intelligence/me/events", { events: batch }, { timeout: 9000 });
  } catch (e) {
    if (e.response?.status === 403 && owner === currentUserId) { consent = false; pending = []; }
    // Tracking must never block ordering/search or generate noisy error popups.
  }
  if (pending.length && owner === currentUserId && consent === true) schedule();
}
function schedule() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 120);
}
export async function trackCustomerActivity(type, values = {}) {
  if (!currentUserId || !ALLOWED.has(type)) return;
  // Search and product-view records are already sent by the original
  // /analytics/search and /analytics/commerce/events/product-view requests.
  // The backend mirrors these into CustomerActivity only for authenticated
  // customers who opted in. Avoid double counting them here.
  if (type === "search_submitted" || type === "product_viewed") return;
  const owner = currentUserId;
  const allowed = await readCustomerActivityConsent();
  if (!allowed || currentUserId !== owner) return;
  const payload = { type, path: cleanPath(values.path) };
  if (type === "search_submitted") {
    const q = short(values.query, 120);
    if (q.length < 2 || /@|\b\d{10,}\b/.test(q)) return;
    payload.query = q;
  }
  if (values.productId && /^[0-9a-f]{24}$/i.test(String(values.productId))) payload.productId = String(values.productId);
  if (values.skuId && /^[0-9a-f]{24}$/i.test(String(values.skuId))) payload.skuId = String(values.skuId);
  if (type === "product_viewed" && !payload.productId && !payload.skuId) return;
  // StrictMode / rapid rerenders do not create multiple identical view events.
  const fingerprint = `${owner}|${type}|${payload.path}|${payload.query || ""}|${payload.productId || ""}|${payload.skuId || ""}`;
  const time = Date.now();
  if ((recent.get(fingerprint) || 0) > time - (type === "product_viewed" || type === "checkout_started" ? 15000 : 1200)) return;
  recent.set(fingerprint, time);
  if (recent.size > 250) for (const [key, at] of recent) if (at < time - 60000) recent.delete(key);
  payload.eventKey = `web-${time}-${Math.random().toString(36).slice(2, 11)}`;
  pending.push(payload);
  schedule();
}
