import request, { USE_MOCK_COLLECTIONS, mockDelay } from '@/services/api/client.js'
import { mockCollections } from '@/services/mock/data.js'
import { generateSlug } from '@/utils/generateSlug.js'

let store = [...mockCollections]

// Builds the multipart body the backend expects: uploadCollectionImages reads
// `banner` (1) and `images` (gallery, up to 10) off req.files, everything
// else is a plain form field (booleans arrive as strings and get coerced
// server-side by boolFromString).
function toFormData(payload) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    // Empty strings ARE sent: dropping them made "clear the Specifications
    // and save" a no-op, because a field the server never receives keeps its
    // old value. undefined/null still drop out — that is how an untouched
    // file input says "leave the current banner alone".
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
// so a selected banner File just becomes an object URL for preview.
function resolveMockImageFields({ banner, ...rest }) {
  const result = { ...rest }
  if (banner instanceof File) result.bannerUrl = URL.createObjectURL(banner)
  return result
}

// The real backend returns Prisma rows: collection_images[] (id, imageUrl,
// altText, caption) instead of a flat `gallery` array + `images` count, and
// `createdAt` (ISO datetime) instead of `created_at` (date string). This
// adapter normalizes both mock and real shapes to what the pages already
// render, so no component code needs to change.
function normalizeCollection(row) {
  if (!row) return row
  const gallery = row.gallery ?? (row.collection_images || []).map((img) => ({
    id: img.id,
    image_url: img.imageUrl,
    alt_text: img.altText,
    is_thumbnail: img.isThumbnail,
  }))
  const thumbnail = gallery.find((img) => img.is_thumbnail)?.image_url
  return {
    ...row,
    // The public endpoints include the parent brand; the admin list includes
    // its name only. Flattened here so nothing downstream has to know which
    // shape it got, or that the relation is spelled `brands` (plural) because
    // that is the Prisma model name.
    brandName: row.brandName ?? row.brands?.name ?? '',
    brandSlug: row.brandSlug ?? row.brands?.slug ?? '',
    created_at: row.created_at ?? (row.createdAt ? String(row.createdAt).slice(0, 10) : undefined),
    images: row.images ?? gallery.length,
    gallery,
    // The one picture that represents this collection: the banner is what the
    // admin panel uploads for exactly that, then the image explicitly flagged
    // as thumbnail, then whatever the gallery leads with.
    coverUrl: row.bannerUrl || thumbnail || gallery[0]?.image_url || '',
  }
}

// ---------------------------------------------------------------------------
// Public website
// ---------------------------------------------------------------------------

/**
 * GET /collections — every ACTIVE collection, in admin display order, each
 * with its gallery and its parent brand attached.
 *
 * Unauthenticated (collection.routes.ts `publicRouter`); the /admin/
 * collections calls below sit behind requireAuth and would 401 for a website
 * visitor. Optional filters map to the query params that route supports.
 */
export async function listPublicCollections({ brandId, category, featured } = {}) {
  if (USE_MOCK_COLLECTIONS) {
    let rows = store.filter((c) => c.isActive)
    if (brandId) rows = rows.filter((c) => c.brandId === brandId)
    if (category) rows = rows.filter((c) => c.category === category)
    return mockDelay(rows.map(normalizeCollection))
  }
  const rows = await request('/collections', { params: { brandId, category, featured } })
  return (rows || []).map(normalizeCollection)
}

/** GET /collections/:slug — one active collection, or null if there is none. */
export async function getPublicCollection(slug) {
  if (USE_MOCK_COLLECTIONS) {
    return mockDelay(normalizeCollection(store.find((c) => c.slug === slug && c.isActive)) || null)
  }
  try {
    return normalizeCollection(await request(`/collections/${slug}`))
  } catch (err) {
    // A slug that is not a collection is an ordinary outcome here, not a
    // failure: the details page also accepts the legacy category/brand slugs
    // and needs to fall through to those rather than show an error.
    if (err.status === 404) return null
    throw err
  }
}

