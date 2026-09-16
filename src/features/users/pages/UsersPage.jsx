import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Save, Trash2, UserPlus, X } from 'lucide-react'

import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import { Field, Input, Select } from '@/components/forms/Field.jsx'
import { useToast } from '@/components/feedback/Toast.jsx'
import { usePermissions } from '@/features/rbac/permissionsContext.js'
import { listRoles } from '@/features/rbac/rbac.api.js'
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from '@/features/users/user.api.js'
import { classNames } from '@/utils/helpers.js'

/**
 * Admin accounts.
 *
 * Creating one here is all it takes for that person to sign in: they use the
 * email and password set below, and the one-time code goes to that same
 * address. There is no invite to accept and no window where the account exists
 * but cannot be used.
 *
 * The role picker is fed from the roles API, and its last option is a link
 * through to the Roles screen — so "this person needs a role that does not
 * exist yet" is one click rather than a dead end.
 */
export default function UsersPage() {
  const { can } = usePermissions()
  const { notify } = useToast()

  const [users, setUsers] = useState([])
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

    Promise.all([
      listUsers(),
      // The role picker needs these. Someone who may create an account is
      // allowed to read role names without holding roles:view — the server
      // accepts either permission on that endpoint.
      listRoles().catch(() => []),
    ])
      .then(([accounts, roleList]) => {
        if (!alive) return
        setUsers(Array.isArray(accounts) ? accounts : [])
        setRoles(Array.isArray(roleList) ? roleList : [])
        setError('')
      })
      .catch((e) => {
        if (alive) setError(e.message || 'Could not load accounts.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [reloadToken])

  const startCreate = () =>
    setEditing({ id: null, name: '', email: '', password: '', roleId: roles[0]?.id ?? '' })

  const startEdit = (user) =>
    setEditing({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '',
      roleId: user.role?.id ?? '',
      isActive: user.isActive,
    })

  const save = async () => {
    if (!editing) return
    setSaving(true)

    try {
      if (editing.id) {
        const body = {
          name: editing.name.trim(),
          roleId: editing.roleId,
          isActive: editing.isActive,
        }
        // Only send a password when one was actually typed — an empty box
        // means "leave it alone", not "set the password to nothing".
        if (editing.password.trim()) body.password = editing.password.trim()

        await updateUser(editing.id, body)
        notify('Account updated.')
      } else {
        await createUser({
          name: editing.name.trim(),
          email: editing.email.trim(),
          password: editing.password,
          roleId: editing.roleId,
        })
        notify('Account created. They can sign in with that email and password.')
      }

      setEditing(null)
      reload()
    } catch (e) {
      notify(e.message || 'Could not save that account.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (user) => {
    try {
      await deleteUser(user.id)
      notify(`${user.email} deleted.`)
      reload()
    } catch (e) {
      notify(e.message || 'Could not delete that account.', { tone: 'error' })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Users</h1>
          <p className="max-w-2xl text-sm text-ink-400">
            Who may sign in to this panel, and which role each of them holds.
            A new account can sign in immediately — the one-time code goes to
            the email address you set here.
          </p>
        </div>

        {can('users', 'create') && !editing && (
          <Button icon={UserPlus} onClick={startCreate} disabled={roles.length === 0}>
            New user
          </Button>
        )}
      </div>

      {roles.length === 0 && !loading && (
        <Card className="p-4 text-sm text-ink-400">
          There are no roles yet, and every account needs one.{' '}
          <Link to="/admin/roles" className="text-brass-700 underline-offset-4 hover:underline">
            Create a role first
          </Link>
          .
        </Card>
      )}

      {editing ? (
        <UserEditor
          draft={editing}
          roles={roles}
          saving={saving}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      ) : loading ? (
        <Card className="p-8 text-center text-sm text-ink-400">Loading accounts…</Card>
      ) : error ? (
        <Card className="p-8 text-center text-sm text-rose">{error}</Card>
      ) : users.length === 0 ? (
        <EmptyState title="No accounts yet" description="Create one to give someone access." />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="pj-table--dark w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 text-ink-900">{user.name}</td>
                  <td className="px-4 py-3 text-ink-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.role ? (
                      <span className="rounded-full border border-ink-100 px-2 py-0.5 text-xs text-ink-600">
                        {user.role.name}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-400">no role</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={classNames(
                        'text-xs font-medium',
                        user.isActive ? 'text-emerald' : 'text-ink-400',
                      )}
                    >
                      {user.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {can('users', 'edit') && (
                        <Button variant="ghost" size="sm" onClick={() => startEdit(user)}>
                          Edit
                        </Button>
                      )}
                      {can('users', 'delete') && (
                        <button
                          type="button"
                          onClick={() => remove(user)}
                          title="Delete this account"
                          className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-rose/10 hover:text-rose"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function UserEditor({ draft, roles, saving, onChange, onCancel, onSave }) {
  const isNew = !draft.id

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {isNew ? 'New user' : `Edit ${draft.name}`}
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

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name" required>
          <Input
            value={draft.name}
            maxLength={80}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </Field>

        <Field
          label="Email"
          required={isNew}
          hint={
            isNew
              ? 'The sign-in address, and where the one-time code is sent.'
              : 'Changing the sign-in address is deliberately not done here.'
          }
        >
          <Input
            type="email"
            value={draft.email}
            disabled={!isNew}
            onChange={(e) => onChange({ ...draft, email: e.target.value })}
          />
        </Field>

        <Field
          label={isNew ? 'Password' : 'New password'}
          required={isNew}
          hint={
            isNew
              ? 'At least 8 characters. Give it to them directly.'
              : 'Leave blank to keep the current one. Setting it signs them out everywhere.'
          }
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={draft.password}
            onChange={(e) => onChange({ ...draft, password: e.target.value })}
          />
        </Field>

        <Field label="Role" required hint="What this account may see and change.">
          <Select
            value={draft.roleId}
            onChange={(e) => onChange({ ...draft, roleId: e.target.value })}
          >
            <option value="">Choose a role…</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* The way out of "the role I need does not exist". */}
      <Link
        to="/admin/roles"
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brass-700 transition-colors hover:underline"
      >
        <Plus size={12} aria-hidden />
        Create a new role
      </Link>

      {!isNew && (
        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => onChange({ ...draft, isActive: e.target.checked })}
            className="h-4 w-4 accent-brass-500"
          />
          Account is active
          <span className="text-xs text-ink-400">
            — a disabled account cannot sign in
          </span>
        </label>
      )}

      <div className="mt-5 flex items-center gap-2">
        <Button
          icon={Save}
          loading={saving}
          disabled={!draft.name.trim() || !draft.roleId || (isNew && !draft.password)}
          onClick={onSave}
        >
          {isNew ? 'Create user' : 'Save changes'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  )
}
