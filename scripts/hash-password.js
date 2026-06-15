#!/usr/bin/env node
// Usage: node scripts/hash-password.js <password>
// Outputs a bcrypt hash to paste into .env.local as ADMIN_PASSWORD_HASH

const bcrypt = require("bcrypt");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>");
  process.exit(1);
}

bcrypt.hash(password, 14).then((hash) => {
  const escaped = hash.replace(/\$/g, "\\$");
  console.log("\nYour password hash:\n");
  console.log(`ADMIN_PASSWORD_HASH=${escaped}`);
  console.log("\nPaste the line above into .env.local\n");
});
