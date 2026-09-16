import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Gem, Building2, CalendarDays, MessagesSquare, Search, Settings, X, LogOut, PenLine, PanelTop, PanelBottom, Newspaper, Moon, Sun,   Users, ShieldCheck, KeyRound, ChevronRight, UserPlus, IndianRupee, Package,
  UsersRound, ListChecks, CalendarClock, FolderOpen, NotebookPen, SlidersHorizontal }
  from 'lucide-react'
import { classNames, initials } from '@/utils/helpers.js'
import { useAuth } from '@/features/auth/hooks/useAuth.jsx'
import { usePermissions } from '@/features/rbac/permissionsContext.js'
import { MODULES } from '@/features/exhibition-ops/opsSpec.js'
import { readCurrentShow } from '@/features/exhibition-ops/currentShow.js'

/** One icon per operations screen, keyed by the slug in opsSpec.js. */
const OPS_ICONS = {
  leads: UserPlus,
  costs: IndianRupee,
  stock: Package,
  crew: UsersRound,
  tasks: ListChecks,
  meetings: CalendarClock,
  files: FolderOpen,
  log: NotebookPen,
  fields: SlidersHorizontal,
}

/**
 * The ten operations screens as sidebar entries.
 *
 * Built from MODULES rather than typed out again, so adding an eleventh
 * module puts it in the rail with no second edit. `to` is a function because
 * the destination depends on which show was last open.
 */
const MODULE_NAV = [
  {
    slug: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
  },
  ...MODULES.map((m) => ({ slug: m.slug, label: m.label, icon: OPS_ICONS[m.slug] })),
].map((entry) => ({
  ...entry,
  resource: 'exhibitionOps',
  to: (showId) =>
    showId ? `/admin/exhibitions/${showId}/ops/${entry.slug}` : "/admin/exhibitions",
}))

// The rail, in reading order. An entry with `items` is a titled group; one
// without is a standalone link.
//
// A group heading has no page of its own — clicking it folds the group away
// rather than navigating (see GroupHeader below). With four groups and
// fourteen pages the rail had become a list you read rather than scanned, and
// most people work inside one or two of them for weeks at a time. What is
// folded is remembered between visits.
//
// Dashboard sits outside every group on purpose: it is the landing page, and
// a landing page that can be folded out of sight is a way to lose your way
// home.
const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, resource: 'dashboard' },
  {
    label: 'Management',
    items: [
      { to: '/admin/collections', label: 'Collections', icon: Gem, resource: 'collections' },
      { to: '/admin/brands', label: 'Brands', icon: Building2, resource: 'brands' },
      { to: '/admin/inquiries', label: 'Inquiries', icon: MessagesSquare, resource: 'inquiries' },
    ],
  },
  {
    // Its own group rather than one entry under Management.
    //
    // A show is not one screen, it is twelve: the record the website prints,
    // and the ten things involved in actually attending. Buried as a single
    // link under Management, eleven of those were reachable only by finding
    // the right row in a table first.
    //
    // The operations entries are per-show, and a sidebar link cannot ask
    // which show you meant — so they point at the last one opened. See
    // currentShow.js. With none remembered they fall back to the list,
    // which is where you would go to pick one anyway.
    label: 'Exhibition',
    items: [
      { to: '/admin/exhibitions', label: 'Shows', icon: CalendarDays, resource: 'exhibitions', end: true },
      ...MODULE_NAV,
    ],
  },
  {
    label: 'Editor',
    items: [
      // The website's text copy. The page itself tabs between the site's
      // pages (see EditorPage.jsx) — that all stays as it is, it just sits
      // under "Content" now.
      // The website's pictures used to live on a separate "Images" screen with
      // its own table and upload flow, which meant a photograph was edited
      // somewhere other than the words beside it. Every picture is now a field
      // in Content, on the tab for the page it appears on.
      { to: '/admin/editor', label: 'Content', icon: PenLine, resource: 'content' },
      { to: '/admin/header', label: 'Header', icon: PanelTop, resource: 'header' },
      { to: '/admin/footer', label: 'Footer', icon: PanelBottom, resource: 'footer' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { to: '/admin/blog', label: 'Blog', icon: Newspaper, resource: 'blog' },
      { to: '/admin/seo', label: 'SEO', icon: Search, resource: 'seo' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/settings', label: 'Settings', icon: Settings, resource: 'settings' },
      { to: '/admin/users', label: 'Users', icon: Users, resource: 'users' },
      { to: '/admin/roles', label: 'Roles', icon: ShieldCheck, resource: 'roles' },
      { to: '/admin/vault', label: 'Vault', icon: KeyRound, resource: 'notes' },
    ],
  },
]

// Glass treatment — same shared tokens as every other glass surface in the
// admin (see .glass / --glass-* in global.css) so the sidebar floats as
// frosted glass over the dark gradient background on every admin route.
const SIDEBAR_GLASS = {
  background: 'var(--glass-fill-strong)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: '1px solid var(--glass-border)',
}

/**
 * Which groups are folded away, remembered between visits.
 *
 * In localStorage rather than on the account: this is a preference about one
 * person's rail on one machine, not a fact about them, and it is not worth a
 * column, a request on every page load, or a migration.
 *
 * Every access is wrapped, because a private window or a browser set to block
 * site data throws on the accessor itself. The rail then works exactly as
 * before and simply forgets between visits, which is the right way for a
 * convenience to fail.
 */
const COLLAPSED_KEY = 'pj-admin-nav-collapsed'

function readCollapsed() {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function writeCollapsed(groups) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...groups]))
  } catch {
    // See above — nothing to do, and nothing worth telling anyone about.
  }
}

