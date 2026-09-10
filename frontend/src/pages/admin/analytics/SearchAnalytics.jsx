import {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../../api/api.js";
import formatCurrency from "../../../utils/formatCurrency.js";

/* =========================================================
   FILTER OPTIONS
========================================================= */

const RANGE_OPTIONS = [
  {
    label: "Last 7 Days",
    value: 7,
  },
  {
    label: "Last 30 Days",
    value: 30,
  },
  {
    label: "Last 90 Days",
    value: 90,
  },
  {
    label: "Last 180 Days",
    value: 180,
  },
];

const LIMIT_OPTIONS = [
  10,
  20,
  30,
];

/* =========================================================
   HELPERS
========================================================= */

const formatNumber = (value) =>
  Number(value || 0).toLocaleString(
    "en-IN"
  );

const formatPercent = (value) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0%";
  }

  return `${number.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 1,
    }
  )}%`;
};

const formatCompactCurrency = (
  value
) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "₹0";
  }

  if (number >= 10000000) {
    return `₹${(
      number / 10000000
    ).toFixed(1)}Cr`;
  }

  if (number >= 100000) {
    return `₹${(
      number / 100000
    ).toFixed(1)}L`;
  }

  if (number >= 1000) {
    return `₹${(
      number / 1000
    ).toFixed(1)}K`;
  }

  return `₹${number.toLocaleString(
    "en-IN"
  )}`;
};

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
};

const formatShortDate = (
  value
) => {
  if (!value) {
    return "";
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
    }
  ).format(date);
};

const getMax = (
  array,
  key
) =>
  Math.max(
    1,
    ...(array || []).map(
      (item) =>
        Number(
          item?.[key] || 0
        )
    )
  );

const percentageWidth = (
  value,
  max
) => {
  const number = Number(
    value || 0
  );

  const maximum = Number(
    max || 1
  );

  if (number <= 0) {
    return "0%";
  }

  return `${Math.max(
    4,
    Math.min(
      100,
      (number / maximum) *
        100
    )
  )}%`;
};

const readableItemType = (
  value
) => {
  if (
    value === "custom_hamper"
  ) {
    return "Custom Hamper";
  }

  return "Ready-made Hamper";
};

const readableStatus = (
  value
) =>
  String(value || "Unknown")
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase()
    );

const demandSignal = (
  value
) => {
  const map = {
    strong_demand: {
      label: "Strong Demand",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    },

    high_interest_no_sales: {
      label:
        "Interest, No Sales",
      className:
        "border-red-200 bg-red-50 text-red-700",
    },

    high_interest_low_sales: {
      label:
        "High Interest / Low Sales",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
    },

    sales_led: {
      label: "Sales Led",
      className:
        "border-blue-200 bg-blue-50 text-blue-700",
    },

    interest_led: {
      label: "Interest Led",
      className:
        "border-violet-200 bg-violet-50 text-violet-700",
    },

    emerging: {
      label: "Emerging",
      className:
        "border-black/10 bg-black/[0.03] text-black/55",
    },
  };

  return (
    map[value] ||
    map.emerging
  );
};

/* =========================================================
   MAIN PAGE
========================================================= */

