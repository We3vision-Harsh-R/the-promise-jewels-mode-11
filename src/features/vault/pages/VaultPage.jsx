import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Pin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'

import * as vaultService from '@/features/vault/vault.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import { Can } from '@/features/rbac/usePermissions.jsx'
import Card from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'
import Modal from '@/components/ui/Modal.jsx'
import { Field, Input, Select, Textarea } from '@/components/forms/Field.jsx'
import { classNames } from '@/utils/helpers.js'

// The vault.
//
// Everything on this screen belongs to the account looking at it and to nobody
// else — not to a colleague, not to the Master role. That is enforced on the
// server (secure-notes.service.ts), not here; this screen simply never asks
// for anyone else's.
//
// What reaches the database is one sealed blob per entry. The title, the
// password, even which KIND of entry it is are all inside it. What is written
// down here is only ever in transit and in this tab's memory.

const BLANK = {
  kind: 'note',
  title: '',
  body: '',
  url: '',
  fields: [],
  tags: [],
}

/** The fields each kind starts with. A person should not have to invent them. */
const STARTERS = {
  note: [],
  login: [
    { label: 'Username', value: '', secret: false },
    { label: 'Password', value: '', secret: true },
  ],
  card: [
    { label: 'Card number', value: '', secret: true },
    { label: 'Expiry', value: '', secret: false },
    { label: 'CVV', value: '', secret: true },
    { label: 'PIN', value: '', secret: true },
  ],
  bank: [
    { label: 'Account number', value: '', secret: true },
    { label: 'IFSC', value: '', secret: false },
    { label: 'Customer ID', value: '', secret: false },
  ],
}

