// ---------------------------------------------------------------------------
// POST /api/auth/login/verify
// ---------------------------------------------------------------------------
//
// Step 2 of the login flow for an admin who has already enrolled TOTP:
//   - The caller has a half-cookie minted by /api/auth/login, with
//     `twoFactor: false, enrollment: false, aid: <admin id>`. The proxy
//     keeps that cookie useless on every admin route except this one.
//   - The body carries a 6-digit TOTP code. We verify it against the
//     admin's stored `totp_secret` from the DB.
//   - On success we mint a fresh fully-authenticated token (new `sid`,
//     `twoFactor: true`) and update the admin's last_login_at.
//
// Brute-force defence: the same per-IP lockout used for /api/auth/login
// applies here too. Each wrong code charges an attempt against the bucket.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  createToken,
  setAuthCookie,
  clearAuthCookie,
  readSession,
  consumeLoginAttempt,
  resetLoginRateLimit,
} from "@/lib/auth";
import { getAdminById, markAdminLogin } from "@/lib/admins";
import { verifyTotp } from "@/lib/totp";
import { getClientIp } from "@/lib/rate-limit";

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
    // Already past 2FA -- nothing to do, but don't error.
    return NextResponse.json({ success: true });
  }
  if (session.enrollment) {
    // Caller is in the enrolment flow, not the verify flow. Refuse here
    // so a half-cookie can only be redeemed at the endpoint that matches
    // its claim.
    return NextResponse.json(
      { error: "Complete TOTP setup at /admin/login/enroll first." },
      { status: 403 },
    );
  }

  const admin = await getAdminById(session.aid);
  if (!admin || !admin.totpSecret || admin.totpEnrolledAt === null) {
    // Admin row missing, disabled, or no longer enrolled -- treat the
    // session as invalid and clear the cookie so the user is bounced
    // back to /admin/login.
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

  resetLoginRateLimit(ip);

  // Mint a fresh, fully-authenticated token. A new `sid` lets us tell
  // pre- and post-2FA sessions apart in logs and supports future
  // server-side revocation.
  const token = await createToken({
    aid: admin.id,
    twoFactor: true,
    enrollment: false,
    sid: randomUUID(),
  });
  await setAuthCookie(token);

  // Best-effort: update the timestamp so the admin list reflects recent
  // activity. We deliberately don't fail the login if this throws.
  void markAdminLogin(admin.id).catch((err) =>
    console.error("[auth/verify] markAdminLogin failed:", err),
  );

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  // Lets the verify page cancel a half-finished login (e.g. user closes
  // the tab and starts over) without leaving an unused half-cookie around.
  await clearAuthCookie();
  return NextResponse.json({ success: true });
}
