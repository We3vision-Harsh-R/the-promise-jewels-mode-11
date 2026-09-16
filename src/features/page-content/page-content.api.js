import request from '@/services/api/client.js'

// The Editor — text content for the public website's pages.
//
// No mock branch: this feature only makes sense against the real backend
// (it reads and writes the rows the public site renders), and it was built
// after the backend module, so it never had a mock phase to keep in step.

// ---- Admin ----

/** The Editor's page tabs. */
export function listPages() {
  return request('/page-content/pages')
}

/** Field declarations + current values for one page — everything the form needs. */
export function getPage(page) {
  return request(`/page-content/${page}`)
}

/** Saves one page. `values` is { section: { field: value } }. */
export function updatePage(page, values) {
  return request(`/page-content/${page}`, { method: 'PUT', body: { values } })
}

// ---- Public (used by the website, no auth) ----

export function getPublicPage(page) {
  return request(`/page-content/public/${page}`)
}

// ---- Layout: which sections a page shows, and in what order ----

/** Admin: every section of the page, with its label, position and visibility. */
export function getLayout(page) {
  return request(`/page-content/${page}/layout`)
}

/** Admin: saves the whole arrangement. `sections` is [{ key, isVisible }]. */
export function saveLayout(page, sections) {
  return request(`/page-content/${page}/layout`, { method: 'PUT', body: { sections } })
}

/** Public: the visible section keys, in order. Read by the website itself. */
export function getPublicLayout(page) {
  return request(`/page-content/public/${page}/layout`)
}
