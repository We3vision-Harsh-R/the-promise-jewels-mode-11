import request from '@/services/api/client.js'

// The owner's vault.
//
// There is no account id in any of these calls, and that is the design: the
// server takes the owner from the session and there is no parameter anywhere
// in the module that could name a different one. See secure-notes.service.ts.

/** The kinds of entry, and whether the server can actually open the vault. */
export function getOptions() {
  return request('/vault/options')
}

/** Everything you have, pinned first. Decrypted by the server, never stored. */
export function listEntries() {
  return request('/vault')
}

/** `{ payload, pinned }`. */
export function createEntry(body) {
  return request('/vault', { method: 'POST', body })
}

export function updateEntry(id, body) {
  return request(`/vault/${id}`, { method: 'PUT', body })
}

export function deleteEntry(id) {
  return request(`/vault/${id}`, { method: 'DELETE' })
}
