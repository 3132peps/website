// ---------------------------------------------------------------------------
// 31-32 Peptides -- DB-backed product catalogue (Phase 1+ of CMS migration)
// ---------------------------------------------------------------------------
//
// `data/products.json` was the original source of truth, with stock + price
// stored as DB overrides. To support full CRUD from the admin UI we now move
// the entire product catalogue into Postgres. The JSON file is preserved as a
// versioned snapshot used:
//   1. To seed an empty DB on first run (`seedProductsFromBaseline`)
//   2. As an emergency fallback if the DB is unreachable at request time
//      (handled in lib/products.ts, switched in Phase 2)
//
// Schema:
//   products            -- one row per product, all scalar fields + arrays
//   product_variants    -- one row per variant, FK to products on slug
//
// Notes:
// - Soft delete via `deleted_at`. List/get queries filter `deleted_at IS NULL`.
// - Display order via `position`. New products go to the bottom by default.
// - The seed is idempotent: re-running upserts every product back to its JSON
//   state, including clearing `deleted_at`. After Phase 3 ships, admins edit
//   the DB directly and the JSON becomes stale -- the seed is intended only
//   for initial migration and disaster recovery, not ongoing sync.

import { neon } from "@neondatabase/serverless";
import productsData from "@/data/products.json";
import type { BundleItem, Product, ProductVariant } from "./types";

const BASELINE = productsData as Product[];

// ---------------------------------------------------------------------------
// Database connection (mirrors lib/products.ts and lib/discounts.ts)
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
// Schema
// ---------------------------------------------------------------------------

