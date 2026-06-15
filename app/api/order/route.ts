import { NextRequest, NextResponse } from "next/server";
import type {
  OrderItem,
  OrderFormData,
  StoredOrder,
  OrderClientMeta,
} from "@/lib/types";
import { sendOrderEmail, sendOrderConfirmation } from "@/lib/email";
import { createOrder } from "@/lib/orders";
import { applyBulkPricingToItems, calculateSubtotal } from "@/lib/pricing";
import {
  incrementDiscountUsage,
  recordDiscountRedemption,
  validateDiscountCode,
} from "@/lib/discounts";
import { getAllProducts } from "@/lib/products";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POSTAGE = 6;

function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  let rand = "";
  for (let i = 0; i < 2; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `PROTEIN-${ts}${rand}`;
}

// Pulls request metadata used as fraud signals on the admin side. IP comes
// from x-real-ip / right-most x-forwarded-for (see getClientIp). Geo headers
// are populated by Vercel's edge -- absent in local dev, so all fields are
// optional and we strip empties before persisting.
function extractClientMeta(request: NextRequest): OrderClientMeta {
  const headers = request.headers;
  const ip = getClientIp(request);
  // user-agent can be arbitrarily long if spoofed; cap to keep the JSONB
  // payload bounded.
  const ua = headers.get("user-agent")?.slice(0, 512) ?? undefined;
  const country = headers.get("x-vercel-ip-country") ?? undefined;
  const region = headers.get("x-vercel-ip-country-region") ?? undefined;
  const cityRaw = headers.get("x-vercel-ip-city") ?? undefined;
  // Vercel URL-encodes spaces in city names ("New%20York").
  const city = cityRaw ? decodeURIComponent(cityRaw) : undefined;

  const meta: OrderClientMeta = {};
  if (ip && ip !== "unknown") meta.ip = ip;
  if (ua) meta.userAgent = ua;
  if (country) meta.country = country;
  if (region) meta.region = region;
  if (city) meta.city = city;
  return meta;
}

function validatePayload(body: unknown): {
  items: OrderItem[];
  formData: OrderFormData;
  discountCode?: string;
} {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body.");
  }

  const { items, formData, discountCode } = body as {
    items?: OrderItem[];
    formData?: OrderFormData;
    discountCode?: string;
  };

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Basket is empty.");
  }

  if (!formData || typeof formData !== "object") {
    throw new Error("Missing form data.");
  }

  const { fullName, email, addressLine1, city, postcode, ruoConfirmed, termsAccepted } =
    formData;

  if (!fullName?.trim()) throw new Error("Full name is required.");
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("A valid email address is required.");
  if (!addressLine1?.trim()) throw new Error("Address line 1 is required.");
  if (!city?.trim()) throw new Error("City is required.");
  if (!postcode?.trim()) throw new Error("Postcode is required.");
  if (!ruoConfirmed) throw new Error("RUO confirmation is required.");
  if (!termsAccepted) throw new Error("Terms must be accepted.");

  return {
    items,
    formData,
    discountCode: typeof discountCode === "string" ? discountCode : undefined,
  };
}

