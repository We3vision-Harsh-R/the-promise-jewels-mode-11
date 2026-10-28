import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from '@/app/routes/RequireAuth.jsx'
import AdminLayout from '@/layouts/AdminLayout.jsx'
import LoginPage from '@/features/auth/pages/LoginPage.jsx'
import { adminPageLoaders } from '@/app/routes/adminPageLoaders.js'
const DashboardPage = lazy(adminPageLoaders.DashboardPage)
const CollectionsPage = lazy(adminPageLoaders.CollectionsPage)
const BrandsPage = lazy(adminPageLoaders.BrandsPage)
const ExhibitionsPage = lazy(adminPageLoaders.ExhibitionsPage)
const InquiriesPage = lazy(adminPageLoaders.InquiriesPage)
const SeoPage = lazy(adminPageLoaders.SeoPage)
const VisitorsPage = lazy(adminPageLoaders.VisitorsPage)
const TeamPage = lazy(adminPageLoaders.TeamPage)
const SettingsPage = lazy(adminPageLoaders.SettingsPage)
const EditorPage = lazy(adminPageLoaders.EditorPage)
const SectionDesignerPage = lazy(adminPageLoaders.SectionDesignerPage)
const VaultPage = lazy(adminPageLoaders.VaultPage)
const HeaderPage = lazy(adminPageLoaders.HeaderPage)
const FooterPage = lazy(adminPageLoaders.FooterPage)
const RingsPage = lazy(adminPageLoaders.RingsPage)
const BlogPage = lazy(adminPageLoaders.BlogPage)
const UsersPage = lazy(adminPageLoaders.UsersPage)
const RolesPage = lazy(adminPageLoaders.RolesPage)
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
          path="rings"
          element={
          <RequirePermission resource="rings">
            <Suspense fallback={null}><RingsPage /></Suspense>
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
