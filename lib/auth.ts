// ---------------------------------------------------------------------------
// 31-32 Peptides -- admin authentication (JWT + bcrypt)
// ---------------------------------------------------------------------------

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// In production we use the __Host- prefix so the cookie is automatically
// scoped to (https + this origin + path=/), can't be set by sub-domains, and
// can't be made non-secure. Locally on http://localhost the prefix is
// rejected by the browser because the cookie can't be Secure, so we fall
// back to the unprefixed name in development.
export const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-elv8_admin"
    : "elv8_admin_token";

function getJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  // In production we refuse to start the route handler without an explicit
  // secret -- a strong secret is the only thing standing between an
  // attacker and a forged admin JWT. In development we fall back to a
  // deterministic placeholder so the dev server doesn't 500 on every
  // admin request before the developer has set up their .env.local.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_JWT_SECRET is not set in production.");
    }
    return new TextEncoder().encode("elv8-dev-only-placeholder-not-for-prod");
  }
  // Reject the historical placeholder value if it ever lands in prod via
  // a copy-paste of the wrong env file. Same idea as the above.
  if (
    process.env.NODE_ENV === "production" &&
    secret === "elv8-jwt-secret-change-in-production"
  ) {
    throw new Error(
      "ADMIN_JWT_SECRET is still the placeholder value. Rotate it before serving traffic.",
    );
  }
  return new TextEncoder().encode(secret);
}

const TOKEN_EXPIRY = "8h";

// Custom header required on state-changing admin requests. This is an
// additional CSRF defence on top of the sameSite=lax cookie -- a cross-origin
// page cannot set custom headers without CORS preflight, so a drive-by
// attacker cannot trigger writes even if the admin is already logged in.
export const ADMIN_CSRF_HEADER = "x-elv8-admin";
export const ADMIN_CSRF_VALUE = "1";

// ---------------------------------------------------------------------------
// Login rate limiting (in-memory, per-instance)
// ---------------------------------------------------------------------------
//
// Keyed by the client IP. Tracks consecutive failed attempts and locks out
// the IP for LOCKOUT_MS after MAX_ATTEMPTS failures. This runs inside a
// single serverless instance's memory, so it's not shared across Vercel
// instances -- it's a best-effort layer to slow down brute force, not a
// perfect global counter. With bcrypt cost 14 already capping attempts to
// well under one per second this is enough to deter brute force.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function pruneRateLimit(now: number) {
  // Periodically drop stale entries so the map doesn't grow unbounded.
  for (const [ip, entry] of rateLimitMap) {
    const stale =
      (entry.lockedUntil && entry.lockedUntil < now) ||
      now - entry.firstAttemptAt > WINDOW_MS;
    if (stale && (!entry.lockedUntil || entry.lockedUntil < now)) {
      rateLimitMap.delete(ip);
    }
  }
}

/**
 * Atomically check the lockout AND charge this attempt against the bucket.
 *
 * Returns `allowed: false` if the IP is already locked out, OR if charging
 * this attempt has tripped the lockout. Returns `allowed: true` for the
 * MAX_ATTEMPTS-th attempt (the user might have the right credentials on
 * their last try); subsequent calls in the same window are rejected.
 *
 * The check + increment happens in a single synchronous function call.
 * JavaScript's event loop is single-threaded between awaits, so no two
 * concurrent requests can interleave between the read and write -- which
 * closes the race where N parallel requests at attempts=MAX-1 could each
 * pass a separate read-only check, then all run bcrypt in parallel before
 * any of them recorded the failure.
 *
 * Call resetLoginRateLimit() on the success path to clear the bucket.
 */
export function consumeLoginAttempt(ip: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  pruneRateLimit(now);
  const entry = rateLimitMap.get(ip);

  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    rateLimitMap.set(ip, {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    });
    return { allowed: true };
  }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
    };
  }
  return { allowed: true };
}

export function resetLoginRateLimit(ip: string) {
  rateLimitMap.delete(ip);
}

// ---------------------------------------------------------------------------
// Password verification
// ---------------------------------------------------------------------------
//
// We bcrypt-compare on every request, even when no admin matches the
// supplied username, so the response time is the same in both cases.
// Without the dummy hash an attacker can probe valid usernames by
// measuring login latency: "wrong username" returns instantly, "right
// username, wrong password" takes hundreds of ms.
//
// The dummy hash is a real bcrypt hash of a random 32-byte secret
// generated at module load -- not a static string -- so we never
// inadvertently leak a known plaintext.