// ---------------------------------------------------------------------------
// POST /api/order
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 10 orders per IP per 15 minutes. A real customer placing one order is
  // far below this; a script slamming the endpoint hits the wall fast.
  const limited = enforceRateLimit(request, {
    name: "order",
    windowMs: 15 * 60 * 1000,
    max: 10,
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { items, formData, discountCode } = validatePayload(body);

    // Reject baskets that include out-of-stock items. The storefront hides
    // the Add-to-Order button for OOS products but we re-check server-side
    // so a stale tab or manual POST can't bypass it.
    const liveProducts = await getAllProducts();
    const outOfStockNames = items
      .filter((item) => {
        const product = liveProducts.find((p) => p.slug === item.productSlug);
        return !product || product.inStock === false;
      })
      .map((item) => item.productName);
    if (outOfStockNames.length > 0) {
      const unique = Array.from(new Set(outOfStockNames));
      return NextResponse.json(
        {
          success: false,
          error: `The following item${unique.length > 1 ? "s are" : " is"} no longer available: ${unique.join(", ")}. Please remove ${unique.length > 1 ? "them" : "it"} and try again.`,
        },
        { status: 409 },
      );
    }

    const referenceNumber = generateReference();

    // Re-derive unit prices server-side so bulk deals (e.g. "3 for £150")
    // are honoured regardless of what the client sent. The client's basket
    // total is for display only -- this is the authoritative calculation
    // used by the stored order, the invoice PDF, and the emails.
    const pricedItems = applyBulkPricingToItems(items);
    const subtotal = calculateSubtotal(pricedItems);

    // ---- Discount code (optional) -------------------------------------
    // Validate the code against the server-side subtotal, then try to
    // atomically increment its usage counter. If either step fails, reject
    // the order with a structured discountError so the client can drop the
    // invalid code and let the customer re-submit without it.
    let discountAppliedCode: string | undefined;
    let discountAmount = 0;
    if (discountCode) {
      const validation = await validateDiscountCode(
        discountCode,
        pricedItems,
        formData.email,
      );
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: validation.error ?? "Discount code is no longer valid.",
            discountError: validation.error ?? "Discount code is no longer valid.",
          },
          { status: 400 },
        );
      }

      const incremented = await incrementDiscountUsage(
        discountCode,
        formData.email,
      );
      if (!incremented) {
        // Lost the race to another order, the code was just deactivated, or
        // the customer hit the per-customer limit between Apply and Submit.
        return NextResponse.json(
          {
            success: false,
            error: "This discount code is no longer available. Please try again.",
            discountError:
              "This discount code is no longer available. Please try again.",
          },
          { status: 409 },
        );
      }

      // Log the redemption so the per-customer limit keeps working on the
      // next order. We do this after the guarded increment so the counter
      // and the log stay consistent.
      if (validation.code) {
        await recordDiscountRedemption(
          validation.code,
          formData.email,
          referenceNumber,
        );
      }

      discountAppliedCode = validation.code;
      discountAmount = validation.discountAmount ?? 0;
    }

    const totalPrice = Math.max(0, subtotal - discountAmount) + POSTAGE;

    // Persist the order
    const now = new Date().toISOString();
    const clientMeta = extractClientMeta(request);
    const storedOrder: StoredOrder = {
      ref: referenceNumber,
      createdAt: now,
      updatedAt: now,
      status: "received",
      customer: {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2,
        city: formData.city,
        county: formData.county,
        postcode: formData.postcode,
      },
      items: pricedItems,
      subtotal,
      postage: POSTAGE,
      total: totalPrice,
      orderNotes: formData.orderNotes,
      ruoConfirmed: formData.ruoConfirmed,
      termsAccepted: formData.termsAccepted,
      statusHistory: [
        { status: "received", timestamp: now },
      ],
      discountCode: discountAppliedCode,
      discountAmount: discountAppliedCode ? discountAmount : undefined,
      clientMeta: Object.keys(clientMeta).length > 0 ? clientMeta : undefined,
    };

    await createOrder(storedOrder);

    // Attempt to send emails -- failures are non-blocking
    try {
      await Promise.allSettled([
        sendOrderEmail({
          items: pricedItems,
          formData,
          orderRef: referenceNumber,
          totalPrice,
          discountCode: discountAppliedCode,
          discountAmount: discountAppliedCode ? discountAmount : undefined,
          clientMeta: storedOrder.clientMeta,
        }),
        sendOrderConfirmation({
          items: pricedItems,
          formData,
          orderRef: referenceNumber,
          totalPrice,
          discountCode: discountAppliedCode,
          discountAmount: discountAppliedCode ? discountAmount : undefined,
        }),
      ]);
    } catch {
      console.warn("[order] Email delivery skipped or failed.");
    }

    return NextResponse.json({ success: true, referenceNumber }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    const status = err instanceof Error && message !== "An unexpected error occurred." ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
