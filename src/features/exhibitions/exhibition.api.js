import request, { USE_MOCK_EXHIBITIONS, mockDelay } from '@/services/api/client.js'
import { mockExhibitions } from '@/services/mock/data.js'
import { generateSlug } from '@/utils/generateSlug.js'

let store = [...mockExhibitions]

// The real exhibitions model (server/prisma/schema.prisma) has no `status`
// or single `location` field the way the mock/UI do — it stores venue,
// city, country, startDate and endDate separately, plus featured/isActive
// booleans. This derives the two-value status the UI actually uses
// ('upcoming' | 'past') from endDate, and joins city/country into the
// single "City, Country" string the form and table already render.
function deriveStatus(startDate, endDate) {
  const now = new Date()
  if (startDate && now < new Date(startDate)) return 'upcoming'
  if (endDate && now > new Date(endDate)) return 'past'
  return 'live'
}
function joinLocation(city, country) {
  return [city, country].filter(Boolean).join(', ')
}

function splitLocation(location) {
  const [city, ...rest] = String(location || '').split(',').map((s) => s.trim())
  return { city: city || undefined, country: rest.join(', ') || undefined }
}

function asDate(value) {
  return value ? String(value).slice(0, 10) : undefined
}

/**
 * `venues` and `highlights` are nullable Json columns — rows created before
 * those columns existed, or through a form that skipped them, come back as
 * null. The public /Exhibition page maps over BOTH (and reads venues[0]), so
 * a null there took the whole page down to a blank screen. Every row is given
 * a usable array here instead.
 */
function toVenues(row) {
  if (Array.isArray(row.venues) && row.venues.length > 0) return row.venues

  // No per-hall schedule stored: treat the show as one venue spanning the
  // flat startDate/endDate pair, which every row does have.
  return [
    {
      name: row.venue || row.title || 'Venue to be announced',
      area: joinLocation(row.city, row.country),
      start: asDate(row.startDate ?? row.start_date),
      end: asDate(row.endDate ?? row.end_date),
    },
  ]
}

/**
 * Custom sections come back as the `exhibition_sections` relation (rows in
 * their own table, already ordered by displayOrder), each with its `fields`.
 *
 * The flat `{ title, fields: [{ label, value }] }` shape below is what the
 * admin form posts and what the public page renders, so mapping here means
 * neither of them has to know the relation exists.
 *
 * `row.customSections` is still read as a fallback: it is the legacy Json
 * column, and a record fetched from somewhere that has not been migrated
 * would otherwise lose its sections.
 *
 * Entries missing a heading are dropped rather than rendered — a block with
 * no title reads as a layout bug on the public page.
 */
function toCustomSections(row) {
  const source = Array.isArray(row.exhibition_sections)
    ? row.exhibition_sections
    : Array.isArray(row.customSections)
      ? row.customSections
      : []

  return source
    .filter((section) => section && section.title)
    .map((section) => ({
      title: section.title,
      fields: Array.isArray(section.fields)
        ? section.fields
            .filter((field) => field && field.label)
            .map((field) => ({ label: field.label, value: field.value ?? '' }))
        : [],
    }))
}

function toHighlights(row) {
  if (Array.isArray(row.highlights)) return row.highlights.filter(Boolean)
  // Tolerated because the column is free-form Json: a single admin-typed
  // block of text becomes one bullet per line.
  if (typeof row.highlights === 'string') {
    return row.highlights.split('\n').map((line) => line.trim()).filter(Boolean)
  }
  return []
}

/**
 * There is no `name` column — the admin form composes `title` as
 * "<name> <year>" on save and reads the name back out of the title on edit.
 * Without removing the year here, every save appended it again:
 *
 *   "IIJS BHARAT 2026" → "IIJS BHARAT 2026 2026" → "IIJS BHARAT 2026 2026 2026"
 *
 * and because the public page prints the name and the year as separate pieces,
 * the duplication showed up on the live site too. Stripping exactly one
 * trailing year makes the round-trip stable: name + year recomposes to the
 * same title it came from.
 *
 * Only the year the record actually carries is removed, so a show genuinely
 * called "ROOTZ 2025" keeps its name when its year is 2026.
 */
function stripTrailingYear(title, year) {
  if (!title || !year) return title
  const suffix = ` ${year}`
  if (!title.endsWith(suffix)) return title
  // Never strip the whole thing away — a title that IS just the year stays.
  return title.slice(0, -suffix.length).trim() || title
}

function normalizeExhibition(row) {
  if (!row) return row
  const gallery = row.gallery ?? (row.exhibition_images || []).map((img) => ({
    id: img.id,
    image_url: img.imageUrl,
    alt_text: img.altText,
  }))
  return {
    ...row,
    location: row.location ?? joinLocation(row.city, row.country),
    start_date: row.start_date ?? asDate(row.startDate),
    end_date: row.end_date ?? asDate(row.endDate),
    status: row.status ?? deriveStatus(row.startDate ?? row.start_date, row.endDate ?? row.end_date),
    image_url: row.image_url ?? row.thumbnailUrl,
    images: row.images ?? gallery.length,
    gallery,

    // ---- Shape the public /Exhibition page renders ----
    //
    // That page was written against src/features/exhibitions/data/
    // exhibitions.js, whose records use different names for the same things
    // (name/logo/about/region) and always carry venues + highlights arrays.
    // Filling them here means the page reads one shape whether a record came
    // from the seed file or from the admin panel.
    name: row.name ?? stripTrailingYear(row.title, row.year),
    logo: row.logo ?? row.thumbnailUrl,
    about: row.about ?? row.description,
    region: row.region ?? row.country,
    venues: toVenues(row),
    highlights: toHighlights(row),
    customSections: toCustomSections(row),
  }
}

