import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

import { ORDER_PAYMENT_STATUS } from "../../constants/statuses.js";

const COLORS = {
  ink: "#1D1A17",
  text: "#342E29",
  muted: "#756C63",
  line: "#E7DED2",
  paper: "#FFFDFC",
  cream: "#FFF7EC",
  creamStrong: "#F4E6D1",
  orange: "#F47822",
  orangeDeep: "#CF5E12",
  orangeSoft: "#FFF0E5",
  gold: "#B88934",
  goldDeep: "#7D5B20",
  goldSoft: "#FFF8E7",
  success: "#2E7D5B",
  successSoft: "#EEF8F2",
  darkSoft: "#F6F2ED",
};

const PAGE = {
  width: 595.28,
  height: 841.89,
  left: 34,
  right: 561.28,
  contentWidth: 527.28,
};

const money = (value, currency = "INR") =>
  `${String(currency || "INR").toUpperCase()} ${Number(value || 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;

const percent = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? `${number}%` : "-";
};

const dateOnly = (value) => {
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

const cleanOneLine = (value, maxLength = 180) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const truncate = (value, maxLength = 90) => {
  const text = cleanOneLine(value, maxLength + 10);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
};

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

  if (!eligibleStatuses.includes(order.paymentStatus)) return order;

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

const logoCandidates = () => {
  const configured = String(process.env.HAMPORIUM_LOGO_PATH || "").trim();
  const candidates = [];

  if (configured) {
    candidates.push(
      path.isAbsolute(configured)
        ? configured
        : path.resolve(process.cwd(), configured)
    );
  }

  // Local development: process.cwd() is normally /backend.
  candidates.push(
    path.resolve(
      process.cwd(),
      "..",
      "frontend",
      "src",
      "assets",
      "images",
      "logo_dark.jpeg"
    )
  );

  // Monorepo root / alternative runtime working directories.
  candidates.push(
    path.resolve(
      process.cwd(),
      "frontend",
      "src",
      "assets",
      "images",
      "logo_dark.jpeg"
    )
  );

  candidates.push(
    path.resolve(
      process.cwd(),
      "src",
      "assets",
      "images",
      "logo_dark.jpeg"
    )
  );

  return [...new Set(candidates)];
};

const getLogoPath = () =>
  logoCandidates().find((candidate) => fs.existsSync(candidate)) || "";

const drawLogo = (doc, x, y, width = 118, height = 76) => {
  const logoPath = getLogoPath();

  if (logoPath) {
    try {
      // Keep the COMPLETE logo visible. Do not crop/clip the JPEG.
      // logo_dark.jpeg has a white canvas, so the invoice header behind it is
      // pure white as well; the canvas blends naturally without a visible box.
      doc.image(logoPath, x, y, {
        fit: [width, height],
        align: "left",
        valign: "center",
      });
      return true;
    } catch (error) {
      console.warn("Invoice logo could not be rendered:", error.message);
    }
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(19)
    .fillColor(COLORS.orangeDeep)
    .text("HAMPORIUM", x, y + 15, {
      width,
      characterSpacing: 1.1,
      align: "left",
    });

  doc
    .font("Helvetica")
    .fontSize(6.2)
    .fillColor(COLORS.goldDeep)
    .text("MORE THAN GIFTS", x, y + 41, {
      width,
      characterSpacing: 0.8,
      align: "left",
    });

  return false;
};

const line = (doc, y, color = COLORS.line, width = 0.7) => {
  doc
    .moveTo(PAGE.left, y)
    .lineTo(PAGE.right, y)
    .lineWidth(width)
    .strokeColor(color)
    .stroke();
};


const segmentLine = (doc, x1, x2, y, color = COLORS.line, width = 0.7) => {
  doc
    .moveTo(x1, y)
    .lineTo(x2, y)
    .lineWidth(width)
    .strokeColor(color)
    .stroke();
};

const roundedBox = (doc, x, y, width, height, fill, radius = 10) => {
  doc.roundedRect(x, y, width, height, radius).fill(fill);
};

const drawLabel = (doc, text, x, y, width, color = COLORS.muted) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(6.4)
    .fillColor(color)
    .text(String(text || "").toUpperCase(), x, y, {
      width,
      characterSpacing: 0.65,
    });
};

const drawValue = (
  doc,
  text,
  x,
  y,
  width,
  { size = 8.7, bold = true, color = COLORS.text, align = "left" } = {}
) => {
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(size)
    .fillColor(color)
    .text(text || "-", x, y, {
      width,
      align,
      ellipsis: true,
      lineBreak: false,
    });
};

const paymentStatusLabel = (status) =>
  String(status || "")
    .replaceAll("_", " ")
    .trim()
    .toUpperCase();

const drawStatusPill = (doc, text, x, y) => {
  const label = text || "PAID";
  const width = Math.max(58, Math.min(120, 22 + label.length * 5.1));

  roundedBox(doc, x, y, width, 22, COLORS.successSoft, 11);
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(COLORS.success)
    .text(label, x + 8, y + 7, {
      width: width - 16,
      align: "center",
      lineBreak: false,
    });

  return width;
};

const sellerAddressLine = (seller) =>
  [seller.address, seller.gstin ? `GSTIN: ${seller.gstin}` : ""]
    .filter(Boolean)
    .join(" | ");

const drawHeader = (doc, order, seller) => {
  // Pure white header lets the JPEG logo's white canvas disappear visually,
  // while the complete logo remains uncropped.
  roundedBox(doc, 24, 20, 547.28, 100, "#FFFFFF", 14);
  doc
    .roundedRect(24, 20, 547.28, 100, 14)
    .lineWidth(0.8)
    .strokeColor("#EADBC8")
    .stroke();

  doc.rect(24, 20, 6, 100).fill(COLORS.orange);
  doc.rect(30, 20, 2, 100).fill(COLORS.gold);

  // Full mark, including the horse and HAMPORIUM wordmark.
  drawLogo(doc, 43, 27, 116, 80);

  const sellerLine = sellerAddressLine(seller);
  if (sellerLine) {
    doc
      .font("Helvetica")
      .fontSize(6.2)
      .fillColor(COLORS.muted)
      .text(truncate(sellerLine, 96), 169, 91, {
        width: 160,
        height: 16,
        ellipsis: true,
        lineGap: 1,
      });
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(COLORS.ink)
    .text("TAX INVOICE", 342, 34, {
      width: 198,
      align: "right",
      lineBreak: false,
    });

  drawValue(doc, `# ${order.invoiceNumber}`, 326, 60, 214, {
    size: 7.4,
    bold: true,
    color: COLORS.goldDeep,
    align: "right",
  });

  const statusWidth = Math.max(
    58,
    Math.min(120, 22 + paymentStatusLabel(order.paymentStatus).length * 5.1)
  );
  drawStatusPill(
    doc,
    paymentStatusLabel(order.paymentStatus),
    540 - statusWidth,
    80
  );
};

