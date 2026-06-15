"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DiscountCode, DiscountType, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import productsData from "@/data/products.json";

// Baseline product catalogue. We use the static JSON here rather than the
// live list from /api/admin/products because this picker is only about
// which SKUs a code applies to -- a product being out of stock doesn't
// remove it from the picker; the admin may still want to pre-configure
// codes for products that are temporarily paused.
const ALL_PRODUCTS = productsData as Product[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(code: DiscountCode): string {
  return code.type === "percent"
    ? `${code.value}% off`
    : `£${code.value.toFixed(2)} off`;
}

function formatExpiry(iso?: string): string {
  if (!iso) return "No expiry";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isExpired(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

function toDateInputValue(iso?: string): string {
  // <input type="date"> expects YYYY-MM-DD, so strip the time component.
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminDiscountsPage() {
  const router = useRouter();

  // List state
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  // Form state (create or edit)
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [code, setCode] = useState("");
  const [type, setType] = useState<DiscountType>("percent");
  const [value, setValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [maxUsages, setMaxUsages] = useState("");
  const [onePerCustomer, setOnePerCustomer] = useState(false);
  // A code's product scope is one of: every product (default), only a
  // hand-picked list, or every product except a hand-picked list. The same
  // slug list drives both restricted modes, so we only need a single
  // selection state.
  const [productScope, setProductScope] = useState<"all" | "only" | "except">(
    "all",
  );
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Group products by category once for the picker, applying the
  // admin-typed filter live.
  const productGroups = useMemo(() => {
    const filter = productFilter.trim().toLowerCase();
    const matched = ALL_PRODUCTS.filter(
      (p) =>
        !filter ||
        p.name.toLowerCase().includes(filter) ||
        p.slug.toLowerCase().includes(filter) ||
        p.category.toLowerCase().includes(filter),
    );
    const byCategory = new Map<string, Product[]>();
    for (const p of matched) {
      const bucket = byCategory.get(p.category) ?? [];
      bucket.push(p);
      byCategory.set(p.category, bucket);
    }
    return Array.from(byCategory.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [productFilter]);

  function toggleSelectedProduct(slug: string) {
    setSelectedProducts((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  // Load codes
  async function loadCodes() {
    setLoading(true);
    setListError("");
    try {
      const res = await fetch("/api/admin/discounts");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load discount codes.");
      const data = (await res.json()) as DiscountCode[];
      setCodes(data);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load codes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear the form back to "create" mode
  function resetForm() {
    setEditing(null);
    setCode("");
    setType("percent");
    setValue("");
    setMinOrderValue("");
    setMaxUsages("");
    setOnePerCustomer(false);
    setProductScope("all");
    setSelectedProducts([]);
    setProductFilter("");
    setExpiresAt("");
    setActive(true);
    setFormError("");
    setFormSuccess("");
  }

  // Populate the form from an existing code (edit mode)
  function startEditing(d: DiscountCode) {
    setEditing(d);
    setCode(d.code);
    setType(d.type);
    setValue(String(d.value));
    setMinOrderValue(d.minOrderValue !== undefined ? String(d.minOrderValue) : "");
    setMaxUsages(d.maxUsages !== undefined ? String(d.maxUsages) : "");
    setOnePerCustomer((d.perCustomerLimit ?? 0) === 1);
    if (d.eligibleProducts && d.eligibleProducts.length > 0) {
      setProductScope("only");
      setSelectedProducts([...d.eligibleProducts]);
    } else if (d.excludedProducts && d.excludedProducts.length > 0) {
      setProductScope("except");
      setSelectedProducts([...d.excludedProducts]);
    } else {
      setProductScope("all");
      setSelectedProducts([]);
    }
    setProductFilter("");
    setExpiresAt(toDateInputValue(d.expiresAt));
    setActive(d.active);
    setFormError("");
    setFormSuccess("");
    // Scroll to the form for convenience on mobile
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Shared submit handler: POST for create, PATCH for edit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!code.trim()) {
      setFormError("Please enter a code name (e.g. SAVE10).");
      return;
    }
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue <= 0) {
      setFormError("Please enter a positive discount value.");
      return;
    }
    if (type === "percent" && numValue > 100) {
      setFormError("Percentage cannot exceed 100.");
      return;
    }

    const numMinOrder = minOrderValue.trim() ? Number(minOrderValue) : null;
    if (numMinOrder !== null && (!Number.isFinite(numMinOrder) || numMinOrder < 0)) {
      setFormError("Minimum order value must be a number.");
      return;
    }

    const numMaxUsages = maxUsages.trim() ? Number(maxUsages) : null;
    if (
      numMaxUsages !== null &&
      (!Number.isInteger(numMaxUsages) || numMaxUsages < 1)
    ) {
      setFormError("Max usages must be a whole number (1 or more).");
      return;
    }

    if (productScope !== "all" && selectedProducts.length === 0) {
      setFormError(
        productScope === "only"
          ? "Pick at least one product, or switch to \"All products\"."
          : "Pick at least one product to exclude, or switch to \"All products\".",
      );
      return;
    }

    // Build the expiry timestamp. A date input like "2026-12-31" is treated
    // as end-of-day in the user's local time so the code stays valid on the
    // final day.
    let expiresIso: string | null = null;
    if (expiresAt.trim()) {
      const d = new Date(expiresAt + "T23:59:59");
      if (Number.isNaN(d.getTime())) {
        setFormError("Expiry date is invalid.");
        return;
      }
      expiresIso = d.toISOString();
    }

    setSaving(true);
    try {
      const payload = {
        code: code.trim(),
        type,
        value: numValue,
        minOrderValue: numMinOrder,
        maxUsages: numMaxUsages,
        perCustomerLimit: onePerCustomer ? 1 : null,
        eligibleProducts: productScope === "only" ? selectedProducts : null,
        excludedProducts: productScope === "except" ? selectedProducts : null,
        expiresAt: expiresIso,
        active,
      };

      const url = editing
        ? `/api/admin/discounts/${encodeURIComponent(editing.code)}`
        : "/api/admin/discounts";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-elv8-admin": "1",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save discount code.");
      }

      setFormSuccess(editing ? "Discount code updated." : "Discount code created.");
      resetForm();
      await loadCodes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  // Quick toggle active/inactive from the table
  async function toggleActive(d: DiscountCode) {
    try {
      const res = await fetch(
        `/api/admin/discounts/${encodeURIComponent(d.code)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-elv8-admin": "1",
          },
          body: JSON.stringify({ active: !d.active }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update.");
      }
      await loadCodes();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to update.");
    }
  }

  async function handleDelete(d: DiscountCode) {
    const confirmed = window.confirm(
      `Delete discount code "${d.code}"?\n\nThis permanently removes the code. Any previous orders that used it are unaffected.`,
    );
    if (!confirmed) return;
    try {
      const res = await fetch(
        `/api/admin/discounts/${encodeURIComponent(d.code)}`,
        {
          method: "DELETE",
          headers: {
            "x-elv8-admin": "1",
          },
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete.");
      }
      if (editing?.code === d.code) resetForm();
      await loadCodes();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const stats = useMemo(() => {
    const total = codes.length;
    const activeCount = codes.filter(
      (c) => c.active && !isExpired(c.expiresAt),
    ).length;
    const expired = codes.filter((c) => isExpired(c.expiresAt)).length;
    return { total, activeCount, expired };
  }, [codes]);

  return (
    <div className="min-h-screen bg-[#0F1626]">
      {/* Header */}
      <header className="border-b border-[#1E2A3F] bg-[#121A2B]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm text-[#8A96AC] hover:text-[#2563EB]"
            >
              &larr; Orders
            </Link>
            <Link
              href="/admin/products"
              className="text-sm text-[#8A96AC] hover:text-[#2563EB]"
            >
              Product Stock
            </Link>
            <h1 className="text-lg font-bold text-[#F5F7FB]">
              <span className="text-[#2563EB]">31-32</span> Discount Codes
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
        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3">
            <p className="text-2xl font-bold text-[#F5F7FB]">{stats.total}</p>
            <p className="text-xs text-[#8A96AC]">Total codes</p>
          </div>
          <div className="rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3">
            <p className="text-2xl font-bold text-emerald-600">
              {stats.activeCount}
            </p>
            <p className="text-xs text-[#8A96AC]">Active</p>
          </div>
          <div className="rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3">
            <p className="text-2xl font-bold text-[#8A96AC]">{stats.expired}</p>
            <p className="text-xs text-[#8A96AC]">Expired</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* ---- Create / edit form ---- */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[#F5F7FB]">
                {editing ? `Edit ${editing.code}` : "Create Discount Code"}
              </h2>

              {formError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  {formSuccess}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Code */}
                <div className="space-y-1.5">
                  <Label htmlFor="code">
                    Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    required
                    placeholder="e.g. SAVE10"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))
                    }
                    disabled={Boolean(editing)}
                    className="font-mono uppercase"
                  />
                  <p className="text-xs text-[#8A96AC]">
                    Case-insensitive. Letters, numbers, no spaces.
                  </p>
                </div>

                {/* Type */}
                <div className="space-y-1.5">
                  <Label>
                    Discount type <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType("percent")}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        type === "percent"
                          ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB]"
                          : "border-[#1E2A3F] bg-[#121A2B] text-[#B0BBD1] hover:border-[#2B3A54]"
                      }`}
                    >
                      % off
                    </button>
                    <button
                      type="button"
                      onClick={() => setType("fixed")}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        type === "fixed"
                          ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB]"
                          : "border-[#1E2A3F] bg-[#121A2B] text-[#B0BBD1] hover:border-[#2B3A54]"
                      }`}
                    >
                      £ off
                    </button>
                  </div>
                </div>

                {/* Value */}
                <div className="space-y-1.5">
                  <Label htmlFor="value">
                    Value <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    {type === "fixed" && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A96AC]">
                        £
                      </span>
                    )}
                    <Input
                      id="value"
                      type="number"
                      min="0"
                      step={type === "percent" ? "1" : "0.01"}
                      required
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={type === "percent" ? "10" : "5.00"}
                      className={type === "fixed" ? "pl-7" : ""}
                    />
                    {type === "percent" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8A96AC]">
                        %
                      </span>
                    )}
                  </div>
                </div>

                {/* Min order */}
                <div className="space-y-1.5">
                  <Label htmlFor="minOrderValue">
                    Minimum order (optional)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A96AC]">
                      £
                    </span>
                    <Input
                      id="minOrderValue"
                      type="number"
                      min="0"
                      step="0.01"
                      value={minOrderValue}
                      onChange={(e) => setMinOrderValue(e.target.value)}
                      placeholder="e.g. 100"
                      className="pl-7"
                    />
                  </div>
                  <p className="text-xs text-[#8A96AC]">
                    Only applies to orders with a subtotal at or above this amount.
                  </p>
                </div>

                {/* Max usages */}
                <div className="space-y-1.5">
                  <Label htmlFor="maxUsages">Max usages (optional)</Label>
                  <Input
                    id="maxUsages"
                    type="number"
                    min="1"
                    step="1"
                    value={maxUsages}
                    onChange={(e) => setMaxUsages(e.target.value)}
                    placeholder="e.g. 50"
                  />
                  <p className="text-xs text-[#8A96AC]">
                    Total times the code can be used across all customers. Leave empty for unlimited.
                  </p>
                </div>

                {/* One per customer */}
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={onePerCustomer}
                    onChange={(e) => setOnePerCustomer(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#2B3A54] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <span className="text-sm text-[#F5F7FB]/80">
                    Limit to one use per customer
                    <span className="mt-0.5 block text-xs font-normal text-[#8A96AC]">
                      Each customer email can only redeem this code once. We
                      identify customers by their email at checkout.
                    </span>
                  </span>
                </label>

                {/* Product scope: all, only selected, or all except selected */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#F5F7FB]">
                    Product scope
                  </p>
                  <div className="space-y-1.5">
                    {(
                      [
                        {
                          value: "all",
                          label: "All products",
                          hint: "Discount applies to every item in the basket.",
                        },
                        {
                          value: "only",
                          label: "Only selected products",
                          hint: "Discount only applies to the line totals of the products you pick.",
                        },
                        {
                          value: "except",
                          label: "All except selected products",
                          hint: "Discount applies to everything except the products you pick.",
                        },
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-start gap-3"
                      >
                        <input
                          type="radio"
                          name="productScope"
                          value={opt.value}
                          checked={productScope === opt.value}
                          onChange={() => {
                            setProductScope(opt.value);
                            if (opt.value === "all") {
                              setSelectedProducts([]);
                              setProductFilter("");
                            }
                          }}
                          className="mt-0.5 h-4 w-4 border-[#2B3A54] text-[#2563EB] focus:ring-[#2563EB]"
                        />
                        <span className="text-sm text-[#F5F7FB]/80">
                          {opt.label}
                          <span className="mt-0.5 block text-xs font-normal text-[#8A96AC]">
                            {opt.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>

                  {productScope !== "all" && (
                    <div className="rounded-lg border border-[#1E2A3F] bg-[#0F1626] p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Input
                          type="text"
                          value={productFilter}
                          onChange={(e) => setProductFilter(e.target.value)}
                          placeholder="Filter products..."
                          className="h-8 bg-[#121A2B] text-xs"
                        />
                        <span className="shrink-0 text-xs font-medium text-[#B0BBD1]">
                          {selectedProducts.length} selected
                        </span>
                      </div>
                      <div className="flex gap-2 pb-2 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedProducts(
                              ALL_PRODUCTS.map((p) => p.slug),
                            )
                          }
                          className="font-medium text-[#2563EB] hover:underline"
                        >
                          Select all
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedProducts([])}
                          className="font-medium text-[#B0BBD1] hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto rounded-md border border-[#1E2A3F] bg-[#121A2B]">
                        {productGroups.length === 0 ? (
                          <p className="p-3 text-xs text-[#8A96AC]">
                            No products match that filter.
                          </p>
                        ) : (
                          productGroups.map(([category, products]) => (
                            <div key={category} className="border-b border-[#1E2A3F] last:border-b-0">
                              <p className="bg-[#0F1626] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8A96AC]">
                                {category}
                              </p>
                              {products.map((p) => {
                                const checked = selectedProducts.includes(p.slug);
                                return (
                                  <label
                                    key={p.slug}
                                    className="flex cursor-pointer items-start gap-2 px-3 py-1.5 text-xs hover:bg-[#0F1626]"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleSelectedProduct(p.slug)}
                                      className="mt-0.5 h-3.5 w-3.5 rounded border-[#2B3A54] text-[#2563EB] focus:ring-[#2563EB]"
                                    />
                                    <span className="text-[#F5F7FB]">
                                      {p.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Expiry */}
                <div className="space-y-1.5">
                  <Label htmlFor="expiresAt">Expiry date (optional)</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                  <p className="text-xs text-[#8A96AC]">
                    Code stops working at the end of this day.
                  </p>
                </div>

                {/* Active */}
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#2B3A54] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <span className="text-sm text-[#F5F7FB]/80">
                    Active — customers can apply this code at checkout
                  </span>
                </label>

                {/* Submit */}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#2563EB] text-white hover:bg-[#15608c]"
                  >
                    {saving
                      ? "Saving..."
                      : editing
                        ? "Update Code"
                        : "Create Code"}
                  </Button>
                  {editing && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* ---- List of codes ---- */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] shadow-sm">
              <div className="border-b border-[#1E2A3F] px-6 py-4">
                <h2 className="text-lg font-semibold text-[#F5F7FB]">
                  All Codes
                </h2>
              </div>

              {listError && (
                <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {listError}
                </div>
              )}

              {loading ? (
                <div className="p-12 text-center text-[#8A96AC]">
                  Loading discount codes...
                </div>
              ) : codes.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-[#8A96AC]">No discount codes yet.</p>
                  <p className="mt-1 text-xs text-[#8A96AC]">
                    Use the form on the left to create your first code.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#1E2A3F]">
                  {codes.map((d) => {
                    const expired = isExpired(d.expiresAt);
                    const maxed =
                      d.maxUsages !== undefined && d.timesUsed >= d.maxUsages;
                    const inactive = !d.active || expired || maxed;
                    return (
                      <div key={d.code} className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-base font-bold text-[#2563EB]">
                                {d.code}
                              </span>
                              {inactive ? (
                                <Badge className="bg-[#1A2439] text-[#8A96AC]">
                                  {expired
                                    ? "Expired"
                                    : maxed
                                      ? "Used up"
                                      : "Inactive"}
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  Active
                                </Badge>
                              )}
                              {d.perCustomerLimit === 1 && (
                                <Badge className="bg-indigo-100 text-indigo-700">
                                  1 per customer
                                </Badge>
                              )}
                              {(() => {
                                const whitelist = d.eligibleProducts;
                                const blacklist = d.excludedProducts;
                                const active =
                                  whitelist && whitelist.length > 0
                                    ? { list: whitelist, mode: "only" as const }
                                    : blacklist && blacklist.length > 0
                                      ? { list: blacklist, mode: "except" as const }
                                      : null;
                                if (!active) return null;
                                const names = active.list
                                  .map((slug) => {
                                    const p = ALL_PRODUCTS.find(
                                      (pp) => pp.slug === slug,
                                    );
                                    return p ? p.name : slug;
                                  })
                                  .join(", ");
                                const label =
                                  active.mode === "only"
                                    ? `${active.list.length} product${active.list.length === 1 ? "" : "s"} only`
                                    : `Excludes ${active.list.length} product${active.list.length === 1 ? "" : "s"}`;
                                const className =
                                  active.mode === "only"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800";
                                return (
                                  <Badge className={className} title={names}>
                                    {label}
                                  </Badge>
                                );
                              })()}
                            </div>

                            <p className="mt-1 text-sm font-semibold text-[#F5F7FB]">
                              {formatValue(d)}
                            </p>

                            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#8A96AC] sm:grid-cols-3">
                              <div>
                                <span className="font-medium text-[#B0BBD1]">
                                  Used:
                                </span>{" "}
                                {d.timesUsed}
                                {d.maxUsages !== undefined
                                  ? ` / ${d.maxUsages}`
                                  : ""}
                              </div>
                              <div>
                                <span className="font-medium text-[#B0BBD1]">
                                  Expires:
                                </span>{" "}
                                {formatExpiry(d.expiresAt)}
                              </div>
                              <div>
                                <span className="font-medium text-[#B0BBD1]">
                                  Min order:
                                </span>{" "}
                                {d.minOrderValue !== undefined
                                  ? `£${d.minOrderValue.toFixed(2)}`
                                  : "None"}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditing(d)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleActive(d)}
                            >
                              {d.active ? "Deactivate" : "Activate"}
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleDelete(d)}
                              className="text-xs font-medium text-red-600 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
