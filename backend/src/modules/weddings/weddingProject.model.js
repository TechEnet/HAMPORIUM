import mongoose from "mongoose";
import crypto from "crypto";

import {
  WEDDING_CONCEPT_STATUS,
  WEDDING_GUEST_IMPORT_STATUS,
  WEDDING_PAYMENT_MILESTONE_STATUS,
  WEDDING_PROJECT_STATUS,
} from "../../constants/statuses.js";


const createWeddingProjectId = () => {
  return `WED-${Date.now()
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
        "family",
        "planner",
        "finance",
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


const conceptSchema = new mongoose.Schema(
  {
    versionNumber: {
      type: Number,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },

    approval: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Approval",
    },

    status: {
      type: String,
      enum: Object.values(
        WEDDING_CONCEPT_STATUS
      ),
      default:
        WEDDING_CONCEPT_STATUS.PUBLISHED,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    approvedAt: {
      type: Date,
    },

    changeRequest: {
      comment: {
        type: String,
        trim: true,
      },

      requestedAt: {
        type: Date,
      },

      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  },
  {
    _id: true,
  }
);


const paymentMilestoneSchema =
  new mongoose.Schema(
    {
      title: {
        type: String,
        required: true,
        trim: true,
      },

      amount: {
        type: Number,
        min: 0,
        default: 0,
      },

      percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },

      dueDate: {
        type: Date,
      },

      required: {
        type: Boolean,
        default: true,
      },

      payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },

      status: {
        type: String,
        enum: Object.values(
          WEDDING_PAYMENT_MILESTONE_STATUS
        ),
        default:
          WEDDING_PAYMENT_MILESTONE_STATUS.PENDING,
      },

      linkedAt: {
        type: Date,
      },

      paidAt: {
        type: Date,
      },

      note: {
        type: String,
        trim: true,
      },
    },
    {
      _id: true,
      timestamps: true,
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


const weddingProjectSchema =
  new mongoose.Schema(
    {
      weddingProjectId: {
        type: String,
        unique: true,
        immutable: true,
        default: createWeddingProjectId,
      },

      owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      members: {
        type: [memberSchema],
        default: [],
      },

      rfq: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RFQ",
        unique: true,
        sparse: true,
      },

      // --------------------------------------
      // BRIEF / FAMILY
      // --------------------------------------

      projectTitle: {
        type: String,
        required: true,
        trim: true,
      },

      coupleName: {
        type: String,
        trim: true,
      },

      familyName: {
        type: String,
        trim: true,
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

      weddingStartDate: {
        type: Date,
      },

      weddingEndDate: {
        type: Date,
      },

      destination: {
        city: {
          type: String,
          trim: true,
        },

        state: {
          type: String,
          trim: true,
        },

        country: {
          type: String,
          trim: true,
          default: "India",
        },
      },

      venueName: {
        type: String,
        trim: true,
      },

      hotelName: {
        type: String,
        trim: true,
      },

      estimatedGuestCount: {
        type: Number,
        min: 0,
        default: 0,
      },

      estimatedRoomCount: {
        type: Number,
        min: 0,
        default: 0,
      },

      totalGiftQuantity: {
        type: Number,
        min: 1,
        default: 1,
      },

      budgetPerGift: {
        type: Number,
        min: 0,
        default: 0,
      },

      totalBudget: {
        type: Number,
        min: 0,
        default: 0,
      },

      currency: {
        type: String,
        default: "INR",
        uppercase: true,
      },

      giftingCategories: {
        type: [String],
        default: [],
      },

      theme: {
        type: String,
        trim: true,
      },

      style: {
        type: String,
        trim: true,
      },

      colourPalette: {
        type: [String],
        default: [],
      },

      dietaryRequirements: {
        type: [String],
        default: [],
      },

      culturalRequirements: {
        type: [String],
        default: [],
      },

      personalizationRequirements: {
        type: String,
        trim: true,
      },

      packagingRequirements: {
        type: String,
        trim: true,
      },

      destinationConstraints: {
        type: String,
        trim: true,
      },

      notes: {
        type: String,
        trim: true,
      },

      // --------------------------------------
      // SHARED DOCUMENTS
      // --------------------------------------

      documents: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Document",
        },
      ],

      guestFile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
      },

      // --------------------------------------
      // CONCEPTS
      // --------------------------------------

      concepts: {
        type: [conceptSchema],
        default: [],
      },

      currentConceptVersion: {
        type: Number,
        default: 0,
      },

      // --------------------------------------
      // PAYMENT MILESTONES
      // --------------------------------------

      paymentMilestones: {
        type: [paymentMilestoneSchema],
        default: [],
      },

      // --------------------------------------
      // GUEST SUMMARY
      // --------------------------------------

      guestImportStatus: {
        type: String,
        enum: Object.values(
          WEDDING_GUEST_IMPORT_STATUS
        ),
        default:
          WEDDING_GUEST_IMPORT_STATUS.NOT_UPLOADED,
      },

      guestSummary: {
        total: {
          type: Number,
          default: 0,
        },

        valid: {
          type: Number,
          default: 0,
        },

        invalid: {
          type: Number,
          default: 0,
        },

        approved: {
          type: Number,
          default: 0,
        },

        allocated: {
          type: Number,
          default: 0,
        },
      },

      // --------------------------------------
      // OPERATIONS
      // --------------------------------------

      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      priority: {
        type: String,
        enum: [
          "low",
          "normal",
          "high",
          "urgent",
        ],
        default: "normal",
        index: true,
      },

      promisedDate: {
        type: Date,
      },

      nextAction: {
        type: String,
        trim: true,
      },

      internalNotes: {
        type: String,
        trim: true,
        select: false,
      },

      status: {
        type: String,
        enum: Object.values(
          WEDDING_PROJECT_STATUS
        ),
        default:
          WEDDING_PROJECT_STATUS.DRAFT,
        index: true,
      },

      submittedAt: {
        type: Date,
      },

      cancelledAt: {
        type: Date,
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


weddingProjectSchema.index({
  owner: 1,
  createdAt: -1,
});


weddingProjectSchema.index({
  "members.user": 1,
});


weddingProjectSchema.index({
  status: 1,
  priority: 1,
  createdAt: -1,
});


weddingProjectSchema.index({
  assignedTo: 1,
  status: 1,
});


const WeddingProject =
  mongoose.model(
    "WeddingProject",
    weddingProjectSchema
  );


export default WeddingProject;