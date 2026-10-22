import request from '@/services/api/client.js'

/**
 * RBAC endpoints.
 *
 * There is no mock branch here on purpose. Every other module in this app has
 * one, and for permissions that would be a way to develop against an access
 * model that does not match the one enforced in production — the exact class
 * of bug this whole feature exists to prevent. If the server is not answering,
 * the panel should behave as though the caller has no permissions, not invent
 * some.
 */

/** The caller's own role and permissions, plus the catalogue they are named in. */
// The panel asks for this at start-up, in parallel with the sign-in check, and
// the permissions provider asks again a moment later once it knows who signed
// in. One request answers both, instead of the second waiting for the first.
let startedAt = 0
let started = null
export function getAccessProfile() {
  if (started && Date.now() - startedAt < 5000) return started
  startedAt = Date.now()
  started = request('/rbac/me')
  started.catch(() => { started = null })
  return started
}

/** Forgets the held answer; called when the signed-in account changes. */
export function resetAccessProfile() {
  started = null
}

export function listRoles() {
  return request('/rbac/roles')
}

export function createRole(body) {
  return request('/rbac/roles', { method: 'POST', body })
}

export function updateRole(id, body) {
  return request(`/rbac/roles/${id}`, { method: 'PUT', body })
}

export function deleteRole(id) {
  return request(`/rbac/roles/${id}`, { method: 'DELETE' })
}