/**
 * A group heading that folds its pages away.
 *
 * A folded group whose page you are ON keeps the brass dot and the lit label,
 * so the rail still answers "where am I" without unfolding. It is deliberately
 * NOT forced open in that case: folding it was a choice, and a rail that
 * springs back open every time you navigate is a rail that ignores you.
 */
function GroupHeader({ label, open, hasActive, onToggle, controls }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className={classNames(
        'flex w-full items-center gap-1.5 rounded-lg px-3.5 pt-3 pb-1 text-left',
        'text-[10px] font-medium uppercase tracking-wider transition-colors',
        hasActive && !open ? 'text-ink-900' : 'text-ink-400 hover:text-ink-900'
      )}
    >
      <ChevronRight
        size={11}
        strokeWidth={2.5}
        aria-hidden="true"
        className={classNames(
          'shrink-0 transition-transform duration-200',
          open && 'rotate-90'
        )}
      />
      <span className="whitespace-nowrap">{label}</span>

      {hasActive && !open && (
        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brass-300" aria-hidden="true" />
      )}
    </button>
  )
}

/**
 * `to` is either a path or a function of the remembered show id.
 *
 * The operations entries need the second form: which show they open is not
 * known when NAV is declared, only when the rail renders.
 */
function NavItem({ to, label, icon: Icon, onNavigate, nested, showId, end }) {
  const href = typeof to === "function" ? to(showId) : to

  return (
    <NavLink
      to={href}
      // NavLink matches on prefix by default, so "Shows"
      // (/admin/exhibitions) lit up on every operations page beneath it —
      // two entries highlighted at once, neither of them wrong-looking
      // enough to notice quickly. `end` is set on the entries that have
      // real routes underneath them.
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        classNames(
          'group relative flex h-10 w-full items-center justify-start gap-3 rounded-full pr-3.5 text-sm transition-colors duration-300',
          // Items inside a group are indented under their heading.
          nested ? 'pl-6' : 'pl-3.5',
          isActive
            ? 'bg-brass-500/20 text-ink-900 font-medium'
            : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={17} strokeWidth={1.75} className="shrink-0" />
          <span className="whitespace-nowrap">{label}</span>
          {isActive && (
            <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-brass-300" />
          )}
        </>
      )}
    </NavLink>
  )
}

