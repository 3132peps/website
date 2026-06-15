import { NextRequest, NextResponse } from "next/server";
import { getOrderByRef, updateOrder } from "@/lib/orders";
import { sendDispatchEmail } from "@/lib/email";
import type { OrderStatus, StatusHistoryEntry } from "@/lib/types";
import { ORDER_STATUS_FLOW, CANCELLABLE_STATUSES } from "@/lib/types";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";

// All statuses that PATCH accepts: the six main flow states plus "cancelled".
const ACCEPTED_STATUSES: OrderStatus[] = [...ORDER_STATUS_FLOW, "cancelled"];

export const dynamic = "force-dynamic";

// GET /api/admin/orders/[ref]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { ref } = await params;
  const order = await getOrderByRef(ref);

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json(order);
}

// PATCH /api/admin/orders/[ref] -- update status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  try {
    const { ref } = await params;
    const { status, note } = (await request.json()) as {
      status: OrderStatus;
      note?: string;
    };

    if (!ACCEPTED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const existing = await getOrderByRef(ref);
    if (!existing) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Cancelling is only allowed for orders that haven't physically left
    // the warehouse. Re-cancelling is a no-op but we still allow the
    // history entry to capture the admin's intent.
    if (status === "cancelled" && !CANCELLABLE_STATUSES.includes(existing.status)) {
      if (existing.status === "cancelled") {
        return NextResponse.json(existing);
      }
      return NextResponse.json(
        {
          error:
            "This order cannot be cancelled because it has already been dispatched or delivered.",
        },
        { status: 409 },
      );
    }

    const historyEntry: StatusHistoryEntry = {
      status,
      timestamp: new Date().toISOString(),
      ...(note ? { note } : {}),
    };

    const updated = await updateOrder(ref, {
      status,
      statusHistory: [...existing.statusHistory, historyEntry],
    });

    // Send dispatch email to customer when status changes to dispatched
    if (status === "dispatched" && existing.status !== "dispatched") {
      try {
        await sendDispatchEmail({
          orderRef: existing.ref,
          customerEmail: existing.customer.email,
          customerName: existing.customer.fullName,
          items: existing.items,
        });
      } catch {
        console.warn(`[admin] Dispatch email failed for order ${ref}`);
      }
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
