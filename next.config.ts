import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
//
// Applied to every page response (excluding _next/static which is already
// hashed + immutable, and api routes which don't need framing protection).
// CSP is intentionally NOT report-only -- we want the browser to enforce it.
//
// Notes on the policy:
//   - 'unsafe-inline' on scripts is required because Next 16 emits inline
//     bootstrap chunks and we use <script type="application/ld+json"> on
//     several pages. We mitigate the inline-script risk by escaping all
//     JSON-LD payloads via lib/sanitize.ts:safeJsonLd().
//   - 'unsafe-inline' on styles is required for Tailwind's runtime style
//     blocks and for CSS-in-JS style attributes Next emits.
//   - img-src includes data: for the QR-style placeholder images and the
//     blob.vercel-storage.com host for admin-uploaded product photos.
//   - connect-src includes the Vercel analytics endpoint plus self.
//   - frame-ancestors 'none' replaces X-Frame-Options for clickjacking.

// React's dev mode uses eval() to reconstruct call stacks across server /
// client boundaries. Production React never calls eval, so we only loosen
// the directive when NODE_ENV says so.
const SCRIPT_SRC =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  SCRIPT_SRC,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
];

const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: CSP_DIRECTIVES.join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // Lock down powerful APIs we don't use. The empty `()` parens disable
    // the feature entirely; any third-party (e.g. an embedded YouTube)
    // would need to be added explicitly.
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "picture-in-picture=()",
      "publickey-credentials-get=(self)",
      "screen-wake-lock=()",
      "sync-xhr=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
];

const HTML_CACHE_HEADERS = [
  {
    key: "Cache-Control",
    value: "public, max-age=0, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project so it ignores the stray
  // package-lock.json in the home directory, which otherwise causes module
  // resolution (tailwindcss, etc.) to fail with "Can't resolve" errors.
  turbopack: {
    root: process.cwd(),
  },

  // ---- Image hosts -----------------------------------------------------
  //
  // Product photos uploaded via the admin form land in Vercel Blob and are
  // served from `<store-id>.public.blob.vercel-storage.com`. The Next.js
  // <Image> component requires every external host to be allow-listed via
  // `images.remotePatterns` -- without this, uploaded images would 400.
  // The pattern below covers any Blob store under our project; the
  // unguessable store ID still functions as the access boundary, since the
  // upload endpoint is admin-only.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },

  // ---- Cache + security headers ---------------------------------------
  //
  // Browsers (and intermediate CDNs) were hanging on to old HTML shells
  // after deploys, so users who had the site open were still running the
  // previous build's JavaScript. We force HTML responses to always
  // revalidate with the origin. The hashed /_next/static/* assets already
  // get long immutable caching from Next.js by default so we leave those
  // alone.
  //
  // Security headers go on every non-asset path. We do NOT set them on
  // /api routes -- API responses are JSON, not framed/rendered, and CSP
  // can interfere with response bodies.
  async headers() {
    return [
      {
        source: "/:path((?!_next|api|favicon|sitemap|robots|images|docs).*)",
        headers: [...SECURITY_HEADERS, ...HTML_CACHE_HEADERS],
      },
      {
        source: "/",
        headers: [...SECURITY_HEADERS, ...HTML_CACHE_HEADERS],
      },
    ];
  },

  // ---- Legacy guide URL redirects -------------------------------------
  //
  // Pre-existing guides shipped on /guides/<slug> before the canonical
  // /guides/<type>/<slug> URL was introduced. Each entry below 308's the
  // legacy URL to its new home so external links + indexed pages keep
  // working. When new published guides are added in the future they go
  // straight to the canonical URL -- this list is only for the original
  // three.
  async redirects() {
    return [
      {
        source: "/guides/what-are-research-peptides",
        destination: "/guides/methodology/what-are-research-peptides",
        permanent: true,
      },
      {
        source: "/guides/how-to-reconstitute-peptides",
        destination: "/guides/reconstitution/how-to-reconstitute-peptides",
        permanent: true,
      },
      {
        source: "/guides/understanding-certificates-of-analysis",
        destination:
          "/guides/methodology/understanding-certificates-of-analysis",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
