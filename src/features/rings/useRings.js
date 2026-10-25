import { useMemo } from 'react'

import useSectionContent from '@/features/page-content/hooks/usePageContent.js'
import { HERO_RING } from '@/components/layout/heroContent.js'

// The spinning photographs. They are kept ONCE (Admin > Rings) and every page
// reads the same library: each page chooses which of the photographs it turns
// and the library says whether they come in the same order everywhere or in a
// different random order on each page.
//
//   const photos = useRingPhotos('about')          // outer ring for the About page
//   const inner  = useRingPhotos('home', 'inner')  // Home's inner ring
//
// Each entry is { src, style } — spread both onto the <img>. `style` carries the
// brightness / contrast / colour / hue match and the crop that were set for that
// photograph, and is undefined when nothing was changed from the original.

export const INNER_RING = [
  '/images/jewellery/image_95.webp',
  '/images/jewellery/image_96.webp',
  '/images/jewellery/image_97.webp',
  '/images/jewellery/image_98.webp',
  '/images/jewellery/image_99.webp',
  '/images/jewellery/image_100.webp',
  '/images/jewellery/image_101.webp',
  '/images/jewellery/image_102.webp',
  '/images/jewellery/image_82.webp',
  '/images/jewellery/image_83.webp',
  '/images/jewellery/image_84.webp',
  '/images/jewellery/image_86.webp',
]

// Every place a ring turns — the keys the Rings screen stores a selection under.
export const RING_PLACES = ['home', 'about', 'team', 'collections', 'brands', 'exhibitions', 'contact', 'blog', 'growth']

const ADJUSTMENTS = { brightness: '100', contrast: '100', saturation: '100', hue: '0', zoom: '100', x: '50', y: '50' }

/** The bundled value of every field of a ring, so an empty database changes nothing. */
function frameDefaults(list) {
  const out = {}
  list.forEach((src, index) => {
    const n = index + 1
    out[`${n}`] = src
    out[`${n}.enabled`] = 'true'
    for (const [key, value] of Object.entries(ADJUSTMENTS)) out[`${n}.${key}`] = value
  })
  return out
}

const DEFAULTS = {
  outer: frameDefaults(HERO_RING),
  inner: frameDefaults(INNER_RING),
  settings: { order: 'same', ...Object.fromEntries(RING_PLACES.map((place) => [`show.${place}`, ''])) },
}

const COUNT = { outer: HERO_RING.length, inner: INNER_RING.length }

/** The same sequence for the same seed, so a page keeps its order between renders. */
function seededShuffle(list, seed) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0

  const next = () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const out = [...list]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const num = (value, fallback, min, max) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/** The CSS that matches one photograph to its neighbours. Undefined when untouched. */
export function frameStyle(content, n) {
  const brightness = num(content[`${n}.brightness`], 100, 40, 160)
  const contrast = num(content[`${n}.contrast`], 100, 40, 160)
  const saturation = num(content[`${n}.saturation`], 100, 0, 220)
  const hue = num(content[`${n}.hue`], 0, -180, 180)
  const zoom = num(content[`${n}.zoom`], 100, 100, 300)
  const x = num(content[`${n}.x`], 50, 0, 100)
  const y = num(content[`${n}.y`], 50, 0, 100)

  const style = {}
  const filters = []
  if (brightness !== 100) filters.push(`brightness(${brightness}%)`)
  if (contrast !== 100) filters.push(`contrast(${contrast}%)`)
  if (saturation !== 100) filters.push(`saturate(${saturation}%)`)
  if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`)
  if (filters.length) style.filter = filters.join(' ')

  if (x !== 50 || y !== 50) style.objectPosition = `${x}% ${y}%`
  if (zoom !== 100) {
    style.transform = `scale(${zoom / 100})`
    style.transformOrigin = `${x}% ${y}%`
  }

  return Object.keys(style).length ? style : undefined
}

/**
 * The photographs one place turns, in the order it turns them.
 *
 * A place that has nothing ticked shows every photograph that is switched on;
 * if every photograph were switched off the whole library is used rather than
 * leaving a ring with nothing in it.
 */
export default function useRingPhotos(place, ring = 'outer') {
  const content = useSectionContent('rings', ring, DEFAULTS[ring])
  const settings = useSectionContent('rings', 'settings', DEFAULTS.settings)

  return useMemo(() => {
    const frames = []
    for (let n = 1; n <= COUNT[ring]; n += 1) {
      frames.push({
        n,
        src: content[`${n}`],
        enabled: content[`${n}.enabled`] !== 'false',
        style: frameStyle(content, n),
      })
    }

    let pool = frames.filter((frame) => frame.enabled)
    if (pool.length === 0) pool = frames

    // Which photographs this page uses applies to the outer ring; the inner
    // ring is always the whole of what is switched on.
    if (ring === 'outer') {
      const chosen = String(settings[`show.${place}`] || '')
        .split(',')
        .map((value) => Number(value))
        .filter(Number.isInteger)

      if (chosen.length) {
        const picked = pool.filter((frame) => chosen.includes(frame.n))
        if (picked.length) pool = picked
      }

      if (settings.order === 'random') pool = seededShuffle(pool, place)
    }

    return pool.map(({ src, style }) => ({ src, style }))
  }, [content, settings, place, ring])
}
