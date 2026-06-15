// ---------------------------------------------------------------------------
// 31-32 Peptides -- multi-admin authentication store
// ---------------------------------------------------------------------------
//
// Replaces the single-admin ADMIN_USERNAME / ADMIN_PASSWORD_HASH /
// ADMIN_TOTP_SECRET env-var model with a Postgres-backed table so we can
// have more than one admin and so each admin enrols their own TOTP secret
// on their first login (no shared secret, no manual env var setup per
// person).
//
// Schema:
//   admins            -- one row per admin: credentials + 2FA state
//
// 2FA enrolment state is encoded by two columns:
//   totp_secret        NULL  + totp_enrolled_at NULL  -> not enrolled at all
//   totp_secret        SET   + totp_enrolled_at NULL  -> enrolment in progress
//                                                        (secret generated, not
//                                                        yet confirmed by code)
//   totp_secret        SET   + totp_enrolled_at SET   -> fully enrolled
//
// Once enrolled the secret is locked: re-enrolment requires manually
// clearing both columns in the DB. This stops a session-hijack attacker
// from quietly rotating the TOTP secret to one they control.

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

export interface Admin {
  id: number;
  username: string;
  passwordHash: string;
  totpSecret: string | null;
  totpEnrolledAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  disabledAt: Date | null;
  createdBy: number | null;
}

interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  totp_secret: string | null;
  totp_enrolled_at: string | null;
  created_at: string;
  last_login_at: string | null;
  disabled_at: string | null;
  created_by: number | null;
}

function rowToAdmin(r: AdminRow): Admin {
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    totpSecret: r.totp_secret,
    totpEnrolledAt: r.totp_enrolled_at ? new Date(r.totp_enrolled_at) : null,
    createdAt: new Date(r.created_at),
    lastLoginAt: r.last_login_at ? new Date(r.last_login_at) : null,
    disabledAt: r.disabled_at ? new Date(r.disabled_at) : null,
    createdBy: r.created_by,
  };
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export async function ensureAdminsTable(): Promise<void> {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      totp_secret TEXT,
      totp_enrolled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ,
      disabled_at TIMESTAMPTZ
    );
  `;
  // Additive migration: created_by tracks which admin provisioned this row.
  // NULL means the row was bootstrapped (e.g. via scripts/add-admin.mjs)
  // before any admin existed to attribute it to.
  await sql`
    ALTER TABLE admins
      ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES admins(id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS admins_username_active_idx
      ON admins(username) WHERE disabled_at IS NULL;
  `;
  await ensureAdminAuditTable();
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
//
// Every admin lifecycle event (create / disable / enable / reset_totp /
// enrolment_completed) lands here for forensics. login_success is NOT
// logged -- last_login_at on the admin row covers that without bloating
// the audit table.
//
// actor_id is NULL when the action was taken by the bootstrap script
// (no admin session existed). target_admin_id is the row being acted on.
//
// Errors during write are swallowed by recordAdminAudit -- a failed
// audit log must never break the operation it's logging, since the
// caller already committed the underlying state change.

export type AdminAuditAction =
  | "created"
  | "disabled"
  | "enabled"
  | "reset_totp"
  | "enrollment_completed";

export interface AdminAuditEntry {
  id: number;
  actorId: number | null;
  targetAdminId: number | null;
  action: AdminAuditAction;
  details: Record<string, unknown>;
  createdAt: Date;
}

interface AdminAuditRow {
  id: number;
  actor_id: number | null;
  target_admin_id: number | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

async function ensureAdminAuditTable(): Promise<void> {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS admin_audit (
      id BIGSERIAL PRIMARY KEY,
      actor_id INTEGER REFERENCES admins(id),
      target_admin_id INTEGER REFERENCES admins(id),
      action TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS admin_audit_target_idx
      ON admin_audit(target_admin_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS admin_audit_actor_idx
      ON admin_audit(actor_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS admin_audit_created_idx
      ON admin_audit(created_at DESC);
  `;
}

export async function recordAdminAudit(input: {
  actorId: number | null;
  targetAdminId: number | null;
  action: AdminAuditAction;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sql = getSQL();
    await sql`
      INSERT INTO admin_audit (actor_id, target_admin_id, action, details)
      VALUES (
        ${input.actorId},
        ${input.targetAdminId},
        ${input.action},
        ${JSON.stringify(input.details ?? {})}::jsonb
      )
    `;
  } catch (err) {
    // Never fail the caller because of a logging hiccup.
    console.error("[admin_audit] failed to record event:", err);
  }
}

export async function listAdminAudit(limit = 100): Promise<AdminAuditEntry[]> {
  await ensureAdminsTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT id, actor_id, target_admin_id, action, details, created_at
    FROM admin_audit
    ORDER BY created_at DESC, id DESC
    LIMIT ${Math.max(1, Math.min(500, limit))}
  `) as AdminAuditRow[];
  return rows.map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    targetAdminId: r.target_admin_id,
    action: r.action as AdminAuditAction,
    details: r.details ?? {},
    createdAt: new Date(r.created_at),
  }));
}

// ---------------------------------------------------------------------------
// Read API
// ---------------------------------------------------------------------------

export async function countAdmins(): Promise<number> {
  await ensureAdminsTable();
  const sql = getSQL();
  const rows = (await sql`SELECT COUNT(*)::int AS n FROM admins`) as {
    n: number;
  }[];
  return rows[0]?.n ?? 0;
}

export async function getAdminByUsername(
  username: string,
): Promise<Admin | null> {
  await ensureAdminsTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT id, username, password_hash, totp_secret, totp_enrolled_at,
           created_at, last_login_at, disabled_at, created_by
    FROM admins
    WHERE username = ${username} AND disabled_at IS NULL
    LIMIT 1
  `) as AdminRow[];
  return rows[0] ? rowToAdmin(rows[0]) : null;
}

