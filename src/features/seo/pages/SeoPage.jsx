import { useEffect, useMemo, useState } from 'react'
import {
  Search, Pencil, Globe, Save, X as XIcon,
  CheckCircle2, AlertTriangle,
} from 'lucide-react'
import * as seoService from '@/features/seo/seo.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import DataTable from '@/components/ui/DataTable.jsx'
import TableToolbar from '@/components/layout/TableToolbar.jsx'
import StatusFilterDropdown from '@/components/forms/StatusFilterDropdown.jsx'
import Button from '@/components/ui/Button.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Card from '@/components/ui/Card.jsx'
import Modal from '@/components/ui/Modal.jsx'
import Tabs from '@/components/ui/Tabs.jsx'
import Switch from '@/components/ui/Switch.jsx'
import { Field, Input, Textarea } from '@/components/forms/Field.jsx'
import { classNames } from '@/utils/helpers.js'
import { timeAgo } from '@/utils/formatDate.js'

// Same frosted-glass tokens as every other glass surface in the admin (see
// .glass / --glass-* in global.css) so this page's cards read as the same
// dark, translucent, blurred panel as the Dashboard and every other page.
const CARD_GLASS = {
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  boxShadow: 'var(--glass-shadow)',
}

// Same glass-field treatment as SettingsPage.jsx — kept local here too
// (rather than folded into Field.jsx) since that file explicitly notes it
// should stay page-local so it doesn't restyle every other light-card form
// (Brands, Collections, Exhibitions) app-wide.
const glassInputClass =
  '!rounded-2xl !border !border-ink-100 !bg-white/10 !backdrop-blur-sm !text-ink-900 !placeholder-ink-400 !shadow-inner focus:!border-brass-300/60 focus:!ring-2 focus:!ring-brass-300/30 focus:!bg-white/[0.14] !transition-all'
const glassTextareaClass = glassInputClass + ' !leading-relaxed'
const pillButtonClass = '!rounded-full !px-6'

// entityType -> UI label. Only STATIC_PAGE/BRAND/COLLECTION/EXHIBITION are
// ever admin-selectable (per the SEO doc, section 16) — BLOG/PRODUCT/LOCATION
// have no corresponding modules in this codebase yet, so they're not
// offered as filter/create options. Any pre-existing row with one of those
// types (unlikely, but the Prisma enum still allows it) still displays via
// the `|| entityType` fallback below rather than breaking.
const ENTITY_TYPE_LABELS = {
  STATIC_PAGE: 'Static Page', BRAND: 'Brand', COLLECTION: 'Collection', EXHIBITION: 'Exhibition',
  BLOG: 'Blog', PRODUCT: 'Product', LOCATION: 'Location',
}
const ENTITY_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'STATIC_PAGE', label: 'Static Page' },
  { value: 'BRAND', label: 'Brand' },
  { value: 'COLLECTION', label: 'Collection' },
  { value: 'EXHIBITION', label: 'Exhibition' },
]

const ROBOTS_OPTIONS = [
  { value: 'INDEX_FOLLOW', label: 'Index, Follow' },
  { value: 'INDEX_NOFOLLOW', label: 'Index, No Follow' },
  { value: 'NOINDEX_FOLLOW', label: 'No Index, Follow' },
  { value: 'NOINDEX_NOFOLLOW', label: 'No Index, No Follow' },
]

// WEBSITE/ORGANIZATION/BRAND/COLLECTION/EXHIBITION/EVENT only — the SEO
// doc (section 27) explicitly says not to expose PRODUCT/ARTICLE/FAQ/BREADCRUMB/
// LOCAL_BUSINESS even though they still exist in the Prisma SchemaType
// enum, since this site doesn't use those content types.
const SCHEMA_TYPE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'ORGANIZATION', label: 'Organization' },
  { value: 'BRAND', label: 'Brand' },
  { value: 'COLLECTION', label: 'Collection' },
  { value: 'EXHIBITION', label: 'Exhibition' },
  { value: 'EVENT', label: 'Event' },
]

const CHANGE_FREQUENCY_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'ALWAYS', label: 'Always' },
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'NEVER', label: 'Never' },
]

