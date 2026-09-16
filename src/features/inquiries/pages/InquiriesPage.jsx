import { useEffect, useMemo, useState } from 'react'
import { Eye, Trash2, Download, Mail, Phone } from 'lucide-react'
import * as inquiryService from '@/features/inquiries/inquiry.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import DataTable from '@/components/ui/DataTable.jsx'
import TableToolbar from '@/components/layout/TableToolbar.jsx'
import StatusFilterDropdown from '@/components/forms/StatusFilterDropdown.jsx'
import Button from '@/components/ui/Button.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Modal from '@/components/ui/Modal.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import { statusTone } from '@/utils/helpers.js'
import { formatDateTime } from '@/utils/formatDate.js'
import { debounce } from '@/utils/debounce.js'

const STATUSES = ['new', 'read']

// Values kept identical to the old native <select> ('' = all, so the
// existing load({ search, status: statusFilter }) call needs no changes).
// Built from the same STATUSES array the status-change <select> below
// already uses, so the two never drift out of sync.
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') })),
]

// India-only numbers: strip everything but digits, keep the last 10 (the
// actual subscriber number), and prefix +91. Falls back to the raw value
// if it doesn't look like a 10-digit Indian mobile number, so bad/legacy
// data doesn't just disappear.
function formatIndianPhone(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return phone
  return `+91 ${digits}`
}

export default function InquiriesPage() {
  const { notify } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [viewing, setViewing] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const load = useMemo(
    () => debounce((params) => {
      setLoading(true)
      setError('')
      inquiryService.listInquiries(params).then((r) => { setRows(r); setLoading(false) }).catch((err) => {
        setError(err.message || 'Failed to load inquiries.')
        setLoading(false)
        notify(err.message || 'Failed to load inquiries.', { tone: 'error' })
      })
    }, 250),
    [notify]
  )

  useEffect(() => { load({ search, status: statusFilter }) }, [search, statusFilter, load])

  async function handleStatusChange(id, status) {
    await inquiryService.updateInquiryStatus(id, status)
    notify('Status updated.')
    load({ search, status: statusFilter })
    if (viewing?.id === id) setViewing((v) => ({ ...v, status }))
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await inquiryService.deleteInquiry(confirmId)
      notify('Inquiry deleted.')
      setConfirmId(null)
      setViewing(null)
      load({ search, status: statusFilter })
    } catch (err) {
      notify(err.message || 'Could not delete.', { tone: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      await inquiryService.exportInquiries({ search, status: statusFilter })
      notify('Export downloaded.')
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'name', header: 'Contact', sortable: true, sortAccessor: (r) => r.name?.toLowerCase() ?? '',
      render: (r) => (
        <div>
          <p className="text-ink-900 font-medium">{r.name}</p>
          <p className="text-ink-400 text-xs">{r.email}</p>
        </div>
      ),
    },
    { key: 'company', header: 'Company', sortable: true, sortAccessor: (r) => r.company?.toLowerCase() ?? '', render: (r) => <span className="text-ink-600">{r.company || '—'}</span> },
    { key: 'phone', header: 'Phone', render: (r) => <span className="text-ink-600">{formatIndianPhone(r.phone)}</span> },
    {
      key: 'status', header: 'Status',
      render: (r) => (
        // Visible pill is the real Badge component, so it's pixel-identical
        // to the status badges everywhere else (dot + tone-colored outline).
        // A native <select> is layered on top, fully transparent, so the
        // field is still a real dropdown you can click to change — native
        // selects can't render a colored dot themselves, so this gets both
        // the exact look and the existing click-to-change behavior.
        <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
          <Badge dark tone={statusTone(r.status)}>{r.status}</Badge>
          <select
            value={r.status}
            onChange={(e) => handleStatusChange(r.id, e.target.value)}
            aria-label={`Change status for ${r.name}`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      ),
    },
    { key: 'created_at', header: 'Received', sortable: true, sortAccessor: (r) => r.created_at, render: (r) => <span className="text-ink-400">{formatDateTime(r.created_at)}</span> },
    {
      key: 'actions', header: '', headClassName: 'w-20',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => setViewing(r)} className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-50" aria-label={`View ${r.name}`}>
            <Eye size={15} />
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
          Couldn't load inquiries: {error}
        </div>
      )}
      <DataTable
        rows={rows}
        loading={loading}
        columns={columns}
        emptyProps={{ title: 'No inquiries match', description: 'Try adjusting your search or filters.' }}
        toolbar={
          <TableToolbar
            dark
            search={search}
            onSearchChange={setSearch}
            placeholder="Search by name or email…"
            filters={
              <StatusFilterDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
              />
            }
            actions={
              <Button size="sm" variant="ghost" icon={Download} loading={exporting} onClick={handleExport}>
                Export
              </Button>
            }
          />
        }
      />

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name}
        subtitle={viewing && formatDateTime(viewing.created_at)}
        footer={
          viewing && (
            <>
              <Button variant="danger" size="sm" onClick={() => setConfirmId(viewing.id)}>Delete</Button>
              <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>Close</Button>
            </>
          )
        }
      >
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-4 text-sm">
              <a href={`mailto:${viewing.email}`} className="flex items-center gap-1.5 text-brass-700 hover:underline">
                <Mail size={14} />{viewing.email}
              </a>
              <a href={`tel:${viewing.phone}`} className="flex items-center gap-1.5 text-brass-700 hover:underline">
                <Phone size={14} />{formatIndianPhone(viewing.phone)}
              </a>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">Company</p>
              <p className="text-sm text-ink-800">{viewing.company || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">Message</p>
              <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{viewing.message}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400 mb-2">Status</p>
              <div className="flex gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(viewing.id, s)}
                    className="focus-visible:outline-2"
                  >
                    <Badge tone={viewing.status === s ? statusTone(s) : 'ink'} className={viewing.status !== s ? 'opacity-50 hover:opacity-100 cursor-pointer' : ''}>
                      {s}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete inquiry?"
        description="This permanently removes the inquiry record. Export first if you need to keep it."
      />
    </div>
  )
}