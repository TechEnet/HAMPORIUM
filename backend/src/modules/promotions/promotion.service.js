import mongoose from "mongoose";

import SKU from "../catalog/sku.model.js";
import Order from "../orders/order.model.js";

import Promotion from "./promotion.model.js";
import ProductControl from "./productControl.model.js";
import PromotionRedemption from "./promotionRedemption.model.js";

import { ORDER_PAYMENT_STATUS } from "../../constants/statuses.js";

export const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const normalizePromotionCode = (value) =>
  String(value || "").trim().toUpperCase().slice(0, 40);

const clampPercent = (value) =>
  Math.max(0, Math.min(100, Number(value || 0)));

const numericOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const globalMarginFloor = () => {
  const configured = numericOrNull(
    process.env.PROMOTION_DEFAULT_MIN_GROSS_MARGIN_PERCENT
  );
  return clampPercent(configured === null ? 20 : configured);
};

const globalPaymentFee = () => {
  const configured = numericOrNull(process.env.PROMOTION_PAYMENT_FEE_PERCENT);
  return clampPercent(configured === null ? 0 : configured);
};

const sameId = (a, b) =>
  String(a?._id || a || "") === String(b?._id || b || "");

const normalizeUnit = (value) => {
  const unit = String(value || "").trim().toLowerCase();
  const aliases = {
    pcs: "pc",
    piece: "pc",
    pieces: "pc",
    gram: "g",
    grams: "g",
    kilogram: "kg",
    kilograms: "kg",
    litre: "l",
    liter: "l",
    litres: "l",
    liters: "l",
    millilitre: "ml",
    milliliter: "ml",
    millilitres: "ml",
    milliliters: "ml",
    millimetre: "mm",
    millimeter: "mm",
    centimetre: "cm",
    centimeter: "cm",
    metre: "m",
    meter: "m",
  };
  return aliases[unit] || unit;
};

const convertQuantity = (value, fromUnit, toUnit) => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 0) return null;

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (!from || !to || from === to) return quantity;

  const groups = [
    { units: { g: 1, kg: 1000 } },
    { units: { ml: 1, l: 1000 } },
    { units: { mm: 1, cm: 10, m: 1000 } },
  ];

  for (const group of groups) {
    if (group.units[from] && group.units[to]) {
      return (quantity * group.units[from]) / group.units[to];
    }
  }

  return null;
};

const componentCost = (component) => {
  const actual = numericOrNull(component?.actualLandedCost);
  if (actual !== null) return actual;
  return numericOrNull(component?.latestUnitCost);
};

const containerCost = (container) => {
  const actual = numericOrNull(container?.actualLandedCost);
  if (actual !== null) return actual;
  return numericOrNull(container?.latestUnitCost);
};

const convertUsageToCostUnits = ({ component, quantity, unit }) => {
  const amount = Number(quantity || 0);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const usageUnit = normalizeUnit(unit || "pc");
  const costUnit = normalizeUnit(component?.uom || usageUnit || "pc");

  if (!costUnit || usageUnit === costUnit) return amount;

  const converted = convertQuantity(amount, usageUnit, costUnit);
  if (converted !== null) return converted;

  const piecesPerUom = Number(component?.piecesPerUom || 0);
  if (piecesPerUom > 0) {
    if (usageUnit === "pc" && costUnit !== "pc") {
      return amount / piecesPerUom;
    }
    if (costUnit === "pc" && usageUnit !== "pc") {
      return amount * piecesPerUom;
    }
  }

  return null;
};

const buildComponentCostLine = ({
  component,
  quantity,
  unit,
  source,
  specification = "",
}) => {
  const costPerCostUnit = componentCost(component);
  const quantityInCostUnit = convertUsageToCostUnits({
    component,
    quantity,
    unit,
  });

  const complete =
    Boolean(component) &&
    costPerCostUnit !== null &&
    quantityInCostUnit !== null;

  return {
    source,
    componentId: component?._id || null,
    name: component?.name || "Missing component",
    code: component?.code || "",
    quantity: Number(quantity || 0),
    unit: unit || "pc",
    costUnit: component?.uom || unit || "pc",
    quantityInCostUnit,
    costPerCostUnit,
    lineCost: complete
      ? roundMoney(quantityInCostUnit * costPerCostUnit)
      : null,
    minGrossMarginPercent: numericOrNull(component?.minGrossMarginPercent),
    specification,
    complete,
  };
};

const currentCatalogTaxableUnit = (sku) => {
  const base = Math.max(
    0,
    Number(sku?.baseSellingPrice ?? sku?.price ?? 0)
  );
  const discount = sku?.discount || {};

  if (!discount.enabled || Number(discount.value || 0) <= 0) {
    return roundMoney(base);
  }

  const raw = Number(discount.value || 0);
  const amount =
    discount.type === "fixed"
      ? Math.min(base, raw)
      : Math.min(base, (base * clampPercent(raw)) / 100);

  return roundMoney(Math.max(0, base - amount));
};