const EDIT_TABS = [
  { value: 'basic', label: 'Basic SEO' },
  { value: 'social', label: 'Social Sharing' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'insights', label: 'Insights' },
]

function scoreColor(score) {
  if (score >= 80) return '#7CE0B8'
  if (score >= 50) return '#D8C287'
  return '#E7A6B6'
}

// Circular score gauge — used both as the small per-row badge in the SEO
// Pages table and (larger) on the edit modal's Insights tab.
function ScoreRing({ score, size = 36, thickness = 3, showLabel = true }) {
  const color = scoreColor(score)
  return (
    <div
      className="relative shrink-0 rounded-full flex items-center justify-center"
      style={{
        height: size,
        width: size,
        background: 'conic-gradient(' + color + ' ' + (score * 3.6) + 'deg, rgba(255,255,255,0.12) 0deg)',
      }}
    >
      <div
        className="absolute rounded-full flex items-center justify-center font-semibold text-ink-900"
        style={{ inset: thickness, background: '#0B3A37', fontSize: size < 50 ? 11 : 20 }}
      >
        {showLabel ? score : ''}
      </div>
    </div>
  )
}

// Meta description length guidance — Google truncates well past 160, so
// this is a UX nudge (per the SEO doc's section 21) not a hard validation rule;
// saving is never blocked on it.
function CharCounter({ length, min = 0, max }) {
  const over = max && length > max
  const under = min && length < min && length > 0
  return (
    <span className={classNames('text-xs', over ? 'text-rose' : under ? 'text-brass-700' : 'text-ink-400')}>
      {length}/{max}
    </span>
  )
}