const drawMetaRow = (doc, order) => {
  const y = 132;
  const gap = 8;
  const cardW = (PAGE.contentWidth - gap * 3) / 4;
  const values = [
    ["ORDER", order.orderNumber || "-"],
    ["ORDER DATE", dateOnly(order.createdAt)],
    ["INVOICE DATE", dateOnly(order.invoiceIssuedAt)],
    ["CURRENCY", String(order.currency || "INR").toUpperCase()],
  ];

  values.forEach(([label, value], index) => {
    const x = PAGE.left + index * (cardW + gap);
    roundedBox(doc, x, y, cardW, 44, COLORS.darkSoft, 8);
    drawLabel(doc, label, x + 9, y + 9, cardW - 18);
    drawValue(doc, truncate(value, 25), x + 9, y + 24, cardW - 18, {
      size: 8.2,
    });
  });
};

const addressLines = (order) => {
  const address = order.deliveryAddress || {};
  const buyerName = order.user?.name || address.fullName || "Customer";
  const buyerEmail = order.user?.email || "";
  const buyerPhone = order.user?.phone || "";

  const billTo = [buyerName, buyerEmail, buyerPhone].filter(Boolean);

  const deliveryAddress = [
    address.fullName,
    address.phone,
    [address.addressLine1, address.addressLine2].filter(Boolean).join(", "),
    [address.landmark ? `Landmark: ${address.landmark}` : ""],
    [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
    address.country,
  ]
    .flat()
    .filter(Boolean);

  return {
    billTo: billTo.slice(0, 3),
    deliverTo: deliveryAddress.slice(0, 5),
  };
};

const drawAddressBlock = (doc, order) => {
  const y = 188;
  const { billTo, deliverTo } = addressLines(order);
  const gap = 14;
  const width = (PAGE.contentWidth - gap) / 2;

  roundedBox(doc, PAGE.left, y, width, 86, COLORS.paper, 10);
  doc
    .roundedRect(PAGE.left, y, width, 86, 10)
    .lineWidth(0.7)
    .strokeColor(COLORS.line)
    .stroke();

  roundedBox(doc, PAGE.left + width + gap, y, width, 86, COLORS.paper, 10);
  doc
    .roundedRect(PAGE.left + width + gap, y, width, 86, 10)
    .lineWidth(0.7)
    .strokeColor(COLORS.line)
    .stroke();

  drawLabel(doc, "BILL TO", PAGE.left + 12, y + 12, width - 24, COLORS.orangeDeep);
  drawLabel(
    doc,
    "DELIVER TO",
    PAGE.left + width + gap + 12,
    y + 12,
    width - 24,
    COLORS.orangeDeep
  );

  doc
    .font("Helvetica")
    .fontSize(7.6)
    .fillColor(COLORS.text)
    .text(billTo.map((row) => truncate(row, 46)).join("\n"), PAGE.left + 12, y + 30, {
      width: width - 24,
      height: 46,
      lineGap: 2.2,
      ellipsis: true,
    });

  doc
    .font("Helvetica")
    .fontSize(7.4)
    .fillColor(COLORS.text)
    .text(
      deliverTo.map((row) => truncate(row, 54)).join("\n"),
      PAGE.left + width + gap + 12,
      y + 30,
      {
        width: width - 24,
        height: 46,
        lineGap: 2,
        ellipsis: true,
      }
    );
};

const getPromotionSummary = (order) => {
  const promotionSnapshots = Array.isArray(order.promotionSnapshots)
    ? order.promotionSnapshots
    : [];

  if (order.partnerPromo?.code) {
    return {
      label: "PARTNER OFFER",
      code: order.partnerPromo.code,
      name: order.partnerPromo.businessName || "Partner benefit",
      savings: Number(
        order.partnerPromo.customerSavings ?? order.partnerPromo.discountAmount ?? 0
      ),
      tone: "gold",
    };
  }

  const active = promotionSnapshots.filter(
    (promotion) => Number(promotion?.customerSavings || 0) > 0
  );

  if (!active.length) return null;

  const first = active[0];
  return {
    label: "HAMPORIUM OFFER",
    code: first.code || first.customerLabel || first.name || "OFFER",
    name:
      first.customerLabel ||
      first.name ||
      (active.length > 1 ? `${active.length} offers applied` : "Offer applied"),
    savings: roundMoney(
      active.reduce(
        (sum, promotion) => sum + Number(promotion.customerSavings || 0),
        0
      )
    ),
    tone: "orange",
  };
};

const drawOfferStrip = (doc, order) => {
  const offer = getPromotionSummary(order);
  if (!offer) return 286;

  const y = 288;
  const fill = offer.tone === "gold" ? COLORS.goldSoft : COLORS.orangeSoft;
  const accent = offer.tone === "gold" ? COLORS.goldDeep : COLORS.orangeDeep;

  roundedBox(doc, PAGE.left, y, PAGE.contentWidth, 34, fill, 8);
  drawLabel(doc, offer.label, PAGE.left + 12, y + 8, 112, accent);
  drawValue(doc, truncate(offer.code, 24), PAGE.left + 120, y + 7, 132, {
    size: 8.5,
  });
  drawValue(doc, truncate(offer.name, 42), PAGE.left + 257, y + 7, 155, {
    size: 7.6,
    bold: false,
    color: COLORS.muted,
  });

  drawValue(
    doc,
    `You saved ${money(offer.savings, order.currency)}`,
    PAGE.left + 407,
    y + 7,
    108,
    {
      size: 7.8,
      color: COLORS.success,
      align: "right",
    }
  );

  return y + 42;
};

const itemDescription = (item) => {
  if (item.itemType !== "custom_hamper") {
    return [item.productName, item.skuName].filter(Boolean).join(" - ") || "Order item";
  }

  const hamper = item.customHamper || {};
  const componentCount = (hamper.components || []).length;
  const decorationCount = (hamper.decorations || []).length;
  const personalised = hamper.personalization?.enabled;

  const details = [
    hamper.containerName || item.productName || "Custom Hamper",
    componentCount ? `${componentCount} hamper items` : "",
    decorationCount ? `${decorationCount} decorations` : "",
    personalised ? "Personalised" : "",
  ].filter(Boolean);

  return details.join(" - ");
};

const quoteRows = (order) => {
  if (
    order.checkoutMode !== "quote" ||
    !Array.isArray(order.commercialSnapshot?.lineItems) ||
    !order.commercialSnapshot.lineItems.length
  ) {
    return [];
  }

  return order.commercialSnapshot.lineItems.map((item) => ({
    description: [item.name, item.description].filter(Boolean).join(" - ") || "Quote item",
    hsnSac: "-",
    gstRate: order.commercialSnapshot?.taxRate ?? null,
    quantity: Number(item.quantity || 1),
    taxableAmount: Number(item.lineTotal || 0),
    taxAmount: 0,
    amount: Number(item.lineTotal || 0),
  }));
};

const invoiceRows = (order) => {
  const commercial = quoteRows(order);
  if (commercial.length) return commercial;

  return (order.items || []).map((item) => {
    const tax = item.tax || {};
    const custom = item.itemType === "custom_hamper";

    return {
      description: itemDescription(item),
      hsnSac: custom ? "MIXED" : tax.hsnSac || "-",
      gstRate: custom ? null : tax.gstRate ?? null,
      quantity: Math.max(1, Number(item.quantity || 1)),
      taxableAmount: Number(item.taxableAmount || 0),
      taxAmount: Number(tax.totalTax || 0),
      amount: Number(item.lineTotal || 0),
    };
  });
};

const consolidateRowsForSinglePage = (rows, maxRows = 6) => {
  if (rows.length <= maxRows) return rows;

  const visible = rows.slice(0, maxRows - 1);
  const hidden = rows.slice(maxRows - 1);

  visible.push({
    description: `Additional ${hidden.length} item${hidden.length === 1 ? "" : "s"} - consolidated for single-page invoice`,
    hsnSac: "MIXED",
    gstRate: null,
    quantity: hidden.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    taxableAmount: roundMoney(
      hidden.reduce((sum, row) => sum + Number(row.taxableAmount || 0), 0)
    ),
    taxAmount: roundMoney(
      hidden.reduce((sum, row) => sum + Number(row.taxAmount || 0), 0)
    ),
    amount: roundMoney(hidden.reduce((sum, row) => sum + Number(row.amount || 0), 0)),
  });

  return visible;
};

const drawItemsTable = (doc, order, startY) => {
  const rows = consolidateRowsForSinglePage(invoiceRows(order), 6);
  const tableX = PAGE.left;
  const tableW = PAGE.contentWidth;
  const headerH = 25;
  const rowH = rows.length >= 6 ? 28 : rows.length >= 4 ? 30 : 32;

  const columns = {
    item: { x: tableX + 8, width: 210 },
    hsn: { x: tableX + 222, width: 52 },
    qty: { x: tableX + 278, width: 31 },
    taxable: { x: tableX + 313, width: 72 },
    gst: { x: tableX + 389, width: 46 },
    total: { x: tableX + 439, width: 80 },
  };

  drawLabel(doc, "ORDER ITEMS", tableX, startY, 130, COLORS.ink);
  const y = startY + 14;

  roundedBox(doc, tableX, y, tableW, headerH, COLORS.ink, 7);
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#FFFFFF");
  doc.text("ITEM", columns.item.x, y + 9, { width: columns.item.width });
  doc.text("HSN", columns.hsn.x, y + 9, { width: columns.hsn.width });
  doc.text("QTY", columns.qty.x, y + 9, {
    width: columns.qty.width,
    align: "right",
  });
  doc.text("TAXABLE", columns.taxable.x, y + 9, {
    width: columns.taxable.width,
    align: "right",
  });
  doc.text("GST", columns.gst.x, y + 9, {
    width: columns.gst.width,
    align: "right",
  });
  doc.text("TOTAL", columns.total.x, y + 9, {
    width: columns.total.width,
    align: "right",
  });

  rows.forEach((row, index) => {
    const rowY = y + headerH + index * rowH;
    const fill = index % 2 === 0 ? COLORS.paper : "#FCFAF7";
    doc.rect(tableX, rowY, tableW, rowH).fill(fill);

    doc
      .font("Helvetica-Bold")
      .fontSize(rows.length >= 6 ? 6.55 : 6.9)
      .fillColor(COLORS.text)
      .text(truncate(row.description, rows.length >= 6 ? 58 : 66), columns.item.x, rowY + 7, {
        width: columns.item.width,
        height: rowH - 8,
        ellipsis: true,
        lineBreak: false,
      });

    doc
      .font("Helvetica")
      .fontSize(6.6)
      .fillColor(COLORS.muted)
      .text(row.hsnSac || "-", columns.hsn.x, rowY + 8, {
        width: columns.hsn.width,
        ellipsis: true,
        lineBreak: false,
      });

    doc
      .font("Helvetica")
      .fontSize(6.6)
      .fillColor(COLORS.text)
      .text(String(row.quantity || 0), columns.qty.x, rowY + 8, {
        width: columns.qty.width,
        align: "right",
        lineBreak: false,
      });

    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor(COLORS.text)
      .text(money(row.taxableAmount, order.currency), columns.taxable.x, rowY + 8, {
        width: columns.taxable.width,
        align: "right",
        lineBreak: false,
      });

    const gstText =
      row.gstRate === null || row.gstRate === undefined
        ? row.hsnSac === "MIXED"
          ? "Mixed"
          : "-"
        : percent(row.gstRate);

    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor(COLORS.muted)
      .text(gstText, columns.gst.x, rowY + 8, {
        width: columns.gst.width,
        align: "right",
        lineBreak: false,
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(6.6)
      .fillColor(COLORS.ink)
      .text(money(row.amount, order.currency), columns.total.x, rowY + 8, {
        width: columns.total.width,
        align: "right",
        lineBreak: false,
      });

    if (index < rows.length - 1) {
      line(doc, rowY + rowH, "#EEE7DE", 0.45);
    }
  });

  const endY = y + headerH + rows.length * rowH;
  doc
    .roundedRect(tableX, y, tableW, headerH + rows.length * rowH, 7)
    .lineWidth(0.65)
    .strokeColor(COLORS.line)
    .stroke();

  return endY;
};

const promotionDiscountAmount = (order) =>
  roundMoney(
    (Array.isArray(order.promotionSnapshots) ? order.promotionSnapshots : []).reduce(
      (sum, promotion) => sum + Number(promotion.discountAmount || 0),
      0
    )
  );

const summaryLines = (order, taxAware) => {
  const partner = Number(order.partnerPromo?.discountAmount || 0);
  const promotion = promotionDiscountAmount(order);
  const storedDiscount = Number(order.discountAmount || 0);
  const catalogue = Math.max(0, storedDiscount - partner - promotion);
  const lines = [];

  if (order.checkoutMode === "quote" && order.commercialSnapshot) {
    const commercial = order.commercialSnapshot;
    lines.push(["Subtotal", Number(commercial.subtotal || 0)]);
    if (Number(commercial.discount || 0) > 0) {
      lines.push(["Discount", -Math.abs(Number(commercial.discount || 0)), COLORS.success]);
    }
    if (Number(commercial.freight || 0) > 0) {
      lines.push(["Freight", Number(commercial.freight || 0)]);
    }
    if (Number(commercial.taxAmount || 0) > 0) {
      lines.push(["Tax", Number(commercial.taxAmount || 0)]);
    }
    return lines;
  }

  lines.push([taxAware ? "Base subtotal" : "Subtotal", Number(order.baseSubtotal ?? order.subtotal ?? 0)]);

  if (catalogue > 0) {
    lines.push(["Catalogue discount", -catalogue, COLORS.success]);
  }

  if (promotion > 0) {
    lines.push(["Promotion", -promotion, COLORS.success]);
  }

  if (partner > 0) {
    lines.push(["Partner offer", -partner, COLORS.success]);
  }

  if (taxAware) {
    lines.push(["Taxable amount", Number(order.taxableAmount || 0)]);
    if (Number(order.taxSummary?.totalTax || 0) > 0) {
      lines.push(["GST", Number(order.taxSummary.totalTax || 0)]);
    }
  }

  if (Number(order.shippingAmount || 0) > 0) {
    lines.push(["Shipping", Number(order.shippingAmount || 0)]);
  } else {
    lines.push(["Shipping", 0, COLORS.success, "FREE"]);
  }

  return lines;
};

const hasStoredTaxBreakup = (order) =>
  Boolean(
    order.taxSummary &&
      order.taxableAmount !== undefined &&
      order.taxAmount !== undefined
  );

const drawBottomPanel = (doc, order, seller, tableEndY) => {
  const footerY = 806;
  const top = tableEndY + 14;
  const panelH = Math.max(214, footerY - top - 18);
  const leftW = 254;
  const gap = 14;
  const rightX = PAGE.left + leftW + gap;
  const rightW = PAGE.contentWidth - leftW - gap;
  const taxAware = hasStoredTaxBreakup(order);
  const payment = order.payment || {};

  roundedBox(doc, PAGE.left, top, leftW, panelH, "#FFFFFF", 11);
  doc
    .roundedRect(PAGE.left, top, leftW, panelH, 11)
    .lineWidth(0.7)
    .strokeColor(COLORS.line)
    .stroke();

  roundedBox(doc, rightX, top, rightW, panelH, COLORS.cream, 11);
  doc
    .roundedRect(rightX, top, rightW, panelH, 11)
    .lineWidth(0.7)
    .strokeColor("#E8D7BC")
    .stroke();

  // LEFT PANEL -----------------------------------------------------------
  drawLabel(doc, "PAYMENT DETAILS", PAGE.left + 14, top + 14, leftW - 28, COLORS.orangeDeep);

  const paymentRows = [
    ["Status", paymentStatusLabel(order.paymentStatus) || "-"],
    ["Paid on", dateOnly(order.paidAt)],
    ["Method", payment.method || "Online payment"],
    ["Transaction", payment.razorpayPaymentId || payment.transactionId || "-"],
  ];

  const leftInnerX = PAGE.left + 14;
  const leftInnerRight = PAGE.left + leftW - 14;
  let py = top + 35;
  const compactLeft = panelH < 250;
  const paymentStep = compactLeft ? 16 : 18;

  paymentRows.forEach(([label, value]) => {
    drawValue(doc, label, leftInnerX, py, 72, {
      size: 6.5,
      bold: false,
      color: COLORS.muted,
    });
    drawValue(doc, truncate(value, compactLeft ? 30 : 36), leftInnerX + 76, py, leftW - 104, {
      size: 6.7,
      color: COLORS.text,
      align: "right",
    });
    py += paymentStep;
  });

  segmentLine(doc, leftInnerX, leftInnerRight, py + 3, COLORS.line, 0.55);
  py += 15;
  drawLabel(doc, "ORDER & DELIVERY", leftInnerX, py, leftW - 28, COLORS.goldDeep);
  py += 17;

  const address = order.deliveryAddress || {};
  const deliveryRows = [
    ["Checkout", String(order.checkoutMode || "retail").replaceAll("_", " ")],
    ["Delivery", dateOnly(order.deliveryDate)],
    ["Pincode", address.postalCode || "-"],
    ["City", [address.city, address.state].filter(Boolean).join(", ") || "-"],
  ];

  const deliveryStep = compactLeft ? 15 : 17;
  deliveryRows.forEach(([label, value]) => {
    drawValue(doc, label, leftInnerX, py, 74, {
      size: 6.5,
      bold: false,
      color: COLORS.muted,
    });
    drawValue(doc, truncate(value, compactLeft ? 28 : 34), leftInnerX + 76, py, leftW - 104, {
      size: 6.6,
      color: COLORS.text,
      align: "right",
    });
    py += deliveryStep;
  });

  // GST summary only when there is enough vertical room; never let it collide
  // with the issuer block pinned to the bottom of the panel.
  const issuerTop = top + panelH - 54;
  const gstRows = [];
  if (taxAware) {
    [
      ["CGST", Number(order.taxSummary?.cgstAmount || 0)],
      ["SGST", Number(order.taxSummary?.sgstAmount || 0)],
      ["IGST", Number(order.taxSummary?.igstAmount || 0)],
    ].forEach((row) => {
      if (row[1] > 0) gstRows.push(row);
    });
    if (!gstRows.length && Number(order.taxSummary?.totalTax || 0) > 0) {
      gstRows.push(["GST", Number(order.taxSummary.totalTax || 0)]);
    }
  }

  if (gstRows.length && py + 18 + gstRows.length * 15 < issuerTop - 8) {
    segmentLine(doc, leftInnerX, leftInnerRight, py + 3, COLORS.line, 0.55);
    py += 15;
    drawLabel(doc, "GST SUMMARY", leftInnerX, py, leftW - 28, COLORS.goldDeep);
    py += 16;
    gstRows.slice(0, 3).forEach(([label, amount]) => {
      drawValue(doc, label, leftInnerX, py, 72, {
        size: 6.4,
        bold: false,
        color: COLORS.muted,
      });
      drawValue(doc, money(amount, order.currency), leftInnerX + 76, py, leftW - 104, {
        size: 6.6,
        color: COLORS.text,
        align: "right",
      });
      py += 15;
    });
  }

  const support = [seller.supportEmail, seller.supportPhone].filter(Boolean).join(" | ");
  segmentLine(doc, leftInnerX, leftInnerRight, issuerTop - 9, COLORS.line, 0.55);
  drawLabel(doc, "INVOICE ISSUED BY", leftInnerX, issuerTop, leftW - 28, COLORS.orangeDeep);
  drawValue(doc, seller.name || "HAMPORIUM", leftInnerX, issuerTop + 13, leftW - 28, {
    size: 7.2,
    color: COLORS.ink,
  });
  if (support) {
    doc
      .font("Helvetica")
      .fontSize(6.0)
      .fillColor(COLORS.muted)
      .text(truncate(support, 66), leftInnerX, issuerTop + 27, {
        width: leftW - 28,
        ellipsis: true,
        lineBreak: false,
      });
  }

  // RIGHT PANEL ----------------------------------------------------------
  drawLabel(doc, "PAYMENT SUMMARY", rightX + 15, top + 14, rightW - 30, COLORS.goldDeep);

  const summary = summaryLines(order, taxAware).slice(0, 8);
  const summaryStart = top + 37;
  const totalDividerY = top + panelH - 70;
  const summaryEndLimit = totalDividerY - 12;
  const availableSummaryH = Math.max(60, summaryEndLimit - summaryStart);
  const lineStep = summary.length
    ? Math.max(11.5, Math.min(18, availableSummaryH / summary.length))
    : 14;

  let sy = summaryStart;
  summary.forEach(([label, value, color, overrideText]) => {
    drawValue(doc, label, rightX + 15, sy, 116, {
      size: 6.7,
      bold: false,
      color: COLORS.muted,
    });
    drawValue(
      doc,
      overrideText || money(value, order.currency),
      rightX + 126,
      sy,
      rightW - 141,
      {
        size: 6.8,
        color: color || COLORS.text,
        align: "right",
      }
    );
    sy += lineStep;
  });

  const offer = getPromotionSummary(order);
  const totalDiscount = Math.max(0, Number(order.discountAmount || 0));
  const savingValue = Number(offer?.savings || totalDiscount || 0);

  if (savingValue > 0 && sy + 25 <= totalDividerY - 6) {
    const saveY = Math.min(sy + 4, totalDividerY - 30);
    roundedBox(doc, rightX + 14, saveY, rightW - 28, 25, COLORS.successSoft, 7);
    drawLabel(doc, "YOU SAVED", rightX + 24, saveY + 8, 70, COLORS.success);
    drawValue(doc, money(savingValue, order.currency), rightX + 94, saveY + 7, rightW - 118, {
      size: 7.4,
      color: COLORS.success,
      align: "right",
    });
  }

  // IMPORTANT: divider belongs only to the summary panel. The previous
  // full-width rule was the source of visible lines crossing/overlapping text.
  segmentLine(doc, rightX + 14, rightX + rightW - 14, totalDividerY, "#DCC9AB", 0.8);

  drawValue(doc, "TOTAL PAID", rightX + 15, totalDividerY + 15, 88, {
    size: 8.2,
    color: COLORS.ink,
  });
  drawValue(doc, money(order.totalAmount, order.currency), rightX + 98, totalDividerY + 10, rightW - 113, {
    size: 12.6,
    color: COLORS.orangeDeep,
    align: "right",
  });

  doc
    .font("Helvetica")
    .fontSize(5.9)
    .fillColor(COLORS.muted)
    .text(
      "Values are locked from the paid order snapshot. Later catalogue or pricing changes do not alter this invoice.",
      rightX + 15,
      top + panelH - 27,
      {
        width: rightW - 30,
        align: "right",
        lineGap: 1,
        height: 16,
        ellipsis: true,
      }
    );

  // Footer ---------------------------------------------------------------
  roundedBox(doc, PAGE.left, footerY - 2, PAGE.contentWidth, 24, COLORS.ink, 8);
  doc
    .font("Helvetica-Bold")
    .fontSize(7.6)
    .fillColor("#FFFFFF")
    .text("THANK YOU FOR GIFTING WITH HAMPORIUM", PAGE.left + 14, footerY + 6, {
      width: 280,
      characterSpacing: 0.35,
      lineBreak: false,
    });

  doc
    .font("Helvetica")
    .fontSize(6.2)
    .fillColor("#D8D1C9")
    .text(support || "HAMPORIUM", PAGE.left + 300, footerY + 7, {
      width: PAGE.contentWidth - 314,
      align: "right",
      ellipsis: true,
      lineBreak: false,
    });
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
    autoFirstPage: true,
    margins: {
      top: 22,
      right: 24,
      bottom: 16,
      left: 24,
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

  // This layout intentionally uses fixed vertical regions and never calls
  // doc.addPage(). Large item lists are consolidated into a final summary row
  // so the customer invoice remains a polished single A4 page.
  drawHeader(doc, order, seller);
  drawMetaRow(doc, order);
  drawAddressBlock(doc, order);
  const itemsStartY = drawOfferStrip(doc, order);
  const tableEndY = drawItemsTable(doc, order, itemsStartY);
  drawBottomPanel(doc, order, seller, tableEndY);

  doc.end();
};
