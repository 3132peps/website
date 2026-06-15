import { NextRequest, NextResponse } from "next/server";
import { createOrder, getAllOrders } from "@/lib/orders";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";
import {
  getAllProductsForAdmin,
  getProductBySlugForAdmin,
} from "@/lib/products";
import { applyBulkPricingToItems, calculateSubtotal } from "@/lib/pricing";
import { saveInvoice } from "@/lib/invoices";
import { buildInvoiceNumber, generateInvoicePdf } from "@/lib/invoice-pdf";
import { sendInvoiceEmail } from "@/lib/email";
import type {
  OrderItem,
  StatusHistoryEntry,
  StoredOrder,
} from "@/lib/types";

export const dynamic = "force-dynamic";
// Invoice PDF generation + email send can take a while on large orders.
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// GET -- list every order (admin dashboard)
// ---------------------------------------------------------------------------

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const orders = await getAllOrders();
  return NextResponse.json(orders);
}

// ---------------------------------------------------------------------------
// POST -- create an order manually from the admin UI
// ---------------------------------------------------------------------------
//
// Used when the customer is paying by invoice and the admin enters the order
// on their behalf. The flow:
//   1. Validate the customer + line items, looking each item up in the
//      admin product catalogue (which includes hidden-from-storefront items
//      so we can sell pens etc. via invoice without listing them publicly).
//   2. Persist the order with status="received".
//   3. If `sendInvoice` is true (the default), generate the invoice PDF,
//      store it, email the customer, then advance the status to
//      "invoice-sent".
//
// The endpoint is admin-only, CSRF-protected by the same x-elv8-admin
// header used elsewhere, and never trusts the prices in the request body --
// they are re-derived from the catalogue for the same reason the public
// order route does.

interface AdminLineInput {
  productSlug: string;
  variantSku: string;
  quantity: number;
  // Optional manual price override (per unit) -- lets the admin charge a
  // different rate than the catalogue (custom quote, B2B pricing, etc.).
  // When omitted the live catalogue price is used. We accept this override
  // ONLY here; the public route still enforces catalogue pricing.
  unitPriceOverride?: number;
}

interface AdminOrderBody {
  customer: {
    fullName: string;
    email: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    county?: string;
    postcode: string;
  };
  items: AdminLineInput[];
  postage?: number;
  orderNotes?: string;
  // Defaults to true. When false the order is created in "received" state
  // without sending the invoice email -- handy if the admin wants to review
  // before sending.
  sendInvoice?: boolean;
}

const DEFAULT_POSTAGE = 6;

