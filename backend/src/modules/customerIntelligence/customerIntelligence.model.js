import mongoose from "mongoose";

export const CUSTOMER_ACTIVITY_TYPES = Object.freeze([
  "account_created", "email_verified", "signed_in",
  "search_submitted", "product_viewed", "cart_item_added",
  "cart_item_removed", "wishlist_item_added", "wishlist_item_removed",
  "builder_started", "hamper_configured", "checkout_started",
]);

const customerActivitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: CUSTOMER_ACTIVITY_TYPES, required: true, index: true },
    source: { type: String, enum: ["auth", "web"], required: true },
    // Browser events contain only allowlisted, non-secret metadata.
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    skuId: { type: mongoose.Schema.Types.ObjectId, ref: "SKU", default: null },
    searchQuery: { type: String, trim: true, default: "", maxlength: 120 },
    pagePath: { type: String, trim: true, default: "", maxlength: 240 },
    eventKey: { type: String, trim: true, default: undefined, maxlength: 100 },
  },
  { timestamps: true, versionKey: false }
);

customerActivitySchema.index({ user: 1, createdAt: -1 });
customerActivitySchema.index({ user: 1, type: 1, createdAt: -1 });
customerActivitySchema.index({ user: 1, type: 1, productId: 1 });
customerActivitySchema.index(
  { user: 1, eventKey: 1 },
  { unique: true, partialFilterExpression: { eventKey: { $type: "string" } } }
);
// Behavioral history is retained for a bounded period. Transactions remain in their original collections.
const configuredDays = Number(process.env.CUSTOMER_ACTIVITY_RETENTION_DAYS || 180);
const retentionDays = Number.isFinite(configuredDays)
  ? Math.max(30, Math.min(1095, Math.floor(configuredDays)))
  : 180;
customerActivitySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: retentionDays * 24 * 60 * 60 }
);

const CustomerActivity = mongoose.models.CustomerActivity ||
  mongoose.model("CustomerActivity", customerActivitySchema);


const customerActivityConsentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    analyticsEnabled: { type: Boolean, required: true, default: false },
    noticeVersion: { type: String, default: "customer-analytics-v1", maxlength: 50 },
    grantedAt: { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const CustomerActivityConsent = mongoose.models.CustomerActivityConsent ||
  mongoose.model("CustomerActivityConsent", customerActivityConsentSchema);


// Internal audit trail. Never expose to public customer routes.
const accountActionSchema = new mongoose.Schema({
  target: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, enum: ["suspend", "reactivate", "delete"], required: true },
  status: { type: String, enum: ["started", "completed", "failed"], default: "started" },
  reason: { type: String, trim: true, required: true, maxlength: 500 },
  accountRoles: { type: [String], default: [] },
  partnerRecordsAffected: { type: Number, default: 0 },
  completedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });
accountActionSchema.index({ target: 1, createdAt: -1 });
accountActionSchema.index({ actor: 1, createdAt: -1 });
const CustomerAccountAction = mongoose.models.CustomerAccountAction ||
  mongoose.model("CustomerAccountAction", accountActionSchema);

export { CustomerActivity, CustomerActivityConsent, CustomerAccountAction };
