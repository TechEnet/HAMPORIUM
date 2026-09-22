import mongoose from "mongoose";

import asyncHandler from "../../utils/asyncHandler.js";
import createAuditLog from "../../helpers/createAuditLog.js";
import uploadFile, { deleteFile } from "../../helpers/uploadFile.js";
import { PARTNER_STATUS, PRODUCT_STATUS } from "../../constants/statuses.js";

import User from "../users/user.model.js";
import Address from "../users/address.model.js";
import Product from "../catalog/product.model.js";
import SKU from "../catalog/sku.model.js";
import Component from "../catalog/component.model.js";
import Container from "../catalog/container.model.js";
import Cart from "../cart/cart.model.js";
import Order from "../orders/order.model.js";
import RFQ from "../rfq/rfq.model.js";
import Partner from "../partners/partner.model.js";
import { calculateTaxLine } from "../tax/tax.service.js";

import Promotion, {
  PROMOTION_STATUSES,
  PROMOTION_TYPES,
} from "./promotion.model.js";
import ProductControl from "./productControl.model.js";
import MasterControlState from "./masterControlState.model.js";
import {
  applyPromotionEngine,
  getSkuSafetyPreview,
  normalizePromotionCode,
  resolvePromotionByCode,
} from "./promotion.service.js";

const ENTITY_TYPES = ["product", "sku", "component", "container"];
const PRIVATE_PROMOTION_TYPES = new Set(["client_coupon", "customer_care"]);
const PUBLIC_PROMOTION_TYPES = new Set([
  "automatic_sale",
  "public_coupon",
  "first_order",
]);

const MODEL_BY_TYPE = {
  product: Product,
  sku: SKU,
  component: Component,
  container: Container,
};

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getUserId = (req) => req.user?._id || req.user?.id;

const clean = (value, maxLength = 180) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const cleanMultiline = (value, maxLength = 3000) =>
  String(value || "").trim().slice(0, maxLength);

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const optionalDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(400, "Invalid date");
  return date;
};

const nullableNumber = (value, { min = 0, max = Infinity } = {}) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(min, Math.min(max, number));
};

const numberValue = (value, fallback = 0, { min = 0, max = Infinity } = {}) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
};

const safePublicLink = (value) => {
  const link = String(value || "").trim().slice(0, 500);
  if (!link) return "";
  if (link.startsWith("/") && !link.startsWith("//")) return link;

  try {
    const parsed = new URL(link);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.toString();
  } catch {
    return "";
  }

  return "";
};

const uniqueIds = (values) =>
  [...new Set((Array.isArray(values) ? values : []).map(String))].filter((id) =>
    mongoose.isValidObjectId(id)
  );

const normalizeEmails = (value) =>
  (Array.isArray(value) ? value : String(value || "").split(/[\n,]/))
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 500);

const imageValue = (value = {}) => ({
  url: clean(value?.url, 2000),
  publicId: clean(value?.publicId, 500),
  alt: clean(value?.alt, 180),
});

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

const hasAllowedImageSignature = (file) => {
  const buffer = file?.buffer;
  const mimeType = String(file?.mimetype || "").toLowerCase();
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (mimeType === "image/avif") {
    return (
      buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
      ["avif", "avis"].includes(buffer.subarray(8, 12).toString("ascii"))
    );
  }
  return false;
};

const buildPromotionPayload = (body = {}) => {
  const type = clean(body.type, 40);
  if (!PROMOTION_TYPES.includes(type)) throw createError(400, "Invalid promotion type");

  const status = clean(body.status || "draft", 30);
  if (!PROMOTION_STATUSES.includes(status)) throw createError(400, "Invalid promotion status");

  const discountType = body.discount?.type === "fixed" ? "fixed" : "percentage";
  const discountValue = Math.max(0, Number(body.discount?.value || 0));

  const band = {
    minDiscountPercent: numberValue(body.automaticBand?.minDiscountPercent, 0, {
      min: 0,
      max: 100,
    }),
    targetDiscountPercent: numberValue(body.automaticBand?.targetDiscountPercent, 0, {
      min: 0,
      max: 100,
    }),
    maxDiscountPercent: numberValue(body.automaticBand?.maxDiscountPercent, 0, {
      min: 0,
      max: 100,
    }),
  };

  if (type === "automatic_sale" && band.maxDiscountPercent === 0) {
    band.maxDiscountPercent = band.targetDiscountPercent;
  }

  const code = normalizePromotionCode(body.code);
  const scope = {
    allSkus: body.scope?.allSkus !== false,
    skus: uniqueIds(body.scope?.skus),
    products: uniqueIds(body.scope?.products),
    categories: uniqueIds(body.scope?.categories),
    collections: uniqueIds(body.scope?.collections),
  };

  const selectedScopeCount =
    scope.skus.length +
    scope.products.length +
    scope.categories.length +
    scope.collections.length;

  if (!scope.allSkus && selectedScopeCount === 0) {
    throw createError(400, "Choose at least one product, SKU, category or collection");
  }

  const audience = {
    users: uniqueIds(body.audience?.users),
    emails: normalizeEmails(body.audience?.emails),
  };

  if (
    PRIVATE_PROMOTION_TYPES.has(type) &&
    audience.users.length === 0 &&
    audience.emails.length === 0
  ) {
    throw createError(400, "Choose at least one customer or customer email for this private offer");
  }

  const websiteDisplay = body.websiteDisplay || {};

  return {
    name: clean(body.name, 180),
    type,
    code: code || undefined,
    status,
    discount: {
      type: type === "automatic_sale" ? "percentage" : discountType,
      value: type === "automatic_sale" ? band.targetDiscountPercent : discountValue,
    },
    automaticBand: band,
    minGrossMarginPercent: nullableNumber(body.minGrossMarginPercent, {
      min: 0,
      max: 100,
    }),
    minOrderValue: numberValue(body.minOrderValue, 0, { min: 0 }),
    maxDiscountAmount: numberValue(body.maxDiscountAmount, 0, { min: 0 }),
    stackWithAutomaticSale: Boolean(body.stackWithAutomaticSale),
    scope,
    audience,
    websiteDisplay: {
      enabled: Boolean(websiteDisplay.enabled),
      announcementBar: Boolean(websiteDisplay.announcementBar),
      homeBanner: Boolean(websiteDisplay.homeBanner),
      productBadge: Boolean(websiteDisplay.productBadge),
      checkoutNote: Boolean(websiteDisplay.checkoutNote),
      popupAd: Boolean(websiteDisplay.popupAd),
      floatingAd: Boolean(websiteDisplay.floatingAd),
      adFrequency: ["once_per_session", "once_per_day", "always"].includes(
        websiteDisplay.adFrequency
      )
        ? websiteDisplay.adFrequency
        : "once_per_session",
      adDelaySeconds: numberValue(websiteDisplay.adDelaySeconds, 2, {
        min: 0,
        max: 30,
      }),
      floatingPosition: ["bottom_right", "bottom_left"].includes(
        websiteDisplay.floatingPosition
      )
        ? websiteDisplay.floatingPosition
        : "bottom_right",
      headline: clean(websiteDisplay.headline, 120),
      message: clean(websiteDisplay.message, 260),
      buttonLabel: clean(websiteDisplay.buttonLabel, 40),
      buttonLink: safePublicLink(websiteDisplay.buttonLink),
      badgeText: clean(websiteDisplay.badgeText, 40),
      theme: ["cream", "dark", "orange", "gold"].includes(websiteDisplay.theme)
        ? websiteDisplay.theme
        : "cream",
      imagePosition: ["center", "top", "bottom", "left", "right"].includes(
        websiteDisplay.imagePosition
      )
        ? websiteDisplay.imagePosition
        : "center",
      overlayPercent: numberValue(websiteDisplay.overlayPercent, 38, {
        min: 0,
        max: 90,
      }),
      desktopImage: imageValue(websiteDisplay.desktopImage),
      mobileImage: imageValue(websiteDisplay.mobileImage),
    },
    startsAt: optionalDate(body.startsAt),
    endsAt: optionalDate(body.endsAt),
    priority: numberValue(body.priority, 0, { min: -1000, max: 1000 }),
    customerLabel: clean(body.customerLabel, 120),
    internalNote: cleanMultiline(body.internalNote, 2000),
  };
};

