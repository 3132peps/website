"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VariantSummary {
  sku: string;
  weight: string;
  price: number;
  basePrice: number;
}

interface ProductSummary {
  slug: string;
  name: string;
  category: string;
  image: string | null;
  inStock: boolean;
  storefrontVisible: boolean;
  variants: VariantSummary[];
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  // Separate spinner state for the visibility toggle so flipping stock and
  // visibility on different rows doesn't fight each other for one flag.
  const [pendingVisibilitySlug, setPendingVisibilitySlug] = useState<
    string | null
  >(null);
  // Per-SKU price editor state. priceDrafts tracks the input value so the
  // admin can edit freely without committing on every keystroke; pendingSku
  // disables the row while a save/reset is in flight.
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  // Soft-delete confirmation state -- when set, the dialog is open for that
  // product. We deliberately confirm before firing the DELETE so the admin
  // doesn't nuke a product with one slip of the mouse.
  const [confirmDelete, setConfirmDelete] = useState<ProductSummary | null>(
    null,
  );
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/products");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load products.");
      const data = (await res.json()) as ProductSummary[];
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleStock(p: ProductSummary) {
    setPendingSlug(p.slug);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/products/${encodeURIComponent(p.slug)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-elv8-admin": "1",
          },
          body: JSON.stringify({ inStock: !p.inStock }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update stock status.");
      }
      // Optimistic local update so the UI reflects the new state without
      // re-fetching every product.
      setProducts((prev) =>
        prev.map((item) =>
          item.slug === p.slug ? { ...item, inStock: data.inStock } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setPendingSlug(null);
    }
  }

  async function toggleVisibility(p: ProductSummary) {
    setPendingVisibilitySlug(p.slug);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/products/${encodeURIComponent(p.slug)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-elv8-admin": "1",
          },
          body: JSON.stringify({ storefrontVisible: !p.storefrontVisible }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update visibility.");
      }
      setProducts((prev) =>
        prev.map((item) =>
          item.slug === p.slug
            ? { ...item, storefrontVisible: data.storefrontVisible }
            : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update visibility.",
      );
    } finally {
      setPendingVisibilitySlug(null);
    }
  }

  async function savePrice(product: ProductSummary, variant: VariantSummary) {
    const raw = priceDrafts[variant.sku];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(`Enter a valid price for ${product.name} (${variant.weight}).`);
      return;
    }
    setPendingSku(variant.sku);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/products/${encodeURIComponent(product.slug)}/variants/${encodeURIComponent(variant.sku)}/price`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-elv8-admin": "1",
          },
          body: JSON.stringify({ price: parsed }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update price.");
      setProducts((prev) =>
        prev.map((p) =>
          p.slug === product.slug
            ? {
                ...p,
                variants: p.variants.map((v) =>
                  v.sku === variant.sku ? { ...v, price: data.price } : v,
                ),
              }
            : p,
        ),
      );
      setPriceDrafts((prev) => {
        const { [variant.sku]: _dropped, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update price.");
    } finally {
      setPendingSku(null);
    }
  }

  async function resetPrice(product: ProductSummary, variant: VariantSummary) {
    setPendingSku(variant.sku);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/products/${encodeURIComponent(product.slug)}/variants/${encodeURIComponent(variant.sku)}/price`,
        {
          method: "DELETE",
          headers: { "x-elv8-admin": "1" },
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reset price.");
      setProducts((prev) =>
        prev.map((p) =>
          p.slug === product.slug
            ? {
                ...p,
                variants: p.variants.map((v) =>
                  v.sku === variant.sku ? { ...v, price: data.price } : v,
                ),
              }
            : p,
        ),
      );
      setPriceDrafts((prev) => {
        const { [variant.sku]: _dropped, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset price.");
    } finally {
      setPendingSku(null);
    }
  }

  async function deleteProduct(p: ProductSummary) {
    setDeletingSlug(p.slug);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/products/${encodeURIComponent(p.slug)}`,
        {
          method: "DELETE",
          headers: { "x-elv8-admin": "1" },
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete product.");
      }
      // Drop the row locally so the table updates without a refetch.
      setProducts((prev) => prev.filter((item) => item.slug !== p.slug));
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingSlug(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
      );
    });
  }, [products, search]);

  const stats = useMemo(() => {
    const total = products.length;
    const outOfStock = products.filter((p) => !p.inStock).length;
    const hidden = products.filter((p) => !p.storefrontVisible).length;
    return { total, inStock: total - outOfStock, outOfStock, hidden };
  }, [products]);

  return (
    <div className="min-h-screen bg-[#0F1626]">
      <header className="border-b border-[#1E2A3F] bg-[#121A2B]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm text-[#8A96AC] hover:text-[#2563EB]"
            >
              &larr; Orders
            </Link>
            <h1 className="text-lg font-bold text-[#F5F7FB]">
              <span className="text-[#2563EB]">31-32</span> Products
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/products/new"
              className="inline-flex h-8 items-center rounded-lg bg-[#2563EB] px-3 text-sm font-medium text-white hover:bg-[#15608c]"
            >
              + New product
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
        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3">
            <p className="text-2xl font-bold text-[#F5F7FB]">{stats.total}</p>
            <p className="text-xs text-[#8A96AC]">Total products</p>
          </div>
          <div className="rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3">
            <p className="text-2xl font-bold text-emerald-600">
              {stats.inStock}
            </p>
            <p className="text-xs text-[#8A96AC]">In stock</p>
          </div>
          <div className="rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3">
            <p className="text-2xl font-bold text-red-600">
              {stats.outOfStock}
            </p>
            <p className="text-xs text-[#8A96AC]">Out of stock</p>
          </div>
          <div className="rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3">
            <p className="text-2xl font-bold text-[#D4DBEC]">{stats.hidden}</p>
            <p className="text-xs text-[#8A96AC]">Hidden from site</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <Input
            placeholder="Search by name, category, or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-md"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-12 text-center text-[#8A96AC]">
            Loading products...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-12 text-center text-[#8A96AC]">
            No products match your search.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#1E2A3F] bg-[#121A2B]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2A3F] bg-[#0F1626] text-left">
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Product
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Category
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1]">
                      Prices
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#B0BBD1] text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const pending = pendingSlug === p.slug;
                    const visibilityPending = pendingVisibilitySlug === p.slug;
                    return (
                      <tr
                        key={p.slug}
                        className="border-b border-gray-50 hover:bg-[#0F1626]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gradient-to-b from-[#1A2439] to-white">
                              {p.image ? (
                                <Image
                                  src={p.image}
                                  alt={p.name}
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-[#F5F7FB]">
                                {p.name}
                              </p>
                              <p className="truncate text-xs text-[#8A96AC]">
                                {p.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#B0BBD1]">
                          {p.category}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            {p.inStock ? (
                              <Badge className="bg-emerald-100 text-emerald-700">
                                In stock
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700">
                                Out of stock
                              </Badge>
                            )}
                            {!p.storefrontVisible && (
                              <Badge className="bg-gray-200 text-[#D4DBEC]">
                                Hidden from site
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-2">
                            {p.variants.map((v) => {
                              const draft = priceDrafts[v.sku];
                              const draftValue =
                                draft !== undefined
                                  ? draft
                                  : v.price.toFixed(2);
                              const parsedDraft = Number(draftValue);
                              const isOverridden = v.price !== v.basePrice;
                              const isDirty =
                                Number.isFinite(parsedDraft) &&
                                Math.abs(parsedDraft - v.price) > 0.001;
                              const savingThis = pendingSku === v.sku;
                              return (
                                <div
                                  key={v.sku}
                                  className="flex flex-wrap items-center gap-2"
                                >
                                  <span className="w-16 shrink-0 text-xs font-medium text-[#B0BBD1]">
                                    {v.weight}
                                  </span>
                                  <div className="relative">
                                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#8A96AC]">
                                      £
                                    </span>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={draftValue}
                                      onChange={(e) =>
                                        setPriceDrafts((prev) => ({
                                          ...prev,
                                          [v.sku]: e.target.value,
                                        }))
                                      }
                                      className="h-8 w-24 pl-5 text-xs"
                                      disabled={savingThis}
                                    />
                                  </div>
                                  {isDirty && (
                                    <Button
                                      size="sm"
                                      onClick={() => savePrice(p, v)}
                                      disabled={savingThis}
                                      className="h-8 bg-[#2563EB] text-white hover:bg-[#15608c]"
                                    >
                                      {savingThis ? "Saving..." : "Save"}
                                    </Button>
                                  )}
                                  {isOverridden && !isDirty && (
                                    <>
                                      <Badge className="bg-amber-100 text-amber-800">
                                        Overridden · base £
                                        {v.basePrice.toFixed(2)}
                                      </Badge>
                                      <button
                                        type="button"
                                        onClick={() => resetPrice(p, v)}
                                        disabled={savingThis}
                                        className="text-xs font-medium text-[#B0BBD1] hover:text-red-700 disabled:opacity-50"
                                      >
                                        Reset
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pending}
                              onClick={() => toggleStock(p)}
                              className={
                                p.inStock
                                  ? "border-red-200 text-red-700 hover:bg-red-50"
                                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              }
                            >
                              {pending
                                ? "Saving..."
                                : p.inStock
                                  ? "Mark out of stock"
                                  : "Mark in stock"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={visibilityPending}
                              onClick={() => toggleVisibility(p)}
                              className={
                                p.storefrontVisible
                                  ? "border-[#2B3A54] text-[#D4DBEC] hover:bg-[#1A2439]"
                                  : "border-[#2563EB]/40 text-[#2563EB] hover:bg-[#2563EB]/10"
                              }
                              title={
                                p.storefrontVisible
                                  ? "Hide this product from the public storefront. It stays available in admin."
                                  : "Show this product on the public storefront."
                              }
                            >
                              {visibilityPending
                                ? "Saving..."
                                : p.storefrontVisible
                                  ? "Hide from site"
                                  : "Show on site"}
                            </Button>
                            <Link
                              href={`/admin/products/${encodeURIComponent(p.slug)}/edit`}
                              className="inline-flex h-7 items-center rounded-[12px] border border-input bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                            >
                              Edit
                            </Link>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmDelete(p)}
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Delete confirmation dialog ----------------------------------- */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this product?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-[#F5F7FB]">
                {confirmDelete?.name}
              </span>{" "}
              will be hidden from the storefront and removed from search.
              Existing orders that reference it will keep working. The product
              can be recovered from the database for 30 days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(null)}
              disabled={deletingSlug !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmDelete && deleteProduct(confirmDelete)}
              disabled={deletingSlug !== null}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deletingSlug ? "Deleting..." : "Delete product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
