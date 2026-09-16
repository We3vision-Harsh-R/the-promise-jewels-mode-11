import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * The mixing panel behind the last swatch in a colour field.
 *
 * The brand palette covers the colours the site is meant to use, and picking
 * off it is deliberately the easy path. This is the other case: the shade that
 * genuinely is not on the list. A native <input type="color"> would do the job
 * but hands the editor the operating system's dialog — a different one on
 * every machine, none of them showing the brand's own colours or the hex the
 * rest of this form is written in.
 *
 * So: saturation square, hue rail, opacity rail, hex box. The value is held as
 * HSV while the panel is open because that is what the square and the rails
 * are — dragging to black in RGB loses the hue you were on, and the cursor
 * jumps back to red when you drag out again.
 */

// --- colour maths ---------------------------------------------------------

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

function hsvToRgb(h, s, v) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x]
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

function rgbToHsv(r, g, b) {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / d) % 6)
    else if (max === gg) h = 60 * ((bb - rr) / d + 2)
    else h = 60 * ((rr - gg) / d + 4)
  }
  if (h < 0) h += 360

  return { h, s: max === 0 ? 0 : d / max, v: max }
}

const toHex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')

/** Accepts #rgb, #rrggbb and #rrggbbaa. Returns null when it is not a colour. */
function parseHex(input) {
  const raw = String(input || '').trim().replace(/^#/, '')

  const expand = (s) => s.split('').map((c) => c + c).join('')
  const hex =
    raw.length === 3 ? expand(raw) : raw.length === 4 ? expand(raw) : raw

  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return null

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  }
}

