import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

import { ORDER_PAYMENT_STATUS } from "../../constants/statuses.js";

const COLORS = {
  ink: "#171717",
  orange: "#F26522",
  orangeSoft: "#FFF4EC",
  gold: "#D4AF37",
  goldSoft: "#FFF9E8",
  paper: "#FFFFFF",
  soft: "#FAF8F5",
  line: "#E6E1DA",
  muted: "#6D6964",
  success: "#198754",
};

const PAGE = {
  left: 42,
  right: 553,
  width: 511,
  bottom: 792,
};

const formatMoney = (value, currency = "INR") =>
  `${String(currency || "INR").toUpperCase()} ${Number(value || 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;

const formatPercent = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? `${number}%` : "-";
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const buildInvoiceNumber = (order) => {
  const suffix = String(order.orderNumber || order._id)
    .replace(/^HMP-ORD-?/i, "")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 70);

  return `HMP-INV-${suffix || String(order._id)}`;
};

export const ensureOrderInvoiceIdentity = async (order) => {
  if (!order) return null;

  const eligibleStatuses = [
    ORDER_PAYMENT_STATUS.PAID,
    ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
    ORDER_PAYMENT_STATUS.REFUNDED,
  ];

  if (!eligibleStatuses.includes(order.paymentStatus)) {
    return order;
  }

  let changed = false;

  if (!order.invoiceNumber) {
    order.invoiceNumber = buildInvoiceNumber(order);
    changed = true;
  }

  if (!order.invoiceIssuedAt) {
    order.invoiceIssuedAt = order.paidAt || new Date();
    changed = true;
  }

  if (changed && typeof order.save === "function") {
    await order.save();
  }

  return order;
};

const drawRule = (doc, y, color = COLORS.line, width = 0.7) => {
  doc
    .moveTo(PAGE.left, y)
    .lineTo(PAGE.right, y)
    .lineWidth(width)
    .strokeColor(color)
    .stroke();
};

const drawPill = ({ doc, x, y, width, text, fill, color }) => {
  doc.roundedRect(x, y, width, 22, 11).fill(fill);
  doc
    .font("Helvetica-Bold")
    .fontSize(7.8)
    .fillColor(color)
    .text(text, x + 8, y + 7, {
      width: width - 16,
      align: "center",
    });
};

const getLogoPath = () => {
  const raw = String(process.env.HAMPORIUM_LOGO_PATH || "").trim();
  if (!raw) return "";

  const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  return fs.existsSync(resolved) ? resolved : "";
};

const drawBrand = (doc, compact = false) => {
  const logoPath = getLogoPath();

  if (logoPath) {
    try {
      doc.image(logoPath, PAGE.left, compact ? 28 : 34, {
        fit: compact ? [118, 32] : [145, 44],
      });
      return;
    } catch (error) {
      console.warn("Invoice logo could not be rendered:", error.message);
    }
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(compact ? 14 : 21)
    .fillColor(COLORS.orange)
    .text("HAMPORIUM", PAGE.left, compact ? 31 : 39, {
      characterSpacing: compact ? 0.8 : 1.2,
    });

  if (!compact) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text("PREMIUM GIFTING, MADE MEMORABLE", PAGE.left, 64, {
        characterSpacing: 0.6,
      });
  }
};

const drawNewPageHeader = (doc, order) => {
  doc.rect(0, 0, 595.28, 64).fill(COLORS.ink);
  drawBrand(doc, true);

  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#FFFFFF")
    .text(`INVOICE ${order.invoiceNumber}`, 330, 29, {
      width: 223,
      align: "right",
    });

  doc.y = 86;
};

const ensurePageSpace = (doc, order, requiredHeight = 90) => {
  if (doc.y + requiredHeight <= 760) return;
  doc.addPage();
  drawNewPageHeader(doc, order);
};

const getPersonalizationSummary = (personalization) => {
  if (!personalization?.enabled) return "";

  const assetSummary = (personalization.assets || [])
    .slice(0, 4)
    .map((asset) => {
      const type = String(asset.type || "artwork").replaceAll("_", " ");
      const placement = String(asset.placement || "other").replaceAll("_", " ");
      return `${type} @ ${placement}`;
    })
    .join(", ");

  return [
    assetSummary ? `Artwork: ${assetSummary}` : "",
    personalization.message
      ? `Text: ${String(personalization.message).slice(0, 500)}`
      : "",
    personalization.instructions
      ? `Instructions: ${String(personalization.instructions).slice(0, 700)}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");
};

