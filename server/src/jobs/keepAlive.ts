import { prisma } from "../database/prisma.js";
import { logger } from "../utils/logger.js";

/**
 * Keeps the Supabase project from being paused for inactivity.
 *
 * A free-tier project pauses after roughly seven days with no database
 * activity, and restoring it is a manual click in a dashboard nobody wants to
 * have to log into. One trivial query a day is enough to stop that happening.
 *
 * WHY THIS IS NOT THE HEALTH ENDPOINT
 *
 * /api/health deliberately touches nothing — a health check that reports
 * internals is reconnaissance. That is the right design and it means pinging
 * it keeps the APP warm while the DATABASE still goes to sleep. Supabase
 * counts database activity, so this has to be a real query against a real
 * table.
 *
 * WHY THERE IS ALSO A CRON SCRIPT
 *
 * This timer lives inside the web process. If the host restarts the app, puts
 * it to sleep, or it crashes over a quiet weekend, the timer goes with it —
 * and the one week that matters is exactly a quiet one. supabase/keep-alive.mjs
 * runs from the host's own scheduler and does not care whether the app is up.
 * Two independent layers, because either alone has a way to fail silently.
 *
 * HONESTLY: THIS IS A WORKAROUND
 *
 * Pausing is the free tier working as intended. If the app is down AND the
 * cron misses for a week, the project still pauses. The actual fix is a paid
 * plan; this buys everything short of that.
 */

/** Once a day. Seven times the margin the limit allows. */
const DEFAULT_INTERVAL_HOURS = 24;

/**
 * One trivial read against a real table.
 *
 * `SELECT 1` on its own may or may not register as activity depending on how
 * it is routed, so this touches `settings` — a real table, one row at most,
 * and the query returns a constant rather than any of its contents. Nothing
 * about this reads or logs data.
 *
 * Kept identical to the query in supabase/keep-alive.mjs; if one changes, the
 * other should.
 */
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRawUnsafe("SELECT 1 FROM settings LIMIT 1");
}

let timer: NodeJS.Timeout | null = null;

/**
 * India Standard Time is UTC+5:30 all year (no daylight saving), so a fixed
 * offset is exact and needs no timezone database.
 */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** The clock time of the daily ping, in IST. 4 a.m. — the quietest hour of the day. */
const DEFAULT_TIME_IST = "04:00";

/**
 * Milliseconds from `now` until the next `HH:MM` on the Indian clock.
 * Exported so the arithmetic can be checked without waiting for 4 a.m.
 */
export function msUntilNextIst(timeIst: string, now: Date = new Date()): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeIst.trim());
  const hour = match ? Number(match[1]) : 4;
  const minute = match ? Number(match[2]) : 0;
  const valid = match && hour < 24 && minute < 60;

  const targetMinutes = valid ? hour * 60 + minute : 4 * 60;

  // Minutes since midnight, on the Indian clock, right now.
  const nowIst = (((now.getUTCHours() * 60 + now.getUTCMinutes() + IST_OFFSET_MINUTES) % 1440) + 1440) % 1440;
  const sinceMidnightMs = nowIst * 60_000 + now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();

  let wait = targetMinutes * 60_000 - sinceMidnightMs;
  if (wait <= 1000) wait += 24 * 60 * 60 * 1000;
  return wait;
}

/**
 * Starts the daily ping.
 *
 * It runs at 04:00 India time every day (KEEPALIVE_TIME_IST changes the time),
 * and once shortly after boot as well. A host that restarts the app every few
 * hours would otherwise never reach 4 a.m. — the timer would keep being thrown
 * away and recreated, and the database would never be touched at all.
 *
 * KEEPALIVE_INTERVAL_HOURS is kept as the on/off switch: a non-positive number
 * disables the timer, anything else leaves it on.
 */
export function startKeepAlive(): void {
  if (timer) return;

  const hours = Number(process.env.KEEPALIVE_INTERVAL_HOURS ?? DEFAULT_INTERVAL_HOURS);

  if (!Number.isFinite(hours) || hours <= 0) {
    logger.info("[keep-alive] disabled (KEEPALIVE_INTERVAL_HOURS is not a positive number)");
    return;
  }

  const timeIst = process.env.KEEPALIVE_TIME_IST ?? DEFAULT_TIME_IST;

  const tick = async () => {
    try {
      await pingDatabase();
      logger.info("[keep-alive] database touched");
    } catch (error) {
      // Never throw out of a timer. An unhandled rejection here would take the
      // whole web process down over a failed keep-alive, which is a far worse
      // outcome than the project pausing.
      logger.error(`[keep-alive] ping failed: ${(error as Error).message}`);
    }
  };

  // Thirty seconds in: late enough that boot is finished and the pool is
  // ready, early enough that a short-lived process still counts.
  const first = setTimeout(tick, 30_000);
  first.unref();

  // Re-armed after every run rather than set once with setInterval, so a long
  // sleep or a clock adjustment cannot push it off the 4 a.m. mark.
  const arm = () => {
    timer = setTimeout(async () => {
      await tick();
      arm();
    }, msUntilNextIst(timeIst));

    // unref so this timer alone never holds the process open. The HTTP server
    // is what keeps it alive; without this, a shutdown would wait for a timer
    // that may be twenty-three hours from firing.
    timer.unref();
  };

  arm();

  const minutes = Math.round(msUntilNextIst(timeIst) / 60_000);
  logger.info(`[keep-alive] on, daily at ${timeIst} IST (next in ${Math.floor(minutes / 60)}h ${minutes % 60}m)`);
}

/** For tests and clean shutdown. */
export function stopKeepAlive(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}
