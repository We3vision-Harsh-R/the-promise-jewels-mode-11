import { classNames } from '@/utils/helpers.js'

// Simple pill tab bar. `dark` uses the same brass-on-translucent-white
// language as the modal's glass fields (Modal.jsx) / TableToolbar's dark
// pills, so it reads correctly both on a light Card and inside the dark
// teal edit modal.
export default function Tabs({ tabs, active, onChange, dark = false }) {
  return (
    <div
      className={classNames(
        'inline-flex flex-wrap items-center gap-1 rounded-full p-1',
        dark ? 'bg-white/5 border border-white/10' : 'bg-ivory-100 border border-ink-100'
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={classNames(
              'px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap',
              isActive
                ? dark
                  ? 'text-[#163B34]'
                  : 'bg-white text-ink-900 shadow-sm'
                : dark
                  ? 'text-ink-400 hover:text-ink-900'
                  : 'text-ink-400 hover:text-ink-600'
            )}
            style={isActive && dark ? { background: 'linear-gradient(135deg, #C4A85D 0%, #AF8E52 100%)' } : undefined}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
