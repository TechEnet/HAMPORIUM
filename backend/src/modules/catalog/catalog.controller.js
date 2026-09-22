import mongoose from "mongoose";
import * as XLSX from "xlsx";

import Product from "./product.model.js";
import SKU from "./sku.model.js";
import Category from "./category.model.js";
import Collection from "./collection.model.js";
import Component from "./component.model.js";
import Container from "./container.model.js";

import asyncHandler from "../../utils/asyncHandler.js";
import { getPagination, getPaginationMeta } from "../../utils/pagination.js";
import { PRODUCT_STATUS } from "../../constants/statuses.js";
import uploadFile, { deleteFile } from "../../helpers/uploadFile.js";
import {
  calculateCatalogPricing,
  normalizeDiscountConfig,
  validateDiscountConfig,
} from "../tax/tax.service.js";

/* =========================================================
   COMMON HELPERS
========================================================= */

const isValidId = (id) => mongoose.isValidObjectId(id);

const disableCatalogCaching = (res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
};

const createSlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseBoolean = (value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];

  return [
    ...new Set(
      tags
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
};

const toPlainObject = (value) => {
  if (!value) return {};
  if (typeof value.toObject === "function") return value.toObject();
  return { ...value };
};

const getReferenceId = (value) => value?._id || value || null;

const toUtcDay = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
};

const addCalendarDays = (date, days = 0) => {
  const result = toUtcDay(date);
  if (!result) return null;
  result.setUTCDate(result.getUTCDate() + Number(days || 0));
  return result;
};

const parseCourierDays = (value, fallback = null) => {
  const source = value === undefined || value === null || value === "" ? fallback : value;

  if (source === undefined || source === null || source === "") {
    return { valid: true, value: null };
  }

  const days = Number(source);

  if (!Number.isInteger(days) || days < 0 || days > 60) {
    return {
      valid: false,
      message: "Courier days must be a whole number between 0 and 60",
    };
  }

  return { valid: true, value: days };
};

/* =========================================================
   SLUG / TAXONOMY HELPERS
========================================================= */

const ensureUniqueSlug = async (Model, source, excludeId = null) => {
  const baseSlug = createSlug(source);

  if (!baseSlug) {
    throw new Error("Unable to create a valid slug");
  }

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const filter = { slug };
    if (excludeId) filter._id = { $ne: excludeId };

    const exists = await Model.exists(filter);
    if (!exists) return slug;

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
};

const validateCategory = async (categoryId) => {
  if (!isValidId(categoryId)) return null;
  return Category.findById(categoryId);
};

const validateCollections = async (collectionIds = []) => {
  if (!Array.isArray(collectionIds)) return null;
  if (collectionIds.length === 0) return [];

  const uniqueIds = [...new Set(collectionIds.map(String))];
  if (!uniqueIds.every((id) => isValidId(id))) return null;

  const collections = await Collection.find({
    _id: { $in: uniqueIds },
  }).select("_id");

  return collections.length === uniqueIds.length ? uniqueIds : null;
};

const resolveCategoryFilter = async (value) => {
  if (!value) return null;

  if (isValidId(value)) {
    const category = await Category.findById(value).select("_id").lean();
    return category?._id || null;
  }

  const category = await Category.findOne({
    slug: String(value).trim().toLowerCase(),
  })
    .select("_id")
    .lean();

  return category?._id || null;
};

const resolveCollectionFilter = async (value) => {
  if (!value) return null;

  if (isValidId(value)) {
    const collection = await Collection.findById(value).select("_id").lean();
    return collection?._id || null;
  }

  const collection = await Collection.findOne({
    slug: String(value).trim().toLowerCase(),
  })
    .select("_id")
    .lean();

  return collection?._id || null;
};

const syncProductPriceRange = async (productId) => {
  const activeSkus = await SKU.find({ product: productId, isActive: true })
    .select("price")
    .lean();

  if (activeSkus.length === 0) {
    await Product.findByIdAndUpdate(productId, {
      minPrice: null,
      maxPrice: null,
      skuCount: 0,
    });
    return;
  }

  const prices = activeSkus.map((sku) => sku.price);

  await Product.findByIdAndUpdate(productId, {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    skuCount: activeSkus.length,
  });
};


const buildCatalogCardPricing = (skus = []) => {
  const pricedSkus = (Array.isArray(skus) ? skus : [])
    .filter((sku) => Number.isFinite(Number(sku?.price)))
    .sort((a, b) => {
      const priceDiff = Number(a.price) - Number(b.price);
      if (priceDiff !== 0) return priceDiff;

      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    });

  const sku = pricedSkus[0] || null;

  if (!sku) {
    return {
      skuId: null,
      skuCode: "",
      sellingPrice: null,
      mrp: null,
      compareAtPrice: null,
      discountAmount: 0,
      discountPercent: 0,
      hasDiscount: false,
    };
  }

  const sellingPrice = Number(sku.price);
  const mrp =
    sku.mrp !== null &&
    sku.mrp !== undefined &&
    Number.isFinite(Number(sku.mrp))
      ? Number(sku.mrp)
      : null;

  const explicitCompareAt =
    sku.compareAtPrice !== null &&
    sku.compareAtPrice !== undefined &&
    Number.isFinite(Number(sku.compareAtPrice))
      ? Number(sku.compareAtPrice)
      : null;

  const compareAtPrice =
    explicitCompareAt !== null &&
    explicitCompareAt > sellingPrice
      ? explicitCompareAt
      : mrp !== null && mrp > sellingPrice
        ? mrp
        : null;

  const discountAmount =
    compareAtPrice !== null
      ? money(compareAtPrice - sellingPrice)
      : 0;

  const discountPercent =
    compareAtPrice !== null && compareAtPrice > 0
      ? Math.round(
          ((compareAtPrice - sellingPrice) /
            compareAtPrice) *
            100
        )
      : 0;

  return {
    skuId: sku._id || null,
    skuCode: sku.code || "",
    sellingPrice,
    mrp,
    compareAtPrice,
    discountAmount,
    discountPercent,
    hasDiscount:
      compareAtPrice !== null &&
      discountPercent > 0,
  };
};

/* =========================================================
   SHARED CATALOG CONSTANTS
========================================================= */

const DIMENSION_UNITS = ["mm", "cm"];
const WEIGHT_UNITS = ["g", "kg"];
const STOCK_UNITS = ["pc", "g", "kg", "ml", "l", "mm", "cm", "m"];
const COMPONENT_TYPES = ["food", "non_food", "packaging"];
const PUBLIC_COMPONENT_TYPES = ["food", "non_food"];
const HAMPER_ROLES = ["content", "decoration"];
const AVAILABILITY_VALUES = ["in_stock", "incoming", "out_of_stock"];
const CHANNEL_KEYS = ["corporate", "wedding", "diwali", "hamperOne"];
const SOURCE_TYPES = ["manual", "product_master", "google_sheet"];

/* =========================================================
   UNIT HELPERS
========================================================= */

const dimensionToCm = (value, unit = "cm") => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return unit === "mm" ? number / 10 : number;
};

const weightToGrams = (value, unit = "g") => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return unit === "kg" ? number * 1000 : number;
};

const convertQuantity = (value, fromUnit = "pc", toUnit = "pc") => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  const from = String(fromUnit || "pc").toLowerCase();
  const to = String(toUnit || "pc").toLowerCase();

  if (from === to) return number;
  if (from === "g" && to === "kg") return number / 1000;
  if (from === "kg" && to === "g") return number * 1000;
  if (from === "ml" && to === "l") return number / 1000;
  if (from === "l" && to === "ml") return number * 1000;
  if (from === "mm" && to === "cm") return number / 10;
  if (from === "cm" && to === "mm") return number * 10;
  if (from === "cm" && to === "m") return number / 100;
  if (from === "m" && to === "cm") return number * 100;
  if (from === "mm" && to === "m") return number / 1000;
  if (from === "m" && to === "mm") return number * 1000;

  return null;
};

const optionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const validateOptionalNumber = (
  value,
  label,
  { min = 0, max = null, integer = false } = {}
) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return `${label} must be a valid number`;
  if (integer && !Number.isInteger(number)) return `${label} must be a whole number`;
  if (number < min) return `${label} must be at least ${min}`;
  if (max !== null && number > max) return `${label} cannot exceed ${max}`;
  return null;
};

const validateBooleanValue = (value, label) => {
  if (value === undefined) return null;
  return parseBoolean(value) === undefined ? `${label} must be true or false` : null;
};

const validateChannels = (channels) => {
  if (!channels) return null;

  for (const key of CHANNEL_KEYS) {
    const error = validateBooleanValue(channels[key], `channels.${key}`);
    if (error) return error;
  }

  return null;
};

const normalizeChannels = (channels = {}, current = {}) => {
  const result = {};

  for (const key of CHANNEL_KEYS) {
    const parsed = parseBoolean(channels[key]);
    result[key] = parsed === undefined ? Boolean(current?.[key]) : parsed;
  }

  return result;
};

const validateSource = (source) => {
  if (!source) return null;

  if (source.type && !SOURCE_TYPES.includes(source.type)) {
    return "Invalid source type";
  }

  for (const field of ["sourceUpdatedAt", "lastSyncedAt"]) {
    if (source[field] && Number.isNaN(new Date(source[field]).getTime())) {
      return `Invalid source.${field}`;
    }
  }

  return null;
};

const normalizeSource = (source = {}, current = {}) => ({
  type: SOURCE_TYPES.includes(source.type)
    ? source.type
    : current?.type || "manual",
  externalSku:
    source.externalSku !== undefined
      ? String(source.externalSku || "").trim()
      : current?.externalSku || "",
  sourceUpdatedAt:
    source.sourceUpdatedAt !== undefined
      ? source.sourceUpdatedAt
        ? new Date(source.sourceUpdatedAt)
        : null
      : current?.sourceUpdatedAt || null,
  lastSyncedAt:
    source.lastSyncedAt !== undefined
      ? source.lastSyncedAt
        ? new Date(source.lastSyncedAt)
        : null
      : current?.lastSyncedAt || null,
});

const hasPrice = (value) => {
  if (value === undefined || value === null || value === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
};

const money = (value) => Number(Number(value || 0).toFixed(2));

const applyPricingControlFields = (document, body, fallbackSource = "manual") => {
  if (body.taxEnabled !== undefined) {
    document.taxEnabled = parseBoolean(body.taxEnabled);
  }

  if (body.discount !== undefined) {
    document.discount = normalizeDiscountConfig(
      body.discount,
      toPlainObject(document.discount)
    );
  }

  if (body.pricingSource !== undefined) {
    document.pricingSource = SOURCE_TYPES.includes(body.pricingSource)
      ? body.pricingSource
      : fallbackSource;
  }

  if (body.taxSource !== undefined) {
    document.taxSource = SOURCE_TYPES.includes(body.taxSource)
      ? body.taxSource
      : fallbackSource;
  }
};

/* =========================================================
   COMPONENT HELPERS
========================================================= */

const normalizeDimensions = (dimensions = {}) => {
  const length = Number(dimensions.length);
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);

  return {
    length: Number.isFinite(length) ? length : null,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    unit: DIMENSION_UNITS.includes(dimensions.unit) ? dimensions.unit : "cm",
  };
};

const normalizeWeight = (weight = {}) => {
  const value = Number(weight.value);

  return {
    value: Number.isFinite(value) ? value : null,
    unit: WEIGHT_UNITS.includes(weight.unit) ? weight.unit : "g",
  };
};

const normalizeAvailability = (availability = {}, { stockUnit = true } = {}) => {
  const rawQuantity = availability.availableQuantity;
  const quantity = rawQuantity === undefined || rawQuantity === null || rawQuantity === ""
    ? null
    : Number(rawQuantity);

  const normalized = {
    status: AVAILABILITY_VALUES.includes(availability.status)
      ? availability.status
      : "in_stock",
    availableQuantity:
      quantity === null
        ? null
        : Number.isFinite(quantity) && quantity >= 0
          ? quantity
          : null,
    nextAvailableDate: availability.nextAvailableDate
      ? new Date(availability.nextAvailableDate)
      : null,
  };

  if (stockUnit) {
    normalized.unit = STOCK_UNITS.includes(availability.unit)
      ? availability.unit
      : "pc";
  }

  return normalized;
};

const validateAvailabilityPayload = (availability, { stockUnit = true, label = "availability" } = {}) => {
  if (!availability) return null;

  if (
    availability.status &&
    !AVAILABILITY_VALUES.includes(availability.status)
  ) {
    return `Invalid ${label} status`;
  }

  if (
    stockUnit &&
    availability.unit &&
    !STOCK_UNITS.includes(availability.unit)
  ) {
    return `Invalid ${label} unit`;
  }

  if (
    availability.availableQuantity !== undefined &&
    availability.availableQuantity !== null &&
    availability.availableQuantity !== ""
  ) {
    const quantity = Number(availability.availableQuantity);

    if (!Number.isFinite(quantity) || quantity < 0) {
      return `${label} quantity must be a valid non-negative number`;
    }
  }

  if (
    availability.status === "incoming" &&
    !availability.nextAvailableDate
  ) {
    return `Next available date is required when ${label} status is incoming`;
  }

  if (
    availability.nextAvailableDate &&
    Number.isNaN(new Date(availability.nextAvailableDate).getTime())
  ) {
    return `Invalid ${label} next available date`;
  }

  return null;
};

const validateComponentPayload = ({
  type,
  hamperRole = "content",
  expiryDate,
  expiryTracked,
  shelfLifeDays,
  dimensions,
  weight,
  customerSelectable,
  availability,
  channels,
  piecesPerUom,
  productPriority,
  mrp,
  sellingPrice,
  latestUnitCost,
  actualLandedCost,
  taxPercent,
  taxEnabled,
  discount,
  minGrossMarginPercent,
  moqQty,
  leadTimeDays,
  fragile,
  personalizable,
  hamperUse,
  source,
}) => {
  if (!COMPONENT_TYPES.includes(type)) return "Invalid component type";
  if (!HAMPER_ROLES.includes(hamperRole)) return "Invalid hamper role";
  if (hamperRole === "decoration" && type !== "non_food") {
    return "Decorative materials must use the non_food component type";
  }

  if (expiryDate && Number.isNaN(new Date(expiryDate).getTime())) {
    return "Invalid expiry date";
  }

  if (dimensions?.unit && !DIMENSION_UNITS.includes(dimensions.unit)) {
    return "Dimension unit must be mm or cm";
  }

  if (weight?.unit && !WEIGHT_UNITS.includes(weight.unit)) {
    return "Weight unit must be g or kg";
  }

  if (customerSelectable === true && hamperRole !== "decoration") {
    const length = Number(dimensions?.length);
    const width = Number(dimensions?.width);
    const height = Number(dimensions?.height);
    const weightValue = Number(weight?.value);

    if (
      !Number.isFinite(length) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      length <= 0 ||
      width <= 0 ||
      height <= 0
    ) {
      return "Length, width and height are required for customer-selectable components";
    }

    if (!Number.isFinite(weightValue) || weightValue <= 0) {
      return "Weight is required for customer-selectable components";
    }
  }

  if (dimensions) {
    for (const key of ["length", "width", "height"]) {
      const raw = dimensions[key];
      if (raw === undefined || raw === null || raw === "") continue;

      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        return `${key} must be a valid non-negative number`;
      }
    }
  }

  if (weight?.value !== undefined && weight?.value !== null && weight?.value !== "") {
    const value = Number(weight.value);
    if (!Number.isFinite(value) || value < 0) {
      return "Weight must be a valid non-negative number";
    }
  }

  const booleanChecks = [
    [expiryTracked, "expiryTracked"],
    [fragile, "fragile"],
    [personalizable, "personalizable"],
    [hamperUse, "hamperUse"],
    [taxEnabled, "taxEnabled"],
  ];

  for (const [value, label] of booleanChecks) {
    const error = validateBooleanValue(value, label);
    if (error) return error;
  }

  const numberChecks = [
    [piecesPerUom, "Pieces per UOM", { min: 0 }],
    [productPriority, "Product priority", { min: 0 }],
    [mrp, "MRP", { min: 0 }],
    [sellingPrice, "Selling price", { min: 0 }],
    [latestUnitCost, "Latest unit cost", { min: 0 }],
    [actualLandedCost, "Actual landed cost", { min: 0 }],
    [taxPercent, "Tax percent", { min: 0, max: 100 }],
    [minGrossMarginPercent, "Minimum gross margin percent", { min: 0, max: 100 }],
    [moqQty, "MOQ quantity", { min: 0 }],
    [leadTimeDays, "Lead time days", { min: 0 }],
    [shelfLifeDays, "Shelf life days", { min: 0 }],
  ];

  for (const [value, label, options] of numberChecks) {
    const error = validateOptionalNumber(value, label, options);
    if (error) return error;
  }

  const discountError = validateDiscountConfig(discount);
  if (discountError) return discountError;

  const channelError = validateChannels(channels);
  if (channelError) return channelError;

  const sourceError = validateSource(source);
  if (sourceError) return sourceError;

  return validateAvailabilityPayload(availability, {
    stockUnit: true,
    label: "component availability",
  });
};

const applyTextFields = (document, body, fields) => {
  for (const field of fields) {
    if (body[field] !== undefined) {
      document[field] = String(body[field] || "").trim();
    }
  }
};

const applyNumberFields = (document, body, fields) => {
  for (const field of fields) {
    if (body[field] !== undefined) {
      document[field] = optionalNumber(body[field]);
    }
  }
};

const applyComponentMasterFields = (component, body) => {
  applyTextFields(component, body, [
    "skuBarcode",
    "sizePack",
    "uom",
    "sourceProductType",
    "taxonomyBaseId",
    "categoryCode",
    "category",
    "subcategory",
    "segment",
    "dietary",
    "personalizationMethod",
    "hsnSac",
    "decorationType",
  ]);

  applyNumberFields(component, body, [
    "piecesPerUom",
    "productPriority",
    "mrp",
    "sellingPrice",
    "latestUnitCost",
    "actualLandedCost",
    "taxPercent",
    "minGrossMarginPercent",
    "moqQty",
    "leadTimeDays",
    "shelfLifeDays",
  ]);

  for (const field of [
    "fragile",
    "expiryTracked",
    "personalizable",
    "hamperUse",
    "countsTowardBoxCapacity",
  ]) {
    if (body[field] !== undefined) component[field] = parseBoolean(body[field]);
  }

  if (component.hamperRole === "decoration") {
    component.countsTowardBoxCapacity = false;
  }

  if (body.channels !== undefined) {
    component.channels = normalizeChannels(body.channels, toPlainObject(component.channels));
  }

  if (body.source !== undefined) {
    component.source = normalizeSource(body.source, toPlainObject(component.source));
  }

  applyPricingControlFields(
    component,
    body,
    component.source?.type || "manual"
  );
};

const applyContainerMasterFields = (container, body) => {
  applyTextFields(container, body, [
    "skuBarcode",
    "sourceProductType",
    "taxonomyBaseId",
    "categoryCode",
    "category",
    "subcategory",
    "segment",
    "hsnSac",
  ]);

  applyNumberFields(container, body, [
    "productPriority",
    "mrp",
    "sellingPrice",
    "latestUnitCost",
    "actualLandedCost",
    "taxPercent",
    "leadTimeDays",
  ]);

  if (body.hamperUse !== undefined) container.hamperUse = parseBoolean(body.hamperUse);

  if (body.channels !== undefined) {
    container.channels = normalizeChannels(body.channels, toPlainObject(container.channels));
  }

  if (body.source !== undefined) {
    container.source = normalizeSource(body.source, toPlainObject(container.source));
  }

  applyPricingControlFields(
    container,
    body,
    container.source?.type || "manual"
  );
};

const validateAndNormalizeMaterialItems = async (
  items = [],
  { fieldName = "internalMaterials", activeOnly = true } = {}
) => {
  if (!Array.isArray(items)) {
    return { valid: false, message: `${fieldName} must be an array` };
  }

  if (items.length === 0) return { valid: true, items: [] };

  const normalized = [];
  const ids = [];
  const seen = new Set();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const componentId = getReferenceId(item?.component);

    if (!isValidId(componentId)) {
      return {
        valid: false,
        message: `Invalid component ID in ${fieldName} at item ${index + 1}`,
      };
    }

    const id = String(componentId);
    if (seen.has(id)) {
      return {
        valid: false,
        message: `Duplicate components are not allowed in ${fieldName}`,
      };
    }

    seen.add(id);
    ids.push(id);

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        valid: false,
        message: `Quantity must be greater than 0 in ${fieldName} item ${index + 1}`,
      };
    }

    normalized.push({
      component: componentId,
      quantity,
      unit: String(item.unit || "pc").trim() || "pc",
      specification: String(item.specification || "").trim(),
      notes: String(item.notes || "").trim(),
    });
  }

  const components = await Component.find({ _id: { $in: ids } })
    .select("_id name type isActive")
    .lean();

  if (components.length !== ids.length) {
    return {
      valid: false,
      message: `One or more ${fieldName} components do not exist`,
    };
  }

  for (const component of components) {
    if (activeOnly && !component.isActive) {
      return {
        valid: false,
        message: `${component.name} is inactive and cannot be used in ${fieldName}`,
      };
    }

    if (component.type !== "packaging") {
      return {
        valid: false,
        message: `${component.name} is not a packaging component`,
      };
    }
  }

  return { valid: true, items: normalized };
};

/* =========================================================
   CONTAINER HELPERS
========================================================= */

const normalizeContainerDimensions = (dimensions = {}) => ({
  length: Number(dimensions.length),
  width: Number(dimensions.width),
  height: Number(dimensions.height),
  unit: DIMENSION_UNITS.includes(dimensions.unit) ? dimensions.unit : "cm",
});

const normalizeWeightCapacity = (weight = {}) => ({
  value: Number(weight.value),
  unit: WEIGHT_UNITS.includes(weight.unit) ? weight.unit : "kg",
});

const validateProductionLeadTime = (leadTime = {}) => {
  for (const field of ["personalizationDays", "assemblyDays", "packingDays"]) {
    const raw = leadTime[field];
    if (raw === undefined || raw === null || raw === "") continue;

    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      return `${field} must be a non-negative whole number`;
    }
  }

  return null;
};

const normalizeProductionLeadTime = (leadTime = {}) => ({
  personalizationDays: Number(leadTime.personalizationDays ?? 0),
  assemblyDays: Number(leadTime.assemblyDays ?? 0),
  packingDays: Number(leadTime.packingDays ?? 0),
});

const validateContainerPayload = ({
  outerDimensions,
  innerDimensions,
  maxContentWeight,
  usableVolumePercent,
  maxItems,
  availability,
  productionLeadTime,
  defaultCourierDays,
  channels,
  hamperUse,
  productPriority,
  mrp,
  sellingPrice,
  latestUnitCost,
  actualLandedCost,
  taxPercent,
  taxEnabled,
  discount,
  leadTimeDays,
  source,
}) => {
  for (const group of [
    { label: "Outer", data: outerDimensions },
    { label: "Inner", data: innerDimensions },
  ]) {
    if (!group.data) return `${group.label} dimensions are required`;

    if (group.data.unit && !DIMENSION_UNITS.includes(group.data.unit)) {
      return `${group.label} dimension unit must be mm or cm`;
    }

    for (const key of ["length", "width", "height"]) {
      const value = Number(group.data[key]);
      if (!Number.isFinite(value) || value <= 0) {
        return `${group.label} ${key} must be greater than 0`;
      }
    }
  }

  const outerUnit = outerDimensions.unit || "cm";
  const innerUnit = innerDimensions.unit || "cm";

  const outerLength = dimensionToCm(outerDimensions.length, outerUnit);
  const outerWidth = dimensionToCm(outerDimensions.width, outerUnit);
  const outerHeight = dimensionToCm(outerDimensions.height, outerUnit);
  const innerLength = dimensionToCm(innerDimensions.length, innerUnit);
  const innerWidth = dimensionToCm(innerDimensions.width, innerUnit);
  const innerHeight = dimensionToCm(innerDimensions.height, innerUnit);

  if (
    innerLength > outerLength ||
    innerWidth > outerWidth ||
    innerHeight > outerHeight
  ) {
    return "Inner dimensions cannot be larger than outer dimensions";
  }

  if (!maxContentWeight) return "Maximum content weight is required";

  const weightValue = Number(maxContentWeight.value);
  if (!Number.isFinite(weightValue) || weightValue <= 0) {
    return "Maximum content weight must be greater than 0";
  }

  if (maxContentWeight.unit && !WEIGHT_UNITS.includes(maxContentWeight.unit)) {
    return "Weight unit must be g or kg";
  }

  const percentage = Number(usableVolumePercent);
  if (!Number.isFinite(percentage) || percentage < 1 || percentage > 100) {
    return "Usable volume percent must be between 1 and 100";
  }

  const parsedMaxItems = Number(maxItems);
  if (!Number.isInteger(parsedMaxItems) || parsedMaxItems < 0) {
    return "Max items must be a non-negative integer";
  }

  const availabilityError = validateAvailabilityPayload(availability, {
    stockUnit: false,
    label: "container availability",
  });
  if (availabilityError) return availabilityError;

  const leadError = validateProductionLeadTime(productionLeadTime || {});
  if (leadError) return leadError;

  const courier = parseCourierDays(defaultCourierDays, null);
  if (!courier.valid) return courier.message;

  const booleanError = validateBooleanValue(hamperUse, "hamperUse");
  if (booleanError) return booleanError;

  const taxEnabledError = validateBooleanValue(taxEnabled, "taxEnabled");
  if (taxEnabledError) return taxEnabledError;

  const discountError = validateDiscountConfig(discount);
  if (discountError) return discountError;

  const numberChecks = [
    [productPriority, "Product priority", { min: 0 }],
    [mrp, "MRP", { min: 0 }],
    [sellingPrice, "Selling price", { min: 0 }],
    [latestUnitCost, "Latest unit cost", { min: 0 }],
    [actualLandedCost, "Actual landed cost", { min: 0 }],
    [taxPercent, "Tax percent", { min: 0, max: 100 }],
    [leadTimeDays, "Lead time days", { min: 0 }],
  ];

  for (const [value, label, options] of numberChecks) {
    const error = validateOptionalNumber(value, label, options);
    if (error) return error;
  }

  const channelError = validateChannels(channels);
  if (channelError) return channelError;

  const sourceError = validateSource(source);
  if (sourceError) return sourceError;

  return null;
};

