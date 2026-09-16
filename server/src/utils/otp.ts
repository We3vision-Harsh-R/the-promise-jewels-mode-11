import { randomInt } from "node:crypto";

/**
 * A one-time code.
 *
 * This was `Math.floor(100000 + Math.random() * 900000)`. `Math.random()` is
 * a fast non-cryptographic generator: its output is a deterministic sequence
 * from an internal state, and observing enough values from it narrows that
 * state. It is the wrong primitive for anything that acts as a credential,
 * and this code IS a credential — it is the second factor on admin sign-in
 * and the only thing standing in front of a password reset.
 *
 * `crypto.randomInt` draws from the OS entropy source and, unlike a modulo of
 * a random integer, is free of modulo bias — every code in the range is
 * equally likely, so no digit pattern is worth guessing first.
 */
const MIN = 100000;
const MAX = 1000000; // exclusive

export const generateOtp = (): string => String(randomInt(MIN, MAX));

/**
 * A six-digit code is one in a million per guess, which is only strong while
 * the number of guesses is bounded. That bound lives in the auth service
 * (an attempt counter on the user row) and in the route limiter; this
 * constant is what they agree on.
 */
export const MAX_OTP_ATTEMPTS = 5;
