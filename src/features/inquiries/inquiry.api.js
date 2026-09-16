import request, { USE_MOCK, mockDelay } from '@/services/api/client.js'
import { mockInquiries } from '@/services/mock/data.js'

let store = [...mockInquiries]

// Public website inquiries always use the API so they are persisted and can
// be viewed from the admin dashboard.
export async function createInquiry(payload) {
  return request('/inquiries/contact', {
    method: 'POST',
    body: payload,
  })
}

// The current Inquiry Prisma model only has: id, name, email, phone,
// company, message, status, createdAt/updatedAt/deletedAt — no type or
// reference columns (see dashboard.types.ts's RecentInquiry note and
// server/prisma/schema.prisma's `model inquiries`). So those two fields
// are gone from this layer entirely; InquiriesPage/DashboardPage no
// longer render a Type/Reference column.
//
// Status is stored uppercase in Postgres (InquiryStatus enum: NEW, READ)
// but every component here works with lowercase ('new' | 'read') to
// match the old mock — toApiStatus/fromApiStatus convert at the edges.
function toApiStatus(status) {
  return status ? status.toUpperCase() : status
}

function fromInquiryRow(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    company: r.company,
    message: r.message,
    status: r.status?.toLowerCase() ?? r.status,
    created_at: r.createdAt,
  }
}

export async function listInquiries({ search, status } = {}) {
  if (USE_MOCK) {
    let rows = [...store]
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter((i) => i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q))
    }
    if (status) rows = rows.filter((i) => i.status === status)
    return mockDelay(rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
  }
  // Real endpoint is paginated ({ items, pagination }); this page doesn't
  // have pagination controls yet, so pull up to the server's max page
  // size in one go and hand back a flat array like the mock did.
  const { items } = await request('/inquiries', {
    params: { search, status: toApiStatus(status), limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
  })
  return items.map(fromInquiryRow)
}

export async function updateInquiryStatus(id, status) {
  if (USE_MOCK) {
    store = store.map((i) => (i.id === id ? { ...i, status } : i))
    return mockDelay(store.find((i) => i.id === id))
  }
  const updated = await request(`/inquiries/${id}/status`, {
    method: 'PATCH',
    body: { status: toApiStatus(status) },
  })
  return fromInquiryRow(updated)
}

export async function deleteInquiry(id) {
  if (USE_MOCK) {
    store = store.filter((i) => i.id !== id)
    return mockDelay(null)
  }
  return request(`/inquiries/${id}`, { method: 'DELETE' })
}

export async function exportInquiries(filters = {}) {
  if (USE_MOCK) {
    const rows = await listInquiries(filters)
    const header = ['Name', 'Email', 'Phone', 'Company', 'Status', 'Received']
    const csv = [header.join(',')]
      .concat(
        rows.map((r) =>
          [r.name, r.email, r.phone, r.company, r.status, r.created_at]
            .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inquiries-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    return mockDelay(true, 100)
  }
  // Real backend streams a signed .xlsx from GET /inquiries/export
  // (requireAuth — relies on the accessToken cookie, so this only works
  // when the API and the app share a cookie-visible origin/proxy).
  const base = import.meta.env?.VITE_API_BASE_URL || '/api/v1'
  const qs = new URLSearchParams(
    Object.entries({ search: filters.search, status: toApiStatus(filters.status) }).filter(([, v]) => v)
  ).toString()
  window.open(`${base}/inquiries/export${qs ? `?${qs}` : ''}`, '_blank')
}
