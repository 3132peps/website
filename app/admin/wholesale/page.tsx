"use client";

// ---------------------------------------------------------------------------
// /admin/wholesale -- list of submitted wholesale enquiries
// ---------------------------------------------------------------------------
//
// Mirrors the admin/orders dashboard pattern: status tiles act as filters,
// search box narrows by free text, click a row to drill into the detail.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WHOLESALE_STATUS_LABELS,
  BUSINESS_TYPE_LABELS,
  MONTHLY_VOLUME_LABELS,
  type StoredWholesaleEnquiry,
  type WholesaleStatus,
} from "@/lib/wholesale";

const STATUS_COLOURS: Record<WholesaleStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_ORDER: WholesaleStatus[] = [
  "new",
  "contacted",
  "qualified",
  "rejected",
];

export default function AdminWholesalePage() {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<StoredWholesaleEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WholesaleStatus | "all">(
    "all",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/wholesale")
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return [];
        }
        if (!res.ok) throw new Error("Failed to load enquiries.");
        return res.json();
      })
      .then(setEnquiries)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load."),
      )
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enquiries.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.businessName.toLowerCase().includes(q) ||
        e.businessEmail.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q)
      );
    });
  }, [enquiries, search, statusFilter]);

  const stats = useMemo(() => {
    const counts: Record<WholesaleStatus, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      rejected: 0,
    };
    for (const e of enquiries) counts[e.status] += 1;
    return counts;
  }, [enquiries]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1626]">
        <p className="text-[#8A96AC]">Loading enquiries...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1626]">
      <header className="border-b border-[#1E2A3F] bg-[#121A2B]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm text-[#8A96AC] hover:text-[#2563EB]"
            >
              &larr; Orders
            </Link>
            <h1 className="text-lg font-bold text-[#F5F7FB]">
              <span className="text-[#2563EB]">31-32</span> Wholesale
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-[#8A96AC]"
          >
            Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Status tiles */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() =>
                setStatusFilter((prev) => (prev === s ? "all" : s))
              }
              className={`rounded-lg border p-3 text-left transition-colors ${
                statusFilter === s
                  ? "border-[#2563EB] bg-[#2563EB]/5"
                  : "border-[#1E2A3F] bg-[#121A2B] hover:border-[#2B3A54]"
              }`}
            >
              <p className="text-2xl font-bold text-[#F5F7FB]">
                {stats[s] ?? 0}
              </p>
              <p className="text-xs text-[#8A96AC]">
                {WHOLESALE_STATUS_LABELS[s]}
              </p>
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by name, business, email, country..."
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
            {filtered.length} enquir{filtered.length === 1 ? "y" : "ies"}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-12 text-center text-[#8A96AC]">
            {enquiries.length === 0
              ? "No wholesale enquiries yet."
              : "No enquiries match your filter."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#1E2A3F] bg-[#121A2B]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2A3F] bg-[#0F1626] text-left">
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Submitted
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Submitter
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Business
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Volume
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => router.push(`/admin/wholesale/${e.id}`)}
                      className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-[#0F1626]"
                    >
                      <td className="px-4 py-3 text-[#8A96AC] whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#F5F7FB]">
                          {e.fullName}
                        </p>
                        <p className="text-xs text-[#8A96AC]">
                          {e.businessEmail}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#F5F7FB]">
                          {e.businessName}
                        </p>
                        <p className="text-xs text-[#8A96AC]">
                          {BUSINESS_TYPE_LABELS[e.businessType] ??
                            e.businessType}{" "}
                          &middot; {e.country}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[#B0BBD1]">
                        {MONTHLY_VOLUME_LABELS[e.monthlyVolume] ??
                          e.monthlyVolume}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`text-xs ${STATUS_COLOURS[e.status]}`}
                        >
                          {WHOLESALE_STATUS_LABELS[e.status]}
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
