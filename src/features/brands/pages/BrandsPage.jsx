import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Building2, X } from 'lucide-react'
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

// One brand = one record with all of these fields, and the public site draws
// every one of them (see pages/Home/components/OurBrands.jsx). They are edited
// together in a single frame so what you fill in here is exactly what the
// website row shows — there is no second place to go and no "save, then
// upload" second step.
const EMPTY = {
  name: '',
  description: '',
  overview: '',
  ctaTitle: '',
  ctaButtonText: '',
  displayOrder: 0,
  isActive: true,
  logoFile: null,
  bannerFile: null,
  logoUrl: '',
  bannerUrl: '',
  // Gallery rows already stored in Supabase: { id, image_url }.
  gallery: [],
  // Files picked in this session that have not been uploaded yet. They go up
  // with the same Save as the rest of the form, on create and on edit alike.
  pendingImages: [],
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: true, label: 'Active' },
  { value: false, label: 'Inactive' },
]

// Same two values as STATUS_OPTIONS minus the toolbar-only "All statuses"
// entry — a form field always has one real status selected, never "all".
const FORM_STATUS_OPTIONS = [
  { value: true, label: 'Active' },
  { value: false, label: 'Inactive' },
]

const GALLERY_STRIP_LIMIT = 4

// Matches the dashed drop zone used for the logo/banner pickers.
const DROP_ZONE_BORDER = '#FFFFFF3D'
const DROP_ZONE_BORDER_HOVER = '#D8C287B3'

