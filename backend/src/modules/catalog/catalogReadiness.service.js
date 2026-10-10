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
  "images.0.url": { $regex: /^https?:\/\//i, $not: /(?:drive|docs)\.google\.com/i },
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
