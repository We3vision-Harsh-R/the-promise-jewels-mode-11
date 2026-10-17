import "dotenv/config";

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import express from "express";

import { prisma } from "../database/prisma.js";
import { createAdminNetwork, describeAdminNetwork, parseAllowList } from "../middleware/adminNetwork.middleware.js";
import { cleanAddress, refreshAdminNetwork, wouldLockOut } from "../modules/admin-network/admin-network.service.js";
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

// ---------------------------------------------------------------------------
// Section 6 helpers: who can reach the admin panel, and can the website reach out
// ---------------------------------------------------------------------------

/**
 * Starts the real guard on a throwaway server and asks it questions.
 *
 * The request is sent from this machine, so the "visitor's address" is carried
 * in X-Forwarded-For and the server is told to trust ONE proxy — which is
 * exactly how a visitor reaches the app through the host's proxy. The same
 * header is also how a visitor would try to LIE about their address, so the
 * test sends that too.
 */
async function withGuard(
  options: Parameters<typeof createAdminNetwork>[0],
  run: (ask: (method: string, url: string, forwardedFor?: string) => Promise<number>) => Promise<void>,
) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(createAdminNetwork({ allowLoopback: false, ...options }));
  app.use((_req, res) => void res.status(200).json({ reached: true }));

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as { port: number };

  try {
    await run(async (method, url, forwardedFor) => {
      const response = await fetch(`http://127.0.0.1:${port}${url}`, {
        method,
        headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
      });
      return response.status;
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
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

  // ---- 6. Who can reach the admin panel ----
  console.log("\n6. Admin panel network");

  // The list has two sources: the host's ADMIN_ALLOWED_IPS (permanent) and the
  // list saved in Settings > Admin access. Read the saved one first, so what is
  // checked here is what the running site would enforce.
  await refreshAdminNetwork();
  const network = describeAdminNetwork();

  if (network.invalid.length) {
    fail("ADMIN_ALLOWED_IPS has entries that are not addresses", network.invalid.join(", "));
  }

  if (network.guardOff) {
    process.env.NODE_ENV === "production"
      ? fail("ADMIN_IP_GUARD=off", "the address protection is switched off in the host's settings")
      : warn("ADMIN_IP_GUARD=off", "the address protection is switched off");
  } else if (!network.configured) {
    process.env.NODE_ENV === "production"
      ? fail("no admin address list is active", "the admin panel is reachable from any address")
      : warn("no admin address list is active", "open to any address — fine for development, not for the live site");
  } else if (!network.enforced) {
    warn("the address list is in report-only mode", "it is only being logged, nobody is refused yet");
  } else {
    pass(
      `admin panel limited to ${network.entries} listed address${network.entries === 1 ? "" : "es"}`,
      `(${network.baseline} from the host, ${network.database} saved in Settings)`,
    );
  }

  // Overly wide or malformed entries must be refused, never half-understood.
  const bad = parseAllowList("0.0.0.0/0, 300.1.1.1, banana, 1.2.3.4/33");
  bad.rules.length === 0 && bad.invalid.length === 4
    ? pass("a whole-internet range or a malformed address is refused")
    : fail("the list parser accepted something it should not", `${bad.rules.length} accepted`);

  // The screen that edits the list must not let its user lock themselves out.
  const office = parseAllowList("203.0.113.10").rules;
  const lockoutCases: Array<[string, boolean, ReturnType<typeof wouldLockOut>]> = [
    ["removing the last address you are using is refused", true, wouldLockOut({ requesterIp: "203.0.113.10", baseline: [], saved: parseAllowList("198.51.100.5").rules, enabled: true, enforce: true })],
    ["a list that still contains you is fine", false, wouldLockOut({ requesterIp: "203.0.113.10", baseline: [], saved: office, enabled: true, enforce: true })],
    ["the host's permanent list keeps you in whatever is removed", false, wouldLockOut({ requesterIp: "203.0.113.10", baseline: office, saved: [], enabled: true, enforce: true })],
    ["report-only mode can never lock anyone out", false, wouldLockOut({ requesterIp: "203.0.113.10", baseline: [], saved: parseAllowList("198.51.100.5").rules, enabled: true, enforce: false })],
    ["a list that is switched off locks nobody out", false, wouldLockOut({ requesterIp: "203.0.113.10", baseline: [], saved: parseAllowList("198.51.100.5").rules, enabled: false, enforce: true })],
  ];
  let lockoutWrong = 0;
  for (const [label, wanted, got] of lockoutCases) {
    if (got !== wanted) {
      lockoutWrong += 1;
      fail(label);
    }
  }
  lockoutWrong === 0 ? pass("the screen refuses changes that would lock its user out") : null;

  const entries: Array<[string, boolean]> = [
    ["203.0.113.24", true],
    ["203.0.113.0/24", true],
    ["0.0.0.0/0", false],
    ["10.0.0.5", false],
    ["192.168.1.10", false],
    ["127.0.0.1", false],
    ["203.0.0.0/8", false],
    ["203.0.113.24, 1.2.3.4", false],
    ["banana", false],
  ];
  const badEntries = entries.filter(([text, ok]) => ("address" in cleanAddress(text)) !== ok);
  badEntries.length === 0
    ? pass("only a real public address or a reasonable range can be added")
    : fail("the address check accepted or refused the wrong thing", badEntries.map(([text]) => text).join(" | "));

  // The guard itself, on a real server, with the list written the way the host
  // would write it. 203.0.113.x and 198.51.100.x are documentation addresses.
  const OFFICE = "203.0.113.10";
  const STRANGER = "198.51.100.77";

  let guardFailures = 0;
  const expect = (label: string, got: number, wanted: number) => {
    if (got !== wanted) {
      guardFailures += 1;
      fail(label, `answered ${got}, wanted ${wanted}`);
    }
  };

  await withGuard({ allowed: `${OFFICE},192.0.2.0/24`, mode: "enforce" }, async (ask) => {
    // From the listed address everything is reachable.
    expect("listed address reaches /admin", await ask("GET", "/admin/login", OFFICE), 200);
    expect("listed address reaches the private API", await ask("GET", "/api/v1/dashboard", OFFICE), 200);
    expect("an address inside a listed range is let in", await ask("GET", "/admin/login", "192.0.2.200"), 200);
    expect("an IPv4 address written the IPv6 way is still matched", await ask("GET", "/admin/login", "::ffff:" + OFFICE), 200);
    expect("an address just outside the range is refused", await ask("GET", "/admin/login", "192.0.3.1"), 404);

    // From anywhere else: the admin and everything private is "not found".
    expect("stranger cannot see the admin page", await ask("GET", "/admin", STRANGER), 404);
    expect("stranger cannot see the sign-in page", await ask("GET", "/admin/login", STRANGER), 404);
    expect("stranger cannot sign in", await ask("POST", "/api/v1/auth/login", STRANGER), 404);
    expect("stranger cannot reach the dashboard API", await ask("GET", "/api/v1/dashboard", STRANGER), 404);
    expect("stranger cannot reach the team admin API", await ask("GET", "/api/v1/admin/team", STRANGER), 404);
    expect("stranger cannot read enquiries", await ask("GET", "/api/v1/inquiries", STRANGER), 404);
    expect("stranger cannot read users", await ask("GET", "/api/v1/users", STRANGER), 404);
    expect("stranger cannot read the vault", await ask("GET", "/api/v1/vault", STRANGER), 404);
    expect("stranger cannot save settings", await ask("PUT", "/api/v1/settings", STRANGER), 404);
    expect("stranger cannot edit page content", await ask("PUT", "/api/v1/page-content/home", STRANGER), 404);
    expect("stranger cannot delete anything", await ask("DELETE", "/api/v1/admin/brands/1", STRANGER), 404);
    expect("stranger cannot see live visitors", await ask("GET", "/api/v1/visitors/live", STRANGER), 404);
    expect("an unknown API path is refused, not passed on", await ask("GET", "/api/v1/something-new", STRANGER), 404);
    expect("a different API version is refused", await ask("GET", "/api/v2/dashboard", STRANGER), 404);
    expect('"who am I" gets the ordinary signed-out answer', await ask("GET", "/api/v1/auth/me", STRANGER), 401);

    // …but the public website keeps working for them.
    for (const [method, url] of [
      ["GET", "/"],
      ["GET", "/our-team"],
      ["GET", "/assets/index.js"],
      ["GET", "/api/health"],
      ["GET", "/api/v1/page-content/public/home"],
      ["GET", "/api/v1/page-content/public/home/layout"],
      ["GET", "/api/v1/settings/public"],
      ["GET", "/api/v1/brands"],
      ["GET", "/api/v1/collections/rings"],
      ["GET", "/api/v1/exhibitions"],
      ["GET", "/api/v1/exhibitions/iijs/gallery"],
      ["GET", "/api/v1/team"],
      ["GET", "/api/v1/blog/public"],
      ["GET", "/api/v1/metadata/home"],
      ["POST", "/api/v1/inquiries/contact"],
      ["POST", "/api/v1/blog/public/a-post/comments"],
      ["POST", "/api/v1/visitors/ping"],
    ] as const) {
      expect(`public ${method} ${url} still works for strangers`, await ask(method, url, STRANGER), 200);
    }

    // The attack that matters: lying about the address. The host's proxy ADDS the
    // real address to the end of X-Forwarded-For; whatever the visitor wrote
    // before it must be ignored.
    expect("a forged address in X-Forwarded-For does not get in", await ask("GET", "/admin/login", `${OFFICE}, ${STRANGER}`), 404);
    expect("…nor with several forged entries", await ask("GET", "/api/v1/dashboard", `${OFFICE}, ${OFFICE}, ${STRANGER}`), 404);
    expect("…nor with the listed address in the middle", await ask("GET", "/api/v1/users", `${STRANGER}, ${OFFICE}, ${STRANGER}`), 404);
  });

  await withGuard({ allowed: OFFICE, mode: "report" }, async (ask) => {
    expect("report mode refuses nobody", await ask("GET", "/admin/login", STRANGER), 200);
  });

  await withGuard({ allowed: "", mode: "enforce" }, async (ask) => {
    expect("an empty list leaves the panel open (the way out of a lock-out)", await ask("GET", "/admin/login", STRANGER), 200);
  });

  guardFailures === 0 ? pass("the guard refuses strangers and still serves the public site") : null;

  // The listed addresses are the client's network. They belong in the host's
  // settings, not in a repository other people can read.
  const saved = await prisma.adminAccessRule.findMany({ select: { address: true } });
  const listed = [process.env.ADMIN_ALLOWED_IPS ?? "", ...saved.map((row) => row.address)]
    .join(",")
    .split(",")
    .map((entry) => entry.trim().split("/")[0])
    .filter((entry) => /^[0-9.]+$/.test(entry));

  if (listed.length) {
    let tracked: string[] = [];
    try {
      tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
    } catch {
      warn("could not list repository files", "is this a git checkout?");
    }

    const text = /\.(ts|tsx|js|jsx|mjs|json|md|yml|yaml|env|example|html|css|txt)$/i;
    const leaked: string[] = [];
    for (const file of tracked) {
      if (!text.test(file) || !fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, "utf8");
      for (const ip of listed) {
        if (new RegExp(`(^|[^0-9.])${ip.replace(/\./g, "\\.")}([^0-9]|$)`).test(content)) leaked.push(`${file}`);
      }
    }

    leaked.length === 0
      ? pass("no allowed address is written into the repository")
      : fail("an allowed address is committed to the repository", [...new Set(leaked)].slice(0, 4).join(", "));
  }

  // ---- 7. The website cannot reach into anyone's network ----
  console.log("\n7. The website does not connect outward");

  // Nothing in the application can open a door from the internet into the
  // office: it has no tunnel, no remote shell, no file transfer, and the only
  // calls it makes to anywhere are to itself and to the email service.
  const manifest = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const remoteAccess = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter((name) =>
    /(^|[-_/])(ssh2?|sftp|ftp|ftps|telnet|tunnel|ngrok|localtunnel|vpn|wireguard|openvpn|rdp|vnc|socks|proxy-agent)([-_/]|$)/i.test(name),
  );
  remoteAccess.length === 0
    ? pass("no remote-access, tunnel, VPN or file-transfer package is installed")
    : fail("a remote-access package is installed", remoteAccess.join(", "));

  const offenders: string[] = [];
  const stray: string[] = [];
  const raw = /(child_process|node:net\b|from ["']net["']|node:tls\b|from ["']tls["']|node:dgram|\baxios\b|node-fetch|\bhttps?\.request\(|new WebSocket|net\.connect|tls\.connect)/;

  for (const file of sourceFiles(path.join("server", "src"))) {
    const rel = file.replace(/\\/g, "/");
    // Scripts and self-tests run by a person on their own machine, not by the website.
    if (/\/scripts\/|\.selftest\.|\.e2e\.|\.coverage\./.test(rel)) continue;

    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (raw.test(line)) offenders.push(`${rel}:${index + 1}`);

      if (/\bfetch\(/.test(line) && !/\.fetch\(/.test(line)) {
        const window = lines.slice(index, index + 3).join(" ");
        if (!/127\.0\.0\.1|api\.resend\.com/.test(window)) stray.push(`${rel}:${index + 1}`);
      }
    });
  }

  offenders.length === 0
    ? pass("the server opens no raw sockets, shells or tunnels")
    : fail("the server contains code that can open a connection or a shell", offenders.slice(0, 4).join(", "));

  stray.length === 0
    ? pass("the only web calls it makes are to itself and to the email service")
    : fail("a web call goes somewhere unexpected", stray.slice(0, 4).join(", "));

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
