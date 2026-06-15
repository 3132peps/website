// ---------------------------------------------------------------------------
// GET /api/admin/me
//
// Returns the calling admin's id + username so the management UI can
// flag the "you" row and disable self-acting buttons. No sensitive
// fields (no password_hash, no totp_secret).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { readSession, requireAdmin } from "@/lib/auth";
import { getAdminById } from "@/lib/admins";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const admin = await getAdminById(session.aid);
  if (!admin) {
    return NextResponse.json({ error: "Admin not found." }, { status: 404 });
  }
  return NextResponse.json({
    id: admin.id,
    username: admin.username,
  });
}
