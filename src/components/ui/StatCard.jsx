import { ArrowUpRight } from 'lucide-react'
import Card from '@/components/ui/Card.jsx'

// Frosted glass treatment — same shared tokens as the sidebar rail, Topbar
// search pill, Inquiry Trends and Quick actions/Recent inquiries cards
// (see .glass / --glass-* in global.css) so every Dashboard surface reads
// as one consistent glass system.
const CARD_GLASS = {
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  boxShadow: 'var(--glass-shadow)',
}

// The number is the point of this card, so it gets the size and the label
// gets out of its way: sentence case, regular weight, no tracking. The icon
// badge is quiet (hairline ring) and the arrow only shows on hover/focus to
// say "this opens the list" — the whole card is the link.
export default function StatCard({ label, value, delta, icon: Icon }) {
  return (
    <Card
      glass
      className="glass-hover group p-5 relative overflow-hidden text-ink-900"
      style={CARD_GLASS}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-brass-700">{label}</p>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brass-300/40 bg-gradient-to-br from-white/10 to-brass-300/10 text-brass-700">
            <Icon size={18} strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <p className="font-display text-4xl leading-none tabular-nums text-brass-100">{value}</p>
          {delta && <p className="text-xs text-brass-700 truncate">{delta}</p>}
        </div>
        <ArrowUpRight
          size={16}
          aria-hidden="true"
          className="shrink-0 text-brass-700 opacity-0 -translate-x-1 translate-y-1 transition duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 group-focus-visible/link:opacity-100 group-focus-visible/link:translate-x-0 group-focus-visible/link:translate-y-0"
        />
      </div>
    </Card>
  )
}
