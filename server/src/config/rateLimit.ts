import rateLimit from "express-rate-limit";

import { ApiError } from "../utils/ApiError.js";

/**
 * Request throttling.
 *
 * express-rate-limit was already a dependency but had never been mounted, so
 * every endpoint — including the ones that check a password and a one-time
 * code — accepted unlimited attempts from one address. A six-digit OTP with
 * no limit is not a second factor; it is a number you can count to.
 *
 * Both limiters key on the client address and fail through the app's normal
 * error shape, so the admin panel reports them like any other error rather
 * than showing a bare HTML page from the library's default handler.
 */
function handler(_req: unknown, _res: unknown, next: (err: ApiError) => void) {
  next(
    new ApiError(429, "Too many attempts. Please wait a minute and try again."),
  );
}

/**
 * The credential endpoints: sign in, forgot password, verify OTP, reset.
 *
 * Deliberately tight. A person signing in mistypes a password two or three
 * times, not twenty; anything above this rate is a script. Successful
 * requests are not counted, so getting it right early never costs anyone
 * their remaining attempts.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

/**
 * Everything else under /api. Loose enough that no real session notices —
 * the public site alone makes half a dozen calls per page load — but it caps
 * what a single address can do in a minute.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

/**
 * Asking for a one-time code — the endpoint that SENDS mail.
 *
 * Tighter than the sign-in limiter, and for a different reason: each call
 * costs a real email. Left open it is both a way to grind at OTPs and a way
 * to use this site to post mail at somebody, which is how a sending domain
 * gets its reputation burned.
 */
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

/**
 * The public contact form. Unauthenticated and it writes a row, so it is the
 * one endpoint an anonymous visitor can use to fill the inquiries table.
 */
export const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

/**
 * Uploads. Each one is a 5 MB body, a type check and a round trip to storage,
 * so the cost per request is far above a normal call — the cap is on work,
 * not on abuse alone.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});
