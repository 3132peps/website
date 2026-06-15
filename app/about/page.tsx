import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about 31-32 Peptides, our commitment to research-grade peptide purity, HPLC-verified quality assurance, and transparent sourcing for UK researchers.",
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section
        className="py-16 md:py-24"
        style={{
          background: "linear-gradient(135deg, #1B2A3D 0%, #2563EB 100%)",
        }}
      >
        <div className="mx-auto max-w-4xl px-4 text-center text-white">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            About 31-32 Peptides
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            Raising the standard for research-grade peptide supply in the United
            Kingdom.
          </p>
        </div>
      </section>

      {/* Brand Story */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:py-20">
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-[#F5F7FB]">
          Our Story
        </h2>
        <div className="space-y-4 text-sm leading-relaxed text-[#D4DBEC] sm:text-base">
          <p>
            31-32 Peptides was founded to address a persistent
            quality gap in the UK peptide research supply chain. Too many
            researchers have been forced to compromise on compound purity,
            inconsistent documentation, and opaque sourcing practices. We set out
            to change that.
          </p>
          <p>
            Our approach is simple: every product we supply is verified to the
            highest analytical standards before it reaches you. We work directly
            with established synthesis laboratories, maintain rigorous
            packaging and handling protocols, and provide batch-specific
            Certificates of Analysis so that researchers can trust the materials
            they are working with.
          </p>
          <p>
            Transparency is at the heart of everything we do. From sourcing and
            manufacturing through to storage and dispatch, we believe
            researchers deserve full visibility into the supply chain behind
            their compounds. That is why we publish purity data, testing
            methodology, and storage conditions for every product we offer.
          </p>
        </div>
      </section>

      {/* Quality Assurance */}
      <section className="py-16 md:py-20" style={{ backgroundColor: "#1A2439" }}>
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-[#F5F7FB]">
            Quality Assurance
          </h2>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            {/* HPLC Testing */}
            <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563EB]/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 3h6v7.5L18 21H6L9 10.5z" />
                  <path d="M9 3h6" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#F5F7FB]">
                HPLC Testing
              </h3>
              <p className="text-sm leading-relaxed text-[#B0BBD1]">
                Every batch is analysed using High-Performance Liquid
                Chromatography to confirm purity, identity, and composition.
                Only batches meeting our strict thresholds are released for sale.
              </p>
            </div>

            {/* Batch-Specific CoAs */}
            <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563EB]/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="m9 15 2 2 4-4" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#F5F7FB]">
                Batch-Specific CoAs
              </h3>
              <p className="text-sm leading-relaxed text-[#B0BBD1]">
                Every product ships with a Certificate of Analysis tied to its
                specific production batch. CoAs include HPLC chromatograms, mass
                spectrometry data, and purity percentages.
              </p>
            </div>

            {/* Third-Party Verification */}
            <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563EB]/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#F5F7FB]">
                Third-Party Verification
              </h3>
              <p className="text-sm leading-relaxed text-[#B0BBD1]">
                In addition to in-house testing, we commission independent
                third-party laboratory analysis to validate our results. Reports
                are available on request for any product and batch.
              </p>
            </div>

            {/* Safe Packaging */}
            <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563EB]/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#F5F7FB]">
                Safe Packaging
              </h3>
              <p className="text-sm leading-relaxed text-[#B0BBD1]">
                All products are dispatched in secure, tamper-evident packaging
                designed to protect compound integrity during transit. Every
                shipment is carefully packed to ensure your research materials
                arrive safely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:py-20">
        <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
          <div>
            <p className="text-3xl font-bold text-[#2563EB]">99%+</p>
            <p className="mt-1 text-sm text-[#B0BBD1]">Verified Purity</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-[#2563EB]">100%</p>
            <p className="mt-1 text-sm text-[#B0BBD1]">Batch-Tested</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-[#2563EB]">Fast</p>
            <p className="mt-1 text-sm text-[#B0BBD1]">UK Delivery</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-[#2563EB]">Secure</p>
            <p className="mt-1 text-sm text-[#B0BBD1]">Safe Packaging</p>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section
        className="py-14 md:py-16"
        style={{ backgroundColor: "#2563EB" }}
      >
        <div className="mx-auto max-w-4xl px-4 text-center text-white">
          <h2 className="text-xl font-bold sm:text-2xl">Our Mission</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80">
            To provide UK researchers with the highest-quality peptide compounds
            available, backed by transparent analytical data and reliable
            supply. Every product we offer is intended strictly for in-vitro
            research use only and is not for human consumption.
          </p>
        </div>
      </section>
    </>
  );
}
