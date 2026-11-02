import { useCallback, useEffect, useState } from 'react'

import { getLockStatus, lockEditor, unlockEditor } from '@/features/page-content/page-content.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'

/**
 * Whether the Editor is locked, and how to change that.
 *
 * Locked means the website serves one frozen copy of everything the Editor
 * controls (no per-page requests, no checking for changes) and every save is
 * refused until it is unlocked. The server enforces that; this only drives it.
 */
export default function useEditorLock() {
  const { notify } = useToast()
  const [status, setStatus] = useState({ locked: false, lockedAt: null, lockedBy: null, version: null })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    getLockStatus()
      .then((next) => !cancelled && setStatus(next))
      .catch(() => {})
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [])

  const lock = useCallback(
    async () => {
      const next = await lockEditor()
      setStatus(next)
      notify('Published and locked. The website now serves this version.')
    },
    [notify]
  )

  const unlock = useCallback(
    async () => {
      const next = await unlockEditor()
      setStatus(next)
      notify('Editor unlocked. You can edit now.')
    },
    [notify]
  )

  return { ...status, ready, lock, unlock }
}