const ensureCodeDoesNotShadowPartner = async (payload, excludePromotionId = null) => {
  if (!payload.code) return;

  if (await Partner.exists({ referralCode: payload.code })) {
    throw createError(
      409,
      "This code already belongs to a partner. Partner codes and HAMPORIUM coupons cannot share a code."
    );
  }

  const query = { code: payload.code };
  if (excludePromotionId) query._id = { $ne: excludePromotionId };
  if (await Promotion.exists(query)) {
    throw createError(409, "A promotion with this code already exists");
  }
};

const audienceAllows = (promotion, user) => {
  if (PUBLIC_PROMOTION_TYPES.has(promotion.type)) return true;
  if (!user || !PRIVATE_PROMOTION_TYPES.has(promotion.type)) return false;

  const userId = String(user._id || user.id || "");
  const email = String(user.email || "").trim().toLowerCase();
  const ids = (promotion.audience?.users || []).map((item) =>
    String(item?._id || item)
  );
  const emails = (promotion.audience?.emails || []).map((item) =>
    String(item || "").trim().toLowerCase()
  );

  return (userId && ids.includes(userId)) || (email && emails.includes(email));
};

const campaignKeywordTarget = (promotion) => {
  const haystack = [
    promotion?.name,
    promotion?.customerLabel,
    promotion?.websiteDisplay?.headline,
    promotion?.websiteDisplay?.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\bdiwali\b/.test(haystack)) return "/diwali";
  if (/\bwedding\b/.test(haystack)) return "/gifts?search=wedding";
  if (/\bcorporate\b/.test(haystack)) return "/gifts?search=corporate";
  if (/\bfestive\b/.test(haystack)) return "/gifts?search=festive";

  return "";
};

const buildPromotionScopeTarget = (promotion) => {
  const skuRows = promotion.scope?.skus || [];
  const productRows = promotion.scope?.products || [];
  const categoryRows = promotion.scope?.categories || [];
  const collectionRows = promotion.scope?.collections || [];

  const productMap = new Map();

  for (const product of productRows) {
    if (!product?._id) continue;
    productMap.set(String(product._id), product);
  }

  for (const sku of skuRows) {
    const product = sku?.product;
    if (!product?._id) continue;
    productMap.set(String(product._id), product);
  }

  const products = [...productMap.values()];

  // Most specific destination first.
  if (products.length === 1 && products[0]?.slug) {
    return {
      link: `/products/${encodeURIComponent(products[0].slug)}`,
      label: products[0].name || promotion.name,
      kind: "product",
    };
  }

  if (collectionRows.length === 1 && collectionRows[0]?.slug) {
    return {
      link: `/collections/${encodeURIComponent(collectionRows[0].slug)}`,
      label: collectionRows[0].name || promotion.name,
      kind: "collection",
    };
  }

  if (categoryRows.length === 1 && categoryRows[0]?.slug) {
    const slug = String(categoryRows[0].slug).trim().toLowerCase();
    return {
      link:
        slug === "diwali-hampers"
          ? "/diwali"
          : `/gifts?category=${encodeURIComponent(slug)}`,
      label: categoryRows[0].name || promotion.name,
      kind: "category",
    };
  }

  const keywordTarget = campaignKeywordTarget(promotion);
  if (keywordTarget) {
    return {
      link: keywordTarget,
      label: promotion.customerLabel || promotion.name,
      kind: "campaign",
    };
  }

  return {
    link: "/gifts",
    label: promotion.customerLabel || promotion.name,
    kind: "all",
  };
};

const promotionToWebsitePayload = (promotion) => {
  const skuRows = promotion.scope?.skus || [];
  const productIds = new Set(
    (promotion.scope?.products || []).map((item) => String(item?._id || item))
  );

  skuRows.forEach((sku) => {
    if (sku?.product) productIds.add(String(sku.product?._id || sku.product));
  });

  const target = buildPromotionScopeTarget(promotion);

  return {
    id: promotion._id,
    name: promotion.name,
    type: promotion.type,
    code: promotion.code || "",
    customerLabel: promotion.customerLabel || "",
    discount: promotion.discount || { type: "percentage", value: 0 },
    automaticBand: promotion.automaticBand || null,
    minOrderValue: Number(promotion.minOrderValue || 0),
    maxDiscountAmount: Number(promotion.maxDiscountAmount || 0),
    startsAt: promotion.startsAt || null,
    endsAt: promotion.endsAt || null,
    priority: Number(promotion.priority || 0),
    updatedAt: promotion.updatedAt || null,
    websiteDisplay: promotion.websiteDisplay || {},
    targetLink: target.link,
    targetLabel: target.label,
    targetKind: target.kind,
    scope: {
      allSkus: promotion.scope?.allSkus !== false,
      productIds: [...productIds],
      skuIds: skuRows.map((item) => String(item?._id || item)),
      categoryIds: (promotion.scope?.categories || []).map((item) =>
        String(item?._id || item)
      ),
      collectionIds: (promotion.scope?.collections || []).map((item) =>
        String(item?._id || item)
      ),
    },
  };
};

const websitePromotionQuery = () => {
  const now = new Date();
  return {
    status: "active",
    "websiteDisplay.enabled": true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
    ],
  };
};

const loadWebsitePromotions = async (filter = {}) =>
  Promotion.find({ ...websitePromotionQuery(), ...filter })
    .select(
      "name type code discount automaticBand minOrderValue maxDiscountAmount scope audience startsAt endsAt priority customerLabel websiteDisplay updatedAt"
    )
    .populate({
      path: "scope.skus",
      select: "_id product",
      populate: {
        path: "product",
        select: "_id name slug category collections",
      },
    })
    .populate("scope.products", "_id name slug category collections")
    .populate("scope.categories", "_id name slug")
    .populate("scope.collections", "_id name slug")
    .sort({ priority: -1, createdAt: -1 })
    .limit(30)
    .lean();

export const listWebsitePromotionsPublic = asyncHandler(async (req, res) => {
  const promotions = await loadWebsitePromotions({
    type: { $in: [...PUBLIC_PROMOTION_TYPES] },
  });

  // Campaign creative changes should appear quickly after an admin update.
  res.set("Cache-Control", "public, max-age=10, must-revalidate");
  res.json({
    success: true,
    promotions: promotions.map(promotionToWebsitePayload),
  });
});

export const listWebsitePromotionsForUser = asyncHandler(async (req, res) => {
  const promotions = await loadWebsitePromotions();
  const eligible = promotions.filter((promotion) => audienceAllows(promotion, req.user));

  res.set("Cache-Control", "private, no-store");
  res.json({
    success: true,
    promotions: eligible.map(promotionToWebsitePayload),
  });
});

