import { lazy } from 'react'

// Every public page except the Home page is loaded on demand.
//
// They were all static imports, so a visitor opening the Home page also
// downloaded, parsed and ran the code for About, Brands, Collections,
// Exhibitions, Blog and Contact before seeing anything. Home stays in the main
// bundle because it is what nearly everyone opens first; the rest are separate
// files fetched when needed.
//
// To keep clicking around instant, `prefetchPages` quietly downloads them all
// once the Home page has finished loading and the browser is idle — see
// MainLayout.jsx. By the time someone clicks a link the file is already cached.
const loaders = {
  AboutPage: () => import('@/pages/About/AboutPage.jsx'),
  OurBrandsPage: () => import('@/features/brands/pages/OurBrandsPage.jsx'),
  BrandDetailPage: () => import('@/features/brands/pages/BrandDetailPage.jsx'),
  OurCollectionPage: () => import('@/features/collections/pages/OurCollectionPage.jsx'),
  CollectionDetailsPage: () => import('@/features/collections/pages/CollectionDetailsPage.jsx'),
  ContactPage: () => import('@/pages/Contact/ContactPage.jsx'),
  ExhibitionPage: () => import('@/features/exhibitions/pages/ExhibitionPage.jsx'),
  ExhibitionDetailPage: () => import('@/features/exhibitions/pages/ExhibitionDetailPage.jsx'),
  BlogListPage: () => import('@/features/blog/pages/BlogListPage.jsx'),
  BlogPostPage: () => import('@/features/blog/pages/BlogPostPage.jsx'),
  OurTeamPage: () => import('@/features/team/pages/OurTeamPage.jsx'),
  NotFoundPage: () => import('@/pages/NotFound/NotFoundPage.jsx'),
}

export const AboutPage = lazy(loaders.AboutPage)
export const OurBrandsPage = lazy(loaders.OurBrandsPage)
export const BrandDetailPage = lazy(loaders.BrandDetailPage)
export const OurCollectionPage = lazy(loaders.OurCollectionPage)
export const CollectionDetailsPage = lazy(loaders.CollectionDetailsPage)
export const ContactPage = lazy(loaders.ContactPage)
export const ExhibitionPage = lazy(loaders.ExhibitionPage)
export const ExhibitionDetailPage = lazy(loaders.ExhibitionDetailPage)
export const BlogListPage = lazy(loaders.BlogListPage)
export const BlogPostPage = lazy(loaders.BlogPostPage)
export const OurTeamPage = lazy(loaders.OurTeamPage)
export const NotFoundPage = lazy(loaders.NotFoundPage)

let started = false

/**
 * Downloads the other pages in the background. Safe to call more than once.
 * Skipped when the visitor has asked their browser to save data, and
 * done one at a time so it never competes with what they are looking at.
 */
export function prefetchPages() {
  if (started) return
  started = true

  const connection = typeof navigator !== 'undefined' ? navigator.connection : undefined
  if (connection?.saveData) return

  const queue = Object.values(loaders)

  const next = () => {
    const load = queue.shift()
    if (!load) return
    load()
      .catch(() => {
        /* a failed prefetch only means the page loads when it is opened */
      })
      .finally(() => schedule(next))
  }

  const schedule = (fn) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(fn, { timeout: 3000 })
    } else {
      window.setTimeout(fn, 400)
    }
  }

  schedule(next)
}
