import type { Server } from "node:http";

import { prisma } from "../database/prisma.js";
import { logger } from "./logger.js";

/**
 * Keeping the process alive, and shutting it down cleanly when it must stop.
 *
 * Node kills the process on an unhandled promise rejection. That default is
 * correct for a script and wrong for a web server: one forgotten `.catch()`
 * anywhere — in a mail send, a storage cleanup, a stray `void` call — took
 * the entire website down for every visitor until something restarted it.
 * Nothing in this application handled that, or SIGTERM, or a socket that
 * opens and then never finishes its request.
 *
 * The three problems and the three answers:
 *
 *   1. UNHANDLED REJECTION → log it loudly and KEEP SERVING. A rejected
 *      promise in one request must not end the other visitors' sessions.
 *   2. UNCAUGHT EXCEPTION → the process state is genuinely unknown after
 *      one, so this does exit — but it drains first, and it exits non-zero
 *      so a supervisor restarts it rather than assuming a clean stop.
 *   3. SIGTERM / SIGINT → stop accepting new connections, let in-flight
 *      requests finish, disconnect Prisma, then exit. A deploy that kills
 *      the process mid-write is how half-written rows happen.
 */

/** How long in-flight work gets to finish before the process stops waiting. */
const DRAIN_MS = 10_000;

let shuttingDown = false;

async function closeEverything(server: Server, reason: string, code: number) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.warn(`[SHUTDOWN] ${reason} — draining for up to ${DRAIN_MS}ms`);

  // Refuse new connections immediately; existing ones are allowed to finish.
  server.close(() => {
    logger.info("[SHUTDOWN] all connections closed");
  });

  // A hard ceiling. If a request is wedged, the deploy still has to proceed —
  // unref() so this timer is not itself a reason to stay alive.
  const guard = setTimeout(() => {
    logger.error("[SHUTDOWN] drain timed out — exiting anyway");
    process.exit(code);
  }, DRAIN_MS);

  guard.unref();

  try {
    await prisma.$disconnect();
    logger.info("[SHUTDOWN] database disconnected");
  } catch (error) {
    logger.error("[SHUTDOWN] database disconnect failed", (error as Error).message);
  }

  clearTimeout(guard);
  process.exit(code);
}

export function installResilience(server: Server): void {
  /**
   * Socket-level timeouts — the defence against Slowloris.
   *
   * Without these a client can open a connection, send one byte of a header
   * and hold the socket open indefinitely. A few thousand of those exhaust
   * the connection table and the site stops answering anyone, without a
   * single valid request ever being made.
   *
   * `headersTimeout` MUST be greater than `keepAliveTimeout`, or Node closes
   * keep-alive sockets that are behaving perfectly well and clients see
   * random resets.
   */
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
  // The whole request, body included. Long enough for a 5 MB upload on a slow
  // connection, short enough that a stalled one is not held forever.
  server.requestTimeout = 120_000;

  process.on("unhandledRejection", (reason) => {
    // Logged and swallowed ON PURPOSE. See the note at the top of this file:
    // the alternative is that one un-awaited promise ends every visitor's
    // session at once.
    logger.error(
      "[UNHANDLED REJECTION] the process is staying up — fix the missing catch",
      reason instanceof Error ? reason.stack : String(reason),
    );
  });

  process.on("uncaughtException", (error) => {
    logger.error("[UNCAUGHT EXCEPTION]", error.stack ?? error.message);

    // Unlike a rejection, this one really does leave the process in an
    // undefined state, so it drains and exits non-zero for the supervisor to
    // restart. It is still a graceful exit rather than an instant death.
    void closeEverything(server, "uncaught exception", 1);
  });

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      void closeEverything(server, signal, 0);
    });
  }
}
