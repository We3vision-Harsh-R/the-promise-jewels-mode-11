import { NextFunction, Request, Response } from "express";

import { ALLOWED_ORIGINS } from "../config/cors.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { logSecurityEvent } from "../utils/securityLog.js";

/**
 * Cross-site request forgery protection.
 *
 * The API authenticates with cookies, and a cookie is attached by the browser
 * to a request whatever page caused it. CORS does not help here: the browser
 * blocks the attacker from READING the response, but the request is still
 * sent and the write still happens. Nothing in this app checked where a
 * state-changing request came from.
 *
 * Two independent defences are now in place:
 *
 *   1. SameSite on the auth cookies (config/cookies.ts) — the browser simply
 *      does not attach them to a cross-site request. This is the strong one,
 *      but it is unavailable to a deployment that genuinely puts the site and
 *      the API on different sites, which is why it is configurable.
 *
 *   2. This middleware — the Origin header, which a browser sets on every
 *      cross-origin request and which page JavaScript cannot forge. It works
 *      whatever the SameSite setting is, so the two together cover both
 *      deployment shapes.
 *
 * GET/HEAD/OPTIONS are exempt: they are not supposed to change anything, and
 * exempting them keeps ordinary navigation and the public site working.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Endpoints that are legitimately called from anywhere and carry no cookie
 * authority of their own. The public comment box and the contact form are
 * meant to be posted to by any visitor, and neither does anything privileged
 * — both write a row that an admin must then approve or read. Requiring an
 * Origin match on them would break nothing today but would break a future
 * embed, so they are exempted deliberately rather than by accident.
 *
 * Everything else — every admin write, every auth exchange — is checked.
 */
const EXEMPT_PATTERNS: RegExp[] = [
  /^\/api\/v1\/inquiries\/contact$/,
  /^\/api\/v1\/blog\/public\/[^/]+\/comments$/,
];

function isExempt(path: string): boolean {
  return EXEMPT_PATTERNS.some((pattern) => pattern.test(path));
}

/** The origin this request actually came from, if the browser told us. */
function requestOrigin(req: Request): string | null {
  const origin = req.get("origin");

  if (origin) return origin;

  // Some browsers omit Origin on same-origin form posts but still send
  // Referer. Falling back to it closes a hole rather than opening one: a
  // cross-site attacker cannot set either header from page JavaScript.
  const referer = req.get("referer");

  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/** The origin this server is being addressed as, so same-origin always passes. */
function selfOrigin(req: Request): string | null {
  const host = req.get("host");

  if (!host) return null;

  // `req.protocol` already honours X-Forwarded-Proto because app.ts sets
  // `trust proxy` in production.
  return `${req.protocol}://${host}`;
}

export function csrfProtection(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (SAFE_METHODS.has(req.method) || isExempt(req.path)) {
    return next();
  }

  const origin = requestOrigin(req);

  if (!origin) {
    // No Origin and no Referer. Browsers send at least one of these on a
    // cross-site write, so this is a non-browser client: curl, a mobile app,
    // a server-to-server call. Those cannot be tricked by a web page, which
    // is the whole threat CSRF describes, so they are allowed through — they
    // still have to present a valid session like anything else.
    return next();
  }

  const allowed = new Set(ALLOWED_ORIGINS);
  const self = selfOrigin(req);

  if (self) allowed.add(self);

  if (allowed.has(origin)) return next();

  logSecurityEvent("csrf.blocked", {
    method: req.method,
    path: req.path,
    origin,
    ip: req.ip,
  });

  next(
    new ApiError(
      403,
      env.NODE_ENV === "production"
        ? "This request was blocked."
        : `Blocked a cross-site request from ${origin}.`,
    ),
  );
}
