"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product, OrderItem } from "@/lib/types";
import { discountPercent } from "@/lib/pricing";
import { getLeadTime } from "@/lib/lead-times";
import ProductImage from "@/components/ProductImage";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ProductCardProps {
  product: Product;
  isBestSeller?: boolean;
}

const BASKET_KEY = "elv8_basket";

function addToBasket(product: Product) {
  const variant = product.variants[0];
  if (!variant) return;

  const existing: OrderItem[] = JSON.parse(
    localStorage.getItem(BASKET_KEY) || "[]"
  );

  const idx = existing.findIndex((i) => i.variantSku === variant.sku);
  if (idx >= 0) {
    existing[idx].quantity += 1;
  } else {
    existing.push({
      productSlug: product.slug,
      productName: product.name,
      variantSku: variant.sku,
      weight: variant.weight,
      price: variant.price,
      quantity: 1,
    });
  }

  localStorage.setItem(BASKET_KEY, JSON.stringify(existing));
  window.dispatchEvent(new Event("basket-updated"));
}

const formatLabels: Record<string, string> = {
  pen: "Pre-filled Pen",
  nasal: "Nasal Spray",
  vial: "Vial",
};

export default function ProductCard({ product, isBestSeller = false }: ProductCardProps) {
  const [confirmed, setConfirmed] = useState(false);

  const firstVariant = product.variants[0];
  const isContactForPrice = product.contactForPrice;
  const isOutOfStock = !product.inStock;
  const leadTime = getLeadTime(product.slug);
  const lowestPrice = firstVariant && !isContactForPrice
    ? firstVariant.price.toFixed(2)
    : null;
  // Sale display is driven by the first variant -- that's the one the card's
  // "From £X" pill is tied to. If a multi-variant product has a sale on a
  // different size, the badge surfaces the from-variant's discount only,
  // which keeps the card honest (no over-claiming) while still flagging
  // sale activity for shoppers.
  const cardDiscountPercent = firstVariant
    ? discountPercent(firstVariant.price, firstVariant.compareAtPrice)
    : 0;
  const cardCompareAt =
    cardDiscountPercent > 0
      ? firstVariant?.compareAtPrice?.toFixed(2)
      : null;

  function handleAddToOrder(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isContactForPrice || isOutOfStock) return;
    addToBasket(product);
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 2000);
  }

  return (
    <Link href={`/products/${product.slug}`} className="block">
      <Card
        className={`group/product h-full transition-shadow duration-200 hover:shadow-lg hover:ring-[#2563EB]/20 ${
          isBestSeller
            ? "ring-2 ring-[#F39C12] shadow-[0_0_0_4px_rgba(243,156,18,0.08)]"
            : ""
        }`}
      >
        {/* Product image */}
        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-[#1A2439] to-white">
          {product.images?.[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <ProductImage
              name={product.name}
              weight={product.variants[0]?.weight || ""}
              format={product.format}
              className="h-full w-full"
            />
          )}
          {product.purity && (
            <span className="absolute right-1.5 top-1.5 rounded-full bg-[#2563EB]/10 px-1.5 py-0.5 text-[8px] font-semibold text-[#2563EB] sm:right-2 sm:top-2 sm:px-2.5 sm:py-1 sm:text-xs">
              {product.purity} Purity
            </span>
          )}
          {/* Top-left stack: format chip then Best Seller pill, so both
              are visible without overlapping the purity badge on the right. */}
          {(product.format && product.format !== "vial") || isBestSeller || leadTime ? (
            <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1 sm:left-2 sm:top-2">
              {product.format && product.format !== "vial" && (
                <span className="rounded-full bg-[#2563EB]/10 px-1.5 py-0.5 text-[8px] font-semibold text-[#2563EB] sm:px-2.5 sm:py-1 sm:text-xs">
                  {formatLabels[product.format] || product.format}
                </span>
              )}
              {isBestSeller && (
                <span className="flex items-center gap-1 rounded-full bg-[#F39C12] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm sm:px-2.5 sm:py-1 sm:text-xs">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    className="sm:h-3 sm:w-3"
                  >
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z" />
                  </svg>
                  Best Seller
                </span>
              )}
              {leadTime && (
                <span className="flex items-center gap-1 rounded-full bg-[#D97706] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm sm:px-2.5 sm:py-1 sm:text-xs">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="sm:h-3 sm:w-3"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {leadTime.badge}
                </span>
              )}
            </div>
          ) : null}
          {product.bulkDeal && !isOutOfStock && (
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#F39C12] px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm sm:bottom-2 sm:left-2 sm:px-2.5 sm:py-1 sm:text-xs">
              {product.bulkDeal}
            </span>
          )}
          {/* Bottom-right badge stack: bundle marker on top of any sale
              badge, so a bundle on sale shows both clearly without overlap. */}
          {(cardDiscountPercent > 0 || product.isBundle) && !isOutOfStock && (
            <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex flex-col items-end gap-1 sm:bottom-2 sm:right-2">
              {product.isBundle && (
                <span className="rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm sm:px-2.5 sm:py-1 sm:text-xs">
                  Bundle
                </span>
              )}
              {cardDiscountPercent > 0 && (
                <span className="rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm sm:px-2.5 sm:py-1 sm:text-xs">
                  {cardDiscountPercent}% OFF
                </span>
              )}
            </div>
          )}
          {isOutOfStock && (
            <>
              <div className="absolute inset-0 bg-[#121A2B]/60" aria-hidden="true" />
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm sm:bottom-2 sm:left-2 sm:px-2.5 sm:py-1 sm:text-xs">
                Out of Stock
              </span>
            </>
          )}
        </div>

        <CardHeader className="gap-1 px-2 pb-0 pt-2 sm:gap-2 sm:px-4 sm:pt-4">
          <div>
            <Badge variant="secondary" className="mb-1 text-[8px] uppercase tracking-wider sm:mb-1.5 sm:text-[10px]">
              {product.category}
            </Badge>
          </div>
          <CardTitle className="line-clamp-2 text-xs font-semibold leading-snug sm:text-sm">
            {product.name}
          </CardTitle>
        </CardHeader>

        <CardContent className="px-2 pb-0 pt-0 sm:px-4">
          {lowestPrice ? (
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <p className="text-sm font-bold text-[#2563EB] sm:text-lg">
                {product.variants.length > 1 ? "From " : ""}&pound;{lowestPrice}
              </p>
              {cardCompareAt && (
                <p className="text-[11px] font-medium text-[#8A96AC] line-through sm:text-sm">
                  &pound;{cardCompareAt}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs font-medium text-[#F5F7FB]/60 sm:text-sm">
              Contact for Price
            </p>
          )}
        </CardContent>

        <CardFooter className="px-2 pb-2 pt-1.5 sm:p-4">
          {isOutOfStock ? (
            <Button
              variant="outline"
              className="w-full cursor-not-allowed border-[#1E2A3F] bg-[#0F1626] text-[#8A96AC]"
              size="sm"
              disabled
              aria-disabled="true"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              Out of Stock
            </Button>
          ) : isContactForPrice ? (
            <Button
              variant="outline"
              className="w-full border-[#2563EB]/30 text-[#2563EB]"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              View Details
            </Button>
          ) : (
            <Button
              onClick={handleAddToOrder}
              className="w-full bg-[#2563EB] text-white hover:bg-[#15608c]"
              size="sm"
            >
              {confirmed ? "Added!" : "Add to Order"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