const getItemDescription = (item) => {
  if (item.itemType !== "custom_hamper") {
    return [item.productName, item.skuName].filter(Boolean).join(" - ");
  }

  const components = item.customHamper?.components || [];
  const decorations = item.customHamper?.decorations || [];
  const personalization = item.customHamper?.personalization;

  const preview = components
    .slice(0, 4)
    .map((component) => `${component.name} x${component.quantity}`)
    .join(", ");

  const remaining = Math.max(0, components.length - 4);
  const extra = remaining ? ` + ${remaining} more` : "";

  const decorationPreview = decorations
    .slice(0, 3)
    .map((component) => `${component.name} x${component.quantity}`)
    .join(", ");

  const decorationRemaining = Math.max(0, decorations.length - 3);
  const decorationExtra = decorationRemaining
    ? ` + ${decorationRemaining} more`
    : "";

  const personalizationPreview = personalization?.enabled
    ? (personalization.assets || [])
        .slice(0, 3)
        .map(
          (asset) =>
            `${String(asset.type || "artwork").replaceAll("_", " ")} @ ${String(
              asset.placement || "other"
            ).replaceAll("_", " ")}`
        )
        .join(", ")
    : "";

  return [
    item.customHamper?.containerName || "Custom Hamper",
    preview ? `Includes: ${preview}${extra}` : "",
    decorationPreview
      ? `Decorations: ${decorationPreview}${decorationExtra}`
      : "",
    personalizationPreview ? `Personalisation: ${personalizationPreview}` : "",
    personalization?.message ? `Personalised text: ${personalization.message}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const multiplyTax = (tax = {}, multiplier = 1) => ({
  hsnSac: tax.hsnSac || "",
  taxType: tax.taxType || "none",
  gstRate: tax.gstRate ?? null,
  cgstRate: tax.cgstRate || 0,
  cgstAmount: roundMoney(Number(tax.cgstAmount || 0) * multiplier),
  sgstRate: tax.sgstRate || 0,
  sgstAmount: roundMoney(Number(tax.sgstAmount || 0) * multiplier),
  igstRate: tax.igstRate || 0,
  igstAmount: roundMoney(Number(tax.igstAmount || 0) * multiplier),
  totalTax: roundMoney(Number(tax.totalTax || 0) * multiplier),
});

const collectTaxRows = (order) => {
  const rows = [];

  for (const item of order.items || []) {
    const orderQuantity = Math.max(1, Number(item.quantity || 1));

    if (item.itemType !== "custom_hamper") {
      rows.push({
        description: getItemDescription(item),
        hsnSac: item.tax?.hsnSac || "",
        quantity: orderQuantity,
        taxableAmount: Number(item.taxableAmount || 0),
        tax: multiplyTax(item.tax, 1),
        amount: Number(item.lineTotal || 0),
      });
      continue;
    }

    const hamper = item.customHamper || {};
    const containerPricing = hamper.containerPricing;

    if (containerPricing) {
      rows.push({
        description: `${hamper.containerName || "Custom Hamper"} - Container`,
        hsnSac: containerPricing.tax?.hsnSac || "",
        quantity: orderQuantity,
        taxableAmount: roundMoney(
          Number(containerPricing.taxableAmount || 0) * orderQuantity
        ),
        tax: multiplyTax(containerPricing.tax, orderQuantity),
        amount: roundMoney(
          Number(containerPricing.finalPrice || 0) * orderQuantity
        ),
      });
    }

    for (const component of hamper.components || []) {
      const componentQty = Number(component.quantity || 1) * orderQuantity;

      rows.push({
        description: component.name || "Custom Hamper Component",
        hsnSac: component.tax?.hsnSac || "",
        quantity: componentQty,
        taxableAmount: roundMoney(
          Number(component.taxableAmount || 0) * orderQuantity
        ),
        tax: multiplyTax(component.tax, orderQuantity),
        amount: roundMoney(Number(component.lineTotal || 0) * orderQuantity),
      });
    }

    for (const decoration of hamper.decorations || []) {
      const decorationQty = Number(decoration.quantity || 1) * orderQuantity;

      rows.push({
        description: `${decoration.name || "Decorative Material"} - Decoration`,
        hsnSac: decoration.tax?.hsnSac || "",
        quantity: decorationQty,
        taxableAmount: roundMoney(
          Number(decoration.taxableAmount || 0) * orderQuantity
        ),
        tax: multiplyTax(decoration.tax, orderQuantity),
        amount: roundMoney(Number(decoration.lineTotal || 0) * orderQuantity),
      });
    }

    if (
      !containerPricing &&
      !(hamper.components || []).length &&
      !(hamper.decorations || []).length
    ) {
      rows.push({
        description: getItemDescription(item),
        hsnSac: item.tax?.hsnSac || "",
        quantity: orderQuantity,
        taxableAmount: Number(item.taxableAmount || 0),
        tax: multiplyTax(item.tax, 1),
        amount: Number(item.lineTotal || 0),
      });
    }
  }

  return rows;
};

const hasStoredTaxBreakup = (order) =>
  order.taxSummary &&
  order.taxableAmount !== undefined &&
  order.taxAmount !== undefined;

const getQuoteCommercialLines = (order) => {
  if (
    order.checkoutMode !== "quote" ||
    !Array.isArray(order.commercialSnapshot?.lineItems) ||
    !order.commercialSnapshot.lineItems.length
  ) {
    return [];
  }

  return order.commercialSnapshot.lineItems.map((item) => ({
    description: [
      item.name,
      item.description,
      item.personalization ? `Personalisation: ${item.personalization}` : "",
      item.packaging ? `Packaging: ${item.packaging}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
    lineTotal: Number(item.lineTotal || 0),
  }));
};

