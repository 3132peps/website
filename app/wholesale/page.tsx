// ---------------------------------------------------------------------------
// /wholesale -- public B2B enquiry page
// ---------------------------------------------------------------------------
//
// Loads the visible product catalogue (storefront-only) so the multi-select
// "products of interest" mirrors what's currently for sale. The form itself
// is a client component because of the controlled inputs + Turnstile widget
// + success-state toggle. The Turnstile site key is exposed via a public env
// var so the widget renders -- the *secret* stays server-side in /api.

import type { Metadata } from "next";
import { getAllProducts } from "@/lib/products";
import WholesaleForm from "./WholesaleForm";
import DisclaimerBanner from "@/components/DisclaimerBanner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wholesale Enquiries | 31-32 Peptides",
  description:
    "Wholesale supply of research-grade peptides for institutions, retailers, and clinics operating under appropriate regulatory frameworks. Submit an enquiry and we'll respond within 2 business days.",
};

export default async function WholesalePage() {
  const products = await getAllProducts();
  const productList = products.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
  }));

  // The site key is intentionally public -- it's safe to ship to the
  // browser. The matching secret lives only on the server (TURNSTILE_SECRET).
  // When unset, the form falls back to a "no spam check configured" notice
  // and the API still runs (skipped in dev, blocked in prod).
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  return (
    <>
      {/* Hero ---------------------------------------------------------- */}
      <section
        className="py-12 md:py-16"
        style={{
          background: "linear-gradient(135deg, #1B2A3D 0%, #2563EB 100%)",
        }}
      >
        <div className="mx-auto max-w-4xl px-4 text-center text-white sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Wholesale Enquiries
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/85">
            31-32 Peptides supplies wholesale to research institutions,
            universities, pharmacies, clinics, and aesthetic providers operating
            under appropriate regulatory frameworks for the jurisdiction in
            which they trade. Submit your enquiry below and one of our team will
            respond within <strong className="text-white">2 business days</strong>{" "}
            with availability, pricing, and onboarding next steps.
          </p>
        </div>
      </section>

      {/* Intro band ---------------------------------------------------- */}
      <section className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
        <DisclaimerBanner text="Wholesale orders are supplied strictly for in-vitro research use only (RUO). Onward distribution must comply with the regulatory framework of the jurisdiction in which you trade." />
      </section>

      {/* What happens next + minimum order ----------------------------- */}
      <section className="mx-auto max-w-4xl px-4 pb-2 pt-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-5">
            <h2 className="text-base font-semibold text-[#F5F7FB]">
              What happens after you submit
            </h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#B0BBD1]">
              <li>You receive an automatic confirmation email.</li>
              <li>
                We review your enquiry and your business&rsquo; regulatory
                position.
              </li>
              <li>
                A member of our team replies within 2 business days with
                pricing, availability, and onboarding details.
              </li>
            </ol>
          </div>
          <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-5">
            <h2 className="text-base font-semibold text-[#F5F7FB]">
              Minimum order
            </h2>
            <p className="mt-2 text-sm text-[#B0BBD1]">
              We do not enforce a fixed minimum order at the enquiry stage --
              expected monthly volume is captured below so we can scope pricing
              and stock allocation around your actual demand. White-label /
              private-label arrangements are available; let us know if relevant
              and we&rsquo;ll discuss separately.
            </p>
          </div>
        </div>
      </section>

      {/* Form ---------------------------------------------------------- */}
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <WholesaleForm
          catalogue={productList}
          turnstileSiteKey={turnstileSiteKey}
        />
      </section>
    </>
  );
}
