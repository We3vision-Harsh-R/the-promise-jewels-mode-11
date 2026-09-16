import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { X } from 'lucide-react'
import { classNames } from '@/utils/helpers.js'

export default function Modal({ open, onClose, title, subtitle, icon: Icon, children, footer, size = 'md' }) {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)

  // Keep the latest onClose in a ref so the animation effect below doesn't
  // need it in its dependency array. Without this, every re-render of the
  // parent (e.g. typing into a form field inside the modal) creates a new
  // onClose function reference, which re-triggers the entrance animation
  // on every keystroke — the "jiggling" effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Mirror the theme scope of whatever mounted this modal onto the portal
  // root. Every Modal consumer today is an admin page; on the public site
  // (no .admin-theme in the DOM) this stays empty, so nothing changes there.
  const themeClass = useMemo(
    () => (open && document.querySelector('.admin-theme') ? 'admin-theme' : ''),
    [open]
  )

  // The CLASS alone was not enough, and the gap was invisible for a long time.
  //
  // Every dark rule in globals.css is written `.admin-theme[data-admin-theme=
  // "dark"] …` — the class AND the attribute. This tree carried the class but
  // not the attribute, so none of them matched and every modal in the dark
  // panel quietly rendered with the LIGHT theme's tokens: near-white inputs
  // with dark green text, floating on a dark page.
  //
  // useAdminTheme already mirrors the attribute onto <body> for exactly this
  // reason (the colour mixer portals there too), so it is read from there
  // rather than re-derived.
  const themeAttr = useMemo(
    () => (open ? document.body.dataset.adminTheme : undefined),
    [open]
  )

  useEffect(() => {
    if (!open) return
    const ctx = gsap.context(() => {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' })
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: 18, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' }
      )
    })
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      ctx.revert()
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open]) // ← only 'open' now, not 'onClose'

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return createPortal(
    <div
      ref={overlayRef}
      // themeClass is the fix for the washed-out/see-through dialog: this tree
      // is portalled to <body>, i.e. OUTSIDE the .admin-theme wrapper that
      // defines --glass-* and the ink-* scale. Without it every token here
      // resolved to nothing, `background: var(--glass-fill-strong)` was an
      // invalid declaration, and the panel rendered fully transparent — what
      // showed through was the dark scrim, not a panel.
      className={classNames(themeClass, 'pj-modal-overlay')}
      data-admin-theme={themeAttr}
      onClick={(e) => e.target === overlayRef.current && onCloseRef.current?.()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        // pj-glass-panel is the shared glass surface (see globals.css) — the
        // same one cards, the sidebar and the topbar use, so every surface in
        // the admin reads as one material instead of each hand-rolling its own
        // background/blur/shadow inline.
        className={classNames(
          'w-full rounded-card dark-surface max-h-[90vh] flex flex-col pj-glass-panel',
          sizes[size]
        )}
      >
        {/* Header: py-5 → py-3.5 and the icon/title gap-3 → gap-2.5. The
            header was taking up a disproportionate amount of the modal's
            vertical space relative to its content (one line of title +
            one line of subtitle), so this trims the empty air above/below
            the text without touching icon/close-button hit targets. */}
        <div className="flex items-start justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            {/* Optional circular icon badge, same treatment as
                SettingsPage's header icon — pass an `icon` prop (a
                lucide-react component) from the page that opens this
                modal to get it; omitted entirely when no icon is given
                so existing modals without one are unaffected. */}
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass-300/40 bg-white/5 text-brass-700">
                <Icon size={16} strokeWidth={2} />
              </span>
            )}
            <div>
              <h2 id="modal-title" className="font-display text-lg font-medium text-ink-900">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-xl p-1.5 text-ink-400 hover:text-ink-900 hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {/* Field treatment lives in globals.css under .pj-modal-body rather
            than as per-element overrides here. Every page's modal form uses
            the shared Field.jsx Input/Select/Textarea, so one rule there
            cascades to Brands, Collections, Exhibitions, Inquiries, SEO —
            all at once — and the fields stay in step with the glass panel
            they sit on instead of drifting out of sync with it. */}
        <div
          className={classNames(
            'px-6 py-4 overflow-y-auto pj-modal-body',
            '[&>form.space-y-4]:!space-y-3 [&>form.space-y-5]:!space-y-3'
          )}
        >
          {children}
        </div>
        {footer && <div className="px-6 py-3.5 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}