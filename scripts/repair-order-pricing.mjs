#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/repair-order-pricing.mjs
// ---------------------------------------------------------------------------
//
// One-off repair script. Scans every stored order in the Neon `orders` table
// and re-applies the bulk-pricing rules in data/products.json. If a stored
// order's line-item prices, subtotal, or total don't match what the rules
// now say they should be, it updates the row in place and prints a diff.
//
// Usage:
//   1. Make sure .env.local contains DATABASE_URL pointing at the prod Neon
//      database (the same URL used by Vercel).
//   2. From elv8-website/, run:
//        node scripts/repair-order-pricing.mjs            # dry run (report only)
//        node scripts/repair-order-pricing.mjs --apply    # persist the fixes
//
// This script is idempotent: running it twice has no effect the second time.
// Safe to run against production. It does NOT touch the invoices table or
// re-send any emails -- you still need to click "Send Invoice" from the admin
// UI afterwards to email the corrected PDF to the customer.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

// ---- Load DATABASE_URL from .env.local ------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

try {
  const envFile = readFileSync(envPath, "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch (err) {
  console.error(`Could not read ${envPath}:`, err.message);
  console.error("Create it with DATABASE_URL=<your Neon URL> and retry.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in .env.local.");
  process.exit(1);
}

// ---- Load product catalogue + pricing rules -------------------------------

const productsPath = resolve(__dirname, "..", "data", "products.json");
const products = JSON.parse(readFileSync(productsPath, "utf8"));

/** Re-implementation of lib/pricing.ts for a plain Node script. */
function getEffectiveUnitPrice(item) {
  const product = products.find((p) => p.slug === item.productSlug);
  if (
    product?.bulkDealQty &&
    product?.bulkDealPrice &&
    item.quantity >= product.bulkDealQty
  ) {
    return product.bulkDealPrice;
  }
  return item.price;
}

function recomputeOrder(order) {
  const pricedItems = order.items.map((item) => ({
    ...item,
    price: getEffectiveUnitPrice(item),
  }));
  const subtotal = pricedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const postage = Number(order.postage);
  const total = subtotal + postage;
  return { pricedItems, subtotal, total };
}

// ---- Main -----------------------------------------------------------------

const apply = process.argv.includes("--apply");
const sql = neon(databaseUrl);

console.log(
  `Elv8 order pricing repair -- mode: ${apply ? "APPLY (writes to DB)" : "DRY RUN (report only)"}`,
);
console.log("");

const rows = await sql`SELECT ref, items, subtotal, postage, total FROM orders ORDER BY created_at ASC`;

let checked = 0;
let mismatched = 0;
let fixed = 0;

for (const row of rows) {
  checked += 1;
  const storedSubtotal = Number(row.subtotal);
  const storedTotal = Number(row.total);
  const { pricedItems, subtotal: correctSubtotal, total: correctTotal } =
    recomputeOrder({
      items: row.items,
      postage: row.postage,
    });

  const subtotalMismatch = Math.abs(storedSubtotal - correctSubtotal) > 0.005;
  const totalMismatch = Math.abs(storedTotal - correctTotal) > 0.005;

  if (!subtotalMismatch && !totalMismatch) continue;

  mismatched += 1;
  console.log(`Order ${row.ref}`);
  console.log(
    `  stored:   subtotal GBP ${storedSubtotal.toFixed(2)}   total GBP ${storedTotal.toFixed(2)}`,
  );
  console.log(
    `  correct:  subtotal GBP ${correctSubtotal.toFixed(2)}   total GBP ${correctTotal.toFixed(2)}`,
  );
  console.log(
    `  refund:   GBP ${(storedTotal - correctTotal).toFixed(2)} (if already paid)`,
  );

  if (apply) {
    await sql`
      UPDATE orders
      SET items = ${JSON.stringify(pricedItems)}::jsonb,
          subtotal = ${correctSubtotal},
          total = ${correctTotal},
          updated_at = NOW()
      WHERE ref = ${row.ref}
    `;
    fixed += 1;
    console.log("  -> updated");
  }
  console.log("");
}

console.log("------------------------------------------------------------");
console.log(`Checked:    ${checked} order(s)`);
console.log(`Mismatched: ${mismatched} order(s)`);
if (apply) {
  console.log(`Fixed:      ${fixed} order(s)`);
} else {
  console.log(`Dry run. Re-run with --apply to persist the fixes.`);
}
