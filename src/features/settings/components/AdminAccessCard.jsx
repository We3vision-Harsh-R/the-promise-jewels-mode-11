import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Plus, Trash2, LocateFixed, Lock } from 'lucide-react'
import * as accessService from '@/features/settings/adminNetwork.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import { useCan } from '@/features/rbac/permissionsContext.js'
import Card from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Switch from '@/components/ui/Switch.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import { Field, Input, Select } from '@/components/forms/Field.jsx'

// Shown under the password box on Settings. It decides which internet addresses
// may open the admin panel at all: anyone else is told the panel does not exist.
//
// The two things that can go wrong are both guarded on the server and explained
// here: locking yourself out (refused, with the reason), and a proxy that hides
// visitors' real addresses (the screen says so instead of pretending to work).

const CARD_GLASS = {
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  boxShadow: 'var(--glass-shadow)',
}

function StatusLine({ data }) {
  if (data.guardOff) {
    return <Badge dark tone="rose">Switched off from the host's settings</Badge>
  }
  if (!data.active) {
    return <Badge dark tone="ink">Off — anyone can reach the sign-in page</Badge>
  }
  return data.enforcing ? (
    <Badge dark tone="emerald">On — only the listed addresses can reach the admin panel</Badge>
  ) : (
    <Badge dark tone="ink">Report only — logging who would be refused, refusing nobody</Badge>
  )
}

