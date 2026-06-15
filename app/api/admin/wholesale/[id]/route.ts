// ---------------------------------------------------------------------------
// /api/admin/wholesale/[id]
//   GET   -- fetch one enquiry
//   PATCH -- update status and/or admin notes
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";
import {
  getWholesaleEnquiryById,
  updateWholesaleEnquiry,
  type WholesaleStatus,
} from "@/lib/wholesale";

export const dynamic = "force-dynamic";

const VALID_STATUSES: WholesaleStatus[] = [
  "new",
  "contacted",
  "qualified",
  "rejected",
];

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const enquiry = await getWholesaleEnquiryById(id);
  if (!enquiry) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json(enquiry);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: { status?: unknown; adminNotes?: unknown };
  try {
    body = (await request.json()) as { status?: unknown; adminNotes?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: { status?: WholesaleStatus; adminNotes?: string } = {};
  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !VALID_STATUSES.includes(body.status as WholesaleStatus)
    ) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}.` },
        { status: 400 },
      );
    }
    patch.status = body.status as WholesaleStatus;
  }
  if (body.adminNotes !== undefined) {
    if (typeof body.adminNotes !== "string") {
      return NextResponse.json(
        { error: "adminNotes must be a string." },
        { status: 400 },
      );
    }
    if (body.adminNotes.length > 5000) {
      return NextResponse.json(
        { error: "adminNotes is too long." },
        { status: 400 },
      );
    }
    patch.adminNotes = body.adminNotes;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Provide status or adminNotes to update." },
      { status: 400 },
    );
  }

  const updated = await updateWholesaleEnquiry(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json(updated);
}
