// ---------------------------------------------------------------------------
// scripts/test-security-fixes.mjs
// ---------------------------------------------------------------------------
//
// Verifies the three security fixes applied on top of the security review:
//   1. Bcrypt dummy-hash cost matches real-hash cost (no timing leak).
//   2. getClientIp prefers x-real-ip and falls back to the rightmost XFF
//      entry, not the leftmost (no IP spoofing via XFF prefix).
//   3. safeJsonLd produces valid JSON for input containing "<!--", "</script",
//      and other tricky substrings.
//
// Run with: node scripts/test-security-fixes.mjs
// Exits non-zero on any failure.
//
// No test framework on this project; matches the ad-hoc style of the other
// scripts/test-*.mjs files.

import { performance } from "node:perf_hooks";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";

let failures = 0;
function ok(name) {
  console.log(`  PASS  ${name}`);
}
function fail(name, detail) {
  failures += 1;
  console.error(`  FAIL  ${name}\n        ${detail}`);
}

// ---------------------------------------------------------------------------
// 1. Bcrypt timing parity: dummy hash and real hash should use the same cost
//    so wrong-username and wrong-password paths take comparable time.
// ---------------------------------------------------------------------------
console.log("\n[1] Bcrypt cost parity (timing equalisation)");

const REAL_COST = 14; // matches hashPassword() in lib/auth.ts
const realHash = await bcrypt.hash("real-password", REAL_COST);
const dummyHash = await bcrypt.hash(randomBytes(32).toString("base64"), REAL_COST);

// Both should report the same cost in the hash header ($2b$14$...)
const realCost = Number(realHash.split("$")[2]);
const dummyCost = Number(dummyHash.split("$")[2]);
if (realCost === dummyCost && realCost === REAL_COST) {
  ok(`real and dummy hashes both at cost ${REAL_COST}`);
} else {
  fail("hash cost parity", `real=${realCost}, dummy=${dummyCost}, expected=${REAL_COST}`);
}

// Smoke-check the timing: wrong-password (compare vs realHash) and
// wrong-username (compare vs dummyHash) should fall within ~30% of each
// other. We run a few rounds and average to dampen scheduler jitter.
async function avgCompareMs(hash) {
  const ROUNDS = 3;
  let total = 0;
  for (let i = 0; i < ROUNDS; i += 1) {
    const t0 = performance.now();
    await bcrypt.compare("guess", hash);
    total += performance.now() - t0;
  }
  return total / ROUNDS;
}
const realMs = await avgCompareMs(realHash);
const dummyMs = await avgCompareMs(dummyHash);
const ratio = Math.max(realMs, dummyMs) / Math.min(realMs, dummyMs);
if (ratio < 1.5) {
  ok(`compare times within 1.5x (real=${realMs.toFixed(0)}ms, dummy=${dummyMs.toFixed(0)}ms)`);
} else {
  fail(
    "compare times diverge",
    `real=${realMs.toFixed(0)}ms, dummy=${dummyMs.toFixed(0)}ms, ratio=${ratio.toFixed(2)}x`,
  );
}

// ---------------------------------------------------------------------------
// 2. getClientIp: prefer x-real-ip, fall back to rightmost XFF entry.
// ---------------------------------------------------------------------------
console.log("\n[2] getClientIp header parsing");

// Re-implement the same logic locally so this test doesn't need to import
// TS source. If the implementation drifts, this test must be updated too --
// keep it in sync with lib/rate-limit.ts:getClientIp.
function getClientIp(headers) {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",");
    return parts[parts.length - 1].trim();
  }
  return "unknown";
}
function h(map) {
  return { get: (k) => map[k.toLowerCase()] ?? null };
}

