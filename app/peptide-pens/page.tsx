import type { Metadata } from "next";
import { getAllProducts } from "@/lib/products";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import ProductCard from "@/components/ProductCard";
import { safeJsonLd } from "@/lib/sanitize";

// Pens share the catalogue's stock/visibility data, which can change at any
// time from /admin/products, so re-read on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Peptide Pens | 31-32 Peptides",
  description:
    "Browse our range of pre-filled research peptide pens, including single-peptide and research blend pens. All products are for in-vitro research use only.",
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
      name: "Peptide Pens",
      item: "https://31-32peptides.com/peptide-pens",
    },
  ],
};

export default async function PeptidePensPage() {
  const allProducts = await getAllProducts();
  const pens = allProducts
    .filter((p) => p.format === "pen")
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Top disclaimer banner */}
        <div className="mb-8">
          <DisclaimerBanner text="All products are for in-vitro research use only. Not for human consumption, medical treatment, or cosmetic use." />
        </div>

        {/* Page heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#F5F7FB] sm:text-4xl">
            Peptide Pens
          </h1>
          <p className="mt-2 max-w-2xl text-base text-[#B0BBD1]">
            Pre-filled research pens for precise, reproducible laboratory
            dispensing — including single-peptide and multi-peptide research
            blends. Every pen is supplied exclusively for in-vitro research use.
          </p>
        </div>

        {/* Pen grid */}
        {pens.length === 0 ? (
          <div className="rounded-lg bg-[#1A2439] py-16 text-center">
            <p className="text-lg font-medium text-[#F5F7FB]">
              No peptide pens are available right now.
            </p>
            <p className="mt-2 text-sm text-[#B0BBD1]">
              Please check back soon or browse our full catalogue.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-xs text-[#8A96AC] sm:text-sm">
              {pens.length} {pens.length === 1 ? "pen" : "pens"}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
              {pens.map((product) => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