const skuPopulate = [
  {
    path: "product",
    select: "name slug category collections status",
  },
  {
    path: "container",
    select:
      "name code actualLandedCost latestUnitCost minGrossMarginPercent packingMaterials",
    populate: {
      path: "packingMaterials.component",
      select:
        "name code uom piecesPerUom actualLandedCost latestUnitCost minGrossMarginPercent",
    },
  },
  {
    path: "hamperContents.component",
    select:
      "name code uom piecesPerUom actualLandedCost latestUnitCost minGrossMarginPercent",
  },
  {
    path: "internalMaterials.component",
    select:
      "name code uom piecesPerUom actualLandedCost latestUnitCost minGrossMarginPercent",
  },
];

export const loadSkuEconomics = async (skuIds) => {
  const ids = [...new Set((skuIds || []).map(String).filter(Boolean))].filter(
    (id) => mongoose.isValidObjectId(id)
  );

  if (!ids.length) {
    return { skuMap: new Map(), controlMap: new Map() };
  }

  const [skus, controls] = await Promise.all([
    SKU.find({ _id: { $in: ids } }).populate(skuPopulate).lean(),
    ProductControl.find({ sku: { $in: ids } }).lean(),
  ]);

  return {
    skuMap: new Map(skus.map((sku) => [String(sku._id), sku])),
    controlMap: new Map(
      controls.map((control) => [String(control.sku), control])
    ),
  };
};

const getSkuCostBreakdown = ({ sku, control }) => {
  const lines = [];
  const marginFloors = [globalMarginFloor()];

  if (control?.marginPolicy?.minGrossMarginPercent !== null) {
    const value = numericOrNull(control?.marginPolicy?.minGrossMarginPercent);
    if (value !== null) marginFloors.push(value);
  }

  if (sku?.container) {
    const cost = containerCost(sku.container);
    const margin = numericOrNull(sku.container.minGrossMarginPercent);
    if (margin !== null) marginFloors.push(margin);

    lines.push({
      source: "container",
      componentId: null,
      name: sku.container.name || "Container",
      code: sku.container.code || "",
      quantity: 1,
      unit: "pc",
      costUnit: "pc",
      quantityInCostUnit: 1,
      costPerCostUnit: cost,
      lineCost: cost === null ? null : roundMoney(cost),
      minGrossMarginPercent: margin,
      complete: cost !== null,
    });

    for (const row of sku.container.packingMaterials || []) {
      const line = buildComponentCostLine({
        component: row.component,
        quantity: row.quantity,
        unit: row.unit,
        source: "container_packing_material",
        specification: row.specification || "",
      });
      lines.push(line);
      if (line.minGrossMarginPercent !== null) {
        marginFloors.push(line.minGrossMarginPercent);
      }
    }
  }

  for (const row of sku?.hamperContents || []) {
    const line = buildComponentCostLine({
      component: row.component,
      quantity: row.quantity,
      unit: row.unit,
      source: row.isOptional ? "hamper_content_optional" : "hamper_content",
    });
    lines.push(line);
    if (line.minGrossMarginPercent !== null) {
      marginFloors.push(line.minGrossMarginPercent);
    }
  }

  for (const row of sku?.internalMaterials || []) {
    const line = buildComponentCostLine({
      component: row.component,
      quantity: row.quantity,
      unit: row.unit,
      source: "internal_material",
      specification: row.specification || "",
    });
    lines.push(line);
    if (line.minGrossMarginPercent !== null) {
      marginFloors.push(line.minGrossMarginPercent);
    }
  }

  const missing = lines.filter((line) => !line.complete);
  const unitCostOverride = numericOrNull(
    control?.marginPolicy?.unitCostOverride
  );

  // Fail closed when a SKU has no BOM/cost lines. A zero-length BOM must not
  // be interpreted as a zero landed cost. Admin can explicitly supply a
  // finished-SKU landed cost through unitCostOverride.
  const derivedLandedCost =
    unitCostOverride !== null
      ? roundMoney(Math.max(0, unitCostOverride))
      : !lines.length || missing.length
        ? null
        : roundMoney(
            lines.reduce((sum, line) => sum + Number(line.lineCost || 0), 0)
          );

  const extraUnitCost = roundMoney(
    Math.max(0, Number(control?.marginPolicy?.extraUnitCost || 0))
  );
  const deliverySubsidy = roundMoney(
    Math.max(0, Number(control?.marginPolicy?.deliverySubsidy || 0))
  );

  const totalFixedCost =
    derivedLandedCost === null
      ? null
      : roundMoney(derivedLandedCost + extraUnitCost + deliverySubsidy);

  const paymentFeePercent = clampPercent(
    control?.marginPolicy?.paymentFeePercent === null ||
      control?.marginPolicy?.paymentFeePercent === undefined
      ? globalPaymentFee()
      : control.marginPolicy.paymentFeePercent
  );

  return {
    lines,
    missing,
    costComplete: derivedLandedCost !== null,
    costSource: unitCostOverride !== null ? "sku_override" : "derived_bom",
    unitCostOverride,
    derivedLandedCost,
    extraUnitCost,
    deliverySubsidy,
    totalFixedCost,
    paymentFeePercent,
    minimumMarginPercent: clampPercent(Math.max(...marginFloors)),
  };
};