// Maps the form shape (title/description/venue/location/start_date/
// end_date) to what createExhibitionSchema / updateExhibitionSchema
// actually accept. `status` isn't a real backend field — it's derived
// from dates on read — so it's intentionally dropped here.
function toBackendPayload(payload) {
  const { location, start_date, end_date, ...rest } = payload
  const backendFields = { ...rest }
  delete backendFields.status

  const { city, country } = splitLocation(location)

  return {
    ...backendFields,
    city,
    country,
    ...(start_date ? { startDate: start_date } : {}),
    ...(end_date ? { endDate: end_date } : {}),
  }
}
export async function listExhibitions({ search, status } = {}) {
  if (USE_MOCK_EXHIBITIONS) {
    let rows = [...store]
    if (search) rows = rows.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
    if (status) rows = rows.filter((e) => e.status === status)
    return mockDelay(rows)
  }
  // The backend has no status filter — 'upcoming'/'past' is derived
  // client-side from dates below — and search only exists as a separate
  // /exhibitions/search?keyword= endpoint, not a query param on the list
  // route, so route to whichever one the caller actually needs.
  const result = search
    ? await request('/exhibitions/search', { params: { keyword: search } })
    : await request('/exhibitions', { params: status ? { status } : {} }) 
  let rows = result.items.map(normalizeExhibition)
  return rows
}
/**
 * GET /exhibitions/:slug — one show, with its gallery and custom sections.
 *
 * Unauthenticated, and the only source the per-show page reads: nothing about
 * an exhibition is bundled with the site any more.
 *
 * Returns null when the slug is not a show, so the page can render a "not
 * found" state instead of treating an ordinary bad link as an error.
 */
export async function getPublicExhibition(slug) {
  if (USE_MOCK_EXHIBITIONS) {
    return mockDelay(normalizeExhibition(store.find((e) => e.slug === slug)) || null)
  }
  try {
    return normalizeExhibition(await request(`/exhibitions/${slug}`))
  } catch (err) {
    if (err.status === 404) return null
    throw err
  }
}

export async function createExhibition(payload) {
  if (USE_MOCK_EXHIBITIONS) {
    const row = {
      id: `e${Date.now()}`,
      slug: generateSlug(payload.title),
      status: 'upcoming',
      images: 0,
      ...payload,
    }
    store = [row, ...store]
    return mockDelay(row)
  }
  const row = await request('/exhibitions', { method: 'POST', body: toBackendPayload(payload) })
  return normalizeExhibition(row)
}

export async function updateExhibition(id, payload) {
  if (USE_MOCK_EXHIBITIONS) {
    store = store.map((e) => (e.id === id ? { ...e, ...payload } : e))
    return mockDelay(store.find((e) => e.id === id))
  }
  const row = await request(`/exhibitions/${id}`, { method: 'PATCH', body: toBackendPayload(payload) })
  return normalizeExhibition(row)
}

export async function deleteExhibition(id) {
  if (USE_MOCK_EXHIBITIONS) {
    store = store.filter((e) => e.id !== id)
    return mockDelay(null)
  }
  return request(`/exhibitions/${id}`, { method: 'DELETE' })
}

export async function uploadExhibitionGalleryImage(id, file) {
  if (USE_MOCK_EXHIBITIONS) {
    const image = { id: `img${Date.now()}`, image_url: URL.createObjectURL(file) }
    store = store.map((e) =>
      e.id === id ? { ...e, gallery: [...(e.gallery || []), image], images: (e.images || 0) + 1 } : e
    )
    return mockDelay(image)
  }
  const formData = new FormData()
  formData.append('image', file)
  const image = await request(`/exhibitions/${id}/gallery`, { method: 'POST', body: formData })
  return { id: image.id, image_url: image.imageUrl, alt_text: image.altText }
}

export async function deleteExhibitionGalleryImage(exhibitionId, imageId) {
  if (USE_MOCK_EXHIBITIONS) {
    store = store.map((e) =>
      e.id === exhibitionId
        ? { ...e, gallery: (e.gallery || []).filter((i) => i.id !== imageId), images: Math.max(0, (e.images || 1) - 1) }
        : e
    )
    return mockDelay(null)
  }
  // Backend mounts this at /exhibitions/gallery/:imageId (not nested under
  // the exhibition id) — exhibitionId is only needed for the mock branch.
  return request(`/exhibitions/gallery/${imageId}`, { method: 'DELETE' })
}
export async function uploadExhibitionImage(id, file) {
  if (USE_MOCK_EXHIBITIONS) {
    const url = URL.createObjectURL(file)
    store = store.map((e) => (e.id === id ? { ...e, image_url: url } : e))
    return mockDelay({ image_url: url })
  }
  const formData = new FormData()
  formData.append('image', file)
  // Real route is /thumbnail, not /image, and returns { thumbnailUrl }.
  const result = await request(`/exhibitions/${id}/thumbnail`, { method: 'POST', body: formData })
  return { image_url: result.thumbnailUrl }
}
