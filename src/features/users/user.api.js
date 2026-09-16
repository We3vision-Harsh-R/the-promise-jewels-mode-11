import request from '@/services/api/client.js'

/**
 * Admin accounts.
 *
 * No mock branch, for the same reason `rbac.api.js` has none: developing an
 * access screen against invented data is how you ship one that does not match
 * what the server enforces.
 */

export function listUsers() {
  return request('/users')
}

export function createUser(body) {
  return request('/users', { method: 'POST', body })
}

export function updateUser(id, body) {
  return request(`/users/${id}`, { method: 'PUT', body })
}

export function deleteUser(id) {
  return request(`/users/${id}`, { method: 'DELETE' })
}