const calculateContainerCapacity = (container) => {
  const dimensions = container?.innerDimensions;
  if (!dimensions) return null;

  const length = dimensionToCm(dimensions.length, dimensions.unit);
  const width = dimensionToCm(dimensions.width, dimensions.unit);
  const height = dimensionToCm(dimensions.height, dimensions.unit);

  if (![length, width, height].every(Number.isFinite)) return null;

  const totalVolume = length * width * height;
  const percentage = Number(container.usableVolumePercent);
  const usableVolume = totalVolume * (Number.isFinite(percentage) ? percentage / 100 : 0.85);

  return {
    totalVolumeCm3: Number(totalVolume.toFixed(2)),
    usableVolumeCm3: Number(usableVolume.toFixed(2)),
  };
};

const validateContainerReference = async (containerId) => {
  if (containerId === undefined || containerId === null || containerId === "") {
    return { valid: true, containerId: null };
  }

  if (!isValidId(containerId)) {
    return { valid: false, message: "Invalid container ID" };
  }

  const container = await Container.findById(containerId)
    .select("_id isActive")
    .lean();

  if (!container) return { valid: false, message: "Container not found" };
  if (!container.isActive) {
    return { valid: false, message: "Inactive container cannot be assigned to an SKU" };
  }

  return { valid: true, containerId: container._id };
};

/* =========================================================
   SKU / HAMPER HELPERS
========================================================= */

const calculateEarliestExpiryDate = async (hamperContents = []) => {
  if (!Array.isArray(hamperContents) || hamperContents.length === 0) return null;

  const componentIds = [
    ...new Set(
      hamperContents
        .map((item) => String(getReferenceId(item?.component) || ""))
        .filter((id) => isValidId(id))
    ),
  ];

  if (componentIds.length === 0) return null;

  const foodComponents = await Component.find({
    _id: { $in: componentIds },
    type: "food",
    expiryDate: { $ne: null },
  })
    .select("expiryDate")
    .lean();

  const dates = foodComponents
    .map((component) => component.expiryDate && new Date(component.expiryDate))
    .filter((date) => date && !Number.isNaN(date.getTime()));

  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((date) => date.getTime())));
};

const validateAndNormalizeHamperContents = async (items = []) => {
  if (!Array.isArray(items)) {
    return { valid: false, message: "hamperContents must be an array" };
  }

  if (items.length === 0) {
    return { valid: true, items: [], earliestExpiryDate: null };
  }

  const normalized = [];
  const ids = [];
  const seen = new Set();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const componentId = getReferenceId(item?.component);

    if (!isValidId(componentId)) {
      return {
        valid: false,
        message: `Invalid component ID in hamperContents at item ${index + 1}`,
      };
    }

    const id = String(componentId);
    if (seen.has(id)) {
      return {
        valid: false,
        message: "Duplicate components are not allowed in hamper contents",
      };
    }

    seen.add(id);
    ids.push(id);

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        valid: false,
        message: `Quantity must be greater than 0 in hamperContents item ${index + 1}`,
      };
    }

    let isOptional = false;
    if (item.isOptional !== undefined) {
      const parsed = parseBoolean(item.isOptional);
      if (parsed === undefined) {
        return {
          valid: false,
          message: `isOptional must be true or false in hamperContents item ${index + 1}`,
        };
      }
      isOptional = parsed;
    }

    const sortOrder = item.sortOrder !== undefined ? Number(item.sortOrder) : index;
    if (!Number.isFinite(sortOrder)) {
      return {
        valid: false,
        message: `Invalid sortOrder in hamperContents item ${index + 1}`,
      };
    }

    normalized.push({
      component: componentId,
      quantity,
      unit: String(item.unit || "pc").trim() || "pc",
      displayName: String(item.displayName || "").trim(),
      sortOrder,
      isOptional,
    });
  }

  const components = await Component.find({ _id: { $in: ids } })
    .select("_id name type hamperRole expiryDate isActive")
    .lean();

  if (components.length !== ids.length) {
    return {
      valid: false,
      message: "One or more hamper content components do not exist",
    };
  }

  for (const component of components) {
    if (!component.isActive) {
      return {
        valid: false,
        message: `${component.name} is inactive and cannot be added to hamper contents`,
      };
    }

    if (component.type === "packaging") {
      return {
        valid: false,
        message: `${component.name} is a packaging component and cannot be added to customer-facing hamper contents`,
      };
    }

    if ((component.hamperRole || "content") === "decoration") {
      return {
        valid: false,
        message: `${component.name} is a decoration and must be stored in the separate decorations field`,
      };
    }
  }

  const expiryDates = components
    .filter((component) => component.type === "food" && component.expiryDate)
    .map((component) => new Date(component.expiryDate))
    .filter((date) => !Number.isNaN(date.getTime()));

  return {
    valid: true,
    items: normalized,
    earliestExpiryDate:
      expiryDates.length > 0
        ? new Date(Math.min(...expiryDates.map((date) => date.getTime())))
        : null,
  };
};

const validateAndNormalizeDecorations = async (items = []) => {
  if (!Array.isArray(items)) {
    return { valid: false, message: "decorations must be an array" };
  }

  if (items.length === 0) {
    return { valid: true, items: [] };
  }

  const normalized = [];
  const ids = [];
  const seen = new Set();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const componentId = getReferenceId(item?.component);

    if (!isValidId(componentId)) {
      return {
        valid: false,
        message: `Invalid component ID in decorations at item ${index + 1}`,
      };
    }

    const id = String(componentId);
    if (seen.has(id)) {
      return {
        valid: false,
        message: "Duplicate components are not allowed in decorations",
      };
    }

    seen.add(id);
    ids.push(id);

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        valid: false,
        message: `Quantity must be greater than 0 in decorations item ${index + 1}`,
      };
    }

    let isOptional = false;
    if (item.isOptional !== undefined) {
      const parsed = parseBoolean(item.isOptional);
      if (parsed === undefined) {
        return {
          valid: false,
          message: `isOptional must be true or false in decorations item ${index + 1}`,
        };
      }
      isOptional = parsed;
    }

    const sortOrder = item.sortOrder !== undefined ? Number(item.sortOrder) : index;
    if (!Number.isFinite(sortOrder)) {
      return {
        valid: false,
        message: `Invalid sortOrder in decorations item ${index + 1}`,
      };
    }

    normalized.push({
      component: componentId,
      quantity,
      unit: String(item.unit || "pc").trim() || "pc",
      displayName: String(item.displayName || "").trim(),
      sortOrder,
      isOptional,
    });
  }

  const components = await Component.find({ _id: { $in: ids } })
    .select("_id name type hamperRole isActive customerSelectable")
    .lean();

  if (components.length !== ids.length) {
    return { valid: false, message: "One or more decoration components do not exist" };
  }

  for (const component of components) {
    if (!component.isActive) {
      return {
        valid: false,
        message: `${component.name} is inactive and cannot be used as a decoration`,
      };
    }

    if ((component.hamperRole || "content") !== "decoration") {
      return {
        valid: false,
        message: `${component.name} is not configured as a decoration`,
      };
    }
  }

  return { valid: true, items: normalized };
};

const syncSkuExpiryForComponent = async (componentId) => {
  const skus = await SKU.find({
    "hamperContents.component": componentId,
  }).select("_id hamperContents earliestExpiryDate");

  for (const sku of skus) {
    sku.earliestExpiryDate = await calculateEarliestExpiryDate(sku.hamperContents);
    await sku.save();
  }
};

/* =========================================================
   AVAILABILITY / ETA ENGINE
========================================================= */

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
  availabilityUnit: reference?.availability?.unit || (source === "container" ? "pc" : null),
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

  if (blocked.length > 0) {
    const result = {
      status: "unavailable",
      canEstimate: false,
      materialsReadyDate: null,
      productionLeadDays,
      dispatchReadyDate: null,
      courierDays,
      expectedDeliveryDate: null,
    };

    if (includeDetails) {
      result.dependencies = dependencies;
      result.blockedDependencies = blocked;
    }

    return result;
  }

  const readyDates = dependencies
    .map((item) => item.readyDate && new Date(item.readyDate))
    .filter((date) => date && !Number.isNaN(date.getTime()));

  const materialsReadyDate = new Date(
    Math.max(today.getTime(), ...readyDates.map((date) => date.getTime()))
  );

  const dispatchReadyDate = addCalendarDays(materialsReadyDate, productionLeadDays);
  const expectedDeliveryDate =
    courierDays === null ? null : addCalendarDays(dispatchReadyDate, courierDays);

  const result = {
    status: materialsReadyDate > today ? "scheduled" : "ready",
    canEstimate: true,
    materialsReadyDate,
    productionLeadDays,
    dispatchReadyDate,
    courierDays,
    expectedDeliveryDate,
  };

  if (includeDetails) {
    result.dependencies = dependencies;
    result.blockedDependencies = [];
  }

  return result;
};

