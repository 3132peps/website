interface DisclaimerBannerProps {
  text?: string;
}

const DEFAULT_TEXT =
  "This product is supplied for in-vitro laboratory research only. Not for human consumption, medical treatment, or cosmetic use.";

export default function DisclaimerBanner({
  text = DEFAULT_TEXT,
}: DisclaimerBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {/* Warning triangle icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0 text-amber-500"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}
