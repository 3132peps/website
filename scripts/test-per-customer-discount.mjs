// Ad-hoc verification script for the per-customer discount limit.
// Run: node --env-file=.env.local scripts/test-per-customer-discount.mjs
// Leaves no persistent test data — cleans up its own code + redemptions.

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const CODE = "PERCUSTOMERTEST" + Math.floor(Math.random() * 10000);
const EMAIL = `test+${Date.now()}@example.com`;

async function run() {
  console.log("\n=== Per-customer limit smoke test ===");
  console.log("Code:", CODE, " Email:", EMAIL);

  // 1. Ensure tables exist (calls the same path the app does on any hit).
  const res = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "__force_table_init__", items: [] }),
  });
  console.log("warmup status:", res.status);

  // 2. Verify the new column + table exist.
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'discount_codes' AND column_name = 'per_customer_limit'
  `;
  console.log("per_customer_limit column exists:", cols.length === 1);

  const tbls = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'discount_redemptions'
  `;
  console.log("discount_redemptions table exists:", tbls.length === 1);

  // 3. Insert a code with per_customer_limit = 1 directly so we don't need
  //    an admin session.
  await sql`
    INSERT INTO discount_codes (code, type, value, per_customer_limit, active)
    VALUES (${CODE}, 'percent', 10, 1, TRUE)
  `;

  // 4. Validate without email → expect requiresEmail + valid=false.
  const r1 = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: CODE,
      items: [
        {
          productSlug: "x",
          productName: "X",
          variantSku: "sku",
          weight: "1mg",
          price: 100,
          quantity: 1,
        },
      ],
    }),
  });
  const j1 = await r1.json();
  console.log("\n-- no email --");
  console.log("status:", r1.status, "body:", j1);
  console.assert(j1.valid === false, "should be invalid without email");
  console.assert(j1.requiresEmail === true, "should flag requiresEmail");

  // 5. Validate with email, no prior redemption → expect valid=true.
  const r2 = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: CODE,
      customerEmail: EMAIL,
      items: [
        {
          productSlug: "x",
          productName: "X",
          variantSku: "sku",
          weight: "1mg",
          price: 100,
          quantity: 1,
        },
      ],
    }),
  });
  const j2 = await r2.json();
  console.log("\n-- with email, first use --");
  console.log("status:", r2.status, "body:", j2);
  console.assert(j2.valid === true, "should be valid on first use");

  // 6. Simulate a previous redemption, then re-validate → expect invalid.
  await sql`
    INSERT INTO discount_redemptions (code, customer_email, order_ref)
    VALUES (${CODE}, ${EMAIL.toLowerCase()}, 'FAKE-REF-1')
  `;
  const r3 = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: CODE,
      customerEmail: EMAIL,
      items: [
        {
          productSlug: "x",
          productName: "X",
          variantSku: "sku",
          weight: "1mg",
          price: 100,
          quantity: 1,
        },
      ],
    }),
  });
  const j3 = await r3.json();
  console.log("\n-- with email, after redemption --");
  console.log("status:", r3.status, "body:", j3);
  console.assert(j3.valid === false, "should be invalid after redemption");

  // 7. Different email → valid.
  const r4 = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: CODE,
      customerEmail: "someone-else@example.com",
      items: [
        {
          productSlug: "x",
          productName: "X",
          variantSku: "sku",
          weight: "1mg",
          price: 100,
          quantity: 1,
        },
      ],
    }),
  });
  const j4 = await r4.json();
  console.log("\n-- with different email --");
  console.log("status:", r4.status, "body:", j4);
  console.assert(j4.valid === true, "different email should still be valid");

  // 8. Clean up.
  await sql`DELETE FROM discount_redemptions WHERE code = ${CODE}`;
  await sql`DELETE FROM discount_codes WHERE code = ${CODE}`;
  console.log("\nCleanup done.");
}

run().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
