import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Gem, Building2, CalendarDays, MessagesSquare, Search, Settings, X, LogOut, PenLine,
  PanelTop, PanelBottom, CircleDot, Newspaper, Moon, Sun, Users, ShieldCheck, KeyRound, UsersRound, Radio,
} from 'lucide-react'
import { classNames, initials } from '@/utils/helpers.js'
import { APP_VERSION } from '@/app/config.js'
import { preloadAdminPage } from '@/app/routes/adminPageLoaders.js'
import { useAuth } from '@/features/auth/hooks/useAuth.jsx'
import { usePermissions } from '@/features/rbac/permissionsContext.js'

// A group has a title and `items`; Dashboard stands alone above them.
const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, resource: 'dashboard' },
  {
    label: 'Management',
    items: [
      { to: '/admin/collections', label: 'Collections', icon: Gem, resource: 'collections' },
      { to: '/admin/brands', label: 'Brands', icon: Building2, resource: 'brands' },
      { to: '/admin/exhibitions', label: 'Exhibitions', icon: CalendarDays, resource: 'exhibitions' },
      { to: '/admin/team', label: 'Our Team', icon: UsersRound, resource: 'team' },
      { to: '/admin/inquiries', label: 'Inquiries', icon: MessagesSquare, resource: 'inquiries' },
    ],
  },
  {
    label: 'Editor',
    items: [
      { to: '/admin/editor', label: 'Content', icon: PenLine, resource: 'content' },
      { to: '/admin/header', label: 'Header', icon: PanelTop, resource: 'header' },
      { to: '/admin/footer', label: 'Footer', icon: PanelBottom, resource: 'footer' },
      { to: '/admin/rings', label: 'Rings', icon: CircleDot, resource: 'rings' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { to: '/admin/blog', label: 'Blog', icon: Newspaper, resource: 'blog' },
      { to: '/admin/seo', label: 'SEO', icon: Search, resource: 'seo' },
      { to: '/admin/visitors', label: 'Visitors', icon: Radio, resource: 'visitors' },
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

// Keep in step with AdminLayout's lg:pl-[260px].
export const SIDEBAR_WIDTH = 224

const GLASS = {
  background: 'var(--glass-fill-strong)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: '1px solid var(--glass-border)',
}

function NavItem({ to, label, icon: Icon, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      onMouseEnter={() => preloadAdminPage(to)}
      className={({ isActive }) =>
        classNames(
          'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors',
          isActive ? 'bg-ink-900/[0.07] font-semibold text-ink-900' : 'font-medium text-ink-600 hover:bg-ink-900/[0.04] hover:text-ink-900'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} strokeWidth={1.75} className={classNames('shrink-0', isActive ? 'text-brass-700' : 'text-ink-400')} />
          {label}
        </>
      )}
    </NavLink>
  )
}

function NavItems({ onNavigate }) {
  const { canView, ready } = usePermissions()
  // Until permissions load show nothing rather than links that may be refused.
  const allowed = (item) => ready && (!item.resource || canView(item.resource))

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-2">
      {NAV.map((entry) => {
        if (!entry.items) return allowed(entry) ? <NavItem key={entry.to} {...entry} onNavigate={onNavigate} /> : null

        const items = entry.items.filter(allowed)
        if (!items.length) return null

        return (
          <div key={entry.label} className="mt-4">
            <p className="mb-1 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400">{entry.label}</p>
            {items.map((item) => (
              <NavItem key={item.to} {...item} onNavigate={onNavigate} />
            ))}
          </div>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
      <img src="/images/PROMISE_LOGO_skin_icon_only.webp" alt="" className="h-8 w-8 shrink-0 object-contain" />
      <div className="leading-tight">
        <p className="font-display text-[15px] text-ink-900">Promise Jewel</p>
        <p className="text-[10.5px] text-ink-400">Admin · v{APP_VERSION}</p>
      </div>
    </div>
  )
}

const ICON_BUTTON = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-900'

function Footer({ isDark, onToggleTheme }) {
  const { user, logout } = useAuth()
  const name = user?.name || 'Admin'

  return (
    <div className="flex items-center gap-2 border-t border-ink-900/[0.08] px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass-500/25 text-xs font-semibold text-brass-700">
        {initials(name) || 'A'}
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-900">{name}</p>
      {onToggleTheme && (
        <button type="button" onClick={onToggleTheme} title={isDark ? 'Light theme' : 'Dark theme'} aria-label="Toggle theme" className={ICON_BUTTON}>
          {isDark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        </button>
      )}
      <button onClick={logout} title="Sign out" aria-label="Sign out" className={ICON_BUTTON}>
        <LogOut size={16} strokeWidth={1.75} />
      </button>
    </div>
  )
}

export function SidebarDesktop({ isDark, onToggleTheme }) {
  return (
    <aside
      style={{ width: SIDEBAR_WIDTH, borderRadius: 28, ...GLASS }}
      className="fixed inset-y-3 left-3 z-40 hidden flex-col overflow-hidden text-ink-900 shadow-2xl lg:flex"
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
        onClick={onClose}
        className={classNames(
          'fixed inset-0 z-50 bg-ink-900/50 transition-opacity lg:hidden',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      <aside
        style={GLASS}
        className={classNames(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col text-ink-900 transition-transform duration-300 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button onClick={onClose} aria-label="Close menu" className="absolute right-3 top-4 text-ink-600 hover:text-ink-900">
          <X size={20} />
        </button>
        <Brand />
        <NavItems onNavigate={onClose} />
        <Footer isDark={isDark} onToggleTheme={onToggleTheme} />
      </aside>
    </>
  )
}
