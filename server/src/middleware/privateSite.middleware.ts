import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import "../config/env.js";
import { env } from "../config/env.js";
import { verifyAccessToken, verifyRefreshToken } from "../utils/jwt.js";
import { PUBLIC_RULES } from "./adminNetwork.middleware.js";

/**
 * Keeps the website closed to everyone who is not signed in to the admin panel.
 *
 *   SITE_PRIVATE=on   closed   (the default in production)
 *   SITE_PRIVATE=off  open to the public (the default while developing)
 *
 * A stranger who opens any page gets a short "this site is private" notice with
 * a link to the sign-in page, and the public API answers 401 — so the content
 * cannot be read through the back door either. Every response, signed in or
 * not, carries `X-Robots-Tag: noindex`, which is what makes search engines drop
 * the old "Coming Soon" listing.
 *
 * "Signed in" means a valid session cookie from the admin sign-in. The refresh
 * cookie counts too, because it outlives the 15-minute access cookie; the panel
 * renews the pair by itself, so a signed-in person never sees the notice.
 */

const flag = (process.env.SITE_PRIVATE ?? "").trim().toLowerCase();
export const SITE_PRIVATE = flag ? flag !== "off" && flag !== "false" && flag !== "0" : env.NODE_ENV === "production";

/** The site's own cache warm-up calls itself with this, since it has no cookies. */
export const INTERNAL_TOKEN = randomBytes(16).toString("hex");
export const INTERNAL_HEADER = "x-pj-internal";

const NOINDEX = "noindex, nofollow, noarchive, nosnippet";

/** What a page needs before anyone has signed in: the panel's own page, its code and look. */
const OPEN_PREFIXES = ["/admin", "/assets/", "/fonts/", "/icons/", "/images/", "/src/", "/@", "/node_modules/"];
const OPEN_FILES = new Set(["/robots.txt", "/favicon.svg", "/icons.svg", "/favicon.ico"]);

function isSignedIn(req: Request): boolean {
  const { accessToken, refreshToken } = req.cookies ?? {};
  if (accessToken) {
    try {
      verifyAccessToken(accessToken);
      return true;
    } catch {
      /* expired — the refresh cookie may still be good */
    }
  }
  if (refreshToken) {
    try {
      verifyRefreshToken(refreshToken);
      return true;
    } catch {
      /* not valid */
    }
  }
  return false;
}

const NOTICE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="${NOINDEX}">
<title>Private</title>
<style>
html,body{height:100%;margin:0}
body{display:grid;place-items:center;background:#01383B;color:#f4ecd8;font:16px/1.6 system-ui,sans-serif;text-align:center;padding:24px}
h1{font-weight:500;letter-spacing:.04em;margin:0 0 8px}
p{margin:0 0 24px;opacity:.75}
a{display:inline-block;padding:10px 22px;border:1px solid #f4ecd8;color:#f4ecd8;text-decoration:none;border-radius:2px}
</style></head>
<body><main><h1>This website is private</h1>
<p>Access is limited to authorized users.</p>
<a href="/admin/login">Authorized sign-in</a></main></body></html>`;

export function privateSite(req: Request, res: Response, next: NextFunction): void {
  // Always: no search engine may list or cache anything from here.
  res.setHeader("X-Robots-Tag", NOINDEX);

  if (!SITE_PRIVATE) return next();
  if (req.headers[INTERNAL_HEADER] === INTERNAL_TOKEN) return next();

  const path = req.path;

  if (path.startsWith("/api")) {
    // Only the public website's calls are closed here; everything else on the
    // API already asks for a sign-in of its own, and sign-in itself must work.
    const relative = path.replace(/^\/api\/v1/, "") || "/";
    const isPublicCall = path.startsWith("/api/v1") && PUBLIC_RULES.some((r) => r.method === req.method && r.pattern.test(relative));
    if (!isPublicCall || isSignedIn(req)) return next();
    res.status(401).json({ success: false, message: "This website is private." });
    return;
  }

  if (OPEN_FILES.has(path) || OPEN_PREFIXES.some((p) => path.startsWith(p)) || isSignedIn(req)) return next();

  res.status(401).set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).send(NOTICE);
}
