import request from '@/services/api/client.js'

// Which internet addresses may open the admin panel (Settings > Admin access).
//
//   GET    /admin/network              the list, the switch, and the caller's own address
//   POST   /admin/network/rules        add an address or range
//   DELETE /admin/network/rules/:id    remove one (refused if it would lock the caller out)
//   PUT    /admin/network/settings     { enabled?, mode? }  (refused if it would lock the caller out)

export function getAdminAccess() {
  return request('/admin/network')
}

export function addAdminAddress({ address, label }) {
  return request('/admin/network/rules', { method: 'POST', body: { address, label } })
}

export function removeAdminAddress(id) {
  return request(`/admin/network/rules/${id}`, { method: 'DELETE' })
}

export function saveAdminAccessSettings(changes) {
  return request('/admin/network/settings', { method: 'PUT', body: changes })
}
