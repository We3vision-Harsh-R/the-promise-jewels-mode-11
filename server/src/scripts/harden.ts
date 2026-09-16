import "dotenv/config";

import { prisma } from "../database/prisma.js";
import { encryptField, fieldCryptoReady, isEncrypted, rowAad } from "../utils/fieldCrypto.js";

/**
 * Brings an existing database up to the security the code now expects.
 *
 * Run with `npm run security:harden`. Safe to run repeatedly — every step
 * checks before it writes, so a second run reports zero changes rather than
 * doing the work twice or corrupting what the first run did.
 *
 * Three jobs:
 *
 *   1. Encrypt personal data written before the columns were encrypted.
 *   2. Turn on Row Level Security, as a safety net that does not exist today.
 *   3. Clear refresh-token hashes left in the old bcrypt format.
 *
 * None of it is destructive. Step 3 ends a stale session; the account signs in
 * again and nothing is lost.
 */

let changed = 0;

function say(step: string, detail: string) {
  console.log(`  ${step.padEnd(34)} ${detail}`);
}

// ---------------------------------------------------------------------------
// 1. Encrypt what was written in plaintext
// ---------------------------------------------------------------------------

async function encryptInquiries() {
  const rows = await prisma.inquiries.findMany({
    select: { id: true, name: true, email: true, phone: true, company: true, message: true },
  });

  let done = 0;

  for (const row of rows) {
    // isEncrypted on every field, not just one: a run interrupted halfway
    // could have sealed some columns of a row and not others.
    const fields = ["name", "email", "phone", "company", "message"] as const;
    const pending = fields.filter((f) => row[f] !== null && !isEncrypted(row[f]));
    if (pending.length === 0) continue;

    const aad = rowAad("inquiries", row.id);
    const data: Record<string, string | null> = {};
    for (const field of pending) data[field] = encryptField(row[field], aad);

    await prisma.inquiries.update({ where: { id: row.id }, data });
    done += 1;
  }

  changed += done;
  say("enquiries encrypted", done === 0 ? "nothing to do" : `${done} of ${rows.length} rows`);
}

async function encryptLeads() {
  const rows = await prisma.exhibitionLead.findMany({
    select: { id: true, name: true, company: true, phone: true, email: true, interest: true, notes: true },
  });

  let done = 0;

  for (const row of rows) {
    const fields = ["name", "company", "phone", "email", "interest", "notes"] as const;
    const pending = fields.filter((f) => row[f] !== null && !isEncrypted(row[f]));
    if (pending.length === 0) continue;

    const aad = rowAad("exhibition_leads", row.id);
    const data: Record<string, string | null> = {};
    for (const field of pending) data[field] = encryptField(row[field], aad);

    await prisma.exhibitionLead.update({ where: { id: row.id }, data });
    done += 1;
  }

  changed += done;
  say("exhibition leads encrypted", done === 0 ? "nothing to do" : `${done} of ${rows.length} rows`);
}

// ---------------------------------------------------------------------------
// 2. Row Level Security
// ---------------------------------------------------------------------------

/**
 * Turns RLS on for every table in `public`.
 *
 * This is a safety net, not a fix for anything open today. Checked before
 * writing it: `anon` and `authenticated` — the two roles Supabase exposes to
 * the browser through PostgREST — hold NO privileges on any of these tables,
 * so the REST API cannot read them with or without RLS.
 *
 * It is worth doing anyway because that is one dashboard click away from
 * changing. Enabling Realtime on a table, or any "expose this table" action,
 * adds those grants — and with RLS off, the table is then world-readable to
 * anybody holding the publishable key, which is public by design.
 *
 * The application is unaffected: it connects as `postgres`, which has
 * BYPASSRLS (verified), so no policy is needed for it to keep working. That is
 * also why no policies are created here — a policy that only ever applies to
 * roles with no grants would be decoration.
 */
async function enableRls() {
  const tables = await prisma.$queryRawUnsafe<Array<{ table: string; rls: boolean }>>(`
    SELECT c.relname AS table, c.relrowsecurity AS rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `);

  const off = tables.filter((t) => !t.rls);

  for (const t of off) {
    // Identifier quoted, and the name comes from the catalogue rather than any
    // input, so there is nothing here to inject.
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."${t.table}" ENABLE ROW LEVEL SECURITY`);
  }

  changed += off.length;
  say("row level security", off.length === 0 ? "already on everywhere" : `enabled on ${off.length} tables`);
}

// ---------------------------------------------------------------------------
// 3. Stale refresh-token hashes
// ---------------------------------------------------------------------------

/**
 * Clears refresh hashes still stored in the old bcrypt format.
 *
 * Refresh tokens are SHA-256 now (utils/tokenHash.ts) — bcrypt was replaced
 * because it silently truncates at 72 bytes, so two different tokens sharing a
 * 72-byte prefix compared equal. The code is correct; rows written before that
 * change are not, and a SHA-256 comparison can never match one.
 *
 * The practical effect of leaving them is a session that can never refresh and
 * gets signed out at a moment nobody can explain. Clearing them makes that a
 * clean, immediate re-login instead.
 */
async function clearLegacyRefreshHashes() {
  const stale = await prisma.user.findMany({
    where: { refreshTokenHash: { startsWith: "$2" } },
    select: { id: true },
  });

  if (stale.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: stale.map((u) => u.id) } },
      data: { refreshTokenHash: null },
    });
  }

  changed += stale.length;
  say(
    "legacy refresh hashes",
    stale.length === 0 ? "none left" : `${stale.length} cleared (those accounts sign in again)`,
  );
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("\nHardening an existing database\n");

  if (!fieldCryptoReady()) {
    console.log(
      "  DATA_ENCRYPTION_KEY is not set, so nothing can be encrypted.\n" +
        "  Generate one with:\n" +
        "    node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"\n",
    );
    process.exit(1);
  }

  await encryptInquiries();
  await encryptLeads();
  await enableRls();
  await clearLegacyRefreshHashes();

  console.log(
    changed === 0
      ? "\nNothing to change — this database is already hardened.\n"
      : `\nDone. ${changed} change${changed === 1 ? "" : "s"}.\n`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("\nFailed:", (error as Error).message, "\n");
  await prisma.$disconnect();
  process.exit(1);
});
