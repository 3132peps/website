// ---------------------------------------------------------------------------
// /api/admin/products
//   GET  -- list every product with merged stock + per-variant price status
//   POST -- create a new product (admin CRUD, Phase 3)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";
import { getAllProductsForAdmin, getBaselineProducts } from "@/lib/products";
import {
  countProducts,
  productExists,
  upsertProduct,
} from "@/lib/products-db";
import { parseProductBody } from "@/lib/products-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  // Admin reads include products hidden from the storefront so the admin can
  // manage the full catalogue (e.g. items kept around for manually-created
  // orders that should never appear publicly).
  const products = await getAllProductsForAdmin();
  const baseline = getBaselineProducts();
  // The admin UI only needs a minimal projection -- send just what it renders
  // to keep the payload small even as the catalogue grows. Each variant
  // carries both the effective price (current DB value) and the JSON baseline
  // price so the UI can flag rows whose price has drifted from the snapshot.
  const summary = products.map((p) => {
    const baseProduct = baseline.find((bp) => bp.slug === p.slug);
    return {
      slug: p.slug,
      name: p.name,
      category: p.category,
      image: p.images?.[0] ?? null,
      inStock: p.inStock,
      // Default to true for legacy rows that pre-date the column.
      storefrontVisible: p.storefrontVisible !== false,
      variants: p.variants.map((v) => {
        const baseVariant = baseProduct?.variants.find((bv) => bv.sku === v.sku);
        return {
          sku: v.sku,
          weight: v.weight,
          price: v.price,
          basePrice: baseVariant?.price ?? v.price,
        };
      }),
    };
  });
  return NextResponse.json(summary);
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseProductBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Reject duplicate slugs -- the underlying upsert would silently overwrite
  // the existing row, which is never what the admin meant when they hit
  // "Create new product".
  const exists = await productExists(parsed.input.slug);
  if (exists) {
    return NextResponse.json(
      { error: `A product with slug "${parsed.input.slug}" already exists.` },
      { status: 409 },
    );
  }

  // Append to the bottom of the list by default.
  const total = await countProducts();
  await upsertProduct({ ...parsed.input, position: total });

  return NextResponse.json({ slug: parsed.input.slug }, { status: 201 });
}
