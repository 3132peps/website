// ---------------------------------------------------------------------------
// 31-32 Peptides -- invoice PDF generator
// ---------------------------------------------------------------------------
//
// Uses pdf-lib (pure JS, no native deps) so it runs in any Next.js runtime,
// including Vercel serverless. The invoice is A4, single-page for typical
// orders, with company header, billing details, itemised table, totals, and
// the UK bank transfer payment details. The order reference is printed as
// the payment reference the customer is asked to quote on their bank transfer.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { StoredOrder } from "./types";

// ---- Company constants ---------------------------------------------------

const COMPANY = {
  name: "31-32 Peptides",
  email: "info@31-32peptides.com",
  website: "www.31-32peptides.com",
  strapline: "UK Research Peptides",
} as const;

const BANK = {
  // TODO(31-32): replace with 31-32 Peptides Ltd bank details before go-live.
  accountName: "[PENDING — 31-32 account name]",
  sortCode: "00-00-00",
  accountNumber: "00000000",
} as const;

// Brand colours pulled from the admin UI so the PDF feels on-brand.
const BRAND_BLUE = rgb(0.145, 0.388, 0.922); // #2563EB
const BRAND_DARK = rgb(0.106, 0.165, 0.239); // #1B2A3D
const GREY_700 = rgb(0.29, 0.33, 0.38);
const GREY_500 = rgb(0.42, 0.45, 0.5);
const GREY_300 = rgb(0.8, 0.82, 0.84);
const BLACK = rgb(0, 0, 0);

// ---- Helpers -------------------------------------------------------------

