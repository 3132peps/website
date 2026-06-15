// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[id]/reset-totp
//
// Clears another admin's TOTP secret + enrolment timestamp so they go
// through the enrolment flow again on their next login. Refuses to act
// on the caller's own row (you'd lock yourself out the moment your
// session expires).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminCsrf, readSession } from "@/lib/auth";
import { recordAdminAudit, resetAdminTotp } from "@/lib/admins";

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
    return NextResponse.json({ error: "Invalid admin id." }, { status: 400 });
  }

  if (session?.aid === targetId) {
    return NextResponse.json(
      {
        error:
          "You can't reset your own TOTP -- ask another admin to do it for you.",
      },
      { status: 400 },
    );
  }

  const ok = await resetAdminTotp(targetId);
  if (!ok) {
    return NextResponse.json({ error: "Admin not found." }, { status: 404 });
  }

  void recordAdminAudit({
    actorId: session?.aid ?? null,
    targetAdminId: targetId,
    action: "reset_totp",
  });

  return NextResponse.json({ success: true });
}