const calculateSafetyFromBreakdown = ({
  breakdown,
  currentTaxableUnit,
  commissionRate = 0,
  additionalMarginFloor = null,
}) => {
  const current = roundMoney(Math.max(0, Number(currentTaxableUnit || 0)));
  const commissionPercent = clampPercent(commissionRate);
  const marginPercent = clampPercent(
    Math.max(
      Number(breakdown.minimumMarginPercent || 0),
      Number(additionalMarginFloor || 0)
    )
  );
  const paymentFeePercent = clampPercent(breakdown.paymentFeePercent);
  const variablePercent = paymentFeePercent + commissionPercent;
  const denominator = 1 - (marginPercent + variablePercent) / 100;

  if (!breakdown.costComplete || breakdown.totalFixedCost === null) {
    return {
      safe: false,
      reason: "Cost data is incomplete",
      currentTaxableUnit: current,
      safeMinimumTaxableUnit: null,
      safeMaxDiscountPercent: 0,
      estimatedCurrentGrossMarginPercent: null,
      marginPercent,
      paymentFeePercent,
      commissionPercent,
    };
  }

  if (denominator <= 0) {
    return {
      safe: false,
      reason: "Margin, fee and commission settings leave no valid selling price",
      currentTaxableUnit: current,
      safeMinimumTaxableUnit: null,
      safeMaxDiscountPercent: 0,
      estimatedCurrentGrossMarginPercent: null,
      marginPercent,
      paymentFeePercent,
      commissionPercent,
    };
  }

  const safeMinimumTaxableUnit = roundMoney(
    Number(breakdown.totalFixedCost || 0) / denominator
  );

  const safeMaxDiscountPercent =
    current > 0
      ? clampPercent(
          ((current - safeMinimumTaxableUnit) / current) * 100
        )
      : 0;

  const estimatedCurrentGrossMarginPercent =
    current > 0
      ? roundMoney(
          ((current -
            Number(breakdown.totalFixedCost || 0) -
            current * (variablePercent / 100)) /
            current) *
            100
        )
      : null;

  return {
    safe: current >= safeMinimumTaxableUnit - 0.009,
    reason:
      current >= safeMinimumTaxableUnit - 0.009
        ? ""
        : "Current taxable price is already below the protected margin floor",
    currentTaxableUnit: current,
    safeMinimumTaxableUnit,
    safeMaxDiscountPercent: roundMoney(safeMaxDiscountPercent),
    estimatedCurrentGrossMarginPercent,
    marginPercent,
    paymentFeePercent,
    commissionPercent,
  };
};

export const getSkuSafetyPreview = async ({
  skuId,
  commissionRate = 0,
  currentTaxableUnit = null,
  additionalMarginFloor = null,
}) => {
  if (!mongoose.isValidObjectId(skuId)) {
    const error = new Error("Invalid SKU ID");
    error.statusCode = 400;
    throw error;
  }

  const { skuMap, controlMap } = await loadSkuEconomics([skuId]);
  const sku = skuMap.get(String(skuId));

  if (!sku) {
    const error = new Error("SKU not found");
    error.statusCode = 404;
    throw error;
  }

  const control = controlMap.get(String(skuId)) || null;
  const breakdown = getSkuCostBreakdown({ sku, control });
  const taxableUnit =
    currentTaxableUnit === null || currentTaxableUnit === undefined
      ? currentCatalogTaxableUnit(sku)
      : currentTaxableUnit;

  const safety = calculateSafetyFromBreakdown({
    breakdown,
    currentTaxableUnit: taxableUnit,
    commissionRate,
    additionalMarginFloor,
  });

  return {
    sku: {
      _id: sku._id,
      code: sku.code,
      name: sku.name,
      baseSellingPrice: sku.baseSellingPrice,
      price: sku.price,
      product: sku.product
        ? {
            _id: sku.product._id,
            name: sku.product.name,
            slug: sku.product.slug,
          }
        : null,
      container: sku.container
        ? {
            _id: sku.container._id,
            name: sku.container.name,
            code: sku.container.code,
          }
        : null,
    },
    control: control || {
      sku: sku._id,
      product: sku.product?._id || null,
      marginPolicy: {
        minGrossMarginPercent: null,
        unitCostOverride: null,
        extraUnitCost: 0,
        deliverySubsidy: 0,
        paymentFeePercent: null,
      },
      promoEligibility: {
        allowAutomaticSale: true,
        allowCoupons: true,
        allowPartnerCode: true,
      },
      note: "",
    },
    cost: breakdown,
    safety,
  };
};

