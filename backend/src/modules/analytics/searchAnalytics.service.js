import mongoose from "mongoose";

import SearchAnalytics, {
  SEARCH_EVENT_TYPES,
} from "./searchAnalytics.model.js";

import Order from "../orders/order.model.js";

import {
  ORDER_PAYMENT_STATUS,
} from "../../constants/statuses.js";

/* =========================================================
   COMMON HELPERS
========================================================= */

const createHttpError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);

  error.statusCode =
    statusCode;

  return error;
};

const cleanString = (
  value,
  maxLength = 160
) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const normalizeQuery = (
  value
) =>
  cleanString(
    value,
    160
  ).toLowerCase();

const normalizePincode = (
  value
) => {
  const pincode =
    String(value || "")
      .replace(/\D/g, "")
      .slice(0, 6);

  return /^[1-9][0-9]{5}$/.test(
    pincode
  )
    ? pincode
    : "";
};

const normalizeLocation = (
  location
) => {
  if (
    !location ||
    typeof location !==
      "object"
  ) {
    return {
      pincode: "",
      city: "",
      state: "",
      country: "India",
    };
  }

  return {
    pincode:
      normalizePincode(
        location.pincode
      ),

    city:
      cleanString(
        location.city,
        120
      ),

    state:
      cleanString(
        location.state,
        120
      ),

    country:
      cleanString(
        location.country ||
          "India",
        120
      ) || "India",
  };
};

const normalizeResultCount = (
  value
) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return null;
  }

  return Math.min(
    1000,
    Math.max(
      0,
      Math.floor(number)
    )
  );
};

const clampDays = (
  value
) => {
  const days =
    Number(value);

  if (
    !Number.isFinite(days)
  ) {
    return 30;
  }

  return Math.min(
    365,
    Math.max(
      1,
      Math.floor(days)
    )
  );
};

const clampLimit = (
  value
) => {
  const limit =
    Number(value);

  if (
    !Number.isFinite(limit)
  ) {
    return 10;
  }

  return Math.min(
    50,
    Math.max(
      1,
      Math.floor(limit)
    )
  );
};

const roundNumber = (
  value,
  digits = 2
) => {
  const number =
    Number(value || 0);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  const factor =
    10 ** digits;

  return (
    Math.round(
      number * factor
    ) / factor
  );
};

const safeDivide = (
  numerator,
  denominator
) => {
  const top =
    Number(numerator || 0);

  const bottom =
    Number(denominator || 0);

  if (!bottom) {
    return 0;
  }

  return top / bottom;
};

const percentageChange = (
  current,
  previous
) => {
  const currentValue =
    Number(current || 0);

  const previousValue =
    Number(previous || 0);

  if (
    previousValue === 0
  ) {
    if (
      currentValue === 0
    ) {
      return 0;
    }

    return null;
  }

  return roundNumber(
    ((currentValue -
      previousValue) /
      previousValue) *
      100,
    2
  );
};

const buildProductKey = (
  value
) => {
  if (value?.product) {
    return `product:${String(
      value.product
    )}`;
  }

  if (value?.productSlug) {
    return `slug:${String(
      value.productSlug
    ).toLowerCase()}`;
  }

  if (value?.productName) {
    return `name:${String(
      value.productName
    ).toLowerCase()}`;
  }

  return "";
};

/* =========================================================
   CREATE SEARCH EVENT
========================================================= */

