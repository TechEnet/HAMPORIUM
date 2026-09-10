export const PRODUCT_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
});

export const PRODUCT_STATUS_VALUES = Object.values(PRODUCT_STATUS);

export const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  PAYMENT_FAILED: "payment_failed",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
});

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);

export const CUSTOMER_ORDER_STATUS = Object.freeze({
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  PACKED: "packed",
  DISPATCHED: "dispatched",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
});

export const CUSTOMER_ORDER_STATUS_VALUES = Object.values(
  CUSTOMER_ORDER_STATUS
);

export const CANCELLATION_STATUS = Object.freeze({
  NONE: "none",
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected",
});

export const CANCELLATION_STATUS_VALUES = Object.values(
  CANCELLATION_STATUS
);

export const ORDER_PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  PARTIALLY_REFUNDED: "partially_refunded",
  REFUNDED: "refunded",
});

export const ORDER_PAYMENT_STATUS_VALUES = Object.values(
  ORDER_PAYMENT_STATUS
);

export const PAYMENT_STATUS = Object.freeze({
  CREATED: "created",
  AUTHORIZED: "authorized",
  CAPTURED: "captured",
  FAILED: "failed",
  PARTIALLY_REFUNDED: "partially_refunded",
  REFUNDED: "refunded",
});

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

export const REFUND_TYPE = Object.freeze({
  FULL: "full",
  PARTIAL: "partial",
});

export const REFUND_TYPE_VALUES = Object.values(REFUND_TYPE);

export const REFUND_STATUS = Object.freeze({
  CREATED: "created",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
});

export const REFUND_STATUS_VALUES = Object.values(REFUND_STATUS);

// ==============================
// PHASE 5 - RFQ
// ==============================

export const RFQ_STATUS = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  QUOTED: "quoted",
  QUOTE_CHANGE_REQUESTED: "quote_change_requested",
  QUOTE_ACCEPTED: "quote_accepted",
  PROOF_REVIEW: "proof_review",
  PROOF_CHANGE_REQUESTED: "proof_change_requested",
  APPROVED: "approved",
  CANCELLED: "cancelled",
});

// ======================================================
// PHASE 5 - QUOTE
// ======================================================

export const QUOTE_STATUS = Object.freeze({
  DRAFT: "draft",
  SENT: "sent",
  CHANGE_REQUESTED: "change_requested",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  EXPIRED: "expired",
});

export const QUOTE_VERSION_STATUS = Object.freeze({
  DRAFT: "draft",
  SENT: "sent",
  CHANGE_REQUESTED: "change_requested",
  ACCEPTED: "accepted",
  SUPERSEDED: "superseded",
});

// ==============================
// PHASE 5 - APPROVAL
// ==============================

export const APPROVAL_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  CANCELLED: "cancelled",
});

export const APPROVAL_ACTION = Object.freeze({
  APPROVE: "approve",
  REQUEST_CHANGES: "request_changes",
  COMMENT: "comment",
  ASK_FOR_CALL: "ask_for_call",
});

// ==============================
// PHASE 5 - DOCUMENT
// ==============================

export const DOCUMENT_STATUS = Object.freeze({
  ACTIVE: "active",
  SUPERSEDED: "superseded",
  ARCHIVED: "archived",
});

// ======================================================
// PHASE 6 - CORPORATE
// ======================================================

export const ORGANIZATION_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});

export const CORPORATE_CAMPAIGN_STATUS = Object.freeze({
  DRAFT: "draft",
  RFQ_SUBMITTED: "rfq_submitted",
  QUOTE_IN_PROGRESS: "quote_in_progress",
  QUOTE_SENT: "quote_sent",
  QUOTE_CHANGE_REQUESTED: "quote_change_requested",
  QUOTE_ACCEPTED: "quote_accepted",
  PROOF_PENDING: "proof_pending",
  APPROVAL_PENDING: "approval_pending",
  APPROVED: "approved",
  COMMERCIAL_PENDING: "commercial_pending",
  PO_PENDING: "po_pending",
  PAYMENT_PENDING: "payment_pending",
  COMMERCIAL_CONFIRMED: "commercial_confirmed",
  RECIPIENTS_PENDING: "recipients_pending",
  RECIPIENTS_REVIEW: "recipients_review",
  RECIPIENTS_READY: "recipients_ready",
  READY_FOR_PRODUCTION: "ready_for_production",
  CANCELLED: "cancelled",
});

