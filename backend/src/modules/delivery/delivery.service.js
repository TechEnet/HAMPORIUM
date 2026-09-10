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

const createHttpError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidId = (value) => mongoose.isValidObjectId(value);
const getReferenceId = (value) => value?._id || value || null;

const toUtcDay = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
};

const addCalendarDays = (date, days = 0) => {
  const result = toUtcDay(date);
  if (!result) return null;
  result.setUTCDate(result.getUTCDate() + Math.max(0, Number(days || 0)));
  return result;
};

const normalizeProductionLeadTime = (leadTime = {}) => ({
  personalizationDays: Math.max(0, Number(leadTime.personalizationDays || 0)),
  assemblyDays: Math.max(0, Number(leadTime.assemblyDays || 0)),
  packingDays: Math.max(0, Number(leadTime.packingDays || 0)),
});

const parseCourierDays = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const firstConfiguredCourierDays = (...values) => {
  for (const value of values) {
    const parsed = parseCourierDays(value);
    if (parsed !== null) return parsed;
  }

  return null;
};

const getSystemDefaultCourierDays = () =>
  firstConfiguredCourierDays(
    process.env.DEFAULT_COURIER_DAYS,
    3
  );

const convertQuantity = (value, fromUnit = "pc", toUnit = "pc") => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  const from = String(fromUnit || "pc").toLowerCase();
  const to = String(toUnit || "pc").toLowerCase();
  if (from === to) return number;

  const conversions = {
    "g:kg": 1 / 1000,
    "kg:g": 1000,
    "ml:l": 1 / 1000,
    "l:ml": 1000,
    "mm:cm": 1 / 10,
    "cm:mm": 10,
    "cm:m": 1 / 100,
    "m:cm": 100,
    "mm:m": 1 / 1000,
    "m:mm": 1000,
  };

  const factor = conversions[`${from}:${to}`];
  return factor === undefined ? null : number * factor;
};

const resolveDependencyReadyDate = (
  dependency,
  today,
  { requiredQuantity = null, requiredUnit = "pc", stockUnit = true } = {}
) => {
  if (!dependency) {
    return { ready: false, readyDate: null, reason: "REFERENCE_NOT_FOUND" };
  }

  if (dependency.isActive === false) {
    return { ready: false, readyDate: null, reason: "INACTIVE" };
  }

  const availability = dependency.availability || {};
  const status = availability.status || "in_stock";
  const availableQuantity =
    availability.availableQuantity === undefined ||
    availability.availableQuantity === null ||
    availability.availableQuantity === ""
      ? null
      : Number(availability.availableQuantity);

  let enoughNow = true;

  if (
    requiredQuantity !== null &&
    availableQuantity !== null &&
    Number.isFinite(availableQuantity)
  ) {
    const targetUnit = stockUnit ? availability.unit || "pc" : "pc";
    const requiredInStockUnit = convertQuantity(
      requiredQuantity,
      requiredUnit,
      targetUnit
    );

    if (requiredInStockUnit !== null) {
      enoughNow = availableQuantity >= requiredInStockUnit;
    }
  }

  if (status === "in_stock" && enoughNow) {
    return { ready: true, readyDate: today, reason: null };
  }

  const nextAvailableDate = availability.nextAvailableDate
    ? toUtcDay(availability.nextAvailableDate)
    : null;

  if (nextAvailableDate) {
    return {
      ready: true,
      readyDate: nextAvailableDate > today ? nextAvailableDate : today,
      reason: null,
    };
  }

  if (status === "in_stock" && !enoughNow) {
    return { ready: false, readyDate: null, reason: "INSUFFICIENT_STOCK" };
  }

  if (status === "incoming" || status === "out_of_stock") {
    return {
      ready: false,
      readyDate: null,
      reason: "AVAILABILITY_DATE_UNKNOWN",
    };
  }

  return { ready: false, readyDate: null, reason: "UNAVAILABLE" };
};

