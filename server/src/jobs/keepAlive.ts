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
 * Starts the daily ping.
 *
 * Runs once shortly after boot as well as on the interval. A host that
 * restarts the app every few hours would otherwise never reach the first
 * tick — the timer would keep being thrown away and recreated, and the
 * database would never be touched at all.
 */
export function startKeepAlive(): void {
  if (timer) return;

  const hours = Number(process.env.KEEPALIVE_INTERVAL_HOURS ?? DEFAULT_INTERVAL_HOURS);

  if (!Number.isFinite(hours) || hours <= 0) {
    logger.info("[keep-alive] disabled (KEEPALIVE_INTERVAL_HOURS is not a positive number)");
    return;
  }

  const everyMs = hours * 60 * 60 * 1000;

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

  timer = setInterval(tick, everyMs);

  // unref so this timer alone never holds the process open. The HTTP server
  // is what keeps it alive; without this, a shutdown would wait for a timer
  // that may be twenty-three hours from firing.
  timer.unref();

  logger.info(`[keep-alive] on, every ${hours}h`);
}

/** For tests and clean shutdown. */
export function stopKeepAlive(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
