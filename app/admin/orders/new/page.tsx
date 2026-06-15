// ---------------------------------------------------------------------------
// /admin/orders/new -- create an order manually (admin-side, invoice flow)
// ---------------------------------------------------------------------------
//
// Server component that loads the full admin product catalogue (including
// products hidden from the public storefront) and hands it to the client
// form. Hidden products MUST be reachable here -- that's the entire reason
// this page exists: so the admin can sell items that are kept off the
// public site (e.g. peptide pens) by manually entering the order and
// emailing the customer an invoice.
//
// Auth is enforced by proxy.ts on every /admin/* path; the API endpoint the
// form posts to also calls requireAdmin(). This page itself does not need
// to render an unauthorised message because the proxy never delivers an
// unauthenticated request here in the first place.

import Link from "next/link";
import { getAllProductsForAdmin } from "@/lib/products";
import AdminOrderForm from "./AdminOrderForm";

export const dynamic = "force-dynamic";

export default async function AdminOrderNewPage() {
  const products = await getAllProductsForAdmin();
  // Strip the catalogue down to what the form needs. Sending the full
  // Product objects (including descriptions, COA URLs, tags, etc.) would
  // bloat the page payload for no benefit.
  const catalogue = products.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    storefrontVisible: p.storefrontVisible !== false,
    inStock: p.inStock,
    variants: p.variants.map((v) => ({
      sku: v.sku,
      weight: v.weight,
      price: v.price,
    })),
  }));

  return (
    <div className="min-h-screen bg-[#0F1626]">
      <header className="border-b border-[#1E2A3F] bg-[#121A2B]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm text-[#8A96AC] hover:text-[#2563EB]"
            >
              &larr; Orders
            </Link>
            <h1 className="text-lg font-bold text-[#F5F7FB]">
              <span className="text-[#2563EB]">ELV8</span> &middot; New order
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">Manual order entry</p>
          <p className="mt-1 text-blue-800">
            Use this form to create an order on a customer&rsquo;s behalf.
            On submit, the order is saved and an invoice PDF is emailed to
            the customer with UK bank-transfer details. The order then
            appears in the dashboard at &ldquo;Invoice Sent&rdquo;, ready to
            be marked paid once the transfer arrives.
          </p>
        </div>

        <AdminOrderForm catalogue={catalogue} />
      </main>
    </div>
  );
}