const calculateSkuDeliveryEstimate = async (
  sku,
  { courierDays = null, includeDetails = false } = {}
) => {
  const today = toUtcDay(new Date());
  const dependencies = [];

  const containerId = getReferenceId(sku.container);
  if (containerId) {
    const container = await Container.findById(containerId)
      .select("_id name code isActive availability")
      .lean();

    const ready = resolveDependencyReadyDate(container, today, {
      requiredQuantity: 1,
      requiredUnit: "pc",
      stockUnit: false,
    });

    dependencies.push(
      makeDependency("container", container, ready, {
        requiredQuantity: 1,
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

  const decorationEntries = Array.isArray(sku.decorations)
    ? sku.decorations.filter((item) => !item.isOptional)
    : [];

  const componentIds = [
    ...new Set(
      [...contentEntries, ...materialEntries, ...decorationEntries]
        .map((item) => String(getReferenceId(item.component) || ""))
        .filter((id) => isValidId(id))
    ),
  ];

  const components = componentIds.length
    ? await Component.find({ _id: { $in: componentIds } })
        .select("_id name code isActive availability")
        .lean()
    : [];

  const componentMap = new Map(
    components.map((component) => [String(component._id), component])
  );

  for (const item of contentEntries) {
    const component = componentMap.get(String(getReferenceId(item.component)));
    const ready = resolveDependencyReadyDate(component, today, {
      requiredQuantity: item.quantity,
      requiredUnit: item.unit || "pc",
      stockUnit: true,
    });

    dependencies.push(
      makeDependency("hamper_content", component, ready, {
        requiredQuantity: item.quantity,
        requiredUnit: item.unit || "pc",
      })
    );
  }

  for (const item of materialEntries) {
    const component = componentMap.get(String(getReferenceId(item.component)));
    const ready = resolveDependencyReadyDate(component, today, {
      requiredQuantity: item.quantity,
      requiredUnit: item.unit || "pc",
      stockUnit: true,
    });

    dependencies.push(
      makeDependency("internal_material", component, ready, {
        requiredQuantity: item.quantity,
        requiredUnit: item.unit || "pc",
      })
    );
  }

  for (const item of decorationEntries) {
    const component = componentMap.get(String(getReferenceId(item.component)));
    const ready = resolveDependencyReadyDate(component, today, {
      requiredQuantity: item.quantity,
      requiredUnit: item.unit || "pc",
      stockUnit: true,
    });

    dependencies.push(
      makeDependency("decoration", component, ready, {
        requiredQuantity: item.quantity,
        requiredUnit: item.unit || "pc",
      })
    );
  }

  return finalizeDeliveryEstimate({
    dependencies,
    leadTime: sku.productionLeadTime,
    courierDays,
    today,
    includeDetails,
  });
};

/* =========================================================
   3D CUSTOM HAMPER CAPACITY ENGINE
========================================================= */

const getComponentPhysicalData = (component) => {
  const dimensions = component?.dimensions || {};
  const length = dimensionToCm(dimensions.length, dimensions.unit);
  const width = dimensionToCm(dimensions.width, dimensions.unit);
  const height = dimensionToCm(dimensions.height, dimensions.unit);
  const weight = weightToGrams(component?.weight?.value, component?.weight?.unit);

  if (
    ![length, width, height, weight].every(Number.isFinite) ||
    length <= 0 ||
    width <= 0 ||
    height <= 0 ||
    weight <= 0
  ) {
    return null;
  }

  return {
    length,
    width,
    height,
    weightGrams: weight,
    volumeCm3: length * width * height,
  };
};

const uniqueOrientations = ({ length, width, height }) => {
  const permutations = [
    [length, width, height],
    [length, height, width],
    [width, length, height],
    [width, height, length],
    [height, length, width],
    [height, width, length],
  ];

  const seen = new Set();
  const result = [];

  for (const [l, w, h] of permutations) {
    const key = `${l}|${w}|${h}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ length: l, width: w, height: h });
  }

  return result;
};

const boxCanFitOne = (box, item) =>
  uniqueOrientations(item).some(
    (orientation) =>
      orientation.length <= box.length + 1e-9 &&
      orientation.width <= box.width + 1e-9 &&
      orientation.height <= box.height + 1e-9
  );

const pruneSpaces = (spaces) =>
  spaces.filter(
    (space) => space.length > 1e-9 && space.width > 1e-9 && space.height > 1e-9
  );

const packRectangles = (box, instances) => {
  const sorted = [...instances].sort((a, b) => b.volumeCm3 - a.volumeCm3);
  let spaces = [{ ...box }];
  const placements = [];

  for (const instance of sorted) {
    let best = null;

    for (let spaceIndex = 0; spaceIndex < spaces.length; spaceIndex += 1) {
      const space = spaces[spaceIndex];
      const spaceVolume = space.length * space.width * space.height;

      for (const orientation of uniqueOrientations(instance)) {
        if (
          orientation.length <= space.length + 1e-9 &&
          orientation.width <= space.width + 1e-9 &&
          orientation.height <= space.height + 1e-9
        ) {
          const itemVolume = orientation.length * orientation.width * orientation.height;
          const score = spaceVolume - itemVolume;

          if (!best || score < best.score) {
            best = { spaceIndex, space, orientation, score };
          }
        }
      }
    }

    if (!best) {
      return {
        fits: false,
        failedItem: instance,
        placements,
      };
    }

    const { space, orientation, spaceIndex } = best;
    spaces.splice(spaceIndex, 1);

    const { length: l, width: w, height: h } = orientation;

    spaces.push(
      {
        length: space.length - l,
        width: space.width,
        height: space.height,
      },
      {
        length: l,
        width: space.width - w,
        height: space.height,
      },
      {
        length: l,
        width: w,
        height: space.height - h,
      }
    );

    spaces = pruneSpaces(spaces);
    placements.push({ componentId: instance.componentId, orientation });
  }

  return { fits: true, placements };
};

const configurationReasonMessage = (reason) => {
  const map = {
    INVALID_COMPONENT_DATA: "Product physical dimensions or weight are missing",
    DIMENSION_NOT_FIT: "Product dimensions do not fit this box",
    MAX_ITEMS_EXCEEDED: "Box item-count capacity exceeded",
    USABLE_VOLUME_EXCEEDED: "Not enough usable box space",
    WEIGHT_EXCEEDED: "Selected products exceed the box weight capacity",
    PACKING_LAYOUT_NOT_FIT: "Products cannot be arranged inside the remaining box space",
    UNAVAILABLE: "Product is currently unavailable with no known restock date",
    PRICE_NOT_SET: "Selling price has not been configured for this item",
  };

  return map[reason] || "Configuration is not valid";
};

const evaluatePhysicalConfiguration = (container, selections, componentMap) => {
  const inner = container.innerDimensions;
  const box = {
    length: dimensionToCm(inner.length, inner.unit),
    width: dimensionToCm(inner.width, inner.unit),
    height: dimensionToCm(inner.height, inner.unit),
  };

  const boxCapacity = calculateContainerCapacity(container);
  const maxWeightGrams = weightToGrams(
    container.maxContentWeight?.value,
    container.maxContentWeight?.unit
  );
  const maxItems = Number(container.maxItems || 0);

  const instances = [];
  let itemCount = 0;
  let usedVolumeCm3 = 0;
  let usedWeightGrams = 0;

  for (const selection of selections) {
    const component = componentMap.get(String(selection.componentId));
    const physical = getComponentPhysicalData(component);

    if (!physical) {
      return {
        valid: false,
        reason: "INVALID_COMPONENT_DATA",
        componentId: selection.componentId,
      };
    }

    if (!boxCanFitOne(box, physical)) {
      return {
        valid: false,
        reason: "DIMENSION_NOT_FIT",
        componentId: selection.componentId,
      };
    }

    itemCount += selection.quantity;
    usedVolumeCm3 += physical.volumeCm3 * selection.quantity;
    usedWeightGrams += physical.weightGrams * selection.quantity;

    for (let i = 0; i < selection.quantity; i += 1) {
      instances.push({
        componentId: selection.componentId,
        ...physical,
      });
    }
  }

  if (maxItems > 0 && itemCount > maxItems) {
    return { valid: false, reason: "MAX_ITEMS_EXCEEDED" };
  }

  if (usedVolumeCm3 > boxCapacity.usableVolumeCm3 + 1e-9) {
    return { valid: false, reason: "USABLE_VOLUME_EXCEEDED" };
  }

  if (usedWeightGrams > maxWeightGrams + 1e-9) {
    return { valid: false, reason: "WEIGHT_EXCEEDED" };
  }

  const packing = packRectangles(box, instances);
  if (!packing.fits) {
    return {
      valid: false,
      reason: "PACKING_LAYOUT_NOT_FIT",
      componentId: packing.failedItem?.componentId || null,
    };
  }

  return {
    valid: true,
    reason: null,
    itemCount,
    capacity: {
      usedVolumeCm3: Number(usedVolumeCm3.toFixed(2)),
      usableVolumeCm3: boxCapacity.usableVolumeCm3,
      remainingVolumeCm3: Number(
        Math.max(0, boxCapacity.usableVolumeCm3 - usedVolumeCm3).toFixed(2)
      ),
      usedWeightGrams: Number(usedWeightGrams.toFixed(2)),
      maxWeightGrams: Number(maxWeightGrams.toFixed(2)),
      remainingWeightGrams: Number(
        Math.max(0, maxWeightGrams - usedWeightGrams).toFixed(2)
      ),
      itemCount,
      maxItems: maxItems || null,
    },
    packing,
  };
};

const normalizeConfigurationItems = (items = []) => {
  if (!Array.isArray(items)) {
    return { valid: false, message: "items must be an array" };
  }

  const merged = new Map();

  for (let index = 0; index < items.length; index += 1) {
    const rawId = items[index]?.componentId || items[index]?.component;
    const componentId = String(rawId || "");
    const quantity = Number(items[index]?.quantity ?? 1);

    if (!isValidId(componentId)) {
      return {
        valid: false,
        message: `Invalid component ID at item ${index + 1}`,
      };
    }

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
      return {
        valid: false,
        message: `Configuration quantity must be a whole number between 1 and 100 at item ${index + 1}`,
      };
    }

    merged.set(componentId, (merged.get(componentId) || 0) + quantity);
  }

  return {
    valid: true,
    items: [...merged.entries()].map(([componentId, quantity]) => ({
      componentId,
      quantity,
    })),
  };
};

const calculateConfigurationPricing = (
  container,
  selections,
  componentMap,
  decorationSelections = []
) => {
  const missingPrices = [];

  const containerPricing = hasPrice(container?.sellingPrice)
    ? calculateCatalogPricing({
        baseSellingPrice: container.sellingPrice,
        taxPercent: container.taxPercent ?? 0,
        taxEnabled: container.taxEnabled !== false,
        discount: container.discount || {},
      })
    : null;

  if (!containerPricing) {
    missingPrices.push({
      type: "container",
      referenceId: container?._id || null,
      name: container?.name || "Container",
      code: container?.code || "",
    });
  }

  const buildLines = (source, role) =>
    source.map((selection) => {
      const component = componentMap.get(String(selection.componentId));
      const pricing = hasPrice(component?.sellingPrice)
        ? calculateCatalogPricing({
            baseSellingPrice: component.sellingPrice,
            taxPercent: component.taxPercent ?? 0,
            taxEnabled: component.taxEnabled !== false,
            discount: component.discount || {},
          })
        : null;

      if (!pricing) {
        missingPrices.push({
          type: role === "decoration" ? "decoration" : "component",
          referenceId: component?._id || selection.componentId,
          name: component?.name || "Component",
          code: component?.code || "",
        });
      }

      return {
        componentId: selection.componentId,
        name: component?.name || "",
        code: component?.code || "",
        hamperRole: role,
        quantity: selection.quantity,
        baseUnitPrice: pricing?.baseSellingPrice ?? null,
        discount: pricing?.discount || null,
        discountAmount: pricing?.discountAmount ?? null,
        taxableUnitPrice: pricing?.taxableValue ?? null,
        taxPercent: pricing?.taxPercent ?? null,
        taxAmount: pricing?.taxAmount ?? null,
        hsnSac: component?.hsnSac || "",
        unitPrice: pricing?.price ?? null,
        lineTotal:
          pricing === null ? null : money(pricing.price * selection.quantity),
      };
    });

  const itemLines = buildLines(selections, "content");
  const decorationLines = buildLines(decorationSelections, "decoration");

  const itemsTotal = itemLines.every((line) => line.lineTotal !== null)
    ? money(itemLines.reduce((total, line) => total + line.lineTotal, 0))
    : null;

  const decorationsTotal = decorationLines.every((line) => line.lineTotal !== null)
    ? money(decorationLines.reduce((total, line) => total + line.lineTotal, 0))
    : null;

  const total =
    containerPricing !== null &&
    itemsTotal !== null &&
    decorationsTotal !== null
      ? money(containerPricing.price + itemsTotal + decorationsTotal)
      : null;

  return {
    complete: missingPrices.length === 0,
    currency: "INR",
    containerBasePrice: containerPricing?.baseSellingPrice ?? null,
    containerDiscount: containerPricing?.discount || null,
    containerDiscountAmount: containerPricing?.discountAmount ?? null,
    containerTaxPercent: containerPricing?.taxPercent ?? null,
    containerTaxAmount: containerPricing?.taxAmount ?? null,
    containerHsnSac: container?.hsnSac || "",
    containerPrice: containerPricing?.price ?? null,
    itemsTotal,
    decorationsTotal,
    total,
    items: itemLines,
    decorations: decorationLines,
    missingPrices,
  };
};

const calculateCustomConfigurationEta = async (
  container,
  selections,
  componentMap,
  courierDays,
  decorationSelections = []
) => {
  const today = toUtcDay(new Date());
  const dependencies = [];

  const containerReady = resolveDependencyReadyDate(container, today, {
    requiredQuantity: 1,
    requiredUnit: "pc",
    stockUnit: false,
  });

  dependencies.push(
    makeDependency("container", container, containerReady, {
      requiredQuantity: 1,
      requiredUnit: "pc",
    })
  );

  for (const selection of selections) {
    const component = componentMap.get(String(selection.componentId));
    const ready = resolveDependencyReadyDate(component, today, {
      requiredQuantity: selection.quantity,
      requiredUnit: "pc",
      stockUnit: true,
    });

    dependencies.push(
      makeDependency("selected_component", component, ready, {
        requiredQuantity: selection.quantity,
        requiredUnit: "pc",
      })
    );
  }

  for (const selection of decorationSelections) {
    const component = componentMap.get(String(selection.componentId));
    const ready = resolveDependencyReadyDate(component, today, {
      requiredQuantity: selection.quantity,
      requiredUnit: "pc",
      stockUnit: true,
    });

    dependencies.push(
      makeDependency("decorative_component", component, ready, {
        requiredQuantity: selection.quantity,
        requiredUnit: "pc",
      })
    );
  }

  const packingMaterials = Array.isArray(container.packingMaterials)
    ? container.packingMaterials
    : [];

  if (packingMaterials.length > 0) {
    const ids = packingMaterials
      .map((item) => String(getReferenceId(item.component) || ""))
      .filter((id) => isValidId(id));

    const materials = await Component.find({ _id: { $in: ids } })
      .select("_id name code isActive availability")
      .lean();

    const materialMap = new Map(
      materials.map((component) => [String(component._id), component])
    );

    for (const item of packingMaterials) {
      const component = materialMap.get(String(getReferenceId(item.component)));
      const ready = resolveDependencyReadyDate(component, today, {
        requiredQuantity: item.quantity,
        requiredUnit: item.unit || "pc",
        stockUnit: true,
      });

      dependencies.push(
        makeDependency("packing_material", component, ready, {
          requiredQuantity: item.quantity,
          requiredUnit: item.unit || "pc",
        })
      );
    }
  }

  return finalizeDeliveryEstimate({
    dependencies,
    leadTime: container.productionLeadTime,
    courierDays,
    today,
    includeDetails: false,
  });
};

/* =========================================================
   PRODUCT MASTER EXCEL IMPORT HELPERS
========================================================= */

const PRODUCT_MASTER_SHEET = "Product Master";
const HAMPER_COMPOSITION_SHEET = "Hamper Composition";
const CONTAINER_SETUP_SHEET = "HAMPORIUM Container Setup";
const DECORATION_MASTER_SHEET = "Decoration Master";

const normalizeMasterHeader = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const normalizeMasterRow = (row = {}) => {
  const normalized = {};

  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeMasterHeader(key)] = value;
  }

  return normalized;
};

const getMasterValue = (row, aliases = []) => {
  for (const alias of aliases) {
    const key = normalizeMasterHeader(alias);
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }

  return null;
};

const masterText = (row, aliases = []) => {
  const value = getMasterValue(row, aliases);
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const masterNumber = (row, aliases, label, errors) => {
  const raw = getMasterValue(row, aliases);

  if (raw === undefined || raw === null || raw === "") return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    errors.push(`${label} must be numeric`);
    return null;
  }

  return value;
};

const masterBoolean = (row, aliases, fallback = false) => {
  const raw = getMasterValue(row, aliases);
  if (raw === undefined || raw === null || raw === "") return fallback;

  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;

  const value = String(raw).trim().toLowerCase();

  if (["yes", "y", "true", "1", "active"].includes(value)) return true;
  if (["no", "n", "false", "0", "inactive"].includes(value)) return false;

  return fallback;
};

const masterDate = (row, aliases, label, errors) => {
  const raw = getMasterValue(row, aliases);
  if (raw === undefined || raw === null || raw === "") return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;

  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      return new Date(
        Date.UTC(
          parsed.y,
          parsed.m - 1,
          parsed.d,
          parsed.H || 0,
          parsed.M || 0,
          Math.floor(parsed.S || 0)
        )
      );
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${label} is not a valid date`);
    return null;
  }

  return date;
};

const masterStatusActive = (row) => {
  const status = masterText(row, ["Status"]).toLowerCase();

  if (!status) return true;
  if (["inactive", "archived", "disabled", "discontinued"].includes(status)) {
    return false;
  }

  return true;
};

const getMasterRecordType = (row) => {
  const productType = masterText(row, ["Product Type"]).toLowerCase();
  const recordType = masterText(row, ["Record Type"]).toLowerCase();

  if (productType.includes("container") || recordType.includes("container")) {
    return "container";
  }

  if (
    (productType.includes("hamper") || recordType.includes("hamper")) &&
    !productType.includes("packaging material")
  ) {
    return "ready_made_hamper";
  }

  return "component";
};

const getMasterBuilderSection = (row) =>
  masterText(row, ["Builder Section", "Builder Area", "Custom Builder Section"])
    .trim()
    .toLowerCase();

const isMasterDecorationRow = (row, decorationMasterEntry = null) => {
  const builderSection = getMasterBuilderSection(row);
  const decorationType =
    masterText(row, ["Decoration Type"]) || decorationMasterEntry?.decorationType || "";
  const selectable = masterBoolean(
    row,
    ["Decoration Selectable?", "Decoration Selectable"],
    decorationMasterEntry?.customerSelectable === true
  );

  return (
    builderSection.includes("decoration") ||
    Boolean(decorationType) ||
    selectable === true
  );
};

const getMasterComponentType = (row, { decoration = false } = {}) => {
  if (decoration) return "non_food";

  const productType = masterText(row, ["Product Type"]).toLowerCase();
  const category = masterText(row, ["Category"]).toLowerCase();
  const taxonomy = masterText(row, ["Taxonomy Base ID (Auto)", "Taxonomy Base ID"])
    .toLowerCase();

  if (
    productType.includes("packaging material") ||
    category === "packaging"
  ) {
    return "packaging";
  }

  if (category === "food" || taxonomy.startsWith("food-")) {
    return "food";
  }

  return "non_food";
};

const setMasterField = (target, key, value) => {
  if (value === undefined || value === null || value === "") return;
  target[key] = value;
};

const validPositiveDimensions = (dimensions) =>
  dimensions &&
  [dimensions.length, dimensions.width, dimensions.height].every(
    (value) => Number.isFinite(Number(value)) && Number(value) > 0
  );

const validPositiveWeight = (weight) =>
  weight &&
  Number.isFinite(Number(weight.value)) &&
  Number(weight.value) > 0 &&
  WEIGHT_UNITS.includes(weight.unit || "kg");

const normalizeExternalSkuKey = (value) => String(value || "").trim();
const normalizeCodeKey = (value) => String(value || "").trim().toUpperCase();

const buildMasterCommonFields = (row, errors) => {
  const externalSku = masterText(row, [
    "Product SKU (10 digits numeric — immutable)",
    "Product SKU",
    "SKU",
  ]);

  const name = masterText(row, ["Product Name", "Name"]);
  const brand = masterText(row, ["Brand Name", "Brand"]);
  const skuBarcode = masterText(row, [
    "SKU Barcode",
    "Barcode / GTIN (Editable)",
    "Barcode / GTIN",
  ]);
  const sizePack = masterText(row, [
    "Size/Pack",
    "Size Option (Required — immutable after SKU)",
    "Size Option",
  ]);
  const uom = masterText(row, ["UOM"]);
  const sourceProductType = masterText(row, ["Product Type"]);
  const taxonomyBaseId = masterText(row, [
    "Taxonomy Base ID (Auto)",
    "Taxonomy Base ID",
  ]);
  const categoryCode = masterText(row, [
    "Category Code (3 digits)",
    "Category Code",
  ]);
  const category = masterText(row, ["Category"]);
  const subcategory = masterText(row, ["Subcategory"]);
  const segment = masterText(row, ["Segment"]);
  const hsnSac = masterText(row, ["HSN/SAC"]);
  const imageUrl = masterText(row, ["Image / Asset URL", "Image URL"]);
  const internalNotes = masterText(row, ["Notes"]);
  const personalizationMethod = masterText(row, ["Personalization Method"]);
  const dietary = masterText(row, ["Dietary"]);

  const piecesPerUom = masterNumber(
    row,
    ["Pieces per UOM", "Case Pack Qty"],
    "Pieces per UOM / Case Pack Qty",
    errors
  );
  const productPriority = masterNumber(row, ["Product Priority"], "Product Priority", errors);
  const mrp = masterNumber(row, ["Retail MRP"], "Retail MRP", errors);
  const sellingPrice = masterNumber(row, ["Target Sell Price"], "Target Sell Price", errors);
  const latestUnitCost = masterNumber(row, ["Latest Unit Cost"], "Latest Unit Cost", errors);
  const actualLandedCost = masterNumber(row, ["Actual Landed Cost"], "Actual Landed Cost", errors);
  const taxPercent = masterNumber(row, ["Tax %"], "Tax %", errors);
  const minGrossMarginPercent = masterNumber(
    row,
    ["Min Gross Margin %"],
    "Min Gross Margin %",
    errors
  );
  const moqQty = masterNumber(row, ["MOQ Qty"], "MOQ Qty", errors);
  const leadTimeDays = masterNumber(row, ["Lead Time Days"], "Lead Time Days", errors);
  const shelfLifeDays = masterNumber(row, ["Shelf Life Days"], "Shelf Life Days", errors);
  const expiryDate = masterDate(
    row,
    [
      "Expiry Date",
      "Best Before Date",
      "Batch Expiry Date",
      "Product Expiry Date",
      "Expiry / Best Before Date",
      "Use By Date",
    ],
    "Expiry Date",
    errors
  );
  const width = masterNumber(row, ["Product Width cm"], "Product Width cm", errors);
  const length = masterNumber(row, ["Product Length cm"], "Product Length cm", errors);
  const height = masterNumber(row, ["Product Height cm"], "Product Height cm", errors);
  const weightKg = masterNumber(
    row,
    ["Net Product Weight kg"],
    "Net Product Weight kg",
    errors
  );

  const sourceUpdatedAt = masterDate(
    row,
    ["Last Updated Date & Time", "Last Updated Date", "Updated At"],
    "Last Updated Date & Time",
    errors
  );

  return {
    externalSku,
    name,
    brand,
    skuBarcode,
    sizePack,
    uom,
    sourceProductType,
    taxonomyBaseId,
    categoryCode,
    category,
    subcategory,
    segment,
    hsnSac,
    imageUrl,
    internalNotes,
    personalizationMethod,
    dietary,
    piecesPerUom,
    productPriority,
    mrp,
    sellingPrice,
    latestUnitCost,
    actualLandedCost,
    taxPercent,
    minGrossMarginPercent,
    moqQty,
    leadTimeDays,
    shelfLifeDays,
    expiryDate,
    dimensions:
      [length, width, height].some((value) => value !== null)
        ? { length, width, height, unit: "cm" }
        : null,
    weight: weightKg === null ? null : { value: weightKg, unit: "kg" },
    fragile: masterBoolean(row, ["Fragile?"], false),
    expiryTracked: masterBoolean(row, ["Expiry Tracked?"], false),
    personalizable: masterBoolean(row, ["Personalizable?"], false),
    hamperUse: masterBoolean(row, ["Hamper Use"], false),
    channels: {
      corporate: masterBoolean(row, ["Corporate?"], false),
      wedding: masterBoolean(row, ["Wedding?"], false),
      diwali: masterBoolean(row, ["Diwali?"], false),
      hamperOne: masterBoolean(row, ["HAMPER ONE?", "Hamper One?"], false),
    },
    isActive: masterStatusActive(row),
    sourceUpdatedAt,
  };
};

const findWorkbookSheet = (workbook, names = []) =>
  workbook.SheetNames.find((sheetName) =>
    names.some(
      (candidate) =>
        normalizeMasterHeader(sheetName) === normalizeMasterHeader(candidate)
    )
  );

const parseContainerSetupSheet = (workbook) => {
  const sheetName = findWorkbookSheet(workbook, [
    CONTAINER_SETUP_SHEET,
    "Container Setup",
    "Box Setup",
  ]);

  if (!sheetName) {
    return { sheetName: null, bySku: new Map(), errors: [] };
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: null,
    raw: true,
  });

  const bySku = new Map();
  const errors = [];

  rows.map(normalizeMasterRow).forEach((row, index) => {
    const rowNumber = index + 2;
    const sku = masterText(row, ["Container SKU", "Product SKU", "SKU"]);
    if (!sku) return;

    if (bySku.has(sku)) {
      errors.push(`${CONTAINER_SETUP_SHEET} row ${rowNumber} duplicates Container SKU ${sku}`);
      return;
    }

    const localErrors = [];
    const outerLength = masterNumber(row, ["Outer L cm", "Outer Length cm"], "Outer L cm", localErrors);
    const outerWidth = masterNumber(row, ["Outer W cm", "Outer Width cm"], "Outer W cm", localErrors);
    const outerHeight = masterNumber(row, ["Outer H cm", "Outer Height cm"], "Outer H cm", localErrors);
    const innerLength = masterNumber(row, ["True Inner L cm", "Inner L cm", "Inner Length cm"], "True Inner L cm", localErrors);
    const innerWidth = masterNumber(row, ["True Inner W cm", "Inner W cm", "Inner Width cm"], "True Inner W cm", localErrors);
    const innerHeight = masterNumber(row, ["True Inner H cm", "Inner H cm", "Inner Height cm"], "True Inner H cm", localErrors);
    const maxContentWeight = masterNumber(row, ["Max Content Weight kg", "Max Safe Load kg"], "Max Content Weight kg", localErrors);
    const usableVolumePercent = masterNumber(row, ["Usable Volume %"], "Usable Volume %", localErrors);
    const maxItems = masterNumber(row, ["Max Items", "Max Content Items"], "Max Items", localErrors);
    const defaultCourierDays = masterNumber(row, ["Default Courier Days", "Courier Days"], "Default Courier Days", localErrors);

    if (localErrors.length) {
      errors.push(...localErrors.map((message) => `${CONTAINER_SETUP_SHEET} row ${rowNumber}: ${message}`));
    }

    bySku.set(sku, {
      outerDimensions:
        [outerLength, outerWidth, outerHeight].every((value) => Number(value) > 0)
          ? { length: outerLength, width: outerWidth, height: outerHeight, unit: "cm" }
          : null,
      innerDimensions:
        [innerLength, innerWidth, innerHeight].every((value) => Number(value) > 0)
          ? { length: innerLength, width: innerWidth, height: innerHeight, unit: "cm" }
          : null,
      maxContentWeight:
        Number(maxContentWeight) > 0
          ? { value: maxContentWeight, unit: "kg" }
          : null,
      usableVolumePercent,
      maxItems,
      defaultCourierDays,
      customerSelectable: masterBoolean(
        row,
        ["Custom Builder Selectable", "Customer Selectable?", "Selectable?"],
        true
      ),
    });
  });

  return { sheetName, bySku, errors };
};

const parseDecorationMasterSheet = (workbook) => {
  const sheetName = findWorkbookSheet(workbook, [
    DECORATION_MASTER_SHEET,
    "Decorations",
  ]);

  if (!sheetName) {
    return { sheetName: null, bySku: new Map(), errors: [] };
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: null,
    raw: true,
  });

  const bySku = new Map();
  const errors = [];

  rows.map(normalizeMasterRow).forEach((row, index) => {
    const rowNumber = index + 2;
    const sku = masterText(row, ["Decoration SKU", "Product SKU", "SKU"]);
    if (!sku) return;

    if (bySku.has(sku)) {
      errors.push(`${DECORATION_MASTER_SHEET} row ${rowNumber} duplicates Decoration SKU ${sku}`);
      return;
    }

    const priceErrors = [];
    const sellingPrice = masterNumber(row, ["Target Sell Price"], "Target Sell Price", priceErrors);
    const taxPercent = masterNumber(row, ["Tax %"], "Tax %", priceErrors);
    if (priceErrors.length) {
      errors.push(...priceErrors.map((message) => `${DECORATION_MASTER_SHEET} row ${rowNumber}: ${message}`));
    }

    bySku.set(sku, {
      decorationType: masterText(row, ["Decoration Type"]),
      customerSelectable: masterBoolean(row, ["Customer Selectable?"], true),
      countsTowardBoxCapacity: masterBoolean(row, ["Counts Toward Box Capacity?"], false),
      sellingPrice,
      taxPercent,
      personalizable: masterBoolean(row, ["Personalizable?"], false),
      imageUrl: masterText(row, ["Image / Asset URL", "Image URL"]),
    });
  });

  return { sheetName, bySku, errors };
};

const buildComponentMasterPayload = (row, { decorationMasterEntry = null } = {}) => {
  const errors = [];
  const review = [];
  const common = buildMasterCommonFields(row, errors);
  const decoration = isMasterDecorationRow(row, decorationMasterEntry);
  const type = getMasterComponentType(row, { decoration });
  const hamperRole = decoration ? "decoration" : "content";

  if (!common.externalSku) errors.push("Product SKU is required");
  if (!common.name) errors.push("Product Name is required");

  const payload = {
    name: common.name,
    code: common.externalSku.toUpperCase(),
    type,
    hamperRole,
    source: {
      type: "product_master",
      externalSku: common.externalSku,
    },
  };

  setMasterField(payload, "brand", common.brand);
  setMasterField(payload, "skuBarcode", common.skuBarcode);
  setMasterField(payload, "sizePack", common.sizePack);
  setMasterField(payload, "uom", common.uom);
  setMasterField(payload, "sourceProductType", common.sourceProductType);
  setMasterField(payload, "taxonomyBaseId", common.taxonomyBaseId);
  setMasterField(payload, "categoryCode", common.categoryCode);
  setMasterField(payload, "category", common.category);
  setMasterField(payload, "subcategory", common.subcategory);
  setMasterField(payload, "segment", common.segment);
  setMasterField(payload, "hsnSac", common.hsnSac);
  setMasterField(payload, "internalNotes", common.internalNotes);
  setMasterField(payload, "personalizationMethod", common.personalizationMethod);
  setMasterField(payload, "dietary", common.dietary);

  setMasterField(payload, "piecesPerUom", common.piecesPerUom);
  setMasterField(payload, "productPriority", common.productPriority);
  setMasterField(payload, "mrp", common.mrp);
  setMasterField(
    payload,
    "sellingPrice",
    decorationMasterEntry?.sellingPrice ?? common.sellingPrice
  );
  setMasterField(payload, "latestUnitCost", common.latestUnitCost);
  setMasterField(payload, "actualLandedCost", common.actualLandedCost);
  setMasterField(
    payload,
    "taxPercent",
    decorationMasterEntry?.taxPercent ?? common.taxPercent
  );
  payload.taxEnabled =
    payload.taxPercent !== null &&
    payload.taxPercent !== undefined &&
    Number(payload.taxPercent) > 0;
  payload.pricingSource = "product_master";
  payload.taxSource = "product_master";
  setMasterField(payload, "minGrossMarginPercent", common.minGrossMarginPercent);
  setMasterField(payload, "moqQty", common.moqQty);
  setMasterField(payload, "leadTimeDays", common.leadTimeDays);
  setMasterField(payload, "shelfLifeDays", common.shelfLifeDays);

  if (type !== "packaging" && !decoration && common.expiryDate) {
    payload.expiryDate = common.expiryDate;
  }

  if (common.dimensions) payload.dimensions = common.dimensions;
  if (common.weight) payload.weight = common.weight;

  payload.fragile = common.fragile;
  payload.expiryTracked = decoration ? false : common.expiryTracked;
  payload.personalizable =
    decorationMasterEntry?.personalizable ?? common.personalizable;
  payload.hamperUse = common.hamperUse;
  payload.channels = common.channels;
  payload.isActive = common.isActive;

  if (decoration) {
    payload.decorationType =
      masterText(row, ["Decoration Type"]) ||
      decorationMasterEntry?.decorationType ||
      "Decoration";
    payload.countsTowardBoxCapacity = false;
    payload.customerSelectable =
      common.isActive &&
      masterBoolean(
        row,
        ["Decoration Selectable?", "Decoration Selectable"],
        decorationMasterEntry?.customerSelectable !== false
      );
  } else {
    payload.decorationType = "";
    payload.countsTowardBoxCapacity = masterBoolean(
      row,
      ["Counts Toward Box Capacity?"],
      type !== "packaging"
    );
    payload.customerSelectable =
      type !== "packaging" && common.hamperUse && common.isActive;
  }

  const imageUrl = decorationMasterEntry?.imageUrl || common.imageUrl;
  if (imageUrl) {
    payload.images = [{ url: imageUrl, publicId: "", alt: common.name }];
  }

  if (common.sourceUpdatedAt) payload.source.sourceUpdatedAt = common.sourceUpdatedAt;

  if (payload.customerSelectable && hamperRole !== "decoration") {
    if (!validPositiveDimensions(common.dimensions)) {
      review.push("Customer-selectable item requires Product Length, Width and Height");
    }

    if (
      !common.weight ||
      !Number.isFinite(Number(common.weight.value)) ||
      Number(common.weight.value) <= 0
    ) {
      review.push("Customer-selectable item requires Net Product Weight");
    }

    if (common.sellingPrice === null) {
      review.push("Customer-selectable item requires Target Sell Price");
    }
  }

  if (decoration && payload.customerSelectable && payload.sellingPrice === undefined) {
    review.push("Customer-selectable decoration requires Target Sell Price");
  }

  return { payload, errors, review };
};

const buildContainerMasterPayload = (row, setupEntry = null) => {
  const errors = [];
  const review = [];
  const common = buildMasterCommonFields(row, errors);

  const maxSafeLoadKg = masterNumber(
    row,
    ["Max Safe Load kg (Container Only)", "Max Content Weight kg (Container Only)"],
    "Max Safe Load kg",
    errors
  );

  const innerWidth = masterNumber(
    row,
    ["True Inner Width cm (Container Only)", "True Inner W cm", "Inner Width cm"],
    "True Inner Width cm",
    errors
  );
  const innerLength = masterNumber(
    row,
    ["True Inner Length cm (Container Only)", "True Inner L cm", "Inner Length cm"],
    "True Inner Length cm",
    errors
  );
  const innerHeight = masterNumber(
    row,
    ["True Inner Height cm (Container Only)", "True Inner H cm", "Inner Height cm"],
    "True Inner Height cm",
    errors
  );
  const usableVolumePercent = masterNumber(
    row,
    ["Usable Volume % (Container Only)", "Usable Volume %"],
    "Usable Volume %",
    errors
  );
  const maxItems = masterNumber(
    row,
    ["Max Content Items (Container Only)", "Max Items"],
    "Max Content Items",
    errors
  );
  const defaultCourierDays = masterNumber(
    row,
    ["Default Courier Days", "Courier Days"],
    "Default Courier Days",
    errors
  );

  if (!common.externalSku) errors.push("Product SKU is required");
  if (!common.name) errors.push("Product Name is required");

  const payload = {
    name: common.name,
    code: common.externalSku.toUpperCase(),
    source: {
      type: "product_master",
      externalSku: common.externalSku,
    },
  };

  setMasterField(payload, "skuBarcode", common.skuBarcode);
  setMasterField(payload, "sourceProductType", common.sourceProductType);
  setMasterField(payload, "taxonomyBaseId", common.taxonomyBaseId);
  setMasterField(payload, "categoryCode", common.categoryCode);
  setMasterField(payload, "category", common.category);
  setMasterField(payload, "subcategory", common.subcategory);
  setMasterField(payload, "segment", common.segment);
  setMasterField(payload, "hsnSac", common.hsnSac);
  setMasterField(payload, "internalNotes", common.internalNotes);

  setMasterField(payload, "productPriority", common.productPriority);
  setMasterField(payload, "mrp", common.mrp);
  setMasterField(payload, "sellingPrice", common.sellingPrice);
  setMasterField(payload, "latestUnitCost", common.latestUnitCost);
  setMasterField(payload, "actualLandedCost", common.actualLandedCost);
  setMasterField(payload, "taxPercent", common.taxPercent);
  payload.taxEnabled = common.taxPercent !== null && Number(common.taxPercent) > 0;
  payload.pricingSource = "product_master";
  payload.taxSource = "product_master";
  setMasterField(payload, "minGrossMarginPercent", common.minGrossMarginPercent);
  setMasterField(payload, "leadTimeDays", common.leadTimeDays);

  const outerDimensions = validPositiveDimensions(common.dimensions)
    ? common.dimensions
    : setupEntry?.outerDimensions;
  const rowInnerDimensions =
    [innerLength, innerWidth, innerHeight].every((value) => Number(value) > 0)
      ? {
          length: innerLength,
          width: innerWidth,
          height: innerHeight,
          unit: "cm",
        }
      : null;

  const finalInnerDimensions = rowInnerDimensions || setupEntry?.innerDimensions || null;
  const finalMaxContentWeight =
    Number(maxSafeLoadKg) > 0
      ? { value: maxSafeLoadKg, unit: "kg" }
      : setupEntry?.maxContentWeight || null;

  if (validPositiveDimensions(outerDimensions)) {
    payload.outerDimensions = outerDimensions;
  }
  if (validPositiveDimensions(finalInnerDimensions)) {
    payload.innerDimensions = finalInnerDimensions;
  }
  if (validPositiveWeight(finalMaxContentWeight)) {
    payload.maxContentWeight = finalMaxContentWeight;
  }

  const finalUsableVolumePercent =
    usableVolumePercent ?? setupEntry?.usableVolumePercent ?? 85;
  const finalMaxItems = maxItems ?? setupEntry?.maxItems ?? 0;
  const finalCourierDays =
    defaultCourierDays ?? setupEntry?.defaultCourierDays ?? null;

  payload.usableVolumePercent = Number(finalUsableVolumePercent);
  payload.maxItems = Number(finalMaxItems);
  payload.defaultCourierDays =
    finalCourierDays === null || finalCourierDays === ""
      ? null
      : Number(finalCourierDays);

  payload.hamperUse = common.hamperUse;
  payload.channels = common.channels;
  payload.isActive = common.isActive;
  payload.customerSelectable =
    common.isActive &&
    common.hamperUse !== false &&
    (setupEntry?.customerSelectable ?? true);

  if (common.imageUrl) {
    payload.images = [{ url: common.imageUrl, publicId: "", alt: common.name }];
  }

  if (common.sourceUpdatedAt) payload.source.sourceUpdatedAt = common.sourceUpdatedAt;

  if (!payload.outerDimensions) {
    review.push("Container requires Product Length, Width and Height for outer dimensions");
  }
  if (!payload.innerDimensions) {
    review.push(
      "Container requires true inner Length, Width and Height in Product Master or HAMPORIUM Container Setup"
    );
  }
  if (!payload.maxContentWeight || Number(payload.maxContentWeight.value) <= 0) {
    review.push("Container requires Max Content Weight / Max Safe Load kg");
  }
  if (
    !Number.isFinite(Number(payload.usableVolumePercent)) ||
    Number(payload.usableVolumePercent) < 1 ||
    Number(payload.usableVolumePercent) > 100
  ) {
    review.push("Container requires Usable Volume % between 1 and 100");
  }
  if (!Number.isInteger(Number(payload.maxItems)) || Number(payload.maxItems) < 0) {
    review.push("Container Max Content Items must be a non-negative whole number");
  }

  if (
    payload.outerDimensions &&
    payload.innerDimensions &&
    validPositiveDimensions(payload.outerDimensions) &&
    validPositiveDimensions(payload.innerDimensions)
  ) {
    const validationError = validateContainerPayload({
      ...payload,
      availability: { status: "in_stock" },
      productionLeadTime: {
        personalizationDays: 0,
        assemblyDays: 0,
        packingDays: 0,
      },
    });
    if (validationError) review.push(validationError);
  }

  return { payload, errors, review };
};

const comparableDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
};