export async function listCollections({ search, brandId, isActive } = {}) {
  if (USE_MOCK_COLLECTIONS) {
    let rows = [...store]
    if (search) rows = rows.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    if (brandId) rows = rows.filter((c) => c.brandId === brandId)
    if (isActive !== undefined) rows = rows.filter((c) => c.isActive === isActive)
    return mockDelay(rows)
  }

  const result = await request('/admin/collections', { params: { search, brandId, isActive } })
  return result.collections.map(normalizeCollection)
}

export async function createCollection(payload) {
  if (USE_MOCK_COLLECTIONS) {
    const row = {
      id: `c${Date.now()}`,
      slug: generateSlug(payload.name),
      isActive: true,
      images: 0,
      created_at: new Date().toISOString().slice(0, 10),
      gallery: [],
      ...resolveMockImageFields(payload),
    }
    store = [row, ...store]
    return mockDelay(row)
  }
  const row = await request('/admin/collections', { method: 'POST', body: toFormData(payload) })
  return normalizeCollection(row)
}

export async function updateCollection(id, payload) {
  if (USE_MOCK_COLLECTIONS) {
    const { images, ...rest } = payload
    store = store.map((c) => {
      if (c.id !== id) return c
      const updated = { ...c, ...resolveMockImageFields(rest) }
      if (images?.length) {
        const newImages = images.map((file) => ({
          id: `img${Date.now()}-${Math.random().toString(36).slice(2)}`,
          image_url: URL.createObjectURL(file),
        }))
        updated.gallery = [...(c.gallery || []), ...newImages]
        updated.images = (c.images || 0) + newImages.length
      }
      return updated
    })
    return mockDelay(store.find((c) => c.id === id))
  }
  const row = await request(`/admin/collections/${id}`, { method: 'PUT', body: toFormData(payload) })
  return normalizeCollection(row)
}

export async function deleteCollection(id) {
  if (USE_MOCK_COLLECTIONS) {
    store = store.filter((c) => c.id !== id)
    return mockDelay(null)
  }
  return request(`/admin/collections/${id}`, { method: 'DELETE' })
}

export async function reorderCollections(orderedIds) {
  if (USE_MOCK_COLLECTIONS) {
    store = orderedIds
      .map((id, i) => {
        const c = store.find((x) => x.id === id)
        return c ? { ...c, sort_order: i + 1 } : null
      })
      .filter(Boolean)
    return mockDelay(store)
  }
  // Backend expects { items: [{ id, displayOrder }] }, not a plain id list.
  const items = orderedIds.map((id, displayOrder) => ({ id, displayOrder }))
  return request('/admin/collections/reorder', { method: 'PATCH', body: { items } })
}

/**
 * Marks one gallery image as the collection's thumbnail. The backend clears
 * the flag on the collection's other images, so this is a "pick one", not a
 * toggle.
 */
export async function setCollectionThumbnail(collectionId, imageId) {
  if (USE_MOCK_COLLECTIONS) {
    store = store.map((c) =>
      c.id === collectionId
        ? {
            ...c,
            gallery: (c.gallery || []).map((i) => ({ ...i, is_thumbnail: i.id === imageId })),
          }
        : c
    )
    return mockDelay(null)
  }
  return request(`/admin/collections/${collectionId}/images/${imageId}/thumbnail`, { method: 'PATCH' })
}

export async function deleteCollectionGalleryImage(collectionId, imageId) {
  if (USE_MOCK_COLLECTIONS) {
    store = store.map((c) =>
      c.id === collectionId
        ? { ...c, gallery: (c.gallery || []).filter((i) => i.id !== imageId), images: Math.max(0, (c.images || 1) - 1) }
        : c
    )
    return mockDelay(null)
  }
  return request(`/admin/collections/${collectionId}/images/${imageId}`, { method: 'DELETE' })
}
