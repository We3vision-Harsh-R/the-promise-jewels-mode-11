import { useSyncExternalStore } from 'react'

// Keeps open pages in step with the admin panel.
//
// The website remembers what it fetched (page copy, brands, collections, the
// footer's contact details…) so moving between pages is instant. That memory is
// what made a saved change look "not there" until the page was reloaded.
//
// Now a save is announced, and every page reacts:
//
//   - the admin panel, after any successful save, tells other tabs of the site
//     at once (BroadcastChannel, with localStorage as a fallback);
//   - every open page of the website also asks the server, every few seconds
//     and whenever the tab comes back into view, for the content version — a
//     number that changes on each save — which covers another browser or
//     another computer;
//   - on a change, the remembered data is dropped and every component that shows
//     data is told (useContentTick), so it fetches again and updates in place.
//
// Nothing here reloads the page or touches what the visitor is doing.

const CHANNEL = 'pj-content'
const STORAGE_KEY = 'pj-content-changed'
const POLL_MS = 15_000
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

let knownVersion = null
let started = false

async function checkVersion() {
  if (document.visibilityState === 'hidden') return

  try {
    const res = await fetch(`${BASE_URL}/content-version`, { cache: 'no-store', credentials: 'omit' })
    if (!res.ok) return
    const { version } = await res.json()

    if (knownVersion !== null && version !== knownVersion) changed()
    knownVersion = version
  } catch {
    /* offline or a blip: try again next time */
  }
}

/** Starts listening on the public website. Safe to call more than once. */
export function startContentSync() {
  if (started || typeof window === 'undefined') return
  started = true

  const bc = getChannel()
  if (bc) bc.onmessage = () => changed()

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) changed()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkVersion()
  })
  window.addEventListener('focus', checkVersion)

  checkVersion()
  setInterval(checkVersion, POLL_MS)
}
