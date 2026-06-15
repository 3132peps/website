"use client";

// ---------------------------------------------------------------------------
// Admin product editor form, used by both /admin/products/new (create) and
// /admin/products/[slug]/edit (update).
//
// The form is intentionally a single big controlled component -- the field
// list isn't long enough to justify React Hook Form, and the validation
// happens server-side in lib/products-validation.ts so any error the user
// sees here is exactly what the API returned. Empty arrays / empty strings
// are normalised on submit so the JSON payload matches the API's shape.
// ---------------------------------------------------------------------------

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BundleItem, Product, ProductVariant } from "@/lib/types";

type Mode = "create" | "edit";

interface ProductFormProps {
  mode: Mode;
  initial?: Product;
}

interface FormState {
  slug: string;
  name: string;
  category: string;
  format: "" | "vial" | "pen" | "nasal";
  description: string;
  researchContext: string;
  purity: string;
  molecularWeight: string;
  sequence: string;
  storageInstructions: string;
  coaUrl: string;
  inStock: boolean;
  storefrontVisible: boolean;
  contactForPrice: boolean;
  bulkDeal: string;
  bulkDealQty: string;
  bulkDealPrice: string;
  // Arrays edited as comma-separated strings or repeating fields
  tagsText: string;
  relatedSlugsText: string;
  images: string[];
  // Variants carry an optional `compareAtPrice` (set when this variant is on
  // sale -- the strikethrough price the storefront renders next to `price`).
  variants: ProductVariant[];
  // Bundle support
  isBundle: boolean;
  bundleItems: BundleItem[];
}

function fromProduct(p: Product | undefined): FormState {
  return {
    slug: p?.slug ?? "",
    name: p?.name ?? "",
    category: p?.category ?? "",
    format: (p?.format ?? "") as FormState["format"],
    description: p?.description ?? "",
    researchContext: p?.researchContext ?? "",
    purity: p?.purity ?? "",
    molecularWeight: p?.molecularWeight ?? "",
    sequence: p?.sequence ?? "",
    storageInstructions: p?.storageInstructions ?? "",
    coaUrl: p?.coaUrl ?? "",
    inStock: p?.inStock ?? true,
    // Defaults to true for new products. Existing rows that pre-date the
    // flag come back as `undefined` from the DB facade, which the !== false
    // check coerces to true (i.e. visible) -- the same behaviour they had
    // before the column existed.
    storefrontVisible: p?.storefrontVisible !== false,
    contactForPrice: p?.contactForPrice ?? false,
    bulkDeal: p?.bulkDeal ?? "",
    bulkDealQty: p?.bulkDealQty != null ? String(p.bulkDealQty) : "",
    bulkDealPrice: p?.bulkDealPrice != null ? String(p.bulkDealPrice) : "",
    tagsText: (p?.tags ?? []).join(", "),
    relatedSlugsText: (p?.relatedSlugs ?? []).join(", "),
    images: p?.images?.length ? [...p.images] : [""],
    variants: p?.variants?.length
      ? p.variants.map((v) => ({ ...v }))
      : [{ weight: "", sku: "", price: 0 }],
    isBundle: p?.isBundle ?? false,
    bundleItems: p?.bundleItems ? p.bundleItems.map((b) => ({ ...b })) : [],
  };
}

function splitCsv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// Minimal projection of the admin catalogue we need for the bundle item
// picker. Mirrors the response shape returned by GET /api/admin/products.
interface CatalogueProductSummary {
  slug: string;
  name: string;
  variants: { sku: string; weight: string; price: number }[];
}