const comparableImportValue = (value) => {
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => comparableImportValue(item));
  }

  if (value && typeof value === "object") {
    const result = {};

    for (const key of Object.keys(value).sort()) {
      if (key === "_id" || key === "lastSyncedAt") continue;
      const nextValue = value[key];
      if (nextValue === undefined) continue;

      if (key.toLowerCase().includes("date") || key.endsWith("At")) {
        result[key] = comparableDateValue(nextValue);
      } else {
        result[key] = comparableImportValue(nextValue);
      }
    }

    return result;
  }

  return value;
};

const valuesMatchIncoming = (current, incoming) => {
  if (incoming instanceof Date) {
    return comparableDateValue(current) === incoming.toISOString();
  }

  if (Array.isArray(incoming)) {
    if (!Array.isArray(current) || current.length !== incoming.length) return false;
    return incoming.every((item, index) => valuesMatchIncoming(current[index], item));
  }

  if (incoming && typeof incoming === "object") {
    if (!current || typeof current !== "object") return false;

    return Object.entries(incoming).every(([key, value]) => {
      if (key === "lastSyncedAt" || value === undefined) return true;
      return valuesMatchIncoming(current[key], value);
    });
  }

  if (typeof incoming === "number") {
    return Number(current) === incoming;
  }

  if (typeof incoming === "boolean") {
    return Boolean(current) === incoming;
  }

  if (incoming === null) return current === null || current === undefined;

  return String(current ?? "") === String(incoming ?? "");
};

const collectChangedFields = (current, incoming, prefix = "") => {
  const changes = [];

  for (const [key, value] of Object.entries(incoming || {})) {
    if (key === "lastSyncedAt" || value === undefined) continue;

    const path = prefix ? `${prefix}.${key}` : key;
    const currentValue = current?.[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      changes.push(...collectChangedFields(currentValue || {}, value, path));
      continue;
    }

    if (!valuesMatchIncoming(currentValue, value)) changes.push(path);
  }

  return changes;
};

const parseHamperCompositionSheet = (workbook) => {
  const sheetName = findWorkbookSheet(workbook, [
    HAMPER_COMPOSITION_SHEET,
    "Hamper BOM",
    "Ready Made Composition",
    "Ready-Made Composition",
  ]);

  if (!sheetName) {
    return { sheetName: null, byHamperSku: new Map(), errors: [] };
  }

  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: null,
    raw: true,
  });

  const byHamperSku = new Map();
  const errors = [];

  rawRows.map(normalizeMasterRow).forEach((row, index) => {
    const rowNumber = index + 2;
    const hamperSku = masterText(row, [
      "Hamper SKU",
      "Parent Hamper SKU",
      "Parent Product SKU",
      "Ready Made Hamper SKU",
    ]);
    const childSku = masterText(row, [
      "Item SKU",
      "Child SKU",
      "Component SKU",
      "Container SKU",
      "Product SKU",
    ]);
    const roleRaw = masterText(row, ["Role", "Item Role", "Type"]).toLowerCase();
    const builderSection = masterText(row, ["Builder Section"]).toLowerCase();

    let role = "content";
    if (roleRaw.includes("container") || roleRaw === "box") role = "container";
    else if (roleRaw.includes("decoration") || builderSection.includes("decoration")) role = "decoration";
    else if (roleRaw.includes("pack") || roleRaw.includes("material")) role = "packaging";

    const quantityRaw = getMasterValue(row, ["Quantity", "Qty"]);
    const quantity = quantityRaw === null || quantityRaw === "" ? 1 : Number(quantityRaw);
    const sortOrderRaw = getMasterValue(row, ["Sort Order", "Sequence"]);
    const sortOrder =
      sortOrderRaw === null || sortOrderRaw === "" ? index : Number(sortOrderRaw);

    if (!hamperSku || !childSku) {
      errors.push(`Hamper Composition row ${rowNumber} requires Hamper SKU and Item SKU`);
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Hamper Composition row ${rowNumber} has invalid quantity`);
      return;
    }

    if (!Number.isFinite(sortOrder)) {
      errors.push(`Hamper Composition row ${rowNumber} has invalid sort order`);
      return;
    }

    const entry = {
      rowNumber,
      hamperSku,
      childSku,
      role,
      quantity,
      unit: masterText(row, ["Unit", "UOM"]) || "pc",
      displayName: masterText(row, ["Display Name", "Item Name"]),
      sortOrder,
      isOptional: masterBoolean(row, ["Optional?", "Is Optional"], false),
      specification: masterText(row, ["Specification"]),
      notes: masterText(row, ["Notes"]),
      countsTowardBoxCapacity: masterBoolean(
        row,
        ["Counts Toward Box Capacity?"],
        role === "content"
      ),
    };

    if (!byHamperSku.has(hamperSku)) byHamperSku.set(hamperSku, []);
    byHamperSku.get(hamperSku).push(entry);
  });

  return { sheetName, byHamperSku, errors };
};

const addLookupRecord = (map, record) => {
  if (!record) return;
  const externalSku = normalizeExternalSkuKey(record?.source?.externalSku);
  const code = normalizeCodeKey(record?.code);
  if (externalSku) map.set(externalSku, record);
  if (code) map.set(code, record);
};

const getLookupRecord = (map, sku) => {
  if (!map) return null;
  return map.get(normalizeExternalSkuKey(sku)) || map.get(normalizeCodeKey(sku)) || null;
};

const createEmptyCatalogContext = () => ({
  componentsBySku: new Map(),
  containersBySku: new Map(),
  skusBySku: new Map(),
  readyProductsBySku: new Map(),
  productsById: new Map(),
  categoriesBySlug: new Map(),
  categoriesByName: new Map(),
});

const buildExistingCatalogContext = async ({ allSkus = [], categoryNames = [] } = {}) => {
  const normalizedSkus = [...new Set(allSkus.map(normalizeExternalSkuKey).filter(Boolean))];
  const upperCodes = normalizedSkus.map(normalizeCodeKey);

  const componentQuery = normalizedSkus.length
    ? {
        $or: [
          { "source.externalSku": { $in: normalizedSkus } },
          { code: { $in: upperCodes } },
        ],
      }
    : { _id: null };
  const containerQuery = componentQuery;
  const skuQuery = componentQuery;

  const [components, containers, skus, categories] = await Promise.all([
    Component.find(componentQuery).lean(),
    Container.find(containerQuery).lean(),
    SKU.find(skuQuery).lean(),
    Category.find({}).lean(),
  ]);

  const productIds = [...new Set(skus.map((sku) => String(sku.product || "")).filter(isValidId))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).lean()
    : [];

  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const componentsBySku = new Map();
  const containersBySku = new Map();
  const skusBySku = new Map();
  const readyProductsBySku = new Map();

  for (const component of components) addLookupRecord(componentsBySku, component);
  for (const container of containers) addLookupRecord(containersBySku, container);
  for (const sku of skus) {
    addLookupRecord(skusBySku, sku);
    const product = productsById.get(String(sku.product));
    const externalSku = normalizeExternalSkuKey(sku?.source?.externalSku || sku.code);
    if (product && externalSku) readyProductsBySku.set(externalSku, product);
    if (product && sku.code) readyProductsBySku.set(normalizeCodeKey(sku.code), product);
  }

  const categoriesBySlug = new Map();
  const categoriesByName = new Map();
  for (const category of categories) {
    categoriesBySlug.set(String(category.slug || "").toLowerCase(), category);
    categoriesByName.set(String(category.name || "").trim().toLowerCase(), category);
  }

  for (const name of categoryNames) {
    const key = String(name || "").trim().toLowerCase();
    if (!key) continue;
    const slug = createSlug(name);
    if (!categoriesByName.has(key) && categoriesBySlug.has(slug)) {
      categoriesByName.set(key, categoriesBySlug.get(slug));
    }
  }

  return {
    componentsBySku,
    containersBySku,
    skusBySku,
    readyProductsBySku,
    productsById,
    categoriesBySlug,
    categoriesByName,
  };
};

const resolveReadyMadeCategoryFromContext = (name, context) => {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) return null;

  return (
    context.categoriesByName.get(normalizedName.toLowerCase()) ||
    context.categoriesBySlug.get(createSlug(normalizedName)) ||
    null
  );
};

const buildReadyMadeMasterPayload = async (
  row,
  compositionEntries = [],
  context
) => {
  const errors = [];
  const review = [];
  const common = buildMasterCommonFields(row, errors);
  const categoryName = masterText(row, [
    "Website Category",
    "Ready Made Category",
    "Ready-Made Category",
    "Category",
  ]);
  const shortDescription = masterText(row, [
    "Short Description",
    "Product Short Description",
  ]);
  const description = masterText(row, [
    "Description",
    "Product Description",
    "Notes",
  ]);
  const courierDays = masterNumber(
    row,
    ["Default Courier Days", "Courier Days"],
    "Default Courier Days",
    errors
  );
  const featured = masterBoolean(row, ["Featured?", "Is Featured"], false);

  if (!common.externalSku) errors.push("Product SKU is required");
  if (!common.name) errors.push("Product Name is required");
  if (!categoryName) errors.push("Website Category / Category is required for ready-made hampers");
  if (common.sellingPrice === null) errors.push("Target Sell Price is required for ready-made hampers");

  const containerEntries = compositionEntries.filter((entry) => entry.role === "container");
  const contentEntries = compositionEntries.filter((entry) => entry.role === "content");
  const materialEntries = compositionEntries.filter((entry) => entry.role === "packaging");
  const decorationEntries = compositionEntries.filter((entry) => entry.role === "decoration");

  if (compositionEntries.length === 0) {
    review.push(`No ${HAMPER_COMPOSITION_SHEET} rows were found for this ready-made hamper SKU`);
  }

  if (containerEntries.length !== 1) {
    review.push("Ready-made hamper requires exactly one container in Hamper Composition");
  }

  if (contentEntries.length === 0) {
    review.push("Ready-made hamper requires at least one customer-facing content item");
  }

  const container =
    containerEntries.length === 1
      ? getLookupRecord(context.sourceContainersBySku, containerEntries[0].childSku)
      : null;

  if (containerEntries.length === 1 && !container) {
    review.push(`Container SKU ${containerEntries[0].childSku} is not present in this Product Master or HAMPORIUM`);
  } else if (container && container.isActive === false) {
    review.push(`Container ${container.name} is inactive`);
  } else if (container && !validPositiveDimensions(container.innerDimensions)) {
    review.push(`Container ${container.name} requires completed true inner dimensions`);
  }

  const hamperContents = [];
  const internalMaterials = [];
  const decorations = [];
  const physicalComponentMap = new Map();

  for (const entry of contentEntries) {
    const component = getLookupRecord(context.sourceComponentsBySku, entry.childSku);

    if (!component) {
      review.push(`Content SKU ${entry.childSku} is not present in this Product Master or HAMPORIUM`);
      continue;
    }

    if (component.isActive === false) {
      review.push(`${component.name} is inactive`);
      continue;
    }

    if (component.type === "packaging") {
      review.push(`${component.name} is packaging and cannot be customer-facing hamper content`);
      continue;
    }

    if ((component.hamperRole || "content") === "decoration") {
      review.push(`${component.name} is a decoration and cannot be stored as hamper content`);
      continue;
    }

    physicalComponentMap.set(entry.childSku, component);
    hamperContents.push({
      component: entry.childSku,
      quantity: entry.quantity,
      unit: entry.unit || "pc",
      displayName: entry.displayName || component.name,
      sortOrder: entry.sortOrder,
      isOptional: entry.isOptional,
    });
  }

  for (const entry of materialEntries) {
    const component = getLookupRecord(context.sourceComponentsBySku, entry.childSku);

    if (!component) {
      review.push(`Packaging SKU ${entry.childSku} is not present in this Product Master or HAMPORIUM`);
      continue;
    }

    if (component.isActive === false || component.type !== "packaging") {
      review.push(`${component.name} must be an active packaging component`);
      continue;
    }

    internalMaterials.push({
      component: entry.childSku,
      quantity: entry.quantity,
      unit: entry.unit || "pc",
      specification: entry.specification || "",
      notes: entry.notes || "",
    });
  }

  for (const entry of decorationEntries) {
    const component = getLookupRecord(context.sourceComponentsBySku, entry.childSku);

    if (!component) {
      review.push(`Decoration SKU ${entry.childSku} is not present in this Product Master or HAMPORIUM`);
      continue;
    }

    if (component.isActive === false || (component.hamperRole || "content") !== "decoration") {
      review.push(`${component.name} must be an active decoration component`);
      continue;
    }

    decorations.push({
      component: entry.childSku,
      quantity: entry.quantity,
      unit: entry.unit || "pc",
      displayName: entry.displayName || component.name,
      sortOrder: entry.sortOrder,
      isOptional: entry.isOptional,
    });
  }

  if (
    container &&
    hamperContents.length === contentEntries.length &&
    hamperContents.length > 0
  ) {
    const selections = hamperContents
      .filter((item) => !item.isOptional)
      .map((item) => ({
        componentId: String(item.component),
        quantity: Number(item.quantity),
      }));

    const physical = evaluatePhysicalConfiguration(
      container,
      selections,
      physicalComponentMap
    );
    if (!physical.valid) {
      review.push(
        `Fixed hamper composition does not pass the common fit engine: ${configurationReasonMessage(physical.reason)}`
      );
    }
  }

  const category = resolveReadyMadeCategoryFromContext(categoryName, context.existingContext);
  const source = {
    type: "product_master",
    externalSku: common.externalSku,
  };
  if (common.sourceUpdatedAt) source.sourceUpdatedAt = common.sourceUpdatedAt;

  const productPayload = {
    name: common.name,
    shortDescription: shortDescription || description.slice(0, 500),
    description,
    brand: common.brand || "HAMPORIUM",
    images: common.imageUrl
      ? [{ url: common.imageUrl, publicId: "", alt: common.name }]
      : [],
    tags: normalizeTags([
      "ready-made-hamper",
      common.channels.wedding ? "wedding" : "",
      common.channels.corporate ? "corporate" : "",
      common.channels.diwali ? "diwali" : "",
      common.channels.hamperOne ? "hamper-one" : "",
      common.segment,
      common.subcategory,
    ]),
    status: common.isActive ? PRODUCT_STATUS.ACTIVE : PRODUCT_STATUS.DRAFT,
    isFeatured: featured,
    source,
  };

  const readyMadePricing = calculateCatalogPricing({
    baseSellingPrice: common.sellingPrice === null ? 0 : Number(common.sellingPrice),
    taxPercent: common.taxPercent ?? 0,
    taxEnabled: common.taxPercent !== null && Number(common.taxPercent) > 0,
    discount: { enabled: false, type: "percentage", value: 0 },
  });

  const skuPayload = {
    code: common.externalSku.toUpperCase(),
    skuBarcode: common.skuBarcode || "",
    name: common.sizePack || "Standard",
    optionValues: common.sizePack ? { size: common.sizePack } : {},
    baseSellingPrice: readyMadePricing.baseSellingPrice,
    mrp: common.mrp === null ? null : Number(common.mrp),
    taxEnabled: readyMadePricing.taxEnabled,
    taxPercent: readyMadePricing.taxPercent,
    hsnSac: common.hsnSac || "",
    discount: readyMadePricing.discount,
    pricingSource: "product_master",
    taxSource: "product_master",
    price: readyMadePricing.price,
    compareAtPrice:
      common.mrp !== null && Number(common.mrp) > Number(readyMadePricing.price)
        ? Number(common.mrp)
        : null,
    images: common.imageUrl
      ? [{ url: common.imageUrl, publicId: "", alt: common.name }]
      : [],
    container: containerEntries[0]?.childSku || null,
    hamperContents,
    internalMaterials,
    decorations,
    packagedDimensions: validPositiveDimensions(common.dimensions)
      ? common.dimensions
      : { length: null, width: null, height: null, unit: "cm" },
    packagedWeight:
      common.weight && Number(common.weight.value) > 0
        ? common.weight
        : { value: null, unit: "kg" },
    productionLeadTime: {
      personalizationDays: common.personalizable ? 1 : 0,
      assemblyDays: Math.max(0, Number(common.leadTimeDays || 0)),
      packingDays: 0,
    },
    defaultCourierDays:
      courierDays === null ? container?.defaultCourierDays ?? null : courierDays,
    isActive: common.isActive,
    sortOrder: Number(common.productPriority || 0),
    source,
  };

  return {
    productPayload,
    skuPayload,
    categoryName,
    categoryId: category?._id || null,
    errors,
    review,
    compositionSummary: {
      containerSku: containerEntries[0]?.childSku || null,
      contentLines: contentEntries.length,
      totalUnits: contentEntries.reduce(
        (sum, entry) => sum + Number(entry.quantity || 0),
        0
      ),
      packagingLines: materialEntries.length,
      decorationLines: decorationEntries.length,
    },
  };
};

const calculateReadyMadeHamperMetrics = (sku) => {
  const contents = Array.isArray(sku?.hamperContents) ? sku.hamperContents : [];
  let contentWeightGrams = 0;
  let contentWeightComplete = true;
  let totalUnits = 0;

  for (const item of contents) {
    if (item.isOptional) continue;
    const quantity = Number(item.quantity || 0);
    totalUnits += quantity;
    const component =
      item.component && typeof item.component === "object" ? item.component : null;
    const grams = component
      ? weightToGrams(component.weight?.value, component.weight?.unit)
      : null;

    if (!Number.isFinite(grams)) contentWeightComplete = false;
    else contentWeightGrams += grams * quantity;
  }

  const packagedWeight = validPositiveWeight(sku?.packagedWeight)
    ? sku.packagedWeight
    : null;
  const packagedDimensions = validPositiveDimensions(sku?.packagedDimensions)
    ? sku.packagedDimensions
    : validPositiveDimensions(sku?.container?.outerDimensions)
      ? sku.container.outerDimensions
      : null;

  return {
    uniqueProductCount: contents.filter((item) => !item.isOptional).length,
    totalUnits: Number(totalUnits.toFixed(3)),
    contentWeight: contentWeightComplete
      ? { value: Number((contentWeightGrams / 1000).toFixed(3)), unit: "kg" }
      : null,
    hamperWeight: packagedWeight,
    hamperWeightSource: packagedWeight ? "product_master" : "not_available",
    dimensions: packagedDimensions,
    dimensionsSource: validPositiveDimensions(sku?.packagedDimensions)
      ? "product_master"
      : packagedDimensions
        ? "container_outer"
        : "not_available",
  };
};

const analyzeProductMasterBuffer = async (
  buffer,
  filename = "",
  { replaceMode = true } = {}
) => {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: true,
  });

  const sheetName = findWorkbookSheet(workbook, [PRODUCT_MASTER_SHEET]);

  if (!sheetName) {
    const error = new Error(`Workbook must contain a \"${PRODUCT_MASTER_SHEET}\" sheet`);
    error.statusCode = 400;
    throw error;
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: null,
    raw: true,
  });

  if (rows.length === 0) {
    const error = new Error("Product Master sheet does not contain any data rows");
    error.statusCode = 400;
    throw error;
  }

  const composition = parseHamperCompositionSheet(workbook);
  const containerSetup = parseContainerSetupSheet(workbook);
  const decorationMaster = parseDecorationMasterSheet(workbook);
  const normalizedRows = rows.map(normalizeMasterRow);
  const skuCounts = new Map();
  const rowMeta = [];
  const allSkus = new Set();
  const categoryNames = new Set();

  normalizedRows.forEach((row, index) => {
    const externalSku = masterText(row, [
      "Product SKU (10 digits numeric — immutable)",
      "Product SKU",
      "SKU",
    ]);
    const recordType = getMasterRecordType(row);
    const name = masterText(row, ["Product Name", "Name"]);
    const rowNumber = index + 2;

    if (externalSku) {
      skuCounts.set(externalSku, (skuCounts.get(externalSku) || 0) + 1);
      allSkus.add(externalSku);
    }

    if (recordType === "ready_made_hamper") {
      const categoryName = masterText(row, [
        "Website Category",
        "Ready Made Category",
        "Ready-Made Category",
        "Category",
      ]);
      if (categoryName) categoryNames.add(categoryName);
    }

    rowMeta.push({ row, rowNumber, recordType, externalSku, name });
  });

  for (const entries of composition.byHamperSku.values()) {
    for (const entry of entries) allSkus.add(entry.childSku);
  }

  /*
   * TESTING HARD-REPLACE MODE
   * -------------------------------------------------------
   * In replace mode the selected workbook is the source of truth and the
   * current catalogue will be cleared on Confirm Import. Preview therefore
   * must not depend on the existing catalogue at all. Besides making Analyze
   * much faster on Render/MongoDB Atlas, this avoids stale/legacy records or
   * old schemas causing the preview endpoint to fail before the replacement
   * can happen.
   *
   * Non-replace/merge mode can still compare against MongoDB normally.
   */
  const existingContext = replaceMode
    ? createEmptyCatalogContext()
    : await buildExistingCatalogContext({
        allSkus: [...allSkus],
        categoryNames: [...categoryNames],
      });

  const builtBaseByRow = new Map();
  const workbookComponentsBySku = new Map();
  const workbookContainersBySku = new Map();

  for (const meta of rowMeta) {
    if (meta.recordType === "ready_made_hamper") continue;

    const built =
      meta.recordType === "container"
        ? buildContainerMasterPayload(
            meta.row,
            containerSetup.bySku.get(meta.externalSku) || null
          )
        : buildComponentMasterPayload(meta.row, {
            decorationMasterEntry:
              decorationMaster.bySku.get(meta.externalSku) || null,
          });

    builtBaseByRow.set(meta.rowNumber, built);

    if (meta.externalSku && built.errors.length === 0) {
      if (meta.recordType === "container") {
        addLookupRecord(workbookContainersBySku, built.payload);
      } else {
        addLookupRecord(workbookComponentsBySku, built.payload);
      }
    }
  }

  const sourceComponentsBySku = new Map(existingContext.componentsBySku);
  const sourceContainersBySku = new Map(existingContext.containersBySku);
  for (const [key, value] of workbookComponentsBySku.entries()) {
    sourceComponentsBySku.set(key, value);
  }
  for (const [key, value] of workbookContainersBySku.entries()) {
    sourceContainersBySku.set(key, value);
  }

  const context = {
    existingContext,
    sourceComponentsBySku,
    sourceContainersBySku,
  };

  const results = [];

  for (const meta of rowMeta) {
    const { row, rowNumber, recordType, externalSku, name } = meta;

    if (recordType === "ready_made_hamper") {
      const built = await buildReadyMadeMasterPayload(
        row,
        composition.byHamperSku.get(externalSku) || [],
        context
      );

      if (externalSku && skuCounts.get(externalSku) > 1) {
        built.errors.push("Duplicate Product SKU exists more than once in this workbook");
      }

      const componentConflict = getLookupRecord(
        existingContext.componentsBySku,
        externalSku
      );
      const containerConflict = getLookupRecord(
        existingContext.containersBySku,
        externalSku
      );
      const manualCrossConflict = [componentConflict, containerConflict].find(
        (record) => record && record?.source?.type !== "product_master"
      );

      if (manualCrossConflict) {
        built.review.push(
          `Product SKU is already owned by a manual ${componentConflict ? "component" : "container"} record`
        );
      }

      if (built.errors.length > 0) {
        results.push({
          rowNumber,
          externalSku,
          name,
          recordType,
          action: "ERROR",
          reason: built.errors.join("; "),
          changedFields: [],
          compositionSummary: built.compositionSummary,
        });
        continue;
      }

      const existingSku = getLookupRecord(existingContext.skusBySku, externalSku);
      const existingProduct = existingSku
        ? existingContext.productsById.get(String(existingSku.product)) || null
        : getLookupRecord(existingContext.readyProductsBySku, externalSku);

      if (
        (existingSku && existingSku?.source?.type !== "product_master") ||
        (existingProduct && existingProduct?.source?.type !== "product_master")
      ) {
        built.review.push(
          "Ready-made hamper SKU is already owned by a manual catalogue record"
        );
      }

      if (built.review.length > 0) {
        results.push({
          rowNumber,
          externalSku,
          name,
          recordType,
          action: "REVIEW",
          reason: [...new Set(built.review)].join("; "),
          changedFields: [],
          compositionSummary: built.compositionSummary,
          _payload: {
            product: built.productPayload,
            sku: built.skuPayload,
            categoryName: built.categoryName,
            categoryId: built.categoryId,
          },
        });
        continue;
      }

      const action = !existingProduct || !existingSku ? "CREATE" : "UPDATE";
      const changedFields = [];
      if (existingProduct) {
        changedFields.push(
          ...collectChangedFields(existingProduct, {
            ...built.productPayload,
            category: built.categoryId || existingProduct.category,
          }).map((field) => `product.${field}`)
        );
      }
      if (existingSku) {
        changedFields.push(
          ...collectChangedFields(existingSku, {
            ...built.skuPayload,
            container: undefined,
            hamperContents: undefined,
            internalMaterials: undefined,
            decorations: undefined,
          }).map((field) => `sku.${field}`)
        );
        changedFields.push("sku.composition");
      }

      results.push({
        rowNumber,
        externalSku,
        name,
        recordType,
        action,
        reason:
          action === "CREATE"
            ? built.categoryId
              ? "New ready-made hamper Product + SKU"
              : `New ready-made hamper Product + SKU; website category \"${built.categoryName}\" will be created`
            : replaceMode
              ? "Existing Product Master ready-made hamper will be replaced by this workbook"
              : "Existing ready-made hamper has Product Master / composition changes",
        changedFields,
        compositionSummary: built.compositionSummary,
        _payload: {
          product: built.productPayload,
          sku: built.skuPayload,
          categoryName: built.categoryName,
          categoryId: built.categoryId,
        },
        _existingProductId: existingProduct?._id || null,
        _existingSkuId: existingSku?._id || null,
      });
      continue;
    }

    const built = builtBaseByRow.get(rowNumber);

    if (externalSku && skuCounts.get(externalSku) > 1) {
      built.errors.push("Duplicate Product SKU exists more than once in this workbook");
    }

    if (built.errors.length > 0) {
      results.push({
        rowNumber,
        externalSku,
        name,
        recordType,
        action: "ERROR",
        reason: built.errors.join("; "),
        changedFields: [],
      });
      continue;
    }

    const ownMap =
      recordType === "container"
        ? existingContext.containersBySku
        : existingContext.componentsBySku;
    const otherMap =
      recordType === "container"
        ? existingContext.componentsBySku
        : existingContext.containersBySku;
    const existing = getLookupRecord(ownMap, externalSku);
    const conflicting = getLookupRecord(otherMap, externalSku);

    const reviewMessages = [...built.review];

    if (conflicting && conflicting?.source?.type !== "product_master") {
      reviewMessages.push(
        `Product SKU already exists as a manual ${recordType === "container" ? "component" : "container"}: ${conflicting.name}`
      );
    }

    if (existing && existing?.source?.type !== "product_master") {
      reviewMessages.push(
        "Product SKU is already owned by a manual catalogue record and will not be overwritten"
      );
    }

    if (reviewMessages.length > 0) {
      results.push({
        rowNumber,
        externalSku,
        name,
        recordType,
        action: "REVIEW",
        reason: [...new Set(reviewMessages)].join("; "),
        changedFields: existing ? collectChangedFields(existing, built.payload) : [],
        _payload: built.payload,
        _existingId: existing?._id || null,
      });
      continue;
    }

    if (!existing) {
      results.push({
        rowNumber,
        externalSku,
        name,
        recordType,
        action: "CREATE",
        reason: "New Product Master record",
        changedFields: [],
        _payload: built.payload,
        _existingId: null,
      });
      continue;
    }

    const changedFields = collectChangedFields(existing, built.payload);

    results.push({
      rowNumber,
      externalSku,
      name,
      recordType,
      action: replaceMode ? "UPDATE" : changedFields.length > 0 ? "UPDATE" : "SKIP",
      reason: replaceMode
        ? "Existing Product Master record will be replaced by this workbook"
        : changedFields.length > 0
          ? "Existing record has Product Master changes"
          : "No Product Master changes detected",
      changedFields,
      _payload: built.payload,
      _existingId: existing._id,
    });
  }

  const allSheetErrors = [
    ...composition.errors,
    ...containerSetup.errors,
    ...decorationMaster.errors,
  ];

  const summary = {
    totalRows: results.length,
    create: 0,
    update: 0,
    skip: 0,
    review: 0,
    error: allSheetErrors.length,
    components: { create: 0, update: 0, skip: 0, review: 0, error: 0 },
    containers: { create: 0, update: 0, skip: 0, review: 0, error: 0 },
    readyMadeHampers: { create: 0, update: 0, skip: 0, review: 0, error: 0 },
  };

  for (const result of results) {
    const key = result.action.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(summary, key)) summary[key] += 1;

    const group =
      result.recordType === "container"
        ? summary.containers
        : result.recordType === "ready_made_hamper"
          ? summary.readyMadeHampers
          : summary.components;

    if (Object.prototype.hasOwnProperty.call(group, key)) group[key] += 1;
  }

  return {
    filename,
    sheetName,
    compositionSheetName: composition.sheetName,
    containerSetupSheetName: containerSetup.sheetName,
    decorationSheetName: decorationMaster.sheetName,
    compositionErrors: allSheetErrors,
    summary,
    results,
    replaceMode,
  };
};

