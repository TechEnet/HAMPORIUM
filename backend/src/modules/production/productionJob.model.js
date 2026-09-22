import crypto from "crypto";
import mongoose from "mongoose";

import {
  PRODUCTION_ITEM_STATUS,
  PRODUCTION_STAGE,
  QC_STATUS,
} from "../../constants/statuses.js";

const productionItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      default: "",
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    personalizationRequired: {
      type: Boolean,
      default: false,
    },
    personalizationDetails: {
      type: String,
      default: "",
    },
    personalizationStatus: {
      type: String,
      enum: Object.values(PRODUCTION_ITEM_STATUS),
      default: PRODUCTION_ITEM_STATUS.PENDING,
    },
    assemblyStatus: {
      type: String,
      enum: Object.values(PRODUCTION_ITEM_STATUS),
      default: PRODUCTION_ITEM_STATUS.PENDING,
    },
    qcStatus: {
      type: String,
      enum: Object.values(PRODUCTION_ITEM_STATUS),
      default: PRODUCTION_ITEM_STATUS.PENDING,
    },
    packingStatus: {
      type: String,
      enum: Object.values(PRODUCTION_ITEM_STATUS),
      default: PRODUCTION_ITEM_STATUS.PENDING,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { _id: true }
);

const historySchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      enum: Object.values(PRODUCTION_STAGE),
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const productionJobSchema = new mongoose.Schema(
  {
    jobCode: {
      type: String,
      unique: true,
      index: true,
    },
    sourceKey: {
      type: String,
      default: null,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["order", "corporate", "wedding", "partner", "manual"],
      required: true,
      index: true,
    },
    sourceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    customerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [productionItemSchema],
      validate: [
        (items) => Array.isArray(items) && items.length > 0,
        "At least one production item is required.",
      ],
    },
    stage: {
      type: String,
      enum: Object.values(PRODUCTION_STAGE),
      default: PRODUCTION_STAGE.CONFIRMED,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Internal production target: the order should be ready for courier by this date.
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },

    // Customer-facing delivery promise. This is not used to auto-mark delivery.
    expectedDeliveryDate: {
      type: Date,
      default: null,
      index: true,
    },

    notes: {
      type: String,
      default: "",
    },
    qc: {
      status: {
        type: String,
        enum: Object.values(QC_STATUS),
        default: QC_STATUS.PENDING,
      },
      notes: {
        type: String,
        default: "",
      },
      checkedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      checkedAt: {
        type: Date,
        default: null,
      },
    },
    history: {
      type: [historySchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const doneOrNotRequired = (value) =>
  [
    PRODUCTION_ITEM_STATUS.DONE,
    PRODUCTION_ITEM_STATUS.NOT_REQUIRED,
  ].includes(value);

const allItemsDone = (items, field) =>
  Array.isArray(items) &&
  items.length > 0 &&
  items.every((item) => doneOrNotRequired(item[field]));

const personalizationDone = (items) => {
  const requiredItems = (items || []).filter(
    (item) => item.personalizationRequired
  );

  if (!requiredItems.length) return true;

  return requiredItems.every((item) =>
    doneOrNotRequired(item.personalizationStatus)
  );
};

const pushAutomaticHistory = (job, stage, note) => {
  const last = job.history?.[job.history.length - 1];

  if (last?.stage === stage && last?.note === note) {
    return;
  }

  job.history.push({
    stage,
    note,
    by: job.updatedBy || null,
    at: new Date(),
  });
};

productionJobSchema.pre("validate", function assignJobIdentity() {
  if (!this.jobCode) {
    const date = new Date();

    const stamp =
      `${date.getFullYear()}` +
      `${String(date.getMonth() + 1).padStart(2, "0")}` +
      `${String(date.getDate()).padStart(2, "0")}`;

    this.jobCode =
      `PRD-${stamp}-` +
      crypto.randomBytes(3).toString("hex").toUpperCase();
  }

  if (!this.sourceKey && this.sourceType && this.sourceId) {
    this.sourceKey = `${this.sourceType}:${String(this.sourceId)}`;
  }
});

/*
 * Retail order progression:
 *
 * CONFIRMED
 *   -> admin explicitly starts production
 *
 * PERSONALIZATION
 *   -> ASSEMBLY automatically when all required personalization is done
 *
 * ASSEMBLY
 *   -> QC automatically when every item assembly is done
 *
 * QC
 *   -> PACKING only through the QC endpoint after QC passes
 *
 * PACKING
 *   -> READY_TO_SHIP automatically when every item packing is done
 *
 * SHIPPED and DELIVERED are controlled only by fulfilment.
 */
productionJobSchema.pre("save", function reconcileAutomaticStage() {
  if (this.sourceType !== "order") return;

  if (
    [
      PRODUCTION_STAGE.CONFIRMED,
      PRODUCTION_STAGE.ON_HOLD,
      PRODUCTION_STAGE.CANCELLED,
      PRODUCTION_STAGE.READY_TO_SHIP,
      PRODUCTION_STAGE.SHIPPED,
      PRODUCTION_STAGE.DELIVERED,
    ].includes(this.stage)
  ) {
    return;
  }

  let changed = true;
  let guard = 0;

  while (changed && guard < 4) {
    changed = false;
    guard += 1;

    if (
      this.stage === PRODUCTION_STAGE.PERSONALIZATION &&
      personalizationDone(this.items)
    ) {
      this.stage = PRODUCTION_STAGE.ASSEMBLY;

      pushAutomaticHistory(
        this,
        PRODUCTION_STAGE.ASSEMBLY,
        "Personalization is complete. Production moved to assembly."
      );

      changed = true;
      continue;
    }

    if (
      this.stage === PRODUCTION_STAGE.ASSEMBLY &&
      allItemsDone(this.items, "assemblyStatus")
    ) {
      this.stage = PRODUCTION_STAGE.QC;

      pushAutomaticHistory(
        this,
        PRODUCTION_STAGE.QC,
        "Assembly is complete for every item. Production moved to QC."
      );

      changed = true;
      continue;
    }

    if (
      this.stage === PRODUCTION_STAGE.PACKING &&
      allItemsDone(this.items, "packingStatus")
    ) {
      this.stage = PRODUCTION_STAGE.READY_TO_SHIP;

      pushAutomaticHistory(
        this,
        PRODUCTION_STAGE.READY_TO_SHIP,
        "Packing is complete. The order is ready to ship."
      );

      changed = true;
    }
  }
});

productionJobSchema.post(
  "save",
  async function triggerProductionSideEffects(doc) {
    if (doc.sourceType !== "order" || !doc.sourceId) return;

    try {
      const { syncProductionJobSideEffects } = await import(
        "./productionAutomation.service.js"
      );

      await syncProductionJobSideEffects(doc);
    } catch (error) {
      console.error(
        `Production automatic side-effect failed for ${
          doc.jobCode || doc._id
        }:`,
        error.message
      );
    }
  }
);

productionJobSchema.index({
  stage: 1,
  createdAt: -1,
});

productionJobSchema.index({
  sourceType: 1,
  sourceId: 1,
});

productionJobSchema.index({
  customerUser: 1,
  createdAt: -1,
});

productionJobSchema.index({
  dueDate: 1,
  stage: 1,
});

const ProductionJob =
  mongoose.models.ProductionJob ||
  mongoose.model(
    "ProductionJob",
    productionJobSchema
  );

export default ProductionJob;