// Produce a deterministic invoice number derived from the order ref so the
// admin and customer see the same identifier. Order refs like
// "PROTEIN-AB12CD" become "INV-AB12CD"; we strip the PROTEIN (or legacy
// ELV8) prefix if present.
export function buildInvoiceNumber(orderRef: string): string {
  const stripped = orderRef.replace(/^(?:PROTEIN|ELV8)[-_]?/i, "");
  return `INV-${stripped}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatMoney(value: number): string {
  return `GBP ${value.toFixed(2)}`;
}

function drawText(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
  },
): void {
  page.drawText(text, {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color ?? BLACK,
  });
}

// Wrap a string at a soft character width. pdf-lib has no built-in wrapping,
// so we use the font's width measurement to greedy-wrap on spaces.
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ---- Main generator ------------------------------------------------------

export async function generateInvoicePdf(order: StoredOrder): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${buildInvoiceNumber(order.ref)}`);
  pdf.setAuthor(COMPANY.name);
  pdf.setProducer("31-32 Peptides invoice system");
  pdf.setCreator(COMPANY.name);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // A4 in points (72 dpi): 595.28 x 841.89
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;

  // ---- Header band ------------------------------------------------------
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: BRAND_DARK,
  });

  drawText(page, COMPANY.name.toUpperCase(), {
    x: margin,
    y: height - 45,
    size: 22,
    font: bold,
    color: rgb(1, 1, 1),
  });
  drawText(page, COMPANY.strapline, {
    x: margin,
    y: height - 65,
    size: 10,
    font: regular,
    color: rgb(0.8, 0.86, 0.92),
  });
  drawText(page, COMPANY.email, {
    x: margin,
    y: height - 80,
    size: 9,
    font: regular,
    color: rgb(0.8, 0.86, 0.92),
  });

  // "INVOICE" label right-aligned in the header
  const invoiceLabel = "INVOICE";
  const invoiceLabelWidth = bold.widthOfTextAtSize(invoiceLabel, 26);
  drawText(page, invoiceLabel, {
    x: width - margin - invoiceLabelWidth,
    y: height - 55,
    size: 26,
    font: bold,
    color: rgb(1, 1, 1),
  });

  y = height - 120;

  // ---- Invoice meta (number + dates, right column) ----------------------
  const invoiceNumber = buildInvoiceNumber(order.ref);
  const metaRows: [string, string][] = [
    ["Invoice Number", invoiceNumber],
    ["Order Reference", order.ref],
    ["Issue Date", formatDate(new Date().toISOString())],
    ["Order Placed", formatDate(order.createdAt)],
  ];

  const metaColX = width - margin - 200;
  let metaY = y;
  for (const [label, value] of metaRows) {
    drawText(page, label, {
      x: metaColX,
      y: metaY,
      size: 8,
      font: regular,
      color: GREY_500,
    });
    drawText(page, value, {
      x: metaColX,
      y: metaY - 12,
      size: 10,
      font: bold,
      color: BRAND_DARK,
    });
    metaY -= 30;
  }

  // ---- Bill To (left column) -------------------------------------------
  drawText(page, "BILL TO", {
    x: margin,
    y,
    size: 8,
    font: bold,
    color: GREY_500,
  });
  let billY = y - 15;
  const billLines = [
    order.customer.fullName,
    order.customer.email,
    ...(order.customer.phone ? [order.customer.phone] : []),
    order.customer.addressLine1,
    ...(order.customer.addressLine2 ? [order.customer.addressLine2] : []),
    order.customer.city,
    ...(order.customer.county ? [order.customer.county] : []),
    order.customer.postcode,
  ];
  for (const [i, line] of billLines.entries()) {
    drawText(page, line, {
      x: margin,
      y: billY,
      size: i === 0 ? 11 : 9,
      font: i === 0 ? bold : regular,
      color: i === 0 ? BRAND_DARK : GREY_700,
    });
    billY -= i === 0 ? 15 : 12;
  }

  y = Math.min(billY, metaY) - 20;

  // ---- Items table ------------------------------------------------------
  // Header row
  page.drawRectangle({
    x: margin,
    y: y - 22,
    width: width - margin * 2,
    height: 22,
    color: BRAND_BLUE,
  });
  const headerY = y - 16;
  drawText(page, "Description", {
    x: margin + 10,
    y: headerY,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  });
  drawText(page, "Qty", {
    x: margin + 320,
    y: headerY,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  });
  drawText(page, "Unit Price", {
    x: margin + 360,
    y: headerY,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  });
  // Right-aligned "Amount"
  const amountLabel = "Amount";
  const amountLabelWidth = bold.widthOfTextAtSize(amountLabel, 9);
  drawText(page, amountLabel, {
    x: width - margin - 10 - amountLabelWidth,
    y: headerY,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  });

  y -= 22;

  // Item rows
  for (const item of order.items) {
    const rowHeight = 28;
    y -= rowHeight;

    // Thin separator
    page.drawLine({
      start: { x: margin, y: y + rowHeight },
      end: { x: width - margin, y: y + rowHeight },
      thickness: 0.5,
      color: GREY_300,
    });

    const description = `${item.productName} (${item.weight})`;
    const wrapped = wrapText(description, regular, 10, 300);
    const baseLineY = y + rowHeight - 12;

    drawText(page, wrapped[0] ?? description, {
      x: margin + 10,
      y: baseLineY,
      size: 10,
      font: bold,
      color: BRAND_DARK,
    });
    if (wrapped[1]) {
      drawText(page, wrapped[1], {
        x: margin + 10,
        y: baseLineY - 10,
        size: 8,
        font: regular,
        color: GREY_700,
      });
    } else {
      drawText(page, `SKU: ${item.variantSku}`, {
        x: margin + 10,
        y: baseLineY - 10,
        size: 7,
        font: regular,
        color: GREY_500,
      });
    }

    drawText(page, `${item.quantity}`, {
      x: margin + 325,
      y: baseLineY,
      size: 10,
      font: regular,
      color: BRAND_DARK,
    });
    drawText(page, formatMoney(item.price), {
      x: margin + 360,
      y: baseLineY,
      size: 10,
      font: regular,
      color: BRAND_DARK,
    });

    const lineTotal = item.price * item.quantity;
    const lineTotalText = formatMoney(lineTotal);
    const lineTotalWidth = bold.widthOfTextAtSize(lineTotalText, 10);
    drawText(page, lineTotalText, {
      x: width - margin - 10 - lineTotalWidth,
      y: baseLineY,
      size: 10,
      font: bold,
      color: BRAND_DARK,
    });
  }

  // Bottom separator under items
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: GREY_300,
  });

  // ---- Totals block -----------------------------------------------------
  y -= 24;
  const totalsLabelX = width - margin - 180;
  const totalsValueX = width - margin - 10;

  const drawTotalRow = (
    label: string,
    value: string,
    opts: { emphasise?: boolean } = {},
  ) => {
    const size = opts.emphasise ? 13 : 10;
    const font = opts.emphasise ? bold : regular;
    const color = opts.emphasise ? BRAND_DARK : GREY_700;
    drawText(page, label, {
      x: totalsLabelX,
      y,
      size,
      font,
      color,
    });
    const valueWidth = font.widthOfTextAtSize(value, size);
    drawText(page, value, {
      x: totalsValueX - valueWidth,
      y,
      size,
      font,
      color,
    });
    y -= opts.emphasise ? 22 : 16;
  };

  drawTotalRow("Subtotal", formatMoney(order.subtotal));
  if (order.discountCode && order.discountAmount) {
    drawTotalRow(
      `Discount (${order.discountCode})`,
      `-${formatMoney(order.discountAmount)}`,
    );
  }
  drawTotalRow("Postage (UK Tracked)", formatMoney(order.postage));

  // Emphasis line above total
  page.drawLine({
    start: { x: totalsLabelX, y: y + 6 },
    end: { x: width - margin, y: y + 6 },
    thickness: 1,
    color: BRAND_DARK,
  });
  y -= 6;

  drawTotalRow("Total Due", formatMoney(order.total), { emphasise: true });

  // ---- Payment details box ---------------------------------------------
  y -= 8;
  const boxHeight = 130;
  const boxY = y - boxHeight;
  page.drawRectangle({
    x: margin,
    y: boxY,
    width: width - margin * 2,
    height: boxHeight,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: BRAND_BLUE,
    borderWidth: 1.2,
  });

  drawText(page, "PAYMENT DETAILS -- UK BANK TRANSFER", {
    x: margin + 14,
    y: y - 18,
    size: 10,
    font: bold,
    color: BRAND_BLUE,
  });

  const payRows: [string, string][] = [
    ["Account Name", BANK.accountName],
    ["Sort Code", BANK.sortCode],
    ["Account Number", BANK.accountNumber],
    ["Payment Reference", order.ref],
  ];

  let payY = y - 38;
  for (const [label, value] of payRows) {
    drawText(page, label, {
      x: margin + 14,
      y: payY,
      size: 8,
      font: regular,
      color: GREY_500,
    });
    drawText(page, value, {
      x: margin + 140,
      y: payY,
      size: 11,
      font: bold,
      color: BRAND_DARK,
    });
    payY -= 18;
  }

  drawText(
    page,
    `Please quote "${order.ref}" as your payment reference so we can match the`,
    {
      x: margin + 14,
      y: boxY + 22,
      size: 8,
      font: regular,
      color: GREY_700,
    },
  );
  drawText(page, "payment to your order and dispatch it without delay.", {
    x: margin + 14,
    y: boxY + 10,
    size: 8,
    font: regular,
    color: GREY_700,
  });

  y = boxY - 14;

  // ---- Footer / RUO notice ---------------------------------------------
  const footerText =
    "All products supplied by 31-32 Peptides are sold strictly for research use only (RUO). Not for human consumption, diagnostic or therapeutic use. Questions? Email " +
    COMPANY.email +
    ".";
  const wrappedFooter = wrapText(footerText, regular, 8, width - margin * 2);
  let footerY = Math.max(y, margin + 20);
  for (const line of wrappedFooter) {
    drawText(page, line, {
      x: margin,
      y: footerY,
      size: 8,
      font: regular,
      color: GREY_500,
    });
    footerY -= 11;
  }

  // Page number / site URL pinned to the bottom.
  drawText(page, COMPANY.website, {
    x: margin,
    y: 24,
    size: 8,
    font: regular,
    color: GREY_500,
  });
  const pageLabel = `${invoiceNumber} -- page 1 of 1`;
  const pageLabelWidth = regular.widthOfTextAtSize(pageLabel, 8);
  drawText(page, pageLabel, {
    x: width - margin - pageLabelWidth,
    y: 24,
    size: 8,
    font: regular,
    color: GREY_500,
  });

  return pdf.save();
}