const promotionActiveNow = (promotion, now = new Date()) => {
  if (!promotion || promotion.status !== "active") return false;
  if (promotion.startsAt && new Date(promotion.startsAt) > now) return false;
  if (promotion.endsAt && new Date(promotion.endsAt) <= now) return false;
  return true;
};

const promotionScopeMatchesSku = (promotion, sku) => {
  const scope = promotion?.scope || {};
  if (scope.allSkus !== false) return true;

  const skuId = String(sku?._id || "");
  const productId = String(sku?.product?._id || sku?.product || "");
  const categoryId = String(sku?.product?.category?._id || sku?.product?.category || "");
  const collectionIds = new Set(
    (sku?.product?.collections || []).map((item) => String(item?._id || item))
  );

  if ((scope.skus || []).some((item) => String(item) === skuId)) return true;
  if ((scope.products || []).some((item) => String(item) === productId)) return true;
  if ((scope.categories || []).some((item) => String(item) === categoryId)) {
    return true;
  }
  if (
    (scope.collections || []).some((item) => collectionIds.has(String(item)))
  ) {
    return true;
  }

  return false;
};

const audienceMatches = (promotion, user) => {
  if (!["client_coupon", "customer_care"].includes(promotion.type)) {
    return true;
  }

  const users = promotion.audience?.users || [];
  const emails = promotion.audience?.emails || [];

  // Private coupon types are intentionally fail-closed.
  if (!users.length && !emails.length) return false;

  const userId = String(user?._id || user?.id || "");
  const email = String(user?.email || "").trim().toLowerCase();

  return (
    users.some((id) => String(id) === userId) ||
    emails.some((value) => String(value).trim().toLowerCase() === email)
  );
};

const hasPreviousPaidRetailOrder = async (userId) => {
  if (!userId) return true;

  return Boolean(
    await Order.exists({
      user: userId,
      checkoutMode: { $in: ["cart", "buy_now"] },
      paymentStatus: {
        $in: [
          ORDER_PAYMENT_STATUS.PAID,
          ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
          ORDER_PAYMENT_STATUS.REFUNDED,
        ],
      },
    })
  );
};

const firstOrderPromotionAvailable = async (promotion, userId) => {
  if (promotion.type !== "first_order") return true;

  if (await hasPreviousPaidRetailOrder(userId)) return false;

  const existingLock = await PromotionRedemption.exists({
    promotion: promotion._id,
    user: userId,
    firstOrderLock: true,
  });

  return !existingLock;
};

export const resolvePromotionByCode = async ({ code, user }) => {
  const normalized = normalizePromotionCode(code);
  if (!normalized) return null;

  const promotion = await Promotion.findOne({
    code: normalized,
    status: "active",
  }).lean();

  if (!promotion || !promotionActiveNow(promotion)) return null;
  if (!audienceMatches(promotion, user)) return null;
  if (!(await firstOrderPromotionAvailable(promotion, user?._id || user?.id))) {
    return null;
  }

  return promotion;
};

const getAutomaticPromotionsForUser = async (user) => {
  const now = new Date();

  const promotions = await Promotion.find({
    status: "active",
    type: { $in: ["automatic_sale", "first_order"] },
    $or: [{ startsAt: null }, { startsAt: { $lte: now } }],
    $and: [
      {
        $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
      },
      {
        $or: [
          { type: "automatic_sale" },
          { type: "first_order", code: { $exists: false } },
        ],
      },
    ],
  })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  const result = [];
  for (const promotion of promotions) {
    if (!audienceMatches(promotion, user)) continue;
    if (!(await firstOrderPromotionAvailable(promotion, user?._id || user?.id))) {
      continue;
    }
    result.push(promotion);
  }

  return result;
};

const scaleTaxSnapshot = (tax, ratio) => {
  const safeRatio = Math.max(0, Math.min(1, Number(ratio || 0)));
  return {
    ...(tax || {}),
    cgstAmount: roundMoney(Number(tax?.cgstAmount || 0) * safeRatio),
    sgstAmount: roundMoney(Number(tax?.sgstAmount || 0) * safeRatio),
    igstAmount: roundMoney(Number(tax?.igstAmount || 0) * safeRatio),
    totalTax: roundMoney(Number(tax?.totalTax || 0) * safeRatio),
  };
};

