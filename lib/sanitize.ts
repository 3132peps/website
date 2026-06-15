// ---------------------------------------------------------------------------
// 31-32 Peptides -- shared input sanitization helpers
// ---------------------------------------------------------------------------
//
// These run on the server-side admin write path (lib/products-validation.ts)
// and on the JSON-LD render path (app/products/[slug]/page.tsx). Goals:
//
//   - Length caps so a hostile or careless admin can't blow up the DB / DOM.
//   - URL validation so coaUrl / images[] can't carry "javascript:" or
//     "data:" payloads. React strips most of these but we don't rely on it.
//   - Safe JSON for inline <script type="application/ld+json"> tags so a
//     description containing "</script>" can't break out of the script
//     element and inject HTML.

// ---------------------------------------------------------------------------
// String length caps -- long enough to cover real content, tight enough to
// keep DB rows sensible and prevent storage-as-exfiltration tricks.
// ---------------------------------------------------------------------------

export const FIELD_LIMITS = {
  slug: 120,
  name: 200,
  category: 80,
  description: 8_000,
  researchContext: 16_000,
  purity: 60,
  coaUrl: 500,
  storageInstructions: 500,
  molecularWeight: 80,
  sequence: 2_000,
  bulkDeal: 200,
  tag: 60,
  imageUrl: 500,
} as const;

export type FieldLimit = keyof typeof FIELD_LIMITS;

/**
 * Strips unsafe control characters (NUL, line/paragraph separators that
 * survive JSON encoding) without touching legitimate whitespace. We don't
 * try to scrub HTML tags here -- React escapes those at render time -- but
 * removing C0 controls keeps the DB clean and prevents log-injection tricks.
 */
export function stripControlChars(value: string): string {
  // Allow \t \n \r; strip everything else in C0 plus DEL.
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/** Bounds a string to a known field limit and strips control chars. */
export function boundedString(value: string, field: FieldLimit): string {
  const cleaned = stripControlChars(value);
  const max = FIELD_LIMITS[field];
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/**
 * Allow-list of URL schemes/hosts we accept for product image fields.
 * The admin can paste:
 *   - an https URL on Vercel Blob (uploaded via /api/admin/upload-image);
 *   - a relative path under /images/ for legacy bundled assets.
 *
 * Anything else (javascript:, data:, vbscript:, file:, ftp:) is rejected.
 */
export interface UrlPolicy {
  /** Allow http URLs. Default: false (https only). */
  allowHttp?: boolean;
  /** Allow protocol-relative paths starting with `/`. Default: true. */
  allowRelative?: boolean;
  /** If set, the URL's host must match one of these (case-insensitive). */
  allowedHosts?: string[];
}

/**
 * Returns the input string if it parses as a safe URL under the policy,
 * otherwise null. The caller decides whether to reject the request or
 * fall back to a default.
 */
export function safeUrl(value: string, policy: UrlPolicy = {}): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Relative path under /images/... or other site-internal locations.
  if (trimmed.startsWith("/")) {
    if (policy.allowRelative === false) return null;
    // Reject protocol-relative URLs ("//evil.example/...") which the URL
    // parser would happily accept.
    if (trimmed.startsWith("//")) return null;
    // Block control chars and obvious tag-breakers.
    if (/[ -"<>\\]/.test(trimmed)) return null;
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol === "https:") {
    // ok
  } else if (protocol === "http:") {
    if (!policy.allowHttp) return null;
  } else {
    // Blocks javascript:, data:, vbscript:, file:, ftp:, mailto:, etc.
    return null;
  }

  if (policy.allowedHosts && policy.allowedHosts.length > 0) {
    const host = parsed.hostname.toLowerCase();
    const matches = policy.allowedHosts.some((allowed) => {
      const a = allowed.toLowerCase();
      if (a.startsWith("*.")) {
        const suffix = a.slice(1); // ".example.com"
        return host.endsWith(suffix) || host === suffix.slice(1);
      }
      return host === a;
    });
    if (!matches) return null;
  }

  return parsed.toString();
}

// ---------------------------------------------------------------------------
// JSON-LD safe encoding
// ---------------------------------------------------------------------------
//
// The inline <script type="application/ld+json"> tag is parsed by the HTML
// parser, not the JSON parser, so any "</" sequence in the JSON ends the
// script tag and turns the rest of the JSON into HTML. JSON.stringify does
// not escape these by default. We do it ourselves on the way out.

/**
 * Returns a JSON string that is safe to embed verbatim in a <script> body.
 *
 * - Every "<" becomes its JSON unicode escape "\u003C". The HTML parser
 *   sees a literal backslash-u-zero-zero-three-c sequence and won't end
 *   the script tag or open a comment; the JSON parser turns it back into
 *   "<" on the way in. This single rule covers "</script", "<!--", and
 *   "<!" without producing the invalid "\!" escape the previous version
 *   emitted (which broke JSON-LD parsing for any input containing "<!--").
 * - U+2028 / U+2029 become \u-escapes (they're legal in JSON, not in JS,
 *   and matter if a tool ever evals this string instead of parsing it).
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(new RegExp("\u2028", "g"), "\\u2028")
    .replace(new RegExp("\u2029", "g"), "\\u2029");
}