function NavItems({ onNavigate }) {
  const { canView, ready } = usePermissions()
  const { pathname } = useLocation()

  // Read once, lazily. Reading localStorage on every render would be wasted
  // work, and reading it in an effect would mean one render with every group
  // open before they snap shut.
  const [collapsed, setCollapsed] = useState(readCollapsed)

  // Persisting belongs in an effect: it is synchronising an external system
  // with React state, which is the one thing effects are actually for.
  //
  // It was in the click handler first, which looked simpler and was wrong.
  // The handler read `collapsed` from its closure, so folding three headings
  // in quick succession had all three compute their next value from the same
  // stale set — and only the last one survived. Caught by clicking three at
  // once while testing; a person doing the same thing would have hit it.
  useEffect(() => {
    writeCollapsed(collapsed)
  }, [collapsed])

  // The updater form for the same reason: each toggle is applied to whatever
  // the previous one produced, not to what was on screen when it was clicked.
  function toggle(label) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  // Read once per render. Cheap, and it has to be current: the rail must
  // point at the show you are on, not the one this tab was opened with.
  const showId = readCurrentShow()

  // `/admin/roles` must not light up for `/admin/rolesomething`, so it is an
  // exact match or a real path segment beneath it.
  const isOn = (to) => {
    const href = typeof to === 'function' ? to(showId) : to
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  // An entry is shown only when the role may open it. This is the first of
  // three gates and the least important one — RequirePermission stops the
  // route and the API refuses the request regardless. It exists so the panel
  // does not offer links that lead to a refusal.
  //
  // Until the profile has loaded, nothing is shown rather than everything:
  // a flash of screens you cannot open is worse than a moment of empty rail.
  const allowed = (item) => ready && (!item.resource || canView(item.resource))

  return (
    <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto overflow-x-hidden">
      {NAV.map((entry) => {
        if (!entry.items) {
          return allowed(entry) ? (
            <NavItem key={entry.to} {...entry} showId={showId} onNavigate={onNavigate} />
          ) : null
        }

        const visible = entry.items.filter(allowed)

        // A group heading with nothing under it is just a label for an
        // absence, so the whole group goes.
        if (visible.length === 0) return null

        const open = !collapsed.has(entry.label)
        const bodyId = `nav-group-${entry.label.toLowerCase().replace(/\W+/g, '-')}`

        return (
          <div key={entry.label} className="space-y-1">
            <GroupHeader
              label={entry.label}
              open={open}
              hasActive={visible.some((item) => isOn(item.to))}
              onToggle={() => toggle(entry.label)}
              controls={bodyId}
            />

            {/* Unmounted rather than hidden. These are links: left in the DOM
                they stay tabbable and reachable by a screen reader, so a
                folded group would still be walked through by anyone not using
                a mouse — which is the opposite of folding it. */}
            {open && (
              <div id={bodyId} className="space-y-1">
                {visible.map((item) => (
                  <NavItem key={item.label} {...item} nested showId={showId} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

// Desktop rail: floating rounded panel (1.75rem radius, teal gradient —
// matches the reference build), pinned open at all times.
//
// It used to sit collapsed at 60px and expand to 200px on hover, which meant
// the labels were only readable while the pointer was over the rail and the
// whole content column slid sideways every time you crossed it. It is now
// always the full width: fixed, always labelled, nothing to hover.
//
// NOTE: if you change SIDEBAR_WIDTH, update AdminLayout's lg:pl-[280px] to
// match (left-3 offset + this width + the same ~24px breathing room).
// 200 -> 244. At 200 the rail was the same width as its longest label,
// so every row read as text pressed against two edges. The extra 44px is
// margin, not content: nothing new fits in it, the labels simply stop
// touching the sides. That gap is most of what separates a panel that
// looks considered from one that looks cramped.
export const SIDEBAR_WIDTH = 244

export function SidebarDesktop({ isDark, onToggleTheme }) {
  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        borderRadius: '28px',
        ...SIDEBAR_GLASS,
      }}
      className="hidden lg:flex fixed inset-y-3 left-3 flex-col text-ink-900 z-40 overflow-hidden shadow-2xl"
    >
      <Brand />
      <NavItems />
      <Footer isDark={isDark} onToggleTheme={onToggleTheme} />
    </aside>
  )
}

export function SidebarMobile({ open, onClose, isDark, onToggleTheme }) {
  return (
    <>
      <div
        className={classNames(
          'fixed inset-0 z-50 bg-ink-900/50 transition-opacity lg:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <aside
        style={SIDEBAR_GLASS}
        className={classNames(
          'fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col text-ink-900 transition-transform duration-300 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <BrandMark />
          <button onClick={onClose} className="text-ink-600 hover:text-ink-900" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <div className="h-3" />
        <NavItems onNavigate={onClose} />
        <Footer isDark={isDark} onToggleTheme={onToggleTheme} />
      </aside>
    </>
  )
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/images/PROMISE_LOGO_skin_icon_only.webp"
        alt="Promise Jewel"
        className="h-8 w-8 shrink-0 object-contain"
      />
      <div className="leading-tight whitespace-nowrap">
        <p className="font-display text-base text-ink-900">Promise Jewel</p>
        <p className="text-[10px] uppercase tracking-wider text-ink-400">Admin</p>
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div className="px-3 pt-5 pb-4">
      <BrandMark />
    </div>
  )
}

// Admin profile block, pinned to the bottom of the rail:
// avatar + name + email + a sign-out action.
function Footer({ isDark, onToggleTheme }) {
  const { user, logout } = useAuth()
  const name = user?.name || 'Admin'
  const email = user?.email || ''

  return (
    <div className="px-3 py-4">
      {/* Light / dark, sat with the other things you do to the panel
          rather than to the content. The label names the theme you would
          be switching TO, so the row says what the click does instead of
          describing where you already are. */}
      {onToggleTheme && (
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to the light theme' : 'Switch to the dark theme'}
          className="mb-3 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-ink-600 transition-colors hover:bg-brass-500/12 hover:text-ink-900"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brass-500/18 text-brass-700">
            {isDark ? <Sun size={14} strokeWidth={1.75} /> : <Moon size={14} strokeWidth={1.75} />}
          </span>
          <span className="text-[13px] font-medium">{isDark ? 'Light theme' : 'Dark theme'}</span>
        </button>
      )}

      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 shrink-0 rounded-full bg-brass-500/20 text-brass-700 flex items-center justify-center text-xs font-medium">
          {initials(name) || 'A'}
        </div>
        <div className="min-w-0 leading-tight flex-1">
          <p className="truncate text-sm text-ink-900 font-medium">{name}</p>
          {email && <p className="truncate text-[11px] text-ink-400">{email}</p>}
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-ink-50 transition-colors"
        >
          <LogOut size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}