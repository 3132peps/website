// ---------------------------------------------------------------------------
// 31-32 Peptides -- TOTP (RFC 6238) helpers for admin 2FA
// ---------------------------------------------------------------------------
//
// We implement TOTP directly against node:crypto rather than pulling in
// otplib or speakeasy. It's a small spec, the implementation is well-trodden,
// and removing one transitive dep shrinks the supply-chain attack surface.
//
// Compatibility:
//   - 30-second time step (the de facto standard)
//   - 6-digit codes
//   - SHA-1 HMAC (the de facto standard, what Google Authenticator expects)
//   - One time-step of clock skew on either side accepted (3 codes total)
//   - Base32 secret encoding (RFC 4648, no padding)
//
// Each admin has their own secret stored in the `admins.totp_secret` column
// (see lib/admins.ts). The login flow generates a fresh secret on first
// login and stores it after the admin confirms a code from their app.

import { createHash, createHmac } from "node:crypto";

// ---------------------------------------------------------------------------
// Base32 -- standard RFC 4648 alphabet, no padding on output.
// ---------------------------------------------------------------------------

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += B32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const idx = B32_ALPHABET.indexOf(cleaned[i]!);
    if (idx === -1) throw new Error("Invalid base32 character.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

// ---------------------------------------------------------------------------
// HOTP (RFC 4226) -- the building block TOTP wraps with a time-based counter
// ---------------------------------------------------------------------------

function hotp(secret: Uint8Array, counter: number, digits = 6): string {
  // Counter is 8 bytes big-endian. We can't use Number for the high 32 bits
  // because counter can exceed 2^32 for very-future Unix timestamps; use a
  // BigInt to be safe.
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = createHmac("sha1", secret).update(buf).digest();
  // Dynamic truncation per RFC 4226 §5.3
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const mod = 10 ** digits;
  return (code % mod).toString().padStart(digits, "0");
}

// ---------------------------------------------------------------------------
// TOTP
// ---------------------------------------------------------------------------

const TIME_STEP_SECONDS = 30;

interface VerifyOptions {
  /** Number of past/future steps to accept. 1 = ±30 seconds. */
  window?: number;
  /** Override the current Unix time (in seconds) -- useful for tests. */
  now?: number;
}

// ---------------------------------------------------------------------------
// Replay cache
// ---------------------------------------------------------------------------
//
// RFC 6238 §5.2: a verifier MUST NOT accept the same OTP twice during the
// validity period. Without this, a code observed once (e.g. shoulder-surfed
// or briefly intercepted via a malicious browser extension) is reusable
// for the remainder of the 30-second step.
//
// We track (counter, code) pairs per secret in a per-process Map. Cold-start
// boundaries on serverless mean the cache is best-effort across instances,
// but for the realistic threat model -- sequential replay within a short
// window, hitting the same warm function instance -- it's effective.
//
// Memory bound: at most ~3 entries per secret (window=1 plus one slot of
// breathing room), and we prune stale steps on every successful match.

const acceptedCodes = new Map<string, Set<string>>();

function secretFingerprint(secret: Uint8Array): string {
  // SHA-256 prefix is plenty to distinguish secrets in a Map key without
  // putting the secret bytes themselves into a long-lived data structure.
  return createHash("sha256").update(secret).digest("hex").slice(0, 16);
}

function pruneAccepted(seen: Set<string>, currentCounter: number) {
  for (const key of seen) {
    const step = Number.parseInt(key.split(":")[0]!, 10);
    // Anything older than the current step minus one is outside the verify
    // window and can't be accepted again, so drop it to bound memory.
    if (!Number.isFinite(step) || step < currentCounter - 1) {
      seen.delete(key);
    }
  }
}

/** Test-only: clears the replay cache so unit tests can reuse codes. */
export function _resetTotpReplayCacheForTests() {
  acceptedCodes.clear();
}

/**
 * Returns true if `code` matches a TOTP generated from `secretBase32` within
 * the configured time window AND has not already been accepted in the same
 * step. Constant-time string compare on each candidate so an attacker can't
 * measure progress through the digit prefix.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  options: VerifyOptions = {},
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  let secret: Uint8Array;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return false;
  }
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const window = options.window ?? 1;
  const counter = Math.floor(now / TIME_STEP_SECONDS);

  // Walk the full window even after a match so timing doesn't leak which
  // step the code came from.
  let matchedCounter: number | null = null;
  for (let offset = -window; offset <= window; offset++) {
    const candidateCounter = counter + offset;
    const candidate = hotp(secret, candidateCounter);
    if (timingSafeEqualString(candidate, code)) {
      matchedCounter = candidateCounter;
    }
  }
  if (matchedCounter === null) return false;

  // Replay check. Done after the constant-time loop so the verification
  // work is uniform; this branch only runs on a successful match, by which
  // point the attacker has already won the cryptographic guess.
  const fp = secretFingerprint(secret);
  const key = `${matchedCounter}:${code}`;
  let seen = acceptedCodes.get(fp);
  if (seen?.has(key)) return false;
  if (!seen) {
    seen = new Set();
    acceptedCodes.set(fp, seen);
  }
  seen.add(key);
  pruneAccepted(seen, counter);
  return true;
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Builds an otpauth:// URI suitable for handing to a QR code generator.
 * (We embed the URI as text in the admin setup screen and the admin scans
 *  it with their authenticator app, or copies the secret manually.)
 */
export function buildOtpAuthUri(params: {
  secretBase32: string;
  issuer: string;
  account: string;
}): string {
  const issuer = encodeURIComponent(params.issuer);
  const account = encodeURIComponent(params.account);
  return (
    `otpauth://totp/${issuer}:${account}` +
    `?secret=${params.secretBase32}` +
    `&issuer=${issuer}` +
    `&algorithm=SHA1&digits=6&period=30`
  );
}