const buildContainerReviewData = (result) => {
  if (
    result?.recordType !== "container" ||
    result?.action !== "REVIEW" ||
    !result?._payload
  ) {
    return null;
  }

  const payload = result._payload;

  return {
    outerDimensions: payload.outerDimensions || null,
    innerDimensions: payload.innerDimensions || null,
    maxContentWeight: payload.maxContentWeight || null,
    hasSourceOuterDimensions: validPositiveDimensions(payload.outerDimensions),
    hasSourceInnerDimensions: validPositiveDimensions(payload.innerDimensions),
    hasSourceMaxContentWeight: validPositiveWeight(payload.maxContentWeight),
    material: payload.material || "",
    usableVolumePercent: payload.usableVolumePercent ?? 85,
    maxItems: payload.maxItems ?? 0,
    productionLeadTime: {
      personalizationDays: 0,
      assemblyDays: 0,
      packingDays: 0,
    },
    defaultCourierDays: payload.defaultCourierDays ?? null,
    availability: {
      status: "in_stock",
      availableQuantity: null,
      nextAvailableDate: null,
    },
    customerSelectable: payload.customerSelectable !== false,
    sortOrder: 0,
    sellingPrice: payload.sellingPrice ?? null,
    mrp: payload.mrp ?? null,
    category: payload.category || "",
    subcategory: payload.subcategory || "",
    sourceProductType: payload.sourceProductType || "",
  };
};

const publicImportResult = (result) => ({
  rowNumber: result.rowNumber,
  externalSku: result.externalSku,
  name: result.name,
  recordType: result.recordType,
  action: result.action,
  reason: result.reason,
  changedFields: result.changedFields || [],
  compositionSummary: result.compositionSummary || null,
  reviewData: buildContainerReviewData(result),
});

const parseContainerReviewCompletion = (raw) => {
  if (!raw) return {};

  if (typeof raw === "object") return raw;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    const error = new Error("Invalid container completion data");
    error.statusCode = 400;
    throw error;
  }
};

const replaceProductMasterCatalog = async () => {
  /*
   * TESTING-PHASE HARD REPLACE
   * -------------------------------------------------------
   * The user is repeatedly importing different master files and expects the
   * selected workbook to become the ONLY current catalogue. Older importer
   * versions did not always tag every row consistently with
   * source.type=product_master, so filtering only by source.type can leave
   * stale products/components/containers behind.
   *
   * Therefore Confirm Import clears the current catalogue core first, while
   * preserving users, orders, payments, partners, reviews, etc.
   *
   * Collections are intentionally preserved because the Product Master does
   * not own collection definitions. Categories referenced by the catalogue
   * being replaced are removed and recreated from the new workbook.
   */

  const existingProducts = await Product.find({})
    .select("_id category")
    .lean();

  const productCategoryIds = [
    ...new Set(
      existingProducts
        .map((product) => String(product.category || ""))
        .filter(isValidId)
    ),
  ];

  const importedCategoryIds = await Category.find({
    "source.type": "product_master",
  })
    .distinct("_id");

  const candidateCategoryIds = [
    ...new Set([
      ...productCategoryIds,
      ...importedCategoryIds.map(String),
    ]),
  ];

  /*
   * Delete child records first. We intentionally clear ALL catalogue rows in
   * these four core collections during testing so an older untagged import
   * cannot survive and appear beside the new workbook.
   */
  const skuDelete = await SKU.deleteMany({});

  const productDelete = await Product.deleteMany({});
  const componentDelete = await Component.deleteMany({});
  const containerDelete = await Container.deleteMany({});

  let deletedCategories = 0;

  if (candidateCategoryIds.length) {
    const result = await Category.deleteMany({
      _id: { $in: candidateCategoryIds },
    });
    deletedCategories = result.deletedCount || 0;
  }

  return {
    products: productDelete.deletedCount || 0,
    skus: skuDelete.deletedCount || 0,
    components: componentDelete.deletedCount || 0,
    containers: containerDelete.deletedCount || 0,
    categories: deletedCategories,
  };
};

const buildImportedBaseLookup = async () => {
  const [components, containers] = await Promise.all([
    Component.find({ "source.type": "product_master" }).lean(),
    Container.find({ "source.type": "product_master" }).lean(),
  ]);

  const componentsBySku = new Map();
  const containersBySku = new Map();
  for (const component of components) addLookupRecord(componentsBySku, component);
  for (const container of containers) addLookupRecord(containersBySku, container);

  return { componentsBySku, containersBySku };
};

const resolveReadyMadeReferences = (skuPayload, baseLookup) => {
  const resolved = {
    ...skuPayload,
    hamperContents: [],
    internalMaterials: [],
    decorations: [],
  };

  if (skuPayload.container) {
    const container = getLookupRecord(baseLookup.containersBySku, skuPayload.container);
    if (!container) {
      throw new Error(`Container SKU ${skuPayload.container} was not imported`);
    }
    resolved.container = container._id;
  } else {
    resolved.container = null;
  }

  const expiryDates = [];

  for (const item of skuPayload.hamperContents || []) {
    const component = getLookupRecord(baseLookup.componentsBySku, item.component);
    if (!component) {
      throw new Error(`Content SKU ${item.component} was not imported`);
    }
    if (component.type === "packaging" || (component.hamperRole || "content") === "decoration") {
      throw new Error(`${component.name} is not valid ready-made hamper content`);
    }

    resolved.hamperContents.push({
      ...item,
      component: component._id,
    });

    if (!item.isOptional && component.type === "food" && component.expiryDate) {
      const date = new Date(component.expiryDate);
      if (!Number.isNaN(date.getTime())) expiryDates.push(date);
    }
  }

  for (const item of skuPayload.internalMaterials || []) {
    const component = getLookupRecord(baseLookup.componentsBySku, item.component);
    if (!component) {
      throw new Error(`Packaging SKU ${item.component} was not imported`);
    }
    if (component.type !== "packaging") {
      throw new Error(`${component.name} is not an internal packaging component`);
    }

    resolved.internalMaterials.push({
      ...item,
      component: component._id,
    });
  }

  for (const item of skuPayload.decorations || []) {
    const component = getLookupRecord(baseLookup.componentsBySku, item.component);
    if (!component) {
      throw new Error(`Decoration SKU ${item.component} was not imported`);
    }
    if ((component.hamperRole || "content") !== "decoration") {
      throw new Error(`${component.name} is not a decoration component`);
    }

    resolved.decorations.push({
      ...item,
      component: component._id,
    });
  }

  resolved.earliestExpiryDate = expiryDates.length
    ? new Date(Math.min(...expiryDates.map((date) => date.getTime())))
    : null;

  return resolved;
};

const ensureImportedCategory = async (categoryName, importedAt) => {
  const normalizedName = String(categoryName || "").trim();
  if (!normalizedName) throw new Error("Ready-made hamper category is required");

  const slug = createSlug(normalizedName);
  let category = await Category.findOne({
    $or: [
      { slug },
      { name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: "i" } },
    ],
  });

  if (category) return category;

  category = await Category.create({
    name: normalizedName,
    slug: await ensureUniqueSlug(Category, normalizedName),
    description: "",
    image: "",
    imagePublicId: "",
    isActive: true,
    sortOrder: 0,
    source: {
      type: "product_master",
      externalSku: `category:${slug}`,
      lastSyncedAt: importedAt,
    },
  });

  return category;
};

/* =========================================================
   ADMIN PRODUCT MASTER IMPORT
========================================================= */

export const previewProductMasterImport = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({
      success: false,
      message: "Product Master Excel file is required",
    });
  }

  const analysis = await analyzeProductMasterBuffer(
    req.file.buffer,
    req.file.originalname || "",
    { replaceMode: true }
  );

  res.status(200).json({
    success: true,
    message:
      "Product Master analyzed successfully. Confirm Import will replace the previous Product Master catalogue with this workbook.",
    importMode: "replace_product_master",
    replacementStrategy: "testing_hard_replace",
    filename: analysis.filename,
    sheetName: analysis.sheetName,
    compositionSheetName: analysis.compositionSheetName,
    containerSetupSheetName: analysis.containerSetupSheetName,
    decorationSheetName: analysis.decorationSheetName,
    compositionErrors: analysis.compositionErrors,
    summary: analysis.summary,
    results: analysis.results.map(publicImportResult),
  });
});

export const completeProductMasterContainerReview = asyncHandler(
  async (req, res) => {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Product Master Excel file is required",
      });
    }

    const externalSku = String(req.body.externalSku || "").trim();

    if (!externalSku) {
      return res.status(400).json({
        success: false,
        message: "Product SKU is required for container review completion",
      });
    }

    const completion = parseContainerReviewCompletion(req.body.completion);

    const analysis = await analyzeProductMasterBuffer(
      req.file.buffer,
      req.file.originalname || "",
      { replaceMode: true }
    );

    const item = analysis.results.find(
      (result) =>
        result.recordType === "container" &&
        String(result.externalSku || "") === externalSku
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Container row was not found in the selected Product Master file",
      });
    }

    if (item.action === "ERROR") {
      return res.status(400).json({
        success: false,
        message: item.reason || "This Product Master row contains errors",
      });
    }

    if (!item._payload) {
      return res.status(409).json({
        success: false,
        message:
          item.reason ||
          "This review row cannot be completed automatically. Resolve the conflict first.",
      });
    }

    const sourcePayload = item._payload;

    let container = item._existingId
      ? await Container.findById(item._existingId)
      : await Container.findOne({
          $or: [
            { "source.externalSku": externalSku },
            { code: externalSku.toUpperCase() },
          ],
        });

    const existingPlain = container ? container.toObject() : {};

    const outerDimensions =
      sourcePayload.outerDimensions ||
      completion.outerDimensions ||
      existingPlain.outerDimensions;

    const innerDimensions =
      sourcePayload.innerDimensions ||
      completion.innerDimensions ||
      existingPlain.innerDimensions;

    const maxContentWeight =
      sourcePayload.maxContentWeight ||
      completion.maxContentWeight ||
      existingPlain.maxContentWeight;

    if (!validPositiveDimensions(outerDimensions)) {
      return res.status(400).json({
        success: false,
        message: "Valid outer Length, Width and Height are required",
      });
    }

    if (!validPositiveDimensions(innerDimensions)) {
      return res.status(400).json({
        success: false,
        message: "Valid true inner Length, Width and Height are required",
      });
    }

    if (!validPositiveWeight(maxContentWeight)) {
      return res.status(400).json({
        success: false,
        message: "Maximum content weight is required",
      });
    }

    const currentLeadTime = toPlainObject(existingPlain.productionLeadTime);
    const requestedLeadTime =
      completion.productionLeadTime &&
      typeof completion.productionLeadTime === "object"
        ? completion.productionLeadTime
        : {};

    const productionLeadTime = {
      personalizationDays:
        requestedLeadTime.personalizationDays ??
        currentLeadTime.personalizationDays ??
        0,
      assemblyDays:
        requestedLeadTime.assemblyDays ?? currentLeadTime.assemblyDays ?? 0,
      packingDays:
        requestedLeadTime.packingDays ?? currentLeadTime.packingDays ?? 0,
    };

    const leadTimeError = validateProductionLeadTime(productionLeadTime);
    if (leadTimeError) {
      return res.status(400).json({ success: false, message: leadTimeError });
    }

    const currentAvailability = toPlainObject(existingPlain.availability);
    const requestedAvailability =
      completion.availability && typeof completion.availability === "object"
        ? completion.availability
        : {};

    const availability = {
      ...currentAvailability,
      ...requestedAvailability,
      status:
        requestedAvailability.status || currentAvailability.status || "in_stock",
    };

    const availabilityError = validateAvailabilityPayload(availability, {
      stockUnit: false,
      label: "container availability",
    });

    if (availabilityError) {
      return res.status(400).json({ success: false, message: availabilityError });
    }

    const usableVolumePercent =
      sourcePayload.usableVolumePercent ??
      (completion.usableVolumePercent !== undefined &&
      completion.usableVolumePercent !== null &&
      completion.usableVolumePercent !== ""
        ? Number(completion.usableVolumePercent)
        : Number(existingPlain.usableVolumePercent ?? 85));

    const maxItems =
      sourcePayload.maxItems ??
      (completion.maxItems !== undefined &&
      completion.maxItems !== null &&
      completion.maxItems !== ""
        ? Number(completion.maxItems)
        : Number(existingPlain.maxItems ?? 0));

    const requestedCourierDays =
      sourcePayload.defaultCourierDays ??
      (completion.defaultCourierDays !== undefined
        ? completion.defaultCourierDays
        : existingPlain.defaultCourierDays);

    const courier = parseCourierDays(requestedCourierDays, null);
    if (!courier.valid) {
      return res.status(400).json({ success: false, message: courier.message });
    }

    let customerSelectable =
      sourcePayload.customerSelectable !== undefined
        ? Boolean(sourcePayload.customerSelectable)
        : completion.customerSelectable !== undefined
          ? parseBoolean(completion.customerSelectable)
          : existingPlain.customerSelectable;

    if (
      completion.customerSelectable !== undefined &&
      customerSelectable === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "customerSelectable must be true or false",
      });
    }

    if (customerSelectable === undefined) {
      customerSelectable =
        sourcePayload.hamperUse !== false && sourcePayload.isActive !== false;
    }

    if (sourcePayload.hamperUse === false || sourcePayload.isActive === false) {
      customerSelectable = false;
    }

    const packingMaterialsInput =
      completion.packingMaterials !== undefined
        ? completion.packingMaterials
        : existingPlain.packingMaterials || [];

    const materialsResult = await validateAndNormalizeMaterialItems(
      packingMaterialsInput,
      {
        fieldName: "packingMaterials",
        activeOnly: true,
      }
    );

    if (!materialsResult.valid) {
      return res.status(400).json({
        success: false,
        message: materialsResult.message,
      });
    }

    const importedAt = new Date();

    const payload = {
      ...sourcePayload,
      material:
        completion.material !== undefined
          ? String(completion.material || "").trim()
          : existingPlain.material || "",
      outerDimensions: normalizeContainerDimensions(outerDimensions),
      innerDimensions: normalizeContainerDimensions(innerDimensions),
      maxContentWeight: normalizeWeightCapacity(maxContentWeight),
      usableVolumePercent,
      maxItems,
      packingMaterials: materialsResult.items,
      productionLeadTime: normalizeProductionLeadTime(productionLeadTime),
      defaultCourierDays: courier.value,
      availability: normalizeAvailability(availability, { stockUnit: false }),
      customerSelectable,
      sortOrder:
        completion.sortOrder !== undefined
          ? Number(completion.sortOrder) || 0
          : Number(existingPlain.sortOrder || 0),
      source: {
        ...(sourcePayload.source || {}),
        type: "product_master",
        externalSku,
        lastSyncedAt: importedAt,
      },
    };

    if (completion.internalNotes !== undefined) {
      payload.internalNotes = String(completion.internalNotes || "");
    } else if (
      sourcePayload.internalNotes === undefined &&
      existingPlain.internalNotes !== undefined
    ) {
      payload.internalNotes = existingPlain.internalNotes;
    }

    const validationError = validateContainerPayload({
      ...payload,
      outerDimensions: payload.outerDimensions,
      innerDimensions: payload.innerDimensions,
      maxContentWeight: payload.maxContentWeight,
      usableVolumePercent: payload.usableVolumePercent,
      maxItems: payload.maxItems,
      availability: payload.availability,
      productionLeadTime: payload.productionLeadTime,
      defaultCourierDays: payload.defaultCourierDays,
      hamperUse: payload.hamperUse,
    });

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    let created = false;

    if (!container) {
      container = await Container.create(payload);
      created = true;
    } else {
      container.set(payload);
      await container.save();
    }

    const plain = container.toObject();

    res.status(created ? 201 : 200).json({
      success: true,
      message: created
        ? "Container review completed and container imported"
        : "Container review completed and container updated",
      container: {
        ...plain,
        capacity: calculateContainerCapacity(plain),
      },
    });
  }
);