export async function getAdminById(id: number): Promise<Admin | null> {
  await ensureAdminsTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT id, username, password_hash, totp_secret, totp_enrolled_at,
           created_at, last_login_at, disabled_at, created_by
    FROM admins
    WHERE id = ${id} AND disabled_at IS NULL
    LIMIT 1
  `) as AdminRow[];
  return rows[0] ? rowToAdmin(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Enrolment write API
// ---------------------------------------------------------------------------

/**
 * Stores a fresh, not-yet-confirmed TOTP secret on the admin row.
 *
 * Refuses if the admin is already enrolled -- once `totp_enrolled_at`
 * is set, the secret is treated as immutable from this code path so a
 * hijacked half-cookie can't quietly swap an existing admin's TOTP
 * secret to one the attacker controls.
 *
 * Re-running before confirmation is fine and overwrites the secret,
 * which is what we want when the admin hits the enrol page twice
 * (a leaked-but-unconfirmed secret should not stay valid).
 */
export async function setAdminPendingTotpSecret(
  id: number,
  secret: string,
): Promise<boolean> {
  await ensureAdminsTable();
  const sql = getSQL();
  const result = (await sql`
    UPDATE admins
       SET totp_secret = ${secret}
     WHERE id = ${id}
       AND disabled_at IS NULL
       AND totp_enrolled_at IS NULL
    RETURNING id
  `) as { id: number }[];
  return result.length > 0;
}

/**
 * Promotes a pending secret to a confirmed enrolment. Called from the
 * enrol API only after the admin has successfully verified a code
 * generated from the pending secret.
 */
export async function confirmAdminEnrollment(id: number): Promise<boolean> {
  await ensureAdminsTable();
  const sql = getSQL();
  const result = (await sql`
    UPDATE admins
       SET totp_enrolled_at = NOW()
     WHERE id = ${id}
       AND disabled_at IS NULL
       AND totp_secret IS NOT NULL
       AND totp_enrolled_at IS NULL
    RETURNING id
  `) as { id: number }[];
  return result.length > 0;
}

export async function markAdminLogin(id: number): Promise<void> {
  await ensureAdminsTable();
  const sql = getSQL();
  await sql`UPDATE admins SET last_login_at = NOW() WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// Create / list / disable
// ---------------------------------------------------------------------------

export async function createAdmin(input: {
  username: string;
  passwordHash: string;
  createdBy?: number | null;
}): Promise<Admin> {
  await ensureAdminsTable();
  const sql = getSQL();
  const rows = (await sql`
    INSERT INTO admins (username, password_hash, created_by)
    VALUES (
      ${input.username},
      ${input.passwordHash},
      ${input.createdBy ?? null}
    )
    RETURNING id, username, password_hash, totp_secret, totp_enrolled_at,
              created_at, last_login_at, disabled_at, created_by
  `) as AdminRow[];
  return rowToAdmin(rows[0]!);
}

export async function listAdmins(): Promise<Admin[]> {
  await ensureAdminsTable();
  const sql = getSQL();
  const rows = (await sql`
    SELECT id, username, password_hash, totp_secret, totp_enrolled_at,
           created_at, last_login_at, disabled_at, created_by
    FROM admins
    ORDER BY id ASC
  `) as AdminRow[];
  return rows.map(rowToAdmin);
}

/**
 * Marks an admin as disabled. They can no longer log in (the username
 * lookup filters disabled_at IS NULL) and any existing JWT they hold
 * stops working at the next API call that loads the admin record.
 */
export async function disableAdmin(id: number): Promise<boolean> {
  await ensureAdminsTable();
  const sql = getSQL();
  const result = (await sql`
    UPDATE admins SET disabled_at = NOW()
     WHERE id = ${id} AND disabled_at IS NULL
    RETURNING id
  `) as { id: number }[];
  return result.length > 0;
}

export async function enableAdmin(id: number): Promise<boolean> {
  await ensureAdminsTable();
  const sql = getSQL();
  const result = (await sql`
    UPDATE admins SET disabled_at = NULL
     WHERE id = ${id} AND disabled_at IS NOT NULL
    RETURNING id
  `) as { id: number }[];
  return result.length > 0;
}

/**
 * Clears an admin's TOTP secret + enrolment timestamp so they go through
 * the enrolment flow again on next login. Used when a phone is lost or
 * the secret needs rotating.
 */
export async function resetAdminTotp(id: number): Promise<boolean> {
  await ensureAdminsTable();
  const sql = getSQL();
  const result = (await sql`
    UPDATE admins
       SET totp_secret = NULL,
           totp_enrolled_at = NULL
     WHERE id = ${id}
    RETURNING id
  `) as { id: number }[];
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Migration note
// ---------------------------------------------------------------------------
//
// The legacy ADMIN_USERNAME / ADMIN_PASSWORD_HASH / ADMIN_TOTP_SECRET env
// vars are no longer consulted by the application -- admins live entirely
// in the `admins` table now. Use `scripts/add-admin.mjs` to provision new
// admins after deploy. After both admins are created, the legacy env vars
// can be removed from Vercel.
