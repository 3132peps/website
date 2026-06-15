// ---------------------------------------------------------------------------
// /api/admin/discounts -- list and create discount codes
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import {
  createDiscountCode,
  getAllDiscountCodes,
  normaliseCode,
  getDiscountCode,
} from "@/lib/discounts";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";
import type { DiscountType } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/admin/discounts -- list all codes
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const codes = await getAllDiscountCodes();
  return NextResponse.json(codes);
}

// POST /api/admin/discounts -- create a new code
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  try {
    const body = (await request.json()) as {
      code?: string;
      type?: DiscountType;
      value?: number;
      minOrderValue?: number | null;
      maxUsages?: number | null;
      perCustomerLimit?: number | null;
      eligibleProducts?: string[] | null;
      excludedProducts?: string[] | null;
      expiresAt?: string | null;
      active?: boolean;
    };

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json(
        { error: "Code is required." },
        { status: 400 },
      );
    }

    // Reject duplicates up front with a clearer message than the Postgres
    // unique constraint violation.
    const existing = await getDiscountCode(body.code);
    if (existing) {
      return NextResponse.json(
        { error: `A discount code named "${normaliseCode(body.code)}" already exists.` },
        { status: 409 },
      );
    }

    if (body.type !== "percent" && body.type !== "fixed") {
      return NextResponse.json(
        { error: "Type must be 'percent' or 'fixed'." },
        { status: 400 },
      );
    }
    if (typeof body.value !== "number" || !Number.isFinite(body.value) || body.value <= 0) {
      return NextResponse.json(
        { error: "Value must be a positive number." },
        { status: 400 },
      );
    }
    if (body.type === "percent" && body.value > 100) {
      return NextResponse.json(
        { error: "Percentage value cannot exceed 100." },
        { status: 400 },
      );
    }

    const created = await createDiscountCode({
      code: body.code,
      type: body.type,
      value: body.value,
      minOrderValue:
        body.minOrderValue !== null && body.minOrderValue !== undefined
          ? Number(body.minOrderValue)
          : undefined,
      maxUsages:
        body.maxUsages !== null && body.maxUsages !== undefined
          ? Number(body.maxUsages)
          : undefined,
      perCustomerLimit:
        body.perCustomerLimit !== null && body.perCustomerLimit !== undefined
          ? Number(body.perCustomerLimit)
          : undefined,
      eligibleProducts: Array.isArray(body.eligibleProducts)
        ? body.eligibleProducts
        : undefined,
      excludedProducts: Array.isArray(body.excludedProducts)
        ? body.excludedProducts
        : undefined,
      expiresAt: body.expiresAt ?? undefined,
      active: body.active ?? true,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to create discount code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
