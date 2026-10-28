import type { NextFunction, Request, Response } from "express";

import { logger } from "../utils/logger.js";

/**
 * An in-memory cache for the website's read-only API calls.
 *
 * WHY IT EXISTS
 *
 * The database sits in another country from the visitors, so every public
 * request paid a full round trip to it — about two seconds each, and the home
 * page makes two of them before it can show its own words. Almost none of that
 * data changes between one visitor and the next, so it is answered from memory
 * instead and the database is only asked when something may have changed.
 *
 * HOW IT STAYS CORRECT
 *
 *   1. Only a fixed list of anonymous, read-only GET routes is ever cached
 *      (PUBLIC_GET below). Nothing that depends on who is asking is on it.
 *   2. Any successful write to the API — saving content, uploading a picture,
 *      changing a brand — empties the whole cache at once, so an edit in the
 *      admin panel is on the website the next time anyone loads a page.
 *      Writes that do not change what the website shows (sign-in, the contact
 *      form, comments, the visitor beacon) are excluded so they cannot be used
 *      to keep the cache permanently cold.
 *   3. A cached answer older than REFRESH_AFTER_MS is still returned
 *      immediately, but is refreshed in the background (stale-while-revalidate),
 *      so a visitor never waits on the database to be told what is already known.
 *   4. Nothing older than MAX_AGE_MS is ever served; past that the request goes
 *      to the database like it did before this existed. It is long on purpose:
 *      an edit made in the admin panel empties the cache immediately (rule 2), so
 *      the age limit only matters for a change made behind the application's
 *      back, and a quiet page is better answered at once with something a few
 *      hours old — while it is refreshed — than made to wait.
 *
 * The cache lives in one process. If the host runs several copies, an edit
 * empties only the copy that received it; the others notice on their next
 * request after REFRESH_AFTER_MS, which serves the old answer once and fetches
 * the new one for everybody after it.
 */

const REFRESH_AFTER_MS = 30_000;
const MAX_AGE_MS = 6 * 3_600_000;
const MAX_ENTRIES = 300;
const MAX_URL_LENGTH = 240;

/** Marks the server's own refresh requests so they bypass the cache. */
const REFRESH_HEADER = "x-pj-cache-refresh";

/**
 * Anonymous GET routes whose answer is the same for every visitor.
 * Paths are relative to /api/v1.
 */
const PUBLIC_GET: RegExp[] = [
  /^\/page-content\/public\/[A-Za-z-]+(\/layout)?$/,
  /^\/settings\/public$/,
  /^\/blog\/public(\/[^/]+)?$/,
  /^\/brands(\/[^/]+)?$/,
  /^\/team$/,
  /^\/collections(\/[^/]+)?$/,
  /^\/exhibitions$/,
  /^\/exhibitions\/search$/,
  /^\/exhibitions\/[^/]+(\/gallery)?$/,
  /^\/metadata\/[^/]+$/,
];

/** Writes that cannot change what the website shows. */
const WRITES_THAT_DO_NOT_INVALIDATE: RegExp[] = [
  /^\/auth\//,
  /^\/inquiries\/contact$/,
  /^\/blog\/public\/[^/]+\/comments$/,
  /^\/visitors\//,
];

interface Entry {
  status: number;
  body: string | Buffer;
  contentType: string;
  storedAt: number;
  refreshing: boolean;
  /** Requests answered from this entry since it was last refreshed. */
  hits: number;
}

const store = new Map<string, Entry>();

/** Bumped on every invalidation so a refresh started before an edit cannot store a pre-edit answer. */
let generation = 0;

/** The port this server answers on, for its own refresh requests. */
let selfPort = 0;

/** Pages visitors were actually using when the cache was emptied, to be filled again. */
const toRewarm = new Set<string>();
let rewarmTimer: NodeJS.Timeout | null = null;

/**
 * Changes whenever the cache is emptied, which is whenever the admin panel
 * saves something. The website asks for it (GET /content-version) every few
 * seconds and, when it differs from the one it last saw, drops what it holds
 * and fetches again — so a save shows on pages that are already open, without
 * anyone refreshing them.
 */
let contentVersion = Date.now();

export function getContentVersion(): number {
  return contentVersion;
}

/** Other in-memory caches that must be emptied whenever this one is (every save). */
const clearListeners = new Set<() => void>();

export function onPublicCacheCleared(listener: () => void): void {
  clearListeners.add(listener);
}

export function clearPublicCache(): void {
  contentVersion = Date.now();
  clearListeners.forEach((listener) => listener());

  for (const [key, entry] of store) {
    if (entry.hits > 0) toRewarm.add(key);
  }

  generation += 1;
  store.clear();

  // Emptying the cache is right (the edit must show), but it would leave the
  // next visitor to pay for the database. A moment after the last change, the
  // pages people were reading are fetched again in the background. The delay
  // lets a run of saves settle first, so one burst of editing is one refill.
  if (!selfPort) return;
  if (rewarmTimer) clearTimeout(rewarmTimer);
  rewarmTimer = setTimeout(() => {
    rewarmTimer = null;
    const keys = [...toRewarm];
    toRewarm.clear();
    for (const key of keys) void refresh(key);
  }, 2_000);
  rewarmTimer.unref();
}

