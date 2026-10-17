import { useEffect, useMemo, useRef } from 'react'

/**
 * A faceted diamond drawn in real 3D with plain CSS — no 3D library, so it adds
 * a few kilobytes to the page rather than a few hundred.
 *
 * SHAPE
 * A round-brilliant reduced to what reads at this size: a flat top (the table),
 * eight sloping crown facets, and eight pavilion facets running down to a point
 * (the culet) — 32 triangles in all. Every triangle is one small element placed
 * in space with a matrix, so the browser does the hidden-surface work.
 *
 * MOTION
 * The turn follows the SCROLL of the page, not a timer: a pixel of scrolling is
 * a fixed number of degrees, so it keeps turning for as long as the visitor
 * keeps scrolling, in whichever direction they go, and rests when they rest.
 * The angle eases toward its target a little each frame so it glides instead of
 * stepping with the scroll wheel.
 *
 * LIGHT
 * Each frame, every facet's brightness is worked out again from the way it now
 * faces a fixed lamp, so facets flash and fade as they pass it — that moving
 * glitter is what makes it read as a gem rather than a spinning shape.
 *
 * COST
 * It only runs while it is on screen, writes 32 colours a frame, and does
 * nothing at all for visitors who ask their device to reduce motion (they get
 * the diamond standing still at a flattering angle).
 */

const DEG = Math.PI / 180

// Geometry, in CSS space (x right, y DOWN, z toward the viewer), in pixels.
const GIRDLE = 92 // radius of the widest ring
const TABLE = 50 // radius of the flat top
const CROWN = 36 // height from girdle up to the table
const PAVILION = 78 // depth from girdle down to the culet
const SIDES = 8

const TILT = 22 // degrees the diamond leans toward the viewer
const DEGREES_PER_PIXEL = 0.32
const EASE = 0.12

// A lamp up and to the left, in front. Unit length is applied below.
const LAMP = norm([-0.45, -0.75, 0.55])
// Halfway between the lamp and the viewer: where a mirror-like glint appears.
const HALF = norm([LAMP[0], LAMP[1], LAMP[2] + 1])

function norm(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** The 32 triangles of the stone, each with its outward normal. */
function buildFacets() {
  // y is measured so the stone is centred on its own middle.
  const centreShift = (PAVILION - CROWN) / 2
  const ring = (radius, y, offset = 0) =>
    Array.from({ length: SIDES }, (_, i) => {
      const angle = (i / SIDES) * Math.PI * 2 + offset
      return [Math.cos(angle) * radius, y, Math.sin(angle) * radius]
    })

  const tableY = -CROWN + centreShift
  const girdleY = centreShift
  const culet = [0, PAVILION + centreShift, 0]
  const tableCentre = [0, tableY, 0]

  const table = ring(TABLE, tableY)
  const girdle = ring(GIRDLE, girdleY)
  const triangles = []

  for (let i = 0; i < SIDES; i += 1) {
    const j = (i + 1) % SIDES
    // The flat top.
    triangles.push({ points: [tableCentre, table[i], table[j]], kind: 'table', index: i })
    // The sloping crown: a quad split in two.
    triangles.push({ points: [table[i], girdle[i], girdle[j]], kind: 'crown', index: i })
    triangles.push({ points: [table[i], girdle[j], table[j]], kind: 'crown', index: i })
    // The pavilion, down to the point.
    triangles.push({ points: [girdle[i], culet, girdle[j]], kind: 'pavilion', index: i })
  }

  return triangles.map((triangle, id) => {
    let [a, b, c] = triangle.points
    const centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]

    // Wound so that cross(b - a, c - a) points OUT of the stone: the browser
    // hides a face whose normal points away from the viewer, and that only
    // works out for the inside faces if the outside ones face outward.
    if (dot(cross(sub(b, a), sub(c, a)), centroid) < 0) {
      ;[b, c] = [c, b]
    }

    // A hair of overlap, so antialiasing never leaves a bright seam between
    // two facets that should meet exactly.
    const grow = (p) => [
      centroid[0] + (p[0] - centroid[0]) * 1.012,
      centroid[1] + (p[1] - centroid[1]) * 1.012,
      centroid[2] + (p[2] - centroid[2]) * 1.012,
    ]
    ;[a, b, c] = [grow(a), grow(b), grow(c)]

    const u = sub(b, a)
    const v = sub(c, a)
    const n = norm(cross(u, v))
    const SIZE = 100 // the element is 100px square; the matrix maps it onto the triangle

    return {
      id,
      kind: triangle.kind,
      index: triangle.index,
      normal: n,
      // Column-major matrix3d: x axis -> u, y axis -> v, z axis -> n, origin -> a.
      matrix: `matrix3d(${u[0] / SIZE},${u[1] / SIZE},${u[2] / SIZE},0,${v[0] / SIZE},${v[1] / SIZE},${v[2] / SIZE},0,${n[0]},${n[1]},${n[2]},0,${a[0]},${a[1]},${a[2]},1)`,
      // Each facet leans very slightly different in hue so the stone is not one flat tint.
      hueShift: ((triangle.index * 37 + id * 11) % 17) - 8,
    }
  })
}

