// Mock data — shaped to match the planned Prisma schema / API envelope so it
// swaps out for real endpoints with zero component changes. See services/api.js.

import {
  EXHIBITIONS as EXHIBITION_SEED,
  getRange,
  getStatus,
} from '@/features/exhibitions/data/exhibitions.js'

export const mockBrands = [
  { id: 'b1', name: 'Aara', slug: 'aara', description: 'Contemporary fine jewellery house.', logoUrl: '', sort_order: 1, isActive: true, collections: 4 },
  { id: 'b2', name: 'Vireya', slug: 'vireya', description: 'Botanical-inspired gold jewellery.', logoUrl: '', sort_order: 2, isActive: true, collections: 3 },
  { id: 'b3', name: 'Kohinoor House', slug: 'kohinoor-house', description: 'Heritage bridal and statement pieces.', logoUrl: '', sort_order: 3, isActive: true, collections: 6 },
  { id: 'b4', name: 'Sundari', slug: 'sundari', description: 'Everyday minimal gold jewellery.', logoUrl: '', sort_order: 4, isActive: false, collections: 1 },
]

export const mockCollections = [
  { id: 'c1', brandId: 'b1', name: 'Monsoon Bloom', slug: 'monsoon-bloom', description: 'Floral motifs in rose gold.', category: 'Rings', isActive: true, created_at: '2026-06-02', images: 8 },
  { id: 'c2', brandId: 'b2', name: 'Ember & Ash', slug: 'ember-ash', description: 'Smoked topaz statement pieces.', category: 'Necklaces', isActive: true, created_at: '2026-06-14', images: 5 },
  { id: 'c3', brandId: 'b3', name: 'Regal Line', slug: 'regal-line', description: 'Heritage bridal sets.', category: 'Bridal', isActive: false, created_at: '2026-07-01', images: 12 },
  { id: 'c4', brandId: 'b3', name: 'Meridian', slug: 'meridian', description: 'Minimal geometric gold.', category: 'Earrings', isActive: true, created_at: '2026-07-10', images: 6 },
  { id: 'c5', brandId: 'b1', name: 'Petal Drop', slug: 'petal-drop', description: 'Everyday earrings capsule.', category: 'Earrings', isActive: false, created_at: '2026-07-22', images: 3 },
]