// Same generator as the public order route, kept inline so the two flows
// remain decoupled (a refactor of one shouldn't silently change the other).
function generateAdminReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  let rand = "";
  for (let i = 0; i < 2; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `PROTEIN-${ts}${rand}`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function trimmed(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseBody(body: unknown):
  | { error: string }
  | { input: AdminOrderBody } {
  if (!isObject(body)) return { error: "Request body must be a JSON object." };
  const customerRaw = body.customer;
  if (!isObject(customerRaw)) return { error: "customer is required." };

  const fullName = trimmed(customerRaw.fullName);
  const email = trimmed(customerRaw.email);
  const addressLine1 = trimmed(customerRaw.addressLine1);
  const city = trimmed(customerRaw.city);
  const postcode = trimmed(customerRaw.postcode);

  if (!fullName) return { error: "Customer full name is required." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "A valid customer email is required." };
  }
  if (!addressLine1) return { error: "Address line 1 is required." };
  if (!city) return { error: "City is required." };
  if (!postcode) return { error: "Postcode is required." };

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: "At least one line item is required." };
  }
  if (body.items.length > 50) {
    return { error: "Too many line items (max 50)." };
  }

  const items: AdminLineInput[] = [];
  for (let i = 0; i < body.items.length; i++) {
    const raw = body.items[i];
    if (!isObject(raw)) {
      return { error: `Item ${i + 1}: expected an object.` };
    }
    const productSlug = trimmed(raw.productSlug);
    const variantSku = trimmed(raw.variantSku);
    const quantity = Number(raw.quantity);
    if (!productSlug) {
      return { error: `Item ${i + 1}: productSlug is required.` };
    }
    if (!variantSku) {
      return { error: `Item ${i + 1}: variantSku is required.` };
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 1000) {
      return {
        error: `Item ${i + 1}: quantity must be a positive integer up to 1000.`,
      };
    }

    let unitPriceOverride: number | undefined;
    if (raw.unitPriceOverride !== undefined && raw.unitPriceOverride !== null) {
      const v = Number(raw.unitPriceOverride);
      if (!Number.isFinite(v) || v < 0 || v > 100_000) {
        return {
          error: `Item ${i + 1}: unitPriceOverride must be a non-negative number.`,
        };
      }
      unitPriceOverride = v;
    }

    items.push({
      productSlug,
      variantSku,
      quantity: Math.floor(quantity),
      unitPriceOverride,
    });
  }

  // Postage -- defaults to the same flat rate the storefront uses.
  let postage = DEFAULT_POSTAGE;
  if (body.postage !== undefined && body.postage !== null) {
    const v = Number(body.postage);
    if (!Number.isFinite(v) || v < 0 || v > 1_000) {
      return { error: "postage must be a non-negative number up to 1000." };
    }
    postage = v;
  }

  return {
    input: {
      customer: {
        fullName,
        email,
        phone: trimmed(customerRaw.phone) || undefined,
        addressLine1,
        addressLine2: trimmed(customerRaw.addressLine2) || undefined,
        city,
        county: trimmed(customerRaw.county) || undefined,
        postcode,
      },
      items,
      postage,
      orderNotes: trimmed(body.orderNotes) || undefined,
      sendInvoice: body.sendInvoice !== false,
    },
  };
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = parseBody(raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { input } = parsed;

  // Resolve each line item against the admin catalogue. We use the admin
  // reader so hidden-from-storefront products (e.g. pens) are reachable --
  // that's the whole point of this endpoint vs the public /api/order one.
  const products = await getAllProductsForAdmin();
  const orderItems: OrderItem[] = [];
  for (let i = 0; i < input.items.length; i++) {
    const line = input.items[i];
    const product =
      products.find((p) => p.slug === line.productSlug) ??
      // Fallback in case the catalogue cache misses a freshly-added slug.
      (await getProductBySlugForAdmin(line.productSlug));
    if (!product) {
      return NextResponse.json(
        { error: `Item ${i + 1}: product "${line.productSlug}" not found.` },
        { status: 400 },
      );
    }
    const variant = product.variants.find((v) => v.sku === line.variantSku);
    if (!variant) {
      return NextResponse.json(
        {
          error: `Item ${i + 1}: variant "${line.variantSku}" not found on product "${product.slug}".`,
        },
        { status: 400 },
      );
    }
    orderItems.push({
      productSlug: product.slug,
      productName: product.name,
      variantSku: variant.sku,
      weight: variant.weight,
      // Use the admin's override price when supplied, otherwise the live
      // catalogue price. Bulk-deal logic is applied below via
      // applyBulkPricingToItems so the admin doesn't have to reason about it.
      price:
        line.unitPriceOverride !== undefined
          ? line.unitPriceOverride
          : variant.price,
      quantity: line.quantity,
    });
  }

  // Re-derive prices and subtotal so any bulk-deal threshold the admin would
  // qualify for is honoured the same way it is on the storefront.
  const pricedItems = applyBulkPricingToItems(orderItems);
  const subtotal = calculateSubtotal(pricedItems);
  const total = subtotal + (input.postage ?? DEFAULT_POSTAGE);

  const ref = generateAdminReference();
  const now = new Date().toISOString();
  const order: StoredOrder = {
    ref,
    createdAt: now,
    updatedAt: now,
    status: "received",
    customer: input.customer,
    items: pricedItems,
    subtotal,
    postage: input.postage ?? DEFAULT_POSTAGE,
    total,
    orderNotes: input.orderNotes,
    // No customer-side checkboxes were ticked here -- the admin is creating
    // the order on the customer's behalf. We record TRUE for both so the
    // invoice / status flow doesn't get confused, and the order notes /
    // status history capture that this was admin-entered.
    ruoConfirmed: true,
    termsAccepted: true,
    statusHistory: [
      {
        status: "received",
        timestamp: now,
        note: "Order created manually via admin",
      },
    ],
  };

  await createOrder(order);

  // Optionally generate + send the invoice in the same request. We do this
  // sequentially after the order is persisted so the admin's POST returns
  // with the final status, and any email failure surfaces a clear error
  // instead of a silently-stuck "received" order.
  let invoiceNumber: string | undefined;
  let finalOrder = order;

  if (input.sendInvoice) {
    try {
      const pdfBytes = await generateInvoicePdf(order);
      invoiceNumber = buildInvoiceNumber(order.ref);

      await saveInvoice({
        orderRef: order.ref,
        invoiceNumber,
        pdf: pdfBytes,
        sent: false,
      });

      const emailResult = await sendInvoiceEmail({
        orderRef: order.ref,
        invoiceNumber,
        customerEmail: order.customer.email,
        customerName: order.customer.fullName,
        totalPrice: order.total,
        pdf: pdfBytes,
      });

      if (!emailResult.success) {
        // The order is on file with the invoice PDF -- the admin can
        // re-send from the order detail page. We surface a 502 so the
        // client knows the email step failed.
        return NextResponse.json(
          {
            order,
            invoiceNumber,
            error: `Order created and invoice generated, but the email failed: ${emailResult.error ?? "unknown error"}.`,
          },
          { status: 502 },
        );
      }

      await saveInvoice({
        orderRef: order.ref,
        invoiceNumber,
        pdf: pdfBytes,
        sent: true,
      });

      const sentEntry: StatusHistoryEntry = {
        status: "invoice-sent",
        timestamp: new Date().toISOString(),
        note: `Invoice ${invoiceNumber} emailed to ${order.customer.email}`,
      };
      finalOrder = {
        ...order,
        status: "invoice-sent",
        updatedAt: sentEntry.timestamp,
        statusHistory: [...order.statusHistory, sentEntry],
      };
      // Persist the new status so the dashboard shows the order at
      // "Invoice Sent" alongside the rest of the post-invoice queue.
      const { updateOrder } = await import("@/lib/orders");
      await updateOrder(order.ref, {
        status: "invoice-sent",
        statusHistory: finalOrder.statusHistory,
      });
    } catch (err) {
      console.error(`[admin/orders POST] Invoice send failed for ${ref}:`, err);
      return NextResponse.json(
        {
          order,
          error:
            err instanceof Error
              ? `Order created but invoice failed: ${err.message}`
              : "Order created but invoice failed.",
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(
    { order: finalOrder, invoiceNumber },
    { status: 201 },
  );
}
