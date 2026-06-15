import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Terms and conditions for purchasing research-grade peptides from 31-32 Peptides. All products are for in-vitro research use only.",
};

export default function TermsPage() {
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
            Terms &amp; Conditions
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Last updated: June 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <div className="prose prose-sm prose-gray max-w-none text-sm leading-relaxed text-[#D4DBEC] sm:text-base [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#F5F7FB] [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#F5F7FB] [&_p]:mb-3 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1">
          {/* Research Use Only Agreement */}
          <div className="mb-10 rounded-lg border-2 border-[#2563EB]/30 bg-[#1A2439] p-6">
            <h2 className="!mt-0 text-lg font-bold text-[#2563EB]">
              Research Use Only Agreement
            </h2>
            <p>
              All products sold by 31-32 Peptides are intended
              strictly for in-vitro research use only (RUO). They are not
              intended for human or animal consumption, therapeutic use,
              diagnostic purposes, or any form of in-vivo application.
            </p>
            <p>
              By placing an order, you confirm that you understand and agree to
              this condition. You further confirm that you will not use, resell,
              or distribute any products for purposes other than legitimate
              in-vitro laboratory research.
            </p>
          </div>

          <h2>1. General</h2>
          <p>
            These Terms and Conditions (&ldquo;Terms&rdquo;) govern your use of
            the 31-32 Peptides website (the &ldquo;Site&rdquo;) and
            any purchases made through it. By accessing or using the Site, or by
            placing an order, you agree to be bound by these Terms in full. If
            you do not agree, you must not use the Site or place any orders.
          </p>
          <p>
            31-32 Peptides reserves the right to update these Terms
            at any time. The latest version will always be available on this
            page with the &ldquo;Last updated&rdquo; date.
          </p>

          <h2>2. Eligibility</h2>
          <p>To purchase products from 31-32 Peptides, you must:</p>
          <ul>
            <li>Be at least 18 years of age;</li>
            <li>Be a resident of or have a delivery address in the United Kingdom;</li>
            <li>
              Intend to use all purchased products solely for legitimate in-vitro
              research purposes;
            </li>
            <li>
              Not be purchasing on behalf of any individual under the age of 18.
            </li>
          </ul>
          <p>
            We reserve the right to request age verification or proof of
            research affiliation before processing any order.
          </p>

          <h2>3. Products</h2>
          <h3>3.1 Product Descriptions</h3>
          <p>
            We make every effort to ensure that product descriptions, images,
            and specifications on the Site are accurate. However, we do not
            warrant that all product information is complete, current, or
            error-free. Products may vary slightly from images shown.
          </p>

          <h3>3.2 Research Use Only</h3>
          <p>
            All products are supplied strictly for in-vitro research use only.
            They are not manufactured, tested, or approved for human or animal
            consumption, therapeutic use, or any clinical application. Misuse of
            products is entirely at the buyer&rsquo;s own risk and liability.
          </p>

          <h3>3.3 Availability &amp; Substitutions</h3>
          <p>
            Product availability is subject to change without notice, and we
            reserve the right to discontinue any product at any time. Where a
            specific product, presentation, or packaging is temporarily or
            permanently unavailable, we reserve the right, at our sole
            discretion, to supply a comparable alternative of equal or greater
            value &mdash; often a higher-value equivalent &mdash; so that your
            order can be fulfilled. By placing an order you consent to receiving
            a suitable equivalent of equal or higher value where your original
            selection cannot be supplied, and such substitutions are not grounds
            for a return, refund, or cancellation.
          </p>

          <h2>4. Order Process</h2>
          <p>
            When you place an order through our website:
          </p>
          <ul>
            <li>
              Our team will review your order and send an invoice to your email
              within 24 hours;
            </li>
            <li>
              Payment is required before dispatch. Once payment is received,
              your order will be processed and dispatched;
            </li>
            <li>
              You will receive email notifications at key stages: order
              confirmed, invoice sent, payment received, and dispatched;
            </li>
            <li>
              All orders are subject to the same quality assurance standards
              as all our products;
            </li>
            <li>
              If a batch fails quality control before dispatch, you will be
              offered an equivalent replacement of equal or greater value, or
              allocation in the next passing batch.
            </li>
          </ul>

          <h2>5. Pricing &amp; Payment</h2>
          <p>
            All prices are displayed in British Pounds (GBP) and are inclusive of
            VAT where applicable. We reserve the right to change prices at any
            time, though any changes will not affect orders already confirmed.
          </p>
          <p>
            Payment must be received in full before dispatch. We accept the
            payment methods displayed at checkout.
          </p>

          <h2>6. Shipping &amp; Delivery</h2>
          <p>
            Please refer to our{" "}
            <a
              href="/shipping"
              className="text-[#2563EB] underline hover:text-[#155d8a]"
            >
              Shipping &amp; Returns
            </a>{" "}
            page for full details regarding dispatch times, carriers, and
            delivery expectations.
          </p>

          <h2>7. Returns, Refunds &amp; Substitutions</h2>
          <p>
            Due to the nature of the research compounds we supply, all sales are
            final. Once an order has been dispatched we are unable to accept
            returns or to offer refunds or exchanges, including (without
            limitation) for change of mind, ordering the wrong item or quantity,
            or any other reason within the customer&rsquo;s control. Once a
            product has left our facility we cannot verify that it remains
            unopened, uncontaminated, or stored within its required conditions,
            and for health-protection and hygiene reasons it cannot be resold and
            therefore cannot be returned or refunded.
          </p>
          <p>
            Where a specific product, presentation, or packaging is temporarily
            or permanently unavailable, we reserve the right, at our sole
            discretion, to supply a comparable alternative of equal or greater
            value &mdash; often a higher-value equivalent &mdash; without prior
            notice. By placing an order you consent to receiving such an
            equivalent where your original selection cannot be supplied, and
            substitutions of this kind are not grounds for a return, refund, or
            cancellation.
          </p>
          <p>
            If your order arrives damaged, faulty, or incorrect, please contact
            us within 48 hours of delivery with photographs and your order
            number, before opening or using the product. Where an error or fault
            on our part is confirmed, we will, at our discretion, arrange a
            replacement of equal or greater value; we do not require you to return
            the item. Nothing in these Terms is intended to exclude or limit any
            statutory rights that cannot lawfully be excluded. Please see our{" "}
            <a
              href="/shipping"
              className="text-[#2563EB] underline hover:text-[#155d8a]"
            >
              Shipping &amp; Returns
            </a>{" "}
            page for the full policy.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            All content on this Site, including but not limited to text,
            graphics, logos, images, and software, is the property of 31-32
            Wellness or its licensors and is protected by
            applicable intellectual property laws. You may not reproduce,
            distribute, or create derivative works from any content without our
            prior written consent.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, 31-32 Peptides
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages arising from or relating to your
            use of the Site or any products purchased.
          </p>
          <p>
            Our total liability for any claim arising from these Terms or your
            use of our products shall not exceed the amount paid by you for the
            specific product(s) giving rise to the claim.
          </p>
          <p>
            We do not accept any liability for the misuse of products, including
            any use other than in-vitro laboratory research.
          </p>

          <h2>10. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless 31-32 Peptides,
            its directors, employees, and agents from any claims, damages,
            losses, or expenses arising from your breach of these Terms or your
            misuse of any products.
          </p>

          <h2>11. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of England and Wales. Any disputes arising from or in
            connection with these Terms shall be subject to the exclusive
            jurisdiction of the courts of England and Wales.
          </p>

          <h2>12. Contact</h2>
          <p>
            If you have any questions about these Terms, please contact us at{" "}
            <a
              href="mailto:info@31-32peptides.com"
              className="text-[#2563EB] underline hover:text-[#155d8a]"
            >
              info@31-32peptides.com
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
