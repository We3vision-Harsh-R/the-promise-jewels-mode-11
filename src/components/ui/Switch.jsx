import { classNames } from '@/utils/helpers.js'

// No toggle-switch primitive exists yet elsewhere in the app (the one
// on/off field found, CollectionsPage.jsx's "Featured" checkbox, uses a
// plain <input type="checkbox">) — this is used for the SEO edit form's
// several ON/OFF fields (Indexed, Published, Include in Sitemap) which
// read much better as switches than checkboxes. Built with the same
// brass-gradient-when-on / translucent-white-when-off language as
// Button's primary variant and the modal's glass inputs, so it drops
// into either a light card or the dark modal without extra theming.
export default function Switch({ checked, onChange, label, description, disabled, className }) {
  return (
    <label className={classNames('flex items-center justify-between gap-4 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed', className)}>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-sm font-medium text-ink-900">{label}</span>}
          {description && <span className="text-xs text-ink-400 mt-0.5">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={classNames(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brass-300/40',
          checked ? '' : 'bg-white/10 border border-white/15'
        )}
        style={checked ? { background: 'linear-gradient(135deg, #C4A85D 0%, #AF8E52 100%)' } : undefined}
      >
        <span
          className={classNames(
            'inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
          )}
        />
      </button>
    </label>
  )
}
