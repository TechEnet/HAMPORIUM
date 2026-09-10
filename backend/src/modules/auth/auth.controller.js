import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";

import User from "../users/user.model.js";
import Partner from "../partners/partner.model.js";
import sendOTP from "../../helpers/sendOTP.js";
import asyncHandler from "../../utils/asyncHandler.js";
import createAuditLog from "../../helpers/createAuditLog.js";

import { ROLES } from "../../constants/roles.js";
import { PARTNER_STATUS } from "../../constants/statuses.js";

const googleClient = new OAuth2Client();

const EMAIL_OTP_TTL_MINUTES = Number(process.env.AUTH_EMAIL_OTP_TTL_MINUTES || 10);
const EMAIL_OTP_RESEND_SECONDS = Number(process.env.AUTH_EMAIL_OTP_RESEND_SECONDS || 60);
const EMAIL_OTP_MAX_ATTEMPTS = Number(process.env.AUTH_EMAIL_OTP_MAX_ATTEMPTS || 5);
const EMAIL_OTP_MAX_SENDS_PER_HOUR = Number(
  process.env.AUTH_EMAIL_OTP_MAX_SENDS_PER_HOUR || 5
);

const RESET_OTP_TTL_MINUTES = Number(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || 10);
const RESET_OTP_RESEND_SECONDS = Number(process.env.PASSWORD_RESET_OTP_RESEND_SECONDS || 60);
const RESET_OTP_MAX_ATTEMPTS = Number(process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS || 5);

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return process.env.JWT_SECRET;
};

const getGoogleClientId = () => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  return process.env.GOOGLE_CLIENT_ID;
};

const createToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), version: user.tokenVersion },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      algorithm: "HS256",
    }
  );

const getCookieOptions = () => {
  const days = Math.max(1, Number(process.env.JWT_COOKIE_DAYS || 7));
  const configuredSameSite = String(process.env.COOKIE_SAME_SITE || "lax").toLowerCase();
  const sameSite = ["lax", "strict", "none"].includes(configuredSameSite)
    ? configuredSameSite
    : "lax";
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production" ||
    sameSite === "none";

  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: days * 24 * 60 * 60 * 1000,
  };
};

const setAuthCookie = (res, token) => {
  res.cookie("accessToken", token, getCookieOptions());
};

const clearAuthCookie = (res) => {
  const options = getCookieOptions();
  delete options.maxAge;
  res.clearCookie("accessToken", options);
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar || "",
  roles: user.roles,
  isActive: user.isActive,
  emailVerified: Boolean(user.emailVerified),
  emailVerifiedAt: user.emailVerifiedAt || null,
  createdAt: user.createdAt,
});

const partnerSummary = async (userId) => {
  const partner = await Partner.findOne({
    $or: [
      { owner: userId },
      {
        members: {
          $elemMatch: { user: userId, isActive: true },
        },
      },
    ],
  }).select("partnerId businessName referralCode status application.onboardingCompletedAt");

  if (!partner) return null;

  return {
    id: partner._id,
    partnerId: partner.partnerId,
    businessName: partner.businessName,
    referralCode: partner.referralCode,
    status: partner.status,
    approved: partner.status === PARTNER_STATUS.APPROVED,
    onboardingComplete: Boolean(partner.application?.onboardingCompletedAt),
  };
};

const hashOtp = (otp) =>
  createHash("sha256").update(String(otp)).digest("hex");

const otpMatches = (receivedOtp, storedHash) => {
  if (!storedHash) return false;
  const receivedBuffer = Buffer.from(hashOtp(receivedOtp));
  const storedBuffer = Buffer.from(String(storedHash));
  if (receivedBuffer.length !== storedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, storedBuffer);
};

const createOtp = () => randomInt(100000, 1000000).toString();

const isGoogleAuthoritativeEmail = (payload) => {
  const email = payload.email?.toLowerCase() || "";
  return email.endsWith("@gmail.com") ||
    (payload.email_verified === true && Boolean(payload.hd));
};

const verifyGoogleCredential = async (credential) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: getGoogleClientId(),
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

const enforceVerifiedEmail = (user, res) => {
  if (user.emailVerified !== false) return false;

  res.status(403).json({
    success: false,
    verificationRequired: true,
    email: user.email,
    message: "Verify your email before logging in",
  });
  return true;
};