/** Where a facet's normal points after the stone has turned by `yaw` and leaned by TILT. */
function turn(normal, yaw) {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  // rotateY
  const x1 = normal[0] * cy + normal[2] * sy
  const z1 = -normal[0] * sy + normal[2] * cy
  const y1 = normal[1]
  // rotateX
  const ct = Math.cos(TILT * DEG)
  const st = Math.sin(TILT * DEG)
  return [x1, y1 * ct - z1 * st, y1 * st + z1 * ct]
}

function colourFor(facet, yaw) {
  const n = turn(facet.normal, yaw)
  const diffuse = Math.max(0, dot(n, LAMP))
  const glint = Math.pow(Math.max(0, dot(n, HALF)), 22)

  // The table is a flat mirror; the crown and pavilion catch the light more softly.
  // Icy and pale, like a colourless stone, with the site's teal showing through
  // in the shadowed facets and gold-white flashing where the lamp hits.
  const base = facet.kind === 'table' ? 70 : facet.kind === 'crown' ? 46 : 30
  const lightness = Math.min(98, base + diffuse * 40 + glint * 60)
  const saturation = Math.max(8, 36 - glint * 28 - diffuse * 8)
  const hue = 184 + facet.hueShift + (1 - diffuse) * 10

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

export default function Diamond3D({ className = '', label = 'A rotating diamond' }) {
  const facets = useMemo(() => buildFacets(), [])
  const wrapRef = useRef(null)
  const scaleRef = useRef(null)
  const spinRef = useRef(null)
  const facetRefs = useRef([])

  // The stone is drawn at a fixed size and scaled to whatever box it is given,
  // so one component serves the large desktop placement and the small phone one.
  useEffect(() => {
    const wrap = wrapRef.current
    const scale = scaleRef.current
    if (!wrap || !scale) return undefined

    const fit = () => {
      const { width, height } = wrap.getBoundingClientRect()
      scale.style.transform = `scale(${Math.max(0.1, Math.min(width, height) / (GIRDLE * 2.3))})`
    }

    fit()
    if (typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(fit)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    const spin = spinRef.current
    if (!wrap || !spin) return undefined

    const paint = (yaw) => {
      spin.style.transform = `rotateX(${TILT}deg) rotateY(${yaw / DEG}deg)`
      for (const facet of facets) {
        const node = facetRefs.current[facet.id]
        if (node) node.style.background = colourFor(facet, yaw)
      }
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // A resting pose that shows several facets, for those who do not want motion.
    paint(28 * DEG)
    if (reduced) return undefined

    let visible = false
    let frame = 0
    let current = 28 * DEG
    let lastPainted = current

    const target = () => 28 * DEG + window.scrollY * DEGREES_PER_PIXEL * DEG

    const tick = () => {
      frame = 0
      if (!visible) return

      const goal = target()
      current += (goal - current) * EASE

      // Skip the 32 style writes when nothing has visibly moved.
      if (Math.abs(current - lastPainted) > 0.0004) {
        paint(current)
        lastPainted = current
      }

      frame = window.requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible && !frame) {
          // Joining mid-page: start from where the scroll is, not from the last pose.
          current = target()
          frame = window.requestAnimationFrame(tick)
        }
      },
      { rootMargin: '120px' },
    )
    observer.observe(wrap)

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [facets])

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={label}
      // No position class here on purpose: the caller says where it goes (absolute,
      // relative…). A default "relative" here fought the caller's "absolute" and won.
      className={`pointer-events-none select-none [perspective:900px] ${className}`}
    >
      {/* Light catching the edges: four small stars that fade in and out at
          different moments. Still (and fully visible) when motion is reduced. */}
      {[
        'left-[6%] top-[18%] h-[14px] w-[14px] [animation-delay:0s]',
        'right-[4%] top-[34%] h-[10px] w-[10px] [animation-delay:1.1s]',
        'left-[16%] bottom-[16%] h-[9px] w-[9px] [animation-delay:2.1s]',
        'right-[18%] top-[6%] h-[8px] w-[8px] [animation-delay:0.6s]',
      ].map((place) => (
        <span
          key={place}
          aria-hidden="true"
          className={`absolute ${place} bg-[#D4B45C] [clip-path:polygon(50%_0,60%_40%,100%_50%,60%_60%,50%_100%,40%_60%,0_50%,40%_40%)] [animation:pj-twinkle_3.2s_ease-in-out_infinite] motion-reduce:[animation:none]`}
        />
      ))}

      {/* A soft glow and a shadow on the "floor" so it does not float in nothing. */}
      <span className="absolute inset-[-10%] rounded-full bg-[radial-gradient(circle,rgba(201,161,90,0.22)_0%,rgba(40,111,111,0.12)_45%,transparent_70%)]" />
      <span className="absolute bottom-[2%] left-1/2 h-[8%] w-[56%] -translate-x-1/2 rounded-[50%] bg-[#01383B]/20 blur-[8px]" />

      {/* The stage: its middle is the stone's middle. */}
      <div className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: 'translate(-50%, -50%)' }}>
        <div ref={scaleRef} style={{ transformStyle: 'preserve-3d' }}>
          <div ref={spinRef} style={{ transformStyle: 'preserve-3d' }} className="will-change-transform">
            {facets.map((facet) => (
              <span
                key={facet.id}
                ref={(node) => {
                  facetRefs.current[facet.id] = node
                }}
                className="absolute left-0 top-0 block h-[100px] w-[100px] [backface-visibility:hidden] [clip-path:polygon(0_0,100%_0,0_100%)]"
                style={{ transform: facet.matrix, transformOrigin: '0 0' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
