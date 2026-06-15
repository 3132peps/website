// ---------------------------------------------------------------------------
// /api/admin/discounts/[code] -- update or delete a single code
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import {
  getDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
} from "@/lib/discounts";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";
import type { DiscountType } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/admin/discounts/[code]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { code } = await params;
  const discount = await getDiscountCode(code);
  if (!discount) {
    return NextResponse.json(
      { error: "Discount code not found." },
      { status: 404 },
    );
  }
  return NextResponse.json(discount);
}

// PATCH /api/admin/discounts/[code] -- update fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  try {
    const { code } = await params;
    const body = (await request.json()) as {
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

    const updated = await updateDiscountCode(code, {
      type: body.type,
      value: body.value,
      minOrderValue:
        body.minOrderValue === null
          ? null
          : body.minOrderValue !== undefined
            ? Number(body.minOrderValue)
            : undefined,
      maxUsages:
        body.maxUsages === null
          ? null
          : body.maxUsages !== undefined
            ? Number(body.maxUsages)
            : undefined,
      perCustomerLimit:
        body.perCustomerLimit === null
          ? null
          : body.perCustomerLimit !== undefined
            ? Number(body.perCustomerLimit)
            : undefined,
      eligibleProducts:
        body.eligibleProducts === null
          ? null
          : Array.isArray(body.eligibleProducts)
            ? body.eligibleProducts
            : undefined,
      excludedProducts:
        body.excludedProducts === null
          ? null
          : Array.isArray(body.excludedProducts)
            ? body.excludedProducts
            : undefined,
      expiresAt:
        body.expiresAt === null
          ? null
          : body.expiresAt ?? undefined,
      active: body.active,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Discount code not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to update discount code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/admin/discounts/[code]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  const { code } = await params;
  const deleted = await deleteDiscountCode(code);
  if (!deleted) {
    return NextResponse.json(
      { error: "Discount code not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}
