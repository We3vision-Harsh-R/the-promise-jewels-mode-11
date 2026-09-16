import request from '@/services/api/client.js'

// Running a show. Everything is scoped to one exhibition id, and the server
// guards it with the `exhibitionOps` permission — a different one from the
// `exhibitions` record the website prints. See exhibition-ops.routes.ts.

/** Enum choices, assignable accounts and collections, straight from the server. */
export function getOptions() {
  return request('/exhibition-ops/options')
}

/** Everything about one show's operations, plus the computed report. */
export function getOps(exhibitionId) {
  return request(`/exhibition-ops/${exhibitionId}`)
}

export function saveHeader(exhibitionId, body) {
  return request(`/exhibition-ops/${exhibitionId}`, { method: 'PUT', body })
}

// Every module below is the same three calls against a different path, so the
// screen drives them from one spec rather than ten near-identical functions.
export function createRow(exhibitionId, kind, body) {
  return request(`/exhibition-ops/${exhibitionId}/${kind}`, { method: 'POST', body })
}

export function updateRow(exhibitionId, kind, id, body) {
  return request(`/exhibition-ops/${exhibitionId}/${kind}/${id}`, { method: 'PUT', body })
}

export function deleteRow(exhibitionId, kind, id) {
  return request(`/exhibition-ops/${exhibitionId}/${kind}/${id}`, { method: 'DELETE' })
}

/** Shifts hang off a crew member, so they are the one exception to the shape. */
export function createShift(exhibitionId, crewId, body) {
  return request(`/exhibition-ops/${exhibitionId}/crew/${crewId}/shifts`, { method: 'POST', body })
}

export function deleteShift(exhibitionId, shiftId) {
  return request(`/exhibition-ops/${exhibitionId}/shifts/${shiftId}`, { method: 'DELETE' })
}