const applyGenericDiscountToItem = ({ item, discountAmount }) => {
  const beforeTaxable = roundMoney(item.taxableAmount || 0);
  const applied = roundMoney(
    Math.min(beforeTaxable, Math.max(0, Number(discountAmount || 0)))
  );

  if (applied <= 0) {
    return {
      discountAmount: 0,
      taxReductionAmount: 0,
      customerSavings: 0,
    };
  }

  const afterTaxable = roundMoney(beforeTaxable - applied);
  const ratio = beforeTaxable > 0 ? afterTaxable / beforeTaxable : 0;
  const previousTax = roundMoney(item.tax?.totalTax || 0);
  const nextTax = scaleTaxSnapshot(item.tax || {}, ratio);
  const nextTaxTotal = roundMoney(nextTax.totalTax || 0);
  const taxReductionAmount = roundMoney(
    Math.max(0, previousTax - nextTaxTotal)
  );

  item.promotionDiscountAmount = roundMoney(
    Number(item.promotionDiscountAmount || 0) + applied
  );
  item.taxableAmount = afterTaxable;
  item.tax = nextTax;
  item.lineTotal = roundMoney(afterTaxable + nextTaxTotal);
  item.unitPrice = roundMoney(
    item.lineTotal / Math.max(1, Number(item.quantity || 1))
  );

  return {
    discountAmount: applied,
    taxReductionAmount,
    customerSavings: roundMoney(applied + taxReductionAmount),
  };
};

const applyPartnerDiscountToItem = ({ item, discountAmount }) => {
  const beforeTaxable = roundMoney(item.taxableAmount || 0);
  const applied = roundMoney(
    Math.min(beforeTaxable, Math.max(0, Number(discountAmount || 0)))
  );

  if (applied <= 0) {
    return {
      discountAmount: 0,
      taxReductionAmount: 0,
      customerSavings: 0,
    };
  }

  const afterTaxable = roundMoney(beforeTaxable - applied);
  const ratio = beforeTaxable > 0 ? afterTaxable / beforeTaxable : 0;
  const previousTax = roundMoney(item.tax?.totalTax || 0);
  const nextTax = scaleTaxSnapshot(item.tax || {}, ratio);
  const nextTaxTotal = roundMoney(nextTax.totalTax || 0);
  const taxReductionAmount = roundMoney(
    Math.max(0, previousTax - nextTaxTotal)
  );

  item.partnerPromoDiscountAmount = roundMoney(
    Number(item.partnerPromoDiscountAmount || 0) + applied
  );
  item.taxableAmount = afterTaxable;
  item.tax = nextTax;
  item.lineTotal = roundMoney(afterTaxable + nextTaxTotal);
  item.unitPrice = roundMoney(
    item.lineTotal / Math.max(1, Number(item.quantity || 1))
  );

  return {
    discountAmount: applied,
    taxReductionAmount,
    customerSavings: roundMoney(applied + taxReductionAmount),
  };
};

const aggregatePromotionResult = (map, promotion, result, appliedSkuId) => {
  const key = String(promotion._id);
  const existing = map.get(key) || {
    promotion: promotion._id,
    type: promotion.type,
    code: promotion.code || "",
    name: promotion.name,
    customerLabel: promotion.customerLabel || promotion.name,
    discountType:
      promotion.type === "automatic_sale"
        ? "percentage"
        : promotion.discount?.type || "percentage",
    discountValue:
      promotion.type === "automatic_sale"
        ? Number(promotion.automaticBand?.targetDiscountPercent || 0)
        : Number(promotion.discount?.value || 0),
    discountAmount: 0,
    taxReductionAmount: 0,
    customerSavings: 0,
    appliedSkus: [],
    appliedAt: new Date(),
  };

  existing.discountAmount = roundMoney(
    existing.discountAmount + Number(result.discountAmount || 0)
  );
  existing.taxReductionAmount = roundMoney(
    existing.taxReductionAmount + Number(result.taxReductionAmount || 0)
  );
  existing.customerSavings = roundMoney(
    existing.customerSavings + Number(result.customerSavings || 0)
  );

  if (appliedSkuId && !existing.appliedSkus.some((id) => sameId(id, appliedSkuId))) {
    existing.appliedSkus.push(appliedSkuId);
  }

  map.set(key, existing);
};

const defaultControl = (sku) => ({
  sku: sku._id,
  product: sku.product?._id || null,
  marginPolicy: {
    minGrossMarginPercent: null,
    unitCostOverride: null,
    extraUnitCost: 0,
    deliverySubsidy: 0,
    paymentFeePercent: null,
  },
  promoEligibility: {
    allowAutomaticSale: true,
    allowCoupons: true,
    allowPartnerCode: true,
  },
});