const makeDependency = (
  source,
  reference,
  readyResult,
  { requiredQuantity = null, requiredUnit = null } = {}
) => ({
  source,
  referenceId: reference?._id || null,
  name: reference?.name || source,
  code: reference?.code || "",
  requiredQuantity,
  requiredUnit,
  availabilityStatus: reference?.availability?.status || null,
  availableQuantity: reference?.availability?.availableQuantity ?? null,
  availabilityUnit:
    reference?.availability?.unit || (source === "container" ? "pc" : null),
  nextAvailableDate: reference?.availability?.nextAvailableDate || null,
  ready: readyResult.ready,
  readyDate: readyResult.readyDate,
  blockingReason: readyResult.reason,
});

const finalizeDeliveryEstimate = ({
  dependencies,
  leadTime,
  courierDays,
  today = toUtcDay(new Date()),
  includeDetails = false,
}) => {
  const blocked = dependencies.filter((item) => !item.ready);
  const normalizedLeadTime = normalizeProductionLeadTime(leadTime || {});
  const productionLeadDays =
    normalizedLeadTime.personalizationDays +
    normalizedLeadTime.assemblyDays +
    normalizedLeadTime.packingDays;

  const blockedReasons = [
    ...new Set(blocked.map((item) => item.blockingReason).filter(Boolean)),
  ];

  if (blocked.length > 0) {
    return {
      status: "unavailable",
      canEstimate: false,
      materialsReadyDate: null,
      productionLeadDays,
      dispatchReadyDate: null,
      courierDays,
      expectedDeliveryDate: null,
      blockedReasons,
      ...(includeDetails
        ? { dependencies, blockedDependencies: blocked }
        : {}),
    };
  }

  const readyDates = dependencies
    .map((item) => (item.readyDate ? new Date(item.readyDate) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));

  const materialsReadyDate = new Date(
    Math.max(today.getTime(), ...readyDates.map((date) => date.getTime()))
  );
  const dispatchReadyDate = addCalendarDays(
    materialsReadyDate,
    productionLeadDays
  );
  const expectedDeliveryDate =
    courierDays === null
      ? null
      : addCalendarDays(dispatchReadyDate, courierDays);

  return {
    status: materialsReadyDate > today ? "scheduled" : "ready",
    canEstimate: true,
    materialsReadyDate,
    productionLeadDays,
    dispatchReadyDate,
    courierDays,
    expectedDeliveryDate,
    blockedReasons: [],
    ...(includeDetails
      ? { dependencies, blockedDependencies: [] }
      : {}),
  };
};

const loadComponents = async (entries = []) => {
  const ids = [
    ...new Set(
      entries
        .map((item) => String(getReferenceId(item?.component) || ""))
        .filter((id) => isValidId(id))
    ),
  ];

  if (!ids.length) return new Map();

  const components = await Component.find({ _id: { $in: ids } })
    .select("_id name code isActive availability")
    .lean();

  return new Map(components.map((component) => [String(component._id), component]));
};

