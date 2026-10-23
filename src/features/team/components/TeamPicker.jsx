import { useCallback, useEffect, useState } from 'react'
import { Check } from 'lucide-react'

import * as teamService from '@/features/team/team.api.js'
import { classNames } from '@/utils/helpers.js'

// Which of the people added under Admin > Our Team a band of the website shows.
// The value is their ids, comma-separated; empty means everyone marked as shown.
// The people themselves are not edited here — only which of them appear.

/** "a,b,c" -> ["a","b","c"] */
function parseIds(value) {
  return String(value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

function Thumb({ member }) {
  const [failed, setFailed] = useState(false)

  return member.photoUrl && !failed ? (
    <img src={member.photoUrl} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover object-top" />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-teal-900/70 text-sm text-ink-900/70">
      {(member.name || '•').slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function TeamPicker({ value, disabled, onChange }) {
  const [members, setMembers] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(
    () =>
      teamService
        .listTeam()
        .then((rows) => {
          setMembers(rows || [])
          setError('')
        })
        .catch((err) => setError(err.message || 'Could not load the people.')),
    [],
  )

  useEffect(() => {
    load()
    // The list above the picker (add / edit / delete) announces its changes.
    window.addEventListener('pj:team-changed', load)
    return () => window.removeEventListener('pj:team-changed', load)
  }, [load])

  const selected = parseIds(value)
  const everyone = selected.length === 0

  function toggle(id) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
    onChange(next.join(','))
  }

  if (error) return <p className="m-0 text-xs text-rose">{error}</p>
  if (!members) return <p className="m-0 text-xs text-ink-400">Loading people…</p>
  if (members.length === 0) {
    return <p className="m-0 text-xs text-ink-400">Nobody has been added yet. Add people in the list above.</p>
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-xs text-ink-500">
          {everyone
            ? 'Showing everyone who is marked as shown.'
            : `Showing ${selected.length} chosen ${selected.length === 1 ? 'person' : 'people'}.`}
        </p>
        {!everyone && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('')}
            className="text-xs font-medium text-brass-700 hover:underline disabled:opacity-50"
          >
            Show everyone
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {members.map((member) => {
          const checked = selected.includes(member.id)

          return (
            <button
              key={member.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(member.id)}
              aria-pressed={checked}
              className={classNames(
                'relative flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors disabled:opacity-60',
                checked ? 'border-brass-500 bg-brass-500/10' : 'border-ink-100 bg-white hover:border-brass-500/50',
              )}
            >
              <span className="h-12 w-10 shrink-0 overflow-hidden rounded-md bg-ivory-100">
                <Thumb member={member} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink-900">{member.name}</span>
                <span className="block truncate text-[11px] text-ink-400">{member.designation}</span>
                {!member.isActive && <span className="block text-[10px] text-rose">hidden — not shown</span>}
              </span>
              {checked && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brass-500 text-white">
                  <Check size={11} aria-hidden />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