export const createSearchAnalyticsEvent =
  async ({
    eventType,
    query,
    source,
    visibleResultCount,
    pagePath,
    sessionId,
    productId,
    productSlug,
    productName,
    location,
  }) => {
    if (
      !SEARCH_EVENT_TYPES.includes(
        eventType
      )
    ) {
      throw createHttpError(
        "Invalid search analytics event type"
      );
    }

    const cleanedQuery =
      cleanString(
        query,
        160
      );

    const normalizedQuery =
      normalizeQuery(
        cleanedQuery
      );

    if (!normalizedQuery) {
      throw createHttpError(
        "Search query is required"
      );
    }

    let product = null;

    if (
      productId &&
      mongoose.isValidObjectId(
        productId
      )
    ) {
      product =
        productId;
    }

    const event =
      await SearchAnalytics.create(
        {
          eventType,

          query:
            cleanedQuery,

          normalizedQuery,

          source:
            cleanString(
              source ||
                "unknown",
              60
            ) ||
            "unknown",

          visibleResultCount:
            normalizeResultCount(
              visibleResultCount
            ),

          pagePath:
            cleanString(
              pagePath,
              500
            ),

          sessionId:
            cleanString(
              sessionId,
              120
            ),

          product,

          productSlug:
            cleanString(
              productSlug,
              220
            ),

          productName:
            cleanString(
              productName,
              180
            ),

          location:
            normalizeLocation(
              location
            ),
        }
      );

    return event;
  };

/* =========================================================
   PERIOD
========================================================= */

const buildPeriod = (
  days
) => {
  const to =
    new Date();

  const from =
    new Date(to);

  from.setDate(
    from.getDate() -
      days
  );

  const previousTo =
    new Date(from);

  const previousFrom =
    new Date(from);

  previousFrom.setDate(
    previousFrom.getDate() -
      days
  );

  return {
    from,
    to,
    previousFrom,
    previousTo,
  };
};

/* =========================================================
   PAID ORDER FILTER
========================================================= */

const getPaidOrderFilter = (
  from,
  to
) => ({
  paymentStatus:
    ORDER_PAYMENT_STATUS.PAID,

  paidAt: {
    $gte: from,
    $lt: to,
  },
});

/* =========================================================
   COMMERCE TOTALS
========================================================= */

const getCommerceTotals =
  async (
    filter
  ) => {
    const result =
      await Order.aggregate([
        {
          $match:
            filter,
        },

        {
          $project: {
            totalAmount: 1,
            subtotal: 1,
            shippingAmount: 1,
            discountAmount: 1,
            user: 1,

            units: {
              $sum: {
                $map: {
                  input:
                    "$items",

                  as: "item",

                  in: {
                    $ifNull: [
                      "$$item.quantity",
                      0,
                    ],
                  },
                },
              },
            },
          },
        },

        {
          $group: {
            _id: null,

            revenue: {
              $sum:
                "$totalAmount",
            },

            subtotal: {
              $sum:
                "$subtotal",
            },

            shippingAmount: {
              $sum:
                "$shippingAmount",
            },

            discountAmount: {
              $sum:
                "$discountAmount",
            },

            paidOrders: {
              $sum: 1,
            },

            unitsSold: {
              $sum: "$units",
            },

            customers: {
              $addToSet:
                "$user",
            },
          },
        },

        {
          $project: {
            _id: 0,

            revenue: 1,
            subtotal: 1,
            shippingAmount: 1,
            discountAmount: 1,
            paidOrders: 1,
            unitsSold: 1,

            uniqueCustomers: {
              $size:
                "$customers",
            },
          },
        },
      ]);

    const row =
      result?.[0] ||
      {};

    const revenue =
      Number(
        row.revenue ||
          0
      );

    const paidOrders =
      Number(
        row.paidOrders ||
          0
      );

    const unitsSold =
      Number(
        row.unitsSold ||
          0
      );

    const uniqueCustomers =
      Number(
        row.uniqueCustomers ||
          0
      );

    return {
      revenue:
        roundNumber(
          revenue
        ),

      subtotal:
        roundNumber(
          row.subtotal
        ),

      shippingAmount:
        roundNumber(
          row.shippingAmount
        ),

      discountAmount:
        roundNumber(
          row.discountAmount
        ),

      paidOrders,

      unitsSold,

      uniqueCustomers,

      averageOrderValue:
        roundNumber(
          safeDivide(
            revenue,
            paidOrders
          )
        ),

      unitsPerOrder:
        roundNumber(
          safeDivide(
            unitsSold,
            paidOrders
          )
        ),

      revenuePerCustomer:
        roundNumber(
          safeDivide(
            revenue,
            uniqueCustomers
          )
        ),
    };
  };

