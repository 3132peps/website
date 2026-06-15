import type { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the 31-32 Peptides team. We respond to all enquiries within 24 hours on business days.",
};

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section
        className="py-16 md:py-20"
        style={{
          background: "linear-gradient(135deg, #1B2A3D 0%, #2563EB 100%)",
        }}
      >
        <div className="mx-auto max-w-4xl px-4 text-center text-white">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Contact Us
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/80">
            Have a question about our products, your order, or wholesale
            enquiries? We are here to help.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-5">
          {/* Contact Form -- left column (3/5) */}
          <div className="md:col-span-3">
            <h2 className="mb-6 text-xl font-bold text-[#F5F7FB]">
              Send Us a Message
            </h2>
            <ContactForm />
          </div>

          {/* Contact Info -- right column (2/5) */}
          <div className="md:col-span-2">
            <h2 className="mb-6 text-xl font-bold text-[#F5F7FB]">
              Contact Information
            </h2>

            <div className="space-y-6">
              {/* Email */}
              <div>
                <h3 className="text-sm font-semibold text-[#F5F7FB]">Email</h3>
                <a
                  href="mailto:info@31-32peptides.com"
                  className="mt-1 block text-sm text-[#2563EB] hover:underline"
                >
                  info@31-32peptides.com
                </a>
              </div>

              {/* Response Time */}
              <div>
                <h3 className="text-sm font-semibold text-[#F5F7FB]">
                  Response Time
                </h3>
                <p className="mt-1 text-sm text-[#B0BBD1]">
                  We respond to all enquiries within 24 hours on business days.
                </p>
              </div>

              {/* Research Enquiries */}
              <div>
                <h3 className="text-sm font-semibold text-[#F5F7FB]">
                  Wholesale &amp; Bulk Orders
                </h3>
                <p className="mt-1 text-sm text-[#B0BBD1]">
                  For institutional or bulk pricing enquiries, please select
                  &ldquo;Wholesale/Bulk&rdquo; as your subject when submitting
                  the form, or email us directly.
                </p>
              </div>

              {/* Registered Office */}
              <div>
                <h3 className="text-sm font-semibold text-[#F5F7FB]">
                  Registered Office
                </h3>
                <address className="mt-1 not-italic text-sm leading-relaxed text-[#B0BBD1]">
                  31-32 Peptides
                  <br />
                  Unit 1 Rumbush Farm Business Park
                  <br />
                  Rumbush Lane, Earlswood
                  <br />
                  Solihull, England, B94 5LW
                </address>
                <p className="mt-2 text-xs text-[#8A96AC]">
                  Company number{" "}
                  <span className="font-mono text-[#D4DBEC]">17183269</span>{" "}
                  &middot; Registered in England &amp; Wales
                </p>
              </div>

              {/* Note */}
              <div className="rounded-lg border border-[#2563EB]/20 bg-[#1A2439] p-4">
                <p className="text-xs leading-relaxed text-[#B0BBD1]">
                  All products supplied by 31-32 Peptides are for
                  in-vitro research use only and are not intended for human
                  consumption.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