export const listPromotionsAdmin = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(String(req.query.search).trim()), "i");
    filter.$or = [{ name: regex }, { code: regex }, { customerLabel: regex }];
  }

  const [promotions, total] = await Promise.all([
    Promotion.find(filter)
      .select("+internalNote")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("audience.users", "name email phone")
      .populate("scope.products", "name slug status")
      .populate("scope.skus", "code name product isActive")
      .populate("scope.categories", "name slug")
      .populate("scope.collections", "name slug")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Promotion.countDocuments(filter),
  ]);

  res.json({
    success: true,
    promotions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const createPromotionAdmin = asyncHandler(async (req, res) => {
  const payload = buildPromotionPayload(req.body || {});
  if (!payload.name) throw createError(400, "Promotion name is required");

  await ensureCodeDoesNotShadowPartner(payload);

  const promotion = await Promotion.create({
    ...payload,
    createdBy: getUserId(req),
    updatedBy: getUserId(req),
  });

  await createAuditLog({
    req,
    action: "promotion_created",
    module: "promotions",
    entityType: "promotion",
    entityId: promotion._id,
    description: `Promotion ${promotion.name} created.`,
    metadata: { type: promotion.type, code: promotion.code || "", status: promotion.status },
  });

  res.status(201).json({
    success: true,
    message: "Promotion created.",
    promotion,
  });
});

export const updatePromotionAdmin = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw createError(400, "Invalid promotion ID");
  }

  const promotion = await Promotion.findById(req.params.id).select("+internalNote");
  if (!promotion) throw createError(404, "Promotion not found");

  const current = promotion.toObject();
  const merged = {
    ...current,
    ...req.body,
    discount: { ...(current.discount || {}), ...(req.body?.discount || {}) },
    automaticBand: {
      ...(current.automaticBand || {}),
      ...(req.body?.automaticBand || {}),
    },
    scope: { ...(current.scope || {}), ...(req.body?.scope || {}) },
    audience: { ...(current.audience || {}), ...(req.body?.audience || {}) },
    websiteDisplay: {
      ...(current.websiteDisplay || {}),
      ...(req.body?.websiteDisplay || {}),
      desktopImage: {
        ...(current.websiteDisplay?.desktopImage || {}),
        ...(req.body?.websiteDisplay?.desktopImage || {}),
      },
      mobileImage: {
        ...(current.websiteDisplay?.mobileImage || {}),
        ...(req.body?.websiteDisplay?.mobileImage || {}),
      },
    },
  };

  const payload = buildPromotionPayload(merged);
  if (!payload.name) throw createError(400, "Promotion name is required");

  await ensureCodeDoesNotShadowPartner(payload, promotion._id);
  promotion.set(payload);
  promotion.updatedBy = getUserId(req);
  await promotion.save();

  await createAuditLog({
    req,
    action: "promotion_updated",
    module: "promotions",
    entityType: "promotion",
    entityId: promotion._id,
    description: `Promotion ${promotion.name} updated.`,
    metadata: { type: promotion.type, code: promotion.code || "", status: promotion.status },
  });

  res.json({ success: true, message: "Promotion updated.", promotion });
});

export const deletePromotionAdmin = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw createError(400, "Invalid promotion ID");
  }

  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) throw createError(404, "Promotion not found");

  const usedInOrder = await Order.exists({ "promotionSnapshots.promotion": promotion._id });
  if (usedInOrder) {
    throw createError(
      409,
      "This promotion has order history and cannot be deleted. Pause or expire it instead."
    );
  }

  for (const slot of ["desktopImage", "mobileImage"]) {
    const publicId = promotion.websiteDisplay?.[slot]?.publicId;
    if (publicId) {
      try {
        await deleteFile(publicId);
      } catch (error) {
        console.error(`Promotion image cleanup failed for ${publicId}:`, error.message);
      }
    }
  }

  await Promotion.deleteOne({ _id: promotion._id });

  await createAuditLog({
    req,
    action: "promotion_deleted",
    module: "promotions",
    entityType: "promotion",
    entityId: promotion._id,
    description: `Unused promotion ${promotion.name} deleted.`,
  });

  res.json({ success: true, message: "Promotion deleted." });
});

export const uploadPromotionDisplayImageAdmin = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw createError(400, "Invalid promotion ID");
  }
  if (!req.file) throw createError(400, "Choose an image to upload");
  if (!hasAllowedImageSignature(req.file)) {
    throw createError(400, "Upload a valid JPG, PNG, WEBP or AVIF image");
  }

  const slot = req.params.slot === "mobile" ? "mobileImage" : req.params.slot === "desktop" ? "desktopImage" : null;
  if (!slot) throw createError(400, "Image slot must be desktop or mobile");

  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) throw createError(404, "Promotion not found");

  const uploaded = normalizeUploadResult(
    await uploadFile(req.file.buffer, {
      folder: `hamporium/promotions/${promotion._id}`,
    })
  );

  if (!uploaded.url) throw createError(502, "Image upload did not return a usable URL");

  const oldPublicId = promotion.websiteDisplay?.[slot]?.publicId;
  promotion.set(`websiteDisplay.${slot}`, {
    url: uploaded.url,
    publicId: uploaded.publicId,
    alt: clean(req.body?.alt || promotion.name, 180),
  });
  // A campaign image can be used by the large home banner, popup or floating
  // side ad. Keep the admin's chosen placement. If no visual placement was
  // selected, default to a dismissible one-time popup instead of silently
  // creating a full-width homepage banner.
  promotion.websiteDisplay.enabled = true;
  if (
    !promotion.websiteDisplay.homeBanner &&
    !promotion.websiteDisplay.popupAd &&
    !promotion.websiteDisplay.floatingAd
  ) {
    promotion.websiteDisplay.popupAd = true;
  }
  promotion.updatedBy = getUserId(req);
  await promotion.save();

  if (oldPublicId && oldPublicId !== uploaded.publicId) {
    try {
      await deleteFile(oldPublicId);
    } catch (error) {
      console.error(`Old promotion image cleanup failed for ${oldPublicId}:`, error.message);
    }
  }

  res.status(201).json({
    success: true,
    message: `${req.params.slot === "mobile" ? "Mobile" : "Desktop"} banner image uploaded.`,
    promotion,
  });
});

export const removePromotionDisplayImageAdmin = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw createError(400, "Invalid promotion ID");
  const slot = req.params.slot === "mobile" ? "mobileImage" : req.params.slot === "desktop" ? "desktopImage" : null;
  if (!slot) throw createError(400, "Image slot must be desktop or mobile");

  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) throw createError(404, "Promotion not found");

  const publicId = promotion.websiteDisplay?.[slot]?.publicId;
  promotion.set(`websiteDisplay.${slot}`, { url: "", publicId: "", alt: "" });
  promotion.updatedBy = getUserId(req);
  await promotion.save();

  if (publicId) {
    try {
      await deleteFile(publicId);
    } catch (error) {
      console.error(`Promotion image cleanup failed for ${publicId}:`, error.message);
    }
  }

  res.json({ success: true, message: "Banner image removed.", promotion });
});

export const previewPromotionCode = asyncHandler(async (req, res) => {
  const code = normalizePromotionCode(req.body?.code);
  if (!code) throw createError(400, "Promo or partner code is required");

  // Code namespaces must never overlap. Promotion creation already blocks new
  // collisions; this extra check also fails closed if legacy data is dirty.
  const [promotionNamespaceExists, partnerNamespaceExists] = await Promise.all([
    Promotion.exists({ code }),
    Partner.exists({ referralCode: code }),
  ]);

  if (promotionNamespaceExists && partnerNamespaceExists) {
    throw createError(
      409,
      "This code has a configuration conflict. Please contact HAMPORIUM support."
    );
  }

  // First resolve HAMPORIUM promotions with every account-level rule applied:
  // active status, date window, private audience and first-order eligibility.
  const promotion = await resolvePromotionByCode({ code, user: req.user });

  if (promotion) {
    return res.json({
      success: true,
      valid: true,
      kind: "promotion",
      promotion: {
        type: promotion.type,
        code: promotion.code || "",
        name: promotion.customerLabel || promotion.name,
        discount: promotion.discount,
        minOrderValue: Number(promotion.minOrderValue || 0),
        maxDiscountAmount: Number(promotion.maxDiscountAmount || 0),
        stackWithAutomaticSale: Boolean(promotion.stackWithAutomaticSale),
      },
    });
  }

  // If a promotion owns this code but is paused, expired, not started, private
  // to somebody else, or no longer first-order eligible, do NOT reinterpret it
  // as a partner code. This prevents type-confusion and information leakage.
  if (promotionNamespaceExists) {
    return res.status(404).json({
      success: false,
      valid: false,
      message: "This code is not available for your account or order.",
    });
  }

  const partner = await Partner.findOne({
    referralCode: code,
    status: PARTNER_STATUS.APPROVED,
  })
    .select(
      "partnerId referralCode businessName owner members.user members.isActive +customerDiscountRate"
    )
    .lean();

  if (!partner) {
    return res.status(404).json({
      success: false,
      valid: false,
      message: "This code is invalid or unavailable.",
    });
  }

  const userId = String(getUserId(req) || "");
  const ownerId = String(partner.owner || "");
  const isActiveMember = (partner.members || []).some(
    (member) => member?.isActive && String(member.user || "") === userId
  );

  if (userId && (ownerId === userId || isActiveMember)) {
    throw createError(403, "You cannot use your own partner code.");
  }

  return res.json({
    success: true,
    valid: true,
    kind: "partner",
    referral: {
      referralCode: partner.referralCode,
      partnerId: partner.partnerId,
      businessName: partner.businessName,
      discountPercent: Math.max(
        0,
        Math.min(100, Number(partner.customerDiscountRate || 0))
      ),
    },
  });
});


