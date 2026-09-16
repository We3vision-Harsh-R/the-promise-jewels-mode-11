import { env } from "./env.js";

const isProduction = env.NODE_ENV === "production";

/**
 * Auth cookie policy.
 *
 * `SameSite` is the single most effective CSRF control available, because the
 * browser refuses to attach the cookie to a cross-site request at all — the
 * forged request arrives unauthenticated and fails on its own.
 *
 * This used to be `SameSite=None` in production unconditionally, on the
 * reasoning that the site and the API were on different origins. They are
 * not: this Express app serves the built site AND the API on one port, and
 * `.env` sets `VITE_API_BASE_URL=/api/v1` — a same-origin path. `None` was
 * therefore switching off CSRF protection for a split that no longer exists.
 *
 * `Lax` is now the default. It still allows the cookie on ordinary top-level
 * navigation to the site, which is what keeps a bookmarked /admin link
 * working, while withholding it from cross-site POSTs and background
 * requests.
 *
 * A deployment that genuinely does put the front end on another site (a
 * static host talking to a Render API) sets CROSS_SITE_COOKIES=true and gets
 * the old behaviour back. That is why csrf.middleware.ts exists as well: the
 * Origin check protects that configuration too, so neither shape is left
 * relying on a single control.
 */
const crossSite = process.env.CROSS_SITE_COOKIES === "true";

// A `SameSite=None` cookie is rejected by every current browser unless it is
// also `Secure`, so the two must move together. Locally, where there is no
// HTTPS, `Secure` would mean the cookie is never stored at all — which is
// what silently broke sign-in here once already.
const sameSite = crossSite && isProduction ? ("none" as const) : ("lax" as const);
const secure = isProduction;

const BASE = {
  httpOnly: true,
  secure,
  sameSite,
  // Scoped to the whole site because both the public pages and /admin read it.
  path: "/",
} as const;

export const ACCESS_COOKIE_OPTIONS = {
  ...BASE,
  maxAge: 15 * 60 * 1000,
};

export const REFRESH_COOKIE_OPTIONS = {
  ...BASE,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Clearing must repeat the same attributes it was set with. A cookie cleared
 * with a different path or sameSite is not the same cookie to the browser,
 * and the old one survives — which is a session that outlives its own logout.
 */
export const CLEAR_COOKIE_OPTIONS = { ...BASE };
