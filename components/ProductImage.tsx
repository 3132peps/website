"use client";

interface ProductImageProps {
  name: string;
  weight: string;
  format?: "vial" | "pen" | "nasal";
  className?: string;
}

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1).trimEnd() + "\u2026";
}

function VialSVG({ name, weight }: { name: string; weight: string }) {
  const displayName = truncateName(name, 20);
  return (
    <svg
      viewBox="0 0 200 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${name} vial illustration`}
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="vialBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A2439" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="vialBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e8edf0" />
          <stop offset="30%" stopColor="#f7f9fa" />
          <stop offset="70%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e5e8" />
        </linearGradient>
        <linearGradient id="vialCap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#15608c" />
        </linearGradient>
        <filter id="vialShadow" x="-20%" y="-5%" width="140%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1B2A3D" floodOpacity="0.1" />
        </filter>
        <clipPath id="labelClip">
          <rect x="68" y="110" width="64" height="80" rx="2" />
        </clipPath>
      </defs>

      {/* Background */}
      <rect width="200" height="260" fill="url(#vialBg)" />

      {/* Shadow ellipse */}
      <ellipse cx="100" cy="238" rx="32" ry="5" fill="#1B2A3D" opacity="0.08" />

      {/* Vial body */}
      <g filter="url(#vialShadow)">
        {/* Main cylinder */}
        <rect x="72" y="68" width="56" height="150" rx="4" fill="url(#vialBody)" stroke="#d0d5d8" strokeWidth="0.5" />
        {/* Rounded bottom */}
        <ellipse cx="100" cy="218" rx="28" ry="10" fill="url(#vialBody)" stroke="#d0d5d8" strokeWidth="0.5" />
        <rect x="72" y="208" width="56" height="12" fill="url(#vialBody)" />

        {/* Neck */}
        <rect x="88" y="48" width="24" height="22" rx="2" fill="#f0f2f3" stroke="#d0d5d8" strokeWidth="0.5" />

        {/* Cap / stopper */}
        <rect x="85" y="38" width="30" height="14" rx="3" fill="url(#vialCap)" />
        <rect x="90" y="34" width="20" height="6" rx="2" fill="#2563EB" />

        {/* Crimp ring */}
        <rect x="86" y="52" width="28" height="4" rx="1" fill="#c0c5c8" />
        <rect x="86" y="52" width="28" height="1" fill="#d8dde0" />

        {/* Label area */}
        <rect x="76" y="95" width="48" height="75" rx="3" fill="white" stroke="#c8cdd0" strokeWidth="0.5" />

        {/* Label top accent line */}
        <rect x="76" y="95" width="48" height="3" rx="1.5" fill="#2563EB" />

        {/* ELV8 brand text */}
        <text x="100" y="112" textAnchor="middle" fontSize="7" fontWeight="700" fill="#2563EB" fontFamily="system-ui, sans-serif" letterSpacing="1.5">
          ELV8
        </text>

        {/* Product name */}
        <text x="100" y="134" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#1B2A3D" fontFamily="system-ui, sans-serif">
          {displayName}
        </text>

        {/* Weight */}
        <text x="100" y="158" textAnchor="middle" fontSize="6" fontWeight="500" fill="#6b7280" fontFamily="system-ui, sans-serif">
          {weight}
        </text>

        {/* Liquid fill inside vial */}
        <rect x="74" y="175" width="52" height="35" fill="#2563EB" opacity="0.06" />
        <rect x="74" y="173" width="52" height="3" fill="#2563EB" opacity="0.1" rx="1" />

        {/* Glass shine highlight */}
        <rect x="78" y="70" width="6" height="140" rx="3" fill="white" opacity="0.4" />
      </g>
    </svg>
  );
}

