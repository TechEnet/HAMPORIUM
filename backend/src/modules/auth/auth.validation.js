import { body } from "express-validator";

import {
  PARTNER_BUSINESS_TYPE,
  PARTNER_CAPABILITY_VALUES,
  PARTNER_TYPE_VALUES,
} from "../../constants/statuses.js";

const passwordByteLengthValidator = (password) => {
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Password is too long");
  }
  return true;
};

const passwordRules = (field = "password") =>
  body(field)
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .custom(passwordByteLengthValidator);

const emailRules = (field = "email") =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Enter a valid email address")
    .normalizeEmail();

export const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 80 })
    .withMessage("Name must be between 2 and 80 characters"),
  emailRules(),
  passwordRules(),
  body("phone")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 7, max: 20 })
    .withMessage("Enter a valid phone number"),
];

export const loginValidation = [emailRules(), passwordRules()];

export const googleLoginValidation = [
  body("credential")
    .isString()
    .withMessage("Google credential must be a string")
    .notEmpty()
    .withMessage("Google credential is required"),
];

export const verifyEmailValidation = [
  emailRules(),
  body("otp")
    .trim()
    .matches(/^\d{6}$/)
    .withMessage("OTP must contain exactly 6 digits"),
];

export const resendEmailOtpValidation = [emailRules()];

export const forgotPasswordValidation = [emailRules()];

export const resetPasswordValidation = [
  emailRules(),
  body("otp")
    .trim()
    .matches(/^\d{6}$/)
    .withMessage("OTP must contain exactly 6 digits"),
  passwordRules("newPassword"),
];

export const partnerApplicationValidation = [
  body("businessName")
    .trim()
    .notEmpty()
    .withMessage("Business name is required")
    .isLength({ max: 160 }),
  body("partnerType")
    .isIn(PARTNER_TYPE_VALUES)
    .withMessage("Select a valid partner type"),
  body("businessType")
    .optional({ checkFalsy: true })
    .isIn(Object.values(PARTNER_BUSINESS_TYPE))
    .withMessage("Select a valid business type"),
  body("contact.phone")
    .trim()
    .notEmpty()
    .withMessage("Partner phone number is required")
    .isLength({ min: 7, max: 20 })
    .withMessage("Enter a valid partner phone number"),
  body("about")
    .trim()
    .notEmpty()
    .withMessage("Tell us about your business")
    .isLength({ min: 20, max: 3000 })
    .withMessage("Business description must be between 20 and 3000 characters"),
  body("capabilities")
    .isArray({ min: 1 })
    .withMessage("Select at least one capability"),
  body("capabilities.*")
    .isIn(PARTNER_CAPABILITY_VALUES)
    .withMessage("Invalid partner capability"),
  body("address.city")
    .trim()
    .notEmpty()
    .withMessage("City is required"),
  body("address.state")
    .trim()
    .notEmpty()
    .withMessage("State is required"),
  body("address.pincode")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage("Enter a valid 6 digit Indian pincode"),
  body("experienceYears")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage("Experience must be between 0 and 100 years"),
  body("panNumber")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i)
    .withMessage("Enter a valid PAN number"),
  body("gstNumber")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i)
    .withMessage("Enter a valid GSTIN"),
  body("website")
    .optional({ checkFalsy: true })
    .trim()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("Website must be a valid http/https URL"),
  body("portfolioUrl")
    .optional({ checkFalsy: true })
    .trim()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("Portfolio must be a valid http/https URL"),
  body("commercialProfile.preferredWorkingModel")
    .optional({ checkFalsy: true })
    .isIn(["referral", "project", "supplier", "hybrid", "other"])
    .withMessage("Select a valid partner working model"),
  body("commercialProfile.commissionAcknowledged")
    .custom((value) => value === true)
    .withMessage("Commission model acknowledgement is required"),
  body("application.termsAccepted")
    .custom((value) => value === true)
    .withMessage("Partner terms must be accepted"),
  body("application.privacyAccepted")
    .custom((value) => value === true)
    .withMessage("Privacy terms must be accepted"),
  body("application.declarationAccepted")
    .custom((value) => value === true)
    .withMessage("Partner declaration must be accepted"),
];

export const partnerRegisterValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 80 }),
  emailRules(),
  passwordRules(),
  ...partnerApplicationValidation,
];

export const partnerGoogleRegisterValidation = [
  ...googleLoginValidation,
  ...partnerApplicationValidation,
];

export const partnerLoginValidation = loginValidation;
export const partnerGoogleLoginValidation = googleLoginValidation;
