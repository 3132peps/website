// ---------------------------------------------------------------------------
// 31-32 Peptides -- wholesale enquiries persistence (Neon Postgres)
// ---------------------------------------------------------------------------
//
// Captures B2B enquiries submitted via /wholesale. We store every field the
// admin needs to triage the lead AND the compliance attestation (so we have
// a record that the submitter ticked the RUO + jurisdiction + authority
// boxes), plus a status the admin can advance from "new" through to
// "qualified" or "rejected".
//
// Failure mode: writes that throw should never silently lose data. The
// route handler that calls createWholesaleEnquiry() is responsible for
// falling back to a recoverable channel (an admin email with the full
// payload, dropped in lib/email.ts) -- this module just owns the table.

import { neon } from "@neondatabase/serverless";

function getSQL() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL or POSTGRES_URL environment variable is not set.",
    );
  }
  return neon(url);
}

// ---------------------------------------------------------------------------
// Types -- mirror the form fields + a few system-managed fields
// ---------------------------------------------------------------------------

export type WholesaleStatus = "new" | "contacted" | "qualified" | "rejected";

export const WHOLESALE_STATUS_LABELS: Record<WholesaleStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  rejected: "Rejected",
};

export type BusinessType =
  | "research-institution"
  | "university"
  | "pharmacy"
  | "clinic"
  | "aesthetic-provider"
  | "reseller-retailer"
  | "distributor"
  | "other";

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  "research-institution": "Research institution",
  university: "University",
  pharmacy: "Pharmacy",
  clinic: "Clinic",
  "aesthetic-provider": "Aesthetic provider",
  "reseller-retailer": "Reseller / retailer",
  distributor: "Distributor",
  other: "Other",
};

export type YearsTrading = "<1" | "1-3" | "3-5" | "5+";

export type MonthlyVolume =
  | "<50"
  | "50-200"
  | "200-500"
  | "500-1000"
  | "1000+";

export const MONTHLY_VOLUME_LABELS: Record<MonthlyVolume, string> = {
  "<50": "Under 50 vials",
  "50-200": "50 – 200 vials",
  "200-500": "200 – 500 vials",
  "500-1000": "500 – 1,000 vials",
  "1000+": "1,000+ vials",
};

export type DispatchFrequency = "one-off" | "monthly" | "quarterly" | "ad-hoc";

export const DISPATCH_FREQUENCY_LABELS: Record<DispatchFrequency, string> = {
  "one-off": "One-off",
  monthly: "Monthly",
  quarterly: "Quarterly",
  "ad-hoc": "Ad-hoc",
};

// Submitted enquiry shape -- matches the form payload after server-side
// validation. Compliance fields are stored as booleans so we can audit
// whether the boxes were ticked at submit time.
export interface WholesaleEnquiryInput {
  fullName: string;
  businessName: string;
  role: string;
  businessEmail: string;
  phone?: string;
  website?: string;
  country: string;

  businessType: BusinessType;
  yearsTrading: YearsTrading;
  registrationNumber?: string;
  vatNumber?: string;

  productsOfInterest: string[];
  productsOfInterestOther?: string;
  monthlyVolume: MonthlyVolume;
  dispatchFrequency: DispatchFrequency;
  whiteLabelInterest: boolean;
  additionalNotes?: string;

  attestationResearchOnly: boolean;
  attestationRegulatory: boolean;
  attestationAuthority: boolean;
}