function PenSVG({ name, weight }: { name: string; weight: string }) {
  const displayName = truncateName(name, 18);
  return (
    <svg
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${name} pen illustration`}
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="penBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A2439" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="penBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#15608c" />
        </linearGradient>
        <linearGradient id="penCap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#134f75" />
          <stop offset="100%" stopColor="#0e3d5c" />
        </linearGradient>
        <linearGradient id="boxGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5f7f9" />
          <stop offset="100%" stopColor="#e8ecef" />
        </linearGradient>
        <filter id="penShadow" x="-5%" y="-10%" width="110%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1B2A3D" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Background */}
      <rect width="280" height="200" fill="url(#penBg)" />

      {/* Packaging box behind pen (tilted) */}
      <g transform="translate(140, 130) rotate(-8)">
        <rect x="-65" y="-45" width="130" height="90" rx="5" fill="url(#boxGrad)" stroke="#c8cdd0" strokeWidth="0.8" />
        {/* Box brand */}
        <text x="0" y="-18" textAnchor="middle" fontSize="10" fontWeight="800" fill="#2563EB" fontFamily="system-ui, sans-serif" letterSpacing="2">
          ELV8
        </text>
        <text x="0" y="-5" textAnchor="middle" fontSize="6" fontWeight="500" fill="#6b7280" fontFamily="system-ui, sans-serif" letterSpacing="0.5">
          WELLNESS
        </text>
        {/* Box line accents */}
        <rect x="-50" y="5" width="100" height="0.5" fill="#2563EB" opacity="0.2" />
        <text x="0" y="18" textAnchor="middle" fontSize="6" fontWeight="500" fill="#6b7280" fontFamily="system-ui, sans-serif">
          {weight}
        </text>
      </g>

      {/* Shadow under pen */}
      <ellipse cx="140" cy="165" rx="90" ry="5" fill="#1B2A3D" opacity="0.06" />

      {/* Pen body */}
      <g filter="url(#penShadow)">
        {/* Main pen barrel */}
        <rect x="55" y="75" width="175" height="28" rx="14" fill="url(#penBody)" />

        {/* Plunger button (right end) */}
        <rect x="222" y="79" width="22" height="20" rx="10" fill="#134f75" />
        <circle cx="237" cy="89" r="4" fill="#2563EB" stroke="#0e3d5c" strokeWidth="0.5" />

        {/* Cap (left end) */}
        <rect x="30" y="77" width="32" height="24" rx="12" fill="url(#penCap)" />

        {/* Dose window */}
        <rect x="185" y="80" width="25" height="18" rx="3" fill="#f0f7fa" stroke="#134f75" strokeWidth="0.5" />
        <text x="197" y="93" textAnchor="middle" fontSize="7" fontWeight="700" fill="#1B2A3D" fontFamily="system-ui, sans-serif">
          0.5
        </text>

        {/* Pen body text */}
        <text x="128" y="84" textAnchor="middle" fontSize="5.5" fontWeight="600" fill="white" fontFamily="system-ui, sans-serif" opacity="0.6" letterSpacing="1.5">
          ELV8
        </text>
        <text x="128" y="96" textAnchor="middle" fontSize="7" fontWeight="700" fill="white" fontFamily="system-ui, sans-serif">
          {displayName}
        </text>

        {/* Shine highlight */}
        <rect x="60" y="77" width="160" height="5" rx="2.5" fill="white" opacity="0.2" />

        {/* Grip texture lines */}
        {[0, 6, 12, 18, 24].map((offset) => (
          <rect key={offset} x={75 + offset} y="97" width="1" height="4" rx="0.5" fill="white" opacity="0.15" />
        ))}
      </g>
    </svg>
  );
}

function NasalSVG({ name, weight }: { name: string; weight: string }) {
  const displayName = truncateName(name, 18);
  return (
    <svg
      viewBox="0 0 200 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${name} nasal spray illustration`}
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="nasalBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A2439" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="nasalBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e8edf0" />
          <stop offset="30%" stopColor="#f7f9fa" />
          <stop offset="70%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e5e8" />
        </linearGradient>
        <linearGradient id="nasalNozzle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#15608c" />
        </linearGradient>
        <filter id="nasalShadow" x="-20%" y="-5%" width="140%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1B2A3D" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Background */}
      <rect width="200" height="260" fill="url(#nasalBg)" />

      {/* Shadow */}
      <ellipse cx="100" cy="235" rx="35" ry="5" fill="#1B2A3D" opacity="0.08" />

      <g filter="url(#nasalShadow)">
        {/* Bottle body - wider and shorter than vial */}
        <rect x="65" y="100" width="70" height="120" rx="6" fill="url(#nasalBody)" stroke="#d0d5d8" strokeWidth="0.5" />
        {/* Rounded bottom */}
        <ellipse cx="100" cy="220" rx="35" ry="8" fill="url(#nasalBody)" stroke="#d0d5d8" strokeWidth="0.5" />
        <rect x="65" y="212" width="70" height="10" fill="url(#nasalBody)" />

        {/* Shoulder / neck transition */}
        <path d="M80 100 L80 88 Q80 82 86 82 L114 82 Q120 82 120 88 L120 100" fill="#f0f2f3" stroke="#d0d5d8" strokeWidth="0.5" />

        {/* Actuator base */}
        <rect x="86" y="72" width="28" height="12" rx="3" fill="url(#nasalNozzle)" />

        {/* Nozzle stem */}
        <rect x="95" y="52" width="10" height="22" rx="2" fill="url(#nasalNozzle)" />

        {/* Nozzle tip (angled spray tip) */}
        <path d="M96 52 L100 38 L104 52 Z" fill="#2563EB" />
        <ellipse cx="100" cy="52" rx="6" ry="2" fill="#15608c" />

        {/* Finger grips */}
        <rect x="75" y="75" width="14" height="6" rx="3" fill="#2563EB" opacity="0.8" />
        <rect x="111" y="75" width="14" height="6" rx="3" fill="#2563EB" opacity="0.8" />

        {/* Label area */}
        <rect x="72" y="115" width="56" height="70" rx="3" fill="white" stroke="#c8cdd0" strokeWidth="0.5" />

        {/* Label top accent */}
        <rect x="72" y="115" width="56" height="3" rx="1.5" fill="#2563EB" />

        {/* ELV8 brand */}
        <text x="100" y="132" textAnchor="middle" fontSize="7" fontWeight="700" fill="#2563EB" fontFamily="system-ui, sans-serif" letterSpacing="1.5">
          ELV8
        </text>

        {/* Product name */}
        <text x="100" y="152" textAnchor="middle" fontSize="6" fontWeight="700" fill="#1B2A3D" fontFamily="system-ui, sans-serif">
          {displayName}
        </text>

        {/* Weight */}
        <text x="100" y="172" textAnchor="middle" fontSize="5.5" fontWeight="500" fill="#6b7280" fontFamily="system-ui, sans-serif">
          {weight}
        </text>

        {/* Liquid fill */}
        <rect x="67" y="192" width="66" height="22" fill="#2563EB" opacity="0.06" />
        <rect x="67" y="190" width="66" height="3" fill="#2563EB" opacity="0.1" rx="1" />

        {/* Glass shine */}
        <rect x="72" y="102" width="5" height="108" rx="2.5" fill="white" opacity="0.35" />
      </g>
    </svg>
  );
}

export default function ProductImage({
  name,
  weight,
  format = "vial",
  className,
}: ProductImageProps) {
  return (
    <div className={className}>
      {format === "pen" ? (
        <PenSVG name={name} weight={weight} />
      ) : format === "nasal" ? (
        <NasalSVG name={name} weight={weight} />
      ) : (
        <VialSVG name={name} weight={weight} />
      )}
    </div>
  );
}