const drawInvoiceHeader = (doc, order, seller) => {
  doc.rect(0, 0, 595.28, 126).fill(COLORS.ink);

  drawBrand(doc);

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("#FFFFFF")
    .text("TAX INVOICE", 350, 35, {
      width: 203,
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(7.8)
    .fillColor("#CBC7C2")
    .text(`Invoice No: ${order.invoiceNumber}`, 330, 64, {
      width: 223,
      align: "right",
    })
    .text(`Invoice Date: ${formatDate(order.invoiceIssuedAt)}`, {
      width: 223,
      align: "right",
    })
    .text(`Order No: ${order.orderNumber}`, {
      width: 223,
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(7.4)
    .fillColor("#D4D0CC")
    .text(seller.name, PAGE.left, 84, { width: 245 });

  const sellerLine = [seller.address, seller.gstin ? `GSTIN ${seller.gstin}` : ""]
    .filter(Boolean)
    .join(" | ");

  if (sellerLine) {
    doc.text(sellerLine, PAGE.left, 96, { width: 275 });
  }
};

const drawMetaCards = (doc, order) => {
  const y = 146;
  const cardW = 121;
  const gap = 9;
  const data = [
    ["ORDER DATE", formatDate(order.createdAt)],
    ["PAYMENT", String(order.paymentStatus || "").replaceAll("_", " ").toUpperCase()],
    ["DELIVERY DATE", formatDate(order.deliveryDate)],
    ["CURRENCY", String(order.currency || "INR").toUpperCase()],
  ];

  data.forEach(([label, value], index) => {
    const x = PAGE.left + index * (cardW + gap);
    doc.roundedRect(x, y, cardW, 54, 8).fill(COLORS.soft);

    doc
      .font("Helvetica-Bold")
      .fontSize(6.8)
      .fillColor(COLORS.muted)
      .text(label, x + 10, y + 11, { width: cardW - 20 });

    doc
      .font("Helvetica-Bold")
      .fontSize(9.2)
      .fillColor(COLORS.ink)
      .text(value || "-", x + 10, y + 28, {
        width: cardW - 20,
        ellipsis: true,
      });
  });

  doc.y = y + 72;
};

const drawAddressSection = (doc, order) => {
  const address = order.deliveryAddress || {};
  const buyerName = order.user?.name || address.fullName || "Customer";
  const buyerEmail = order.user?.email || "";

  const leftX = PAGE.left;
  const rightX = 310;
  const top = doc.y;

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.orange)
    .text("BILL TO", leftX, top);

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.orange)
    .text("DELIVER TO", rightX, top);

  const leftLines = [
    buyerName,
    buyerEmail,
    order.user?.phone || "",
  ].filter(Boolean);

  const rightLines = [
    address.fullName,
    address.phone,
    address.addressLine1,
    address.addressLine2,
    address.landmark ? `Landmark: ${address.landmark}` : "",
    [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean);

  doc
    .font("Helvetica")
    .fontSize(8.6)
    .fillColor(COLORS.ink)
    .text(leftLines.join("\n"), leftX, top + 17, {
      width: 220,
      lineGap: 3,
    });

  const leftBottom = doc.y;

  doc
    .font("Helvetica")
    .fontSize(8.6)
    .fillColor(COLORS.ink)
    .text(rightLines.join("\n"), rightX, top + 17, {
      width: 243,
      lineGap: 3,
    });

  const rightBottom = doc.y;

  if (order.checkoutMode === "quote" && order.bulkOrder) {
    const quoteLines = [
      order.bulkOrder.companyName
        ? `Company: ${order.bulkOrder.companyName}`
        : "",
      order.bulkOrder.gstNumber
        ? `Customer GSTIN: ${order.bulkOrder.gstNumber}`
        : "",
      (order.bulkOrder.deliveryLocations || []).length
        ? `Delivery plan: ${(order.bulkOrder.deliveryLocations || []).join(", ")}`
        : order.bulkOrder.addressModel
          ? `Delivery model: ${String(order.bulkOrder.addressModel).replaceAll("_", " ")}`
          : "",
    ].filter(Boolean);

    if (quoteLines.length) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(quoteLines.join("\n"), leftX, leftBottom + 7, {
          width: 220,
          lineGap: 2,
        });
    }
  }

  doc.y = Math.max(leftBottom, rightBottom, doc.y) + 18;
  drawRule(doc, doc.y);
  doc.moveDown(1.1);
};

const drawPartnerPromoBanner = (doc, order) => {
  const promo = order.partnerPromo;
  if (!promo?.code) return;

  ensurePageSpace(doc, order, 58);

  const y = doc.y;
  doc.roundedRect(PAGE.left, y, PAGE.width, 46, 9).fill(COLORS.goldSoft);

  doc
    .font("Helvetica-Bold")
    .fontSize(7.2)
    .fillColor("#8A6A13")
    .text("PARTNER PROMO", PAGE.left + 12, y + 10);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.ink)
    .text(
      `${promo.code}${promo.businessName ? ` - ${promo.businessName}` : ""}`,
      PAGE.left + 12,
      y + 23,
      { width: 330 }
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.success)
    .text(
      `${formatPercent(promo.discountPercent)} OFF | Saved ${formatMoney(
        promo.customerSavings ?? promo.discountAmount,
        order.currency
      )}`,
      365,
      y + 21,
      { width: 176, align: "right" }
    );

  doc.y = y + 58;
};

const drawTaxTable = (doc, order, taxRows) => {
  const x = {
    item: 42,
    hsn: 245,
    qty: 302,
    taxable: 335,
    gst: 411,
    tax: 451,
    amount: 505,
  };

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(PAGE.left, y - 5, PAGE.width, 25).fill(COLORS.soft);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.ink);
    doc.text("ITEM", x.item + 5, y + 3, { width: 191 });
    doc.text("HSN", x.hsn, y + 3, { width: 52 });
    doc.text("QTY", x.qty, y + 3, { width: 27, align: "right" });
    doc.text("TAXABLE", x.taxable, y + 3, { width: 70, align: "right" });
    doc.text("GST", x.gst, y + 3, { width: 34, align: "right" });
    doc.text("TAX", x.tax, y + 3, { width: 48, align: "right" });
    doc.text("TOTAL", x.amount, y + 3, { width: 48, align: "right" });
    doc.y = y + 28;
  };

  drawHeader();

  for (const row of taxRows) {
    if (doc.y + 70 > 760) {
      doc.addPage();
      drawNewPageHeader(doc, order);
      drawHeader();
    }

    const rowY = doc.y;

    doc
      .font("Helvetica")
      .fontSize(7.2)
      .fillColor(COLORS.ink)
      .text(row.description, x.item + 5, rowY, {
        width: 191,
        lineGap: 1.5,
      });

    const descBottom = doc.y;

    doc.text(row.hsnSac || "-", x.hsn, rowY, { width: 52 });
    doc.text(String(row.quantity || 0), x.qty, rowY, {
      width: 27,
      align: "right",
    });
    doc.text(formatMoney(row.taxableAmount, order.currency), x.taxable, rowY, {
      width: 70,
      align: "right",
    });
    doc.text(formatPercent(row.tax?.gstRate), x.gst, rowY, {
      width: 34,
      align: "right",
    });
    doc.text(formatMoney(row.tax?.totalTax, order.currency), x.tax, rowY, {
      width: 48,
      align: "right",
    });
    doc.text(formatMoney(row.amount, order.currency), x.amount, rowY, {
      width: 48,
      align: "right",
    });

    doc.y = Math.max(descBottom, rowY + 25) + 7;
    drawRule(doc, doc.y, "#EEEAE5", 0.5);
    doc.y += 8;
  }
};

