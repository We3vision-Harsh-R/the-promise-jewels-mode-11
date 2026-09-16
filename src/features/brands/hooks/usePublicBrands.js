import { useEffect, useState } from 'react'

import { listPublicBrands } from '@/features/brands/brand.api.js'

// GET /brands is the same payload for every visitor and the brand section
// mounts on both the homepage and /our-brand, so the in-flight promise is
// cached at module scope — the two never fire two requests. A brand edited in
// the admin panel therefore needs a reload to appear, which is the right
// trade-off for a public marketing site (same call as usePublicSettings.js).
let brandsPromise = null

function fetchPublicBrands() {
  // The .catch lives inside the cached promise so a failed request resolves
  // to null for every consumer instead of becoming an unhandled rejection.
  brandsPromise = brandsPromise || listPublicBrands().catch(() => null)
  return brandsPromise
}

/**
 * Flattens one API row into exactly the fields the public brand frame draws,
 * so the component never has to know about Prisma column names or the
 * brand_images relation.
 *
 * `image` is the single hero photo for the frame: the banner is what the
 * admin panel labels "Banner" and is meant for exactly this, but a brand
 * saved with only a logo or only gallery shots still gets a picture rather
 * than an empty frame.
 */
function toBrandFrame(row) {
  const gallery = (row.gallery || [])
    .map((img) => ({
      id: img.id,
      url: img.image_url,
      alt: img.alt_text || row.name,
    }))
    .filter((img) => img.url)

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    overview: row.overview || '',
    logoUrl: row.logoUrl || '',
    bannerUrl: row.bannerUrl || '',
    ctaTitle: row.ctaTitle || '',
    ctaButtonText: row.ctaButtonText || '',
    gallery,
    image: row.bannerUrl || gallery[0]?.url || row.logoUrl || '',
  }
}

/**
 * Every active brand from Supabase, in admin display order, shaped for the
 * public brand frame.
 *
 * Returns `{ brands, loading }`. `brands` is an empty array both before the
 * request resolves and when it fails — callers fall back to the copy bundled
 * with the site in that case, so an API outage never blanks a public page.
 *
 * Usage:
 *   const { brands, loading } = usePublicBrands()
 */
export default function usePublicBrands() {
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchPublicBrands().then((rows) => {
      if (cancelled) return
      setBrands(Array.isArray(rows) ? rows.map(toBrandFrame) : [])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { brands, loading }
}