const getSafetyForOrderItem = ({
  item,
  sku,
  control,
  commissionRate = 0,
  additionalMarginFloor = null,
}) => {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const currentTaxableUnit = roundMoney(
    Number(item.taxableAmount || 0) / quantity
  );
  const breakdown = getSkuCostBreakdown({ sku, control });
  const safety = calculateSafetyFromBreakdown({
    breakdown,
    currentTaxableUnit,
    commissionRate,
    additionalMarginFloor,
  });

  return { breakdown, safety, quantity, currentTaxableUnit };
};

const maximumSafeLineDiscount = ({ safety, quantity, currentLineTaxable }) => {
  if (!safety.safe || safety.safeMinimumTaxableUnit === null) return 0;
  return roundMoney(
    Math.max(
      0,
      Number(currentLineTaxable || 0) -
        Number(safety.safeMinimumTaxableUnit || 0) * quantity
    )
  );
};

const applyAutomaticPromotions = async ({
  items,
  user,
  skuMap,
  controlMap,
}) => {
  const promotions = await getAutomaticPromotionsForUser(user);
  if (!promotions.length) return [];

  const snapshotMap = new Map();

  for (const item of items) {
    if ((item.itemType || "sku") !== "sku" || !item.sku) continue;

    const sku = skuMap.get(String(item.sku));
    if (!sku) continue;
    const control = controlMap.get(String(item.sku)) || defaultControl(sku);
    if (control?.promoEligibility?.allowAutomaticSale === false) continue;

    let best = null;

    for (const promotion of promotions) {
      if (!promotionScopeMatchesSku(promotion, sku)) continue;

      const isAutomaticFirstOrder =
        promotion.type === "first_order" && !promotion.code;
      const firstOrderPercent = clampPercent(
        promotion.discount?.type === "percentage"
          ? promotion.discount?.value || 0
          : 0
      );
      const min = clampPercent(
        isAutomaticFirstOrder
          ? firstOrderPercent
          : promotion.automaticBand?.minDiscountPercent || 0
      );
      const target = clampPercent(
        isAutomaticFirstOrder
          ? firstOrderPercent
          : promotion.automaticBand?.targetDiscountPercent || 0
      );
      const max = clampPercent(
        isAutomaticFirstOrder
          ? firstOrderPercent
          : promotion.automaticBand?.maxDiscountPercent || target
      );

      const { safety, quantity } = getSafetyForOrderItem({
        item,
        sku,
        control,
        additionalMarginFloor: promotion.minGrossMarginPercent,
      });

      if (!safety.safe) continue;

      const protectedPercent = Math.min(
        target,
        max,
        Number(safety.safeMaxDiscountPercent || 0)
      );

      if (protectedPercent + 0.0001 < min || protectedPercent <= 0) {
        continue;
      }

      const lineTaxable = roundMoney(item.taxableAmount || 0);
      const requested = roundMoney((lineTaxable * protectedPercent) / 100);
      const safeMax = maximumSafeLineDiscount({
        safety,
        quantity,
        currentLineTaxable: lineTaxable,
      });
      const discountAmount = Math.min(requested, safeMax);

      if (discountAmount <= 0) continue;

      const candidate = {
        promotion,
        percent: protectedPercent,
        discountAmount,
      };

      if (
        !best ||
        candidate.discountAmount > best.discountAmount + 0.009 ||
        (Math.abs(candidate.discountAmount - best.discountAmount) <= 0.009 &&
          Number(promotion.priority || 0) > Number(best.promotion.priority || 0))
      ) {
        best = candidate;
      }
    }

    if (!best) continue;

    const result = applyGenericDiscountToItem({
      item,
      discountAmount: best.discountAmount,
    });

    aggregatePromotionResult(snapshotMap, best.promotion, result, item.sku);
  }

  return [...snapshotMap.values()].filter(
    (snapshot) => snapshot.discountAmount > 0
  );
};

const eligibleCouponItems = ({ items, promotion, skuMap, controlMap }) => {
  return items
    .filter((item) => (item.itemType || "sku") === "sku" && item.sku)
    .map((item) => {
      const sku = skuMap.get(String(item.sku));
      if (!sku) return null;
      const control = controlMap.get(String(item.sku)) || defaultControl(sku);
      if (control?.promoEligibility?.allowCoupons === false) return null;
      if (!promotionScopeMatchesSku(promotion, sku)) return null;
      return { item, sku, control };
    })
    .filter(Boolean);
};

