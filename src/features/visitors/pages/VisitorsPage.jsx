import { useCallback, useEffect, useMemo, useState } from 'react'
import { Globe2, MonitorSmartphone, Smartphone, Tablet, Users, Link2, FileText } from 'lucide-react'
import Card from '@/components/ui/Card.jsx'
import { classNames } from '@/utils/helpers.js'
import { getLiveVisitors, getVisitorSummary } from '@/features/visitors/visitor.api.js'

// Who is on the website, and where they are. The live board is polled every few
// seconds from the server's memory (cheap); the history is read from the
// database and refreshed less often.

const LIVE_EVERY_MS = 8000
const SUMMARY_EVERY_MS = 60000

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

const PAGE_NAMES = {
  '/': 'Home',
  '/AboutPage': 'About',
  '/our-brand': 'Brands',
  '/our-collection': 'Collections',
  '/contact': 'Contact',
  '/Exhibition': 'Exhibitions',
  '/blog': 'Blog',
}

/** "/our-collection/rings" -> "Collection · rings". Anything unknown shows its path. */
function pageName(path) {
  if (PAGE_NAMES[path]) return PAGE_NAMES[path]
  if (path.startsWith('/our-collection/')) return `Collection · ${path.split('/')[2]}`
  if (path.startsWith('/Exhibition/')) return `Show · ${path.split('/')[2]}`
  if (path.startsWith('/blog/')) return `Post · ${path.split('/')[2]}`
  return path
}

const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

function countryName(code) {
  if (!code) return 'Unknown'
  try {
    return regionNames?.of(code) || code
  } catch {
    return code
  }
}

/**
 * The country's two-letter code in a small tag. Flag emoji would be prettier,
 * but Windows draws them as bare letters, so the tag is the same on every device.
 */
function CountryTag({ code }) {
  return (
    <span className="inline-block min-w-[1.6rem] rounded bg-black/25 px-1 text-center text-[10px] font-bold leading-4 tracking-wide">
      {code || '??'}
    </span>
  )
}

