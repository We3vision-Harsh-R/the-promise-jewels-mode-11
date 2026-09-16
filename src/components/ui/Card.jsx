import { classNames } from '@/utils/helpers.js'

// `glass` opts a Card instance out of the default 'bg-white border ...'
// classes. Necessary because Bootstrap ships `.bg-white` / `.border-0`
// utilities with the SAME class names as Tailwind's, marked !important
// (see global.css's note on this) — those were silently overriding the
// inline glass background/border passed in by StatCard.jsx and
// DashboardPage.jsx's Quick actions/Recent inquiries/skeleton cards,
// which is why they rendered as opaque light cards instead of the dark
// glass AnalyticsWidget already showed correctly (it doesn't use Card.jsx,
// so it never had a colliding 'bg-white' class to begin with). Default
// (glass=false) is byte-for-byte the original behavior — every other
// Card usage across the app is unaffected.
export default function Card({ children, className, facet = false, as: As = 'div', glass = false, ...props }) {
  return (
    <As
      className={classNames(
        // `pj-card` gives the default card the same glass material as every
        // other admin surface (see globals.css). It is scoped to
        // .admin-theme there, so a Card rendered on the public site keeps the
        // plain white treatment these utilities already provide.
        glass ? 'rounded-card' : 'pj-card bg-white border border-ink-100 rounded-card shadow-card',
        facet && 'facet',
        className
      )}
      {...props}
    >
      {children}
    </As>
  )
}