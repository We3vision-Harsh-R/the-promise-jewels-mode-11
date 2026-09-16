import { classNames } from '@/utils/helpers.js'

const toneClasses = {
  emerald: 'bg-emerald/10 text-emerald border-emerald/20',
  brass: 'bg-brass-100 text-[#6E5730] border-brass-300/60',
  rose: 'bg-rose/10 text-rose border-rose/20',
  ink: 'bg-ink-50 text-ink-600 border-ink-100',
}

// These were tuned for teal gradient cards, but every card that passes
// `dark` renders WHITE — so the pale mint/pink text measured 1.4:1 and 1.81:1
// against it. Chips keep their translucent fill (background untouched); only
// the text and hairline are darkened enough to read.
const darkToneClasses = {
  emerald: 'bg-emerald/10 text-emerald border-emerald/25',
  brass: 'bg-brass-100 text-[#6E5730] border-brass-300/60',
  rose: 'bg-rose/10 text-rose border-rose/25',
  ink: 'bg-ink-50 text-ink-600 border-ink-100',
}

const labels = {
  published: 'Published', draft: 'Draft', active: 'Active', inactive: 'Inactive',
  upcoming: 'Upcoming', past: 'Past', new: 'New', in_progress: 'In progress', resolved: 'Resolved',
}

export default function Badge({ tone = 'ink', dark = false, children, className }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide px-2.5 py-1 rounded-full border',
        (dark ? darkToneClasses : toneClasses)[tone],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[children] || children}
    </span>
  )
}