const sendEmailVerificationOtp = async (user, { force = false } = {}) => {
  const selected = await User.findById(user._id).select(
    "+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts +emailVerificationOtpLastSentAt +emailVerificationOtpWindowStartedAt +emailVerificationOtpSendCount"
  );

  const now = new Date();
  const windowExpired =
    !selected.emailVerificationOtpWindowStartedAt ||
    now.getTime() - selected.emailVerificationOtpWindowStartedAt.getTime() > 60 * 60 * 1000;

  if (windowExpired) {
    selected.emailVerificationOtpWindowStartedAt = now;
    selected.emailVerificationOtpSendCount = 0;
  }

  if (selected.emailVerificationOtpSendCount >= EMAIL_OTP_MAX_SENDS_PER_HOUR) {
    const error = new Error("Too many verification OTP requests. Try again later.");
    error.statusCode = 429;
    throw error;
  }

  if (!force && selected.emailVerificationOtpLastSentAt) {
    const seconds =
      (now.getTime() - selected.emailVerificationOtpLastSentAt.getTime()) / 1000;
    if (seconds < EMAIL_OTP_RESEND_SECONDS) {
      const error = new Error(
        `Please wait ${Math.ceil(EMAIL_OTP_RESEND_SECONDS - seconds)} seconds before requesting another OTP.`
      );
      error.statusCode = 429;
      throw error;
    }
  }

  const otp = createOtp();
  selected.emailVerificationOtpHash = hashOtp(otp);
  selected.emailVerificationOtpExpiresAt = new Date(
    Date.now() + EMAIL_OTP_TTL_MINUTES * 60 * 1000
  );
  selected.emailVerificationOtpAttempts = 0;
  selected.emailVerificationOtpLastSentAt = now;
  selected.emailVerificationOtpSendCount += 1;
  await selected.save({ validateBeforeSave: false });

  await sendOTP({
    to: selected.email,
    toName: selected.name,
    otp,
    purpose: "Email Verification",
    expiresInMinutes: EMAIL_OTP_TTL_MINUTES,
  });
};

const normalizedStrings = (values, max = 30, maxLength = 120) =>
  [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim().slice(0, maxLength))
    .filter(Boolean))].slice(0, max);

const normalizePartnerApplication = ({ body, user }) => {
  const now = new Date();
  const contact = body.contact || {};
  const application = body.application || {};

  return {
    owner: user._id,
    businessName: String(body.businessName || "").trim(),
    legalName: String(body.legalName || "").trim(),
    registeredBusinessName: String(
      body.registeredBusinessName || body.legalName || body.businessName || ""
    ).trim(),
    businessType: body.businessType || "individual",
    partnerType: body.partnerType,
    capabilities: normalizedStrings(body.capabilities, 30, 80),
    supplyCategories: normalizedStrings(body.supplyCategories, 40, 80),
    servicesOffered: normalizedStrings(body.servicesOffered, 40, 120),
    contact: {
      name: String(contact.name || user.name || "").trim(),
      email: String(contact.email || user.email || "").trim().toLowerCase(),
      phone: String(contact.phone || user.phone || "").trim(),
    },
    website: String(body.website || "").trim(),
    social: {
      instagram: String(body.social?.instagram || "").trim(),
      linkedin: String(body.social?.linkedin || "").trim(),
      facebook: String(body.social?.facebook || "").trim(),
      other: String(body.social?.other || "").trim(),
    },
    gstNumber: String(body.gstNumber || "").trim().toUpperCase(),
    panNumber: String(body.panNumber || "").trim().toUpperCase(),
    address: {
      line1: String(body.address?.line1 || "").trim(),
      line2: String(body.address?.line2 || "").trim(),
      city: String(body.address?.city || "").trim(),
      state: String(body.address?.state || "").trim(),
      pincode: String(body.address?.pincode || "").trim(),
      country: String(body.address?.country || "India").trim() || "India",
    },
    serviceAreas: (Array.isArray(body.serviceAreas) ? body.serviceAreas : [])
      .slice(0, 50)
      .map((area) => ({
        city: String(area?.city || "").trim(),
        state: String(area?.state || "").trim(),
        pincode: String(area?.pincode || "").trim(),
      }))
      .filter((area) => area.city || area.state || area.pincode),
    about: String(body.about || "").trim(),
    experienceYears: Math.max(0, Number(body.experienceYears || 0)),
    portfolioUrl: String(body.portfolioUrl || "").trim(),
    commercialProfile: {
      expectedMonthlyVolume: Math.max(
        0,
        Number(body.commercialProfile?.expectedMonthlyVolume || 0)
      ),
      typicalOrderValue: Math.max(
        0,
        Number(body.commercialProfile?.typicalOrderValue || 0)
      ),
      preferredWorkingModel:
        body.commercialProfile?.preferredWorkingModel || "referral",
      commissionAcknowledged: Boolean(
        body.commercialProfile?.commissionAcknowledged
      ),
    },
    members: [
      {
        user: user._id,
        role: "partner_admin",
        isActive: true,
      },
    ],
    status: PARTNER_STATUS.APPLIED,
    application: {
      onboardingVersion: String(application.onboardingVersion || "1.0"),
      submittedAt: now,
      termsAcceptedAt: application.termsAccepted ? now : null,
      privacyAcceptedAt: application.privacyAccepted ? now : null,
      declarationAcceptedAt: application.declarationAccepted ? now : null,
      onboardingCompletedAt: now,
    },
    agreement: {
      version: String(application.agreementVersion || application.onboardingVersion || "1.0"),
      acceptedAt: application.termsAccepted ? now : null,
      acceptedBy: application.termsAccepted ? user._id : null,
      note: application.termsAccepted ? "Accepted during partner onboarding." : "",
    },
    statusHistory: [
      {
        status: PARTNER_STATUS.APPLIED,
        changedBy: user._id,
        note: "Partner application submitted during registration.",
      },
    ],
  };
};

