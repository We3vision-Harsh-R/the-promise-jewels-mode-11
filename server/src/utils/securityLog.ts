import { logger } from "./logger.js";

/**
 * Security events, kept apart from ordinary request logging.
 *
 * There was no record of a failed sign-in, a blocked cross-site request or a
 * rate-limit trip anywhere in this application, which means a slow
 * credential-stuffing run against the admin panel would have left no trace at
 * all. These lines are deliberately machine-greppable — one prefix, one JSON
 * object — so they can be shipped to whatever the host offers later without
 * reformatting.
 *
 * NOTHING SENSITIVE GOES IN HERE. Not passwords, not OTPs, not tokens, not
 * session cookies. An email address is recorded for authentication events
 * because without it the log cannot answer "which account was attacked", but
 * it is masked: enough to correlate attempts, not enough to harvest.
 */
export type SecurityEvent =
  | "auth.login.failed"
  | "auth.login.disabled_account"
  | "auth.otp.failed"
  | "auth.otp.locked"
  | "auth.otp.verified"
  | "auth.password.reset"
  | "auth.refresh.rejected"
  | "auth.logout"
  | "authz.denied"
  // Account lifecycle. An admin account appearing or disappearing is worth a
  // line in the same log as a failed sign-in — it is the same question later:
  // who could get in, and when did that change.
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "csrf.blocked"
  | "ratelimit.tripped"
  | "upload.rejected";

/** `bharat@example.com` -> `bh***@example.com`. */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return "unknown";

  const [name, domain] = email.split("@");

  if (!domain) return "invalid";

  return `${name.slice(0, 2)}***@${domain}`;
}

export function logSecurityEvent(
  event: SecurityEvent,
  detail: Record<string, unknown> = {},
): void {
  logger.warn(
    "[SECURITY]",
    JSON.stringify({ event, at: new Date().toISOString(), ...detail }),
  );
}
