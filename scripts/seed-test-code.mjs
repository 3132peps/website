// Seeds (or removes) a test per-customer-limit code so the checkout UI can
// be exercised in the browser. Run with:
//   node --env-file=.env.local scripts/seed-test-code.mjs seed
//   node --env-file=.env.local scripts/seed-test-code.mjs clean

import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const CODE = "UIPERCUSTOMERTEST";

const action = process.argv[2] ?? "seed";
if (action === "seed") {
  await sql`DELETE FROM discount_redemptions WHERE code = ${CODE}`;
  await sql`DELETE FROM discount_codes WHERE code = ${CODE}`;
  await sql`
    INSERT INTO discount_codes (code, type, value, per_customer_limit, active)
    VALUES (${CODE}, 'percent', 15, 1, TRUE)
  `;
  console.log("seeded", CODE);
} else {
  await sql`DELETE FROM discount_redemptions WHERE code = ${CODE}`;
  await sql`DELETE FROM discount_codes WHERE code = ${CODE}`;
  console.log("cleaned", CODE);
}
