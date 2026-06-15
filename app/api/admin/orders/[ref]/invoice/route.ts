// ---------------------------------------------------------------------------
// POST /api/admin/orders/[ref]/invoice   -- generate + send invoice
// GET  /api/admin/orders/[ref]/invoice   -- download stored invoice PDF
// ---------------------------------------------------------------------------
//
// POST is triggered when the admin clicks "Send Invoice" from the order
// detail page. It generates a PDF, stores it in the invoices table, emails
// the customer via Resend with the PDF attached, then transitions the order
// status to "invoice-sent".
//
// GET returns the stored PDF so the admin can re-download a previously
// generated invoice from the order detail page.

import { NextRequest, NextResponse } from "next/server";
import { getOrderByRef, updateOrder } from "@/lib/orders";
import { getInvoiceByRef, saveInvoice } from "@/lib/invoices";
import { buildInvoiceNumber, generateInvoicePdf } from "@/lib/invoice-pdf";
import { sendInvoiceEmail } from "@/lib/email";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";
import type { StatusHistoryEntry } from "@/lib/types";

export const dynamic = "force-dynamic";
// PDF generation pushes this route past the default 10s serverless budget on
// larger orders, so bump the timeout. Vercel Hobby caps at 60s.
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// POST -- generate, store, email, and advance status
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  const { ref } = await params;

  const order = await getOrderByRef(ref);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  try {
    // 1. Generate the PDF from the current order state.
    const pdfBytes = await generateInvoicePdf(order);
    const invoiceNumber = buildInvoiceNumber(order.ref);

    // 2. Persist the PDF so it can be re-downloaded later.
    await saveInvoice({
      orderRef: order.ref,
      invoiceNumber,
      pdf: pdfBytes,
      sent: false,
    });

    // 3. Email the customer with the PDF attached.
    const emailResult = await sendInvoiceEmail({
      orderRef: order.ref,
      invoiceNumber,
      customerEmail: order.customer.email,
      customerName: order.customer.fullName,
      totalPrice: order.total,
      pdf: pdfBytes,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error: `Invoice PDF was generated and stored, but the email failed to send: ${emailResult.error ?? "unknown error"}`,
        },
        { status: 502 },
      );
    }

    // 4. Mark the invoice as sent in storage.
    await saveInvoice({
      orderRef: order.ref,
      invoiceNumber,
      pdf: pdfBytes,
      sent: true,
    });

    // 5. Advance the order to "invoice-sent" so the admin now waits for
    //    payment. We only move the status forward -- if it's already past
    //    this stage we leave it alone so re-sending doesn't regress it.
    let updated = order;
    if (order.status === "received") {
      const historyEntry: StatusHistoryEntry = {
        status: "invoice-sent",
        timestamp: new Date().toISOString(),
        note: `Invoice ${invoiceNumber} emailed to ${order.customer.email}`,
      };
      const next = await updateOrder(ref, {
        status: "invoice-sent",
        statusHistory: [...order.statusHistory, historyEntry],
      });
      if (next) updated = next;
    }

    return NextResponse.json({
      order: updated,
      invoiceNumber,
      messageId: emailResult.messageId,
    });
  } catch (err) {
    console.error(`[admin] Invoice send failed for order ${ref}:`, err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Invoice failed: ${err.message}`
            : "Invoice failed due to an unexpected error.",
      },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET -- download stored invoice PDF (admin only)
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { ref } = await params;

  const invoice = await getInvoiceByRef(ref);
  if (!invoice) {
    return NextResponse.json(
      { error: "Invoice not found for this order." },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(invoice.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
