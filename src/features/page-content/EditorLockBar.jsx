import { useState } from 'react'
import { Lock, Unlock, UploadCloud } from 'lucide-react'

import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Modal from '@/components/ui/Modal.jsx'

/**
 * The Editor's publish button.
 *
 * "Publish & lock" freezes everything the Editor controls under a new unique
 * version. The website then loads that version once (checking it only when a page
 * is opened or reloaded) and every save is refused until "Unlock to edit".
 * The server enforces all of that; this only drives it.
 */
export default function EditorLockBar({ lock }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!lock.ready) return null

  const close = () => {
    if (busy) return
    setOpen(false)
    setError('')
  }

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await (lock.locked ? lock.unlock() : lock.lock())
      setOpen(false)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const since = lock.lockedAt ? new Date(lock.lockedAt).toLocaleString() : ''

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brass-500/15 text-brass-700">
            {lock.locked ? <Lock size={16} /> : <Unlock size={16} />}
          </span>
          <div>
            <p className="text-sm font-medium text-ink-900">
              {lock.locked ? 'Published and locked' : 'Editing — not locked'}
              {lock.locked && lock.version && (
                <span className="ml-2 rounded-md bg-ink-900/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-normal text-ink-600">
                  {lock.version}
                </span>
              )}
            </p>
            <p className="max-w-2xl text-xs text-ink-400">
              {lock.locked
                ? `Version published${lock.lockedBy ? ` by ${lock.lockedBy}` : ''}${since ? ` on ${since}` : ''}. The website shows this version and only checks it when a page is opened or reloaded.`
                : 'When the content is final, publish and lock it. The website then loads this version once and stops fetching content again.'}
            </p>
          </div>
        </div>

        <Button
          variant={lock.locked ? 'ghost' : 'primary'}
          icon={lock.locked ? Unlock : UploadCloud}
          onClick={() => setOpen(true)}
        >
          {lock.locked ? 'Unlock to edit' : 'Publish & lock'}
        </Button>
      </Card>

      <Modal
        open={open}
        onClose={close}
        size="sm"
        icon={lock.locked ? Unlock : UploadCloud}
        title={lock.locked ? 'Unlock to edit?' : 'Publish and lock?'}
        subtitle={
          lock.locked
            ? 'The Editor opens for changes. Visitors keep seeing the published version until you publish again.'
            : 'The content is saved as a new version and the Editor locks. This can take a few seconds.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirm} loading={busy}>
              {lock.locked ? 'Unlock' : 'Publish & lock'}
            </Button>
          </>
        }
      >
        {error ? <p className="text-sm text-rose">{error}</p> : null}
      </Modal>
    </>
  )
}
