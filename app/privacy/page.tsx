import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy for 31-32 Peptides. Learn how we collect, use, and protect your personal data in accordance with UK GDPR.",
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Last updated: May 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <div className="prose prose-sm prose-gray max-w-none text-sm leading-relaxed text-[#D4DBEC] sm:text-base [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#F5F7FB] [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#F5F7FB] [&_p]:mb-3 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1">
          <h2>1. Data Controller</h2>
          <p>
            31-32 Peptides is the data controller responsible for
            your personal data collected through this website. If you have any
            questions about how your data is handled, please contact us at{" "}
            <a
              href="mailto:info@31-32peptides.com"
              className="text-[#2563EB] underline hover:text-[#155d8a]"
            >
              info@31-32peptides.com
            </a>
            .
          </p>

          <h2>2. What Data We Collect</h2>
          <p>We may collect and process the following personal data:</p>
          <ul>
            <li>
              <strong>Identity data:</strong> your full name as provided during
              orders or contact form submissions.
            </li>
            <li>
              <strong>Contact data:</strong> your email address, phone number
              (if provided), and delivery address.
            </li>
            <li>
              <strong>Order data:</strong> details of products ordered,
              transaction references, and order history.
            </li>
            <li>
              <strong>Technical data:</strong> IP address, browser type and
              version, time zone, operating system, and platform via standard
              server logs and analytics.
            </li>
            <li>
              <strong>Order request metadata:</strong> when you place an order
              we record your IP address, the user-agent string sent by your
              browser or device, and an approximate location derived from
              your IP (country, region, and city). This is stored alongside
              the order record and used solely for fraud prevention and
              dispute investigation -- see &ldquo;Legal Basis&rdquo; below.
            </li>
            <li>
              <strong>Communication data:</strong> records of correspondence when
              you contact us via the website or email.
            </li>
          </ul>

          <h2>3. Legal Basis for Processing</h2>
          <p>
            We process your personal data on the following legal grounds under
            UK GDPR:
          </p>
          <ul>
            <li>
              <strong>Contract performance:</strong> processing necessary to
              fulfil your order or purchase, including dispatching products
              and sending order confirmations.
            </li>
            <li>
              <strong>Legitimate interests:</strong> processing necessary for
              our legitimate business interests, such as improving our website,
              preventing fraud (including capturing order request metadata
              such as IP address and device information at the point of
              order), and responding to enquiries, where those interests do
              not override your fundamental rights.
            </li>
            <li>
              <strong>Consent:</strong> where you have given specific consent,
              for example opting in to marketing communications. You may
              withdraw consent at any time.
            </li>
            <li>
              <strong>Legal obligation:</strong> processing required to comply
              with our legal obligations, such as tax and accounting
              requirements.
            </li>
          </ul>

          <h2>4. How We Use Your Data</h2>
          <p>Your personal data is used to:</p>
          <ul>
            <li>Process and fulfil your orders;</li>
            <li>
              Send order confirmations, dispatch notifications, and other
              transactional communications;
            </li>
            <li>Respond to your enquiries submitted via the contact form;</li>
            <li>Improve our website and services;</li>
            <li>Comply with legal and regulatory obligations;</li>
            <li>
              Detect and prevent fraud or unauthorised activity on our platform.
            </li>
          </ul>

          <h2>5. Data Retention</h2>
          <p>
            We retain your personal data only for as long as necessary to fulfil
            the purposes for which it was collected:
          </p>
          <ul>
            <li>
              <strong>Order data:</strong> retained for 6 years from the date of
              transaction for tax and accounting compliance.
            </li>
            <li>
              <strong>Contact form submissions:</strong> retained for 12 months
              from the date of submission, unless the enquiry relates to an
              ongoing order or dispute.
            </li>
            <li>
              <strong>Technical/analytics data:</strong> retained for up to 26
              months.
            </li>
          </ul>
          <p>
            After the applicable retention period, your data is securely deleted
            or anonymised.
          </p>

          <h2>6. Your Rights</h2>
          <p>Under UK GDPR, you have the following rights:</p>
          <ul>
            <li>
              <strong>Right of access:</strong> request a copy of the personal
              data we hold about you.
            </li>
            <li>
              <strong>Right to rectification:</strong> request correction of any
              inaccurate or incomplete data.
            </li>
            <li>
              <strong>Right to erasure:</strong> request deletion of your
              personal data where there is no compelling reason for continued
              processing.
            </li>
            <li>
              <strong>Right to restrict processing:</strong> request that we
              limit how we use your data in certain circumstances.
            </li>
            <li>
              <strong>Right to data portability:</strong> request a copy of your
              data in a structured, machine-readable format.
            </li>
            <li>
              <strong>Right to object:</strong> object to processing based on
              legitimate interests or for direct marketing purposes.
            </li>
            <li>
              <strong>Right to withdraw consent:</strong> where processing is
              based on consent, you may withdraw it at any time without
              affecting the lawfulness of prior processing.
            </li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{" "}
            <a
              href="mailto:info@31-32peptides.com"
              className="text-[#2563EB] underline hover:text-[#155d8a]"
            >
              info@31-32peptides.com
            </a>
            . We will respond within one month of receiving your request. You
            also have the right to lodge a complaint with the Information
            Commissioner&rsquo;s Office (ICO) at{" "}
            <a
              href="https://ico.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2563EB] underline hover:text-[#155d8a]"
            >
              ico.org.uk
            </a>
            .
          </p>

          <h2>7. Cookies</h2>
          <p>
            Our website uses cookies and similar technologies to improve your
            browsing experience and analyse site traffic:
          </p>
          <ul>
            <li>
              <strong>Essential cookies:</strong> required for the website to
              function correctly, such as session management and age
              verification. These cannot be disabled.
            </li>
            <li>
              <strong>Analytics cookies:</strong> help us understand how
              visitors use the site. We use anonymised analytics data to improve
              our content and services. You may opt out of analytics cookies at
              any time.
            </li>
          </ul>
          <p>
            We do not use advertising or tracking cookies. No personal data is
            sold to third parties for marketing purposes.
          </p>

          <h2>8. Third-Party Services</h2>
          <p>
            We may share your personal data with the following categories of
            third-party service providers, who process data on our behalf:
          </p>
          <ul>
            <li>
              <strong>Email service providers</strong> (e.g., Resend) for
              sending transactional and order-related emails.
            </li>
            <li>
              <strong>Shipping carriers</strong> (e.g., Royal Mail, DPD) for
              order fulfilment and delivery tracking.
            </li>
            <li>
              <strong>Hosting and infrastructure providers</strong> for website
              hosting and data storage.
            </li>
            <li>
              <strong>Analytics providers</strong> for anonymised website usage
              analysis.
            </li>
          </ul>
          <p>
            All third-party processors are contractually obligated to handle
            your data securely and in compliance with UK GDPR. We do not sell
            your personal data to any third party.
          </p>

          <h2>9. Data Security</h2>
          <p>
            We implement appropriate technical and organisational measures to
            protect your personal data against unauthorised access, alteration,
            disclosure, or destruction. These measures include encryption of
            data in transit (SSL/TLS), access controls, and regular security
            reviews.
          </p>

          <h2>10. International Transfers</h2>
          <p>
            Where personal data is processed by third-party services located
            outside the UK, we ensure appropriate safeguards are in place, such
            as standard contractual clauses approved by the ICO, to protect your
            data to a standard consistent with UK GDPR.
          </p>

          <h2>11. Contact for Data Requests</h2>
          <p>
            For any questions regarding this Privacy Policy, or to exercise
            your data protection rights, please contact:
          </p>
          <p>
            <strong>31-32 Peptides</strong>
            <br />
            Email:{" "}
            <a
              href="mailto:info@31-32peptides.com"
              className="text-[#2563EB] underline hover:text-[#155d8a]"
            >
              info@31-32peptides.com
            </a>
          </p>
          <p>
            We aim to respond to all data protection enquiries within one
            calendar month.
          </p>
        </div>
      </section>
    </>
  );
}
