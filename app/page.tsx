import Link from "next/link";
import Image from "next/image";
import TrustBar from "@/components/TrustBar";
import ProductCard from "@/components/ProductCard";
import { getAllProducts } from "@/lib/products";

// Stock status can change at any time from /admin/products. Re-read overrides
// every request so out-of-stock items show up correctly on the home page.
export const dynamic = "force-dynamic";

export default async function Home() {
  const allProducts = await getAllProducts();
  const featuredProducts = allProducts
    .filter((p) => p.category !== "Lab Supplies")
    .slice(0, 4);

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Dark molecular gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 18% 78%, rgba(34,211,238,0.14) 0%, transparent 55%), radial-gradient(ellipse at 85% 12%, rgba(37,99,235,0.20) 0%, transparent 55%), linear-gradient(135deg, #070B14 0%, #0F1626 55%, #102A52 100%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
          {/* Copy */}
          <div className="text-center md:text-left">
            <span className="inline-flex items-center rounded-full border border-[#2563EB]/40 bg-[#2563EB]/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[#7DB0FF]">
              Research Grade Peptides
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
              Research-Grade Peptides.{" "}
              <span className="text-[#22D3EE]">Verified Purity.</span>{" "}
              UK&nbsp;Dispatched.
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg md:mx-0">
              High-purity research compounds for in-vitro laboratory use. Every
              batch independently tested. Every vial CoA-documented.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row md:justify-start">
              <Link
                href="/products"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#2563EB] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
              >
                Browse Products
              </Link>

              <Link
                href="/calculator"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                Peptide Calculator
              </Link>
            </div>

            <p className="mt-8 text-xs text-white/50">
              All products for research use only. Not for human consumption.
            </p>
          </div>

          {/* Product vial */}
          <div className="relative mx-auto w-full max-w-sm">
            <Image
              src="/images/hero-vial.jpg"
              alt="31-32 Peptides research vial"
              width={900}
              height={1350}
              className="w-full rounded-2xl border border-[#1E2A3F]"
              priority
            />
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <TrustBar />

      {/* Featured Products */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-[#F5F7FB] sm:text-3xl">
          Featured Research Compounds
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/products"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#2563EB]/30 px-6 text-sm font-medium text-[#2563EB] transition-colors hover:bg-[#2563EB]/5"
          >
            View All Products
          </Link>
        </div>
      </section>

      {/* Why 31-32 Section */}
      <section className="py-16 md:py-20" style={{ backgroundColor: "#1A2439" }}>
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold tracking-tight text-[#F5F7FB] sm:text-3xl">
            Why Researchers Choose 31-32
          </h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center rounded-xl border border-[#1E2A3F] bg-[#121A2B] overflow-hidden">
              <div className="p-6">
                <div className="mb-4 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-[#2563EB]/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[#F5F7FB]">Quality Assurance</h3>
                <p className="text-sm leading-relaxed text-[#B0BBD1]">
                  Every batch undergoes HPLC testing to verify purity. Full Certificates of Analysis are provided with every product, documenting identity, purity, and endotoxin levels.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center rounded-xl border border-[#1E2A3F] bg-[#121A2B] overflow-hidden">
              <div className="p-6">
                <div className="mb-4 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-[#2563EB]/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[#F5F7FB]">Safe Packaging</h3>
                <p className="text-sm leading-relaxed text-[#B0BBD1]">
                  All orders are dispatched in secure, tamper-evident packaging designed to protect compound integrity during transit. Every shipment is carefully packed to ensure your research materials arrive safely.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center rounded-xl border border-[#1E2A3F] bg-[#121A2B] overflow-hidden">
              <div className="p-6">
                <div className="mb-4 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-[#2563EB]/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[#F5F7FB]">Fast UK Shipping</h3>
                <p className="text-sm leading-relaxed text-[#B0BBD1]">
                  Quick UK delivery on all orders. All shipments are fully tracked with Royal Mail, ensuring your research compounds arrive promptly and securely.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calculator CTA Banner */}
      <section className="relative overflow-hidden py-14 md:py-16">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 80% 20%, rgba(34,211,238,0.25) 0%, transparent 55%), linear-gradient(135deg, #1D4ED8 0%, #2563EB 60%, #1E40AF 100%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center text-white">
          <h2 className="text-xl font-bold sm:text-2xl">
            Need to calculate reconstitution volumes?
          </h2>
          <p className="mt-3 text-base text-white/80">
            Try our free research calculator.
          </p>
          <div className="mt-6">
            <Link
              href="/calculator"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#121A2B] px-6 text-sm font-semibold text-[#2563EB] transition-colors hover:bg-[#121A2B]/90"
            >
              Open Calculator
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
