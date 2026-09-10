import crypto from "crypto";
import mongoose from "mongoose";

import {
  PARTNER_BUSINESS_TYPE,
  PARTNER_CAPABILITY_VALUES,
  PARTNER_STATUS,
  PARTNER_TYPE,
  PARTNER_TYPE_VALUES,
} from "../../constants/statuses.js";

const createPartnerId = () =>
  `PTR-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const createReferralCode = () =>
  `HMP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const partnerMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["partner_admin", "partner_user"],
      default: "partner_user",
    },
    isActive: { type: Boolean, default: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: { type: String, trim: true, default: "" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const serviceAreaSchema = new mongoose.Schema(
  {
    city: { type: String, trim: true, default: "", maxlength: 120 },
    state: { type: String, trim: true, default: "", maxlength: 120 },
    pincode: { type: String, trim: true, default: "", maxlength: 10 },
  },
  { _id: false }
);

const verificationDocumentSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    kind: {
      type: String,
      enum: ["pan", "gst", "registration", "address", "portfolio", "other"],
      default: "other",
    },
  },
  { _id: false }
);

const partnerSchema = new mongoose.Schema(
  {
    partnerId: {
      type: String,
      unique: true,
      index: true,
      immutable: true,
      default: createPartnerId,
    },

    referralCode: {
      type: String,
      unique: true,
      index: true,
      immutable: true,
      default: createReferralCode,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    legalName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },

    registeredBusinessName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },

    businessType: {
      type: String,
      enum: Object.values(PARTNER_BUSINESS_TYPE),
      default: PARTNER_BUSINESS_TYPE.INDIVIDUAL,
    },

    partnerType: {
      type: String,
      enum: PARTNER_TYPE_VALUES,
      default: PARTNER_TYPE.EVENT_PLANNER,
      index: true,
    },

    capabilities: {
      type: [{ type: String, enum: PARTNER_CAPABILITY_VALUES }],
      default: [],
    },

    supplyCategories: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: [],
    },

    servicesOffered: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },

    contact: {
      name: { type: String, trim: true, required: true, maxlength: 100 },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        required: true,
        maxlength: 180,
      },
      phone: { type: String, trim: true, default: "", maxlength: 30 },
    },

    website: { type: String, trim: true, default: "", maxlength: 300 },

    social: {
      instagram: { type: String, trim: true, default: "", maxlength: 300 },
      linkedin: { type: String, trim: true, default: "", maxlength: 300 },
      facebook: { type: String, trim: true, default: "", maxlength: 300 },
      other: { type: String, trim: true, default: "", maxlength: 300 },
    },

    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 20,
    },

    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 16,
      select: false,
    },

    address: {
      line1: { type: String, trim: true, default: "", maxlength: 180 },
      line2: { type: String, trim: true, default: "", maxlength: 180 },
      city: { type: String, trim: true, default: "", maxlength: 120 },
      state: { type: String, trim: true, default: "", maxlength: 120 },
      pincode: { type: String, trim: true, default: "", maxlength: 10 },
      country: { type: String, trim: true, default: "India", maxlength: 80 },
    },

    serviceAreas: {
      type: [serviceAreaSchema],
      default: [],
    },

    about: { type: String, trim: true, default: "", maxlength: 3000 },

    experienceYears: { type: Number, min: 0, max: 100, default: 0 },

    portfolioUrl: { type: String, trim: true, default: "", maxlength: 300 },

    commercialProfile: {
      expectedMonthlyVolume: { type: Number, min: 0, default: 0 },
      typicalOrderValue: { type: Number, min: 0, default: 0 },
      preferredWorkingModel: {
        type: String,
        enum: ["referral", "project", "supplier", "hybrid", "other"],
        default: "referral",
      },
      commissionAcknowledged: { type: Boolean, default: false },
    },

    verification: {
      status: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
      panVerified: { type: Boolean, default: false },
      gstVerified: { type: Boolean, default: false },
      note: { type: String, trim: true, default: "", maxlength: 1000 },
      documents: { type: [verificationDocumentSchema], default: [] },
      verifiedAt: { type: Date, default: null },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },

    application: {
      onboardingVersion: { type: String, trim: true, default: "1.0" },
      submittedAt: { type: Date, default: Date.now },
      termsAcceptedAt: { type: Date, default: null },
      privacyAcceptedAt: { type: Date, default: null },
      declarationAcceptedAt: { type: Date, default: null },
      onboardingCompletedAt: { type: Date, default: null },
    },

    members: { type: [partnerMemberSchema], default: [] },

    status: {
      type: String,
      enum: Object.values(PARTNER_STATUS),
      default: PARTNER_STATUS.APPLIED,
      index: true,
    },

    review: {
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: { type: Date, default: null },
      note: { type: String, trim: true, default: "", maxlength: 1200 },
    },

    agreement: {
      version: { type: String, trim: true, default: "" },
      acceptedAt: { type: Date, default: null },
      acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      note: { type: String, trim: true, default: "", maxlength: 1000 },
    },

    // Internal partner earning rate. Never expose publicly.
    defaultCommissionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      select: false,
    },

    // Customer-facing discount attached to this partner's referral/promo code.
    // Public referral resolution exposes only this rate, never commission rate.
    customerDiscountRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      select: false,
    },

    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

partnerSchema.index({ "members.user": 1 });
partnerSchema.index({ status: 1, createdAt: -1 });
partnerSchema.index({ partnerType: 1, status: 1 });

const Partner =
  mongoose.models.Partner ||
  mongoose.model("Partner", partnerSchema);

export default Partner;
