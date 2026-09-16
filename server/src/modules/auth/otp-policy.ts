import { prisma } from "../../database/prisma.js";
import { logger } from "../../utils/logger.js";
import { SETTINGS_ID } from "../settings/settings.constants.js";

/**
 * The one question: does signing in need the emailed code?
 *
 * Every place that would send or check an OTP asks this first, so the answer
 * lives in exactly one file. Before this, the second step was unconditional and
 * spread across the login and verify paths — turning it off would have meant
 * editing the auth flow, which is not a thing anyone should do to change a
 * preference.
 *
 * DEFAULT: OFF.
 *
 * That is deliberate, and it is the conservative choice rather than the lax
 * one. An OTP is only a second factor if the code actually arrives; when it
 * does not, it is simply a locked door with no key — which is exactly the
 * state this panel was in, because the mail sender only delivers to one
 * address. A setting that defaults to "on" and silently locks out every new
 * account is worse than one that defaults to "off" and is turned on
 * deliberately once mail is known to work.
 *
 * The setting is system-wide on purpose. Per-account two-factor invites the
 * question "who turned mine off", and there is no screen here to answer it.
 */

/**
 * Read once, then cached briefly.
 *
 * This is consulted on every sign-in attempt, including failed ones, so it is
 * also the cheapest thing for a burst of login attempts to hammer. Ten seconds
 * means a change made in Settings takes effect within ten seconds everywhere,
 * which is well inside "I toggled it and tried again".
 */
const CACHE_TTL_MS = 10_000;

let cached: { value: boolean; expiresAt: number } | null = null;

/** Called by the settings service the moment the toggle is saved. */
export function clearOtpPolicyCache(): void {
  cached = null;
}

export async function isOtpRequired(): Promise<boolean> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    // Addressed by id, not findFirst. This database has more than one
    // settings row — the repository has always written to SETTINGS_ID and
    // left the other one behind — so findFirst returned whichever Postgres
    // felt like, which was not the row the Settings screen saves. The toggle
    // appeared to do nothing.
    const row = await prisma.settings.findUnique({
      where: { id: SETTINGS_ID },
      select: { otpRequired: true },
    });

    const value = row?.otpRequired ?? false;
    cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (error) {
    // A database that cannot answer must not become a panel nobody can enter.
    // Failing to OFF here matches the default and keeps the door usable; the
    // password is still checked either way, so this is not a bypass of
    // authentication, only of the second step.
    logger.error(
      `Could not read the OTP setting, treating it as off: ${(error as Error).message}`,
    );
    return false;
  }
}

/**
 * Password reset is NOT covered by the toggle.
 *
 * "I forgot my password" has no password to check, so the emailed code is the
 * only thing proving the person asking owns the address. Turning it off there
 * would let anyone reset anyone's password by typing their email. The setting
 * governs the SECOND step of a sign-in, never the only step of a reset.
 */
export const RESET_ALWAYS_REQUIRES_OTP = true;