function DropZone({ label, accept = 'image/*', multiple = false, onChange }) {
  return (
    <div
      className="relative rounded-3xl border border-dashed p-6 text-center transition-colors backdrop-blur-sm"
      style={{ borderColor: DROP_ZONE_BORDER, background: 'rgba(255,255,255,0.08)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = DROP_ZONE_BORDER_HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = DROP_ZONE_BORDER)}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <p className="text-sm text-ink-600">{label}</p>
      <p className="mt-1 text-xs text-brass-700">PNG, JPG, WEBP up to 5MB</p>
    </div>
  )
}

/**
 * Miniature of the row the public site renders for this brand.
 *
 * It is deliberately built from the same fields in the same order as
 * OurBrands.jsx's BrandFrame — hero photo with the logo badge on it, then
 * number, name, rule, description, overview, gallery strip, CTA — so the
 * frame you fill in and the frame visitors see cannot drift apart. Every
 * brand goes through this one layout, which is what keeps all of them
 * looking identical on the site no matter how many are added.
 */
function WebsitePreview({ form }) {
  const image = form.bannerUrl || form.gallery[0]?.image_url || form.logoUrl
  const strip = [
    ...form.gallery.map((g) => g.image_url),
    ...form.pendingImages.map((p) => p.url),
  ].slice(0, GALLERY_STRIP_LIMIT)
  const hasCta = Boolean(form.ctaTitle || form.ctaButtonText)

  return (
    <div className="rounded-2xl border border-white/10 bg-white p-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#F1F6F5]">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-[#01383B]/30">
            No image yet
          </span>
        )}
        {form.logoUrl && form.logoUrl !== image && (
          <span className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/95 shadow">
            <img src={form.logoUrl} alt="" className="h-[74%] w-[74%] object-contain" />
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="m-0 text-[0.7rem] font-medium tabular-nums text-[#C9A15A]">
          ({String((Number(form.displayOrder) || 0) + 1).padStart(2, '0')})
        </p>
        <p className="mt-1 text-base font-medium leading-tight text-[#01383B]">
          {form.name || 'Brand name'}
        </p>
        <span className="mt-2 block h-px w-[42px] bg-gradient-to-r from-[#C9A15A] to-[#C9A15A]/0" />
        {form.description && (
          <p className="mt-2 text-[0.72rem] leading-[1.7] text-[#0B5B5D]/75">{form.description}</p>
        )}
        {form.overview && (
          <p className="mt-2 whitespace-pre-line text-[0.68rem] leading-[1.75] text-[#0B5B5D]/60">
            {form.overview}
          </p>
        )}
        {strip.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {strip.map((url) => (
              <span key={url} className="h-9 w-9 overflow-hidden rounded-md bg-[#F1F6F5]">
                <img src={url} alt="" className="h-full w-full object-cover" />
              </span>
            ))}
          </div>
        )}
        {hasCta && (
          <div className="mt-3">
            {form.ctaTitle && (
              <p className="m-0 mb-1.5 text-[0.75rem] leading-snug text-[#01383B]">{form.ctaTitle}</p>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-[#C9A15A] px-3 py-1 text-[0.68rem] font-medium text-[#01383B]">
              {form.ctaButtonText || 'Enquire now'} &#8594;
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

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
    // New brands go to the end of the website list by default rather than
    // fighting the existing rows for position 0.
    setForm({ ...EMPTY, displayOrder: rows.length })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      name: row.name,
      description: row.description || '',
      overview: row.overview || '',
      ctaTitle: row.ctaTitle || '',
      ctaButtonText: row.ctaButtonText || '',
      displayOrder: row.displayOrder ?? 0,
      isActive: !!row.isActive,
      logoFile: null,
      bannerFile: null,
      logoUrl: row.logoUrl || '',
      bannerUrl: row.bannerUrl || '',
      gallery: row.gallery || [],
      pendingImages: [],
    })
    setModalOpen(true)
  }

  // Logo, banner AND gallery all ride along with the rest of the form in one
  // multipart request (uploadBrandImages on create/update), so a single Save
  // writes the whole brand — no "create first, then add images" second pass.
  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        overview: form.overview,
        ctaTitle: form.ctaTitle,
        ctaButtonText: form.ctaButtonText,
        displayOrder: Number(form.displayOrder) || 0,
        isActive: form.isActive,
        logo: form.logoFile || undefined,
        banner: form.bannerFile || undefined,
        images: form.pendingImages.length ? form.pendingImages.map((p) => p.file) : undefined,
      }
      if (editing) {
        await brandService.updateBrand(editing.id, payload)
      } else {
        await brandService.createBrand(payload)
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
    // Object URLs are only valid while the page is open; releasing them here
    // stops a long editing session from leaking every previewed file.
    form.pendingImages.forEach((p) => URL.revokeObjectURL(p.url))
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY)
  }

  function handleFileSelect(e, target) {
    const file = e.target.files?.[0]
    if (!file) return
    const fileField = target === 'logo' ? 'logoFile' : 'bannerFile'
    const urlField = target === 'logo' ? 'logoUrl' : 'bannerUrl'
    setForm((f) => ({ ...f, [fileField]: file, [urlField]: URL.createObjectURL(file) }))
    // Let the same file be re-picked after a remove.
    e.target.value = ''
  }

  function handleGallerySelect(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setForm((f) => ({
      ...f,
      pendingImages: [
        ...f.pendingImages,
        ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ],
    }))
    e.target.value = ''
  }

  function removePendingImage(url) {
    URL.revokeObjectURL(url)
    setForm((f) => ({ ...f, pendingImages: f.pendingImages.filter((p) => p.url !== url) }))
  }

  // A gallery image that is already in Supabase has to be deleted server-side;
  // there is no "unsaved delete" to undo, so it goes immediately.
  async function removeSavedImage(imageId) {
    if (!editing) return
    try {
      await brandService.deleteBrandGalleryImage(editing.id, imageId)
      setForm((f) => ({ ...f, gallery: f.gallery.filter((g) => g.id !== imageId) }))
      notify('Image removed.')
      load()
    } catch (err) {
      notify(err.message || 'Could not delete.', { tone: 'error' })
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await brandService.deleteBrand(confirmId)
      notify('Brand deleted.')
      setConfirmId(null)
      load()
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
        subtitle={
          editing
            ? `/${editing.slug} — everything here is what the website shows`
            : 'Everything the website shows for a brand, in one frame.'
        }
        size="xl"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              {editing ? 'Save changes' : 'Create brand'}
            </Button>
          </>
        }
      >
        {/* minmax(0,1fr), not 1fr: a grid item defaults to min-width:auto, so the
            left column refuses to shrink below its widest field and pushes the
            whole form wider than the dialog — which scrolls the modal body
            sideways and clips the preview. min-w-0 on the column itself is the
            same guard one level down. */}
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 space-y-4">
            <Field label="Brand name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>

            <Field label="Description" required hint="At least 10 characters — the main paragraph beside the photo.">
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                minLength={10}
                required
              />
            </Field>

            <Field label="Brand overview" hint="Optional longer copy, shown under the description. Line breaks are kept.">
              <Textarea rows={5} value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Inquiry CTA heading">
                <Input value={form.ctaTitle} onChange={(e) => setForm({ ...form, ctaTitle: e.target.value })} placeholder="e.g. Schedule a private viewing" />
              </Field>
              <Field label="CTA button text" hint="The button links to the contact page.">
                <Input value={form.ctaButtonText} onChange={(e) => setForm({ ...form, ctaButtonText: e.target.value })} placeholder="e.g. Book inquiry" />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Display order" hint="Lowest number appears first on the website.">
                <Input
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                />
              </Field>
              <Field label="Status" hint="Only active brands appear on the website.">
                <StatusFilterDropdown
                  fullWidth
                  value={form.isActive}
                  onChange={(value) => setForm({ ...form, isActive: value })}
                  options={FORM_STATUS_OPTIONS}
                />
              </Field>
            </div>

            <div className="space-y-4 border-t border-ink-100 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Logo" hint="Shown as a badge on the photo.">
                  <DropZone label="Click or drop an image" onChange={(e) => handleFileSelect(e, 'logo')} />
                  {form.logoUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={form.logoUrl} alt="Logo preview" className="h-10 w-10 rounded-full object-cover border border-white/15" />
                      <p className="truncate text-xs text-brass-700">{form.logoFile ? form.logoFile.name : form.logoUrl}</p>
                    </div>
                  )}
                </Field>

                <Field label="Banner" hint="The main photo of the website row.">
                  <DropZone label="Click or drop an image" onChange={(e) => handleFileSelect(e, 'banner')} />
                  {form.bannerUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={form.bannerUrl} alt="Banner preview" className="h-10 w-10 rounded-md object-cover border border-white/15" />
                      <p className="truncate text-xs text-brass-700">{form.bannerFile ? form.bannerFile.name : form.bannerUrl}</p>
                    </div>
                  )}
                </Field>
              </div>

              <Field label="Gallery" hint={`Extra photos. The first ${GALLERY_STRIP_LIMIT} appear as a strip on the website row.`}>
                <DropZone label="Click or drop images" multiple onChange={handleGallerySelect} />
                {(form.gallery.length > 0 || form.pendingImages.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {form.gallery.map((image) => (
                      <div key={image.id} className="relative h-16 w-16 overflow-hidden rounded-md border border-white/15">
                        <img src={image.image_url} alt={image.alt_text || ''} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeSavedImage(image.id)}
                          aria-label="Remove image"
                          className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-rose"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    {form.pendingImages.map((pending) => (
                      <div key={pending.url} className="relative h-16 w-16 overflow-hidden rounded-md border border-dashed border-brass-500/60">
                        <img src={pending.url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePendingImage(pending.url)}
                          aria-label="Remove image"
                          className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-rose"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {form.pendingImages.length > 0 && (
                  <p className="mt-2 text-xs text-brass-700">
                    {form.pendingImages.length} image{form.pendingImages.length > 1 ? 's' : ''} will upload when you save.
                  </p>
                )}
              </Field>
            </div>
          </div>

          <div className="lg:sticky lg:top-0 lg:self-start">
            <p className="mb-2 text-xs font-medium text-ink-600">Website preview</p>
            <WebsitePreview form={form} />
            <p className="mt-2 text-xs text-ink-400">
              Every brand renders in this same frame on the homepage and /our-brand.
            </p>
          </div>
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
