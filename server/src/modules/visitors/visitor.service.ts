import geoip from "geoip-country";

import { prisma } from "../../database/prisma.js";
import { logger } from "../../utils/logger.js";

/**
 * Who is on the website right now, and where they came from.
 *
 * WHAT IS KEPT
 *
 * Per visit: a random id the browser made up (no cookie, no account), the
 * COUNTRY the connection came from, the page, the device class and where they
 * arrived from. The IP address is used for one lookup and then dropped — it is
 * never written down, in memory or in the database.
 *
 * WHY EVERYTHING GOES THROUGH MEMORY FIRST
 *
 * The database is a long way from the visitors, so every query costs a
 * noticeable wait, and a visitor sends a heartbeat every thirty seconds. Writing
 * each one would put the tracker in a queue with the website's own requests.
 * Instead each ping only updates a map in memory, and one batched write every
 * FLUSH_MS carries all of them — two statements per flush however many people
 * are online. The live view reads the map directly, so it is current to the
 * second; the history reads the database and is current to the last flush.
 *
 * A restart empties the live map (the people are still there, and reappear on
 * their next heartbeat within thirty seconds). History is kept in the database.
 */

const ACTIVE_WINDOW_MS = 2 * 60_000;
const FLUSH_MS = 20_000;
const KEEP_DAYS = 90;
const MAX_LIVE = 5_000;

export interface PingInput {
  sid: string;
  path: string;
  referrer?: string;
  userAgent: string;
  ip: string;
}

interface LiveVisitor {
  id: string;
  country: string | null;
  page: string;
  referrer: string | null;
  device: "mobile" | "tablet" | "desktop";
  pageViews: number;
  firstSeen: number;
  lastSeen: number;
}

const live = new Map<string, LiveVisitor>();
const dirty = new Set<string>();
let pendingViews: { sessionId: string; page: string; country: string | null; createdAt: Date }[] = [];

/** Crawlers and preview bots are not visitors. */
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|headless|lighthouse|pagespeed|gtmetrix|preview|monitor|uptime/i;

export function isBot(userAgent: string): boolean {
  return !userAgent || BOT.test(userAgent);
}

function deviceOf(userAgent: string): LiveVisitor["device"] {
  if (/ipad|tablet|playbook|silk/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return "mobile";
  return "desktop";
}

function countryOf(ip: string): string | null {
  const clean = ip.replace(/^::ffff:/, "");
  if (!clean || clean === "::1" || clean.startsWith("127.") || clean.startsWith("10.") || clean.startsWith("192.168.")) {
    return null;
  }
  try {
    return geoip.lookup(clean)?.country ?? null;
  } catch {
    return null;
  }
}

/** Where they came from, as a host name only — never a path or query. */
function referrerHost(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host.slice(0, 80) || null;
  } catch {
    return null;
  }
}

/** Records a page view or a heartbeat. Touches memory only. */
export function recordPing(input: PingInput): void {
  if (isBot(input.userAgent)) return;

  const now = Date.now();
  const existing = live.get(input.sid);

  if (!existing) {
    if (live.size >= MAX_LIVE) return;

    const country = countryOf(input.ip);
    live.set(input.sid, {
      id: input.sid,
      country,
      page: input.path,
      referrer: referrerHost(input.referrer),
      device: deviceOf(input.userAgent),
      pageViews: 1,
      firstSeen: now,
      lastSeen: now,
    });
    pendingViews.push({ sessionId: input.sid, page: input.path, country, createdAt: new Date(now) });
    dirty.add(input.sid);
    return;
  }

  existing.lastSeen = now;

  if (existing.page !== input.path) {
    existing.page = input.path;
    existing.pageViews += 1;
    pendingViews.push({ sessionId: input.sid, page: input.path, country: existing.country, createdAt: new Date(now) });
  }

  dirty.add(input.sid);
}

