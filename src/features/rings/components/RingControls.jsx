import { useRef, useState } from 'react'
import { Check, ImagePlus, RotateCcw } from 'lucide-react'

import { frameStyle } from '@/features/rings/useRings.js'
import { classNames } from '@/utils/helpers.js'

// The controls the Rings screen adds to the Editor's form:
//
//   RingFrameControl  one photograph — a small row to scan, and an editor that
//                     opens under it: preview, replace, and the brightness /
//                     contrast / colour / hue / crop that match it to the
//                     photographs around it, with a side-by-side comparison
//   FramesPicker      which of the photographs one page turns
//   ChoiceInput       a short list of named choices as radio buttons

const ADJUSTMENTS = [
  { key: 'brightness', label: 'Brightness', min: 40, max: 160, step: 1, unit: '%', rest: 100 },
  { key: 'contrast', label: 'Contrast', min: 40, max: 160, step: 1, unit: '%', rest: 100 },
  { key: 'saturation', label: 'Colour strength', min: 0, max: 220, step: 1, unit: '%', rest: 100 },
  { key: 'hue', label: 'Hue', min: -180, max: 180, step: 1, unit: '°', rest: 0 },
]

const CROP = [
  { key: 'zoom', label: 'Zoom', min: 100, max: 300, step: 1, unit: '%', rest: 100 },
  { key: 'x', label: 'Left / right', min: 0, max: 100, step: 1, unit: '%', rest: 50 },
  { key: 'y', label: 'Up / down', min: 0, max: 100, step: 1, unit: '%', rest: 50 },
]

/** The values a frame's sliders hold, read from the editor's draft. */
function readFrame(draft, sectionKey, n) {
  const values = {}
  for (const { key, rest } of [...ADJUSTMENTS, ...CROP]) {
    const raw = draft[`${sectionKey}.${n}.${key}`]
    values[`${n}.${key}`] = raw === '' || raw === undefined ? String(rest) : raw
  }
  return values
}

/** A slider with its value typed beside it, short enough to take in at a glance. */
function Slider({ item, value, disabled, onChange }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,170px)_62px] items-center gap-2 text-xs text-ink-500">
      <span className="truncate">{item.label}</span>
      <input
        type="range"
        min={item.min}
        max={item.max}
        step={item.step}
        value={value}
        disabled={disabled}
        aria-label={item.label}
        onChange={(event) => onChange(event.target.value)}
        className="h-1.5 w-full cursor-pointer accent-brass-600"
      />
      <span className="relative">
        <input
          type="number"
          min={item.min}
          max={item.max}
          step={item.step}
          value={value}
          disabled={disabled}
          aria-label={`${item.label} value`}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(String(Math.min(item.max, Math.max(item.min, next))))
          }}
          className="w-full rounded-md border border-ink-100 bg-white py-0.5 pl-1.5 pr-4 text-right text-[11px] tabular-nums text-ink-700 focus:border-brass-500 focus:outline-none"
        />
        <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-ink-400">
          {item.unit}
        </span>
      </span>
    </div>
  )
}

/** One photograph exactly as the website shows it. */
function Preview({ src, style, caption, badge }) {
  return (
    <figure className="m-0 space-y-1.5">
      <div className="relative h-[200px] w-[160px] overflow-hidden rounded-[10px] bg-ivory-100 shadow-sm">
        <img src={src} alt="" className="block h-full w-full object-cover" style={style} />
        {badge && (
          <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-medium text-white">
            {badge}
          </span>
        )}
      </div>
      <figcaption className="text-center text-[11px] text-ink-400">{caption}</figcaption>
    </figure>
  )
}

