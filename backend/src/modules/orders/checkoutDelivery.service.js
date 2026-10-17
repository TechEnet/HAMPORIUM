

import mongoose from "mongoose";

import Address from "../users/address.model.js";
import Cart from "../cart/cart.model.js";
import SKU from "../catalog/sku.model.js";
import Container from "../catalog/container.model.js";

import { getSkuCheckoutIssue } from "../catalog/catalogReadiness.service.js";
import {
  calculateCustomHamperDeliveryEstimate,
  calculateSkuDeliveryEstimate,
} from "../delivery/delivery.service.js";

const INDIA_PINCODE_REGEX = /^[1-9][0-9]{5}$/;
// No courier-day configuration or secondary delivery timing (Excel-only V6).
const httpError = (message, statusCode = 400, code = "") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};
const normalizeQuantity = (value) => {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 99 ? quantity : null;
};

const toDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const maxDate = (dates = []) => {
  const valid = dates
    .map((value) => (value ? new Date(value) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));

  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((date) => date.getTime())));
};

const getAddress = async ({ userId, addressId }) => {
  if (!mongoose.isValidObjectId(addressId)) {
    throw httpError("Valid delivery address is required", 400, "ADDRESS_REQUIRED");
  }

  const address = await Address.findOne({ _id: addressId, user: userId }).lean();
  if (!address) {
    throw httpError("Delivery address not found", 404, "ADDRESS_NOT_FOUND");
  }

  const pincode = String(address.postalCode || "").replace(/\D/g, "");
  if (!INDIA_PINCODE_REGEX.test(pincode)) {
    throw httpError(
      "Selected address must contain a valid 6-digit Indian pincode",
      409,
      "PINCODE_REQUIRED"
    );
  }

  return { address, pincode };
};

const describeCheckoutBlocker = (estimate, label) => {
  const dependency = estimate?.blockedDependencies?.[0] || null;
  const reason = dependency?.blockingReason || estimate?.blockedReasons?.[0] || "ITEM_UNAVAILABLE";
  const category = {
    container: "box",
    hamper_content: "hamper item",
    internal_material: "packing material",
    container_packing_material: "packing material",
    custom_content: "custom hamper item",
    decoration: "decoration",
    selected_component: "hamper item",
  }[dependency?.source] || "item";
  // Product names are already public; never expose MongoDB IDs, supplier costs
  // or customer address data through checkout errors.
  const name = String(dependency?.name || "").trim().slice(0, 80);
  const item = name && name !== dependency?.source ? `${category} "${name}"` : `required ${category}`;

  switch (reason) {
    case "REFERENCE_NOT_FOUND":
      return { reason, message: `${label}: a required ${category} is missing from the catalogue (REFERENCE_NOT_FOUND). Please contact support.` };
    case "INACTIVE":
      return { reason, message: `${label}: ${item} is inactive (INACTIVE). Please choose another item or contact support.` };
    case "INSUFFICIENT_STOCK":
      return { reason, message: `${label}: ${item} has insufficient stock for the selected quantity (INSUFFICIENT_STOCK).` };
    case "LEAD_TIME_MISSING":
      return { reason, message: dependency
        ? `${label}: Excel Lead Time Days is missing for ${item} (LEAD_TIME_MISSING). Add it and confirm import.`
        : `${label}: its own Lead Time Days is missing in Excel Hamper Master (LEAD_TIME_MISSING). Add it and confirm import.` };
    case "STOCK_UNIT_MISMATCH":
      return { reason, message: `${label}: stock quantity units for ${item} are inconsistent. Please contact support (STOCK_UNIT_MISMATCH).` };
    case "AVAILABILITY_DATE_UNKNOWN":
      return { reason, message: `${label}: the restock date for ${item} is not confirmed (AVAILABILITY_DATE_UNKNOWN).` };
    case "UNAVAILABLE":
      return { reason, message: `${label}: ${item} is currently unavailable (UNAVAILABLE).` };
    default:
      return { reason, message: `${label} cannot be scheduled right now (${reason}). Please review your cart or contact support.` };
  }
};

const validateEstimate = (estimate, label) => {
  if (!estimate?.canEstimate) {
    const blocker = describeCheckoutBlocker(estimate, label);
    // A 409 is correct for an unavailable dependency. Log a stable code so
    // the admin can fix the Product Master / MongoDB record instead of guessing.
    console.warn("[CheckoutDelivery] blocked", {
      product: label,
      code: blocker.reason,
      source: estimate?.blockedDependencies?.[0]?.source || null,
      referenceId: estimate?.blockedDependencies?.[0]?.referenceId || null,
    });
    throw httpError(blocker.message, 409, blocker.reason);
  }

  if (!estimate.expectedDeliveryDate) {
    throw httpError(
      `Expected delivery is temporarily unavailable for ${label} (DELIVERY_DATE_MISSING). Please try again later.`,
      409,
      "DELIVERY_DATE_MISSING"
    );
  }
};

const requireEligibleSku = (sku, { mode = "cart", itemId = null } = {}) => {
  const issue = getSkuCheckoutIssue(sku);
  if (!issue) return;
  console.warn("[CheckoutDelivery] SKU eligibility blocked", {
    code: issue.code,
    mode,
    skuCode: sku?.code || null,
    cartItemId: itemId ? String(itemId) : null,
  });
  throw httpError(issue.message, 409, issue.code);
};

const buildSkuEstimate = async ({ sku, quantity, itemId = null }) => {
  const label = sku.product?.name || sku.name || sku.code || "Hamper";

  const estimate = await calculateSkuDeliveryEstimate(sku, {
    quantity,
    includeDetails: true,
  });
  validateEstimate(estimate, label);

  return {
    itemId,
    itemType: "sku",
    skuId: sku._id,
    skuCode: sku.code,
    name: label,
    quantity,
    ...estimate,
  };
};