// Type-and-press-Enter chip input for SEO keywords/tags — backed by the
// real SeoPage <-> SeoTag relation (see seo.service.js's `tags` mapping),
// not a made-up field.
function KeywordsInput({ value = [], onChange }) {
  const [draft, setDraft] = useState('')

  function commit() {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }

  return (
    <div className={classNames('flex flex-wrap items-center gap-1.5 p-2 min-h-[42px]', glassInputClass)}>
      {value.map((kw) => (
        <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-brass-300/15 border border-brass-300/30 text-brass-700 text-xs px-2.5 py-1">
          {kw}
          <button type="button" onClick={() => onChange(value.filter((k) => k !== kw))} className="hover:text-ink-900" aria-label={'Remove ' + kw}>
            <XIcon size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={commit}
        placeholder={value.length ? '' : 'Type and press Enter to add…'}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-ink-900 placeholder:text-ink-900/40 focus:outline-none"
      />
    </div>
  )
}

function HeaderIcon({ icon: Icon }) {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brass-300/25 to-brass-600/15 border border-brass-300/20 text-brass-700">
      <Icon size={16} />
    </span>
  )
}

export default function SeoPage() {
  const { notify } = useToast()

  // ---- Global settings state ----
  const [settings, setSettings] = useState(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  // ---- SEO pages table state ----
  const [rows, setRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(true)
  const [rowsError, setRowsError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // ---- Edit modal state ----
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(null)
  const [editTab, setEditTab] = useState('basic')
  const [saving, setSaving] = useState(false)

  function loadSettings() {
    setSettingsError('')
    seoService.getSeoSettings().then(setSettings).catch((err) => {
      setSettingsError(err.message || 'Failed to load SEO settings.')
      notify(err.message || 'Failed to load SEO settings.', { tone: 'error' })
    })
  }

  function loadRows() {
    setLoadingRows(true)
    setRowsError('')
    seoService.getSeoPages().then((r) => { setRows(r); setLoadingRows(false) }).catch((err) => {
      setRowsError(err.message || 'Failed to load SEO pages.')
      setLoadingRows(false)
      notify(err.message || 'Failed to load SEO pages.', { tone: 'error' })
    })
  }

  useEffect(() => { loadSettings(); loadRows() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRows = useMemo(() => {
    let out = rows
    if (typeFilter) out = out.filter((r) => r.entityType === typeFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter((r) =>
        (r.displayName && r.displayName.toLowerCase().includes(q)) ||
        (r.slug && r.slug.toLowerCase().includes(q)) ||
        (r.metaTitle && r.metaTitle.toLowerCase().includes(q))
      )
    }
    return out
  }, [rows, typeFilter, search])

  async function handleSaveSettings(e) {
    e.preventDefault()
    setSettingsSaving(true)
    try {
      const updated = await seoService.updateSeoSettings(settings)
      setSettings(updated)
      notify('SEO settings saved.')
    } catch (err) {
      notify(err.message || 'Something went wrong.', { tone: 'error' })
    } finally {
      setSettingsSaving(false)
    }
  }

  function openEdit(row) {
    setEditing(row)
    setEditTab('basic')
    setForm({ ...row })
  }

  function closeEdit() {
    setEditing(null)
    setForm(null)
  }

  async function handleSaveRow(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await seoService.updateSeoPage(editing.id, form)
      notify('SEO page updated.')
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      closeEdit()
    } catch (err) {
      notify(err.message || 'Something went wrong.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'page', header: 'Page',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Search size={14} className="text-ink-900/40 shrink-0" />
          <div className="min-w-0">
            <div className="text-ink-900 font-medium truncate">{r.displayName}</div>
            <div className="text-ink-900/40 text-xs truncate">/{r.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'entityType', header: 'Type',
      render: (r) => <Badge tone="brass" dark>{ENTITY_TYPE_LABELS[r.entityType] || r.entityType}</Badge>,
    },
    {
      key: 'metaTitle', header: 'SEO Title',
      render: (r) => <span className="text-ink-600 text-sm line-clamp-1 block max-w-xs">{r.metaTitle}</span>,
    },
    {
      key: 'seoScore', header: 'Score', headClassName: 'w-16',
      render: (r) => <ScoreRing score={r.seoScore ?? 0} />,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge tone={r.isPublished ? 'emerald' : 'ink'} dark>{r.isPublished ? 'Published' : 'Draft'}</Badge>,
    },
    {
      key: 'sitemap', header: 'Sitemap',
      render: (r) => <Badge tone={r.includeInSitemap ? 'emerald' : 'ink'} dark>{r.includeInSitemap ? 'Included' : 'Excluded'}</Badge>,
    },
    {
      key: 'updatedAt', header: 'Updated',
      render: (r) => <span className="text-ink-400 text-xs whitespace-nowrap">{timeAgo(r.updatedAt)}</span>,
    },
    {
      key: 'actions', header: '', headClassName: 'w-16',
      render: (r) => (
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-white/10 float-right" aria-label={'Edit ' + r.displayName + ' SEO'}>
          <Pencil size={15} />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      {/* ---------------- Global SEO Settings ---------------- */}
      <Card glass className="p-5 sm:p-6 dark-surface" style={CARD_GLASS}>
        <div className="mb-5 flex items-center gap-2.5">
          <HeaderIcon icon={Globe} />
          <div>
            <h2 className="font-display text-base text-ink-900">Global SEO Settings</h2>
            <p className="text-xs text-ink-400 mt-0.5">Site-wide defaults used when a page doesn't set its own.</p>
          </div>
        </div>

        {settingsError && !settings && (
          <div className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
            Couldn't load SEO settings: {settingsError}
          </div>
        )}

        {!settings ? (
          <div className="text-sm text-ink-400">Loading…</div>
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Site Name" required>
                <Input className={glassInputClass} value={settings.siteName || ''} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} required />
              </Field>
              <Field label="Site URL" required hint="e.g. https://promisejewels.com">
                <Input className={glassInputClass} type="url" value={settings.siteUrl || ''} onChange={(e) => setSettings({ ...settings, siteUrl: e.target.value })} required />
              </Field>
              <Field label="Default Meta Title" required>
                <Input className={glassInputClass} value={settings.defaultMetaTitle || ''} onChange={(e) => setSettings({ ...settings, defaultMetaTitle: e.target.value })} maxLength={60} required />
              </Field>
              <Field label="Default Meta Description" required className="sm:col-span-2">
                <Textarea className={glassTextareaClass} value={settings.defaultMetaDescription || ''} onChange={(e) => setSettings({ ...settings, defaultMetaDescription: e.target.value })} maxLength={160} required />
              </Field>
              <Field label="Default OG Image" hint="Image URL, used as social fallback">
                <Input className={glassInputClass} value={settings.defaultOgImage || ''} onChange={(e) => setSettings({ ...settings, defaultOgImage: e.target.value })} placeholder="https://…" />
              </Field>
              <Field label="Robots Policy" required>
                <StatusFilterDropdown
                  fullWidth
                  value={settings.robots || 'INDEX_FOLLOW'}
                  onChange={(value) => setSettings({ ...settings, robots: value })}
                  options={ROBOTS_OPTIONS}
                />
              </Field>
            </div>

            <div className="pt-2">
              <Button type="submit" icon={Save} loading={settingsSaving} className={pillButtonClass}>Save Changes</Button>
            </div>
          </form>
        )}
      </Card>

      {/* ---------------- SEO Pages ---------------- */}
      <div>
        <h2 className="font-display text-base text-ink-900 mb-3">SEO Pages</h2>
        {rowsError && !loadingRows && (
          <div className="mb-3 rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
            Couldn't load SEO pages: {rowsError}
          </div>
        )}
        <DataTable
          rows={filteredRows}
          loading={loadingRows}
          columns={columns}
          emptyProps={{ title: 'No pages configured', description: 'SEO pages are created automatically when a Brand, Collection or Exhibition is added.' }}
          toolbar={
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              placeholder="Search pages…"
              filters={<StatusFilterDropdown value={typeFilter} onChange={setTypeFilter} options={ENTITY_TYPE_FILTER_OPTIONS} />}
            />
          }
        />
      </div>

      {/* ---------------- Edit modal ---------------- */}
      <Modal
        open={!!editing}
        onClose={closeEdit}
        size="xl"
        title={editing ? 'SEO — ' + editing.displayName : ''}
        subtitle={editing ? '/' + editing.slug + ' · ' + (ENTITY_TYPE_LABELS[editing.entityType] || editing.entityType) : ''}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeEdit}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSaveRow}>Save Changes</Button>
          </>
        }
      >
        {form && (
          <form onSubmit={handleSaveRow} className="space-y-5">
            <Tabs tabs={EDIT_TABS} active={editTab} onChange={setEditTab} dark />

            {editTab === 'basic' && (
              <div className="space-y-4">
                <Field label="Meta Title" required hint={<CharCounter length={form.metaTitle ? form.metaTitle.length : 0} max={60} />}>
                  <Input className={glassInputClass} value={form.metaTitle || ''} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} maxLength={70} required />
                </Field>
                <Field label="Meta Description" required hint={<CharCounter length={form.metaDescription ? form.metaDescription.length : 0} max={160} />}>
                  <Textarea className={glassTextareaClass} value={form.metaDescription || ''} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} maxLength={200} required />
                </Field>
                <Field label="Canonical URL" hint="Falls back to the site default if left blank.">
                  <Input className={glassInputClass} value={form.canonicalUrl || ''} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} placeholder="https://…" />
                </Field>
                <Field label="Robots">
                  <StatusFilterDropdown
                    fullWidth
                    value={form.robots || 'INDEX_FOLLOW'}
                    onChange={(value) => setForm({ ...form, robots: value })}
                    options={ROBOTS_OPTIONS}
                  />
                </Field>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 space-y-3.5">
                  <Switch
                    checked={!!form.includeInSitemap}
                    onChange={(v) => setForm({ ...form, includeInSitemap: v })}
                    label="Include in Sitemap"
                    description="Show this page in sitemap.xml"
                  />
                  <Switch
                    checked={!!form.isIndexed}
                    onChange={(v) => setForm({ ...form, isIndexed: v })}
                    label="Index this page"
                    description="Allow search engines to index it"
                  />
                </div>
              </div>
            )}

            {editTab === 'social' && (
              <div className="space-y-4">
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E5730]">Open Graph</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="space-y-4">
                    <Field label="OG Title" hint="Falls back to Meta Title if left blank.">
                      <Input className={glassInputClass} value={form.ogTitle || ''} onChange={(e) => setForm({ ...form, ogTitle: e.target.value })} maxLength={60} />
                    </Field>
                    <Field label="OG Description">
                      <Textarea className={glassTextareaClass} value={form.ogDescription || ''} onChange={(e) => setForm({ ...form, ogDescription: e.target.value })} maxLength={200} />
                    </Field>
                    <Field label="OG Image URL" hint="Recommended 1200 × 630px. Falls back to the site default image.">
                      <Input className={glassInputClass} value={form.ogImage || ''} onChange={(e) => setForm({ ...form, ogImage: e.target.value })} placeholder="https://…" />
                    </Field>
                  </div>
                </div>
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E5730]">Twitter</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="space-y-4">
                    <Field label="Twitter Title">
                      <Input className={glassInputClass} value={form.twitterTitle || ''} onChange={(e) => setForm({ ...form, twitterTitle: e.target.value })} maxLength={60} />
                    </Field>
                    <Field label="Twitter Description">
                      <Textarea className={glassTextareaClass} value={form.twitterDescription || ''} onChange={(e) => setForm({ ...form, twitterDescription: e.target.value })} maxLength={200} />
                    </Field>
                    <Field label="Twitter Image URL" hint="Recommended 1200 × 628px. Falls back to the OG image.">
                      <Input className={glassInputClass} value={form.twitterImage || ''} onChange={(e) => setForm({ ...form, twitterImage: e.target.value })} placeholder="https://…" />
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {editTab === 'advanced' && (
              <div className="space-y-4">
                <Field label="Schema Type" hint="Structured data (JSON-LD) is generated by the backend from this.">
                  <StatusFilterDropdown
                    fullWidth
                    value={form.schemaType || ''}
                    onChange={(value) => setForm({ ...form, schemaType: value })}
                    options={SCHEMA_TYPE_OPTIONS}
                  />
                </Field>
                <Field label="Keywords / Tags" hint="Type and press Enter to add.">
                  <KeywordsInput value={form.keywordList || []} onChange={(v) => setForm({ ...form, keywordList: v })} />
                </Field>
                <Field label="Priority" hint={'Sitemap priority (0.0 – 1.0): ' + Number(form.priority ?? 0.5).toFixed(1)}>
                  <input
                    type="range" min="0" max="1" step="0.1"
                    value={form.priority ?? 0.5}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full accent-brass-500"
                  />
                </Field>
                <Field label="Change Frequency">
                  <StatusFilterDropdown
                    fullWidth
                    value={form.changeFrequency || ''}
                    onChange={(value) => setForm({ ...form, changeFrequency: value })}
                    options={CHANGE_FREQUENCY_OPTIONS}
                  />
                </Field>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
                  <Switch
                    checked={!!form.isPublished}
                    onChange={(v) => setForm({ ...form, isPublished: v })}
                    label="Published"
                    description="Make this entry live on the website"
                  />
                </div>
              </div>
            )}

            {editTab === 'insights' && (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-2 py-2">
                  <ScoreRing score={editing.seoScore ?? 0} size={120} thickness={8} />
                  <p className="text-sm font-medium text-ink-900">
                    {editing.seoScore >= 80 ? 'Excellent' : editing.seoScore >= 50 ? 'Good' : 'Needs work'}
                  </p>
                  <p className="text-xs text-ink-400 text-center max-w-xs">
                    Calculated from completeness of key SEO fields. Save your changes and reopen this page to refresh the score.
                  </p>
                </div>
                <div className="space-y-2">
                  {(editing.completedChecks || []).map((c) => (
                    <div key={c} className="flex items-center gap-2.5 text-sm text-ink-600">
                      <CheckCircle2 size={15} className="text-[#7CE0B8] shrink-0" /> {c}
                    </div>
                  ))}
                  {(editing.missingChecks || []).map((c) => (
                    <div key={c} className="flex items-center gap-2.5 text-sm text-ink-400">
                      <AlertTriangle size={15} className="text-[#D8C287] shrink-0" /> {c} missing
                    </div>
                  ))}
                  {!editing.completedChecks?.length && !editing.missingChecks?.length && (
                    <p className="text-sm text-ink-400">No score data yet — save this page once to calculate it.</p>
                  )}
                </div>
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  )
}