const createPartnerRecord = async ({ user, body }) => {
  const existing = await Partner.findOne({ owner: user._id });
  if (existing) return existing;
  return Partner.create(normalizePartnerApplication({ body, user }));
};

const ensurePartnerRole = async (user) => {
  if (!user.roles.includes(ROLES.PARTNER)) {
    user.roles.push(ROLES.PARTNER);
  }
};

const loginResponse = async (res, user, message) => {
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  setAuthCookie(res, createToken(user));

  const partner = user.roles.includes(ROLES.PARTNER)
    ? await partnerSummary(user._id)
    : null;

  return res.status(200).json({
    success: true,
    message,
    user: publicUser(user),
    partner,
  });
};

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists",
    });
  }

  const user = await User.create({
    name,
    email,
    phone: phone || "",
    password: await bcrypt.hash(password, 12),
    emailVerified: false,
    emailVerifiedAt: null,
    roles: [ROLES.CUSTOMER],
  });

  let emailSent = true;
  let emailError = "";

  try {
    await sendEmailVerificationOtp(user, { force: true });
  } catch (error) {
    emailSent = false;
    emailError = error.message;
    console.error("Registration verification email failed:", error.message);
  }

  res.status(emailSent ? 201 : 202).json({
    success: true,
    verificationRequired: true,
    emailSent,
    email: user.email,
    message: emailSent
      ? "Account created. Verify your email with the OTP we sent."
      : "Account created, but the verification email could not be sent. Use resend OTP after email configuration is fixed.",
    ...(emailSent ? {} : { emailDeliveryError: emailError }),
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email }).select(
    "+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts"
  );

  if (!user || user.emailVerified) {
    if (user?.emailVerified) {
      return loginResponse(res, user, "Email is already verified");
    }
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  }

  if (
    !user.emailVerificationOtpHash ||
    !user.emailVerificationOtpExpiresAt ||
    user.emailVerificationOtpExpiresAt.getTime() < Date.now()
  ) {
    return res.status(400).json({ success: false, message: "OTP has expired" });
  }

  if (user.emailVerificationOtpAttempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: "Too many invalid OTP attempts. Request a new OTP.",
    });
  }

  if (!otpMatches(otp, user.emailVerificationOtpHash)) {
    user.emailVerificationOtpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  }

  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationOtpHash = null;
  user.emailVerificationOtpExpiresAt = null;
  user.emailVerificationOtpAttempts = 0;
  await user.save({ validateBeforeSave: false });

  return loginResponse(res, user, "Email verified successfully");
});

export const resendEmailVerificationOtp = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user || !user.isActive || user.emailVerified) {
    return res.status(200).json({
      success: true,
      message: "If verification is required, an OTP has been sent.",
    });
  }

  await sendEmailVerificationOtp(user);

  res.status(200).json({
    success: true,
    message: "If verification is required, an OTP has been sent.",
  });
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select("+password");

  if (!user || !user.password || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: "This account is disabled" });
  }

  if (enforceVerifiedEmail(user, res)) return;
  return loginResponse(res, user, "Logged in successfully");
});

