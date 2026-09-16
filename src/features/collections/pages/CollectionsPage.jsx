import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ImagePlus, Star, X } from 'lucide-react'
import * as collectionService from '@/features/collections/collection.api.js'
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
import { formatDate } from '@/utils/formatDate.js'
import { debounce } from '@/utils/debounce.js'

// One collection = one record with all of these fields, and the public site
// draws every one of them (see features/collections/pages/
// CollectionDetailsPage.jsx and components/CollectionCategories.jsx). They are
// edited together in a single frame so what you fill in here is exactly what
// the website shows — there is no second place to go and no "save, then
// upload" second step.
const EMPTY = {
  name: '',
  brandId: '',
  description: '',
  category: '',
  specification: '',
  ctaTitle: '',
  ctaButtonText: '',
  featured: false,
  displayOrder: 0,
  isActive: true,
  bannerFile: null,
  bannerUrl: '',
  // Gallery rows already stored in Supabase: { id, image_url, is_thumbnail }.
  gallery: [],
  // Files picked in this session that have not been uploaded yet. They go up
  // with the same Save as the rest of the form, on create and on edit alike.
  pendingImages: [],
}

// Values kept identical to the old native <select> ('all' = no filter).
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

// Matches the dashed drop zone used across the admin's image pickers.
const DROP_ZONE_BORDER = '#FFFFFF3D'
const DROP_ZONE_BORDER_HOVER = '#D8C287B3'

