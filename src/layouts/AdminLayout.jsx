import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { gsap } from 'gsap'
import { SidebarDesktop, SidebarMobile } from '@/components/layout/Sidebar.jsx'
import Topbar from '@/components/layout/Topbar.jsx'
import useAdminTheme from '@/hooks/useAdminTheme.js'

const TITLES = {
  '/admin/dashboard': ['Dashboard', 'Overview of collections, brands, exhibitions & inquiries'],
  '/admin/collections': ['Collections', 'Manage jewellery collections across all brands'],
  '/admin/brands': ['Brands', 'Manage the brand portfolio'],
  '/admin/exhibitions': ['Exhibitions', 'Manage exhibition listings and galleries'],
  '/admin/inquiries': ['Inquiries', 'Review and action business inquiries'],
  // Both sit under "Editor" in the sidebar; the heading matches the nav
  // label so the page you land on names itself the same way you got to it.
  // Neither had an entry here before, so both rendered as a bare "Admin".
  '/admin/editor': ['Content', 'Editable text across every page of the website'],
  '/admin/header': ['Header', 'The menu shown at the top of every page'],
  '/admin/footer': ['Footer', 'The footer shown at the bottom of every page'],
  '/admin/blog': ['Blog', 'Posts, comments and the journal page'],
  '/admin/seo': ['SEO', 'Per-page meta title, description & OG image'],
  '/admin/settings': ['Settings', 'Site settings, contact details & password'],
  '/admin/users': ['Users', 'Who may sign in, and the role each of them holds'],
  '/admin/roles': ['Roles', 'What each role may see and change'],
  '/admin/vault': ['Vault', 'Your own notes and passwords, sealed before they are stored'],
}

/**
 * Titles for screens whose path carries an id.
 *
 * The map above is keyed on the exact path, which is right for the screens
 * that have one. The designer does not — /admin/sections/new and
 * /admin/sections/<id> are the same screen — so it is matched by prefix, and
 * anything added under a path like it will be too.
 */
const PREFIX_TITLES = [
  ['/admin/sections', ['Section designer', 'Build a new band and place it on any page']],
  ['/admin/exhibitions/', ['Show operations', 'The stall, the money, the buyers and the stock']],
]

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef(null)
  const { theme, toggle, isDark } = useAdminTheme()

  const [title, subtitle] =
    TITLES[location.pathname] ||
    PREFIX_TITLES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] || ['Admin', '']

  useEffect(() => {
    setMobileOpen(false)
    if (mainRef.current) {
      gsap.fromTo(
        mainRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
      )
    }
  }, [location.pathname])

  return (
    // The whole dark treatment hangs off this one attribute — see the
    // ADMIN — DARK THEME block in globals.css. Light is its absence, which
    // is the styling the panel already had, so neither theme needs a second
    // stylesheet or a flash of the wrong one on load.
    <div className="admin-theme min-h-screen dashboard-bg" data-admin-theme={theme}>
      <SidebarDesktop isDark={isDark} onToggleTheme={toggle} />
      <SidebarMobile
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isDark={isDark}
        onToggleTheme={toggle}
      />

      {/* The rail is a fixed 200px and never collapses now, so this padding
          is constant — it used to animate between two values in step with
          the rail's hover-expand, which slid the whole page sideways every
          time the pointer crossed the sidebar. Matches Sidebar.jsx's
          SIDEBAR_WIDTH plus its left-3 offset and a little breathing room;
          keep the two in sync if the rail width ever changes. */}
      <div className="lg:pl-[280px]">
        {/* title/subtitle no longer passed to Topbar — they render below,
            at the top of the page content instead, so each page shows its
            own heading in-page rather than in the header bar. */}
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        {/* Was `max-w-[1400px]` with no `mx-auto` — on any screen wider
            than 1400px the content stayed pinned to the left and left a
            dead gap on the right (that's the bug from the screenshot).
            `w-full` lets it fill the available width; keeping a generous
            `max-w` only kicks in on ultra-wide monitors, and `mx-auto`
            centers it if it ever does cap out, instead of leaving the
            gap on one side only. */}
        <main ref={mainRef} className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
          {/* dark-surface remaps text-ink-* to light brass/ivory tones (see
              global.css) so this heading reads correctly against the dark
              glass background used across every admin route. */}
          <div className="mb-6 dark-surface">
            <h1 className="font-display font-semibold text-2xl text-ink-900">{title}</h1>
            {subtitle && <p className="text-sm text-ink-400 mt-1">{subtitle}</p>}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}