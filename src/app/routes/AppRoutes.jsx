import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import ClientLayout from '@/layouts/MainLayout.jsx'
import Home from '@/pages/Home/Home.jsx'
import {
  AboutPage,
  OurBrandsPage,
  OurCollectionPage,
  CollectionDetailsPage,
  ContactPage,
  ExhibitionPage,
  ExhibitionDetailPage,
  BlogListPage,
  BlogPostPage,
  OurTeamPage,
  NotFoundPage,
} from '@/app/routes/lazyPages.js'

// The admin panel is its own page (admin.html, entry admin-main.jsx), so the
// public bundle carries none of it. A client-side jump to /admin from inside the
// website becomes a normal page load, which the server answers with that page.
function OpenAdminPage() {
  useEffect(() => {
    window.location.replace(window.location.href)
  }, [])
  return null
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ClientLayout />}>
        <Route index element={<Home />} />
        <Route path="AboutPage" element={<AboutPage />} />
        <Route path="our-team" element={<OurTeamPage />} />
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
        {/* Anything else on the website. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route
        path="/admin/*"
        element={<OpenAdminPage />}
      />
    </Routes>
  )
}
