import mongoose from "mongoose";
import crypto from "crypto";

import {
  ORGANIZATION_STATUS,
} from "../../constants/statuses.js";


const createOrganizationId = () => {
  return `ORG-${Date.now()
    .toString(36)
    .toUpperCase()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
};


const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: [
        "owner",
        "corporate_admin",
        "requester",
        "approver",
        "procurement_finance",
        "viewer",
      ],
      default: "viewer",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);


const statusHistorySchema =
  new mongoose.Schema(
    {
      status: {
        type: String,
        required: true,
      },

      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      note: {
        type: String,
        trim: true,
      },

      changedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    }
  );


const organizationSchema =
  new mongoose.Schema(
    {
      organizationId: {
        type: String,
        unique: true,
        immutable: true,
        default: createOrganizationId,
      },

      owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      legalName: {
        type: String,
        trim: true,
      },

      gstNumber: {
        type: String,
        trim: true,
        uppercase: true,
      },

      panNumber: {
        type: String,
        trim: true,
        uppercase: true,
      },

      primaryContact: {
        name: {
          type: String,
          trim: true,
        },

        email: {
          type: String,
          trim: true,
          lowercase: true,
        },

        phone: {
          type: String,
          trim: true,
        },
      },

      billing: {
        email: {
          type: String,
          trim: true,
          lowercase: true,
        },

        phone: {
          type: String,
          trim: true,
        },

        addressLine1: {
          type: String,
          trim: true,
        },

        addressLine2: {
          type: String,
          trim: true,
        },

        city: {
          type: String,
          trim: true,
        },

        state: {
          type: String,
          trim: true,
        },

        pincode: {
          type: String,
          trim: true,
        },

        country: {
          type: String,
          trim: true,
          default: "India",
        },
      },

      members: {
        type: [memberSchema],
        default: [],
      },

      status: {
        type: String,
        enum: Object.values(
          ORGANIZATION_STATUS
        ),
        default:
          ORGANIZATION_STATUS.ACTIVE,
        index: true,
      },

      statusHistory: {
        type: [statusHistorySchema],
        default: [],
      },
    },
    {
      timestamps: true,
    }
  );


organizationSchema.index({
  "members.user": 1,
});


organizationSchema.index(
  {
    gstNumber: 1,
  },
  {
    sparse: true,
  }
);


const Organization =
  mongoose.model(
    "Organization",
    organizationSchema
  );


export default Organization;