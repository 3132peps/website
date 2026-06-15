// ---------------------------------------------------------------------------
// 31-32 Peptides -- authoritative pricing helpers
// ---------------------------------------------------------------------------
//
// Bulk/multi-buy deals (e.g. "Retatrutide: 3 for £150") are configured on the
// product in data/products.json via `bulkDealQty` and `bulkDealPrice`. The
// rules must be applied identically on the client (for the basket display)
// and on the server (for the stored order, invoice PDF, and emails).
//
// This module is the single source of truth for that calculation. Never
// trust a client-supplied `price` field when persisting an order -- always
// re-derive it via `getEffectiveUnitPrice` so a tampered or stale basket
// can't bypass the intended pricing.

import type { OrderItem, Product } from "@/lib/types";
import productsData from "@/data/products.json";

const PRODUCTS = productsData as Product[];

/**
 * Returns the per-unit price that should actually be charged for an order
 * item, applying any bulk deal configured on the product when the quantity
 * qualifies. Falls back to the item's stored unit price when no deal
 * applies or the product is not found.
 */
export function getEffectiveUnitPrice(item: OrderItem): number {
  const product = PRODUCTS.find((p) => p.slug === item.productSlug);
  if (
    product?.bulkDealQty &&
    product?.bulkDealPrice &&
    item.quantity >= product.bulkDealQty
  ) {
    return product.bulkDealPrice;
  }
  return item.price;
}

/**
 * Returns true if a bulk deal is currently active for this item -- i.e. the
 * quantity meets the threshold for the configured deal.
 */
export function isBulkDealActive(item: OrderItem): boolean {
  const product = PRODUCTS.find((p) => p.slug === item.productSlug);
  return Boolean(
    product?.bulkDealQty &&
      product?.bulkDealPrice &&
      item.quantity >= product.bulkDealQty,
  );
}

/** Line total for a single order item with bulk pricing applied. */
export function calculateLineTotal(item: OrderItem): number {
  return getEffectiveUnitPrice(item) * item.quantity;
}

/** Basket subtotal with bulk pricing applied to every line. */
export function calculateSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
}

/**
 * Returns a copy of the items with each `price` normalised to the effective
 * unit price. Use this before persisting an order so the stored line items,
 * the invoice PDF, and the confirmation emails all reflect the charged
 * price rather than the headline variant price.
 */
export function applyBulkPricingToItems(items: OrderItem[]): OrderItem[] {
  return items.map((item) => ({
    ...item,
    price: getEffectiveUnitPrice(item),
  }));
}

// ---------------------------------------------------------------------------
// Sale price helpers (display-only -- the variant's `price` is what the
// customer is actually charged, so basket/order maths are unaffected)
// ---------------------------------------------------------------------------

/**
 * Returns the percent off as a positive integer, or 0 when there's no sale.
 * Rounds to the nearest whole percent because that's what reads cleanly on
 * a small badge -- "23% OFF" rather than "23.4% OFF".
 */
export function discountPercent(
  price: number,
  compareAtPrice: number | undefined,
): number {
  if (
    compareAtPrice === undefined ||
    !Number.isFinite(compareAtPrice) ||
    compareAtPrice <= price
  ) {
    return 0;
  }
  const pct = ((compareAtPrice - price) / compareAtPrice) * 100;
  return Math.round(pct);
}
