import jwt from "jsonwebtoken";
import User from "../modules/users/user.model.js";
import { CustomerActivityConsent } from "../modules/customerIntelligence/customerIntelligence.model.js";

/**
 * Optional, purpose-limited identity for the EXISTING public analytics endpoints.
 * This middleware is deliberately not `protect`: anonymous searches and views must
 * continue to work even when a customer has no login, cookie, or consent.
 * NEVER use a user id supplied in the analytics body.
 * We only attach identity after authenticating a live JWT and finding an
 * explicit, currently enabled Customer 360 analytics choice.
 */
export const attachConsentedAnalyticsCustomer = async (req, res, next) => {
  req.analyticsCustomerId = null;

  try {
    let token = req.cookies?.accessToken || "";
    if (!token) {
      const authorization = req.headers?.authorization || "";
      if (authorization.startsWith("Bearer ")) token = authorization.slice(7);
    }
    if (!token || !process.env.JWT_SECRET) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!decoded?.userId || !Number.isInteger(decoded.version)) return next();

    const user = await User.findById(decoded.userId)
      .select("_id isActive isDeleted tokenVersion").lean();
    if (!user || user.isActive !== true || user.isDeleted === true ||
        Number(user.tokenVersion) !== decoded.version) return next();

    const optedIn = await CustomerActivityConsent.exists({
      user: user._id,
      analyticsEnabled: true,
    });

    if (optedIn) req.analyticsCustomerId = user._id;
  } catch (error) {
    // Anonymous aggregate analytics must remain available even if a customer
    // has an expired token or the optional identity lookup is unavailable.
    if (!["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"].includes(error?.name)) {
      console.warn("[Analytics] Optional customer identity unavailable:", error?.message);
    }
  }

  return next();
};