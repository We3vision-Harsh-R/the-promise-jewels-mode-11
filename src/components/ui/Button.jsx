import { classNames } from '@/utils/helpers.js'

// Gold gradient pill (matches the "View all" treatment on Recent
// inquiries) — used for every primary action across the admin (Add
// collection, Add brand, Add exhibition, etc.), since they all render
// through the "primary" variant below.
const PRIMARY_GRADIENT = 'linear-gradient(135deg, #C4A85D 0%, #AF8E52 100%)'

const variants = {
  primary:
    'shadow-[0_2px_8px_-2px_rgba(196,168,93,0.35)] hover:shadow-[0_3px_10px_-2px_rgba(196,168,93,0.45)] transition-shadow',
  brass: 'bg-brass-500 text-ink-900 hover:bg-brass-600 font-medium',
  ghost: 'bg-transparent text-ink-900 hover:bg-ink-50 border border-ink-100',
  danger: 'bg-transparent text-rose hover:bg-rose/10 border border-rose/30',
  link: 'bg-transparent text-brass-700 hover:text-brass-600 underline-offset-4 hover:underline p-0',
}

const sizes = {
  sm: 'text-xs px-3 py-1.5 rounded-xl',
  md: 'text-sm px-4 py-2.5 rounded-xl',
  lg: 'text-sm px-5 py-3 rounded-xl',
}

export default function Button({
  as: As = 'button',
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  className,
  children,
  disabled,
  style,
  ...props
}) {
  return (
    <As
      className={classNames(
        'inline-flex items-center justify-center gap-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
      style={variant === 'primary' ? { background: PRIMARY_GRADIENT, color: '#163B34', ...style } : style}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        Icon && <Icon size={15} strokeWidth={2} />
      )}
      {children}
      {!loading && IconRight && <IconRight size={15} strokeWidth={2} />}
    </As>
  )
}                      