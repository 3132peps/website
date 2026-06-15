// Ad-hoc verification for product-restricted discount codes.
// Run: node --env-file=.env.local scripts/test-eligible-products.mjs
// Cleans up its own test code.

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const CODE = "ELIGIBLETEST" + Math.floor(Math.random() * 10000);

function item(slug, price, qty = 1) {
  return {
    productSlug: slug,
    productName: slug,
    variantSku: slug + "-sku",
    weight: "10mg",
    price,
    quantity: qty,
  };
}

async function run() {
  console.log("\n=== Eligible-products smoke test ===");
  console.log("Code:", CODE);

  // Warm the app with a non-empty basket so the route calls
  // validateDiscountCode and the migration runs via ensureDiscountCodesTable.
  const warm = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: "__init__",
      items: [item("warmup-item", 1)],
    }),
  });
  console.log("warmup status:", warm.status);

  const col = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'discount_codes' AND column_name = 'eligible_products'
  `;
  console.log("eligible_products column exists:", col.length === 1);

  // Seed: 20% off, restricted to two specific slugs.
  await sql`DELETE FROM discount_codes WHERE code = ${CODE}`;
  await sql`
    INSERT INTO discount_codes (code, type, value, eligible_products, active)
    VALUES (${CODE}, 'percent', 20, ARRAY['bpc-157-10mg', 'tb-500-5mg'], TRUE)
  `;

  // Case 1: basket has only an ineligible product -> reject.
  let res = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: CODE, items: [item("unrelated-peptide", 100)] }),
  });
  let j = await res.json();
  console.log("\n-- all ineligible --");
  console.log("status:", res.status, "valid:", j.valid, "error:", j.error);
  console.assert(j.valid === false, "should be invalid when nothing matches");

  // Case 2: basket has only eligible items -> discount on full subtotal.
  res = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: CODE,
      items: [item("bpc-157-10mg", 50, 2)],
    }),
  });
  j = await res.json();
  console.log("\n-- only eligible (£100 basket, 20% off) --");
  console.log("status:", res.status, "valid:", j.valid, "discountAmount:", j.discountAmount);
  console.assert(j.valid === true && j.discountAmount === 20, "should be 20% of £100 = £20");

  // Case 3: mixed basket -> discount only on eligible subtotal.
  //   Eligible: bpc-157-10mg £50 x 2 = £100
  //   Ineligible: unrelated £200 x 1 = £200
  //   Full subtotal £300, eligible £100, 20% of eligible = £20
  res = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: CODE,
      items: [item("bpc-157-10mg", 50, 2), item("unrelated-peptide", 200, 1)],
    }),
  });
  j = await res.json();
  console.log("\n-- mixed (£100 eligible + £200 not, 20% off) --");
  console.log("status:", res.status, "valid:", j.valid, "discountAmount:", j.discountAmount);
  console.assert(j.valid === true && j.discountAmount === 20, "discount must be on eligible subtotal only");

  // Case 4: fixed £15 off restricted to a £5 item -> capped at eligible subtotal.
  await sql`
    UPDATE discount_codes
    SET type = 'fixed', value = 15, eligible_products = ARRAY['cheap-item']
    WHERE code = ${CODE}
  `;
  res = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: CODE,
      items: [item("cheap-item", 5, 1), item("expensive-item", 200, 1)],
    }),
  });
  j = await res.json();
  console.log("\n-- fixed £15 off, eligible subtotal £5 --");
  console.log("status:", res.status, "valid:", j.valid, "discountAmount:", j.discountAmount);
  console.assert(j.valid === true && j.discountAmount === 5, "fixed discount capped at eligible subtotal");

  // Case 5: no restriction set -> discount on full subtotal.
  await sql`
    UPDATE discount_codes
    SET type = 'percent', value = 10, eligible_products = NULL
    WHERE code = ${CODE}
  `;
  res = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: CODE,
      items: [item("a", 50), item("b", 50)],
    }),
  });
  j = await res.json();
  console.log("\n-- no restriction, 10% off £100 --");
  console.log("status:", res.status, "valid:", j.valid, "discountAmount:", j.discountAmount);
  console.assert(j.valid === true && j.discountAmount === 10, "unrestricted should behave as before");

  // Case 6: blacklist (excluded_products) -> discount applies to everything
  // except the excluded items.
  //   Excluded: cheap-item £5 x 1 = £5
  //   Other: expensive-item £200 x 1 = £200
  //   15% of £200 eligible = £30
  await sql`
    UPDATE discount_codes
    SET type = 'percent', value = 15,
        eligible_products = NULL,
        excluded_products = ARRAY['cheap-item']
    WHERE code = ${CODE}
  `;
  res = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: CODE,
      items: [item("cheap-item", 5, 1), item("expensive-item", 200, 1)],
    }),
  });
  j = await res.json();
  console.log("\n-- blacklist: 15% off basket excluding cheap-item --");
  console.log("status:", res.status, "valid:", j.valid, "discountAmount:", j.discountAmount);
  console.assert(j.valid === true && j.discountAmount === 30, "blacklist should discount only non-excluded items");

  // Case 7: blacklist with only excluded items -> reject.
  res = await fetch("http://localhost:3000/api/discount/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: CODE,
      items: [item("cheap-item", 5, 3)],
    }),
  });
  j = await res.json();
  console.log("\n-- blacklist: basket has only excluded items --");
  console.log("status:", res.status, "valid:", j.valid, "error:", j.error);
  console.assert(j.valid === false, "should reject when every item is excluded");

  await sql`DELETE FROM discount_codes WHERE code = ${CODE}`;
  console.log("\nCleanup done.");
}

run().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
