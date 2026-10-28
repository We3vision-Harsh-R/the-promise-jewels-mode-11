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

// Keep in step with AdminLayout's lg:pl-[280px].
export const SIDEBAR_WIDTH = 244

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
          'relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors',
          isActive
            ? 'bg-brass-500/25 font-semibold text-ink-900'
            : 'font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-brass-600" />}
          <Icon size={18} strokeWidth={isActive ? 2 : 1.75} className={classNames('shrink-0', isActive && 'text-brass-700')} />
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
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
      {NAV.map((entry) => {
        if (!entry.items) return allowed(entry) ? <NavItem key={entry.to} {...entry} onNavigate={onNavigate} /> : null

        const items = entry.items.filter(allowed)
        if (!items.length) return null

        return (
          <div key={entry.label} className="pt-3">
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{entry.label}</p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavItem key={item.to} {...item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-3">
      <img src="/images/PROMISE_LOGO_skin_icon_only.webp" alt="" className="h-9 w-9 shrink-0 object-contain" />
      <div className="min-w-0 leading-tight">
        <p className="font-display text-[17px] text-ink-900">Promise Jewel</p>
        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-ink-400">
          Admin <span className="mx-0.5">·</span> v{APP_VERSION}
        </p>
      </div>
    </div>
  )
}

function Footer({ isDark, onToggleTheme }) {
  const { user, logout } = useAuth()
  const name = user?.name || 'Admin'

  return (
    <div className="space-y-2 border-t border-ink-100 p-3">
      {onToggleTheme && (
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
        >
          {isDark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
          {isDark ? 'Light theme' : 'Dark theme'}
        </button>
      )}

      <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brass-500/30 text-sm font-semibold text-brass-700">
          {initials(name) || 'A'}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-ink-900">{name}</p>
          {user?.email && <p className="truncate text-[11px] text-ink-400">{user.email}</p>}
        </div>
        <button
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-white hover:text-ink-900"
        >
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </div>
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
