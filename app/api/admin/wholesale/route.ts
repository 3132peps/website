// ---------------------------------------------------------------------------
// GET /api/admin/wholesale -- list every wholesale enquiry
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllWholesaleEnquiries } from "@/lib/wholesale";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const enquiries = await getAllWholesaleEnquiries();
  return NextResponse.json(enquiries);
}
