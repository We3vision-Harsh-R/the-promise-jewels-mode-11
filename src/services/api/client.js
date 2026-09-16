// Base API client.
//
// Matches the contract in the planning doc:
//   - all routes prefixed /api/v1
//   - JWT sent via HttpOnly cookie (credentials: 'include'), not localStorage
//   - response envelope: { success, data, message }
//
// Mock mode returns canned data and, for auth, ACCEPTS ANY CREDENTIALS. That
// makes the default the whole security question: this defaulted to 'true', so
// a build that merely forgot to set VITE_USE_MOCK shipped an admin login that
// let anyone in. Vite inlines these at build time, so the mistake is invisible
// until the bundle is already live.
//
// It now defaults to OFF. Mock mode is opt-in — set VITE_USE_MOCK=true in a
// local .env when the backend is not running. Every flag below inherits this
// default, so the whole tree fails closed.
export const USE_MOCK = (import.meta.env?.VITE_USE_MOCK ?? 'false') !== 'false'

// Independent flag for the auth module specifically. Backend rollout
// happens module-by-module — auth is live before dashboard/collections/
// brands are — so this lets auth.service.js hit the real backend while
// every other *.service.js file keeps using mocks via USE_MOCK above.
// Defaults to whatever USE_MOCK is unless explicitly overridden in .env,
// so nothing breaks for anyone who hasn't set VITE_USE_MOCK_AUTH yet.
export const USE_MOCK_AUTH = (import.meta.env?.VITE_USE_MOCK_AUTH ?? String(USE_MOCK)) !== 'false'

// Per-module overrides, same pattern as USE_MOCK_AUTH above. The backend is
// rolling out module-by-module and routes/index.ts on the server only
// mounts auth/exhibitions/brands/collections/seo/seo-settings so far —
// dashboard, inquiries and settings modules exist in the server codebase
// but aren't registered on any route yet, so those three stay mocked until
// a backend dev wires them up in routes/index.ts. Each flag defaults to
// USE_MOCK unless explicitly set in .env.
export const USE_MOCK_BRANDS = (import.meta.env?.VITE_USE_MOCK_BRANDS ?? String(USE_MOCK)) !== 'false'
export const USE_MOCK_COLLECTIONS = (import.meta.env?.VITE_USE_MOCK_COLLECTIONS ?? String(USE_MOCK)) !== 'false'
export const USE_MOCK_EXHIBITIONS = (import.meta.env?.VITE_USE_MOCK_EXHIBITIONS ?? String(USE_MOCK)) !== 'false'
export const USE_MOCK_SEO = (import.meta.env?.VITE_USE_MOCK_SEO ?? String(USE_MOCK)) !== 'false'
// SEO Settings (/seo-settings) is mounted alongside /seo in routes/index.ts
// and rolls out on the same timeline, so it defaults to USE_MOCK_SEO rather
// than the generic USE_MOCK — set VITE_USE_MOCK_SEO_SETTINGS explicitly if
// it ever needs to diverge from the SEO pages endpoint.
export const USE_MOCK_SEO_SETTINGS = (import.meta.env?.VITE_USE_MOCK_SEO_SETTINGS ?? String(USE_MOCK_SEO)) !== 'false'
export const USE_MOCK_DASHBOARD = (import.meta.env?.VITE_USE_MOCK_DASHBOARD ?? String(USE_MOCK)) !== 'false'
export const USE_MOCK_INQUIRIES = (import.meta.env?.VITE_USE_MOCK_INQUIRIES ?? String(USE_MOCK)) !== 'false'
export const USE_MOCK_SETTINGS = (import.meta.env?.VITE_USE_MOCK_SETTINGS ?? String(USE_MOCK)) !== 'false'

// Exported (not just module-local) so seo.service.js's getPublicMetadata()
// can hit /metadata/:slug directly with fetch() — that endpoint is public
// (seo.public.routes.ts, mounted at "/") and responds with the raw
// metadata object, not the { success, data, message } envelope every
// other route uses, so it can't go through request() below.
export const BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api/v1'

// Endpoints that must never trigger a refresh-and-retry themselves —
// either because a 401 from them is the real answer (login, verify-otp:
// wrong credentials/code is not "session expired"), or because retrying
// them would recurse (refresh, logout).
const NO_REFRESH_RETRY = ['/auth/login', '/auth/verify-otp', '/auth/refresh', '/auth/logout']

// Access tokens are short-lived; when one expires mid-session, the backend
// returns 401 on an otherwise-valid request. Rather than bouncing the user
// to the login screen, silently call /auth/refresh (which reads the
// longer-lived refreshToken cookie and re-issues both cookies) and retry
// the original request once. Concurrent 401s share one in-flight refresh
// call instead of each firing their own.
let refreshPromise = null

async function request(path, { method = 'GET', body, params, _isRetry = false } = {}) {
  let url = `${BASE_URL}${path}`
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString()
    if (qs) url += `?${qs}`
  }

  // Uploads pass a FormData body (logo/banner/gallery images). Those must
  // NOT be JSON-stringified and must NOT get a Content-Type header — the
  // browser sets the multipart boundary itself. Every existing JSON call
  // is unaffected since body stays a plain object for those.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body && !isFormData ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  })

  const envelope = await res.json().catch(() => ({ success: false, data: null, message: 'Invalid server response' }))

  if (!res.ok || envelope.success === false) {
    const canRetryViaRefresh = res.status === 401 && !_isRetry && !NO_REFRESH_RETRY.includes(path)

    if (canRetryViaRefresh) {
      try {
        refreshPromise = refreshPromise || request('/auth/refresh', { method: 'POST', _isRetry: true })
        await refreshPromise
        refreshPromise = null
        return request(path, { method, body, params, _isRetry: true })
      } catch {
        refreshPromise = null
        // Refresh failed too (refresh token expired/invalid) — fall
        // through and surface the original 401 below.
      }
    }

    // A Zod rejection answers with message "Validation failed." and the real
    // detail in errors.fieldErrors ({ audience: ["Who attends is too long."] }).
    // That detail used to be dropped here, so every admin form showed a bare
    // "Validation failed." with no clue which field was at fault — the single
    // biggest cause of "the form just won't save". Fold it into the message
    // and hand the raw map over on err.fields for forms that want to mark
    // individual inputs.
    const fieldErrors = envelope.errors?.fieldErrors
    const detail = fieldErrors
      ? Object.entries(fieldErrors)
          .map(([field, messages]) => `${field}: ${[].concat(messages).filter(Boolean).join(' ')}`)
          .filter(Boolean)
          .join(' · ')
      : ''

    const err = new Error(
      detail
        ? `${envelope.message || 'Request failed'} — ${detail}`
        : envelope.message || `Request failed (${res.status})`
    )
    err.status = res.status
    err.fields = fieldErrors || null
    throw err
  }
  return envelope.data
}

// Small helper so mock services can simulate the same async/latency shape
// as a real network call, keeping loading states honest during dev.
export function mockDelay(data, ms = 350) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

export function envelope(data, message = 'OK') {
  return { success: true, data, message }
}

export default request