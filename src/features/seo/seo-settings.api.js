import request, { USE_MOCK_SEO_SETTINGS, mockDelay } from '@/services/api/client.js'
import { mockSeoSettings } from '@/services/mock/data.js'

let store = { ...mockSeoSettings }

// GET /seo-settings — server/src/modules/seo-settings. There's exactly one
// row (SeoSettingsService.get() lazily creates it on first fetch if
// missing), so this always resolves to a single settings object, not a
// list.
export async function getSeoSettings() {
  if (USE_MOCK_SEO_SETTINGS) return mockDelay({ ...store })
  return request('/seo-settings')
}

// PATCH /seo-settings. Sends the full UpdateSeoSettingsInput shape
// (server/src/modules/seo-settings/seo-settings.validation.ts) — required
// fields (siteName, siteUrl, defaultMetaTitle, defaultMetaDescription,
// robots) always included, optional verification/analytics/template
// fields sent as empty strings rather than omitted so clearing a field in
// the form actually clears it on the backend instead of leaving the old
// value untouched.
export async function updateSeoSettings(payload) {
  const body = {
    siteName: payload.siteName,
    siteUrl: payload.siteUrl,
    defaultMetaTitle: payload.defaultMetaTitle,
    defaultMetaDescription: payload.defaultMetaDescription,
    titleTemplate: payload.titleTemplate || '',
    defaultCanonicalUrl: payload.defaultCanonicalUrl || '',
    defaultOgImage: payload.defaultOgImage || '',
    robots: payload.robots,
    googleVerification: payload.googleVerification || '',
    bingVerification: payload.bingVerification || '',
    yandexVerification: payload.yandexVerification || '',
    pinterestVerification: payload.pinterestVerification || '',
    googleAnalyticsId: payload.googleAnalyticsId || '',
    googleTagManagerId: payload.googleTagManagerId || '',
    facebookPixelId: payload.facebookPixelId || '',
  }

  if (USE_MOCK_SEO_SETTINGS) {
    store = { ...store, ...body }
    return mockDelay({ ...store })
  }
  return request('/seo-settings', { method: 'PATCH', body })
}
