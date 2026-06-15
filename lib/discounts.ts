// ---------------------------------------------------------------------------
// 31-32 Peptides -- discount code persistence and validation (Neon Postgres)
// ---------------------------------------------------------------------------
//
// Discount codes are stored in the `discount_codes` table. The admin creates
// and manages them from /admin/discounts; customers apply them at checkout
// from /order. Validation is done server-side in two places:
//
//   1. POST /api/discount/validate  -- live "Apply" button on the checkout
//      page so the customer sees the discount before submitting the order.
//   2. POST /api/order              -- re-validates and increments the usage
//      counter atomically so a code can never exceed its max usages even
//      under concurrent orders.
//
// Discounts only reduce the subtotal (postage stays £6 flat).

import { neon } from "@neondatabase/serverless";
import type {
  DiscountCode,
  DiscountType,
  DiscountValidationResult,
  OrderItem,
} from "./types";
import { calculateSubtotal } from "./pricing";

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------

function getSQL() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("DATABASE_URL or POSTGRES_URL environment variable is not set.");
  }
  return neon(url);
}

// ---------------------------------------------------------------------------
// Table initialisation (called on first use)
// ---------------------------------------------------------------------------

export async function ensureDiscountCodesTable(): Promise<void> {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS discount_codes (
      code TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
      value NUMERIC(10,2) NOT NULL,
      min_order_value NUMERIC(10,2),
      max_usages INTEGER,
      times_used INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  // Additive migration: per-customer usage cap. Nullable column; null = no
  // per-customer limit, 1 = one-time use per customer, etc.
  await sql`
    ALTER TABLE discount_codes
      ADD COLUMN IF NOT EXISTS per_customer_limit INTEGER;
  `;
  // Additive migration: restrict a code to specific product slugs. Null or
  // empty array means the code applies to every product (current behaviour).
  await sql`
    ALTER TABLE discount_codes
      ADD COLUMN IF NOT EXISTS eligible_products TEXT[];
  `;
  // Additive migration: exclusion list -- the mirror of eligible_products.
  // Null/empty means "no exclusions". A code must use either eligible or
  // excluded, never both; that invariant is enforced at the admin-API level.
  await sql`
    ALTER TABLE discount_codes
      ADD COLUMN IF NOT EXISTS excluded_products TEXT[];
  `;
  // Per-order redemption log. Used both to enforce the per-customer limit
  // and to give the admin an audit trail of who used which code.
  await sql`
    CREATE TABLE IF NOT EXISTS discount_redemptions (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      order_ref TEXT NOT NULL,
      redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code_email
      ON discount_redemptions (code, LOWER(customer_email));
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_discount_redemptions_order_ref
      ON discount_redemptions (order_ref);
  `;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface DiscountRow {
  code: string;
  type: DiscountType;
  value: string;
  min_order_value: string | null;
  max_usages: number | null;
  per_customer_limit: number | null;
  eligible_products: string[] | null;
  excluded_products: string[] | null;
  times_used: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function rowToDiscount(row: DiscountRow): DiscountCode {
  return {
    code: row.code,
    type: row.type,
    value: Number(row.value),
    minOrderValue: row.min_order_value !== null ? Number(row.min_order_value) : undefined,
    maxUsages: row.max_usages ?? undefined,
    perCustomerLimit: row.per_customer_limit ?? undefined,
    eligibleProducts:
      row.eligible_products && row.eligible_products.length > 0
        ? row.eligible_products
        : undefined,
    excludedProducts:
      row.excluded_products && row.excluded_products.length > 0
        ? row.excluded_products
        : undefined,
    timesUsed: row.times_used,
    expiresAt: row.expires_at ?? undefined,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Normalise the code format so codes are case-insensitive and trimmed
// ---------------------------------------------------------------------------

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function getAllDiscountCodes(): Promise<DiscountCode[]> {
  await ensureDiscountCodesTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT * FROM discount_codes ORDER BY created_at DESC
  `) as DiscountRow[];
  return rows.map(rowToDiscount);
}

export async function getDiscountCode(code: string): Promise<DiscountCode | undefined> {
  await ensureDiscountCodesTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT * FROM discount_codes WHERE code = ${normaliseCode(code)} LIMIT 1
  `) as DiscountRow[];
  return rows[0] ? rowToDiscount(rows[0]) : undefined;
}

export interface CreateDiscountInput {
  code: string;
  type: DiscountType;
  value: number;
  minOrderValue?: number;
  maxUsages?: number;
  perCustomerLimit?: number;
  eligibleProducts?: string[];
  excludedProducts?: string[];
  expiresAt?: string;
  active?: boolean;
}

// Normalise an eligible-products list for storage. Empty arrays become null
// so "unrestricted" is represented exactly one way in the database.
function normaliseEligibleProducts(
  input: string[] | null | undefined,
): string[] | null {
  if (!input || input.length === 0) return null;
  const cleaned = Array.from(
    new Set(
      input
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0),
    ),
  );
  return cleaned.length > 0 ? cleaned : null;
}

export async function createDiscountCode(
  input: CreateDiscountInput,
): Promise<DiscountCode> {
  await ensureDiscountCodesTable();
  const sql = getSQL();

  const code = normaliseCode(input.code);
  if (!code) throw new Error("Code is required.");
  if (input.type !== "percent" && input.type !== "fixed") {
    throw new Error("Type must be 'percent' or 'fixed'.");
  }
  if (!Number.isFinite(input.value) || input.value <= 0) {
    throw new Error("Value must be a positive number.");
  }
  if (input.type === "percent" && input.value > 100) {
    throw new Error("Percentage value cannot exceed 100.");
  }
  if (
    input.perCustomerLimit !== undefined &&
    (!Number.isInteger(input.perCustomerLimit) || input.perCustomerLimit < 1)
  ) {
    throw new Error("Per-customer limit must be a whole number (1 or more).");
  }

  const eligibleProducts = normaliseEligibleProducts(input.eligibleProducts);
  const excludedProducts = normaliseEligibleProducts(input.excludedProducts);
  if (eligibleProducts && excludedProducts) {
    throw new Error(
      "A discount code can't use both an eligible list and an excluded list -- pick one.",
    );
  }

  await sql`
    INSERT INTO discount_codes (
      code, type, value, min_order_value, max_usages, per_customer_limit,
      eligible_products, excluded_products, expires_at, active
    )
    VALUES (
      ${code},
      ${input.type},
      ${input.value},
      ${input.minOrderValue ?? null},
      ${input.maxUsages ?? null},
      ${input.perCustomerLimit ?? null},
      ${eligibleProducts},
      ${excludedProducts},
      ${input.expiresAt ?? null},
      ${input.active ?? true}
    )
  `;

  const created = await getDiscountCode(code);
  if (!created) throw new Error("Failed to create discount code.");
  return created;
}

export interface UpdateDiscountInput {
  type?: DiscountType;
  value?: number;
  minOrderValue?: number | null;
  maxUsages?: number | null;
  perCustomerLimit?: number | null;
  eligibleProducts?: string[] | null;
  excludedProducts?: string[] | null;
  expiresAt?: string | null;
  active?: boolean;
}

export async function updateDiscountCode(
  code: string,
  input: UpdateDiscountInput,
): Promise<DiscountCode | undefined> {
  await ensureDiscountCodesTable();
  const sql = getSQL();

  const existing = await getDiscountCode(code);
  if (!existing) return undefined;

  const type = input.type ?? existing.type;
  const value = input.value ?? existing.value;
  const minOrderValue =
    input.minOrderValue === undefined
      ? existing.minOrderValue ?? null
      : input.minOrderValue;
  const maxUsages =
    input.maxUsages === undefined ? existing.maxUsages ?? null : input.maxUsages;
  const perCustomerLimit =
    input.perCustomerLimit === undefined
      ? existing.perCustomerLimit ?? null
      : input.perCustomerLimit;
  const eligibleProducts =
    input.eligibleProducts === undefined
      ? normaliseEligibleProducts(existing.eligibleProducts)
      : normaliseEligibleProducts(input.eligibleProducts);
  const excludedProducts =
    input.excludedProducts === undefined
      ? normaliseEligibleProducts(existing.excludedProducts)
      : normaliseEligibleProducts(input.excludedProducts);
  if (eligibleProducts && excludedProducts) {
    throw new Error(
      "A discount code can't use both an eligible list and an excluded list -- pick one.",
    );
  }
  const expiresAt =
    input.expiresAt === undefined ? existing.expiresAt ?? null : input.expiresAt;
  const active = input.active ?? existing.active;

  if (type === "percent" && value > 100) {
    throw new Error("Percentage value cannot exceed 100.");
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Value must be a positive number.");
  }
  if (
    perCustomerLimit !== null &&
    (!Number.isInteger(perCustomerLimit) || perCustomerLimit < 1)
  ) {
    throw new Error("Per-customer limit must be a whole number (1 or more).");
  }

  await sql`
    UPDATE discount_codes
    SET type = ${type},
        value = ${value},
        min_order_value = ${minOrderValue},
        max_usages = ${maxUsages},
        per_customer_limit = ${perCustomerLimit},
        eligible_products = ${eligibleProducts},
        excluded_products = ${excludedProducts},
        expires_at = ${expiresAt},
        active = ${active},
        updated_at = NOW()
    WHERE code = ${normaliseCode(code)}
  `;

  return getDiscountCode(code);
}

export async function deleteDiscountCode(code: string): Promise<boolean> {
  await ensureDiscountCodesTable();
  const sql = getSQL();
  const result = (await sql`
    DELETE FROM discount_codes WHERE code = ${normaliseCode(code)}
  `) as unknown as { rowCount?: number };
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Validation + usage counter
// ---------------------------------------------------------------------------

/**
 * Computes the discount amount in GBP for a given subtotal.
 * Percent discounts are rounded to 2dp and capped at the subtotal so a
 * discount can never exceed the basket value.
 */
export function calculateDiscountAmount(
  type: DiscountType,
  value: number,
  subtotal: number,
): number {
  if (subtotal <= 0) return 0;
  let amount: number;
  if (type === "percent") {
    amount = (subtotal * value) / 100;
  } else {
    amount = value;
  }
  // Cap to subtotal and round to 2dp
  amount = Math.min(amount, subtotal);
  return Math.round(amount * 100) / 100;
}

/**
 * Validates a discount code against the basket contents. The caller passes
 * the already-priced items (output of `applyBulkPricingToItems`) — the
 * full subtotal is used for the minimum-order check, but the actual
 * discount amount is computed against the *eligible* subtotal (items whose
 * product slug appears in the code's `eligibleProducts` list). When a code
 * has no eligibleProducts list, the eligible subtotal equals the full
 * subtotal and the code behaves exactly like before.
 *
 * Pass `customerEmail` when available so per-customer limits can be
 * enforced. If the code has a per-customer limit but no email is supplied,
 * the result is `{ valid: false, requiresEmail: true }` so the client can
 * prompt the customer to fill in their email and retry.
 */
export async function validateDiscountCode(
  code: string,
  items: OrderItem[],
  customerEmail?: string,
): Promise<DiscountValidationResult> {
  const normalised = normaliseCode(code);
  if (!normalised) {
    return { valid: false, error: "Please enter a discount code." };
  }

  const discount = await getDiscountCode(normalised);
  if (!discount) {
    return { valid: false, error: "This discount code is not recognised." };
  }

  if (!discount.active) {
    return { valid: false, error: "This discount code is no longer active." };
  }

  if (discount.expiresAt && new Date(discount.expiresAt).getTime() < Date.now()) {
    return { valid: false, error: "This discount code has expired." };
  }

  if (discount.maxUsages !== undefined && discount.timesUsed >= discount.maxUsages) {
    return {
      valid: false,
      error: "This discount code has reached its maximum number of uses.",
    };
  }

  const subtotal = calculateSubtotal(items);

  if (discount.minOrderValue !== undefined && subtotal < discount.minOrderValue) {
    return {
      valid: false,
      error: `This code requires a minimum order of £${discount.minOrderValue.toFixed(
        2,
      )}.`,
    };
  }

  // Product restriction. Two mutually-exclusive modes:
  //   - eligibleProducts (whitelist): discount only applies to items whose
  //     slug appears in the list.
  //   - excludedProducts (blacklist): discount applies to every item except
  //     those whose slug appears in the list.
  // When either is set, we filter the basket to the "discountable" items
  // and use their subtotal for the discount amount. If nothing in the
  // basket qualifies, reject the code so the customer isn't left
  // wondering why their discount is £0.
  let eligibleSubtotal = subtotal;
  const whitelist = discount.eligibleProducts;
  const blacklist = discount.excludedProducts;
  if (whitelist && whitelist.length > 0) {
    const set = new Set(whitelist);
    const matched = items.filter((item) => set.has(item.productSlug));
    if (matched.length === 0) {
      return {
        valid: false,
        error: "This discount code doesn't apply to any items in your basket.",
      };
    }
    eligibleSubtotal = calculateSubtotal(matched);
  } else if (blacklist && blacklist.length > 0) {
    const set = new Set(blacklist);
    const matched = items.filter((item) => !set.has(item.productSlug));
    if (matched.length === 0) {
      return {
        valid: false,
        error:
          "This discount code doesn't apply to any items in your basket.",
      };
    }
    eligibleSubtotal = calculateSubtotal(matched);
  }

  // Per-customer usage cap. Customer identity is the email address, so we
  // need one before we can say whether the code is still available. If it
  // hasn't been supplied yet, tell the client to collect it and retry.
  if (discount.perCustomerLimit !== undefined) {
    const email = customerEmail?.trim();
    if (!email) {
      return {
        valid: false,
        requiresEmail: true,
        error:
          "Please enter your email address before applying this code — it's limited to one use per customer.",
      };
    }
    const used = await countCustomerRedemptions(normalised, email);
    if (used >= discount.perCustomerLimit) {
      return {
        valid: false,
        error:
          discount.perCustomerLimit === 1
            ? "You have already used this discount code."
            : "You have reached the usage limit for this discount code.",
      };
    }
  }

  const discountAmount = calculateDiscountAmount(
    discount.type,
    discount.value,
    eligibleSubtotal,
  );

  return {
    valid: true,
    code: discount.code,
    type: discount.type,
    value: discount.value,
    discountAmount,
  };
}

/**
 * Counts how many times a given customer (identified by email) has already
 * redeemed a given code. Used by both the pre-checkout validation and the
 * atomic usage increment at order submission time.
 */
export async function countCustomerRedemptions(
  code: string,
  customerEmail: string,
): Promise<number> {
  await ensureDiscountCodesTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM discount_redemptions
    WHERE code = ${normaliseCode(code)}
      AND LOWER(customer_email) = LOWER(${customerEmail.trim()})
  `) as { count: number }[];
  return Number(rows[0]?.count ?? 0);
}

/**
 * Atomically increments the usage counter for a discount code. Uses a
 * guarded UPDATE so the increment only happens if the code is still within
 * its active/expiry/max-usage limits -- and, if a per-customer limit is
 * set, still within that limit for the supplied customer email. This
 * protects against two orders using the last remaining slot on the same
 * code at the same time.
 *
 * Callers should pass `customerEmail` whenever it's available. If the code
 * has a `per_customer_limit`, the increment is rejected when no email is
 * supplied or the customer has already hit their limit.
 *
 * Returns true if the increment applied, false if the code was rejected at
 * the database level (in which case the caller should refuse the order).
 */
export async function incrementDiscountUsage(
  code: string,
  customerEmail?: string,
): Promise<boolean> {
  await ensureDiscountCodesTable();
  const sql = getSQL();
  const normalised = normaliseCode(code);
  const email = customerEmail?.trim() || null;

  // The per-customer guard uses a correlated subquery against the
  // redemptions log. When `per_customer_limit` is null the clause short-
  // circuits. When it's set but no email was supplied, the guard forces a
  // no-op so the caller can surface a clear error.
  const rows = (await sql`
    UPDATE discount_codes
    SET times_used = times_used + 1,
        updated_at = NOW()
    WHERE code = ${normalised}
      AND active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_usages IS NULL OR times_used < max_usages)
      AND (
        per_customer_limit IS NULL
        OR (
          ${email}::TEXT IS NOT NULL
          AND per_customer_limit > (
            SELECT COUNT(*) FROM discount_redemptions
            WHERE code = ${normalised}
              AND LOWER(customer_email) = LOWER(${email ?? ""})
          )
        )
      )
    RETURNING code
  `) as { code: string }[];

  return rows.length > 0;
}

/**
 * Records a single redemption of a discount code by a specific customer
 * against a specific order. Call this after `incrementDiscountUsage`
 * succeeds so the redemption log and the `times_used` counter stay in
 * sync. Storing the email lower-cased keeps lookups cheap and consistent
 * with the case-insensitive matching used by `countCustomerRedemptions`.
 */
export async function recordDiscountRedemption(
  code: string,
  customerEmail: string,
  orderRef: string,
): Promise<void> {
  await ensureDiscountCodesTable();
  const sql = getSQL();
  await sql`
    INSERT INTO discount_redemptions (code, customer_email, order_ref)
    VALUES (
      ${normaliseCode(code)},
      ${customerEmail.trim().toLowerCase()},
      ${orderRef}
    )
  `;
}