export const confirmProductMasterImport = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({
      success: false,
      message: "Product Master Excel file is required",
    });
  }

  const preflight = await analyzeProductMasterBuffer(
    req.file.buffer,
    req.file.originalname || "",
    { replaceMode: true }
  );

  const blockingRows = preflight.results.filter((item) =>
    ["ERROR", "REVIEW"].includes(item.action)
  );

  if (preflight.compositionErrors.length > 0 || blockingRows.length > 0) {
    return res.status(409).json({
      success: false,
      message:
        "Import was not started because the workbook still has errors or review items. No existing catalogue data was deleted.",
      importMode: "replace_product_master",
      filename: preflight.filename,
      sheetName: preflight.sheetName,
      compositionSheetName: preflight.compositionSheetName,
      containerSetupSheetName: preflight.containerSetupSheetName,
      decorationSheetName: preflight.decorationSheetName,
      compositionErrors: preflight.compositionErrors,
      summary: preflight.summary,
      results: preflight.results.map(publicImportResult),
    });
  }

  const removed = await replaceProductMasterCatalog();

  const analysis = await analyzeProductMasterBuffer(
    req.file.buffer,
    req.file.originalname || "",
    { replaceMode: true }
  );

  const postResetBlocking = analysis.results.filter((item) =>
    ["ERROR", "REVIEW"].includes(item.action)
  );

  if (analysis.compositionErrors.length > 0 || postResetBlocking.length > 0) {
    const error = new Error(
      "Catalogue reset completed, but the workbook became invalid during the fresh import analysis. Re-run Analyze File and fix the reported rows."
    );
    error.statusCode = 409;
    throw error;
  }

  const importedAt = new Date();
  const resultByRow = new Map();
  const summary = {
    totalRows: analysis.summary.totalRows,
    created: 0,
    updated: 0,
    skipped: 0,
    review: 0,
    errors: 0,
    removed,
  };

  for (const item of analysis.results) {
    if (item.recordType === "ready_made_hamper") continue;

    try {
      const Model = item.recordType === "container" ? Container : Component;
      const payload = {
        ...item._payload,
        source: {
          ...(item._payload?.source || {}),
          type: "product_master",
          externalSku: item.externalSku,
          lastSyncedAt: importedAt,
        },
      };

      await Model.create(payload);
      resultByRow.set(item.rowNumber, {
        ...publicImportResult(item),
        action: "CREATED",
      });
    } catch (error) {
      resultByRow.set(item.rowNumber, {
        ...publicImportResult(item),
        action: "ERROR",
        reason: error.message || "Unable to import this row",
      });
    }
  }

  const baseErrors = [...resultByRow.values()].filter(
    (item) => item.action === "ERROR"
  );

  if (baseErrors.length === 0) {
    const baseLookup = await buildImportedBaseLookup();

    for (const item of analysis.results) {
      if (item.recordType !== "ready_made_hamper") continue;

      try {
        const category = await ensureImportedCategory(
          item._payload.categoryName,
          importedAt
        );

        const productPayload = {
          ...item._payload.product,
          category: category._id,
          source: {
            ...(item._payload.product.source || {}),
            type: "product_master",
            externalSku: item.externalSku,
            lastSyncedAt: importedAt,
          },
        };

        const skuPayload = resolveReadyMadeReferences(
          {
            ...item._payload.sku,
            source: {
              ...(item._payload.sku.source || {}),
              type: "product_master",
              externalSku: item.externalSku,
              lastSyncedAt: importedAt,
            },
          },
          baseLookup
        );

        const product = await Product.create({
          ...productPayload,
          slug: await ensureUniqueSlug(Product, productPayload.name),
        });

        try {
          await SKU.create({
            ...skuPayload,
            product: product._id,
          });
        } catch (error) {
          await Product.findByIdAndDelete(product._id);
          throw error;
        }

        await syncProductPriceRange(product._id);

        resultByRow.set(item.rowNumber, {
          ...publicImportResult(item),
          action: "CREATED",
        });
      } catch (error) {
        resultByRow.set(item.rowNumber, {
          ...publicImportResult(item),
          action: "ERROR",
          reason: error.message || "Unable to import ready-made hamper",
        });
      }
    }
  } else {
    for (const item of analysis.results) {
      if (item.recordType !== "ready_made_hamper") continue;
      resultByRow.set(item.rowNumber, {
        ...publicImportResult(item),
        action: "ERROR",
        reason:
          "Ready-made hamper was not imported because one or more base component/container rows failed",
      });
    }
  }

  const results = [...analysis.results]
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map((item) => resultByRow.get(item.rowNumber) || publicImportResult(item));

  for (const item of results) {
    if (item.action === "CREATED") summary.created += 1;
    else if (item.action === "UPDATED") summary.updated += 1;
    else if (item.action === "SKIP") summary.skipped += 1;
    else if (item.action === "REVIEW") summary.review += 1;
    else if (item.action === "ERROR") summary.errors += 1;
  }

  const [databaseProducts, databaseSkus, databaseComponents, databaseContainers] =
    await Promise.all([
      Product.countDocuments({}),
      SKU.countDocuments({}),
      Component.countDocuments({}),
      Container.countDocuments({}),
    ]);

  const databaseState = {
    products: databaseProducts,
    skus: databaseSkus,
    components: databaseComponents,
    containers: databaseContainers,
  };

  res.status(200).json({
    success: summary.errors === 0,
    message:
      summary.errors === 0
        ? "Previous Product Master catalogue was replaced successfully with the new workbook"
        : "Previous Product Master catalogue was cleared and the new import completed with row errors",
    importMode: "replace_product_master",
    replacementStrategy: "testing_hard_replace",
    databaseState,
    filename: analysis.filename,
    sheetName: analysis.sheetName,
    compositionSheetName: analysis.compositionSheetName,
    containerSetupSheetName: analysis.containerSetupSheetName,
    decorationSheetName: analysis.decorationSheetName,
    summary,
    results,
  });
});


/* =========================================================
   PUBLIC COMPONENTS / CONTAINERS
========================================================= */

export const getComponents = asyncHandler(async (req, res) => {
  disableCatalogCaching(res);
  const { search, type, category, subcategory, segment, channel, hamperRole } = req.query;
  const filter = {
    isActive: true,
    customerSelectable: true,
    type: { $in: PUBLIC_COMPONENT_TYPES },
  };

  if (type) {
    if (!PUBLIC_COMPONENT_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid public component type",
      });
    }
    filter.type = type;
  }

  if (hamperRole) {
    if (!HAMPER_ROLES.includes(hamperRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hamper role",
      });
    }

    if (hamperRole === "decoration") {
      filter.hamperRole = "decoration";
    } else {
      filter.hamperUse = { $ne: false };
      filter.$and = [
        {
          $or: [
            { hamperRole: "content" },
            { hamperRole: { $exists: false } },
            { hamperRole: null },
          ],
        },
      ];
    }
  } else {
    filter.hamperUse = { $ne: false };
    filter.$and = [
      {
        $or: [
          { hamperRole: "content" },
          { hamperRole: { $exists: false } },
          { hamperRole: null },
        ],
      },
    ];
  }

  if (channel) {
    if (!CHANNEL_KEYS.includes(channel)) {
      return res.status(400).json({ success: false, message: "Invalid channel" });
    }
    filter[`channels.${channel}`] = true;
  }

  if (category?.trim()) filter.category = category.trim();
  if (subcategory?.trim()) filter.subcategory = subcategory.trim();
  if (segment?.trim()) filter.segment = segment.trim();

  if (search?.trim()) {
    const safeSearch = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { code: { $regex: safeSearch, $options: "i" } },
      { brand: { $regex: safeSearch, $options: "i" } },
      { category: { $regex: safeSearch, $options: "i" } },
      { subcategory: { $regex: safeSearch, $options: "i" } },
      { segment: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const components = await Component.find(filter)
    .select(
      "name code type hamperRole decorationType countsTowardBoxCapacity brand description images skuBarcode sizePack uom piecesPerUom sourceProductType taxonomyBaseId categoryCode category subcategory segment productPriority mrp sellingPrice taxEnabled taxPercent hsnSac discount dimensions weight fragile dietary expiryTracked shelfLifeDays expiryDate personalizable personalizationMethod hamperUse channels availability.status availability.availableQuantity availability.unit availability.nextAvailableDate"
    )
    .sort({ productPriority: 1, name: 1 })
    .lean();

  const publicComponents = components.map((component) => {
    const pricing = calculateCatalogPricing({
      baseSellingPrice: component.sellingPrice ?? 0,
      taxPercent: component.taxPercent ?? 0,
      taxEnabled: component.taxEnabled !== false,
      discount: component.discount || {},
    });

    return {
      ...component,
      baseSellingPrice: pricing.baseSellingPrice,
      sellingPrice: pricing.price,
      discountAmount: pricing.discountAmount,
      taxablePrice: pricing.taxableValue,
      taxAmount: pricing.taxAmount,
      taxIncluded: true,
    };
  });

  res.status(200).json({ success: true, components: publicComponents });
});

export const getContainers = asyncHandler(async (req, res) => {
  disableCatalogCaching(res);
  const { search, category, subcategory, segment, channel } = req.query;
  const filter = {
    isActive: true,
    customerSelectable: true,
    hamperUse: { $ne: false },
  };

  if (channel) {
    if (!CHANNEL_KEYS.includes(channel)) {
      return res.status(400).json({ success: false, message: "Invalid channel" });
    }
    filter[`channels.${channel}`] = true;
  }

  if (category?.trim()) filter.category = category.trim();
  if (subcategory?.trim()) filter.subcategory = subcategory.trim();
  if (segment?.trim()) filter.segment = segment.trim();

  if (search?.trim()) {
    const safeSearch = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { code: { $regex: safeSearch, $options: "i" } },
      { material: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const containers = await Container.find(filter)
    .select(
      "name code material description images skuBarcode sourceProductType taxonomyBaseId categoryCode category subcategory segment productPriority mrp sellingPrice taxEnabled taxPercent hsnSac discount outerDimensions innerDimensions maxContentWeight usableVolumePercent maxItems productionLeadTime defaultCourierDays hamperUse channels availability.status availability.nextAvailableDate sortOrder"
    )
    .sort({ sortOrder: 1, productPriority: 1, name: 1 })
    .lean();

  res.status(200).json({
    success: true,
    containers: containers.map((container) => {
      const pricing = calculateCatalogPricing({
        baseSellingPrice: container.sellingPrice ?? 0,
        taxPercent: container.taxPercent ?? 0,
        taxEnabled: container.taxEnabled !== false,
        discount: container.discount || {},
      });

      return {
        ...container,
        baseSellingPrice: pricing.baseSellingPrice,
        sellingPrice: pricing.price,
        discountAmount: pricing.discountAmount,
        taxablePrice: pricing.taxableValue,
        taxAmount: pricing.taxAmount,
        taxIncluded: true,
        capacity: calculateContainerCapacity(container),
      };
    }),
  });
});

/* =========================================================
   PUBLIC CONFIGURATION VALIDATION
========================================================= */

export const validateConfiguration = asyncHandler(async (req, res) => {
  const {
    containerId,
    items = [],
    decorations = [],
    candidateIds,
    courierDays,
    channel,
  } = req.body;

  if (!isValidId(containerId)) {
    return res.status(400).json({
      success: false,
      message: "Valid containerId is required",
    });
  }

  if (channel && !CHANNEL_KEYS.includes(channel)) {
    return res.status(400).json({ success: false, message: "Invalid channel" });
  }

  const containerFilter = {
    _id: containerId,
    isActive: true,
    customerSelectable: true,
    hamperUse: { $ne: false },
  };

  if (channel) containerFilter[`channels.${channel}`] = true;

  const container = await Container.findOne(containerFilter)
    .select("-internalNotes -latestUnitCost -actualLandedCost")
    .lean();

  if (!container) {
    return res.status(404).json({
      success: false,
      message: "Selectable container not found",
    });
  }

  const normalizedItems = normalizeConfigurationItems(items);
  if (!normalizedItems.valid) {
    return res.status(400).json({
      success: false,
      message: normalizedItems.message,
    });
  }

  const normalizedDecorations = normalizeConfigurationItems(decorations);
  if (!normalizedDecorations.valid) {
    return res.status(400).json({
      success: false,
      message: normalizedDecorations.message.replace(
        /Configuration quantity/g,
        "Decoration quantity"
      ),
    });
  }

  const selectedIds = normalizedItems.items.map((item) => item.componentId);
  const decorationIds = normalizedDecorations.items.map(
    (item) => item.componentId
  );

  const requestedCandidateIds = Array.isArray(candidateIds)
    ? [...new Set(candidateIds.map(String).filter((id) => isValidId(id)))]
    : null;

  const allIds = [
    ...new Set([
      ...selectedIds,
      ...decorationIds,
      ...(requestedCandidateIds || []),
    ]),
  ];

  const componentFilter = {
    isActive: true,
    customerSelectable: true,
    type: { $in: PUBLIC_COMPONENT_TYPES },
  };

  if (channel) componentFilter[`channels.${channel}`] = true;
  if (allIds.length > 0) componentFilter._id = { $in: allIds };

  const baseComponents = await Component.find(componentFilter)
    .select(
      "_id name code type hamperRole decorationType countsTowardBoxCapacity brand images category subcategory segment mrp sellingPrice taxEnabled taxPercent hsnSac discount dimensions weight fragile dietary expiryTracked shelfLifeDays expiryDate personalizable personalizationMethod channels availability isActive customerSelectable hamperUse"
    )
    .lean();

  const componentMap = new Map(
    baseComponents.map((component) => [String(component._id), component])
  );

  for (const selectedId of selectedIds) {
    const component = componentMap.get(String(selectedId));

    if (
      !component ||
      component.hamperUse === false ||
      (component.hamperRole || "content") === "decoration"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected hamper contents are inactive, unavailable for this channel, unavailable for custom hampers, decorative-only, or do not exist",
      });
    }
  }

  for (const decorationId of decorationIds) {
    const component = componentMap.get(String(decorationId));

    if (!component || (component.hamperRole || "content") !== "decoration") {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected decorative materials are inactive, unavailable for this channel, not configured as decorative material, or do not exist",
      });
    }
  }

  const physical = evaluatePhysicalConfiguration(
    container,
    normalizedItems.items,
    componentMap
  );

  const courier = parseCourierDays(courierDays, container.defaultCourierDays);
  if (!courier.valid) {
    return res.status(400).json({ success: false, message: courier.message });
  }

  const deliveryEstimate = await calculateCustomConfigurationEta(
    container,
    normalizedItems.items,
    componentMap,
    courier.value,
    normalizedDecorations.items
  );

  const pricing = calculateConfigurationPricing(
    container,
    normalizedItems.items,
    componentMap,
    normalizedDecorations.items
  );

  let candidates = [];

  if (Array.isArray(candidateIds)) {
    candidates = requestedCandidateIds.map((candidateId) => {
      const component = componentMap.get(String(candidateId));

      if (
        !component ||
        (component.hamperRole || "content") === "decoration"
      ) {
        return {
          componentId: candidateId,
          selectable: false,
          reason: "UNAVAILABLE",
          message: configurationReasonMessage("UNAVAILABLE"),
          maxAdditionalQuantity: 0,
        };
      }

      if (!hasPrice(component.sellingPrice)) {
        return {
          componentId: candidateId,
          name: component.name,
          code: component.code,
          selectable: false,
          reason: "PRICE_NOT_SET",
          message: configurationReasonMessage("PRICE_NOT_SET"),
          maxAdditionalQuantity: 0,
        };
      }

      const baseQuantity =
        normalizedItems.items.find(
          (item) => String(item.componentId) === String(candidateId)
        )?.quantity || 0;

      const maxSearch = 100;
      let maxAdditionalQuantity = 0;
      let firstFailure = null;

      for (let additional = 1; additional <= maxSearch; additional += 1) {
        const totalCandidateQuantity = baseQuantity + additional;
        const candidateReady = resolveDependencyReadyDate(
          component,
          toUtcDay(new Date()),
          {
            requiredQuantity: totalCandidateQuantity,
            requiredUnit: "pc",
            stockUnit: true,
          }
        );

        if (!candidateReady.ready) {
          firstFailure = { reason: "UNAVAILABLE" };
          break;
        }

        const nextSelections = normalizedItems.items.filter(
          (item) => String(item.componentId) !== String(candidateId)
        );

        nextSelections.push({
          componentId: candidateId,
          quantity: totalCandidateQuantity,
        });

        const evaluation = evaluatePhysicalConfiguration(
          container,
          nextSelections,
          componentMap
        );

        if (!evaluation.valid) {
          firstFailure = evaluation;
          break;
        }

        maxAdditionalQuantity = additional;
      }

      return {
        componentId: candidateId,
        name: component.name,
        code: component.code,
        sellingPrice: component.sellingPrice,
        mrp: component.mrp,
        selectable: maxAdditionalQuantity > 0,
        reason:
          maxAdditionalQuantity > 0
            ? null
            : firstFailure?.reason || "PACKING_LAYOUT_NOT_FIT",
        message:
          maxAdditionalQuantity > 0
            ? null
            : configurationReasonMessage(
                firstFailure?.reason || "PACKING_LAYOUT_NOT_FIT"
              ),
        maxAdditionalQuantity,
      };
    });
  }

  const selectedExpiryDates = normalizedItems.items
    .map((item) => componentMap.get(String(item.componentId)))
    .filter(
      (component) => component?.expiryTracked !== false && component?.expiryDate
    )
    .map((component) => new Date(component.expiryDate))
    .filter((date) => !Number.isNaN(date.getTime()));

  const earliestExpiryDate = selectedExpiryDates.length
    ? new Date(Math.min(...selectedExpiryDates.map((date) => date.getTime())))
    : null;

  const finalReason = !physical.valid
    ? physical.reason
    : !deliveryEstimate.canEstimate
      ? "UNAVAILABLE"
      : !pricing.complete
        ? "PRICE_NOT_SET"
        : null;

  res.status(200).json({
    success: true,
    configuration: {
      valid: physical.valid,
      orderable:
        physical.valid && deliveryEstimate.canEstimate && pricing.complete,
      reason: finalReason,
      message: finalReason ? configurationReasonMessage(finalReason) : null,
      channel: channel || null,
      container: {
        _id: container._id,
        name: container.name,
        code: container.code,
        sellingPrice: container.sellingPrice ?? null,
        mrp: container.mrp ?? null,
        innerDimensions: container.innerDimensions,
        maxContentWeight: container.maxContentWeight,
        usableVolumePercent: container.usableVolumePercent,
        maxItems: container.maxItems,
      },
      selectedItems: pricing.items,
      selectedDecorations: pricing.decorations,
      pricing,
      earliestExpiryDate,
      capacity: physical.capacity || null,
      deliveryEstimate,
      candidates,
    },
  });
});

/* =========================================================
   PUBLIC TAXONOMY / PRODUCTS
========================================================= */

export const getCategories = asyncHandler(async (req, res) => {
  disableCatalogCaching(res);
  const categories = await Category.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  res.status(200).json({ success: true, categories });
});

export const getCollections = asyncHandler(async (req, res) => {
  disableCatalogCaching(res);
  const collections = await Collection.find({ isActive: true })
    .sort({ isFeatured: -1, sortOrder: 1, name: 1 })
    .lean();

  res.status(200).json({ success: true, collections });
});

export const getProducts = asyncHandler(async (req, res) => {
  disableCatalogCaching(res);
  const {
    search,
    category,
    collection,
    minPrice,
    maxPrice,
    featured,
    sort,
  } = req.query;

  const { page, limit, skip } = getPagination(req.query);
  const filter = {
    status: PRODUCT_STATUS.ACTIVE,
    minPrice: { $ne: null },
  };

  if (search?.trim()) {
    const safeSearch = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { shortDescription: { $regex: safeSearch, $options: "i" } },
      { tags: { $regex: safeSearch, $options: "i" } },
    ];
  }

  if (category) {
    const categoryId = await resolveCategoryFilter(category);
    if (!categoryId) {
      return res.status(200).json({
        success: true,
        products: [],
        pagination: getPaginationMeta(0, page, limit),
      });
    }
    filter.category = categoryId;
  }

  if (collection) {
    const collectionId = await resolveCollectionFilter(collection);
    if (!collectionId) {
      return res.status(200).json({
        success: true,
        products: [],
        pagination: getPaginationMeta(0, page, limit),
      });
    }
    filter.collections = collectionId;
  }

  const parsedMinPrice = Number(minPrice);
  const parsedMaxPrice = Number(maxPrice);

  if (
    minPrice !== undefined &&
    minPrice !== "" &&
    Number.isFinite(parsedMinPrice) &&
    parsedMinPrice >= 0
  ) {
    filter.maxPrice = { $gte: parsedMinPrice };
  }

  if (
    maxPrice !== undefined &&
    maxPrice !== "" &&
    Number.isFinite(parsedMaxPrice) &&
    parsedMaxPrice >= 0
  ) {
    filter.minPrice = { ...filter.minPrice, $lte: parsedMaxPrice };
  }

  const featuredValue = parseBoolean(featured);
  if (featuredValue !== undefined) filter.isFeatured = featuredValue;

  let sortQuery = { createdAt: -1 };
  if (sort === "price-low") sortQuery = { minPrice: 1, createdAt: -1 };
  if (sort === "price-high") sortQuery = { minPrice: -1, createdAt: -1 };
  if (sort === "name") sortQuery = { name: 1 };
  if (sort === "featured") sortQuery = { isFeatured: -1, createdAt: -1 };

  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .populate("category", "name slug")
    .populate("collections", "name slug")
    .sort(sortQuery)
    .skip(skip)
    .limit(limit)
    .lean();

  const productIds = products.map((product) => product._id);
  const rawSkus = productIds.length
    ? await SKU.find({ product: { $in: productIds }, isActive: true })
        .select(
          "product code price mrp compareAtPrice discount baseSellingPrice taxEnabled taxPercent container hamperContents packagedDimensions packagedWeight sortOrder"
        )
        .populate({
          path: "container",
          select: "outerDimensions",
        })
        .populate({
          path: "hamperContents.component",
          select: "weight",
        })
        .sort({ sortOrder: 1, price: 1 })
        .lean()
    : [];

  const skusByProduct = new Map();

  for (const sku of rawSkus) {
    const key = String(sku.product);

    if (!skusByProduct.has(key)) {
      skusByProduct.set(key, []);
    }

    skusByProduct.get(key).push(sku);
  }

  const publicProducts = products.map((product) => {
    const productSkus =
      skusByProduct.get(
        String(product._id)
      ) || [];

    const summarySku =
      productSkus[0] || null;

    const pricingSummary =
      buildCatalogCardPricing(
        productSkus
      );

    return {
      ...product,

      hamperSummary:
        summarySku
          ? calculateReadyMadeHamperMetrics(
              summarySku
            )
          : null,

      /*
       * Card pricing is resolved from the cheapest active SKU
       * so the displayed selling price, MRP and OFF percentage
       * all refer to the same SKU.
       */
      pricingSummary,

      // Convenient aliases for existing frontend cards.
      cardPrice:
        pricingSummary.sellingPrice,

      compareAtPrice:
        pricingSummary.compareAtPrice,

      mrp:
        pricingSummary.mrp,

      discountAmount:
        pricingSummary.discountAmount,

      discountPercent:
        pricingSummary.discountPercent,

      hasDiscount:
        pricingSummary.hasDiscount,
    };
  });

  res.status(200).json({
    success: true,
    products: publicProducts,
    pagination: getPaginationMeta(total, page, limit),
  });
});


export const getProductBySlug = asyncHandler(async (req, res) => {
  disableCatalogCaching(res);
  const { slug } = req.params;

  const product = await Product.findOne({
    slug: String(slug).trim().toLowerCase(),
    status: PRODUCT_STATUS.ACTIVE,
  })
    .populate("category", "name slug description")
    .populate("collections", "name slug")
    .lean();

  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  const rawSkus = await SKU.find({
    product: product._id,
    isActive: true,
  })
    .select(
      "product code name optionValues baseSellingPrice mrp taxEnabled taxPercent hsnSac discount price compareAtPrice images container hamperContents internalMaterials decorations packagedDimensions packagedWeight productionLeadTime defaultCourierDays earliestExpiryDate isActive sortOrder createdAt updatedAt"
    )
    .populate({
      path: "container",
      select:
        "name code material images outerDimensions innerDimensions maxContentWeight usableVolumePercent maxItems availability productionLeadTime defaultCourierDays",
    })
    .populate({
      path: "hamperContents.component",
      select:
        "name code type hamperRole brand images sizePack uom dimensions weight fragile dietary expiryTracked shelfLifeDays expiryDate personalizable personalizationMethod availability",
    })
    .populate({
      path: "decorations.component",
      select:
        "name code type hamperRole decorationType brand images sizePack uom personalizable personalizationMethod availability sellingPrice taxEnabled taxPercent hsnSac discount",
    })
    .sort({ sortOrder: 1, price: 1 })
    .lean();

  const skus = await Promise.all(
    rawSkus.map(async (sku) => {
      const courier = parseCourierDays(req.query.courierDays, sku.defaultCourierDays);

      if (!courier.valid) {
        const error = new Error(courier.message);
        error.statusCode = 400;
        throw error;
      }

      const deliveryEstimate = await calculateSkuDeliveryEstimate(sku, {
        courierDays: courier.value,
        includeDetails: false,
      });

      const hamperMetrics = calculateReadyMadeHamperMetrics(sku);
      const { internalMaterials, ...publicSku } = sku;

      return {
        ...publicSku,
        hamperMetrics,
        deliveryEstimate,
      };
    })
  );

  res.status(200).json({
    success: true,
    product: { ...product, skus },
  });
});


/* =========================================================
   IMAGE UPLOAD
========================================================= */

export const uploadCatalogImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Image file is required" });
  }

  const allowedTypes = [
    "product",
    "sku",
    "category",
    "collection",
    "component",
    "container",
  ];

  const type = allowedTypes.includes(req.body.type) ? req.body.type : "product";
  const folderMap = {
    product: "hamporium/catalog/products",
    sku: "hamporium/catalog/skus",
    category: "hamporium/catalog/categories",
    collection: "hamporium/catalog/collections",
    component: "hamporium/catalog/components",
    container: "hamporium/catalog/containers",
  };

  const image = await uploadFile(req.file.buffer, { folder: folderMap[type] });

  res.status(201).json({
    success: true,
    message: "Image uploaded successfully",
    image,
  });
});

export const deleteCatalogImage = asyncHandler(async (req, res) => {
  const { publicId } = req.body;

  if (!publicId?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Image public ID is required",
    });
  }

  await deleteFile(publicId.trim());

  res.status(200).json({
    success: true,
    message: "Image deleted successfully",
  });
});

/* =========================================================
   ADMIN CATEGORIES
========================================================= */

