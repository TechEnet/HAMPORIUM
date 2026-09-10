import crypto from "node:crypto";
import mongoose from "mongoose";

import Cart from "./cart.model.js";
import SKU from "../catalog/sku.model.js";
import Component from "../catalog/component.model.js";
import Container from "../catalog/container.model.js";
import Order from "../orders/order.model.js";
import RFQ from "../rfq/rfq.model.js";

import asyncHandler from "../../utils/asyncHandler.js";
import uploadFile, { deleteFile } from "../../helpers/uploadFile.js";
import { PRODUCT_STATUS } from "../../constants/statuses.js";
import { calculateCatalogPricing } from "../tax/tax.service.js";
import {
  recordCommerceEvent,
  resolveSearchAttribution,
} from "../analytics/commerceAnalytics.service.js";

const isValidId = (id) => mongoose.isValidObjectId(id);
const CHANNELS = ["corporate", "wedding", "diwali", "hamperOne"];
const PUBLIC_COMPONENT_TYPES = ["food", "non_food"];
const PERSONALIZATION_ASSET_TYPES = new Set([
  "logo",
  "icon",
  "gift_wrap",
  "reference_design",
]);
const PERSONALIZATION_PLACEMENTS = new Set([
  "top_lid",
  "front",
  "inside_lid",
  "gift_tag",
  "message_card",
  "ribbon_tag",
  "full_wrap",
  "other",
]);
const MAX_PERSONALIZATION_ASSETS = 4;
const MAX_PERSONALIZATION_FILE_BYTES = 5 * 1024 * 1024;

const getPersonalizationUploadSecret = () =>
  String(
    process.env.PERSONALIZATION_UPLOAD_SECRET ||
      process.env.JWT_SECRET ||
      process.env.COOKIE_SECRET ||
      ""
  );

const isSafeAssetUrl = (value) => {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const makePersonalizationUploadProof = ({ userId, publicId, url }) => {
  const secret = getPersonalizationUploadSecret();
  if (!secret) return "";

  return crypto
    .createHmac("sha256", secret)
    .update(`${String(userId)}\n${String(publicId)}\n${String(url)}`)
    .digest("hex");
};

const validPersonalizationUploadProof = ({
  userId,
  publicId,
  url,
  proof,
}) => {
  const expected = makePersonalizationUploadProof({ userId, publicId, url });
  const received = String(proof || "").trim().toLowerCase();

  if (!expected || !received || expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex")
  );
};

const hasAllowedImageSignature = (file) => {
  const buffer = file?.buffer;
  const mimeType = String(file?.mimetype || "").toLowerCase();

  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }

  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  if (mimeType === "image/avif") {
    const boxType = buffer.subarray(4, 8).toString("ascii");
    const brand = buffer.subarray(8, 12).toString("ascii");
    return boxType === "ftyp" && ["avif", "avis"].includes(brand);
  }

  return false;
};

const money = (value) => Number(Number(value || 0).toFixed(2));

const cleanString = (value, maxLength = 160) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const hasPrice = (value) => {
  if (value === undefined || value === null || value === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
};

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
  return null;
};

const normalizeCustomSelections = (
  items = [],
  { required = false, label = "hamper item" } = {}
) => {
  if (!Array.isArray(items)) {
    return { valid: false, message: `${label}s must be an array` };
  }

  if (required && items.length === 0) {
    return { valid: false, message: "Select at least one hamper item" };
  }

  const merged = new Map();

  for (let index = 0; index < items.length; index += 1) {
    const rawId = items[index]?.componentId || items[index]?.component;
    const componentId = String(rawId || "");
    const quantity = Number(items[index]?.quantity ?? 1);

    if (!isValidId(componentId)) {
      return {
        valid: false,
        message: `Invalid component ID at ${label} ${index + 1}`,
      };
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return {
        valid: false,
        message: `Quantity must be between 1 and 99 at ${label} ${index + 1}`,
      };
    }

    merged.set(componentId, (merged.get(componentId) || 0) + quantity);
  }

  const normalized = [...merged.entries()].map(([componentId, quantity]) => ({
    componentId,
    quantity,
  }));

  if (normalized.some((item) => item.quantity > 99)) {
    return {
      valid: false,
      message: `Maximum quantity for a selected ${label} is 99`,
    };
  }

  return { valid: true, items: normalized };
};

const normalizeCustomItems = (items = []) =>
  normalizeCustomSelections(items, {
    required: true,
    label: "hamper item",
  });

const normalizeDecorations = (decorations = []) =>
  normalizeCustomSelections(decorations, {
    required: false,
    label: "decorative item",
  });

const personalizationFolderForUser = (userId) =>
  `hamporium/custom-hamper-personalization/${String(userId)}`;

const normalizeUploadResult = (result = {}) => ({
  url:
    result.url ||
    result.secure_url ||
    result.location ||
    result.Location ||
    "",
  publicId:
    result.publicId ||
    result.public_id ||
    result.storageKey ||
    result.key ||
    result.Key ||
    "",
});

