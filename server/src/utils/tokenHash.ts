import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Hashing for long opaque secrets — refresh tokens specifically.
 *
 * These were being hashed with bcrypt, which SILENTLY TRUNCATES ITS INPUT AT
 * 72 BYTES. A refresh JWT here is ~192 characters, and its first 72 are the
 * fixed `{"alg":"HS256","typ":"JWT"}` header plus the opening of the payload
 * — the issued-at, the expiry and the entire signature all fall past the cut.
 *
 * The consequence was that the stored hash did not identify a token, only
 * roughly a user. Verified against this project's own bcryptjs and
 * jsonwebtoken: hashing one refresh token and comparing a DIFFERENT one
 * issued to the same user returns true. So the server-side session record
 * matched any refresh token that user had ever been given, rotation on
 * /refresh evicted nothing, and a stolen token stayed usable for its whole
 * seven days no matter how many times the real user signed in again.
 *
 * SHA-256 covers the entire input. It is also the right primitive here for a
 * second reason: bcrypt's deliberate slowness protects LOW-entropy secrets
 * that humans choose, and pays for that with CPU on every refresh. A signed
 * JWT is already high-entropy, so there is nothing to slow an attacker down
 * about — a fast hash costs the attacker just as much and costs us nothing.
 *
 * Passwords keep bcrypt. That distinction is the whole point.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Compares in constant time.
 *
 * A plain `===` on a secret leaks its prefix through how long the comparison
 * takes. The lengths are checked first because timingSafeEqual throws on a
 * mismatch, and both sides are hex digests of a fixed length anyway, so a
 * differing length means malformed input rather than a near miss.
 */
export function tokenMatches(token: string, storedHash: string | null): boolean {
  if (!storedHash) return false;

  const candidate = Buffer.from(hashToken(token), "utf8");
  const stored = Buffer.from(storedHash, "utf8");

  if (candidate.length !== stored.length) return false;

  return timingSafeEqual(candidate, stored);
}
