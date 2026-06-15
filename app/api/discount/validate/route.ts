// ---------------------------------------------------------------------------
// POST /api/discount/validate
// ---------------------------------------------------------------------------
//
// Public endpoint used by the /order page when a customer clicks "Apply" on
// a discount code. It validates the code against the current basket
// (server-side pricing, not client-supplied totals) and returns either the
// computed discount amount or an error message.
//
// This is a read-only check; the usage counter is incremented later inside
// the order submission route so a code is only "burned" on a successful
// order, not on repeated apply-button clicks.

import { NextRequest, NextResponse } from "next/server";
import { validateDiscountCode } from "@/lib/discounts";
import { applyBulkPricingToItems } from "@/lib/pricing";
import type { OrderItem } from "@/lib/types";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Discount-code probing is the most attractive abuse here -- guess the
  // code, learn the discount value. 30 attempts per 5 minutes per IP is
  // forgiving for a customer typing a code repeatedly, harsh for a script
  // running through a wordlist.
  const limited = enforceRateLimit(request, {
    name: "discount-validate",
    windowMs: 5 * 60 * 1000,
    max: 30,
  });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      code?: string;
      items?: OrderItem[];
      customerEmail?: string;
    };

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        { valid: false, error: "Please enter a discount code." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { valid: false, error: "Add items to your basket first." },
        { status: 400 },
      );
    }

    // Re-price items server-side so tampered client totals can't inflate
    // the discount on a percentage code, and so bulk deals are honoured
    // when computing the eligible subtotal.
    const pricedItems = applyBulkPricingToItems(body.items);

    const customerEmail =
      typeof body.customerEmail === "string" && body.customerEmail.trim()
        ? body.customerEmail.trim()
        : undefined;

    const result = await validateDiscountCode(
      body.code,
      pricedItems,
      customerEmail,
    );
    if (!result.valid) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { valid: false, error: "Unable to validate discount code." },
      { status: 500 },
    );
  }
}
