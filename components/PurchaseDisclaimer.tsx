interface PurchaseDisclaimerProps {
  variant?: "light" | "dark";
  className?: string;
}

const ITEMS = [
  {
    title: "Research Use Only",
    body: "All products are exclusively sold for research purposes. They are not intended for human use, therapeutic, diagnostic, or clinical application.",
  },
  {
    title: "Not Medical Products",
    body: "None of the products listed on our website are medical products, nor should they be marketed or used as such.",
  },
  {
    title: "Compliance and Responsibility",
    body: "The buyer is responsible for ensuring compliance with all relevant laws and regulations. 31-32 Peptides holds no liability for misuse of products or any adverse outcomes.",
  },
];

export default function PurchaseDisclaimer({
  variant = "light",
  className = "",
}: PurchaseDisclaimerProps) {
  const isDark = variant === "dark";

  const headingClass = isDark ? "text-white" : "text-[#F5F7FB]";
  const bodyClass = isDark ? "text-gray-300" : "text-[#D4DBEC]";
  const itemTitleClass = isDark ? "text-white" : "text-[#F5F7FB]";
  const containerClass = isDark
    ? "border-white/10 bg-[#162436]"
    : "border-amber-200 bg-amber-50";

  return (
    <section
      className={`rounded-xl border p-6 sm:p-8 ${containerClass} ${className}`}
      aria-labelledby="purchase-disclaimer-heading"
    >
      <h2
        id="purchase-disclaimer-heading"
        className={`text-lg font-semibold ${headingClass}`}
      >
        Disclaimer for 31-32 Peptides Purchase
      </h2>
      <p className={`mt-2 text-sm leading-relaxed ${bodyClass}`}>
        By purchasing from 31-32 Peptides, you acknowledge and agree that:
      </p>

      <ul className="mt-4 space-y-3">
        {ITEMS.map((item) => (
          <li key={item.title} className="text-sm leading-relaxed">
            <span className={`font-semibold ${itemTitleClass}`}>
              {item.title}:
            </span>{" "}
            <span className={bodyClass}>{item.body}</span>
          </li>
        ))}
      </ul>

      <p className={`mt-4 text-sm leading-relaxed ${bodyClass}`}>
        Your purchase signifies your understanding and agreement to these
        terms.
      </p>
    </section>
  );
}
