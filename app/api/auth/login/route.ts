// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
//
// Step 1 of the admin login flow:
//   - Look up the admin by username and bcrypt-verify the password against
//     the stored hash.
//   - Issue a session cookie carrying the admin's id. The cookie is half-
//     authenticated until the second factor is cleared.
//   - Branch based on the admin's TOTP state:
//       not yet enrolled  -> cookie has `enrollment: true`, client is sent
//                            to /admin/login/enroll to scan a fresh secret
//       already enrolled  -> cookie has `enrollment: false`, client is sent
//                            to /admin/login/verify to enter their code
//
// Brute-force defence is in lib/auth.ts: a per-IP lockout after 5 failures
// in 15 minutes, plus the always-bcrypt-compare timing equaliser inside
// verifyAdminPassword so wrong-username and wrong-password take the same
// time.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  verifyAdminPassword,
  createToken,
  setAuthCookie,
  consumeLoginAttempt,
  resetLoginRateLimit,
} from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // Charge an attempt up-front. This both rejects already-locked IPs and
    // closes the race where N parallel requests at attempts=MAX-1 could
    // each pass a read-only check before any of them recorded the failure.
    const limit = consumeLoginAttempt(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many failed login attempts. Please try again in a few minutes.",
        },
        {
          status: 429,
          headers: limit.retryAfterSeconds
            ? { "Retry-After": String(limit.retryAfterSeconds) }
            : undefined,
        },
      );
    }

    const body = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 },
      );
    }

    // Cap input lengths to avoid an attacker forcing very long bcrypt
    // comparisons. bcrypt itself silently truncates at 72 bytes but we
    // cap earlier to make the wrong-password path and the right-password
    // path uniform.
    if (username.length > 200 || password.length > 200) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }

    const admin = await verifyAdminPassword(username, password);
    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }

    resetLoginRateLimit(ip);

    const enrolled = admin.totpEnrolledAt !== null;
    const token = await createToken({
      aid: admin.id,
      twoFactor: false,
      enrollment: !enrolled,
      sid: randomUUID(),
    });
    await setAuthCookie(token);

    if (enrolled) {
      // Past 2FA setup -- normal login flow continues at /verify.
      return NextResponse.json({
        success: true,
        twoFactorRequired: true,
      });
    }
    // First login (or admin who never finished setup) -- send them to
    // the enrolment page where they'll scan a fresh QR / setup key.
    return NextResponse.json({
      success: true,
      enrollmentRequired: true,
    });
  } catch (err) {
    console.error("[auth/login] unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
