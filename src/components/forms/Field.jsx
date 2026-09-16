import { useRef, useState } from 'react'
import ColorPicker from '@/components/forms/ColorPicker.jsx'
import { classNames } from '@/utils/helpers.js'

// text-ink-900 resolves to #0E2B26 — technically a palette color, but dark
// enough to read as plain black on screen. Swapped for text-emerald-600
// (#0E4238) to match the same fix already applied to page headings in
// AdminLayout.jsx, so form fields and the "All statuses" filter select
// read as on-brand teal instead of black.
const baseInput =
  'w-full rounded-md border border-ink-100 bg-ivory-100 px-3.5 py-2.5 text-sm text-emerald-600 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brass-500/40 focus:border-brass-500 transition-colors'

export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={classNames('block', className)}>
      {label && (
        <span className="mb-1.5 flex items-baseline gap-1 text-xs font-medium text-ink-600">
          {label}
          {required && <span className="text-rose">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose">{error}</span>}
    </label>
  )
}

export function Input({ className, ...props }) {
  return <input className={classNames(baseInput, className)} {...props} />
}

export function Textarea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={classNames(baseInput, 'resize-y', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={classNames(baseInput, 'appearance-none bg-no-repeat', className)} {...props}>
      {children}
    </select>
  )
}

/**
 * A picture field: shows what is set now, and swaps it for a new upload.
 *
 * `fallback` is the image that would be used if this one is left empty — the
 * cover photo standing in for the sharing image, for instance. It is shown
 * greyed so an editor can see what readers would get without setting anything,
 * which is the difference between "empty" and "empty on purpose".
 */
export function ImageInput({
  value,
  fallback = '',
  accept = 'image/jpeg,image/png,image/webp',
  disabled,
  onPick,
  onClear,
}) {
  const shown = value || fallback
  const isFallback = !value && Boolean(fallback)

  return (
    <div className="flex items-start gap-3">
      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md border border-ink-100 bg-ivory-100">
        {shown ? (
          <img
            src={shown}
            alt=""
            className={classNames('h-full w-full object-cover', isFallback && 'opacity-40')}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[11px] text-ink-400">
            No image
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 pt-0.5">
        <label
          className={classNames(
            'inline-flex w-fit cursor-pointer items-center rounded-md border border-ink-100 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:border-brass-500 hover:text-brass-500',
            disabled && 'pointer-events-none opacity-50'
          )}
        >
          {value ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept={accept}
            disabled={disabled}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              // Clear the input so picking the SAME file twice still fires.
              event.target.value = ''
              if (file) onPick?.(file)
            }}
          />
        </label>

        {value && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onClear?.()}
            className="w-fit text-xs text-ink-400 underline-offset-2 transition-colors hover:text-rose hover:underline disabled:opacity-50"
          >
            Reset to the bundled picture
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A colour field: the brand's colours as round swatches, the hex beside them,
 * and one last swatch that opens the mixer.
 *
 * The swatches matter more than the mixer. Left with only a colour wheel,
 * every editor invents a slightly different teal and the site drifts out of
 * its own palette one page at a time. The listed colours are the brand's, and
 * they are one click away; anything else is still allowed, but it takes the
 * extra step of opening the panel, which is the right amount of friction.
 */
export function ColorInput({ value, palette = [], disabled, onChange }) {
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState(null)
  const mixRef = useRef(null)

  const current = (value || '').toLowerCase()
  const onPalette = palette.some((c) => c.value.toLowerCase() === current)
  const isCustom = Boolean(current) && !onPalette

  const openMixer = () => {
    if (disabled) return
    setAnchorRect(mixRef.current?.getBoundingClientRect() ?? null)
    setOpen(true)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {palette.map((colour) => {
        const active = colour.value.toLowerCase() === current
        return (
          <button
            key={colour.value}
            type="button"
            title={`${colour.label} — ${colour.value}`}
            disabled={disabled}
            onClick={() => onChange?.(colour.value)}
            style={{ backgroundColor: colour.value }}
            className={classNames(
              'h-6 w-6 rounded-full border transition-transform hover:scale-110 disabled:opacity-50',
              active ? 'border-brass-500 ring-2 ring-brass-500/40' : 'border-ink-100'
            )}
          />
        )
      })}

      {/* The mixer. Rainbow so it reads as "any colour" rather than as one
          more brand shade, and ringed when the current value came from it. */}
      <button
        ref={mixRef}
        type="button"
        title="Mix a custom colour"
        aria-label="Mix a custom colour"
        aria-expanded={open}
        disabled={disabled}
        onClick={openMixer}
        style={{
          background: isCustom
            ? current
            : 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
        className={classNames(
          'relative h-6 w-6 rounded-full border transition-transform hover:scale-110 disabled:opacity-50',
          isCustom ? 'border-brass-500 ring-2 ring-brass-500/40' : 'border-ink-100'
        )}
      >
        <span className="absolute inset-0 grid place-items-center">
          <span className="h-2 w-2 rounded-full bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />
        </span>
      </button>

      {/* The hex, typed directly. Editors quote colours to each other as
          codes, and a value pasted from a brand sheet should not have to be
          hunted for on a wheel. */}
      <input
        type="text"
        value={value || ''}
        disabled={disabled}
        placeholder="#000000"
        spellCheck={false}
        aria-label="Hex colour value"
        onChange={(event) => onChange?.(event.target.value)}
        className="ml-1 w-[92px] rounded-md border border-ink-100 bg-ivory-100 px-2 py-1.5 font-mono text-xs uppercase text-emerald-600 focus:border-brass-500 focus:outline-none focus:ring-2 focus:ring-brass-500/30 disabled:opacity-50"
      />

      {open && (
        <ColorPicker
          value={value}
          palette={palette}
          anchorRect={anchorRect}
          onChange={(hex) => onChange?.(hex)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * The typeface for one piece of copy. Each option is drawn in its own font,
 * because a list of names tells you nothing about what you are choosing.
 *
 * "Design default" is the empty value, and it is first for a reason: it is
 * what every field starts as, and what an editor picks to undo a change.
 */
export function FontSelect({ value, fonts = [], disabled, onChange }) {
  return (
    <Select
      value={value || ''}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      style={value ? { fontFamily: `"${value}", sans-serif` } : undefined}
    >
      <option value="">Design default</option>
      {fonts.map((font) => (
        <option key={font.value} value={font.value} style={{ fontFamily: `"${font.value}", sans-serif` }}>
          {font.label}
        </option>
      ))}
    </Select>
  )
}

/**
 * A size or a letter-spacing, either of which may be left empty.
 *
 * NumberInput below cannot be used for these: it coerces an empty box to its
 * minimum, so clearing a size would silently set 8px instead of handing the
 * field back to the design. Here empty stays empty all the way to the server,
 * which deletes the row.
 */
export function MeasureInput({ value, min, max, step = 1, unit = '', placeholder = 'Design default', disabled, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className={classNames(baseInput, 'w-full')}
      />
      {unit && <span className="shrink-0 text-xs text-ink-400">{unit}</span>}
      {value !== '' && value != null && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange?.('')}
          title="Back to the design's own value"
          className="shrink-0 rounded-md px-2 py-1 text-xs text-ink-400 transition-colors hover:text-rose disabled:opacity-50"
        >
          Reset
        </button>
      )}
    </div>
  )
}

/** The weight for one piece of copy. */
export function WeightSelect({ value, weights = [], disabled, onChange }) {
  return (
    <Select value={value || ''} disabled={disabled} onChange={(event) => onChange?.(event.target.value)}>
      <option value="">Design default</option>
      {weights.map((weight) => (
        <option key={weight.value} value={weight.value}>
          {weight.label}
        </option>
      ))}
    </Select>
  )
}

/**
 * A number field with a slider beside the box.
 *
 * The slider is for values that are felt rather than calculated — an animation
 * speed, a percentage — where dragging until it looks right beats guessing a
 * number. The box stays because some values are known exactly.
 *
 * The width lives on the wrapper, never on the input: `baseInput` already sets
 * `w-full`, and two width utilities on one element are settled by stylesheet
 * order rather than by which was written last.
 */
export function NumberInput({ value, min = 0, max = 100, step = 1, unit = '', disabled, onChange }) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : min

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numeric}
        disabled={disabled}
        onChange={(event) => onChange?.(Number(event.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-100 accent-brass-500 disabled:opacity-50"
      />
      <span className="flex shrink-0 items-center gap-1">
        <span className="w-20">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={numeric}
            disabled={disabled}
            onChange={(event) => onChange?.(Number(event.target.value))}
            className={classNames(baseInput, 'text-center')}
          />
        </span>
        {unit && <span className="whitespace-nowrap text-xs text-ink-400">{unit}</span>}
      </span>
    </div>
  )
}