export const calculateSkuDeliveryEstimate = async (
  sku,
  { quantity = 1, courierDays = undefined, includeDetails = false } = {}
) => {
  if (!sku) throw createHttpError("SKU is required for delivery estimate", 400);

  const today = toUtcDay(new Date());
  const orderQuantity = Math.max(1, Number(quantity || 1));
  const dependencies = [];
  let containerCourierDays = null;

  const containerId = getReferenceId(sku.container);
  if (containerId) {
    const container = await Container.findById(containerId)
      .select("_id name code isActive availability defaultCourierDays")
      .lean();

    containerCourierDays = container?.defaultCourierDays ?? null;

    const requiredQuantity = orderQuantity;
    const ready = resolveDependencyReadyDate(container, today, {
      requiredQuantity,
      requiredUnit: "pc",
      stockUnit: false,
    });

    dependencies.push(
      makeDependency("container", container, ready, {
        requiredQuantity,
        requiredUnit: "pc",
      })
    );
  }

  const contentEntries = Array.isArray(sku.hamperContents)
    ? sku.hamperContents.filter((item) => !item.isOptional)
    : [];
  const materialEntries = Array.isArray(sku.internalMaterials)
    ? sku.internalMaterials
    : [];

  const componentMap = await loadComponents([
    ...contentEntries,
    ...materialEntries,
  ]);

  for (const item of contentEntries) {
    const component = componentMap.get(String(getReferenceId(item.component)));
    const requiredQuantity = Number(item.quantity || 1) * orderQuantity;
    const requiredUnit = item.unit || "pc";
    const ready = resolveDependencyReadyDate(component, today, {
      requiredQuantity,
      requiredUnit,
      stockUnit: true,
    });

    dependencies.push(
      makeDependency("hamper_content", component, ready, {
        requiredQuantity,
        requiredUnit,
      })
    );
  }

  for (const item of materialEntries) {
    const component = componentMap.get(String(getReferenceId(item.component)));
    const requiredQuantity = Number(item.quantity || 1) * orderQuantity;
    const requiredUnit = item.unit || "pc";
    const ready = resolveDependencyReadyDate(component, today, {
      requiredQuantity,
      requiredUnit,
      stockUnit: true,
    });

    dependencies.push(
      makeDependency("internal_material", component, ready, {
        requiredQuantity,
        requiredUnit,
      })
    );
  }

  const resolvedCourierDays =
    courierDays === undefined
      ? firstConfiguredCourierDays(
          sku.defaultCourierDays,
          containerCourierDays,
          getSystemDefaultCourierDays()
        )
      : parseCourierDays(courierDays);

  return finalizeDeliveryEstimate({
    dependencies,
    leadTime: sku.productionLeadTime,
    courierDays: resolvedCourierDays,
    today,
    includeDetails,
  });
};

export const calculateCustomHamperDeliveryEstimate = async ({
  containerId,
  items = [],
  decorations = [],
  quantity = 1,
  includeDetails = false,
}) => {
  if (!isValidId(containerId)) {
    throw createHttpError("Valid custom hamper container is required", 400);
  }

  const today = toUtcDay(new Date());
  const orderQuantity = Math.max(1, Number(quantity || 1));
  const dependencies = [];

  const container = await Container.findOne({ _id: containerId, isActive: true })
    .select(
      "_id name code isActive availability packingMaterials productionLeadTime defaultCourierDays"
    )
    .lean();

  if (!container) {
    throw createHttpError("Custom hamper container is unavailable", 409);
  }

  const containerRequiredQuantity = orderQuantity;
  const containerReady = resolveDependencyReadyDate(container, today, {
    requiredQuantity: containerRequiredQuantity,
    requiredUnit: "pc",
    stockUnit: false,
  });

  dependencies.push(
    makeDependency("container", container, containerReady, {
      requiredQuantity: containerRequiredQuantity,
      requiredUnit: "pc",
    })
  );

  const normalizedSelections = [...items, ...decorations]
    .map((item) => ({
      component: item.componentId || item.component,
      quantity: Number(item.quantity || 1),
      unit: item.unit || "pc",
      source: decorations.includes(item) ? "decoration" : "custom_content",
    }))
    .filter((item) => item.component);

  const packingEntries = Array.isArray(container.packingMaterials)
    ? container.packingMaterials.map((item) => ({
        component: item.component,
        quantity: Number(item.quantity || 1),
        unit: item.unit || "pc",
        source: "container_packing_material",
      }))
    : [];

  const componentMap = await loadComponents([
    ...normalizedSelections,
    ...packingEntries,
  ]);

  for (const selection of normalizedSelections) {
    const component = componentMap.get(String(getReferenceId(selection.component)));
    const requiredQuantity = selection.quantity * orderQuantity;
    const ready = resolveDependencyReadyDate(component, today, {
      requiredQuantity,
      requiredUnit: selection.unit,
      stockUnit: true,
    });

    dependencies.push(
      makeDependency(selection.source, component, ready, {
        requiredQuantity,
        requiredUnit: selection.unit,
      })
    );
  }

  for (const material of packingEntries) {
    const component = componentMap.get(String(getReferenceId(material.component)));
    const requiredQuantity = material.quantity * orderQuantity;
    const ready = resolveDependencyReadyDate(component, today, {
      requiredQuantity,
      requiredUnit: material.unit,
      stockUnit: true,
    });

    dependencies.push(
      makeDependency(material.source, component, ready, {
        requiredQuantity,
        requiredUnit: material.unit,
      })
    );
  }

  return finalizeDeliveryEstimate({
    dependencies,
    leadTime: container.productionLeadTime,
    courierDays: firstConfiguredCourierDays(
      container.defaultCourierDays,
      getSystemDefaultCourierDays()
    ),
    today,
    includeDetails,
  });
};

