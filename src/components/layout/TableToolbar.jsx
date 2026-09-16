import { cloneElement, isValidElement } from 'react'
import { Search } from 'lucide-react'

// Translucent white gradient + soft neutral shadow + real backdrop-blur, so
// the pill reads as actual frosted glass (matching the Dashboard's
// GLASS_PILL_CLASS treatment) rather than just a flat translucent tint.
const darkPillClass =
  'rounded-full !border !border-white/15 !bg-gradient-to-br !from-white/10 !to-white/5 !backdrop-blur-md !text-ink-900 !shadow-[0_2px_10px_-2px_rgba(0,0,0,0.3)] hover:!shadow-[0_3px_14px_-2px_rgba(0,0,0,0.35)] !transition-shadow'

// A <select>'s open option list is painted by the browser's own OS chrome
// (solid white/light in every major browser) — CSS on the element can't
// override that layout, but background-color/color on individual <option>
// tags IS respected by Chrome/Edge, so each page pairs this class with
// darkOptionStyle below on its own <option> elements to keep the open
// list on-brand too. The closed trigger itself CAN take a real backdrop-
// blur (see darkSelectGlassStyle below), so only this native option-list
// exception stays a flat solid color.
//
// This is the single source of truth for every status-style filter
// <Select> across the admin — change it here and every page using
// TableToolbar's `filters` + `dark` prop follows.
const darkSelectClass =
  '!w-auto !rounded-lg !border !border-white/15 !text-ink-900 !font-semibold !shadow-lg !backdrop-blur-md focus:!ring-white/20 focus:!border-white/20 focus:!outline-none'

// Same frosted-glass tokens as every other glass surface in the admin (see
// .glass-strong / --glass-* in global.css) — applied via inline style
// (merged in below) since a multi-layer CSS custom property like
// var(--glass-fill-strong) can't be expressed as a Tailwind arbitrary
// class (its comma-separated gradient layers break the bracket-notation
// parser). Kept local rather than the .glass-strong class itself because
// this needs to layer onto whatever the caller's own className already is.
const darkSelectGlassStyle = {
  background: 'var(--glass-fill-strong)',
  boxShadow: 'var(--glass-shadow)',
}

// Pair with the class above on each <option> in a page's filter Select —
// e.g. <option style={darkOptionStyle}>Active</option> — so the native
// open list (which ignores the class above) still reads dark teal +
// golden text instead of the browser's default white/black.
export const darkOptionStyle = { backgroundColor: '#0E4238', color: '#D8C287' }

export default function TableToolbar({ search, onSearchChange, placeholder = 'Search…', filters, actions, dark = false }) {
  // Filters (typically a status/type <Select>) are handed in by each page
  // using the shared Field.jsx Select, which defaults to a plain light
  // bg-ivory-100 box — correct on a white form, but a jarring plain white
  // rectangle on a dark toolbar. When dark, re-theme it with darkSelectClass
  // (the teal-gradient/gold-text card above) instead of asking every page
  // to remember to pass dark-specific classes themselves.
  //
  // Components that already theme themselves for dark toolbars (e.g.
  // StatusFilterDropdown, flagged via a static `isSelfThemed = true`)
  // are skipped here. darkSelectClass's className merge lands on
  // whatever element `filters` renders as — for a plain <select> that's
  // the input itself, but for a custom component like
  // StatusFilterDropdown the className prop only reaches its *outer
  // wrapper div*, not the pill button. That mismatch painted a second,
  // rectangular teal/shadow box behind the rounded pill.
  const skipTheming = isValidElement(filters) && filters.type?.isSelfThemed
  const themedFilters =
    dark && isValidElement(filters) && !skipTheming
      ? cloneElement(filters, {
          className: [filters.props.className, darkSelectClass].filter(Boolean).join(' '),
          style: { ...filters.props.style, ...darkSelectGlassStyle },
        })
      : filters

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* items-center: without it, this row defaults to align-items:
          stretch, so the search wrapper and the filter (StatusFilterDropdown
          or <select>) get stretched to match each other's height instead of
          sharing one vertical center — that's what pushed them out of line. */}
      <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
        {/* search-pill class hooks into the global focus-visible opt-out in
            the admin theme CSS (.admin-theme .search-pill input:focus-visible
            { outline: none }) — without it, this input still gets the
            site-wide gold focus-visible outline defined on every
            input/button, even though darkPillClass itself carries no gold. */}
        <div className={`relative w-full sm:max-w-xs ${dark ? 'search-pill' : ''}`}>
          <Search
            size={15}
            className={dark ? 'absolute left-3 top-1/2 -translate-y-1/2 text-ink-400' : 'absolute left-3 top-1/2 -translate-y-1/2 text-ink-400'}
          />
          {/* h-9, no py-2: py-2 + border was computing to 38px (border-box:
              20px line-height + 16px padding + 2px border), 2px taller than
              the dropdown pill's explicit h-9 (36px). Matching h-9 here
              instead of relying on padding makes both exactly the same
              height, so they align regardless of border/line-height math.

              focus:ring/focus:border removed below (dark branch only) —
              on click this was layering a bright, full-opacity brass ring
              + border on top of the pill's normal faint border, reading
              as a distracting golden glow appearing out of nowhere.
              focus:outline-none is kept so the browser's default blue
              outline doesn't take its place, and darkPillClass no longer
              carries any brass/gold tint, so there's nothing gold left to
              show on focus or hover. */}
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className={
              dark
                ? `w-full h-9 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-900/40 focus:outline-none ${darkPillClass}`
                : 'w-full h-9 rounded-md border border-ink-100 bg-ivory-100 pl-9 pr-3 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brass-500/40 focus:border-brass-500'
            }
          />
        </div>
        {themedFilters}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}