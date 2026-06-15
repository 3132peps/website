#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Surgically upsert the 13 new pen/nasal products (added June 2026) from the
// products.json baseline into the live DB catalogue. Only these slugs are
// touched -- every other product (including the 6 admin-added DB-only rows) is
// left exactly as-is. This is NOT a full re-seed; it never calls
// seedProductsFromBaseline and never deletes or rewrites existing products.
//
// Mirrors the column/variant logic of lib/products-db.ts -> upsertProduct so
// the rows land identically to an admin "create product" save.
//
// Idempotent: ON CONFLICT upserts, so re-running is safe.
//
// Usage:
//   node scripts/upsert-new-pens.mjs            # dry run (reads only, no writes)
//   node scripts/upsert-new-pens.mjs --commit   # actually write to the DB
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local (same parser as restore-hidden-products.mjs)
const envFile = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
for (const line of envFile.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  const k = t.slice(0, eq).trim();
  if (!process.env[k]) process.env[k] = v;
}

const COMMIT = process.argv.includes("--commit");

const NEW_SLUGS = [
  "mots-c-pen", "pt-141-pen", "cagrilintide-pen", "growth-hormone-pen",
  "tesamorelin-pen", "cjc-1295-ipamorelin-pen", "slu-pp-332-pen", "ss-31-pen",
  "melanotan-2-pen", "retatrutide-cagrilintide-pen", "limitless-pen",
  "limitless-nasal", "wolverine-nasal",
];

const jsonPath = resolve(__dirname, "..", "data", "products.json");
const all = JSON.parse(readFileSync(jsonPath, "utf8"));
const toAdd = NEW_SLUGS.map((s) => all.find((p) => p.slug === s)).filter(Boolean);

if (toAdd.length !== NEW_SLUGS.length) {
  console.error(`Expected ${NEW_SLUGS.length} products in products.json, found ${toAdd.length}. Aborting.`);
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE products
    ADD COLUMN IF NOT EXISTS storefront_visible BOOLEAN NOT NULL DEFAULT TRUE
`;

// Place new rows at the bottom of the display order.
const posRows = await sql`SELECT COALESCE(MAX(position), -1) AS maxpos FROM products WHERE deleted_at IS NULL`;
let nextPos = Number(posRows[0].maxpos) + 1;

console.log(`Mode: ${COMMIT ? "COMMIT (writing to DB)" : "DRY RUN (no writes)"}`);
console.log(`Products to upsert: ${toAdd.length}`);
console.log("");

let written = 0;
for (const p of toAdd) {
  const existing = await sql`SELECT slug FROM products WHERE slug = ${p.slug} LIMIT 1`;
  const state = existing.length ? "update" : "insert";
  const v = p.variants[0];
  console.log(`  [${state}] ${p.slug}  (£${v.price}, ${v.weight}, ${p.format})  pos=${nextPos}`);

  if (COMMIT) {
    await sql`
      INSERT INTO products (
        slug, name, category, description, research_context,
        purity, coa_url, storage_instructions, molecular_weight, sequence,
        in_stock, images, tags, related_slugs,
        format, contact_for_price, bulk_deal, bulk_deal_qty, bulk_deal_price,
        position, storefront_visible, is_bundle, bundle_items, updated_at
      ) VALUES (
        ${p.slug}, ${p.name}, ${p.category}, ${p.description}, ${p.researchContext ?? ""},
        ${p.purity ?? ""}, ${p.coaUrl ?? ""}, ${p.storageInstructions ?? ""},
        ${p.molecularWeight ?? ""}, ${p.sequence ?? ""},
        ${p.inStock ?? true}, ${p.images ?? []}, ${p.tags ?? []}, ${p.relatedSlugs ?? []},
        ${p.format ?? null}, ${p.contactForPrice ?? false},
        ${p.bulkDeal ?? null}, ${p.bulkDealQty ?? null}, ${p.bulkDealPrice ?? null},
        ${nextPos}, ${true}, ${false}, ${"[]"}::jsonb, NOW()
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
        storefront_visible = EXCLUDED.storefront_visible,
        deleted_at = NULL,
        updated_at = NOW()
    `;
    // Variant (single per product here). Mirror upsertProduct's variant sync.
    await sql`
      INSERT INTO product_variants (
        sku, product_slug, weight, price, position, compare_at_price, updated_at
      ) VALUES (
        ${v.sku}, ${p.slug}, ${v.weight}, ${v.price}, ${0}, ${null}, NOW()
      )
      ON CONFLICT (sku) DO UPDATE SET
        product_slug = EXCLUDED.product_slug,
        weight = EXCLUDED.weight,
        price = EXCLUDED.price,
        position = EXCLUDED.position,
        compare_at_price = EXCLUDED.compare_at_price,
        updated_at = NOW()
    `;
    const keepSkus = p.variants.map((x) => x.sku);
    await sql`DELETE FROM product_variants WHERE product_slug = ${p.slug} AND sku <> ALL(${keepSkus})`;
    written += 1;
  }
  nextPos += 1;
}

console.log("");
if (COMMIT) {
  const visible = await sql`SELECT COUNT(*)::int AS n FROM products WHERE deleted_at IS NULL AND storefront_visible = TRUE`;
  console.log(`Done. Upserted ${written} products. Storefront-visible total now: ${visible[0].n}`);
} else {
  console.log("Dry run complete. Re-run with --commit to write these to the DB.");
}
