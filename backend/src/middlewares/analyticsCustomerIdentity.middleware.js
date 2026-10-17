
// PATH: backend/src/middlewares/analyticsCustomerIdentity.middleware.js
// Public search and product-view analytics remain anonymous when not signed in.
// A verified, active signed-in customer is associated only if they have not
// explicitly disabled Customer 360 tracking. Never trust a user ID from req.body.
import jwt from "jsonwebtoken";
import User from "../modules/users/user.model.js";
import { CustomerActivityConsent } from "../modules/customerIntelligence/customerIntelligence.model.js";

// Keep existing export name so analytics routes do not require modification.
export const attachConsentedAnalyticsCustomer = async (req, res, next) => {
  req.analyticsCustomerId = null;
  try {
    const prefHeader = String(req.get?.("X-Hamporium-Analytics-Preference") || "");
    if (prefHeader !== "on") return next();

    let token = req.cookies?.accessToken || "";
    if (!token) {
      const authorization = req.headers?.authorization || "";
      if (authorization.startsWith("Bearer ")) token = authorization.slice(7);
    }
    if (!token || !process.env.JWT_SECRET) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!decoded?.userId || !Number.isInteger(decoded.version)) return next();
    const user = await User.findById(decoded.userId)
      .select("_id roles isActive isDeleted tokenVersion").lean();
    if (!user || user.isActive !== true || user.isDeleted === true ||
        Number(user.tokenVersion) !== decoded.version ||
        !user.roles?.includes("customer") ||
        user.roles.some((role) => ["admin", "operations"].includes(role))) return next();

    // An existing false choice is a durable opt-out. An absent row is not
    // interpreted as refusal: the storefront's disclosed first-party policy applies.
    const preference = await CustomerActivityConsent.findOne({ user: user._id })
      .select("analyticsEnabled").lean();
    if (preference?.analyticsEnabled !== false) req.analyticsCustomerId = user._id;
  } catch (error) {
    if (!["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"].includes(error?.name)) {
      console.warn("[Analytics] Customer identity lookup unavailable:", error?.message);
    }
  }
  return next();
};
