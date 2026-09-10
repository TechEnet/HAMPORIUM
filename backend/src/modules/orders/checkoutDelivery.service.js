import mongoose from "mongoose";

import Address from "../users/address.model.js";
import Cart from "../cart/cart.model.js";
import SKU from "../catalog/sku.model.js";

import { PRODUCT_STATUS } from "../../constants/statuses.js";
import {
  calculateCustomHamperDeliveryEstimate,
  calculateSkuDeliveryEstimate,
} from "../delivery/delivery.service.js";

const INDIA_PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const httpError = (message, statusCode = 400, code = "") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const normalizeQuantity = (value) => {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;
  return quantity;
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

const validateEstimate = (estimate, label) => {
  if (!estimate?.canEstimate) {
    const reason = estimate?.blockedReasons?.[0] || "ITEM_UNAVAILABLE";
    throw httpError(
      `${label} is not currently available for checkout.`,
      409,
      reason
    );
  }

  if (!estimate.expectedDeliveryDate) {
    throw httpError(
      `Expected delivery is temporarily unavailable for ${label}. Please try again later.`,
      409,
      "COURIER_DAYS_MISSING"
    );
  }
};

const buildSkuEstimate = async ({ sku, quantity, itemId = null }) => {
  const estimate = await calculateSkuDeliveryEstimate(sku, {
    quantity,
    includeDetails: true,
  });

  const label = sku.product?.name || sku.name || sku.code || "Hamper";
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
    ? await SKU.find({ _id: { $in: skuIds }, isActive: true })
        .populate("product", "name slug status")
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
    if (
      !sku ||
      !sku.product ||
      sku.product.status !== PRODUCT_STATUS.ACTIVE
    ) {
      throw httpError(
        "One or more cart items are no longer available. Please review your cart.",
        409,
        "ITEM_UNAVAILABLE"
      );
    }

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

  const sku = await SKU.findOne({ _id: skuId, isActive: true })
    .populate("product", "name slug status")
    .lean();

  if (!sku || !sku.product || sku.product.status !== PRODUCT_STATUS.ACTIVE) {
    throw httpError(
      "This product is currently unavailable",
      409,
      "ITEM_UNAVAILABLE"
    );
  }

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
