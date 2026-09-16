import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, MapPin, X, ExternalLink, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Can } from '@/features/rbac/usePermissions.jsx'
import * as exhibitionService from '@/features/exhibitions/exhibition.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import DataTable from '@/components/ui/DataTable.jsx'
import TableToolbar from '@/components/layout/TableToolbar.jsx'
import StatusFilterDropdown from '@/components/forms/StatusFilterDropdown.jsx'
import Button from '@/components/ui/Button.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Modal from '@/components/ui/Modal.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import { Field, Input, Textarea } from '@/components/forms/Field.jsx'
import { statusTone } from '@/utils/helpers.js'
import { formatDate } from '@/utils/formatDate.js'
import { debounce } from '@/utils/debounce.js'

// Mirrors every field the public /Exhibition page renders. The old EMPTY
// carried 7 fields while the page showed 15 — edition, organiser, hours,
// audience, why-we-exhibit, highlights and the per-venue dates had nowhere
// to be entered at all.
const EMPTY = {
  name: '',
  year: new Date().getFullYear(),
  edition: '',
  organiser: '',
  city: '',
  region: '',
  audience: '',
  hours: '10:00 - 19:00',
  description: '',
  whyWeExhibit: '',
  highlightsText: '',
  datesConfirmed: true,
  // At least one venue always exists; IIJS needs two, each with its own
  // dates, which is why this is a list rather than flat start/end fields.
  venues: [{ name: '', area: '', start: '', end: '' }],
  // Operator-defined extra content — see the Custom sections repeater below
  // and customSectionsSchema on the server, which is what validates it.
  customSections: [],
}

const EMPTY_VENUE = { name: '', area: '', start: '', end: '' }
const EMPTY_CUSTOM_SECTION = { title: '', fields: [{ label: '', value: '' }] }
const EMPTY_CUSTOM_FIELD = { label: '', value: '' }

const NEWLINE = String.fromCharCode(10)

// Highlights are edited as one line-per-item textarea — far less friction
// than a repeater for what is a short bullet list.
const linesToList = (text) =>
  text.split(NEWLINE).map((line) => line.trim()).filter(Boolean)
const listToLines = (list) => (list ?? []).join(NEWLINE)

// Values kept identical to the old native <select> ('' = all, so the
// existing load({ search, status: statusFilter }) call needs no changes).
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'live', label: 'Live' },
  { value: 'past', label: 'Past' },
]

// Same two values as STATUS_OPTIONS minus the toolbar-only "All statuses"
// entry — a form field always has one real status selected, never "all".
// const FORM_STATUS_OPTIONS = [
//   { value: 'upcoming', label: 'Upcoming' },
//   { value: 'past', label: 'Past' },
// ]

