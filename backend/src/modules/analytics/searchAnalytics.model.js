import mongoose from "mongoose";

const SEARCH_EVENT_TYPES = [
  "search_submit",
  "search_result_click",
  "popular_search_click",
];

const searchLocationSchema =
  new mongoose.Schema(
    {
      pincode: {
        type: String,
        trim: true,
        default: "",
        maxlength: 6,
      },

      city: {
        type: String,
        trim: true,
        default: "",
        maxlength: 120,
      },

      state: {
        type: String,
        trim: true,
        default: "",
        maxlength: 120,
      },

      country: {
        type: String,
        trim: true,
        default: "India",
        maxlength: 120,
      },
    },
    {
      _id: false,
    }
  );

const searchAnalyticsSchema =
  new mongoose.Schema(
    {
      eventType: {
        type: String,
        enum:
          SEARCH_EVENT_TYPES,
        required: true,
        index: true,
      },

      query: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
      },

      normalizedQuery: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 160,
        index: true,
      },

      source: {
        type: String,
        trim: true,
        default:
          "unknown",
        maxlength: 60,
        index: true,
      },

      visibleResultCount: {
        type: Number,
        default: null,
        min: 0,
        max: 1000,
      },

      pagePath: {
        type: String,
        trim: true,
        default: "",
        maxlength: 500,
      },

      /*
       * Anonymous browser session id.
       * No password / token / auth credential is stored.
       */
      sessionId: {
        type: String,
        trim: true,
        default: "",
        maxlength: 120,
        index: true,
      },

      /*
       * Only populated for search_result_click.
       */
      product: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref: "Product",

        default: null,

        index: true,
      },

      productSlug: {
        type: String,
        trim: true,
        default: "",
        maxlength: 220,
      },

      productName: {
        type: String,
        trim: true,
        default: "",
        maxlength: 180,
      },

      /*
       * Coarse delivery location only.
       * Exact GPS coordinates are intentionally NOT stored.
       */
      location: {
        type:
          searchLocationSchema,

        default:
          () => ({}),
      },
    },
    {
      timestamps: true,
    }
  );

/* =========================================================
   INDEXES
========================================================= */

searchAnalyticsSchema.index({
  eventType: 1,
  createdAt: -1,
});

searchAnalyticsSchema.index({
  normalizedQuery: 1,
  createdAt: -1,
});

searchAnalyticsSchema.index({
  source: 1,
  createdAt: -1,
});

searchAnalyticsSchema.index({
  "location.pincode": 1,
  createdAt: -1,
});

searchAnalyticsSchema.index({
  product: 1,
  eventType: 1,
  createdAt: -1,
});

const SearchAnalytics =
  mongoose.model(
    "SearchAnalytics",
    searchAnalyticsSchema
  );

export {
  SEARCH_EVENT_TYPES,
};

export default SearchAnalytics;