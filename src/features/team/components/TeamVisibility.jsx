import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import * as teamService from '@/features/team/team.api.js'
import { TEAM_CATEGORIES } from '@/features/team/categories.js'
import { classNames } from '@/utils/helpers.js'

// The people of one section of the website, each with an eye.
//
//   open eye   the person is shown in this section
//   closed eye the person is hidden from THIS section only (they still show
//              wherever their eye is open)
//
// Everyone added under Admin > Our Team is listed, so a person added later is
// already here. The people themselves — photograph, name, role, company, order,
// whether they appear on the site at all — are managed under Our Team.
//
// `mode`:
//   "hide"  the stored value is the people whose eye is CLOSED; a new person is
//           shown by default (About page, Our Team page)
//   "show"  the stored value is the people whose eye is OPEN; a new person is
//           hidden until chosen (a brand's team)

function parse(value) {
  return String(value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

function Avatar({ member }) {
  const [failed, setFailed] = useState(false)

  return member.photoUrl && !failed ? (
    <img src={member.photoUrl} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover object-top" />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-teal-900/70 text-lg text-ink-900/70">
      {(member.name || '•').slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function TeamVisibility({ value, onChange, kind = 'all', mode = 'hide', disabled }) {
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
    // The team list above (add / edit / delete) announces its changes.
    window.addEventListener('pj:team-changed', load)
    return () => window.removeEventListener('pj:team-changed', load)
  }, [load])

  if (error) return <p className="m-0 text-xs text-rose">{error}</p>
  if (!members) return <p className="m-0 text-xs text-ink-400">Loading people…</p>

  const people = members.filter((member) => kind === 'all' || member.kind === kind)

  if (people.length === 0) {
    return (
      <p className="m-0 text-xs text-ink-400">
        Nobody of this kind has been added yet. Add people under Our Team and they appear here.
      </p>
    )
  }

  const stored = parse(value)
  const isOpen = (id) => (mode === 'hide' ? !stored.includes(id) : stored.includes(id))

  function setOpen(id, open) {
    const next = new Set(stored)
    // "hide": stored = closed eyes; "show": stored = open eyes.
    const store = mode === 'hide' ? !open : open
    if (store) next.add(id)
    else next.delete(id)
    onChange([...next].join(','))
  }

  function setAll(open) {
    const ids = people.map((member) => member.id)
    const others = stored.filter((id) => !ids.includes(id))
    const store = mode === 'hide' ? !open : open
    onChange([...others, ...(store ? ids : [])].join(','))
  }

  const shown = people.filter((member) => member.isActive && isOpen(member.id)).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span>
          {shown} of {people.length} shown in this section
        </span>
        <span className="flex gap-3">
          <button type="button" disabled={disabled} onClick={() => setAll(true)} className="font-medium text-brass-700 hover:underline disabled:opacity-50">
            Show all
          </button>
          <button type="button" disabled={disabled} onClick={() => setAll(false)} className="font-medium text-brass-700 hover:underline disabled:opacity-50">
            Hide all
          </button>
        </span>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(128px,1fr))]">
        {people.map((member) => {
          const off = !member.isActive
          const open = !off && isOpen(member.id)
          const company = TEAM_CATEGORIES.find((category) => category.key === member.category)?.label

          return (
            <div
              key={member.id}
              className={classNames(
                'overflow-hidden rounded-xl border bg-white transition-colors',
                open ? 'border-brass-500/60' : 'border-ink-100',
              )}
            >
              <div className="relative aspect-[3/4] w-full bg-ivory-100">
                <div className={classNames('h-full w-full transition', !open && 'opacity-40 grayscale')}>
                  <Avatar member={member} />
                </div>

                <button
                  type="button"
                  disabled={disabled || off}
                  onClick={() => setOpen(member.id, !open)}
                  aria-pressed={open}
                  aria-label={open ? `Hide ${member.name} from this section` : `Show ${member.name} in this section`}
                  title={off ? 'Switched off in Our Team' : open ? 'Shown — click to hide' : 'Hidden — click to show'}
                  className={classNames(
                    'absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full shadow transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    open ? 'bg-brass-500 text-white' : 'bg-white/90 text-ink-500 hover:text-ink-900',
                  )}
                >
                  {open ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
                </button>

                {off && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] font-medium text-white">
                    Off in Our Team
                  </span>
                )}
              </div>

              <div className="p-2">
                <p className="m-0 truncate text-xs font-medium text-ink-900">{member.name}</p>
                <p className="m-0 truncate text-[11px] text-ink-400">{member.designation}</p>
                {company && <p className="m-0 mt-0.5 truncate text-[10px] text-brass-700">{company}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
