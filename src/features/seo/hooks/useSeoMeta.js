import { useEffect } from 'react'
import { getPublicMetadata } from '@/features/seo/seo.api.js'

// Sets/updates a <meta> tag by name or property, creating it if it
// doesn't exist yet. Tagged with data-seo-managed so cleanup can find
// and remove exactly the tags this hook created, without touching any
// other <meta> tags already in index.html (charset, viewport, etc).
function setMeta(attr, key, content) {
  if (content === undefined || content === null || content === '') return null
  let el = document.head.querySelector(`meta[${attr}="${key}"][data-seo-managed]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    el.setAttribute('data-seo-managed', 'true')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
  return el
}

function setLink(rel, href) {
  if (!href) return null
  let el = document.head.querySelector(`link[rel="${rel}"][data-seo-managed]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    el.setAttribute('data-seo-managed', 'true')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
  return el
}

// Public SEO integration — server/src/modules/seo/public/seo.public.service.ts
// generates title/description/canonical/robots/OG/Twitter/schema server-side
// (the frontend does NOT recompute any of these fallbacks itself, per the
// SEO doc's "VERY IMPORTANT BACKEND OWNERSHIP" section); this hook's only
// job is to take that response and push it into the actual document <head>,
// since this project is React/Vite rather than Next.js and has no
// generateMetadata()/react-helmet equivalent already in place.
//
// Usage: call useSeoMeta('home') (or 'brands/cartier', 'exhibitions/...',
// etc — whatever slug the SeoPage record uses) near the top of a public
// page component. Silently no-ops if no SeoPage exists yet for that slug
// (e.g. static pages that haven't been given an SEO record), so it never
// blocks the page from rendering.
export function useSeoMeta(slug) {
  useEffect(() => {
    if (!slug) return
    let cancelled = false

    getPublicMetadata(slug)
      .then((data) => {
        if (cancelled || !data) return

        if (data.title) document.title = data.title
        setMeta('name', 'description', data.description)
        setLink('canonical', data.alternates?.canonical)

        if (data.robots) {
          const parts = [data.robots.index ? 'index' : 'noindex', data.robots.follow ? 'follow' : 'nofollow']
          setMeta('name', 'robots', parts.join(', '))
        }

        const og = data.openGraph
        if (og) {
          setMeta('property', 'og:title', og.title)
          setMeta('property', 'og:description', og.description)
          setMeta('property', 'og:url', og.url)
          setMeta('property', 'og:site_name', og.siteName)
          setMeta('property', 'og:type', og.type)
          setMeta('property', 'og:image', og.images?.[0]?.url)
        }

        const tw = data.twitter
        if (tw) {
          setMeta('name', 'twitter:card', tw.card)
          setMeta('name', 'twitter:title', tw.title)
          setMeta('name', 'twitter:description', tw.description)
          setMeta('name', 'twitter:image', tw.images?.[0])
        }

        // JSON-LD structured data — backend-generated, frontend just embeds
        // it verbatim (per the doc: "Do NOT implement schema JSON generation").
        let schemaEl = document.head.querySelector('script[type="application/ld+json"][data-seo-managed]')
        if (data.schema) {
          if (!schemaEl) {
            schemaEl = document.createElement('script')
            schemaEl.type = 'application/ld+json'
            schemaEl.setAttribute('data-seo-managed', 'true')
            document.head.appendChild(schemaEl)
          }
          schemaEl.textContent = JSON.stringify(data.schema)
        } else if (schemaEl) {
          schemaEl.remove()
        }
      })
      .catch(() => {
        // No SEO record for this slug yet, or the request failed — leave
        // whatever title/meta tags are already in index.html untouched
        // rather than surfacing an error on a public page.
      })

    return () => { cancelled = true }
  }, [slug])
}

export default useSeoMeta
