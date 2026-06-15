// ---------------------------------------------------------------------------
// /api/admin/seed-products -- one-shot migration from products.json into the
// DB-backed catalogue. Idempotent in the sense that running it multiple times
// upserts every row back to the JSON state -- which means it WILL overwrite
// any admin edits made since the JSON snapshot.
//
// After Phase 3 ships and admins start editing products in the DB directly,
// running this would silently replace their work with stale JSON values.
// To avoid an accidental click wiping the catalogue, this endpoint now:
//
//   1. Requires ADMIN_ALLOW_SEED_PRODUCTS=true in the environment.
//   2. Requires an explicit `confirm: "OVERWRITE-WITH-BASELINE"` field
//      in the JSON body.
//
// Both gates have to be satisfied. The env flag is a deploy-time switch
// (turn it on, run the seed once, turn it off again); the body field is a
// runtime guard against an unintended POST. Together they make this an
// intentional, two-step action rather than an accidental click.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";
import { seedProductsFromBaseline } from "@/lib/products-db";

export const dynamic = "force-dynamic";

const REQUIRED_CONFIRMATION = "OVERWRITE-WITH-BASELINE";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  if (process.env.ADMIN_ALLOW_SEED_PRODUCTS !== "true") {
    return NextResponse.json(
      {
        error:
          "Seeding from baseline is disabled. Set ADMIN_ALLOW_SEED_PRODUCTS=true to enable, then redeploy.",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with a confirm field." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    (body as { confirm?: unknown }).confirm !== REQUIRED_CONFIRMATION
  ) {
    return NextResponse.json(
      {
        error: `Re-seeding will overwrite every product with the JSON baseline. Pass {"confirm":"${REQUIRED_CONFIRMATION}"} to proceed.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await seedProductsFromBaseline();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[seed-products]", err);
    return NextResponse.json(
      { error: "Seed failed. Check server logs." },
      { status: 500 },
    );
  }
}
