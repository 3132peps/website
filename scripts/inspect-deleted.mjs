import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = v;
}

const sql = neon(process.env.DATABASE_URL);

console.log("\n=== DELETED PRODUCTS ===");
const deleted = await sql`SELECT slug, name, category, deleted_at FROM products WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`;
for (const p of deleted) console.log(`  ${p.slug}  (${p.name})  deleted: ${p.deleted_at}`);
console.log(`\nTotal deleted: ${deleted.length}`);

console.log("\n=== ACTIVE PRODUCTS ===");
const active = await sql`SELECT slug, name FROM products WHERE deleted_at IS NULL ORDER BY position ASC, slug ASC`;
for (const p of active) console.log(`  ${p.slug}  (${p.name})`);
console.log(`\nTotal active: ${active.length}`);

console.log("\n=== PRODUCTS TABLE COLUMNS ===");
const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='products' ORDER BY ordinal_position`;
for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type}`);
