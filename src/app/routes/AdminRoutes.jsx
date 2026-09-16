import { Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from '@/app/routes/RequireAuth.jsx'
import AdminLayout from '@/layouts/AdminLayout.jsx'
import LoginPage from '@/features/auth/pages/LoginPage.jsx'
import DashboardPage from '@/features/dashboard/pages/DashboardPage.jsx'
import CollectionsPage from '@/features/collections/pages/CollectionsPage.jsx'
import BrandsPage from '@/features/brands/pages/BrandsPage.jsx'
import ExhibitionsPage from '@/features/exhibitions/pages/ExhibitionsPage.jsx'
import InquiriesPage from '@/features/inquiries/pages/InquiriesPage.jsx'
import SeoPage from '@/features/seo/pages/SeoPage.jsx'
import SettingsPage from '@/features/settings/pages/SettingsPage.jsx'
import EditorPage from '@/features/page-content/pages/EditorPage.jsx'
import SectionDesignerPage from '@/features/page-content/pages/SectionDesignerPage.jsx'
import VaultPage from '@/features/vault/pages/VaultPage.jsx'
import ExhibitionOpsPage from '@/features/exhibition-ops/pages/ExhibitionOpsPage.jsx'
import HeaderPage from '@/features/page-content/pages/HeaderPage.jsx'
import FooterPage from '@/features/page-content/pages/FooterPage.jsx'
import BlogPage from '@/features/blog/pages/BlogPage.jsx'
import UsersPage from '@/features/users/pages/UsersPage.jsx'
import RolesPage from '@/features/rbac/pages/RolesPage.jsx'
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
            <DashboardPage />
          </RequirePermission>
          }
        />
        <Route
          path="collections"
          element={
          <RequirePermission resource="collections">
            <CollectionsPage />
          </RequirePermission>
          }
        />
        <Route
          path="brands"
          element={
          <RequirePermission resource="brands">
            <BrandsPage />
          </RequirePermission>
          }
        />
        <Route
          path="exhibitions"
          element={
          <RequirePermission resource="exhibitions">
            <ExhibitionsPage />
          </RequirePermission>
          }
        />
        <Route
          path="inquiries"
          element={
          <RequirePermission resource="inquiries">
            <InquiriesPage />
          </RequirePermission>
          }
        />
        <Route
          path="editor"
          element={
          <RequirePermission resource="content">
            <EditorPage />
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
            <ExhibitionOpsPage />
          </RequirePermission>
          }
        />
        <Route
          path="vault"
          element={
          <RequirePermission resource="notes">
            <VaultPage />
          </RequirePermission>
          }
        />
        <Route
          path="sections/new"
          element={
          <RequirePermission resource="sections">
            <SectionDesignerPage />
          </RequirePermission>
          }
        />
        <Route
          path="sections/:id"
          element={
          <RequirePermission resource="sections">
            <SectionDesignerPage />
          </RequirePermission>
          }
        />
        {/* The header and the footer are on every page, so they are edited
            on their own screens rather than as tabs under Content. */}
        <Route
          path="header"
          element={
          <RequirePermission resource="header">
            <HeaderPage />
          </RequirePermission>
          }
        />
        <Route
          path="footer"
          element={
          <RequirePermission resource="footer">
            <FooterPage />
          </RequirePermission>
          }
        />
        <Route
          path="blog"
          element={
          <RequirePermission resource="blog">
            <BlogPage />
          </RequirePermission>
          }
        />
        <Route
          path="seo"
          element={
          <RequirePermission resource="seo">
            <SeoPage />
          </RequirePermission>
          }
        />
        {/* System */}
        <Route
          path="users"
          element={
            <RequirePermission resource="users">
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="roles"
          element={
            <RequirePermission resource="roles">
              <RolesPage />
            </RequirePermission>
          }
        />
        <Route
          path="settings"
          element={
          <RequirePermission resource="settings">
            <SettingsPage />
          </RequirePermission>
          }
        />
      </Route>

      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  )
}
