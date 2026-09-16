import request, { USE_MOCK_SEO, USE_MOCK_SEO_SETTINGS, BASE_URL, mockDelay } from '@/services/api/client.js'
import { mockSeo, mockSeoSettings } from '@/services/mock/data.js'

let store = [...mockSeo]
let settingsStore = { ...mockSeoSettings }

// ---------------------------------------------------------------------
// SEO Pages (/seo, /seo/:id) — server/src/modules/seo
//
// The real SeoPage model (server/prisma/schema.prisma) already matches
// what the admin UI needs field-for-field, so this mostly passes data
// straight through. The one adapter is `keywords`: the backend stores
// these as a normalized SeoTag[] relation and returns them pre-joined as
// a comma-separated string (see seoResponse.builder.ts), but the edit
// form wants an array of chips to add/remove — normalizeSeoPage splits
// that string on load, and updateSeoPage joins the array back before
// sending (the backend accepts `tags` as a string OR string[], see
// seo.service.ts#normalizeTags).
function normalizeSeoPage(row) {
  if (!row) return row
  return {
    ...row,
    keywordList: row.keywordList ?? (row.keywords ? row.keywords.split(',').map((k) => k.trim()).filter(Boolean) : []),
  }
}

export async function getSeoPages() {
  if (USE_MOCK_SEO) return mockDelay(store.map(normalizeSeoPage))
  // GET /seo (bulk list) only returns id/displayName/slug/entityType/
  // seoScore/updatedAt — no metaTitle/isPublished/includeInSitemap — so
  // the admin table (which shows SEO title + status + sitemap columns)
  // needs a GET /seo/:id per page for the fields it displays.
  const pages = await request('/seo')
  const details = await Promise.all(pages.map((p) => request(`/seo/${p.id}`)))
  return details.map(normalizeSeoPage)
}

export async function getSeoPage(id) {
  if (USE_MOCK_SEO) return mockDelay(normalizeSeoPage(store.find((p) => p.id === id)))
  const page = await request(`/seo/${id}`)
  return normalizeSeoPage(page)
}

// Only forwards fields the backend's UpdateSeoDto actually accepts
// (server/src/modules/seo/seo.types.ts). displayName/slug/entityType/
// entityId are deliberately excluded — those are owned by the linked
// Brand/Collection/Exhibition (or the static-page record itself) and are
// kept in sync by the backend automatically (see seo.service.ts#
// updateByEntity), so the admin edit form renders them read-only and
// never sends them back.
export async function updateSeoPage(id, payload) {
  const body = {
    metaTitle: payload.metaTitle,
    metaDescription: payload.metaDescription,
    canonicalUrl: payload.canonicalUrl || undefined,
    robots: payload.robots,
    ogTitle: payload.ogTitle || undefined,
    ogDescription: payload.ogDescription || undefined,
    ogImage: payload.ogImage || undefined,
    twitterTitle: payload.twitterTitle || undefined,
    twitterDescription: payload.twitterDescription || undefined,
    twitterImage: payload.twitterImage || undefined,
    schemaType: payload.schemaType || undefined,
    priority: payload.priority !== '' && payload.priority !== undefined ? Number(payload.priority) : undefined,
    changeFrequency: payload.changeFrequency || undefined,
    includeInSitemap: payload.includeInSitemap,
    isIndexed: payload.isIndexed,
    isPublished: payload.isPublished,
    // Backend accepts tags as string | string[] and normalizes/dedupes
    // them itself (seo.service.ts#normalizeTags) — sending the array
    // straight through is fine.
    tags: payload.keywordList,
  }

  if (USE_MOCK_SEO) {
    store = store.map((p) => (p.id === id ? { ...p, ...body, keywords: (body.tags || []).join(', ') } : p))
    return mockDelay(normalizeSeoPage(store.find((p) => p.id === id)))
  }

  const page = await request(`/seo/${id}`, { method: 'PATCH', body })
  return normalizeSeoPage(page)
}

// ---------------------------------------------------------------------
// SEO Settings (/seo-settings) — server/src/modules/seo-settings

export async function getSeoSettings() {
  if (USE_MOCK_SEO_SETTINGS) return mockDelay({ ...settingsStore })
  return request('/seo-settings')
}

export async function updateSeoSettings(payload) {
  const body = {
    siteName: payload.siteName,
    siteUrl: payload.siteUrl,
    defaultMetaTitle: payload.defaultMetaTitle,
    defaultMetaDescription: payload.defaultMetaDescription,
    titleTemplate: payload.titleTemplate || undefined,
    defaultCanonicalUrl: payload.defaultCanonicalUrl || undefined,
    defaultOgImage: payload.defaultOgImage || undefined,
    robots: payload.robots,
    googleVerification: payload.googleVerification || undefined,
    bingVerification: payload.bingVerification || undefined,
    yandexVerification: payload.yandexVerification || undefined,
    pinterestVerification: payload.pinterestVerification || undefined,
    googleAnalyticsId: payload.googleAnalyticsId || undefined,
    googleTagManagerId: payload.googleTagManagerId || undefined,
    facebookPixelId: payload.facebookPixelId || undefined,
  }

  if (USE_MOCK_SEO_SETTINGS) {
    settingsStore = { ...settingsStore, ...body }
    return mockDelay({ ...settingsStore })
  }

  return request('/seo-settings', { method: 'PATCH', body })
}

// ---------------------------------------------------------------------
// Public metadata (/metadata/:slug) — server/src/modules/seo/public
//
// seo.public.routes.ts is mounted at "/" (not under an authenticated
// prefix) and its controller responds with the raw metadata object
// directly (`res.json(metadata)`), not the { success, data, message }
// envelope every other route uses — so this can't go through the shared
// request() helper, which unwraps `envelope.data`. Plain fetch instead.
export async function getPublicMetadata(slug) {
  const res = await fetch(`${BASE_URL}/metadata/${slug}`, { credentials: 'include' })
  if (!res.ok) {
    const err = new Error(`Failed to load metadata for "${slug}" (${res.status})`)
    err.status = res.status
    throw err
  }
  return res.json()
}
