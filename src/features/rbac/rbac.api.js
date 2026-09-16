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
export function getAccessProfile() {
  return request('/rbac/me')
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
