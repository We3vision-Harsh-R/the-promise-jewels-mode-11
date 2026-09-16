import { useEffect, useState } from 'react'

import { getPublicPage } from '@/features/page-content/page-content.api.js'

// Editable copy for the public website.
//
// One fetch serves every section of a page, so a page with seven editable
// sections still makes a single request. Results are cached per page at
// module scope — the homepage mounts seven components that each read their
// own section, and they must not fire seven requests.
const cache = new Map()
const inFlight = new Map()

function loadPage(page) {
  if (cache.has(page)) return Promise.resolve(cache.get(page))

  if (!inFlight.has(page)) {
    const promise = getPublicPage(page)
      .then((data) => {
        cache.set(page, data || {})
        return cache.get(page)
      })
      .catch(() => {
        // A failed fetch must not blank the page — callers fall back to the
        // copy bundled with the site when they get nothing back.
        cache.set(page, {})
        return cache.get(page)
      })
      .finally(() => {
        inFlight.delete(page)
      })

    inFlight.set(page, promise)
  }

  return inFlight.get(page)
}

/**
 * Returns the copy for one section of one page, merged over `fallback`.
 *
 * `fallback` is the object the component shipped with, and it doubles as the
 * list of keys: only keys it declares are read, and a key the admin has not
 * overridden keeps its bundled value. An empty database, an untouched field
 * or a failed request therefore all render exactly what the component
 * rendered before its copy became editable.
 */
export default function useSectionContent(page, section, fallback) {
  const [content, setContent] = useState(fallback)

  useEffect(() => {
    let cancelled = false

    loadPage(page).then((pages) => {
      if (cancelled) return

      const saved = pages?.[section]
      if (!saved) return

      const merged = { ...fallback }
      let changed = false

      for (const key of Object.keys(fallback)) {
        if (saved[key] && saved[key] !== fallback[key]) {
          merged[key] = saved[key]
          changed = true
        }
      }

      // Styling that belongs to copy this component already declares.
      //
      // The rule above — only keys the fallback lists are read — is what keeps
      // a component from being handed fields it knows nothing about. But the
      // Editor now stores four styling values beside every piece of copy
      // (Font, Size, Weight, Spacing), and listing all four next to all 42
      // strings would mean 168 empty entries spread across seven files, every
      // one of which has to be remembered when a string is added.
      //
      // So they are matched by name instead: `titleTopFont` is accepted
      // because `titleTop` is declared. A styling key whose copy the component
      // does not have is still ignored, so the guarantee the rule exists for
      // is unchanged.
      for (const key of Object.keys(saved)) {
        if (key in fallback) continue

        const base = key.replace(/(Font|Size|Weight|Spacing)$/, '')
        if (base === key || !(base in fallback)) continue

        if (saved[key]) {
          merged[key] = saved[key]
          changed = true
        }
      }

      // The response always carries every field, defaults included, so most
      // loads produce a merge identical to the fallback. Keeping the original
      // object in that case matters: callers derive GSAP timelines from this
      // value, and handing them a new identity for unchanged copy would tear
      // down and replay an entrance animation on every page load.
      if (changed) setContent(merged)
    })

    return () => {
      cancelled = true
    }
    // `fallback` is a module-level constant at every call site; listing it
    // here would only re-run this effect if someone starts building it inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, section])

  return content
}
