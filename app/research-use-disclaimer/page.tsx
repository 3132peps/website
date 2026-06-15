import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Research Use Disclaimer | 31-32 Peptides",
  description:
    "All products sold by 31-32 Peptides are for in-vitro laboratory research purposes only. Read the full Research Use Disclaimer before purchasing.",
};

export default function ResearchUseDisclaimerPage() {
  return (
    <>
      {/* Hero */}
      <section
        className="py-12 md:py-16"
        style={{
          background: "linear-gradient(135deg, #1B2A3D 0%, #2563EB 100%)",
        }}
      >
        <div className="mx-auto max-w-4xl px-4 text-center text-white">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Research Use Disclaimer
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Last updated: May 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <div className="prose prose-sm prose-gray max-w-none text-sm leading-relaxed text-[#D4DBEC] sm:text-base [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#F5F7FB] [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#F5F7FB] [&_p]:mb-3 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1 [&_strong]:text-[#F5F7FB]">
          {/* Top callout -- mirrors the layout used on /terms */}
          <div className="mb-10 rounded-lg border-2 border-[#2563EB]/30 bg-[#1A2439] p-6">
            <h2 className="!mt-0 text-lg font-bold text-[#2563EB]">
              Research Use Only
            </h2>
            <p>
              All products sold by 31-32 Peptides are for laboratory research
              purposes only. They are not intended for human or animal use,
              and must not be used:
            </p>
            <ul>
              <li>
                In foods, drugs, cosmetics, household items, or any products
                intended for ingestion, injection, or topical application;
              </li>
              <li>
                For clinical, diagnostic, therapeutic, or veterinary purposes;
              </li>
              <li>
                In any manner that would contravene UK law or regulatory
                standards.
              </li>
            </ul>
          </div>

          <h2>Buyer Acknowledgements</h2>
          <p>By purchasing from 31-32 Peptides, you confirm that:</p>
          <ul>
            <li>
              You are a qualified researcher, institution, or laboratory
              acting within a lawful and controlled environment;
            </li>
            <li>
              You fully understand and accept the hazards and handling
              requirements associated with research-grade materials;
            </li>
            <li>
              You assume all responsibility for the safe storage, handling,
              and lawful use of the products supplied.
            </li>
          </ul>

          <h2>Liability</h2>
          <p>
            <strong>
              31-32 Peptides accepts no liability for misuse, mishandling, or
              unlawful application of any product.
            </strong>
          </p>

          <h2>Disclaimer for 31-32 Peptides Purchases</h2>
          <p>
            By purchasing from 31-32 Peptides, you acknowledge and agree that:
          </p>
          <p>
            <strong>Research Use Only:</strong> All products are exclusively
            sold for research purposes. They are not intended for human use,
            therapeutic, diagnostic, or clinical application.
          </p>
          <p>
            <strong>Not Medical Products:</strong> None of the products listed
            on our website are medical products, nor should they be marketed
            or used as such.
          </p>
          <p>
            <strong>Compliance and Responsibility:</strong> The buyer is
            responsible for ensuring compliance with all relevant laws and
            regulations. 31-32 Peptides holds no liability for misuse of
            products or any adverse outcomes.
          </p>
          <p>Your purchase signifies your understanding and agreement to these terms.</p>

          <h2>Important Notice</h2>
          <p>
            All powdered (lyophilised) products and any other subsequent items
            are strictly for scientific research purposes. No dosing
            guidelines are included. We comply with all local regulations
            regarding research-only sales within the United Kingdom. We are
            not a pharmacy and do not endorse or offer advice for human or
            animal consumption. Please thoroughly review our terms and
            conditions before making a purchase on our website. International
            customers must check their own local laws and regulations before
            purchasing.
          </p>
          <p>
            <strong>
              You must be 18+ and purchasing for scientific research only.
            </strong>
          </p>
          <p>
            By placing an order with 31-32 Peptides you confirm that you have
            read and accepted the terms set out in this disclaimer.
          </p>
        </div>
      </section>
    </>
  );
}
