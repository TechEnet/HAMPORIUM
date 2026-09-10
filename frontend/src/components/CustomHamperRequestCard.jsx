import formatCurrency from "../utils/formatCurrency.js";

const assetLabel = (value) =>
  String(value || "Artwork")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const CustomHamperRequestCard = ({
  request,
  quantity = 1,
  compact = false,
  title = "Requested Custom Hamper",
}) => {
  if (!request) return null;

  const items = request.items || request.components || [];
  const decorations = request.decorations || [];
  const personalization = request.personalization;
  const pricing = request.indicativePricing || {
    containerPrice: request.containerPrice,
    itemsTotal: request.itemsTotal,
    decorationsTotal: request.decorationsTotal,
    total: request.hamperUnitPrice,
    currency: "INR",
  };
  const totalQuantity = Number(quantity || 1);
  const indicativeRequestValue =
    pricing.total === null || pricing.total === undefined
      ? null
      : Number(pricing.total || 0) * totalQuantity;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
            {request.containerImage ? (
              <img
                src={request.containerImage}
                alt={request.containerName || "Custom hamper"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl">🎁</span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#F26522]">
              {title}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {request.containerName || "Custom Hamper"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {request.containerCode || "Custom box"}
              {request.channel ? ` · ${assetLabel(request.channel)}` : ""}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 sm:text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Bulk Qty
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {totalQuantity.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className={`grid gap-5 p-5 ${compact ? "" : "lg:grid-cols-2"}`}>
        <SnapshotGroup title="Inside the hamper" items={items} />
        <SnapshotGroup
          title="Decorations & finishing"
          items={decorations}
          empty="No decorative materials selected."
        />
      </div>

      {personalization?.enabled && (
        <div className="border-t border-slate-100 p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Personalisation & artwork
            </h3>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-[#F26522]">
              {(personalization.assets || []).length} file
              {(personalization.assets || []).length === 1 ? "" : "s"}
            </span>
          </div>

          {(personalization.assets || []).length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {personalization.assets.map((asset, index) => (
                <a
                  key={`${asset.url}-${index}`}
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-[#F26522]"
                >
                  <div className="aspect-[4/3] bg-white">
                    <img
                      src={asset.url}
                      alt={asset.fileName || assetLabel(asset.type)}
                      className="h-full w-full object-contain p-2"
                    />
                  </div>
                  <div className="border-t border-slate-200 p-3">
                    <p className="truncate text-xs font-semibold text-slate-900">
                      {assetLabel(asset.type)}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {assetLabel(asset.placement)}
                    </p>
                    {asset.notes && (
                      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">
                        {asset.notes}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}

          {(personalization.message || personalization.instructions) && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {personalization.message && (
                <TextBox label="Message" value={personalization.message} />
              )}
              {personalization.instructions && (
                <TextBox
                  label="Production instructions"
                  value={personalization.instructions}
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Indicative box"
          value={moneyOrDash(pricing.containerPrice)}
        />
        <Metric
          label="Indicative gifts"
          value={moneyOrDash(pricing.itemsTotal)}
        />
        <Metric
          label="Indicative finishing"
          value={moneyOrDash(pricing.decorationsTotal)}
        />
        <Metric
          label="Indicative request value"
          value={
            indicativeRequestValue === null
              ? "—"
              : formatCurrency(indicativeRequestValue)
          }
          strong
        />
      </div>

      <div className="border-t border-slate-100 px-5 py-3 text-xs leading-5 text-slate-500">
        Builder pricing is an indicative reference only for a bulk request.
        The accepted quotation is the commercial amount used for payment and
        the final order.
      </div>
    </section>
  );
};

const SnapshotGroup = ({
  title,
  items = [],
  empty = "No content items recorded.",
}) => (
  <div>
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    {items.length === 0 ? (
      <p className="mt-3 text-sm text-slate-500">{empty}</p>
    ) : (
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <SnapshotLine
            key={`${item.component || item.code || item.name}-${index}`}
            image={item.image}
            name={item.name}
            code={item.code}
            quantity={item.quantity}
            price={item.indicativeLineTotal ?? item.lineTotal}
          />
        ))}
      </div>
    )}
  </div>
);

const SnapshotLine = ({ image, name, code, quantity, price }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
      {image ? (
        <img
          src={image}
          alt={name || "Hamper item"}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span className="text-base">✦</span>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-slate-900">
        {name || "Hamper item"}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate-500">
        {code || "—"} · Qty {Number(quantity || 1)}
      </p>
    </div>
    {price !== null && price !== undefined && (
      <span className="shrink-0 text-xs font-semibold text-slate-700">
        {formatCurrency(price)}
      </span>
    )}
  </div>
);

const TextBox = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
      {value}
    </p>
  </div>
);

const Metric = ({ label, value, strong = false }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p
      className={`mt-1 ${
        strong
          ? "text-lg font-bold text-[#F26522]"
          : "font-semibold text-slate-900"
      }`}
    >
      {value}
    </p>
  </div>
);

const moneyOrDash = (value) =>
  value === null || value === undefined
    ? "—"
    : formatCurrency(Number(value || 0));

export default CustomHamperRequestCard;
