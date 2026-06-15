import type { Metadata } from "next";
import { getAllProducts } from "@/lib/products";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import ProductCatalogue from "@/components/ProductCatalogue";
import { safeJsonLd } from "@/lib/sanitize";

// Stock availability can change at any time from /admin/products, so the
// catalogue page must re-read overrides on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research Peptides | 31-32 Peptides",
  description:
    "Browse our catalogue of high-purity research peptides and laboratory supplies. All products are for in-vitro research use only.",
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
  ],
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const allProducts = await getAllProducts();
  const resolvedSearchParams = await searchParams;
  const rawQuery = resolvedSearchParams.q;
  const initialQuery = Array.isArray(rawQuery) ? rawQuery[0] ?? "" : rawQuery ?? "";

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
            Research Products
          </h1>
          <p className="mt-2 max-w-2xl text-base text-[#B0BBD1]">
            High-purity peptides and laboratory supplies for in-vitro research.
            Every batch is third-party tested with a Certificate of Analysis.
          </p>
        </div>

        {/* Client component handles filtering, sorting, and display */}
        <ProductCatalogue products={allProducts} initialQuery={initialQuery} />
      </section>
    </>
  );
}
