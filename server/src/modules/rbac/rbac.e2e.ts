import { prisma } from "../../database/prisma.js";
import { generateAccessToken } from "../../utils/jwt.js";
import { clearPermissionCache, createRole } from "./rbac.service.js";

/**
 * Proves the guards actually refuse a real HTTP request.
 *
 * The self-test checks the permission logic; this checks the wiring. They are
 * different failures: a guard can be perfectly correct and simply not be on
 * the route — which is what rbac.coverage.ts catches statically and this
 * catches for real.
 *
 * Every request here is a GET. Nothing is created, changed or deleted: a test
 * that proved DELETE was refused by attempting one would, the day it
 * regressed, delete the client's data in order to tell you so.
 *
 * Needs the dev server up on PORT (default 2000).
 */

const PORT = process.env.PORT ?? 2000;
const BASE = `http://localhost:${PORT}/api/v1`;
const NAME = "__rbac_e2e_role";

// The server caches a permission set for ten seconds, and that cache lives in
// ITS process — clearing it from here clears this script's copy and nothing
// else. Waiting it out is what makes each assertion about the role just
// assigned rather than the one it replaced.
const CACHE_TTL_MS = 10_000;
const settle = () => new Promise((resolve) => setTimeout(resolve, CACHE_TTL_MS + 700));

let failures = 0;

function expect(label: string, actual: number, wanted: number | ((n: number) => boolean)) {
  const pass = typeof wanted === "function" ? wanted(actual) : actual === wanted;
  if (!pass) failures += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label.padEnd(34)} got ${actual}`);
}

async function get(path: string, token: string): Promise<number> {
  const res = await fetch(BASE + path, {
    headers: { cookie: `accessToken=${token}` },
  });
  return res.status;
}

// Reachable? Otherwise every assertion below "passes" for the wrong reason.
const health = await fetch(`http://localhost:${PORT}/api/health`).catch(() => null);

if (!health || !health.ok) {
  console.log(`Dev server is not answering on ${PORT} — start it and re-run.`);
  process.exit(2);
}

const subject = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

if (!subject) {
  console.log("No accounts in this database — nothing to sign in as.");
  process.exit(2);
}

await prisma.role.delete({ where: { name: NAME } }).catch(() => {});

const role = await createRole({
  name: NAME,
  description: "temporary, created by the end-to-end check",
  permissions: ["collections:view"],
});

const originalRoleId = subject.roleId;
const token = generateAccessToken(subject.id);

try {
  await prisma.user.update({ where: { id: subject.id }, data: { roleId: role.id } });
  clearPermissionCache();
  await settle();

  console.log("\nA role holding only collections:view");
  expect("GET /collections/:id allowed", await get("/collections/nope", token), (n) => n !== 403);
  expect("GET /inquiries refused", await get("/inquiries", token), 403);
  expect("GET /dashboard refused", await get("/dashboard", token), 403);
  expect("GET /media/assets refused", await get("/media/assets", token), 403);
  expect("GET /rbac/roles refused", await get("/rbac/roles", token), 403);
  expect("GET /settings refused", await get("/settings", token), 403);
  expect("GET /page-content/pages refused", await get("/page-content/pages", token), 403);
  // Designing a section is its own resource. Content access must not confer
  // it, and neither must anything else — this role holds neither.
  expect("GET /sections/options refused", await get("/sections/options", token), 403);
  // The vault permission decides whether an account HAS a vault. Without it,
  // not even an empty one.
  expect("GET /vault refused", await get("/vault", token), 403);
  expect("GET /sections/page/home refused", await get("/sections/page/home", token), 403);
  expect("GET /rbac/me allowed", await get("/rbac/me", token), 200);

  console.log("\nThe public website is unaffected");
  const anonymous = await fetch(`${BASE}/settings/public`);
  expect("GET /settings/public open", anonymous.status, 200);

  // A page's arrangement is what every visitor sees, so it is read without a
  // permission — but the designs behind a designed section must never be.
  const layout = await fetch(`${BASE}/page-content/public/home/layout`);
  expect("GET /public/home/layout open", layout.status, 200);
  const vault = await fetch(`${BASE}/vault`);
  expect("GET /vault closed to anonymous", vault.status, 401);
  const designs = await fetch(`${BASE}/sections/page/home`);
  expect("GET /sections/page/home closed to anonymous", designs.status, 401);

  console.log("\nThe same account as Master");
  const master = await prisma.role.findFirst({ where: { isSystem: true } });

  if (master) {
    await prisma.user.update({ where: { id: subject.id }, data: { roleId: master.id } });
    clearPermissionCache();
    await settle();

    expect("GET /inquiries allowed", await get("/inquiries", token), 200);
    expect("GET /dashboard allowed", await get("/dashboard", token), 200);
    expect("GET /rbac/roles allowed", await get("/rbac/roles", token), 200);
    expect("GET /settings allowed", await get("/settings", token), 200);
    expect("GET /sections/options allowed", await get("/sections/options", token), 200);
    // Master gets its OWN vault, not a view of anyone else's — there is no
    // parameter in that module that could name another account.
    expect("GET /vault allowed (own only)", await get("/vault", token), 200);
  }
} finally {
  // Always put the account back, even if an assertion threw.
  await prisma.user.update({
    where: { id: subject.id },
    data: { roleId: originalRoleId },
  });
  clearPermissionCache();
  await prisma.role.delete({ where: { name: NAME } }).catch(() => {});
}

console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);
