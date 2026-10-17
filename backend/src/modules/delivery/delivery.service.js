
import mongoose from "mongoose";

import Product from "../catalog/product.model.js";
import SKU from "../catalog/sku.model.js";
import Component from "../catalog/component.model.js";
import Container from "../catalog/container.model.js";
import { PRODUCT_STATUS } from "../../constants/statuses.js";
import {
  geocodeIndianPincode,
  reverseGeocodeIndianLocation,
} from "./mapbox.service.js";

// V6: Excel Lead Time Days is the only source for delivery timing.
// No courier days, no extra assembly/personalization/packing offset, no
// date extension based on nextAvailableDate. Inventory is validated separately.
const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};
const isValidId = (value) => mongoose.isValidObjectId(value);
const idOf = (value) => value?._id || value || null;
const dayStart = (value = new Date()) => {
  // Delivery is sold in India: use the India business calendar day, not UTC
  // clock midnight (which would show yesterday from 00:00 to 05:29 IST).
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const valueOf = (type) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(valueOf("year"), valueOf("month") - 1, valueOf("day")));
};
const addDays = (date, days) => {
  const result = dayStart(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};
const validExcelDays = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 365 ? number : null;
};

// Imported ready-made SKUs from older deployments saved AH lead time in
// assemblyDays. Use that legacy mapping ONLY when explicit leadTimeDays is absent.
// In particular, a default personalization day must not become an invented ETA.
const readyMadeExcelDays = (sku) => {
  const explicit = validExcelDays(sku?.leadTimeDays);
  if (explicit !== null) return explicit;
  if (sku?.source?.type !== "product_master") return null;
  const assembly = validExcelDays(sku?.productionLeadTime?.assemblyDays);
  return assembly !== null && assembly > 0 ? assembly : null;
};

const quantityInUnit = (value, fromUnit = "pc", toUnit = "pc") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const from = String(fromUnit || "pc").toLowerCase();
  const to = String(toUnit || "pc").toLowerCase();
  if (from === to) return amount;
  const conversion = {
    "g:kg": 0.001, "kg:g": 1000, "ml:l": 0.001, "l:ml": 1000,
    "mm:cm": 0.1, "cm:mm": 10, "cm:m": 0.01, "m:cm": 100,
    "mm:m": 0.001, "m:mm": 1000,
  };
  const factor = conversion[`${from}:${to}`];
  return factor === undefined ? null : amount * factor;
};

const checkDependency = (
  source, reference, { quantity = 1, unit = "pc", stockUnit = true } = {}
) => {
  let blockingReason = null;
  if (!reference) blockingReason = "REFERENCE_NOT_FOUND";
  else if (reference.isActive === false) blockingReason = "INACTIVE";
  else {
    const availability = reference.availability || {};
    const status = availability.status || "in_stock";
    if (status !== "in_stock") blockingReason = "UNAVAILABLE";
    else if (availability.availableQuantity !== undefined &&
      availability.availableQuantity !== null && availability.availableQuantity !== "") {
      const available = Number(availability.availableQuantity);
      const required = quantityInUnit(quantity, unit,
        stockUnit ? availability.unit || "pc" : "pc");
      // Stock with incompatible units must be reviewed rather than assumed sufficient.
      if (!Number.isFinite(available) || required === null) {
        blockingReason = "STOCK_UNIT_MISMATCH";
      } else if (available < required) {
        blockingReason = "INSUFFICIENT_STOCK";
      }
    }
  }
  return {
    source,
    referenceId: reference?._id || null,
    code: reference?.code || "",
    name: reference?.name || source,
    leadTimeDays: validExcelDays(reference?.leadTimeDays),
    ready: !blockingReason,
    readyDate: blockingReason ? null : dayStart(),
    blockingReason,
  };
};

const finish = ({ dependencies, leadTimeDays, kind, includeDetails = false }) => {
  const today = dayStart();
  const blocked = dependencies.filter((dependency) => !dependency.ready);
  // Ready-made: use ONLY hamper's own Excel lead time; not its ingredients/box.
  // Custom: every required box/gift/decoration/material contributes to MAX days.
  const leadMissing = kind === "ready_made"
    ? leadTimeDays === null
    : dependencies.some((dependency) => dependency.ready && dependency.leadTimeDays === null);
  const maxDays = kind === "ready_made"
    ? leadTimeDays
    : dependencies.length
      ? Math.max(...dependencies.map((dependency) => dependency.leadTimeDays ?? 0))
      : null;
  const missing = kind === "ready_made" ? [] : dependencies.filter((d) => d.ready && d.leadTimeDays === null);
  const blockedReasons = [...new Set([
    ...blocked.map((dependency) => dependency.blockingReason).filter(Boolean),
    ...(leadMissing ? ["LEAD_TIME_MISSING"] : []),
  ])];
  const canEstimate = blocked.length === 0 && !leadMissing && maxDays !== null;
  const date = canEstimate ? addDays(today, maxDays) : null;
  return {
    status: canEstimate ? "ready" : "unavailable",
    canEstimate,
    materialsReadyDate: canEstimate ? today : null,
    productionLeadDays: maxDays,
    leadTimeDays: maxDays,
    dispatchReadyDate: date,
    expectedDeliveryDate: date,
    blockedReasons,
    ...(includeDetails ? {
      dependencies,
      blockedDependencies: [...blocked, ...missing.map((d) => ({...d, blockingReason: "LEAD_TIME_MISSING"}))],
    } : {}),
  };
};

