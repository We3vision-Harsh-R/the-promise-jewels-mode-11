import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import * as brandService from '@/features/brands/brand.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import DataTable from '@/components/ui/DataTable.jsx'
import TableToolbar from '@/components/layout/TableToolbar.jsx'
import StatusFilterDropdown from '@/components/forms/StatusFilterDropdown.jsx'
import Button from '@/components/ui/Button.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Modal from '@/components/ui/Modal.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import { Field, Input, Textarea } from '@/components/forms/Field.jsx'
import { debounce } from '@/utils/debounce.js'

// A brand is added with just a name and a description. Its logo and picture are
// uploaded from Admin > Collections, where the brand is chosen.
const EMPTY = { name: '', description: '' }

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: true, label: 'Active' },
  { value: false, label: 'Inactive' },
]

export default function BrandsPage() {
  const { notify } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const [confirmId, setConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const load = useMemo(() => debounce(() => {
    setLoading(true)
    setError('')
    brandService.listBrands().then((r) => { setRows(r); setLoading(false) }).catch((err) => {
      setError(err.message || 'Failed to load brands.')
      setLoading(false)
      notify(err.message || 'Failed to load brands.', { tone: 'error' })
    })
  }, 200), [notify])

  useEffect(() => { load() }, [load])

  const filtered = rows
    .filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    .filter((b) => statusFilter === 'all' || b.isActive === statusFilter)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({ name: row.name, description: row.description || '' })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await brandService.updateBrand(editing.id, { name: form.name, description: form.description })
      } else {
        // A new brand goes to the end of the website list.
        await brandService.createBrand({ name: form.name, description: form.description, displayOrder: rows.length })
      }

      notify(editing ? 'Brand updated.' : 'Brand created.')
      load()
      closeModal()
    } catch (err) {
      notify(err.message || 'Something went wrong.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await brandService.deleteBrand(confirmId)
      notify('Brand deleted.')
      // Taken off the list at once; the server has already confirmed it, so
      // there is no need to fetch the whole list again over a slow link.
      setRows((current) => current.filter((row) => row.id !== confirmId))
      setConfirmId(null)
    } catch (err) {
      notify(err.message || 'Could not delete.', { tone: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'logo', header: 'Logo', headClassName: 'w-16',
      render: (r) => (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-50 text-ink-400 shrink-0 overflow-hidden">
          {r.logoUrl ? (
            <img src={r.logoUrl} alt={r.name} className="h-full w-full object-cover" />
          ) : (
            <Building2 size={15} />
          )}
        </div>
      ),
    },
    {
      key: 'name', header: 'Brand',
      render: (r) => (
        <div>
          <p className="text-ink-900 font-medium">{r.name}</p>
          <p className="text-ink-400 text-xs">/{r.slug}</p>
        </div>
      ),
    },
    {
      // The website draws its rows in this order, so it belongs in the table
      // next to the brand rather than hidden inside the form only.
      key: 'displayOrder', header: 'Order', headClassName: 'w-20',
      render: (r) => <span className="text-ink-600 tabular-nums">{r.displayOrder ?? 0}</span>,
    },
    { key: 'collections', header: 'Collections', render: (r) => <span className="text-ink-600">{r.collections}</span> },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge dark tone={r.isActive ? 'emerald' : 'ink'}>{r.isActive ? 'active' : 'inactive'}</Badge>,
    },
    {
      key: 'actions', header: '', headClassName: 'w-24',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-50" aria-label={`Edit ${r.name}`}>
            <Pencil size={15} />
          </button>
          <button onClick={() => setConfirmId(r.id)} className="p-1.5 rounded-md text-ink-400 hover:text-rose hover:bg-rose/5" aria-label={`Delete ${r.name}`}>
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {error && !loading && (
        <div className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          Couldn't load brands: {error}
        </div>
      )}
      <DataTable
        rows={filtered}
        loading={loading}
        columns={columns}
        emptyProps={{
          title: 'No brands yet',
          description: 'Add a brand and it appears on the homepage and /our-brand automatically.',
          action: <Button size="sm" icon={Plus} onClick={openCreate}>Add brand</Button>,
        }}
        toolbar={
          <TableToolbar
            dark
            search={search}
            onSearchChange={setSearch}
            placeholder="Search brands…"
            actions={<Button size="sm" icon={Plus} onClick={openCreate}>Add brand</Button>}
            filters={
              <StatusFilterDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
              />
            }
          />
        }
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit brand' : 'New brand'}
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              {editing ? 'Save changes' : 'Create brand'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Brand name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>

          <Field label="Brand description" required hint="At least 10 characters.">
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              minLength={10}
              required
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete brand?"
        description="Collections under this brand will be orphaned. Reassign them first if you want to keep them live."
      />
    </div>
  )
}
