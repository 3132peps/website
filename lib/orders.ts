// ---------------------------------------------------------------------------
// 31-32 Peptides -- order persistence (Neon Postgres)
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";
import type {
  StoredOrder,
  OrderItem,
  OrderClientMeta,
  StatusHistoryEntry,
  OrderStatus,
} from "./types";

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
// Initialise the orders table (called once on first use)
// ---------------------------------------------------------------------------

export async function ensureOrdersTable(): Promise<void> {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      ref TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'received',
      customer JSONB NOT NULL,
      items JSONB NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      postage NUMERIC(10,2) NOT NULL,
      total NUMERIC(10,2) NOT NULL,
      order_notes TEXT,
      ruo_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
      status_history JSONB NOT NULL DEFAULT '[]'
    );
  `;
  // Discount columns were added after the initial schema. Use ADD COLUMN
  // IF NOT EXISTS so existing production rows are preserved and the
  // migration is idempotent across cold starts.
  await sql`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS discount_code TEXT,
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2)
  `;
  // Fraud-signal column added 2026-05. JSONB so we can extend the captured
  // request metadata (referrer, fingerprint, etc.) without further ALTERs.
  await sql`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS client_meta JSONB
  `;
}

// ---------------------------------------------------------------------------
// Helpers: row → StoredOrder mapping
// ---------------------------------------------------------------------------

interface OrderRow {
  ref: string;
  created_at: string;
  updated_at: string;
  status: OrderStatus;
  customer: StoredOrder["customer"];
  items: OrderItem[];
  subtotal: string;
  postage: string;
  total: string;
  order_notes: string | null;
  ruo_confirmed: boolean;
  terms_accepted: boolean;
  status_history: StatusHistoryEntry[];
  discount_code: string | null;
  discount_amount: string | null;
  client_meta: OrderClientMeta | null;
}

function rowToOrder(row: OrderRow): StoredOrder {
  return {
    ref: row.ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    customer: row.customer,
    items: row.items,
    subtotal: Number(row.subtotal),
    postage: Number(row.postage),
    total: Number(row.total),
    orderNotes: row.order_notes ?? undefined,
    ruoConfirmed: row.ruo_confirmed,
    termsAccepted: row.terms_accepted,
    statusHistory: row.status_history,
    discountCode: row.discount_code ?? undefined,
    discountAmount:
      row.discount_amount !== null && row.discount_amount !== undefined
        ? Number(row.discount_amount)
        : undefined,
    clientMeta: row.client_meta ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function getAllOrders(): Promise<StoredOrder[]> {
  await ensureOrdersTable();
  const sql = getSQL();
  const rows = await sql`
    SELECT * FROM orders ORDER BY created_at DESC
  ` as OrderRow[];
  return rows.map(rowToOrder);
}

export async function getOrderByRef(ref: string): Promise<StoredOrder | undefined> {
  await ensureOrdersTable();
  const sql = getSQL();
  const rows = await sql`
    SELECT * FROM orders WHERE ref = ${ref} LIMIT 1
  ` as OrderRow[];
  return rows[0] ? rowToOrder(rows[0]) : undefined;
}

export async function createOrder(order: StoredOrder): Promise<StoredOrder> {
  await ensureOrdersTable();
  const sql = getSQL();
  await sql`
    INSERT INTO orders (ref, created_at, updated_at, status, customer, items, subtotal, postage, total, order_notes, ruo_confirmed, terms_accepted, status_history, discount_code, discount_amount, client_meta)
    VALUES (
      ${order.ref},
      ${order.createdAt},
      ${order.updatedAt},
      ${order.status},
      ${JSON.stringify(order.customer)},
      ${JSON.stringify(order.items)},
      ${order.subtotal},
      ${order.postage},
      ${order.total},
      ${order.orderNotes ?? null},
      ${order.ruoConfirmed},
      ${order.termsAccepted},
      ${JSON.stringify(order.statusHistory)},
      ${order.discountCode ?? null},
      ${order.discountAmount ?? null},
      ${order.clientMeta ? JSON.stringify(order.clientMeta) : null}
    )
  `;
  return order;
}

export async function updateOrder(
  ref: string,
  updates: Partial<StoredOrder>,
): Promise<StoredOrder | undefined> {
  await ensureOrdersTable();
  const sql = getSQL();

  const now = new Date().toISOString();

  if (updates.status !== undefined && updates.statusHistory !== undefined) {
    await sql`
      UPDATE orders
      SET status = ${updates.status},
          status_history = ${JSON.stringify(updates.statusHistory)},
          updated_at = ${now}
      WHERE ref = ${ref}
    `;
  } else if (updates.status !== undefined) {
    await sql`
      UPDATE orders
      SET status = ${updates.status},
          updated_at = ${now}
      WHERE ref = ${ref}
    `;
  }

  return getOrderByRef(ref);
}
