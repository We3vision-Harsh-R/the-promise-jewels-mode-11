import fs from "node:fs";
import path from "node:path";

/**
 * A fast health check for the whole site, meant to be run before and after
 * every deploy.
 *
 *   npm run smoke:check                       # the server on this machine
 *   npm run smoke:check -- https://thepromisejewels.com
 *
 * It does two kinds of check:
 *
 *   LINKS   reads the source and verifies that every internal link and every
 *           navigate() call points at a page that exists, and every /images,
 *           /fonts and /Icons path points at a file that exists. A dead link
 *           is found here, not by a visitor.
 *
 *   SERVER  asks the running server for every page and every public API call,
 *           checks the answer, and flags anything slower than the budget.
 *
 * It only READS. The one write it makes is the visitor ping, which stores a
 * country and a page and nothing else. Nothing here needs a password. Exits
 * non-zero when anything fails, so a deploy script can stop on it.
 */

const ROOT = process.cwd();
const BASE = (process.argv[2] ?? `http://localhost:${process.env.PORT ?? 2000}`).replace(/\/$/, "");

/** A cached public answer should come back well inside this. */
const FAST_MS = 800;
/** Nothing public may ever take longer than this. */
const HARD_MS = 2000;

let failures = 0;
let warnings = 0;

const pass = (label: string, detail = "") => console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
const fail = (label: string, detail = "") => {
  failures += 1;
  console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`);
};
const warn = (label: string, detail = "") => {
  warnings += 1;
  console.log(`  WARN  ${label}${detail ? "  " + detail : ""}`);
};

// ---------------------------------------------------------------------------
// LINKS
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Route patterns declared in a routes file, as regular expressions. */
function routePatterns(file: string, prefix: string): RegExp[] {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  const patterns: RegExp[] = [];

  if (/<Route\s+index/.test(source)) patterns.push(new RegExp(`^${prefix === "" ? "/" : prefix}/?$`));

  for (const match of source.matchAll(/<Route\s+[^>]*?path="([^"]+)"/g)) {
    const raw = match[1];
    if (raw === "*" || raw === "/") continue;
    const clean = raw.replace(/\/\*$/, "");
    const body = clean
      .split("/")
      .map((part) => (part.startsWith(":") ? "[^/]+" : part.replace(/\?$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("/");
    patterns.push(new RegExp(`^${prefix}/${body}/?$`));
  }
  return patterns;
}

function checkLinks(): void {
  console.log("\nLINKS — every internal link must lead somewhere");

  const publicRoutes = routePatterns("src/app/routes/AppRoutes.jsx", "").filter((p) => !p.source.includes("admin"));
  const adminRoutes = routePatterns("src/app/routes/AdminRoutes.jsx", "/admin");
  adminRoutes.push(/^\/admin\/?$/);
  const known = [...publicRoutes, ...adminRoutes];

  const staticRoot = path.join(ROOT, "public");
  let linkCount = 0;
  let assetCount = 0;
  const seen = new Set<string>();

  for (const file of walk(path.join(ROOT, "src"))) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");

    const links = [
      ...text.matchAll(/(?:\bto|\bhref)=["'](\/[^"'#?\s]*)/g),
      ...text.matchAll(/navigate\(\s*["'](\/[^"'#?\s]*)/g),
      ...text.matchAll(/\bto:\s*["'](\/[^"'#?\s]*)/g),
      ...text.matchAll(/\bpath:\s*["'](\/admin[^"'#?\s]*)/g),
    ];

    for (const match of links) {
      const target = match[1].replace(/\/+$/, "") || "/";
      const key = `${rel}|${target}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Files are checked below, where a name may contain spaces.
      if (/^\/(images|fonts|Icons|icons|favicon|assets)/.test(target)) continue;
      if (target.startsWith("/api") || target.includes("${")) continue;

      linkCount += 1;
      if (!known.some((pattern) => pattern.test(target))) fail("link to a page that does not exist", `${target}   (in ${rel})`);
    }

    // Pictures referenced as plain strings: "/images/…", "/fonts/…".
    for (const match of text.matchAll(/["'`](\/(?:images|fonts|Icons)\/[^"'`)?#]+)/g)) {
      const target = match[1];
      // "/images/..." in a comment, and paths built at runtime, are not files.
      if (target.includes("...")) continue;
      const key = `${rel}|${target}`;
      if (seen.has(key) || target.includes("${")) continue;
      seen.add(key);
      assetCount += 1;
      if (!fs.existsSync(path.join(staticRoot, target))) fail("missing file", `${target}   (used in ${rel})`);
    }
  }

  if (failures === 0) pass(`${linkCount} page links and ${assetCount} file references all resolve`);
}

// ---------------------------------------------------------------------------
// SERVER
// ---------------------------------------------------------------------------