export const googleLogin = asyncHandler(async (req, res) => {
  const payload = await verifyGoogleCredential(req.body.credential);

  if (!payload) {
    return res.status(401).json({ success: false, message: "Invalid Google credential" });
  }

  const normalizedEmail = payload.email.toLowerCase();
  let user = await User.findOne({ googleId: payload.sub });

  if (!user) {
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (existingUser.googleId && existingUser.googleId !== payload.sub) {
        return res.status(409).json({
          success: false,
          message: "This email is already linked to another Google account",
        });
      }

      if (!existingUser.googleId && !isGoogleAuthoritativeEmail(payload)) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists. Login with your password first.",
        });
      }

      existingUser.googleId = payload.sub;
      existingUser.emailVerified = true;
      existingUser.emailVerifiedAt = existingUser.emailVerifiedAt || new Date();
      if (payload.picture && !existingUser.avatar) existingUser.avatar = payload.picture;
      await existingUser.save({ validateBeforeSave: false });
      user = existingUser;
    } else {
      user = await User.create({
        name: payload.name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        googleId: payload.sub,
        avatar: payload.picture || "",
        password: null,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        roles: [ROLES.CUSTOMER],
      });
    }
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: "This account is disabled" });
  }

  if (payload.picture) user.avatar = payload.picture;
  user.emailVerified = true;
  user.emailVerifiedAt = user.emailVerifiedAt || new Date();
  return loginResponse(res, user, "Google login successful");
});

export const partnerRegister = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) {
    return res.status(409).json({
      success: false,
      message: "This email already has a HAMPORIUM account. Login first and apply as a partner from the partner onboarding flow.",
    });
  }

  const user = await User.create({
    name,
    email,
    phone: String(req.body.contact?.phone || "").trim(),
    password: await bcrypt.hash(password, 12),
    roles: [ROLES.PARTNER],
    emailVerified: false,
    emailVerifiedAt: null,
  });

  let partner;
  try {
    partner = await createPartnerRecord({ user, body: req.body });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }

  let emailSent = true;
  let emailError = "";
  try {
    await sendEmailVerificationOtp(user, { force: true });
  } catch (error) {
    emailSent = false;
    emailError = error.message;
    console.error("Partner verification email failed:", error.message);
  }

  res.status(emailSent ? 201 : 202).json({
    success: true,
    verificationRequired: true,
    emailSent,
    email: user.email,
    partner: {
      id: partner._id,
      partnerId: partner.partnerId,
      status: partner.status,
      businessName: partner.businessName,
    },
    message: emailSent
      ? "Partner application created. Verify your email to continue."
      : "Partner application created, but the verification email could not be sent. Use resend OTP after email configuration is fixed.",
    ...(emailSent ? {} : { emailDeliveryError: emailError }),
  });
});

export const partnerLogin = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select("+password");

  if (!user || !user.password || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  if (!user.roles.includes(ROLES.PARTNER)) {
    return res.status(403).json({
      success: false,
      message: "This account is not registered as a HAMPORIUM partner",
    });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: "This account is disabled" });
  }

  if (enforceVerifiedEmail(user, res)) return;
  return loginResponse(res, user, "Partner login successful");
});

export const partnerGoogleRegister = asyncHandler(async (req, res) => {
  const payload = await verifyGoogleCredential(req.body.credential);

  if (!payload) {
    return res.status(401).json({ success: false, message: "Invalid Google credential" });
  }

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
  let createdUser = false;

  if (user?.googleId && user.googleId !== payload.sub) {
    return res.status(409).json({
      success: false,
      message: "This email is already linked to another Google account",
    });
  }

  if (!user) {
    user = await User.create({
      name: payload.name || email.split("@")[0],
      email,
      phone: String(req.body.contact?.phone || "").trim(),
      googleId: payload.sub,
      avatar: payload.picture || "",
      password: null,
      roles: [ROLES.PARTNER],
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });
    createdUser = true;
  } else {
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "This account is disabled" });
    }

    if (!user.googleId && !isGoogleAuthoritativeEmail(payload)) {
      return res.status(409).json({
        success: false,
        message: "A HAMPORIUM account already exists with this email. Login to that account first and apply as a partner.",
      });
    }

    user.googleId = user.googleId || payload.sub;
    user.emailVerified = true;
    user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    if (payload.picture) user.avatar = payload.picture;
    await ensurePartnerRole(user);
    await user.save({ validateBeforeSave: false });
  }

  if (
    await Partner.exists({
      $or: [
        { owner: user._id },
        { members: { $elemMatch: { user: user._id, isActive: true } } },
      ],
    })
  ) {
    if (createdUser) await User.deleteOne({ _id: user._id });
    return res.status(409).json({
      success: false,
      message: "A partner application already exists for this account. Use partner login.",
    });
  }

  let partner;
  try {
    partner = await createPartnerRecord({ user, body: req.body });
  } catch (error) {
    if (createdUser) await User.deleteOne({ _id: user._id });
    throw error;
  }

  await createAuditLog({
    req,
    action: "partner_google_registration",
    module: "partners",
    entityType: "partner",
    entityId: partner._id,
    description: "Partner registered with a verified Google account.",
  });

  return loginResponse(res, user, "Partner application created with Google");
});