export const resolveLocationFromCoordinates = async ({ latitude, longitude }) =>
  reverseGeocodeIndianLocation({ latitude, longitude });

export const resolveLocationFromPincode = async (pincode) =>
  geocodeIndianPincode(pincode);

export const checkSkuDeliveryForPincode = async ({ skuId, pincode }) => {
  if (!isValidId(skuId)) {
    throw createHttpError("Invalid SKU ID", 400);
  }

  const location = await resolveLocationFromPincode(pincode);
  if (!location) {
    return {
      status: "unserviceable",
      serviceable: false,
      orderable: false,
      pincode,
      city: "",
      district: "",
      state: "",
      country: "India",
      expectedDeliveryDate: null,
      etaAvailable: false,
      message: "We could not verify delivery for this pincode.",
      courierVerified: false,
    };
  }

  const sku = await SKU.findOne({ _id: skuId, isActive: true })
    .select(
      "product code name container hamperContents internalMaterials productionLeadTime defaultCourierDays isActive"
    )
    .lean();

  if (!sku) {
    throw createHttpError("SKU not found or unavailable", 404);
  }

  const product = await Product.findOne({
    _id: sku.product,
    status: PRODUCT_STATUS.ACTIVE,
  })
    .select("_id name slug status")
    .lean();

  if (!product) {
    throw createHttpError("Product is not available", 404);
  }

  const deliveryEstimate = await calculateSkuDeliveryEstimate(sku);
  const orderable = Boolean(deliveryEstimate.canEstimate);
  const etaAvailable = Boolean(deliveryEstimate.expectedDeliveryDate);

  let message = "Delivery available";
  if (!orderable) {
    message =
      "Delivery is available to this location, but this hamper is currently unavailable.";
  } else if (!etaAvailable) {
    message =
      "Delivery is available. Final delivery date will be confirmed during checkout.";
  }

  return {
    status: orderable ? "available" : "temporarily_unavailable",
    serviceable: true,
    orderable,
    pincode: location.pincode || pincode,
    city: location.city || "",
    district: location.district || "",
    state: location.state || "",
    country: location.country || "India",
    countryCode: location.countryCode || "IN",
    expectedDeliveryDate: deliveryEstimate.expectedDeliveryDate,
    etaAvailable,
    message,
    courierVerified: false,
    deliveryEstimate: {
      status: deliveryEstimate.status,
      canEstimate: deliveryEstimate.canEstimate,
      materialsReadyDate: deliveryEstimate.materialsReadyDate,
      productionLeadDays: deliveryEstimate.productionLeadDays,
      dispatchReadyDate: deliveryEstimate.dispatchReadyDate,
      courierDays: deliveryEstimate.courierDays,
      expectedDeliveryDate: deliveryEstimate.expectedDeliveryDate,
      blockedReasons: deliveryEstimate.blockedReasons,
    },
  };
};
