import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Pencil,
  Plus,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  LayoutList,
  RotateCcw,
  Save,
} from 'lucide-react'

import * as editorService from '@/features/page-content/page-content.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import Card from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'
import {
  ColorInput,
  FontSelect,
  MeasureInput,
  WeightSelect,
  Field,
  ImageInput,
  Input,
  NumberInput,
  Textarea,
} from '@/components/forms/Field.jsx'
import { uploadAsset } from '@/features/media/media.api.js'
import { Can } from '@/features/rbac/usePermissions.jsx'
import { classNames } from '@/utils/helpers.js'

// The Editor — text content for the public website.
//
// Which strings are editable is declared on the server
// (page-content.constants.ts) and sent down with the current values, so this
// page renders whatever the schema says rather than hardcoding a form per
// section. Adding an editable heading needs no change here.
//
// Flow:
//   1. pick the page (tabs across the top)
//   2. work down its sections — each is a card of labelled inputs
//   3. Save writes the whole page in one transaction and it is live at once
//   4. clearing a field puts the copy the site shipped with back
/**
 * @param area     When set, this screen edits ONE area (e.g. "header") and the
 *                 page tab bar is not rendered. Used by the Header and Footer
 *                 screens, which are not pages and so have nothing to tab
 *                 between. Left unset, it is the Content editor and tabs
 *                 across every page of the site.
 * @param title    Heading for the screen.
 * @param subtitle One line under the heading.
 */
