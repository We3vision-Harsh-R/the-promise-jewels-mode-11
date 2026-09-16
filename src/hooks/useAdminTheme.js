import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'pj_admin_theme'
const DEFAULT_THEME = 'dark'

/**
 * Light or dark for the admin panel, remembered between visits.
 *
 * The panel ships dark. The whole dark treatment lives behind one attribute —
 * `[data-admin-theme="dark"]` on the same element that carries `.admin-theme`
 * (see the ADMIN — DARK THEME block in globals.css) — so switching is a matter
 * of setting that attribute, not of loading a second stylesheet. Light is the
 * absence of it, which is the styling the panel already had.
 *
 * The choice is per-browser rather than per-account: it is a preference about
 * this screen on this machine, not a fact about the user worth a column and a
 * round trip. localStorage can throw outright in a private window or with site
 * data blocked, so every access is guarded and the default simply stands.
 */
function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export default function useAdminTheme() {
  const [theme, setTheme] = useState(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // A browser refusing to store it is not a reason to refuse to apply it.
    }
  }, [theme])

  // The colour mixer renders through a portal on document.body, which is
  // outside the element carrying .admin-theme — so none of the panel scoping
  // reaches it. Marking the body too gives anything portalled a hook of its
  // own, and the attribute is cleared on the way out so the public site is
  // never left wearing an admin theme.
  useEffect(() => {
    document.body.dataset.adminTheme = theme
    return () => {
      delete document.body.dataset.adminTheme
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, setTheme, toggle, isDark: theme === 'dark' }
}
