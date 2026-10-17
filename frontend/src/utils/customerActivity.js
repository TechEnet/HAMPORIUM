
// PATH: frontend/src/utils/customerActivity.js
// Signed-in Customer 360 event capture. No extra opt-in prompt. An existing
// user opt-out or rejected analytics cookie preference remains authoritative.
import api from "../api/api.js";

let currentUserId = "";
let trackingEnabled = null;
let loadingPreference = null;
let pending = [];
let flushTimer = null;
const recent = new Map();
const ALLOWED = new Set([
  "search_submitted", "product_viewed", "cart_item_added", "cart_item_removed",
  "wishlist_item_added", "wishlist_item_removed", "builder_started",
  "hamper_configured", "checkout_started",
]);
const sameId = (user) => String(user?.id || user?._id || "");
const short = (value, limit) => String(value ?? "").trim().slice(0, limit);
const cleanPath = (path) => {
  const p = short(path || (typeof window !== "undefined" ? window.location.pathname : ""), 240)
    .split("?")[0].split("#")[0];
  return p.startsWith("/") && !p.startsWith("//") ? p : "";
};

// Preserve a saved 'Reject analytics' choice from the existing cookie banner.
// No cookie preference saved != explicit rejection. Align storage key if your
// deployed cookie banner uses a newer version/key.
export const analyticsExplicitlyRejected = () => {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem("hamporium_cookie_preferences_v2");
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data?.analytics === false;
  } catch { return false; }
};
const stopPending = () => {
  pending = [];
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  recent.clear();
};
export function configureCustomerActivityUser(user) {
  const nextId = sameId(user);
  if (currentUserId === nextId) return;
  stopPending();
  currentUserId = nextId;
  trackingEnabled = null;
  loadingPreference = null;
}
export async function readCustomerActivityPreference() {
  if (!currentUserId || analyticsExplicitlyRejected()) return false;
  if (trackingEnabled !== null) return trackingEnabled;
  if (loadingPreference) return loadingPreference;
  const owner = currentUserId;
  loadingPreference = api.get("/customer-intelligence/me/consent")
    .then(({ data }) => {
      // Endpoint retains its existing path for backwards compatibility.
      const enabled = data?.consent?.analyticsEnabled === true;
      if (owner === currentUserId) trackingEnabled = enabled;
      return owner === currentUserId && enabled && !analyticsExplicitlyRejected();
    })
    .catch(() => false) // Fail closed on network errors.
    .finally(() => { if (owner === currentUserId) loadingPreference = null; });
  return loadingPreference;
}
// Backwards compatible exports for code that still calls the old names.
export const readCustomerActivityConsent = readCustomerActivityPreference;
export async function updateCustomerActivityConsent(enabled) {
  if (!currentUserId) throw new Error("Sign in first.");
  const owner = currentUserId;
  const response = await api.put("/customer-intelligence/me/consent", { analyticsEnabled: enabled === true });
  if (owner === currentUserId) {
    trackingEnabled = response.data?.consent?.analyticsEnabled === true;
    if (!trackingEnabled) stopPending();
  }
  return response.data?.consent;
}
export async function deleteCustomerActivityHistory() {
  if (!currentUserId) throw new Error("Sign in first.");
  const owner = currentUserId;
  stopPending();
  const { data } = await api.delete("/customer-intelligence/me/activity");
  if (owner === currentUserId) trackingEnabled = false;
  return data;
}
async function flush() {
  flushTimer = null;
  if (!pending.length || !currentUserId || trackingEnabled !== true || analyticsExplicitlyRejected()) {
    stopPending(); return;
  }
  const owner = currentUserId;
  const batch = pending.splice(0, 20);
  try {
    await api.post("/customer-intelligence/me/events", { events: batch }, { timeout: 9000 });
  } catch (error) {
    if (error.response?.status === 403 && owner === currentUserId) {
      trackingEnabled = false;
      stopPending();
    }
  }
  if (pending.length && owner === currentUserId && trackingEnabled === true) schedule();
}
function schedule() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 120);
}
export async function trackCustomerActivity(type, values = {}) {
  if (!currentUserId || !ALLOWED.has(type) || analyticsExplicitlyRejected()) return;
  // Search and product-view events are mirrored on the backend from the
  // existing analytics routes. Do not double count them here.
  if (type === "search_submitted" || type === "product_viewed") return;
  const owner = currentUserId;
  if (!(await readCustomerActivityPreference()) || owner !== currentUserId) return;
  const payload = { type, path: cleanPath(values.path) };
  if (values.productId && /^[0-9a-f]{24}$/i.test(String(values.productId))) payload.productId = String(values.productId);
  if (values.skuId && /^[0-9a-f]{24}$/i.test(String(values.skuId))) payload.skuId = String(values.skuId);
  const fingerprint = `${owner}|${type}|${payload.path}|${payload.productId || ""}|${payload.skuId || ""}`;
  const now = Date.now();
  if ((recent.get(fingerprint) || 0) > now - (type === "checkout_started" ? 15000 : 1200)) return;
  recent.set(fingerprint, now);
  if (recent.size > 250) for (const [key, at] of recent) if (at < now - 60000) recent.delete(key);
  payload.eventKey = `web-${now}-${Math.random().toString(36).slice(2, 11)}`;
  pending.push(payload);
  schedule();
}
if (typeof window !== "undefined") {
  window.addEventListener("hamporium:consent-changed", (event) => {
    if (event?.detail?.analytics === false) stopPending();
  });
}