const loadComponents = async (entries) => {
  const ids = [...new Set(entries
    .map((entry) => String(idOf(entry?.component) || ""))
    .filter(isValidId))];
  if (!ids.length) return new Map();
  const components = await Component.find({ _id: { $in: ids } })
    .select("_id code name isActive availability leadTimeDays").lean();
  return new Map(components.map((component) => [String(component._id), component]));
};

export const calculateSkuDeliveryEstimate = async (
  sku, { quantity = 1, includeDetails = false } = {}
) => {
  if (!sku) throw httpError("SKU required for delivery estimate", 400);
  const orderQuantity = Math.max(1, Number(quantity || 1));
  const dependencies = [];
  const containerId = idOf(sku.container);
  if (containerId) {
    const box = await Container.findById(containerId)
      .select("_id code name isActive availability leadTimeDays").lean();
    dependencies.push(checkDependency("container", box, { quantity: orderQuantity, stockUnit: false }));
  }
  const contents = (sku.hamperContents || []).filter((entry) => !entry.isOptional);
  const materials = sku.internalMaterials || [];
  const decorations = (sku.decorations || []).filter((entry) => !entry.isOptional);
  const componentMap = await loadComponents([...contents, ...materials, ...decorations]);
  for (const [source, entries] of [
    ["hamper_content", contents], ["internal_material", materials], ["decoration", decorations],
  ]) {
    for (const entry of entries) {
      const component = componentMap.get(String(idOf(entry.component)));
      dependencies.push(checkDependency(source, component, {
        quantity: Number(entry.quantity || 1) * orderQuantity,
        unit: entry.unit || "pc",
      }));
    }
  }
  return finish({
    kind: "ready_made",
    dependencies,
    leadTimeDays: readyMadeExcelDays(sku),
    includeDetails,
  });
};

export const calculateCustomHamperDeliveryEstimate = async ({
  containerId, items = [], decorations = [], quantity = 1, includeDetails = false,
}) => {
  if (!isValidId(containerId)) throw httpError("Valid custom hamper box is required", 400);
  const orderQuantity = Math.max(1, Number(quantity || 1));
  const container = await Container.findOne({ _id: containerId, isActive: true })
    .select("_id code name isActive availability leadTimeDays packingMaterials").lean();
  if (!container) throw httpError("Custom hamper container is unavailable", 409);
  const dependencies = [checkDependency("container", container, { quantity: orderQuantity, stockUnit: false })];
  const selections = [
    ...items.map((entry) => ({ ...entry, source: "custom_content" })),
    ...decorations.map((entry) => ({ ...entry, source: "decoration" })),
  ].map((entry) => ({
    component: entry.componentId || entry.component,
    quantity: entry.quantity,
    unit: entry.unit || "pc",
    source: entry.source,
  }));
  const packing = (container.packingMaterials || []).map((entry) => ({
    component: entry.component,
    quantity: entry.quantity,
    unit: entry.unit || "pc",
    source: "container_packing_material",
  }));
  const componentMap = await loadComponents([...selections, ...packing]);
  for (const entry of [...selections, ...packing]) {
    const component = componentMap.get(String(idOf(entry.component)));
    dependencies.push(checkDependency(entry.source, component, {
      quantity: Number(entry.quantity || 1) * orderQuantity,
      unit: entry.unit,
    }));
  }
  return finish({kind: "custom_hamper", dependencies, includeDetails});
};

export const resolveLocationFromCoordinates = async ({ latitude, longitude }) =>
  reverseGeocodeIndianLocation({ latitude, longitude });
export const resolveLocationFromPincode = async (pincode) =>
  geocodeIndianPincode(pincode);

export const checkSkuDeliveryForPincode = async ({ skuId, pincode }) => {
  if (!isValidId(skuId)) throw httpError("Invalid SKU ID", 400);
  const location = await resolveLocationFromPincode(pincode);
  if (!location) return {
    status: "unserviceable", serviceable: false, orderable: false,
    pincode, city: "", state: "", country: "India", etaAvailable: false,
    expectedDeliveryDate: null, courierVerified: false,
    message: "Could not verify delivery for this pincode.",
  };
  const sku = await SKU.findOne({_id: skuId, isActive: true}).lean();
  if (!sku) throw httpError("SKU not found", 404);
  const product = await Product.findOne({_id: sku.product, status: PRODUCT_STATUS.ACTIVE})
    .select("_id name status").lean();
  if (!product) throw httpError("Product not available", 404);
  const estimate = await calculateSkuDeliveryEstimate(sku);
  return {
    status: estimate.canEstimate ? "available" : "temporarily_unavailable",
    serviceable: true, orderable: estimate.canEstimate,
    pincode: location.pincode || pincode,
    city: location.city || "", district: location.district || "",
    state: location.state || "", country: "India", countryCode: "IN",
    expectedDeliveryDate: estimate.expectedDeliveryDate,
    etaAvailable: Boolean(estimate.expectedDeliveryDate), courierVerified: false,
    message: estimate.canEstimate ? "Delivery available" :
      estimate.blockedReasons.includes("LEAD_TIME_MISSING") ?
        "Lead Time Days missing in Excel; please contact support." :
        "A required item or box is unavailable.",
    deliveryEstimate: estimate,
  };
};
