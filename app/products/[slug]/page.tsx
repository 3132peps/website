import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { Product } from "@/lib/types";
import { getAllProducts, getBaselineProducts, getProductBySlug } from "@/lib/products";
import { getLeadTime } from "@/lib/lead-times";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PurchaseDisclaimer from "@/components/PurchaseDisclaimer";
import ProductDisclaimerPopup from "@/components/ProductDisclaimerPopup";
import BundleContents from "@/components/BundleContents";
import { Badge } from "@/components/ui/badge";
import ProductImage from "@/components/ProductImage";
import ProductGallery from "@/components/ProductGallery";
import ProductActions from "./ProductActions";
import { safeJsonLd } from "@/lib/sanitize";

// Stock status can change at any time from /admin/products -- re-read
// overrides per request.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------
export function generateStaticParams() {
  return getBaselineProducts().map((p) => ({ slug: p.slug }));
}

// ---------------------------------------------------------------------------
// Dynamic metadata
// ---------------------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Read from the DB (with baseline fallback) rather than the JSON baseline
  // directly: admin-created products exist only in the DB, and their pages
  // would otherwise render with a "Product Not Found" title. The page is
  // force-dynamic, so metadata runs per-request anyway.
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Product Not Found" };
  }

  // The root layout's title template appends "| 31-32 Peptides".
  return {
    title: product.name,
    description: product.description.slice(0, 160),
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const allProducts: Product[] = await getAllProducts();

  // Temporary dispatch lead-time notice (e.g. made-to-order items), keyed by
  // slug in lib/lead-times.ts.
  const leadTime = getLeadTime(product.slug);

  const relatedProducts = product.relatedSlugs
    .map((rs) => allProducts.find((p) => p.slug === rs))
    .filter(Boolean) as Product[];

  // Calculator deep link, pre-loaded with this compound + its mg amount.
  const firstVariantMg = (() => {
    const w = product.variants[0]?.weight ?? "";
    const m = w.match(/([\d.]+)\s*mg/i);
    return m ? Number(m[1]) : null;
  })();
  const calculatorHref = `/calculator?compound=${encodeURIComponent(product.slug)}${
    firstVariantMg !== null ? `&peptide=${firstVariantMg}` : ""
  }`;

  // JSON-LD Product structured data
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.variants[0]?.sku,
    category: product.category,
    offers: product.contactForPrice
      ? undefined
      : product.variants.map((v) => ({
          "@type": "Offer",
          price: v.price,
          priceCurrency: "GBP",
          sku: v.sku,
          availability: product.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://31-32peptides.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: "https://31-32peptides.com/products",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `https://31-32peptides.com/products/${product.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />

      <ProductDisclaimerPopup />

      <article className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-[#8A96AC]" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-[#2563EB]">
                Home
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/products" className="hover:text-[#2563EB]">
                Products
              </Link>
            </li>
            <li>/</li>
            <li className="font-medium text-[#F5F7FB]">{product.name}</li>
          </ol>
        </nav>

        {/* ----------------------------------------------------------------- */}
        {/* Two-column layout */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid gap-10 lg:grid-cols-2">
          {/* LEFT COLUMN -- Product photo gallery */}
          {product.images && product.images.length > 0 ? (
            <ProductGallery images={product.images} productName={product.name} />
          ) : (
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#1A2439] to-white aspect-square">
              <div className="flex h-full w-full items-center justify-center">
                <ProductImage
                  name={product.name}
                  weight={product.variants[0]?.weight || ""}
                  format={product.format}
                  className="h-full w-full"
                />
              </div>
            </div>
          )}

          {/* RIGHT COLUMN -- Product info */}
          <div className="flex flex-col gap-6">
            {/* Category & format badges */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className="text-xs uppercase tracking-wider"
              >
                {product.category}
              </Badge>
              {product.format && product.format !== "vial" && (
                <Badge
                  variant="outline"
                  className="border-[#2563EB]/30 text-xs uppercase tracking-wider text-[#2563EB]"
                >
                  {product.format === "pen" ? "Pre-filled Pen" : "Nasal Spray"}
                </Badge>
              )}
              {product.isBundle && (
                <Badge className="bg-[#2563EB] text-xs uppercase tracking-wider text-white">
                  Bundle
                </Badge>
              )}
            </div>

            {/* Name */}
            <h1 className="text-3xl font-bold tracking-tight text-[#F5F7FB] sm:text-4xl">
              {product.name}
            </h1>

            {/* Purity */}
            {product.purity && (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#2563EB]">
                  {product.purity}
                </span>
                <span className="text-sm font-medium uppercase tracking-wide text-[#8A96AC]">
                  HPLC Verified
                </span>
              </div>
            )}

            {/* Dispatch lead-time notice (e.g. made-to-order items) */}
            {leadTime && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">
                    Dispatch Time
                  </h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-amber-800">
                    {leadTime.notice}
                  </p>
                </div>
              </div>
            )}

            {/* Client component: variant selector + add to basket */}
            <ProductActions product={product} />

            {/* Certificate of Analysis */}
            {product.coaUrl && (
              <a
                href={product.coaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-md border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-2.5 text-sm font-medium text-[#2563EB] transition-colors hover:bg-[#2563EB]/10"
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
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Certificate of Analysis (PDF)
              </a>
            )}

            {/* Storage instructions */}
            {product.storageInstructions && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-1 text-sm font-semibold text-amber-900">
                  Storage Instructions
                </h3>
                <p className="text-sm leading-relaxed text-amber-800">
                  {product.storageInstructions}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Description & Research Context */}
        {/* ----------------------------------------------------------------- */}
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-xl font-bold text-[#F5F7FB]">
              Description
            </h2>
            <p className="leading-relaxed text-[#D4DBEC]">
              {product.description}
            </p>
          </div>

          {product.researchContext && (
            <div>
              <h2 className="mb-3 text-xl font-bold text-[#F5F7FB]">
                Research Context
              </h2>
              <p className="leading-relaxed text-[#D4DBEC]">
                {product.researchContext}
              </p>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Molecular Info */}
        {/* ----------------------------------------------------------------- */}
        {(product.molecularWeight || product.sequence) && (
          <div className="mt-12 rounded-xl border border-[#1E2A3F] bg-[#1A2439] p-6">
            <h2 className="mb-4 text-xl font-bold text-[#F5F7FB]">
              Molecular Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {product.molecularWeight && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8A96AC]">
                    Molecular Weight
                  </p>
                  <p className="mt-1 font-mono text-base text-[#F5F7FB]">
                    {product.molecularWeight}
                  </p>
                </div>
              )}
              {product.sequence && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8A96AC]">
                    Sequence
                  </p>
                  <p className="mt-1 break-all font-mono text-sm leading-relaxed text-[#F5F7FB]">
                    {product.sequence}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reconstitution calculator deep link for this compound. */}
        <div className="mt-12">
          <Link
            href={calculatorHref}
            className="flex items-center gap-4 rounded-xl border border-[#2563EB]/30 bg-[#1A2439] p-5 transition-colors hover:border-[#2563EB] hover:bg-[#2563EB]/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#121A2B] text-[#2563EB]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 2v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V2" />
                <line x1="9" y1="2" x2="15" y2="2" />
                <line x1="6" y1="14" x2="18" y2="14" />
              </svg>
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#F5F7FB]">
                Reconstitution Calculator
              </p>
              <p className="text-xs text-[#B0BBD1]">
                Open the calculator pre-loaded with this compound to plan
                reconstitution.
              </p>
            </div>
            <span className="text-xs font-medium text-[#2563EB]">Open &rarr;</span>
          </Link>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Bundle "What's included" -- only when the product is a bundle.   */}
        {/* Resolves bundle items against the storefront catalogue, so any   */}
        {/* hidden / removed constituent is silently dropped (no dead links).*/}
        {/* ----------------------------------------------------------------- */}
        {product.isBundle && (
          <BundleContents bundle={product} catalogue={allProducts} />
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Related Products */}
        {/* ----------------------------------------------------------------- */}
        {relatedProducts.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 text-2xl font-bold text-[#F5F7FB]">
              Related Products
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
              {relatedProducts.map((rp) => (
                <Link
                  key={rp.slug}
                  href={`/products/${rp.slug}`}
                  className="group flex items-center gap-4 rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-4 transition-shadow hover:shadow-md"
                >
                  {/* Small product thumbnail */}
                  <div className="relative h-14 w-14 shrink-0 rounded-lg bg-gradient-to-b from-[#1A2439] to-white overflow-hidden">
                    {rp.images?.[0] ? (
                      <Image
                        src={rp.images[0]}
                        alt={rp.name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <ProductImage
                        name={rp.name}
                        weight={rp.variants[0]?.weight || ""}
                        format={rp.format}
                        className="h-full w-full"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#F5F7FB] group-hover:text-[#2563EB]">
                      {rp.name}
                    </p>
                    <p className="text-sm text-[#8A96AC]">{rp.category}</p>
                    <p className="text-sm font-bold text-[#2563EB]">
                      From &pound;{rp.variants[0]?.price.toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Bottom disclaimer */}
        <div className="mt-14 space-y-4">
          <DisclaimerBanner />
          <PurchaseDisclaimer />
        </div>
      </article>
    </>
  );
}
