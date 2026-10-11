// backend/src/modules/catalog/catalogReadiness.service.js
// Read-only storefront eligibility: missing information is never invented.
// Admin retains all records; these predicates only decide public visibility.

export const hasWebsiteImage = (images) =>
  Array.isArray(images) && images.some((image) => {
    const url = String(typeof image === "string" ? image : image?.url || "").trim();
    if (!/^https?:\/\//i.test(url)) return false;
    try {
      const parsed = new URL(url);
      return !["drive.google.com", "docs.google.com"].includes(parsed.hostname.toLowerCase());
    } catch {
      return false;
    }
  });

const positive = (value) => value !== null && value !== undefined && value !== "" &&
  Number.isFinite(Number(value)) && Number(value) > 0;

const hasDimensions = (d) => positive(d?.length) && positive(d?.width) && positive(d?.height);

export function componentArchiveReasons(component) {
  const reasons = [];
  const decoration = component?.hamperRole === "decoration";
  if (component?.isActive === false) reasons.push("Inactive in Excel/Admin");
  if (component?.type === "packaging") reasons.push("Internal packaging item — not a storefront gift");
  if (!component?.name?.trim()) reasons.push("Product name missing");
  if (!positive(component?.sellingPrice)) reasons.push("Selling price missing");
  if (!hasWebsiteImage(component?.images)) reasons.push("Product image missing");
  if (!decoration && component?.hamperUse === false) reasons.push("Not enabled for custom hampers");
  if (!decoration && !hasDimensions(component?.dimensions)) reasons.push("Dimensions incomplete");
  if (!decoration && !positive(component?.weight?.value)) reasons.push("Product weight missing");
  if (component?.customerSelectable === false) reasons.push("Customer selection disabled");
  return reasons;
}

export function containerArchiveReasons(box) {
  const reasons = [];
  if (box?.isActive === false) reasons.push("Inactive in Excel/Admin");
  if (!box?.name?.trim()) reasons.push("Box name missing");
  if (!positive(box?.sellingPrice)) reasons.push("Selling price missing");
  if (!hasWebsiteImage(box?.images)) reasons.push("Box image missing");
  if (!hasDimensions(box?.outerDimensions)) reasons.push("Outer dimensions incomplete");
  if (!hasDimensions(box?.innerDimensions)) reasons.push("True inner dimensions incomplete");
  if (!positive(box?.maxContentWeight?.value)) reasons.push("Maximum content weight missing");
  const volume = Number(box?.usableVolumePercent);
  if (!Number.isFinite(volume) || volume < 1 || volume > 100) reasons.push("Usable volume percentage invalid");
  if (box?.hamperUse === false) reasons.push("Not enabled for custom hampers");
  if (box?.customerSelectable === false) reasons.push("Customer selection disabled");
  return reasons;
}

export function hamperArchiveReasons(product, skus = []) {
  const reasons = [];
  if (product?.status !== "active") reasons.push("Not approved/active");
  if (!product?.name?.trim()) reasons.push("Hamper name missing");
  if (!product?.category) reasons.push("Category missing");
  if (!hasWebsiteImage(product?.images)) reasons.push("Hamper cover image missing");
  const activeSku = skus.some((sku) => sku?.isActive !== false && positive(sku?.price));
  if (!activeSku) reasons.push("Active SKU with a selling price missing");
  return reasons;
}

// MongoDB pre-filters AND JS readiness must both pass; this query keeps existing
// pagination accurate while excluding incomplete items at the database layer.
export const websiteImageMongoFilter = () => ({
  images: {
    $elemMatch: {
      url: { $regex: /^https?:\/\//i, $not: /(?:drive|docs)\.google\.com/i },
    },
  },
});

export function buildComponentPublicFilter() {
  return {
    isActive: true,
    customerSelectable: true,
    type: { $in: ["food", "non_food"] },
    sellingPrice: { $gt: 0 },
    ...websiteImageMongoFilter(),
  };
}

export function buildContainerPublicFilter() {
  return {
    isActive: true,
    customerSelectable: true,
    hamperUse: { $ne: false },
    sellingPrice: { $gt: 0 },
    ...websiteImageMongoFilter(),
    "outerDimensions.length": { $gt: 0 },
    "outerDimensions.width": { $gt: 0 },
    "outerDimensions.height": { $gt: 0 },
    "innerDimensions.length": { $gt: 0 },
    "innerDimensions.width": { $gt: 0 },
    "innerDimensions.height": { $gt: 0 },
    "maxContentWeight.value": { $gt: 0 },
    usableVolumePercent: { $gte: 1, $lte: 100 },
  };
}


/* =========================================================
   ADMIN CONTAINER WEBSITE VISIBILITY DIAGNOSTICS — V18
   Keep these gates synchronized with buildContainerPublicFilter().
   This is read-only; visibility is never auto-enabled by an import.
========================================================= */

const CONTAINER_CHANNELS = ["corporate", "wedding", "diwali", "hamperOne"];

export function inspectContainerWebsiteVisibility(box) {
  const required = [
    ["active", "Catalogue active", box?.isActive === true,
      "Inactive: turn on Active in the container editor"],
    ["hamperUse", "Allowed for hampers", box?.hamperUse !== false,
      "Hamper usage disabled: enable 'Can be used for hampers'"],
    ["customerSelectable", "Customer selection enabled", box?.customerSelectable === true,
      "Customer selection disabled: enable 'Available in custom hamper builder'"],
    ["sellingPrice", "Positive base selling price", positive(box?.sellingPrice),
      "Selling price missing: enter Base Selling Price (Pre-GST)"],
    ["image", "Displayable image saved", hasWebsiteImage(box?.images),
      "Display image missing: sync/upload a website image (not only a Drive link)"],
    ["outerDimensions", "Outer length, width and height", hasDimensions(box?.outerDimensions),
      "Outer dimensions missing: fill all three positive measurements"],
    ["innerDimensions", "True inner length, width and height", hasDimensions(box?.innerDimensions),
      "Inner dimensions missing: fill all three true usable measurements"],
    ["maxContentWeight", "Maximum content weight", positive(box?.maxContentWeight?.value),
      "Maximum content weight missing: enter a positive weight capacity"],
    ["usableVolumePercent", "Usable volume 1–100%",
      box?.usableVolumePercent !== null &&
      box?.usableVolumePercent !== undefined &&
      box?.usableVolumePercent !== "" &&
      Number.isFinite(Number(box.usableVolumePercent)) &&
      Number(box.usableVolumePercent) >= 1 &&
      Number(box.usableVolumePercent) <= 100,
      "Usable volume percent missing or outside 1–100%"],
  ];

  const checks = required.map(([key, label, passed, reason]) => ({
    key, label, passed: Boolean(passed), reason: passed ? "" : reason,
  }));
  const reasons = checks.filter((check) => !check.passed).map((check) => check.reason);
  const ready = reasons.length === 0;
  const enabledChannels = CONTAINER_CHANNELS.filter((channel) =>
    box?.channels?.[channel] === true
  );
  const channels = Object.fromEntries(CONTAINER_CHANNELS.map((channel) => [
    channel,
    {
      enabled: box?.channels?.[channel] === true,
      visible: ready && box?.channels?.[channel] === true,
      reason: box?.channels?.[channel] === true
        ? ""
        : `Not enabled for ${channel} channel`,
    },
  ]));

  const warnings = [];
  if (!enabledChannels.length) {
    warnings.push("No special channel enabled. Default builder may show this box, but channel-specific pages will not.");
  }
  const toCm = (d, k) => Number(d?.[k]) * (d?.unit === "mm" ? 0.1 : 1);
  if (hasDimensions(box?.outerDimensions) && hasDimensions(box?.innerDimensions) &&
    ["length", "width", "height"].some((k) =>
      toCm(box.innerDimensions, k) > toCm(box.outerDimensions, k) + 0.0001
    )) {
    warnings.push("Inner dimensions are larger than outer dimensions. Recheck physical measurements before customer use.");
  }
  if (box?.availability?.status === "out_of_stock") {
    warnings.push("Marked out of stock; website availability/purchase logic may restrict this box.");
  }

  return {
    ready, visibleWithoutChannel: ready,
    reasons, checks, warnings,
    enabledChannels, channels,
    canEnableCustomerSelection: !ready &&
      box?.customerSelectable === false &&
      checks.every((check) => check.key === "customerSelectable" || check.passed) &&
      !warnings.some((w) => w.startsWith("Inner dimensions are larger")),
  };
}
