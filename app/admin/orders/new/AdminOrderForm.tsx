"use client";

// ---------------------------------------------------------------------------
// Admin order entry form.
//
// Two sections:
//   1. Customer details (name, email, address, phone, notes)
//   2. Line items -- pick a product + variant, set qty, optionally override
//      the unit price (for B2B / custom quotes).
//
// The form posts to POST /api/admin/orders, which on success redirects to
// the new order's detail page so the admin can re-send the invoice or
// progress the order from there. The line-item table re-derives the
// subtotal locally for display, but the server is the source of truth for
// what gets stored / invoiced.

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface CatalogueVariant {
  sku: string;
  weight: string;
  price: number;
}

export interface CatalogueProduct {
  slug: string;
  name: string;
  category: string;
  storefrontVisible: boolean;
  inStock: boolean;
  variants: CatalogueVariant[];
}

interface LineDraft {
  productSlug: string;
  variantSku: string;
  quantity: number;
  // Optional override (per unit). Empty string = use catalogue price.
  priceText: string;
}

interface CustomerDraft {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
}

const EMPTY_LINE: LineDraft = {
  productSlug: "",
  variantSku: "",
  quantity: 1,
  priceText: "",
};

const EMPTY_CUSTOMER: CustomerDraft = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  county: "",
  postcode: "",
};