const assetBelongsToUser = (publicId, userId) => {
  const value = String(publicId || "").trim();
  if (!value || !userId) return false;
  return value.startsWith(`${personalizationFolderForUser(userId)}/`);
};

const normalizePersonalization = (
  personalization,
  { userId = null, requireOwnedAssets = false } = {}
) => {
  if (!personalization || typeof personalization !== "object") {
    return { valid: true, personalization: undefined };
  }

  const rawAssets = Array.isArray(personalization.assets)
    ? personalization.assets
    : [];

  if (rawAssets.length > MAX_PERSONALIZATION_ASSETS) {
    return {
      valid: false,
      message: `Upload at most ${MAX_PERSONALIZATION_ASSETS} personalization images`,
    };
  }

  const seen = new Set();
  const assets = [];

  for (let index = 0; index < rawAssets.length; index += 1) {
    const raw = rawAssets[index] || {};
    const type = cleanString(raw.type, 40).toLowerCase();
    const placement = cleanString(raw.placement || "top_lid", 40).toLowerCase();
    const url = cleanString(raw.url, 2000);
    const publicId = cleanString(raw.publicId, 500);
    const fileName = cleanString(raw.fileName, 180);
    const mimeType = cleanString(raw.mimeType, 100).toLowerCase();
    const size = Number(raw.size || 0);
    const notes = cleanString(raw.notes, 500);
    const uploadProof = cleanString(raw.uploadProof, 128).toLowerCase();

    if (!PERSONALIZATION_ASSET_TYPES.has(type)) {
      return { valid: false, message: `Invalid personalization asset type at item ${index + 1}` };
    }
    if (!PERSONALIZATION_PLACEMENTS.has(placement)) {
      return { valid: false, message: `Invalid personalization placement at item ${index + 1}` };
    }
    if (!url || !publicId || !isSafeAssetUrl(url)) {
      return { valid: false, message: `Uploaded personalization asset ${index + 1} is incomplete` };
    }
    if (
      requireOwnedAssets &&
      (!userId ||
        !assetBelongsToUser(publicId, userId) ||
        !validPersonalizationUploadProof({
          userId,
          publicId,
          url,
          proof: uploadProof,
        }))
    ) {
      return {
        valid: false,
        message: "One or more personalization uploads could not be verified for this account",
      };
    }
    if (Number.isFinite(size) && size > MAX_PERSONALIZATION_FILE_BYTES) {
      return { valid: false, message: `Personalization asset ${index + 1} exceeds the 5 MB limit` };
    }
    if (seen.has(publicId)) continue;
    seen.add(publicId);
    assets.push({
      type,
      url,
      publicId,
      fileName,
      mimeType,
      size: Number.isFinite(size) && size > 0 ? size : 0,
      placement,
      notes,
    });
  }

  const message = cleanString(personalization.message, 500);
  const instructions = cleanString(personalization.instructions, 1500);
  const enabled = Boolean(assets.length || message || instructions);

  if (!enabled) return { valid: true, personalization: undefined };

  return {
    valid: true,
    personalization: { enabled: true, assets, message, instructions },
  };
};

