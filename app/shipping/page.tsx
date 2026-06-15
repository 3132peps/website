import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description:
    "UK shipping information, delivery times, safe packaging, and returns policy for 31-32 Peptides research peptides.",
};

export default function ShippingPage() {
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
            Shipping &amp; Returns
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/80">
            Fast, tracked UK delivery with safe, secure packaging for
            all research compounds.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <div className="space-y-12">
          {/* Shipping Information */}
          <div>
            <h2 className="mb-6 text-xl font-bold text-[#F5F7FB] sm:text-2xl">
              UK Shipping
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {/* Quick Dispatch */}
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
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-[#F5F7FB]">
                  Quick Dispatch
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#B0BBD1]">
                  Orders are dispatched promptly once payment has been received.
                </p>
              </div>

              {/* Tracked Delivery */}
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
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-[#F5F7FB]">
                  Royal Mail Tracked
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#B0BBD1]">
                  All UK orders are sent via Royal Mail Tracked. Tracking
                  details are available on request.
                </p>
              </div>

              {/* Delivery Time */}
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
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-[#F5F7FB]">
                  1-3 Business Days
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#B0BBD1]">
                  Standard UK delivery within 1-3 business days from the date
                  of dispatch.
                </p>
              </div>
            </div>
          </div>

          {/* Packaging */}
          <div>
            <h2 className="mb-4 text-xl font-bold text-[#F5F7FB] sm:text-2xl">
              Packaging
            </h2>
            <div className="rounded-xl border border-[#1E2A3F] bg-[#1A2439] p-6">
              <div className="space-y-3 text-sm leading-relaxed text-[#D4DBEC] sm:text-base">
                <p>
                  All orders are dispatched in <strong>discreet</strong>,
                  unbranded packaging with no external indication of the
                  contents.
                </p>
                <p>
                  Peptide products are shipped using{" "}
                  <strong>secure, protective packaging</strong> designed to
                  maintain compound integrity during transit. All items are
                  carefully packed to ensure products arrive safely and in
                  optimal condition.
                </p>
                <p>
                  All vials are sealed in tamper-evident packaging and cushioned
                  to prevent damage during shipping.
                </p>
              </div>
            </div>
          </div>

          {/* Returns, Refunds & Substitutions */}
          <div>
            <h2 className="mb-4 text-xl font-bold text-[#F5F7FB] sm:text-2xl">
              Returns, Refunds &amp; Substitutions
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-[#D4DBEC] sm:text-base">
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
                <h3 className="mb-2 text-base font-semibold text-[#F5F7FB]">
                  All Sales Are Final — No Returns or Refunds
                </h3>
                <p className="mb-3">
                  Due to the nature of the research compounds we supply, all
                  sales are final. We are unable to accept returns or to offer
                  refunds or exchanges once an order has been dispatched.
                </p>
                <p className="mb-3">
                  Once a product has left our facility we cannot guarantee how it
                  has been handled, opened, used, or stored, and we have no way of
                  verifying that a returned item remains unopened, uncontaminated,
                  and within its required storage conditions. For the safety and
                  protection of every researcher we supply, and on health-protection
                  and hygiene grounds, products cannot be resold once they have left
                  our control and therefore cannot be returned or refunded.
                </p>
                <p>
                  This includes, without limitation, change of mind, ordering the
                  wrong item or quantity, no longer requiring the product, or any
                  other reason within the customer&rsquo;s control. Please review
                  your order carefully before submitting payment.
                </p>
              </div>

              <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
                <h3 className="mb-2 text-base font-semibold text-[#F5F7FB]">
                  Product &amp; Packaging Substitutions
                </h3>
                <p className="mb-3">
                  Stock levels and the availability of specific products, brands,
                  presentations, vial sizes, and packaging can change without
                  notice. Where the exact item or packaging you ordered is
                  temporarily or permanently unavailable, we reserve the right, at
                  our sole discretion, to supply a comparable alternative of equal
                  or greater value &mdash; frequently a higher-value equivalent
                  &mdash; so that your order can be fulfilled without delay.
                </p>
                <p>
                  By placing an order you consent to receiving a suitable
                  equivalent of equal or higher value where your original selection
                  cannot be supplied. Substitutions are provided in good faith to
                  fulfil your order and are not grounds for a return, refund, or
                  cancellation.
                </p>
              </div>

              <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
                <h3 className="mb-2 text-base font-semibold text-[#F5F7FB]">
                  Damaged, Faulty or Incorrect Items
                </h3>
                <p>
                  We take great care in packing every order. In the unlikely event
                  that your parcel arrives visibly damaged, or you believe an item
                  is faulty or not what you ordered, please contact us at{" "}
                  <a
                    href="mailto:info@31-32peptides.com"
                    className="text-[#2563EB] underline hover:text-[#155d8a]"
                  >
                    info@31-32peptides.com
                  </a>{" "}
                  within 48 hours of delivery, with clear photographs and your
                  order number, before opening or using the product. Where an error
                  or fault on our part is confirmed, we will, at our discretion,
                  arrange a replacement of equal or greater value. We do not require
                  you to return the item.
                </p>
              </div>

              <div className="rounded-xl border border-[#1E2A3F] bg-[#1A2439] p-6">
                <h3 className="mb-2 text-base font-semibold text-[#F5F7FB]">
                  Your Statutory Rights
                </h3>
                <p>
                  Nothing in this policy is intended to exclude or limit any rights
                  you may have under applicable law that cannot lawfully be
                  excluded. All products are supplied strictly for in-vitro research
                  use only and not as consumer goods; please see our{" "}
                  <a
                    href="/terms"
                    className="text-[#2563EB] underline hover:text-[#155d8a]"
                  >
                    Terms &amp; Conditions
                  </a>{" "}
                  for full details.
                </p>
              </div>
            </div>
          </div>

          {/* Tracking & Missing Parcels */}
          <div>
            <h2 className="mb-4 text-xl font-bold text-[#F5F7FB] sm:text-2xl">
              Tracking &amp; Missing Parcels
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-[#D4DBEC] sm:text-base">
              <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
                <h3 className="mb-2 text-base font-semibold text-[#F5F7FB]">
                  Tracking on Request
                </h3>
                <p>
                  Every UK order is sent via Royal Mail Tracked, so a tracking
                  number is generated for every parcel. To keep your inbox
                  clean we do not send tracking details automatically, but they
                  are always available — just email{" "}
                  <a
                    href="mailto:info@31-32peptides.com"
                    className="text-[#2563EB] underline hover:text-[#155d8a]"
                  >
                    info@31-32peptides.com
                  </a>{" "}
                  with your order reference and we will forward the tracking
                  number straight away.
                </p>
              </div>

              <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6">
                <h3 className="mb-2 text-base font-semibold text-[#F5F7FB]">
                  Delayed or Missing Parcels
                </h3>
                <p>
                  Once a parcel is in transit it sits within Royal Mail&rsquo;s
                  delivery network. If a parcel is delayed, marked as delivered
                  but not received, or otherwise appears missing, Royal Mail
                  handle the investigation directly through their{" "}
                  <a
                    href="https://www.royalmail.com/help/missing-parcel"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2563EB] underline hover:text-[#155d8a]"
                  >
                    missing or delayed mail process
                  </a>
                  . We will gladly supply the tracking number to help you raise
                  a claim, and we are happy to support you through the process.
                </p>
              </div>
            </div>
          </div>

          {/* International Shipping */}
          <div>
            <h2 className="mb-4 text-xl font-bold text-[#F5F7FB] sm:text-2xl">
              International Shipping
            </h2>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6">
              <p className="text-sm leading-relaxed text-[#D4DBEC] sm:text-base">
                International shipping is <strong>not available</strong> at
                launch. We are currently focused on providing the best possible
                service to UK-based researchers. We plan to expand our shipping
                options in the future. Please check back for updates or contact
                us to register your interest.
              </p>
            </div>
          </div>

          {/* Questions */}
          <div className="text-center">
            <p className="text-sm text-[#B0BBD1]">
              Have questions about shipping or returns?{" "}
              <a
                href="/contact"
                className="text-[#2563EB] underline hover:text-[#155d8a]"
              >
                Contact our team
              </a>{" "}
              and we will be happy to help.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
