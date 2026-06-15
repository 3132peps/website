"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderItem, OrderFormData, Product } from "@/lib/types";
import productsData from "@/data/products.json";
import {
  calculateSubtotal,
  getEffectiveUnitPrice,
} from "@/lib/pricing";

const allProducts = productsData as Product[];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASKET_KEY = "elv8_basket";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBasket(): OrderItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BASKET_KEY);
    return raw ? (JSON.parse(raw) as OrderItem[]) : [];
  } catch {
    return [];
  }
}

function writeBasket(items: OrderItem[]) {
  localStorage.setItem(BASKET_KEY, JSON.stringify(items));
}

// Bulk-pricing helpers live in lib/pricing so that the basket display and
// the /api/order handler calculate totals from the same source of truth.
// See lib/pricing.ts.

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AppliedDiscount {
  code: string;
  type: "percent" | "fixed";
  value: number;
  amount: number;
}

export default function OrderPage() {
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [mounted, setMounted] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [ruoConfirmed, setRuoConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Discount code state
  const [discountInput, setDiscountInput] = useState("");
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load basket on mount
  useEffect(() => {
    setItems(readBasket());
    setMounted(true);
  }, []);

  // Persist basket changes. Any mutation invalidates a previously applied
  // discount code because the subtotal may no longer meet the code's rules
  // (e.g. the customer removed an item and dropped under the min order
  // threshold). The customer just has to click "Apply" again.
  const persist = useCallback((updated: OrderItem[]) => {
    setItems(updated);
    writeBasket(updated);
    setDiscount(null);
    setDiscountError(null);
  }, []);

  // Basket actions
  const updateQuantity = (index: number, delta: number) => {
    const updated = [...items];
    const newQty = updated[index].quantity + delta;
    if (newQty < 1) return;
    updated[index] = { ...updated[index], quantity: newQty };
    persist(updated);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    persist(updated);
  };

  // Apply / remove discount code
  async function handleApplyDiscount() {
    setDiscountError(null);
    const code = discountInput.trim();
    if (!code) {
      setDiscountError("Please enter a discount code.");
      return;
    }
    if (items.length === 0) {
      setDiscountError("Add items to your basket first.");
      return;
    }
    setApplyingDiscount(true);
    try {
      // Codes with a per-customer limit need the customer's email so the
      // server can check the redemption history. Pass it when filled in;
      // the server responds with requiresEmail: true if it's mandatory for
      // the specific code the customer entered.
      const customerEmail = email.trim() || undefined;
      const res = await fetch("/api/discount/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, items, customerEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setDiscount(null);
        setDiscountError(data.error ?? "Invalid discount code.");
        return;
      }
      setDiscount({
        code: data.code,
        type: data.type,
        value: data.value,
        amount: data.discountAmount,
      });
      setDiscountInput(data.code);
    } catch {
      setDiscountError("Network error. Please try again.");
    } finally {
      setApplyingDiscount(false);
    }
  }

  function handleRemoveDiscount() {
    setDiscount(null);
    setDiscountInput("");
    setDiscountError(null);
  }

  // Form validation
  const validate = (): string | null => {
    if (!fullName.trim()) return "Full name is required.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "A valid email address is required.";
    if (!addressLine1.trim()) return "Address line 1 is required.";
    if (!city.trim()) return "City is required.";
    if (!postcode.trim()) return "Postcode is required.";
    if (!ruoConfirmed) return "You must confirm the RUO declaration.";
    if (!termsAccepted) return "You must accept the Terms & Conditions.";
    return null;
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const formData: OrderFormData = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      county: county.trim() || undefined,
      postcode: postcode.trim(),
      orderNotes: orderNotes.trim() || undefined,
      ruoConfirmed,
      termsAccepted,
    };

    setSubmitting(true);

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          formData,
          discountCode: discount?.code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If the server rejected the discount code at submission time (e.g.
        // the code was used up by another customer between Apply and
        // Submit), drop it locally so the customer can try again.
        if (data.discountError) {
          setDiscount(null);
          setDiscountError(data.discountError);
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      // Clear the basket now the order is safely persisted server-side, and
      // notify the header's cart badge in the same tab via the shared event.
      localStorage.removeItem(BASKET_KEY);
      setItems([]);
      window.dispatchEvent(new Event("basket-updated"));

      router.push(`/order/confirmation?ref=${data.referenceNumber}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Don't render until mounted (avoids hydration mismatch with localStorage)
  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#1A2439]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-gray-200" />
            <div className="h-4 w-64 rounded bg-gray-200" />
          </div>
        </div>
      </main>
    );
  }

  const POSTAGE = 6;
  const itemsTotal = calculateSubtotal(items);
  // The applied discount amount is capped server-side, but recompute here
  // so the displayed total is always consistent with the line items in view.
  const discountAmount = discount
    ? Math.min(
        discount.type === "percent"
          ? Math.round(((itemsTotal * discount.value) / 100) * 100) / 100
          : discount.value,
        itemsTotal,
      )
    : 0;
  const total =
    items.length > 0 ? itemsTotal - discountAmount + POSTAGE : 0;
  const hasItems = items.length > 0;

  return (
    <main className="min-h-screen bg-[#1A2439]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        {/* ---- Header ---- */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#F5F7FB] sm:text-4xl">
            Your Order
          </h1>
          <p className="mt-2 text-[#F5F7FB]/70">
            Review your basket and submit your order. Our team will be in touch to arrange the rest.
          </p>
        </div>

        {/* ---- Empty state ---- */}
        {!hasItems && (
          <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-12 text-center shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto h-16 w-16 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
              />
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-[#F5F7FB]">
              Your basket is empty
            </h2>
            <p className="mt-2 text-[#F5F7FB]/60">
              Browse our catalogue and add items to get started.
            </p>
            <Link href="/products">
              <Button className="mt-6 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white">
                Browse Products
              </Button>
            </Link>
          </div>
        )}

        {/* ---- Two-column layout ---- */}
        {hasItems && (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
              {/* ---- Basket summary (left) ---- */}
              <div className="lg:col-span-2">
                <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-[#F5F7FB]">
                    Your Basket
                  </h2>

                  <div className="divide-y divide-[#1E2A3F]">
                    {items.map((item, idx) => {
                      const product = allProducts.find(
                        (p) => p.slug === item.productSlug,
                      );
                      const effectivePrice = getEffectiveUnitPrice(item);
                      const dealActive =
                        product?.bulkDealQty &&
                        product?.bulkDealPrice &&
                        item.quantity >= product.bulkDealQty;
                      const dealAvailable =
                        product?.bulkDealQty &&
                        product?.bulkDealPrice &&
                        !dealActive;
                      const remaining = dealAvailable
                        ? product.bulkDealQty! - item.quantity
                        : 0;

                      return (
                        <div
                          key={`${item.variantSku}-${idx}`}
                          className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#F5F7FB] truncate">
                              {item.productName}
                            </p>
                            <p className="text-sm text-[#F5F7FB]/60">
                              {item.weight}
                            </p>

                            {/* Price with deal info */}
                            {dealActive ? (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-sm font-semibold text-[#2563EB]">
                                  &pound;{effectivePrice.toFixed(2)}
                                </span>
                                <span className="text-xs text-[#F5F7FB]/40 line-through">
                                  &pound;{item.price.toFixed(2)}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2563EB]">
                                  Deal applied!
                                </span>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm font-semibold text-[#2563EB]">
                                &pound;{item.price.toFixed(2)}
                              </p>
                            )}

                            {/* Deal hint */}
                            {dealAvailable && remaining > 0 && (
                              <p className="mt-0.5 text-xs font-medium text-[#F39C12]">
                                Add {remaining} more for &pound;
                                {product.bulkDealPrice!.toFixed(2)} each
                              </p>
                            )}

                            {/* Line total */}
                            <p className="mt-1 text-xs text-[#F5F7FB]/50">
                              Line total: &pound;
                              {(effectivePrice * item.quantity).toFixed(2)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#1E2A3F] text-[#F5F7FB]/70 transition-colors hover:bg-[#0F1626]"
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-sm font-medium text-[#F5F7FB]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#1E2A3F] text-[#F5F7FB]/70 transition-colors hover:bg-[#0F1626]"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="mt-0.5 text-sm text-red-500 hover:text-red-700 transition-colors"
                            aria-label={`Remove ${item.productName}`}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* ---- Discount code ---- */}
                  <div className="mt-6 border-t border-[#1E2A3F] pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8A96AC]">
                      Discount Code
                    </p>
                    {discount ? (
                      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold text-emerald-700">
                            {discount.code}
                          </p>
                          <p className="text-xs text-emerald-700/80">
                            {discount.type === "percent"
                              ? `${discount.value}% off`
                              : `£${discount.value.toFixed(2)} off`}{" "}
                            applied
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveDiscount}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          id="discountCode"
                          type="text"
                          value={discountInput}
                          onChange={(e) => {
                            setDiscountInput(
                              e.target.value.toUpperCase().replace(/\s+/g, ""),
                            );
                            if (discountError) setDiscountError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleApplyDiscount();
                            }
                          }}
                          placeholder="e.g. SAVE10"
                          className="font-mono uppercase"
                        />
                        <Button
                          type="button"
                          onClick={handleApplyDiscount}
                          disabled={applyingDiscount || !discountInput.trim()}
                          variant="outline"
                          className="shrink-0"
                        >
                          {applyingDiscount ? "Checking..." : "Apply"}
                        </Button>
                      </div>
                    )}
                    {discountError && (
                      <p className="mt-2 text-xs text-red-600">
                        {discountError}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 space-y-2 border-t border-[#1E2A3F] pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#F5F7FB]/70">Subtotal</span>
                      <span className="text-sm font-medium text-[#F5F7FB]">
                        &pound;{itemsTotal.toFixed(2)}
                      </span>
                    </div>
                    {discount && discountAmount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-emerald-700">
                          Discount ({discount.code})
                        </span>
                        <span className="text-sm font-medium text-emerald-700">
                          -&pound;{discountAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#F5F7FB]/70">Postage (UK Tracked)</span>
                      <span className="text-sm font-medium text-[#F5F7FB]">
                        &pound;{POSTAGE.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#1E2A3F] pt-2">
                      <span className="text-sm font-semibold text-[#F5F7FB]">Total</span>
                      <span className="text-lg font-bold text-[#F5F7FB]">
                        &pound;{total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ---- Order form (right) ---- */}
              <div className="lg:col-span-3">
                <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6 shadow-sm">
                  <h2 className="mb-6 text-lg font-semibold text-[#F5F7FB]">
                    Your Details
                  </h2>

                  {error && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="space-y-5">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName">
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Smith"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email">
                        Email Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="07700 900000"
                      />
                    </div>

                    {/* Delivery Address */}
                    <fieldset className="space-y-4">
                      <legend className="text-sm font-medium text-[#F5F7FB]">
                        Delivery Address
                      </legend>

                      <div className="space-y-1.5">
                        <Label htmlFor="addressLine1">
                          Address Line 1 <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="addressLine1"
                          type="text"
                          required
                          value={addressLine1}
                          onChange={(e) => setAddressLine1(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="addressLine2">Address Line 2</Label>
                        <Input
                          id="addressLine2"
                          type="text"
                          value={addressLine2}
                          onChange={(e) => setAddressLine2(e.target.value)}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="city">
                            City <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="city"
                            type="text"
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="county">County</Label>
                          <Input
                            id="county"
                            type="text"
                            value={county}
                            onChange={(e) => setCounty(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 sm:max-w-[200px]">
                        <Label htmlFor="postcode">
                          Postcode <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="postcode"
                          type="text"
                          required
                          value={postcode}
                          onChange={(e) => setPostcode(e.target.value)}
                          placeholder="SW1A 1AA"
                        />
                      </div>
                    </fieldset>

                    {/* Order Notes */}
                    <div className="space-y-1.5">
                      <Label htmlFor="orderNotes">Order Notes</Label>
                      <Textarea
                        id="orderNotes"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Any special instructions or questions..."
                        rows={3}
                      />
                    </div>

                    {/* Checkboxes */}
                    <div className="space-y-3 pt-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ruoConfirmed}
                          onChange={(e) => setRuoConfirmed(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-[#2B3A54] text-[#2563EB] focus:ring-[#2563EB]"
                          required
                        />
                        <span className="text-sm text-[#F5F7FB]/80">
                          I confirm I am 18+ and purchasing for in-vitro
                          laboratory research use only.{" "}
                          <span className="text-red-500">*</span>
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-[#2B3A54] text-[#2563EB] focus:ring-[#2563EB]"
                          required
                        />
                        <span className="text-sm text-[#F5F7FB]/80">
                          I accept the{" "}
                          <Link
                            href="/terms"
                            target="_blank"
                            className="text-[#2563EB] underline hover:text-[#2563EB]/80"
                          >
                            Terms &amp; Conditions
                          </Link>
                          . <span className="text-red-500">*</span>
                        </span>
                      </label>
                    </div>

                    {/* Submit */}
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="mt-4 w-full bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold h-11 text-base"
                    >
                      {submitting ? "Submitting..." : "Submit Order"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
