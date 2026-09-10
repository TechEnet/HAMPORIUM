import mongoose from "mongoose";

import {
  PARTNER_REFERRAL_STATUS,
} from "../../constants/statuses.js";

const partnerReferralSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    referralCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    source: {
      type: String,
      trim: true,
      default: "partner_link",
      maxlength: 80,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PartnerProject",
      default: null,
    },

    showcase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Showcase",
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(
        PARTNER_REFERRAL_STATUS
      ),
      default:
        PARTNER_REFERRAL_STATUS.ACTIVE,
      index: true,
    },

    acquiredAt: {
      type: Date,
      default: Date.now,
    },

    lastAttributedAt: {
      type: Date,
      default: null,
    },

    attributedOrderCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    attributedOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    revokeReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

partnerReferralSchema.index({
  partner: 1,
  createdAt: -1,
});

partnerReferralSchema.index({
  partner: 1,
  status: 1,
});

const PartnerReferral =
  mongoose.models.PartnerReferral ||
  mongoose.model(
    "PartnerReferral",
    partnerReferralSchema
  );

export default PartnerReferral;