export default function ExhibitionsPage() {
  const { notify } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  const [confirmId, setConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Photographs for this show. `gallery` is what is already in Supabase;
  // `pendingGallery` is what has been picked in this session and goes up with
  // the same Save as the rest of the form — the gallery is part of the edit
  // frame now, not a second modal reached from the table.
  const [gallery, setGallery] = useState([])
  const [pendingGallery, setPendingGallery] = useState([])
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [error, setError] = useState('')

  const load = useMemo(
    () => debounce((params) => {
      setLoading(true)
      setError('')
      exhibitionService.listExhibitions(params).then((r) => { setRows(r); setLoading(false) }).catch((err) => {
        setError(err.message || 'Failed to load exhibitions.')
        setLoading(false)
        notify(err.message || 'Failed to load exhibitions.', { tone: 'error' })
      })
    }, 250),
    [notify]
  )

  useEffect(() => { load({ search, status: statusFilter }) }, [search, statusFilter, load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setFormError('')
    setImageFile(null)
    setImagePreview('')
    setGallery([])
    setPendingGallery([])
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      name: row.name ?? row.title ?? '',
      year: row.year ?? new Date(row.start_date).getFullYear(),
      edition: row.edition ?? '',
      organiser: row.organiser ?? '',
      city: row.city ?? '',
      region: row.region ?? '',
      audience: row.audience ?? '',
      hours: row.hours ?? '10:00 - 19:00',
      description: row.description ?? '',
      whyWeExhibit: row.whyWeExhibit ?? '',
      highlightsText: listToLines(row.highlights),
      datesConfirmed: row.datesConfirmed ?? true,
      // Fall back to the flat dates for records created before this form
      // carried a venue list, so old rows still open cleanly.
      venues:
        row.venues?.length
          ? row.venues.map((v) => ({ ...v }))
          : [{ name: row.venue ?? '', area: row.location ?? '', start: row.start_date ?? '', end: row.end_date ?? '' }],
      // Deep-copied so editing a field does not mutate the row still held in
      // the table's state behind the modal.
      customSections: (row.customSections ?? []).map((section) => ({
        title: section.title ?? '',
        fields: (section.fields ?? []).map((field) => ({
          label: field.label ?? '',
          value: field.value ?? '',
        })),
      })),
    })
    setFormError('')
    setImageFile(null)
    setImagePreview(row.image_url || '')
    setGallery(row.gallery || [])
    setPendingGallery([])
    setModalOpen(true)
  }

  // --- venue repeater ------------------------------------------------------
  function updateVenue(index, patch) {
    setForm((prev) => ({
      ...prev,
      venues: prev.venues.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }))
  }

  function addVenue() {
    setForm((prev) => ({ ...prev, venues: [...prev.venues, { ...EMPTY_VENUE }] }))
  }

  function removeVenue(index) {
    // Never drop to zero — the page needs at least one date range to render.
    setForm((prev) => ({
      ...prev,
      venues: prev.venues.length > 1 ? prev.venues.filter((_, i) => i !== index) : prev.venues,
    }))
  }

  // --- custom section repeater --------------------------------------------
  //
  // Two levels: a section (a heading) holds any number of label/value fields.
  // That is what lets a whole new block be added to the public page, and a new
  // line added inside an existing one, without a schema change either time.
  function updateCustomSection(index, patch) {
    setForm((prev) => ({
      ...prev,
      customSections: prev.customSections.map((section, i) =>
        i === index ? { ...section, ...patch } : section
      ),
    }))
  }

  function addCustomSection() {
    setForm((prev) => ({
      ...prev,
      customSections: [
        ...prev.customSections,
        { ...EMPTY_CUSTOM_SECTION, fields: [{ ...EMPTY_CUSTOM_FIELD }] },
      ],
    }))
  }

  function removeCustomSection(index) {
    setForm((prev) => ({
      ...prev,
      customSections: prev.customSections.filter((_, i) => i !== index),
    }))
  }

  function updateCustomField(sectionIndex, fieldIndex, patch) {
    setForm((prev) => ({
      ...prev,
      customSections: prev.customSections.map((section, i) =>
        i === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, j) =>
                j === fieldIndex ? { ...field, ...patch } : field
              ),
            }
          : section
      ),
    }))
  }

  function addCustomField(sectionIndex) {
    setForm((prev) => ({
      ...prev,
      customSections: prev.customSections.map((section, i) =>
        i === sectionIndex
          ? { ...section, fields: [...section.fields, { ...EMPTY_CUSTOM_FIELD }] }
          : section
      ),
    }))
  }

  function removeCustomField(sectionIndex, fieldIndex) {
    setForm((prev) => ({
      ...prev,
      customSections: prev.customSections.map((section, i) =>
        i === sectionIndex
          ? { ...section, fields: section.fields.filter((_, j) => j !== fieldIndex) }
          : section
      ),
    }))
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSave(e) {
    e.preventDefault()

    // Each venue is validated on its own — a two-venue show can easily have
    // one range right and the other reversed.
    const badVenue = form.venues.findIndex(
      (v) => !v.start || !v.end || v.end < v.start
    )
    if (badVenue !== -1) {
      setFormError(
        `Venue ${badVenue + 1}: end date must be set and on or after the start date.`
      )
      return
    }
    // Mirrors customSectionsSchema on the server, but only for what actually
    // gets SENT. Blank rows are stripped on save, so a section you started and
    // abandoned — or an empty trailing field left over from "+ Add field" —
    // must not block the whole form. Only a field that has a value typed into
    // it but no label is a genuine mistake, because that value would be
    // silently dropped.
    const badSection = form.customSections.findIndex((section) => {
      const started = section.title.trim() || section.fields.some((f) => f.label.trim() || f.value.trim())
      if (!started) return false
      if (!section.title.trim()) return true
      return section.fields.some((f) => !f.label.trim() && f.value.trim())
    })
    if (badSection !== -1) {
      setFormError(
        `Custom section ${badSection + 1}: give the section a heading, and a label to every field that has a value.`
      )
      return
    }

    setFormError('')
    setSaving(true)
    try {
      // Derived fields the table columns and status filter still read, so the
      // list view keeps working without every consumer learning the new shape.
      const starts = form.venues.map((v) => v.start).sort()
      const ends = form.venues.map((v) => v.end).sort()

      const payload = {
        ...form,
        // Empty rows are dropped rather than saved: adding a section and
        // leaving a field blank is how you abandon it, and a blank labelled
        // line on the public page reads as a bug.
        customSections: form.customSections
          .map((section) => ({
            title: section.title.trim(),
            fields: section.fields
              .filter((field) => field.label.trim())
              .map((field) => ({ label: field.label.trim(), value: field.value.trim() })),
          }))
          .filter((section) => section.title),
        // The API answers with field-level detail now (see client.js), so a
        // rejected save names the field instead of just failing.
        highlights: linesToList(form.highlightsText),
        title: `${form.name} ${form.year}`.trim(),
        location: [form.city, form.region].filter(Boolean).join(', '),
        venue: form.venues[0]?.name ?? '',
        start_date: starts[0],
        end_date: ends[ends.length - 1],
      }
      delete payload.highlightsText

      let record
      if (editing) {
        record = await exhibitionService.updateExhibition(editing.id, payload)
        notify('Exhibition updated.')
      } else {
        record = await exhibitionService.createExhibition(payload)
        notify('Exhibition created.')
      }
      if (imageFile) {
        setUploadingImage(true)
        await exhibitionService.uploadExhibitionImage(record.id, imageFile)
        setUploadingImage(false)
      }

      // Gallery uploads need an exhibition id, so they run after the record
      // exists — which is also why this works unchanged for a brand new show.
      // Sequential rather than parallel: each is a multipart POST to Supabase
      // Storage, and firing ten at once is how uploads start timing out.
      if (pendingGallery.length) {
        setUploadingGallery(true)
        for (const pending of pendingGallery) {
          await exhibitionService.uploadExhibitionGalleryImage(record.id, pending.file)
        }
        setUploadingGallery(false)
      }

      load({ search, status: statusFilter })
    } catch (err) {
      notify(err.message || 'Something went wrong.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await exhibitionService.deleteExhibition(confirmId)
      notify('Exhibition deleted.')
      setConfirmId(null)
      load({ search, status: statusFilter })
    } catch (err) {
      notify(err.message || 'Could not delete.', { tone: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  // Object URLs are only valid while the page is open; releasing them here
  // stops a long editing session from leaking every previewed file.
  function closeModal() {
    pendingGallery.forEach((p) => URL.revokeObjectURL(p.url))
    setPendingGallery([])
    setModalOpen(false)
  }

  // --- gallery, inside the edit frame --------------------------------------
  function handleGallerySelect(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setPendingGallery((prev) => [
      ...prev,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ])
    // Let the same file be re-picked after a remove.
    e.target.value = ''
  }

  function removePendingGalleryImage(url) {
    URL.revokeObjectURL(url)
    setPendingGallery((prev) => prev.filter((p) => p.url !== url))
  }

  // An image already in Supabase has to be deleted server-side; there is no
  // "unsaved delete" to undo, so it goes immediately.
  async function removeSavedGalleryImage(imageId) {
    if (!editing) return
    try {
      await exhibitionService.deleteExhibitionGalleryImage(editing.id, imageId)
      setGallery((prev) => prev.filter((i) => i.id !== imageId))
      notify('Image removed.')
      load({ search, status: statusFilter })
    } catch (err) {
      notify(err.message || 'Could not delete.', { tone: 'error' })
    }
  }

  const columns = [
    {
      key: 'thumbnail', header: '', headClassName: 'w-14',
      render: (r) => (
        r.image_url ? (
          <img src={r.image_url} alt={r.title} className="h-9 w-9 rounded-lg object-cover border border-ink-100" />
        ) : (
          <div className="h-9 w-9 rounded-lg bg-ink-50 flex items-center justify-center text-[10px] text-ink-400 font-bold">
            N/A
          </div>
        )
      ),
    },
    {
      key: 'title', header: 'Exhibition',
      render: (r) => (
        <div>
          <p className="text-ink-900 font-medium">{r.title}</p>
          <p className="text-ink-400 text-xs flex items-center gap-1"><MapPin size={11} />{r.location}</p>
        </div>
      ),
    },
    { key: 'venue', header: 'Venue', render: (r) => <span className="text-ink-600">{r.venue || '—'}</span> },
    { key: 'dates', header: 'Dates', render: (r) => <span className="text-ink-600">{formatDate(r.start_date)} – {formatDate(r.end_date)}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge dark tone={statusTone(r.status)}>{r.status}</Badge> },
    {
      key: 'actions', header: '', headClassName: 'w-28',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end">
          {/* Straight to this show's own page on the site. Adding a show here
              is what creates that page, so this is the quickest way to check
              what a visitor actually sees. */}
          {r.slug && (
            <a
              href={`/Exhibition/${r.slug}`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-50"
              aria-label={`View ${r.title} page`}
            >
              <ExternalLink size={15} />
            </a>
          )}
          {/* Running the show, as opposed to describing it. Its own
              permission, so this only appears for someone who holds it. */}
          <Can resource="exhibitionOps" action="view">
            <Link
              to={`/admin/exhibitions/${r.id}/ops`}
              className="p-1.5 rounded-md text-ink-400 hover:text-brass-700 hover:bg-brass-500/10"
              title="Operations — stall, costs, leads, stock"
              aria-label={`Operations for ${r.title}`}
            >
              <ClipboardList size={15} />
            </Link>
          </Can>
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-50" aria-label={`Edit ${r.title}`}>
            <Pencil size={15} />
          </button>
          <button onClick={() => setConfirmId(r.id)} className="p-1.5 rounded-md text-ink-400 hover:text-rose hover:bg-rose/5" aria-label={`Delete ${r.title}`}>
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
          Couldn't load exhibitions: {error}
        </div>
      )}
      <DataTable
        rows={rows}
        loading={loading}
        columns={columns}
        emptyProps={{
          title: 'No exhibitions yet',
          description: 'List an exhibition to surface it on the public site.',
          action: <Button size="sm" icon={Plus} onClick={openCreate}>Add exhibition</Button>,
        }}
        toolbar={
          <TableToolbar
            dark
            search={search}
            onSearchChange={setSearch}
            placeholder="Search exhibitions…"
            filters={
              <StatusFilterDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
              />
            }
            actions={<Button size="sm" icon={Plus} onClick={openCreate}>Add exhibition</Button>}
          />
        }
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit exhibition' : 'New exhibition'}
        subtitle={
          editing?.slug
            ? `Everything here is what /Exhibition/${editing.slug} shows.`
            : 'This becomes the show’s own page on the site.'
        }
        // Widest panel available. This form has fourteen fields plus a
        // repeater; in the default 512px dialog it was one long column with
        // most of the screen empty beside it and everything below "Who
        // attends" behind a scroll.
        size="xl"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              {saving && (uploadingImage || uploadingGallery) ? 'Uploading…' : editing ? 'Save changes' : 'Create exhibition'}
            </Button>
          </>
        }
      >
        {/* Two columns on a wide screen so the extra width is actually used:
            the show's facts on the left, its written copy and logo on the
            right. Stacks back to one column below lg, which is exactly the
            layout this form had before. */}
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label="Exhibition name" required hint="Without the year — that is a separate field.">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="IIJS Bharat Premiere" />
              </Field>
            </div>
            <Field label="Year" required>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Edition" hint="Shown as the gold label above the title.">
              <Input value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })} placeholder="42nd Edition" />
            </Field>
            <Field label="Show hours">
              <Input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="10:00 - 19:00" />
            </Field>
          </div>

          <Field label="Organised by" hint="Credited at the foot of the section and in the event schema.">
            <Input value={form.organiser} onChange={(e) => setForm({ ...form, organiser: e.target.value })} placeholder="Gem & Jewellery Export Promotion Council (GJEPC)" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="City" required>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required placeholder="Mumbai" />
            </Field>
            <Field label="State / Country" required>
              <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} required placeholder="Maharashtra, India" />
            </Field>
          </div>

          <Field label="Who attends">
            <Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="B2B - trade buyers, retailers and international importers" />
          </Field>

          {/* Venues repeater — a show can run across more than one hall with
              different opening dates at each, which a single start/end pair
              cannot express. */}
          <Field label="Venues & dates" required error={formError} hint="Add one block per hall. Each keeps its own dates.">
            <div className="space-y-3">
              {form.venues.map((venue, index) => (
                <div key={index} className="rounded-2xl border border-ink-100 bg-ink-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
                      Venue {index + 1}
                    </span>
                    {form.venues.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVenue(index)}
                        className="text-xs text-rose hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={venue.name}
                      onChange={(e) => updateVenue(index, { name: e.target.value })}
                      placeholder="Jio World Convention Centre"
                    />
                    <Input
                      value={venue.area}
                      onChange={(e) => updateVenue(index, { area: e.target.value })}
                      placeholder="BKC, Mumbai"
                    />
                    <Input
                      type="date"
                      value={venue.start}
                      onChange={(e) => updateVenue(index, { start: e.target.value })}
                      required
                    />
                    <Input
                      type="date"
                      value={venue.end}
                      onChange={(e) => updateVenue(index, { end: e.target.value })}
                      required
                    />
                  </div>
                </div>
              ))}

              <Button type="button" variant="ghost" size="sm" onClick={addVenue}>
                + Add another venue
              </Button>
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input
              type="checkbox"
              checked={form.datesConfirmed}
              onChange={(e) => setForm({ ...form, datesConfirmed: e.target.checked })}
            />
            Dates confirmed with the organiser
            <span className="text-xs text-ink-400">
              (unchecked shows a warning on the public page)
            </span>
          </label>
          </div>

          <div className="space-y-4">
          <Field label="About this show" required hint="The intro paragraph under the title.">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </Field>

          <Field label="Why we exhibit" hint="Shown in the highlighted panel.">
            <Textarea
              rows={3}
              value={form.whyWeExhibit}
              onChange={(e) => setForm({ ...form, whyWeExhibit: e.target.value })}
            />
          </Field>

          <Field label="Highlights" hint="One per line. Rendered as the gold-marker bullet list.">
            <Textarea
              rows={4}
              value={form.highlightsText}
              onChange={(e) => setForm({ ...form, highlightsText: e.target.value })}
              placeholder={`2,100+ exhibitors across roughly 3,600 stalls${NEWLINE}50,000+ trade visitors expected`}
            />
          </Field>

          {/* The extensible half of a show. Anything the fixed fields above
              do not cover goes here: one section becomes one extra block on
              the public page, one field becomes one labelled line inside it.
              Adding either needs no code change and no migration — the shape
              is validated by customSectionsSchema on the server. */}
          <Field
            label="Custom sections"
            hint="Extra blocks for this show. Each appears on the public page under its own heading."
          >
            <div className="space-y-3">
              {form.customSections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="rounded-2xl border border-ink-100 bg-ink-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
                      Section {sectionIndex + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCustomSection(sectionIndex)}
                      className="text-xs text-rose hover:underline"
                    >
                      Remove section
                    </button>
                  </div>

                  <Input
                    value={section.title}
                    onChange={(e) => updateCustomSection(sectionIndex, { title: e.target.value })}
                    placeholder="Section heading — e.g. Stall details"
                  />

                  <div className="mt-2 space-y-2">
                    {section.fields.map((field, fieldIndex) => (
                      <div key={fieldIndex} className="flex items-start gap-2">
                        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)]">
                          <Input
                            value={field.label}
                            onChange={(e) =>
                              updateCustomField(sectionIndex, fieldIndex, { label: e.target.value })
                            }
                            placeholder="Label — e.g. Stall no."
                          />
                          <Input
                            value={field.value}
                            onChange={(e) =>
                              updateCustomField(sectionIndex, fieldIndex, { value: e.target.value })
                            }
                            placeholder="Value — e.g. Hall 5, H-42"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCustomField(sectionIndex, fieldIndex)}
                          aria-label="Remove field"
                          className="mt-2.5 shrink-0 rounded-md p-1 text-ink-400 hover:bg-rose/5 hover:text-rose"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addCustomField(sectionIndex)}
                  >
                    + Add field
                  </Button>
                </div>
              ))}

              <Button type="button" variant="ghost" size="sm" onClick={addCustomSection}>
                + Add a custom section
              </Button>
            </div>
          </Field>

          <Field label="Exhibition logo">
            <div
              className="relative rounded-3xl border border-dashed border-ink-100 bg-ink-50/40 p-6 text-center transition-colors hover:border-brass-300"
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <p className="text-sm text-ink-600">Click or drop an image</p>
              <p className="mt-1 text-xs text-ink-400">PNG, JPG, WEBP up to 5MB</p>
            </div>
            {imagePreview && (
              <div className="mt-2 flex items-center gap-2">
                <img src={imagePreview} alt="Preview" className="h-10 w-10 rounded-lg object-contain border border-ink-100 bg-white" />
                <p className="truncate text-xs text-ink-400">{imageFile ? imageFile.name : 'Current image'}</p>
              </div>
            )}
          </Field>

          {/* Photographs for this show. Every image added here appears on the
              public page — the /Exhibition section and nowhere else draws its
              pictures from, so this is the one place they come from. */}
          <Field
            label="Exhibition photos"
            hint="Every photo added here is shown on the public page, in this order."
          >
            <div className="relative rounded-3xl border border-dashed border-ink-100 bg-ink-50/40 p-6 text-center transition-colors hover:border-brass-300">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleGallerySelect}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <p className="text-sm text-ink-600">Click or drop images</p>
              <p className="mt-1 text-xs text-ink-400">PNG, JPG, WEBP up to 5MB each</p>
            </div>

            {(gallery.length > 0 || pendingGallery.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {gallery.map((image) => (
                  <div key={image.id} className="relative h-16 w-16 overflow-hidden rounded-md border border-ink-100">
                    <img src={image.image_url} alt={image.alt_text || ''} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeSavedGalleryImage(image.id)}
                      aria-label="Remove image"
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-rose"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {pendingGallery.map((pending) => (
                  <div key={pending.url} className="relative h-16 w-16 overflow-hidden rounded-md border border-dashed border-brass-300">
                    <img src={pending.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePendingGalleryImage(pending.url)}
                      aria-label="Remove image"
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-rose"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {pendingGallery.length > 0 && (
              <p className="mt-2 text-xs text-ink-400">
                {pendingGallery.length} photo{pendingGallery.length > 1 ? 's' : ''} will upload when you save.
              </p>
            )}
          </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete exhibition?"
        description="This removes the exhibition and its gallery from the public site. This can't be undone."
      />
    </div>
  )
}