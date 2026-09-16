import { useState, useRef, useEffect } from 'react'
import { Menu, LogOut, User, Search, Bell } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth.jsx'

// Glass version of the pill/dropdowns — same shared tokens as the rest of
// the admin glass system (see .glass in global.css), applied inline here
// since the pill also needs its own gradient tint, not just the flat glass
// fill. Used on every admin route.
const PILL_GLASS = {
  background: 'var(--glass-fill-strong)',
  border: '1px solid var(--glass-border)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  boxShadow: 'var(--glass-shadow)',
}

// Shared look for both dropdown panels: same frosted glass fill as the
// pill itself (not plain white), dark-surface so the existing text-ink-900/
// text-ink-400/border-ink-100 classes already written below automatically
// remap to brass tones (same mechanism DataTable's dark cards use), and a
// larger radius (rounded-3xl) to match the soft-curve language used by the
// sidebar/search pill instead of the sharper rounded-md boxes.
const dropdownClass = 'absolute right-0 mt-2 z-50 rounded-3xl border-0 dark-surface overflow-hidden shadow-card'

// Header shows only the mobile menu button (small screens) and one
// centered pill (search + notifications + profile avatar), colored with
// the same teal gradient as the sidebar rail.
//
// AdminLayout still passes `title` and `subtitle`, and they are still
// harmlessly accepted — they are simply not destructured here, because
// nothing in this header renders them. Say the word if that page text should
// live somewhere else, and they can be picked back up.
export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const menuRef = useRef(null)
  const notifRef = useRef(null)
  const pillStyle = PILL_GLASS

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    // relative z-30: page content below (StatCards etc.) gets its own
    // stacking context once GSAP applies a transform for the reveal
    // animation, and — since it comes later in the DOM — was painting on
    // top of these dropdowns despite them being position:absolute. Pinning
    // the header itself above that stacking context fixes it; the two
    // dropdown panels also get z-50 below as a second safety net.
    <header
      className="relative z-30 grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 py-3"
    >
      {/* lg:invisible (not lg:hidden) so this still reserves its box on
          desktop — keeps the pill perfectly centered at every breakpoint,
          balanced by the matching spacer on the right. */}
      <button
        onClick={onMenuClick}
        className="lg:invisible justify-self-start rounded-md p-1.5 text-ink-600 hover:text-ink-900 hover:bg-white/10"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex justify-center">
        {/* Single pill housing all three controls — same gradient + capsule
            language as the sidebar rail, just shorter (h-11).
            `search-pill` class lets global.css opt this input out of the
            default gold focus-visible outline (doesn't read well on the
            dark gradient background). */}
        <div
          className="search-pill flex items-center gap-0.5 h-11 rounded-full pl-4 pr-1.5"
          style={pillStyle}
        >
          <Search size={15} className="text-ink-400 shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            className="w-32 sm:w-40 lg:w-56 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none px-2.5"
          />

          <div className="h-5 w-px bg-white/15 mx-1 shrink-0" />

          {/* Notifications — light gold border by default, full gold on hover */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((o) => !o)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#D8C287')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#D8C28766')}
              style={{ border: '1px solid #D8C28766' }}
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-brass-500/15 text-ink-600 hover:bg-brass-500/25 hover:text-ink-900 transition-colors"
              aria-label="Notifications"
            >
              <Bell size={16} strokeWidth={1.75} />
              <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-brass-300" />
            </button>

            {notifOpen && (
              <div className={`${dropdownClass} w-72`} style={pillStyle}>
                <div className="px-3.5 py-3 border-b border-ink-100">
                  <p className="text-sm text-ink-900 font-medium">Notifications</p>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-ink-100">
                  <div className="px-3.5 py-3">
                    <p className="text-sm text-ink-800">New inquiry received</p>
                    <p className="text-xs text-ink-400 mt-0.5">Just now</p>
                  </div>
                  <div className="px-3.5 py-3">
                    <p className="text-sm text-ink-800">Exhibition date updated</p>
                    <p className="text-xs text-ink-400 mt-0.5">2 hours ago</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile — Promise Jewel icon logo instead of initials, same
              size as the notification circle, light gold border by
              default, full gold on hover. The dropdown itself still shows
              the signed-in name/email. */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((o) => !o)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#D8C287')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#D8C28766')}
              style={{ border: '1px solid #D8C28766' }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brass-500/15 p-1.5 hover:bg-brass-500/25 transition-colors"
              aria-label="Account menu"
            >
              <img
                src="/images/PROMISE_LOGO_skin_icon_only.webp"
                alt="Account"
                className="h-full w-full object-contain"
              />
            </button>

            {open && (
              <div className={`${dropdownClass} w-48`} style={pillStyle}>
                <div className="px-3.5 py-3 border-b border-ink-100 flex items-center gap-2.5">
                  <img
                    src="/images/PROMISE_LOGO_skin_icon_only.webp"
                    alt="Promise Jewel"
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                  <div className="min-w-0 leading-tight">
                    <p className="text-xs text-ink-400">Signed in as</p>
                    <p className="text-sm text-ink-900 truncate">{user?.email}</p>
                  </div>
                </div>
                <button className="flex w-full items-center gap-2 px-3.5 py-2.5 text-sm text-ink-600 hover:bg-ink-50">
                  <User size={15} /> Profile
                </button>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 text-sm text-rose hover:bg-rose/5"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Balances the menu button's reserved width so the pill sits dead
          center rather than drifting left. */}
      <div className="w-8 h-8" aria-hidden="true" />
    </header>
  )
}