export async function ensureProductTables(): Promise<void> {
  const sql = getSQL();

  // `CREATE TABLE IF NOT EXISTS` is not safe under concurrent execution in
  // Postgres -- two parallel calls can both pass the existence check and
  // race on inserting into pg_type, causing 23505 / 42710 errors. Wrap each
  // DDL in a swallow-on-conflict helper so the dev hot-reload + concurrent
  // first requests on a fresh DB don't poison the read path.
  await runDdlIgnoringConcurrentCreate(sql`
    CREATE TABLE IF NOT EXISTS products (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      research_context TEXT NOT NULL DEFAULT '',
      purity TEXT NOT NULL DEFAULT '',
      coa_url TEXT NOT NULL DEFAULT '',
      storage_instructions TEXT NOT NULL DEFAULT '',
      molecular_weight TEXT NOT NULL DEFAULT '',
      sequence TEXT NOT NULL DEFAULT '',
      in_stock BOOLEAN NOT NULL DEFAULT TRUE,
      images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      related_slugs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      format TEXT CHECK (format IS NULL OR format IN ('vial', 'pen', 'nasal')),
      contact_for_price BOOLEAN NOT NULL DEFAULT FALSE,
      bulk_deal TEXT,
      bulk_deal_qty INTEGER,
      bulk_deal_price NUMERIC(10,2),
      position INTEGER NOT NULL DEFAULT 0,
      deleted_at TIMESTAMPTZ,
      storefront_visible BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // storefront_visible was added after the initial schema. Use ADD COLUMN
  // IF NOT EXISTS so existing production rows keep their data and the
  // migration is idempotent across cold starts. Existing rows default to
  // TRUE so behaviour is unchanged until an admin flips an item to hidden.
  await runDdlIgnoringConcurrentCreate(sql`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS storefront_visible BOOLEAN NOT NULL DEFAULT TRUE
  `);

  // Bundle support -- `is_bundle` flags a product as an aggregator, and
  // `bundle_items` holds an ordered JSONB list of {productSlug, weight,
  // label?} entries. JSONB is the right shape because bundle items are a
  // small, fixed-cardinality list per product and we never query them
  // individually -- we always read the bundle whole and render its
  // contents. ADD COLUMN IF NOT EXISTS keeps the migration idempotent.
  await runDdlIgnoringConcurrentCreate(sql`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await runDdlIgnoringConcurrentCreate(sql`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS bundle_items JSONB NOT NULL DEFAULT '[]'::jsonb
  `);

  await runDdlIgnoringConcurrentCreate(sql`
    CREATE INDEX IF NOT EXISTS products_position_active_idx
      ON products(position) WHERE deleted_at IS NULL;
  `);
  await runDdlIgnoringConcurrentCreate(sql`
    CREATE INDEX IF NOT EXISTS products_category_active_idx
      ON products(category) WHERE deleted_at IS NULL;
  `);

  await runDdlIgnoringConcurrentCreate(sql`
    CREATE TABLE IF NOT EXISTS product_variants (
      sku TEXT PRIMARY KEY,
      product_slug TEXT NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
      weight TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await runDdlIgnoringConcurrentCreate(sql`
    CREATE INDEX IF NOT EXISTS product_variants_product_slug_idx
      ON product_variants(product_slug);
  `);

  // Sale support -- `compare_at_price` is the strikethrough/pre-sale price.
  // The variant's `price` remains the price the customer is actually charged
  // (Shopify-style), so basket maths and bulk-deal logic don't need to know
  // about sales. NULL means "no sale active". ADD COLUMN IF NOT EXISTS keeps
  // the migration idempotent and preserves existing rows.
  await runDdlIgnoringConcurrentCreate(sql`
    ALTER TABLE product_variants
      ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10,2)
  `);
}

async function runDdlIgnoringConcurrentCreate(
  promise: Promise<unknown>,
): Promise<void> {
  try {
    await promise;
  } catch (err) {
    if (isConcurrentCreateError(err)) return;
    throw err;
  }
}

function isConcurrentCreateError(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("code" in err)) {
    return false;
  }
  const code = (err as { code?: string }).code;
  // 42710 = duplicate_object  ("type X already exists")
  // 23505 = unique_violation, raised on the pg_type catalog row when two
  //         CREATE TABLE calls race
  return code === "42710" || code === "23505";
}

// ---------------------------------------------------------------------------
// Row <-> Product mapping
// ---------------------------------------------------------------------------

interface ProductRow {
  slug: string;
  name: string;
  category: string;
  description: string;
  research_context: string;
  purity: string;
  coa_url: string;
  storage_instructions: string;
  molecular_weight: string;
  sequence: string;
  in_stock: boolean;
  images: string[];
  tags: string[];
  related_slugs: string[];
  format: string | null;
  contact_for_price: boolean;
  bulk_deal: string | null;
  bulk_deal_qty: number | null;
  bulk_deal_price: string | null;
  position: number;
  storefront_visible: boolean;
  is_bundle: boolean;
  bundle_items: unknown;
}

interface VariantRow {
  sku: string;
  product_slug: string;
  weight: string;
  price: string;
  position: number;
  compare_at_price: string | null;
}

function rowToProduct(p: ProductRow, variants: ProductVariant[]): Product {
  // Postgres NUMERIC values come back as strings via @neondatabase/serverless,
  // so we coerce here once instead of leaking string-prices into callers.
  const product: Product = {
    slug: p.slug,
    name: p.name,
    category: p.category,
    description: p.description,
    researchContext: p.research_context,
    purity: p.purity,
    coaUrl: p.coa_url,
    storageInstructions: p.storage_instructions,
    molecularWeight: p.molecular_weight,
    sequence: p.sequence,
    inStock: p.in_stock,
    images: p.images,
    tags: p.tags,
    relatedSlugs: p.related_slugs,
    variants,
  };
  if (p.format) product.format = p.format as Product["format"];
  if (p.contact_for_price) product.contactForPrice = true;
  if (p.bulk_deal) product.bulkDeal = p.bulk_deal;
  if (p.bulk_deal_qty !== null) product.bulkDealQty = p.bulk_deal_qty;
  if (p.bulk_deal_price !== null) {
    product.bulkDealPrice = Number(p.bulk_deal_price);
  }
  // Carry through storefront visibility so admin UIs can render the flag.
  // Storefront-facing callers don't read this -- they query through the
  // visible-only read path -- but we keep the field on the type so a single
  // Product object is enough for both audiences.
  product.storefrontVisible = p.storefront_visible;
  // Bundle metadata. Only flag the bundle when both the boolean is set AND
  // there is at least one item -- a bundle with no items would render an
  // empty "What's included" block on the storefront, which we don't want.
  // The JSONB column round-trips as a JS array already, but we still
  // narrow it through validation here to keep the Product type honest.
  if (p.is_bundle) {
    const items = parseBundleItems(p.bundle_items);
    if (items.length > 0) {
      product.isBundle = true;
      product.bundleItems = items;
    }
  }
  return product;
}

function rowToVariant(v: VariantRow): ProductVariant {
  const variant: ProductVariant = {
    sku: v.sku,
    weight: v.weight,
    price: Number(v.price),
  };
  // Only attach the compare-at price when it is strictly higher than the
  // sale price -- otherwise there's no discount to surface and including
  // it would push the storefront UI into a "sale of nothing" state.
  if (v.compare_at_price !== null && v.compare_at_price !== undefined) {
    const cap = Number(v.compare_at_price);
    if (Number.isFinite(cap) && cap > Number(v.price)) {
      variant.compareAtPrice = cap;
    }
  }
  return variant;
}

function parseBundleItems(raw: unknown): BundleItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BundleItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const productSlug = typeof e.productSlug === "string" ? e.productSlug : "";
    const weight = typeof e.weight === "string" ? e.weight : "";
    if (!productSlug || !weight) continue;
    const item: BundleItem = { productSlug, weight };
    if (typeof e.label === "string" && e.label.trim()) {
      item.label = e.label.trim();
    }
    out.push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Read API (used in Phase 2 once we switch lib/products.ts to read from DB)
// ---------------------------------------------------------------------------

/**
 * Storefront read: returns every product that is non-deleted AND marked as
 * visible on the public storefront, ordered by display position.
 *
 * Admin-only items (those flagged `storefront_visible = FALSE`) are
 * deliberately excluded so the homepage, /products, /products/[slug], and
 * the customer order API never surface them.
 */
export async function getAllProductsFromDb(): Promise<Product[]> {
  await ensureProductTables();
  // Bootstraps an empty DB on first read so the storefront never goes dark
  // immediately after deploy. Subsequent reads short-circuit because the
  // table is no longer empty.
  await autoSeedIfEmpty();
  const sql = getSQL();

  const productRows = (await sql`
    SELECT slug, name, category, description, research_context, purity,
           coa_url, storage_instructions, molecular_weight, sequence,
           in_stock, images, tags, related_slugs, format, contact_for_price,
           bulk_deal, bulk_deal_qty, bulk_deal_price, position,
           storefront_visible, is_bundle, bundle_items
    FROM products
    WHERE deleted_at IS NULL
      AND storefront_visible = TRUE
    ORDER BY position ASC, slug ASC
  `) as ProductRow[];

  if (productRows.length === 0) return [];

  return await attachVariants(productRows);
}

/** Storefront read: one non-deleted, visible product by slug. */
export async function getProductBySlugFromDb(
  slug: string,
): Promise<Product | undefined> {
  await ensureProductTables();
  await autoSeedIfEmpty();
  const sql = getSQL();

  const productRows = (await sql`
    SELECT slug, name, category, description, research_context, purity,
           coa_url, storage_instructions, molecular_weight, sequence,
           in_stock, images, tags, related_slugs, format, contact_for_price,
           bulk_deal, bulk_deal_qty, bulk_deal_price, position,
           storefront_visible, is_bundle, bundle_items
    FROM products
    WHERE slug = ${slug}
      AND deleted_at IS NULL
      AND storefront_visible = TRUE
    LIMIT 1
  `) as ProductRow[];
  if (productRows.length === 0) return undefined;

  const variantRows = (await sql`
    SELECT sku, product_slug, weight, price, position, compare_at_price
    FROM product_variants
    WHERE product_slug = ${slug}
    ORDER BY position ASC, sku ASC
  `) as VariantRow[];

  return rowToProduct(productRows[0], variantRows.map(rowToVariant));
}

/**
 * Admin read: returns every non-deleted product including those hidden from
 * the storefront. The admin needs to see + manage the full catalogue, which
 * includes products kept around solely for manually-created (admin-side)
 * orders.
 */
export async function getAllProductsFromDbForAdmin(): Promise<Product[]> {
  await ensureProductTables();
  await autoSeedIfEmpty();
  const sql = getSQL();

  const productRows = (await sql`
    SELECT slug, name, category, description, research_context, purity,
           coa_url, storage_instructions, molecular_weight, sequence,
           in_stock, images, tags, related_slugs, format, contact_for_price,
           bulk_deal, bulk_deal_qty, bulk_deal_price, position,
           storefront_visible, is_bundle, bundle_items
    FROM products
    WHERE deleted_at IS NULL
    ORDER BY position ASC, slug ASC
  `) as ProductRow[];

  if (productRows.length === 0) return [];

  return await attachVariants(productRows);
}

/** Admin read: one non-deleted product by slug, including hidden ones. */
export async function getProductBySlugFromDbForAdmin(
  slug: string,
): Promise<Product | undefined> {
  await ensureProductTables();
  await autoSeedIfEmpty();
  const sql = getSQL();

  const productRows = (await sql`
    SELECT slug, name, category, description, research_context, purity,
           coa_url, storage_instructions, molecular_weight, sequence,
           in_stock, images, tags, related_slugs, format, contact_for_price,
           bulk_deal, bulk_deal_qty, bulk_deal_price, position,
           storefront_visible, is_bundle, bundle_items
    FROM products
    WHERE slug = ${slug} AND deleted_at IS NULL
    LIMIT 1
  `) as ProductRow[];
  if (productRows.length === 0) return undefined;

  const variantRows = (await sql`
    SELECT sku, product_slug, weight, price, position, compare_at_price
    FROM product_variants
    WHERE product_slug = ${slug}
    ORDER BY position ASC, sku ASC
  `) as VariantRow[];

  return rowToProduct(productRows[0], variantRows.map(rowToVariant));
}

// Shared variant-attachment helper used by both list reads above. We fetch
// variants in one query and group them in-memory rather than running a
// per-product query, so the catalogue list stays at two round-trips
// regardless of how many products there are.
async function attachVariants(productRows: ProductRow[]): Promise<Product[]> {
  const sql = getSQL();
  const variantRows = (await sql`
    SELECT sku, product_slug, weight, price, position, compare_at_price
    FROM product_variants
    ORDER BY product_slug ASC, position ASC, sku ASC
  `) as VariantRow[];

  const variantsBySlug = new Map<string, ProductVariant[]>();
  for (const v of variantRows) {
    const list = variantsBySlug.get(v.product_slug);
    const variant = rowToVariant(v);
    if (list) list.push(variant);
    else variantsBySlug.set(v.product_slug, [variant]);
  }

  return productRows.map((p) => rowToProduct(p, variantsBySlug.get(p.slug) ?? []));
}

// ---------------------------------------------------------------------------
// Write API (Phase 3 admin CRUD will call these)
// ---------------------------------------------------------------------------

export interface ProductWriteInput {
  slug: string;
  name: string;
  category: string;
  description: string;
  researchContext?: string;
  purity?: string;
  coaUrl?: string;
  storageInstructions?: string;
  molecularWeight?: string;
  sequence?: string;
  inStock?: boolean;
  images?: string[];
  tags?: string[];
  relatedSlugs?: string[];
  format?: "vial" | "pen" | "nasal" | null;
  contactForPrice?: boolean;
  bulkDeal?: string | null;
  bulkDealQty?: number | null;
  bulkDealPrice?: number | null;
  position?: number;
  storefrontVisible?: boolean;
  isBundle?: boolean;
  bundleItems?: BundleItem[];
  variants: ProductVariant[];
}

/**
 * Upserts a product and replaces its variants. Used by both the admin save
 * flow and the seed script. Re-running with the same input is a no-op.
 */
export async function upsertProduct(input: ProductWriteInput): Promise<void> {
  await ensureProductTables();
  const sql = getSQL();

  // Serialise bundle items to JSON. JSONB columns expect a string in the
  // wire protocol when sent through @neondatabase/serverless tagged
  // template literals, so we stringify here once.
  const bundleItemsJson = JSON.stringify(input.bundleItems ?? []);

  await sql`
    INSERT INTO products (
      slug, name, category, description, research_context,
      purity, coa_url, storage_instructions, molecular_weight, sequence,
      in_stock, images, tags, related_slugs,
      format, contact_for_price, bulk_deal, bulk_deal_qty, bulk_deal_price,
      position, storefront_visible, is_bundle, bundle_items, updated_at
    ) VALUES (
      ${input.slug}, ${input.name}, ${input.category}, ${input.description},
      ${input.researchContext ?? ""},
      ${input.purity ?? ""}, ${input.coaUrl ?? ""},
      ${input.storageInstructions ?? ""}, ${input.molecularWeight ?? ""},
      ${input.sequence ?? ""},
      ${input.inStock ?? true},
      ${input.images ?? []}, ${input.tags ?? []}, ${input.relatedSlugs ?? []},
      ${input.format ?? null}, ${input.contactForPrice ?? false},
      ${input.bulkDeal ?? null}, ${input.bulkDealQty ?? null},
      ${input.bulkDealPrice ?? null},
      ${input.position ?? 0}, ${input.storefrontVisible ?? true},
      ${input.isBundle ?? false}, ${bundleItemsJson}::jsonb, NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      research_context = EXCLUDED.research_context,
      purity = EXCLUDED.purity,
      coa_url = EXCLUDED.coa_url,
      storage_instructions = EXCLUDED.storage_instructions,
      molecular_weight = EXCLUDED.molecular_weight,
      sequence = EXCLUDED.sequence,
      in_stock = EXCLUDED.in_stock,
      images = EXCLUDED.images,
      tags = EXCLUDED.tags,
      related_slugs = EXCLUDED.related_slugs,
      format = EXCLUDED.format,
      contact_for_price = EXCLUDED.contact_for_price,
      bulk_deal = EXCLUDED.bulk_deal,
      bulk_deal_qty = EXCLUDED.bulk_deal_qty,
      bulk_deal_price = EXCLUDED.bulk_deal_price,
      position = EXCLUDED.position,
      storefront_visible = EXCLUDED.storefront_visible,
      is_bundle = EXCLUDED.is_bundle,
      bundle_items = EXCLUDED.bundle_items,
      deleted_at = NULL,
      updated_at = NOW()
  `;

  // Variant sync: upsert each variant in the input, then delete any orphans
  // from the DB whose SKU isn't in the new list. This pattern is safe under
  // concurrent calls (two seeds racing both upsert the same rows; both
  // delete the same orphans -- no duplicate-key errors) and lets the admin
  // editor add or remove variants without code changes.
  for (let i = 0; i < input.variants.length; i++) {
    const v = input.variants[i];
    // compare_at_price is only meaningful when strictly greater than price
    // (otherwise there's no sale). Anything else gets stored as NULL so the
    // storefront read path doesn't have to filter again.
    const compareAtPrice =
      typeof v.compareAtPrice === "number" &&
      Number.isFinite(v.compareAtPrice) &&
      v.compareAtPrice > v.price
        ? v.compareAtPrice
        : null;
    await sql`
      INSERT INTO product_variants (
        sku, product_slug, weight, price, position, compare_at_price,
        updated_at
      ) VALUES (
        ${v.sku}, ${input.slug}, ${v.weight}, ${v.price}, ${i},
        ${compareAtPrice}, NOW()
      )
      ON CONFLICT (sku) DO UPDATE SET
        product_slug = EXCLUDED.product_slug,
        weight = EXCLUDED.weight,
        price = EXCLUDED.price,
        position = EXCLUDED.position,
        compare_at_price = EXCLUDED.compare_at_price,
        updated_at = NOW()
    `;
  }
  const keepSkus = input.variants.map((v) => v.sku);
  await sql`
    DELETE FROM product_variants
    WHERE product_slug = ${input.slug}
      AND sku <> ALL(${keepSkus})
  `;
}

/** Updates a single product's in-stock flag. Used by the admin stock toggle. */
export async function setProductStock(
  slug: string,
  inStock: boolean,
): Promise<boolean> {
  await ensureProductTables();
  const sql = getSQL();
  const result = (await sql`
    UPDATE products SET in_stock = ${inStock}, updated_at = NOW()
    WHERE slug = ${slug} AND deleted_at IS NULL
    RETURNING slug
  `) as { slug: string }[];
  return result.length > 0;
}

/**
 * Updates a single product's storefront visibility flag. Used by the admin
 * row toggle to hide a product from the public storefront while keeping it
 * in the admin catalogue (e.g. for manual / invoice-only orders).
 */
export async function setProductStorefrontVisible(
  slug: string,
  visible: boolean,
): Promise<boolean> {
  await ensureProductTables();
  const sql = getSQL();
  const result = (await sql`
    UPDATE products SET storefront_visible = ${visible}, updated_at = NOW()
    WHERE slug = ${slug} AND deleted_at IS NULL
    RETURNING slug
  `) as { slug: string }[];
  return result.length > 0;
}

/** Updates a single variant's price. Used by the admin price editor. */
export async function setVariantPrice(
  sku: string,
  price: number,
): Promise<boolean> {
  await ensureProductTables();
  const sql = getSQL();
  const result = (await sql`
    UPDATE product_variants SET price = ${price}, updated_at = NOW()
    WHERE sku = ${sku}
    RETURNING sku
  `) as { sku: string }[];
  return result.length > 0;
}

/** Returns true if a product with this slug exists (deleted or not). */
export async function productExists(slug: string): Promise<boolean> {
  await ensureProductTables();
  const sql = getSQL();
  const rows = (await sql`
    SELECT 1 FROM products WHERE slug = ${slug} LIMIT 1
  `) as unknown[];
  return rows.length > 0;
}

/**
 * Returns the display position of a product, or null if it doesn't exist.
 * Used by the PUT route so updates don't accidentally renumber the list.
 */
export async function getProductPosition(slug: string): Promise<number | null> {
  await ensureProductTables();
  const sql = getSQL();
  const rows = (await sql`
    SELECT position FROM products WHERE slug = ${slug}
  `) as { position: number }[];
  return rows[0]?.position ?? null;
}

/** Soft-deletes a product. Variants are kept so order history still works. */
export async function softDeleteProduct(slug: string): Promise<boolean> {
  await ensureProductTables();
  const sql = getSQL();
  const result = (await sql`
    UPDATE products SET deleted_at = NOW(), updated_at = NOW()
    WHERE slug = ${slug} AND deleted_at IS NULL
    RETURNING slug
  `) as { slug: string }[];
  return result.length > 0;
}

/** Restores a soft-deleted product. */
export async function restoreProduct(slug: string): Promise<boolean> {
  await ensureProductTables();
  const sql = getSQL();
  const result = (await sql`
    UPDATE products SET deleted_at = NULL, updated_at = NOW()
    WHERE slug = ${slug} AND deleted_at IS NOT NULL
    RETURNING slug
  `) as { slug: string }[];
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export interface SeedResult {
  products: number;
  variants: number;
}

/** Returns the total number of product rows (including soft-deleted). */
export async function countProducts(): Promise<number> {
  await ensureProductTables();
  const sql = getSQL();
  const rows = (await sql`SELECT COUNT(*)::int AS n FROM products`) as {
    n: number;
  }[];
  return rows[0]?.n ?? 0;
}

/**
 * Reads the legacy stock + price override tables (created by the original
 * lib/products.ts overlay system) and applies them on top of the freshly
 * seeded products. Called only by the auto-seed path so it runs exactly
 * once: when the DB is bootstrapped for the first time after Phase 2.
 *
 * After Phase 2, admin writes go directly to `products.in_stock` and
 * `product_variants.price`, so the legacy override tables become stale.
 * They're left in place untouched as a safety net, to be dropped in a
 * follow-up cleanup commit once we've confirmed everything works.
 */
async function importLegacyOverridesIntoCatalogue(): Promise<void> {
  const sql = getSQL();

  // Stock overrides -> products.in_stock
  // Wrap in try/catch because the table may not exist on a brand new DB.
  try {
    const stockRows = (await sql`
      SELECT slug, in_stock FROM product_stock_overrides
    `) as { slug: string; in_stock: boolean }[];
    for (const row of stockRows) {
      await sql`
        UPDATE products
          SET in_stock = ${row.in_stock}, updated_at = NOW()
          WHERE slug = ${row.slug}
      `;
    }
  } catch (err) {
    // Legacy table doesn't exist on a fresh DB -- nothing to migrate.
    if (!isMissingTableError(err)) throw err;
  }

  // Price overrides -> product_variants.price
  try {
    const priceRows = (await sql`
      SELECT sku, price FROM product_variant_price_overrides
    `) as { sku: string; price: string }[];
    for (const row of priceRows) {
      await sql`
        UPDATE product_variants
          SET price = ${Number(row.price)}, updated_at = NOW()
          WHERE sku = ${row.sku}
      `;
    }
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }
}

function isMissingTableError(err: unknown): boolean {
  // Postgres error code 42P01 = undefined_table
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42P01"
  );
}

/**
 * Bootstraps an empty DB: seeds from JSON, then merges any legacy stock /
 * price overrides on top so the new catalogue starts in the same effective
 * state as the old one. Safe to call repeatedly -- the empty-table check
 * makes it a no-op once the catalogue is populated.
 *
 * Uses an in-process promise mutex so concurrent first requests in the
 * same Node process collapse onto a single seed pass. Cross-process
 * concurrency (e.g. multiple Vercel instances) is still possible, but the
 * underlying upsert pattern in `upsertProduct` handles that safely too.
 */
let inFlightSeed: Promise<boolean> | null = null;

export async function autoSeedIfEmpty(): Promise<boolean> {
  if (inFlightSeed) return inFlightSeed;
  inFlightSeed = (async () => {
    try {
      const count = await countProducts();
      if (count > 0) return false;
      await seedProductsFromBaseline();
      await importLegacyOverridesIntoCatalogue();
      return true;
    } finally {
      // Allow a future request to retry if this one threw -- but only after
      // the current promise settles, so concurrent callers still share the
      // outcome of this attempt.
      queueMicrotask(() => {
        inFlightSeed = null;
      });
    }
  })();
  return inFlightSeed;
}

/**
 * Seeds the DB from the baseline products.json file. Idempotent: every row
 * is upserted, which is exactly what we want for an initial migration or for
 * a disaster-recovery refresh from the JSON snapshot.
 *
 * NOTE: After Phase 3 ships, admins edit products directly in the DB. Running
 * this seed at that point would *overwrite* any admin edits with the JSON
 * values. The seed endpoint that calls this should be guarded accordingly.
 */
export async function seedProductsFromBaseline(): Promise<SeedResult> {
  await ensureProductTables();

  let variantCount = 0;
  for (let i = 0; i < BASELINE.length; i++) {
    const p = BASELINE[i];
    await upsertProduct({
      slug: p.slug,
      name: p.name,
      category: p.category,
      description: p.description,
      researchContext: p.researchContext,
      purity: p.purity,
      coaUrl: p.coaUrl,
      storageInstructions: p.storageInstructions,
      molecularWeight: p.molecularWeight,
      sequence: p.sequence,
      inStock: p.inStock,
      images: p.images,
      tags: p.tags,
      relatedSlugs: p.relatedSlugs,
      format: p.format ?? null,
      contactForPrice: p.contactForPrice ?? false,
      bulkDeal: p.bulkDeal ?? null,
      bulkDealQty: p.bulkDealQty ?? null,
      bulkDealPrice: p.bulkDealPrice ?? null,
      position: i,
      // The baseline JSON predates the storefront_visible flag, so seeded
      // rows default to TRUE -- the same behaviour they had before. The
      // restore script is the only place that intentionally writes FALSE.
      storefrontVisible: p.storefrontVisible ?? true,
      // Baseline JSON is always non-bundles. Bundles are admin-created.
      isBundle: p.isBundle ?? false,
      bundleItems: p.bundleItems ?? [],
      variants: p.variants,
    });
    variantCount += p.variants.length;
  }

  return { products: BASELINE.length, variants: variantCount };
}
