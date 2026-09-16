import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

// Same frosted-glass tokens as every other glass surface in the admin (see
// .glass / .glass-strong / --glass-* in global.css) — duplicated as
// constants here (not imported as classes) so this file has no hard
// dependency on Topbar.jsx, and because the trigger/panel need to layer
// these onto their own gradient/opacity variants via inline style rather
// than a plain class. Keep in sync with Topbar.jsx's PILL_GLASS and
// DataTable.jsx's CARD_GLASS if the shared tokens ever change.
const GLASS_BORDER = '1px solid var(--glass-border)'
const GLASS_FILL = 'var(--glass-fill)'
const GLASS_FILL_STRONG = 'var(--glass-fill-strong)'
const GLASS_SHADOW = 'var(--glass-shadow)'

// dark-surface remaps text-ink-* classes to brass/gold tones (same
// mechanism Topbar's "Profile" row and DataTable's dark cards use) — that
// is what gives each option row its golden color. It's deliberately kept
// OFF the trigger button: dark-surface also carries a card-style shadow
// meant for rectangular panels, which squares off the shadow around a
// rounded pill. The button gets its look entirely from the inline
// border/background + text-ink-900 below instead.
const dropdownClass =
  'absolute left-0 mt-2 z-50 border-0 dark-surface shadow-card max-h-48 overflow-y-auto ' +
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full ' +
  '[&::-webkit-scrollbar-thumb:hover]:bg-white/25'

// Reusable status-style filter for any admin list page (Brands,
// Collections, Exhibitions, Inquiries, …). Pass the options for that
// page's statuses — e.g. [{ value: 'all', label: 'All statuses' },
// { value: 'active', label: 'Active' }, { value: 'inactive', label:
// 'Inactive' }] for Brands, or Published/Draft for Collections — value/
// onChange work like a controlled <select> so it drops into the same
// `filters` slot on TableToolbar a <Select> used to occupy.
//
// fullWidth: set this when using the dropdown as a form field (e.g.
// inside a modal, in place of Field/Select) rather than a toolbar filter.
// Toolbar usage sizes the pill to its content; form usage needs it to
// stretch to match the other full-width inputs above it.
export default function StatusFilterDropdown({ value, onChange, options, className, fullWidth }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = options.find((o) => o.value === value) || options[0]

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''} ${className || ''}`} ref={ref}>
      {/* Border colors switched from brass/gold (#D8C287...) to a neutral
          white, so neither the resting border nor the hover state shows
          any gold — hover now just brightens the same white border a
          touch instead of swapping to solid brass. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = fullWidth ? '#FFFFFF4D' : '#FFFFFF33')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = fullWidth ? '#FFFFFF2E' : '#FFFFFF1F')}
        style={
          fullWidth
            ? { border: GLASS_BORDER, background: GLASS_FILL }
            : { border: GLASS_BORDER, background: GLASS_FILL_STRONG, boxShadow: GLASS_SHADOW }
        }
        className={`flex items-center gap-2 h-9 pl-3.5 pr-3 text-sm font-medium transition-colors backdrop-blur-md ${
          fullWidth ? 'w-full justify-between rounded-xl text-ink-900' : 'rounded-full text-ink-900 status-pill'
        }`}
      >
        {current?.label}
        <ChevronDown size={14} className={`transition-transform ${fullWidth ? 'text-ink-600' : 'text-ink-400'} ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`${dropdownClass} backdrop-blur-md border border-[color:var(--glass-border)] ${fullWidth ? 'w-full rounded-xl' : 'w-44 rounded-3xl'}`}
          style={{
            background: fullWidth ? GLASS_FILL : GLASS_FILL_STRONG,
            boxShadow: GLASS_SHADOW,
            scrollbarWidth: 'thin',
            scrollbarColor: '#FFFFFF33 transparent',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={
                opt.value === value
                  ? 'flex w-full items-center px-3.5 py-2.5 text-sm text-brass-700 font-semibold bg-white/10'
                  : 'flex w-full items-center px-3.5 py-2.5 text-sm text-ink-600 hover:bg-white/5'
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Tells TableToolbar this component fully themes itself (trigger pill +
// dropdown panel) and should be left alone — see the isSelfThemed check
// in TableToolbar's cloneElement logic. Without this, TableToolbar tries
// to layer its plain-<select> dark theming (teal bg, rounded-lg, shadow)
// onto this component's outer wrapper div, producing a second, squared-
// off shadow behind the rounded pill.
StatusFilterDropdown.isSelfThemed = true