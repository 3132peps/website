"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product, OrderItem } from "@/lib/types";
import { discountPercent } from "@/lib/pricing";
import { Button } from "@/components/ui/button";

const BASKET_KEY = "elv8_basket";

interface ProductActionsProps {
  product: Product;
}

export default function ProductActions({ product }: ProductActionsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [confirmed, setConfirmed] = useState(false);

  const selectedVariant = product.variants[selectedIndex];
  if (!selectedVariant) return null;

  const isContactForPrice = product.contactForPrice;
  const isOutOfStock = !product.inStock;

  function decrementQty() {
    setQuantity((q) => Math.max(1, q - 1));
  }

  function incrementQty() {
    setQuantity((q) => Math.min(99, q + 1));
  }

  function handleAddToBasket() {
    if (isContactForPrice || isOutOfStock) return;
    const variant = product.variants[selectedIndex];
    if (!variant) return;

    const existing: OrderItem[] = JSON.parse(
      localStorage.getItem(BASKET_KEY) || "[]",
    );

    const idx = existing.findIndex((i) => i.variantSku === variant.sku);
    if (idx >= 0) {
      existing[idx].quantity += quantity;
    } else {
      existing.push({
        productSlug: product.slug,
        productName: product.name,
        variantSku: variant.sku,
        weight: variant.weight,
        price: variant.price,
        quantity,
      });
    }

    localStorage.setItem(BASKET_KEY, JSON.stringify(existing));
    window.dispatchEvent(new Event("basket-updated"));

    setConfirmed(true);
    setQuantity(1);
    setTimeout(() => setConfirmed(false), 2500);
  }

  return (
    <div className="space-y-5">
      {/* Variant selector */}
      {product.variants.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium text-[#B0BBD1]">Select size</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v, i) => {
              const onSale =
                v.compareAtPrice !== undefined && v.compareAtPrice > v.price;
              return (
                <button
                  key={v.sku}
                  onClick={() => setSelectedIndex(i)}
                  className={`rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    selectedIndex === i
                      ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB]"
                      : "border-[#1E2A3F] bg-[#121A2B] text-[#F5F7FB] hover:border-[#2563EB]/40"
                  }`}
                >
                  <span>{v.weight}</span>
                  {!isContactForPrice && (
                    <span className="ml-2">
                      <span className="text-[#8A96AC]">
                        &pound;{v.price.toFixed(2)}
                      </span>
                      {onSale && (
                        <span className="ml-1.5 text-xs text-[#8A96AC] line-through">
                          &pound;{v.compareAtPrice!.toFixed(2)}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Out of stock notice -- takes precedence over contact-for-price and
          the normal add-to-order UI. */}
      {isOutOfStock ? (
        <div className="rounded-lg border border-[#2563EB]/30 bg-[#2563EB]/5 p-4">
          <p className="text-lg font-bold text-[#2563EB]">
            Currently Out of Stock
          </p>
          <p className="mt-1 text-sm text-[#B0BBD1]">
            This product is temporarily unavailable. Please check back soon or
            get in touch if you&rsquo;d like to be notified when it returns.
          </p>
          <Link
            href="/contact"
            className="mt-3 inline-flex h-10 items-center justify-center rounded-lg border border-[#2563EB]/30 bg-[#121A2B] px-6 text-sm font-semibold text-[#2563EB] transition-colors hover:bg-[#2563EB]/5"
          >
            Contact Us
          </Link>
        </div>
      ) : isContactForPrice ? (
        <div className="rounded-lg border border-[#F39C12]/30 bg-[#F39C12]/5 p-4">
          <p className="text-lg font-bold text-[#F5F7FB]">Contact for Price</p>
          <p className="mt-1 text-sm text-[#B0BBD1]">
            Please get in touch for pricing and availability on this product.
          </p>
          <Link
            href="/contact"
            className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-[#2563EB] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#15608c]"
          >
            Contact Us
          </Link>
        </div>
      ) : (
        <>
          <div>
            {(() => {
              const pct = discountPercent(
                selectedVariant.price,
                selectedVariant.compareAtPrice,
              );
              const onSale = pct > 0;
              return (
                <>
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <p className="text-2xl font-bold text-[#2563EB]">
                      &pound;{selectedVariant.price.toFixed(2)}
                    </p>
                    {onSale && (
                      <>
                        <p className="text-base font-medium text-[#8A96AC] line-through">
                          &pound;{selectedVariant.compareAtPrice!.toFixed(2)}
                        </p>
                        <span className="rounded-full bg-[#2563EB] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                          {pct}% OFF
                        </span>
                      </>
                    )}
                  </div>
                  {onSale && (
                    <p className="mt-1 text-xs font-medium text-[#2563EB]">
                      You save &pound;
                      {(
                        selectedVariant.compareAtPrice! - selectedVariant.price
                      ).toFixed(2)}
                    </p>
                  )}
                </>
              );
            })()}
            {product.bulkDeal && (
              <p className="mt-1 text-sm font-medium text-[#F39C12]">
                {product.bulkDeal}
              </p>
            )}
          </div>

          {/* Quantity selector + Order button.
              `self-start w-fit` on the qty container is the mobile fix:
              flex-col parents default to align-items:stretch, which was
              making the qty selector span the full screen width. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex w-fit items-center self-start rounded-lg border border-[#1E2A3F]">
              <button
                onClick={decrementQty}
                className="flex h-11 w-11 items-center justify-center text-lg font-medium text-[#8A96AC] transition-colors hover:bg-[#0F1626] hover:text-[#F5F7FB] disabled:opacity-40 sm:h-10 sm:w-10"
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                &minus;
              </button>
              <span className="flex h-11 w-12 items-center justify-center border-x border-[#1E2A3F] text-sm font-semibold text-[#F5F7FB] sm:h-10">
                {quantity}
              </span>
              <button
                onClick={incrementQty}
                className="flex h-11 w-11 items-center justify-center text-lg font-medium text-[#8A96AC] transition-colors hover:bg-[#0F1626] hover:text-[#F5F7FB] disabled:opacity-40 sm:h-10 sm:w-10"
                disabled={quantity >= 99}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <Button
              onClick={handleAddToBasket}
              size="lg"
              className={`h-12 flex-1 text-base font-semibold transition-colors sm:h-10 sm:flex-initial sm:min-w-[180px] sm:text-sm ${
                confirmed
                  ? "bg-[#2563EB] hover:bg-[#B91C1C]"
                  : "bg-[#2563EB] hover:bg-[#15608c]"
              } text-white`}
            >
              {confirmed ? "Added!" : `Add to Order${quantity > 1 ? ` (${quantity})` : ""}`}
            </Button>
          </div>

          {/* Confirmation message */}
          {confirmed && (
            <p className="text-sm font-medium text-[#2563EB]">
              Item has been added to your basket.
            </p>
          )}

          {/* Bulk deal button */}
          {product.bulkDeal &&
            product.bulkDealQty &&
            product.bulkDealPrice != null && (
              <div className="rounded-lg border-2 border-[#F39C12]/40 bg-[#F39C12]/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#F39C12]/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[#F39C12]">
                    Best Value
                  </span>
                </div>
                <Button
                  onClick={() => {
                    if (isContactForPrice) return;
                    const variant = product.variants[selectedIndex];
                    if (!variant) return;

                    const existing: OrderItem[] = JSON.parse(
                      localStorage.getItem(BASKET_KEY) || "[]",
                    );

                    const idx = existing.findIndex(
                      (i) => i.variantSku === variant.sku,
                    );
                    if (idx >= 0) {
                      existing[idx].quantity += product.bulkDealQty!;
                    } else {
                      existing.push({
                        productSlug: product.slug,
                        productName: product.name,
                        variantSku: variant.sku,
                        weight: variant.weight,
                        price: variant.price,
                        quantity: product.bulkDealQty!,
                      });
                    }

                    localStorage.setItem(
                      BASKET_KEY,
                      JSON.stringify(existing),
                    );
                    window.dispatchEvent(new Event("basket-updated"));

                    setConfirmed(true);
                    setQuantity(1);
                    setTimeout(() => setConfirmed(false), 2500);
                  }}
                  className="w-full bg-[#F39C12] text-white font-semibold hover:bg-[#e08e0b] h-11 text-sm"
                >
                  Add {product.bulkDealQty} for &pound;
                  {(product.bulkDealQty * product.bulkDealPrice).toFixed(0)}{" "}
                  (Save &pound;
                  {(
                    selectedVariant.price * product.bulkDealQty -
                    product.bulkDealPrice * product.bulkDealQty
                  ).toFixed(0)}
                  )
                </Button>
              </div>
            )}
        </>
      )}
    </div>
  );
}
