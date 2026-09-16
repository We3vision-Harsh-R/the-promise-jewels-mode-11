import "dotenv/config";

import { prisma } from "../database/prisma.js";
import { decryptField, encryptField, fieldCryptoReady, isEncrypted, rowAad } from "../utils/fieldCrypto.js";
import { vaultIsConfigured } from "../utils/secureBox.js";

/**
 * Checks the things that are supposed to be true about this deployment, and
 * exits non-zero when they are not.
 *
 * Run with `npm run security:check`. Meant for a deploy gate: every item here
 * is something that was true when it was built and could quietly stop being
 * true — a key removed from the environment, a table added without RLS, a
 * migration that reintroduced a plaintext column.
 *
 * It checks the LIVE database and the LIVE environment, not the source. A
 * source file cannot tell you that production is missing a key.
 */

let failures = 0;
let warnings = 0;

function pass(what: string, detail = "") {
  console.log(`  PASS  ${what}${detail ? `   ${detail}` : ""}`);
}

function fail(what: string, detail = "") {
  console.log(`  FAIL  ${what}${detail ? `   ${detail}` : ""}`);
  failures += 1;
}

function warn(what: string, detail = "") {
  console.log(`  WARN  ${what}${detail ? `   ${detail}` : ""}`);
  warnings += 1;
}

async function main() {
  console.log("\nSecurity check\n");

  // ---- 1. Keys ----
  console.log("1. Encryption keys");

  vaultIsConfigured() ? pass("vault key present") : fail("NOTES_ENCRYPTION_KEY missing");
  fieldCryptoReady() ? pass("field key present") : fail("DATA_ENCRYPTION_KEY missing");

  const notes = process.env.NOTES_ENCRYPTION_KEY;
  const data = process.env.DATA_ENCRYPTION_KEY;

  if (notes && data && notes === data) {
    fail("the two keys are identical", "one leak would be both");
  } else if (notes && data) {
    pass("the two keys differ");
  }

  // A round trip, so a key that is present but wrong is caught here rather
  // than the first time a customer submits the contact form.
  if (fieldCryptoReady()) {
    const aad = rowAad("selftest", "1");
    const sealed = encryptField("check", aad);
    decryptField(sealed, aad) === "check"
      ? pass("field encryption round trips")
      : fail("field encryption does not round trip");

    let rejected = false;
    try {
      decryptField(sealed, rowAad("selftest", "2"));
    } catch {
      rejected = true;
    }
    rejected
      ? pass("a value moved to another row is refused")
      : fail("a value moved to another row still opens");
  }

  // ---- 2. Personal data at rest ----
  console.log("\n2. Personal data at rest");

  const inquiries = await prisma.inquiries.findMany({
    select: { id: true, name: true, email: true, phone: true },
  });

  const plainInquiries = inquiries.filter(
    (row) => row.name !== null && !isEncrypted(row.name),
  );

  inquiries.length === 0
    ? pass("no enquiries yet", "(nothing to check)")
    : plainInquiries.length === 0
      ? pass(`all ${inquiries.length} enquiries encrypted`)
      : fail(
          `${plainInquiries.length} of ${inquiries.length} enquiries are plaintext`,
          "run: npm run security:harden",
        );

  const leads = await prisma.exhibitionLead.findMany({ select: { id: true, name: true } });
  const plainLeads = leads.filter((row) => row.name !== null && !isEncrypted(row.name));

  leads.length === 0
    ? pass("no exhibition leads yet", "(nothing to check)")
    : plainLeads.length === 0
      ? pass(`all ${leads.length} leads encrypted`)
      : fail(`${plainLeads.length} of ${leads.length} leads are plaintext`, "run: npm run security:harden");

  const notesRows = await prisma.secureNote.findMany({ select: { payload: true } });
  const plainNotes = notesRows.filter((row) => !row.payload.startsWith("v1."));
  plainNotes.length === 0
    ? pass(`all ${notesRows.length} vault entries sealed`)
    : fail(`${plainNotes.length} vault entries are not sealed`);

  // ---- 3. Credentials ----
  console.log("\n3. Stored credentials");

  const users = await prisma.user.findMany({
    select: { password: true, refreshTokenHash: true, otpCode: true },
  });

  const weakPasswords = users.filter((u) => !u.password?.startsWith("$2"));
  weakPasswords.length === 0
    ? pass(`all ${users.length} passwords hashed`)
    : fail(`${weakPasswords.length} passwords are not bcrypt hashes`);

  // Refresh tokens are SHA-256 hex now. A bcrypt value is a pre-fix leftover
  // that can never match, so the session it belongs to can never refresh.
  const legacyRefresh = users.filter((u) => u.refreshTokenHash?.startsWith("$2"));
  legacyRefresh.length === 0
    ? pass("no legacy bcrypt refresh hashes")
    : fail(`${legacyRefresh.length} refresh hashes still bcrypt`, "run: npm run security:harden");

  const plainOtp = users.filter((u) => u.otpCode !== null && !u.otpCode.startsWith("$2"));
  plainOtp.length === 0
    ? pass("no plaintext sign-in codes stored")
    : fail(`${plainOtp.length} sign-in codes are stored in plaintext`);

  // ---- 4. The database itself ----
  console.log("\n4. Database");

  const rls = await prisma.$queryRawUnsafe<Array<{ table: string }>>(`
    SELECT c.relname AS table
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  `);

  rls.length === 0
    ? pass("row level security on every table")
    : fail(`${rls.length} tables without RLS`, rls.slice(0, 4).map((r) => r.table).join(", "));

  // The real question behind RLS: can the browser-facing roles reach anything?
  const grants = await prisma.$queryRawUnsafe<Array<{ grantee: string; table_name: string }>>(`
    SELECT DISTINCT grantee, table_name
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
  `);

  grants.length === 0
    ? pass("PostgREST roles have no table privileges", "(the publishable key reaches nothing)")
    : warn(
        `${grants.length} grants to anon/authenticated`,
        "RLS is now the only thing standing between them and the data",
      );

  // ---- 5. Environment ----
  console.log("\n5. Environment");

  const pooled = process.env.DATABASE_URL ?? "";
  if (pooled.includes("pgbouncer=true") && !pooled.includes("connection_limit")) {
    fail(
      "the pooled DATABASE_URL has no connection_limit",
      "Prisma will open ~25 connections; add &connection_limit=1",
    );
  } else {
    pass("pooled connection limit set");
  }

  const secrets: Array<[string, string | undefined, number]> = [
    ["JWT_ACCESS_SECRET", process.env.JWT_ACCESS_SECRET, 32],
    ["JWT_REFRESH_SECRET", process.env.JWT_REFRESH_SECRET, 32],
  ];

  for (const [name, value, min] of secrets) {
    !value
      ? fail(`${name} is not set`)
      : value.length < min
        ? fail(`${name} is under ${min} characters`)
        : pass(`${name} long enough`);
  }

  process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET
    ? fail("the two JWT secrets are identical")
    : pass("the two JWT secrets differ");

  // ---- Result ----
  console.log(
    failures === 0
      ? `\nALL PASSED${warnings > 0 ? ` (${warnings} warning${warnings === 1 ? "" : "s"})` : ""}\n`
      : `\n${failures} FAILED\n`,
  );

  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("\nCheck could not run:", (error as Error).message, "\n");
  await prisma.$disconnect();
  process.exit(1);
});
