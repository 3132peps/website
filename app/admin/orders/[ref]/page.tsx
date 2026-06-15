"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StoredOrder, OrderStatus } from "@/lib/types";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_FLOW,
  CANCELLABLE_STATUSES,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<OrderStatus, string> = {
  received: "bg-blue-100 text-blue-800",
  "invoice-sent": "bg-yellow-100 text-yellow-800",
  "invoice-paid": "bg-emerald-100 text-emerald-800",
  packed: "bg-purple-100 text-purple-800",
  dispatched: "bg-indigo-100 text-indigo-800",
  delivered: "bg-[#1A2439] text-[#B0BBD1]",
  cancelled: "bg-red-100 text-red-700",
};

const STEP_ACTIVE_COLORS: Record<OrderStatus, string> = {
  received: "border-blue-500 bg-blue-500",
  "invoice-sent": "border-yellow-500 bg-yellow-500",
  "invoice-paid": "border-emerald-500 bg-emerald-500",
  packed: "border-purple-500 bg-purple-500",
  dispatched: "border-indigo-500 bg-indigo-500",
  delivered: "border-gray-500 bg-gray-500",
  cancelled: "border-red-500 bg-red-500",
};

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/orders/${ref}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          throw new Error("Unauthorized");
        }
        if (!res.ok) throw new Error("Order not found");
        return res.json();
      })
      .then(setOrder)
      .catch((err) => {
        if (err.message !== "Unauthorized") setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [ref, router]);

  async function handleStatusUpdate(newStatus: OrderStatus) {
    setUpdating(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/orders/${ref}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-elv8-admin": "1",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Update failed");
      }

      const updated = await res.json();
      setOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }

  async function handleCancelOrder() {
    if (!order) return;
    const reason = window.prompt(
      `Cancel order ${order.ref}?\n\nThis order will be hidden from the active orders list but kept on record. You can reinstate it later.\n\nOptional: enter a reason (visible in the status history).`,
      "",
    );
    // prompt returns null if the admin clicks Cancel on the dialog itself.
    if (reason === null) return;

    setUpdating(true);
    setError("");
    setInvoiceMessage("");

    try {
      const res = await fetch(`/api/admin/orders/${ref}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-elv8-admin": "1",
        },
        body: JSON.stringify({
          status: "cancelled",
          note: reason.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Cancellation failed");
      }

      const updated = await res.json();
      setOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setUpdating(false);
    }
  }

  async function handleReinstate() {
    if (!order) return;
    // Work out where to send it back to: the last non-cancelled status in
    // the history. Falls back to "received" for safety.
    const previous = [...order.statusHistory]
      .reverse()
      .find((h) => h.status !== "cancelled");
    const target: OrderStatus = previous?.status ?? "received";

    const confirmed = window.confirm(
      `Reinstate this order as "${ORDER_STATUS_LABELS[target]}"?`,
    );
    if (!confirmed) return;

    setUpdating(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/orders/${ref}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-elv8-admin": "1",
        },
        body: JSON.stringify({
          status: target,
          note: "Order reinstated",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Reinstate failed");
      }

      const updated = await res.json();
      setOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reinstate failed");
    } finally {
      setUpdating(false);
    }
  }

  async function handleSendInvoice(options: { resend?: boolean } = {}) {
    if (!order) return;
    const { resend = false } = options;

    const message = resend
      ? `Re-send invoice to ${order.customer.email}?\n\nA fresh PDF invoice will be generated from the current order details and emailed to the customer. The order status will not change.`
      : `Send invoice to ${order.customer.email}?\n\nA PDF invoice will be emailed to the customer with the UK bank transfer details. The order will then move to "Invoice Sent" and wait for payment.`;

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setSendingInvoice(true);
    setError("");
    setInvoiceMessage("");

    try {
      const res = await fetch(`/api/admin/orders/${ref}/invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elv8-admin": "1",
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send invoice");
      }

      if (data.order) setOrder(data.order);
      setInvoiceMessage(
        resend
          ? `Invoice ${data.invoiceNumber} re-sent to ${order.customer.email}.`
          : `Invoice ${data.invoiceNumber} emailed to ${order.customer.email}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invoice");
    } finally {
      setSendingInvoice(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1626]">
        <p className="text-[#8A96AC]">Loading order...</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0F1626]">
        <p className="text-red-600">{error}</p>
        <Link href="/admin" className="text-sm text-[#2563EB] hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!order) return null;

  const isCancelled = order.status === "cancelled";
  const canCancel = CANCELLABLE_STATUSES.includes(order.status);
  const currentIdx = ORDER_STATUS_FLOW.indexOf(order.status);
  const nextStatus =
    !isCancelled && currentIdx < ORDER_STATUS_FLOW.length - 1
      ? ORDER_STATUS_FLOW[currentIdx + 1]
      : null;

  return (
    <div className="min-h-screen bg-[#0F1626]">
      {/* Header */}
      <header className="border-b border-[#1E2A3F] bg-[#121A2B]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/admin"
            className="text-sm text-[#8A96AC] hover:text-[#2563EB]"
          >
            &larr; Orders
          </Link>
          <h1 className="text-lg font-bold text-[#F5F7FB]">
            Order{" "}
            <span className="font-mono text-[#2563EB]">{order.ref}</span>
          </h1>
          <Badge className={`ml-auto ${STATUS_COLORS[order.status]}`}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Cancelled banner */}
        {isCancelled && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-red-800">
                  This order has been cancelled
                </h2>
                <p className="mt-1 text-xs text-red-700">
                  Cancelled orders are hidden from the main dashboard. The
                  record is kept for your reference and can be reinstated if
                  needed.
                </p>
                <Button
                  onClick={handleReinstate}
                  disabled={updating}
                  variant="outline"
                  className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
                >
                  {updating ? "Reinstating..." : "Reinstate Order"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Status progression */}
        <div className="mb-8 rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8A96AC]">
            Order Progress
          </h2>

          {/* Progress steps */}
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {ORDER_STATUS_FLOW.map((s, i) => {
              const isCompleted = i <= currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold text-white transition-colors ${
                        isCompleted
                          ? STEP_ACTIVE_COLORS[s]
                          : "border-[#2B3A54] bg-[#1A2439] text-[#8A96AC]"
                      } ${isCurrent ? "ring-2 ring-offset-2 ring-[#2563EB]/30" : ""}`}
                    >
                      {isCompleted ? (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <p
                      className={`mt-1.5 whitespace-nowrap text-[10px] font-medium ${
                        isCompleted ? "text-[#F5F7FB]" : "text-[#8A96AC]"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[s]}
                    </p>
                  </div>
                  {i < ORDER_STATUS_FLOW.length - 1 && (
                    <div
                      className={`mx-1 h-0.5 w-8 sm:w-12 ${
                        i < currentIdx ? "bg-[#2563EB]" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Next status action */}
          {nextStatus && order.status === "received" && (
            <div className="mt-6 flex flex-col gap-2 border-t border-[#1E2A3F] pt-4 sm:flex-row sm:items-center sm:gap-3">
              <Button
                onClick={() => handleSendInvoice()}
                disabled={sendingInvoice}
                className="bg-[#2563EB] text-white hover:bg-[#15608c]"
              >
                {sendingInvoice ? "Sending invoice..." : "Send Invoice"}
              </Button>
              <p className="text-xs text-[#8A96AC]">
                Emails a PDF invoice (with bank transfer details) to{" "}
                {order.customer.email} and moves this order to
                &ldquo;Invoice Sent&rdquo;.
              </p>
            </div>
          )}

          {nextStatus && order.status !== "received" && (
            <div className="mt-6 flex items-center gap-3 border-t border-[#1E2A3F] pt-4">
              <Button
                onClick={() => handleStatusUpdate(nextStatus)}
                disabled={updating}
                className="bg-[#2563EB] text-white hover:bg-[#15608c]"
              >
                {updating
                  ? "Updating..."
                  : `Mark as ${ORDER_STATUS_LABELS[nextStatus]}`}
              </Button>
              {nextStatus === "dispatched" && (
                <p className="text-xs text-[#8A96AC]">
                  Customer will be emailed when dispatched
                </p>
              )}
            </div>
          )}

          {/* Invoice PDF download + re-send -- visible once an invoice has been sent */}
          {order.status !== "received" && order.status !== "cancelled" && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <a
                href={`/api/admin/orders/${ref}/invoice`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline"
              >
                View invoice PDF &rarr;
              </a>
              <Button
                type="button"
                onClick={() => handleSendInvoice({ resend: true })}
                disabled={sendingInvoice}
                className="h-8 bg-[#121A2B] text-xs font-medium text-[#2563EB] border border-[#2563EB] hover:bg-[#2563EB]/5"
              >
                {sendingInvoice ? "Re-sending..." : "Re-send invoice to customer"}
              </Button>
            </div>
          )}

          {invoiceMessage && (
            <p className="mt-3 text-sm font-medium text-emerald-600">
              {invoiceMessage}
            </p>
          )}

          {order.status === "delivered" && (
            <p className="mt-4 border-t border-[#1E2A3F] pt-4 text-sm font-medium text-emerald-600">
              This order is complete.
            </p>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          {/* Cancel order -- active, cancellable states only */}
          {canCancel && (
            <div className="mt-6 border-t border-[#1E2A3F] pt-4">
              <button
                onClick={handleCancelOrder}
                disabled={updating}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {updating ? "Cancelling..." : "Cancel this order"}
              </button>
              <p className="mt-1 text-[11px] text-[#8A96AC]">
                Hides the order from the active list. You can reinstate it
                later from the Cancelled tab.
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Customer info */}
          <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8A96AC]">
              Customer
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-[#F5F7FB]">
                  {order.customer.fullName}
                </p>
                <p className="text-[#8A96AC]">{order.customer.email}</p>
                {order.customer.phone && (
                  <p className="text-[#8A96AC]">{order.customer.phone}</p>
                )}
              </div>
              <div className="border-t border-[#1E2A3F] pt-3">
                <p className="mb-1 text-xs font-semibold uppercase text-[#8A96AC]">
                  Delivery Address
                </p>
                <p className="text-[#D4DBEC]">
                  {order.customer.addressLine1}
                  <br />
                  {order.customer.addressLine2 && (
                    <>
                      {order.customer.addressLine2}
                      <br />
                    </>
                  )}
                  {order.customer.city}
                  <br />
                  {order.customer.county && (
                    <>
                      {order.customer.county}
                      <br />
                    </>
                  )}
                  {order.customer.postcode}
                </p>
              </div>
            </div>
          </div>

          {/* Order summary */}
          <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8A96AC]">
              Order Summary
            </h2>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-gray-50 pb-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-[#F5F7FB]">
                      {item.productName}
                    </p>
                    <p className="text-xs text-[#8A96AC]">
                      {item.weight} &times; {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-[#F5F7FB]">
                    &pound;{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
              <div className="flex justify-between pt-1 text-sm text-[#8A96AC]">
                <span>Subtotal</span>
                <span>&pound;{order.subtotal.toFixed(2)}</span>
              </div>
              {order.discountCode && order.discountAmount ? (
                <div className="flex justify-between text-sm text-emerald-700">
                  <span>Discount ({order.discountCode})</span>
                  <span>-&pound;{order.discountAmount.toFixed(2)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm text-[#8A96AC]">
                <span>Postage (UK Tracked)</span>
                <span>&pound;{order.postage.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-[#1E2A3F] pt-2 text-base font-bold text-[#F5F7FB]">
                <span>Total</span>
                <span>&pound;{order.total.toFixed(2)}</span>
              </div>
            </div>

            {order.orderNotes && (
              <div className="mt-4 rounded-lg bg-[#0F1626] p-3">
                <p className="text-xs font-semibold uppercase text-[#8A96AC]">
                  Customer Notes
                </p>
                <p className="mt-1 text-sm text-[#D4DBEC]">
                  {order.orderNotes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Order origin -- request metadata captured at order time so the
            admin can spot scripted / off-region orders. All fields optional;
            if every field is missing (e.g. a legacy row) the panel is hidden. */}
        {order.clientMeta &&
          (order.clientMeta.ip ||
            order.clientMeta.userAgent ||
            order.clientMeta.country ||
            order.clientMeta.region ||
            order.clientMeta.city) && (
            <div className="mt-6 rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8A96AC]">
                Order Origin
              </h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-[#8A96AC]">
                    IP Address
                  </dt>
                  <dd className="mt-0.5 font-mono text-[#F5F7FB]">
                    {order.clientMeta.ip ?? "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-[#8A96AC]">
                    Approx. Location
                  </dt>
                  <dd className="mt-0.5 text-[#F5F7FB]">
                    {[
                      order.clientMeta.city,
                      order.clientMeta.region,
                      order.clientMeta.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "N/A"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-[#8A96AC]">
                    Device / User-Agent
                  </dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-[#B0BBD1]">
                    {order.clientMeta.userAgent ?? "N/A"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-[11px] text-[#8A96AC]">
                Captured for fraud prevention. IP and device information are
                self-reported by the request and may be obscured by VPNs or
                spoofed by automated tooling -- treat as a signal, not proof.
              </p>
            </div>
          )}

        {/* Status history */}
        <div className="mt-6 rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8A96AC]">
            Status History
          </h2>
          <div className="space-y-3">
            {order.statusHistory.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-[#2563EB]" />
                <div>
                  <p className="font-medium text-[#F5F7FB]">
                    {ORDER_STATUS_LABELS[entry.status]}
                  </p>
                  <p className="text-xs text-[#8A96AC]">
                    {new Date(entry.timestamp).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {entry.note && (
                    <p className="mt-0.5 text-[#B0BBD1]">{entry.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meta info */}
        <div className="mt-6 flex items-center gap-4 text-xs text-[#8A96AC]">
          <p>
            Created:{" "}
            {new Date(order.createdAt).toLocaleString("en-GB")}
          </p>
          <p>
            Updated:{" "}
            {new Date(order.updatedAt).toLocaleString("en-GB")}
          </p>
          <p>RUO: {order.ruoConfirmed ? "Confirmed" : "No"}</p>
          <p>Terms: {order.termsAccepted ? "Accepted" : "No"}</p>
        </div>
      </main>
    </div>
  );
}
