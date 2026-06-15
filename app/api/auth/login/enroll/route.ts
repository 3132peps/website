// ---------------------------------------------------------------------------
// /api/auth/login/enroll
// ---------------------------------------------------------------------------
//
// First-time TOTP enrolment for a fresh admin account.
//
// Flow:
//   1. Admin completes step 1 (POST /api/auth/login) with their username
//      and password. Because their `totp_enrolled_at` is NULL, the login
//      route mints a half-cookie with `enrollment: true` and tells the
//      client to redirect to /admin/login/enroll.
//
//   2. The enrol page calls GET /api/auth/login/enroll. The server
//      generates a fresh 160-bit base32 TOTP secret (or reuses an existing
//      pending one for this admin), stores it on the row but leaves
//      `totp_enrolled_at` NULL, and returns the secret + an otpauth://
//      URI. The page renders the secret as a manual setup key alongside
//      QR-friendly text the admin can scan into Google Authenticator,
//      1Password, Authy, etc.
//
//   3. Admin scans, types the 6-digit code, and the page POSTs it here.
//      We verify the code against the pending secret. On success we set
//      `totp_enrolled_at = NOW()` and mint a fresh fully-authenticated
//      cookie with `twoFactor: true, enrollment: false`.
//
// Once `totp_enrolled_at` is set, this endpoint refuses to mint a new
// secret -- re-enrolment for an already-enrolled admin requires manually
// clearing the column in the DB. That stops a hijacked half-cookie from
// silently rotating an existing admin's TOTP secret.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import {
  createToken,
  setAuthCookie,
  clearAuthCookie,
  readSession,
  consumeLoginAttempt,
  resetLoginRateLimit,
} from "@/lib/auth";
import {
  getAdminById,
  setAdminPendingTotpSecret,
  confirmAdminEnrollment,
  markAdminLogin,
  recordAdminAudit,
} from "@/lib/admins";
import { base32Encode, buildOtpAuthUri, verifyTotp } from "@/lib/totp";
import { getClientIp } from "@/lib/rate-limit";

const ISSUER = "31-32 Peptides";

// ---------------------------------------------------------------------------
// GET -- returns the secret + otpauth URI for the half-authenticated admin
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { error: "No login session. Sign in again." },
      { status: 401 },
    );
  }
  if (session.twoFactor) {
    return NextResponse.json(
      { error: "Already authenticated." },
      { status: 400 },
    );
  }
  if (!session.enrollment) {
    return NextResponse.json(
      { error: "Use /api/auth/login/verify to enter your code." },
      { status: 403 },
    );
  }

  const admin = await getAdminById(session.aid);
  if (!admin) {
    await clearAuthCookie();
    return NextResponse.json(
      { error: "Session is no longer valid. Sign in again." },
      { status: 401 },
    );
  }
  if (admin.totpEnrolledAt !== null) {
    // Already enrolled -- shouldn't be on this page. Bounce them to the
    // verify flow instead of overwriting the secret.
    return NextResponse.json(
      { error: "Already enrolled. Use /admin/login/verify." },
      { status: 409 },
    );
  }

  // Reuse a pending secret if one is already on the row -- otherwise
  // generate a fresh 160-bit base32 secret. Reuse matters when the admin
  // refreshes the enrol page: if we minted a new secret on every GET,
  // the QR they already scanned would silently stop matching.
  let secretBase32 = admin.totpSecret;
  if (!secretBase32) {
    secretBase32 = base32Encode(new Uint8Array(randomBytes(20)));
    const stored = await setAdminPendingTotpSecret(admin.id, secretBase32);
    if (!stored) {
      // Race: the admin enrolled via another tab between getAdminById
      // and setAdminPendingTotpSecret. Refresh state and bail.
      return NextResponse.json(
        { error: "Already enrolled. Use /admin/login/verify." },
        { status: 409 },
      );
    }
  }

  const otpauthUri = buildOtpAuthUri({
    secretBase32,
    issuer: ISSUER,
    account: admin.username,
  });

  return NextResponse.json({
    secretBase32,
    otpauthUri,
    issuer: ISSUER,
    account: admin.username,
  });
}

// ---------------------------------------------------------------------------
// POST -- verifies a 6-digit code, confirms enrolment, mints a full cookie
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const limit = consumeLoginAttempt(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          "Too many failed attempts. Please try again in a few minutes.",
      },
      {
        status: 429,
        headers: limit.retryAfterSeconds
          ? { "Retry-After": String(limit.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { error: "No login session. Sign in again." },
      { status: 401 },
    );
  }
  if (session.twoFactor) {
    return NextResponse.json({ success: true });
  }
  if (!session.enrollment) {
    return NextResponse.json(
      { error: "Use /api/auth/login/verify to enter your code." },
      { status: 403 },
    );
  }

  const admin = await getAdminById(session.aid);
  if (!admin || !admin.totpSecret || admin.totpEnrolledAt !== null) {
    await clearAuthCookie();
    return NextResponse.json(
      { error: "Session is no longer valid. Sign in again." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with a code field." },
      { status: 400 },
    );
  }
  const code =
    typeof (body as { code?: unknown })?.code === "string"
      ? (body as { code: string }).code.trim()
      : "";

  const ok = verifyTotp(admin.totpSecret, code);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid code. Try again." },
      { status: 401 },
    );
  }

  const confirmed = await confirmAdminEnrollment(admin.id);
  if (!confirmed) {
    // Race: admin row got updated between our read and our confirm.
    // Likely already enrolled in another tab; just refuse.
    return NextResponse.json(
      { error: "Could not confirm enrolment. Sign in again." },
      { status: 409 },
    );
  }

  resetLoginRateLimit(ip);

  const token = await createToken({
    aid: admin.id,
    twoFactor: true,
    enrollment: false,
    sid: randomUUID(),
  });
  await setAuthCookie(token);

  void markAdminLogin(admin.id).catch((err) =>
    console.error("[auth/enroll] markAdminLogin failed:", err),
  );
  void recordAdminAudit({
    actorId: admin.id,
    targetAdminId: admin.id,
    action: "enrollment_completed",
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  // Cancel a half-finished enrolment. Drops the cookie. Note: we do NOT
  // clear the pending secret on the admin row -- if the admin returns
  // and starts over, we'd rather they see the same secret they may have
  // already scanned than force them to scan again.
  await clearAuthCookie();
  return NextResponse.json({ success: true });
}
