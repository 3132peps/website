import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PeptideCalculator from "@/components/PeptideCalculator";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { safeJsonLd } from "@/lib/sanitize";
import { getBaselineProducts } from "@/lib/products";

// `compound` in the URL changes the rendered banner + JSON-LD, so this
// must re-render per request. The calculator widget itself is a client
// component and stays interactive.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Peptide Reconstitution Calculator",
  description:
    "Free peptide reconstitution calculator. Calculate bacteriostatic water volume, injection dose in insulin units, and syringe draw volume for research peptides. Accurate IU conversion for BPC-157, TB-500, and more.",
  keywords: [
    "peptide reconstitution calculator",
    "peptide dosage calculator",
    "bacteriostatic water calculator",
    "insulin unit conversion",
    "peptide mixing calculator",
    "BPC-157 dosage",
    "reconstitution calculator",
    "peptide research calculator",
  ],
};

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------

const faqs = [
  {
    question: "What is peptide reconstitution?",
    answer:
      "Peptide reconstitution is the process of dissolving a lyophilised (freeze-dried) peptide powder into a sterile solution, typically bacteriostatic water, to create a liquid suitable for precise measurement in laboratory research. The reconstituted solution allows researchers to draw accurate micro-doses using an insulin syringe.",
  },
  {
    question: "What is bacteriostatic water and why is it used for reconstitution?",
    answer:
      "Bacteriostatic water is sterile water that contains 0.9% benzyl alcohol as a preservative. The benzyl alcohol inhibits bacterial growth, which extends the usable life of the reconstituted peptide solution. It is preferred over plain sterile water because it allows the solution to be stored and used over multiple research sessions rather than requiring single-use preparation.",
  },
  {
    question: "How do I convert insulin units (IU) to millilitres (mL)?",
    answer:
      "On a standard U-100 insulin syringe, 100 insulin units (IU) equals 1 mL. Therefore, 1 IU equals 0.01 mL. To convert IU to mL, divide the number of units by 100. For example, 25 IU equals 0.25 mL, and 10 IU equals 0.10 mL. This calculator performs this conversion automatically.",
  },
  {
    question: "How should reconstituted peptides be stored?",
    answer:
      "Reconstituted peptide solutions should be stored in the refrigerator at 2-8 degrees Celsius (36-46 degrees Fahrenheit). Avoid freezing the reconstituted solution as this can damage the peptide structure. Keep the vial upright and protected from light.",
  },
  {
    question: "What syringe size should I use?",
    answer:
      "The choice of syringe depends on the volume you need to draw. A 0.3 mL (30 IU) syringe offers the highest precision for very small volumes. A 0.5 mL (50 IU) syringe is the most commonly used as it balances precision with capacity. A 1.0 mL (100 IU) syringe is suitable when larger volumes are required. Use the smallest syringe that can accommodate your draw volume for maximum accuracy.",
  },
  {
    question: "How much bacteriostatic water should I add to my peptide vial?",
    answer:
      "The amount of bacteriostatic water depends on the peptide quantity in the vial and the concentration you wish to achieve. Adding more water creates a more dilute solution, making it easier to measure small doses accurately. A common starting point is 2 mL of water for a 5 mg vial, which yields a concentration of 2,500 mcg/mL. Use this calculator to find the right volume for your specific requirements.",
  },
  {
    question: "What does the graduation mark on the syringe mean?",
    answer:
      "The graduation mark indicates which line on your insulin syringe to draw to. Each small line on a U-100 insulin syringe typically represents 1 IU (0.01 mL). The calculator rounds the draw volume to the nearest whole unit mark for easy reading. On a 0.5 mL syringe, the 25 mark represents 0.25 mL, which is half the syringe capacity.",
  },
  {
    question: "Why does the calculator show my draw volume exceeds syringe capacity?",
    answer:
      "This error appears when the required volume for your desired dose is larger than the selected syringe can hold. You can resolve this by adding more bacteriostatic water to dilute the solution (increasing the water volume), using a larger capacity syringe, or reducing the desired dose amount. The calculator will update in real-time as you adjust these values.",
  },
];

// ---------------------------------------------------------------------------
// JSON-LD structured data
// ---------------------------------------------------------------------------

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawCompound = Array.isArray(sp.compound) ? sp.compound[0] : sp.compound;
  const compoundSlug = typeof rawCompound === "string" ? rawCompound : null;

  // Look up the chosen compound + its reconstitution guide. We use the
  // baseline JSON for product lookup because the calculator page has no
  // need to be DB-fresh -- a recently-renamed product is fine to render
  // with the snapshot label until the next deploy.
  const compound = compoundSlug
    ? getBaselineProducts().find((p) => p.slug === compoundSlug)
    : undefined;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <DisclaimerBanner />

        <div className="mt-8 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#F5F7FB] sm:text-4xl">
            Peptide Reconstitution Calculator
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Calculate the exact volume to draw for your desired research dose.
            Enter your peptide amount, water volume, and target dose below
            &mdash; results update in real time.
          </p>
        </div>

        {/* Compound preset banner -- only when ?compound=<slug> resolves */}
        {compound && (
          <div className="mb-6 rounded-xl border border-[#2563EB]/30 bg-[#1A2439] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Badge className="bg-[#2563EB] text-white">Preset</Badge>
                <div>
                  <p className="text-sm font-semibold text-[#F5F7FB]">
                    Calculating for {compound.name}
                  </p>
                  <p className="text-xs text-[#B0BBD1]">
                    Adjust the peptide amount or water volume below as needed
                    for your batch.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Link
                  href={`/products/${compound.slug}`}
                  className="font-medium text-[#2563EB] hover:underline"
                >
                  View product &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Calculator */}
        <div className="rounded-xl border bg-[#121A2B] p-6 shadow-sm sm:p-8">
          <Suspense fallback={<CalculatorSkeleton />}>
            <PeptideCalculator />
          </Suspense>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-[#F5F7FB]">
            Frequently Asked Questions
          </h2>
          <Accordion className="rounded-lg border bg-[#121A2B] shadow-sm">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className="px-5 text-left text-[15px] font-medium text-[#F5F7FB]">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 text-muted-foreground leading-relaxed">
                  <p>{faq.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="mt-12">
          <DisclaimerBanner />
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function CalculatorSkeleton() {
  return (
    <div className="grid animate-pulse gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-8 w-full rounded bg-[#1A2439]" />
          </div>
        ))}
      </div>
      <div className="space-y-6">
        <div className="h-24 rounded-lg bg-[#1A2439]" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-[#1A2439]" />
          ))}
        </div>
      </div>
    </div>
  );
}
