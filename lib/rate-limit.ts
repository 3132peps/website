// ---------------------------------------------------------------------------
// 31-32 Peptides -- shared in-memory rate limiter for public endpoints
// ---------------------------------------------------------------------------
//
// Used by /api/contact, /api/order, /api/discount/validate to slow down
// abuse (spam, basket flooding, discount-code guessing). Like the admin
// login limiter in lib/auth.ts, this is per-instance memory -- not perfect
// across Vercel's autoscaling cold starts, but good enough to deter casual
// scripted abuse without standing up a Redis dependency.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

interface Limiter {
  windowMs: number;
  max: number;
  buckets: Map<string, Bucket>;
}

const limiters = new Map<string, Limiter>();

function getLimiter(name: string, windowMs: number, max: number): Limiter {
  let l = limiters.get(name);
  if (!l) {
    l = { windowMs, max, buckets: new Map() };
    limiters.set(name, l);
  }
  return l;
}

function pruneBuckets(l: Limiter, now: number) {
  // Cap memory growth -- drop entries whose window has expired.
  for (const [k, b] of l.buckets) {
    if (b.resetAt < now) l.buckets.delete(k);
  }
}

export interface RateLimitConfig {
  /** Logical name (e.g. "contact", "order") -- separates buckets by route. */
  name: string;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests per IP within the window. */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function rateLimit(
  ip: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const l = getLimiter(config.name, config.windowMs, config.max);
  // Cheap periodic prune -- only when the bucket map grows past a small
  // threshold, so we don't iterate it on every hit.
  if (l.buckets.size > 1024) pruneBuckets(l, now);

  const entry = l.buckets.get(ip);
  if (!entry || entry.resetAt <= now) {
    l.buckets.set(ip, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true };
  }
  if (entry.count >= config.max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  entry.count += 1;
  return { allowed: true };
}

/**
 * Pulls the originating client IP from request headers.
 *
 * On Vercel the trustworthy header is `x-real-ip`, set by the edge to the
 * actual TCP peer. `x-forwarded-for` may contain client-supplied entries
 * appended on the left, so taking `xff.split(",")[0]` lets an attacker
 * spoof their IP and bypass per-IP rate limits. We prefer `x-real-ip`,
 * and when falling back to `x-forwarded-for` we take the *rightmost* hop
 * (the IP nearest to our trusted edge), not the leftmost.
 */
export function getClientIp(request: NextRequest | Request): string {
  const headers =
    "headers" in request ? (request as Request).headers : (request as NextRequest).headers;
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",");
    return parts[parts.length - 1]!.trim();
  }
  return "unknown";
}

/**
 * Convenience: applies rate limiting and returns a 429 NextResponse if the
 * caller is over the limit, or null to let the route continue. Lets each
 * route stay a one-liner at the top of its handler.
 */
export function enforceRateLimit(
  request: NextRequest | Request,
  config: RateLimitConfig,
): NextResponse | null {
  const ip = getClientIp(request);
  const result = rateLimit(ip, config);
  if (result.allowed) return null;
  return NextResponse.json(
    {
      success: false,
      error: "Too many requests. Please slow down and try again shortly.",
    },
    {
      status: 429,
      headers: result.retryAfterSeconds
        ? { "Retry-After": String(result.retryAfterSeconds) }
        : undefined,
    },
  );
}
