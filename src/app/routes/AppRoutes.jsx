import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import ClientLayout from '@/layouts/MainLayout.jsx'
import Home from '@/pages/Home/Home.jsx'
import AboutPage from '@/pages/About/AboutPage.jsx'
import OurBrandsPage from '@/features/brands/pages/OurBrandsPage.jsx'
import OurCollectionPage from '@/features/collections/pages/OurCollectionPage.jsx'
import CollectionDetailsPage from '@/features/collections/pages/CollectionDetailsPage.jsx'
import ContactPage from '@/pages/Contact/ContactPage.jsx'
import ExhibitionPage from '@/features/exhibitions/pages/ExhibitionPage.jsx'
import ExhibitionDetailPage from '@/features/exhibitions/pages/ExhibitionDetailPage.jsx'
import BlogListPage from '@/features/blog/pages/BlogListPage.jsx'
import BlogPostPage from '@/features/blog/pages/BlogPostPage.jsx'

// The admin panel is loaded on demand, not with the website.
//
// It was a static import, so its whole dependency tree — Recharts, TipTap and
// ProseMirror among them — was linked into the single bundle every visitor
// downloads. Someone reading the homepage was paying to download a charting
// library and a rich-text editor for a screen they cannot even sign into.
//
// Splitting it here means the public site ships without any of that, and the
// admin chunk is fetched the moment someone actually navigates to /admin.
const AdminRoutes = lazy(() => import('@/app/routes/AdminRoutes.jsx'))

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ClientLayout />}>
        <Route index element={<Home />} />
        <Route path="AboutPage" element={<AboutPage />} />
        <Route path="our-brand" element={<OurBrandsPage />} />
        <Route path="our-collection" element={<OurCollectionPage />} />
        <Route path="our-collection/:categoryId" element={<CollectionDetailsPage />} />
        <Route path="contact" element={<ContactPage />} />
        {/* Matches the "Exhibition Highlights" href in Navbar.jsx, which
            pointed at a route that did not exist. */}
        <Route path="Exhibition" element={<ExhibitionPage />} />
        {/* One page per show, created by adding the show in Admin >
            Exhibitions — the slug is the record's own. */}
        <Route path="Exhibition/:slug" element={<ExhibitionDetailPage />} />
        {/* The journal. Posts are written in Admin > Marketing > Blog; the
            slug on the post record is what appears here. */}
        <Route path="blog" element={<BlogListPage />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />
      </Route>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={null}>
            <AdminRoutes />
          </Suspense>
        }
      />
    </Routes>
  )
}