export const CORPORATE_PO_STATUS = Object.freeze({
  NOT_REQUIRED: "not_required",
  PENDING: "pending",
  SUBMITTED: "submitted",
  VERIFIED: "verified",
  REJECTED: "rejected",
});

export const CORPORATE_PAYMENT_STATUS = Object.freeze({
  NOT_REQUIRED: "not_required",
  PENDING: "pending",
  PARTIAL: "partial",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
});

export const RECIPIENT_IMPORT_STATUS = Object.freeze({
  NOT_UPLOADED: "not_uploaded",
  UPLOADED: "uploaded",
  NEEDS_REVIEW: "needs_review",
  APPROVED: "approved",
});

export const RECIPIENT_STATUS = Object.freeze({
  VALID: "valid",
  NEEDS_REVIEW: "needs_review",
  INVALID: "invalid",
  APPROVED: "approved",
});

// ======================================================
// PHASE 7 - WEDDING
// ======================================================

export const WEDDING_PROJECT_STATUS = Object.freeze({
  DRAFT: "draft",
  BRIEF_SUBMITTED: "brief_submitted",
  UNDER_REVIEW: "under_review",
  CONCEPT_READY: "concept_ready",
  CONCEPT_CHANGE_REQUESTED: "concept_change_requested",
  CONCEPT_APPROVED: "concept_approved",
  QUOTE_IN_PROGRESS: "quote_in_progress",
  QUOTE_SENT: "quote_sent",
  QUOTE_CHANGE_REQUESTED: "quote_change_requested",
  QUOTE_ACCEPTED: "quote_accepted",
  SAMPLE_PENDING: "sample_pending",
  APPROVAL_PENDING: "approval_pending",
  PROOF_CHANGE_REQUESTED: "proof_change_requested",
  APPROVED: "approved",
  PAYMENT_PENDING: "payment_pending",
  PAYMENT_PARTIAL: "payment_partial",
  PAYMENT_CONFIRMED: "payment_confirmed",
  GUESTS_PENDING: "guests_pending",
  GUESTS_REVIEW: "guests_review",
  GUESTS_READY: "guests_ready",
  READY_FOR_PRODUCTION: "ready_for_production",
  CANCELLED: "cancelled",
});

export const WEDDING_CONCEPT_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  CHANGE_REQUESTED: "change_requested",
  APPROVED: "approved",
  SUPERSEDED: "superseded",
});

export const WEDDING_EVENT_STATUS = Object.freeze({
  PLANNED: "planned",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
});

export const WEDDING_PAYMENT_MILESTONE_STATUS = Object.freeze({
  PENDING: "pending",
  PARTIAL: "partial",
  PAID: "paid",
  WAIVED: "waived",
});

export const WEDDING_GUEST_IMPORT_STATUS = Object.freeze({
  NOT_UPLOADED: "not_uploaded",
  UPLOADED: "uploaded",
  NEEDS_REVIEW: "needs_review",
  APPROVED: "approved",
});

export const WEDDING_GUEST_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  APPROVED: "approved",
});

export const WEDDING_GUEST_DELIVERY_STATUS = Object.freeze({
  NOT_PLANNED: "not_planned",
  ALLOCATED: "allocated",
  READY: "ready",
  DELIVERED: "delivered",
  EXCEPTION: "exception",
});

// =====================================================
// PHASE 8 - EVENT PARTNER
// =====================================================

export const PARTNER_STATUS = Object.freeze({
  APPLIED: "applied",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
});


export const PARTNER_TYPE = Object.freeze({
  EVENT_PLANNER: "event_planner",
  WEDDING_PLANNER: "wedding_planner",
  CORPORATE_GIFTING_PARTNER: "corporate_gifting_partner",
  EVENT_AGENCY: "event_agency",
  GIFT_CURATOR: "gift_curator",
  VENDOR_SUPPLIER: "vendor_supplier",
  PACKAGING_SUPPLIER: "packaging_supplier",
  FOOD_SUPPLIER: "food_supplier",
  NON_FOOD_SUPPLIER: "non_food_supplier",
  PERSONALIZATION_PARTNER: "personalization_partner",
  LOGISTICS_PARTNER: "logistics_partner",
  VENUE_PARTNER: "venue_partner",
  OTHER: "other",
});

export const PARTNER_TYPE_VALUES = Object.values(PARTNER_TYPE);

export const PARTNER_BUSINESS_TYPE = Object.freeze({
  INDIVIDUAL: "individual",
  PROPRIETORSHIP: "proprietorship",
  PARTNERSHIP: "partnership",
  LLP: "llp",
  PRIVATE_LIMITED: "private_limited",
  PUBLIC_LIMITED: "public_limited",
  OTHER: "other",
});

