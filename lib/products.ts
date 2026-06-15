// ---------------------------------------------------------------------------
// 31-32 Peptides -- product catalogue facade
// ---------------------------------------------------------------------------
//
// Phase 2 onwards, the catalogue lives in Postgres (`products` and
// `product_variants` tables -- see lib/products-db.ts). This file is a thin
// facade that:
//
//   1. Routes every `getAllProducts` / `getProductBySlug` call through the DB.
//   2. Falls back to the baseline `data/products.json` snapshot if the DB is
//      unreachable, so a transient Neon outage doesn't take the storefront
//      down.
//   3. Keeps the legacy `setStockOverride` / `setVariantPriceOverride` /
//      `clearVariantPriceOverride` API surface intact -- the existing admin
//      endpoints call these without knowing or caring that the storage moved
//      from the old override tables onto the main `products` /
//      `product_variants` rows. "Reset price" now means "set price back to
//      the JSON baseline value" rather than "delete the override row", but
//      the user-visible behaviour is identical.
//
// The legacy `product_stock_overrides` and `product_variant_price_overrides`
// tables are left in place untouched after Phase 2 -- their data has already
// been merged into the main catalogue by `importLegacyOverridesIntoCatalogue`
// at first cold start. They can be dropped in a follow-up cleanup commit
// once the migration is settled.

import { neon } from "@neondatabase/serverless";
import productsData from "@/data/products.json";
import type { Product } from "./types";
import {
  getAllProductsFromDb,
  getAllProductsFromDbForAdmin,
  getProductBySlugFromDb,
  getProductBySlugFromDbForAdmin,
  setProductStock,
  setProductStorefrontVisible,
  setVariantPrice,
} from "./products-db";

const BASELINE = productsData as Product[];

// ---------------------------------------------------------------------------
// Database connection (still used by the legacy override readers below)
// ---------------------------------------------------------------------------

function getSQL() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL or POSTGRES_URL environment variable is not set.",
    );
  }
  return neon(url);
}

// ---------------------------------------------------------------------------
// Public read API -- DB-backed with JSON fallback
// ---------------------------------------------------------------------------

/** Returns every product. Reads from DB; falls back to JSON on DB error. */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const fromDb = await getAllProductsFromDb();
    // An empty result here means the auto-seed is running (or the DB is in
    // an unexpected empty state). Either way, returning the baseline keeps
    // the storefront functional until the next request.
    if (fromDb.length > 0) return fromDb;
  } catch (err) {
    console.error("[products] DB read failed, falling back to baseline:", err);
  }
  return BASELINE.filter((p) => p.storefrontVisible !== false);
}

/**
 * Storefront read: returns one product by slug if it is non-deleted AND
 * marked as visible on the public storefront.
 *
 * The baseline JSON is consulted *only* when the DB throws (a real outage)
 * -- a clean "DB returned no matching row" answer must NOT fall through to
 * the baseline, because the baseline doesn't carry the storefront_visible
 * flag and would happily resurrect a product the admin has deliberately
 * hidden (e.g. the pen line kept around for invoice-only orders).
 */
export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  try {
    return await getProductBySlugFromDb(slug);
  } catch (err) {
    console.error(
      "[products] DB read failed for slug",
      slug,
      "falling back to baseline:",
      err,
    );
    return BASELINE.find(
      (p) => p.slug === slug && p.storefrontVisible !== false,
    );
  }
}

/** Synchronous baseline accessor -- the JSON snapshot. */
export function getBaselineProducts(): Product[] {
  return BASELINE;
}

// ---------------------------------------------------------------------------
// Admin read API -- includes products hidden from the storefront
// ---------------------------------------------------------------------------
//
// The storefront APIs above filter `storefront_visible = TRUE`. Admin pages
// need the full catalogue (every non-deleted row) so they can manage
// products that are intentionally kept off the public site. These admin
// helpers must NEVER be called from user-facing code paths -- doing so
// would leak hidden products to the storefront.

/** Admin: every non-deleted product, including hidden-from-storefront ones. */
export async function getAllProductsForAdmin(): Promise<Product[]> {
  try {
    const fromDb = await getAllProductsFromDbForAdmin();
    if (fromDb.length > 0) return fromDb;
  } catch (err) {
    console.error(
      "[products] Admin DB read failed, falling back to baseline:",
      err,
    );
  }
  return BASELINE;
}

