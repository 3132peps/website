// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[id]/disable
//   body: { enabled: boolean }
//
// Disables (or re-enables) a different admin. Refuses to act on the
// caller's own row -- no foot-gun where you accidentally lock yourself
// out. Requires an authenticated admin + CSRF header.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminCsrf, readSession } from "@/lib/auth";
import {
  disableAdmin,
  enableAdmin,
  recordAdminAudit,
} from "@/lib/admins";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  const session = await readSession();
  const { id: idStr } = await params;
  const targetId = Number.parseInt(idStr, 10);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return NextResponse.json(
      { error: "Invalid admin id." },
      { status: 400 },
    );
  }

  if (session?.aid === targetId) {
    return NextResponse.json(
      { error: "You can't change your own enabled state." },
      { status: 400 },
    );
  }

  // Confirm the row exists. We deliberately read with getAdminById which
  // filters disabled_at IS NULL, so to enable a disabled admin we have
  // to look without that filter -- read the row by primary key directly.
  const target = await getAdminByIdIncludingDisabled(targetId);
  if (!target) {
    return NextResponse.json(
      { error: "Admin not found." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with an 'enabled' boolean." },
      { status: 400 },
    );
  }
  const enabled = (body as { enabled?: unknown })?.enabled === true;

  let changed = false;
  if (enabled) {
    changed = await enableAdmin(targetId);
  } else {
    changed = await disableAdmin(targetId);
  }
  if (!changed) {
    return NextResponse.json(
      { error: "Admin is already in that state." },
      { status: 409 },
    );
  }

  void recordAdminAudit({
    actorId: session?.aid ?? null,
    targetAdminId: targetId,
    action: enabled ? "enabled" : "disabled",
  });

  return NextResponse.json({ success: true });
}

// Companion to lib/admins.ts:getAdminById -- that filters out disabled
// rows (the auth path needs that). For management we want to see them.
async function getAdminByIdIncludingDisabled(id: number) {
  const { neon } = await import("@neondatabase/serverless");
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  const rows = (await sql`
    SELECT id, username FROM admins WHERE id = ${id} LIMIT 1
  `) as { id: number; username: string }[];
  return rows[0] ?? null;
}