const buildPromotionQuoteSkuItem = ({ sku, quantity, destinationState = "" }) => {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    throw createError(400, "Quantity must be between 1 and 99");
  }

  if (
    !sku ||
    !sku.isActive ||
    !sku.product ||
    sku.product.status !== PRODUCT_STATUS.ACTIVE
  ) {
    throw createError(409, "One or more products are no longer available.");
  }

  const pricing = calculateTaxLine({
    baseUnitPrice: Number(sku.baseSellingPrice ?? sku.price ?? 0),
    quantity: qty,
    taxPercent: sku.taxPercent ?? 0,
    hsnSac: sku.hsnSac || "",
    taxEnabled: sku.taxEnabled !== false,
    discount: sku.discount || {},
    destinationState,
  });

  return {
    itemType: "sku",
    product: sku.product._id,
    sku: sku._id,
    productName: sku.product.name,
    productSlug: sku.product.slug,
    skuName: sku.name,
    skuCode: sku.code,
    quantity: qty,
    baseUnitPrice: pricing.baseUnitPrice,
    baseLineTotal: pricing.baseLineTotal,
    discount: {
      ...pricing.discount,
      amount: pricing.discountAmount,
    },
    promotionDiscountAmount: 0,
    partnerPromoDiscountAmount: 0,
    taxableAmount: pricing.taxableValue,
    tax: pricing.tax,
    unitPrice: pricing.unitPrice,
    lineTotal: pricing.lineTotal,
  };
};

const loadPromotionQuoteItems = async ({ req, mode, skuId, quantity }) => {
  let destinationState = "";
  const addressId = String(req.body?.addressId || "").trim();

  if (addressId) {
    if (!mongoose.isValidObjectId(addressId)) {
      throw createError(400, "Invalid delivery address");
    }

    const address = await Address.findOne({
      _id: addressId,
      user: getUserId(req),
    })
      .select("state")
      .lean();

    if (!address) throw createError(404, "Delivery address not found");
    destinationState = address.state || "";
  }

  if (mode === "buy_now") {
    if (!mongoose.isValidObjectId(skuId)) {
      throw createError(400, "Invalid product option");
    }

    const sku = await SKU.findById(skuId)
      .populate("product", "name slug status category collections")
      .lean();

    if (!sku) throw createError(404, "Product option not found");

    return [
      buildPromotionQuoteSkuItem({
        sku,
        quantity: Number(quantity || 1),
        destinationState,
      }),
    ];
  }

  if (mode !== "cart") {
    throw createError(400, "Invalid checkout mode");
  }

  const cart = await Cart.findOne({ user: getUserId(req) }).lean();
  if (!cart?.items?.length) throw createError(400, "Your cart is empty");

  const rows = (cart.items || []).filter(
    (item) => (item.itemType || "sku") === "sku" && item.sku
  );

  if (!rows.length) {
    throw createError(
      400,
      "This promotion does not apply to custom hampers in the current promotion setup."
    );
  }

  const skuIds = [...new Set(rows.map((item) => String(item.sku)))].filter(
    (id) => mongoose.isValidObjectId(id)
  );

  const skus = await SKU.find({ _id: { $in: skuIds } })
    .populate("product", "name slug status category collections")
    .lean();
  const skuMap = new Map(skus.map((sku) => [String(sku._id), sku]));

  return rows.map((row) => {
    const sku = skuMap.get(String(row.sku));
    if (!sku) throw createError(409, "A cart item is no longer available.");
    return buildPromotionQuoteSkuItem({
      sku,
      quantity: Number(row.quantity || 1),
      destinationState,
    });
  });
};

// Secure checkout quote for normal HAMPORIUM promotions.
// All prices, product scope and margin checks are recalculated from server data.
// The client only sends the code + checkout mode; it cannot submit a discount amount.
export const quotePromotionCode = asyncHandler(async (req, res) => {
  const code = normalizePromotionCode(req.body?.code);
  if (!code) throw createError(400, "Promotion code is required");

  const [promotionNamespaceExists, partnerNamespaceExists] = await Promise.all([
    Promotion.exists({ code }),
    Partner.exists({ referralCode: code }),
  ]);

  if (promotionNamespaceExists && partnerNamespaceExists) {
    throw createError(
      409,
      "This code has a configuration conflict. Please contact HAMPORIUM support."
    );
  }

  if (!promotionNamespaceExists) {
    throw createError(404, "Promotion code is unavailable");
  }

  const promotion = await resolvePromotionByCode({ code, user: req.user });
  if (!promotion) {
    throw createError(404, "This promotion is not available for your account.");
  }

  const items = await loadPromotionQuoteItems({
    req,
    mode: String(req.body?.mode || "cart").trim().toLowerCase(),
    skuId: req.body?.skuId,
    quantity: req.body?.quantity,
  });

  const beforeTotal = Number(
    items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0).toFixed(2)
  );

  const result = await applyPromotionEngine({
    items,
    user: req.user,
    explicitPromotion: promotion,
    suppressAutomatic: false,
  });

  const explicitSnapshot = (result.promotionSnapshots || []).find(
    (snapshot) =>
      String(snapshot.promotion || "") === String(promotion._id) ||
      String(snapshot.code || "").toUpperCase() === code
  );

  if (!explicitSnapshot || Number(explicitSnapshot.customerSavings || 0) <= 0) {
    throw createError(400, "This promotion does not provide a discount on these items.");
  }

  const afterTotal = Number(
    items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0).toFixed(2)
  );
  const totalSavings = Number(Math.max(0, beforeTotal - afterTotal).toFixed(2));

  res.json({
    success: true,
    valid: true,
    quote: {
      code,
      promotionId: promotion._id,
      name: promotion.customerLabel || promotion.name,
      discountType: explicitSnapshot.discountType,
      discountValue: Number(explicitSnapshot.discountValue || 0),
      discountAmount: Number(explicitSnapshot.discountAmount || 0),
      taxReductionAmount: Number(explicitSnapshot.taxReductionAmount || 0),
      customerSavings: Number(explicitSnapshot.customerSavings || 0),
      totalSavings,
      beforeEligibleTotal: beforeTotal,
      afterEligibleTotal: afterTotal,
      appliedSkus: explicitSnapshot.appliedSkus || [],
      stackedPromotionCount: Math.max(
        0,
        Number((result.promotionSnapshots || []).length) - 1
      ),
    },
  });
});

export const listSkuControlsAdmin = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const search = String(req.query.search || "").trim();
  const filter = {};

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const products = await Product.find({ name: regex }).select("_id").limit(100).lean();
    filter.$or = [
      { code: regex },
      { name: regex },
      { product: { $in: products.map((item) => item._id) } },
    ];
  }

  const skus = await SKU.find(filter)
    .select("code name product baseSellingPrice price discount taxPercent isActive container")
    .populate("product", "name slug status")
    .populate("container", "name code")
    .sort({ isActive: -1, code: 1 })
    .limit(limit)
    .lean();

  const controls = await ProductControl.find({
    sku: { $in: skus.map((item) => item._id) },
  }).lean();
  const controlMap = new Map(controls.map((item) => [String(item.sku), item]));

  res.json({
    success: true,
    skus: skus.map((sku) => ({
      ...sku,
      control: controlMap.get(String(sku._id)) || null,
    })),
  });
});

