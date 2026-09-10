import mongoose from "mongoose";

import {
  ROLES,
  ROLE_VALUES,
} from "../../constants/roles.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    password: {
      type: String,
      default: null,
      select: false,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    avatar: {
      type: String,
      default: "",
    },

    roles: {
      type: [
        {
          type: String,
          enum: ROLE_VALUES,
        },
      ],
      default: [ROLES.CUSTOMER],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    /*
     * Migration-safe default:
     * existing users created before email verification was introduced
     * remain usable. New email/password registrations explicitly set false.
     */
    emailVerified: {
      type: Boolean,
      default: true,
      index: true,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    emailVerificationOtpHash: {
      type: String,
      select: false,
      default: null,
    },

    emailVerificationOtpExpiresAt: {
      type: Date,
      select: false,
      default: null,
    },

    emailVerificationOtpAttempts: {
      type: Number,
      select: false,
      default: 0,
      min: 0,
    },

    emailVerificationOtpLastSentAt: {
      type: Date,
      select: false,
      default: null,
    },

    emailVerificationOtpWindowStartedAt: {
      type: Date,
      select: false,
      default: null,
    },

    emailVerificationOtpSendCount: {
      type: Number,
      select: false,
      default: 0,
      min: 0,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    tokenVersion: {
      type: Number,
      default: 0,
    },

    passwordResetOtpHash: {
      type: String,
      select: false,
      default: null,
    },

    passwordResetOtpExpiresAt: {
      type: Date,
      select: false,
      default: null,
    },

    passwordResetOtpAttempts: {
      type: Number,
      select: false,
      default: 0,
      min: 0,
    },

    passwordResetOtpLastSentAt: {
      type: Date,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ roles: 1, isActive: 1 });

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

export default User;