/* =========================================================
   REPEAT CUSTOMERS
========================================================= */

const getRepeatCustomerMetrics =
  async (
    filter
  ) => {
    const rows =
      await Order.aggregate([
        {
          $match:
            filter,
        },

        {
          $group: {
            _id: "$user",

            orders: {
              $sum: 1,
            },

            revenue: {
              $sum:
                "$totalAmount",
            },
          },
        },

        {
          $group: {
            _id: null,

            customers: {
              $sum: 1,
            },

            repeatCustomers: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      "$orders",
                      2,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

    const row =
      rows?.[0] ||
      {};

    const customers =
      Number(
        row.customers ||
          0
      );

    const repeatCustomers =
      Number(
        row.repeatCustomers ||
          0
      );

    return {
      customers,

      repeatCustomers,

      repeatCustomerRate:
        roundNumber(
          safeDivide(
            repeatCustomers,
            customers
          ) * 100
        ),
    };
  };

/* =========================================================
   TOP PRODUCTS
========================================================= */

const getTopProducts =
  async (
    filter,
    limit = 10,
    internalLimit = 100
  ) => {
    const rows =
      await Order.aggregate([
        {
          $match:
            filter,
        },

        {
          $unwind:
            "$items",
        },

        {
          $group: {
            _id: {
              itemType:
                "$items.itemType",

              product:
                "$items.product",

              customChannel:
                "$items.customHamper.channel",

              customContainerCode:
                "$items.customHamper.containerCode",
            },

            product: {
              $first:
                "$items.product",
            },

            productName: {
              $first:
                "$items.productName",
            },

            productSlug: {
              $first:
                "$items.productSlug",
            },

            itemType: {
              $first:
                "$items.itemType",
            },

            image: {
              $first:
                "$items.image",
            },

            customChannel: {
              $first:
                "$items.customHamper.channel",
            },

            customContainerName: {
              $first:
                "$items.customHamper.containerName",
            },

            revenue: {
              $sum:
                "$items.lineTotal",
            },

            unitsSold: {
              $sum:
                "$items.quantity",
            },

            orders: {
              $addToSet:
                "$_id",
            },
          },
        },

        {
          $project: {
            _id: 0,

            product: 1,
            productName: 1,
            productSlug: 1,
            itemType: 1,
            image: 1,
            customChannel: 1,
            customContainerName: 1,
            revenue: 1,
            unitsSold: 1,

            orderCount: {
              $size:
                "$orders",
            },
          },
        },

        {
          $sort: {
            revenue: -1,
            unitsSold: -1,
          },
        },

        {
          $limit:
            Math.max(
              limit,
              internalLimit
            ),
        },
      ]);

    return rows.map(
      (row) => ({
        ...row,

        revenue:
          roundNumber(
            row.revenue
          ),

        averageSellingPrice:
          roundNumber(
            safeDivide(
              row.revenue,
              row.unitsSold
            )
          ),
      })
    );
  };

/* =========================================================
   TOP SKU / VARIANTS
========================================================= */

const getTopVariants =
  async (
    filter,
    limit
  ) => {
    const rows =
      await Order.aggregate([
        {
          $match:
            filter,
        },

        {
          $unwind:
            "$items",
        },

        {
          $match: {
            "items.itemType":
              "sku",
          },
        },

        {
          $group: {
            _id:
              "$items.sku",

            sku: {
              $first:
                "$items.sku",
            },

            skuCode: {
              $first:
                "$items.skuCode",
            },

            skuName: {
              $first:
                "$items.skuName",
            },

            productName: {
              $first:
                "$items.productName",
            },

            productSlug: {
              $first:
                "$items.productSlug",
            },

            revenue: {
              $sum:
                "$items.lineTotal",
            },

            unitsSold: {
              $sum:
                "$items.quantity",
            },

            orders: {
              $addToSet:
                "$_id",
            },
          },
        },

        {
          $project: {
            _id: 0,

            sku: 1,
            skuCode: 1,
            skuName: 1,
            productName: 1,
            productSlug: 1,
            revenue: 1,
            unitsSold: 1,

            orderCount: {
              $size:
                "$orders",
            },
          },
        },

        {
          $sort: {
            unitsSold: -1,
            revenue: -1,
          },
        },

        {
          $limit:
            limit,
        },
      ]);

    return rows.map(
      (row) => ({
        ...row,

        revenue:
          roundNumber(
            row.revenue
          ),
      })
    );
  };

/* =========================================================
   SALES TREND
========================================================= */

const getSalesTrend =
  async (
    filter
  ) => {
    const rows =
      await Order.aggregate([
        {
          $match:
            filter,
        },

        {
          $project: {
            paidAt: 1,
            totalAmount: 1,

            units: {
              $sum: {
                $map: {
                  input:
                    "$items",

                  as: "item",

                  in: {
                    $ifNull: [
                      "$$item.quantity",
                      0,
                    ],
                  },
                },
              },
            },
          },
        },

        {
          $group: {
            _id: {
              $dateToString: {
                format:
                  "%Y-%m-%d",

                date:
                  "$paidAt",

                timezone:
                  "Asia/Kolkata",
              },
            },

            revenue: {
              $sum:
                "$totalAmount",
            },

            orders: {
              $sum: 1,
            },

            unitsSold: {
              $sum:
                "$units",
            },
          },
        },

        {
          $sort: {
            _id: 1,
          },
        },

        {
          $project: {
            _id: 0,
            date: "$_id",
            revenue: 1,
            orders: 1,
            unitsSold: 1,
          },
        },
      ]);

    return rows.map(
      (row) => ({
        ...row,

        revenue:
          roundNumber(
            row.revenue
          ),
      })
    );
  };

/* =========================================================
   SALES BY LOCATION
========================================================= */

const getSalesByLocation =
  async (
    filter,
    limit
  ) => {
    const rows =
      await Order.aggregate([
        {
          $match:
            filter,
        },

        {
          $group: {
            _id: {
              city: {
                $ifNull: [
                  "$deliveryAddress.city",
                  "",
                ],
              },

              state: {
                $ifNull: [
                  "$deliveryAddress.state",
                  "",
                ],
              },

              pincode: {
                $ifNull: [
                  "$deliveryAddress.postalCode",
                  "",
                ],
              },
            },

            orders: {
              $sum: 1,
            },

            revenue: {
              $sum:
                "$totalAmount",
            },

            unitsSold: {
              $sum: {
                $sum: {
                  $map: {
                    input:
                      "$items",

                    as: "item",

                    in: {
                      $ifNull: [
                        "$$item.quantity",
                        0,
                      ],
                    },
                  },
                },
              },
            },
          },
        },

        {
          $sort: {
            revenue: -1,
            orders: -1,
          },
        },

        {
          $limit:
            limit,
        },

        {
          $project: {
            _id: 0,

            city:
              "$_id.city",

            state:
              "$_id.state",

            pincode:
              "$_id.pincode",

            orders: 1,
            revenue: 1,
            unitsSold: 1,
          },
        },
      ]);

    return rows.map(
      (row) => ({
        ...row,

        revenue:
          roundNumber(
            row.revenue
          ),
      })
    );
  };

/* =========================================================
   READY MADE VS CUSTOM
========================================================= */

const getItemTypeSplit =
  async (
    filter
  ) => {
    const rows =
      await Order.aggregate([
        {
          $match:
            filter,
        },

        {
          $unwind:
            "$items",
        },

        {
          $group: {
            _id:
              "$items.itemType",

            revenue: {
              $sum:
                "$items.lineTotal",
            },

            unitsSold: {
              $sum:
                "$items.quantity",
            },

            orders: {
              $addToSet:
                "$_id",
            },
          },
        },

        {
          $project: {
            _id: 0,

            itemType:
              "$_id",

            revenue: 1,
            unitsSold: 1,

            orderCount: {
              $size:
                "$orders",
            },
          },
        },

        {
          $sort: {
            revenue: -1,
          },
        },
      ]);

    return rows.map(
      (row) => ({
        ...row,

        revenue:
          roundNumber(
            row.revenue
          ),
      })
    );
  };

/* =========================================================
   PAID ORDER STATUS
========================================================= */

const getOrderStatusBreakdown =
  async (
    filter
  ) => {
    const rows =
      await Order.aggregate([
        {
          $match:
            filter,
        },

        {
          $group: {
            _id:
              "$status",

            orders: {
              $sum: 1,
            },

            revenue: {
              $sum:
                "$totalAmount",
            },
          },
        },

        {
          $sort: {
            orders: -1,
          },
        },

        {
          $project: {
            _id: 0,

            status:
              "$_id",

            orders: 1,
            revenue: 1,
          },
        },
      ]);

    return rows.map(
      (row) => ({
        ...row,

        revenue:
          roundNumber(
            row.revenue
          ),
      })
    );
  };

/* =========================================================
   PRODUCT SEARCH CLICKS
========================================================= */

const getProductSearchClicks =
  async (
    from,
    to
  ) => {
    return SearchAnalytics.aggregate([
      {
        $match: {
          eventType:
            "search_result_click",

          createdAt: {
            $gte: from,
            $lt: to,
          },
        },
      },

      {
        $group: {
          _id: {
            product:
              "$product",

            productSlug:
              "$productSlug",

            productName:
              "$productName",
          },

          clicks: {
            $sum: 1,
          },

          searches: {
            $addToSet:
              "$normalizedQuery",
          },
        },
      },

      {
        $project: {
          _id: 0,

          product:
            "$_id.product",

          productSlug:
            "$_id.productSlug",

          productName:
            "$_id.productName",

          clicks: 1,

          uniqueSearchTerms: {
            $size:
              "$searches",
          },
        },
      },

      {
        $sort: {
          clicks: -1,
        },
      },

      {
        $limit: 100,
      },
    ]);
  };

/* =========================================================
   PRODUCT DEMAND
========================================================= */

const buildProductDemand = (
  salesProducts,
  clickedProducts,
  limit
) => {
  const map =
    new Map();

  for (
    const item of
    salesProducts
  ) {
    if (
      item.itemType !==
      "sku"
    ) {
      continue;
    }

    const key =
      buildProductKey(
        item
      );

    if (!key) continue;

    map.set(
      key,
      {
        product:
          item.product ||
          null,

        productName:
          item.productName ||
          "",

        productSlug:
          item.productSlug ||
          "",

        image:
          item.image ||
          "",

        revenue:
          Number(
            item.revenue ||
              0
          ),

        unitsSold:
          Number(
            item.unitsSold ||
              0
          ),

        orderCount:
          Number(
            item.orderCount ||
              0
          ),

        searchClicks: 0,

        uniqueSearchTerms:
          0,
      }
    );
  }

  for (
    const item of
    clickedProducts
  ) {
    const key =
      buildProductKey(
        item
      );

    if (!key) continue;

    const existing =
      map.get(key) ||
      {
        product:
          item.product ||
          null,

        productName:
          item.productName ||
          "",

        productSlug:
          item.productSlug ||
          "",

        image: "",

        revenue: 0,

        unitsSold: 0,

        orderCount: 0,

        searchClicks: 0,

        uniqueSearchTerms:
          0,
      };

    existing.searchClicks =
      Number(
        item.clicks ||
          0
      );

    existing.uniqueSearchTerms =
      Number(
        item.uniqueSearchTerms ||
          0
      );

    map.set(
      key,
      existing
    );
  }

  const values = [
    ...map.values(),
  ];

  const maxUnits =
    Math.max(
      1,
      ...values.map(
        (item) =>
          item.unitsSold
      )
    );

  const maxClicks =
    Math.max(
      1,
      ...values.map(
        (item) =>
          item.searchClicks
      )
    );

  const maxOrders =
    Math.max(
      1,
      ...values.map(
        (item) =>
          item.orderCount
      )
    );

  const enriched =
    values.map(
      (item) => {
        const unitScore =
          item.unitsSold /
          maxUnits;

        const clickScore =
          item.searchClicks /
          maxClicks;

        const orderScore =
          item.orderCount /
          maxOrders;

        /*
         * Demand Index is intentionally a heuristic,
         * not a financial/accounting metric.
         *
         * 55% actual units sold
         * 35% search-result interest
         * 10% number of paid orders
         */
        const demandIndex =
          Math.round(
            (unitScore *
              0.55 +
              clickScore *
                0.35 +
              orderScore *
                0.1) *
              100
          );

        let signal =
          "emerging";

        if (
          item.unitsSold >=
            3 &&
          item.searchClicks >=
            3
        ) {
          signal =
            "strong_demand";
        } else if (
          item.searchClicks >=
            3 &&
          item.unitsSold ===
            0
        ) {
          signal =
            "high_interest_no_sales";
        } else if (
          item.searchClicks >=
            4 &&
          item.searchClicks >=
            item.unitsSold *
              2
        ) {
          signal =
            "high_interest_low_sales";
        } else if (
          item.unitsSold >=
          3
        ) {
          signal =
            "sales_led";
        } else if (
          item.searchClicks >=
          3
        ) {
          signal =
            "interest_led";
        }

        return {
          ...item,

          revenue:
            roundNumber(
              item.revenue
            ),

          demandIndex,

          signal,

          searchInterestPerSale:
            roundNumber(
              safeDivide(
                item.searchClicks,
                item.unitsSold
              ),
              2
            ),
        };
      }
    );

  enriched.sort(
    (a, b) =>
      b.demandIndex -
        a.demandIndex ||
      b.revenue -
        a.revenue
  );

  return {
    products:
      enriched.slice(
        0,
        limit
      ),

    highInterestLowSales:
      enriched
        .filter(
          (item) =>
            [
              "high_interest_no_sales",
              "high_interest_low_sales",
            ].includes(
              item.signal
            )
        )
        .slice(
          0,
          limit
        ),
  };
};

/* =========================================================
   SEARCH SUMMARY
========================================================= */

export const getSearchAnalyticsSummary =
  async ({
    days = 30,
    limit = 10,
  } = {}) => {
    const resolvedDays =
      clampDays(days);

    const resolvedLimit =
      clampLimit(limit);

    const {
      from,
      to,
      previousFrom,
      previousTo,
    } =
      buildPeriod(
        resolvedDays
      );

    /* =====================================================
       SEARCH COUNTS
    ===================================================== */

    const [
      totalEvents,
      searchSubmits,
      resultClicks,
      popularClicks,
    ] =
      await Promise.all([
        SearchAnalytics.countDocuments(
          {
            createdAt: {
              $gte: from,
              $lt: to,
            },
          }
        ),

        SearchAnalytics.countDocuments(
          {
            eventType:
              "search_submit",

            createdAt: {
              $gte: from,
              $lt: to,
            },
          }
        ),

        SearchAnalytics.countDocuments(
          {
            eventType:
              "search_result_click",

            createdAt: {
              $gte: from,
              $lt: to,
            },
          }
        ),

        SearchAnalytics.countDocuments(
          {
            eventType:
              "popular_search_click",

            createdAt: {
              $gte: from,
              $lt: to,
            },
          }
        ),
      ]);

    /* =====================================================
       TOP SEARCHES
    ===================================================== */

    const topSearches =
      await SearchAnalytics.aggregate(
        [
          {
            $match: {
              eventType: {
                $in: [
                  "search_submit",
                  "popular_search_click",
                ],
              },

              createdAt: {
                $gte: from,
                $lt: to,
              },
            },
          },

          {
            $group: {
              _id:
                "$normalizedQuery",

              query: {
                $first:
                  "$query",
              },

              count: {
                $sum: 1,
              },

              averageVisibleResults:
                {
                  $avg:
                    "$visibleResultCount",
                },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },

          {
            $limit:
              resolvedLimit,
          },

          {
            $project: {
              _id: 0,
              query: 1,
              count: 1,

              averageVisibleResults:
                {
                  $round: [
                    "$averageVisibleResults",
                    1,
                  ],
                },
            },
          },
        ]
      );

    /* =====================================================
       ZERO RESULT SEARCHES
    ===================================================== */

    const zeroResultSearches =
      await SearchAnalytics.aggregate(
        [
          {
            $match: {
              eventType:
                "search_submit",

              visibleResultCount:
                0,

              createdAt: {
                $gte: from,
                $lt: to,
              },
            },
          },

          {
            $group: {
              _id:
                "$normalizedQuery",

              query: {
                $first:
                  "$query",
              },

              count: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },

          {
            $limit:
              resolvedLimit,
          },

          {
            $project: {
              _id: 0,
              query: 1,
              count: 1,
            },
          },
        ]
      );

    /* =====================================================
       TOP CLICKED PRODUCTS
    ===================================================== */

    const topClickedProducts =
      await SearchAnalytics.aggregate(
        [
          {
            $match: {
              eventType:
                "search_result_click",

              createdAt: {
                $gte: from,
                $lt: to,
              },
            },
          },

          {
            $group: {
              _id: {
                product:
                  "$product",

                productSlug:
                  "$productSlug",

                productName:
                  "$productName",
              },

              clicks: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              clicks: -1,
            },
          },

          {
            $limit:
              resolvedLimit,
          },

          {
            $project: {
              _id: 0,

              product:
                "$_id.product",

              productSlug:
                "$_id.productSlug",

              productName:
                "$_id.productName",

              clicks: 1,
            },
          },
        ]
      );

    /* =====================================================
       SEARCH LOCATIONS
    ===================================================== */

    const topLocations =
      await SearchAnalytics.aggregate(
        [
          {
            $match: {
              eventType: {
                $in: [
                  "search_submit",
                  "popular_search_click",
                ],
              },

              createdAt: {
                $gte: from,
                $lt: to,
              },

              "location.pincode": {
                $ne: "",
              },
            },
          },

          {
            $group: {
              _id: {
                pincode:
                  "$location.pincode",

                city:
                  "$location.city",

                state:
                  "$location.state",
              },

              searches: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              searches: -1,
            },
          },

          {
            $limit:
              resolvedLimit,
          },

          {
            $project: {
              _id: 0,

              pincode:
                "$_id.pincode",

              city:
                "$_id.city",

              state:
                "$_id.state",

              searches: 1,
            },
          },
        ]
      );

    /* =====================================================
       SEARCH SOURCES
    ===================================================== */

    const searchesBySource =
      await SearchAnalytics.aggregate(
        [
          {
            $match: {
              eventType: {
                $in: [
                  "search_submit",
                  "popular_search_click",
                ],
              },

              createdAt: {
                $gte: from,
                $lt: to,
              },
            },
          },

          {
            $group: {
              _id:
                "$source",

              searches: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              searches: -1,
            },
          },

          {
            $project: {
              _id: 0,

              source:
                "$_id",

              searches: 1,
            },
          },
        ]
      );

    /* =====================================================
       COMMERCE
    ===================================================== */

    const currentPaidFilter =
      getPaidOrderFilter(
        from,
        to
      );

    const previousPaidFilter =
      getPaidOrderFilter(
        previousFrom,
        previousTo
      );

    const [
      currentCommerce,
      previousCommerce,
      repeatCustomers,
      salesProducts,
      topVariants,
      salesTrend,
      salesByLocation,
      itemTypeSplit,
      orderStatusBreakdown,
      productSearchClicks,
    ] =
      await Promise.all([
        getCommerceTotals(
          currentPaidFilter
        ),

        getCommerceTotals(
          previousPaidFilter
        ),

        getRepeatCustomerMetrics(
          currentPaidFilter
        ),

        getTopProducts(
          currentPaidFilter,
          resolvedLimit,
          100
        ),

        getTopVariants(
          currentPaidFilter,
          resolvedLimit
        ),

        getSalesTrend(
          currentPaidFilter
        ),

        getSalesByLocation(
          currentPaidFilter,
          resolvedLimit
        ),

        getItemTypeSplit(
          currentPaidFilter
        ),

        getOrderStatusBreakdown(
          currentPaidFilter
        ),

        getProductSearchClicks(
          from,
          to
        ),
      ]);

    const commerceTotals =
      {
        ...currentCommerce,

        repeatCustomers:
          repeatCustomers.repeatCustomers,

        repeatCustomerRate:
          repeatCustomers.repeatCustomerRate,
      };

    const growth = {
      revenue:
        percentageChange(
          currentCommerce.revenue,
          previousCommerce.revenue
        ),

      paidOrders:
        percentageChange(
          currentCommerce.paidOrders,
          previousCommerce.paidOrders
        ),

      unitsSold:
        percentageChange(
          currentCommerce.unitsSold,
          previousCommerce.unitsSold
        ),

      averageOrderValue:
        percentageChange(
          currentCommerce.averageOrderValue,
          previousCommerce.averageOrderValue
        ),

      uniqueCustomers:
        percentageChange(
          currentCommerce.uniqueCustomers,
          previousCommerce.uniqueCustomers
        ),
    };

    /* =====================================================
       BEST SELLERS
    ===================================================== */

    const topByRevenue =
      [...salesProducts].sort(
        (a, b) =>
          b.revenue -
          a.revenue
      );

    const topByUnits =
      [...salesProducts].sort(
        (a, b) =>
          b.unitsSold -
            a.unitsSold ||
          b.revenue -
            a.revenue
      );

    const bestSellers = {
      byRevenue:
        topByRevenue[0] ||
        null,

      byUnits:
        topByUnits[0] ||
        null,
    };

    /* =====================================================
       DEMAND INTELLIGENCE
    ===================================================== */

    const demand =
      buildProductDemand(
        salesProducts,
        productSearchClicks,
        resolvedLimit
      );

    const clickThroughRate =
      searchSubmits > 0
        ? roundNumber(
            (resultClicks /
              searchSubmits) *
              100
          )
        : 0;

    /* =====================================================
       RESPONSE
    ===================================================== */

    return {
      period: {
        days:
          resolvedDays,

        from,

        to,

        previousFrom,

        previousTo,
      },

      search: {
        totals: {
          totalEvents,
          searchSubmits,
          resultClicks,
          popularClicks,
          clickThroughRate,
        },

        topSearches,

        zeroResultSearches,

        topClickedProducts,

        topLocations,

        searchesBySource,
      },

      /*
       * Kept for backwards compatibility with
       * the first Search Analytics frontend.
       */
      totals: {
        totalEvents,
        searchSubmits,
        resultClicks,
        popularClicks,
        clickThroughRate,
      },

      topSearches,

      zeroResultSearches,

      topClickedProducts,

      topLocations,

      searchesBySource,

      commerce: {
        totals:
          commerceTotals,

        previousTotals:
          previousCommerce,

        growth,

        bestSellers,

        topProducts:
          salesProducts.slice(
            0,
            resolvedLimit
          ),

        topVariants,

        salesTrend,

        salesByLocation,

        itemTypeSplit,

        orderStatusBreakdown,
      },

      demand,
    };
  };