import { useEffect, useMemo, useState } from 'react'
import { Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react'

import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import { Field, Input } from '@/components/forms/Field.jsx'
import { useToast } from '@/components/feedback/Toast.jsx'
import { usePermissions } from '@/features/rbac/permissionsContext.js'
import {
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from '@/features/rbac/rbac.api.js'
import { classNames } from '@/utils/helpers.js'

/**
 * Roles, and exactly what each one may see and change.
 *
 * The permission grid is built from `resources` on the access profile — the
 * catalogue the SERVER sent. Nothing here knows what permissions exist; adding
 * a screen to the catalogue makes it appear in this form with no change to
 * this file, and removing one takes it out of every role's form at the same
 * moment it stops being enforced.
 */
export default function RolesPage() {
  const { resources, can } = usePermissions()
  const { notify } = useToast()

  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  // A counter rather than a callback: the fetch happens inside the effect, so
  // nothing sets state synchronously while the effect body runs. Bumping it is
  // how a save asks for fresh data.
  const [reloadToken, setReloadToken] = useState(0)
  const reload = () => setReloadToken((n) => n + 1)

  useEffect(() => {
    let alive = true

    listRoles()
      .then((data) => {
        if (!alive) return
        setRoles(Array.isArray(data) ? data : [])
        setError('')
      })
      .catch((e) => {
        if (alive) setError(e.message || 'Could not load roles.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [reloadToken])

  // The catalogue, grouped the way the sidebar is, so the form reads in the
  // same order as the panel it governs.
  const groups = useMemo(() => {
    const byGroup = new Map()
    for (const resource of resources) {
      byGroup.set(resource.group, [...(byGroup.get(resource.group) ?? []), resource])
    }
    // A Map preserves insertion order, so the groups come out in catalogue
    // order rather than alphabetically — the same order as the sidebar.
    return [...byGroup.entries()]
  }, [resources])

  const startCreate = () =>
    setEditing({ id: null, name: '', description: '', permissions: [] })

  const startEdit = (role) =>
    setEditing({
      id: role.id,
      name: role.name,
      description: role.description ?? '',
      permissions: [...role.permissions],
      isSystem: role.isSystem,
    })

  const toggle = (key) =>
    setEditing((current) => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter((p) => p !== key)
        : [...current.permissions, key],
    }))

  const save = async () => {
    if (!editing) return
    setSaving(true)

    try {
      const body = {
        name: editing.name.trim(),
        description: editing.description.trim(),
        permissions: editing.permissions,
      }

      if (editing.id) await updateRole(editing.id, body)
      else await createRole(body)

      notify(editing.id ? 'Role updated.' : 'Role created.')
      setEditing(null)
      reload()
    } catch (e) {
      notify(e.message || 'Could not save that role.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (role) => {
    try {
      await deleteRole(role.id)
      notify(`${role.name} deleted.`)
      reload()
    } catch (e) {
      notify(e.message || 'Could not delete that role.', { tone: 'error' })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Roles</h1>
          <p className="max-w-2xl text-sm text-ink-400">
            A role is a bundle of permissions. Everyone who signs in holds one,
            and it decides both what they see and what the server will let them
            do.
          </p>
        </div>

        {can('roles', 'create') && !editing && (
          <Button icon={Plus} onClick={startCreate}>
            New role
          </Button>
        )}
      </div>

      {editing ? (
        <RoleEditor
          draft={editing}
          groups={groups}
          saving={saving}
          onChange={setEditing}
          onToggle={toggle}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      ) : loading ? (
        <Card className="p-8 text-center text-sm text-ink-400">Loading roles…</Card>
      ) : error ? (
        <Card className="p-8 text-center text-sm text-rose">{error}</Card>
      ) : roles.length === 0 ? (
        <EmptyState title="No roles yet" description="Create one to get started." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              total={resources.reduce((n, r) => n + r.actions.length, 0)}
              canEdit={can('roles', 'edit')}
              canDelete={can('roles', 'delete')}
              onEdit={() => startEdit(role)}
              onDelete={() => remove(role)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RoleCard({ role, total, canEdit, canDelete, onEdit, onDelete }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-ink-900">
            {role.name}
            {role.isSystem && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brass-500/40 bg-brass-500/10 px-2 py-0.5 text-[10px] font-medium text-brass-700">
                <ShieldCheck size={11} aria-hidden />
                System
              </span>
            )}
          </p>
          {role.description && (
            <p className="mt-1 text-xs leading-relaxed text-ink-400">{role.description}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canEdit && !role.isSystem && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
          {canDelete && !role.isSystem && role.userCount === 0 && (
            <button
              type="button"
              onClick={onDelete}
              title="Delete this role"
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-rose/10 hover:text-rose"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
        <span>
          <strong className="text-ink-600">{role.permissions.length}</strong> of {total} permissions
        </span>
        <span>
          <strong className="text-ink-600">{role.userCount}</strong>{' '}
          {role.userCount === 1 ? 'account' : 'accounts'}
        </span>
        {/* A role somebody holds cannot be deleted — the button is absent
            rather than present-and-failing, so the reason is visible here. */}
        {role.userCount > 0 && !role.isSystem && (
          <span className="text-ink-400">held, so it cannot be deleted</span>
        )}
      </div>
    </Card>
  )
}

function RoleEditor({ draft, groups, saving, onChange, onToggle, onCancel, onSave }) {
  const readOnly = Boolean(draft.isSystem)

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {draft.id ? `Edit ${draft.name}` : 'New role'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="rounded-md p-1 text-ink-400 transition-colors hover:text-ink-900"
        >
          <X size={16} />
        </button>
      </div>

      {readOnly && (
        <p className="mb-4 rounded-lg border border-brass-500/40 bg-brass-500/5 px-3 py-2 text-xs text-brass-700">
          This is a system role. It always holds every permission and cannot be
          renamed, edited or deleted — it is the way back in if a permission
          change locks everyone out.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name" required>
          <Input
            value={draft.name}
            disabled={readOnly}
            maxLength={40}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Description" hint="What this role is for, in a line.">
          <Input
            value={draft.description}
            disabled={readOnly}
            maxLength={200}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-5 space-y-4">
        {groups.map(([group, items]) => (
          <div key={group}>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brass-700">
                {group}
              </p>
              <span className="h-px flex-1 bg-ink-100" />
            </div>

            <div className="space-y-2">
              {items.map((resource) => (
                <div
                  key={resource.key}
                  className="rounded-xl border border-ink-100 bg-white/[0.04] p-3"
                >
                  <p className="text-sm font-medium text-ink-900">{resource.label}</p>
                  <p className="mt-0.5 text-xs text-ink-400">{resource.description}</p>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {resource.actions.map((action) => {
                      const key = `${resource.key}:${action}`
                      const on = readOnly || draft.permissions.includes(key)

                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={readOnly}
                          onClick={() => onToggle(key)}
                          className={classNames(
                            'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-60',
                            on
                              ? 'border-brass-500 bg-brass-500/15 text-brass-700'
                              : 'border-ink-100 text-ink-400 hover:border-brass-500/50 hover:text-ink-600',
                          )}
                        >
                          {action}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-5 flex items-center gap-2">
          <Button icon={Save} loading={saving} onClick={onSave}>
            {draft.id ? 'Save changes' : 'Create role'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </Card>
  )
}
