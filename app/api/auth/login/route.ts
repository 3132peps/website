// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
//
// Admin login: look up the admin by username, bcrypt-verify the password, and
// issue a fully-authenticated session cookie. Two-factor (TOTP) has been
// removed -- a correct password is sufficient.
//
// First-run bootstrap: if the admins table is empty, the first successful
// sign-in CREATES the owner account from the submitted username + password.
// Sign in right after deploy so this one-time window stays closed.
//
// Brute-force defence is in lib/auth.ts: a per-IP lockout after 5 failures in
// 15 minutes, plus the always-bcrypt-compare timing equaliser inside
// verifyAdminPassword so wrong-username and wrong-password take the same time.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  verifyAdminPassword,
  createToken,
  setAuthCookie,
  hashPassword,
  consumeLoginAttempt,
  resetLoginRateLimit,
} from "@/lib/auth";
import { countAdmins, createAdmin, markAdminLogin } from "@/lib/admins";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // Charge an attempt up-front. This both rejects already-locked IPs and
    // closes the race where N parallel requests at attempts=MAX-1 could each
    // pass a read-only check before any of them recorded the failure.
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
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 },
      );
    }

    // Cap input lengths so an attacker can't force very long bcrypt
    // comparisons (bcrypt truncates at 72 bytes; we cap earlier so the
    // wrong-password and right-password paths stay uniform).
    if (username.length > 200 || password.length > 200) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }

    // First-run seeding: with no admins yet, create the owner account from
    // the ADMIN_USERNAME / ADMIN_PASSWORD env vars set in the Vercel project.
    // Gating on env vars means ONLY someone with dashboard access can create
    // the first admin -- a stranger who reaches this page can never claim it.
    // If the env vars are absent there is simply no admin and every login is
    // rejected, so the table can never be seeded by an outsider.
    if ((await countAdmins()) === 0) {
      const seedUser = process.env.ADMIN_USERNAME?.trim();
      const seedPass = process.env.ADMIN_PASSWORD;
      if (seedUser && seedPass && seedPass.length >= 8) {
        const passwordHash = await hashPassword(seedPass);
        await createAdmin({ username: seedUser, passwordHash, createdBy: null });
      }
    }

    const admin = await verifyAdminPassword(username, password);
    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }

    resetLoginRateLimit(ip);

    // Two-factor removed: issue a fully-authenticated session straight away.
    const token = await createToken({
      aid: admin.id,
      twoFactor: true,
      enrollment: false,
      sid: randomUUID(),
    });
    await setAuthCookie(token);

    void markAdminLogin(admin.id).catch((err) =>
      console.error("[auth/login] markAdminLogin failed:", err),
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[auth/login] unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