/** Opaque colours stay 6 digits — an "ff" tail on every value is just noise. */
function toHex({ h, s, v }, alpha) {
  const [r, g, b] = hsvToRgb(h, s, v)
  const base = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`
  return alpha >= 1 ? base : `${base}${toHex2(alpha * 255)}`
}

// --- a draggable area -----------------------------------------------------

/**
 * Turns pointer position into a 0–1 fraction, for the square and both rails.
 *
 * Pointer capture is what makes a drag survive leaving the element: without it
 * the square stops tracking the moment the cursor crosses its own edge, which
 * is exactly when someone is dragging to pure white or pure black.
 */
function useDrag(onMove) {
  const ref = useRef(null)

  const handle = useCallback(
    (event) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      onMove({
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
      })
    },
    [onMove],
  )

  const onPointerDown = (event) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    handle(event)
  }

  const onPointerMove = (event) => {
    if (event.buttons !== 1) return
    handle(event)
  }

  return [ref, { onPointerDown, onPointerMove }]
}

// --- the panel ------------------------------------------------------------

export default function ColorPicker({ value, palette = [], anchorRect, onChange, onClose }) {
  const parsed = parseHex(value) ?? { r: 231, g: 77, b: 77, a: 1 }
  const [hsv, setHsv] = useState(() => rgbToHsv(parsed.r, parsed.g, parsed.b))
  const [alpha, setAlpha] = useState(parsed.a)
  const [hexDraft, setHexDraft] = useState((value || '').replace(/^#/, '').toUpperCase())
  const panelRef = useRef(null)

  // Emit on every adjustment so the page behind updates live, which is the
  // whole point of a picker sitting next to what it is colouring.
  const emit = (nextHsv, nextAlpha) => {
    const hex = toHex(nextHsv, nextAlpha)
    setHexDraft(hex.replace(/^#/, '').toUpperCase())
    onChange?.(hex)
  }

  const [squareRef, squareDrag] = useDrag(({ x, y }) => {
    const next = { ...hsv, s: x, v: 1 - y }
    setHsv(next)
    emit(next, alpha)
  })

  const [hueRef, hueDrag] = useDrag(({ x }) => {
    const next = { ...hsv, h: x * 360 }
    setHsv(next)
    emit(next, alpha)
  })

  const [alphaRef, alphaDrag] = useDrag(({ x }) => {
    setAlpha(x)
    emit(hsv, x)
  })

  // Positioned against the button that opened it, in a portal, so a panel
  // opened on the last row of a long form is not clipped by the card it sits
  // in. Flipped above the button when there is no room below.
  //
  // Derived during render rather than set from an effect: the panel would
  // otherwise paint once at 0,0 and jump into place on the next frame.
  const placement = useMemo(() => {
    if (!anchorRect) return { top: 0, left: 0 }
    const width = 268
    const height = 360
    const gap = 8
    const left = clamp(anchorRect.left, 8, window.innerWidth - width - 8)
    const below = anchorRect.bottom + gap
    const top =
      below + height > window.innerHeight
        ? Math.max(8, anchorRect.top - height - gap)
        : below
    return { top, left }
  }, [anchorRect])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    const onDown = (event) => {
      if (!panelRef.current?.contains(event.target)) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    // Deferred so the click that opened the panel does not immediately shut it.
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      clearTimeout(id)
    }
  }, [onClose])

  const [pr, pg, pb] = hsvToRgb(hsv.h, hsv.s, hsv.v)
  const solid = `rgb(${pr}, ${pg}, ${pb})`
  const hueSolid = `hsl(${hsv.h}, 100%, 50%)`

  const commitHex = () => {
    const next = parseHex(hexDraft)
    if (!next) {
      setHexDraft((value || '').replace(/^#/, '').toUpperCase())
      return
    }
    const nextHsv = rgbToHsv(next.r, next.g, next.b)
    setHsv(nextHsv)
    setAlpha(next.a)
    onChange?.(toHex(nextHsv, next.a))
  }

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: placement.top, left: placement.left, width: 268 }}
      className="pj-picker fixed z-[100] rounded-2xl border p-3 shadow-[0_18px_50px_rgba(1,56,59,0.22)]"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-600">Custom</span>
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Close the colour picker"
          className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ivory-100 hover:text-emerald-600"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Saturation (x) against brightness (y), over the current hue. */}
      <div
        ref={squareRef}
        {...squareDrag}
        className="relative h-[150px] w-full cursor-crosshair touch-none overflow-hidden rounded-lg"
        style={{
          backgroundColor: hueSolid,
          backgroundImage:
            'linear-gradient(to right, #fff, rgba(255,255,255,0)), linear-gradient(to top, #000, rgba(0,0,0,0))',
        }}
      >
        <span
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: solid }}
        />
      </div>

      <div className="mt-3 space-y-2.5">
        <Rail
          railRef={hueRef}
          drag={hueDrag}
          thumbAt={hsv.h / 360}
          thumbColor={hueSolid}
          background="linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)"
          label="Hue"
        />
        <Rail
          railRef={alphaRef}
          drag={alphaDrag}
          thumbAt={alpha}
          thumbColor={solid}
          checkered
          background={`linear-gradient(to right, rgba(${pr},${pg},${pb},0) 0%, rgb(${pr},${pg},${pb}) 100%)`}
          label="Opacity"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-md border border-ink-100 px-2 py-1.5 text-[11px] font-medium text-ink-400">
          Hex
        </span>
        <input
          value={hexDraft}
          onChange={(event) => setHexDraft(event.target.value.replace(/^#/, '').toUpperCase())}
          onBlur={commitHex}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitHex()
            }
          }}
          spellCheck={false}
          aria-label="Hex colour value"
          className="min-w-0 flex-1 rounded-md border border-ink-100 bg-ivory-100 px-2 py-1.5 font-mono text-xs uppercase text-emerald-600 focus:border-brass-500 focus:outline-none focus:ring-2 focus:ring-brass-500/30"
        />
        <span className="w-14 shrink-0 text-right font-mono text-xs text-ink-400">
          {Math.round(alpha * 100)}%
        </span>
      </div>

      {palette.length > 0 && (
        <>
          <p className="mt-3 mb-1.5 text-[11px] font-medium text-ink-400">Brand palette</p>
          <div className="flex flex-wrap gap-1.5">
            {palette.map((colour) => (
              <button
                key={colour.value}
                type="button"
                title={`${colour.label} — ${colour.value}`}
                onClick={() => {
                  const next = parseHex(colour.value)
                  if (!next) return
                  const nextHsv = rgbToHsv(next.r, next.g, next.b)
                  setHsv(nextHsv)
                  setAlpha(1)
                  setHexDraft(colour.value.replace(/^#/, '').toUpperCase())
                  onChange?.(colour.value)
                }}
                style={{ backgroundColor: colour.value }}
                className="h-5 w-5 rounded-full border border-ink-100 transition-transform hover:scale-110"
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}

/** One horizontal slider — the hue rail and the opacity rail are the same thing. */
function Rail({ railRef, drag, thumbAt, thumbColor, background, checkered, label }) {
  return (
    <div
      ref={railRef}
      {...drag}
      aria-label={label}
      className="relative h-3.5 w-full cursor-pointer touch-none rounded-full"
      style={
        checkered
          ? {
              backgroundImage:
                'linear-gradient(45deg, #d6d6d6 25%, transparent 25%), linear-gradient(-45deg, #d6d6d6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d6d6d6 75%), linear-gradient(-45deg, transparent 75%, #d6d6d6 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
            }
          : undefined
      }
    >
      <div className="absolute inset-0 rounded-full" style={{ backgroundImage: background }} />
      <span
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{ left: `${thumbAt * 100}%`, backgroundColor: thumbColor }}
      />
    </div>
  )
}
