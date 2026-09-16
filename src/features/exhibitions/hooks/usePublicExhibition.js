import { useEffect, useState } from 'react'

import { getPublicExhibition } from '@/features/exhibitions/exhibition.api.js'

/**
 * One exhibition by slug, for its own page.
 *
 * Everything the page draws comes from this — the record, its gallery and its
 * custom sections all arrive in the one response, so nothing about a show is
 * bundled with the site.
 *
 * Returns `{ exhibition, loading }`. `exhibition` is null while loading AND
 * when the slug is not a show; `loading` is what tells the two apart, so the
 * page can show a proper "not found" instead of a permanent spinner.
 */
export default function usePublicExhibition(slug) {
  // The slug the stored result belongs to is kept WITH it, so "is this result
  // current?" is derived at render rather than reset inside the effect — a
  // reset there would be a setState in an effect body, and would let the
  // previous show render for a frame under the new slug's heading.
  const [state, setState] = useState({ slug: null, exhibition: null })

  useEffect(() => {
    if (!slug) return undefined
    let cancelled = false

    getPublicExhibition(slug)
      .catch(() => null)
      .then((row) => {
        if (cancelled) return
        setState({ slug, exhibition: row })
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  const settled = !slug || state.slug === slug

  return {
    exhibition: slug && settled ? state.exhibition : null,
    loading: !settled,
  }
}
