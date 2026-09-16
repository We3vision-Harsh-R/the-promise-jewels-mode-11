import { useEffect, useState } from 'react'

import {
  getPublicCollection,
  listPublicCollections,
} from '@/features/collections/collection.api.js'

// GET /collections returns the same payload for every visitor and the grid
// mounts on more than one route, so the in-flight promise is cached at module
// scope — they share ONE request instead of each firing its own. A collection
// edited in the admin therefore needs a reload to appear, which is the right
// trade-off for a public marketing site (same call as usePublicSettings.js).
let listPromise = null

function fetchPublicCollections() {
  // The .catch lives inside the cached promise so a failed request resolves to
  // null for every consumer rather than becoming an unhandled rejection.
  listPromise = listPromise || listPublicCollections().catch(() => null)
  return listPromise
}

/**
 * Every active collection, in admin display order.
 *
 * Returns `{ collections, loading }`. `collections` is empty both before the
 * request resolves and when it fails — callers fall back to the tiles bundled
 * with the site in that case, so an API outage never blanks a public page.
 */
export default function usePublicCollections() {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchPublicCollections().then((rows) => {
      if (cancelled) return
      setCollections(Array.isArray(rows) ? rows : [])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { collections, loading }
}

/**
 * One collection by slug, for the details page.
 *
 * `collection` is null while loading AND when the slug is not a collection at
 * all — the details page also answers to the legacy category and brand slugs,
 * so "not found" has to be an ordinary result the caller can fall through on
 * rather than an error. `loading` is what distinguishes the two.
 */
export function usePublicCollection(slug) {
  // The slug the stored result belongs to is kept WITH it, so "is this result
  // current?" is derived at render rather than reset inside the effect. That
  // reset would be a setState in an effect body — a cascading render, and the
  // one thing that would let the previous collection show for a frame under
  // the new slug's heading.
  const [state, setState] = useState({ slug: null, collection: null })

  useEffect(() => {
    if (!slug) return undefined
    let cancelled = false

    getPublicCollection(slug)
      .catch(() => null)
      .then((row) => {
        if (cancelled) return
        setState({ slug, collection: row })
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  const settled = !slug || state.slug === slug

  return {
    collection: slug && settled ? state.collection : null,
    loading: !settled,
  }
}
