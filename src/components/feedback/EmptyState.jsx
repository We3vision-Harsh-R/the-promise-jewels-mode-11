export default function EmptyState({ icon: Icon, title, description, action, dark = false }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div
          className={
            dark
              ? 'mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-brass-300/30 bg-white/5 text-brass-700'
              : 'mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ivory-200 text-ink-400'
          }
        >
          <Icon size={22} strokeWidth={1.5} />
        </div>
      )}
      <h3 className={dark ? 'font-display text-base text-ink-900' : 'font-display text-base text-ink-900'}>{title}</h3>
      {description && (
        <p className={dark ? 'mt-1.5 max-w-sm text-sm text-ink-900/55' : 'mt-1.5 max-w-sm text-sm text-ink-400'}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
