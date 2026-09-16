import request, { USE_MOCK_BRANDS, mockDelay } from '@/services/api/client.js'
import { mockBrands } from '@/services/mock/data.js'
import { generateSlug } from '@/utils/generateSlug.js'

let store = [...mockBrands]

// Builds the multipart body the backend expects: uploadBrandImages reads
// `logo` (1), `banner` (1) and `images` (gallery, up to 10) off req.files,
// everything else comes through req.body as plain form fields (booleans
// arrive as strings and get coerced server-side by boolFromString).
function toFormData(payload) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    // Empty strings ARE sent: dropping them made "clear the Overview and
    // save" a no-op, because a field the server never receives keeps its old
    // value. undefined/null still drop out — that is how an untouched file
    // input says "leave the current logo alone".
    if (value === undefined || value === null) return
    if (key === 'images' && Array.isArray(value)) {
      value.forEach((file) => formData.append('images', file))
      return
    }
    if (value instanceof File) {
      formData.append(key, value)
      return
    }
    formData.append(key, typeof value === 'boolean' ? String(value) : value)
  })
  return formData
}

// Mock-only: there's no real upload happening against the in-memory store,
// so a selected logo/banner File just becomes an object URL for preview.
function resolveMockImageFields({ logo, banner, ...rest }) {
  const result = { ...rest }
  if (logo instanceof File) result.logoUrl = URL.createObjectURL(logo)
  if (banner instanceof File) result.bannerUrl = URL.createObjectURL(banner)
  return result
}

// The real backend returns Prisma rows: brand_images[] (id, imageUrl,
// altText, caption) instead of a flat `gallery` array, and a
// `_count.collections` instead of a plain `collections` number (only
// present on the admin list endpoint — single-row fetches from
// create/update/getById don't include it). This adapter normalizes both
// mock and real shapes to what the pages already render, so no component
// code needs to change.
function normalizeBrand(row) {
  if (!row) return row
  return {
    ...row,
    collections: row._count?.collections ?? row.collections ?? 0,
    gallery: row.gallery ?? (row.brand_images || []).map((img) => ({
      id: img.id,
      image_url: img.imageUrl,
      alt_text: img.altText,
    })),
  }
}

// ---------------------------------------------------------------------------
// Public website
// ---------------------------------------------------------------------------

/**
 * GET /brands — every ACTIVE brand, ordered by displayOrder, each with its
 * gallery rows attached.
 *
 * This is the unauthenticated endpoint (brand.routes.ts `publicRouter`). The
 * /admin/brands calls below all sit behind requireAuth and would 401 for a
 * website visitor, so the public pages must come through here.
 */
export async function listPublicBrands() {
  if (USE_MOCK_BRANDS) {
    const rows = store
      .filter((b) => b.isActive)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    return mockDelay(rows.map(normalizeBrand))
  }
  const rows = await request('/brands')
  return (rows || []).map(normalizeBrand)
}

export async function listBrands({ isActive } = {}) {
  if (USE_MOCK_BRANDS) {
    const rows = isActive === undefined ? store : store.filter((b) => b.isActive === isActive)
    return mockDelay([...rows].sort((a, b) => a.sort_order - b.sort_order))
  }
  const result = await request('/admin/brands', { params: { isActive } })
  return result.brands.map(normalizeBrand)
}

export async function createBrand(payload) {
  if (USE_MOCK_BRANDS) {
    const brand = {
      id: `b${Date.now()}`,
      slug: generateSlug(payload.name),
      isActive: true,
      collections: 0,
      sort_order: store.length + 1,
      gallery: [],
      ...resolveMockImageFields(payload),
    }
    store = [...store, brand]
    return mockDelay(brand)
  }
  const brand = await request('/admin/brands', { method: 'POST', body: toFormData(payload) })
  return normalizeBrand(brand)
}

export async function updateBrand(id, payload) {
  if (USE_MOCK_BRANDS) {
    const { images, ...rest } = payload
    store = store.map((b) => {
      if (b.id !== id) return b
      const updated = { ...b, ...resolveMockImageFields(rest) }
      if (images?.length) {
        const newImages = images.map((file) => ({
          id: `img${Date.now()}-${Math.random().toString(36).slice(2)}`,
          image_url: URL.createObjectURL(file),
        }))
        updated.gallery = [...(b.gallery || []), ...newImages]
      }
      return updated
    })
    return mockDelay(store.find((b) => b.id === id))
  }
  const brand = await request(`/admin/brands/${id}`, { method: 'PUT', body: toFormData(payload) })
  return normalizeBrand(brand)
}

export async function deleteBrand(id) {
  if (USE_MOCK_BRANDS) {
    store = store.filter((b) => b.id !== id)
    return mockDelay(null)
  }
  return request(`/admin/brands/${id}`, { method: 'DELETE' })
}

export async function reorderBrands(orderedIds) {
  if (USE_MOCK_BRANDS) {
    store = orderedIds
      .map((id, i) => {
        const b = store.find((x) => x.id === id)
        return b ? { ...b, sort_order: i + 1 } : null
      })
      .filter(Boolean)
    return mockDelay(store)
  }
  // Backend expects { items: [{ id, displayOrder }] }, not a plain id list.
  const items = orderedIds.map((id, displayOrder) => ({ id, displayOrder }))
  return request('/admin/brands/reorder', { method: 'PATCH', body: { items } })
}

export async function deleteBrandGalleryImage(brandId, imageId) {
  if (USE_MOCK_BRANDS) {
    store = store.map((b) =>
      b.id === brandId ? { ...b, gallery: (b.gallery || []).filter((i) => i.id !== imageId) } : b
    )
    return mockDelay(null)
  }
  return request(`/admin/brands/${brandId}/images/${imageId}`, { method: 'DELETE' })
}
