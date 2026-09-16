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

export default function StatCard({ label, value, delta, icon: Icon }) {
  return (
    <Card
      glass
      className="glass-hover p-4 relative overflow-hidden text-ink-900"
      style={CARD_GLASS}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-wide text-brass-700/90">{label}</p>
        {Icon && (
          // Rounded-square glass badge with a soft gold glow — same
          // "lit from within" gradient + shadow language as the dark
          // search pill / filter selects (see darkPillClass in
          // TableToolbar.jsx), applied here at icon-badge scale.
          // Bumped from h-9/w-9 to h-12/w-12 (and icon 16 -> 20) so the
          // badge reads clearly at a glance instead of getting lost next
          // to the label; border thickened to border-2 and brightened
          // from /40 to /70 opacity so the gold ring is actually visible
          // rather than blending into the teal card.
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-brass-300/60 bg-gradient-to-br from-white/10 to-brass-300/10 text-brass-700 shadow-[0_0_8px_-3px_rgba(196,168,93,0.28)]">
            <Icon size={20} strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-display text-3xl leading-none text-brass-100">{value}</p>
        {delta && <p className="text-xs text-brass-700">{delta}</p>}
      </div>
    </Card>
  )
}