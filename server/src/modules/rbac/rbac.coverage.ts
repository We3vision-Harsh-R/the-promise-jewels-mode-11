import fs from "node:fs";
import path from "node:path";

/**
 * Reports every API route that no permission guard protects.
 *
 * Applying RBAC route by route means the failure mode is a route someone
 * forgot — and a forgotten route fails OPEN, which is the one direction an
 * access control must never fail in. Reading eleven files and hoping is not a
 * check.
 *
 * This reads the route files rather than the mounted router. Express 5 compiles
 * mount paths into opaque matcher functions with no readable path on them, so
 * walking the live tree cannot say WHICH route is unguarded — only that one is,
 * which is not actionable. The declarations are the thing being audited anyway,
 * and they are written in one consistent shape across every module.
 *
 * Run with `npm run rbac:coverage`. Exits non-zero when anything is uncovered,
 * so it can gate a deploy.
 */

const MODULES_DIR = path.join(process.cwd(), "server/src/modules");

/**
 * Routes that are meant to be reachable without a permission.
 *
 * Every entry carries its reason, because this list is the only way a route
 * can be unguarded and still pass. `file` is the module file name, `route` the
 * literal path in the declaration.
 */
const PUBLIC: Array<{ file: string; method: string; route: string; why: string }> = [
  { file: "seo.public.routes.ts", method: "get", route: "/sitemap.xml", why: "crawler file" },
  { file: "seo.public.routes.ts", method: "get", route: "/robots.txt", why: "crawler file" },
  { file: "seo.public.routes.ts", method: "get", route: "/llms.txt", why: "crawler file" },
  { file: "seo.public.routes.ts", method: "get", route: "/metadata/:slug", why: "per-page SEO for the website" },

  { file: "settings.routes.ts", method: "get", route: "/public", why: "footer contact details" },

  { file: "page-content.routes.ts", method: "get", route: "/public/:page", why: "the website's own copy" },
  { file: "page-content.routes.ts", method: "get", route: "/public/:page/layout", why: "which sections the website renders, and in what order" },

  { file: "blog.routes.ts", method: "get", route: "/public", why: "the public journal" },
  { file: "blog.routes.ts", method: "get", route: "/public/:slug", why: "a public post" },
  { file: "blog.routes.ts", method: "post", route: "/public/:slug/comments", why: "reader comments, rate-limited and moderated" },

  { file: "inquiry.routes.ts", method: "post", route: "/contact", why: "the public contact form, rate-limited" },

  { file: "brand.routes.ts", method: "get", route: "/", why: "the website lists brands" },
  { file: "brand.routes.ts", method: "get", route: "/:slug", why: "a public brand page" },

  { file: "collection.routes.ts", method: "get", route: "/", why: "the website lists collections" },
  { file: "collection.routes.ts", method: "get", route: "/:slug", why: "a public collection page" },

  { file: "exhibition.routes.ts", method: "get", route: "/", why: "the website lists shows" },
  { file: "exhibition.routes.ts", method: "get", route: "/search", why: "public show search" },
  { file: "exhibition.routes.ts", method: "get", route: "/:slug", why: "a public show page" },
  { file: "exhibition.routes.ts", method: "get", route: "/:id/gallery", why: "a public show's gallery" },

  { file: "seo.routes.ts", method: "get", route: "/", why: "public page metadata list" },
  { file: "seo.routes.ts", method: "get", route: "/:id", why: "public page metadata" },

  // Authentication cannot require a permission to be used.
  { file: "auth.routes.ts", method: "*", route: "*", why: "sign-in, OTP, refresh, logout" },

  // "What may I do" has to be answerable by an account that may do nothing.
  { file: "rbac.routes.ts", method: "get", route: "/me", why: "the caller's own access profile" },
  // Scoped to the caller. Requiring settings:edit would stop a viewer ever
  // rotating their own password, which is the opposite of what we want.
  { file: "settings.routes.ts", method: "put", route: "/password", why: "changing your OWN password" },
];

interface Declaration {
  file: string;
  line: number;
  method: string;
  route: string;
  guarded: boolean;
}

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (entry.name.endsWith(".routes.ts")) out.push(full);
  }
  return out;
}

const declarations: Declaration[] = [];

for (const file of routeFiles(MODULES_DIR)) {
  const name = path.basename(file);
  const source = fs.readFileSync(file, "utf8");
  const lines = source.split("\n");

  // Each declaration starts at `router.get(` / `adminRouter.delete(` and runs
  // until its brackets balance, so a call spread over six lines is read whole.
  const start = /^\s*(?:router|adminRouter)\.(get|post|put|patch|delete)\(\s*$|^\s*(?:router|adminRouter)\.(get|post|put|patch|delete)\(/;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(start);
    if (!match) continue;

    const method = (match[1] ?? match[2]).toLowerCase();

    let depth = 0;
    let text = "";
    let j = i;

    do {
      const line = lines[j];
      text += line + "\n";
      for (const ch of line) {
        if (ch === "(") depth += 1;
        else if (ch === ")") depth -= 1;
      }
      j += 1;
    } while (depth > 0 && j < lines.length && j - i < 40);

    const routeMatch = text.match(/\(\s*["'`]([^"'`]*)["'`]/);
    const route = routeMatch ? routeMatch[1] : "(unknown)";

    declarations.push({
      file: name,
      line: i + 1,
      method,
      route,
      // requirePagePermission and requireAnyPageView are the page-content
      // module's own guards. They are built FROM requirePermission (see
      // page-content.permission.ts) — the resource is chosen per request
      // because Content, Header and Footer share one endpoint.
      guarded:
        /require(Any)?Permission\s*\(/.test(text) ||
        /requirePagePermission\s*\(/.test(text) ||
        /requireAnyPageView/.test(text),
    });

    i = j - 1;
  }
}

const isPublic = (d: Declaration) =>
  PUBLIC.some(
    (p) =>
      p.file === d.file &&
      (p.method === "*" || p.method === d.method) &&
      (p.route === "*" || p.route === d.route),
  );

const guarded = declarations.filter((d) => d.guarded);
const open = declarations.filter((d) => !d.guarded && isPublic(d));
const uncovered = declarations.filter((d) => !d.guarded && !isPublic(d));

console.log(`Route declarations found: ${declarations.length}`);
console.log(`  guarded by a permission : ${guarded.length}`);
console.log(`  deliberately public     : ${open.length}`);
console.log(`  UNCOVERED               : ${uncovered.length}`);

if (uncovered.length > 0) {
  console.log("\nUncovered — these accept any signed-in account:\n");

  const byFile = new Map<string, Declaration[]>();
  for (const d of uncovered) {
    byFile.set(d.file, [...(byFile.get(d.file) ?? []), d]);
  }

  for (const [file, list] of [...byFile].sort()) {
    console.log(`  ${file}`);
    for (const d of list) {
      console.log(`      ${String(d.line).padStart(4)}  ${d.method.toUpperCase().padEnd(6)} ${d.route}`);
    }
  }
}

process.exit(uncovered.length > 0 ? 1 : 0);