const personalizationFingerprint = (personalization) => {
  if (!personalization?.enabled) return "";
  const normalized = {
    assets: [...(personalization.assets || [])]
      .map((asset) => ({
        type: asset.type,
        publicId: asset.publicId,
        placement: asset.placement,
        notes: asset.notes || "",
      }))
      .sort((a, b) => String(a.publicId).localeCompare(String(b.publicId))),
    message: personalization.message || "",
    instructions: personalization.instructions || "",
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .slice(0, 24);
};

const serializeSelections = (items = []) =>
  [...items]
    .sort((a, b) => String(a.componentId).localeCompare(String(b.componentId)))
    .map((item) => `${item.componentId}:${item.quantity}`)
    .join("|");

const customConfigurationKey = (
  containerId,
  items,
  decorations = [],
  channel = "",
  personalization = undefined
) => {
  const parts = [
    String(containerId),
    String(channel || ""),
    serializeSelections(items),
  ];

  if (decorations.length) {
    parts.push(`decor:${serializeSelections(decorations)}`);
  }

  const personalKey = personalizationFingerprint(personalization);
  if (personalKey) {
    parts.push(`personal:${personalKey}`);
  }

  return parts.join("::");
};

const getComponentPhysicalData = (component) => {
  const length = dimensionToCm(
    component?.dimensions?.length,
    component?.dimensions?.unit
  );
  const width = dimensionToCm(
    component?.dimensions?.width,
    component?.dimensions?.unit
  );
  const height = dimensionToCm(
    component?.dimensions?.height,
    component?.dimensions?.unit
  );
  const weightGrams = weightToGrams(
    component?.weight?.value,
    component?.weight?.unit
  );

  if (
    ![length, width, height, weightGrams].every(Number.isFinite) ||
    length <= 0 ||
    width <= 0 ||
    height <= 0 ||
    weightGrams <= 0
  ) {
    return null;
  }

  return {
    length,
    width,
    height,
    weightGrams,
    volumeCm3: length * width * height,
  };
};

const uniqueOrientations = ({ length, width, height }) => {
  const values = [
    [length, width, height],
    [length, height, width],
    [width, length, height],
    [width, height, length],
    [height, length, width],
    [height, width, length],
  ];

  const seen = new Set();

  return values
    .filter(([l, w, h]) => {
      const key = `${l}|${w}|${h}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(([lengthValue, widthValue, heightValue]) => ({
      length: lengthValue,
      width: widthValue,
      height: heightValue,
    }));
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
    (space) =>
      space.length > 1e-9 &&
      space.width > 1e-9 &&
      space.height > 1e-9
  );

const packRectangles = (box, instances) => {
  const sorted = [...instances].sort((a, b) => b.volumeCm3 - a.volumeCm3);
  let spaces = [{ ...box }];

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
          const itemVolume =
            orientation.length * orientation.width * orientation.height;
          const score = spaceVolume - itemVolume;

          if (!best || score < best.score) {
            best = { spaceIndex, space, orientation, score };
          }
        }
      }
    }

    if (!best) return false;

    const { space, orientation, spaceIndex } = best;
    spaces.splice(spaceIndex, 1);

    const { length, width, height } = orientation;

    spaces.push(
      {
        length: space.length - length,
        width: space.width,
        height: space.height,
      },
      {
        length,
        width: space.width - width,
        height: space.height,
      },
      {
        length,
        width,
        height: space.height - height,
      }
    );

    spaces = pruneSpaces(spaces);
  }

  return true;
};

const calculateContainerCapacity = (container) => {
  const length = dimensionToCm(
    container?.innerDimensions?.length,
    container?.innerDimensions?.unit
  );
  const width = dimensionToCm(
    container?.innerDimensions?.width,
    container?.innerDimensions?.unit
  );
  const height = dimensionToCm(
    container?.innerDimensions?.height,
    container?.innerDimensions?.unit
  );

  if (![length, width, height].every(Number.isFinite)) return null;

  const totalVolumeCm3 = length * width * height;
  const percentage = Number(container.usableVolumePercent);

  return {
    totalVolumeCm3,
    usableVolumeCm3:
      totalVolumeCm3 *
      (Number.isFinite(percentage) ? percentage / 100 : 0.85),
  };
};

const evaluatePhysicalConfiguration = (container, selections, componentMap) => {
  const box = {
    length: dimensionToCm(
      container.innerDimensions?.length,
      container.innerDimensions?.unit
    ),
    width: dimensionToCm(
      container.innerDimensions?.width,
      container.innerDimensions?.unit
    ),
    height: dimensionToCm(
      container.innerDimensions?.height,
      container.innerDimensions?.unit
    ),
  };

  const capacity = calculateContainerCapacity(container);
  const maxWeightGrams = weightToGrams(
    container.maxContentWeight?.value,
    container.maxContentWeight?.unit
  );
  const maxItems = Number(container.maxItems || 0);

  if (
    !capacity ||
    ![box.length, box.width, box.height, maxWeightGrams].every(Number.isFinite)
  ) {
    return {
      valid: false,
      reason: "Container physical capacity is incomplete",
      capacity: null,
    };
  }

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
        reason: `${component?.name || "Selected item"} has incomplete dimensions or weight`,
        capacity: null,
      };
    }

    if (!boxCanFitOne(box, physical)) {
      return {
        valid: false,
        reason: `${component.name} does not fit inside the selected box`,
        capacity: null,
      };
    }

    itemCount += selection.quantity;
    usedVolumeCm3 += physical.volumeCm3 * selection.quantity;
    usedWeightGrams += physical.weightGrams * selection.quantity;

    for (let index = 0; index < selection.quantity; index += 1) {
      instances.push({
        componentId: selection.componentId,
        ...physical,
      });
    }
  }

  if (maxItems > 0 && itemCount > maxItems) {
    return {
      valid: false,
      reason: "Selected items exceed the box item-count limit",
      capacity: null,
    };
  }

  if (usedVolumeCm3 > capacity.usableVolumeCm3 + 1e-9) {
    return {
      valid: false,
      reason: "Selected items exceed the usable box volume",
      capacity: null,
    };
  }

  if (usedWeightGrams > maxWeightGrams + 1e-9) {
    return {
      valid: false,
      reason: "Selected items exceed the box weight capacity",
      capacity: null,
    };
  }

  if (!packRectangles(box, instances)) {
    return {
      valid: false,
      reason: "Selected items cannot be arranged inside the box",
      capacity: null,
    };
  }

  return {
    valid: true,
    reason: null,
    capacity: {
      usedVolumeCm3: Number(usedVolumeCm3.toFixed(2)),
      usableVolumeCm3: Number(capacity.usableVolumeCm3.toFixed(2)),
      remainingVolumeCm3: Number(
        Math.max(0, capacity.usableVolumeCm3 - usedVolumeCm3).toFixed(2)
      ),
      usedWeightGrams: Number(usedWeightGrams.toFixed(2)),
      maxWeightGrams: Number(maxWeightGrams.toFixed(2)),
      remainingWeightGrams: Number(
        Math.max(0, maxWeightGrams - usedWeightGrams).toFixed(2)
      ),
      itemCount,
      maxItems: maxItems || null,
    },
  };
};

const availabilityAllows = (
  availability = {},
  requiredQuantity = 1,
  requiredUnit = "pc"
) => {
  const status = availability.status || "in_stock";
  const availableQuantity =
    availability.availableQuantity === undefined ||
    availability.availableQuantity === null ||
    availability.availableQuantity === ""
      ? null
      : Number(availability.availableQuantity);

  if (status === "in_stock") {
    if (availableQuantity === null || !Number.isFinite(availableQuantity)) {
      return true;
    }

    const stockUnit = availability.unit || "pc";
    const requiredInStockUnit = convertQuantity(
      requiredQuantity,
      requiredUnit,
      stockUnit
    );

    if (requiredInStockUnit === null) return true;
    return availableQuantity >= requiredInStockUnit;
  }

  if (availability.nextAvailableDate) {
    const date = new Date(availability.nextAvailableDate);
    return !Number.isNaN(date.getTime());
  }

  return false;
};

export const validateCustomHamper = async ({
  containerId,
  items,
  decorations = [],
  channel = "",
}) => {
  if (!isValidId(containerId)) {
    return { orderable: false, message: "Valid container is required" };
  }

  if (channel && !CHANNELS.includes(channel)) {
    return { orderable: false, message: "Invalid custom hamper channel" };
  }

  const normalized = normalizeCustomItems(items);
  if (!normalized.valid) {
    return { orderable: false, message: normalized.message };
  }

  const normalizedDecorations = normalizeDecorations(decorations);
  if (!normalizedDecorations.valid) {
    return { orderable: false, message: normalizedDecorations.message };
  }

  const containerFilter = {
    _id: containerId,
    isActive: true,
    customerSelectable: true,
    hamperUse: { $ne: false },
  };

  if (channel) containerFilter[`channels.${channel}`] = true;

  const container = await Container.findOne(containerFilter)
    .select(
      "_id name code images mrp sellingPrice taxEnabled taxPercent hsnSac discount pricingSource taxSource innerDimensions maxContentWeight usableVolumePercent maxItems availability channels"
    )
    .lean();

  if (!container) {
    return {
      orderable: false,
      message: "Selected custom hamper box is no longer available",
    };
  }

  const contentIds = normalized.items.map((item) => item.componentId);
  const decorationIds = normalizedDecorations.items.map(
    (item) => item.componentId
  );
  const componentIds = [...new Set([...contentIds, ...decorationIds])];

  const componentFilter = {
    _id: { $in: componentIds },
    isActive: true,
    customerSelectable: true,
    hamperUse: { $ne: false },
    type: { $in: PUBLIC_COMPONENT_TYPES },
  };

  if (channel) componentFilter[`channels.${channel}`] = true;

  const components = await Component.find(componentFilter)
    .select(
      "_id name code brand images type hamperRole mrp sellingPrice taxEnabled taxPercent hsnSac discount pricingSource taxSource dimensions weight availability category subcategory segment"
    )
    .lean();

  if (components.length !== componentIds.length) {
    return {
      orderable: false,
      message:
        "One or more selected custom hamper items are no longer available for custom gifting",
    };
  }

  const componentMap = new Map(
    components.map((component) => [String(component._id), component])
  );

  for (const selection of normalized.items) {
    const component = componentMap.get(String(selection.componentId));

    if (!component || (component.hamperRole || "content") === "decoration") {
      return {
        orderable: false,
        message: `${component?.name || "Selected item"} is configured as decorative material and cannot consume hamper capacity`,
      };
    }
  }

  for (const selection of normalizedDecorations.items) {
    const component = componentMap.get(String(selection.componentId));

    if (!component || (component.hamperRole || "content") !== "decoration") {
      return {
        orderable: false,
        message: `${component?.name || "Selected decoration"} is not configured as decorative material`,
      };
    }
  }

  const physical = evaluatePhysicalConfiguration(
    container,
    normalized.items,
    componentMap
  );

  if (!physical.valid) {
    return {
      orderable: false,
      message: physical.reason,
      container,
      components,
      items: normalized.items,
      decorations: normalizedDecorations.items,
      capacity: physical.capacity,
    };
  }

  if (!availabilityAllows(container.availability, 1, "pc")) {
    return {
      orderable: false,
      message: "Selected custom hamper box is currently unavailable",
      container,
      components,
      items: normalized.items,
      decorations: normalizedDecorations.items,
      capacity: physical.capacity,
    };
  }

  const allSelections = [
    ...normalized.items.map((item) => ({ ...item, hamperRole: "content" })),
    ...normalizedDecorations.items.map((item) => ({
      ...item,
      hamperRole: "decoration",
    })),
  ];

  for (const selection of allSelections) {
    const component = componentMap.get(String(selection.componentId));

    if (!availabilityAllows(component.availability, selection.quantity, "pc")) {
      return {
        orderable: false,
        message: `${component.name} is currently unavailable in the selected quantity`,
        container,
        components,
        items: normalized.items,
        decorations: normalizedDecorations.items,
        capacity: physical.capacity,
      };
    }
  }

  if (!hasPrice(container.sellingPrice)) {
    return {
      orderable: false,
      message: "Selected box does not have a selling price",
      container,
      components,
      items: normalized.items,
      decorations: normalizedDecorations.items,
      capacity: physical.capacity,
    };
  }

  const buildPricingLines = (selections, hamperRole) => {
    const lines = [];
    let total = 0;

    for (const selection of selections) {
      const component = componentMap.get(String(selection.componentId));

      if (!hasPrice(component.sellingPrice)) {
        return {
          valid: false,
          message: `${component.name} does not have a selling price`,
        };
      }

      const pricing = calculateCatalogPricing({
        baseSellingPrice: component.sellingPrice,
        taxPercent: component.taxPercent ?? 0,
        taxEnabled: component.taxEnabled !== false,
        discount: component.discount || {},
      });

      const unitPrice = money(pricing.price);
      const lineTotal = money(unitPrice * selection.quantity);
      total = money(total + lineTotal);

      lines.push({
        componentId: component._id,
        name: component.name,
        code: component.code,
        hamperRole,
        quantity: selection.quantity,
        baseUnitPrice: pricing.baseSellingPrice,
        discount: pricing.discount,
        discountAmount: pricing.discountAmount,
        taxableUnitPrice: pricing.taxableValue,
        taxPercent: pricing.taxPercent,
        taxAmount: pricing.taxAmount,
        hsnSac: component.hsnSac || "",
        unitPrice,
        lineTotal,
      });
    }

    return { valid: true, lines, total };
  };

  const contentPricing = buildPricingLines(normalized.items, "content");
  if (!contentPricing.valid) {
    return {
      orderable: false,
      message: contentPricing.message,
      container,
      components,
      items: normalized.items,
      decorations: normalizedDecorations.items,
      capacity: physical.capacity,
    };
  }

  const decorationPricing = buildPricingLines(
    normalizedDecorations.items,
    "decoration"
  );
  if (!decorationPricing.valid) {
    return {
      orderable: false,
      message: decorationPricing.message,
      container,
      components,
      items: normalized.items,
      decorations: normalizedDecorations.items,
      capacity: physical.capacity,
    };
  }

  const containerPricing = calculateCatalogPricing({
    baseSellingPrice: container.sellingPrice,
    taxPercent: container.taxPercent ?? 0,
    taxEnabled: container.taxEnabled !== false,
    discount: container.discount || {},
  });

  const containerPrice = money(containerPricing.price);
  const itemsTotal = money(contentPricing.total);
  const decorationsTotal = money(decorationPricing.total);
  const total = money(containerPrice + itemsTotal + decorationsTotal);

  return {
    orderable: true,
    message: null,
    container,
    components,
    items: normalized.items,
    decorations: normalizedDecorations.items,
    capacity: physical.capacity,
    pricing: {
      currency: "INR",
      containerBasePrice: containerPricing.baseSellingPrice,
      containerDiscount: containerPricing.discount,
      containerDiscountAmount: containerPricing.discountAmount,
      containerTaxPercent: containerPricing.taxPercent,
      containerTaxAmount: containerPricing.taxAmount,
      containerHsnSac: container.hsnSac || "",
      containerPrice,
      itemsTotal,
      decorationsTotal,
      total,
      items: contentPricing.lines,
      decorations: decorationPricing.lines,
    },
  };
};

const makeAttributionSnapshot = ({ analytics = {}, attribution = null } = {}) => {
  const sessionId = cleanString(
    attribution?.sessionId || analytics?.sessionId,
    120
  );
  const source = cleanString(attribution?.source || analytics?.source, 60);
  const query = cleanString(attribution?.query, 160);
  const normalizedQuery = cleanString(attribution?.normalizedQuery, 160).toLowerCase();

  if (!sessionId && !source && !query && !normalizedQuery && !attribution?.searchEvent) {
    return undefined;
  }

  return {
    sessionId,
    searchEvent: attribution?.searchEvent || null,
    query,
    normalizedQuery,
    source,
    clickedAt: attribution?.clickedAt || null,
  };
};

const getCartResponse = async (userId) => {
  const cart = await Cart.findOne({ user: userId })
    .populate("items.product", "name slug images status")
    .populate(
      "items.sku",
      "code name baseSellingPrice mrp taxEnabled taxPercent hsnSac discount price compareAtPrice images optionValues isActive"
    )
    .lean();

  if (!cart) {
    return {
      id: null,
      items: [],
      subtotal: 0,
      totalItems: 0,
      hasUnavailableItems: false,
    };
  }

  const items = [];
  let subtotal = 0;
  let totalItems = 0;
  let hasUnavailableItems = false;

  for (const item of cart.items || []) {
    const itemType = item.itemType || "sku";

    if (itemType === "custom_hamper") {
      const customHamper = item.customHamper || {};
      const validation = await validateCustomHamper({
        containerId: customHamper.container,
        items: customHamper.items || [],
        decorations: customHamper.decorations || [],
        channel: customHamper.channel || "",
      });

      const quantity = Number(item.quantity || 1);
      const unitPrice = validation.orderable ? validation.pricing.total : 0;
      const lineTotal = validation.orderable
        ? money(unitPrice * quantity)
        : 0;

      if (!validation.orderable) hasUnavailableItems = true;

      const componentMap = new Map(
        (validation.components || []).map((component) => [
          String(component._id),
          component,
        ])
      );

      items.push({
        cartItemId: item._id,
        itemType: "custom_hamper",
        quantity,
        unitPrice,
        lineTotal,
        orderable: validation.orderable,
        message: validation.message,
        attribution: item.attribution || null,
        customHamper: {
          channel: customHamper.channel || "",
          container: validation.container || null,
          items: (validation.items || customHamper.items || []).map(
            (selection) => ({
              component:
                componentMap.get(
                  String(selection.componentId || selection.component)
                ) || null,
              componentId:
                selection.componentId || selection.component || null,
              quantity: Number(selection.quantity || 1),
            })
          ),
          decorations: (
            validation.decorations ||
            customHamper.decorations ||
            []
          ).map((selection) => ({
            component:
              componentMap.get(
                String(selection.componentId || selection.component)
              ) || null,
            componentId:
              selection.componentId || selection.component || null,
            quantity: Number(selection.quantity || 1),
          })),
          personalization: customHamper.personalization || null,
          pricing: validation.pricing || null,
          capacity: validation.capacity || null,
        },
      });

      subtotal = money(subtotal + lineTotal);
      totalItems += quantity;
      continue;
    }

    if (
      !item.product ||
      !item.sku ||
      item.product.status !== PRODUCT_STATUS.ACTIVE ||
      !item.sku.isActive
    ) {
      continue;
    }

    const quantity = Number(item.quantity || 1);
    const lineTotal = money(item.sku.price * quantity);

    items.push({
      cartItemId: item._id,
      itemType: "sku",
      product: item.product,
      sku: item.sku,
      quantity,
      lineTotal,
      orderable: true,
      attribution: item.attribution || null,
    });

    subtotal = money(subtotal + lineTotal);
    totalItems += quantity;
  }

  return {
    id: cart._id,
    items,
    subtotal,
    totalItems,
    hasUnavailableItems,
  };
};

export const uploadCustomHamperPersonalizationAsset = asyncHandler(
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Choose a JPG, PNG, WEBP or AVIF image to upload",
      });
    }

    const type = cleanString(req.body?.type, 40).toLowerCase();
    if (!PERSONALIZATION_ASSET_TYPES.has(type)) {
      return res.status(400).json({ success: false, message: "Invalid personalization asset type" });
    }

    if (!hasAllowedImageSignature(req.file)) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file content does not match a supported image format",
      });
    }

    if (!getPersonalizationUploadSecret()) {
      return res.status(500).json({
        success: false,
        message: "Personalization upload security is not configured",
      });
    }

    const folder = personalizationFolderForUser(req.user._id);
    const uploaded = normalizeUploadResult(await uploadFile(req.file.buffer, { folder }));

    if (!uploaded.url || !uploaded.publicId) {
      return res.status(502).json({
        success: false,
        message: "Personalization image upload did not return a usable file reference",
      });
    }

    const uploadProof = makePersonalizationUploadProof({
      userId: req.user._id,
      publicId: uploaded.publicId,
      url: uploaded.url,
    });

    res.status(201).json({
      success: true,
      message: "Personalization image uploaded",
      asset: {
        type,
        url: uploaded.url,
        publicId: uploaded.publicId,
        uploadProof,
        fileName: cleanString(req.file.originalname, 180),
        mimeType: cleanString(req.file.mimetype, 100).toLowerCase(),
        size: Number(req.file.size || 0),
      },
    });
  }
);

export const deleteCustomHamperPersonalizationAsset = asyncHandler(
  async (req, res) => {
    const publicId = cleanString(req.body?.publicId, 500);
    const url = cleanString(req.body?.url, 2000);
    const uploadProof = cleanString(req.body?.uploadProof, 128).toLowerCase();

    if (!publicId || !url || !uploadProof) {
      return res.status(400).json({
        success: false,
        message: "Personalization image reference is incomplete",
      });
    }
    if (
      !assetBelongsToUser(publicId, req.user._id) ||
      !validPersonalizationUploadProof({
        userId: req.user._id,
        publicId,
        url,
        proof: uploadProof,
      })
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete this personalization image",
      });
    }

    const [cartReference, orderReference, rfqReference] = await Promise.all([
      Cart.exists({
        user: req.user._id,
        "items.customHamper.personalization.assets.publicId": publicId,
      }),
      Order.exists({
        user: req.user._id,
        "items.customHamper.personalization.assets.publicId": publicId,
      }),
      RFQ.exists({
        requester: req.user._id,
        "customHamperRequest.personalization.assets.publicId": publicId,
      }),
    ]);

    if (cartReference || orderReference || rfqReference) {
      return res.status(409).json({
        success: false,
        message:
          "This artwork is already attached to a saved hamper, RFQ or order and cannot be deleted from storage.",
      });
    }

    await deleteFile(publicId);
    res.status(200).json({ success: true, message: "Personalization image deleted" });
  }
);

export const getCart = asyncHandler(async (req, res) => {
  const cart = await getCartResponse(req.user._id);
  res.status(200).json({ success: true, cart });
});

export const addCartItem = asyncHandler(async (req, res) => {
  const {
    skuId,
    quantity = 1,
    analytics = {},
    location = null,
  } = req.body;

  if (!isValidId(skuId)) {
    return res.status(400).json({ success: false, message: "Invalid SKU ID" });
  }

  const parsedQuantity = Number.parseInt(quantity, 10);

  if (
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 1 ||
    parsedQuantity > 99
  ) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be between 1 and 99",
    });
  }

  const sku = await SKU.findById(skuId).populate(
    "product",
    "status name slug"
  );

  if (!sku || !sku.product) {
    return res.status(404).json({ success: false, message: "SKU not found" });
  }

  if (!sku.isActive || sku.product.status !== PRODUCT_STATUS.ACTIVE) {
    return res.status(400).json({
      success: false,
      message: "This product is currently unavailable",
    });
  }

  const searchAttribution = await resolveSearchAttribution({
    sessionId: analytics?.sessionId,
    productId: sku.product._id,
    productSlug: sku.product.slug,
    searchEventId: analytics?.searchEventId,
  });

  const attribution = makeAttributionSnapshot({
    analytics,
    attribution: searchAttribution,
  });

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  const existingItem = cart.items.find(
    (item) =>
      (item.itemType || "sku") === "sku" &&
      String(item.sku) === String(sku._id)
  );

  if (existingItem) {
    const newQuantity = existingItem.quantity + parsedQuantity;

    if (newQuantity > 99) {
      return res.status(400).json({
        success: false,
        message: "Maximum quantity for an item is 99",
      });
    }

    existingItem.quantity = newQuantity;
    if (attribution) existingItem.attribution = attribution;
  } else {
    cart.items.push({
      itemType: "sku",
      product: sku.product._id,
      sku: sku._id,
      customHamper: null,
      attribution,
      quantity: parsedQuantity,
    });
  }

  await cart.save();

  try {
    await recordCommerceEvent({
      eventType: "add_to_cart",
      userId: req.user._id,
      sessionId: attribution?.sessionId || analytics?.sessionId,
      source: attribution?.source || analytics?.source || "product_detail",
      pagePath: analytics?.pagePath,
      productId: sku.product._id,
      skuId: sku._id,
      productSlug: sku.product.slug,
      productName: sku.product.name,
      itemType: "sku",
      quantity: parsedQuantity,
      value: money(Number(sku.price) * parsedQuantity),
      currency: "INR",
      location,
      attribution,
    });
  } catch (error) {
    console.error("Add-to-cart analytics failed:", error.message);
  }

  const updatedCart = await getCartResponse(req.user._id);

  res.status(200).json({
    success: true,
    message: "Item added to cart",
    cart: updatedCart,
  });
});

export const addCustomHamper = asyncHandler(async (req, res) => {
  const {
    containerId,
    items = [],
    decorations = [],
    channel = "",
    personalization = null,
    quantity = 1,
    analytics = {},
    location = null,
  } = req.body;

  const parsedQuantity = Number.parseInt(quantity, 10);

  if (
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 1 ||
    parsedQuantity > 99
  ) {
    return res.status(400).json({
      success: false,
      message: "Hamper quantity must be between 1 and 99",
    });
  }

  const validation = await validateCustomHamper({
    containerId,
    items,
    decorations,
    channel,
  });

  if (!validation.orderable) {
    return res.status(400).json({
      success: false,
      message:
        validation.message || "This custom hamper cannot be added to cart",
    });
  }

  const normalized = normalizeCustomItems(items);
  const normalizedDecorations = normalizeDecorations(decorations);

  if (!normalizedDecorations.valid) {
    return res.status(400).json({
      success: false,
      message: normalizedDecorations.message,
    });
  }

  const normalizedPersonalization = normalizePersonalization(personalization, {
    userId: req.user._id,
    requireOwnedAssets: true,
  });

  if (!normalizedPersonalization.valid) {
    return res.status(400).json({ success: false, message: normalizedPersonalization.message });
  }

  const configurationKey = customConfigurationKey(
    containerId,
    normalized.items,
    normalizedDecorations.items,
    channel,
    normalizedPersonalization.personalization
  );

  const attribution = makeAttributionSnapshot({ analytics });

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  const existingItem = cart.items.find(
    (item) =>
      item.itemType === "custom_hamper" &&
      item.customHamper?.configurationKey === configurationKey
  );

  if (existingItem) {
    const nextQuantity = Number(existingItem.quantity || 1) + parsedQuantity;

    if (nextQuantity > 99) {
      return res.status(400).json({
        success: false,
        message: "Maximum quantity for this custom hamper is 99",
      });
    }

    existingItem.quantity = nextQuantity;
    if (attribution) existingItem.attribution = attribution;
  } else {
    cart.items.push({
      itemType: "custom_hamper",
      product: null,
      sku: null,
      quantity: parsedQuantity,
      attribution,
      customHamper: {
        container: containerId,
        items: normalized.items.map((item) => ({
          component: item.componentId,
          quantity: item.quantity,
        })),
        decorations: normalizedDecorations.items.map((item) => ({
          component: item.componentId,
          quantity: item.quantity,
        })),
        channel: channel || "",
        personalization: normalizedPersonalization.personalization,
        configurationKey,
      },
    });
  }

  await cart.save();

  try {
    await recordCommerceEvent({
      eventType: "add_to_cart",
      userId: req.user._id,
      sessionId: attribution?.sessionId || analytics?.sessionId,
      source: attribution?.source || analytics?.source || "custom_hamper",
      pagePath: analytics?.pagePath,
      itemType: "custom_hamper",
      quantity: parsedQuantity,
      value: money(validation.pricing.total * parsedQuantity),
      currency: validation.pricing.currency || "INR",
      location,
      attribution,
    });
  } catch (error) {
    console.error("Custom hamper analytics failed:", error.message);
  }

  const updatedCart = await getCartResponse(req.user._id);

  res.status(200).json({
    success: true,
    message: "Custom hamper added to cart",
    cart: updatedCart,
  });
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const { skuId } = req.params;
  const { quantity } = req.body;

  if (!isValidId(skuId)) {
    return res.status(400).json({ success: false, message: "Invalid SKU ID" });
  }

  const parsedQuantity = Number.parseInt(quantity, 10);

  if (
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 1 ||
    parsedQuantity > 99
  ) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be between 1 and 99",
    });
  }

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return res.status(404).json({ success: false, message: "Cart not found" });
  }

  const item = cart.items.find(
    (cartItem) =>
      (cartItem.itemType || "sku") === "sku" &&
      String(cartItem.sku) === String(skuId)
  );

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "Cart item not found",
    });
  }

  item.quantity = parsedQuantity;
  await cart.save();

  const updatedCart = await getCartResponse(req.user._id);

  res.status(200).json({
    success: true,
    message: "Cart updated",
    cart: updatedCart,
  });
});

export const updateCustomHamperQuantity = asyncHandler(async (req, res) => {
  const { cartItemId } = req.params;
  const { quantity } = req.body;

  if (!isValidId(cartItemId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid custom hamper cart item ID",
    });
  }

  const parsedQuantity = Number.parseInt(quantity, 10);

  if (
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 1 ||
    parsedQuantity > 99
  ) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be between 1 and 99",
    });
  }

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return res.status(404).json({ success: false, message: "Cart not found" });
  }

  const item = cart.items.id(cartItemId);

  if (!item || item.itemType !== "custom_hamper") {
    return res.status(404).json({
      success: false,
      message: "Custom hamper cart item not found",
    });
  }

  item.quantity = parsedQuantity;
  await cart.save();

  const updatedCart = await getCartResponse(req.user._id);

  res.status(200).json({
    success: true,
    message: "Custom hamper quantity updated",
    cart: updatedCart,
  });
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const { skuId } = req.params;

  if (!isValidId(skuId)) {
    return res.status(400).json({ success: false, message: "Invalid SKU ID" });
  }

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return res.status(404).json({ success: false, message: "Cart not found" });
  }

  cart.items = cart.items.filter(
    (item) =>
      !(
        (item.itemType || "sku") === "sku" &&
        String(item.sku) === String(skuId)
      )
  );

  await cart.save();

  const updatedCart = await getCartResponse(req.user._id);

  res.status(200).json({
    success: true,
    message: "Item removed from cart",
    cart: updatedCart,
  });
});

export const removeCustomHamper = asyncHandler(async (req, res) => {
  const { cartItemId } = req.params;

  if (!isValidId(cartItemId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid custom hamper cart item ID",
    });
  }

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return res.status(404).json({ success: false, message: "Cart not found" });
  }

  const before = cart.items.length;

  cart.items = cart.items.filter(
    (item) =>
      !(
        item.itemType === "custom_hamper" &&
        String(item._id) === String(cartItemId)
      )
  );

  if (cart.items.length === before) {
    return res.status(404).json({
      success: false,
      message: "Custom hamper cart item not found",
    });
  }

  await cart.save();

  const updatedCart = await getCartResponse(req.user._id);

  res.status(200).json({
    success: true,
    message: "Custom hamper removed from cart",
    cart: updatedCart,
  });
});

export const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndUpdate(
    { user: req.user._id },
    { $set: { items: [] } }
  );

  res.status(200).json({
    success: true,
    message: "Cart cleared",
    cart: {
      items: [],
      subtotal: 0,
      totalItems: 0,
      hasUnavailableItems: false,
    },
  });
});