const drawSimpleTable = (doc, order, rows) => {
  const x = {
    item: 42,
    qty: 338,
    unit: 387,
    amount: 478,
  };

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(PAGE.left, y - 5, PAGE.width, 25).fill(COLORS.soft);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.ink);
    doc.text("ITEM", x.item + 5, y + 3, { width: 280 });
    doc.text("QTY", x.qty, y + 3, { width: 38, align: "right" });
    doc.text("UNIT", x.unit, y + 3, { width: 77, align: "right" });
    doc.text("AMOUNT", x.amount, y + 3, { width: 70, align: "right" });
    doc.y = y + 28;
  };

  drawHeader();

  for (const item of rows) {
    if (doc.y + 78 > 760) {
      doc.addPage();
      drawNewPageHeader(doc, order);
      drawHeader();
    }

    const rowY = doc.y;

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLORS.ink)
      .text(item.description || "Order item", x.item + 5, rowY, {
        width: 280,
        lineGap: 2,
      });

    const descriptionBottom = doc.y;

    doc.text(String(item.quantity || 0), x.qty, rowY, {
      width: 38,
      align: "right",
    });

    doc.text(formatMoney(item.unitPrice, order.currency), x.unit, rowY, {
      width: 77,
      align: "right",
    });

    doc.text(formatMoney(item.lineTotal, order.currency), x.amount, rowY, {
      width: 70,
      align: "right",
    });

    doc.y = Math.max(descriptionBottom, rowY + 28) + 8;
    drawRule(doc, doc.y, "#EEEAE5", 0.5);
    doc.y += 8;
  }
};

