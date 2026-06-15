"use client";

import { useState, useMemo } from "react";
import type { Product } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

const CATEGORIES = [
  "All",
  "GLP-1 Research",
  "Tissue Repair",
  "Cellular Regeneration",
  "Metabolic Research",
  "Melanocortin Research",
  "Neuroprotective",
  "Growth Factor Research",
  "Anti-Inflammatory Research",
  "Anti-Aging Research",
  "Hair & Scalp Research",
  "Lab Supplies",
] as const;

// Best-seller slug tokens. Every variant of these product families
// (pens, vials, third-party brands like Synedica) floats to the top.
const BEST_SELLER_PREFIXES = ["retatrutide", "ghk-cu", "bpc-157", "tb-500"];

function isBestSeller(slug: string): boolean {
  return BEST_SELLER_PREFIXES.some((token) => slug.includes(token));
}

type SortOption = "name-asc" | "price-low" | "price-high";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name-asc", label: "Name A\u2013Z" },
  { value: "price-low", label: "Price Low\u2013High" },
  { value: "price-high", label: "Price High\u2013Low" },
];

interface ProductCatalogueProps {
  products: Product[];
  initialQuery?: string;
}

export default function ProductCatalogue({
  products,
  initialQuery = "",
}: ProductCatalogueProps) {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);

  const filteredAndSorted = useMemo(() => {
    let result =
      activeCategory === "All"
        ? products
        : products.filter((p) => p.category === activeCategory);

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((p) => {
        const haystack = [
          p.name,
          p.category,
          p.description,
          p.researchContext,
          ...(p.tags || []),
          ...(p.variants || []).map((v) => v.sku),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    result = [...result].sort((a, b) => {
      // Best sellers always float to the top of whichever sort the user picked.
      const aBest = isBestSeller(a.slug);
      const bBest = isBestSeller(b.slug);
      if (aBest !== bBest) return aBest ? -1 : 1;

      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "price-low": {
          const aPrice = a.variants[0]?.price ?? 0;
          const bPrice = b.variants[0]?.price ?? 0;
          return aPrice - bPrice;
        }
        case "price-high": {
          const aPrice = a.variants[0]?.price ?? 0;
          const bPrice = b.variants[0]?.price ?? 0;
          return bPrice - aPrice;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [products, activeCategory, sortBy, searchQuery]);

  function clearFilters() {
    setActiveCategory("All");
    setSearchQuery("");
  }

  return (
    <div>
      {/* Filter and Sort Controls */}
      <div className="mb-6 space-y-3 sm:mb-8 sm:space-y-4">
        {/* Search bar */}
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A96AC]"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full rounded-lg border border-[#1E2A3F] bg-[#121A2B] py-2.5 pl-10 pr-10 text-sm text-[#F5F7FB] placeholder:text-[#8A96AC] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8A96AC] transition-colors hover:bg-[#1A2439] hover:text-[#F5F7FB]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Category filters: horizontal scroll on mobile, wrap on desktop */}
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
          role="tablist"
          aria-label="Product categories"
        >
          {CATEGORIES.filter(
            (cat) => cat === "All" || products.some((p) => p.category === cat),
          ).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              role="tab"
              aria-selected={activeCategory === cat}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:px-4 sm:py-2 sm:text-sm ${
                activeCategory === cat
                  ? "bg-[#2563EB] text-white shadow-sm"
                  : "bg-[#1A2439] text-[#F5F7FB] hover:bg-[#2563EB]/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort + result count */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[#8A96AC] sm:text-sm">
            {filteredAndSorted.length}{" "}
            {filteredAndSorted.length === 1 ? "product" : "products"}
            {searchQuery && (
              <>
                {" "}for &ldquo;<span className="font-medium text-[#F5F7FB]">{searchQuery}</span>&rdquo;
              </>
            )}
          </p>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort products"
            className="rounded-md border border-[#1E2A3F] bg-[#121A2B] px-2.5 py-1.5 text-xs text-[#F5F7FB] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB] sm:px-3 sm:py-2 sm:text-sm"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Grid */}
      {filteredAndSorted.length === 0 ? (
        <div className="rounded-lg bg-[#1A2439] py-16 text-center">
          <p className="text-lg font-medium text-[#F5F7FB]">
            {searchQuery
              ? `No products match “${searchQuery}”.`
              : "No products found in this category."}
          </p>
          <button
            onClick={clearFilters}
            className="mt-3 text-sm font-medium text-[#2563EB] hover:underline"
          >
            Clear filters and view all products
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {filteredAndSorted.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              isBestSeller={isBestSeller(product.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