export const getAdminCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find()
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  res.status(200).json({ success: true, categories });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, image, imagePublicId, isActive, sortOrder } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: "Category name is required" });
  }

  const slug = await ensureUniqueSlug(Category, name);
  const activeValue = parseBoolean(isActive);

  if (isActive !== undefined && activeValue === undefined) {
    return res.status(400).json({ success: false, message: "isActive must be true or false" });
  }

  const category = await Category.create({
    name: name.trim(),
    slug,
    description: description || "",
    image: image || "",
    imagePublicId: imagePublicId || "",
    isActive: activeValue ?? true,
    sortOrder: Number(sortOrder) || 0,
  });

  res.status(201).json({ success: true, message: "Category created successfully", category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  if (!isValidId(categoryId)) {
    return res.status(400).json({ success: false, message: "Invalid category ID" });
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    return res.status(404).json({ success: false, message: "Category not found" });
  }

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Category name cannot be empty" });
    }
    category.name = name;
  }

  if (req.body.description !== undefined) category.description = req.body.description;
  if (req.body.image !== undefined) category.image = req.body.image;
  if (req.body.imagePublicId !== undefined) category.imagePublicId = req.body.imagePublicId;
  if (req.body.sortOrder !== undefined) category.sortOrder = Number(req.body.sortOrder) || 0;

  if (req.body.isActive !== undefined) {
    const activeValue = parseBoolean(req.body.isActive);
    if (activeValue === undefined) {
      return res.status(400).json({ success: false, message: "isActive must be true or false" });
    }
    category.isActive = activeValue;
  }

  if (req.body.slug) {
    category.slug = await ensureUniqueSlug(Category, req.body.slug, category._id);
  }

  await category.save();
  res.status(200).json({ success: true, message: "Category updated successfully", category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  if (!isValidId(categoryId)) {
    return res.status(400).json({ success: false, message: "Invalid category ID" });
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    return res.status(404).json({ success: false, message: "Category not found" });
  }

  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    return res.status(409).json({
      success: false,
      message: "Category cannot be deleted because products are using it. Disable it instead.",
    });
  }

  await category.deleteOne();
  res.status(200).json({ success: true, message: "Category deleted successfully" });
});

/* =========================================================
   ADMIN COLLECTIONS
========================================================= */

export const getAdminCollections = asyncHandler(async (req, res) => {
  const collections = await Collection.find()
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  res.status(200).json({ success: true, collections });
});

export const createCollection = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    image,
    imagePublicId,
    bannerImage,
    bannerImagePublicId,
    isFeatured,
    isActive,
    sortOrder,
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: "Collection name is required" });
  }

  const slug = await ensureUniqueSlug(Collection, name);
  const featuredValue = parseBoolean(isFeatured);
  const activeValue = parseBoolean(isActive);

  if (isFeatured !== undefined && featuredValue === undefined) {
    return res.status(400).json({ success: false, message: "isFeatured must be true or false" });
  }

  if (isActive !== undefined && activeValue === undefined) {
    return res.status(400).json({ success: false, message: "isActive must be true or false" });
  }

  const collection = await Collection.create({
    name: name.trim(),
    slug,
    description: description || "",
    image: image || "",
    imagePublicId: imagePublicId || "",
    bannerImage: bannerImage || "",
    bannerImagePublicId: bannerImagePublicId || "",
    isFeatured: featuredValue ?? false,
    isActive: activeValue ?? true,
    sortOrder: Number(sortOrder) || 0,
  });

  res.status(201).json({ success: true, message: "Collection created successfully", collection });
});

export const updateCollection = asyncHandler(async (req, res) => {
  const { collectionId } = req.params;

  if (!isValidId(collectionId)) {
    return res.status(400).json({ success: false, message: "Invalid collection ID" });
  }

  const collection = await Collection.findById(collectionId);
  if (!collection) {
    return res.status(404).json({ success: false, message: "Collection not found" });
  }

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Collection name cannot be empty" });
    }
    collection.name = name;
  }

  if (req.body.description !== undefined) collection.description = req.body.description;
  if (req.body.image !== undefined) collection.image = req.body.image;
  if (req.body.imagePublicId !== undefined) collection.imagePublicId = req.body.imagePublicId;
  if (req.body.bannerImage !== undefined) collection.bannerImage = req.body.bannerImage;
  if (req.body.bannerImagePublicId !== undefined) {
    collection.bannerImagePublicId = req.body.bannerImagePublicId;
  }
  if (req.body.sortOrder !== undefined) collection.sortOrder = Number(req.body.sortOrder) || 0;

  if (req.body.isFeatured !== undefined) {
    const featuredValue = parseBoolean(req.body.isFeatured);
    if (featuredValue === undefined) {
      return res.status(400).json({ success: false, message: "isFeatured must be true or false" });
    }
    collection.isFeatured = featuredValue;
  }

  if (req.body.isActive !== undefined) {
    const activeValue = parseBoolean(req.body.isActive);
    if (activeValue === undefined) {
      return res.status(400).json({ success: false, message: "isActive must be true or false" });
    }
    collection.isActive = activeValue;
  }

  if (req.body.slug) {
    collection.slug = await ensureUniqueSlug(Collection, req.body.slug, collection._id);
  }

  await collection.save();
  res.status(200).json({ success: true, message: "Collection updated successfully", collection });
});

export const deleteCollection = asyncHandler(async (req, res) => {
  const { collectionId } = req.params;

  if (!isValidId(collectionId)) {
    return res.status(400).json({ success: false, message: "Invalid collection ID" });
  }

  const collection = await Collection.findById(collectionId);
  if (!collection) {
    return res.status(404).json({ success: false, message: "Collection not found" });
  }

  await Product.updateMany(
    { collections: collection._id },
    { $pull: { collections: collection._id } }
  );

  await collection.deleteOne();
  res.status(200).json({ success: true, message: "Collection deleted successfully" });
});

/* =========================================================
   ADMIN COMPONENTS
========================================================= */

export const getAdminComponents = asyncHandler(async (req, res) => {
  const {
    search,
    type,
    isActive,
    customerSelectable,
    availability,
    category,
    subcategory,
    segment,
    channel,
    hamperUse,
    hamperRole,
  } = req.query;

  const { page, limit, skip } = getPagination(req.query, 30);
  const filter = {};

  if (search?.trim()) {
    const safeSearch = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { code: { $regex: safeSearch, $options: "i" } },
      { brand: { $regex: safeSearch, $options: "i" } },
      { "source.externalSku": { $regex: safeSearch, $options: "i" } },
    ];
  }

  if (type && COMPONENT_TYPES.includes(type)) filter.type = type;
  if (hamperRole && HAMPER_ROLES.includes(hamperRole)) {
    if (hamperRole === "decoration") {
      filter.hamperRole = "decoration";
    } else {
      filter.$and = [
        {
          $or: [
            { hamperRole: "content" },
            { hamperRole: { $exists: false } },
            { hamperRole: null },
          ],
        },
      ];
    }
  }
  if (category?.trim()) filter.category = category.trim();
  if (subcategory?.trim()) filter.subcategory = subcategory.trim();
  if (segment?.trim()) filter.segment = segment.trim();

  if (channel) {
    if (!CHANNEL_KEYS.includes(channel)) {
      return res.status(400).json({ success: false, message: "Invalid channel" });
    }
    filter[`channels.${channel}`] = true;
  }

  const activeValue = parseBoolean(isActive);
  if (activeValue !== undefined) filter.isActive = activeValue;

  const selectableValue = parseBoolean(customerSelectable);
  if (selectableValue !== undefined) filter.customerSelectable = selectableValue;

  const hamperUseValue = parseBoolean(hamperUse);
  if (hamperUseValue !== undefined) filter.hamperUse = hamperUseValue;

  if (availability && AVAILABILITY_VALUES.includes(availability)) {
    filter["availability.status"] = availability;
  }

  const total = await Component.countDocuments(filter);
  const components = await Component.find(filter)
    .sort({ productPriority: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.status(200).json({
    success: true,
    components,
    pagination: getPaginationMeta(total, page, limit),
  });
});

export const getAdminComponentById = asyncHandler(async (req, res) => {
  const { componentId } = req.params;

  if (!isValidId(componentId)) {
    return res.status(400).json({ success: false, message: "Invalid component ID" });
  }

  const component = await Component.findById(componentId).lean();
  if (!component) {
    return res.status(404).json({ success: false, message: "Component not found" });
  }

  res.status(200).json({ success: true, component });
});

export const createComponent = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    type,
    hamperRole,
    brand,
    description,
    images,
    dimensions,
    weight,
    expiryDate,
    availability,
    customerSelectable,
    isActive,
    internalNotes,
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: "Component name is required" });
  }

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Component code is required" });
  }

  if (!COMPONENT_TYPES.includes(type)) {
    return res.status(400).json({ success: false, message: "Invalid component type" });
  }

  if (hamperRole !== undefined && !HAMPER_ROLES.includes(hamperRole)) {
    return res.status(400).json({ success: false, message: "Invalid hamper role" });
  }

  const finalHamperRole = type === "packaging" ? "content" : hamperRole || "content";

  if (finalHamperRole === "decoration" && type !== "non_food") {
    return res.status(400).json({
      success: false,
      message: "Decorative materials must use the non_food component type",
    });
  }

  const normalizedCode = code.trim().toUpperCase();
  const exists = await Component.exists({ code: normalizedCode });

  if (exists) {
    return res.status(409).json({ success: false, message: "Component code already exists" });
  }

  const selectableValue = parseBoolean(customerSelectable);
  const activeValue = parseBoolean(isActive);
  const hamperUseValue = parseBoolean(req.body.hamperUse);
  const expiryTrackedValue = parseBoolean(req.body.expiryTracked);

  if (customerSelectable !== undefined && selectableValue === undefined) {
    return res.status(400).json({
      success: false,
      message: "customerSelectable must be true or false",
    });
  }

  if (isActive !== undefined && activeValue === undefined) {
    return res.status(400).json({ success: false, message: "isActive must be true or false" });
  }

  if (req.body.hamperUse !== undefined && hamperUseValue === undefined) {
    return res.status(400).json({ success: false, message: "hamperUse must be true or false" });
  }

  if (req.body.expiryTracked !== undefined && expiryTrackedValue === undefined) {
    return res.status(400).json({ success: false, message: "expiryTracked must be true or false" });
  }

  const finalHamperUse = hamperUseValue ?? true;
  const finalExpiryTracked =
    type === "packaging" || finalHamperRole === "decoration"
      ? false
      : expiryTrackedValue ?? type === "food";
  const finalSelectable =
    type === "packaging"
      ? false
      : finalHamperRole === "decoration"
        ? selectableValue ?? false
        : !finalHamperUse
          ? false
          : selectableValue ?? false;

  const validationError = validateComponentPayload({
    ...req.body,
    type,
    hamperRole: finalHamperRole,
    expiryDate,
    expiryTracked: finalExpiryTracked,
    dimensions,
    weight,
    customerSelectable: finalSelectable,
    availability,
  });

  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const component = new Component({
    name: name.trim(),
    code: normalizedCode,
    type,
    hamperRole: finalHamperRole,
    brand: brand?.trim() || "",
    description: description || "",
    images: Array.isArray(images) ? images : [],
    dimensions: normalizeDimensions(dimensions),
    weight: normalizeWeight(weight),
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    availability: normalizeAvailability(availability, { stockUnit: true }),
    customerSelectable: finalSelectable,
    isActive: activeValue ?? true,
    internalNotes: internalNotes || "",
  });

  applyComponentMasterFields(component, req.body);
  component.hamperRole = finalHamperRole;
  component.hamperUse = finalHamperUse;
  component.expiryTracked = finalExpiryTracked;

  if (type === "packaging") {
    component.hamperRole = "content";
    component.customerSelectable = false;
    component.expiryDate = null;
  }

  if (component.hamperRole === "decoration") {
    component.expiryTracked = false;
    component.expiryDate = null;
    component.countsTowardBoxCapacity = false;
  }

  await component.save();

  res.status(201).json({
    success: true,
    message: "Component created successfully",
    component,
  });
});

export const updateComponent = asyncHandler(async (req, res) => {
  const { componentId } = req.params;

  if (!isValidId(componentId)) {
    return res.status(400).json({ success: false, message: "Invalid component ID" });
  }

  const component = await Component.findById(componentId);
  if (!component) {
    return res.status(404).json({ success: false, message: "Component not found" });
  }

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Component name cannot be empty" });
    }
    component.name = name;
  }

  if (req.body.code !== undefined) {
    const newCode = String(req.body.code).trim().toUpperCase();
    if (!newCode) {
      return res.status(400).json({ success: false, message: "Component code cannot be empty" });
    }

    const exists = await Component.exists({
      code: newCode,
      _id: { $ne: component._id },
    });

    if (exists) {
      return res.status(409).json({ success: false, message: "Component code already exists" });
    }

    component.code = newCode;
  }

  const nextType = req.body.type !== undefined ? req.body.type : component.type;
  if (!COMPONENT_TYPES.includes(nextType)) {
    return res.status(400).json({ success: false, message: "Invalid component type" });
  }

  let nextHamperRole =
    req.body.hamperRole !== undefined
      ? req.body.hamperRole
      : component.hamperRole || "content";

  if (!HAMPER_ROLES.includes(nextHamperRole)) {
    return res.status(400).json({ success: false, message: "Invalid hamper role" });
  }

  if (nextType === "packaging") nextHamperRole = "content";

  if (nextHamperRole === "decoration" && nextType !== "non_food") {
    return res.status(400).json({
      success: false,
      message: "Decorative materials must use the non_food component type",
    });
  }

  if (
    nextHamperRole === "decoration" &&
    (component.hamperRole || "content") !== "decoration"
  ) {
    const usedAsContent = await SKU.exists({
      "hamperContents.component": component._id,
    });

    if (usedAsContent) {
      return res.status(409).json({
        success: false,
        message:
          "Component is used in a ready-made hamper SKU and cannot be changed to a decorative material",
      });
    }
  }

  if (
    nextHamperRole !== "decoration" &&
    (component.hamperRole || "content") === "decoration"
  ) {
    const usedAsDecoration = await SKU.exists({
      "decorations.component": component._id,
    });

    if (usedAsDecoration) {
      return res.status(409).json({
        success: false,
        message:
          "Component is used in ready-made hamper decorations and cannot leave the decoration role",
      });
    }
  }

  if (req.body.type !== undefined && nextType !== component.type) {
    if (nextType === "packaging") {
      const usedAsContentOrDecoration = await SKU.exists({
        $or: [
          { "hamperContents.component": component._id },
          { "decorations.component": component._id },
        ],
      });

      if (usedAsContentOrDecoration) {
        return res.status(409).json({
          success: false,
          message:
            "Component is used in hamper contents/decorations and cannot be changed to packaging",
        });
      }
    } else {
      const usedAsSkuMaterial = await SKU.exists({
        "internalMaterials.component": component._id,
      });
      const usedAsContainerMaterial = await Container.exists({
        "packingMaterials.component": component._id,
      });

      if (usedAsSkuMaterial || usedAsContainerMaterial) {
        return res.status(409).json({
          success: false,
          message:
            "Component is used as packaging material and cannot be changed to a customer item type",
        });
      }
    }
  }

  let nextHamperUse = component.hamperUse !== false;
  if (req.body.hamperUse !== undefined) {
    const value = parseBoolean(req.body.hamperUse);
    if (value === undefined) {
      return res.status(400).json({ success: false, message: "hamperUse must be true or false" });
    }
    nextHamperUse = value;
  }

  let nextSelectable = component.customerSelectable;
  if (req.body.customerSelectable !== undefined) {
    const value = parseBoolean(req.body.customerSelectable);
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: "customerSelectable must be true or false",
      });
    }
    nextSelectable = value;
  }

  if (nextType === "packaging") nextSelectable = false;
  if (nextHamperRole !== "decoration" && !nextHamperUse) nextSelectable = false;

  let nextExpiryTracked = Boolean(component.expiryTracked);
  if (req.body.expiryTracked !== undefined) {
    const value = parseBoolean(req.body.expiryTracked);
    if (value === undefined) {
      return res.status(400).json({ success: false, message: "expiryTracked must be true or false" });
    }
    nextExpiryTracked = value;
  } else if (req.body.type !== undefined && nextType === "food" && component.type !== "food") {
    nextExpiryTracked = true;
  }

  if (nextType === "packaging" || nextHamperRole === "decoration") {
    nextExpiryTracked = false;
  }

  const currentDimensions = toPlainObject(component.dimensions);
  const currentWeight = toPlainObject(component.weight);
  const currentAvailability = toPlainObject(component.availability);

  const nextDimensions =
    req.body.dimensions !== undefined
      ? { ...currentDimensions, ...req.body.dimensions }
      : currentDimensions;

  const nextWeight =
    req.body.weight !== undefined
      ? { ...currentWeight, ...req.body.weight }
      : currentWeight;

  const nextAvailability =
    req.body.availability !== undefined
      ? { ...currentAvailability, ...req.body.availability }
      : currentAvailability;

  const nextExpiry =
    req.body.expiryDate !== undefined ? req.body.expiryDate : component.expiryDate;

  const validationError = validateComponentPayload({
    ...req.body,
    type: nextType,
    hamperRole: nextHamperRole,
    expiryDate: nextExpiry,
    expiryTracked: nextExpiryTracked,
    dimensions: nextDimensions,
    weight: nextWeight,
    customerSelectable: nextSelectable,
    availability: nextAvailability,
  });

  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  component.type = nextType;
  component.hamperRole = nextHamperRole;
  component.hamperUse = nextHamperUse;
  component.customerSelectable = nextSelectable;
  component.expiryTracked = nextExpiryTracked;

  if (req.body.brand !== undefined) component.brand = String(req.body.brand || "").trim();
  if (req.body.description !== undefined) component.description = req.body.description || "";
  if (req.body.images !== undefined) {
    component.images = Array.isArray(req.body.images) ? req.body.images : [];
  }
  if (req.body.dimensions !== undefined) {
    component.dimensions = normalizeDimensions(nextDimensions);
  }
  if (req.body.weight !== undefined) component.weight = normalizeWeight(nextWeight);
  if (req.body.availability !== undefined) {
    component.availability = normalizeAvailability(nextAvailability, { stockUnit: true });
  }

  if (req.body.expiryDate !== undefined) {
    component.expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
  }

  if (nextType === "packaging" || nextHamperRole === "decoration") {
    component.expiryDate = null;
  }

  if (req.body.isActive !== undefined) {
    const activeValue = parseBoolean(req.body.isActive);
    if (activeValue === undefined) {
      return res.status(400).json({ success: false, message: "isActive must be true or false" });
    }
    component.isActive = activeValue;
  }

  if (req.body.internalNotes !== undefined) {
    component.internalNotes = req.body.internalNotes || "";
  }

  applyComponentMasterFields(component, req.body);
  component.hamperRole = nextHamperRole;
  component.hamperUse = nextHamperUse;
  component.expiryTracked = nextExpiryTracked;
  component.customerSelectable = nextSelectable;
  if (component.hamperRole === "decoration") {
    component.countsTowardBoxCapacity = false;
  }

  await component.save();

  if (
    req.body.expiryDate !== undefined ||
    req.body.type !== undefined ||
    req.body.expiryTracked !== undefined
  ) {
    await syncSkuExpiryForComponent(component._id);
  }

  res.status(200).json({
    success: true,
    message: "Component updated successfully",
    component,
  });
});

export const deleteComponent = asyncHandler(async (req, res) => {
  const { componentId } = req.params;

  if (!isValidId(componentId)) {
    return res.status(400).json({ success: false, message: "Invalid component ID" });
  }

  const component = await Component.findById(componentId);
  if (!component) {
    return res.status(404).json({ success: false, message: "Component not found" });
  }

  const usedBySKU = await SKU.exists({
    $or: [
      { "hamperContents.component": component._id },
      { "internalMaterials.component": component._id },
      { "decorations.component": component._id },
    ],
  });

  const usedByContainer = await Container.exists({
    "packingMaterials.component": component._id,
  });

  if (usedBySKU || usedByContainer) {
    return res.status(409).json({
      success: false,
      message: "Component is in use. Disable it instead of deleting it.",
    });
  }

  await component.deleteOne();
  res.status(200).json({ success: true, message: "Component deleted successfully" });
});

/* =========================================================
   ADMIN CONTAINERS
========================================================= */

export const getAdminContainers = asyncHandler(async (req, res) => {
  const {
    search,
    isActive,
    customerSelectable,
    availability,
    category,
    subcategory,
    segment,
    channel,
    hamperUse,
  } = req.query;

  const { page, limit, skip } = getPagination(req.query, 30);
  const filter = {};

  if (search?.trim()) {
    const safeSearch = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { code: { $regex: safeSearch, $options: "i" } },
      { material: { $regex: safeSearch, $options: "i" } },
      { "source.externalSku": { $regex: safeSearch, $options: "i" } },
    ];
  }

  if (category?.trim()) filter.category = category.trim();
  if (subcategory?.trim()) filter.subcategory = subcategory.trim();
  if (segment?.trim()) filter.segment = segment.trim();

  if (channel) {
    if (!CHANNEL_KEYS.includes(channel)) {
      return res.status(400).json({ success: false, message: "Invalid channel" });
    }
    filter[`channels.${channel}`] = true;
  }

  const activeValue = parseBoolean(isActive);
  if (activeValue !== undefined) filter.isActive = activeValue;

  const selectableValue = parseBoolean(customerSelectable);
  if (selectableValue !== undefined) filter.customerSelectable = selectableValue;

  const hamperUseValue = parseBoolean(hamperUse);
  if (hamperUseValue !== undefined) filter.hamperUse = hamperUseValue;

  if (availability && AVAILABILITY_VALUES.includes(availability)) {
    filter["availability.status"] = availability;
  }

  const total = await Container.countDocuments(filter);
  const containers = await Container.find(filter)
    .populate("packingMaterials.component", "name code type availability")
    .sort({ sortOrder: 1, productPriority: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.status(200).json({
    success: true,
    containers: containers.map((container) => ({
      ...container,
      capacity: calculateContainerCapacity(container),
    })),
    pagination: getPaginationMeta(total, page, limit),
  });
});

export const getAdminContainerById = asyncHandler(async (req, res) => {
  const { containerId } = req.params;

  if (!isValidId(containerId)) {
    return res.status(400).json({ success: false, message: "Invalid container ID" });
  }

  const container = await Container.findById(containerId)
    .populate("packingMaterials.component")
    .lean();

  if (!container) {
    return res.status(404).json({ success: false, message: "Container not found" });
  }

  res.status(200).json({
    success: true,
    container: { ...container, capacity: calculateContainerCapacity(container) },
  });
});

export const createContainer = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    material,
    description,
    images,
    outerDimensions,
    innerDimensions,
    maxContentWeight,
    usableVolumePercent,
    maxItems,
    packingMaterials,
    productionLeadTime,
    defaultCourierDays,
    availability,
    customerSelectable,
    isActive,
    sortOrder,
    internalNotes,
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: "Container name is required" });
  }

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Container code is required" });
  }

  const normalizedCode = code.trim().toUpperCase();
  const exists = await Container.exists({ code: normalizedCode });

  if (exists) {
    return res.status(409).json({ success: false, message: "Container code already exists" });
  }

  const selectableValue = parseBoolean(customerSelectable);
  const activeValue = parseBoolean(isActive);
  const hamperUseValue = parseBoolean(req.body.hamperUse);

  if (customerSelectable !== undefined && selectableValue === undefined) {
    return res.status(400).json({
      success: false,
      message: "customerSelectable must be true or false",
    });
  }

  if (isActive !== undefined && activeValue === undefined) {
    return res.status(400).json({ success: false, message: "isActive must be true or false" });
  }

  if (req.body.hamperUse !== undefined && hamperUseValue === undefined) {
    return res.status(400).json({ success: false, message: "hamperUse must be true or false" });
  }

  const finalHamperUse = hamperUseValue ?? true;
  const finalSelectable = finalHamperUse ? selectableValue ?? true : false;

  const validationError = validateContainerPayload({
    ...req.body,
    outerDimensions,
    innerDimensions,
    maxContentWeight,
    usableVolumePercent: usableVolumePercent ?? 85,
    maxItems: maxItems ?? 0,
    availability,
    productionLeadTime,
    defaultCourierDays,
    hamperUse: finalHamperUse,
  });

  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const materialsResult = await validateAndNormalizeMaterialItems(
    packingMaterials || [],
    { fieldName: "packingMaterials" }
  );

  if (!materialsResult.valid) {
    return res.status(400).json({ success: false, message: materialsResult.message });
  }

  const courier = parseCourierDays(defaultCourierDays, null);

  const container = new Container({
    name: name.trim(),
    code: normalizedCode,
    material: material?.trim() || "",
    description: description || "",
    images: Array.isArray(images) ? images : [],
    outerDimensions: normalizeContainerDimensions(outerDimensions),
    innerDimensions: normalizeContainerDimensions(innerDimensions),
    maxContentWeight: normalizeWeightCapacity(maxContentWeight),
    usableVolumePercent: Number(usableVolumePercent ?? 85),
    maxItems: Number(maxItems ?? 0),
    packingMaterials: materialsResult.items,
    productionLeadTime: normalizeProductionLeadTime(productionLeadTime),
    defaultCourierDays: courier.value,
    availability: normalizeAvailability(availability, { stockUnit: false }),
    customerSelectable: finalSelectable,
    isActive: activeValue ?? true,
    sortOrder: Number(sortOrder) || 0,
    internalNotes: internalNotes || "",
  });

  applyContainerMasterFields(container, req.body);
  container.hamperUse = finalHamperUse;
  container.customerSelectable = finalSelectable;

  await container.save();

  const plain = container.toObject();
  res.status(201).json({
    success: true,
    message: "Container created successfully",
    container: { ...plain, capacity: calculateContainerCapacity(plain) },
  });
});

