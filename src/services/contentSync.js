import { useSyncExternalStore } from 'react'

// Keeps open pages in step with the admin panel.
//
// The website remembers what it fetched (page copy, brands, collections, the
// footer's contact details…) so moving between pages is instant.
//
//   - the admin panel, after any successful save, tells other tabs of the site
//     at once (BroadcastChannel, with localStorage as a fallback); they drop what
//     they remember and fetch again, updating in place;
//   - on every page load or reload the site checks the published version once
//     (see "The locked Editor" below). There is NO timer: nothing asks the server
//     on an interval, and nothing runs when a tab regains focus.
//
// Nothing here reloads the page or touches what the visitor is doing.

const CHANNEL = 'pj-content'
const STORAGE_KEY = 'pj-content-changed'
const BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api/v1'

let tick = 0
const listeners = new Set()
const clearers = new Set()

/** A module that remembers fetched data registers how to forget it. */
export function registerCacheClearer(clear) {
  clearers.add(clear)
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * A number that goes up when content changed. Put it in the dependency list of
 * the effect that fetches, and the fetch runs again.
 */
export function useContentTick() {
  return useSyncExternalStore(subscribe, () => tick, () => 0)
}

let pending = null

/** Forgets everything remembered and tells every listener — once, however many signals arrive together. */
function changed() {
  if (pending) return
  pending = setTimeout(() => {
    pending = null
    clearers.forEach((clear) => {
      try {
        clear()
      } catch {
        /* a cache that cannot be cleared is simply refetched */
      }
    })
    tick += 1
    listeners.forEach((listener) => listener())
  }, 120)
}

let channel = null
function getChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return channel
  channel = new BroadcastChannel(CHANNEL)
  return channel
}

/** Called after a successful save (by the API client): other open pages refresh. */
export function announceContentChange() {
  try {
    getChannel()?.postMessage('changed')
  } catch {
    /* the poll below still catches it */
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    /* storage blocked — the channel and the poll cover it */
  }
  changed()
}

// ---- The locked Editor / published version -------------------------------
//
// "Publish & lock" in the admin panel freezes everything the Editor controls
// (all page copy, header, footer, rings, arrangements, site settings) as one
// snapshot with a unique version. The website reads that instead of asking per
// page.
//
// Version check: every page load and every reload asks `/site-snapshot` once,
// with `cache: 'no-cache'`. The browser keeps its copy but asks the server first
// ("still version X?"): unchanged -> an empty 304, so nothing is downloaded;
// republished -> the new snapshot arrives and is used at once. A reload therefore
// always lands on the newest published version, and no interval is needed.
//
// The request starts when this module loads, before any component asks. If it
// fails the site behaves exactly as it did before locking existed.
let snapshotPromise = null

const VERSION_COOKIE = 'pj_cv'

/**
 * Remembers, in one small first-party cookie, which published version this
 * browser last loaded. It holds a short id only (never content or anything
 * personal), lasts 30 days and is only sent along with this site's own requests.
 */
function rememberVersion(version) {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${VERSION_COOKIE}=${encodeURIComponent(version || '')}; Max-Age=${version ? 2_592_000 : 0}; Path=/; SameSite=Lax${secure}`
  } catch {
    /* cookies blocked — the version check does not depend on it */
  }
}

function fetchSnapshot() {
  return fetch(`${BASE_URL}/site-snapshot`, { credentials: 'omit', cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => {
      const data = body?.data?.locked ? body.data : { locked: false }
      rememberVersion(data.locked ? data.version : '')
      return data
    })
    .catch(() => ({ locked: false }))
}

/** Resolves to the frozen content (`{ locked: true, version, pages, layouts, settings }`) or `{ locked: false }`. */
export function getSiteSnapshot() {
  if (typeof window === 'undefined') return Promise.resolve({ locked: false })
  snapshotPromise ??= fetchSnapshot()
  return snapshotPromise
}

// A save or publish in this browser: ask again, and trust the server's answer.
registerCacheClearer(() => {
  snapshotPromise = null
})

getSiteSnapshot()

let started = false

/** Starts listening on the public website. Safe to call more than once. */
export function startContentSync() {
  if (started || typeof window === 'undefined') return
  started = true

  const bc = getChannel()
  if (bc) bc.onmessage = () => changed()

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) changed()
  })
}
