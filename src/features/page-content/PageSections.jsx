import { Fragment, useEffect, useRef } from 'react'
import { ScrollTrigger } from "@/lib/gsap.js"

import CustomSection from '@/features/page-content/CustomSection.jsx'
import usePageLayout from '@/features/page-content/hooks/usePageLayout.js'

/**
 * Renders one page's sections in the order the admin panel saved.
 *
 * A page hands over a registry — section key to a function that draws it — and
 * this decides which of them appear and in what sequence. The page file no
 * longer lists its own sections in JSX order, because that order now lives in
 * the database and is changed from Admin > Content without a deploy.
 *
 * The registry stays in the page file rather than in one global map on purpose:
 * a section key is only meaningful within its page ("hero" exists on six of
 * them), and keeping the mapping beside the page keeps the imports tree-shaken
 * per route.
 *
 * Each value is a FUNCTION returning JSX, not a component. Several pages hold
 * state their sections share — which brand is being filtered on, the shows
 * that have loaded — and a registry of bare components would have no way to
 * pass it. A closure written where that state lives has every bit of it, and
 * costs nothing: the element it returns still has its own component identity,
 * so React moves it on a reorder rather than rebuilding it.
 *
 * @param page      Page key, matching the catalogue on the server.
 * @param sections  { [key]: () => JSX }. Declaration order is the default
 *                  order, so an unsaved page renders exactly as before.
 */
export default function PageSections({ page, sections }) {
  const keys = Object.keys(sections)
  const { order, custom } = usePageLayout(page, keys)

  // Sections designed in the panel. They arrive with the arrangement rather
  // than being imported, because there is no file to import — the design is
  // the data, drawn by one component.
  const designs = new Map(custom.map((entry) => [entry.key, entry]))

  // Several sections pin themselves with ScrollTrigger, which measures the
  // document once on mount. Moving a section changes every measurement below
  // it, so a rearrangement that arrives after mount has to say so — without
  // this, a pinned section further down the page fires at the wrong scroll
  // position for the rest of the visit.
  const applied = useRef(null)

  useEffect(() => {
    const signature = order.join('|')
    if (applied.current === null) {
      applied.current = signature
      return
    }
    if (applied.current === signature) return

    applied.current = signature
    // After the browser has laid the new arrangement out, not during it.
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(frame)
  }, [order])

  return (
    <>
      {order.map((key) => {
        const design = designs.get(key)
        if (design) {
          return <CustomSection key={key} blocks={design.blocks} style={design.style} />
        }

        const render = sections[key]
        if (!render) return null

        // Keyed by section, so a reorder moves the existing DOM node instead
        // of tearing the component down and replaying its entrance.
        return <Fragment key={key}>{render()}</Fragment>
      })}
    </>
  )
}