const drawPersonalisation = (doc, order) => {
  const personalizedItems = (order.items || [])
    .filter(
      (item) =>
        item.itemType === "custom_hamper" &&
        item.customHamper?.personalization?.enabled
    )
    .map((item) => ({
      label:
        item.customHamper?.containerName || item.productName || "Custom Hamper",
      summary: getPersonalizationSummary(item.customHamper?.personalization),
    }))
    .filter((item) => item.summary);

  if (!personalizedItems.length) return;

  ensurePageSpace(doc, order, 110);

  const top = doc.y;
  doc.roundedRect(PAGE.left, top, PAGE.width, 30, 8).fill(COLORS.orangeSoft);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.orange)
    .text("PERSONALISATION REQUEST", PAGE.left + 12, top + 11);

  doc.y = top + 40;

  for (const item of personalizedItems) {
    ensurePageSpace(doc, order, 50);
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLORS.ink)
      .text(item.label, PAGE.left, doc.y, { width: PAGE.width });
    doc.moveDown(0.25);
    doc
      .font("Helvetica")
      .fontSize(7.6)
      .fillColor(COLORS.muted)
      .text(item.summary, {
        width: PAGE.width,
        lineGap: 1.5,
      });
    doc.moveDown(0.6);
  }
};

const drawTotals = (doc, order, { quoteCommercialLines, taxAware }) => {
  ensurePageSpace(doc, order, 240);

  const boxX = 322;
  const boxW = 231;
  const top = doc.y + 6;
  const promoAmount = Number(order.partnerPromo?.discountAmount || 0);
  const totalStoredDiscount = Number(order.discountAmount || 0);
  const catalogueDiscount = Math.max(0, totalStoredDiscount - promoAmount);

  const lines = [];

  if (quoteCommercialLines.length) {
    const commercial = order.commercialSnapshot || {};
    lines.push(["Quote subtotal", commercial.subtotal]);

    if (Number(commercial.discount || 0) > 0) {
      lines.push(["Discount", -Math.abs(Number(commercial.discount || 0))]);
    }

    if (Number(commercial.freight || 0) > 0) {
      lines.push(["Freight", commercial.freight]);
    }

    if (Number(commercial.taxAmount || 0) > 0) {
      lines.push([
        Number(commercial.taxRate || 0) > 0
          ? `Tax (${formatPercent(commercial.taxRate)})`
          : "Tax",
        commercial.taxAmount,
      ]);
    }
  } else if (taxAware) {
    lines.push(["Base subtotal", order.baseSubtotal]);

    if (catalogueDiscount > 0) {
      lines.push(["Catalogue discount", -catalogueDiscount, COLORS.success]);
    }

    if (promoAmount > 0) {
      lines.push([
        `Partner promo ${order.partnerPromo?.code || ""}`.trim(),
        -promoAmount,
        COLORS.success,
      ]);
    }

    lines.push(["Taxable amount", order.taxableAmount]);

    if (Number(order.taxSummary?.cgstAmount || 0) > 0) {
      lines.push(["CGST", order.taxSummary.cgstAmount]);
    }
    if (Number(order.taxSummary?.sgstAmount || 0) > 0) {
      lines.push(["SGST", order.taxSummary.sgstAmount]);
    }
    if (Number(order.taxSummary?.igstAmount || 0) > 0) {
      lines.push(["IGST", order.taxSummary.igstAmount]);
    }
    if (
      Number(order.taxSummary?.totalTax || 0) > 0 &&
      !Number(order.taxSummary?.cgstAmount || 0) &&
      !Number(order.taxSummary?.sgstAmount || 0) &&
      !Number(order.taxSummary?.igstAmount || 0)
    ) {
      lines.push(["GST", order.taxSummary.totalTax]);
    }

    lines.push(["Items incl. GST", order.subtotal]);
    lines.push(["Shipping", order.shippingAmount]);
  } else {
    lines.push(["Subtotal", order.subtotal]);

    if (catalogueDiscount > 0) {
      lines.push(["Catalogue discount", -catalogueDiscount, COLORS.success]);
    }

    if (promoAmount > 0) {
      lines.push([
        `Partner promo ${order.partnerPromo?.code || ""}`.trim(),
        -promoAmount,
        COLORS.success,
      ]);
    }

    lines.push(["Shipping", order.shippingAmount]);
  }

  const boxH = 38 + lines.length * 22 + 48;
  doc.roundedRect(boxX, top, boxW, boxH, 10).fill(COLORS.soft);

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("PAYMENT SUMMARY", boxX + 14, top + 14);

  let y = top + 38;

  for (const [label, value, color] of lines) {
    doc
      .font("Helvetica")
      .fontSize(8.2)
      .fillColor(COLORS.muted)
      .text(label, boxX + 14, y, { width: 116 });

    doc
      .font("Helvetica-Bold")
      .fontSize(8.2)
      .fillColor(color || COLORS.ink)
      .text(formatMoney(value, order.currency), boxX + 130, y, {
        width: boxW - 144,
        align: "right",
      });

    y += 22;
  }

  doc
    .moveTo(boxX + 14, y + 1)
    .lineTo(boxX + boxW - 14, y + 1)
    .lineWidth(0.8)
    .strokeColor(COLORS.line)
    .stroke();

  y += 15;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.ink)
    .text("TOTAL", boxX + 14, y + 3, { width: 70 });

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(COLORS.orange)
    .text(formatMoney(order.totalAmount, order.currency), boxX + 88, y, {
      width: boxW - 102,
      align: "right",
    });

  doc.y = top + boxH + 20;
};