const allocateOrderDiscount = ({ rows, promotion }) => {
  const eligibleTotal = roundMoney(
    rows.reduce((sum, row) => sum + Number(row.item.taxableAmount || 0), 0)
  );

  if (eligibleTotal <= 0) return [];

  let totalDiscount = 0;

  if (promotion.discount?.type === "fixed") {
    totalDiscount = Math.min(
      eligibleTotal,
      Math.max(0, Number(promotion.discount?.value || 0))
    );
  } else {
    totalDiscount = roundMoney(
      (eligibleTotal * clampPercent(promotion.discount?.value || 0)) / 100
    );
  }

  const cap = Math.max(0, Number(promotion.maxDiscountAmount || 0));
  if (cap > 0) totalDiscount = Math.min(totalDiscount, cap);
  totalDiscount = roundMoney(totalDiscount);

  if (totalDiscount <= 0) return [];

  let allocated = 0;
  return rows.map((row, index) => {
    const taxable = roundMoney(row.item.taxableAmount || 0);
    const amount =
      index === rows.length - 1
        ? roundMoney(totalDiscount - allocated)
        : roundMoney((totalDiscount * taxable) / eligibleTotal);
    allocated = roundMoney(allocated + amount);
    return { ...row, discountAmount: Math.min(taxable, amount) };
  });
};

const applyExplicitCoupon = ({
  promotion,
  items,
  skuMap,
  controlMap,
}) => {
  const eligible = eligibleCouponItems({
    items,
    promotion,
    skuMap,
    controlMap,
  });

  if (!eligible.length) {
    const error = new Error("This coupon does not apply to the items in your order.");
    error.statusCode = 400;
    throw error;
  }

  // Minimum order value is checked only against coupon-eligible SKU value.
  // Non-eligible SKUs and custom hampers cannot be used to unlock a coupon.
  const eligibleTaxable = roundMoney(
    eligible.reduce(
      (sum, row) => sum + Number(row.item?.taxableAmount || 0),
      0
    )
  );

  if (eligibleTaxable + 0.009 < Number(promotion.minOrderValue || 0)) {
    const error = new Error(
      `This code requires at least ₹${Number(
        promotion.minOrderValue || 0
      ).toLocaleString("en-IN")} of eligible products.`
    );
    error.statusCode = 400;
    throw error;
  }

  const allocations = allocateOrderDiscount({ rows: eligible, promotion });
  if (!allocations.length) {
    const error = new Error("This coupon does not provide a discount on this order.");
    error.statusCode = 400;
    throw error;
  }

  // Explicit coupon values are never silently reduced. If any allocated line
  // would breach margin, the whole code is rejected.
  for (const row of allocations) {
    const { safety, quantity } = getSafetyForOrderItem({
      item: row.item,
      sku: row.sku,
      control: row.control,
      additionalMarginFloor: promotion.minGrossMarginPercent,
    });

    if (!safety.safe) {
      const error = new Error(
        `${row.item.productName || row.sku.name} cannot accept this coupon because protected cost or margin data is incomplete/unsafe.`
      );
      error.statusCode = 409;
      throw error;
    }

    const safeMax = maximumSafeLineDiscount({
      safety,
      quantity,
      currentLineTaxable: row.item.taxableAmount,
    });

    if (Number(row.discountAmount || 0) > safeMax + 0.009) {
      const error = new Error(
        `${promotion.code || promotion.name} would push ${
          row.item.productName || row.sku.name
        } below its protected margin. The coupon was not applied.`
      );
      error.statusCode = 409;
      throw error;
    }
  }

  const snapshotMap = new Map();
  for (const row of allocations) {
    const result = applyGenericDiscountToItem({
      item: row.item,
      discountAmount: row.discountAmount,
    });
    aggregatePromotionResult(snapshotMap, promotion, result, row.item.sku);
  }

  return [...snapshotMap.values()];
};

export const applyPromotionEngine = async ({
  items,
  user,
  explicitPromotion = null,
  suppressAutomatic = false,
}) => {
  const skuIds = items
    .filter((item) => (item.itemType || "sku") === "sku")
    .map((item) => item.sku)
    .filter(Boolean);

  const { skuMap, controlMap } = await loadSkuEconomics(skuIds);
  const snapshots = [];

  const shouldApplyAutomatic =
    !suppressAutomatic &&
    (!explicitPromotion || explicitPromotion.stackWithAutomaticSale === true);

  if (shouldApplyAutomatic) {
    snapshots.push(
      ...(await applyAutomaticPromotions({
        items,
        user,
        skuMap,
        controlMap,
      }))
    );
  }

  if (explicitPromotion) {
    snapshots.push(
      ...applyExplicitCoupon({
        promotion: explicitPromotion,
        items,
        skuMap,
        controlMap,
      })
    );
  }

  return {
    promotionSnapshots: snapshots,
    skuMap,
    controlMap,
  };
};