export default function VaultPage() {
  const { notify } = useToast()

  const [options, setOptions] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all')

  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(BLANK)
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const [opts, list] = await Promise.all([
          vaultService.getOptions(),
          vaultService.listEntries(),
        ])
        if (cancelled) return
        setOptions(opts)
        setEntries(list)
      } catch (err) {
        if (!cancelled) notify(err.message || 'The vault could not be opened.', { tone: 'error' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [notify, reloadToken])

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  const kinds = options?.kinds ?? []
  const kindLabel = (value) => kinds.find((k) => k.value === value)?.label ?? value

  /**
   * Search happens here, in the browser, over what has already been decrypted
   * to be shown. The alternative — sending the query to the server — would
   * describe what is being looked for to anyone watching, and keeping a
   * searchable copy of the titles server-side is the one thing the sealed
   * payload exists to prevent.
   */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()

    return entries.filter((entry) => {
      if (entry.damaged) return true
      if (kindFilter !== 'all' && entry.payload.kind !== kindFilter) return false
      if (!q) return true

      const haystack = [
        entry.payload.title,
        entry.payload.body,
        entry.payload.url,
        ...entry.payload.tags,
        // Field LABELS are searchable, values are not. "Which entry has a
        // recovery code" is a fair question; matching on the code itself
        // would mean typing a password into a search box to find it.
        ...entry.payload.fields.map((f) => f.label),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [entries, query, kindFilter])

  function openNew() {
    setDraft({ ...BLANK, fields: [] })
    setPinned(false)
    setEditing('new')
  }

  function openExisting(entry) {
    setDraft({ ...BLANK, ...entry.payload })
    setPinned(entry.pinned)
    setEditing(entry.id)
  }

  function setKind(kind) {
    setDraft((d) => ({
      ...d,
      kind,
      // Only seed the starter fields into an entry nobody has filled in yet,
      // so changing your mind about the kind never discards typed values.
      fields: d.fields.length === 0 ? STARTERS[kind].map((f) => ({ ...f })) : d.fields,
    }))
  }

  async function handleSave() {
    if (!draft.title.trim()) {
      notify('Give this a title so you can find it again.', { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      const body = {
        payload: { ...draft, fields: draft.fields.filter((f) => f.label.trim()) },
        pinned,
      }

      if (editing === 'new') await vaultService.createEntry(body)
      else await vaultService.updateEntry(editing, body)

      notify('Saved and sealed.')
      setEditing(null)
      reload()
    } catch (err) {
      notify(err.message || 'That could not be saved.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    setSaving(true)
    try {
      await vaultService.deleteEntry(id)
      notify('Deleted.')
      setEditing(null)
      reload()
    } catch (err) {
      notify(err.message || 'That could not be deleted.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const configured = options ? options.configured : true

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* No <h1> here: AdminLayout already titles the screen, and two
            headings stacked read as a mistake. */}
        <div>
          <p className="max-w-2xl text-sm text-ink-400">
            Notes and passwords, sealed before they are stored. Only this
            account can open them — not a colleague, not the Master role.
          </p>
        </div>

        <Can resource="notes" action="create">
          <Button onClick={openNew} disabled={!configured} icon={Plus}>
            New entry
          </Button>
        </Can>
      </div>

      {!configured && (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-brass-700" aria-hidden />
            <div>
              <p className="text-sm font-medium text-ink-900">
                The vault is not set up on this server yet
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-400">
                It needs an encryption key —{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                  NOTES_ENCRYPTION_KEY
                </code>{' '}
                in the server environment. Until it is set, nothing can be read
                or written here. See <code className="text-xs">.env.example</code>{' '}
                for how to generate one, and keep a copy somewhere safe: lose it
                and every note sealed with it is unreadable for good.
              </p>
            </div>
          </div>
        </Card>
      )}

      {configured && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex-1 min-w-[220px]">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles, notes and field names…"
                className="w-full rounded-xl border border-ink-100 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brass-500/60"
              />
            </label>

            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="All"
                active={kindFilter === 'all'}
                onClick={() => setKindFilter('all')}
              />
              {kinds.map((kind) => (
                <FilterChip
                  key={kind.value}
                  label={kind.label}
                  active={kindFilter === kind.value}
                  onClick={() => setKindFilter(kind.value)}
                />
              ))}
            </div>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
            <ShieldCheck size={12} className="text-brass-600" aria-hidden />
            Searching happens in this browser, over what is already on screen —
            what you type never leaves the page.
          </p>
        </Card>
      )}

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-ink-400">Opening…</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-5">
          <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-100 py-12 text-center">
            <KeyRound size={22} className="text-ink-400" aria-hidden />
            <p className="mt-2 text-sm font-medium text-ink-900">
              {entries.length === 0 ? 'Nothing in the vault yet' : 'Nothing matches that'}
            </p>
            <p className="max-w-md text-sm text-ink-400">
              {entries.length === 0
                ? 'Put the passwords and notes you keep re-typing in here once, and stop remembering them.'
                : 'Try a different word, or clear the filter.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((entry) =>
            entry.damaged ? (
              <DamagedCard key={entry.id} entry={entry} />
            ) : (
              <EntryCard
                key={entry.id}
                entry={entry}
                kindLabel={kindLabel}
                onOpen={() => openExisting(entry)}
              />
            ),
          )}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New entry' : 'Edit entry'}
        subtitle="Sealed the moment you save. Nothing here is stored in a form anyone can read."
        icon={KeyRound}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            {editing !== 'new' ? (
              <Can resource="notes" action="delete">
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(editing)}
                  disabled={saving}
                  icon={Trash2}
                >
                  Delete
                </Button>
              </Can>
            ) : (
              <span />
            )}

            <span className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {saving ? 'Sealing…' : 'Save'}
              </Button>
            </span>
          </div>
        }
      >
        <EntryForm
          draft={draft}
          setDraft={setDraft}
          setKind={setKind}
          kinds={kinds}
          pinned={pinned}
          setPinned={setPinned}
          disabled={saving}
        />
      </Modal>
    </div>
  )
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-brass-500/60 bg-brass-500/10 text-brass-700'
          : 'border-ink-100 text-ink-400 hover:border-brass-500/40 hover:text-brass-700',
      )}
    >
      {label}
    </button>
  )
}

function EntryCard({ entry, kindLabel, onOpen }) {
  const { payload } = entry
  const secrets = payload.fields.filter((f) => f.secret).length

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col items-start gap-3 p-4 text-left transition-colors hover:bg-brass-500/[0.04]"
      >
        <span className="flex w-full items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                {kindLabel(payload.kind)}
              </span>
              {entry.pinned && <Pin size={12} className="text-brass-600" aria-label="Pinned" />}
            </span>
            <span className="mt-2 block truncate text-sm font-medium text-ink-900">
              {payload.title}
            </span>
          </span>
        </span>

        {payload.body && (
          <span className="line-clamp-2 text-xs leading-relaxed text-ink-400">{payload.body}</span>
        )}

        <span className="flex w-full flex-wrap items-center gap-1.5">
          {payload.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-ink-100 px-2 py-0.5 text-[10px] text-ink-400"
            >
              {tag}
            </span>
          ))}
          {secrets > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-ink-400">
              <KeyRound size={10} aria-hidden />
              {secrets} hidden
            </span>
          )}
        </span>
      </button>

      {/* The values people actually came for, without opening the entry. */}
      {payload.fields.length > 0 && (
        <div className="space-y-1.5 border-t border-ink-100 px-4 py-3">
          {payload.fields.slice(0, 3).map((field, index) => (
            <SecretRow key={`${field.label}-${index}`} field={field} />
          ))}
        </div>
      )}
    </Card>
  )
}

function DamagedCard({ entry }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-brass-700" aria-hidden />
        <div>
          <p className="text-sm font-medium text-ink-900">This entry cannot be opened</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            It was sealed with a different key, or it has been altered in the
            database. The rest of your vault is unaffected. Saved{' '}
            {new Date(entry.updatedAt).toLocaleDateString()}.
          </p>
        </div>
      </div>
    </Card>
  )
}