const drawPaymentAndFooter = (doc, order, seller, taxAware) => {
  ensurePageSpace(doc, order, 150);

  const payment = order.payment || {};
  const top = doc.y;

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.orange)
    .text("PAYMENT DETAILS", PAGE.left, top);

  const paymentLines = [
    `Status: ${String(order.paymentStatus || "").toUpperCase()}`,
    `Paid on: ${formatDate(order.paidAt)}`,
    payment.method ? `Method: ${payment.method}` : "",
    payment.razorpayPaymentId
      ? `Transaction ID: ${payment.razorpayPaymentId}`
      : "",
  ].filter(Boolean);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.ink)
    .text(paymentLines.join("\n"), PAGE.left, top + 17, {
      width: 290,
      lineGap: 3,
    });

  if (order.partnerPromo?.code) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor("#8A6A13")
      .text("PARTNER ATTRIBUTION", 360, top);

    doc
      .font("Helvetica")
      .fontSize(7.8)
      .fillColor(COLORS.ink)
      .text(
        `${order.partnerPromo.code}${
          order.partnerPromo.businessName
            ? `\n${order.partnerPromo.businessName}`
            : ""
        }`,
        360,
        top + 17,
        { width: 193, align: "right", lineGap: 3 }
      );
  }

  doc.y = Math.max(doc.y, top + 74);
  drawRule(doc, doc.y);
  doc.y += 12;

  const sellerStateConfigured = Boolean(
    String(process.env.HAMPORIUM_GST_STATE || "").trim()
  );

  const taxNote = taxAware
    ? sellerStateConfigured
      ? "GST values are generated from the immutable order snapshot. Later catalogue tax changes do not alter this invoice."
      : "GST total is stored on this order. Configure HAMPORIUM_GST_STATE to classify future taxable orders as CGST/SGST or IGST."
    : "This invoice reflects the commercial values stored on the order. No tax breakup is invented when a stored tax snapshot is unavailable.";

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text(taxNote, PAGE.left, doc.y, {
      width: PAGE.width,
      align: "center",
      lineGap: 2,
    });

  doc.moveDown(1.2);

  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(COLORS.ink)
    .text("Thank you for gifting with HAMPORIUM.", PAGE.left, doc.y, {
      width: PAGE.width,
      align: "center",
    });

  const support = [seller.supportEmail, seller.supportPhone]
    .filter(Boolean)
    .join(" | ");

  if (support) {
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(support, PAGE.left, doc.y + 13, {
        width: PAGE.width,
        align: "center",
      });
  }
};

