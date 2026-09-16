import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import * as dashboardService from '@/features/dashboard/dashboard.api.js'
import { classNames } from '@/utils/helpers.js'

// Same shared glass tokens as StatCard/Sidebar/Topbar (see global.css) —
// only the container gets glassed per the brief; chart colors, gold line,
// labels and grid all stay exactly as they were.
const CARD_GLASS = {
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  boxShadow: 'var(--glass-shadow)',
}

const PERIOD_OPTIONS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

export default function AnalyticsWidget() {
  const [period, setPeriod] = useState('week')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    dashboardService.getAnalytics(period).then((rows) => {
      if (!alive) return
      setData(rows)
      setLoading(false)
    })
    return () => { alive = false }
  }, [period])

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedLabel = PERIOD_OPTIONS.find((opt) => opt.value === period)?.label ?? 'This Week'

  return (
    <article
      style={CARD_GLASS}
      className="rounded-2xl p-4 text-ink-900"
    >
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Inquiry Trends</h2>
          <p className="text-xs text-ink-400 mt-0.5">Inquiry volume over time</p>
        </div>

        <div className="relative shrink-0" ref={wrapperRef}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-ink-900 hover:bg-white/10 transition-colors"
          >
            {selectedLabel}
            <ChevronDown size={14} className={classNames('transition-transform', open && 'rotate-180')} />
          </button>

          {open && (
            <ul
              className={classNames(
                'absolute right-0 mt-1.5 w-36 max-h-48 rounded-2xl border backdrop-blur-sm shadow-xl overflow-y-auto z-10',
                '[&::-webkit-scrollbar]:w-1.5',
                '[&::-webkit-scrollbar-track]:bg-transparent',
                '[&::-webkit-scrollbar-thumb]:bg-brass-300/40',
                '[&::-webkit-scrollbar-thumb]:rounded-full',
                '[&::-webkit-scrollbar-thumb:hover]:bg-brass-300/60'
              )}
              style={{
                background: 'var(--glass-fill-strong)',
                backdropFilter: 'blur(var(--glass-blur))',
                WebkitBackdropFilter: 'blur(var(--glass-blur))',
                borderColor: '#FFFFFF2E',
                scrollbarWidth: 'thin',
                scrollbarColor: '#D8C28766 transparent',
              }}
            >
              {PERIOD_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => { setPeriod(opt.value); setOpen(false) }}
                    className={classNames(
                      'w-full text-left px-3.5 py-2 text-xs transition-colors',
                      opt.value === period
                        ? 'bg-white/10 text-brass-700 font-medium'
                        : 'text-ink-600 hover:bg-white/10 hover:text-ink-900'
                    )}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="h-56 mt-2">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-ink-900/40">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="inquiryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D8C287" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#D8C287" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.15)" />

              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#b9d4d1', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b9d4d1', fontSize: 12 }} />

              <Tooltip
                contentStyle={{
                  background: '#0E2B26',
                  border: '1px solid rgba(216, 194, 135, 0.4)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '13px',
                }}
                labelStyle={{ color: '#D8C287', fontWeight: 600, marginBottom: 4 }}
                itemStyle={{ color: '#d7e6e2' }}
              />

              <Area
                type="monotone"
                dataKey="inquiries"
                stroke="#D8C287"
                strokeWidth={3}
                fill="url(#inquiryGradient)"
                dot={{ r: 4, fill: '#D8C287' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </article>
  )
}