export const updateContainer = asyncHandler(async (req, res) => {
  const { containerId } = req.params;

  if (!isValidId(containerId)) {
    return res.status(400).json({ success: false, message: "Invalid container ID" });
  }

  const container = await Container.findById(containerId);
  if (!container) {
    return res.status(404).json({ success: false, message: "Container not found" });
  }

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Container name cannot be empty" });
    }
    container.name = name;
  }

  if (req.body.code !== undefined) {
    const newCode = String(req.body.code).trim().toUpperCase();
    if (!newCode) {
      return res.status(400).json({ success: false, message: "Container code cannot be empty" });
    }

    const exists = await Container.exists({
      code: newCode,
      _id: { $ne: container._id },
    });

    if (exists) {
      return res.status(409).json({ success: false, message: "Container code already exists" });
    }

    container.code = newCode;
  }

  const currentOuter = toPlainObject(container.outerDimensions);
  const currentInner = toPlainObject(container.innerDimensions);
  const currentWeight = toPlainObject(container.maxContentWeight);
  const currentAvailability = toPlainObject(container.availability);
  const currentLeadTime = toPlainObject(container.productionLeadTime);

  const nextOuter =
    req.body.outerDimensions !== undefined
      ? { ...currentOuter, ...req.body.outerDimensions }
      : currentOuter;
  const nextInner =
    req.body.innerDimensions !== undefined
      ? { ...currentInner, ...req.body.innerDimensions }
      : currentInner;
  const nextWeight =
    req.body.maxContentWeight !== undefined
      ? { ...currentWeight, ...req.body.maxContentWeight }
      : currentWeight;
  const nextAvailability =
    req.body.availability !== undefined
      ? { ...currentAvailability, ...req.body.availability }
      : currentAvailability;
  const nextLeadTime =
    req.body.productionLeadTime !== undefined
      ? { ...currentLeadTime, ...req.body.productionLeadTime }
      : currentLeadTime;
  const nextUsableVolume =
    req.body.usableVolumePercent !== undefined
      ? req.body.usableVolumePercent
      : container.usableVolumePercent;
  const nextMaxItems =
    req.body.maxItems !== undefined ? req.body.maxItems : container.maxItems;
  const nextCourierDays =
    req.body.defaultCourierDays !== undefined
      ? req.body.defaultCourierDays
      : container.defaultCourierDays;

  let nextHamperUse = container.hamperUse !== false;
  if (req.body.hamperUse !== undefined) {
    const value = parseBoolean(req.body.hamperUse);
    if (value === undefined) {
      return res.status(400).json({ success: false, message: "hamperUse must be true or false" });
    }
    nextHamperUse = value;
  }

  let nextSelectable = container.customerSelectable;
  if (req.body.customerSelectable !== undefined) {
    const value = parseBoolean(req.body.customerSelectable);
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: "customerSelectable must be true or false",
      });
    }
    nextSelectable = value;
  }

  if (!nextHamperUse) nextSelectable = false;

  const validationError = validateContainerPayload({
    ...req.body,
    outerDimensions: nextOuter,
    innerDimensions: nextInner,
    maxContentWeight: nextWeight,
    usableVolumePercent: nextUsableVolume,
    maxItems: nextMaxItems,
    availability: nextAvailability,
    productionLeadTime: nextLeadTime,
    defaultCourierDays: nextCourierDays,
    hamperUse: nextHamperUse,
  });

  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  if (req.body.packingMaterials !== undefined) {
    const materialsResult = await validateAndNormalizeMaterialItems(
      req.body.packingMaterials,
      { fieldName: "packingMaterials" }
    );

    if (!materialsResult.valid) {
      return res.status(400).json({ success: false, message: materialsResult.message });
    }

    container.packingMaterials = materialsResult.items;
  }

  if (req.body.material !== undefined) container.material = String(req.body.material || "").trim();
  if (req.body.description !== undefined) container.description = req.body.description || "";
  if (req.body.images !== undefined) {
    container.images = Array.isArray(req.body.images) ? req.body.images : [];
  }
  if (req.body.outerDimensions !== undefined) {
    container.outerDimensions = normalizeContainerDimensions(nextOuter);
  }
  if (req.body.innerDimensions !== undefined) {
    container.innerDimensions = normalizeContainerDimensions(nextInner);
  }
  if (req.body.maxContentWeight !== undefined) {
    container.maxContentWeight = normalizeWeightCapacity(nextWeight);
  }
  if (req.body.usableVolumePercent !== undefined) {
    container.usableVolumePercent = Number(nextUsableVolume);
  }
  if (req.body.maxItems !== undefined) container.maxItems = Number(nextMaxItems);
  if (req.body.productionLeadTime !== undefined) {
    container.productionLeadTime = normalizeProductionLeadTime(nextLeadTime);
  }
  if (req.body.defaultCourierDays !== undefined) {
    container.defaultCourierDays = parseCourierDays(nextCourierDays, null).value;
  }
  if (req.body.availability !== undefined) {
    container.availability = normalizeAvailability(nextAvailability, { stockUnit: false });
  }

  container.hamperUse = nextHamperUse;
  container.customerSelectable = nextSelectable;

  if (req.body.isActive !== undefined) {
    const value = parseBoolean(req.body.isActive);
    if (value === undefined) {
      return res.status(400).json({ success: false, message: "isActive must be true or false" });
    }
    container.isActive = value;
  }

  if (req.body.sortOrder !== undefined) container.sortOrder = Number(req.body.sortOrder) || 0;
  if (req.body.internalNotes !== undefined) container.internalNotes = req.body.internalNotes || "";

  applyContainerMasterFields(container, req.body);
  container.hamperUse = nextHamperUse;
  container.customerSelectable = nextSelectable;

  await container.save();
  const plain = container.toObject();

  res.status(200).json({
    success: true,
    message: "Container updated successfully",
    container: { ...plain, capacity: calculateContainerCapacity(plain) },
  });
});

export const deleteContainer = asyncHandler(async (req, res) => {
  const { containerId } = req.params;

  if (!isValidId(containerId)) {
    return res.status(400).json({ success: false, message: "Invalid container ID" });
  }

  const container = await Container.findById(containerId);
  if (!container) {
    return res.status(404).json({ success: false, message: "Container not found" });
  }

  const usedBySKU = await SKU.exists({ container: container._id });
  if (usedBySKU) {
    return res.status(409).json({
      success: false,
      message: "Container is being used by one or more SKUs. Disable it instead of deleting it.",
    });
  }

  await container.deleteOne();
  res.status(200).json({ success: true, message: "Container deleted successfully" });
});

/* =========================================================
   ADMIN PRODUCTS
========================================================= */

export const getAdminProducts = asyncHandler(async (req, res) => {
  const { search, status, category } = req.query;
  const { page, limit, skip } = getPagination(req.query, 20);
  const filter = {};

  if (search?.trim()) {
    const safeSearch = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { slug: { $regex: safeSearch, $options: "i" } },
    ];
  }

  if (status) filter.status = status;
  if (category && isValidId(category)) filter.category = category;

  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .populate("category", "name slug")
    .populate("collections", "name slug")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.status(200).json({
    success: true,
    products,
    pagination: getPaginationMeta(total, page, limit),
  });
});

export const getAdminProductById = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!isValidId(productId)) {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }

  const product = await Product.findById(productId)
    .populate("category", "name slug")
    .populate("collections", "name slug")
    .lean();

  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  const rawSkus = await SKU.find({ product: product._id })
    .populate("container")
    .populate("hamperContents.component")
    .populate("decorations.component")
    .populate("internalMaterials.component")
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const skus = await Promise.all(
    rawSkus.map(async (sku) => {
      const courier = parseCourierDays(req.query.courierDays, sku.defaultCourierDays);
      if (!courier.valid) {
        const error = new Error(courier.message);
        error.statusCode = 400;
        throw error;
      }

      return {
        ...sku,
        deliveryEstimate: await calculateSkuDeliveryEstimate(sku, {
          courierDays: courier.value,
          includeDetails: true,
        }),
      };
    })
  );

  res.status(200).json({
    success: true,
    product: { ...product, skus },
  });
});

export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    shortDescription,
    description,
    brand,
    category,
    collections,
    tags,
    images,
    status,
    isFeatured,
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: "Product name is required" });
  }

  if (!category) {
    return res.status(400).json({ success: false, message: "Product category is required" });
  }

  const validCategory = await validateCategory(category);
  if (!validCategory) {
    return res.status(400).json({ success: false, message: "Invalid product category" });
  }

  const validCollections = await validateCollections(collections || []);
  if (validCollections === null) {
    return res.status(400).json({
      success: false,
      message: "One or more collections are invalid",
    });
  }

  const slug = await ensureUniqueSlug(Product, name);
  const featuredValue = parseBoolean(isFeatured);

  if (isFeatured !== undefined && featuredValue === undefined) {
    return res.status(400).json({ success: false, message: "isFeatured must be true or false" });
  }

  const product = await Product.create({
    name: name.trim(),
    slug,
    shortDescription: shortDescription || "",
    description: description || "",
    brand: brand || "HAMPORIUM",
    category: validCategory._id,
    collections: validCollections,
    tags: normalizeTags(tags),
    images: Array.isArray(images) ? images : [],
    status: status || PRODUCT_STATUS.DRAFT,
    isFeatured: featuredValue ?? false,
  });

  res.status(201).json({ success: true, message: "Product created successfully", product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!isValidId(productId)) {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  if (req.body.category !== undefined) {
    const category = await validateCategory(req.body.category);
    if (!category) {
      return res.status(400).json({ success: false, message: "Invalid product category" });
    }
    product.category = category._id;
  }

  if (req.body.collections !== undefined) {
    const collections = await validateCollections(req.body.collections);
    if (collections === null) {
      return res.status(400).json({
        success: false,
        message: "One or more collections are invalid",
      });
    }
    product.collections = collections;
  }

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Product name cannot be empty" });
    }
    product.name = name;
  }

  if (req.body.shortDescription !== undefined) product.shortDescription = req.body.shortDescription;
  if (req.body.description !== undefined) product.description = req.body.description;
  if (req.body.brand !== undefined) product.brand = req.body.brand;
  if (req.body.images !== undefined) product.images = Array.isArray(req.body.images) ? req.body.images : [];
  if (req.body.status !== undefined) product.status = req.body.status;

  if (req.body.isFeatured !== undefined) {
    const featuredValue = parseBoolean(req.body.isFeatured);
    if (featuredValue === undefined) {
      return res.status(400).json({ success: false, message: "isFeatured must be true or false" });
    }
    product.isFeatured = featuredValue;
  }

  if (req.body.tags !== undefined) product.tags = normalizeTags(req.body.tags);

  if (req.body.slug) {
    product.slug = await ensureUniqueSlug(Product, req.body.slug, product._id);
  }

  await product.save();
  res.status(200).json({ success: true, message: "Product updated successfully", product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!isValidId(productId)) {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  product.status = PRODUCT_STATUS.ARCHIVED;
  product.isFeatured = false;
  await product.save();

  await SKU.updateMany(
    { product: product._id },
    { $set: { isActive: false } }
  );

  await syncProductPriceRange(product._id);
  res.status(200).json({ success: true, message: "Product archived successfully" });
});

/* =========================================================
   ADMIN SKUS
========================================================= */

export const createSKU = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const {
    code,
    skuBarcode,
    name,
    optionValues,
    baseSellingPrice,
    price,
    mrp,
    taxEnabled,
    taxPercent,
    hsnSac,
    discount,
    pricingSource,
    taxSource,
    compareAtPrice,
    images,
    container,
    hamperContents,
    decorations,
    internalMaterials,
    packagedDimensions,
    packagedWeight,
    productionLeadTime,
    defaultCourierDays,
    isActive,
    sortOrder,
    source,
  } = req.body;

  if (!isValidId(productId)) {
    return res.status(400).json({ success: false, message: "Invalid product ID" });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  if (product.status === PRODUCT_STATUS.ARCHIVED) {
    return res.status(400).json({
      success: false,
      message: "Cannot add SKU to archived product",
    });
  }

  if (!code?.trim() || !name?.trim()) {
    return res.status(400).json({
      success: false,
      message: "SKU code and name are required",
    });
  }

  const parsedBaseSellingPrice = Number(
    baseSellingPrice !== undefined ? baseSellingPrice : price
  );
  if (!Number.isFinite(parsedBaseSellingPrice) || parsedBaseSellingPrice < 0) {
    return res.status(400).json({
      success: false,
      message: "Valid base selling price is required",
    });
  }

  const taxRate =
    taxPercent === undefined || taxPercent === null || taxPercent === ""
      ? 0
      : Number(taxPercent);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return res.status(400).json({ success: false, message: "Invalid GST rate" });
  }

  const taxEnabledValue =
    taxEnabled === undefined ? taxRate > 0 : parseBoolean(taxEnabled);
  if (taxEnabled !== undefined && taxEnabledValue === undefined) {
    return res.status(400).json({
      success: false,
      message: "taxEnabled must be true or false",
    });
  }

  const discountError = validateDiscountConfig(discount);
  if (discountError) {
    return res.status(400).json({ success: false, message: discountError });
  }

  const normalizedDiscount = normalizeDiscountConfig(discount);
  const pricing = calculateCatalogPricing({
    baseSellingPrice: parsedBaseSellingPrice,
    taxPercent: taxRate,
    taxEnabled: taxEnabledValue !== false,
    discount: normalizedDiscount,
  });

  let parsedMrp = null;
  if (mrp !== undefined && mrp !== null && mrp !== "") {
    parsedMrp = Number(mrp);
    if (!Number.isFinite(parsedMrp) || parsedMrp < 0) {
      return res.status(400).json({ success: false, message: "Invalid MRP" });
    }
  }

  let parsedCompareAtPrice = null;
  if (compareAtPrice !== undefined && compareAtPrice !== null && compareAtPrice !== "") {
    parsedCompareAtPrice = Number(compareAtPrice);
    if (!Number.isFinite(parsedCompareAtPrice) || parsedCompareAtPrice < 0) {
      return res.status(400).json({ success: false, message: "Invalid compare-at price" });
    }
  } else if (parsedMrp !== null && parsedMrp > pricing.price) {
    parsedCompareAtPrice = parsedMrp;
  }

  if (parsedCompareAtPrice !== null && parsedCompareAtPrice <= pricing.price) {
    parsedCompareAtPrice = null;
  }

  const normalizedCode = code.trim().toUpperCase();
  const existingSKU = await SKU.exists({ code: normalizedCode });
  if (existingSKU) {
    return res.status(409).json({ success: false, message: "SKU code already exists" });
  }

  const activeValue = parseBoolean(isActive);
  if (isActive !== undefined && activeValue === undefined) {
    return res.status(400).json({ success: false, message: "isActive must be true or false" });
  }

  const containerResult = await validateContainerReference(container);
  if (!containerResult.valid) {
    return res.status(400).json({ success: false, message: containerResult.message });
  }

  const contentsResult = await validateAndNormalizeHamperContents(hamperContents || []);
  if (!contentsResult.valid) {
    return res.status(400).json({ success: false, message: contentsResult.message });
  }

  const decorationsResult = await validateAndNormalizeDecorations(decorations || []);
  if (!decorationsResult.valid) {
    return res.status(400).json({ success: false, message: decorationsResult.message });
  }

  const materialsResult = await validateAndNormalizeMaterialItems(internalMaterials || [], {
    fieldName: "internalMaterials",
  });
  if (!materialsResult.valid) {
    return res.status(400).json({ success: false, message: materialsResult.message });
  }

  const leadTimeError = validateProductionLeadTime(productionLeadTime || {});
  if (leadTimeError) {
    return res.status(400).json({ success: false, message: leadTimeError });
  }

  const courier = parseCourierDays(defaultCourierDays, null);
  if (!courier.valid) {
    return res.status(400).json({ success: false, message: courier.message });
  }

  const sourceError = validateSource(source);
  if (sourceError) {
    return res.status(400).json({ success: false, message: sourceError });
  }

  const sku = await SKU.create({
    product: product._id,
    code: normalizedCode,
    skuBarcode: String(skuBarcode || "").trim(),
    name: name.trim(),
    optionValues: optionValues || {},
    baseSellingPrice: pricing.baseSellingPrice,
    mrp: parsedMrp,
    taxEnabled: pricing.taxEnabled,
    taxPercent: pricing.taxPercent,
    hsnSac: String(hsnSac || "").trim(),
    discount: pricing.discount,
    pricingSource: SOURCE_TYPES.includes(pricingSource) ? pricingSource : "manual",
    taxSource: SOURCE_TYPES.includes(taxSource) ? taxSource : "manual",
    price: pricing.price,
    compareAtPrice: parsedCompareAtPrice,
    images: Array.isArray(images) ? images : [],
    container: containerResult.containerId,
    hamperContents: contentsResult.items,
    decorations: decorationsResult.items,
    internalMaterials: materialsResult.items,
    packagedDimensions: packagedDimensions ? normalizeDimensions(packagedDimensions) : undefined,
    packagedWeight: packagedWeight ? normalizeWeight(packagedWeight) : undefined,
    productionLeadTime: normalizeProductionLeadTime(productionLeadTime),
    defaultCourierDays: courier.value,
    earliestExpiryDate: contentsResult.earliestExpiryDate,
    isActive: activeValue ?? true,
    sortOrder: Number(sortOrder) || 0,
    source: source ? normalizeSource(source) : undefined,
  });

  await syncProductPriceRange(product._id);
  res.status(201).json({ success: true, message: "SKU created successfully", sku });
});

export const updateSKU = asyncHandler(async (req, res) => {
  const { skuId } = req.params;

  if (!isValidId(skuId)) {
    return res.status(400).json({ success: false, message: "Invalid SKU ID" });
  }

  const sku = await SKU.findById(skuId);
  if (!sku) {
    return res.status(404).json({ success: false, message: "SKU not found" });
  }

  if (req.body.code !== undefined) {
    const newCode = String(req.body.code).trim().toUpperCase();
    if (!newCode) {
      return res.status(400).json({ success: false, message: "SKU code cannot be empty" });
    }

    const existingSKU = await SKU.exists({
      code: newCode,
      _id: { $ne: sku._id },
    });

    if (existingSKU) {
      return res.status(409).json({ success: false, message: "SKU code already exists" });
    }

    sku.code = newCode;
  }

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "SKU name cannot be empty" });
    }
    sku.name = name;
  }

  if (
    req.body.baseSellingPrice !== undefined ||
    req.body.price !== undefined
  ) {
    const basePrice = Number(
      req.body.baseSellingPrice !== undefined
        ? req.body.baseSellingPrice
        : req.body.price
    );

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid base selling price",
      });
    }

    sku.baseSellingPrice = basePrice;
    sku.pricingSource = SOURCE_TYPES.includes(req.body.pricingSource)
      ? req.body.pricingSource
      : "manual";
  }

  if (req.body.mrp !== undefined) {
    if (req.body.mrp === null || req.body.mrp === "") {
      sku.mrp = null;
    } else {
      const mrp = Number(req.body.mrp);
      if (!Number.isFinite(mrp) || mrp < 0) {
        return res.status(400).json({ success: false, message: "Invalid MRP" });
      }
      sku.mrp = mrp;
    }
  }

  if (req.body.taxPercent !== undefined) {
    const rate = Number(req.body.taxPercent);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ success: false, message: "Invalid GST rate" });
    }
    sku.taxPercent = rate;
    sku.taxSource = SOURCE_TYPES.includes(req.body.taxSource)
      ? req.body.taxSource
      : "manual";
  }

  if (req.body.taxEnabled !== undefined) {
    const enabled = parseBoolean(req.body.taxEnabled);
    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: "taxEnabled must be true or false",
      });
    }
    sku.taxEnabled = enabled;
  }

  if (req.body.hsnSac !== undefined) {
    sku.hsnSac = String(req.body.hsnSac || "").trim();
  }

  if (req.body.discount !== undefined) {
    const discountError = validateDiscountConfig(req.body.discount);
    if (discountError) {
      return res.status(400).json({ success: false, message: discountError });
    }
    sku.discount = normalizeDiscountConfig(
      req.body.discount,
      toPlainObject(sku.discount)
    );
    sku.pricingSource = SOURCE_TYPES.includes(req.body.pricingSource)
      ? req.body.pricingSource
      : "manual";
  }

  if (req.body.compareAtPrice !== undefined) {
    if (req.body.compareAtPrice === null || req.body.compareAtPrice === "") {
      sku.compareAtPrice = null;
    } else {
      const compareAtPrice = Number(req.body.compareAtPrice);
      if (!Number.isFinite(compareAtPrice) || compareAtPrice < 0) {
        return res.status(400).json({ success: false, message: "Invalid compare-at price" });
      }
      sku.compareAtPrice = compareAtPrice;
    }
  }

  if (req.body.optionValues !== undefined) sku.optionValues = req.body.optionValues || {};
  if (req.body.images !== undefined) sku.images = Array.isArray(req.body.images) ? req.body.images : [];

  if (req.body.container !== undefined) {
    const containerResult = await validateContainerReference(req.body.container);
    if (!containerResult.valid) {
      return res.status(400).json({ success: false, message: containerResult.message });
    }
    sku.container = containerResult.containerId;
  }

  if (req.body.hamperContents !== undefined) {
    const contentsResult = await validateAndNormalizeHamperContents(req.body.hamperContents);
    if (!contentsResult.valid) {
      return res.status(400).json({ success: false, message: contentsResult.message });
    }

    sku.hamperContents = contentsResult.items;
    sku.earliestExpiryDate = contentsResult.earliestExpiryDate;
  } else {
    sku.earliestExpiryDate = await calculateEarliestExpiryDate(sku.hamperContents);
  }

  if (req.body.decorations !== undefined) {
    const decorationsResult = await validateAndNormalizeDecorations(
      req.body.decorations
    );

    if (!decorationsResult.valid) {
      return res.status(400).json({
        success: false,
        message: decorationsResult.message,
      });
    }

    sku.decorations = decorationsResult.items;
  }

  if (req.body.internalMaterials !== undefined) {
    const materialsResult = await validateAndNormalizeMaterialItems(
      req.body.internalMaterials,
      { fieldName: "internalMaterials" }
    );

    if (!materialsResult.valid) {
      return res.status(400).json({ success: false, message: materialsResult.message });
    }

    sku.internalMaterials = materialsResult.items;
  }

  if (req.body.packagedDimensions !== undefined) {
    sku.packagedDimensions = normalizeDimensions(req.body.packagedDimensions);
  }

  if (req.body.packagedWeight !== undefined) {
    sku.packagedWeight = normalizeWeight(req.body.packagedWeight);
  }

  if (req.body.productionLeadTime !== undefined) {
    const nextLeadTime = {
      ...toPlainObject(sku.productionLeadTime),
      ...req.body.productionLeadTime,
    };

    const leadTimeError = validateProductionLeadTime(nextLeadTime);
    if (leadTimeError) {
      return res.status(400).json({ success: false, message: leadTimeError });
    }

    sku.productionLeadTime = normalizeProductionLeadTime(nextLeadTime);
  }

  if (req.body.defaultCourierDays !== undefined) {
    const courier = parseCourierDays(req.body.defaultCourierDays, null);
    if (!courier.valid) {
      return res.status(400).json({ success: false, message: courier.message });
    }
    sku.defaultCourierDays = courier.value;
  }

  if (req.body.sortOrder !== undefined) {
    const sortOrder = Number(req.body.sortOrder);
    if (!Number.isFinite(sortOrder)) {
      return res.status(400).json({ success: false, message: "Invalid SKU sort order" });
    }
    sku.sortOrder = sortOrder;
  }

  if (req.body.isActive !== undefined) {
    const activeValue = parseBoolean(req.body.isActive);
    if (activeValue === undefined) {
      return res.status(400).json({ success: false, message: "isActive must be true or false" });
    }
    sku.isActive = activeValue;
  }

  if (req.body.skuBarcode !== undefined) {
    sku.skuBarcode = String(req.body.skuBarcode || "").trim();
  }

  if (req.body.source !== undefined) {
    const sourceError = validateSource(req.body.source);
    if (sourceError) {
      return res.status(400).json({ success: false, message: sourceError });
    }
    sku.source = normalizeSource(req.body.source, toPlainObject(sku.source));
  }

  await sku.save();
  await syncProductPriceRange(sku.product);

  res.status(200).json({ success: true, message: "SKU updated successfully", sku });
});

export const deleteSKU = asyncHandler(async (req, res) => {
  const { skuId } = req.params;

  if (!isValidId(skuId)) {
    return res.status(400).json({ success: false, message: "Invalid SKU ID" });
  }

  const sku = await SKU.findById(skuId);
  if (!sku) {
    return res.status(404).json({ success: false, message: "SKU not found" });
  }

  const productId = sku.product;
  await sku.deleteOne();
  await syncProductPriceRange(productId);

  res.status(200).json({ success: true, message: "SKU deleted successfully" });
});