export const streamOrderInvoicePdf = ({ order, res }) => {
  const seller = {
    name: process.env.HAMPORIUM_BUSINESS_NAME || "HAMPORIUM",
    address: process.env.HAMPORIUM_BUSINESS_ADDRESS || "",
    gstin: process.env.HAMPORIUM_GSTIN || "",
    supportEmail: process.env.HAMPORIUM_SUPPORT_EMAIL || "",
    supportPhone: process.env.HAMPORIUM_SUPPORT_PHONE || "",
  };

  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 42,
      right: 42,
      bottom: 42,
      left: 42,
    },
    info: {
      Title: `HAMPORIUM Invoice ${order.invoiceNumber}`,
      Author: seller.name,
      Subject: `Invoice for order ${order.orderNumber}`,
    },
  });

  const safeFilename = String(
    order.invoiceNumber || order.orderNumber || "invoice"
  )
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 100);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeFilename}.pdf"`
  );
  res.setHeader("Cache-Control", "private, no-store");

  doc.pipe(res);

  drawInvoiceHeader(doc, order, seller);
  drawMetaCards(doc, order);
  drawAddressSection(doc, order);
  drawPartnerPromoBanner(doc, order);

  const quoteCommercialLines = getQuoteCommercialLines(order);
  const taxRows = collectTaxRows(order);
  const taxAware =
    quoteCommercialLines.length === 0 &&
    hasStoredTaxBreakup(order) &&
    taxRows.length > 0;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.ink)
    .text("ORDER ITEMS", PAGE.left, doc.y);

  doc.y += 16;

  if (taxAware) {
    drawTaxTable(doc, order, taxRows);
  } else {
    const invoiceLines = quoteCommercialLines.length
      ? quoteCommercialLines
      : (order.items || []).map((item) => ({
          description: getItemDescription(item),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        }));

    drawSimpleTable(doc, order, invoiceLines);
  }

  drawPersonalisation(doc, order);
  drawTotals(doc, order, { quoteCommercialLines, taxAware });
  drawPaymentAndFooter(doc, order, seller, taxAware);

  doc.end();
};
