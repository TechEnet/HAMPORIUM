import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import multer from "multer";

import {
  forgotPassword,
  googleLogin,
  login,
  logout,
  logoutAll,
  partnerGoogleLogin,
  partnerGoogleRegister,
  partnerLogin,
  partnerRegister,
  register,
  resendEmailVerificationOtp,
  resetPassword,
  verifyEmail,
} from "./auth.controller.js";

import {
  forgotPasswordValidation,
  googleLoginValidation,
  loginValidation,
  partnerGoogleLoginValidation,
  partnerGoogleRegisterValidation,
  partnerLoginValidation,
  partnerRegisterValidation,
  registerValidation,
  resendEmailOtpValidation,
  resetPasswordValidation,
  verifyEmailValidation,
} from "./auth.validation.js";

import validate from "../../middlewares/validate.middleware.js";
import protect from "../../middlewares/auth.middleware.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const partnerKycUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);

    if (!allowed.has(file.mimetype)) {
      const error = new Error("Partner KYC must be JPG, PNG, WEBP or PDF.");
      error.statusCode = 400;
      return cb(error);
    }

    cb(null, true);
  },
});

const partnerKycFields = partnerKycUpload.fields([
  { name: "panDocument", maxCount: 1 },
  { name: "aadhaarDocument", maxCount: 1 },
]);

const parsePartnerRegistrationPayload = (req, res, next) => {
  if (typeof req.body?.payload !== "string") return next();

  try {
    const parsed = JSON.parse(req.body.payload);
    req.body = {
      ...req.body,
      ...parsed,
    };
    delete req.body.payload;
    return next();
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid partner registration payload.",
    });
  }
};

router.post("/register", registrationLimiter, registerValidation, validate, register);
router.post("/verify-email", otpLimiter, verifyEmailValidation, validate, verifyEmail);
router.post(
  "/resend-verification-otp",
  otpLimiter,
  resendEmailOtpValidation,
  validate,
  resendEmailVerificationOtp
);
router.post("/login", authLimiter, loginValidation, validate, login);
router.post("/google", authLimiter, googleLoginValidation, validate, googleLogin);

router.post(
  "/partner/register",
  registrationLimiter,
  partnerKycFields,
  parsePartnerRegistrationPayload,
  partnerRegisterValidation,
  validate,
  partnerRegister
);
router.post(
  "/partner/login",
  authLimiter,
  partnerLoginValidation,
  validate,
  partnerLogin
);
router.post(
  "/partner/google/register",
  registrationLimiter,
  partnerKycFields,
  parsePartnerRegistrationPayload,
  partnerGoogleRegisterValidation,
  validate,
  partnerGoogleRegister
);
router.post(
  "/partner/google/login",
  authLimiter,
  partnerGoogleLoginValidation,
  validate,
  partnerGoogleLogin
);

router.post("/logout", logout);
router.post("/logout-all", protect, logoutAll);

router.post(
  "/forgot-password",
  passwordResetLimiter,
  forgotPasswordValidation,
  validate,
  forgotPassword
);
router.post(
  "/reset-password",
  passwordResetLimiter,
  resetPasswordValidation,
  validate,
  resetPassword
);

export default router;
