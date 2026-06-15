#!/usr/bin/env node
// ---------------------------------------------------------------------------
// One-shot restore for the 8 pen products that were soft-deleted to satisfy
// the payment-gateway application. These are now reinstated as "hidden from
// storefront" -- the admin can sell them via manually-created orders, but
// the public site never lists or links them.
//
// Idempotent: re-running it on already-restored rows is a no-op (UPDATE
// affecting zero rows is fine, the post-state is the same).
//
// Usage:
//   node scripts/restore-hidden-products.mjs
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const envFile = readFileSync(envPath, "utf8");
for (const line of envFile.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  let v = t.slice(eq + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (!process.env[t.slice(0, eq).trim()]) {
    process.env[t.slice(0, eq).trim()] = v;
  }
}

const SLUGS = [
  "tirzepatide-elv8-pen",
  "retatrutide-elv8-pen",
  "synedica-retatrutide-pen",
  "nad-plus-pen",
  "ghk-cu-pen",
  "wolverine-pen",
  "glow-pen",
  "klow-pen",
];

const sql = neon(process.env.DATABASE_URL);

// Make sure the column exists. The app boots ensureProductTables() on first
// admin request, but this script may run before any web traffic touches the
// DB after a fresh deploy. ADD COLUMN IF NOT EXISTS is idempotent.
await sql`
  ALTER TABLE products
    ADD COLUMN IF NOT EXISTS storefront_visible BOOLEAN NOT NULL DEFAULT TRUE
`;

console.log("Restoring soft-deleted pen products as hidden-from-storefront:");
let updated = 0;
let alreadyOk = 0;
let missing = 0;

for (const slug of SLUGS) {
  const rows = await sql`
    SELECT slug, deleted_at, storefront_visible
    FROM products
    WHERE slug = ${slug}
    LIMIT 1
  `;
  if (rows.length === 0) {
    console.log(`  [missing] ${slug} -- not in DB, skipping`);
    missing += 1;
    continue;
  }
  const row = rows[0];
  if (row.deleted_at === null && row.storefront_visible === false) {
    console.log(`  [ok]      ${slug} -- already restored + hidden`);
    alreadyOk += 1;
    continue;
  }

  await sql`
    UPDATE products
       SET deleted_at         = NULL,
           storefront_visible = FALSE,
           updated_at         = NOW()
     WHERE slug = ${slug}
  `;
  console.log(`  [updated] ${slug}`);
  updated += 1;
}

console.log("");
console.log(`Done. updated=${updated}  already-ok=${alreadyOk}  missing=${missing}`);
