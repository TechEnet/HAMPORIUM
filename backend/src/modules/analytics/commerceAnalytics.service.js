import mongoose from "mongoose";

import CommerceAnalytics, {
  COMMERCE_EVENT_TYPES,
} from "./commerceAnalytics.model.js";
import SearchAnalytics from "./searchAnalytics.model.js";
import Order from "../orders/order.model.js";

import {
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
} from "../../constants/statuses.js";

const SEARCH_ATTRIBUTION_DAYS = 7;

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const cleanString = (value, maxLength = 160) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const normalizeQuery = (value) => cleanString(value, 160).toLowerCase();

const normalizePincode = (value) => {
  const pincode = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);

  return /^[1-9][0-9]{5}$/.test(pincode) ? pincode : "";
};

const normalizeLocation = (location) => ({
  pincode: normalizePincode(location?.pincode || location?.postalCode),
  city: cleanString(location?.city, 120),
  state: cleanString(location?.state, 120),
  country: cleanString(location?.country || "India", 120) || "India",
});

const roundNumber = (value, digits = 2) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
};

const safeDivide = (numerator, denominator) => {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  return bottom ? top / bottom : 0;
};

const clampDays = (value) => {
  const days = Number(value);
  if (!Number.isFinite(days)) return 30;
  return Math.min(365, Math.max(1, Math.floor(days)));
};

const clampLimit = (value) => {
  const limit = Number(value);
  if (!Number.isFinite(limit)) return 10;
  return Math.min(50, Math.max(1, Math.floor(limit)));
};

const buildPeriod = (days) => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from, to };
};

const productKey = (value) => {
  if (value?.product) return `product:${String(value.product)}`;
  if (value?.productSlug) return `slug:${String(value.productSlug).toLowerCase()}`;
  if (value?.productName) return `name:${String(value.productName).toLowerCase()}`;
  return "";
};

const sanitizeAttribution = (value) => {
  if (!value) return undefined;

  return {
    searchEvent:
      value.searchEvent && mongoose.isValidObjectId(value.searchEvent)
        ? value.searchEvent
        : null,
    query: cleanString(value.query, 160),
    normalizedQuery: normalizeQuery(value.normalizedQuery || value.query),
    source: cleanString(value.source, 60),
    clickedAt: value.clickedAt ? new Date(value.clickedAt) : null,
  };
};

