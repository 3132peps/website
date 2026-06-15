// ---------------------------------------------------------------------------
// /api/admin/users
//   GET   -- list every admin (id, username, dates, enabled/disabled, enrolment)
//   POST  -- create a new admin (username + password) -- they enrol on first login
//
// Both require an authenticated admin (twoFactor=true) plus the CSRF
// header. Self-protection rules apply on the row-level routes (disable,
// reset-totp); creating new admins is open to any active admin.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { hashPassword, requireAdmin, requireAdminCsrf, readSession } from "@/lib/auth";
import {
  createAdmin,
  getAdminByUsername,
  listAdmins,
  recordAdminAudit,
} from "@/lib/admins";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]*$/;
const MIN_PASSWORD_LENGTH = 12;
const MAX_USERNAME_LENGTH = 100;
const MAX_PASSWORD_LENGTH = 200;

interface AdminListRow {
  id: number;
  username: string;
  createdAt: string;
  createdBy: number | null;
  lastLoginAt: string | null;
  enrolledAt: string | null;
  disabledAt: string | null;
}

// ---------------------------------------------------------------------------
// GET -- list admins
// ---------------------------------------------------------------------------

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const admins = await listAdmins();
  // Strip password_hash and totp_secret -- the UI never needs either
  // and they'd be a serious leak if they accidentally rendered.
  const out: AdminListRow[] = admins.map((a) => ({
    id: a.id,
    username: a.username,
    createdAt: a.createdAt.toISOString(),
    createdBy: a.createdBy,
    lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
    enrolledAt: a.totpEnrolledAt ? a.totpEnrolledAt.toISOString() : null,
    disabledAt: a.disabledAt ? a.disabledAt.toISOString() : null,
  }));
  return NextResponse.json({ admins: out });
}

// ---------------------------------------------------------------------------
// POST -- create a new admin
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with username and password fields." },
      { status: 400 },
    );
  }

  const username =
    typeof (body as { username?: unknown })?.username === "string"
      ? (body as { username: string }).username.trim()
      : "";
  const password =
    typeof (body as { password?: unknown })?.password === "string"
      ? (body as { password: string }).password
      : "";

  if (!username || username.length > MAX_USERNAME_LENGTH || !USERNAME_RE.test(username)) {
    return NextResponse.json(
      {
        error:
          "Username must be 1-100 lowercase letters/digits/./-/_ chars, starting with a letter or digit.",
      },
      { status: 400 },
    );
  }
  if (
    !password ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return NextResponse.json(
      {
        error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  const existing = await getAdminByUsername(username);
  if (existing) {
    return NextResponse.json(
      { error: "An admin with that username already exists." },
      { status: 409 },
    );
  }

  const session = await readSession();
  const passwordHash = await hashPassword(password);
  const created = await createAdmin({
    username,
    passwordHash,
    createdBy: session?.aid ?? null,
  });

  void recordAdminAudit({
    actorId: session?.aid ?? null,
    targetAdminId: created.id,
    action: "created",
    details: { username: created.username },
  });

  return NextResponse.json({
    success: true,
    admin: {
      id: created.id,
      username: created.username,
      createdAt: created.createdAt.toISOString(),
    },
  });
}
