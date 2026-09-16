import request from '@/services/api/client.js'

// Sections designed in the panel rather than written in code.
//
// Everything here needs a "sections" permission, which only the Master role
// holds until it is granted deliberately — see custom-section.routes.ts.

/** Fonts, colours, block types and the pages that can hold one. */
export function getOptions() {
  return request('/sections/options')
}

export function listForPage(page) {
  return request(`/sections/page/${page}`)
}

export function getSection(id) {
  return request(`/sections/${id}`)
}

/** `{ page, label, blocks, style }`. */
export function createSection(body) {
  return request('/sections', { method: 'POST', body })
}

/** `{ label, blocks, style }` — the page a section is on never changes. */
export function updateSection(id, body) {
  return request(`/sections/${id}`, { method: 'PUT', body })
}

export function deleteSection(id) {
  return request(`/sections/${id}`, { method: 'DELETE' })
}
