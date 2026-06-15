// ---------------------------------------------------------------------------
// /api/admin/products/[slug]/variants/[sku]/price
// ---------------------------------------------------------------------------
//
// Lets the admin override a single variant's price (PATCH) or clear the
// override to fall back to the baseline JSON price (DELETE). Override
// storage mirrors the stock-override pattern in lib/products.ts: a tiny
// Postgres table keyed by SKU that's merged into the catalogue at request
// time, so changes surface on the next request without a redeploy.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";
import {
  clearVariantPriceOverride,
  getBaselineProducts,
  setVariantPriceOverride,
} from "@/lib/products";

export const dynamic = "force-dynamic";

function findVariant(slug: string, sku: string) {
  const product = getBaselineProducts().find((p) => p.slug === slug);
  if (!product) return { error: "Product not found." as const, status: 404 };
  const variant = product.variants.find((v) => v.sku === sku);
  if (!variant) return { error: "Variant not found." as const, status: 404 };
  return { product, variant };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; sku: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  const { slug, sku } = await params;
  const lookup = findVariant(slug, sku);
  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  try {
    const body = (await request.json()) as { price?: unknown };
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: "Price must be a non-negative number." },
        { status: 400 },
      );
    }
    // Round to 2dp server-side so we don't store £49.999999.
    const rounded = Math.round(price * 100) / 100;
    await setVariantPriceOverride(sku, rounded);
    return NextResponse.json({ slug, sku, price: rounded });
  } catch (err) {
    console.error("[admin/products variants PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update price." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; sku: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  const { slug, sku } = await params;
  const lookup = findVariant(slug, sku);
  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  try {
    await clearVariantPriceOverride(sku);
    // Return the baseline price so the client can restore the form without
    // another round-trip.
    return NextResponse.json({
      slug,
      sku,
      price: lookup.variant.price,
      reset: true,
    });
  } catch (err) {
    console.error("[admin/products variants DELETE]", err);
    return NextResponse.json(
      { error: "Failed to reset price." },
      { status: 500 },
    );
  }
}
