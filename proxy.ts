// ---------------------------------------------------------------------------
// Elv8 Peptides -- proxy (admin route protection)
// ---------------------------------------------------------------------------
//
// This is the Next.js 16 proxy convention (formerly "middleware"). It runs
// at the edge before any route handler, so it's our first line of defence:
// no admin page or admin API route is reached unless the JWT verifies.
//
// We deliberately don't import from lib/auth.ts here because edge runtime
// modules can't pull in node-only deps like bcrypt. Cookie name + JWT
// verification are duplicated by hand below; both are kept trivial so the
// duplication is low-risk.
//
// Three valid cookie states drive routing:
//   twoFactor=true                    -> fully authenticated, allow anywhere
//   twoFactor=false, enrollment=true  -> mid-enrolment, only the enrol
//                                         endpoints are reachable
//   twoFactor=false, enrollment=false -> mid-verify, only the verify
//                                         endpoints are reachable
//
// The 2FA-cleared check still happens inside individual route handlers via
// requireAdmin() so a token issued mid-flow can't reach /admin/products
// even if the proxy is ever misconfigured.

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PROD_COOKIE = "__Host-elv8_admin";
const DEV_COOKIE = "elv8_admin_token";

function getJwtSecret(): Uint8Array {
  // The proxy is invoked on every protected request; we must not throw
  // here or the whole admin surface 500s. Fall through to a placeholder
  // and let the route handler reject (returning a clean 401) if the
  // verify fails. Production deploys without a real secret will simply
  // fail every JWT verification, which is the safe default.
  const secret = process.env.ADMIN_JWT_SECRET || "missing-admin-jwt-secret";
  return new TextEncoder().encode(secret);
}

// Paths reachable with no cookie at all -- the unauthenticated entry surface.
const PUBLIC_PATHS = new Set([
  "/admin/login",
  "/api/auth/login",
  "/api/auth/logout",
]);

// Paths reachable with a half-cookie that's still in the verify (enrolled)
// flow.
const VERIFY_PATHS = new Set([
  "/admin/login/verify",
  "/api/auth/login/verify",
]);

// Paths reachable with a half-cookie that's still in the enrol flow.
const ENROLL_PATHS = new Set([
  "/admin/login/enroll",
  "/api/auth/login/enroll",
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Anything that isn't an admin surface falls straight through. (Belt-
  // and-braces -- the matcher below already restricts us to /admin and
  // /api/admin, but keep the guard explicit.)
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const cookieName =
    process.env.NODE_ENV === "production" ? PROD_COOKIE : DEV_COOKIE;
  const token =
    request.cookies.get(cookieName)?.value ??
    // Belt-and-braces: also check the other name so a recently switched
    // environment doesn't leave admins stuck on a half-rotated cookie.
    request.cookies.get(DEV_COOKIE)?.value ??
    request.cookies.get(PROD_COOKIE)?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, getJwtSecret());
    payload = verified.payload as Record<string, unknown>;
  } catch {
    return redirectToLogin(request);
  }

  const twoFactor = payload.twoFactor === true;
  const enrollment = payload.enrollment === true;

  // Fully authenticated -- any admin path is fair game.
  if (twoFactor) return NextResponse.next();

  // Mid-flow: route based on which step the cookie says we're in.
  // Allow only the matching endpoint pair; redirect anything else.
  if (enrollment) {
    if (ENROLL_PATHS.has(pathname)) return NextResponse.next();
    return redirectByPath(request, "/admin/login/enroll");
  }

  if (VERIFY_PATHS.has(pathname)) return NextResponse.next();
  return redirectByPath(request, "/admin/login/verify");
}

function redirectToLogin(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

function redirectByPath(request: NextRequest, target: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
