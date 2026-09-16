import cors from "cors";

import { env } from "./env.js";

/**
 * Who may call this API from a browser.
 *
 * This was `{ origin: true, credentials: true }`, which tells the `cors`
 * package to REFLECT whatever Origin the request arrived with and to allow
 * credentials alongside it. That combination is not a relaxed policy, it is
 * the absence of one: any page on the internet could call this API with a
 * logged-in admin's cookies attached AND read the response, because the
 * browser was told that page's own origin was allowed. Every admin endpoint
 * — brands, collections, inquiries, settings, the whole Editor — was
 * readable and writable from an attacker's page for as long as an admin had
 * a session open.
 *
 * The list below is explicit. An origin that is not on it gets no CORS
 * headers back, so the browser refuses to hand the response to the calling
 * page.
 */

/** Normalises to scheme://host:port so a trailing slash never causes a miss. */
function toOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const DEV_ORIGINS = [
  "http://localhost:2000",
  "http://127.0.0.1:2000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

/**
 * The site and the API are the same Express app on one origin, so in the
 * normal deployment CORS is not even involved. SITE_URL and FRONTEND_URL are
 * still listed because the two have been configured separately before (a
 * static front end talking to a Render API), and CORS_EXTRA_ORIGINS exists so
 * that can be re-introduced without editing code.
 */
export const ALLOWED_ORIGINS: string[] = Array.from(
  new Set(
    [
      toOrigin(env.SITE_URL),
      toOrigin(env.FRONTEND_URL),
      ...(process.env.CORS_EXTRA_ORIGINS ?? "")
        .split(",")
        .map((value) => toOrigin(value.trim())),
      ...(env.NODE_ENV === "production" ? [] : DEV_ORIGINS),
    ].filter((value): value is string => Boolean(value)),
  ),
);

export const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // No Origin header at all: a same-origin navigation, curl, a health
    // check, or a server-to-server call. There is no cross-origin read to
    // protect against, so this is allowed — it is also what keeps the site
    // itself working, since it is served by this very app.
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

    // Refused by returning `false`, not by throwing: an error here becomes a
    // 500 in the global handler, which would misreport a routine policy
    // decision as a server fault. `false` simply omits the CORS headers and
    // the browser blocks the read, which is the correct outcome.
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  // Cache the preflight answer for a day so the admin panel is not making a
  // round trip before every write.
  maxAge: 86400,
};