export const PARTNER_CAPABILITY = Object.freeze({
  READY_MADE_HAMPERS: "ready_made_hampers",
  CUSTOM_HAMPERS: "custom_hampers",
  FOOD_PRODUCTS: "food_products",
  NON_FOOD_PRODUCTS: "non_food_products",
  PACKAGING: "packaging",
  PERSONALIZATION: "personalization",
  WEDDING_GIFTING: "wedding_gifting",
  CORPORATE_GIFTING: "corporate_gifting",
  EVENT_GIFTING: "event_gifting",
  BULK_SOURCING: "bulk_sourcing",
  LOGISTICS: "logistics",
  DESIGN_CURATION: "design_curation",
  OTHER: "other",
});

export const PARTNER_CAPABILITY_VALUES = Object.values(PARTNER_CAPABILITY);

export const PARTNER_REFERRAL_STATUS = Object.freeze({
  ACTIVE: "active",
  REVOKED: "revoked",
});

export const PARTNER_PAYOUT_STATUS = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  HELD: "held",
  PAID: "paid",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

export const PARTNER_PROJECT_STATUS = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  CHANGES_REQUESTED: "changes_requested",
  CLIENT_PRICE_APPROVED: "client_price_approved",
  SHOWCASE_LIVE: "showcase_live",
  CLIENT_REVIEW: "client_review",
  CLIENT_APPROVED: "client_approved",
  ENQUIRY: "enquiry",
  ORDER_ATTRIBUTED: "order_attributed",
  CANCELLED: "cancelled",
});

export const SHOWCASE_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  REVOKED: "revoked",
  EXPIRED: "expired",
  ARCHIVED: "archived",
});

export const SHOWCASE_CLIENT_ACTION = Object.freeze({
  SHORTLIST: "shortlist",
  UNSHORTLIST: "unshortlist",
  COMMENT: "comment",
  REQUEST_CHANGE: "request_change",
  APPROVE: "approve",
  ENQUIRE: "enquire",
});

export const COMMISSION_STATUS = Object.freeze({
  POTENTIAL: "potential",
  ATTRIBUTED: "attributed",
  ORDER_CONFIRMED: "order_confirmed",
  ELIGIBLE: "eligible",
  PAYABLE: "payable",
  PAID: "paid",
  REVERSED: "reversed",
});

export const COMMISSION_PAYOUT_STATUS = Object.freeze({
  NOT_DUE: "not_due",
  PENDING: "pending",
  HELD: "held",
  PAID: "paid",
  REVERSED: "reversed",
});

// ======================================================
// PHASE 9 - PRODUCTION / QC / FULFILMENT
// ======================================================

export const PRODUCTION_STAGE = Object.freeze({
  CONFIRMED: "confirmed",
  PERSONALIZATION: "personalization",
  ASSEMBLY: "assembly",
  QC: "qc",
  PACKING: "packing",
  READY_TO_SHIP: "ready_to_ship",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  ON_HOLD: "on_hold",
  CANCELLED: "cancelled",
});

export const PRODUCTION_ITEM_STATUS = Object.freeze({
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  DONE: "done",
  NOT_REQUIRED: "not_required",
  FAILED: "failed",
  REWORK: "rework",
});

export const QC_STATUS = Object.freeze({
  PENDING: "pending",
  PASSED: "passed",
  FAILED: "failed",
});

export const FULFILMENT_STATUS = Object.freeze({
  CREATED: "created",
  LABEL_READY: "label_ready",
  DISPATCHED: "dispatched",
  IN_TRANSIT: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  FAILED: "failed",
  RETURNED: "returned",
  CANCELLED: "cancelled",
});

export const NOTIFICATION_STATUS = Object.freeze({
  UNREAD: "unread",
  READ: "read",
});

export const NOTIFICATION_TYPE = Object.freeze({
  ORDER: "order",
  PAYMENT: "payment",
  PRODUCTION: "production",
  QC: "qc",
  SHIPMENT: "shipment",
  REFUND: "refund",
  COMMISSION: "commission",
  PARTNER: "partner",
  PAYOUT: "payout",
  SYSTEM: "system",
});

export const NOTIFICATION_EMAIL_STATUS = Object.freeze({
  NOT_REQUESTED: "not_requested",
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
});

export const NOTIFICATION_WHATSAPP_STATUS = Object.freeze({
  NOT_REQUESTED: "not_requested",
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
});