const SearchAnalytics = () => {
  const [
    days,
    setDays,
  ] = useState(30);

  const [
    limit,
    setLimit,
  ] = useState(10);

  const [
    analytics,
    setAnalytics,
  ] = useState(null);

  const [
    conversionAnalytics,
    setConversionAnalytics,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  /* =======================================================
     LOAD
  ======================================================= */

  useEffect(() => {
    let active = true;

    const loadAnalytics =
      async () => {
        if (analytics) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const [
            searchResponse,
            conversionResponse,
          ] = await Promise.all([
            api.get(
              "/analytics/admin/search-summary",
              {
                params: {
                  days,
                  limit,
                },
              }
            ),

            api.get(
              "/analytics/commerce/admin/summary",
              {
                params: {
                  days,
                  limit,
                },
              }
            ),
          ]);

          if (!active) {
            return;
          }

          setAnalytics(
            searchResponse.data
              ?.analytics ||
              null
          );

          setConversionAnalytics(
            conversionResponse.data
              ?.analytics ||
              null
          );
        } catch (
          requestError
        ) {
          if (!active) {
            return;
          }

          setError(
            requestError
              .response?.data
              ?.message ||
              "Unable to load analytics."
          );
        } finally {
          if (active) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      };

    loadAnalytics();

    return () => {
      active = false;
    };
  }, [
    days,
    limit,
    refreshKey,
  ]);

  /* =======================================================
     NORMALIZED DATA
  ======================================================= */

  const search =
    analytics?.search ||
    {
      totals:
        analytics?.totals ||
        {},

      topSearches:
        analytics?.topSearches ||
        [],

      zeroResultSearches:
        analytics
          ?.zeroResultSearches ||
        [],

      topClickedProducts:
        analytics
          ?.topClickedProducts ||
        [],

      topLocations:
        analytics?.topLocations ||
        [],

      searchesBySource:
        analytics
          ?.searchesBySource ||
        [],
    };

  const commerce =
    analytics?.commerce || {};

  const commerceTotals =
    commerce.totals || {};

  const growth =
    commerce.growth || {};

  const topProducts =
    commerce.topProducts || [];

  const topVariants =
    commerce.topVariants || [];

  const salesTrend =
    commerce.salesTrend || [];

  const salesLocations =
    commerce.salesByLocation || [];

  const itemTypeSplit =
    commerce.itemTypeSplit || [];

  const orderStatuses =
    commerce.orderStatusBreakdown ||
    [];

  const demandProducts =
    analytics?.demand?.products ||
    [];

  const opportunityProducts =
    analytics?.demand
      ?.highInterestLowSales ||
    [];

  const topSearches =
    search.topSearches || [];

  const zeroSearches =
    search.zeroResultSearches ||
    [];

  const topClickedProducts =
    search.topClickedProducts ||
    [];

  const searchLocations =
    search.topLocations || [];

  const searchSources =
    search.searchesBySource ||
    [];

  const bestByRevenue =
    commerce.bestSellers
      ?.byRevenue || null;

  const bestByUnits =
    commerce.bestSellers
      ?.byUnits || null;

  if (
    loading &&
    !analytics
  ) {
    return (
      <AnalyticsSkeleton />
    );
  }

  return (
    <div
      className="
        w-full
        min-w-0
        max-w-full
        overflow-x-hidden
        text-[#171717]
      "
    >
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <section
        className="
          border-b
          border-black/[0.08]
          pb-7
        "
      >
        <div
          className="
            flex
            min-w-0
            flex-col
            gap-6

            min-[1180px]:flex-row
            min-[1180px]:items-end
            min-[1180px]:justify-between
          "
        >
          <div
            className="
              min-w-0
              max-w-[860px]
            "
          >
            <div
              className="
                flex
                items-center
                gap-3
              "
            >
              <span
                className="
                  h-px
                  w-9
                  bg-[#D4AF37]
                "
              />

              <p
                className="
                  text-[10px]
                  font-black
                  uppercase
                  tracking-[0.18em]
                  text-[#F97316]

                  sm:text-[11px]
                "
              >
                Business Intelligence
              </p>
            </div>

            <h1
              className="
                mt-3
                text-[28px]
                font-black
                leading-[1.08]
                tracking-[-0.045em]

                sm:text-[34px]

                lg:text-[38px]

                min-[1700px]:text-[42px]
              "
            >
              Commerce & Demand Analytics
            </h1>

            <p
              className="
                mt-4
                max-w-[790px]
                text-[13px]
                font-medium
                leading-6
                text-black/50

                sm:text-[14px]
                sm:leading-7

                lg:text-[15px]
              "
            >
              Understand sales, customer demand, search behaviour and product performance from one clear dashboard.
            </p>

            {analytics?.period && (
              <div
                className="
                  mt-4
                  inline-flex
                  max-w-full
                  items-center
                  gap-2
                  border
                  border-black/[0.08]
                  bg-white
                  px-3
                  py-2
                "
              >
                <CalendarIcon />

                <span
                  className="
                    truncate
                    text-[10px]
                    font-bold
                    text-black/45

                    sm:text-[11px]
                  "
                >
                  {formatDate(
                    analytics
                      .period
                      .from
                  )}
                  {" — "}
                  {formatDate(
                    analytics
                      .period
                      .to
                  )}
                </span>
              </div>
            )}
          </div>

          <div
            className="
              flex
              w-full
              flex-wrap
              gap-2

              min-[1180px]:w-auto
              min-[1180px]:shrink-0
            "
          >
            <select
              value={days}
              onChange={(
                event
              ) =>
                setDays(
                  Number(
                    event.target
                      .value
                  )
                )
              }
              className="
                h-[46px]
                min-w-[140px]
                flex-1
                border
                border-black/[0.1]
                bg-white
                px-4
                text-[12px]
                font-bold
                text-[#292929]
                outline-none

                focus:border-[#F97316]

                sm:flex-none
              "
            >
              {RANGE_OPTIONS.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>

            <select
              value={limit}
              onChange={(
                event
              ) =>
                setLimit(
                  Number(
                    event.target
                      .value
                  )
                )
              }
              className="
                h-[46px]
                min-w-[105px]
                flex-1
                border
                border-black/[0.1]
                bg-white
                px-4
                text-[12px]
                font-bold
                text-[#292929]
                outline-none

                focus:border-[#F97316]

                sm:flex-none
              "
            >
              {LIMIT_OPTIONS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    Top {item}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              disabled={
                refreshing
              }
              onClick={() =>
                setRefreshKey(
                  (current) =>
                    current + 1
                )
              }
              className="
                flex
                h-[46px]
                min-w-[120px]
                flex-1
                items-center
                justify-center
                gap-2
                bg-[#171717]
                px-5
                text-[11px]
                font-black
                uppercase
                tracking-[0.05em]
                text-white
                transition

                hover:bg-[#F97316]

                disabled:opacity-50

                sm:flex-none
              "
            >
              <RefreshIcon
                spinning={
                  refreshing
                }
              />

              {refreshing
                ? "Refreshing"
                : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div
          className="
            mt-6
            border-l-4
            border-red-500
            bg-red-50
            px-5
            py-4
          "
        >
          <p
            className="
              text-[13px]
              font-semibold
              leading-6
              text-red-700
            "
          >
            {error}
          </p>
        </div>
      )}

      {/* ===================================================
          01 EXECUTIVE OVERVIEW
      =================================================== */}

      <DashboardSection
        number="01"
        eyebrow="Executive Overview"
        title="Business performance at a glance"
        description="Key numbers for the selected period, including revenue, sales volume and customer activity."
      >
        <AutoGrid
          minWidth={185}
          gap={0}
          className="
            border-l
            border-t
            border-black/[0.08]
          "
        >
          <KpiCard
            title="Revenue"
            value={formatCurrency(
              commerceTotals.revenue ||
                0
            )}
            subtitle="Paid revenue"
            growth={
              growth.revenue
            }
            icon={
              <RevenueIcon />
            }
          />

          <KpiCard
            title="Paid Orders"
            value={formatNumber(
              commerceTotals.paidOrders
            )}
            subtitle="Successful purchases"
            growth={
              growth.paidOrders
            }
            icon={
              <OrderIcon />
            }
          />

          <KpiCard
            title="Units Sold"
            value={formatNumber(
              commerceTotals.unitsSold
            )}
            subtitle="Hamper units sold"
            growth={
              growth.unitsSold
            }
            icon={
              <BoxIcon />
            }
          />

          <KpiCard
            title="Average Order"
            value={formatCurrency(
              commerceTotals.averageOrderValue ||
                0
            )}
            subtitle="Average order value"
            growth={
              growth.averageOrderValue
            }
            icon={
              <AverageIcon />
            }
          />

          <KpiCard
            title="Search Click Rate"
            value={formatPercent(
              search.totals
                ?.clickThroughRate
            )}
            subtitle="Search → product click"
            icon={
              <SearchIcon />
            }
          />

          <KpiCard
            title="Repeat Customers"
            value={formatPercent(
              commerceTotals.repeatCustomerRate
            )}
            subtitle={`${formatNumber(
              commerceTotals.repeatCustomers
            )} repeat buyers`}
            icon={
              <CustomerIcon />
            }
          />
        </AutoGrid>
      </DashboardSection>

      <ConversionIntelligence
        analytics={conversionAnalytics}
      />

      {/* ===================================================
          02 VISUAL OVERVIEW
      =================================================== */}

      <DashboardSection
        number="02"
        eyebrow="Visual Overview"
        title="See the business picture instantly"
        description="Visual comparisons make trends and performance differences easier to identify."
      >
        <AutoGrid
          minWidth={560}
          gap={20}
        >
          <ChartPanel
            title="Revenue Trend"
            description="Paid revenue performance across the selected period."
          >
            <RevenueLineChart
              rows={
                salesTrend
              }
            />
          </ChartPanel>

          <ChartPanel
            title="Search Funnel"
            description="How search interest flows toward product discovery."
          >
            <SearchFunnel
              totals={
                search.totals ||
                {}
              }
            />
          </ChartPanel>
        </AutoGrid>

        <AutoGrid
          minWidth={340}
          gap={20}
          className="mt-5"
        >
          <ChartPanel
            title="Sales Mix"
            description="Ready-made versus custom hamper revenue."
          >
            <SalesMixDonut
              rows={
                itemTypeSplit
              }
            />
          </ChartPanel>

          <ChartPanel
            title="Top Product Revenue"
            description="Quick visual ranking of your highest earning hampers."
          >
            <ProductRevenueChart
              rows={topProducts.slice(
                0,
                6
              )}
            />
          </ChartPanel>

          <ChartPanel
            title="Search Demand"
            description="Most searched terms by customers."
          >
            <SearchDemandChart
              rows={topSearches.slice(
                0,
                6
              )}
            />
          </ChartPanel>
        </AutoGrid>
      </DashboardSection>

      {/* ===================================================
          03 BEST SELLERS
      =================================================== */}

      <DashboardSection
        number="03"
        eyebrow="Best Sellers"
        title="Which hampers are winning?"
        description="Compare the strongest product by revenue with the strongest product by units sold."
      >
        <AutoGrid
          minWidth={560}
          gap={20}
        >
          <WinnerCard
            eyebrow="Revenue Leader"
            title="Highest Selling Hamper"
            item={
              bestByRevenue
            }
            mainValue={
              bestByRevenue
                ? formatCurrency(
                    bestByRevenue.revenue
                  )
                : "—"
            }
            mainLabel="Revenue"
          />

          <WinnerCard
            eyebrow="Volume Leader"
            title="Most Purchased Hamper"
            item={
              bestByUnits
            }
            mainValue={
              bestByUnits
                ? `${formatNumber(
                    bestByUnits.unitsSold
                  )} units`
                : "—"
            }
            mainLabel="Units Sold"
            gold
          />
        </AutoGrid>
      </DashboardSection>

      {/* ===================================================
          04 SALES PERFORMANCE
      =================================================== */}

      <DashboardSection
        number="04"
        eyebrow="Sales Performance"
        title="Orders and units over time"
        description="Compare the number of paid orders with the quantity of hampers sold each day."
      >
        <ChartPanel
          title="Order & Unit Activity"
          description="Daily paid order activity and total units sold."
        >
          <OrdersUnitsChart
            rows={
              salesTrend
            }
          />
        </ChartPanel>
      </DashboardSection>

      {/* ===================================================
          05 PRODUCT PERFORMANCE
      =================================================== */}

      <DashboardSection
        number="05"
        eyebrow="Product Performance"
        title="What customers are actually buying"
        description="Detailed ranking of hampers and exact SKU variants based on real paid orders."
      >
        <Panel
          title="Top Selling Hampers"
          description="Products ranked by revenue with units, orders and average selling price."
          icon={
            <BoxIcon />
          }
        >
          <TopProductsTable
            products={
              topProducts
            }
          />
        </Panel>

        <div className="mt-5">
          <Panel
            title="Top Selling Variants"
            description="Identify which exact SKU or variant is moving fastest."
            icon={
              <VariantIcon />
            }
          >
            <VariantsList
              variants={
                topVariants
              }
            />
          </Panel>
        </div>
      </DashboardSection>

      {/* ===================================================
          06 DEMAND INTELLIGENCE
      =================================================== */}

      <DashboardSection
        number="06"
        eyebrow="Demand Intelligence"
        title="Customer interest versus actual sales"
        description="Use search interest and paid sales together to identify strong demand and missed opportunities."
      >
        <Panel
          title="Product Demand Index"
          description="A higher score represents stronger combined sales and customer interest."
          icon={
            <DemandIcon />
          }
        >
          <DemandTable
            products={
              demandProducts
            }
          />
        </Panel>

        <div className="mt-5">
          <Panel
            title="High Interest, Low Sales"
            description="Products attracting customer attention without matching purchase volume."
            icon={
              <OpportunityIcon />
            }
            warning
          >
            <OpportunityList
              products={
                opportunityProducts
              }
            />
          </Panel>
        </div>
      </DashboardSection>

      {/* ===================================================
          07 SEARCH INTELLIGENCE
      =================================================== */}

      <DashboardSection
        number="07"
        eyebrow="Search Intelligence"
        title="What customers are looking for"
        description="Understand customer intent before the purchase happens."
      >
        <AutoGrid
          minWidth={340}
          gap={20}
        >
          <Panel
            title="Top Searches"
            description="Most frequently submitted search terms."
            icon={
              <SearchIcon />
            }
          >
            <TopSearchList
              rows={
                topSearches
              }
            />
          </Panel>

          <Panel
            title="Most Clicked Products"
            description="Products customers select from search suggestions."
            icon={
              <ClickIcon />
            }
          >
            <SearchClickedProducts
              rows={
                topClickedProducts
              }
            />
          </Panel>

          <Panel
            title="Zero Result Searches"
            description="Searches where customers could not find a matching product."
            icon={
              <OpportunityIcon />
            }
            warning
          >
            <ZeroSearchList
              rows={
                zeroSearches
              }
            />
          </Panel>
        </AutoGrid>

        <div className="mt-5">
          <Panel
            title="Search Devices"
            description="Compare desktop and mobile customer search activity."
            icon={
              <DeviceIcon />
            }
          >
            <SearchSourceList
              rows={
                searchSources
              }
            />
          </Panel>
        </div>
      </DashboardSection>

      {/* ===================================================
          08 GEOGRAPHY
      =================================================== */}

      <DashboardSection
        number="08"
        eyebrow="Geography"
        title="Where demand and purchases come from"
        description="Compare actual buying locations with locations generating search interest."
      >
        <AutoGrid
          minWidth={480}
          gap={20}
        >
          <Panel
            title="Where Customers Buy"
            description="Paid revenue grouped by checkout delivery location."
            icon={
              <LocationIcon />
            }
          >
            <SalesLocationList
              rows={
                salesLocations
              }
            />
          </Panel>

          <Panel
            title="Where Demand Starts"
            description="Search activity based on the delivery location selected in the website."
            icon={
              <SearchLocationIcon />
            }
          >
            <SearchLocationList
              rows={
                searchLocations
              }
            />
          </Panel>
        </AutoGrid>
      </DashboardSection>

      {/* ===================================================
          09 BUSINESS HEALTH
      =================================================== */}

      <DashboardSection
        number="09"
        eyebrow="Business Health"
        title="Customer and order health"
        description="Understand customer value, product mix and current paid-order status."
        last
      >
        <AutoGrid
          minWidth={220}
          gap={0}
          className="
            border-l
            border-t
            border-black/[0.08]
          "
        >
          <SmallMetric
            label="Unique Customers"
            value={formatNumber(
              commerceTotals.uniqueCustomers
            )}
            helper="Paid customers"
          />

          <SmallMetric
            label="Units / Order"
            value={Number(
              commerceTotals.unitsPerOrder ||
                0
            ).toLocaleString(
              "en-IN",
              {
                maximumFractionDigits:
                  2,
              }
            )}
            helper="Average basket size"
          />

          <SmallMetric
            label="Discount Given"
            value={formatCurrency(
              commerceTotals.discountAmount ||
                0
            )}
            helper="Total discount value"
          />

          <SmallMetric
            label="Revenue / Customer"
            value={formatCurrency(
              commerceTotals.revenuePerCustomer ||
                0
            )}
            helper="Average customer value"
          />
        </AutoGrid>

        <AutoGrid
          minWidth={480}
          gap={20}
          className="mt-5"
        >
          <Panel
            title="Ready-made vs Custom"
            description="Revenue contribution by hamper type."
            icon={
              <MixIcon />
            }
          >
            <ItemTypeSplit
              rows={
                itemTypeSplit
              }
            />
          </Panel>

          <Panel
            title="Paid Order Status"
            description="Operational status of successfully paid orders."
            icon={
              <OrderIcon />
            }
          >
            <OrderStatusList
              rows={
                orderStatuses
              }
            />
          </Panel>
        </AutoGrid>
      </DashboardSection>
    </div>
  );
};

/* =========================================================
   CONVERSION INTELLIGENCE
========================================================= */

const ConversionIntelligence = ({
  analytics,
}) => {
  const funnel =
    analytics?.funnel || {};

  const commerce =
    analytics?.commerce || {};

  const searchAttribution =
    analytics?.searchAttribution || {};

  const topConvertingSearches =
    searchAttribution.topConvertingSearches ||
    [];

  const topProducts =
    analytics?.products?.topProducts ||
    [];

  return (
    <DashboardSection
      number="01B"
      eyebrow="Conversion Intelligence"
      title="From product discovery to paid order"
      description="Server-side commerce events connect product views, add-to-cart actions, checkout starts, Buy Now and successful paid orders."
    >
      <AutoGrid
        minWidth={185}
        gap={0}
        className="border-l border-t border-black/[0.08]"
      >
        <KpiCard
          title="Product Views"
          value={formatNumber(
            funnel.productViews
          )}
          subtitle="Tracked PDP views"
          icon={<SearchIcon />}
        />

        <KpiCard
          title="Add to Carts"
          value={formatNumber(
            funnel.addToCarts
          )}
          subtitle="Tracked cart additions"
          icon={<BoxIcon />}
        />

        <KpiCard
          title="Checkout Starts"
          value={formatNumber(
            funnel.checkoutStarts
          )}
          subtitle={`${formatNumber(
            funnel.buyNowStarts
          )} Buy Now starts`}
          icon={<OrderIcon />}
        />

        <KpiCard
          title="View → Cart"
          value={formatPercent(
            funnel.viewToCartRate
          )}
          subtitle="Product view conversion"
          icon={<AverageIcon />}
        />

        <KpiCard
          title="Checkout → Paid"
          value={formatPercent(
            funnel.checkoutToPaidOrderRate
          )}
          subtitle="Checkout conversion"
          icon={<RevenueIcon />}
        />

        <KpiCard
          title="Search → Paid"
          value={formatPercent(
            funnel.searchToPaidOrderRate
          )}
          subtitle={`${formatNumber(
            searchAttribution.attributedPaidOrders
          )} attributed orders`}
          icon={<CustomerIcon />}
        />
      </AutoGrid>

      <AutoGrid
        minWidth={360}
        gap={20}
        className="mt-5"
      >
        <div className="min-w-0 border border-black/[0.08] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#F97316]">
                Search Attribution
              </p>

              <h3 className="mt-1 text-[19px] font-black tracking-[-0.025em]">
                Searches that become revenue
              </h3>
            </div>

            <span className="text-right text-[10px] font-bold text-black/35">
              {formatNumber(
                searchAttribution.attributedPaidOrders
              )}{" "}
              paid orders
            </span>
          </div>

          {topConvertingSearches.length ? (
            <div className="mt-5 divide-y divide-black/[0.06]">
              {topConvertingSearches
                .slice(0, 8)
                .map((row, index) => (
                  <div
                    key={`${row.normalizedQuery || row.query}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-extrabold">
                        {row.query ||
                          row.normalizedQuery ||
                          "Search"}
                      </p>

                      <p className="mt-1 text-[9px] font-semibold text-black/35">
                        {formatNumber(
                          row.orderCount
                        )}{" "}
                        orders ·{" "}
                        {formatNumber(
                          row.unitsSold
                        )}{" "}
                        units
                      </p>
                    </div>

                    <p className="text-[12px] font-black text-[#171717]">
                      {formatCurrency(
                        row.revenue || 0
                      )}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="mt-5 text-[11px] font-medium leading-5 text-black/35">
              Paid search-attributed orders will appear here once customers move from search results through checkout.
            </p>
          )}
        </div>

        <div className="min-w-0 border border-black/[0.08] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#F97316]">
                Product Conversion
              </p>

              <h3 className="mt-1 text-[19px] font-black tracking-[-0.025em]">
                Views, carts and sales together
              </h3>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-bold text-black/35">
                Abandoned checkout
              </p>

              <p className="mt-1 text-[12px] font-black text-[#171717]">
                {formatNumber(
                  commerce.abandonedCheckoutOrders
                )}
              </p>
            </div>
          </div>

          {topProducts.length ? (
            <div className="mt-5 divide-y divide-black/[0.06]">
              {topProducts
                .slice(0, 8)
                .map((row, index) => (
                  <div
                    key={`${row.productId || row.productSlug || row.productName}-${index}`}
                    className="py-3 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="min-w-0 truncate text-[12px] font-extrabold">
                        {row.productName ||
                          row.productSlug ||
                          "Product"}
                      </p>

                      <p className="shrink-0 text-[10px] font-black text-[#F97316]">
                        {formatPercent(
                          row.viewToCartRate
                        )}
                      </p>
                    </div>

                    <p className="mt-1 text-[9px] font-semibold text-black/35">
                      {formatNumber(row.views)} views ·{" "}
                      {formatNumber(
                        row.addToCartUnits
                      )}{" "}
                      cart units ·{" "}
                      {formatNumber(
                        row.unitsSold
                      )}{" "}
                      sold
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="mt-5 text-[11px] font-medium leading-5 text-black/35">
              Product conversion data will populate as product views and cart events are recorded.
            </p>
          )}

          {Number(
            commerce.abandonedCheckoutValue || 0
          ) > 0 && (
            <div className="mt-5 border-t border-black/[0.06] pt-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-black/30">
                Abandoned checkout value
              </p>

              <p className="mt-1 text-[18px] font-black">
                {formatCurrency(
                  commerce.abandonedCheckoutValue
                )}
              </p>
            </div>
          )}
        </div>
      </AutoGrid>
    </DashboardSection>
  );
};

/* =========================================================
   AUTO GRID
   IMPORTANT:
   Responds to ACTUAL available content width, not only
   browser viewport breakpoint.
========================================================= */

const AutoGrid = ({
  children,
  minWidth = 320,
  gap = 16,
  className = "",
}) => (
  <div
    className={`
      grid
      min-w-0
      max-w-full

      ${className}
    `}
    style={{
      gap: `${gap}px`,

      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minWidth}px), 1fr))`,
    }}
  >
    {children}
  </div>
);

/* =========================================================
   DASHBOARD SECTION
========================================================= */

const DashboardSection = ({
  number,
  eyebrow,
  title,
  description,
  children,
  last = false,
}) => (
  <section
    className={`
      min-w-0
      pt-9

      sm:pt-10

      ${
        last
          ? "pb-8"
          : "pb-3"
      }
    `}
  >
    <div
      className="
        mb-5
        flex
        min-w-0
        items-start
        gap-3

        sm:mb-6
        sm:gap-4
      "
    >
      <span
        className="
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          border
          border-[#D4AF37]/35
          bg-[#FFF9F2]
          font-serif
          text-[13px]
          font-semibold
          text-[#B89024]

          sm:h-10
          sm:w-10
          sm:text-[14px]
        "
      >
        {number}
      </span>

      <div className="min-w-0">
        <p
          className="
            text-[10px]
            font-black
            uppercase
            tracking-[0.15em]
            text-[#F97316]

            sm:text-[11px]
          "
        >
          {eyebrow}
        </p>

        <h2
          className="
            mt-1.5
            text-[21px]
            font-black
            leading-tight
            tracking-[-0.03em]
            text-[#222]

            sm:text-[24px]

            lg:text-[26px]
          "
        >
          {title}
        </h2>

        <p
          className="
            mt-2
            max-w-[920px]
            text-[12px]
            font-medium
            leading-6
            text-black/45

            sm:text-[13px]

            lg:text-[14px]
          "
        >
          {description}
        </p>
      </div>
    </div>

    {children}
  </section>
);

/* =========================================================
   KPI
========================================================= */

const KpiCard = ({
  title,
  value,
  subtitle,
  growth,
  icon,
}) => (
  <div
    className="
      min-h-[165px]
      min-w-0
      border-b
      border-r
      border-black/[0.08]
      bg-white
      p-4

      sm:min-h-[170px]
      sm:p-5
    "
  >
    <div
      className="
        flex
        items-start
        justify-between
        gap-3
      "
    >
      <p
        className="
          text-[10px]
          font-black
          uppercase
          tracking-[0.07em]
          text-black/40

          sm:text-[11px]
        "
      >
        {title}
      </p>

      <span
        className="
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          border
          border-black/[0.07]
          bg-[#FAF9F6]
          text-[#F97316]
        "
      >
        {icon}
      </span>
    </div>

    <p
      className="
        mt-5
        break-words
        text-[26px]
        font-black
        leading-none
        tracking-[-0.045em]

        sm:text-[28px]

        min-[1750px]:text-[30px]
      "
    >
      {value}
    </p>

    <div
      className="
        mt-4
        flex
        flex-wrap
        items-center
        gap-2
      "
    >
      {growth !==
        undefined &&
        growth !== null && (
          <GrowthBadge
            value={
              growth
            }
          />
        )}

      <p
        className="
          text-[10px]
          font-medium
          leading-4
          text-black/40
        "
      >
        {subtitle}
      </p>
    </div>
  </div>
);

const GrowthBadge = ({
  value,
}) => {
  const number =
    Number(value || 0);

  const positive =
    number >= 0;

  return (
    <span
      className={`
        shrink-0
        border
        px-2
        py-1
        text-[9px]
        font-black

        ${
          positive
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-600"
        }
      `}
    >
      {positive
        ? "↑"
        : "↓"}{" "}
      {Math.abs(
        number
      ).toLocaleString(
        "en-IN",
        {
          maximumFractionDigits:
            1,
        }
      )}
      %
    </span>
  );
};

/* =========================================================
   SMALL METRIC
========================================================= */

const SmallMetric = ({
  label,
  value,
  helper,
}) => (
  <div
    className="
      min-w-0
      border-b
      border-r
      border-black/[0.08]
      bg-white
      px-5
      py-5
    "
  >
    <p
      className="
        text-[10px]
        font-black
        uppercase
        tracking-[0.08em]
        text-black/35
      "
    >
      {label}
    </p>

    <p
      className="
        mt-2
        break-words
        text-[21px]
        font-black
        tracking-[-0.03em]

        sm:text-[22px]
      "
    >
      {value}
    </p>

    <p
      className="
        mt-2
        text-[10px]
        font-medium
        text-black/35
      "
    >
      {helper}
    </p>
  </div>
);

/* =========================================================
   CHART PANEL
========================================================= */

const ChartPanel = ({
  title,
  description,
  children,
}) => (
  <div
    className="
      min-w-0
      max-w-full
      overflow-hidden
      border
      border-black/[0.08]
      bg-white
    "
  >
    <div
      className="
        border-b
        border-black/[0.07]
        bg-[#FCFBF9]
        px-4
        py-4

        sm:px-5

        lg:px-6
      "
    >
      <h3
        className="
          text-[16px]
          font-black
          tracking-[-0.02em]
          text-[#252525]

          sm:text-[18px]
        "
      >
        {title}
      </h3>

      <p
        className="
          mt-1.5
          text-[11px]
          font-medium
          leading-5
          text-black/40

          sm:text-[12px]
        "
      >
        {description}
      </p>
    </div>

    <div
      className="
        min-w-0
        max-w-full
        p-4

        sm:p-5

        lg:p-6
      "
    >
      {children}
    </div>
  </div>
);

/* =========================================================
   REVENUE LINE CHART
========================================================= */

const RevenueLineChart = ({
  rows,
}) => {
  const chart = useMemo(
    () => {
      if (!rows?.length) {
        return null;
      }

      const width = 1000;
      const height = 300;

      const left = 58;
      const right = 22;
      const top = 25;
      const bottom = 42;

      const usableWidth =
        width -
        left -
        right;

      const usableHeight =
        height -
        top -
        bottom;

      const max = Math.max(
        1,
        ...rows.map(
          (row) =>
            Number(
              row.revenue || 0
            )
        )
      );

      const points = rows.map(
        (
          row,
          index
        ) => {
          const x =
            rows.length === 1
              ? left +
                usableWidth / 2
              : left +
                (index /
                  (rows.length -
                    1)) *
                  usableWidth;

          const y =
            top +
            usableHeight -
            (Number(
              row.revenue || 0
            ) /
              max) *
              usableHeight;

          return {
            x,
            y,
            row,
          };
        }
      );

      const line = points
        .map(
          (
            point,
            index
          ) =>
            `${
              index === 0
                ? "M"
                : "L"
            } ${point.x} ${point.y}`
        )
        .join(" ");

      const area = `${line} L ${
        points[
          points.length - 1
        ].x
      } ${
        top +
        usableHeight
      } L ${
        points[0].x
      } ${
        top +
        usableHeight
      } Z`;

      return {
        width,
        height,
        left,
        top,
        usableHeight,
        max,
        points,
        line,
        area,
      };
    },
    [rows]
  );

  if (!chart) {
    return (
      <EmptyData text="Revenue chart will appear after paid orders are recorded." />
    );
  }

  const labelEvery = Math.max(
    1,
    Math.ceil(
      rows.length / 6
    )
  );

  return (
    <div
      className="
        w-full
        min-w-0
        overflow-hidden
      "
    >
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="
          block
          h-auto
          w-full
        "
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 1, 2, 3, 4].map(
          (line) => {
            const y =
              chart.top +
              (chart.usableHeight /
                4) *
                line;

            const amount =
              chart.max *
              (1 - line / 4);

            return (
              <g key={line}>
                <line
                  x1="58"
                  x2="978"
                  y1={y}
                  y2={y}
                  stroke="rgba(0,0,0,.07)"
                  strokeWidth="1"
                />

                <text
                  x="50"
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="rgba(0,0,0,.38)"
                >
                  {formatCompactCurrency(
                    amount
                  )}
                </text>
              </g>
            );
          }
        )}

        <defs>
          <linearGradient
            id="revenueArea"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#F97316"
              stopOpacity="0.26"
            />

            <stop
              offset="100%"
              stopColor="#F97316"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        <path
          d={chart.area}
          fill="url(#revenueArea)"
        />

        <path
          d={chart.line}
          fill="none"
          stroke="#F97316"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {chart.points.map(
          (
            point,
            index
          ) => (
            <g
              key={
                point.row.date
              }
            >
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="white"
                stroke="#F97316"
                strokeWidth="3"
              />

              {index %
                labelEvery ===
                0 && (
                <text
                  x={point.x}
                  y="288"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="rgba(0,0,0,.45)"
                >
                  {formatShortDate(
                    point.row
                      .date
                  )}
                </text>
              )}
            </g>
          )
        )}
      </svg>
    </div>
  );
};

/* =========================================================
   ORDERS + UNITS
========================================================= */

const OrdersUnitsChart = ({
  rows,
}) => {
  if (!rows?.length) {
    return (
      <EmptyData text="Order activity chart will appear after paid orders are recorded." />
    );
  }

  const max = Math.max(
    1,
    ...rows.flatMap(
      (row) => [
        Number(
          row.orders || 0
        ),
        Number(
          row.unitsSold || 0
        ),
      ]
    )
  );

  return (
    <div className="min-w-0">
      <div
        className="
          mb-5
          flex
          flex-wrap
          items-center
          gap-5
        "
      >
        <Legend
          boxClass="bg-[#171717]"
          label="Paid Orders"
        />

        <Legend
          boxClass="bg-[#F97316]"
          label="Units Sold"
        />
      </div>

      <div
        className="
          max-w-full
          overflow-x-auto
          pb-2
        "
      >
        <div
          className="
            flex
            min-w-[720px]
            items-end
            gap-3
          "
        >
          {rows.map(
            (row) => (
              <div
                key={row.date}
                className="
                  min-w-[48px]
                  flex-1
                "
              >
                <div
                  className="
                    flex
                    h-[200px]
                    items-end
                    justify-center
                    gap-1.5
                    border-b
                    border-black/[0.08]
                  "
                >
                  <div
                    title={`${row.orders} orders`}
                    style={{
                      height:
                        percentageWidth(
                          row.orders,
                          max
                        ),
                    }}
                    className="
                      w-[34%]
                      min-w-[10px]
                      bg-[#171717]
                    "
                  />

                  <div
                    title={`${row.unitsSold} units`}
                    style={{
                      height:
                        percentageWidth(
                          row.unitsSold,
                          max
                        ),
                    }}
                    className="
                      w-[34%]
                      min-w-[10px]
                      bg-[#F97316]
                    "
                  />
                </div>

                <p
                  className="
                    mt-2
                    text-center
                    text-[9px]
                    font-bold
                    text-black/40
                  "
                >
                  {formatShortDate(
                    row.date
                  )}
                </p>

                <p
                  className="
                    mt-1
                    text-center
                    text-[9px]
                    text-black/30
                  "
                >
                  {row.orders} /{" "}
                  {row.unitsSold}
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   SEARCH FUNNEL
========================================================= */

const SearchFunnel = ({
  totals,
}) => {
  const rows = [
    {
      label:
        "Searches Submitted",

      value: Number(
        totals.searchSubmits || 0
      ),

      className:
        "bg-[#171717]",
    },

    {
      label:
        "Product Clicks",

      value: Number(
        totals.resultClicks || 0
      ),

      className:
        "bg-[#F97316]",
    },

    {
      label:
        "Popular Search Clicks",

      value: Number(
        totals.popularClicks ||
          0
      ),

      className:
        "bg-[#D4AF37]",
    },
  ];

  const max = Math.max(
    1,
    ...rows.map(
      (item) => item.value
    )
  );

  return (
    <div
      className="
        space-y-5
        py-2
      "
    >
      {rows.map(
        (item) => (
          <div key={item.label}>
            <div
              className="
                mb-2
                flex
                items-end
                justify-between
                gap-4
              "
            >
              <p
                className="
                  text-[11px]
                  font-bold
                  text-[#292929]

                  sm:text-[12px]
                "
              >
                {item.label}
              </p>

              <p
                className="
                  text-[17px]
                  font-black

                  sm:text-[18px]
                "
              >
                {formatNumber(
                  item.value
                )}
              </p>
            </div>

            <div
              className="
                h-9
                bg-black/[0.04]

                sm:h-10
              "
            >
              <div
                style={{
                  width:
                    percentageWidth(
                      item.value,
                      max
                    ),
                }}
                className={`
                  flex
                  h-full
                  items-center
                  justify-end
                  px-3
                  transition-all
                  duration-500

                  ${item.className}
                `}
              >
                {item.value > 0 && (
                  <span
                    className="
                      text-[9px]
                      font-black
                      text-white
                    "
                  >
                    {Math.round(
                      (item.value /
                        max) *
                        100
                    )}
                    %
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      )}

      <div
        className="
          border-t
          border-black/[0.07]
          pt-4
        "
      >
        <p
          className="
            text-[11px]
            font-medium
            text-black/45
          "
        >
          Search → product click rate
        </p>

        <p
          className="
            mt-1
            text-[24px]
            font-black
            text-[#F97316]

            sm:text-[25px]
          "
        >
          {formatPercent(
            totals.clickThroughRate
          )}
        </p>
      </div>
    </div>
  );
};

/* =========================================================
   SALES MIX DONUT
========================================================= */

const SalesMixDonut = ({
  rows,
}) => {
  if (!rows?.length) {
    return (
      <EmptyData text="Sales mix will appear after paid orders are recorded." />
    );
  }

  const total = rows.reduce(
    (sum, item) =>
      sum +
      Number(
        item.revenue || 0
      ),
    0
  );

  const first = rows[0];

  const firstPercentage =
    total > 0
      ? (Number(
          first?.revenue || 0
        ) /
          total) *
        100
      : 0;

  const background =
    rows.length > 1
      ? `conic-gradient(#F97316 0 ${firstPercentage}%, #D4AF37 ${firstPercentage}% 100%)`
      : "conic-gradient(#F97316 0 100%)";

  return (
    <div
      className="
        flex
        min-w-0
        flex-col
        items-center
        justify-center
        gap-7
        py-2

        min-[520px]:flex-row
      "
    >
      <div
        style={{
          background,
        }}
        className="
          relative
          h-[160px]
          w-[160px]
          shrink-0
          rounded-full

          sm:h-[180px]
          sm:w-[180px]
        "
      >
        <div
          className="
            absolute
            inset-[25px]
            flex
            flex-col
            items-center
            justify-center
            rounded-full
            bg-white
            text-center

            sm:inset-[28px]
          "
        >
          <p
            className="
              text-[8px]
              font-black
              uppercase
              tracking-[0.08em]
              text-black/30

              sm:text-[9px]
            "
          >
            Revenue
          </p>

          <p
            className="
              mt-1
              text-[18px]
              font-black

              sm:text-[20px]
            "
          >
            {formatCompactCurrency(
              total
            )}
          </p>
        </div>
      </div>

      <div
        className="
          w-full
          min-w-0
          max-w-[300px]
          space-y-4
        "
      >
        {rows.map(
          (
            item,
            index
          ) => {
            const percent =
              total > 0
                ? (Number(
                    item.revenue ||
                      0
                  ) /
                    total) *
                  100
                : 0;

            return (
              <div
                key={
                  item.itemType
                }
                className="
                  flex
                  min-w-0
                  items-center
                  justify-between
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    min-w-0
                    items-center
                    gap-3
                  "
                >
                  <span
                    className={`
                      h-3
                      w-3
                      shrink-0

                      ${
                        index === 0
                          ? "bg-[#F97316]"
                          : "bg-[#D4AF37]"
                      }
                    `}
                  />

                  <div className="min-w-0">
                    <p
                      className="
                        text-[11px]
                        font-extrabold
                        leading-4

                        sm:text-[12px]
                      "
                    >
                      {readableItemType(
                        item.itemType
                      )}
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[9px]
                        text-black/35
                      "
                    >
                      {formatNumber(
                        item.unitsSold
                      )}{" "}
                      units
                    </p>
                  </div>
                </div>

                <div
                  className="
                    shrink-0
                    text-right
                  "
                >
                  <p
                    className="
                      text-[11px]
                      font-black

                      sm:text-[12px]
                    "
                  >
                    {percent.toFixed(
                      1
                    )}
                    %
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-[9px]
                      text-black/35
                    "
                  >
                    {formatCompactCurrency(
                      item.revenue
                    )}
                  </p>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
};

/* =========================================================
   PRODUCT REVENUE CHART
========================================================= */

const ProductRevenueChart = ({
  rows,
}) => {
  if (!rows?.length) {
    return (
      <EmptyData text="Product revenue chart will appear after sales." />
    );
  }

  const max = getMax(
    rows,
    "revenue"
  );

  return (
    <div className="space-y-5">
      {rows.map(
        (
          item,
          index
        ) => (
          <div
            key={`${item.product || item.productName}-${index}`}
            className="min-w-0"
          >
            <div
              className="
                mb-2
                flex
                min-w-0
                items-start
                justify-between
                gap-3
              "
            >
              <p
                className="
                  min-w-0
                  flex-1
                  truncate
                  text-[11px]
                  font-extrabold

                  sm:text-[12px]
                "
              >
                {item.productName ||
                  "Custom Hamper"}
              </p>

              <p
                className="
                  shrink-0
                  text-[11px]
                  font-black
                  text-[#F97316]
                "
              >
                {formatCompactCurrency(
                  item.revenue
                )}
              </p>
            </div>

            <div
              className="
                h-2.5
                bg-black/[0.05]
              "
            >
              <div
                style={{
                  width:
                    percentageWidth(
                      item.revenue,
                      max
                    ),
                }}
                className="
                  h-full
                  bg-[#F97316]
                "
              />
            </div>

            <p
              className="
                mt-1.5
                text-[9px]
                text-black/35
              "
            >
              {formatNumber(
                item.unitsSold
              )}{" "}
              units ·{" "}
              {formatNumber(
                item.orderCount
              )}{" "}
              orders
            </p>
          </div>
        )
      )}
    </div>
  );
};

/* =========================================================
   SEARCH DEMAND
========================================================= */

const SearchDemandChart = ({
  rows,
}) => {
  if (!rows?.length) {
    return (
      <EmptyData text="Search demand chart will appear after searches." />
    );
  }

  const max = getMax(
    rows,
    "count"
  );

  return (
    <div className="space-y-5">
      {rows.map(
        (
          item,
          index
        ) => (
          <div
            key={`${item.query}-${index}`}
            className="min-w-0"
          >
            <div
              className="
                mb-2
                flex
                min-w-0
                items-center
                justify-between
                gap-4
              "
            >
              <p
                className="
                  min-w-0
                  flex-1
                  truncate
                  text-[11px]
                  font-extrabold

                  sm:text-[12px]
                "
              >
                {item.query}
              </p>

              <p
                className="
                  shrink-0
                  text-[13px]
                  font-black
                "
              >
                {formatNumber(
                  item.count
                )}
              </p>
            </div>

            <div
              className="
                h-2.5
                bg-black/[0.05]
              "
            >
              <div
                style={{
                  width:
                    percentageWidth(
                      item.count,
                      max
                    ),
                }}
                className="
                  h-full
                  bg-[#171717]
                "
              />
            </div>
          </div>
        )
      )}
    </div>
  );
};

/* =========================================================
   LEGEND
========================================================= */

const Legend = ({
  boxClass,
  label,
}) => (
  <div
    className="
      flex
      items-center
      gap-2
    "
  >
    <span
      className={`
        h-3
        w-3

        ${boxClass}
      `}
    />

    <span
      className="
        text-[10px]
        font-bold
        text-black/45
      "
    >
      {label}
    </span>
  </div>
);

/* =========================================================
   PANEL
========================================================= */

const Panel = ({
  title,
  description,
  children,
  icon,
  warning = false,
}) => (
  <div
    className="
      h-full
      min-w-0
      max-w-full
      overflow-hidden
      border
      border-black/[0.08]
      bg-white
    "
  >
    <div
      className="
        flex
        min-w-0
        items-start
        gap-3
        border-b
        border-black/[0.07]
        bg-[#FCFBF9]
        px-4
        py-4

        sm:gap-4
        sm:px-5
        sm:py-5

        lg:px-6
      "
    >
      <span
        className={`
          flex
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          border

          ${
            warning
              ? "border-red-100 bg-red-50 text-red-500"
              : "border-[#F97316]/15 bg-[#FFF7F2] text-[#F97316]"
          }
        `}
      >
        {icon}
      </span>

      <div className="min-w-0">
        <h3
          className="
            text-[16px]
            font-black
            leading-tight
            tracking-[-0.02em]
            text-[#252525]

            sm:text-[18px]

            lg:text-[19px]
          "
        >
          {title}
        </h3>

        <p
          className="
            mt-1.5
            text-[11px]
            font-medium
            leading-5
            text-black/40

            sm:text-[12px]
          "
        >
          {description}
        </p>
      </div>
    </div>

    <div
      className="
        min-w-0
        max-w-full
        p-4

        sm:p-5

        lg:p-6
      "
    >
      {children}
    </div>
  </div>
);

/* =========================================================
   WINNER CARD
   IMPORTANT RESPONSIVE FIX:
   Removed internal 3-column layout.
========================================================= */

const WinnerCard = ({
  eyebrow,
  title,
  item,
  mainValue,
  mainLabel,
  gold = false,
}) => (
  <article
    className="
      min-w-0
      max-w-full
      overflow-hidden
      border
      border-black/[0.08]
      bg-white
    "
  >
    {/* IMAGE + INFORMATION */}

    <div
      className="
        grid
        min-w-0

        sm:grid-cols-[140px_minmax(0,1fr)]

        min-[1750px]:grid-cols-[155px_minmax(0,1fr)]
      "
    >
      <div
        className="
          flex
          min-h-[145px]
          items-center
          justify-center
          border-b
          border-black/[0.07]
          bg-[#F7F5F0]
          p-4

          sm:min-h-[180px]
          sm:border-b-0
          sm:border-r
        "
      >
        {item?.image ? (
          <img
            src={item.image}
            alt={
              item.productName
            }
            className="
              h-[115px]
              w-[115px]
              object-cover

              sm:h-[120px]
              sm:w-[120px]

              min-[1750px]:h-[125px]
              min-[1750px]:w-[125px]
            "
          />
        ) : (
          <span className="text-[#F97316]">
            <BoxIcon large />
          </span>
        )}
      </div>

      <div
        className="
          min-w-0
          p-4

          sm:p-5
        "
      >
        <p
          className={`
            text-[9px]
            font-black
            uppercase
            tracking-[0.14em]

            sm:text-[10px]

            ${
              gold
                ? "text-[#B59022]"
                : "text-[#F97316]"
            }
          `}
        >
          {eyebrow}
        </p>

        <h3
          className="
            mt-2
            text-[17px]
            font-black
            leading-[1.25]
            tracking-[-0.025em]

            sm:text-[19px]

            min-[1750px]:text-[20px]
          "
        >
          {title}
        </h3>

        {item ? (
          <>
            <p
              className="
                mt-4
                break-words
                text-[13px]
                font-extrabold
                leading-5
                text-[#262626]

                sm:text-[14px]

                min-[1750px]:text-[15px]
              "
            >
              {item.productName ||
                "Custom Hamper"}
            </p>

            {item.customContainerName && (
              <p
                className="
                  mt-1
                  text-[10px]
                  font-medium
                  text-black/40
                "
              >
                {
                  item.customContainerName
                }
              </p>
            )}

            <div
              className="
                mt-4
                flex
                flex-wrap
                gap-x-4
                gap-y-2
                text-[10px]
                font-semibold
                text-black/45

                sm:text-[11px]
              "
            >
              <span>
                {formatNumber(
                  item.unitsSold
                )}{" "}
                units
              </span>

              <span>
                {formatNumber(
                  item.orderCount
                )}{" "}
                orders
              </span>

              <span>
                {readableItemType(
                  item.itemType
                )}
              </span>
            </div>
          </>
        ) : (
          <p
            className="
              mt-4
              text-[12px]
              text-black/35

              sm:text-[13px]
            "
          >
            No paid sales yet.
          </p>
        )}
      </div>
    </div>

    {/* METRIC STRIP */}

    <div
      className={`
        flex
        min-h-[92px]
        min-w-0
        flex-col
        justify-center
        gap-2
        border-t
        px-5
        py-4

        sm:flex-row
        sm:items-center
        sm:justify-between
        sm:gap-5

        ${
          gold
            ? "border-[#D4AF37]/20 bg-[#FFF9E8]"
            : "border-[#F97316]/15 bg-[#FFF7F2]"
        }
      `}
    >
      <div>
        <p
          className="
            text-[9px]
            font-black
            uppercase
            tracking-[0.1em]
            text-black/30
          "
        >
          {mainLabel}
        </p>

        <p
          className="
            mt-1
            text-[24px]
            font-black
            leading-none
            tracking-[-0.04em]

            sm:text-[26px]
          "
        >
          {mainValue}
        </p>
      </div>

      {item && (
        <div
          className="
            flex
            flex-wrap
            gap-4
            text-[10px]
            font-semibold
            text-black/40

            sm:justify-end
            sm:text-right
          "
        >
          <div>
            <p
              className="
                text-[8px]
                font-black
                uppercase
                tracking-[0.07em]
                text-black/25
              "
            >
              Orders
            </p>

            <p
              className="
                mt-1
                text-[12px]
                font-black
                text-[#252525]
              "
            >
              {formatNumber(
                item.orderCount
              )}
            </p>
          </div>

          <div>
            <p
              className="
                text-[8px]
                font-black
                uppercase
                tracking-[0.07em]
                text-black/25
              "
            >
              Units
            </p>

            <p
              className="
                mt-1
                text-[12px]
                font-black
                text-[#252525]
              "
            >
              {formatNumber(
                item.unitsSold
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  </article>
);

/* =========================================================
   TOP PRODUCTS
========================================================= */

const TopProductsTable = ({
  products,
}) => {
  if (!products.length) {
    return (
      <EmptyData text="No paid product sales yet." />
    );
  }

  return (
    <div
      className="
        max-w-full
        overflow-x-auto
      "
    >
      <table
        className="
          w-full
          min-w-[820px]
          border-collapse
        "
      >
        <thead>
          <tr
            className="
              border-b
              border-black/[0.08]
            "
          >
            <Heading>
              Rank
            </Heading>

            <Heading>
              Hamper
            </Heading>

            <Heading>
              Type
            </Heading>

            <Heading right>
              Orders
            </Heading>

            <Heading right>
              Units
            </Heading>

            <Heading right>
              Avg Price
            </Heading>

            <Heading right>
              Revenue
            </Heading>
          </tr>
        </thead>

        <tbody>
          {products.map(
            (
              item,
              index
            ) => (
              <tr
                key={`${item.product || item.productName}-${index}`}
                className="
                  border-b
                  border-black/[0.055]

                  last:border-b-0
                "
              >
                <Cell>
                  <span
                    className="
                      text-[12px]
                      font-black
                      text-black/25
                    "
                  >
                    {String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )}
                  </span>
                </Cell>

                <Cell>
                  <div
                    className="
                      flex
                      min-w-[220px]
                      items-center
                      gap-3
                    "
                  >
                    {item.image ? (
                      <img
                        src={
                          item.image
                        }
                        alt={
                          item.productName
                        }
                        className="
                          h-11
                          w-11
                          shrink-0
                          object-cover

                          sm:h-12
                          sm:w-12
                        "
                      />
                    ) : (
                      <span
                        className="
                          flex
                          h-11
                          w-11
                          shrink-0
                          items-center
                          justify-center
                          bg-[#FAF9F6]
                          text-[#F97316]

                          sm:h-12
                          sm:w-12
                        "
                      >
                        <BoxIcon />
                      </span>
                    )}

                    <p
                      className="
                        text-[12px]
                        font-extrabold
                        leading-5
                        text-[#282828]

                        sm:text-[13px]
                      "
                    >
                      {item.productName ||
                        "Custom Hamper"}
                    </p>
                  </div>
                </Cell>

                <Cell>
                  {readableItemType(
                    item.itemType
                  )}
                </Cell>

                <Cell right>
                  {formatNumber(
                    item.orderCount
                  )}
                </Cell>

                <Cell right>
                  <span className="font-black">
                    {formatNumber(
                      item.unitsSold
                    )}
                  </span>
                </Cell>

                <Cell right>
                  {formatCurrency(
                    item.averageSellingPrice ||
                      0
                  )}
                </Cell>

                <Cell right>
                  <span
                    className="
                      text-[12px]
                      font-black
                      text-[#F97316]
                    "
                  >
                    {formatCurrency(
                      item.revenue
                    )}
                  </span>
                </Cell>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
};

/* =========================================================
   DEMAND TABLE
========================================================= */

const DemandTable = ({
  products,
}) => {
  if (!products.length) {
    return (
      <EmptyData text="Demand intelligence will appear after product searches and sales." />
    );
  }

  return (
    <div
      className="
        max-w-full
        overflow-x-auto
      "
    >
      <table
        className="
          w-full
          min-w-[900px]
        "
      >
        <thead>
          <tr
            className="
              border-b
              border-black/[0.08]
            "
          >
            <Heading>
              Product
            </Heading>

            <Heading right>
              Demand Index
            </Heading>

            <Heading right>
              Search Clicks
            </Heading>

            <Heading right>
              Units Sold
            </Heading>

            <Heading right>
              Orders
            </Heading>

            <Heading right>
              Revenue
            </Heading>

            <Heading>
              Signal
            </Heading>
          </tr>
        </thead>

        <tbody>
          {products.map(
            (item) => {
              const signal =
                demandSignal(
                  item.signal
                );

              return (
                <tr
                  key={`${item.product || item.productSlug || item.productName}`}
                  className="
                    border-b
                    border-black/[0.055]

                    last:border-b-0
                  "
                >
                  <Cell>
                    <p
                      className="
                        min-w-[180px]
                        text-[12px]
                        font-extrabold
                        leading-5
                        text-[#282828]

                        sm:text-[13px]
                      "
                    >
                      {item.productName ||
                        "Product"}
                    </p>
                  </Cell>

                  <Cell right>
                    <div
                      className="
                        inline-flex
                        min-w-[105px]
                        items-center
                        gap-2
                      "
                    >
                      <div
                        className="
                          h-2
                          flex-1
                          bg-black/[0.06]
                        "
                      >
                        <div
                          style={{
                            width: `${item.demandIndex}%`,
                          }}
                          className="
                            h-full
                            bg-[#F97316]
                          "
                        />
                      </div>

                      <span
                        className="
                          min-w-[28px]
                          text-[12px]
                          font-black
                        "
                      >
                        {
                          item.demandIndex
                        }
                      </span>
                    </div>
                  </Cell>

                  <Cell right>
                    {formatNumber(
                      item.searchClicks
                    )}
                  </Cell>

                  <Cell right>
                    {formatNumber(
                      item.unitsSold
                    )}
                  </Cell>

                  <Cell right>
                    {formatNumber(
                      item.orderCount
                    )}
                  </Cell>

                  <Cell right>
                    {formatCurrency(
                      item.revenue
                    )}
                  </Cell>

                  <Cell>
                    <span
                      className={`
                        inline-flex
                        whitespace-nowrap
                        border
                        px-2.5
                        py-1
                        text-[9px]
                        font-black
                        uppercase

                        ${signal.className}
                      `}
                    >
                      {signal.label}
                    </span>
                  </Cell>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
};

/* =========================================================
   OPPORTUNITY
========================================================= */

const OpportunityList = ({
  products,
}) => {
  if (!products.length) {
    return (
      <EmptyData
        positive
        text="No high-interest / low-sale gap was detected in this period."
      />
    );
  }

  return (
    <AutoGrid
      minWidth={280}
      gap={1}
      className="
        border-l
        border-t
        border-black/[0.08]
        bg-black/[0.08]
      "
    >
      {products.map(
        (item) => {
          const signal =
            demandSignal(
              item.signal
            );

          return (
            <div
              key={
                item.product ||
                item.productSlug
              }
              className="
                min-w-0
                bg-white
                p-4
              "
            >
              <p
                className="
                  break-words
                  text-[13px]
                  font-extrabold
                  leading-5
                "
              >
                {item.productName}
              </p>

              <span
                className={`
                  mt-3
                  inline-flex
                  border
                  px-2.5
                  py-1
                  text-[9px]
                  font-black

                  ${signal.className}
                `}
              >
                {signal.label}
              </span>

              <div
                className="
                  mt-4
                  grid
                  grid-cols-2
                  gap-3
                "
              >
                <StatBox
                  label="Search Clicks"
                  value={formatNumber(
                    item.searchClicks
                  )}
                />

                <StatBox
                  label="Units Sold"
                  value={formatNumber(
                    item.unitsSold
                  )}
                />
              </div>
            </div>
          );
        }
      )}
    </AutoGrid>
  );
};

/* =========================================================
   VARIANTS
========================================================= */

const VariantsList = ({
  variants,
}) => {
  if (!variants.length) {
    return (
      <EmptyData text="No variant sales yet." />
    );
  }

  const max = getMax(
    variants,
    "unitsSold"
  );

  return (
    <AutoGrid
      minWidth={360}
      gap={28}
    >
      {variants.map(
        (
          item,
          index
        ) => (
          <div
            key={
              item.sku ||
              item.skuCode ||
              index
            }
            className="
              min-w-0
              border-b
              border-black/[0.06]
              pb-4
            "
          >
            <div
              className="
                flex
                min-w-0
                items-center
                justify-between
                gap-4
              "
            >
              <div className="min-w-0">
                <p
                  className="
                    truncate
                    text-[13px]
                    font-extrabold
                  "
                >
                  {item.productName}
                </p>

                <p
                  className="
                    mt-1
                    truncate
                    text-[10px]
                    text-black/40
                  "
                >
                  {item.skuName ||
                    "Standard"}
                </p>

                <p
                  className="
                    mt-1
                    text-[10px]
                    text-black/35
                  "
                >
                  {formatCurrency(
                    item.revenue
                  )}{" "}
                  revenue
                </p>
              </div>

              <div
                className="
                  shrink-0
                  text-right
                "
              >
                <p
                  className="
                    text-[16px]
                    font-black
                  "
                >
                  {formatNumber(
                    item.unitsSold
                  )}
                </p>

                <p
                  className="
                    text-[9px]
                    uppercase
                    text-black/30
                  "
                >
                  units
                </p>
              </div>
            </div>

            <div
              className="
                mt-3
                h-2
                bg-black/[0.05]
              "
            >
              <div
                style={{
                  width:
                    percentageWidth(
                      item.unitsSold,
                      max
                    ),
                }}
                className="
                  h-full
                  bg-[#D4AF37]
                "
              />
            </div>
          </div>
        )
      )}
    </AutoGrid>
  );
};

/* =========================================================
   SEARCH LISTS
========================================================= */

const TopSearchList = ({
  rows,
}) => {
  if (!rows.length) {
    return (
      <EmptyData text="No submitted searches yet." />
    );
  }

  const max = getMax(
    rows,
    "count"
  );

  return (
    <div className="space-y-5">
      {rows.map(
        (
          item,
          index
        ) => (
          <BarRow
            key={`${item.query}-${index}`}
            label={
              item.query
            }
            value={
              item.count
            }
            max={max}
            helper={`Avg results: ${
              item.averageVisibleResults ??
              "—"
            }`}
          />
        )
      )}
    </div>
  );
};

const SearchClickedProducts = ({
  rows,
}) => {
  if (!rows.length) {
    return (
      <EmptyData text="Search-result product clicks will appear here." />
    );
  }

  const max = getMax(
    rows,
    "clicks"
  );

  return (
    <div className="space-y-5">
      {rows.map(
        (
          item,
          index
        ) => (
          <BarRow
            key={`${item.productSlug || index}`}
            label={
              item.productName ||
              item.productSlug ||
              "Unknown Product"
            }
            value={
              item.clicks
            }
            max={max}
            gold
            helper="Search suggestion clicks"
          />
        )
      )}
    </div>
  );
};

const ZeroSearchList = ({
  rows,
}) => {
  if (!rows.length) {
    return (
      <EmptyData
        positive
        text="No zero-result searches were detected."
      />
    );
  }

  const max = getMax(
    rows,
    "count"
  );

  return (
    <div className="space-y-5">
      {rows.map(
        (
          item,
          index
        ) => (
          <BarRow
            key={`${item.query}-${index}`}
            label={
              item.query
            }
            value={
              item.count
            }
            max={max}
            danger
            helper="No visible product found"
          />
        )
      )}
    </div>
  );
};

const BarRow = ({
  label,
  value,
  max,
  helper,
  danger = false,
  gold = false,
}) => (
  <div className="min-w-0">
    <div
      className="
        flex
        min-w-0
        items-start
        justify-between
        gap-4
      "
    >
      <div className="min-w-0">
        <p
          className="
            truncate
            text-[12px]
            font-extrabold

            sm:text-[13px]
          "
        >
          {label}
        </p>

        {helper && (
          <p
            className="
              mt-1
              text-[10px]
              text-black/35
            "
          >
            {helper}
          </p>
        )}
      </div>

      <p
        className={`
          shrink-0
          text-[14px]
          font-black

          sm:text-[15px]

          ${
            danger
              ? "text-red-600"
              : gold
                ? "text-[#B89024]"
                : ""
          }
        `}
      >
        {formatNumber(value)}
      </p>
    </div>

    <div
      className="
        mt-3
        h-2
        bg-black/[0.05]
      "
    >
      <div
        style={{
          width:
            percentageWidth(
              value,
              max
            ),
        }}
        className={`
          h-full

          ${
            danger
              ? "bg-red-500"
              : gold
                ? "bg-[#D4AF37]"
                : "bg-[#F97316]"
          }
        `}
      />
    </div>
  </div>
);

/* =========================================================
   LOCATIONS
========================================================= */

const SalesLocationList = ({
  rows,
}) => {
  if (!rows.length) {
    return (
      <EmptyData text="No paid location data yet." />
    );
  }

  const max = getMax(
    rows,
    "revenue"
  );

  return (
    <div className="space-y-5">
      {rows.map(
        (
          item,
          index
        ) => (
          <div
            key={`${item.pincode}-${index}`}
            className="min-w-0"
          >
            <div
              className="
                flex
                min-w-0
                items-start
                justify-between
                gap-4
              "
            >
              <div className="min-w-0">
                <p
                  className="
                    break-words
                    text-[12px]
                    font-extrabold

                    sm:text-[13px]
                  "
                >
                  {item.city ||
                    "Unknown City"}

                  {item.state
                    ? `, ${item.state}`
                    : ""}
                </p>

                <p
                  className="
                    mt-1
                    text-[10px]
                    leading-5
                    text-black/38
                  "
                >
                  {item.pincode ||
                    "No pincode"}{" "}
                  · {item.orders} orders ·{" "}
                  {item.unitsSold} units
                </p>
              </div>

              <p
                className="
                  shrink-0
                  text-[12px]
                  font-black
                  text-[#F97316]

                  sm:text-[13px]
                "
              >
                {formatCurrency(
                  item.revenue
                )}
              </p>
            </div>

            <div
              className="
                mt-3
                h-2
                bg-black/[0.05]
              "
            >
              <div
                style={{
                  width:
                    percentageWidth(
                      item.revenue,
                      max
                    ),
                }}
                className="
                  h-full
                  bg-[#F97316]
                "
              />
            </div>
          </div>
        )
      )}
    </div>
  );
};

const SearchLocationList = ({
  rows,
}) => {
  if (!rows.length) {
    return (
      <EmptyData text="Search-location data will appear after customers select a delivery location." />
    );
  }

  const max = getMax(
    rows,
    "searches"
  );

  return (
    <div className="space-y-5">
      {rows.map(
        (
          item,
          index
        ) => (
          <BarRow
            key={`${item.pincode}-${index}`}
            label={`${item.city || "Unknown"}${
              item.state
                ? `, ${item.state}`
                : ""
            }`}
            value={
              item.searches
            }
            max={max}
            helper={
              item.pincode
                ? `Pincode ${item.pincode}`
                : ""
            }
          />
        )
      )}
    </div>
  );
};

/* =========================================================
   SEARCH SOURCE
========================================================= */

const SearchSourceList = ({
  rows,
}) => {
  if (!rows.length) {
    return (
      <EmptyData text="No search source data yet." />
    );
  }

  const max = getMax(
    rows,
    "searches"
  );

  return (
    <AutoGrid
      minWidth={240}
      gap={16}
    >
      {rows.map(
        (
          item,
          index
        ) => (
          <div
            key={`${item.source}-${index}`}
            className="
              min-w-0
              border
              border-black/[0.07]
              bg-[#FCFBF9]
              p-4
            "
          >
            <div
              className="
                flex
                min-w-0
                items-center
                justify-between
                gap-4
              "
            >
              <div
                className="
                  flex
                  min-w-0
                  items-center
                  gap-3
                "
              >
                <span
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    bg-white
                    text-[#F97316]
                  "
                >
                  {String(
                    item.source
                  ).includes(
                    "mobile"
                  ) ? (
                    <MobileIcon />
                  ) : (
                    <DesktopIcon />
                  )}
                </span>

                <p
                  className="
                    truncate
                    text-[12px]
                    font-extrabold

                    sm:text-[13px]
                  "
                >
                  {readableStatus(
                    item.source
                  )}
                </p>
              </div>

              <p
                className="
                  shrink-0
                  text-[17px]
                  font-black

                  sm:text-[18px]
                "
              >
                {formatNumber(
                  item.searches
                )}
              </p>
            </div>

            <div
              className="
                mt-4
                h-2
                bg-black/[0.05]
              "
            >
              <div
                style={{
                  width:
                    percentageWidth(
                      item.searches,
                      max
                    ),
                }}
                className="
                  h-full
                  bg-[#F97316]
                "
              />
            </div>
          </div>
        )
      )}
    </AutoGrid>
  );
};

/* =========================================================
   ITEM TYPE
========================================================= */

const ItemTypeSplit = ({
  rows,
}) => {
  if (!rows.length) {
    return (
      <EmptyData text="No paid order mix yet." />
    );
  }

  const max = getMax(
    rows,
    "revenue"
  );

  return (
    <div className="space-y-6">
      {rows.map(
        (item) => (
          <div
            key={
              item.itemType
            }
            className="min-w-0"
          >
            <div
              className="
                flex
                min-w-0
                items-start
                justify-between
                gap-4
              "
            >
              <div className="min-w-0">
                <p
                  className="
                    text-[13px]
                    font-extrabold

                    sm:text-[14px]
                  "
                >
                  {readableItemType(
                    item.itemType
                  )}
                </p>

                <p
                  className="
                    mt-1
                    text-[10px]
                    text-black/38
                  "
                >
                  {item.unitsSold} units ·{" "}
                  {item.orderCount} orders
                </p>
              </div>

              <p
                className="
                  shrink-0
                  text-[13px]
                  font-black

                  sm:text-[14px]
                "
              >
                {formatCurrency(
                  item.revenue
                )}
              </p>
            </div>

            <div
              className="
                mt-3
                h-2
                bg-black/[0.05]
              "
            >
              <div
                style={{
                  width:
                    percentageWidth(
                      item.revenue,
                      max
                    ),
                }}
                className="
                  h-full
                  bg-[#D4AF37]
                "
              />
            </div>
          </div>
        )
      )}
    </div>
  );
};

/* =========================================================
   ORDER STATUS
========================================================= */

const OrderStatusList = ({
  rows,
}) => {
  if (!rows.length) {
    return (
      <EmptyData text="No paid orders yet." />
    );
  }

  return (
    <div
      className="
        divide-y
        divide-black/[0.06]
      "
    >
      {rows.map(
        (
          item,
          index
        ) => (
          <div
            key={`${item.status}-${index}`}
            className="
              flex
              min-w-0
              items-center
              justify-between
              gap-5
              py-4

              first:pt-0
              last:pb-0
            "
          >
            <div className="min-w-0">
              <p
                className="
                  text-[12px]
                  font-extrabold

                  sm:text-[13px]
                "
              >
                {readableStatus(
                  item.status
                )}
              </p>

              <p
                className="
                  mt-1
                  text-[10px]
                  text-black/38
                "
              >
                {formatCurrency(
                  item.revenue
                )}{" "}
                revenue
              </p>
            </div>

            <div
              className="
                shrink-0
                text-right
              "
            >
              <p
                className="
                  text-[17px]
                  font-black

                  sm:text-[18px]
                "
              >
                {item.orders}
              </p>

              <p
                className="
                  text-[9px]
                  uppercase
                  text-black/30
                "
              >
                orders
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
};

/* =========================================================
   STAT BOX
========================================================= */

const StatBox = ({
  label,
  value,
}) => (
  <div
    className="
      min-w-0
      border
      border-black/[0.07]
      bg-[#FAF9F6]
      px-3
      py-3
    "
  >
    <p
      className="
        text-[8px]
        font-black
        uppercase
        tracking-[0.07em]
        text-black/30
      "
    >
      {label}
    </p>

    <p
      className="
        mt-1
        break-words
        text-[16px]
        font-black

        sm:text-[17px]
      "
    >
      {value}
    </p>
  </div>
);

/* =========================================================
   TABLE
========================================================= */

const Heading = ({
  children,
  right = false,
}) => (
  <th
    className={`
      whitespace-nowrap
      px-3
      py-3.5
      text-[10px]
      font-black
      uppercase
      tracking-[0.07em]
      text-black/35

      ${
        right
          ? "text-right"
          : "text-left"
      }
    `}
  >
    {children}
  </th>
);

const Cell = ({
  children,
  right = false,
}) => (
  <td
    className={`
      px-3
      py-4
      text-[11px]
      font-medium
      text-black/55

      sm:text-[12px]

      ${
        right
          ? "text-right"
          : "text-left"
      }
    `}
  >
    {children}
  </td>
);

/* =========================================================
   EMPTY
========================================================= */

const EmptyData = ({
  text,
  positive = false,
}) => (
  <div
    className="
      flex
      min-h-[145px]
      items-center
      justify-center
      px-4
      text-center

      sm:min-h-[150px]
      sm:px-5
    "
  >
    <div className="max-w-sm">
      <span
        className={`
          mx-auto
          flex
          h-11
          w-11
          items-center
          justify-center
          border

          ${
            positive
              ? "border-emerald-100 bg-emerald-50 text-emerald-600"
              : "border-black/[0.07] bg-[#FAF9F6] text-black/30"
          }
        `}
      >
        {positive ? (
          <CheckIcon />
        ) : (
          <AnalyticsIcon />
        )}
      </span>

      <p
        className="
          mt-4
          text-[11px]
          font-medium
          leading-5
          text-black/42

          sm:text-[12px]
          sm:leading-6
        "
      >
        {text}
      </p>
    </div>
  </div>
);

/* =========================================================
   SKELETON
========================================================= */

const AnalyticsSkeleton = () => (
  <div
    className="
      w-full
      min-w-0
      animate-pulse
    "
  >
    <div
      className="
        h-3
        w-40
        bg-[#F97316]/15
      "
    />

    <div
      className="
        mt-4
        h-11
        w-[440px]
        max-w-full
        bg-black/[0.06]
      "
    />

    <div
      className="
        mt-4
        h-4
        w-[680px]
        max-w-full
        bg-black/[0.04]
      "
    />

    <AutoGrid
      minWidth={185}
      gap={0}
      className="
        mt-10
        border-l
        border-t
        border-black/[0.06]
      "
    >
      {[1, 2, 3, 4, 5, 6].map(
        (item) => (
          <div
            key={item}
            className="
              h-[170px]
              border-b
              border-r
              border-black/[0.06]
              bg-white
              p-5
            "
          />
        )
      )}
    </AutoGrid>

    <AutoGrid
      minWidth={500}
      gap={20}
      className="mt-7"
    >
      <div
        className="
          h-[340px]
          border
          border-black/[0.06]
          bg-white
        "
      />

      <div
        className="
          h-[340px]
          border
          border-black/[0.06]
          bg-white
        "
      />
    </AutoGrid>
  </div>
);

/* =========================================================
   ICON BASE
========================================================= */

const Icon = ({
  children,
  large = false,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={
      large
        ? "h-8 w-8"
        : "h-[18px] w-[18px]"
    }
  >
    {children}
  </svg>
);

/* =========================================================
   ICONS
========================================================= */

const RevenueIcon = () => (
  <Icon>
    <path d="M7 5h10M7 9h10M8 5c4 0 6 2 6 5s-2 5-6 5h-1l8 5" />
  </Icon>
);

const OrderIcon = () => (
  <Icon>
    <path d="M5 7h14l-1 13H6L5 7Z" />
    <path d="M9 9V5a3 3 0 0 1 6 0v4" />
  </Icon>
);

const BoxIcon = ({
  large = false,
}) => (
  <Icon large={large}>
    <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
    <path d="m4 8.5 8 4.5 8-4.5M12 13v7" />
  </Icon>
);

const AverageIcon = () => (
  <Icon>
    <path d="M4 18V9M10 18V5M16 18v-6M22 18V3" />
  </Icon>
);

const SearchIcon = () => (
  <Icon>
    <circle
      cx="10"
      cy="10"
      r="5"
    />

    <path d="m14 14 6 6" />
  </Icon>
);

const CustomerIcon = () => (
  <Icon>
    <circle
      cx="9"
      cy="8"
      r="3"
    />

    <circle
      cx="17"
      cy="9"
      r="2"
    />

    <path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M15 15c3-.4 5 1.2 6 4.5" />
  </Icon>
);

const VariantIcon = () => (
  <Icon>
    <rect
      x="4"
      y="4"
      width="6"
      height="6"
    />

    <rect
      x="14"
      y="4"
      width="6"
      height="6"
    />

    <rect
      x="4"
      y="14"
      width="6"
      height="6"
    />
  </Icon>
);

const DemandIcon = () => (
  <Icon>
    <path d="M4 19V9M10 19V5M16 19v-7M21 19V3" />
  </Icon>
);

const OpportunityIcon = () => (
  <Icon>
    <path d="M12 3 3 20h18L12 3Z" />
    <path d="M12 9v5M12 17h.01" />
  </Icon>
);

const ClickIcon = () => (
  <Icon>
    <path d="m5 3 12 9-6 1 3 6-2.5 1.3-3-6L5 19V3Z" />
  </Icon>
);

const DeviceIcon = () => (
  <Icon>
    <rect
      x="3"
      y="4"
      width="14"
      height="11"
    />

    <path d="M7 20h6M10 15v5" />

    <rect
      x="18"
      y="8"
      width="3"
      height="9"
    />
  </Icon>
);

const LocationIcon = () => (
  <Icon>
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

    <circle
      cx="12"
      cy="10"
      r="2.5"
    />
  </Icon>
);

const SearchLocationIcon = () => (
  <Icon>
    <circle
      cx="9"
      cy="9"
      r="4"
    />

    <path d="m12 12 3 3" />

    <path d="M20 15c0 3-4 6-4 6s-4-3-4-6a4 4 0 1 1 8 0Z" />
  </Icon>
);

const MixIcon = () => (
  <Icon>
    <path d="M4 6h6v6H4zM14 6h6v6h-6zM4 16h6v4H4zM14 16h6v4h-6z" />
  </Icon>
);

const CalendarIcon = () => (
  <Icon>
    <rect
      x="3"
      y="5"
      width="18"
      height="16"
      rx="1"
    />

    <path d="M7 3v4M17 3v4M3 10h18" />
  </Icon>
);

const MobileIcon = () => (
  <Icon>
    <rect
      x="7"
      y="2"
      width="10"
      height="20"
      rx="2"
    />

    <path d="M11 18h2" />
  </Icon>
);

const DesktopIcon = () => (
  <Icon>
    <rect
      x="3"
      y="4"
      width="18"
      height="13"
      rx="1"
    />

    <path d="M8 21h8M12 17v4" />
  </Icon>
);

const AnalyticsIcon = () => (
  <Icon>
    <path d="M5 19V10M10 19V5M15 19v-7M20 19V3" />
  </Icon>
);

const CheckIcon = () => (
  <Icon>
    <circle
      cx="12"
      cy="12"
      r="9"
    />

    <path d="m8 12 2.5 2.5L16 9" />
  </Icon>
);

const RefreshIcon = ({
  spinning,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`
      h-4
      w-4

      ${
        spinning
          ? "animate-spin"
          : ""
      }
    `}
  >
    <path d="M20 6v5h-5" />
    <path d="M4 18v-5h5" />
    <path d="M6.2 8A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 11.8-2" />
  </svg>
);

export default SearchAnalytics;