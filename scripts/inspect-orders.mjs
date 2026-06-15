#!/usr/bin/env node
// Quick read-only dump of specific orders. Takes refs as CLI args.
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
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = v;
}

const sql = neon(process.env.DATABASE_URL);
const refs = process.argv.slice(2);
if (refs.length === 0) {
  console.error("Usage: node inspect-orders.mjs REF1 REF2 ...");
  process.exit(1);
}

for (const ref of refs) {
  const rows = await sql`SELECT ref, created_at, status, customer, items, subtotal, total FROM orders WHERE ref = ${ref}`;
  if (rows.length === 0) {
    console.log(`\n${ref}: not found`);
    continue;
  }
  const r = rows[0];
  console.log(`\n${ref}  (status: ${r.status}, created: ${r.created_at})`);
  console.log(`  customer: ${r.customer.fullName} <${r.customer.email}>`);
  console.log(`  items:`);
  for (const item of r.items) {
    console.log(
      `    - ${item.productName} (${item.weight}) x${item.quantity} @ GBP ${Number(item.price).toFixed(2)}`,
    );
  }
  console.log(`  stored subtotal: GBP ${Number(r.subtotal).toFixed(2)}`);
  console.log(`  stored total:    GBP ${Number(r.total).toFixed(2)}`);
}