import { randomBytes } from "node:crypto";
import { getAdminByUsername, type Admin } from "./admins";

// Cost MUST match hashPassword() below -- a mismatched cost reintroduces the
// timing channel we're trying to close (wrong-username takes cost-12 time,
// wrong-password takes cost-14 time, and the difference is observable).
const DUMMY_HASH_PROMISE: Promise<string> = bcrypt.hash(
  randomBytes(32).toString("base64"),
  14,
);

/**
 * Looks up the admin by username and bcrypt-compares the supplied password.
 * Always runs a bcrypt comparison (against a dummy hash if no admin matches)
 * so wrong-username and wrong-password take the same time.
 *
 * Returns the admin record on success, or null on any failure.
 */
export async function verifyAdminPassword(
  username: string,
  password: string,
): Promise<Admin | null> {
  const dummyHash = await DUMMY_HASH_PROMISE;
  const admin = await getAdminByUsername(username);

  if (!admin) {
    await bcrypt.compare(password, dummyHash);
    return null;
  }

  const ok = await bcrypt.compare(password, admin.passwordHash);
  return ok ? admin : null;
}

// ---------------------------------------------------------------------------
// JWT token management
// ---------------------------------------------------------------------------

export interface AdminTokenClaims {
  /** Identifies which admin this token represents. */
  aid: number;
  /** Whether this session has cleared the TOTP step. */
  twoFactor: boolean;
  /**
   * True while the admin is mid-TOTP-enrolment (password verified but
   * they haven't scanned/confirmed a code yet). When this flag is set
   * the proxy only allows them to reach the enrol endpoint, not the
   * verify endpoint or any real admin route.
   */
  enrollment: boolean;
  /** Random per-session ID -- handy if we ever want server-side revocation. */
  sid: string;
}

export async function createToken(claims: AdminTokenClaims): Promise<string> {
  return new SignJWT({ role: "admin", ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export interface VerifiedToken {
  aid: number;
  twoFactor: boolean;
  enrollment: boolean;
  sid: string;
}

export async function verifyToken(token: string): Promise<VerifiedToken | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const aid = typeof payload.aid === "number" ? payload.aid : 0;
    if (aid <= 0) return null;
    return {
      aid,
      twoFactor: payload.twoFactor === true,
      enrollment: payload.enrollment === true,
      sid: typeof payload.sid === "string" ? payload.sid : "",
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ---------------------------------------------------------------------------
// Check if current request is authenticated
// ---------------------------------------------------------------------------

/**
 * Returns true only when the cookie verifies AND the session has cleared
 * the second factor. A token issued mid-flow (after username+password but
 * before the TOTP step or before TOTP enrolment) does NOT count as
 * authenticated -- that's what the `twoFactor` and `enrollment` claims
 * are for.
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthCookie();
  if (!token) return false;
  const verified = await verifyToken(token);
  if (!verified) return false;
  return verified.twoFactor === true && verified.enrollment === false;
}

/** Returns the verified token claims, or null if the cookie is missing/invalid. */
export async function readSession(): Promise<VerifiedToken | null> {
  const token = await getAuthCookie();
  if (!token) return null;
  return verifyToken(token);
}

// ---------------------------------------------------------------------------
// Route handler guard: defence-in-depth on top of proxy.ts. Returns a 401
// response if the request is not authenticated, or null to let the handler
// continue. Call from every admin API route so that if proxy.ts is ever
// misconfigured the endpoints are still protected.
// ---------------------------------------------------------------------------

export async function requireAdmin(): Promise<NextResponse | null> {
  const ok = await isAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

// ---------------------------------------------------------------------------
// CSRF check for state-changing admin requests. Requires the custom header
// defined above -- a cross-origin page cannot set this header without CORS
// preflight, so it blocks drive-by CSRF even if the cookie leaks.
// ---------------------------------------------------------------------------

export function requireAdminCsrf(request: Request): NextResponse | null {
  if (request.headers.get(ADMIN_CSRF_HEADER) !== ADMIN_CSRF_VALUE) {
    return NextResponse.json(
      { error: "Missing or invalid CSRF header." },
      { status: 403 },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Utility: generate a password hash (run once to set up admin)
// ---------------------------------------------------------------------------
//
// Bumped from cost 12 to cost 14: ~4x slower, still well under a second on
// modern hardware, and a meaningful step against attackers with stolen
// hashes plus a GPU rig.

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 14);
}
