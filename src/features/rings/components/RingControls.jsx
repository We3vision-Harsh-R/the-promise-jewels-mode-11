import { useRef, useState } from 'react'
import { Check, ImagePlus, RotateCcw } from 'lucide-react'

import { frameStyle } from '@/features/rings/useRings.js'
import { classNames } from '@/utils/helpers.js'

// The three controls the Rings screen adds to the Editor's form:
//
//   RingFrameControl  one photograph — preview, replace, on/off, and the
//                     brightness / contrast / colour / hue / crop that match it
//                     to the photographs around it
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
  { key: 'x', label: 'Move left / right', min: 0, max: 100, step: 1, unit: '%', rest: 50 },
  { key: 'y', label: 'Move up / down', min: 0, max: 100, step: 1, unit: '%', rest: 50 },
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

function Slider({ item, value, disabled, onChange }) {
  return (
    <label className="grid grid-cols-[104px_1fr_46px] items-center gap-2 text-xs text-ink-500">
      <span>{item.label}</span>
      <input
        type="range"
        min={item.min}
        max={item.max}
        step={item.step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-1.5 w-full cursor-pointer accent-brass-600"
      />
      <span className="text-right tabular-nums text-ink-400">
        {value}
        {item.unit}
      </span>
    </label>
  )
}

export function RingFrameControl({ section, field, draft, disabled, onChange, onUpload }) {
  const n = field.key
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const src = draft[`${section.key}.${n}`] || field.default
  const enabled = draft[`${section.key}.${n}.enabled`] !== 'false'
  const values = readFrame(draft, section.key, n)
  const style = frameStyle(values, n)

  const set = (suffix, value) => onChange(section.key, `${n}.${suffix}`, String(value))

  const changed = [...ADJUSTMENTS, ...CROP].some(({ key, rest }) => Number(values[`${n}.${key}`]) !== rest)

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
    <div className={classNames('grid gap-4 rounded-xl border border-ink-100 bg-white p-3 sm:grid-cols-[132px_1fr]', !enabled && 'opacity-60')}>
      <div className="space-y-2">
        <div className="relative h-[165px] w-[132px] overflow-hidden rounded-[10px] bg-ivory-100">
          {/* The same filter and crop the website applies, so what is matched
              here is what visitors see. */}
          <img src={src} alt="" className="block h-full w-full object-cover" style={style} />
          {!enabled && (
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[10px] font-medium text-white">
              Not used
            </span>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="hidden" />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-100 px-2 py-1.5 text-xs font-medium text-ink-700 hover:border-brass-500 disabled:opacity-50"
        >
          <ImagePlus size={13} aria-hidden />
          {busy ? 'Uploading…' : 'Replace photo'}
        </button>
      </div>

      <div className="space-y-2.5">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-medium text-ink-700">
          <span>
            Use this photo on the website
            <span className="block font-normal text-ink-400">Switch off to take it out of every ring.</span>
          </span>
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(event) => onChange(section.key, `${n}.enabled`, event.target.checked ? 'true' : 'false')}
            className="h-4 w-4 accent-brass-600"
          />
        </label>

        <p className="m-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-brass-700">Match its colour</p>
        {ADJUSTMENTS.map((item) => (
          <Slider key={item.key} item={item} value={values[`${n}.${item.key}`]} disabled={disabled} onChange={(v) => set(item.key, v)} />
        ))}

        <p className="m-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-brass-700">Crop</p>
        {CROP.map((item) => (
          <Slider key={item.key} item={item} value={values[`${n}.${item.key}`]} disabled={disabled} onChange={(v) => set(item.key, v)} />
        ))}

        {changed && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => [...ADJUSTMENTS, ...CROP].forEach(({ key, rest }) => set(key, rest))}
            className="inline-flex items-center gap-1 text-xs font-medium text-brass-700 hover:underline disabled:opacity-50"
          >
            <RotateCcw size={12} aria-hidden />
            Reset colour and crop
          </button>
        )}
      </div>
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
        <span>{everything ? 'Showing every photograph that is switched on.' : `Showing ${selected.length} chosen photograph${selected.length === 1 ? '' : 's'}.`}</span>
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