export default function AdminAccessCard() {
  const canView = useCan('adminNetwork', 'view')
  const canAdd = useCan('adminNetwork', 'create')
  const canEdit = useCan('adminNetwork', 'edit')
  const canDelete = useCan('adminNetwork', 'delete')
  const { notify } = useToast()

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [confirmEnforce, setConfirmEnforce] = useState(false)

  const load = useCallback(
    () =>
      accessService
        .getAdminAccess()
        .then((result) => {
          setData(result)
          setError('')
        })
        .catch((err) => setError(err.message || 'Could not load the admin access list.')),
    [],
  )

  useEffect(() => {
    if (canView) load()
  }, [canView, load])

  if (!canView) return null

  // One place for every change: show the server's own explanation when it refuses.
  async function run(action, success) {
    setBusy(true)
    try {
      await action()
      if (success) notify(success)
      await load()
      return true
    } catch (err) {
      notify(err.message || 'That did not work.', { tone: 'error', duration: 8000 })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd(event) {
    event.preventDefault()
    const added = await run(
      () => accessService.addAdminAddress({ address: address.trim(), label: label.trim() }),
      'Address added.',
    )
    if (added) {
      setAddress('')
      setLabel('')
    }
  }

  function addMine() {
    return run(
      () => accessService.addAdminAddress({ address: data.yourAddress, label: label.trim() || 'My current address' }),
      'Your current address was added.',
    )
  }

  async function toggle(enabled) {
    // Turning it on starts as report-only unless it was already set to enforce:
    // the safe way to find out the server sees the right address.
    await run(
      () => accessService.saveAdminAccessSettings({ enabled }),
      enabled ? 'Admin access protection is on.' : 'Admin access protection is off.',
    )
  }

  async function changeMode(mode) {
    if (mode === 'enforce' && !confirmEnforce) {
      setConfirmEnforce(true)
      return
    }
    await run(() => accessService.saveAdminAccessSettings({ mode }), mode === 'enforce' ? 'Now refusing other addresses.' : 'Report-only mode.')
  }

  async function confirmRemove() {
    const id = removing
    const ok = await run(() => accessService.removeAdminAddress(id), 'Address removed.')
    if (ok) setRemoving(null)
  }

  return (
    <Card glass className="p-5 sm:p-6 dark-surface" style={CARD_GLASS}>
      <div className="mb-1 flex items-center gap-2.5">
        <ShieldCheck size={18} className="text-brass-700" />
        <h2 className="font-display text-base text-ink-900">Admin access</h2>
      </div>
      <p className="mb-5 text-xs text-ink-400">
        Decide which internet addresses may open this admin panel. Anyone else is told the panel does not exist. The
        public website is not affected.
      </p>

      {error && <p className="text-sm text-rose">{error}</p>}
      {!data && !error && <p className="text-sm text-ink-400">Loading…</p>}

      {data && (
        <div className="space-y-5">
          <StatusLine data={data} />

          {data.yourAddressIsPrivate && (
            <p className="rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs text-rose">
              The website sees your address as {data.yourAddress}, which is a private address. The proxy in front of the
              website is hiding visitors' real addresses (check TRUST_PROXY_HOPS in the host's settings). Until that is
              fixed a list of addresses cannot tell people apart, and it cannot be turned on.
            </p>
          )}

          {/* The address the server sees for this very request. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100/60 px-3.5 py-3">
            <div className="min-w-0">
              <p className="m-0 text-xs text-ink-400">Your address, as the website sees it now</p>
              <p className="m-0 mt-0.5 break-all font-mono text-sm text-ink-900">{data.yourAddress || 'unknown'}</p>
              <p className="m-0 mt-0.5 text-xs text-ink-400">
                {data.yourAddressIsListed ? 'This address is on the list.' : 'This address is not on the list yet.'}
              </p>
            </div>
            {canAdd && !data.yourAddressIsListed && !data.yourAddressIsPrivate && (
              <Button type="button" size="sm" icon={LocateFixed} loading={busy} onClick={addMine}>
                Add my current address
              </Button>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-600">Allowed addresses</p>

            {data.baseline.length === 0 && data.rules.length === 0 && (
              <p className="m-0 text-sm text-ink-400">Nothing yet. Add the office's address below.</p>
            )}

            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {data.baseline.map((entry) => (
                <li key={`host-${entry}`} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100/60 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block break-all font-mono text-sm text-ink-900">{entry}</span>
                    <span className="block text-xs text-ink-400">Set in the host's settings — cannot be removed here</span>
                  </span>
                  <Lock size={14} className="shrink-0 text-ink-400" aria-label="Permanent" />
                </li>
              ))}

              {data.rules.map((rule) => (
                <li key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100/60 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block break-all font-mono text-sm text-ink-900">{rule.address}</span>
                    <span className="block truncate text-xs text-ink-400">{rule.label}</span>
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setRemoving(rule.id)}
                      aria-label={`Remove ${rule.address}`}
                      className="shrink-0 rounded-md p-1.5 text-ink-400 hover:bg-rose/5 hover:text-rose"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {canAdd && (
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Address or range" hint="For example 203.0.113.24 or 203.0.113.0/24">
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="203.0.113.24" required />
                </Field>
                <Field label="Whose is it?" hint="So people know later.">
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Client office" maxLength={80} required />
                </Field>
              </div>
              <Button type="submit" size="sm" icon={Plus} loading={busy}>Add address</Button>
            </form>
          )}

          {canEdit && (
            <div className="space-y-3 border-t border-ink-100/50 pt-4">
              <Switch
                checked={Boolean(data.enabled)}
                disabled={busy || data.guardOff}
                onChange={toggle}
                label="Only listed addresses may open the admin panel"
                description="Turn on once your own address is on the list. It is refused if it would lock you out."
              />

              {data.enabled && (
                <Field
                  label="When someone else tries"
                  hint={
                    data.modeFromHost
                      ? `The host's settings force "${data.modeFromHost}" and override this.`
                      : 'Start with "report only", use the panel, then switch to refusing.'
                  }
                >
                  <Select value={data.mode} disabled={busy || Boolean(data.modeFromHost)} onChange={(e) => changeMode(e.target.value)}>
                    <option value="report">Only record it (report only)</option>
                    <option value="enforce">Refuse them (recommended once it works)</option>
                  </Select>
                </Field>
              )}
            </div>
          )}

          <p className="m-0 text-xs text-ink-400">
            Before you start: set <code>ADMIN_ALLOWED_IPS</code> in the host's settings to the one or two addresses that
            must never be locked out. If everyone is ever locked out, set <code>ADMIN_IP_GUARD=off</code> there and
            redeploy.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        loading={busy}
        title="Remove this address?"
        description="Nobody using it will be able to open the admin panel any more (once the protection is on). The server will refuse this if the address is the one you are using."
        confirmLabel="Remove"
      />

      <ConfirmDialog
        open={confirmEnforce}
        onClose={() => setConfirmEnforce(false)}
        onConfirm={async () => {
          await run(() => accessService.saveAdminAccessSettings({ mode: 'enforce' }), 'Now refusing other addresses.')
          setConfirmEnforce(false)
        }}
        loading={busy}
        title="Start refusing other addresses?"
        description="From now on anyone whose address is not on the list gets 'not found' for the admin panel. Only do this after report-only mode has run for a while with everyone who should get in."
        confirmLabel="Refuse others"
        tone="primary"
      />
    </Card>
  )
}