// Seeded from src/data/exhibitions.js — the verified show details that the
// public /Exhibition page renders. Mapping here rather than keeping a second
// hand-written list means the admin table and the public page can never drift
// apart, and every rich field (edition, organiser, per-venue dates, why-we-
// exhibit, highlights) is editable rather than being frontend-only copy.
//
// `title` / `location` / `start_date` / `end_date` / `status` / `images` are
// kept alongside the rich fields because the admin DataTable columns and the
// status filter read those names.
export const mockExhibitions = EXHIBITION_SEED.map((item) => {
  const { start, end } = getRange(item)

  // Local calendar date, NOT toISOString(): getRange returns local midnight,
  // and toISOString converts to UTC — which in any timezone ahead of UTC
  // rolls the date back a day (IIJS showed 04 Aug instead of 05 Aug).
  const toISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`

  return {
    id: item.id,
    slug: item.id,

    // --- table / filter columns -------------------------------------------
    title: `${item.name} ${item.year}`,
    location: `${item.city}, ${item.region}`,
    start_date: toISO(start),
    end_date: toISO(end),
    status: getStatus(item).key === 'live' ? 'live' : getStatus(item).key,
    images: 0,
    image_url: item.logo,

    // --- everything the public page shows ---------------------------------
    name: item.name,
    year: item.year,
    edition: item.edition,
    logo: item.logo,
    organiser: item.organiser,
    city: item.city,
    region: item.region,
    audience: item.audience,
    hours: item.hours,
    venues: item.venues.map((v) => ({ ...v })),
    description: item.about,
    whyWeExhibit: item.whyWeExhibit,
    highlights: [...item.highlights],
    sources: [...item.sources],
    datesConfirmed: item.datesConfirmed,
  }
})

export const mockInquiries = [
  { id: 'i1', name: 'Rhea Malhotra', email: 'rhea@example.com', phone: '+91 98200 11122', type: 'collection', reference: 'Monsoon Bloom', message: 'Interested in wholesale pricing for the Monsoon Bloom line ahead of the festive season.', status: 'new', created_at: '2026-08-01T10:12:00' },
  { id: 'i2', name: 'Aditya Shah', email: 'aditya@bulkgems.in', phone: '+91 90040 55221', type: 'brand', reference: 'Kohinoor House', message: 'Would like to discuss a distribution partnership for the UAE market.', status: 'in_progress', created_at: '2026-07-30T15:40:00' },
  { id: 'i3', name: 'Meera Iyer', email: 'meera.iyer@gmail.com', phone: '+91 88888 44556', type: 'contact', reference: '—', message: 'General question about visiting the Surat showroom.', status: 'resolved', created_at: '2026-07-28T09:05:00' },
  { id: 'i4', name: 'Owen Clarke', email: 'owen@clarke-retail.co.uk', phone: '+44 7700 900123', type: 'exhibition', reference: 'IIJS Mumbai 2026', message: 'Requesting a meeting slot during IIJS Mumbai for buyer discussions.', status: 'new', created_at: '2026-08-02T18:22:00' },
]

export const mockDashboardStats = {
  collections: { value: 5, delta: '+2 this month' },
  brands: { value: 4, delta: '1 inactive' },
  exhibitions: { value: 3, delta: '2 upcoming' },
  inquiries: { value: 4, delta: '2 new' },
}

export const mockAnalyticsWeek = [
  { day: 'Mon', inquiries: 12 },
  { day: 'Tue', inquiries: 24 },
  { day: 'Wed', inquiries: 17 },
  { day: 'Thu', inquiries: 31 },
  { day: 'Fri', inquiries: 26 },
  { day: 'Sat', inquiries: 41 },
  { day: 'Sun', inquiries: 37 },
]

export const mockAnalyticsMonth = [
  { day: 'Week 1', inquiries: 68 },
  { day: 'Week 2', inquiries: 94 },
  { day: 'Week 3', inquiries: 77 },
  { day: 'Week 4', inquiries: 112 },
]

export const mockAnalyticsYear = [
  { day: 'Jan', inquiries: 210 }, { day: 'Feb', inquiries: 188 }, { day: 'Mar', inquiries: 240 },
  { day: 'Apr', inquiries: 265 }, { day: 'May', inquiries: 302 }, { day: 'Jun', inquiries: 289 },
  { day: 'Jul', inquiries: 340 }, { day: 'Aug', inquiries: 318 }, { day: 'Sep', inquiries: 275 },
  { day: 'Oct', inquiries: 355 }, { day: 'Nov', inquiries: 398 }, { day: 'Dec', inquiries: 421 },
]

export const mockAnalytics = mockAnalyticsWeek

// Shaped like the real SeoPage model (server/prisma/schema.prisma) rather
// than the old flat page_key/meta_title mock, so USE_MOCK_SEO=true still
// exercises the same normalizeSeoPage() path the real API responses go
// through — see services/seo.service.js.
export const mockSeo = [
  {
    id: 'seo1', displayName: 'Home', slug: 'home', entityType: 'STATIC_PAGE', entityId: null,
    metaTitle: 'Promise Jewel — Fine Jewellery Brands', metaDescription: 'Discover Promise Jewel\u2019s house of jewellery brands, collections, and exhibitions.',
    keywords: 'jewellery, fine jewellery, promise jewel', canonicalUrl: 'https://promisejewels.com/', robots: 'INDEX_FOLLOW',
    ogTitle: '', ogDescription: '', ogImage: '', twitterTitle: '', twitterDescription: '', twitterImage: '',
    schemaType: 'WEBSITE', priority: 1, changeFrequency: 'MONTHLY', includeInSitemap: true, isIndexed: true, isPublished: true,
    seoScore: 90, completedChecks: ['Meta Title', 'Meta Description', 'Canonical URL', 'Robots Policy', 'Schema Type', 'Included In Sitemap'],
    missingChecks: ['Open Graph Image', 'Twitter Image'], updatedAt: '2026-08-08T10:00:00Z',
  },
  {
    id: 'seo2', displayName: 'About', slug: 'about', entityType: 'STATIC_PAGE', entityId: null,
    metaTitle: 'About Promise Jewel', metaDescription: 'Craftsmanship and heritage behind Promise Jewel.',
    keywords: '', canonicalUrl: 'https://promisejewels.com/about', robots: 'INDEX_FOLLOW',
    ogTitle: '', ogDescription: '', ogImage: '', twitterTitle: '', twitterDescription: '', twitterImage: '',
    schemaType: 'ORGANIZATION', priority: 0.6, changeFrequency: 'YEARLY', includeInSitemap: true, isIndexed: true, isPublished: true,
    seoScore: 65, completedChecks: ['Meta Title', 'Meta Description', 'Canonical URL', 'Robots Policy'],
    missingChecks: ['Open Graph Image', 'Twitter Image', 'Schema Type'], updatedAt: '2026-08-07T09:00:00Z',
  },
]

export const mockSeoSettings = {
  id: 'settings1',
  siteName: 'Promise Jewels',
  siteUrl: 'https://promisejewels.com',
  defaultMetaTitle: 'Promise Jewels | Fine Jewellery',
  defaultMetaDescription: 'Discover Promise Jewels and explore our jewellery brands, collections and exhibitions.',
  titleTemplate: '%s | Promise Jewels',
  defaultCanonicalUrl: 'https://promisejewels.com',
  defaultOgImage: '',
  robots: 'INDEX_FOLLOW',
  googleVerification: '', bingVerification: '', yandexVerification: '', pinterestVerification: '',
  googleAnalyticsId: '', googleTagManagerId: '', facebookPixelId: '',
}

export const mockSettings = {
  site_name: 'Promise Jewels',
  contact_email: 'thepromisejewels@gmail.com',
  contact_phone: '+91 95966 62900',
  address:
    'Sy No- 311/5, Laxmi Niwas, 1st Floor, Plot No - 101, Vasta Devdi Rd, Katargam, Surat, Gujarat 395004',
  business_hours: 'Monday - Saturday\n10:00 AM - 7:00 PM\nSunday Closed',
  social: {
    instagram: 'https://www.instagram.com/promise_jewels_pvt_ltd?igsi=ZDNlZDc0MzIxNw==',
    facebook: 'https://www.facebook.com/share/18UKWe1KTg/',
    linkedin: 'https://www.linkedin.com/company/promise-jewels/posts/?feedView=all',
  },
}