/** The same visitor always gets the same colour, like a cursor in a shared design file. */
function colourFor(label) {
  let hash = 0
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${hash} 70% 52%)`
}

function DeviceIcon({ device, className }) {
  if (device === 'mobile') return <Smartphone className={className} />
  if (device === 'tablet') return <Tablet className={className} />
  return <MonitorSmartphone className={className} />
}

function duration(seconds) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  return `${m}m ${seconds % 60}s`
}

/** One visitor, drawn as a labelled cursor. */
function Cursor({ visitor }) {
  const colour = colourFor(visitor.label)
  return (
    <div
      className="flex items-start gap-1.5"
      title={`${countryName(visitor.country)} · ${visitor.device} · ${visitor.pageViews} page${visitor.pageViews === 1 ? '' : 's'} viewed · here ${duration(visitor.secondsOnSite)}${visitor.referrer ? ` · from ${visitor.referrer}` : ''}`}
    >
      <svg width="18" height="20" viewBox="0 0 18 20" fill={colour} aria-hidden="true" className="mt-0.5 shrink-0 drop-shadow">
        <path d="M1 1l14 7.2-6 1.8-2.2 6.4L1 1z" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
      <span
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white shadow"
        style={{ background: colour }}
      >
        <CountryTag code={visitor.country} />
        {countryName(visitor.country)}
        <DeviceIcon device={visitor.device} className="h-3 w-3 opacity-80" />
        <span className="opacity-70">{visitor.label}</span>
      </span>
    </div>
  )
}

function Bar({ label, value, max, right }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-ink-500">{right ?? value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100/60">
        <div className="h-full rounded-full bg-brass-300" style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  )
}

export default function VisitorsPage() {
  const [days, setDays] = useState(7)
  const [live, setLive] = useState(null)
  // Kept with the range it was fetched for, so changing the range shows
  // "Loading…" without resetting state from inside an effect.
  const [loaded, setLoaded] = useState(null)
  const summary = loaded?.days === days ? loaded.data : null
  const [error, setError] = useState('')

  const loadLive = useCallback(() => {
    getLiveVisitors()
      .then((data) => {
        setLive(data)
        setError('')
      })
      .catch((err) => setError(err.message || 'Could not load live visitors.'))
  }, [])

  useEffect(() => {
    loadLive()
    const timer = window.setInterval(loadLive, LIVE_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [loadLive])

  useEffect(() => {
    let alive = true
    const load = () =>
      getVisitorSummary(days)
        .then((data) => alive && setLoaded({ days, data }))
        .catch((err) => alive && setError(err.message || 'Could not load visitor history.'))

    load()
    const timer = window.setInterval(load, SUMMARY_EVERY_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [days])

  // Swimlanes: one column per page, a cursor per person standing on it.
  const lanes = useMemo(() => {
    const byPage = new Map()
    for (const visitor of live?.visitors ?? []) {
      if (!byPage.has(visitor.page)) byPage.set(visitor.page, [])
      byPage.get(visitor.page).push(visitor)
    }
    return [...byPage.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [live])

  const liveCountries = useMemo(() => new Set((live?.visitors ?? []).map((v) => v.country || '??')).size, [live])
  const maxCountry = summary?.countries?.[0]?.visitors ?? 0
  const maxPage = summary?.pages?.[0]?.views ?? 0
  const maxDay = Math.max(1, ...(summary?.daily ?? []).map((d) => d.visitors))

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            On the website now
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{live ? live.total : '—'}</p>
          <p className="mt-1 text-xs text-ink-400">active in the last {live ? Math.round(live.windowSeconds / 60) : 2} minutes</p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm text-ink-500"><Globe2 className="h-4 w-4" /> Countries online now</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{live ? liveCountries : '—'}</p>
          <p className="mt-1 text-xs text-ink-400">places the current visitors are in</p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm text-ink-500"><Users className="h-4 w-4" /> Visitors, {RANGES.find((r) => r.days === days)?.label.toLowerCase()}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{summary ? summary.visitors : '—'}</p>
          <p className="mt-1 text-xs text-ink-400">separate visits, bots left out</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Who is where</h2>
          <p className="text-xs text-ink-400">Updates every few seconds. Hover a cursor for details.</p>
        </div>

        {!live ? (
          <p className="py-8 text-center text-sm text-ink-400">Loading…</p>
        ) : lanes.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">Nobody is on the website right now.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lanes.map(([page, people]) => (
              <div key={page} className="rounded-xl border border-ink-100/70 bg-ink-50/40 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                    <span className="truncate">{pageName(page)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-xs tabular-nums text-ink-600">{people.length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {people.map((visitor) => (
                    <Cursor key={`${visitor.label}-${visitor.secondsOnSite}-${page}`} visitor={visitor} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((range) => (
          <button
            key={range.days}
            type="button"
            onClick={() => setDays(range.days)}
            className={classNames(
              'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
              range.days === days ? 'border-brass-300 bg-brass-300/20 font-medium' : 'border-ink-100 hover:bg-ink-50',
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><Globe2 className="h-4 w-4" /> Countries</h2>
          {!summary ? (
            <p className="py-6 text-center text-sm text-ink-400">Loading…</p>
          ) : summary.countries.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">No visits in this period yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.countries.map((row) => (
                <Bar
                  key={row.country || 'unknown'}
                  label={<span className="flex items-center gap-2"><CountryTag code={row.country} />{countryName(row.country)}</span>}
                  value={row.visitors}
                  max={maxCountry}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><FileText className="h-4 w-4" /> Most viewed pages</h2>
          {!summary ? (
            <p className="py-6 text-center text-sm text-ink-400">Loading…</p>
          ) : summary.pages.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">No page views in this period yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.pages.map((row) => (
                <Bar key={row.page} label={pageName(row.page)} value={row.views} max={maxPage} right={`${row.views} views`} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold">Visitors per day</h2>
          {!summary || summary.daily.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">{summary ? 'No visits in this period yet.' : 'Loading…'}</p>
          ) : (
            <div className="flex h-32 items-end gap-1">
              {summary.daily.map((row) => (
                <div key={row.day} className="group relative flex h-full flex-1 items-end" title={`${row.day}: ${row.visitors}`}>
                  <div className="w-full rounded-t bg-brass-300/80" style={{ height: `${Math.max(4, (row.visitors / maxDay) * 100)}%` }} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><Link2 className="h-4 w-4" /> Devices and where they came from</h2>
          {!summary ? (
            <p className="py-6 text-center text-sm text-ink-400">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {summary.devices.map((row) => (
                  <span key={row.device} className="flex items-center gap-1.5 rounded-full border border-ink-100 px-3 py-1 text-sm">
                    <DeviceIcon device={row.device} className="h-3.5 w-3.5" />
                    {row.device} · {row.visitors}
                  </span>
                ))}
              </div>
              {summary.sources.length === 0 ? (
                <p className="text-sm text-ink-400">Most visits arrived directly, so there is no referring site to list.</p>
              ) : (
                <div className="space-y-3">
                  {summary.sources.map((row) => (
                    <Bar key={row.source} label={row.source} value={row.visitors} max={summary.sources[0].visitors} />
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
