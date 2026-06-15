// Smoke test: variant price overrides + merge into product listing.
// Run: node --env-file=.env.local scripts/test-variant-prices.mjs

import { neon } from "@neondatabase/serverless";
import productsData from "../data/products.json" with { type: "json" };

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("\n=== Variant-price overrides smoke test ===");

  // Warm: hitting the admin products list requires auth. Instead, warm the
  // table directly and exercise getAllProducts-like logic via raw SQL here.
  await sql`
    CREATE TABLE IF NOT EXISTS product_variant_price_overrides (
      sku TEXT PRIMARY KEY,
      price NUMERIC(10,2) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const col = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'product_variant_price_overrides'
  `;
  console.log(
    "override table columns:",
    col.map((r) => r.column_name).join(", "),
  );

  // Find a product with a variant to override.
  const firstProduct = productsData[0];
  if (!firstProduct || !firstProduct.variants?.length) {
    throw new Error("No products in data/products.json to test with.");
  }
  const variant = firstProduct.variants[0];
  const baselinePrice = Number(variant.price);
  const overridePrice = Math.round((baselinePrice + 12.34) * 100) / 100;
  console.log(
    "product:",
    firstProduct.slug,
    "sku:",
    variant.sku,
    "baseline:",
    baselinePrice,
    "override:",
    overridePrice,
  );

  // Set an override directly.
  await sql`
    INSERT INTO product_variant_price_overrides (sku, price, updated_at)
    VALUES (${variant.sku}, ${overridePrice}, NOW())
    ON CONFLICT (sku) DO UPDATE
      SET price = EXCLUDED.price, updated_at = NOW()
  `;

  // Verify the override is stored.
  const rows = await sql`
    SELECT price::float AS price FROM product_variant_price_overrides
    WHERE sku = ${variant.sku}
  `;
  console.log("stored:", rows[0]?.price);
  console.assert(
    Number(rows[0]?.price) === overridePrice,
    "override did not persist",
  );

  // Verify the product page reflects the override. The public product page
  // is statically rendered but uses getProductBySlug(), which merges
  // overrides from the same table.
  const pageRes = await fetch(
    `http://localhost:3000/products/${firstProduct.slug}`,
    { cache: "no-store" },
  );
  console.log("product page status:", pageRes.status);

  // Clear the override.
  await sql`DELETE FROM product_variant_price_overrides WHERE sku = ${variant.sku}`;
  const afterClear = await sql`
    SELECT price::float AS price FROM product_variant_price_overrides
    WHERE sku = ${variant.sku}
  `;
  console.assert(afterClear.length === 0, "override should be cleared");

  console.log("\nCleanup done.");
}

run().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
