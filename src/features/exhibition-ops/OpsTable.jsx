import { useState } from 'react'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'

import Card from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'
import Modal from '@/components/ui/Modal.jsx'
import { Field, Input, Select, Textarea } from '@/components/forms/Field.jsx'
import { Can } from '@/features/rbac/usePermissions.jsx'
import { uploadAsset } from '@/features/media/media.api.js'
import { BADGE_TONE, pretty } from '@/features/exhibition-ops/opsSpec.js'
import { classNames } from '@/utils/helpers.js'

// One component renders every operations module.
//
// Nine of the ten tabs are the same screen with different columns, so they are
// declared as data in opsSpec.js and drawn here. Nine hand-written tables
// would be nine chances for the same bug to be fixed eight times.

/** "2026-12-04T00:00:00Z" -> "04 Dec 2026". Empty stays empty. */
function showDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function showDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formats an amount for display WITHOUT parsing it as a number.
 *
 * `Number(value).toLocaleString()` would be shorter and would quietly round a
 * long decimal — the exact thing the whole module avoids. Grouping the digit
 * string leaves the value untouched.
 */
function showAmount(value) {
  if (value === null || value === undefined || value === '') return '—'
  const [whole, fraction] = String(value).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

/** An ISO timestamp trimmed to what a date input wants. */
function dateValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

/** And what a datetime-local input wants. */
function dateTimeValue(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Cell({ column, row }) {
  const value = row[column.key]

  if (column.user) return <span>{value?.name ?? '—'}</span>
  if (column.count) return <span>{Array.isArray(value) ? value.length : 0}</span>
  if (column.bool) {
    return (
      <span className={value ? 'text-emerald-600' : 'text-ink-400'}>
        {value ? 'Yes' : 'No'}
      </span>
    )
  }
  if (column.date) return <span>{showDate(value)}</span>
  if (column.datetime) return <span>{showDateTime(value)}</span>
  if (column.money || column.weight) return <span>{showAmount(value)}</span>

  if (column.badge) {
    if (!value) return <span className="text-ink-400">—</span>
    return (
      <span
        className={classNames(
          'inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          BADGE_TONE[value] ?? 'bg-ink-100 text-ink-400',
        )}
      >
        {pretty(value)}
      </span>
    )
  }

  if (column.link && row[column.link]) {
    return (
      <a
        href={row[column.link]}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-brass-700 underline-offset-4 hover:underline"
      >
        {value || 'Open'}
        <ExternalLink size={11} aria-hidden />
      </a>
    )
  }

  if (value === null || value === undefined || value === '') {
    return <span className="text-ink-400">—</span>
  }

  return <span>{String(value)}</span>
}

export default function OpsTable({ module, rows, options, onCreate, onUpdate, onDelete, extra }) {
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  function openNew() {
    setDraft({ ...module.blank })
    setEditing('new')
  }

  function openExisting(row) {
    // Only the keys the form declares, so a payload never carries back the
    // server's own stamps (capturedBy, reconciledAt) as if they were input.
    const next = {}
    for (const field of module.fields) {
      if (field.type === 'heading') continue
      const raw = row[field.key]
      next[field.key] =
        field.type === 'date'
          ? dateValue(raw)
          : field.type === 'datetime'
            ? dateTimeValue(raw)
            : raw === null || raw === undefined
              ? ''
              : raw
    }
    setDraft(next)
    setEditing(row.id)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body = {}

      for (const field of module.fields) {
        if (field.type === 'heading') continue
        const value = draft[field.key]

        if (field.type === 'number') {
          // A cleared number is null where the column allows it (pieces that
          // have not been counted) and 0 where it does not.
          body[field.key] =
            value === '' || value === null || value === undefined
              ? field.nullable
                ? null
                : 0
              : Number(value)
        } else if (field.type === 'check') {
          body[field.key] = Boolean(value)
        } else {
          // Money and weight fall through here as strings, untouched.
          body[field.key] = value ?? ''
        }
      }

      if (editing === 'new') await onCreate(body)
      else await onUpdate(editing, body)

      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function pickFile(file, key) {
    setUploading(true)
    try {
      const asset = await uploadAsset(file)
      setDraft((d) => ({ ...d, [key]: asset.url }))
    } finally {
      setUploading(false)
    }
  }

  const disabled = saving || uploading

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="font-display text-[15px] font-semibold text-emerald-600">
              {module.label}
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-400">{module.blurb}</p>
          </div>

          <Can resource="exhibitionOps" action="create">
            <Button onClick={openNew} icon={Plus}>
              {module.addLabel}
            </Button>
          </Can>
        </div>

        {rows.length === 0 ? (
          <p className="border-t border-ink-100 px-5 py-10 text-center text-sm text-ink-400">
            {module.empty}
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-ink-100">
            <table className="pj-table--dark w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr>
                  {module.columns.map((column) => (
                    <th
                      key={column.key}
                      className={classNames(
                        'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide',
                        column.align === 'right' && 'text-right',
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="w-24 px-4 py-2.5" />
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {module.columns.map((column) => (
                      <td
                        key={column.key}
                        className={classNames(
                          'px-4 py-3 align-top',
                          column.align === 'right' && 'text-right tabular-nums',
                          column.primary ? 'font-medium text-ink-900' : 'text-ink-600',
                          column.wide ? 'max-w-[340px]' : 'whitespace-nowrap',
                        )}
                      >
                        <Cell column={column} row={row} />
                      </td>
                    ))}

                    <td className="px-4 py-3 text-right align-top">
                      <span className="inline-flex items-center gap-1">
                        {!module.noEdit && (
                          <Can resource="exhibitionOps" action="edit">
                            <button
                              type="button"
                              onClick={() => openExisting(row)}
                              title="Edit"
                              aria-label={`Edit ${row[module.columns[0].key] ?? 'row'}`}
                              className="rounded-md p-1.5 text-ink-400 transition-colors hover:text-brass-700"
                            >
                              <Pencil size={14} />
                            </button>
                          </Can>
                        )}

                        <Can resource="exhibitionOps" action="delete">
                          <button
                            type="button"
                            onClick={() => onDelete(row.id)}
                            title="Remove"
                            aria-label={`Remove ${row[module.columns[0].key] ?? 'row'}`}
                            className="rounded-md p-1.5 text-ink-400 transition-colors hover:text-rose"
                          >
                            <Trash2 size={14} />
                          </button>
                        </Can>
                      </span>

                      {extra?.(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? module.addLabel : `Edit — ${module.label}`}
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={disabled}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={uploading}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {module.fields.map((field) => {
            if (field.type === 'heading') {
              return (
                <div key={field.key} className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
                    {field.label}
                  </p>
                  {field.hint && (
                    <p className="mt-1 text-xs leading-relaxed text-ink-400">{field.hint}</p>
                  )}
                </div>
              )
            }

            const value = draft[field.key] ?? ''
            const set = (v) => setDraft((d) => ({ ...d, [field.key]: v }))

            return (
              <div key={field.key} className={field.full ? 'sm:col-span-2' : undefined}>
                <Field label={field.label} hint={field.hint} required={field.required}>
                  {field.type === 'textarea' ? (
                    <Textarea
                      value={value}
                      rows={4}
                      maxLength={field.max}
                      disabled={disabled}
                      onChange={(e) => set(e.target.value)}
                    />
                  ) : field.type === 'select' ? (
                    <Select value={value} disabled={disabled} onChange={(e) => set(e.target.value)}>
                      {(options?.[field.options] ?? []).map((choice) => (
                        <option key={choice} value={choice}>
                          {pretty(choice)}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === 'user' ? (
                    <Select value={value} disabled={disabled} onChange={(e) => set(e.target.value)}>
                      <option value="">Nobody</option>
                      {(options?.users ?? []).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === 'collection' ? (
                    <Select value={value} disabled={disabled} onChange={(e) => set(e.target.value)}>
                      <option value="">Not linked</option>
                      {(options?.collections ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === 'lead' ? (
                    <Select value={value} disabled={disabled} onChange={(e) => set(e.target.value)}>
                      <option value="">Not linked</option>
                      {(options?.leads ?? []).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === 'check' ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => set(!value)}
                      className={classNames(
                        'inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                        value
                          ? 'border-emerald-600/50 bg-emerald-600/10 text-emerald-600'
                          : 'border-ink-100 text-ink-400 hover:text-brass-700',
                      )}
                    >
                      {value ? 'Yes' : 'No'}
                    </button>
                  ) : field.type === 'file' ? (
                    <div className="space-y-2">
                      <input
                        type="file"
                        disabled={disabled}
                        onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0], field.key)}
                        className="block w-full text-xs text-ink-400 file:mr-3 file:rounded-lg file:border file:border-ink-100 file:bg-transparent file:px-3 file:py-2 file:text-xs file:text-ink-600"
                      />
                      {value && (
                        <p className="truncate text-xs text-emerald-600">
                          {uploading ? 'Uploading…' : `Attached: ${value}`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Input
                      // Money and weight use a text input on purpose. `type=
                      // "number"` hands back a JS number and would round a long
                      // decimal before it ever left the page.
                      type={field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : field.type === 'number' ? 'number' : 'text'}
                      inputMode={field.type === 'money' || field.type === 'weight' ? 'decimal' : undefined}
                      placeholder={field.type === 'weight' ? '0.000' : field.type === 'money' ? '0.00' : undefined}
                      value={value}
                      maxLength={field.max}
                      disabled={disabled}
                      onChange={(e) => set(e.target.value)}
                    />
                  )}
                </Field>
              </div>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