function isPublicGet(path: string): boolean {
  return PUBLIC_GET.some((pattern) => pattern.test(path));
}

function isLoopback(req: Request): boolean {
  const ip = req.socket.remoteAddress ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function remember(key: string, entry: Entry): void {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, entry);
}

/**
 * Refreshes happen strictly one after another. The database connection pool is
 * small and each query is slow, so refreshing several entries at once would put
 * a real visitor (or the admin panel) at the back of a queue of background work.
 * One at a time means anyone arriving waits for at most one refresh, not all.
 */
let refreshQueue: Promise<void> = Promise.resolve();

function refresh(key: string): Promise<void> {
  const entry = store.get(key);
  if (entry?.refreshing) return refreshQueue;
  if (entry) entry.refreshing = true;

  refreshQueue = refreshQueue.then(() => refreshNow(key)).catch(() => undefined);
  return refreshQueue;
}

/** Re-asks this same server for `key`, bypassing the cache, and stores what comes back. */
async function refreshNow(key: string): Promise<void> {
  if (!selfPort) return;

  const started = generation;
  const existing = store.get(key);

  try {
    const response = await fetch(`http://127.0.0.1:${selfPort}/api/v1${key}`, {
      headers: { [REFRESH_HEADER]: "1", accept: "application/json" },
    });

    // An edit landed while this was in flight — what came back may predate it.
    if (started !== generation) return;

    if (response.status === 200) {
      remember(key, {
        status: 200,
        body: await response.text(),
        contentType: response.headers.get("content-type") ?? "application/json; charset=utf-8",
        storedAt: Date.now(),
        refreshing: false,
        hits: 0,
      });
    } else if (existing) {
      // Do not keep serving an answer the source no longer gives.
      store.delete(key);
    }
  } catch (error) {
    if (existing) existing.refreshing = false;
    logger.warn(`[public-cache] refresh of ${key} failed: ${(error as Error).message}`);
  }
}

export function publicCache(req: Request, res: Response, next: NextFunction): void {
  const path = req.path;

  // ---- Writes: empty the cache once the change has actually succeeded. ----
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    if (!WRITES_THAT_DO_NOT_INVALIDATE.some((pattern) => pattern.test(path))) {
      res.on("finish", () => {
        if (res.statusCode < 400) clearPublicCache();
      });
    }
    return next();
  }

  if (req.method !== "GET" || !isPublicGet(path)) return next();
  if (req.originalUrl.length > MAX_URL_LENGTH) return next();

  // The server's own refresh must reach the database, not itself.
  if (req.get(REFRESH_HEADER) && isLoopback(req)) return next();

  const key = req.originalUrl.replace(/^\/api\/v1/, "");
  const hit = store.get(key);
  const age = hit ? Date.now() - hit.storedAt : Infinity;

  if (hit && age < MAX_AGE_MS) {
    hit.hits += 1;
    if (age > REFRESH_AFTER_MS && !hit.refreshing) void refresh(key);

    res.set("X-Cache", age > REFRESH_AFTER_MS ? "STALE" : "HIT");
    res.set("Cache-Control", "public, max-age=0, s-maxage=0, must-revalidate");
    res.status(hit.status).type(hit.contentType).send(hit.body);
    return;
  }

  // ---- Miss: let the route answer, and remember a good answer. ----
  const started = generation;
  const send = res.send.bind(res);

  res.send = ((body?: unknown) => {
    if (res.statusCode === 200 && started === generation && (typeof body === "string" || Buffer.isBuffer(body))) {
      remember(key, {
        status: 200,
        body,
        contentType: String(res.get("Content-Type") ?? "application/json; charset=utf-8"),
        storedAt: Date.now(),
        refreshing: false,
        hits: 0,
      });
    }
    return send(body as never);
  }) as Response["send"];

  res.set("X-Cache", "MISS");
  res.set("Cache-Control", "public, max-age=0, s-maxage=0, must-revalidate");
  next();
}

/** The answers worth having ready before the first visitor arrives. */
const WARM_PATHS = [
  "/settings/public",
  "/brands",
  "/team",
  "/collections",
  "/exhibitions",
  "/blog/public",
  ...["home", "about", "team", "collections", "brands", "exhibitions", "contact", "blog", "header", "footer", "rings", "enquiry", "brandDetail", "collectionDetail", "exhibitionDetail"].flatMap(
    (page) => [`/page-content/public/${page}`, `/page-content/public/${page}/layout`],
  ),
];

/**
 * Fills the cache right after the server starts listening, so even the first
 * visitor after a restart is answered from memory. Runs one at a time: the
 * database connection pool holds a single connection, so asking for several at
 * once only makes them queue behind each other until one times out.
 */
export function warmPublicCache(port: number): void {
  selfPort = port;

  void (async () => {
    for (const path of WARM_PATHS) {
      await refresh(path);
    }
    logger.info(`[public-cache] warmed ${store.size} responses`);
  })();

  // Keeps what visitors actually use fresh, so the next request is not the one
  // that pays for the database. Only entries that were asked for since their last
  // refresh are renewed; the rest simply expire, instead of being re-fetched for
  // nobody every minute.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.hits > 0 && now - entry.storedAt > REFRESH_AFTER_MS && !entry.refreshing) void refresh(key);
    }
  }, 45_000).unref();
}