export const getSkuSafetyAdmin = asyncHandler(async (req, res) => {
  const preview = await getSkuSafetyPreview({
    skuId: req.params.skuId,
    commissionRate: Number(req.query.commissionRate || 0),
  });
  res.json({ success: true, preview });
});

export const updateSkuControlAdmin = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.skuId)) throw createError(400, "Invalid SKU ID");

  const sku = await SKU.findById(req.params.skuId).select("product code name").lean();
  if (!sku) throw createError(404, "SKU not found");

  const marginPolicy = req.body?.marginPolicy || {};
  const promoEligibility = req.body?.promoEligibility || {};

  const payload = {
    sku: sku._id,
    product: sku.product || null,
    marginPolicy: {
      minGrossMarginPercent: nullableNumber(marginPolicy.minGrossMarginPercent, {
        min: 0,
        max: 100,
      }),
      unitCostOverride: nullableNumber(marginPolicy.unitCostOverride, { min: 0 }),
      extraUnitCost: numberValue(marginPolicy.extraUnitCost, 0, { min: 0 }),
      deliverySubsidy: numberValue(marginPolicy.deliverySubsidy, 0, { min: 0 }),
      paymentFeePercent: nullableNumber(marginPolicy.paymentFeePercent, {
        min: 0,
        max: 100,
      }),
    },
    promoEligibility: {
      allowAutomaticSale: promoEligibility.allowAutomaticSale !== false,
      allowCoupons: promoEligibility.allowCoupons !== false,
      allowPartnerCode: promoEligibility.allowPartnerCode !== false,
    },
    note: cleanMultiline(req.body?.note, 1600),
    updatedBy: getUserId(req),
  };

  const control = await ProductControl.findOneAndUpdate(
    { sku: sku._id },
    { $set: payload },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  await createAuditLog({
    req,
    action: "product_promotion_control_updated",
    module: "promotions",
    entityType: "sku",
    entityId: sku._id,
    description: `Promotion safety control updated for ${sku.code}.`,
  });

  const preview = await getSkuSafetyPreview({ skuId: sku._id });
  res.json({
    success: true,
    message: "SKU promotion controls updated.",
    control,
    preview,
  });
});

const requireEntityType = (value) => {
  const type = String(value || "").toLowerCase();
  if (!ENTITY_TYPES.includes(type)) throw createError(400, "Invalid item type");
  return type;
};

const getModel = (type) => MODEL_BY_TYPE[requireEntityType(type)];

const stateMapFor = async (type, ids) => {
  if (!ids.length) return new Map();
  const rows = await MasterControlState.find({
    entityType: type,
    entityId: { $in: ids },
  }).lean();
  return new Map(rows.map((row) => [String(row.entityId), row]));
};

const masterSearchFilter = async (type, search) => {
  if (!search) return {};
  const regex = new RegExp(escapeRegex(search), "i");

  if (type === "product") {
    return { $or: [{ name: regex }, { slug: regex }, { brand: regex }] };
  }
  if (type === "sku") {
    const productIds = await Product.find({ name: regex }).distinct("_id");
    return {
      $or: [{ code: regex }, { name: regex }, { product: { $in: productIds } }],
    };
  }
  return {
    $or: [
      { code: regex },
      { name: regex },
      ...(type === "component"
        ? [{ brand: regex }, { category: regex }, { subcategory: regex }]
        : [{ material: regex }, { category: regex }, { subcategory: regex }]),
    ],
  };
};

const liveFilterFor = (type) => {
  if (type === "product") return { status: PRODUCT_STATUS.ACTIVE };
  return { isActive: true };
};

const hiddenFilterFor = (type) => {
  if (type === "product") return { status: { $ne: PRODUCT_STATUS.ACTIVE } };
  return { isActive: { $ne: true } };
};

const listSelectFor = (type) => {
  if (type === "product") {
    return "name slug brand status isFeatured minPrice maxPrice skuCount images category collections updatedAt";
  }
  if (type === "sku") {
    return "code name product baseSellingPrice mrp price isActive sortOrder images container updatedAt";
  }
  if (type === "component") {
    return "code name brand type hamperRole sellingPrice mrp actualLandedCost availability customerSelectable isActive images category subcategory updatedAt";
  }
  return "code name material sellingPrice mrp actualLandedCost availability customerSelectable isActive images category subcategory sortOrder updatedAt";
};

const populateMasterList = (query, type) => {
  if (type === "sku") return query.populate("product", "name slug status");
  if (type === "product") {
    return query
      .populate("category", "name slug")
      .populate("collections", "name slug");
  }
  return query;
};