/** One field, masked if it is a secret, with a copy button either way. */
function SecretRow({ field }) {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(field.value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      // A browser that refuses the clipboard (no permission, insecure origin)
      // is not an error worth a toast — reveal is still right there.
      setShown(true)
    }
  }

  const masked = field.secret && !shown

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate text-[11px] uppercase tracking-wide text-ink-400">
        {field.label}
      </span>

      <span
        className={classNames(
          'min-w-0 flex-1 truncate text-xs',
          masked ? 'tracking-[0.2em] text-ink-400' : 'text-ink-900',
        )}
      >
        {field.value ? (masked ? '••••••••' : field.value) : '—'}
      </span>

      {field.secret && (
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          title={shown ? 'Hide' : 'Show'}
          aria-label={shown ? `Hide ${field.label}` : `Show ${field.label}`}
          className="shrink-0 rounded-md p-1 text-ink-400 transition-colors hover:text-brass-700"
        >
          {shown ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      )}

      {field.value && (
        <button
          type="button"
          onClick={copy}
          title="Copy"
          aria-label={`Copy ${field.label}`}
          className="shrink-0 rounded-md p-1 text-ink-400 transition-colors hover:text-brass-700"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
        </button>
      )}
    </div>
  )
}

function EntryForm({ draft, setDraft, setKind, kinds, pinned, setPinned, disabled }) {
  const set = (changes) => setDraft((d) => ({ ...d, ...changes }))

  const setField = (index, changes) =>
    setDraft((d) => ({
      ...d,
      fields: d.fields.map((f, i) => (i === index ? { ...f, ...changes } : f)),
    }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind">
          <Select
            value={draft.kind}
            disabled={disabled}
            onChange={(event) => setKind(event.target.value)}
          >
            {kinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Title" hint="What you would search for.">
          <Input
            value={draft.title}
            maxLength={160}
            disabled={disabled}
            onChange={(event) => set({ title: event.target.value })}
          />
        </Field>
      </div>

      <Field label="Website" hint="Optional. Where this is used.">
        <Input
          value={draft.url}
          maxLength={500}
          placeholder="https://…"
          disabled={disabled}
          onChange={(event) => set({ url: event.target.value })}
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
            Fields
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                fields: [...d.fields, { label: '', value: '', secret: false }],
              }))
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-100 px-2.5 py-1.5 text-xs text-ink-600 transition-colors hover:border-brass-500/50 hover:text-brass-700 disabled:opacity-40"
          >
            <Plus size={12} aria-hidden />
            Add a field
          </button>
        </div>

        {draft.fields.length === 0 && (
          <p className="rounded-xl border border-dashed border-ink-100 py-5 text-center text-xs text-ink-400">
            No fields yet — a note may not need any.
          </p>
        )}

        {draft.fields.map((field, index) => (
          <div
            key={index}
            className="flex flex-wrap items-end gap-2 rounded-xl border border-ink-100 p-2.5"
          >
            <label className="min-w-[110px] flex-1">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-400">
                Name
              </span>
              <Input
                value={field.label}
                maxLength={60}
                placeholder="Password"
                disabled={disabled}
                onChange={(event) => setField(index, { label: event.target.value })}
              />
            </label>

            <label className="min-w-[150px] flex-[2]">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-400">
                Value
              </span>
              <Input
                // `type` follows the secret flag so the browser's own password
                // manager does not offer to remember what is already in a
                // vault, and so shoulder-surfing a long form is harder.
                type={field.secret ? 'password' : 'text'}
                value={field.value}
                maxLength={2000}
                disabled={disabled}
                onChange={(event) => setField(index, { value: event.target.value })}
              />
            </label>

            <button
              type="button"
              disabled={disabled}
              onClick={() => setField(index, { secret: !field.secret })}
              title={field.secret ? 'Shown masked in the list' : 'Shown in full in the list'}
              className={classNames(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                field.secret
                  ? 'border-brass-500/50 bg-brass-500/10 text-brass-700'
                  : 'border-ink-100 text-ink-400 hover:text-brass-700',
              )}
            >
              {field.secret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setDraft((d) => ({ ...d, fields: d.fields.filter((_, i) => i !== index) }))
              }
              title="Remove this field"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-100 text-ink-400 transition-colors hover:border-brass-500/50 hover:text-brass-700"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <Field label="Notes" hint="Line breaks are kept.">
        <Textarea
          value={draft.body}
          rows={5}
          maxLength={20000}
          disabled={disabled}
          onChange={(event) => set({ body: event.target.value })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tags" hint="Comma separated.">
          <Input
            value={draft.tags.join(', ')}
            disabled={disabled}
            onChange={(event) =>
              set({
                tags: event.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 12),
              })
            }
          />
        </Field>

        <Field label="Pin">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPinned((v) => !v)}
            className={classNames(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors',
              pinned
                ? 'border-brass-500/60 bg-brass-500/10 text-brass-700'
                : 'border-ink-100 text-ink-400 hover:text-brass-700',
            )}
          >
            <Pin size={14} aria-hidden />
            {pinned ? 'Kept at the top' : 'Keep at the top'}
          </button>
        </Field>
      </div>
    </div>
  )
}