export const partnerGoogleLogin = asyncHandler(async (req, res) => {
  const payload = await verifyGoogleCredential(req.body.credential);

  if (!payload) {
    return res.status(401).json({ success: false, message: "Invalid Google credential" });
  }

  const email = payload.email.toLowerCase();
  const user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });

  if (!user || !user.roles.includes(ROLES.PARTNER)) {
    return res.status(403).json({
      success: false,
      message: "No partner account is registered for this Google account",
    });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: "This account is disabled" });
  }

  if (user.googleId && user.googleId !== payload.sub) {
    return res.status(409).json({
      success: false,
      message: "This email is linked to another Google account",
    });
  }

  if (!user.googleId && !isGoogleAuthoritativeEmail(payload)) {
    return res.status(409).json({
      success: false,
      message: "A HAMPORIUM partner account already exists with this email. Login with your password first.",
    });
  }

  user.googleId = user.googleId || payload.sub;
  user.emailVerified = true;
  user.emailVerifiedAt = user.emailVerifiedAt || new Date();
  if (payload.picture) user.avatar = payload.picture;
  return loginResponse(res, user, "Partner Google login successful");
});

export const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

export const logoutAll = asyncHandler(async (req, res) => {
  req.user.tokenVersion += 1;
  await req.user.save({ validateBeforeSave: false });
  clearAuthCookie(res);
  res.status(200).json({
    success: true,
    message: "All sessions have been signed out",
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const genericResponse = {
    success: true,
    message: "If an account exists with this email, an OTP has been sent",
  };

  const user = await User.findOne({ email: req.body.email }).select(
    "+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts +passwordResetOtpLastSentAt"
  );

  if (!user || !user.isActive) return res.status(200).json(genericResponse);

  if (user.passwordResetOtpLastSentAt) {
    const seconds =
      (Date.now() - user.passwordResetOtpLastSentAt.getTime()) / 1000;
    if (seconds < RESET_OTP_RESEND_SECONDS) {
      return res.status(200).json(genericResponse);
    }
  }

  const otp = createOtp();
  user.passwordResetOtpHash = hashOtp(otp);
  user.passwordResetOtpExpiresAt = new Date(
    Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000
  );
  user.passwordResetOtpAttempts = 0;
  user.passwordResetOtpLastSentAt = new Date();
  await user.save({ validateBeforeSave: false });

  await sendOTP({
    to: user.email,
    toName: user.name,
    otp,
    purpose: "Password Reset",
    expiresInMinutes: RESET_OTP_TTL_MINUTES,
  });

  res.status(200).json(genericResponse);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const user = await User.findOne({ email }).select(
    "+password +passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts"
  );

  if (!user?.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  }

  if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
    user.passwordResetOtpHash = null;
    user.passwordResetOtpExpiresAt = null;
    user.passwordResetOtpAttempts = 0;
    await user.save({ validateBeforeSave: false });
    return res.status(400).json({ success: false, message: "OTP has expired" });
  }

  if (user.passwordResetOtpAttempts >= RESET_OTP_MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: "Too many invalid OTP attempts. Request a new OTP.",
    });
  }

  if (!otpMatches(otp, user.passwordResetOtpHash)) {
    user.passwordResetOtpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  }

  user.password = await bcrypt.hash(newPassword, 12);
  user.passwordResetOtpHash = null;
  user.passwordResetOtpExpiresAt = null;
  user.passwordResetOtpAttempts = 0;
  user.tokenVersion += 1;
  await user.save();

  clearAuthCookie(res);
  res.status(200).json({
    success: true,
    message: "Password reset successfully. Please login again.",
  });
});
