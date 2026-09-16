import request, { USE_MOCK, mockDelay } from '@/services/api/client.js'
import { mockDashboardStats, mockAnalyticsWeek, mockAnalyticsMonth, mockAnalyticsYear } from '@/services/mock/data.js'
import { listInquiries } from '@/features/inquiries/inquiry.api.js'

// Chart x-axis labels only need day + month (e.g. "05 Aug"), not the
// full formatDate() output (which always includes the year).
function formatChartDay(isoDate) {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

// The real backend exposes ONE consolidated endpoint —
//   GET /api/v1/dashboard?period=week|month|year
// returning { summary, inquiryTrends, recentInquiries } in a single
// payload (see server/src/modules/dashboard). getStats/getRecentInquiries/
// getAnalytics below keep their old three-function shape so no page
// component needs to change, but they all read from this one fetch.
//
// A short in-flight cache (keyed by period) means calling getStats() and
// getRecentInquiries() back-to-back for the same period — which
// DashboardPage.jsx does via Promise.all — only hits the network once.
const inFlight = new Map()

function fetchDashboard(period = 'week') {
  if (USE_MOCK) return null // callers branch on USE_MOCK themselves below
  if (!inFlight.has(period)) {
    const promise = request('/dashboard', { params: { period } }).finally(() => {
      // Drop the cache entry once settled so a later call (e.g. switching
      // period, or a fresh page load) re-fetches instead of reusing stale data.
      setTimeout(() => inFlight.delete(period), 0)
    })
    inFlight.set(period, promise)
  }
  return inFlight.get(period)
}

// summary.collections/{brands,exhibitions,inquiries} come back as raw
// counts ({ total, thisMonth } etc.) — reshape into the { value, delta }
// pairs StatCard/DashboardPage expect, matching the old mock's wording.
function toStatCards(summary) {
  return {
    collections: { value: summary.collections.total, delta: `+${summary.collections.thisMonth} this month` },
    brands: { value: summary.brands.total, delta: `${summary.brands.inactive} inactive` },
    exhibitions: { value: summary.exhibitions.total, delta: `${summary.exhibitions.upcoming} upcoming` },
    inquiries: { value: summary.inquiries.total, delta: `${summary.inquiries.new} new` },
  }
}

// The current Inquiry model has no type/reference columns (see
// inquiry.service.js), and the backend returns createdAt (camelCase) —
// normalize to created_at so DashboardPage's table (which still reads
// r.created_at) needs no changes.
function toRecentInquiry(r) {
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

export async function getStats() {
  if (USE_MOCK) return mockDelay(mockDashboardStats)
  const { summary } = await fetchDashboard('week')
  return toStatCards(summary)
}

export async function getRecentInquiries(limit = 5) {
  if (USE_MOCK) {
    const rows = await listInquiries({})
    return rows.slice(0, limit)
  }
  const { recentInquiries } = await fetchDashboard('week')
  return recentInquiries.slice(0, limit).map(toRecentInquiry)
}

const ANALYTICS_BY_RANGE = {
  week: mockAnalyticsWeek,
  month: mockAnalyticsMonth,
  year: mockAnalyticsYear,
}

export async function getAnalytics(range = 'week') {
  if (USE_MOCK) return mockDelay(ANALYTICS_BY_RANGE[range] || mockAnalyticsWeek, 250)
  const { inquiryTrends } = await fetchDashboard(range)
  // inquiryTrends: [{ date: '2026-08-05', count: 12 }, ...] ->
  // recharts reads dataKey="day" / dataKey="inquiries" (see AnalyticsWidget.jsx)
  return inquiryTrends.map((t) => ({
    day: formatChartDay(t.date),
    inquiries: t.count,
  }))
}