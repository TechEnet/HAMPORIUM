import mongoose from "mongoose";

const SOURCE_TYPES = ["manual", "product_master", "google_sheet"];

const sourceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: SOURCE_TYPES,
      default: "manual",
    },
    externalSku: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    sourceUpdatedAt: {
      type: Date,
      default: null,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    image: {
      type: String,
      trim: true,
      default: "",
    },

    imagePublicId: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    /*
     * Lets Product Master replacement remove only categories created by
     * an imported workbook while preserving manually managed categories.
     */
    source: {
      type: sourceSchema,
      default: () => ({ type: "manual" }),
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({
  isActive: 1,
  sortOrder: 1,
  name: 1,
});

categorySchema.index({ "source.type": 1, "source.externalSku": 1 });

const Category = mongoose.model("Category", categorySchema);

export default Category;