const buildCustomEstimate = async ({ cartItem }) => {
  const quantity = normalizeQuantity(cartItem.quantity);
  if (!quantity) {
    throw httpError("Invalid custom hamper quantity", 400, "INVALID_QUANTITY");
  }

  const customHamper = cartItem.customHamper;
  if (!customHamper?.container) {
    throw httpError(
      "Custom hamper container is missing",
      409,
      "CUSTOM_HAMPER_INCOMPLETE"
    );
  }

  const container = await Container.findOne({
    _id: customHamper.container,
    isActive: true,
  })
    .select("_id name code isActive leadTimeDays")
    .lean();

  if (!container) {
    throw httpError(
      "Custom hamper box is no longer available",
      409,
      "ITEM_UNAVAILABLE"
    );
  }

  const estimate = await calculateCustomHamperDeliveryEstimate({
    containerId: customHamper.container,
    items: customHamper.items || [],
    decorations: customHamper.decorations || [],
    quantity,
    includeDetails: true,
  });
  validateEstimate(estimate, "Custom Hamper");

  return {
    itemId: cartItem._id,
    itemType: "custom_hamper",
    skuId: null,
    skuCode: "CUSTOM-HAMPER",
    name: "Custom Hamper",
    quantity,
    ...estimate,
  };
};

const summarize = ({ mode, address, pincode, itemEstimates }) => {
  const materialsReadyDate = maxDate(
    itemEstimates.map((item) => item.materialsReadyDate)
  );
  const dispatchReadyDate = maxDate(
    itemEstimates.map((item) => item.dispatchReadyDate)
  );
  const expectedDeliveryDate = maxDate(
    itemEstimates.map((item) => item.expectedDeliveryDate)
  );

  if (!expectedDeliveryDate) {
    throw httpError(
      "Expected delivery date could not be calculated",
      409,
      "DELIVERY_ESTIMATE_UNAVAILABLE"
    );
  }

  return {
    mode,
    canCheckout: true,
    addressId: address._id,
    pincode,
    city: address.city || "",
    state: address.state || "",
    materialsReadyDate,
    dispatchReadyDate,
    expectedDeliveryDate,
    deliveryDateKey: toDateKey(expectedDeliveryDate),
    itemEstimates,
    message: `Expected delivery by ${toDateKey(expectedDeliveryDate)}`,
  };
};

export const calculateCartCheckoutDelivery = async ({ userId, addressId }) => {
  const { address, pincode } = await getAddress({ userId, addressId });
  const cart = await Cart.findOne({ user: userId }).lean();

  if (!cart?.items?.length) {
    throw httpError("Your cart is empty", 400, "EMPTY_CART");
  }

  const skuItems = cart.items.filter(
    (item) => (item.itemType || "sku") === "sku"
  );
  const skuIds = skuItems.map((item) => item.sku).filter(Boolean);

  const skus = skuIds.length
    ? await SKU.find({ _id: { $in: skuIds } })
        .populate("product", "name slug status")
        .populate("container", "name code leadTimeDays")
        .lean()
    : [];

  const skuMap = new Map(skus.map((sku) => [String(sku._id), sku]));
  const itemEstimates = [];

  for (const cartItem of cart.items) {
    const itemType = cartItem.itemType || "sku";

    if (itemType === "custom_hamper") {
      itemEstimates.push(await buildCustomEstimate({ cartItem }));
      continue;
    }

    const quantity = normalizeQuantity(cartItem.quantity);
    if (!quantity) {
      throw httpError("Invalid cart quantity", 400, "INVALID_QUANTITY");
    }

    const sku = skuMap.get(String(cartItem.sku));
    requireEligibleSku(sku, { mode: "cart", itemId: cartItem._id });

    itemEstimates.push(
      await buildSkuEstimate({
        sku,
        quantity,
        itemId: cartItem._id,
      })
    );
  }

  return summarize({
    mode: "cart",
    address,
    pincode,
    itemEstimates,
  });
};

export const calculateBuyNowCheckoutDelivery = async ({
  userId,
  addressId,
  skuId,
  quantity = 1,
}) => {
  const { address, pincode } = await getAddress({ userId, addressId });

  if (!mongoose.isValidObjectId(skuId)) {
    throw httpError("Valid SKU ID is required", 400, "INVALID_SKU");
  }

  const parsedQuantity = normalizeQuantity(quantity);
  if (!parsedQuantity) {
    throw httpError(
      "Quantity must be between 1 and 99",
      400,
      "INVALID_QUANTITY"
    );
  }

  const sku = await SKU.findOne({ _id: skuId })
    .populate("product", "name slug status")
    .populate("container", "name code leadTimeDays")
    .lean();

  requireEligibleSku(sku, { mode: "buy_now" });

  const itemEstimates = [
    await buildSkuEstimate({
      sku,
      quantity: parsedQuantity,
    }),
  ];

  return summarize({
    mode: "buy_now",
    address,
    pincode,
    itemEstimates,
  });
};

export const calculateCheckoutDelivery = async ({
  mode = "cart",
  userId,
  addressId,
  skuId,
  quantity,
}) => {
  if (mode === "buy_now") {
    return calculateBuyNowCheckoutDelivery({
      userId,
      addressId,
      skuId,
      quantity,
    });
  }

  if (mode !== "cart") {
    throw httpError("Checkout mode must be cart or buy_now", 400, "INVALID_MODE");
  }

  return calculateCartCheckoutDelivery({ userId, addressId });
};
