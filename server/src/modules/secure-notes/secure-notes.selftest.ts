// Loaded here rather than relying on a transitive import: this file
// deliberately touches nothing but the crypto, so it pulls in no module
// that would have read .env on its way past.
import "dotenv/config";

import { open, seal, vaultIsConfigured } from "../../utils/secureBox.js";

/**
 * Proves the vault's sealing does what its comments claim.
 *
 * Run with `npm run vault:check`. Exits non-zero on any failure, so it can
 * gate a deploy — a vault whose encryption is quietly broken is worse than no
 * vault, because someone is trusting it with their bank password.
 *
 * Nothing here touches the database. It is the crypto that is being checked,
 * and the crypto is the whole claim.
 */

let failures = 0;

function check(what: string, passed: boolean, detail = "") {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${what}${detail ? `   ${detail}` : ""}`);
  if (!passed) failures += 1;
}

function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const SECRET = 'HDFC net banking / Tr0ub4dor&3 — "quotes", \\slashes\\, emoji 🔐, ऱाष्ट्रीय';

if (!vaultIsConfigured()) {
  console.log(
    "\nNOTES_ENCRYPTION_KEY is not set, so there is nothing to check.\n" +
      "Generate one with:\n" +
      "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"\n",
  );
  process.exit(1);
}

console.log("\n1. A sealed value comes back exactly as it went in");
const sealed = seal(SECRET, OWNER);
check("round trips", open(sealed, OWNER) === SECRET);
check(
  "survives unicode, quotes and backslashes",
  open(seal(SECRET, OWNER), OWNER) === SECRET,
);
check("an empty string is still a value", open(seal("", OWNER), OWNER) === "");

console.log("\n2. Nothing readable is left in the sealed form");
const plainWords = ["HDFC", "banking", "Tr0ub4dor", "quotes", "slashes"];
check(
  "no plaintext word appears in the ciphertext",
  !plainWords.some((w) => sealed.toLowerCase().includes(w.toLowerCase())),
  `(${sealed.slice(0, 24)}…)`,
);
check("carries its version", sealed.startsWith("v1."));

console.log("\n3. The same text sealed twice looks different");
// Deterministic ciphertext would mean two accounts using the same password
// produce the same row — visible to anyone reading the table.
const a = seal("same password", OWNER);
const b = seal("same password", OWNER);
check("two seals of one value differ", a !== b);
check("and both still open", open(a, OWNER) === "same password" && open(b, OWNER) === "same password");

console.log("\n4. It refuses anything that is not exactly what we wrote");
check("a flipped byte in the ciphertext is refused", throws(() => {
  const parts = sealed.split(".");
  const body = Buffer.from(parts[3], "base64");
  body[0] ^= 0x01;
  return open([parts[0], parts[1], parts[2], body.toString("base64")].join("."), OWNER);
}));

check("a swapped authentication tag is refused", throws(() => {
  const parts = sealed.split(".");
  const otherTag = seal("anything", OWNER).split(".")[2];
  return open([parts[0], parts[1], otherTag, parts[3]].join("."), OWNER);
}));

check("a truncated value is refused", throws(() => open(sealed.slice(0, -8), OWNER)));
check("a value in an unknown format is refused", throws(() => open("not-a-sealed-value", OWNER)));

console.log("\n5. A row moved to another account will not open");
// This is the AAD doing its job: the owner id is bound to the ciphertext, so
// somebody with write access to the table cannot re-point a row at their own
// account and read it.
check("sealed for one owner, opened as another", throws(() => open(sealed, OTHER)));
check("still opens for its real owner", open(sealed, OWNER) === SECRET);

console.log(failures === 0 ? "\nALL PASSED\n" : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