export default function ProductForm({ mode, initial }: ProductFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => fromProduct(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Catalogue used by the bundle item picker. Loaded on mount because the
  // form is a client component and the server-rendered page doesn't pass
  // this through. We exclude the product currently being edited so the
  // admin can't accidentally bundle a product into itself.
  const [catalogue, setCatalogue] = useState<CatalogueProductSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/products")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CatalogueProductSummary[]) => {
        if (cancelled) return;
        setCatalogue(
          data
            .filter((p) => p.slug !== state.slug)
            .map((p) => ({
              slug: p.slug,
              name: p.name,
              variants: p.variants ?? [],
            })),
        );
      })
      .catch(() => setCatalogue([]));
    return () => {
      cancelled = true;
    };
    // We intentionally key on the slug -- once the slug changes (which only
    // happens at create time before the first save) we want to refresh the
    // exclusion. The catalogue itself doesn't update mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.slug]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function updateVariant(
    i: number,
    patch: Partial<ProductVariant>,
  ) {
    setState((prev) => ({
      ...prev,
      variants: prev.variants.map((v, idx) =>
        idx === i ? { ...v, ...patch } : v,
      ),
    }));
  }

  function addVariant() {
    setState((prev) => ({
      ...prev,
      variants: [...prev.variants, { weight: "", sku: "", price: 0 }],
    }));
  }

  function removeVariant(i: number) {
    setState((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== i),
    }));
  }

  function updateBundleItem(i: number, patch: Partial<BundleItem>) {
    setState((prev) => ({
      ...prev,
      bundleItems: prev.bundleItems.map((b, idx) =>
        idx === i ? { ...b, ...patch } : b,
      ),
    }));
  }

  function addBundleItem() {
    setState((prev) => ({
      ...prev,
      bundleItems: [
        ...prev.bundleItems,
        { productSlug: "", weight: "", label: "" },
      ],
    }));
  }

  function removeBundleItem(i: number) {
    setState((prev) => ({
      ...prev,
      bundleItems: prev.bundleItems.filter((_, idx) => idx !== i),
    }));
  }

  function updateImage(i: number, value: string) {
    setState((prev) => ({
      ...prev,
      images: prev.images.map((img, idx) => (idx === i ? value : img)),
    }));
  }

  function addImageSlot() {
    setState((prev) => ({ ...prev, images: [...prev.images, ""] }));
  }

  function removeImage(i: number) {
    setState((prev) => ({
      ...prev,
      images: prev.images.length > 1 ? prev.images.filter((_, idx) => idx !== i) : [""],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const body = {
      slug: state.slug.trim(),
      name: state.name.trim(),
      category: state.category.trim(),
      format: state.format || null,
      description: state.description.trim(),
      researchContext: state.researchContext.trim(),
      purity: state.purity.trim(),
      molecularWeight: state.molecularWeight.trim(),
      sequence: state.sequence.trim(),
      storageInstructions: state.storageInstructions.trim(),
      coaUrl: state.coaUrl.trim(),
      inStock: state.inStock,
      storefrontVisible: state.storefrontVisible,
      contactForPrice: state.contactForPrice,
      bulkDeal: state.bulkDeal.trim() || null,
      bulkDealQty: state.bulkDealQty.trim()
        ? Number(state.bulkDealQty)
        : null,
      bulkDealPrice: state.bulkDealPrice.trim()
        ? Number(state.bulkDealPrice)
        : null,
      tags: splitCsv(state.tagsText),
      relatedSlugs: splitCsv(state.relatedSlugsText),
      images: state.images.map((s) => s.trim()).filter(Boolean),
      variants: state.variants.map((v) => {
        // Drop compareAtPrice if it's not strictly higher than price -- the
        // server will reject "compareAt <= price" with a clear error, but
        // dropping zero/empty here saves a round-trip when the admin just
        // hasn't set a sale.
        const cap =
          typeof v.compareAtPrice === "number" &&
          Number.isFinite(v.compareAtPrice) &&
          v.compareAtPrice > Number(v.price)
            ? v.compareAtPrice
            : null;
        return {
          weight: v.weight.trim(),
          sku: v.sku.trim(),
          price: Number(v.price),
          ...(cap !== null ? { compareAtPrice: cap } : {}),
        };
      }),
      isBundle: state.isBundle,
      bundleItems: state.isBundle
        ? state.bundleItems
            .map((b) => ({
              productSlug: b.productSlug.trim(),
              weight: b.weight.trim(),
              ...(b.label?.trim() ? { label: b.label.trim() } : {}),
            }))
            .filter((b) => b.productSlug && b.weight)
        : [],
    };

    try {
      const url =
        mode === "create"
          ? "/api/admin/products"
          : `/api/admin/products/${encodeURIComponent(state.slug)}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-elv8-admin": "1",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Save failed (${res.status}).`);
      }
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Basic info ------------------------------------------------------ */}
      <Section title="Basics">
        <Field label="Slug" hint="lowercase-with-hyphens (used in URLs)">
          <Input
            value={state.slug}
            onChange={(e) => update("slug", e.target.value)}
            disabled={mode === "edit"}
            placeholder="e.g. tirzepatide-40mg-vial"
            required
          />
        </Field>
        <Field label="Name">
          <Input
            value={state.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Tirzepatide 40mg Vial"
            required
          />
        </Field>
        <Field label="Category">
          <Input
            value={state.category}
            onChange={(e) => update("category", e.target.value)}
            placeholder="e.g. GLP-1 Research"
            required
          />
        </Field>
        <Field label="Format" hint="optional — vial, pen, or nasal spray">
          <select
            value={state.format}
            onChange={(e) =>
              update("format", e.target.value as FormState["format"])
            }
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="">(none)</option>
            <option value="vial">Vial</option>
            <option value="pen">Pen</option>
            <option value="nasal">Nasal Spray</option>
          </select>
        </Field>
      </Section>

      {/* Description ----------------------------------------------------- */}
      <Section title="Description">
        <Field label="Description (storefront-facing)">
          <Textarea
            value={state.description}
            onChange={(e) => update("description", e.target.value)}
            rows={4}
            required
          />
        </Field>
        <Field label="Research context (longer, scientific framing)">
          <Textarea
            value={state.researchContext}
            onChange={(e) => update("researchContext", e.target.value)}
            rows={4}
          />
        </Field>
        <Field label="Storage instructions">
          <Input
            value={state.storageInstructions}
            onChange={(e) => update("storageInstructions", e.target.value)}
            placeholder="e.g. Store refrigerated at 2-8°C"
          />
        </Field>
      </Section>

      {/* Spec sheet ------------------------------------------------------ */}
      <Section title="Specifications">
        <Field label="Purity (free text)">
          <Input
            value={state.purity}
            onChange={(e) => update("purity", e.target.value)}
            placeholder="e.g. ≥98%"
          />
        </Field>
        <Field label="Molecular weight">
          <Input
            value={state.molecularWeight}
            onChange={(e) => update("molecularWeight", e.target.value)}
            placeholder="e.g. 4813.45 g/mol"
          />
        </Field>
        <Field label="Sequence">
          <Input
            value={state.sequence}
            onChange={(e) => update("sequence", e.target.value)}
            placeholder="single-letter amino acid sequence"
          />
        </Field>
        <Field label="Certificate of Analysis URL">
          <Input
            type="url"
            value={state.coaUrl}
            onChange={(e) => update("coaUrl", e.target.value)}
            placeholder="https://..."
          />
        </Field>
      </Section>

      {/* Variants -------------------------------------------------------- */}
      <Section
        title="Variants"
        hint="Set 'Sale price (compare at)' to put a variant on sale -- the storefront shows the price strikethrough and a % off badge. Leave blank for no sale."
        action={
          <Button type="button" size="sm" onClick={addVariant} variant="outline">
            + Add variant
          </Button>
        }
      >
        <div className="space-y-3">
          {state.variants.map((v, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-end gap-3 rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3"
            >
              <div className="col-span-12 sm:col-span-2">
                <Label className="text-xs">Weight</Label>
                <Input
                  value={v.weight}
                  onChange={(e) =>
                    updateVariant(i, { weight: e.target.value })
                  }
                  placeholder="10mg"
                />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <Label className="text-xs">SKU</Label>
                <Input
                  value={v.sku}
                  onChange={(e) =>
                    updateVariant(i, { sku: e.target.value })
                  }
                  placeholder="ELV8-XXX-10"
                />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <Label className="text-xs">Price (£)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={v.price}
                  onChange={(e) =>
                    updateVariant(i, { price: Number(e.target.value) })
                  }
                />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Label className="text-xs">
                  Compare at (£)
                  <span className="ml-1 text-[#8A96AC]">optional</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={v.compareAtPrice ?? ""}
                  placeholder="pre-sale price"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      // Clear sale -- let the row submit without
                      // compareAtPrice rather than persist 0.
                      updateVariant(i, { compareAtPrice: undefined });
                      return;
                    }
                    const n = Number(raw);
                    updateVariant(i, {
                      compareAtPrice: Number.isFinite(n) ? n : undefined,
                    });
                  }}
                />
              </div>
              <div className="col-span-12 sm:col-span-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => removeVariant(i)}
                  disabled={state.variants.length === 1}
                  className="w-full text-red-600 hover:bg-red-50"
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Bundle ---------------------------------------------------------- */}
      <Section
        title="Bundle"
        hint="Tick to mark this product as a bundle (e.g. 'Wolverine Stack'). Bundle items must reference existing products. The bundle ships as one order; the storefront renders each constituent with a link to its own product page."
        action={
          state.isBundle ? (
            <Button
              type="button"
              size="sm"
              onClick={addBundleItem}
              variant="outline"
            >
              + Add item
            </Button>
          ) : null
        }
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={state.isBundle}
            onChange={(e) => update("isBundle", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#2B3A54]"
          />
          <span className="text-sm font-medium text-[#D4DBEC]">
            This product is a bundle
            <span className="block text-xs font-normal text-[#8A96AC]">
              When ticked, you must add at least two items below. Each item
              links to a real product so customers can read the research
              context behind every component of the stack.
            </span>
          </span>
        </label>

        {state.isBundle && (
          <div className="space-y-3">
            {state.bundleItems.length === 0 && (
              <p className="rounded-lg border border-dashed border-[#2B3A54] bg-[#0F1626] p-4 text-center text-xs text-[#8A96AC]">
                No items yet. Click <span className="font-medium">+ Add item</span>{" "}
                to include a product in this bundle.
              </p>
            )}
            {state.bundleItems.map((item, i) => {
              const constituent = catalogue.find(
                (p) => p.slug === item.productSlug,
              );
              return (
                <div
                  key={i}
                  className="grid grid-cols-12 items-end gap-3 rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <Label className="text-xs">Product</Label>
                    <select
                      value={item.productSlug}
                      onChange={(e) => {
                        const slug = e.target.value;
                        const next = catalogue.find((p) => p.slug === slug);
                        // When the product changes, default the weight to
                        // its first variant so the row is immediately
                        // valid -- the admin can still pick a different
                        // size from the dropdown next to it.
                        updateBundleItem(i, {
                          productSlug: slug,
                          weight: next?.variants[0]?.weight ?? "",
                        });
                      }}
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <option value="">-- select a product --</option>
                      {catalogue.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Label className="text-xs">Size</Label>
                    <select
                      value={item.weight}
                      onChange={(e) =>
                        updateBundleItem(i, { weight: e.target.value })
                      }
                      disabled={!constituent}
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                    >
                      {constituent ? (
                        constituent.variants.length === 0 ? (
                          <option value="">-- no variants --</option>
                        ) : (
                          constituent.variants.map((v) => (
                            <option key={v.sku} value={v.weight}>
                              {v.weight}
                            </option>
                          ))
                        )
                      ) : (
                        <option value="">--</option>
                      )}
                    </select>
                  </div>
                  <div className="col-span-12 sm:col-span-4">
                    <Label className="text-xs">
                      Label
                      <span className="ml-1 text-[#8A96AC]">optional</span>
                    </Label>
                    <Input
                      value={item.label ?? ""}
                      placeholder="defaults to product name"
                      onChange={(e) =>
                        updateBundleItem(i, { label: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeBundleItem(i)}
                      className="w-full text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Inventory + pricing flags --------------------------------------- */}
      <Section title="Inventory, visibility & pricing flags">
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={state.inStock}
              onChange={(e) => update("inStock", e.target.checked)}
              className="h-4 w-4 rounded border-[#2B3A54]"
            />
            <span className="text-sm font-medium text-[#D4DBEC]">
              In stock
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={state.storefrontVisible}
              onChange={(e) => update("storefrontVisible", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#2B3A54]"
            />
            <span className="text-sm font-medium text-[#D4DBEC]">
              Show on public storefront
              <span className="block text-xs font-normal text-[#8A96AC]">
                Untick to keep this product available in admin (for
                manually-created orders) but hide it from the homepage,
                /products listing, and search.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={state.contactForPrice}
              onChange={(e) => update("contactForPrice", e.target.checked)}
              className="h-4 w-4 rounded border-[#2B3A54]"
            />
            <span className="text-sm font-medium text-[#D4DBEC]">
              Hide price (show "Contact for price" instead)
            </span>
          </label>
        </div>
      </Section>

      {/* Bulk deal ------------------------------------------------------- */}
      <Section title="Bulk deal" hint="Optional. Triggers a discounted unit price when the basket reaches the configured quantity.">
        <Field label="Headline (storefront copy)">
          <Input
            value={state.bulkDeal}
            onChange={(e) => update("bulkDeal", e.target.value)}
            placeholder="e.g. 2+ for £80 each"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity threshold">
            <Input
              type="number"
              min="1"
              step="1"
              value={state.bulkDealQty}
              onChange={(e) => update("bulkDealQty", e.target.value)}
            />
          </Field>
          <Field label="Unit price at threshold (£)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={state.bulkDealPrice}
              onChange={(e) => update("bulkDealPrice", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* Tags + related -------------------------------------------------- */}
      <Section title="Metadata">
        <Field label="Tags" hint="comma-separated (e.g. glp-1, peptide, weight-loss)">
          <Input
            value={state.tagsText}
            onChange={(e) => update("tagsText", e.target.value)}
            placeholder="glp-1, peptide"
          />
        </Field>
        <Field label="Related product slugs" hint="comma-separated (e.g. retatrutide-20mg-vial, semaglutide-10mg)">
          <Input
            value={state.relatedSlugsText}
            onChange={(e) => update("relatedSlugsText", e.target.value)}
            placeholder="other-product-slug, another-one"
          />
        </Field>
      </Section>

      {/* Images ---------------------------------------------------------- */}
      <Section
        title="Images"
        hint="Upload new photos to Vercel Blob, or paste an existing /images/products/* path for legacy assets."
        action={
          <Button type="button" size="sm" onClick={addImageSlot} variant="outline">
            + Add image
          </Button>
        }
      >
        <div className="space-y-3">
          {state.images.map((url, i) => (
            <ImageSlot
              key={i}
              url={url}
              onChange={(v) => updateImage(i, v)}
              onRemove={() => removeImage(i)}
            />
          ))}
        </div>
      </Section>

      {/* Submit ---------------------------------------------------------- */}
      <div className="flex items-center justify-end gap-3 border-t border-[#1E2A3F] pt-6">
        <Link
          href="/admin/products"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
        <Button
          type="submit"
          disabled={saving}
          className="bg-[#2563EB] text-white hover:bg-[#15608c]"
        >
          {saving
            ? "Saving..."
            : mode === "create"
              ? "Create product"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Image slot -- thumbnail + upload button + URL field + remove
// ---------------------------------------------------------------------------

function ImageSlot({
  url,
  onChange,
  onRemove,
}: {
  url: string;
  onChange: (next: string) => void;
  onRemove: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Allow re-uploading the same file by clearing the input value.
    e.target.value = "";

    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: { "x-elv8-admin": "1" },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Upload failed (${res.status}).`);
      }
      if (typeof data.url !== "string") {
        throw new Error("Upload succeeded but no URL was returned.");
      }
      onChange(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gradient-to-b from-[#1A2439] to-white">
          {url ? (
            <Image
              src={url}
              alt=""
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wider text-[#8A96AC]">
              No image
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <Input
            value={url}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://...vercel-storage.com/products/example-abc123.jpg or /images/products/example.jpg"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFile}
            className="hidden"
          />
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="font-medium text-[#2563EB] hover:underline disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload new image"}
            </button>
            <span className="text-[#8A96AC]">or paste a URL above</span>
          </div>
          {uploadError && (
            <p className="text-xs text-red-600">{uploadError}</p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRemove}
          className="self-start text-red-600 hover:bg-red-50"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightweight section + field wrappers to keep the JSX above readable
// ---------------------------------------------------------------------------

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#1E2A3F] bg-[#0F1626] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#F5F7FB]">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-[#8A96AC]">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium text-[#D4DBEC]">
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1 text-xs text-[#8A96AC]">{hint}</p>}
    </div>
  );
}
