import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gem, Building2, CalendarDays, MessagesSquare, ArrowUpRight, Plus } from 'lucide-react'
import { useGsapReveal } from '@/hooks/useGsapReveal.js'
import * as dashboardService from '@/features/dashboard/dashboard.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import Card from '@/components/ui/Card.jsx'
import StatCard from '@/components/ui/StatCard.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import AnalyticsWidget from '@/features/dashboard/components/AnalyticsWidget.jsx'
import { statusTone } from '@/utils/helpers.js'
import { timeAgo } from '@/utils/formatDate.js'

// Frosted glass treatment shared with StatCard / Sidebar / Topbar / Inquiry
// Trends (see .glass / --glass-* tokens in global.css) — used on the stat
// card loading skeleton, the Quick actions card, and the Recent inquiries
// card so all three read as one consistent glass system.
const CARD_GLASS = {
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  boxShadow: 'var(--glass-shadow)',
}

// Quick action pills — same "lit from within" glass treatment as
// TableToolbar's dark search input/select: translucent gradient fill, soft
// gold border + glow, now with backdrop-blur added so it actually frosts
// the glass card behind it instead of just tinting it.
const GLASS_PILL_CLASS =
  'backdrop-blur-md border border-brass-300/30 bg-gradient-to-br from-white/10 to-brass-300/10 shadow-[0_2px_10px_-2px_rgba(196,168,93,0.3)] hover:shadow-[0_3px_14px_-2px_rgba(196,168,93,0.4)] transition-shadow'

export default function DashboardPage() {
  const { notify } = useToast()
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    Promise.all([
      dashboardService.getStats(),
      dashboardService.getRecentInquiries(5),
    ]).then(([s, r]) => {
      if (!alive) return
      setStats(s)
      setRecent(r)
      setLoading(false)
    }).catch((err) => {
      if (!alive) return
      setError(err.message || 'Failed to load dashboard data.')
      setLoading(false)
      notify(err.message || 'Failed to load dashboard data.', { tone: 'error' })
    })
    return () => { alive = false }
  }, [notify])

  const statsRef = useGsapReveal([loading], { stagger: 0.08 })

  const cards = stats
    ? [
        { key: 'collections', label: 'Collections', icon: Gem, ...stats.collections, to: '/admin/collections' },
        { key: 'brands', label: 'Brands', icon: Building2, ...stats.brands, to: '/admin/brands' },
        { key: 'exhibitions', label: 'Exhibitions', icon: CalendarDays, ...stats.exhibitions, to: '/admin/exhibitions' },
        { key: 'inquiries', label: 'Inquiries', icon: MessagesSquare, ...stats.inquiries, to: '/admin/inquiries' },
      ]
    : []

  return (
    <div className="space-y-6">
      {error && !loading && (
        <div className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          Couldn't load dashboard data: {error}
        </div>
      )}
      {/* Steps through every breakpoint: 1 col (mobile) -> 2 col (sm/md,
          ~640-1023px) -> 4 col (lg and up, 1024px+). No more jump straight
          from sm to xl leaving a dead zone stuck at 2 columns. */}
      <div ref={statsRef} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? // Skeleton uses the same CARD_GLASS treatment as the real
            // StatCard instead of bg-ivory-200, so there's no flash of a
            // mismatched color before the real glass card appears —
            // animate-pulse just breathes the glass card in place.
            Array.from({ length: 4 }).map((_, i) => (
              <Card
                key={i}
                glass
                className="p-5 h-[104px] animate-pulse"
                style={CARD_GLASS}
              />
            ))
          : cards.map((c) => (
              <Link key={c.key} to={c.to}>
                <StatCard label={c.label} value={c.value} delta={c.delta} icon={c.icon} />
              </Link>
            ))}
      </div>

      {/* Same fix here: stacked on mobile/tablet, side-by-side from lg up,
          instead of staying stacked all the way to 1280px. */}
      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AnalyticsWidget />
          </div>

        <Card
          glass
          className="p-5 sm:p-6 text-ink-900 flex flex-col h-full"
          style={CARD_GLASS}
        >
          <h2 className="font-display text-base font-bold text-brass-100 mb-4">Quick actions</h2>
          <div className="flex flex-1 flex-col justify-between gap-2.5 h-[calc(100%-2.5rem)]">
            <QuickAction to="/admin/collections" label="Add a collection" icon={Plus} />
            <QuickAction to="/admin/brands" label="Add a brand" icon={Plus} />
            <QuickAction to="/admin/exhibitions" label="Add an exhibition" icon={Plus} />
            <QuickAction to="/admin/inquiries" label="Review inquiries" icon={ArrowUpRight} />
          </div>
        </Card>
      </div>

      {/* Now matches the gradient used above — same treatment applied to
          every list-page table (Collections, Brands, Exhibitions,
          Inquiries, SEO) via DataTable's dark default, so this stays
          consistent with the rest of the admin. */}
      <Card glass className="overflow-hidden dark-surface" style={CARD_GLASS}>
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-ink-100">
          <h2 className="font-display text-base font-bold text-ink-900">Recent inquiries</h2>
          {/* Routed through the shared Button component (variant="primary")
              instead of a one-off Link with its own duplicated gold
              gradient, so this stays in sync with every other primary
              action (Add collection, Add brand, etc.) automatically. */}
          <Button as={Link} to="/admin/inquiries" variant="primary" size="sm" className="rounded-full">
            View all
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="pj-table pj-table--dark">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Status</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>
                    <p className="text-ink-900 font-medium">{r.name}</p>
                    <p className="text-ink-400 text-xs">{r.email}</p>
                  </td>
                  <td className="text-ink-600">{r.company || '—'}</td>
                  <td><Badge dark tone={statusTone(r.status)}>{r.status}</Badge></td>
                  <td className="text-ink-400">{timeAgo(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// Restyled to match the search box's translucent glass pill: dark card
// showing through a subtle white-to-gold gradient, gold border + glow,
// ivory text — with a frosted circular icon badge (same glass fill as the
// card itself, so it reads as "cut into" the surface rather than a flat
// opaque disc). Icon nudges right on hover for a subtle arrow-forward feel.
function QuickAction({ to, label, icon: Icon }) {
  return (
    <Link
      to={to}
      className={`group flex items-center justify-between rounded-full pl-5 pr-1.5 py-1.5 text-sm font-medium text-brass-700 ${GLASS_PILL_CLASS}`}
    >
      {label}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brass-700 transition-transform duration-200 group-hover:translate-x-0.5"
        style={CARD_GLASS}
      >
        <Icon size={15} />
      </span>
    </Link>
  )
}