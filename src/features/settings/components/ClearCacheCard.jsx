import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

import request from '@/services/api/client.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import { useCan } from '@/features/rbac/permissionsContext.js'
import Card from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'

// Settings > "Website cache".
//
// A save in the panel already empties the website's cache and tells every open
// page to fetch fresh data, with nothing to press. This button is for the day
// something still looks old: it empties every cache the server keeps and sends
// the same signal, so all open pages of the website reload their data within
// seconds, without anyone refreshing them.

const CARD_GLASS = {
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  boxShadow: 'var(--glass-shadow)',
}

export default function ClearCacheCard() {
  const { notify } = useToast()
  const canEdit = useCan('settings', 'edit')
  const [busy, setBusy] = useState(false)

  if (!canEdit) return null

  async function clear() {
    setBusy(true)
    try {
      await request('/admin/cache/clear', { method: 'POST' })
      notify('Website cache cleared. Open pages are updating now.')
    } catch (err) {
      notify(err.message || 'Could not clear the cache.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card glass className="p-5 sm:p-6 dark-surface" style={CARD_GLASS}>
      <div className="mb-3 flex items-center gap-2.5">
        <RefreshCw size={16} className="text-brass-300" aria-hidden />
        <h2 className="font-display text-base text-ink-900">Website cache</h2>
      </div>
      <p className="m-0 mb-4 text-sm leading-relaxed text-ink-400">
        Every save already updates the website straight away. If a page still shows something old, this empties
        everything the server remembers and tells every open page of the website to load fresh data.
      </p>
      <Button type="button" icon={RefreshCw} loading={busy} onClick={clear}>
        Clear website cache
      </Button>
    </Card>
  )
}