export const applyPartnerCodeWithMarginGuard = async ({
  items,
  discountPercent,
  commissionRate,
}) => {
  const skuIds = items
    .filter((item) => (item.itemType || "sku") === "sku")
    .map((item) => item.sku)
    .filter(Boolean);

  const { skuMap, controlMap } = await loadSkuEconomics(skuIds);
  const rate = clampPercent(discountPercent);
  const commission = clampPercent(commissionRate);
  const eligible = [];

  for (const item of items) {
    if ((item.itemType || "sku") !== "sku" || !item.sku) continue;
    const sku = skuMap.get(String(item.sku));
    if (!sku) continue;
    const control = controlMap.get(String(item.sku)) || defaultControl(sku);
    if (control?.promoEligibility?.allowPartnerCode === false) continue;

    const { safety, quantity } = getSafetyForOrderItem({
      item,
      sku,
      control,
      commissionRate: commission,
    });

    if (!safety.safe) {
      const error = new Error(
        `Partner code cannot be used for ${
          item.productName || sku.name
        } because protected cost/margin data is incomplete or the current price is already below the required floor.`
      );
      error.statusCode = 409;
      throw error;
    }

    const beforeTaxable = roundMoney(item.taxableAmount || 0);
    const requestedDiscount = roundMoney((beforeTaxable * rate) / 100);
    const safeMax = maximumSafeLineDiscount({
      safety,
      quantity,
      currentLineTaxable: beforeTaxable,
    });

    if (requestedDiscount > safeMax + 0.009) {
      const error = new Error(
        `Partner code discount is not safe for ${
          item.productName || sku.name
        }. Maximum protected discount is ${Number(
          safety.safeMaxDiscountPercent || 0
        ).toFixed(2)}%. The code was not applied.`
      );
      error.statusCode = 409;
      throw error;
    }

    eligible.push({ item, beforeTaxable, requestedDiscount });
  }

  if (!eligible.length) {
    const error = new Error(
      "This partner code is not eligible for the products in this order."
    );
    error.statusCode = 400;
    throw error;
  }

  let eligibleAmount = 0;
  let discountAmount = 0;
  let taxReductionAmount = 0;
  let customerSavings = 0;

  for (const row of eligible) {
    eligibleAmount = roundMoney(eligibleAmount + row.beforeTaxable);

    const result = applyPartnerDiscountToItem({
      item: row.item,
      discountAmount: row.requestedDiscount,
    });

    discountAmount = roundMoney(
      discountAmount + Number(result.discountAmount || 0)
    );
    taxReductionAmount = roundMoney(
      taxReductionAmount + Number(result.taxReductionAmount || 0)
    );
    customerSavings = roundMoney(
      customerSavings + Number(result.customerSavings || 0)
    );
  }

  return {
    rate,
    commissionRate: commission,
    eligibleAmount,
    discountAmount,
    taxReductionAmount,
    customerSavings,
    eligibleValueAfterDiscount: roundMoney(
      Math.max(0, eligibleAmount - discountAmount)
    ),
  };
};

export const reservePromotionRedemptionsForOrder = async ({
  order,
  promotionSnapshots = [],
}) => {
  if (!order?._id || !order?.user || !promotionSnapshots.length) return;

  const documents = promotionSnapshots
    .filter((snapshot) => snapshot?.promotion)
    .map((snapshot) => ({
      promotion: snapshot.promotion,
      user: order.user,
      order: order._id,
      promotionType: snapshot.type,
      code: snapshot.code || "",
      firstOrderLock: snapshot.type === "first_order",
      status: "reserved",
      discountAmount: roundMoney(snapshot.discountAmount || 0),
      customerSavings: roundMoney(snapshot.customerSavings || 0),
    }));

  if (!documents.length) return;

  try {
    await PromotionRedemption.insertMany(documents, { ordered: true });
  } catch (error) {
    await PromotionRedemption.deleteMany({ order: order._id, status: "reserved" });

    if (error?.code === 11000) {
      const conflict = new Error(
        "This first-order promotion is already reserved or used on another order."
      );
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  }
};

export const assertOrderPromotionReservations = async (order) => {
  const firstOrderSnapshots = (order?.promotionSnapshots || []).filter(
    (snapshot) => snapshot.type === "first_order" && snapshot.promotion
  );

  for (const snapshot of firstOrderSnapshots) {
    const reservation = await PromotionRedemption.findOne({
      promotion: snapshot.promotion,
      user: order.user,
      order: order._id,
      firstOrderLock: true,
      status: { $in: ["reserved", "redeemed"] },
    }).lean();

    if (!reservation) {
      const error = new Error(
        "First-order promotion reservation is missing. Please contact support before payment."
      );
      error.statusCode = 409;
      throw error;
    }
  }
};

export const markOrderPromotionRedemptionsPaid = async (orderId) => {
  if (!orderId) return;

  await PromotionRedemption.updateMany(
    { order: orderId, status: "reserved" },
    {
      $set: {
        status: "redeemed",
        redeemedAt: new Date(),
      },
    }
  );
};

export const promotionAppliesToSku = promotionScopeMatchesSku;
export const promotionIsActiveNow = promotionActiveNow;
