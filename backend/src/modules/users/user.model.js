import mongoose from "mongoose";
import { ROLES, ROLE_VALUES } from "../../constants/roles.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, default: "" },
    password: { type: String, default: null, select: false },
    googleId: { type: String, unique: true, sparse: true, index: true },
    avatar: { type: String, default: "" },
    roles: {
      type: [{ type: String, enum: ROLE_VALUES }],
      default: [ROLES.CUSTOMER],
    },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: true, index: true },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationOtpHash: { type: String, select: false, default: null },
    emailVerificationOtpExpiresAt: { type: Date, select: false, default: null },
    emailVerificationOtpAttempts: { type: Number, select: false, default: 0, min: 0 },
    emailVerificationOtpLastSentAt: { type: Date, select: false, default: null },
    emailVerificationOtpWindowStartedAt: { type: Date, select: false, default: null },
    emailVerificationOtpSendCount: { type: Number, select: false, default: 0, min: 0 },
    lastLoginAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    passwordResetOtpHash: { type: String, select: false, default: null },
    passwordResetOtpExpiresAt: { type: Date, select: false, default: null },
    passwordResetOtpAttempts: { type: Number, select: false, default: 0, min: 0 },
    passwordResetOtpLastSentAt: { type: Date, select: false, default: null },

    // Customer 360 account moderation. All pre-existing documents default to not deleted.
    // This is an access deletion + profile anonymization, not a financial-ledger erasure.
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

userSchema.index({ roles: 1, isActive: 1 });
userSchema.index({ isDeleted: 1, createdAt: -1 });

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
