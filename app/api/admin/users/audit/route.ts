// ---------------------------------------------------------------------------
// GET /api/admin/users/audit?limit=100
//
// Returns the most recent admin lifecycle events (create / disable /
// enable / reset_totp / enrollment_completed). Bound to a sensible
// upper limit so a curious admin can't pull the entire history into
// memory.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAdminAudit } from "@/lib/admins";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;
  const entries = await listAdminAudit(
    Number.isFinite(limit) ? limit : 100,
  );

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      actorId: e.actorId,
      targetAdminId: e.targetAdminId,
      action: e.action,
      details: e.details,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