export interface StoredWholesaleEnquiry extends WholesaleEnquiryInput {
  id: number;
  createdAt: string;
  updatedAt: string;
  status: WholesaleStatus;
  adminNotes?: string;
  // The submitter's IP at the time of submit, for abuse triage. We don't
  // hash or anonymise this here -- the table is admin-only and the IP is
  // useful to spot scripted submissions.
  submitterIp?: string;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export async function ensureWholesaleTable(): Promise<void> {
  const sql = getSQL();

  // Single table; payload columns roughly mirror the form. Multi-select
  // products live in TEXT[]. JSONB would also work but TEXT[] gives us a
  // simple GIN index path if we ever want to filter by product interest.
  await sql`
    CREATE TABLE IF NOT EXISTS wholesale_enquiries (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'new',

      full_name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      role TEXT NOT NULL,
      business_email TEXT NOT NULL,
      phone TEXT,
      website TEXT,
      country TEXT NOT NULL,

      business_type TEXT NOT NULL,
      years_trading TEXT NOT NULL,
      registration_number TEXT,
      vat_number TEXT,

      products_of_interest TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      products_of_interest_other TEXT,
      monthly_volume TEXT NOT NULL,
      dispatch_frequency TEXT NOT NULL,
      white_label_interest BOOLEAN NOT NULL DEFAULT FALSE,
      additional_notes TEXT,

      attestation_research_only BOOLEAN NOT NULL,
      attestation_regulatory BOOLEAN NOT NULL,
      attestation_authority BOOLEAN NOT NULL,

      admin_notes TEXT,
      submitter_ip TEXT
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS wholesale_enquiries_created_idx
      ON wholesale_enquiries(created_at DESC);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS wholesale_enquiries_status_idx
      ON wholesale_enquiries(status);
  `;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

interface Row {
  id: number;
  created_at: string;
  updated_at: string;
  status: WholesaleStatus;
  full_name: string;
  business_name: string;
  role: string;
  business_email: string;
  phone: string | null;
  website: string | null;
  country: string;
  business_type: BusinessType;
  years_trading: YearsTrading;
  registration_number: string | null;
  vat_number: string | null;
  products_of_interest: string[];
  products_of_interest_other: string | null;
  monthly_volume: MonthlyVolume;
  dispatch_frequency: DispatchFrequency;
  white_label_interest: boolean;
  additional_notes: string | null;
  attestation_research_only: boolean;
  attestation_regulatory: boolean;
  attestation_authority: boolean;
  admin_notes: string | null;
  submitter_ip: string | null;
}

function rowToEnquiry(row: Row): StoredWholesaleEnquiry {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    fullName: row.full_name,
    businessName: row.business_name,
    role: row.role,
    businessEmail: row.business_email,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    country: row.country,
    businessType: row.business_type,
    yearsTrading: row.years_trading,
    registrationNumber: row.registration_number ?? undefined,
    vatNumber: row.vat_number ?? undefined,
    productsOfInterest: row.products_of_interest,
    productsOfInterestOther: row.products_of_interest_other ?? undefined,
    monthlyVolume: row.monthly_volume,
    dispatchFrequency: row.dispatch_frequency,
    whiteLabelInterest: row.white_label_interest,
    additionalNotes: row.additional_notes ?? undefined,
    attestationResearchOnly: row.attestation_research_only,
    attestationRegulatory: row.attestation_regulatory,
    attestationAuthority: row.attestation_authority,
    adminNotes: row.admin_notes ?? undefined,
    submitterIp: row.submitter_ip ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Persists a wholesale enquiry. Throws on any DB error; the caller is
 * expected to translate that into a recoverable email fallback so the
 * submission isn't lost when the DB is unreachable.
 */
export async function createWholesaleEnquiry(
  input: WholesaleEnquiryInput,
  meta: { submitterIp?: string } = {},
): Promise<StoredWholesaleEnquiry> {
  await ensureWholesaleTable();
  const sql = getSQL();

  const rows = (await sql`
    INSERT INTO wholesale_enquiries (
      full_name, business_name, role, business_email, phone, website, country,
      business_type, years_trading, registration_number, vat_number,
      products_of_interest, products_of_interest_other,
      monthly_volume, dispatch_frequency, white_label_interest, additional_notes,
      attestation_research_only, attestation_regulatory, attestation_authority,
      submitter_ip
    ) VALUES (
      ${input.fullName}, ${input.businessName}, ${input.role},
      ${input.businessEmail}, ${input.phone ?? null}, ${input.website ?? null},
      ${input.country},
      ${input.businessType}, ${input.yearsTrading},
      ${input.registrationNumber ?? null}, ${input.vatNumber ?? null},
      ${input.productsOfInterest}, ${input.productsOfInterestOther ?? null},
      ${input.monthlyVolume}, ${input.dispatchFrequency},
      ${input.whiteLabelInterest}, ${input.additionalNotes ?? null},
      ${input.attestationResearchOnly}, ${input.attestationRegulatory},
      ${input.attestationAuthority},
      ${meta.submitterIp ?? null}
    )
    RETURNING *
  `) as Row[];

  return rowToEnquiry(rows[0]);
}

export async function getAllWholesaleEnquiries(): Promise<
  StoredWholesaleEnquiry[]
> {
  await ensureWholesaleTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT * FROM wholesale_enquiries ORDER BY created_at DESC
  `) as Row[];
  return rows.map(rowToEnquiry);
}

export async function getWholesaleEnquiryById(
  id: number,
): Promise<StoredWholesaleEnquiry | undefined> {
  await ensureWholesaleTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT * FROM wholesale_enquiries WHERE id = ${id} LIMIT 1
  `) as Row[];
  return rows[0] ? rowToEnquiry(rows[0]) : undefined;
}

export async function updateWholesaleEnquiry(
  id: number,
  patch: { status?: WholesaleStatus; adminNotes?: string },
): Promise<StoredWholesaleEnquiry | undefined> {
  await ensureWholesaleTable();
  const sql = getSQL();

  const now = new Date().toISOString();
  if (patch.status !== undefined && patch.adminNotes !== undefined) {
    await sql`
      UPDATE wholesale_enquiries
      SET status = ${patch.status},
          admin_notes = ${patch.adminNotes || null},
          updated_at = ${now}
      WHERE id = ${id}
    `;
  } else if (patch.status !== undefined) {
    await sql`
      UPDATE wholesale_enquiries
      SET status = ${patch.status}, updated_at = ${now}
      WHERE id = ${id}
    `;
  } else if (patch.adminNotes !== undefined) {
    await sql`
      UPDATE wholesale_enquiries
      SET admin_notes = ${patch.adminNotes || null}, updated_at = ${now}
      WHERE id = ${id}
    `;
  }
  return getWholesaleEnquiryById(id);
}
