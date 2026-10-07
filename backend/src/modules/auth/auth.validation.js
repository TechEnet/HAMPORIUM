import { body } from "express-validator";

import {
  PARTNER_BUSINESS_TYPE,
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

const partnerKycNumberValidation = body().custom((value, { req }) => {
  const panNumber = String(req.body?.panNumber || "").trim();
  const aadhaarNumber = String(req.body?.aadhaarNumber || "").replace(/\D/g, "");

  if (!panNumber && !aadhaarNumber) {
    throw new Error("Enter PAN or Aadhaar details for partner verification");
  }

  return true;
});

const partnerKycFileValidation = body().custom((value, { req }) => {
  const panNumber = String(req.body?.panNumber || "").trim();
  const aadhaarNumber = String(req.body?.aadhaarNumber || "").replace(/\D/g, "");
  const panDocument = req.files?.panDocument?.[0];
  const aadhaarDocument = req.files?.aadhaarDocument?.[0];

  if (panNumber && !panDocument) {
    throw new Error("Upload the PAN image or PDF");
  }

  if (aadhaarNumber && !aadhaarDocument) {
    throw new Error("Upload the Aadhaar image or PDF");
  }

  return true;
});

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
    .withMessage("Business or working name is required")
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
    .withMessage("Tell us briefly what you provide or what kind of work you do")
    .isLength({ min: 10, max: 3000 })
    .withMessage("Work details must be between 10 and 3000 characters"),

  body("address.city").trim().notEmpty().withMessage("City is required"),
  body("address.state").trim().notEmpty().withMessage("State is required"),

  body("address.pincode")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage("Enter a valid 6 digit Indian pincode"),

  body("panNumber")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i)
    .withMessage("Enter a valid PAN number"),

  body("aadhaarNumber")
    .optional({ checkFalsy: true })
    .customSanitizer((value) => String(value || "").replace(/\D/g, ""))
    .matches(/^\d{12}$/)
    .withMessage("Enter a valid 12 digit Aadhaar number"),

  partnerKycNumberValidation,

  body("gstNumber")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i)
    .withMessage("Enter a valid GSTIN"),

  body("capabilities")
    .optional()
    .isArray()
    .withMessage("Capabilities must be an array"),

  body("supplyCategories")
    .optional()
    .isArray()
    .withMessage("Supply categories must be an array"),

  body("servicesOffered")
    .optional()
    .isArray()
    .withMessage("Services offered must be an array"),

  body("commercialProfile.preferredWorkingModel")
    .optional({ checkFalsy: true })
    .isIn(["referral", "project", "supplier", "hybrid", "other"])
    .withMessage("Select a valid partner working model"),

  body("commercialProfile.commissionAcknowledged")
    .optional()
    .isBoolean()
    .withMessage("Commission acknowledgement must be true or false"),

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
  partnerKycFileValidation,
];

export const partnerGoogleRegisterValidation = [
  ...googleLoginValidation,
  ...partnerApplicationValidation,
  partnerKycFileValidation,
];

export const partnerLoginValidation = loginValidation;
export const partnerGoogleLoginValidation = googleLoginValidation;
