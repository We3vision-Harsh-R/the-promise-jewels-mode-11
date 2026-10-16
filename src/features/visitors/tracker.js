import { API_BASE_URL } from '@/app/config.js'

// Tells the server that someone is on the website, and which page they are on.
//
// What is sent: a random id this browser made up for the tab, the page path,
// and the page they arrived from. No cookie is set or read, no account is
// involved, and the server keeps only the visitor's country. A visitor whose
// browser sends "Do Not Track" is not counted at all.
//
// It can never get in the way of the page: it is fire-and-forget, errors are
// swallowed, and the server answers before it has written anything.

const KEY = 'pj_visit'

let fallbackId = null

function visitId() {
  try {
    let id = window.sessionStorage.getItem(KEY)
    if (!id) {
      id = randomId()
      window.sessionStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // Storage blocked (private window, strict settings): one id for this load.
    fallbackId = fallbackId || randomId()
    return fallbackId
  }
}

function randomId() {
  const bytes = new Uint8Array(12)
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function pingVisit(path) {
  if (typeof window === 'undefined') return
  if (window.navigator.doNotTrack === '1') return
  if (path.startsWith('/admin')) return

  try {
    window
      .fetch(`${API_BASE_URL}/visitors/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sid: visitId(),
          path,
          referrer: document.referrer || undefined,
        }),
        credentials: 'omit',
        keepalive: true,
      })
      .catch(() => {})
  } catch {
    /* tracking must never throw into the page */
  }
}