function DropZone({ label, multiple = false, onChange }) {
  return (
    <div
      className="relative rounded-3xl border border-dashed p-6 text-center transition-colors backdrop-blur-sm"
      style={{ borderColor: DROP_ZONE_BORDER, background: 'rgba(255,255,255,0.08)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = DROP_ZONE_BORDER_HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = DROP_ZONE_BORDER)}
    >
      <input
        type="file"
        accept="image/*"
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
 * Miniature of the tile and detail copy the public site renders for this
 * collection.
 *
 * Built from the same fields in the same order the website reads them — cover
 * photo (banner, else the thumbnail, else the first gallery shot), brand,
 * name, category, description, specifications, CTA — so the frame you fill in
 * and the page visitors see cannot drift apart.
 */
function WebsitePreview({ form, brandName }) {
  const thumbnail = form.gallery.find((img) => img.is_thumbnail)?.image_url
  const cover =
    form.bannerUrl || thumbnail || form.gallery[0]?.image_url || form.pendingImages[0]?.url
  const hasCta = Boolean(form.ctaTitle || form.ctaButtonText)

  return (
    <div className="rounded-2xl border border-white/10 bg-white p-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#01383B]">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-white/40">
            No image yet
          </span>
        )}
        <span className="pointer-events-none absolute inset-[8px] rounded-[10px] border border-[#C9A15A]/35" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[#01383B] via-[#01383B]/55 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 px-3 pb-3 text-left">
          <span className="mb-1.5 block h-px w-[18px] bg-[#C9A15A]" />
          <span className="block text-[0.85rem] font-medium leading-tight text-white">
            {form.name || 'Collection name'}
          </span>
        </span>
      </div>

      <div className="mt-3">
        <p className="m-0 text-[0.68rem] uppercase tracking-wider text-[#C9922E]">
          {brandName || 'No brand selected'}
        </p>
        {form.category && (
          <span className="mt-1.5 inline-block rounded-full border border-[#C9A15A]/50 px-2 py-0.5 text-[0.62rem] uppercase tracking-wider text-[#C9922E]">
            {form.category}
          </span>
        )}
        {form.description && (
          <p className="mt-2 whitespace-pre-line text-[0.7rem] leading-[1.7] text-[#0B5B5D]/80">
            {form.description}
          </p>
        )}
        {form.specification && (
          <>
            <p className="mt-2 text-[0.72rem] font-semibold text-[#0B5B5D]">Specifications</p>
            <p className="mt-1 whitespace-pre-line text-[0.68rem] leading-[1.7] text-[#666]">
              {form.specification}
            </p>
          </>
        )}
        {hasCta && (
          <div className="mt-3">
            {form.ctaTitle && (
              <p className="m-0 mb-1.5 text-[0.72rem] leading-snug text-[#01383B]">
                {form.ctaTitle}
              </p>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-[#C9A15A] px-3 py-1 text-[0.66rem] font-medium text-[#01383B]">
              {form.ctaButtonText || 'Enquire now'} &#8594;
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CollectionsPage() {
  const { notify } = useToast()
  const [rows, setRows] = useState([])
  const [brands, setBrands] = useState([])
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

  useEffect(() => {
    brandService.listBrands().then(setBrands).catch((err) => {
      notify(err.message || 'Failed to load brands.', { tone: 'error' })
    })
  }, [notify])

  // Themed options for the Brand field's StatusFilterDropdown. A leading
  // placeholder entry (value: '') mirrors the toolbar's "All statuses" row
  // above, so the trigger shows "Select a brand" until one is chosen.
  //
  // Inactive brands are hidden — you should not be able to file a NEW
  // collection under one — except the brand this collection is already on.
  // Without that exception, editing a collection whose brand was since
  // deactivated would show an empty Brand field and silently move the
  // collection to whatever you picked instead.
  const brandOptions = useMemo(() => {
    const selectable = brands.filter((b) => b.isActive || b.id === form.brandId)
    return [
      { value: '', label: 'Select a brand' },
      ...selectable.map((b) => ({
        value: b.id,
        label: b.isActive ? b.name : `${b.name} (inactive)`,
      })),
    ]
  }, [brands, form.brandId])

  const load = useMemo(
    () =>
      debounce((params) => {
        setLoading(true)
        setError('')
        collectionService.listCollections(params).then((r) => {
          setRows(r)
          setLoading(false)
        }).catch((err) => {
          setError(err.message || 'Failed to load collections.')
          setLoading(false)
          notify(err.message || 'Failed to load collections.', { tone: 'error' })
        })
      }, 250),
    [notify]
  )

  const reload = () =>
    load({ search, isActive: statusFilter === 'all' ? undefined : statusFilter })

  useEffect(() => {
    load({ search, isActive: statusFilter === 'all' ? undefined : statusFilter })
  }, [search, statusFilter, load])

  // The admin list carries the brand relation, so the name comes with the row
  // rather than depending on the separate brands request having landed first.
  function brandName(row) {
    return row.brandName || brands.find((b) => b.id === row.brandId)?.name || '—'
  }

  function openCreate() {
    setEditing(null)
    // New collections go to the end of the website grid by default rather
    // than fighting the existing rows for position 0.
    setForm({ ...EMPTY, displayOrder: rows.length })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      name: row.name,
      brandId: row.brandId,
      description: row.description || '',
      category: row.category || '',
      specification: row.specification || '',
      ctaTitle: row.ctaTitle || '',
      ctaButtonText: row.ctaButtonText || '',
      featured: !!row.featured,
      displayOrder: row.displayOrder ?? 0,
      isActive: !!row.isActive,
      bannerFile: null,
      bannerUrl: row.bannerUrl || '',
      gallery: row.gallery || [],
      pendingImages: [],
    })
    setModalOpen(true)
  }

  // Banner AND gallery ride along with the rest of the form in one multipart
  // request (uploadCollectionImages on create/update), so a single Save writes
  // the whole collection — no "create first, then add images" second pass.
  async function handleSave(e) {
    e.preventDefault()
    if (!form.brandId) {
      notify('Please select a brand.', { tone: 'error' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        brandId: form.brandId,
        description: form.description,
        category: form.category,
        specification: form.specification,
        ctaTitle: form.ctaTitle,
        ctaButtonText: form.ctaButtonText,
        featured: form.featured,
        displayOrder: Number(form.displayOrder) || 0,
        isActive: form.isActive,
        banner: form.bannerFile || undefined,
        images: form.pendingImages.length ? form.pendingImages.map((p) => p.file) : undefined,
      }
      if (editing) {
        await collectionService.updateCollection(editing.id, payload)
      } else {
        await collectionService.createCollection(payload)
      }
      notify(editing ? 'Collection updated.' : 'Collection created.')
      reload()
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

  function handleBannerSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setForm((f) => ({ ...f, bannerFile: file, bannerUrl: URL.createObjectURL(file) }))
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

  // A gallery image already in Supabase has to be deleted server-side; there
  // is no "unsaved delete" to undo, so it goes immediately.
  async function removeSavedImage(imageId) {
    if (!editing) return
    try {
      await collectionService.deleteCollectionGalleryImage(editing.id, imageId)
      setForm((f) => ({ ...f, gallery: f.gallery.filter((g) => g.id !== imageId) }))
      notify('Image removed.')
      reload()
    } catch (err) {
      notify(err.message || 'Could not delete.', { tone: 'error' })
    }
  }

  // Picking a thumbnail is a "choose one" on the server — it clears the flag
  // on the collection's other images — so the local state mirrors that rather
  // than toggling a single row.
  async function chooseThumbnail(imageId) {
    if (!editing) return
    try {
      await collectionService.setCollectionThumbnail(editing.id, imageId)
      setForm((f) => ({
        ...f,
        gallery: f.gallery.map((g) => ({ ...g, is_thumbnail: g.id === imageId })),
      }))
      notify('Thumbnail set.')
      reload()
    } catch (err) {
      notify(err.message || 'Could not set thumbnail.', { tone: 'error' })
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await collectionService.deleteCollection(confirmId)
      notify('Collection deleted.')
      setConfirmId(null)
      reload()
    } catch (err) {
      notify(err.message || 'Could not delete.', { tone: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'banner', header: 'Banner', headClassName: 'w-16',
      render: (r) => (
        r.bannerUrl ? (
          <img
            src={r.bannerUrl}
            alt={r.name}
            className="h-10 w-10 rounded-lg object-cover border border-ink-100"
          />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-ink-50 flex items-center justify-center text-[10px] text-ink-400 font-bold">
            N/A
          </div>
        )
      ),
    },
    {
      key: 'name', header: 'Collection',
      render: (r) => (
        <div>
          <p className="text-ink-900 font-medium">{r.name}</p>
          <p className="text-ink-400 text-xs">/{r.slug}</p>
        </div>
      ),
    },
    { key: 'brand', header: 'Brand', render: (r) => <span className="text-ink-600">{brandName(r)}</span> },
    { key: 'category', header: 'Category', render: (r) => <span className="text-ink-600">{r.category || '—'}</span> },
    { key: 'featured', header: 'Featured', render: (r) => <span className="text-ink-600">{r.featured ? '★' : '—'}</span> },
    { key: 'images', header: 'Images', render: (r) => (
      <span className="inline-flex items-center gap-1.5 text-ink-600"><ImagePlus size={13} className="text-ink-400" />{r.images}</span>
    ) },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge dark tone={r.isActive ? 'emerald' : 'ink'}>{r.isActive ? 'active' : 'inactive'}</Badge>,
    },
    { key: 'created_at', header: 'Created', render: (r) => <span className="text-ink-400">{formatDate(r.created_at)}</span> },
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

  const selectedBrandName = brands.find((b) => b.id === form.brandId)?.name

  return (
    <div className="space-y-4">
      {error && !loading && (
        <div className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          Couldn't load collections: {error}
        </div>
      )}
      <DataTable
        rows={rows}
        loading={loading}
        columns={columns}
        emptyProps={{
          title: 'No collections yet',
          description: 'Add a collection and it appears on /our-collection automatically.',
          action: <Button size="sm" icon={Plus} onClick={openCreate}>Add collection</Button>,
        }}
        toolbar={
          <TableToolbar
            dark
            search={search}
            onSearchChange={setSearch}
            placeholder="Search collections…"
            filters={
              <StatusFilterDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
              />
            }
            actions={<Button size="sm" icon={Plus} onClick={openCreate}>Add collection</Button>}
          />
        }
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit collection' : 'New collection'}
        subtitle={
          editing
            ? `/${editing.slug} — everything here is what the website shows`
            : 'Everything the website shows for a collection, in one frame.'
        }
        size="xl"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              {editing ? 'Save changes' : 'Create collection'}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label="Brand" required hint="The brands added in Admin > Brands.">
                <StatusFilterDropdown
                  fullWidth
                  value={form.brandId}
                  onChange={(value) => setForm({ ...form, brandId: value })}
                  options={brandOptions}
                />
              </Field>
            </div>

            <Field label="Description" required hint="At least 10 characters — the main paragraph on the collection page.">
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                minLength={10}
                required
              />
            </Field>

            <Field label="Specifications" hint="Material, weight, purity, gemstone details… Line breaks are kept.">
              <Textarea rows={4} value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Inquiry CTA heading">
                <Input value={form.ctaTitle} onChange={(e) => setForm({ ...form, ctaTitle: e.target.value })} placeholder="e.g. Interested in this collection?" />
              </Field>
              <Field label="CTA button text" hint="The button links to the contact page.">
                <Input value={form.ctaButtonText} onChange={(e) => setForm({ ...form, ctaButtonText: e.target.value })} placeholder="e.g. Enquire now" />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Category" hint="e.g. Rings, Necklaces…">
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Rings" />
              </Field>
              <Field label="Display order" hint="Lowest number first.">
                <Input
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                />
              </Field>
              <Field label="Status" hint="Only active ones appear.">
                <StatusFilterDropdown
                  fullWidth
                  value={form.isActive}
                  onChange={(value) => setForm({ ...form, isActive: value })}
                  options={FORM_STATUS_OPTIONS}
                />
              </Field>
            </div>

            <Field label="Featured">
              <label className="flex items-center gap-2 text-sm text-ink-600">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-200 accent-ink-900"
                />
                Feature this collection
              </label>
            </Field>

            <div className="space-y-4 border-t border-ink-100 pt-4">
              <Field label="Banner" hint="The tile photo on /our-collection and the first image on its page.">
                <DropZone label="Click or drop an image" onChange={handleBannerSelect} />
                {form.bannerUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={form.bannerUrl} alt="Banner preview" className="h-10 w-10 rounded-md object-cover border border-white/15" />
                    <p className="truncate text-xs text-brass-700">{form.bannerFile ? form.bannerFile.name : form.bannerUrl}</p>
                  </div>
                )}
              </Field>

              <Field label="Gallery" hint="The photo grid on the collection's page. Click a star to make one the thumbnail.">
                <DropZone label="Click or drop images" multiple onChange={handleGallerySelect} />
                {(form.gallery.length > 0 || form.pendingImages.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {form.gallery.map((image) => (
                      <div key={image.id} className="relative h-16 w-16 overflow-hidden rounded-md border border-white/15">
                        <img src={image.image_url} alt={image.alt_text || ''} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => chooseThumbnail(image.id)}
                          aria-label={image.is_thumbnail ? 'Current thumbnail' : 'Make thumbnail'}
                          className="absolute left-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-brass-500"
                        >
                          <Star size={11} fill={image.is_thumbnail ? 'currentColor' : 'none'} />
                        </button>
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
            <WebsitePreview form={form} brandName={selectedBrandName} />
            <p className="mt-2 text-xs text-ink-400">
              Every collection renders in this same frame on /our-collection.
            </p>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete collection?"
        description="This removes the collection and its gallery images from the public site. This can't be undone."
      />
    </div>
  )
}
