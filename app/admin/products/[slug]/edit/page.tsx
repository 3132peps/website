// ---------------------------------------------------------------------------
// /admin/products/[slug]/edit -- edit an existing product
// ---------------------------------------------------------------------------

import Link from "next/link";
import { notFound } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";
import { getProductBySlugForAdmin } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Use the admin reader so hidden-from-storefront products are still
  // editable here. Storefront pages must keep using getProductBySlug.
  const product = await getProductBySlugForAdmin(slug);
  if (!product) notFound();

  return (
    <div className="min-h-screen bg-[#0F1626]">
      <header className="border-b border-[#1E2A3F] bg-[#121A2B]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/products"
              className="text-sm text-[#8A96AC] hover:text-[#2563EB]"
            >
              &larr; Back to products
            </Link>
            <h1 className="text-lg font-bold text-[#F5F7FB]">
              <span className="text-[#2563EB]">31-32</span> &middot; Edit{" "}
              <span className="text-[#8A96AC]">{product.name}</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <ProductForm mode="edit" initial={product} />
      </main>
    </div>
  );
}
