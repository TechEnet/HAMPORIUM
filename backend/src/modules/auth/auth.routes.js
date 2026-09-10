import { Router } from "express";
import { rateLimit } from "express-rate-limit";

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
