import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from '@/app/routes/RequireAuth.jsx'
import AdminLayout from '@/layouts/AdminLayout.jsx'
import LoginPage from '@/features/auth/pages/LoginPage.jsx'
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage.jsx'))
const CollectionsPage = lazy(() => import('@/features/collections/pages/CollectionsPage.jsx'))
const BrandsPage = lazy(() => import('@/features/brands/pages/BrandsPage.jsx'))
const ExhibitionsPage = lazy(() => import('@/features/exhibitions/pages/ExhibitionsPage.jsx'))
const InquiriesPage = lazy(() => import('@/features/inquiries/pages/InquiriesPage.jsx'))
const SeoPage = lazy(() => import('@/features/seo/pages/SeoPage.jsx'))
const VisitorsPage = lazy(() => import('@/features/visitors/pages/VisitorsPage.jsx'))
const TeamPage = lazy(() => import('@/features/team/pages/TeamPage.jsx'))
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage.jsx'))
const EditorPage = lazy(() => import('@/features/page-content/pages/EditorPage.jsx'))
const SectionDesignerPage = lazy(() => import('@/features/page-content/pages/SectionDesignerPage.jsx'))
const VaultPage = lazy(() => import('@/features/vault/pages/VaultPage.jsx'))
const ExhibitionOpsPage = lazy(() => import('@/features/exhibition-ops/pages/ExhibitionOpsPage.jsx'))
const HeaderPage = lazy(() => import('@/features/page-content/pages/HeaderPage.jsx'))
const FooterPage = lazy(() => import('@/features/page-content/pages/FooterPage.jsx'))
const BlogPage = lazy(() => import('@/features/blog/pages/BlogPage.jsx'))
const UsersPage = lazy(() => import('@/features/users/pages/UsersPage.jsx'))
const RolesPage = lazy(() => import('@/features/rbac/pages/RolesPage.jsx'))
import RequirePermission from '@/app/routes/RequirePermission.jsx'

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route
          path="dashboard"
          element={
          <RequirePermission resource="dashboard">
            <Suspense fallback={null}><DashboardPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="collections"
          element={
          <RequirePermission resource="collections">
            <Suspense fallback={null}><CollectionsPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="team"
          element={
          <RequirePermission resource="team">
            <Suspense fallback={null}><TeamPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="brands"
          element={
          <RequirePermission resource="brands">
            <Suspense fallback={null}><BrandsPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="exhibitions"
          element={
          <RequirePermission resource="exhibitions">
            <Suspense fallback={null}><ExhibitionsPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="inquiries"
          element={
          <RequirePermission resource="inquiries">
            <Suspense fallback={null}><InquiriesPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="editor"
          element={
          <RequirePermission resource="content">
            <Suspense fallback={null}><EditorPage /></Suspense>
          </RequirePermission>
          }
        />
        {/* Designing a section, not writing its words. Its own resource, so a
            role can be trusted with the copy on a page without being trusted
            to change what the page is made of — only Master holds it until it
            is granted in System > Roles. */}
        {/* The owner's own notes and passwords. The permission decides
            whether an account has a vault; it never decides whose vault it
            sees, which is fixed to the signed-in account on the server. */}
        {/* Running a show, as opposed to advertising one. Its own resource:
            writing a show's website copy and seeing its margin are different
            levels of trust. */}
        <Route
          path="exhibitions/:id/ops/:tab?"
          element={
          <RequirePermission resource="exhibitionOps">
            <Suspense fallback={null}><ExhibitionOpsPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="vault"
          element={
          <RequirePermission resource="notes">
            <Suspense fallback={null}><VaultPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="sections/new"
          element={
          <RequirePermission resource="sections">
            <Suspense fallback={null}><SectionDesignerPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="sections/:id"
          element={
          <RequirePermission resource="sections">
            <Suspense fallback={null}><SectionDesignerPage /></Suspense>
          </RequirePermission>
          }
        />
        {/* The header and the footer are on every page, so they are edited
            on their own screens rather than as tabs under Content. */}
        <Route
          path="header"
          element={
          <RequirePermission resource="header">
            <Suspense fallback={null}><HeaderPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="footer"
          element={
          <RequirePermission resource="footer">
            <Suspense fallback={null}><FooterPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="blog"
          element={
          <RequirePermission resource="blog">
            <Suspense fallback={null}><BlogPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="seo"
          element={
          <RequirePermission resource="seo">
            <Suspense fallback={null}><SeoPage /></Suspense>
          </RequirePermission>
          }
        />
        <Route
          path="visitors"
          element={
          <RequirePermission resource="visitors">
            <Suspense fallback={null}><VisitorsPage /></Suspense>
          </RequirePermission>
          }
        />
        {/* System */}
        <Route
          path="users"
          element={
            <RequirePermission resource="users">
              <Suspense fallback={null}><UsersPage /></Suspense>
            </RequirePermission>
          }
        />
        <Route
          path="roles"
          element={
            <RequirePermission resource="roles">
              <Suspense fallback={null}><RolesPage /></Suspense>
            </RequirePermission>
          }
        />
        <Route
          path="settings"
          element={
          <RequirePermission resource="settings">
            <Suspense fallback={null}><SettingsPage /></Suspense>
          </RequirePermission>
          }
        />
      </Route>

      {/* Absolute on purpose: a relative "dashboard" resolved against the unknown
          address and redirected to /admin/<unknown>/dashboard, then again from
          there, forever. */}
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  )
}
