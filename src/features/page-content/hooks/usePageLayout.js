import { useEffect, useState } from 'react'

import { getPublicLayout } from '@/features/page-content/page-content.api.js'

// Which sections a page shows, and in what order.
//
// Same shape as usePageContent: one request per page, cached at module scope,
// and a bundled fallback that renders the page exactly as it shipped when the
// request has not landed yet, has failed, or has nothing saved.
//
// The fallback matters more here than it does for copy. An unanswered request
// leaves a heading with its bundled words; an unanswered request here would
// leave the page with NO sections at all. So the default order is always the
// starting value, never an empty list.
const cache = new Map()
const inFlight = new Map()

function loadLayout(page) {
  if (cache.has(page)) return Promise.resolve(cache.get(page))

  if (!inFlight.has(page)) {
    const promise = getPublicLayout(page)
      .then((data) => {
        cache.set(page, Array.isArray(data?.order) ? data : null)
        return cache.get(page)
      })
      .catch(() => {
        // null, not [] — "we don't know" has to stay distinguishable from
        // "an admin hid everything", or a network blip blanks the site.
        cache.set(page, null)
        return null
      })
      .finally(() => {
        inFlight.delete(page)
      })

    inFlight.set(page, promise)
  }

  return inFlight.get(page)
}

function sameOrder(a, b) {
  return a.length === b.length && a.every((key, index) => key === b[index])
}

const EMPTY = []

/**
 * Returns the sections to render, in order, and the designs for the ones that
 * were built in the panel.
 *
 * @param page          The page key, e.g. "home".
 * @param defaultOrder  The order the page is built in. Used until the saved
 *                      arrangement arrives, and kept if it never does.
 */
export default function usePageLayout(page, defaultOrder) {
  const [order, setOrder] = useState(defaultOrder)
  const [custom, setCustom] = useState(EMPTY)

  useEffect(() => {
    let cancelled = false

    loadLayout(page).then((data) => {
      if (cancelled || !data) return

      const designed = new Set((data.custom ?? []).map((entry) => entry.key))

      // A key the site has no component for is dropped rather than rendered
      // as a hole: the catalogue on the server can name a section this build
      // does not know about yet, and a half-deployed frontend should show
      // what it has rather than nothing. A designed section is always known —
      // its design arrived in the same response.
      const known = data.order.filter(
        (key) => defaultOrder.includes(key) || designed.has(key)
      )
      if (known.length === 0) return

      // Identity is deliberate. Most visits get the default arrangement back,
      // and handing down a new array for an unchanged order would remount
      // every section and replay its entrance animation on every load.
      setOrder((current) => (sameOrder(current, known) ? current : known))
      if (data.custom?.length) setCustom(data.custom)
    })

    return () => {
      cancelled = true
    }
    // `defaultOrder` is a module-level constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  return { order, custom }
}