export const resolveSearchAttribution = async ({
  sessionId,
  productId,
  productSlug,
  searchEventId,
} = {}) => {
  const normalizedSessionId = cleanString(sessionId, 120);
  const normalizedSlug = cleanString(productSlug, 220).toLowerCase();

  const productMatch = [];

  if (productId && mongoose.isValidObjectId(productId)) {
    productMatch.push({ product: productId });
  }

  if (normalizedSlug) {
    productMatch.push({ productSlug: normalizedSlug });
  }

  let event = null;

  if (searchEventId && mongoose.isValidObjectId(searchEventId)) {
    const explicitFilter = {
      _id: searchEventId,
      eventType: "search_result_click",
    };

    if (normalizedSessionId) explicitFilter.sessionId = normalizedSessionId;
    if (productMatch.length) explicitFilter.$or = productMatch;

    event = await SearchAnalytics.findOne(explicitFilter).lean();
  }

  if (!event && normalizedSessionId && productMatch.length) {
    const from = new Date();
    from.setDate(from.getDate() - SEARCH_ATTRIBUTION_DAYS);

    event = await SearchAnalytics.findOne({
      eventType: "search_result_click",
      sessionId: normalizedSessionId,
      createdAt: { $gte: from },
      $or: productMatch,
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  if (!event) return null;

  return {
    searchEvent: event._id,
    sessionId: event.sessionId || normalizedSessionId,
    query: event.query || "",
    normalizedQuery: event.normalizedQuery || normalizeQuery(event.query),
    source: event.source || "",
    clickedAt: event.createdAt || null,
  };
};

export const recordCommerceEvent = async ({
  eventType,
  userId,
  sessionId,
  source,
  pagePath,
  productId,
  skuId,
  orderId,
  productSlug,
  productName,
  itemType = "",
  checkoutMode = "",
  quantity = null,
  value = null,
  currency = "INR",
  location,
  attribution,
  eventKey,
}) => {
  if (!COMMERCE_EVENT_TYPES.includes(eventType)) {
    throw createHttpError("Invalid commerce analytics event type");
  }

  const parsedQuantity =
    quantity === null || quantity === undefined || quantity === ""
      ? null
      : Number(quantity);

  const parsedValue =
    value === null || value === undefined || value === ""
      ? null
      : Number(value);

  const payload = {
    eventType,
    user:
      userId && mongoose.isValidObjectId(userId)
        ? userId
        : null,
    sessionId: cleanString(sessionId, 120),
    source: cleanString(source || "unknown", 60) || "unknown",
    pagePath: cleanString(pagePath, 500),
    product:
      productId && mongoose.isValidObjectId(productId)
        ? productId
        : null,
    sku:
      skuId && mongoose.isValidObjectId(skuId)
        ? skuId
        : null,
    order:
      orderId && mongoose.isValidObjectId(orderId)
        ? orderId
        : null,
    productSlug: cleanString(productSlug, 220),
    productName: cleanString(productName, 180),
    itemType: ["", "sku", "custom_hamper"].includes(itemType)
      ? itemType
      : "",
    checkoutMode: ["", "cart", "buy_now"].includes(checkoutMode)
      ? checkoutMode
      : "",
    quantity:
      Number.isFinite(parsedQuantity) && parsedQuantity >= 0
        ? parsedQuantity
        : null,
    value:
      Number.isFinite(parsedValue) && parsedValue >= 0
        ? roundNumber(parsedValue)
        : null,
    currency: cleanString(currency || "INR", 10).toUpperCase() || "INR",
    location: normalizeLocation(location),
    attribution: sanitizeAttribution(attribution),
  };

  const normalizedEventKey = cleanString(eventKey, 220);

  if (!normalizedEventKey) {
    return CommerceAnalytics.create(payload);
  }

  payload.eventKey = normalizedEventKey;

  try {
    return await CommerceAnalytics.findOneAndUpdate(
      { eventKey: normalizedEventKey },
      { $setOnInsert: payload },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return CommerceAnalytics.findOne({ eventKey: normalizedEventKey });
    }
    throw error;
  }
};

const getEventProductMetrics = async (from, to) =>
  CommerceAnalytics.aggregate([
    {
      $match: {
        eventType: { $in: ["product_view", "add_to_cart"] },
        createdAt: { $gte: from, $lt: to },
      },
    },
    {
      $group: {
        _id: {
          product: "$product",
          productSlug: "$productSlug",
          productName: "$productName",
        },
        views: {
          $sum: {
            $cond: [{ $eq: ["$eventType", "product_view"] }, 1, 0],
          },
        },
        addToCartEvents: {
          $sum: {
            $cond: [{ $eq: ["$eventType", "add_to_cart"] }, 1, 0],
          },
        },
        addToCartUnits: {
          $sum: {
            $cond: [
              { $eq: ["$eventType", "add_to_cart"] },
              { $ifNull: ["$quantity", 1] },
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        product: "$_id.product",
        productSlug: "$_id.productSlug",
        productName: "$_id.productName",
        views: 1,
        addToCartEvents: 1,
        addToCartUnits: 1,
      },
    },
  ]);

const getSalesProductMetrics = async (from, to) =>
  Order.aggregate([
    {
      $match: {
        paymentStatus: ORDER_PAYMENT_STATUS.PAID,
        paidAt: { $gte: from, $lt: to },
      },
    },
    { $unwind: "$items" },
    { $match: { "items.itemType": "sku" } },
    {
      $group: {
        _id: {
          product: "$items.product",
          productSlug: "$items.productSlug",
          productName: "$items.productName",
        },
        revenue: { $sum: "$items.lineTotal" },
        unitsSold: { $sum: "$items.quantity" },
        orders: { $addToSet: "$_id" },
      },
    },
    {
      $project: {
        _id: 0,
        product: "$_id.product",
        productSlug: "$_id.productSlug",
        productName: "$_id.productName",
        revenue: 1,
        unitsSold: 1,
        orderCount: { $size: "$orders" },
      },
    },
  ]);

const getSearchClickMetrics = async (from, to) =>
  SearchAnalytics.aggregate([
    {
      $match: {
        eventType: "search_result_click",
        createdAt: { $gte: from, $lt: to },
      },
    },
    {
      $group: {
        _id: {
          product: "$product",
          productSlug: "$productSlug",
          productName: "$productName",
        },
        searchClicks: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        product: "$_id.product",
        productSlug: "$_id.productSlug",
        productName: "$_id.productName",
        searchClicks: 1,
      },
    },
  ]);

const mergeProductMetrics = (eventRows, salesRows, searchRows, limit) => {
  const map = new Map();

  const getBase = (row) => ({
    product: row.product || null,
    productSlug: row.productSlug || "",
    productName: row.productName || "",
    views: 0,
    searchClicks: 0,
    addToCartEvents: 0,
    addToCartUnits: 0,
    unitsSold: 0,
    orderCount: 0,
    revenue: 0,
  });

  for (const row of [...eventRows, ...salesRows, ...searchRows]) {
    const key = productKey(row);
    if (!key) continue;

    const current = map.get(key) || getBase(row);

    current.product = current.product || row.product || null;
    current.productSlug = current.productSlug || row.productSlug || "";
    current.productName = current.productName || row.productName || "";

    for (const field of [
      "views",
      "searchClicks",
      "addToCartEvents",
      "addToCartUnits",
      "unitsSold",
      "orderCount",
      "revenue",
    ]) {
      if (row[field] !== undefined) current[field] = Number(row[field] || 0);
    }

    map.set(key, current);
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      revenue: roundNumber(row.revenue),
      viewToCartRate: roundNumber(safeDivide(row.addToCartEvents, row.views) * 100),
      cartToPurchaseRate: roundNumber(
        safeDivide(row.orderCount, row.addToCartEvents) * 100
      ),
      searchClickToPurchaseRate: roundNumber(
        safeDivide(row.orderCount, row.searchClicks) * 100
      ),
    }))
    .sort(
      (a, b) =>
        b.revenue - a.revenue ||
        b.unitsSold - a.unitsSold ||
        b.views - a.views
    )
    .slice(0, limit);
};

export const getCommerceAnalyticsSummary = async ({
  days = 30,
  limit = 10,
} = {}) => {
  const resolvedDays = clampDays(days);
  const resolvedLimit = clampLimit(limit);
  const { from, to } = buildPeriod(resolvedDays);

  const paidFilter = {
    paymentStatus: ORDER_PAYMENT_STATUS.PAID,
    paidAt: { $gte: from, $lt: to },
  };

  const [
    productViews,
    addToCarts,
    checkoutStarts,
    buyNowStarts,
    purchaseEvents,
    paymentFailures,
    searchSubmits,
    uniqueSessionsRows,
    commerceRows,
    repeatRows,
    abandonedRows,
    attributedPaidOrders,
    searchConversions,
    salesByLocation,
    eventProductRows,
    salesProductRows,
    searchClickRows,
  ] = await Promise.all([
    CommerceAnalytics.countDocuments({
      eventType: "product_view",
      createdAt: { $gte: from, $lt: to },
    }),
    CommerceAnalytics.countDocuments({
      eventType: "add_to_cart",
      createdAt: { $gte: from, $lt: to },
    }),
    CommerceAnalytics.countDocuments({
      eventType: "checkout_start",
      createdAt: { $gte: from, $lt: to },
    }),
    CommerceAnalytics.countDocuments({
      eventType: "buy_now_start",
      createdAt: { $gte: from, $lt: to },
    }),
    CommerceAnalytics.countDocuments({
      eventType: "purchase",
      createdAt: { $gte: from, $lt: to },
    }),
    CommerceAnalytics.countDocuments({
      eventType: "payment_failed",
      createdAt: { $gte: from, $lt: to },
    }),
    SearchAnalytics.countDocuments({
      eventType: "search_submit",
      createdAt: { $gte: from, $lt: to },
    }),
    CommerceAnalytics.aggregate([
      {
        $match: {
          sessionId: { $ne: "" },
          createdAt: { $gte: from, $lt: to },
        },
      },
      { $group: { _id: "$sessionId" } },
      { $count: "count" },
    ]),
    Order.aggregate([
      { $match: paidFilter },
      {
        $project: {
          totalAmount: 1,
          user: 1,
          units: {
            $sum: {
              $map: {
                input: "$items",
                as: "item",
                in: { $ifNull: ["$$item.quantity", 0] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
          paidOrders: { $sum: 1 },
          unitsSold: { $sum: "$units" },
          customers: { $addToSet: "$user" },
        },
      },
      {
        $project: {
          _id: 0,
          revenue: 1,
          paidOrders: 1,
          unitsSold: 1,
          uniqueCustomers: { $size: "$customers" },
        },
      },
    ]),
    Order.aggregate([
      { $match: paidFilter },
      { $group: { _id: "$user", orders: { $sum: 1 } } },
      {
        $group: {
          _id: null,
          customers: { $sum: 1 },
          repeatCustomers: {
            $sum: { $cond: [{ $gte: ["$orders", 2] }, 1, 0] },
          },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lt: to },
          paymentStatus: { $ne: ORDER_PAYMENT_STATUS.PAID },
          status: {
            $in: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PAYMENT_FAILED],
          },
        },
      },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          value: { $sum: "$totalAmount" },
        },
      },
    ]),
    Order.countDocuments({
      ...paidFilter,
      "items.attribution.normalizedQuery": { $exists: true, $ne: "" },
    }),
    Order.aggregate([
      { $match: paidFilter },
      { $unwind: "$items" },
      {
        $match: {
          "items.attribution.normalizedQuery": { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$items.attribution.normalizedQuery",
          query: { $first: "$items.attribution.query" },
          source: { $first: "$items.attribution.source" },
          revenue: { $sum: "$items.lineTotal" },
          unitsSold: { $sum: "$items.quantity" },
          orders: { $addToSet: "$_id" },
          products: { $addToSet: "$items.product" },
        },
      },
      {
        $project: {
          _id: 0,
          query: { $cond: [{ $ne: ["$query", ""] }, "$query", "$_id"] },
          normalizedQuery: "$_id",
          source: 1,
          revenue: 1,
          unitsSold: 1,
          orderCount: { $size: "$orders" },
          productCount: { $size: "$products" },
        },
      },
      { $sort: { revenue: -1, unitsSold: -1 } },
      { $limit: resolvedLimit },
    ]),
    Order.aggregate([
      { $match: paidFilter },
      {
        $group: {
          _id: {
            city: { $ifNull: ["$deliveryAddress.city", ""] },
            state: { $ifNull: ["$deliveryAddress.state", ""] },
            pincode: { $ifNull: ["$deliveryAddress.postalCode", ""] },
          },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { revenue: -1, orders: -1 } },
      { $limit: resolvedLimit },
      {
        $project: {
          _id: 0,
          city: "$_id.city",
          state: "$_id.state",
          pincode: "$_id.pincode",
          orders: 1,
          revenue: 1,
        },
      },
    ]),
    getEventProductMetrics(from, to),
    getSalesProductMetrics(from, to),
    getSearchClickMetrics(from, to),
  ]);

  const commerce = commerceRows?.[0] || {};
  const paidOrders = Number(commerce.paidOrders || 0);
  const revenue = roundNumber(commerce.revenue || 0);
  const unitsSold = Number(commerce.unitsSold || 0);
  const uniqueCustomers = Number(commerce.uniqueCustomers || 0);

  const repeat = repeatRows?.[0] || {};
  const repeatCustomers = Number(repeat.repeatCustomers || 0);
  const customerCount = Number(repeat.customers || 0);

  const abandoned = abandonedRows?.[0] || {};
  const abandonedCheckoutOrders = Number(abandoned.orders || 0);
  const abandonedCheckoutValue = roundNumber(abandoned.value || 0);

  const topProducts = mergeProductMetrics(
    eventProductRows,
    salesProductRows,
    searchClickRows,
    resolvedLimit
  );

  return {
    period: {
      days: resolvedDays,
      from,
      to,
    },

    funnel: {
      uniqueSessions: Number(uniqueSessionsRows?.[0]?.count || 0),
      productViews,
      searchSubmits,
      addToCarts,
      checkoutStarts,
      buyNowStarts,
      purchaseEvents,
      paidOrders,
      paymentFailures,
      viewToCartRate: roundNumber(safeDivide(addToCarts, productViews) * 100),
      cartToCheckoutRate: roundNumber(safeDivide(checkoutStarts, addToCarts) * 100),
      checkoutToPaidOrderRate: roundNumber(
        safeDivide(paidOrders, checkoutStarts) * 100
      ),
      searchToPaidOrderRate: roundNumber(
        safeDivide(attributedPaidOrders, searchSubmits) * 100
      ),
    },

    commerce: {
      revenue,
      paidOrders,
      unitsSold,
      uniqueCustomers,
      averageOrderValue: roundNumber(safeDivide(revenue, paidOrders)),
      unitsPerOrder: roundNumber(safeDivide(unitsSold, paidOrders)),
      repeatCustomers,
      repeatCustomerRate: roundNumber(
        safeDivide(repeatCustomers, customerCount) * 100
      ),
      abandonedCheckoutOrders,
      abandonedCheckoutValue,
    },

    searchAttribution: {
      attributedPaidOrders,
      topConvertingSearches: searchConversions.map((row) => ({
        ...row,
        revenue: roundNumber(row.revenue),
      })),
    },

    products: {
      topProducts,
      mostViewed: [...topProducts]
        .sort((a, b) => b.views - a.views)
        .slice(0, resolvedLimit),
      mostAddedToCart: [...topProducts]
        .sort((a, b) => b.addToCartUnits - a.addToCartUnits)
        .slice(0, resolvedLimit),
      bestConverting: [...topProducts]
        .filter((item) => item.views > 0)
        .sort((a, b) => b.viewToCartRate - a.viewToCartRate)
        .slice(0, resolvedLimit),
    },

    salesByLocation: salesByLocation.map((row) => ({
      ...row,
      revenue: roundNumber(row.revenue),
    })),
  };
};