export default function AdminOrderForm({
  catalogue,
}: {
  catalogue: CatalogueProduct[];
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDraft>(EMPTY_CUSTOMER);
  const [lines, setLines] = useState<LineDraft[]>([EMPTY_LINE]);
  const [postageText, setPostageText] = useState("6.00");
  const [orderNotes, setOrderNotes] = useState("");
  const [sendInvoice, setSendInvoice] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Lookup helpers. Catalogue is stable for the lifetime of this page so we
  // memoise once.
  const catalogueBySlug = useMemo(() => {
    const map = new Map<string, CatalogueProduct>();
    for (const p of catalogue) map.set(p.slug, p);
    return map;
  }, [catalogue]);

  function updateCustomer<K extends keyof CustomerDraft>(
    key: K,
    value: CustomerDraft[K],
  ) {
    setCustomer((prev) => ({ ...prev, [key]: value }));
  }

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, EMPTY_LINE]);
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  // Live subtotal preview. Strictly client-side -- the server re-derives
  // its own subtotal (with bulk-deal logic) so this can be a friendly
  // approximation rather than a perfect mirror.
  const subtotal = useMemo(() => {
    let sum = 0;
    for (const line of lines) {
      const product = catalogueBySlug.get(line.productSlug);
      const variant = product?.variants.find((v) => v.sku === line.variantSku);
      if (!variant) continue;
      const override = Number(line.priceText);
      const unit =
        line.priceText.trim() && Number.isFinite(override) && override >= 0
          ? override
          : variant.price;
      sum += unit * (Number.isFinite(line.quantity) ? line.quantity : 0);
    }
    return sum;
  }, [lines, catalogueBySlug]);

  const postage = useMemo(() => {
    const n = Number(postageText);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [postageText]);

  const total = subtotal + postage;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    // Front-end gate: every line must have a product + variant + qty >= 1.
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.productSlug) {
        setError(`Item ${i + 1}: pick a product.`);
        setSubmitting(false);
        return;
      }
      if (!l.variantSku) {
        setError(`Item ${i + 1}: pick a size / SKU.`);
        setSubmitting(false);
        return;
      }
      if (!Number.isFinite(l.quantity) || l.quantity < 1) {
        setError(`Item ${i + 1}: quantity must be at least 1.`);
        setSubmitting(false);
        return;
      }
    }

    const body = {
      customer: {
        fullName: customer.fullName.trim(),
        email: customer.email.trim(),
        phone: customer.phone.trim() || undefined,
        addressLine1: customer.addressLine1.trim(),
        addressLine2: customer.addressLine2.trim() || undefined,
        city: customer.city.trim(),
        county: customer.county.trim() || undefined,
        postcode: customer.postcode.trim(),
      },
      items: lines.map((l) => {
        const override = Number(l.priceText);
        const unitPriceOverride =
          l.priceText.trim() && Number.isFinite(override) && override >= 0
            ? override
            : undefined;
        return {
          productSlug: l.productSlug,
          variantSku: l.variantSku,
          quantity: l.quantity,
          ...(unitPriceOverride !== undefined ? { unitPriceOverride } : {}),
        };
      }),
      postage,
      orderNotes: orderNotes.trim() || undefined,
      sendInvoice,
    };

    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elv8-admin": "1",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The 502 path returns the order object but a non-OK status -- the
        // order WAS created, the invoice email failed. Surface the error
        // and bounce the admin to the order detail page so they can re-send.
        if (data?.order?.ref) {
          router.push(`/admin/orders/${encodeURIComponent(data.order.ref)}`);
          return;
        }
        throw new Error(data.error ?? `Failed (${res.status}).`);
      }
      const ref: string | undefined = data?.order?.ref;
      if (ref) {
        router.push(`/admin/orders/${encodeURIComponent(ref)}`);
      } else {
        router.push("/admin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Customer ------------------------------------------------------- */}
      <Section title="Customer">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input
              value={customer.fullName}
              onChange={(e) => updateCustomer("fullName", e.target.value)}
              required
            />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              value={customer.email}
              onChange={(e) => updateCustomer("email", e.target.value)}
              required
            />
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              value={customer.phone}
              onChange={(e) => updateCustomer("phone", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Delivery address">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" required>
            <Input
              value={customer.addressLine1}
              onChange={(e) => updateCustomer("addressLine1", e.target.value)}
              required
            />
          </Field>
          <Field label="Address line 2">
            <Input
              value={customer.addressLine2}
              onChange={(e) => updateCustomer("addressLine2", e.target.value)}
            />
          </Field>
          <Field label="City / Town" required>
            <Input
              value={customer.city}
              onChange={(e) => updateCustomer("city", e.target.value)}
              required
            />
          </Field>
          <Field label="County">
            <Input
              value={customer.county}
              onChange={(e) => updateCustomer("county", e.target.value)}
            />
          </Field>
          <Field label="Postcode" required>
            <Input
              value={customer.postcode}
              onChange={(e) =>
                updateCustomer("postcode", e.target.value.toUpperCase())
              }
              required
            />
          </Field>
        </div>
      </Section>

      {/* Line items ----------------------------------------------------- */}
      <Section
        title="Items"
        action={
          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            + Add item
          </Button>
        }
      >
        <div className="space-y-3">
          {lines.map((line, i) => (
            <LineRow
              key={i}
              index={i}
              line={line}
              catalogue={catalogue}
              onChange={(patch) => updateLine(i, patch)}
              onRemove={() => removeLine(i)}
              canRemove={lines.length > 1}
            />
          ))}
        </div>
      </Section>

      {/* Shipping + notes ----------------------------------------------- */}
      <Section title="Shipping & notes">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Postage (£)" hint="Defaults to £6 (UK Tracked).">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={postageText}
              onChange={(e) => setPostageText(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Order notes (visible on the invoice / admin)">
          <Textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            rows={3}
            placeholder="e.g. customer prefers Wednesday delivery"
          />
        </Field>
      </Section>

      {/* Summary -------------------------------------------------------- */}
      <Section title="Summary & invoice">
        <div className="rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#B0BBD1]">Subtotal (preview)</span>
            <span className="font-medium text-[#F5F7FB]">
              £{subtotal.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#B0BBD1]">Postage</span>
            <span className="font-medium text-[#F5F7FB]">
              £{postage.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[#1E2A3F] pt-2 text-sm font-semibold">
            <span className="text-[#F5F7FB]">Total</span>
            <span className="text-[#2563EB]">£{total.toFixed(2)}</span>
          </div>
          <p className="mt-2 text-xs text-[#8A96AC]">
            Bulk-deal pricing (if any) is applied by the server when the order
            is saved -- the preview above is a quick estimate.
          </p>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3">
          <input
            type="checkbox"
            checked={sendInvoice}
            onChange={(e) => setSendInvoice(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#2B3A54]"
          />
          <span className="text-sm text-[#D4DBEC]">
            <span className="font-medium text-[#F5F7FB]">
              Email invoice to customer
            </span>
            <span className="block text-xs text-[#8A96AC]">
              On submit, generate a PDF invoice and email it to the customer
              with the UK bank-transfer details. The order moves to
              &ldquo;Invoice Sent&rdquo;. Untick to create the order in
              &ldquo;Received&rdquo; without sending an invoice -- you can
              send it later from the order detail page.
            </span>
          </span>
        </label>
      </Section>

      <div className="flex items-center justify-end gap-3 border-t border-[#1E2A3F] pt-6">
        <Link
          href="/admin"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-[#2563EB] text-white hover:bg-[#15608c]"
        >
          {submitting
            ? "Creating..."
            : sendInvoice
              ? "Create order & send invoice"
              : "Create order"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Line item row -- product picker + variant picker + qty + price override
// ---------------------------------------------------------------------------

function LineRow({
  index,
  line,
  catalogue,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  line: LineDraft;
  catalogue: CatalogueProduct[];
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const product = catalogue.find((p) => p.slug === line.productSlug);
  const variant = product?.variants.find((v) => v.sku === line.variantSku);
  const lineTotal = (() => {
    if (!variant) return 0;
    const override = Number(line.priceText);
    const unit =
      line.priceText.trim() && Number.isFinite(override) && override >= 0
        ? override
        : variant.price;
    return unit * (Number.isFinite(line.quantity) ? line.quantity : 0);
  })();

  return (
    <div className="rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[#8A96AC]">
          Item {index + 1}
        </span>
        <div className="flex items-center gap-2">
          {product && !product.storefrontVisible && (
            <Badge className="bg-gray-200 text-[#D4DBEC]">Admin-only</Badge>
          )}
          {product && !product.inStock && (
            <Badge className="bg-amber-100 text-amber-800">
              Out of stock (storefront)
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-12">
        {/* Product picker */}
        <div className="sm:col-span-5">
          <Label className="text-xs">Product</Label>
          <select
            value={line.productSlug}
            onChange={(e) => {
              // Reset the variant when the product changes -- the previous
              // SKU almost certainly doesn't belong to the new product.
              const newSlug = e.target.value;
              const newProduct = catalogue.find((p) => p.slug === newSlug);
              const firstVariant = newProduct?.variants[0]?.sku ?? "";
              onChange({ productSlug: newSlug, variantSku: firstVariant });
            }}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="">-- select a product --</option>
            {catalogue.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
                {p.storefrontVisible ? "" : " (admin-only)"}
              </option>
            ))}
          </select>
        </div>

        {/* Variant picker */}
        <div className="sm:col-span-3">
          <Label className="text-xs">Size / SKU</Label>
          <select
            value={line.variantSku}
            onChange={(e) => onChange({ variantSku: e.target.value })}
            disabled={!product}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
          >
            {product ? (
              product.variants.length === 0 ? (
                <option value="">-- no variants --</option>
              ) : (
                product.variants.map((v) => (
                  <option key={v.sku} value={v.sku}>
                    {v.weight} -- £{v.price.toFixed(2)} ({v.sku})
                  </option>
                ))
              )
            ) : (
              <option value="">--</option>
            )}
          </select>
        </div>

        {/* Quantity */}
        <div className="sm:col-span-2">
          <Label className="text-xs">Qty</Label>
          <Input
            type="number"
            min="1"
            step="1"
            value={line.quantity}
            onChange={(e) =>
              onChange({ quantity: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </div>

        {/* Price override */}
        <div className="sm:col-span-2">
          <Label className="text-xs">
            Unit £
            <span className="ml-1 text-[#8A96AC]" title="Leave blank to use the catalogue price.">
              (override)
            </span>
          </Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={line.priceText}
            placeholder={
              variant ? variant.price.toFixed(2) : ""
            }
            onChange={(e) => onChange({ priceText: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-[#8A96AC]">
        <span>
          Line total:{" "}
          <span className="font-medium text-[#F5F7FB]">
            £{lineTotal.toFixed(2)}
          </span>
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRemove}
          disabled={!canRemove}
          className="text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section + Field wrappers (mirrors the pattern in ProductForm)
// ---------------------------------------------------------------------------

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#1E2A3F] bg-[#0F1626] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-[#F5F7FB]">{title}</h2>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium text-[#D4DBEC]">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {hint && <p className="mt-1 text-xs text-[#8A96AC]">{hint}</p>}
    </div>
  );
}