export const listMasterItemsAdmin = asyncHandler(async (req, res) => {
  const type = requireEntityType(req.query.type || "product");
  const Model = getModel(type);
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 40)));
  const search = String(req.query.search || "").trim();
  const state = ["all", "live", "hidden", "archived"].includes(req.query.state)
    ? req.query.state
    : "all";

  const searchFilter = await masterSearchFilter(type, search);
  const archivedRows = await MasterControlState.find({
    entityType: type,
    archived: true,
  })
    .select("entityId")
    .lean();
  const archivedIds = archivedRows.map((row) => row.entityId);

  const filter = { ...searchFilter };
  if (state === "archived") {
    filter._id = { $in: archivedIds };
  } else {
    if (archivedIds.length) filter._id = { $nin: archivedIds };
    if (state === "live") Object.assign(filter, liveFilterFor(type));
    if (state === "hidden") Object.assign(filter, hiddenFilterFor(type));
  }

  let query = Model.find(filter)
    .select(listSelectFor(type))
    .sort(type === "product" ? { updatedAt: -1 } : { isActive: -1, name: 1 })
    .skip((page - 1) * limit)
    .limit(limit);
  query = populateMasterList(query, type);

  const [items, total] = await Promise.all([query.lean(), Model.countDocuments(filter)]);
  const stateMap = await stateMapFor(type, items.map((item) => item._id));

  res.json({
    success: true,
    items: items.map((item) => ({
      ...item,
      masterState: stateMap.get(String(item._id)) || null,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const findMasterItem = async (type, id) => {
  if (!mongoose.isValidObjectId(id)) throw createError(400, "Invalid item ID");
  const Model = getModel(type);
  let query = Model.findById(id);

  if (type === "product") {
    query = query.populate("category", "name slug").populate("collections", "name slug");
  } else if (type === "sku") {
    query = query
      .populate("product", "name slug status category collections")
      .populate("container", "name code isActive customerSelectable")
      .populate("hamperContents.component", "name code type hamperRole isActive customerSelectable")
      .populate("internalMaterials.component", "name code type isActive");
  } else if (type === "container") {
    query = query.populate("packingMaterials.component", "name code type isActive");
  }

  const item = await query.lean();
  if (!item) throw createError(404, "Item not found");
  const masterState = await MasterControlState.findOne({
    entityType: type,
    entityId: id,
  }).lean();

  return { item, masterState };
};

export const getMasterItemAdmin = asyncHandler(async (req, res) => {
  const type = requireEntityType(req.params.type);
  const result = await findMasterItem(type, req.params.id);
  res.json({ success: true, ...result });
});

const normalizeDiscount = (discount = {}) => ({
  enabled: Boolean(discount.enabled),
  type: discount.type === "fixed" ? "fixed" : "percentage",
  value: numberValue(discount.value, 0, { min: 0, max: discount.type === "percentage" ? 100 : Infinity }),
});

const normalizeProductionLeadTime = (value = {}) => ({
  personalizationDays: numberValue(value.personalizationDays, 0, { min: 0 }),
  assemblyDays: numberValue(value.assemblyDays, 0, { min: 0 }),
  packingDays: numberValue(value.packingDays, 0, { min: 0 }),
});

const normalizeAvailability = (value = {}, includeUnit = false) => ({
  status: ["in_stock", "incoming", "out_of_stock"].includes(value.status)
    ? value.status
    : "in_stock",
  availableQuantity: nullableNumber(value.availableQuantity, { min: 0 }),
  ...(includeUnit ? { unit: clean(value.unit || "pc", 30) || "pc" } : {}),
  nextAvailableDate: value.nextAvailableDate ? optionalDate(value.nextAvailableDate) : null,
});

const normalizeChannels = (value = {}) => ({
  corporate: Boolean(value.corporate),
  wedding: Boolean(value.wedding),
  diwali: Boolean(value.diwali),
  hamperOne: Boolean(value.hamperOne),
});

const normalizeMaterialRows = (rows = [], { content = false } = {}) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => mongoose.isValidObjectId(row?.component?._id || row?.component))
    .map((row, index) => ({
      ...(row._id && mongoose.isValidObjectId(row._id) ? { _id: row._id } : {}),
      component: row.component?._id || row.component,
      quantity: Math.max(0.001, Number(row.quantity || 1)),
      unit: clean(row.unit || "pc", 30) || "pc",
      ...(content
        ? {
            displayName: clean(row.displayName, 180),
            sortOrder: numberValue(row.sortOrder, index, { min: -10000, max: 10000 }),
            isOptional: Boolean(row.isOptional),
          }
        : {
            specification: cleanMultiline(row.specification, 1000),
            notes: cleanMultiline(row.notes, 2000),
          }),
    }));

const updatePayloadFor = (type, body = {}) => {
  if (type === "product") {
    const payload = {};
    for (const field of ["name", "slug", "brand"]) {
      if (body[field] !== undefined) payload[field] = clean(body[field], field === "name" ? 180 : 160);
    }
    if (body.shortDescription !== undefined) payload.shortDescription = cleanMultiline(body.shortDescription, 500);
    if (body.description !== undefined) payload.description = cleanMultiline(body.description, 10000);
    if (body.status !== undefined) payload.status = clean(body.status, 40);
    if (body.isFeatured !== undefined) payload.isFeatured = Boolean(body.isFeatured);
    if (body.category !== undefined && mongoose.isValidObjectId(body.category?._id || body.category)) {
      payload.category = body.category?._id || body.category;
    }
    if (body.collections !== undefined) payload.collections = uniqueIds(body.collections);
    if (body.tags !== undefined) {
      payload.tags = [...new Set((Array.isArray(body.tags) ? body.tags : String(body.tags).split(/[\n,]/)).map((tag) => clean(tag, 80)).filter(Boolean))].slice(0, 100);
    }
    return payload;
  }

  if (type === "sku") {
    const payload = {};
    if (body.name !== undefined) payload.name = clean(body.name, 120);
    if (body.code !== undefined) payload.code = clean(body.code, 120).toUpperCase();
    if (body.skuBarcode !== undefined) payload.skuBarcode = clean(body.skuBarcode, 120);
    if (body.baseSellingPrice !== undefined) payload.baseSellingPrice = nullableNumber(body.baseSellingPrice, { min: 0 });
    if (body.mrp !== undefined) payload.mrp = nullableNumber(body.mrp, { min: 0 });
    if (body.taxEnabled !== undefined) payload.taxEnabled = Boolean(body.taxEnabled);
    if (body.taxPercent !== undefined) payload.taxPercent = numberValue(body.taxPercent, 0, { min: 0, max: 100 });
    if (body.hsnSac !== undefined) payload.hsnSac = clean(body.hsnSac, 40);
    if (body.discount !== undefined) payload.discount = normalizeDiscount(body.discount);
    if (body.isActive !== undefined) payload.isActive = Boolean(body.isActive);
    if (body.sortOrder !== undefined) payload.sortOrder = numberValue(body.sortOrder, 0, { min: -100000, max: 100000 });
    if (body.defaultCourierDays !== undefined) payload.defaultCourierDays = nullableNumber(body.defaultCourierDays, { min: 0, max: 60 });
    if (body.earliestExpiryDate !== undefined) payload.earliestExpiryDate = body.earliestExpiryDate ? optionalDate(body.earliestExpiryDate) : null;
    if (body.productionLeadTime !== undefined) payload.productionLeadTime = normalizeProductionLeadTime(body.productionLeadTime);
    if (body.container !== undefined) payload.container = mongoose.isValidObjectId(body.container?._id || body.container) ? body.container?._id || body.container : null;
    if (body.hamperContents !== undefined) payload.hamperContents = normalizeMaterialRows(body.hamperContents, { content: true });
    if (body.internalMaterials !== undefined) payload.internalMaterials = normalizeMaterialRows(body.internalMaterials);
    if (body.optionValues !== undefined && body.optionValues && typeof body.optionValues === "object") payload.optionValues = body.optionValues;
    return payload;
  }

  if (type === "component") {
    const payload = {};
    for (const [field, max] of [
      ["name", 180], ["code", 80], ["brand", 120], ["categoryCode", 60], ["category", 180], ["subcategory", 180], ["segment", 180], ["uom", 30], ["dietary", 120], ["personalizationMethod", 240]
    ]) {
      if (body[field] !== undefined) payload[field] = field === "code" ? clean(body[field], max).toUpperCase() : clean(body[field], max);
    }
    if (body.description !== undefined) payload.description = cleanMultiline(body.description, 2000);
    if (body.internalNotes !== undefined) payload.internalNotes = cleanMultiline(body.internalNotes, 3000);
    if (body.type !== undefined) payload.type = body.type;
    if (body.hamperRole !== undefined) payload.hamperRole = body.hamperRole;
    for (const field of ["mrp", "sellingPrice", "latestUnitCost", "actualLandedCost", "minGrossMarginPercent", "moqQty", "leadTimeDays", "shelfLifeDays", "piecesPerUom", "productPriority"]) {
      if (body[field] !== undefined) payload[field] = nullableNumber(body[field], { min: 0, max: field === "minGrossMarginPercent" ? 100 : Infinity });
    }
    if (body.taxEnabled !== undefined) payload.taxEnabled = Boolean(body.taxEnabled);
    if (body.taxPercent !== undefined) payload.taxPercent = nullableNumber(body.taxPercent, { min: 0, max: 100 });
    if (body.hsnSac !== undefined) payload.hsnSac = clean(body.hsnSac, 40);
    if (body.discount !== undefined) payload.discount = normalizeDiscount(body.discount);
    if (body.availability !== undefined) payload.availability = normalizeAvailability(body.availability, true);
    if (body.channels !== undefined) payload.channels = normalizeChannels(body.channels);
    for (const field of ["fragile", "expiryTracked", "personalizable", "hamperUse", "customerSelectable", "isActive"]) {
      if (body[field] !== undefined) payload[field] = Boolean(body[field]);
    }
    if (body.expiryDate !== undefined) payload.expiryDate = body.expiryDate ? optionalDate(body.expiryDate) : null;
    return payload;
  }

  const payload = {};
  for (const [field, max] of [
    ["name", 180], ["code", 80], ["material", 180], ["categoryCode", 60], ["category", 180], ["subcategory", 180], ["segment", 180], ["hsnSac", 40]
  ]) {
    if (body[field] !== undefined) payload[field] = field === "code" ? clean(body[field], max).toUpperCase() : clean(body[field], max);
  }
  if (body.description !== undefined) payload.description = cleanMultiline(body.description, 2000);
  if (body.internalNotes !== undefined) payload.internalNotes = cleanMultiline(body.internalNotes, 3000);
  for (const field of ["mrp", "sellingPrice", "latestUnitCost", "actualLandedCost", "minGrossMarginPercent", "leadTimeDays", "defaultCourierDays", "usableVolumePercent", "maxItems", "productPriority", "sortOrder"]) {
    if (body[field] !== undefined) payload[field] = nullableNumber(body[field], {
      min: field === "sortOrder" ? -100000 : 0,
      max: field === "minGrossMarginPercent" ? 100 : field === "usableVolumePercent" ? 100 : field === "defaultCourierDays" ? 60 : Infinity,
    });
  }
  if (body.taxEnabled !== undefined) payload.taxEnabled = Boolean(body.taxEnabled);
  if (body.taxPercent !== undefined) payload.taxPercent = nullableNumber(body.taxPercent, { min: 0, max: 100 });
  if (body.discount !== undefined) payload.discount = normalizeDiscount(body.discount);
  if (body.availability !== undefined) payload.availability = normalizeAvailability(body.availability, false);
  if (body.channels !== undefined) payload.channels = normalizeChannels(body.channels);
  for (const field of ["hamperUse", "customerSelectable", "isActive"]) {
    if (body[field] !== undefined) payload[field] = Boolean(body[field]);
  }
  if (body.productionLeadTime !== undefined) payload.productionLeadTime = normalizeProductionLeadTime(body.productionLeadTime);
  if (body.packingMaterials !== undefined) payload.packingMaterials = normalizeMaterialRows(body.packingMaterials);
  return payload;
};

const syncProductSummary = async (productId) => {
  if (!productId || !mongoose.isValidObjectId(productId)) return;
  const rows = await SKU.find({ product: productId, isActive: true }).select("price").lean();
  const prices = rows.map((row) => Number(row.price)).filter(Number.isFinite);
  await Product.findByIdAndUpdate(productId, {
    $set: {
      skuCount: rows.length,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
    },
  });
};

export const updateMasterItemAdmin = asyncHandler(async (req, res) => {
  const type = requireEntityType(req.params.type);
  if (!mongoose.isValidObjectId(req.params.id)) throw createError(400, "Invalid item ID");

  const Model = getModel(type);
  const item = await Model.findById(req.params.id);
  if (!item) throw createError(404, "Item not found");

  const oldProductId = type === "sku" ? item.product : null;
  const payload = updatePayloadFor(type, req.body || {});
  item.set(payload);
  await item.save();

  if (type === "sku") {
    await syncProductSummary(item.product);
    if (oldProductId && String(oldProductId) !== String(item.product)) {
      await syncProductSummary(oldProductId);
    }
  }

  await MasterControlState.findOneAndUpdate(
    { entityType: type, entityId: item._id },
    {
      $push: {
        history: {
          action: "update",
          actor: getUserId(req),
          note: clean(req.body?.changeNote, 800),
          at: new Date(),
        },
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  await createAuditLog({
    req,
    action: "master_control_item_updated",
    module: "master_control",
    entityType: type,
    entityId: item._id,
    description: `${type} updated from Master Control.`,
  });

  const result = await findMasterItem(type, item._id);
  res.json({ success: true, message: "Changes saved.", ...result });
});

const archiveSnapshotFor = async (type, item) => {
  if (type === "product") {
    const skus = await SKU.find({ product: item._id }).select("_id isActive").lean();
    return {
      status: item.status,
      isFeatured: Boolean(item.isFeatured),
      skuStates: skus.map((sku) => ({ id: sku._id, isActive: Boolean(sku.isActive) })),
    };
  }
  if (type === "sku") return { isActive: Boolean(item.isActive) };
  return {
    isActive: Boolean(item.isActive),
    customerSelectable: Boolean(item.customerSelectable),
  };
};

export const archiveMasterItemAdmin = asyncHandler(async (req, res) => {
  const type = requireEntityType(req.params.type);
  if (!mongoose.isValidObjectId(req.params.id)) throw createError(400, "Invalid item ID");
  const Model = getModel(type);
  const item = await Model.findById(req.params.id);
  if (!item) throw createError(404, "Item not found");

  const existing = await MasterControlState.findOne({ entityType: type, entityId: item._id });
  if (existing?.archived) {
    return res.json({ success: true, message: "Item is already archived." });
  }

  const previousState = await archiveSnapshotFor(type, item);
  if (type === "product") {
    item.status = PRODUCT_STATUS.DRAFT;
    item.isFeatured = false;
    await item.save();
    await SKU.updateMany({ product: item._id }, { $set: { isActive: false } });
    await syncProductSummary(item._id);
  } else if (type === "sku") {
    item.isActive = false;
    await item.save();
    await syncProductSummary(item.product);
  } else {
    item.isActive = false;
    item.customerSelectable = false;
    await item.save();
  }

  const reason = clean(req.body?.reason, 800);
  await MasterControlState.findOneAndUpdate(
    { entityType: type, entityId: item._id },
    {
      $set: {
        archived: true,
        archivedAt: new Date(),
        archivedBy: getUserId(req),
        restoredAt: null,
        restoredBy: null,
        reason,
        previousState,
      },
      $push: {
        history: {
          action: "archive",
          actor: getUserId(req),
          note: reason,
          at: new Date(),
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await createAuditLog({
    req,
    action: "master_control_item_archived",
    module: "master_control",
    entityType: type,
    entityId: item._id,
    description: `${type} archived from Master Control.`,
  });

  res.json({ success: true, message: "Item archived. It is no longer available to customers." });
});

export const restoreMasterItemAdmin = asyncHandler(async (req, res) => {
  const type = requireEntityType(req.params.type);
  if (!mongoose.isValidObjectId(req.params.id)) throw createError(400, "Invalid item ID");
  const Model = getModel(type);
  const item = await Model.findById(req.params.id);
  if (!item) throw createError(404, "Item not found");

  const state = await MasterControlState.findOne({ entityType: type, entityId: item._id });
  if (!state?.archived) {
    return res.json({ success: true, message: "Item is not archived." });
  }

  const previous = state.previousState || {};
  if (type === "product") {
    item.status = previous.status || PRODUCT_STATUS.ACTIVE;
    item.isFeatured = Boolean(previous.isFeatured);
    await item.save();
    if (Array.isArray(previous.skuStates)) {
      for (const skuState of previous.skuStates) {
        if (!mongoose.isValidObjectId(skuState.id)) continue;
        await SKU.findByIdAndUpdate(skuState.id, {
          $set: { isActive: skuState.isActive !== false },
        });
      }
    }
    await syncProductSummary(item._id);
  } else if (type === "sku") {
    item.isActive = previous.isActive !== false;
    await item.save();
    await syncProductSummary(item.product);
  } else {
    item.isActive = previous.isActive !== false;
    item.customerSelectable = previous.customerSelectable !== false;
    await item.save();
  }

  state.archived = false;
  state.restoredAt = new Date();
  state.restoredBy = getUserId(req);
  state.history.push({
    action: "restore",
    actor: getUserId(req),
    note: clean(req.body?.reason, 800),
    at: new Date(),
  });
  await state.save();

  await createAuditLog({
    req,
    action: "master_control_item_restored",
    module: "master_control",
    entityType: type,
    entityId: item._id,
    description: `${type} restored from Master Control.`,
  });

  res.json({ success: true, message: "Item restored." });
});

const deleteBlockers = async (type, id) => {
  if (type === "product") {
    const [sku, order, cart, promotion] = await Promise.all([
      SKU.exists({ product: id }),
      Order.exists({ "items.product": id }),
      Cart.exists({ "items.product": id }),
      Promotion.exists({ "scope.products": id }),
    ]);
    return [
      sku && "selling options",
      order && "orders",
      cart && "carts",
      promotion && "promotions",
    ].filter(Boolean);
  }

  if (type === "sku") {
    const [order, cart, promotion] = await Promise.all([
      Order.exists({ "items.sku": id }),
      Cart.exists({ "items.sku": id }),
      Promotion.exists({ "scope.skus": id }),
    ]);
    return [order && "orders", cart && "carts", promotion && "promotions"].filter(Boolean);
  }

  if (type === "component") {
    const [sku, container, cart, order, rfq] = await Promise.all([
      SKU.exists({
        $or: [
          { "hamperContents.component": id },
          { "internalMaterials.component": id },
        ],
      }),
      Container.exists({ "packingMaterials.component": id }),
      Cart.exists({
        $or: [
          { "items.customHamper.items.component": id },
          { "items.customHamper.decorations.component": id },
        ],
      }),
      Order.exists({
        $or: [
          { "items.customHamper.components.component": id },
          { "items.customHamper.decorations.component": id },
        ],
      }),
      RFQ.exists({
        $or: [
          { "customHamperRequest.items.component": id },
          { "customHamperRequest.decorations.component": id },
        ],
      }),
    ]);
    return [
      sku && "hamper recipes",
      container && "box packing materials",
      cart && "carts",
      order && "orders",
      rfq && "RFQs",
    ].filter(Boolean);
  }

  const [sku, cart, order, rfq] = await Promise.all([
    SKU.exists({ container: id }),
    Cart.exists({ "items.customHamper.container": id }),
    Order.exists({ "items.customHamper.container": id }),
    RFQ.exists({ "customHamperRequest.container": id }),
  ]);
  return [
    sku && "selling options",
    cart && "carts",
    order && "orders",
    rfq && "RFQs",
  ].filter(Boolean);
};

export const deleteMasterItemAdmin = asyncHandler(async (req, res) => {
  const type = requireEntityType(req.params.type);
  if (!mongoose.isValidObjectId(req.params.id)) throw createError(400, "Invalid item ID");
  const Model = getModel(type);
  const item = await Model.findById(req.params.id);
  if (!item) throw createError(404, "Item not found");

  const blockers = await deleteBlockers(type, item._id);
  if (blockers.length) {
    await MasterControlState.findOneAndUpdate(
      { entityType: type, entityId: item._id },
      {
        $push: {
          history: {
            action: "delete_attempt",
            actor: getUserId(req),
            note: `Blocked by ${blockers.join(", ")}`,
            at: new Date(),
          },
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    throw createError(
      409,
      `This item is used by ${blockers.join(", ")} and cannot be permanently deleted. Archive it instead.`
    );
  }

  const productId = type === "sku" ? item.product : null;
  for (const image of item.images || []) {
    if (!image?.publicId) continue;
    try {
      await deleteFile(image.publicId);
    } catch (error) {
      console.error(`Image cleanup failed for ${image.publicId}:`, error.message);
    }
  }

  if (type === "sku") await ProductControl.deleteMany({ sku: item._id });
  await Model.deleteOne({ _id: item._id });
  await MasterControlState.deleteOne({ entityType: type, entityId: item._id });
  if (productId) await syncProductSummary(productId);

  await createAuditLog({
    req,
    action: "master_control_item_deleted",
    module: "master_control",
    entityType: type,
    entityId: item._id,
    description: `Unused ${type} permanently deleted from Master Control.`,
  });

  res.json({ success: true, message: "Item permanently deleted." });
});

export const uploadMasterItemImageAdmin = asyncHandler(async (req, res) => {
  const type = requireEntityType(req.params.type);
  if (!mongoose.isValidObjectId(req.params.id)) throw createError(400, "Invalid item ID");
  if (!req.file) throw createError(400, "Choose an image to upload");
  if (!hasAllowedImageSignature(req.file)) {
    throw createError(400, "Upload a valid JPG, PNG, WEBP or AVIF image");
  }

  const Model = getModel(type);
  const item = await Model.findById(req.params.id);
  if (!item) throw createError(404, "Item not found");

  const uploaded = normalizeUploadResult(
    await uploadFile(req.file.buffer, {
      folder: `hamporium/master-control/${type}/${item._id}`,
    })
  );
  if (!uploaded.url) throw createError(502, "Image upload did not return a usable URL");

  item.images.push({
    url: uploaded.url,
    publicId: uploaded.publicId,
    alt: clean(req.body?.alt || item.name, 180),
  });
  await item.save();

  res.status(201).json({ success: true, message: "Image added.", images: item.images });
});

export const removeMasterItemImageAdmin = asyncHandler(async (req, res) => {
  const type = requireEntityType(req.params.type);
  if (!mongoose.isValidObjectId(req.params.id)) throw createError(400, "Invalid item ID");
  const Model = getModel(type);
  const item = await Model.findById(req.params.id);
  if (!item) throw createError(404, "Item not found");

  const publicId = clean(req.body?.publicId, 500);
  const url = clean(req.body?.url, 2000);
  const before = item.images?.length || 0;
  item.images = (item.images || []).filter((image) => {
    if (publicId && image.publicId === publicId) return false;
    if (!publicId && url && image.url === url) return false;
    return true;
  });
  if ((item.images?.length || 0) === before) throw createError(404, "Image not found");
  await item.save();

  if (publicId) {
    try {
      await deleteFile(publicId);
    } catch (error) {
      console.error(`Image cleanup failed for ${publicId}:`, error.message);
    }
  }

  res.json({ success: true, message: "Image removed.", images: item.images });
});

const optionLimit = (value) => Math.min(200, Math.max(1, Number(value || 40)));

const nativeNamedOptions = async (collectionName, search, limit) => {
  const filter = search
    ? {
        $or: [
          { name: new RegExp(escapeRegex(search), "i") },
          { slug: new RegExp(escapeRegex(search), "i") },
        ],
      }
    : {};
  return mongoose.connection
    .collection(collectionName)
    .find(filter, { projection: { name: 1, slug: 1, isActive: 1, status: 1 } })
    .sort({ name: 1 })
    .limit(limit)
    .toArray();
};

export const searchMasterOptionsAdmin = asyncHandler(async (req, res) => {
  const kind = String(req.query.kind || "products").toLowerCase();
  const search = String(req.query.search || "").trim();
  const limit = optionLimit(req.query.limit);
  const regex = search ? new RegExp(escapeRegex(search), "i") : null;
  let options = [];

  if (kind === "products") {
    const filter = regex ? { $or: [{ name: regex }, { slug: regex }] } : {};
    options = await Product.find(filter)
      .select("name slug status images")
      .sort({ name: 1 })
      .limit(limit)
      .lean();
  } else if (kind === "skus") {
    const productIds = regex ? await Product.find({ name: regex }).distinct("_id") : [];
    const filter = regex
      ? { $or: [{ code: regex }, { name: regex }, { product: { $in: productIds } }] }
      : {};
    options = await SKU.find(filter)
      .select("code name product price isActive")
      .populate("product", "name slug")
      .sort({ code: 1 })
      .limit(limit)
      .lean();
  } else if (kind === "components") {
    const filter = regex ? { $or: [{ code: regex }, { name: regex }, { brand: regex }] } : {};
    options = await Component.find(filter)
      .select("code name type hamperRole sellingPrice isActive customerSelectable")
      .sort({ name: 1 })
      .limit(limit)
      .lean();
  } else if (kind === "containers") {
    const filter = regex ? { $or: [{ code: regex }, { name: regex }, { material: regex }] } : {};
    options = await Container.find(filter)
      .select("code name material sellingPrice isActive customerSelectable")
      .sort({ name: 1 })
      .limit(limit)
      .lean();
  } else if (kind === "customers") {
    const filter = {
      roles: { $nin: ["admin", "operations", "finance"] },
      ...(regex
        ? { $or: [{ name: regex }, { email: regex }, { phone: regex }] }
        : {}),
    };
    options = await User.find(filter)
      .select("name email phone roles createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } else if (kind === "categories") {
    options = await nativeNamedOptions("categories", search, limit);
  } else if (kind === "collections") {
    options = await nativeNamedOptions("collections", search, limit);
  } else {
    throw createError(400, "Invalid option type");
  }

  res.json({ success: true, options });
});
