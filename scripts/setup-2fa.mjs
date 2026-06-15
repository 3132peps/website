#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/setup-2fa.mjs
// ---------------------------------------------------------------------------
//
// One-shot setup helper for admin TOTP. Generates a fresh 20-byte secret,
// prints:
//   - the base32 secret to paste into .env.local as ADMIN_TOTP_SECRET
//   - an otpauth:// URI ready for any QR-code generator
//   - a quick-link to a Google Charts QR if you'd rather scan one in the
//     browser (note: this sends the URI to a third party, only do it on a
//     trusted machine)
//
// After pasting the secret into .env.local (and setting it in Vercel for
// production), restart your dev server and you'll be prompted for a TOTP
// code at /admin/login.

import { randomBytes } from "node:crypto";

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return out;
}

const secret = base32Encode(randomBytes(20));
const issuer = "Elv8 Wellness";
const account = process.env.ADMIN_EMAIL || "admin";

const uri =
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
  `?secret=${secret}&issuer=${encodeURIComponent(issuer)}` +
  `&algorithm=SHA1&digits=6&period=30`;

console.log("\n=== Elv8 admin 2FA setup ===\n");
console.log("Add this line to .env.local:\n");
console.log(`ADMIN_TOTP_SECRET=${secret}\n`);
console.log("Then:\n");
console.log(" 1. Open Google Authenticator (or 1Password / Authy)");
console.log(" 2. Add account → Scan QR code or enter manually:");
console.log(`      Secret: ${secret}`);
console.log(`      Account: ${account}`);
console.log(`      Issuer: ${issuer}`);
console.log("\nOR scan the URI below with any QR generator:\n");
console.log(`  ${uri}\n`);
console.log("Once 2FA is set up:");
console.log(" - keep this secret safe (anyone with it can mint codes)");
console.log(" - if you lose your phone, regenerate a new secret with this");
console.log("   script and update ADMIN_TOTP_SECRET in Vercel + .env.local");
console.log(" - to disable 2FA entirely, delete ADMIN_TOTP_SECRET");
console.log("\nDon't forget to set ADMIN_TOTP_SECRET in Vercel too.\n");
