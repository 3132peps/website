// ---------------------------------------------------------------------------
// 31-32 Peptides -- invoice persistence (Neon Postgres)
// ---------------------------------------------------------------------------
//
// Stores generated invoice PDFs as bytea in Neon so every invoice the admin
// has sent can be retrieved later. The invoice number is derived from the
// order reference so customers use the order ref as their bank payment
// reference.

import { neon } from "@neondatabase/serverless";

function getSQL() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("DATABASE_URL or POSTGRES_URL environment variable is not set.");
  }
  return neon(url);
}

export interface StoredInvoice {
  orderRef: string;
  invoiceNumber: string;
  generatedAt: string;
  sentAt: string | null;
  pdf: Buffer;
}

export async function ensureInvoicesTable(): Promise<void> {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      order_ref TEXT PRIMARY KEY REFERENCES orders(ref) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ,
      pdf BYTEA NOT NULL
    );
  `;
}

interface InvoiceRow {
  order_ref: string;
  invoice_number: string;
  generated_at: string;
  sent_at: string | null;
  pdf: Buffer | Uint8Array;
}

function rowToInvoice(row: InvoiceRow): StoredInvoice {
  return {
    orderRef: row.order_ref,
    invoiceNumber: row.invoice_number,
    generatedAt: row.generated_at,
    sentAt: row.sent_at,
    pdf: Buffer.isBuffer(row.pdf) ? row.pdf : Buffer.from(row.pdf),
  };
}

export async function getInvoiceByRef(
  orderRef: string,
): Promise<StoredInvoice | undefined> {
  await ensureInvoicesTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT * FROM invoices WHERE order_ref = ${orderRef} LIMIT 1
  `) as InvoiceRow[];
  return rows[0] ? rowToInvoice(rows[0]) : undefined;
}

export async function saveInvoice(params: {
  orderRef: string;
  invoiceNumber: string;
  pdf: Uint8Array;
  sent: boolean;
}): Promise<void> {
  await ensureInvoicesTable();
  const sql = getSQL();
  const now = new Date().toISOString();
  const pdfBuffer = Buffer.from(params.pdf);
  // UPSERT so re-sending an invoice overwrites the stored copy.
  await sql`
    INSERT INTO invoices (order_ref, invoice_number, generated_at, sent_at, pdf)
    VALUES (
      ${params.orderRef},
      ${params.invoiceNumber},
      ${now},
      ${params.sent ? now : null},
      ${pdfBuffer}
    )
    ON CONFLICT (order_ref) DO UPDATE SET
      invoice_number = EXCLUDED.invoice_number,
      generated_at   = EXCLUDED.generated_at,
      sent_at        = EXCLUDED.sent_at,
      pdf            = EXCLUDED.pdf
  `;
}
