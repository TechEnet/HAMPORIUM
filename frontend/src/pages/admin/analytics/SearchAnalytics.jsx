import {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../../api/api.js";
import formatCurrency from "../../../utils/formatCurrency.js";

const RANGE_OPTIONS = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
  { label: "180 Days", value: 180 },
];

const LIMIT_OPTIONS = [5, 10, 20];

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const formatPercent = (value) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0%";
  }

  return `${number.toLocaleString("en-IN", {
    maximumFractionDigits: 1,
  })}%`;
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatShortDate = (value) => {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(date);
};

const getMax = (rows, key) =>
  Math.max(
    1,
    ...(rows || []).map((item) =>
      Number(item?.[key] || 0)
    )
  );

const getWidth = (value, max) => {
  const number = Number(value || 0);
  const maximum = Number(max || 1);

  if (number <= 0) return "0%";

  return `${Math.max(
    3,
    Math.min(100, (number / maximum) * 100)
  )}%`;
};

const readableStatus = (value) =>
  String(value || "Unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );

const readableItemType = (value) =>
  value === "custom_hamper"
    ? "Custom Hamper"
    : "Ready-made Hamper";

const SearchAnalytics = () => {
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(10);

  const [analytics, setAnalytics] =
    useState(null);

  const [
    conversionAnalytics,
    setConversionAnalytics,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [refreshKey, setRefreshKey] =
    useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
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

        if (!active) return;

        setAnalytics(
          searchResponse.data?.analytics ||
            null
        );

        setConversionAnalytics(
          conversionResponse.data
            ?.analytics || null
        );
      } catch (requestError) {
        if (!active) return;

        setError(
          requestError.response?.data
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

    load();

    return () => {
      active = false;
    };
  }, [
    days,
    limit,
    refreshKey,
  ]);

  const search =
    analytics?.search || {
      totals:
        analytics?.totals || {},
      topSearches:
        analytics?.topSearches || [],
      zeroResultSearches:
        analytics?.zeroResultSearches ||
        [],
      topClickedProducts:
        analytics
          ?.topClickedProducts || [],
      topLocations:
        analytics?.topLocations || [],
      searchesBySource:
        analytics
          ?.searchesBySource || [],
    };

  const commerce =
    analytics?.commerce || {};

  const commerceTotals =
    commerce.totals || {};

  const topProducts =
    commerce.topProducts || [];

  const topVariants =
    commerce.topVariants || [];

  const salesTrend =
    commerce.salesTrend || [];

  const salesLocations =
    commerce.salesByLocation || [];

  const orderStatuses =
    commerce.orderStatusBreakdown || [];

  const itemTypeSplit =
    commerce.itemTypeSplit || [];

  const topSearches =
    search.topSearches || [];

  const zeroSearches =
    search.zeroResultSearches || [];

  const topClickedProducts =
    search.topClickedProducts || [];

  const searchLocations =
    search.topLocations || [];

  const opportunityProducts =
    analytics?.demand
      ?.highInterestLowSales || [];

  const funnel =
    conversionAnalytics?.funnel || {};

  const searchAttribution =
    conversionAnalytics
      ?.searchAttribution || {};

  const topConvertingSearches =
    searchAttribution
      .topConvertingSearches || [];

  const productConversion =
    conversionAnalytics?.products
      ?.topProducts || [];

  const bestByRevenue =
    commerce.bestSellers?.byRevenue ||
    topProducts[0] ||
    null;

  const bestByUnits =
    commerce.bestSellers?.byUnits ||
    [...topProducts].sort(
      (a, b) =>
        Number(b.unitsSold || 0) -
        Number(a.unitsSold || 0)
    )[0] ||
    null;

  const totalSearches = Number(
    search.totals?.searchSubmits || 0
  );

  const zeroSearchCount = useMemo(
    () =>
      zeroSearches.reduce(
        (sum, item) =>
          sum +
          Number(item.count || 0),
        0
      ),
    [zeroSearches]
  );

  if (loading && !analytics) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] pb-16 text-[#181715]">
      <header className="border-b border-black/[0.10] pb-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#A47718]">
              Business Overview
            </p>

            <h1 className="mt-2 font-serif text-[42px] font-semibold leading-none tracking-[-0.035em] sm:text-[50px]">
              Analytics
            </h1>

            <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-black/58">
              Sales, products and customer demand in one clear view.
            </p>

            {analytics?.period && (
              <p className="mt-3 text-[12px] font-semibold text-black/45">
                {formatDate(
                  analytics.period.from
                )}{" "}
                —{" "}
                {formatDate(
                  analytics.period.to
                )}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={days}
              onChange={(event) =>
                setDays(
                  Number(
                    event.target.value
                  )
                )
              }
              className={selectClass}
            >
              {RANGE_OPTIONS.map(
                (item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>

            <select
              value={limit}
              onChange={(event) =>
                setLimit(
                  Number(
                    event.target.value
                  )
                )
              }
              className={selectClass}
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
              disabled={refreshing}
              onClick={() =>
                setRefreshKey(
                  (current) =>
                    current + 1
                )
              }
              className="h-11 bg-[#171717] px-5 text-[12px] font-extrabold text-white transition hover:bg-[#F47822] disabled:opacity-40"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mt-5 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
          {error}
        </div>
      )}

      <section className="mt-1 grid border-b border-black/[0.10] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric
          label="Sales"
          value={formatCurrency(
            commerceTotals.revenue || 0
          )}
          helper="Paid revenue"
        />

        <Metric
          label="Orders"
          value={formatNumber(
            commerceTotals.paidOrders
          )}
          helper="Paid orders"
        />

        <Metric
          label="Hampers Sold"
          value={formatNumber(
            commerceTotals.unitsSold
          )}
          helper="Total units"
        />

        <Metric
          label="Avg Order"
          value={formatCurrency(
            commerceTotals.averageOrderValue ||
              0
          )}
          helper="Per order"
        />

        <Metric
          label="Search Click Rate"
          value={formatPercent(
            search.totals
              ?.clickThroughRate
          )}
          helper="Search → product"
        />

        <Metric
          label="Repeat Buyers"
          value={formatPercent(
            commerceTotals.repeatCustomerRate
          )}
          helper={`${formatNumber(
            commerceTotals.repeatCustomers
          )} customers`}
        />
      </section>

      <Section
        title="Sales"
        hint="Revenue and order performance for the selected period."
      >
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
          <SimpleTrend
            rows={salesTrend}
          />

          <OrderStatusList
            rows={orderStatuses}
          />
        </div>
      </Section>

      <Section
        title="What is selling"
        hint="Identify the hampers and variants driving the strongest sales."
      >
        <div className="grid gap-8 xl:grid-cols-2">
          <Winner
            label="Top Revenue"
            item={bestByRevenue}
            value={
              bestByRevenue
                ? formatCurrency(
                    bestByRevenue.revenue
                  )
                : "—"
            }
          />

          <Winner
            label="Most Sold"
            item={bestByUnits}
            value={
              bestByUnits
                ? `${formatNumber(
                    bestByUnits.unitsSold
                  )} units`
                : "—"
            }
          />
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <TopProducts
            rows={topProducts}
          />

          <TopVariants
            rows={topVariants}
          />
        </div>
      </Section>

      <Section
        title="Customer demand"
        hint="See what customers are searching for and where demand is being missed."
      >
        <div className="grid gap-8 xl:grid-cols-3">
          <SimpleListPanel
            title="Top Searches"
            rows={topSearches}
            empty="No search activity is available yet."
            renderRow={(item) => ({
              title:
                item.query ||
                "Search",
              value:
                formatNumber(
                  item.count
                ),
              helper: "searches",
            })}
          />

          <SimpleListPanel
            title="Most Clicked"
            rows={topClickedProducts}
            empty="No product click data is available yet."
            renderRow={(item) => ({
              title:
                item.productName ||
                item.productSlug ||
                "Product",
              value:
                formatNumber(
                  item.clicks
                ),
              helper: "clicks",
            })}
          />

          <SimpleListPanel
            title="No Result Searches"
            rows={zeroSearches}
            empty="Great — no missed searches."
            warning
            renderRow={(item) => ({
              title:
                item.query ||
                "Search",
              value:
                formatNumber(
                  item.count
                ),
              helper: "no results",
            })}
          />
        </div>

        {!!opportunityProducts.length && (
          <div className="mt-8 border-t border-black/[0.08] pt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-[20px] font-extrabold">
                  High interest, low sales
                </h3>

                <p className="mt-1 text-[13px] text-black/45">
                  These products are attracting interest but converting below expectations.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-x-8 gap-y-0 md:grid-cols-2 xl:grid-cols-3">
              {opportunityProducts
                .slice(0, 6)
                .map((item) => (
                  <div
                    key={
                      item.product ||
                      item.productSlug ||
                      item.productName
                    }
                    className="border-b border-black/[0.08] py-4"
                  >
                    <p className="text-[14px] font-extrabold">
                      {item.productName ||
                        "Product"}
                    </p>

                    <p className="mt-1 text-[12px] font-medium text-black/48">
                      {formatNumber(
                        item.searchClicks
                      )}{" "}
                      search clicks ·{" "}
                      {formatNumber(
                        item.unitsSold
                      )}{" "}
                      sold
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Conversion"
        hint="Track how customers move from product discovery to completed payment."
      >
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <ConversionSteps
            funnel={funnel}
            paidOrders={
              commerceTotals.paidOrders
            }
          />

          <div className="border-t border-black/[0.08] pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
            <h3 className="text-[18px] font-extrabold">
              Quick rates
            </h3>

            <div className="mt-4 divide-y divide-black/[0.09]">
              <RateRow
                label="View → Cart"
                value={formatPercent(
                  funnel.viewToCartRate
                )}
              />

              <RateRow
                label="Checkout → Paid"
                value={formatPercent(
                  funnel.checkoutToPaidOrderRate
                )}
              />

              <RateRow
                label="Search → Paid"
                value={formatPercent(
                  funnel.searchToPaidOrderRate
                )}
              />
            </div>

            <p className="mt-5 text-[13px] font-medium leading-6 text-black/50">
              <strong className="text-black/75">
                {formatNumber(
                  searchAttribution.attributedPaidOrders
                )}
              </strong>{" "}
              paid orders were attributed to search activity.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-2">
          <SimpleListPanel
            title="Searches That Converted"
            rows={topConvertingSearches}
            empty="No search-attributed sales are available yet."
            renderRow={(item) => ({
              title:
                item.query ||
                item.normalizedQuery ||
                "Search",
              value:
                formatCurrency(
                  item.revenue || 0
                ),
              helper: `${formatNumber(
                item.orderCount
              )} orders`,
            })}
          />

          <SimpleListPanel
            title="Product Conversion"
            rows={productConversion}
            empty="Product conversion data is not available yet."
            renderRow={(item) => ({
              title:
                item.productName ||
                item.productSlug ||
                "Product",
              value:
                formatPercent(
                  item.viewToCartRate
                ),
              helper: `${formatNumber(
                item.views
              )} views · ${formatNumber(
                item.unitsSold
              )} sold`,
            })}
          />
        </div>
      </Section>

      <Section
        title="Where customers come from"
        hint="Understand where purchases and search activity are coming from."
      >
        <div className="grid gap-8 xl:grid-cols-2">
          <LocationList
            title="Top Buying Locations"
            rows={salesLocations}
            type="sales"
          />

          <LocationList
            title="Top Search Locations"
            rows={searchLocations}
            type="search"
          />
        </div>
      </Section>

      <Section
        title="Business mix"
        hint="Compare the contribution of ready-made and custom hampers."
        last
      >
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <MixList
            rows={itemTypeSplit}
          />

          <div className="grid grid-cols-2 border-l border-t border-black/[0.10] bg-white">
            <SmallMetric
              label="Customers"
              value={formatNumber(
                commerceTotals.uniqueCustomers
              )}
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
            />

            <SmallMetric
              label="Discount"
              value={formatCurrency(
                commerceTotals.discountAmount ||
                  0
              )}
            />

            <SmallMetric
              label="Revenue / Customer"
              value={formatCurrency(
                commerceTotals.revenuePerCustomer ||
                  0
              )}
            />
          </div>
        </div>

        <div className="mt-6 border-t border-black/[0.07] pt-4 text-[13px] text-black/45">
          {totalSearches > 0
            ? `${formatNumber(
                totalSearches
              )} searches were submitted, with ${formatNumber(
                zeroSearchCount
              )} returning no visible results.`
            : "Search activity is not available yet."}
        </div>
      </Section>
    </div>
  );
};

const selectClass =
  "h-11 min-w-[120px] border border-black/[0.1] bg-white px-3 text-[12px] font-bold outline-none focus:border-[#F47822]";

const Section = ({
  title,
  hint,
  children,
  last = false,
}) => (
  <section
    className={`border-b border-black/[0.09] py-10 ${
      last ? "border-b-0 pb-4" : ""
    }`}
  >
    <div className="mb-6">
      <h2 className="font-serif text-[31px] font-semibold leading-tight tracking-[-0.025em] sm:text-[35px]">
        {title}
      </h2>

      <p className="mt-2 max-w-3xl text-[14px] font-medium leading-6 text-black/52">
        {hint}
      </p>
    </div>

    {children}
  </section>
);

const Metric = ({
  label,
  value,
  helper,
}) => (
  <div className="min-w-0 border-b border-r border-black/[0.09] px-5 py-5 xl:border-b-0 xl:first:pl-0 xl:last:border-r-0">
    <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-black/45">
      {label}
    </p>

    <p className="mt-2 break-words text-[26px] font-black tracking-[-0.035em] text-[#181715]">
      {value}
    </p>

    <p className="mt-1 text-[11px] font-semibold text-black/42">
      {helper}
    </p>
  </div>
);

const SimpleTrend = ({ rows }) => {
  if (!rows.length) {
    return (
      <EmptyState text="Sales trend will appear once paid orders are recorded." />
    );
  }

  const max = getMax(rows, "revenue");

  return (
    <div className="min-w-0 overflow-x-auto pb-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-[18px] font-extrabold">
            Revenue Trend
          </h3>

          <p className="mt-1 text-[12px] font-medium text-black/48">
            Daily paid revenue for the selected period.
          </p>
        </div>
      </div>

      <div className="mt-6 flex h-[230px] min-w-[700px] items-end gap-2 border-b border-black/[0.10] pb-0">
        {rows.map((row) => {
          const height =
            getWidth(
              row.revenue,
              max
            );

          return (
            <div
              key={row.date}
              className="flex min-w-[28px] flex-1 flex-col items-center justify-end"
            >
              <div className="flex h-[170px] w-full items-end justify-center">
                <div
                  title={`${formatShortDate(
                    row.date
                  )} · ${formatCurrency(
                    row.revenue || 0
                  )}`}
                  style={{
                    height,
                  }}
                  className="w-[58%] min-w-[12px] bg-[#F47822] transition-all"
                />
              </div>

              <p className="mt-2 text-[9px] font-semibold text-black/35">
                {formatShortDate(
                  row.date
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const OrderStatusList = ({
  rows,
}) => (
  <div>
    <h3 className="text-[18px] font-extrabold">
      Order Status
    </h3>

    <p className="mt-1 text-[12px] font-medium text-black/48">
      Current stage of successfully paid orders.
    </p>

    {!rows.length ? (
      <EmptyState text="No paid order status data is available yet." />
    ) : (
      <div className="mt-4 divide-y divide-black/[0.09]">
        {rows.map(
          (item, index) => (
            <div
              key={`${item.status}-${index}`}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div>
                <p className="text-[14px] font-bold">
                  {readableStatus(
                    item.status
                  )}
                </p>

                <p className="mt-1 text-[11px] font-medium text-black/42">
                  {formatCurrency(
                    item.revenue || 0
                  )}
                </p>
              </div>

              <p className="text-[21px] font-black">
                {formatNumber(
                  item.orders
                )}
              </p>
            </div>
          )
        )}
      </div>
    )}
  </div>
);

const Winner = ({
  label,
  item,
  value,
}) => (
  <div className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] border-y border-black/[0.10] bg-white">
    <div className="flex items-center justify-center bg-[#F7F3EA] p-3">
      {item?.image ? (
        <img
          src={item.image}
          alt={
            item.productName ||
            "Hamper"
          }
          className="h-[86px] w-[86px] object-cover"
        />
      ) : (
        <BoxIcon />
      )}
    </div>

    <div className="min-w-0 px-5 py-5">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#A47718]">
        {label}
      </p>

      <p className="mt-2 truncate text-[16px] font-extrabold">
        {item?.productName ||
          "No sales yet"}
      </p>

      <p className="mt-3 text-[24px] font-black tracking-[-0.03em]">
        {value}
      </p>

      {item && (
        <p className="mt-1 text-[11px] font-medium text-black/42">
          {formatNumber(
            item.orderCount
          )}{" "}
          orders ·{" "}
          {formatNumber(
            item.unitsSold
          )}{" "}
          units
        </p>
      )}
    </div>
  </div>
);

const TopProducts = ({ rows }) => {
  if (!rows.length) {
    return (
      <EmptyState text="No product sales are available yet." />
    );
  }

  return (
    <div>
      <h3 className="text-[18px] font-extrabold">
        Top Hampers
      </h3>

      <div className="mt-4 divide-y divide-black/[0.09]">
        {rows.map(
          (item, index) => (
            <div
              key={`${item.product || item.productName}-${index}`}
              className="grid grid-cols-[34px_56px_minmax(0,1fr)_minmax(90px,auto)] items-center gap-4 py-4"
            >
              <span className="text-[12px] font-black text-black/25">
                {String(
                  index + 1
                ).padStart(2, "0")}
              </span>

              {item.image ? (
                <img
                  src={item.image}
                  alt={
                    item.productName ||
                    "Hamper"
                  }
                  className="h-[50px] w-[50px] object-cover"
                />
              ) : (
                <div className="flex h-[50px] w-[50px] items-center justify-center bg-[#F7F3EA] text-[#F47822]">
                  <BoxIcon />
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-[14px] font-extrabold">
                  {item.productName ||
                    "Custom Hamper"}
                </p>

                <p className="mt-1 text-[11px] font-medium text-black/42">
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

              <p className="text-right text-[14px] font-black text-[#F47822]">
                {formatCurrency(
                  item.revenue || 0
                )}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

const TopVariants = ({ rows }) => {
  if (!rows.length) {
    return (
      <EmptyState text="No variant sales are available yet." />
    );
  }

  return (
    <div>
      <h3 className="text-[18px] font-extrabold">
        Top Variants
      </h3>

      <div className="mt-4 divide-y divide-black/[0.09]">
        {rows.map(
          (item, index) => (
            <div
              key={
                item.sku ||
                item.skuCode ||
                index
              }
              className="flex items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-extrabold text-[#222]">
                  {item.productName ||
                    "Product"}
                </p>

                <p className="mt-1 truncate text-[11px] text-black/35">
                  {item.skuName ||
                    item.skuCode ||
                    "Standard"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[18px] font-black">
                  {formatNumber(
                    item.unitsSold
                  )}
                </p>

                <p className="text-[10px] text-black/35">
                  units
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

const SimpleListPanel = ({
  title,
  rows,
  empty,
  renderRow,
  warning = false,
}) => (
  <div className="min-w-0">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-[18px] font-extrabold">
        {title}
      </h3>

      {warning && (
        <span className="h-2 w-2 rounded-full bg-red-500" />
      )}
    </div>

    {!rows.length ? (
      <EmptyState
        text={empty}
        compact
      />
    ) : (
      <div className="mt-4 divide-y divide-black/[0.09]">
        {rows.slice(0, 8).map(
          (item, index) => {
            const row =
              renderRow(item);

            return (
              <div
                key={`${row.title}-${index}`}
                className="flex items-start justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-extrabold text-[#222]">
                    {row.title}
                  </p>

                  {row.helper && (
                    <p className="mt-1 text-[11px] font-medium text-black/42">
                      {row.helper}
                    </p>
                  )}
                </div>

                <p
                  className={`shrink-0 text-[15px] font-black ${
                    warning
                      ? "text-red-600"
                      : "text-[#171717]"
                  }`}
                >
                  {row.value}
                </p>
              </div>
            );
          }
        )}
      </div>
    )}
  </div>
);

const ConversionSteps = ({
  funnel,
  paidOrders,
}) => {
  const steps = [
    {
      label: "Product Views",
      value:
        funnel.productViews || 0,
    },
    {
      label: "Added to Cart",
      value:
        funnel.addToCarts || 0,
    },
    {
      label: "Checkout Started",
      value:
        funnel.checkoutStarts || 0,
    },
    {
      label: "Paid Orders",
      value:
        paidOrders || 0,
    },
  ];

  const max = Math.max(
    1,
    ...steps.map((item) =>
      Number(item.value || 0)
    )
  );

  return (
    <div>
      <h3 className="text-[18px] font-extrabold">
        Customer Journey
      </h3>

      <div className="mt-5 space-y-5">
        {steps.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="text-[13px] font-bold">
                {item.label}
              </p>

              <p className="text-[18px] font-black">
                {formatNumber(
                  item.value
                )}
              </p>
            </div>

            <div className="h-3 bg-black/[0.05]">
              <div
                style={{
                  width: getWidth(
                    item.value,
                    max
                  ),
                }}
                className="h-full bg-[#F47822]"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RateRow = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between gap-4 py-4">
    <p className="text-[13px] font-semibold text-black/55">
      {label}
    </p>

    <p className="text-[18px] font-black">
      {value}
    </p>
  </div>
);

const LocationList = ({
  title,
  rows,
  type,
}) => (
  <div>
    <h3 className="text-[18px] font-extrabold">
      {title}
    </h3>

    {!rows.length ? (
      <EmptyState text="Location data is not available yet." />
    ) : (
      <div className="mt-4 divide-y divide-black/[0.09]">
        {rows.slice(0, 8).map(
          (item, index) => (
            <div
              key={`${item.pincode || item.city}-${index}`}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-extrabold text-[#222]">
                  {item.city ||
                    "Unknown"}
                  {item.state
                    ? `, ${item.state}`
                    : ""}
                </p>

                <p className="mt-1 text-[11px] font-medium text-black/42">
                  {item.pincode
                    ? `Pincode ${item.pincode}`
                    : "Location"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[15px] font-black">
                  {type === "sales"
                    ? formatCurrency(
                        item.revenue || 0
                      )
                    : formatNumber(
                        item.searches
                      )}
                </p>

                <p className="mt-1 text-[11px] font-medium text-black/42">
                  {type === "sales"
                    ? `${formatNumber(
                        item.orders
                      )} orders`
                    : "searches"}
                </p>
              </div>
            </div>
          )
        )}
      </div>
    )}
  </div>
);

const MixList = ({ rows }) => {
  if (!rows.length) {
    return (
      <EmptyState text="Sales mix data is not available yet." />
    );
  }

  const max = getMax(rows, "revenue");

  return (
    <div>
      <h3 className="text-[18px] font-extrabold">
        Hamper Mix
      </h3>

      <div className="mt-5 space-y-6">
        {rows.map((item) => (
          <div key={item.itemType}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px] font-extrabold">
                  {readableItemType(
                    item.itemType
                  )}
                </p>

                <p className="mt-1 text-[11px] font-medium text-black/42">
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

              <p className="text-[15px] font-black">
                {formatCurrency(
                  item.revenue || 0
                )}
              </p>
            </div>

            <div className="mt-3 h-2 bg-black/[0.05]">
              <div
                style={{
                  width: getWidth(
                    item.revenue,
                    max
                  ),
                }}
                className="h-full bg-[#D4AF37]"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SmallMetric = ({
  label,
  value,
}) => (
  <div className="min-w-0 border-b border-r border-black/[0.10] bg-white px-5 py-5">
    <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-black/35">
      {label}
    </p>

    <p className="mt-2 break-words text-[20px] font-black">
      {value}
    </p>
  </div>
);

const EmptyState = ({
  text,
  compact = false,
}) => (
  <div
    className={`flex items-center justify-center text-center text-[13px] font-medium leading-6 text-black/45 ${
      compact
        ? "min-h-[120px]"
        : "min-h-[150px]"
    }`}
  >
    {text}
  </div>
);

const AnalyticsSkeleton = () => (
  <div className="mx-auto w-full max-w-[1500px] animate-pulse">
    <div className="h-4 w-32 bg-black/[0.06]" />
    <div className="mt-4 h-12 w-[320px] max-w-full bg-black/[0.06]" />
    <div className="mt-3 h-4 w-[460px] max-w-full bg-black/[0.04]" />

    <div className="mt-8 grid sm:grid-cols-2 xl:grid-cols-6">
      {[1, 2, 3, 4, 5, 6].map(
        (item) => (
          <div
            key={item}
            className="h-[120px] border border-black/[0.06] bg-white"
          />
        )
      )}
    </div>

    <div className="mt-10 h-[320px] border border-black/[0.06] bg-white" />
  </div>
);

const BoxIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-7 w-7"
  >
    <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
    <path d="m4 8.5 8 4.5 8-4.5M12 13v7" />
  </svg>
);

export default SearchAnalytics;
