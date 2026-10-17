import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import * as teamService from '@/features/team/team.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import { useCan } from '@/features/rbac/permissionsContext.js'
import Button from '@/components/ui/Button.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Card from '@/components/ui/Card.jsx'
import Modal from '@/components/ui/Modal.jsx'
import Switch from '@/components/ui/Switch.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import { Field, Input, Textarea } from '@/components/forms/Field.jsx'

// The people on the website's Our Team page. Everything on a card here is what
// a visitor sees: the photograph, the name and the role. Saving puts the change
// on the website at once — there is no second publish step.

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

const EMPTY = {
  name: '',
  designation: '',
  bio: '',
  isActive: true,
  // The picture already saved, the file picked in this session, and whether
  // "remove photo" was pressed. At most one of the last two matters.
  photoUrl: '',
  photoFile: null,
  removePhoto: false,
}

function initialsOf(name) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('') || '•'
  )
}

/** A person's picture, or their initials when there is none. */
function Avatar({ src, name, className = '' }) {
  const [failed, setFailed] = useState(false)

  return src && !failed ? (
    <img src={src} alt="" onError={() => setFailed(true)} className={`object-cover object-top ${className}`} />
  ) : (
    <span className={`flex items-center justify-center bg-teal-900/70 font-display text-ink-900/70 ${className}`}>
      {initialsOf(name || '')}
    </span>
  )
}

