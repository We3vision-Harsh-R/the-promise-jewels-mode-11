import request from '@/services/api/client.js'

// The people on the Our Team page.
//
//   GET    /team                 public — the people marked as shown
//   GET    /admin/team           admin  — everyone, shown or not
//   POST   /admin/team           admin  — add (multipart: photo + fields)
//   PUT    /admin/team/:id       admin  — edit; a new photo replaces the old
//   PATCH  /admin/team/:id/status
//   PATCH  /admin/team/reorder   admin  — { ids: [...] } first to last
//   DELETE /admin/team/:id       admin  — removes the person and the photo

/** Everyone the website shows, in order. */
export function listPublicTeam() {
  return request('/team')
}

export function listTeam() {
  return request('/admin/team')
}

// The photo travels as a file part, everything else as plain form fields.
// Empty strings ARE sent: dropping them would make "clear the short line and
// save" do nothing, because a field the server never receives keeps its value.
function toFormData(payload) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (value instanceof File) {
      formData.append(key, value)
      return
    }
    formData.append(key, typeof value === 'boolean' ? String(value) : value)
  })
  return formData
}

export function createMember(payload) {
  return request('/admin/team', { method: 'POST', body: toFormData(payload) })
}

export function updateMember(id, payload) {
  return request(`/admin/team/${id}`, { method: 'PUT', body: toFormData(payload) })
}

export function toggleMember(id) {
  return request(`/admin/team/${id}/status`, { method: 'PATCH' })
}

export function reorderTeam(ids) {
  return request('/admin/team/reorder', { method: 'PATCH', body: { ids } })
}

export function deleteMember(id) {
  return request(`/admin/team/${id}`, { method: 'DELETE' })
}
