"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StoredOrder, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function AdminDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return [];
        }
        if (!res.ok) return [];
        return res.json();
      })
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      // "all" means all *active* orders -- cancelled orders are hidden
      // unless the admin explicitly selects the cancelled tab.
      if (statusFilter === "all" && o.status === "cancelled") return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          o.ref.toLowerCase().includes(q) ||
          o.customer.fullName.toLowerCase().includes(q) ||
          o.customer.email.toLowerCase().includes(q) ||
          o.customer.postcode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1626]">
        <p className="text-[#8A96AC]">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1626]">
      {/* Header */}
      <header className="border-b border-[#1E2A3F] bg-[#121A2B]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-[#F5F7FB]">
            <span className="text-[#2563EB]">31-32</span> Order Management
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/admin/orders/new">
              <Button
                size="sm"
                className="bg-[#2563EB] text-white hover:bg-[#15608c]"
              >
                + New order
              </Button>
            </Link>
            <Link href="/admin/products">
              <Button
                variant="outline"
                size="sm"
                className="text-[#2563EB] border-[#2563EB]/30 hover:bg-[#2563EB]/5"
              >
                Product Stock
              </Button>
            </Link>
            <Link href="/admin/discounts">
              <Button
                variant="outline"
                size="sm"
                className="text-[#2563EB] border-[#2563EB]/30 hover:bg-[#2563EB]/5"
              >
                Discount Codes
              </Button>
            </Link>
            <Link href="/admin/wholesale">
              <Button
                variant="outline"
                size="sm"
                className="text-[#2563EB] border-[#2563EB]/30 hover:bg-[#2563EB]/5"
              >
                Wholesale
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button
                variant="outline"
                size="sm"
                className="text-[#2563EB] border-[#2563EB]/30 hover:bg-[#2563EB]/5"
              >
                Admins
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-[#8A96AC]"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Stats row -- 6 happy-path states */}
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              "received",
              "invoice-sent",
              "invoice-paid",
              "packed",
              "dispatched",
              "delivered",
            ] as OrderStatus[]
          ).map((s) => (
            <button
              key={s}
              onClick={() =>
                setStatusFilter(statusFilter === s ? "all" : s)
              }
              className={`rounded-lg border p-3 text-left transition-colors ${
                statusFilter === s
                  ? "border-[#2563EB] bg-[#2563EB]/5"
                  : "border-[#1E2A3F] bg-[#121A2B] hover:border-[#2B3A54]"
              }`}
            >
              <p className="text-2xl font-bold text-[#F5F7FB]">
                {stats[s] || 0}
              </p>
              <p className="text-xs text-[#8A96AC]">
                {ORDER_STATUS_LABELS[s]}
              </p>
            </button>
          ))}
        </div>

        {/* Cancelled orders tile -- same size as the happy-path tiles, but
            on its own row so it sits visually outside the main flow. */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <button
            onClick={() =>
              setStatusFilter(statusFilter === "cancelled" ? "all" : "cancelled")
            }
            className={`rounded-lg border p-3 text-left transition-colors ${
              statusFilter === "cancelled"
                ? "border-red-400 bg-red-50"
                : "border-[#1E2A3F] bg-[#121A2B] hover:border-[#2B3A54]"
            }`}
          >
            <p className="text-2xl font-bold text-red-700">
              {stats["cancelled"] || 0}
            </p>
            <p className="text-xs text-[#8A96AC]">Cancelled</p>
          </button>
        </div>

        {/* Search + filter bar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by ref, name, email, or postcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-sm"
          />
          {statusFilter !== "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              Clear filter
            </Button>
          )}
          <p className="ml-auto text-sm text-[#8A96AC]">
            {filtered.length} order{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Orders table */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-12 text-center">
            <p className="text-[#8A96AC]">
              {orders.length === 0
                ? "No orders yet."
                : "No orders match your search."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#1E2A3F] bg-[#121A2B]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2A3F] bg-[#0F1626] text-left">
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Reference
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Date
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Customer
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Items
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1] text-right">
                      Total
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr
                      key={order.ref}
                      className="border-b border-gray-50 transition-colors hover:bg-[#0F1626] cursor-pointer"
                      onClick={() =>
                        router.push(`/admin/orders/${order.ref}`)
                      }
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-[#2563EB]">
                        {order.ref}
                      </td>
                      <td className="px-4 py-3 text-[#8A96AC] whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#F5F7FB]">
                          {order.customer.fullName}
                        </p>
                        <p className="text-xs text-[#8A96AC]">
                          {order.customer.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[#B0BBD1]">
                        {order.items.reduce((sum, i) => sum + i.quantity, 0)} item
                        {order.items.reduce((sum, i) => sum + i.quantity, 0) !== 1
                          ? "s"
                          : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#F5F7FB]">
                        &pound;{order.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`text-xs ${STATUS_COLORS[order.status]}`}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