export default function TeamPage() {
  const { notify } = useToast()
  const canCreate = useCan('team', 'create')
  const canEdit = useCan('team', 'edit')
  const canDelete = useCan('team', 'delete')

  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')

  const [confirmId, setConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef(null)

  // No state is set before the request is sent, so calling this from an effect
  // does not re-render synchronously.
  const load = useCallback(
    () =>
      teamService
        .listTeam()
        .then((rows) => {
          setMembers(rows || [])
          setError('')
        })
        .catch((err) => setError(err.message || 'Could not load the team.'))
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  // The preview of a file picked in the browser is an object URL; it is let go
  // when replaced or when the form closes.
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErrors({})
    setPreviewUrl('')
    setModalOpen(true)
  }

  function openEdit(member) {
    setEditing(member)
    setForm({
      name: member.name,
      designation: member.designation,
      bio: member.bio || '',
      isActive: member.isActive,
      photoUrl: member.photoUrl || '',
      photoFile: null,
      removePhoto: false,
    })
    setErrors({})
    setPreviewUrl('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
  }

  function pickPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!ACCEPTED.includes(file.type)) {
      setErrors((current) => ({ ...current, photo: 'Choose a JPG, PNG or WEBP picture.' }))
      return
    }
    if (file.size > MAX_BYTES) {
      setErrors((current) => ({ ...current, photo: 'That picture is over 5 MB.' }))
      return
    }

    setErrors((current) => ({ ...current, photo: undefined }))
    setForm((current) => ({ ...current, photoFile: file, removePhoto: false }))
    setPreviewUrl(URL.createObjectURL(file))
  }

  function removePhoto() {
    setForm((current) => ({ ...current, photoFile: null, removePhoto: true }))
    setPreviewUrl('')
  }

  function validate() {
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Enter the name (at least 2 letters).'
    if (form.designation.trim().length < 2) next.designation = 'Enter the role (at least 2 letters).'
    if (form.bio.trim().length > 600) next.bio = 'Keep it under 600 characters.'
    setErrors((current) => ({ ...current, ...next, photo: current.photo }))
    return Object.keys(next).length === 0
  }

  async function handleSave(event) {
    event?.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        designation: form.designation.trim(),
        bio: form.bio.trim(),
        isActive: form.isActive,
        photo: form.photoFile || undefined,
      }

      if (editing) {
        await teamService.updateMember(editing.id, { ...payload, removePhoto: form.removePhoto })
        notify('Team member updated.')
      } else {
        await teamService.createMember(payload)
        notify('Team member added.')
      }

      setModalOpen(false)
      await load()
    } catch (err) {
      notify(err.message || 'Could not save.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await teamService.deleteMember(confirmId)
      notify('Team member removed.')
      setConfirmId(null)
      await load()
    } catch (err) {
      notify(err.message || 'Could not delete.', { tone: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  async function toggle(member) {
    // Shown at once, then confirmed by the server; put back if it refuses.
    setMembers((rows) => rows.map((row) => (row.id === member.id ? { ...row, isActive: !row.isActive } : row)))
    try {
      await teamService.toggleMember(member.id)
    } catch (err) {
      notify(err.message || 'Could not change visibility.', { tone: 'error' })
      load()
    }
  }

  async function move(index, direction) {
    const target = index + direction
    if (target < 0 || target >= members.length) return

    const next = [...members]
    ;[next[index], next[target]] = [next[target], next[index]]
    setMembers(next)

    try {
      await teamService.reorderTeam(next.map((member) => member.id))
    } catch (err) {
      notify(err.message || 'Could not save the new order.', { tone: 'error' })
      load()
    }
  }

  const shownPhoto = previewUrl || (form.removePhoto ? '' : form.photoUrl)

  return (
    <div className="space-y-5">
      {error && !loading && (
        <div className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          Couldn't load the team: {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-2xl text-sm text-ink-600">
          The people shown on the website's <strong>Our Team</strong> page, in this order. A change saved here is on
          the website straight away. Hidden people stay saved but are not shown.
        </p>
        {canCreate && (
          <Button size="sm" icon={Plus} onClick={openCreate}>
            Add team member
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="aspect-[3/4] animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <EmptyState
            icon={UsersRound}
            title="Nobody is listed yet"
            description="Add the first person and they appear on the Our Team page straight away."
            action={canCreate ? <Button size="sm" icon={Plus} onClick={openCreate}>Add team member</Button> : null}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {members.map((member, index) => (
            <Card key={member.id} className="flex flex-col overflow-hidden p-0">
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-ivory-100">
                <Avatar
                  src={member.photoUrl}
                  name={member.name}
                  className={`h-full w-full text-4xl ${member.isActive ? '' : 'opacity-40 grayscale'}`}
                />
                {!member.isActive && (
                  <span className="absolute left-2 top-2">
                    <Badge dark tone="ink">hidden</Badge>
                  </span>
                )}
                <span className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] tabular-nums text-white">
                  {index + 1}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-medium text-ink-900">{member.name}</p>
                  <p className="m-0 truncate text-xs text-ink-400">{member.designation}</p>
                </div>

                <div className="mt-auto flex items-center justify-between gap-1">
                  <div className="flex items-center">
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${member.name} earlier`}
                          className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-30"
                        >
                          <ArrowLeft size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === members.length - 1}
                          aria-label={`Move ${member.name} later`}
                          className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-30"
                        >
                          <ArrowRight size={15} />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center">
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggle(member)}
                          aria-label={member.isActive ? `Hide ${member.name}` : `Show ${member.name}`}
                          title={member.isActive ? 'Shown on the website — click to hide' : 'Hidden — click to show'}
                          className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-900"
                        >
                          {member.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(member)}
                          aria-label={`Edit ${member.name}`}
                          className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-900"
                        >
                          <Pencil size={15} />
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setConfirmId(member.id)}
                        aria-label={`Delete ${member.name}`}
                        className="rounded-md p-1.5 text-ink-400 hover:bg-rose/5 hover:text-rose"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit team member' : 'Add team member'}
        subtitle="What you fill in here is what the Our Team page shows."
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              {editing ? 'Save changes' : 'Add to the team'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-32 w-24 shrink-0 overflow-hidden rounded-lg border border-ink-100 bg-ivory-100">
              <Avatar src={shownPhoto} name={form.name} className="h-full w-full text-3xl" />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} onChange={pickPhoto} className="hidden" />
              <Button type="button" variant="ghost" size="sm" icon={ImagePlus} onClick={() => fileRef.current?.click()}>
                {shownPhoto ? 'Replace photo' : 'Upload photo'}
              </Button>
              {shownPhoto && (
                <button type="button" onClick={removePhoto} className="w-fit text-xs text-ink-400 hover:text-rose hover:underline">
                  Remove photo
                </button>
              )}
              <p className="m-0 text-xs text-ink-400">JPG, PNG or WEBP, up to 5 MB. A portrait picture works best.</p>
              {errors.photo && <p className="m-0 text-xs text-rose">{errors.photo}</p>}
            </div>
          </div>

          <Field label="Name" required error={errors.name}>
            <Input
              value={form.name}
              maxLength={120}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Bharat Jogani"
            />
          </Field>

          <Field label="Role / designation" required error={errors.designation}>
            <Input
              value={form.designation}
              maxLength={120}
              onChange={(event) => setForm({ ...form, designation: event.target.value })}
              placeholder="e.g. Founder"
            />
          </Field>

          <Field label="A line about them" hint="Optional. Shown under the name on larger screens." error={errors.bio}>
            <Textarea
              rows={3}
              value={form.bio}
              maxLength={600}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
            />
          </Field>

          <Switch
            checked={form.isActive}
            onChange={(isActive) => setForm({ ...form, isActive })}
            label="Show on the website"
            description="Turn off to keep this person saved but off the page."
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Remove this person?"
        description="They disappear from the Our Team page and their photo is deleted. This cannot be undone. To keep them but stop showing them, hide them instead."
        confirmLabel="Remove"
      />
    </div>
  )
}