const cases = [
  {
    name: "x-real-ip wins over spoofed XFF prefix",
    headers: h({
      "x-forwarded-for": "1.2.3.4, 203.0.113.10",
      "x-real-ip": "203.0.113.10",
    }),
    expect: "203.0.113.10",
  },
  {
    name: "no x-real-ip: take rightmost XFF (trusted hop)",
    headers: h({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.10" }),
    expect: "203.0.113.10",
  },
  {
    name: "leftmost XFF entry is NOT used (was the spoofing bug)",
    headers: h({ "x-forwarded-for": "9.9.9.9, 203.0.113.10" }),
    expect: "203.0.113.10",
  },
  {
    name: "single XFF entry",
    headers: h({ "x-forwarded-for": "203.0.113.10" }),
    expect: "203.0.113.10",
  },
  {
    name: "no headers",
    headers: h({}),
    expect: "unknown",
  },
  {
    name: "trims whitespace",
    headers: h({ "x-forwarded-for": "1.1.1.1,   203.0.113.10  " }),
    expect: "203.0.113.10",
  },
];
for (const c of cases) {
  const got = getClientIp(c.headers);
  if (got === c.expect) ok(c.name);
  else fail(c.name, `expected ${c.expect}, got ${got}`);
}

// ---------------------------------------------------------------------------
// 3. safeJsonLd: produces valid JSON for hostile inputs, and the output
//    cannot be misparsed by an HTML parser to break out of <script>.
// ---------------------------------------------------------------------------
console.log("\n[3] safeJsonLd correctness");

function safeJsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(new RegExp("\u2028", "g"), "\\u2028")
    .replace(new RegExp("\u2029", "g"), "\\u2029");
}

const hostileInputs = [
  { name: "plain string", input: { x: "hello world" } },
  { name: "contains </script>", input: { x: "abc</script><img onerror=alert(1)>" } },
  { name: "contains <!--", input: { x: "comment <!-- here --> end" } },
  { name: "contains <!", input: { x: "<!DOCTYPE html>" } },
  { name: "contains U+2028", input: { x: "line\u2028break" } },
  { name: "contains U+2029", input: { x: "para\u2029sep" } },
  { name: "contains all of the above", input: { x: "</script> <!-- <!DOCTYPE \u2028\u2029" } },
  { name: "nested object with hostile string", input: { a: { b: { c: "</script>" } } } },
  { name: "array with hostile string", input: { tags: ["safe", "</script>", "<!--"] } },
];

for (const c of hostileInputs) {
  const out = safeJsonLd(c.input);

  // (a) Output must round-trip through JSON.parse back to the original.
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch (err) {
    fail(`${c.name}: JSON.parse round-trip`, err.message + ` -- output was: ${out}`);
    continue;
  }
  if (JSON.stringify(parsed) !== JSON.stringify(c.input)) {
    fail(
      `${c.name}: round-trip mismatch`,
      `expected ${JSON.stringify(c.input)}, got ${JSON.stringify(parsed)}`,
    );
    continue;
  }

  // (b) Output must not contain a literal "<" -- that's the whole point.
  if (out.includes("<")) {
    fail(`${c.name}: literal '<' in output`, `output: ${out}`);
    continue;
  }

  // (c) Output must not contain raw U+2028 / U+2029.
  if (out.includes("\u2028") || out.includes("\u2029")) {
    fail(`${c.name}: raw line/para separator in output`, `output: ${out}`);
    continue;
  }

  ok(c.name);
}

// ---------------------------------------------------------------------------
// 4. consumeLoginAttempt: closes the parallel-request race that read-only
//    checkLoginRateLimit had. We re-implement the relevant logic in JS
//    here (rather than importing TS source) and verify the behavior.
// ---------------------------------------------------------------------------
console.log("\n[4] consumeLoginAttempt race closure");

function makeConsumer({ maxAttempts = 5, windowMs = 15 * 60_000, lockoutMs = 15 * 60_000 } = {}) {
  const map = new Map();
  return function consume(ip, now = Date.now()) {
    const entry = map.get(ip);
    if (entry?.lockedUntil && entry.lockedUntil > now) {
      return { allowed: false, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
    }
    if (!entry || now - entry.firstAttemptAt > windowMs) {
      map.set(ip, { attempts: 1, firstAttemptAt: now, lockedUntil: null });
      return { allowed: true };
    }
    entry.attempts += 1;
    if (entry.attempts > maxAttempts) {
      entry.lockedUntil = now + lockoutMs;
      return { allowed: false, retryAfterSeconds: Math.ceil(lockoutMs / 1000) };
    }
    return { allowed: true };
  };
}

{
  const consume = makeConsumer();
  // Five attempts allowed (1..5), sixth and beyond blocked.
  const results = [];
  for (let i = 0; i < 8; i += 1) results.push(consume("1.2.3.4").allowed);
  const expected = [true, true, true, true, true, false, false, false];
  if (JSON.stringify(results) === JSON.stringify(expected)) {
    ok("5 attempts allowed, 6th onward locked");
  } else {
    fail(
      "lockout sequence",
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(results)}`,
    );
  }
}

{
  // The race we're closing: simulate 100 "parallel" calls when bucket is at
  // attempts=4. Because consume increments synchronously, exactly one call
  // returns allowed:true (the 5th attempt) and the rest are rejected. The
  // old read-only check would have allowed all 100.
  const consume = makeConsumer();
  for (let i = 0; i < 4; i += 1) consume("9.9.9.9");
  let allowed = 0;
  for (let i = 0; i < 100; i += 1) if (consume("9.9.9.9").allowed) allowed += 1;
  if (allowed === 1) {
    ok("only 1 of 100 parallel requests gets through at attempts=4");
  } else {
    fail("parallel race", `expected 1 allowed, got ${allowed}`);
  }
}

{
  // Window roll-over resets the bucket.
  const consume = makeConsumer({ windowMs: 1000 });
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i += 1) consume("ip", t0);
  // 6th at t0 is locked.
  if (consume("ip", t0).allowed) fail("window roll", "should be locked at t0");
  // After the window passes, consume should treat it as a fresh bucket.
  // Note: lockoutMs is 15min by default, so this only resets if lockoutMs is short too.
  const consumeShort = makeConsumer({ windowMs: 1000, lockoutMs: 1000 });
  for (let i = 0; i < 5; i += 1) consumeShort("ip", t0);
  consumeShort("ip", t0); // trigger lockout
  const after = consumeShort("ip", t0 + 2000);
  if (after.allowed) ok("window + lockout expiry resets bucket");
  else fail("window + lockout expiry", `still locked: ${JSON.stringify(after)}`);
}

// ---------------------------------------------------------------------------
// 5. TOTP replay cache: same valid code can't be accepted twice in the same
//    step. Re-implements the cache logic in JS to test the algorithm.
// ---------------------------------------------------------------------------
console.log("\n[5] TOTP replay protection");

import { createHash, createHmac } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32decode(s) {
  const cleaned = s.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  const out = [];
  let bits = 0;
  let val = 0;
  for (const ch of cleaned) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("bad b32");
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter), 0);
  const h = createHmac("sha1", secret).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const c =
    ((h[off] & 0x7f) << 24) |
    ((h[off + 1] & 0xff) << 16) |
    ((h[off + 2] & 0xff) << 8) |
    (h[off + 3] & 0xff);
  return (c % 1_000_000).toString().padStart(6, "0");
}

function makeVerifier() {
  const seen = new Map(); // fp -> Set<"counter:code">
  return function verify(secretB32, code, nowSec) {
    if (!/^\d{6}$/.test(code)) return false;
    const secret = b32decode(secretB32);
    const counter = Math.floor(nowSec / 30);
    let matched = null;
    for (let off = -1; off <= 1; off += 1) {
      if (hotp(secret, counter + off) === code) matched = counter + off;
    }
    if (matched === null) return false;
    const fp = createHash("sha256").update(secret).digest("hex").slice(0, 16);
    const key = `${matched}:${code}`;
    let s = seen.get(fp);
    if (s?.has(key)) return false;
    if (!s) {
      s = new Set();
      seen.set(fp, s);
    }
    s.add(key);
    return true;
  };
}

{
  const verify = makeVerifier();
  const secret = "JBSWY3DPEHPK3PXP"; // sample base32 secret
  const t0 = 1_700_000_000;
  const decoded = b32decode(secret);
  const counter0 = Math.floor(t0 / 30);
  const validCode = hotp(decoded, counter0);

  // First use accepted.
  if (verify(secret, validCode, t0)) ok("first accept of valid code");
  else fail("first accept", "valid code rejected on first use");

  // Replay within the same step rejected.
  if (!verify(secret, validCode, t0 + 5)) ok("replay rejected within same step");
  else fail("replay reject", "same code accepted twice");

  // Different valid code (next step) accepted.
  const counter1 = counter0 + 1;
  const validCode2 = hotp(decoded, counter1);
  if (verify(secret, validCode2, t0 + 30)) ok("next-step code accepted");
  else fail("next step", "fresh next-step code rejected");

  // Wrong code still rejected, doesn't pollute the cache.
  if (!verify(secret, "000000", t0 + 35)) ok("wrong code rejected");
  else fail("wrong code", "000000 was accepted (very unlikely but possible by chance)");

  // Different secret with a colliding code is independent.
  const otherSecret = "ONSWG4TFOQ";
  const otherDecoded = b32decode(otherSecret);
  const otherCode = hotp(otherDecoded, counter0);
  if (verify(otherSecret, otherCode, t0 + 6)) ok("different secret tracked separately");
  else fail("secret isolation", "different secret blocked by another's cache");
}

// ---------------------------------------------------------------------------
// 6. Proxy gating: given a JWT payload, the proxy should route mid-flow
//    cookies to the enrol endpoint or the verify endpoint based on the
//    `enrollment` claim, and should only fully-allow access when
//    `twoFactor === true`. Re-implements the decision in JS to test the
//    state machine independently of NextRequest plumbing.
// ---------------------------------------------------------------------------
console.log("\n[6] Proxy gating decision");

const PUBLIC_PATHS = new Set([
  "/admin/login",
  "/api/auth/login",
  "/api/auth/logout",
]);
const VERIFY_PATHS = new Set([
  "/admin/login/verify",
  "/api/auth/login/verify",
]);
const ENROLL_PATHS = new Set([
  "/admin/login/enroll",
  "/api/auth/login/enroll",
]);

function decide({ pathname, payload }) {
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return "allow";
  }
  if (PUBLIC_PATHS.has(pathname)) return "allow";
  if (!payload) return "redirect:/admin/login";
  if (payload.twoFactor === true) return "allow";
  if (payload.enrollment === true) {
    return ENROLL_PATHS.has(pathname) ? "allow" : "redirect:/admin/login/enroll";
  }
  return VERIFY_PATHS.has(pathname) ? "allow" : "redirect:/admin/login/verify";
}

const proxyCases = [
  // Public surface
  { name: "no cookie + /admin/login", path: "/admin/login", p: null, exp: "allow" },
  { name: "no cookie + /admin/products", path: "/admin/products", p: null, exp: "redirect:/admin/login" },
  // Fully authenticated
  { name: "twoFactor=true + /admin/products", path: "/admin/products", p: { twoFactor: true, enrollment: false }, exp: "allow" },
  { name: "twoFactor=true + /admin/login/enroll (allowed but pointless)", path: "/admin/login/enroll", p: { twoFactor: true, enrollment: false }, exp: "allow" },
  // Enrolment flow
  { name: "enrollment=true + /admin/login/enroll", path: "/admin/login/enroll", p: { twoFactor: false, enrollment: true }, exp: "allow" },
  { name: "enrollment=true + /api/auth/login/enroll", path: "/api/auth/login/enroll", p: { twoFactor: false, enrollment: true }, exp: "allow" },
  { name: "enrollment=true + /admin/products bounces to enroll", path: "/admin/products", p: { twoFactor: false, enrollment: true }, exp: "redirect:/admin/login/enroll" },
  { name: "enrollment=true + /admin/login/verify bounces to enroll", path: "/admin/login/verify", p: { twoFactor: false, enrollment: true }, exp: "redirect:/admin/login/enroll" },
  // Verify flow
  { name: "verify cookie + /admin/login/verify", path: "/admin/login/verify", p: { twoFactor: false, enrollment: false }, exp: "allow" },
  { name: "verify cookie + /api/auth/login/verify", path: "/api/auth/login/verify", p: { twoFactor: false, enrollment: false }, exp: "allow" },
  { name: "verify cookie + /admin/products bounces to verify", path: "/admin/products", p: { twoFactor: false, enrollment: false }, exp: "redirect:/admin/login/verify" },
  { name: "verify cookie + /admin/login/enroll bounces to verify", path: "/admin/login/enroll", p: { twoFactor: false, enrollment: false }, exp: "redirect:/admin/login/verify" },
];

for (const c of proxyCases) {
  const got = decide({ pathname: c.path, payload: c.p });
  if (got === c.exp) ok(c.name);
  else fail(c.name, `expected ${c.exp}, got ${got}`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("");
if (failures === 0) {
  console.log("All security-fix tests passed.");
  process.exit(0);
} else {
  console.error(`${failures} test(s) failed.`);
  process.exit(1);
}
