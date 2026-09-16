import { useEffect, useState } from 'react'
import request from '@/services/api/client.js'

// Fallbacks are exported so a component can reference a single value (e.g.
// just the logo) without pulling in the hook and its request.
export const DEFAULT_LOGO_URL = '/images/PROMISE_LOGO.webp'

export const DEFAULT_CONTACT = {
  phone: '+91 95966 62900',
  email: 'thepromisejewels@gmail.com',
  address:
    'Sy No- 311/5, Laxmi Niwas, 1st Floor, Plot No - 101, Vasta Devdi Rd, Katargam, Surat, Gujarat 395004',
  // Kept as separate lines so the UI can render them stacked without having
  // to parse a single string.
  hours: ['Monday - Saturday', '10:00 AM - 7:00 PM', 'Sunday Closed'],
}

// Real Promise Jewels profiles. These are the fallbacks — whatever is saved
// in /admin/settings wins over them at runtime.
export const DEFAULT_SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/promise_jewels_pvt_ltd?igsi=ZDNlZDc0MzIxNw==',
  facebook: 'https://www.facebook.com/share/18UKWe1KTg/',
  linkedin: 'https://www.linkedin.com/company/promise-jewels/posts/?feedView=all',
}

// GET /settings/public returns the same small payload to every consumer —
// the footer's contact block, the hero's social row, and the inquiry form's
// contact card — and more than one of those is mounted on most pages. The
// in-flight promise is cached at module scope so they share ONE request
// instead of each firing its own on mount. A settings change therefore needs
// a reload to show up, which is the right trade-off for a public site.
let settingsPromise = null

function fetchPublicSettings() {
  // The .catch lives inside the cached promise so a failed fetch resolves to
  // null for every consumer rather than becoming an unhandled rejection.
  settingsPromise = settingsPromise || request('/settings/public').catch(() => null)
  return settingsPromise
}

/**
 * Site-wide public settings (logo, contact details, social links) with
 * hardcoded fallbacks that stay on screen if the request fails, so a
 * settings outage never blanks out a public page.
 *
 * Usage:
 *   const { logoUrl, contact, social } = usePublicSettings()
 */
export function usePublicSettings() {
  const [settings, setSettings] = useState({
    logoUrl: DEFAULT_LOGO_URL,
    contact: DEFAULT_CONTACT,
    social: DEFAULT_SOCIAL_LINKS,
  })

  useEffect(() => {
    let cancelled = false

    fetchPublicSettings().then((data) => {
      if (cancelled || !data) return
      setSettings({
        logoUrl: data.logoUrl || DEFAULT_LOGO_URL,
        contact: {
          phone: data.phone || DEFAULT_CONTACT.phone,
          email: data.email || DEFAULT_CONTACT.email,
          address: data.address || DEFAULT_CONTACT.address,
          // businessHours is stored as one newline-separated string in the
          // admin panel; split so every consumer gets the same array shape
          // as the fallback above.
          hours: data.businessHours
            ? data.businessHours.split('\n').map((line) => line.trim()).filter(Boolean)
            : DEFAULT_CONTACT.hours,
        },
        social: {
          instagram: data.instagramUrl || DEFAULT_SOCIAL_LINKS.instagram,
          facebook: data.facebookUrl || DEFAULT_SOCIAL_LINKS.facebook,
          linkedin: data.linkedinUrl || DEFAULT_SOCIAL_LINKS.linkedin,
        },
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

  return settings
}

export default usePublicSettings