export function RingFrameControl({ section, field, draft, disabled, onChange, onUpload }) {
  const n = field.key
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [original, setOriginal] = useState(false)
  const [compareWith, setCompareWith] = useState('')

  const src = draft[`${section.key}.${n}`] || field.default
  const enabled = draft[`${section.key}.${n}.enabled`] !== 'false'
  const values = readFrame(draft, section.key, n)
  const style = frameStyle(values, n)
  const all = [...ADJUSTMENTS, ...CROP]
  const changed = all.some(({ key, rest }) => Number(values[`${n}.${key}`]) !== rest)

  // The other photographs of this ring, for the side-by-side view.
  const others = section.fields.filter((item) => item.type === 'ringframe' && item.key !== n)
  const other = others.find((item) => item.key === compareWith)
  const otherSrc = other ? draft[`${section.key}.${other.key}`] || other.default : ''
  const otherStyle = other ? frameStyle(readFrame(draft, section.key, other.key), other.key) : undefined

  const set = (suffix, value) => onChange(section.key, `${n}.${suffix}`, String(value))

  async function pick(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const url = await onUpload(file)
      if (url) onChange(section.key, n, url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={classNames('rounded-xl border border-ink-100 bg-white', !enabled && 'opacity-70')}>
      {/* Closed: a small row, so eighteen photographs stay easy to scan. */}
      <div className="flex items-center gap-3 p-2.5">
        <div className="h-[52px] w-[42px] shrink-0 overflow-hidden rounded-md bg-ivory-100">
          <img src={src} alt="" className="block h-full w-full object-cover" style={style} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-medium text-ink-900">Photo {n}</p>
          <p className="m-0 flex flex-wrap gap-1.5 text-[11px] text-ink-400">
            <span>{enabled ? 'Used on the website' : 'Not used'}</span>
            {changed && <span className="text-brass-700">· colour / crop adjusted</span>}
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-500">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(event) => onChange(section.key, `${n}.enabled`, event.target.checked ? 'true' : 'false')}
            className="h-4 w-4 accent-brass-600"
          />
          Use
        </label>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brass-500"
        >
          {open ? 'Close' : 'Edit'}
        </button>
      </div>

      {open && (
        <div className="grid gap-5 border-t border-ink-100 p-4 lg:grid-cols-[auto_1fr]">
          {/* What it looks like — and next to another photograph to match against. */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-start gap-3">
              <Preview
                src={src}
                style={original ? undefined : style}
                caption={original ? 'Original' : `Photo ${n} — as shown`}
                badge={!enabled ? 'Not used' : undefined}
              />
              {other && <Preview src={otherSrc} style={otherStyle} caption={`Photo ${other.key} — to match`} />}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onMouseDown={() => setOriginal(true)}
                onMouseUp={() => setOriginal(false)}
                onMouseLeave={() => setOriginal(false)}
                onTouchStart={() => setOriginal(true)}
                onTouchEnd={() => setOriginal(false)}
                className="rounded-lg border border-ink-100 px-2.5 py-1.5 text-xs text-ink-600 hover:border-brass-500"
              >
                Hold to see the original
              </button>

              <select
                value={compareWith}
                onChange={(event) => setCompareWith(event.target.value)}
                aria-label="Compare with another photograph"
                className="rounded-lg border border-ink-100 bg-white px-2 py-1.5 text-xs text-ink-700 focus:border-brass-500 focus:outline-none"
              >
                <option value="">Compare with…</option>
                {others.map((item) => (
                  <option key={item.key} value={item.key}>
                    Photo {item.key}
                  </option>
                ))}
              </select>
            </div>

            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="hidden" />
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-100 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:border-brass-500 disabled:opacity-50"
            >
              <ImagePlus size={13} aria-hidden />
              {busy ? 'Uploading…' : 'Replace photo'}
            </button>
          </div>

          <div className="grid content-start gap-x-8 gap-y-4 xl:grid-cols-2">
            <div className="space-y-2">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-brass-700">Match its colour</p>
              {ADJUSTMENTS.map((item) => (
                <Slider
                  key={item.key}
                  item={item}
                  value={values[`${n}.${item.key}`]}
                  disabled={disabled}
                  onChange={(v) => set(item.key, v)}
                />
              ))}
            </div>

            <div className="space-y-2">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-brass-700">Crop</p>
              {CROP.map((item) => (
                <Slider
                  key={item.key}
                  item={item}
                  value={values[`${n}.${item.key}`]}
                  disabled={disabled}
                  onChange={(v) => set(item.key, v)}
                />
              ))}

              {changed && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => all.forEach(({ key, rest }) => set(key, rest))}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brass-700 hover:underline disabled:opacity-50"
                >
                  <RotateCcw size={12} aria-hidden />
                  Reset colour and crop
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Frame numbers, "1,4,5" -> [1, 4, 5]. */
function parseFrames(value) {
  return String(value || '')
    .split(',')
    .map((item) => Number(item))
    .filter(Number.isInteger)
}

export function FramesPicker({ value, draft, disabled, onChange }) {
  const selected = parseFrames(value)
  const everything = selected.length === 0
  const frames = Array.from({ length: 18 }, (_, index) => index + 1)

  function toggle(n) {
    const next = selected.includes(n) ? selected.filter((item) => item !== n) : [...selected, n].sort((a, b) => a - b)
    onChange(next.join(','))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span>
          {everything
            ? 'Showing every photograph that is switched on.'
            : `Showing ${selected.length} chosen photograph${selected.length === 1 ? '' : 's'}.`}
        </span>
        {!everything && (
          <button type="button" disabled={disabled} onClick={() => onChange('')} className="font-medium text-brass-700 hover:underline disabled:opacity-50">
            Show all
          </button>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
        {frames.map((n) => {
          const checked = selected.includes(n)
          const off = draft[`outer.${n}.enabled`] === 'false'

          return (
            <button
              key={n}
              type="button"
              disabled={disabled || off}
              onClick={() => toggle(n)}
              aria-pressed={checked}
              title={off ? `Photo ${n} is switched off` : `Photo ${n}`}
              className={classNames(
                'relative aspect-[4/5] overflow-hidden rounded-md border-2 transition-colors disabled:cursor-not-allowed',
                checked ? 'border-brass-500' : 'border-transparent hover:border-brass-500/40',
                off && 'opacity-30',
              )}
            >
              <img src={draft[`outer.${n}`]} alt="" className="h-full w-full object-cover" style={frameStyle(readFrame(draft, 'outer', n), n)} />
              {checked && (
                <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brass-500 text-white">
                  <Check size={10} aria-hidden />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ChoiceInput({ field, value, disabled, onChange }) {
  const current = value || field.default

  return (
    <div className="space-y-2" role="radiogroup" aria-label={field.label}>
      {field.options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-700">
          <input
            type="radio"
            name={field.key}
            value={option.value}
            checked={current === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 accent-brass-600"
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
