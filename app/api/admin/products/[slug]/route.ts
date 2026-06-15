// ---------------------------------------------------------------------------
// /api/admin/products/[slug]
//   PATCH  -- toggle in_stock (existing behaviour, used by the row toggle)
//   PUT    -- full product update (admin CRUD, Phase 3)
//   DELETE -- soft-delete a product (admin CRUD, Phase 3)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";
import {
  setProductStorefrontVisibility,
  setStockOverride,
} from "@/lib/products";
import {
  getProductPosition,
  productExists,
  softDeleteProduct,
  upsertProduct,
} from "@/lib/products-db";
import { parseProductBody } from "@/lib/products-validation";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// PATCH: row-level toggles (in-stock + storefront visibility)
// ---------------------------------------------------------------------------
//
// The admin product list uses this to flip both flags inline without
// re-saving the whole record. Either field is optional -- the request body
// may include just one. At least one must be present.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  const { slug } = await params;

  const exists = await productExists(slug);
  if (!exists) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      inStock?: unknown;
      storefrontVisible?: unknown;
    };

    const hasInStock = body.inStock !== undefined;
    const hasVisible = body.storefrontVisible !== undefined;

    if (!hasInStock && !hasVisible) {
      return NextResponse.json(
        { error: "Provide `inStock` or `storefrontVisible` to update." },
        { status: 400 },
      );
    }

    if (hasInStock && typeof body.inStock !== "boolean") {
      return NextResponse.json(
        { error: "`inStock` must be a boolean." },
        { status: 400 },
      );
    }
    if (hasVisible && typeof body.storefrontVisible !== "boolean") {
      return NextResponse.json(
        { error: "`storefrontVisible` must be a boolean." },
        { status: 400 },
      );
    }

    const response: { slug: string; inStock?: boolean; storefrontVisible?: boolean } = {
      slug,
    };

    if (hasInStock) {
      await setStockOverride(slug, body.inStock as boolean);
      response.inStock = body.inStock as boolean;
    }
    if (hasVisible) {
      await setProductStorefrontVisibility(
        slug,
        body.storefrontVisible as boolean,
      );
      response.storefrontVisible = body.storefrontVisible as boolean;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("[admin/products PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update product." },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT: full product update
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  const { slug } = await params;

  const exists = await productExists(slug);
  if (!exists) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseProductBody(body, { expectedSlug: slug });
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    // Preserve the existing display position. The PUT body doesn't carry
    // position (the admin form has no reorder control yet), so we look up
    // the current value and pass it through.
    const existingPosition = await getProductPosition(slug);
    await upsertProduct({
      ...parsed.input,
      position: parsed.input.position ?? existingPosition ?? 0,
    });
    return NextResponse.json({ slug });
  } catch (err) {
    console.error("[admin/products PUT]", err);
    return NextResponse.json(
      { error: "Failed to update product." },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE: soft-delete (sets deleted_at, hides from storefront)
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  const { slug } = await params;

  const ok = await softDeleteProduct(slug);
  if (!ok) {
    return NextResponse.json(
      { error: "Product not found or already deleted." },
      { status: 404 },
    );
  }

  return NextResponse.json({ slug, deleted: true });
}