async function timed(url: string, init?: RequestInit) {
  const started = performance.now();
  const response = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  const body = await response.text();
  return { status: response.status, ms: Math.round(performance.now() - started), body, headers: response.headers };
}

const PAGES = ["/", "/AboutPage", "/our-team", "/our-brand", "/our-collection", "/contact", "/Exhibition", "/blog"];

const PUBLIC_API = [
  "/api/health",
  "/api/v1/settings/public",
  "/api/v1/brands",
  "/api/v1/team",
  "/api/v1/collections",
  "/api/v1/exhibitions",
  "/api/v1/blog/public",
  ...["home", "about", "team", "collections", "brands", "exhibitions", "contact", "blog", "header", "footer", "rings", "enquiry", "collectionDetail", "exhibitionDetail"].flatMap(
    (page) => [`/api/v1/page-content/public/${page}`, `/api/v1/page-content/public/${page}/layout`],
  ),
];

const MUST_BE_LOGGED_IN = [
  "/api/v1/dashboard",
  "/api/v1/users",
  "/api/v1/rbac/roles",
  "/api/v1/vault",
  "/api/v1/admin/team",
  "/api/v1/visitors/live",
  "/api/v1/visitors/summary",
  "/api/v1/inquiries",
  "/api/v1/page-content/pages",
];

async function checkServer(): Promise<void> {
  console.log(`\nSERVER — ${BASE}`);

  try {
    await timed(`${BASE}/api/health`);
  } catch (error) {
    fail("the server is not answering", (error as Error).message);
    return;
  }

  // Pages: the shell must load, and point at files that exist.
  let shell = "";
  for (const page of PAGES) {
    const result = await timed(`${BASE}${page}`);
    if (result.status !== 200 || !result.body.includes('id="root"')) {
      fail(`page ${page}`, `status ${result.status}`);
      continue;
    }
    shell = result.body;
    if (result.ms > HARD_MS) fail(`page ${page}`, `${result.ms} ms (limit ${HARD_MS})`);
    else pass(`page ${page}`, `${result.ms} ms`);
  }

  // The admin page: open to everyone, or hidden from this address (ADMIN_ALLOWED_IPS).
  // Both are correct; only a server error is a problem.
  const admin = await timed(`${BASE}/admin/login`);
  if (admin.status === 200) pass("page /admin/login", "open to this address");
  else if (admin.status === 404) pass("page /admin/login", "hidden from this address (ADMIN_ALLOWED_IPS is working)");
  else fail("page /admin/login", `status ${admin.status}`);

  const assets = [...shell.matchAll(/(?:src|href)="(\/(?:assets|fonts)\/[^"]+)"/g)].map((m) => m[1]);
  for (const asset of new Set(assets)) {
    const result = await timed(`${BASE}${asset}`);
    if (result.status !== 200) fail(`file ${asset}`, `status ${result.status}`);
  }
  if (assets.length) pass(`${new Set(assets).size} files the first page depends on all load`);

  // Public API: right answer, and fast.
  for (const endpoint of PUBLIC_API) {
    const result = await timed(`${BASE}${endpoint}`);
    let ok = result.status === 200;
    try {
      const json = JSON.parse(result.body);
      ok = ok && json.success !== false;
    } catch {
      ok = false;
    }
    if (!ok) fail(`api ${endpoint}`, `status ${result.status}`);
    else if (result.ms > HARD_MS) fail(`api ${endpoint}`, `${result.ms} ms (limit ${HARD_MS})`);
    else if (result.ms > FAST_MS) warn(`api ${endpoint}`, `${result.ms} ms — slower than ${FAST_MS} ms; is the cache warm?`);
  }
  pass(`${PUBLIC_API.length} public API calls answered`);

  // Private API: must refuse a stranger.
  for (const endpoint of MUST_BE_LOGGED_IN) {
    const result = await timed(`${BASE}${endpoint}`);
    if (result.status !== 401 && result.status !== 403) fail(`private ${endpoint}`, `answered ${result.status} without a login`);
  }
  pass(`${MUST_BE_LOGGED_IN.length} private API calls refuse a stranger`);

  // The visitor ping.
  const ping = await timed(`${BASE}/api/v1/visitors/ping`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, "user-agent": "Mozilla/5.0 smoke-check Chrome/120" },
    body: JSON.stringify({ sid: "smokecheck0000", path: "/" }),
  });
  if (ping.status === 204 || ping.status === 403) pass("visitor ping", `${ping.status} in ${ping.ms} ms`);
  else fail("visitor ping", `status ${ping.status}`);

  // Cache headers on the things that must be cached.
  const font = await timed(`${BASE}/fonts/Ringtte.woff2`);
  if (!/max-age=\d{6,}/.test(font.headers.get("cache-control") ?? "")) warn("fonts are not cached for long", font.headers.get("cache-control") ?? "no header");
}

(async () => {
  checkLinks();
  await checkServer();

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}${warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})();
