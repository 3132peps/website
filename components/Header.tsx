"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { OrderItem, Product } from "@/lib/types";
import productsData from "@/data/products.json";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/calculator", label: "Calculator" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const BASKET_STORAGE_KEY = "elv8_basket";

// Compact index for fast, low-footprint client-side search in the header
// (both desktop dropdown and mobile sheet).
const searchIndex: Array<{
  slug: string;
  name: string;
  category: string;
  haystack: string;
}> = (productsData as Product[]).map((p) => ({
  slug: p.slug,
  name: p.name,
  category: p.category,
  haystack: [p.name, p.category, ...(p.tags || [])].join(" ").toLowerCase(),
}));

function matchProducts(query: string, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return searchIndex.filter((item) => item.haystack.includes(q)).slice(0, limit);
}

export default function Header() {
  const pathname = usePathname();
  const [basketCount, setBasketCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [desktopSearch, setDesktopSearch] = useState("");
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchContainerRef = useRef<HTMLDivElement>(null);

  // Reset the mobile search whenever the sheet is closed.
  useEffect(() => {
    if (!mobileOpen) setMobileSearch("");
  }, [mobileOpen]);

  const mobileSearchResults = useMemo(
    () => matchProducts(mobileSearch),
    [mobileSearch]
  );
  const desktopSearchResults = useMemo(
    () => matchProducts(desktopSearch),
    [desktopSearch]
  );

  // Auto-focus the desktop search input when opened; clear it when closed.
  useEffect(() => {
    if (desktopSearchOpen) {
      // Small delay lets the dropdown mount before focus is applied.
      const id = window.setTimeout(() => desktopSearchInputRef.current?.focus(), 10);
      return () => window.clearTimeout(id);
    }
    setDesktopSearch("");
  }, [desktopSearchOpen]);

  // Close desktop search on outside click or Escape.
  useEffect(() => {
    if (!desktopSearchOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        desktopSearchContainerRef.current &&
        !desktopSearchContainerRef.current.contains(event.target as Node)
      ) {
        setDesktopSearchOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDesktopSearchOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [desktopSearchOpen]);

  // Close the desktop search whenever the user navigates to a new page.
  useEffect(() => {
    setDesktopSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    function syncBasketCount() {
      try {
        const raw = localStorage.getItem(BASKET_STORAGE_KEY);
        if (raw) {
          const items: OrderItem[] = JSON.parse(raw);
          const total = items.reduce((sum, item) => sum + item.quantity, 0);
          setBasketCount(total);
        } else {
          setBasketCount(0);
        }
      } catch {
        setBasketCount(0);
      }
    }

    syncBasketCount();

    // Re-sync when another tab or component updates localStorage
    window.addEventListener("storage", syncBasketCount);

    // Custom event so same-tab updates are picked up too
    window.addEventListener("basket-updated", syncBasketCount);

    return () => {
      window.removeEventListener("storage", syncBasketCount);
      window.removeEventListener("basket-updated", syncBasketCount);
    };
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header
      className="sticky top-0 z-50 w-full bg-[#121A2B] border-b"
      style={{ borderColor: "#1E2A3F" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* ---- Logo ---- */}
        <Link href="/" className="shrink-0">
          <Image
            src="/images/3132-logo.jpg"
            alt="31-32 Peptides"
            width={120}
            height={120}
            className="h-11 w-auto rounded-lg"
            priority
          />
        </Link>

        {/* ---- Desktop navigation ---- */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`
                px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${
                  isActive(link.href)
                    ? "text-[#2563EB] bg-[#2563EB]/5"
                    : "text-[#F5F7FB] hover:text-[#2563EB] hover:bg-[#0F1626]"
                }
              `}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* ---- Right side: desktop search + basket + mobile hamburger ---- */}
        <div className="flex items-center gap-2">
          {/* WhatsApp community button (desktop only) */}

          {/* Desktop product search (hidden on mobile — the sheet handles that) */}
          <div
            ref={desktopSearchContainerRef}
            className="relative hidden md:block"
          >
            <button
              type="button"
              onClick={() => setDesktopSearchOpen((open) => !open)}
              aria-label="Search products"
              aria-expanded={desktopSearchOpen}
              aria-haspopup="dialog"
              className="inline-flex items-center justify-center rounded-md p-2 text-[#F5F7FB] transition-colors hover:bg-[#0F1626]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {desktopSearchOpen && (
              <div
                role="dialog"
                aria-label="Search products"
                className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[#1E2A3F] bg-[#121A2B] shadow-lg"
              >
                <div className="border-b border-[#1E2A3F] p-3">
                  <label htmlFor="desktop-product-search" className="sr-only">
                    Search products
                  </label>
                  <div className="relative">
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
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A96AC]"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      id="desktop-product-search"
                      ref={desktopSearchInputRef}
                      type="search"
                      value={desktopSearch}
                      onChange={(e) => setDesktopSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && desktopSearch.trim()) {
                          e.preventDefault();
                          setDesktopSearchOpen(false);
                        }
                      }}
                      placeholder="Search products..."
                      className="w-full rounded-lg border border-[#1E2A3F] bg-[#121A2B] py-2 pl-9 pr-9 text-sm text-[#F5F7FB] placeholder:text-[#8A96AC] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                    />
                    {desktopSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setDesktopSearch("");
                          desktopSearchInputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8A96AC] hover:bg-[#1A2439] hover:text-[#F5F7FB]"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
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
                </div>

                {/* Results */}
                {desktopSearch.trim() ? (
                  desktopSearchResults.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-[#8A96AC]">
                      No products match &ldquo;{desktopSearch}&rdquo;.
                    </p>
                  ) : (
                    <ul className="max-h-80 divide-y divide-[#1E2A3F] overflow-y-auto">
                      {desktopSearchResults.map((item) => (
                        <li key={item.slug}>
                          <Link
                            href={`/products/${item.slug}`}
                            onClick={() => setDesktopSearchOpen(false)}
                            className="flex flex-col gap-0.5 px-4 py-2.5 transition-colors hover:bg-[#1A2439]"
                          >
                            <span className="text-sm font-medium text-[#F5F7FB]">
                              {item.name}
                            </span>
                            <span className="text-xs text-[#8A96AC]">
                              {item.category}
                            </span>
                          </Link>
                        </li>
                      ))}
                      <li className="bg-[#1A2439]">
                        <Link
                          href={`/products?q=${encodeURIComponent(desktopSearch)}`}
                          onClick={() => setDesktopSearchOpen(false)}
                          className="block px-4 py-2.5 text-center text-xs font-medium text-[#2563EB] hover:underline"
                        >
                          View all matching products
                        </Link>
                      </li>
                    </ul>
                  )
                ) : (
                  <p className="px-4 py-4 text-xs text-[#8A96AC]">
                    Start typing to search by name, category, or keyword.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Basket icon */}
          <Link
            href="/order"
            className="relative inline-flex items-center justify-center rounded-md p-2 text-[#F5F7FB] hover:bg-[#0F1626] transition-colors"
            aria-label="Basket"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>

            {basketCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white"
                style={{ backgroundColor: "#2563EB" }}
              >
                {basketCount}
              </span>
            )}
          </Link>

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className="inline-flex items-center justify-center rounded-md p-2 text-[#F5F7FB] hover:bg-[#0F1626] transition-colors md:hidden"
              aria-label="Open menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </SheetTrigger>

            <SheetContent side="right" className="w-80 pt-10">
              {/* Mobile search */}
              <div className="mb-4 px-1">
                <label htmlFor="mobile-product-search" className="sr-only">
                  Search products
                </label>
                <div className="relative">
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
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A96AC]"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    id="mobile-product-search"
                    type="search"
                    value={mobileSearch}
                    onChange={(e) => setMobileSearch(e.target.value)}
                    placeholder="Search products..."
                    className="w-full rounded-lg border border-[#1E2A3F] bg-[#121A2B] py-2 pl-9 pr-9 text-sm text-[#F5F7FB] placeholder:text-[#8A96AC] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                  {mobileSearch && (
                    <button
                      type="button"
                      onClick={() => setMobileSearch("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8A96AC] hover:bg-[#1A2439] hover:text-[#F5F7FB]"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
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

                {/* Search results */}
                {mobileSearch.trim() && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-[#1E2A3F] bg-[#121A2B]">
                    {mobileSearchResults.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-[#8A96AC]">
                        No products match &ldquo;{mobileSearch}&rdquo;.
                      </p>
                    ) : (
                      <ul className="max-h-72 divide-y divide-[#1E2A3F] overflow-y-auto">
                        {mobileSearchResults.map((item) => (
                          <li key={item.slug}>
                            <Link
                              href={`/products/${item.slug}`}
                              onClick={() => setMobileOpen(false)}
                              className="flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:bg-[#1A2439]"
                            >
                              <span className="text-sm font-medium text-[#F5F7FB]">
                                {item.name}
                              </span>
                              <span className="text-xs text-[#8A96AC]">
                                {item.category}
                              </span>
                            </Link>
                          </li>
                        ))}
                        <li className="bg-[#1A2439]">
                          <Link
                            href={`/products?q=${encodeURIComponent(mobileSearch)}`}
                            onClick={() => setMobileOpen(false)}
                            className="block px-3 py-2 text-center text-xs font-medium text-[#2563EB] hover:underline"
                          >
                            View all matching products
                          </Link>
                        </li>
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <nav className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      px-4 py-3 rounded-md text-sm font-medium transition-colors
                      ${
                        isActive(link.href)
                          ? "text-[#2563EB] bg-[#2563EB]/5"
                          : "text-[#F5F7FB] hover:text-[#2563EB] hover:bg-[#0F1626]"
                      }
                    `}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-4 border-t border-[#1E2A3F] px-4 pt-4 pb-4">
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