/** Admin: one non-deleted product by slug, including hidden ones. */
export async function getProductBySlugForAdmin(
  slug: string,
): Promise<Product | undefined> {
  try {
    const fromDb = await getProductBySlugFromDbForAdmin(slug);
    if (fromDb) return fromDb;
  } catch (err) {
    console.error(
      "[products] Admin DB read failed for slug",
      slug,
      "falling back to baseline:",
      err,
    );
  }
  return BASELINE.find((p) => p.slug === slug);
}

/**
 * Toggle a product's storefront visibility. Re-exported through this facade
 * so admin route handlers don't have to import from products-db directly.
 */
export async function setProductStorefrontVisibility(
  slug: string,
  visible: boolean,
): Promise<void> {
  const ok = await setProductStorefrontVisible(slug, visible);
  if (!ok) {
    throw new Error(
      `Product "${slug}" not found in catalogue. The DB may not be seeded yet.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Public write API -- preserved signatures, new storage
// ---------------------------------------------------------------------------

/**
 * Toggle a product's in-stock flag. Backed by a UPDATE on `products.in_stock`.
 * Throws if the product doesn't exist (e.g. catalogue not seeded yet).
 */
export async function setStockOverride(
  slug: string,
  inStock: boolean,
): Promise<void> {
  const ok = await setProductStock(slug, inStock);
  if (!ok) {
    throw new Error(
      `Product "${slug}" not found in catalogue. The DB may not be seeded yet.`,
    );
  }
}

/**
 * Set a variant's price. Backed by an UPDATE on `product_variants.price`.
 * Throws if the variant doesn't exist.
 */
export async function setVariantPriceOverride(
  sku: string,
  price: number,
): Promise<void> {
  const ok = await setVariantPrice(sku, price);
  if (!ok) {
    throw new Error(
      `Variant "${sku}" not found in catalogue. The DB may not be seeded yet.`,
    );
  }
}

/**
 * "Reset" a variant's price to the JSON baseline value. The reset behaviour
 * is preserved for the admin UI -- the button still says "Reset" -- it's
 * just implemented now as `UPDATE price = baseline` instead of
 * `DELETE override row`.
 */
export async function clearVariantPriceOverride(sku: string): Promise<void> {
  const baselineVariant = BASELINE.flatMap((p) => p.variants).find(
    (v) => v.sku === sku,
  );
  if (!baselineVariant) {
    throw new Error(`Variant "${sku}" not present in baseline JSON.`);
  }
  const ok = await setVariantPrice(sku, baselineVariant.price);
  if (!ok) {
    throw new Error(`Variant "${sku}" not found in catalogue.`);
  }
}

// ---------------------------------------------------------------------------
// Legacy table initialisers / readers -- kept exported for compatibility
// ---------------------------------------------------------------------------
//
// Nothing inside this app calls these after Phase 2. They're left exported
// so any out-of-tree consumer (or a forgotten dynamic import) doesn't break.
// The bodies are intentionally untouched; they read the legacy override
// tables, which become stale snapshots after the first auto-seed merges
// them into the main catalogue.

export async function ensureStockOverridesTable(): Promise<void> {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS product_stock_overrides (
      slug TEXT PRIMARY KEY,
      in_stock BOOLEAN NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}

export async function ensureVariantPriceOverridesTable(): Promise<void> {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS product_variant_price_overrides (
      sku TEXT PRIMARY KEY,
      price NUMERIC(10,2) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}

interface OverrideRow {
  slug: string;
  in_stock: boolean;
}

export async function getStockOverrides(): Promise<Record<string, boolean>> {
  try {
    await ensureStockOverridesTable();
    const sql = getSQL();
    const rows = (await sql`
      SELECT slug, in_stock FROM product_stock_overrides
    `) as OverrideRow[];
    const map: Record<string, boolean> = {};
    for (const r of rows) map[r.slug] = r.in_stock;
    return map;
  } catch (err) {
    console.error("[products] Failed to load legacy stock overrides:", err);
    return {};
  }
}

interface PriceOverrideRow {
  sku: string;
  price: string;
}

export async function getVariantPriceOverrides(): Promise<
  Record<string, number>
> {
  try {
    await ensureVariantPriceOverridesTable();
    const sql = getSQL();
    const rows = (await sql`
      SELECT sku, price FROM product_variant_price_overrides
    `) as PriceOverrideRow[];
    const map: Record<string, number> = {};
    for (const r of rows) map[r.sku] = Number(r.price);
    return map;
  } catch (err) {
    console.error("[products] Failed to load legacy price overrides:", err);
    return {};
  }
}
