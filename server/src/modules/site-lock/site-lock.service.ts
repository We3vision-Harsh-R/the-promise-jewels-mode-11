import { randomBytes } from "node:crypto";

import { prisma } from "../../database/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { clearPublicCache } from "../../middleware/publicCache.middleware.js";
import { CONTENT_PAGES } from "../page-content/page-content.constants.js";
import pageContentService from "../page-content/page-content.service.js";
import { getPublicLayout } from "../page-content/page-layout.service.js";
import settingsService from "../settings/settings.service.js";

/**
 * Locking the Editor.
 *
 * WHY
 *
 * Every page load of the website used to ask the server for its words (one
 * request per page, plus the arrangement, plus the footer's contact details) and
 * every open page asked "did anything change?" every 15 seconds. Once the
 * content is finished none of that is needed.
 *
 * "Lock editor" freezes everything the Editor controls — all page copy, the
 * header, the footer, the rings, the arrangement of sections and the site
 * settings the footer shows — into ONE snapshot. While locked:
 *
 *   - the website reads that snapshot in a single request (cacheable by the
 *     browser) instead of one request per page, and stops polling altogether;
 *   - the server answers it from memory, so the database is not touched;
 *   - every write to the Editor is refused until it is unlocked with the key.
 *
 * It is a button, not a password: "Publish & lock" freezes the content under a
 * new unique version, "Unlock to edit" lifts the freeze. Locking again takes a
 * fresh snapshot of whatever was edited, with a new version.
 *
 * The version is what the website checks. The browser keeps the snapshot with
 * its version as an ETag and, on every page load or reload, asks the server
 * "is this still version X?" — a tiny 304 if so, the new snapshot if not.
 *
 * WHERE IT LIVES
 *
 * In page_content under the reserved page "_site", so no migration is needed.
 * That page is not in CONTENT_PAGES, so the Editor never lists or serves it.
 *
 * The state is kept in this process's memory after the first read. The host runs
 * one copy of the server; with several copies each would learn of a lock/unlock
 * only on restart.
 */

const SITE_PAGE = "_site";
const SECTION = "lock";
const STATE_FIELD = "state";
const SNAPSHOT_FIELD = "snapshot";

interface LockState {
  locked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  /** The version the snapshot was published as. */
  version: string | null;
}

export interface LockStatus {
  locked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  version: string | null;
}

export interface SiteSnapshot {
  locked: true;
  /** Changes with every lock, so a cached copy can be told apart. */
  version: string;
  pages: Record<string, unknown>;
  layouts: Record<string, unknown>;
  settings: unknown;
}

const UNLOCKED: LockState = { locked: false, lockedAt: null, lockedBy: null, version: null };

let state: LockState | null = null;
let snapshot: SiteSnapshot | null = null;
let loading: Promise<void> | null = null;

/** Unique per publish: time (so versions sort) plus a random tail (so two never collide). */
function newVersion(): string {
  return `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

async function readRow(field: string): Promise<string | null> {
  const row = await prisma.page_content.findUnique({
    where: { page_section_field: { page: SITE_PAGE, section: SECTION, field } },
  });
  return row?.value ?? null;
}

function writeRow(field: string, value: string) {
  return prisma.page_content.upsert({
    where: { page_section_field: { page: SITE_PAGE, section: SECTION, field } },
    update: { value },
    create: { page: SITE_PAGE, section: SECTION, field, value },
  });
}

/** Reads the saved state once. A database that cannot be reached means "not locked", never a blank site. */
function load(): Promise<void> {
  if (state) return Promise.resolve();

  loading ??= (async () => {
    try {
      const [rawState, rawSnapshot] = await Promise.all([readRow(STATE_FIELD), readRow(SNAPSHOT_FIELD)]);
      const parsed = rawState ? (JSON.parse(rawState) as LockState) : UNLOCKED;
      const parsedSnapshot = rawSnapshot ? (JSON.parse(rawSnapshot) as SiteSnapshot) : null;

      // A lock without a snapshot cannot serve anything, so it is not a lock.
      if (parsed.locked && !parsedSnapshot) {
        state = UNLOCKED;
        snapshot = null;
      } else {
        state = parsed;
        snapshot = parsed.locked ? parsedSnapshot : null;
      }
    } catch (error) {
      logger.warn(`[site-lock] could not read the lock state: ${(error as Error).message}`);
      // Not cached: the next request tries again.
      loading = null;
      throw error;
    }
  })();

  return loading;
}

/** Warms the state at startup so the first visitor is answered from memory. */
export async function loadSiteLock(): Promise<void> {
  try {
    await load();
    logger.info(`[site-lock] editor is ${state?.locked ? "LOCKED" : "unlocked"}`);
  } catch {
    /* already logged */
  }
}

async function buildSnapshot(version: string): Promise<SiteSnapshot> {
  const pages: Record<string, unknown> = {};
  const layouts: Record<string, unknown> = {};

  // One after another: the connection pool is small and each query is slow.
  for (const page of CONTENT_PAGES) {
    pages[page.key] = await pageContentService.getPublic(page.key);
    layouts[page.key] = await getPublicLayout(page.key);
  }

  const settings = await settingsService.getPublic();

  return { locked: true, version, pages, layouts, settings };
}

function toStatus(value: LockState): LockStatus {
  return { locked: value.locked, lockedAt: value.lockedAt, lockedBy: value.lockedBy, version: value.version ?? null };
}

class SiteLockService {
  async status(): Promise<LockStatus> {
    await load();
    return toStatus(state ?? UNLOCKED);
  }

  /** Synchronous once loaded — used by the write guard on every request. */
  isLocked(): boolean {
    return state?.locked === true;
  }

  /** What the website reads. `{ locked: false }` costs nothing; a lock is answered from memory. */
  async publicSnapshot(): Promise<{ locked: false } | SiteSnapshot> {
    try {
      await load();
    } catch {
      return { locked: false };
    }
    return state?.locked && snapshot ? snapshot : { locked: false };
  }

  async lock(by: string): Promise<LockStatus> {
    await load();
    if (state?.locked) throw new ApiError(409, "The editor is already locked.");

    const version = newVersion();
    const built = await buildSnapshot(version);
    const next: LockState = {
      locked: true,
      lockedAt: new Date().toISOString(),
      lockedBy: by,
      version,
    };

    // Snapshot first: if the second write failed, the stored state would still
    // say unlocked and the snapshot would simply never be served.
    await writeRow(SNAPSHOT_FIELD, JSON.stringify(built));
    await writeRow(STATE_FIELD, JSON.stringify(next));

    state = next;
    snapshot = built;

    // Open pages notice the new version and switch to the snapshot.
    clearPublicCache();
    return toStatus(next);
  }

  async unlock(): Promise<LockStatus> {
    await load();
    if (!state?.locked) return toStatus(state ?? UNLOCKED);

    await writeRow(STATE_FIELD, JSON.stringify(UNLOCKED));

    state = UNLOCKED;
    snapshot = null;

    clearPublicCache();
    return toStatus(UNLOCKED);
  }
}

export default new SiteLockService();