export default function EditorPage({
  area = null,
  title = 'Editor',
  subtitle = 'The text on the public website, section by section. Saving puts it live immediately.',
}) {
  const { notify } = useToast()

  const [pages, setPages] = useState([])
  const [activePage, setActivePage] = useState(null)

  const [schema, setSchema] = useState(null)
  // Working copy of every field, keyed "section.field" so one flat object
  // backs the whole form and dirty-checking is a comparison, not a walk.
  const [draft, setDraft] = useState({})
  // The last values the server confirmed, held as STATE rather than a ref.
  // As a ref it was read during render (inside the `dirty` useMemo below),
  // which only happened to give the right answer because every write to it
  // sat next to a setDraft that re-rendered anyway. Nothing enforced that
  // pairing. As state the two move together by construction, and React
  // batches the pair into the same render, so this costs no extra work.
  const [saved, setSaved] = useState({})

  // The order the sections appear in on the live page, and whether each one
  // appears at all. Held apart from the draft because it is saved through
  // its own endpoint and is a list rather than a bag of fields — merging
  // the two would mean encoding a position as a pretend text field.
  const [layout, setLayout] = useState([])
  const [savedLayout, setSavedLayout] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ---- Loading ----

  useEffect(() => {
    // Pinned to one area: there is nothing to choose between, so the page list
    // is never fetched and the tab bar below is not rendered.
    if (area) return undefined

    let cancelled = false

    ;(async () => {
      try {
        const list = await editorService.listPages()
        if (cancelled) return
        setPages(list)
        setActivePage((current) => current ?? list[0]?.key ?? null)
      } catch (err) {
        if (!cancelled) notify(err.message || 'Failed to load pages.', { tone: 'error' })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [area, notify])

  const loadPage = useCallback(
    async (page) => {
      if (!page) return

      setLoading(true)
      try {
        const data = await editorService.getPage(page)
        const flat = flatten(data.values)

        setSchema(data)
        setDraft(flat)
        setSaved(flat)
        setLayout(data.layout ?? [])
        setSavedLayout(data.layout ?? [])
      } catch (err) {
        notify(err.message || 'Failed to load that page.', { tone: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [notify]
  )

  // A pinned area is a prop, not state — deriving it keeps the extra render
  // (and the setState-inside-an-effect) out of this component entirely.
  const currentPage = area ?? activePage

  useEffect(() => {
    loadPage(currentPage)
  }, [currentPage, loadPage])

  // ---- Actions ----

  function setValue(sectionKey, fieldKey, value) {
    setDraft((current) => ({ ...current, [`${sectionKey}.${fieldKey}`]: value }))
  }

  async function handleSave() {
    if (!schema) return

    setSaving(true)
    try {
      // Order first, words second. Saving the copy returns the page schema,
      // arrangement included, so doing it the other way round would hand back
      // the arrangement as it was a moment ago and undo what was just moved.
      if (layoutDirty) {
        const next = await editorService.saveLayout(
          schema.key,
          layout.map((entry) => ({ key: entry.key, isVisible: entry.isVisible }))
        )
        setLayout(next)
        setSavedLayout(next)
      }

      if (copyDirty) {
        const data = await editorService.updatePage(schema.key, unflatten(draft))
        const flat = flatten(data.values)

        setSchema(data)
        setDraft(flat)
        setSaved(flat)
        setLayout(data.layout ?? [])
        setSavedLayout(data.layout ?? [])
      }

      notify('Saved — the website is showing this now.')
    } catch (err) {
      notify(err.message || 'Could not save this page.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // ---- Arrangement ----

  /**
   * Moves one section up or down.
   *
   * Buttons rather than drag-and-drop, deliberately. A page has five to seven
   * sections, the panel is used on laptops and tablets alike, and a drag that
   * needs a pointer held steady over a long card is harder to get right than
   * two arrows — which also work from the keyboard without any extra code.
   */
  function moveSection(index, delta) {
    const target = index + delta
    if (target < 0 || target >= layout.length) return

    setLayout((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  /** Shows or hides one section. Hidden sections keep their place and their copy. */
  function toggleSection(index) {
    setLayout((current) =>
      current.map((entry, i) =>
        i === index ? { ...entry, isVisible: !entry.isVisible } : entry
      )
    )
  }

  /**
   * Puts a picked file in storage and hands back its URL.
   *
   * The upload happens at once, but the URL only enters the draft — nothing
   * reaches page_content until Save, so an upload the editor thinks better of
   * is simply never referenced.
   */
  async function handleUpload(file) {
    try {
      const asset = await uploadAsset(file)
      return asset.url
    } catch (err) {
      notify(err.message || 'That file could not be uploaded.', { tone: 'error' })
      return null
    }
  }

  /** Drops unsaved edits — words and arrangement alike. Saved work is untouched. */
  function handleRevert() {
    setDraft(saved)
    setLayout(savedLayout)
  }

  const copyDirty = Object.keys(draft).some((key) => draft[key] !== saved[key])

  const layoutDirty =
    layout.length !== savedLayout.length ||
    layout.some(
      (entry, index) =>
        entry.key !== savedLayout[index].key ||
        entry.isVisible !== savedLayout[index].isVisible
    )

  const dirty = copyDirty || layoutDirty

  /**
   * The section cards, in the order the live page shows them.
   *
   * The panel listing sections in one order while the website renders another
   * is the whole problem this feature exists to fix, so the cards follow the
   * arrangement — and follow it as it is being changed, which is what makes
   * the arrows below feel like they did something.
   */
  const orderedSections = (() => {
    const sections = schema?.sections ?? []
    if (layout.length === 0) return sections

    const byKey = new Map(sections.map((section) => [section.key, section]))
    const hidden = new Set(
      layout.filter((entry) => !entry.isVisible).map((entry) => entry.key)
    )

    const arranged = layout
      .map((entry) => byKey.get(entry.key))
      .filter(Boolean)

    // A section the arrangement does not mention still has to be editable.
    // That should not happen — the server sends every declared section — but
    // dropping a card silently would hide someone's copy behind a bug.
    for (const section of sections) {
      if (!arranged.includes(section)) arranged.push(section)
    }

    return arranged.map((section) => ({ ...section, hidden: hidden.has(section.key) }))
  })()

  const page = pages.find((item) => item.key === currentPage)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">{title}</h1>
          <p className="max-w-2xl text-sm text-ink-400">{subtitle}</p>
        </div>

        {schema?.sections.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleRevert} disabled={!dirty || saving} icon={RotateCcw}>
              Undo changes
            </Button>
            <Button onClick={handleSave} disabled={!dirty} loading={saving} icon={Save}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
      </div>

      {/* ---- Page tabs. Not rendered when this screen edits one area. ---- */}
      {!area && (
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
          Page
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pages.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActivePage(item.key)}
              disabled={saving}
              className={classNames(
                'rounded-xl border px-4 py-2 text-sm transition-colors disabled:opacity-50',
                item.key === activePage
                  ? 'border-brass-500 bg-brass-500/10 text-ink-900 font-medium'
                  : 'border-ink-100 text-ink-600 hover:bg-ink-50'
              )}
            >
              {item.label}
              {item.sectionCount === 0 && (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-400">
                  Not set up
                </span>
              )}
            </button>
          ))}
        </div>

        {page && (
          <p className="mt-3 text-sm text-ink-400">
            {page.sectionCount > 0
              ? `${page.sectionCount} editable sections.`
              : 'This page has no editable text yet.'}{' '}
            <a
              href={page.path}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brass-700 underline-offset-4 hover:underline"
            >
              View page
              <ExternalLink size={12} />
            </a>
          </p>
        )}
      </Card>
      )}

      {/* ---- Arrangement. Only for pages that render from it. ---- */}
      {!loading && schema?.arrangeable && layout.length > 0 && (
        <ArrangementCard
          page={schema.key}
          layout={layout}
          disabled={saving}
          dirty={layoutDirty}
          onMove={moveSection}
          onToggle={toggleSection}
        />
      )}

      {/* ---- Sections ---- */}
      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-ink-400">Loading…</p>
        </Card>
      ) : schema?.sections.length === 0 ? (
        <Card className="p-5">
          <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-100 py-10 text-center">
            <FileText size={22} className="text-ink-400" />
            <p className="mt-2 text-sm font-medium text-ink-900">
              Nothing editable on this page yet
            </p>
            <p className="max-w-md text-sm text-ink-400">
              Its text is still built into the site. Ask a developer to add the
              page&apos;s sections to the Editor and they will appear here.
            </p>
          </div>
        </Card>
      ) : (
        orderedSections.map((section) => (
          <SectionCard
            key={section.key}
            section={section}
            hidden={section.hidden}
            draft={draft}
            palette={schema?.palette ?? []}
            fonts={schema?.fonts ?? []}
            weights={schema?.weights ?? []}
            limits={schema?.limits}
            disabled={saving}
            onChange={setValue}
            onUpload={handleUpload}
          />
        ))
      )}

      {/* A long page puts the header buttons out of reach, so the save stays
          within thumb's reach at the bottom too. */}
      {dirty && schema?.sections.length > 0 && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} loading={saving} icon={Save} className="shadow-lg">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * The order the sections appear in on the live page, and whether they appear.
 *
 * This is the whole point of the screen being section-shaped rather than
 * field-shaped: an editor sees the page as a list in the order a visitor
 * scrolls it, moves a band up, hides one that is not ready, and saves. No
 * deploy, no developer.
 *
 * Hiding is not deleting. A hidden section keeps its position and every word
 * in it, so a band pulled for a season comes back exactly as it was.
 */
function ArrangementCard({ page, layout, disabled, dirty, onMove, onToggle }) {
  const visible = layout.filter((entry) => entry.isVisible).length

  return (
    <Card className="overflow-hidden p-0">
      <div className="h-px w-full bg-gradient-to-r from-brass-500/70 via-brass-500/20 to-transparent" />

      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="flex items-start gap-3">
          <LayoutList size={17} className="mt-0.5 shrink-0 text-brass-600" aria-hidden />
          <div>
            <p className="font-display text-[15px] font-semibold text-emerald-600">
              Arrangement
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              The order a visitor scrolls through this page. Move a section up or
              down, or hide one — its text is kept either way. Saving puts the
              new order on the website.
            </p>
          </div>
        </div>

        <span className="flex items-center gap-2">
          <span className="rounded-full border border-ink-100 bg-ivory-100 px-2.5 py-1 text-[10px] font-medium tracking-wide text-ink-400">
            {visible} of {layout.length} showing
          </span>

          {/* Designing a section is its own permission, so the way in is only
              offered to someone who actually holds it. */}
          <Can resource="sections" action="create">
            <Link
              to={`/admin/sections/new?page=${page}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brass-500/40 bg-brass-500/5 px-3 py-1.5 text-xs font-medium text-brass-700 transition-colors hover:border-brass-500 hover:bg-brass-500/10"
            >
              <Plus size={12} aria-hidden />
              Design a section
            </Link>
          </Can>
        </span>
      </div>

      {/* An arrangement leaving the panel unsaved is the one way to lose work
          here, and the Save button is far up the screen on a long page. */}
      {dirty && (
        <p className="border-t border-brass-500/20 bg-brass-500/[0.06] px-5 py-2 text-xs text-brass-700">
          This order has not been saved yet — the website is still showing the
          previous one.
        </p>
      )}

      <ol className="border-t border-ink-100 bg-ivory-100/40 px-5 py-4">
        {layout.map((entry, index) => (
          <li
            key={entry.key}
            className={classNames(
              'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
              index > 0 && 'mt-2',
              entry.isVisible
                // A slash-alpha white, not a solid one. Solid `bg-white` is
                // untouched by the dark theme (only `bg-white/*` is remapped),
                // so these rows stayed a bright block with cream text on them
                // — invisible. As an alpha it is a raised surface in both.
                ? 'border-ink-100 bg-white/70'
                : 'border-dashed border-ink-100 bg-transparent'
            )}
          >
            {/* The position, so the list reads as an order rather than a set. */}
            <span
              className={classNames(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                entry.isVisible
                  ? 'bg-emerald-600/10 text-emerald-600'
                  : 'bg-ink-100 text-ink-400'
              )}
              aria-hidden
            >
              {index + 1}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={classNames(
                  'block truncate text-sm font-medium',
                  entry.isVisible ? 'text-ink-900' : 'text-ink-400'
                )}
              >
                {entry.label}
              </span>
              <span className="mt-0.5 block truncate text-xs text-ink-400">
                {entry.isVisible ? entry.description : 'Hidden from the website.'}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1">
              {/* Only the designed ones have a design to open. A declared
                  section is a component in the codebase — its words are
                  edited in the card below, not here. */}
              {entry.custom && (
                <Can resource="sections" action="edit">
                  <Link
                    to={`/admin/sections/${entry.custom.id}`}
                    title={`Edit the design of ${entry.label}`}
                    aria-label={`Edit the design of ${entry.label}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-brass-500/40 bg-brass-500/5 text-brass-700 transition-colors hover:border-brass-500 hover:bg-brass-500/10"
                  >
                    <Pencil size={13} aria-hidden />
                  </Link>
                </Can>
              )}
              <IconButton
                label={`Move ${entry.label} up`}
                icon={ArrowUp}
                disabled={disabled || index === 0}
                onClick={() => onMove(index, -1)}
              />
              <IconButton
                label={`Move ${entry.label} down`}
                icon={ArrowDown}
                disabled={disabled || index === layout.length - 1}
                onClick={() => onMove(index, 1)}
              />
              <IconButton
                label={entry.isVisible ? `Hide ${entry.label}` : `Show ${entry.label}`}
                icon={entry.isVisible ? Eye : EyeOff}
                active={!entry.isVisible}
                disabled={disabled}
                onClick={() => onToggle(index)}
              />
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/** A square control that is only an icon, so it needs its name spoken. */
function IconButton({ label, icon: Icon, onClick, disabled, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={classNames(
        'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-35',
        active
          ? 'border-brass-500/50 bg-brass-500/10 text-brass-700 hover:bg-brass-500/20'
          : 'border-ink-100 text-ink-600 hover:border-brass-500/50 hover:bg-brass-500/[0.06] hover:text-brass-700'
      )}
    >
      <Icon size={14} aria-hidden />
    </button>
  )
}

/**
 * One field, rendered as whatever it is declared to be.
 *
 * The schema decides the control, not this component — adding a field type in
 * page-content.constants.ts means adding one branch here and nothing else.
 */
function FieldControl({ section, field, value, palette, fonts, weights, limits, disabled, onChange, onUpload }) {
  const set = (next) => onChange(section.key, field.key, next)

  if (field.type === 'textarea') {
    return (
      <Textarea
        rows={3}
        value={value}
        maxLength={field.max}
        disabled={disabled}
        onChange={(event) => set(event.target.value)}
      />
    )
  }

  if (field.type === 'color') {
    return <ColorInput value={value} palette={palette} disabled={disabled} onChange={set} />
  }

  if (field.type === 'image' || field.type === 'svg') {
    // SVG is offered separately because the site draws it as a mask, which is
    // what lets a colour field elsewhere in the section recolour it. A raster
    // file would keep its own colours and quietly ignore that setting.
    return (
      <ImageInput
        value={value}
        accept={field.type === 'svg' ? 'image/svg+xml' : 'image/jpeg,image/png,image/webp'}
        disabled={disabled}
        onPick={async (file) => {
          const url = await onUpload(file)
          if (url) set(url)
        }}
        onClear={() => set('')}
      />
    )
  }

  if (field.type === 'font') {
    return <FontSelect value={value} fonts={fonts} disabled={disabled} onChange={set} />
  }

  if (field.type === 'weight') {
    return <WeightSelect value={value} weights={weights} disabled={disabled} onChange={set} />
  }

  // Sizes and spacings are deliberately NOT NumberInput: that control coerces
  // an empty box to its minimum, so clearing a size would set 8px rather than
  // hand the field back to the design. Empty has to survive all the way to the
  // server, which reads it as "delete the override".
  if (field.type === 'fontsize') {
    return (
      <MeasureInput
        value={value}
        min={limits?.fontSize?.min}
        max={limits?.fontSize?.max}
        step={1}
        unit="px"
        disabled={disabled}
        onChange={set}
      />
    )
  }

  if (field.type === 'spacing') {
    return (
      <MeasureInput
        value={value}
        min={limits?.spacing?.min}
        max={limits?.spacing?.max}
        step={0.01}
        unit="em"
        disabled={disabled}
        onChange={set}
      />
    )
  }

  if (field.type === 'number') {
    return (
      <NumberInput
        value={value}
        min={field.min}
        max={field.max}
        step={field.step}
        unit={field.unit}
        disabled={disabled}
        onChange={(next) => set(String(next))}
      />
    )
  }

  return (
    <Input
      value={value}
      maxLength={field.max}
      disabled={disabled}
      onChange={(event) => set(event.target.value)}
    />
  )
}

/**
 * Splits a section's fields into the blocks the form actually draws.
 *
 * The schema lists a piece of copy and then the five controls that style it —
 * font, size, colour, weight, spacing. Drawn as six equal inputs in a row that
 * is 333 fields of undifferentiated form on the Home page, with no way to tell
 * which colour belongs to which sentence. Gathering each run into one block
 * lets the copy stay the thing you see, and its styling sit underneath it,
 * folded away until wanted.
 *
 * A styling field only joins the block above it when its key is that block's
 * key plus the expected suffix, so a colour that tints something else — a
 * button's background, a heading spanning two fields — stays a field of its
 * own rather than being absorbed into whatever happened to precede it.
 */
function buildBlocks(fields) {
  const STYLE_SUFFIX = /(ColorTo|Color|Font|Size|Weight|Spacing)$/
  const blocks = []

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i]

    if (field.type !== 'text' && field.type !== 'textarea') {
      blocks.push({ kind: 'plain', field, group: field.group })
      continue
    }

    const styling = []

    while (i + 1 < fields.length) {
      const next = fields[i + 1]
      const suffix = next.key.match(STYLE_SUFFIX)?.[0]

      if (!suffix || next.key.slice(0, -suffix.length) !== field.key) break

      styling.push(next)
      i += 1
    }

    blocks.push({ kind: 'copy', field, styling, group: field.group })
  }

  return blocks
}

/** Consecutive blocks sharing a `group`, in declaration order. */
function groupBlocks(blocks) {
  const runs = []

  for (const block of blocks) {
    const last = runs[runs.length - 1]

    if (last && last.group === block.group) last.blocks.push(block)
    else runs.push({ group: block.group, blocks: [block] })
  }

  return runs
}

/** How a section describes itself before you open it. */
function summarise(fields) {
  const copy = fields.filter((f) => f.type === 'text' || f.type === 'textarea').length
  const pictures = fields.filter((f) => f.type === 'image' || f.type === 'svg').length

  return [
    copy ? `${copy} ${copy === 1 ? 'text' : 'texts'}` : null,
    pictures ? `${pictures} ${pictures === 1 ? 'picture' : 'pictures'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * One piece of copy and the styling that belongs to it.
 *
 * The words are the field; everything else is how they look. So the input sits
 * at the top at full width and the rest is behind "Appearance", closed by
 * default — most edits are to the words, and a form that opens with five
 * styling controls under every sentence buries them.
 */
function CopyBlock({ section, field, styling, draft, controlProps }) {
  const [open, setOpen] = useState(false)
  const key = `${section.key}.${field.key}`

  // A dot on the toggle when this copy has been styled away from the design,
  // so an overridden font is visible without opening every block to look.
  //
  // Compared against each field's own default, not against empty: the colours
  // ship with real values, so "has a value" was true for every block on the
  // page and the dot marked nothing at all.
  const touched = styling.some((f) => {
    const current = draft[`${section.key}.${f.key}`] ?? ''
    return current !== '' && current !== f.default
  })

  return (
    <div className="rounded-xl border border-ink-100 bg-white/[0.04] p-3.5 transition-colors hover:border-brass-500/35">
      <Field label={field.label} hint={field.hint}>
        <FieldControl section={section} field={field} value={draft[key] ?? ''} {...controlProps} />
      </Field>

      {styling.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-400 transition-colors hover:text-brass-700"
          >
            <ChevronDown
              size={13}
              className={classNames('transition-transform', open && 'rotate-180')}
              aria-hidden
            />
            Appearance
            {touched && !open && (
              <span className="h-1.5 w-1.5 rounded-full bg-brass-500" title="Styled" />
            )}
          </button>

          {open && (
            <div className="mt-2 grid gap-3 border-t border-ink-100 pt-3 sm:grid-cols-2">
              {styling.map((styleField) => (
                <Field
                  key={styleField.key}
                  label={styleField.label.replace(`${field.label} — `, '')}
                  hint={styleField.hint}
                  className={styleField.type === 'color' ? 'sm:col-span-2' : undefined}
                >
                  <FieldControl
                    section={section}
                    field={styleField}
                    value={draft[`${section.key}.${styleField.key}`] ?? ''}
                    {...controlProps}
                  />
                </Field>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * One run of fields sharing a heading — "Scrolling names", "Pillar 01", the
 * eighteen photographs of a ring.
 *
 * A long run of pictures folds itself away. Eighteen frames is eighteen
 * thumbnails and eighteen Replace buttons, which on the Home page pushed every
 * text field in the section off the bottom of the screen.
 */
function FieldRun({ run, section, draft, controlProps }) {
  const pictures = run.blocks.every(
    (b) => b.kind === 'plain' && (b.field.type === 'image' || b.field.type === 'svg')
  )
  const foldable = pictures && run.blocks.length > 3
  const [open, setOpen] = useState(!foldable)

  return (
    <div>
      {run.group && (
        <div className="mb-2.5 flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brass-700">
            {run.group}
          </p>
          <span className="h-px flex-1 bg-ink-100" />
          {foldable && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-400 transition-colors hover:text-brass-700"
            >
              {open ? 'Hide' : `Show ${run.blocks.length}`}
              <ChevronDown
                size={12}
                className={classNames('transition-transform', open && 'rotate-180')}
                aria-hidden
              />
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="grid gap-3 md:grid-cols-2">
          {run.blocks.map((block) =>
            block.kind === 'copy' ? (
              <div
                key={block.field.key}
                className={block.field.type === 'textarea' ? 'md:col-span-2' : undefined}
              >
                <CopyBlock
                  section={section}
                  field={block.field}
                  styling={block.styling}
                  draft={draft}
                  controlProps={controlProps}
                />
              </div>
            ) : (
              <Field
                key={block.field.key}
                label={block.field.label}
                hint={block.field.hint}
                className={block.field.type === 'number' ? 'md:col-span-2' : undefined}
              >
                <FieldControl
                  section={section}
                  field={block.field}
                  value={draft[`${section.key}.${block.field.key}`] ?? ''}
                  {...controlProps}
                />
              </Field>
            )
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One section of the page, in its own box.
 *
 * Closed by default. The Home page declares seven sections and 333 fields
 * between them; opened at once that is a single unreadable column, and the
 * question an editor arrives with is "where is the hero heading", not "show me
 * everything". Closed, the page is seven labelled boxes and the answer is
 * visible without scrolling.
 */
function SectionCard({ section, hidden = false, draft, palette, fonts, weights, limits, disabled, onChange, onUpload }) {
  const [open, setOpen] = useState(false)

  const runs = useMemo(() => groupBlocks(buildBlocks(section.fields)), [section.fields])
  const summary = useMemo(() => summarise(section.fields), [section.fields])

  const controlProps = { palette, fonts, weights, limits, disabled, onChange, onUpload }

  return (
    <Card className="overflow-hidden p-0">
      {/* The gold hairline is the only ornament: it marks where one section
          ends and the next begins in a long column of otherwise plain boxes. */}
      <div className="h-px w-full bg-gradient-to-r from-brass-500/70 via-brass-500/20 to-transparent" />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-brass-500/[0.04]"
      >
        <ChevronDown
          size={17}
          className={classNames(
            'mt-0.5 shrink-0 text-brass-600 transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden
        />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-display text-[15px] font-semibold text-emerald-600">
              {section.label}
            </span>
            {summary && (
              <span className="rounded-full border border-ink-100 bg-ivory-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-ink-400">
                {summary}
              </span>
            )}
            {/* Its copy is still editable — it simply is not on the page right
                now, and saying so here stops an hour spent editing words
                nobody can see. */}
            {hidden && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brass-500/40 bg-brass-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-brass-700">
                <EyeOff size={10} aria-hidden />
                Hidden
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-ink-400">
            {section.description}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-ink-100 bg-ivory-100/40 px-5 py-4">
          {/* Content this page shows but does NOT own — the collections, the
              brands, the shows. Editing them here would put the same fact in
              two places, so it links through to the screen that owns them. */}
          {section.manage && (
            <Link
              to={section.manage.path}
              className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-brass-500/40 bg-brass-500/5 px-3 py-2 text-xs font-medium text-brass-700 transition-colors hover:border-brass-500 hover:bg-brass-500/10"
            >
              {section.manage.label}
              <span aria-hidden>→</span>
            </Link>
          )}

          {/* A band with no words of its own — a listing, a form, a grid.
              It is here so it can be moved and hidden from the Arrangement
              panel above; without this line the card opens onto nothing and
              reads as broken. */}
          {section.structural && (
            <p className="text-xs leading-relaxed text-ink-400">
              This band has no text of its own. It is listed here so it can be
              moved or hidden from the Arrangement panel above.
            </p>
          )}

          <div className="space-y-5">
            {runs.map((run, index) => (
              <FieldRun
                key={run.group ?? `run-${index}`}
                run={run}
                section={section}
                draft={draft}
                controlProps={controlProps}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// ---- Shape helpers ----

/** { section: { field: value } } -> { "section.field": value } */
function flatten(values) {
  const flat = {}

  for (const [sectionKey, fields] of Object.entries(values ?? {})) {
    for (const [fieldKey, value] of Object.entries(fields)) {
      flat[`${sectionKey}.${fieldKey}`] = value
    }
  }

  return flat
}

/**
 * The inverse. Field keys contain dots of their own ("items.1.title"), so the
 * split is on the FIRST dot only — everything after it is the field.
 */
function unflatten(flat) {
  const values = {}

  for (const [key, value] of Object.entries(flat)) {
    const dot = key.indexOf('.')
    const sectionKey = key.slice(0, dot)
    const fieldKey = key.slice(dot + 1)

    values[sectionKey] ??= {}
    values[sectionKey][fieldKey] = value
  }

  return values
}

