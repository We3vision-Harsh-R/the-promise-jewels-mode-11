// Each admin screen's code, loaded on demand. Kept in one place so admin-main.jsx
// can start downloading the screen being opened while the sign-in check is still
// running, instead of only after it has answered.
export const adminPageLoaders = {
  DashboardPage: () => import('@/features/dashboard/pages/DashboardPage.jsx'),
  CollectionsPage: () => import('@/features/collections/pages/CollectionsPage.jsx'),
  BrandsPage: () => import('@/features/brands/pages/BrandsPage.jsx'),
  ExhibitionsPage: () => import('@/features/exhibitions/pages/ExhibitionsPage.jsx'),
  InquiriesPage: () => import('@/features/inquiries/pages/InquiriesPage.jsx'),
  SeoPage: () => import('@/features/seo/pages/SeoPage.jsx'),
  VisitorsPage: () => import('@/features/visitors/pages/VisitorsPage.jsx'),
  TeamPage: () => import('@/features/team/pages/TeamPage.jsx'),
  SettingsPage: () => import('@/features/settings/pages/SettingsPage.jsx'),
  EditorPage: () => import('@/features/page-content/pages/EditorPage.jsx'),
  SectionDesignerPage: () => import('@/features/page-content/pages/SectionDesignerPage.jsx'),
  VaultPage: () => import('@/features/vault/pages/VaultPage.jsx'),
  ExhibitionOpsPage: () => import('@/features/exhibition-ops/pages/ExhibitionOpsPage.jsx'),
  HeaderPage: () => import('@/features/page-content/pages/HeaderPage.jsx'),
  FooterPage: () => import('@/features/page-content/pages/FooterPage.jsx'),
  BlogPage: () => import('@/features/blog/pages/BlogPage.jsx'),
  UsersPage: () => import('@/features/users/pages/UsersPage.jsx'),
  RolesPage: () => import('@/features/rbac/pages/RolesPage.jsx'),
}

// First path segment after /admin/ -> the screen that opens there.
const SEGMENT_TO_PAGE = {
  dashboard: 'DashboardPage',
  collections: 'CollectionsPage',
  team: 'TeamPage',
  brands: 'BrandsPage',
  exhibitions: 'ExhibitionsPage',
  inquiries: 'InquiriesPage',
  editor: 'EditorPage',
  vault: 'VaultPage',
  sections: 'SectionDesignerPage',
  header: 'HeaderPage',
  footer: 'FooterPage',
  blog: 'BlogPage',
  seo: 'SeoPage',
  visitors: 'VisitorsPage',
  users: 'UsersPage',
  roles: 'RolesPage',
  settings: 'SettingsPage',
}

/** Starts fetching the code of the screen at `pathname`; a no-op for anything else. */
export function preloadAdminPage(pathname) {
  const segment = pathname.replace(/^\/admin\/?/, '').split('/')[0]
  const name = segment === '' ? 'DashboardPage' : segment === 'exhibitions' && /\/ops/.test(pathname) ? 'ExhibitionOpsPage' : SEGMENT_TO_PAGE[segment]
  if (name) adminPageLoaders[name]().catch(() => {})
}
