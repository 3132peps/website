#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/add-admin.mjs
// ---------------------------------------------------------------------------
//
// Provisions a new admin in the `admins` Postgres table.
//
//   node scripts/add-admin.mjs --username will --password 'a-strong-password'
//   node scripts/add-admin.mjs --username external --password 'their-temp-pw'
//   node scripts/add-admin.mjs --username will   (will prompt for password)
//
// The admin is inserted with totp_secret=NULL so the next time they log
// in via /admin/login they go through the new TOTP enrolment flow and
// scan a fresh QR / setup key into their authenticator app. Once
// confirmed, that secret is locked: re-enrolment requires manually
// clearing totp_secret + totp_enrolled_at on the row.
//
// Requirements:
//   - DATABASE_URL (or POSTGRES_URL) must be set in .env.local pointing
//     at the Neon DB you want to provision against. The same URL the
//     deployed app reads in production lets you provision prod admins
//     from your laptop.
//   - bcrypt is already a dependency (used by the live login route).
//
// Cost factor matches lib/auth.ts hashPassword (currently 14). Bumping
// hashPassword's cost without bumping it here will create admins with
// weaker hashes than admins provisioned through the (future) admin UI.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcrypt";

const BCRYPT_COST = 14;
const MIN_PASSWORD_LENGTH = 12;
const MAX_USERNAME_LENGTH = 100;
const MAX_PASSWORD_LENGTH = 200;

// ---------------------------------------------------------------------------
// Load .env.local so DATABASE_URL is in scope when this script is run by
// hand. Mirrors the pattern in scripts/inspect-orders.mjs.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
try {
  const envFile = readFileSync(envPath, "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch (err) {
  if (err.code !== "ENOENT") throw err;
  // No .env.local -- caller may have set env vars directly. Continue.
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { username: null, password: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--username" || a === "-u") out.username = argv[++i];
    else if (a === "--password" || a === "-p") out.password = argv[++i];
    else if (a === "--force") out.force = true;
    else if (a === "--help" || a === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      printUsage();
      process.exit(1);
    }
  }
  return out;
}

function printUsage() {
  console.log(`
Usage:
  node scripts/add-admin.mjs --username <name> [--password <pw>] [--force]

Options:
  --username, -u   Admin username (required). Lowercase letters, digits,
                   dot, dash, underscore. 1-${MAX_USERNAME_LENGTH} chars.
  --password, -p   Password (>= ${MIN_PASSWORD_LENGTH} chars). If omitted,
                   the script prompts on stdin without echoing.
  --force          Replace an existing admin row with the same username
                   (resets their TOTP enrolment too).
`);
}

// ---------------------------------------------------------------------------
// Hidden-input password prompt
// ---------------------------------------------------------------------------

function promptPassword(label) {
  return new Promise((resolveP, reject) => {
    const muted = new Writable({
      write(chunk, encoding, cb) {
        // Swallow output so the password doesn't echo, but still flush
        // newlines / control codes from readline so the prompt redraws.
        cb();
      },
    });
    const rl = createInterface({
      input: process.stdin,
      output: muted,
      terminal: true,
    });
    process.stdout.write(label);
    rl.question("", (answer) => {
      process.stdout.write("\n");
      rl.close();
      resolveP(answer);
    });
    rl.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]*$/;

function validateUsername(name) {
  if (!name || typeof name !== "string") return "Username is required.";
  if (name.length > MAX_USERNAME_LENGTH) {
    return `Username must be at most ${MAX_USERNAME_LENGTH} chars.`;
  }
  if (!USERNAME_RE.test(name)) {
    return "Username must be lowercase letters/digits/./-/_ only and start with a letter or digit.";
  }
  return null;
}

function validatePassword(pw) {
  if (!pw || typeof pw !== "string") return "Password is required.";
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} chars.`;
  }
  if (pw.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} chars (the login route caps at this length too).`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const usernameError = validateUsername(args.username);
  if (usernameError) {
    console.error(usernameError);
    printUsage();
    process.exit(1);
  }

  let password = args.password;
  if (!password) {
    password = await promptPassword(`Password for ${args.username}: `);
    const confirm = await promptPassword("Confirm password: ");
    if (password !== confirm) {
      console.error("Passwords did not match.");
      process.exit(1);
    }
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    console.error(passwordError);
    process.exit(1);
  }

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error(
      "DATABASE_URL (or POSTGRES_URL) is not set. Add it to .env.local or export it before running.",
    );
    process.exit(1);
  }

  const sql = neon(url);

  // Ensure the table + audit log exist. Mirrors lib/admins.ts so this
  // script can be the very first thing to touch the DB.
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
    )
  `;
  await sql`
    ALTER TABLE admins
      ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES admins(id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS admins_username_active_idx
      ON admins(username) WHERE disabled_at IS NULL
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS admin_audit (
      id BIGSERIAL PRIMARY KEY,
      actor_id INTEGER REFERENCES admins(id),
      target_admin_id INTEGER REFERENCES admins(id),
      action TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const existing = await sql`
    SELECT id, totp_enrolled_at FROM admins WHERE username = ${args.username}
  `;

  if (existing.length > 0 && !args.force) {
    console.error(
      `Admin '${args.username}' already exists (id=${existing[0].id}). Pass --force to replace.`,
    );
    process.exit(1);
  }

  console.log(`Hashing password (bcrypt cost ${BCRYPT_COST})…`);
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  let targetId;
  if (existing.length > 0) {
    // --force: replace credentials and clear TOTP so they re-enrol.
    const updated = await sql`
      UPDATE admins
         SET password_hash = ${passwordHash},
             totp_secret = NULL,
             totp_enrolled_at = NULL,
             disabled_at = NULL
       WHERE username = ${args.username}
       RETURNING id
    `;
    targetId = updated[0]?.id;
    console.log(`Updated existing admin '${args.username}'.`);
    await sql`
      INSERT INTO admin_audit (actor_id, target_admin_id, action, details)
      VALUES (NULL, ${targetId}, 'reset_totp', ${JSON.stringify({ via: "add-admin.mjs --force" })}::jsonb)
    `;
  } else {
    const inserted = await sql`
      INSERT INTO admins (username, password_hash)
      VALUES (${args.username}, ${passwordHash})
      RETURNING id
    `;
    targetId = inserted[0]?.id;
    console.log(`Created admin '${args.username}'.`);
    await sql`
      INSERT INTO admin_audit (actor_id, target_admin_id, action, details)
      VALUES (NULL, ${targetId}, 'created', ${JSON.stringify({ via: "add-admin.mjs", username: args.username })}::jsonb)
    `;
  }

  console.log(
    "\nNext step: have them visit /admin/login, sign in with their username + password,",
  );
  console.log(
    "and follow the on-screen instructions to set up their authenticator app.",
  );
}

main().catch((err) => {
  console.error("\nadd-admin failed:", err.message || err);
  process.exit(1);
});
