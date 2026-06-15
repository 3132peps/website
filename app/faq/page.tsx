import type { Metadata } from "next";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import faqData from "@/data/faqs.json";
import type { FAQCategory } from "@/lib/types";
import { safeJsonLd } from "@/lib/sanitize";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Find answers to common questions about ordering, shipping, quality testing, legal compliance, and peptide research from 31-32 Peptides.",
};

// Map the JSON structure (which uses "questions") to the FAQCategory type (which uses "items")
const categories: FAQCategory[] = (
  faqData as { category: string; questions: { question: string; answer: string }[] }[]
).map((cat) => ({
  category: cat.category,
  items: cat.questions,
}));

// Build JSON-LD structured data for all questions
const allQuestions = categories.flatMap((cat) => cat.items);
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: allQuestions.map((q) => ({
    "@type": "Question",
    name: q.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: q.answer,
    },
  })),
};

export default function FAQPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />

      {/* Hero */}
      <section
        className="py-16 md:py-20"
        style={{
          background: "linear-gradient(135deg, #1B2A3D 0%, #2563EB 100%)",
        }}
      >
        <div className="mx-auto max-w-4xl px-4 text-center text-white">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently Asked Questions
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/80">
            Everything you need to know about ordering, shipping, quality
            testing, and compliance.
          </p>
        </div>
      </section>

      {/* FAQ Sections */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:py-20">
        <div className="space-y-12">
          {categories.map((category) => (
            <div key={category.category}>
              <h2 className="mb-4 text-xl font-bold tracking-tight text-[#F5F7FB] sm:text-2xl">
                {category.category}
              </h2>

              <Accordion>
                {category.items.map((item, index) => (
                  <AccordionItem
                    key={index}
                    value={`${category.category}-${index}`}
                  >
                    <AccordionTrigger>{item.question}</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-[#D4DBEC]">{item.answer}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section
        className="py-12 md:py-14"
        style={{ backgroundColor: "#1A2439" }}
      >
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-lg font-bold text-[#F5F7FB] sm:text-xl">
            Still have questions?
          </h2>
          <p className="mt-2 text-sm text-[#B0BBD1]">
            Our team is here to help. Reach out and we will get back to you
            within 24 hours on business days.
          </p>
          <a
            href="/contact"
            className="mt-4 inline-block rounded-lg bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#155d8a] transition-colors"
          >
            Contact Us
          </a>
        </div>
      </section>
    </>
  );
}
