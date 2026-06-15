// ---------------------------------------------------------------------------
// /admin/products/new -- create a new product
// ---------------------------------------------------------------------------

import Link from "next/link";
import ProductForm from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default function AdminProductNewPage() {
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
              <span className="text-[#2563EB]">ELV8</span> &middot; New product
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <ProductForm mode="create" />
      </main>
    </div>
  );
}