/** Writes everything that changed since the last flush in two statements. */
export async function flushVisitors(): Promise<void> {
  if (!dirty.size && !pendingViews.length) return;

  const ids = [...dirty];
  dirty.clear();
  const views = pendingViews;
  pendingViews = [];

  try {
    const rows = ids.map((id) => live.get(id)).filter((row): row is LiveVisitor => Boolean(row));

    if (rows.length) {
      await prisma.$executeRaw`
        INSERT INTO visitor_sessions
          (id, country, "currentPage", referrer, device, "pageViews", "firstSeen", "lastSeen")
        SELECT * FROM unnest(
          ${rows.map((r) => r.id)}::text[],
          ${rows.map((r) => r.country)}::text[],
          ${rows.map((r) => r.page)}::text[],
          ${rows.map((r) => r.referrer)}::text[],
          ${rows.map((r) => r.device)}::text[],
          ${rows.map((r) => r.pageViews)}::int[],
          ${rows.map((r) => new Date(r.firstSeen).toISOString())}::timestamp[],
          ${rows.map((r) => new Date(r.lastSeen).toISOString())}::timestamp[]
        )
        ON CONFLICT (id) DO UPDATE SET
          "currentPage" = EXCLUDED."currentPage",
          "pageViews"   = EXCLUDED."pageViews",
          "lastSeen"    = EXCLUDED."lastSeen",
          country       = COALESCE(visitor_sessions.country, EXCLUDED.country)
      `;
    }

    if (views.length) {
      await prisma.visitorPageView.createMany({ data: views });
    }
  } catch (error) {
    // Put what failed back so the next flush retries it; tracking must never
    // be able to take the website down, so this only logs.
    for (const id of ids) dirty.add(id);
    pendingViews = [...views, ...pendingViews].slice(-2_000);
    logger.warn(`[visitors] flush failed: ${(error as Error).message}`);
  }
}

/** Forgets people who have gone quiet, and deletes history past the retention limit. */
async function tidy(): Promise<void> {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS * 5;
  for (const [id, visitor] of live) {
    if (visitor.lastSeen < cutoff) live.delete(id);
  }
}

async function purgeOld(): Promise<void> {
  const before = new Date(Date.now() - KEEP_DAYS * 86_400_000);
  try {
    await prisma.visitorPageView.deleteMany({ where: { createdAt: { lt: before } } });
    await prisma.visitorSession.deleteMany({ where: { lastSeen: { lt: before } } });
  } catch (error) {
    logger.warn(`[visitors] purge failed: ${(error as Error).message}`);
  }
}

let started = false;

export function startVisitorTracking(): void {
  if (started) return;
  started = true;

  setInterval(() => {
    void tidy();
    void flushVisitors();
  }, FLUSH_MS).unref();

  // Once a day, and shortly after boot in case the process rarely stays up that long.
  setTimeout(() => void purgeOld(), 5 * 60_000).unref();
  setInterval(() => void purgeOld(), 24 * 3_600_000).unref();
}

// ---- Admin reads ----------------------------------------------------------

export function getLive() {
  const now = Date.now();
  const active = [...live.values()]
    .filter((visitor) => now - visitor.lastSeen <= ACTIVE_WINDOW_MS)
    .sort((a, b) => b.lastSeen - a.lastSeen);

  return {
    windowSeconds: ACTIVE_WINDOW_MS / 1000,
    total: active.length,
    visitors: active.map((visitor) => ({
      // A short stable label, not the full id — enough to tell two people apart
      // on screen without exposing the token the browser holds.
      label: visitor.id.slice(0, 4).toUpperCase(),
      country: visitor.country,
      page: visitor.page,
      device: visitor.device,
      referrer: visitor.referrer,
      pageViews: visitor.pageViews,
      secondsOnSite: Math.round((visitor.lastSeen - visitor.firstSeen) / 1000),
      secondsAgo: Math.round((now - visitor.lastSeen) / 1000),
    })),
  };
}

export async function getSummary(days: number) {
  // Anything newer than the last flush is still only in memory; push it out so
  // the summary never looks twenty seconds behind the live view.
  await flushVisitors();

  const since = new Date(Date.now() - days * 86_400_000);

  const [visitors, countries, pages, daily, devices, sources] = await Promise.all([
    prisma.visitorSession.count({ where: { firstSeen: { gte: since } } }),
    prisma.visitorSession.groupBy({
      by: ["country"],
      where: { firstSeen: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 25,
    }),
    prisma.visitorPageView.groupBy({
      by: ["page"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { page: "desc" } },
      take: 15,
    }),
    prisma.$queryRaw<{ day: Date; visitors: bigint }[]>`
      SELECT date_trunc('day', "firstSeen") AS day, COUNT(*) AS visitors
      FROM visitor_sessions
      WHERE "firstSeen" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    prisma.visitorSession.groupBy({
      by: ["device"],
      where: { firstSeen: { gte: since } },
      _count: { _all: true },
    }),
    prisma.visitorSession.groupBy({
      by: ["referrer"],
      where: { firstSeen: { gte: since }, referrer: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 8,
    }),
  ]);

  return {
    days,
    visitors,
    countries: countries.map((row) => ({ country: row.country, visitors: row._count._all })),
    pages: pages.map((row) => ({ page: row.page, views: row._count._all })),
    daily: daily.map((row) => ({ day: row.day.toISOString().slice(0, 10), visitors: Number(row.visitors) })),
    devices: devices.map((row) => ({ device: row.device, visitors: row._count._all })),
    sources: sources.map((row) => ({ source: row.referrer, visitors: row._count._all })),
  };
}
