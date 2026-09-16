import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowLeft, Eye, Plus, Save, Trash2 } from 'lucide-react'

import * as sectionService from '@/features/page-content/custom-section.api.js'
import { uploadAsset } from '@/features/media/media.api.js'
import CustomSection from '@/features/page-content/CustomSection.jsx'
import { useToast } from '@/components/feedback/Toast.jsx'
import Card from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'
import {
  ColorInput,
  Field,
  FontSelect,
  ImageInput,
  Input,
  MeasureInput,
  NumberInput,
  Select,
  Textarea,
  WeightSelect,
} from '@/components/forms/Field.jsx'
import { classNames } from '@/utils/helpers.js'

// Designing a section.
//
// Everything else in the Editor changes what a page SAYS. This changes what a
// page IS: it builds a band out of a short list of blocks — a heading, some
// words, a picture, a button — and that band can then be placed anywhere on
// the page from the Arrangement panel.
//
// The preview down the right is the point of the screen. A form that describes
// a section without showing it asks the person using it to hold the result in
// their head, and the people who need this most are the ones least willing to
// do that. Everything they change appears immediately, in the section's own
// styling, drawn by the very component the website will use.

const DEFAULT_STYLE = {
  background: '#FFFFFF',
  paddingY: 90,
  width: 'normal',
  align: 'center',
}

const TYPE_LABELS = {
  heading: 'Heading',
  text: 'Paragraph',
  image: 'Picture',
  button: 'Button',
  spacer: 'Space',
  divider: 'Line',
}

/**
 * What a freshly added block starts as.
 *
 * Never empty. A blank heading renders as nothing, so the preview would not
 * move when a block was added and the button would feel broken — the wording
 * below is placeholder text that is obviously meant to be replaced.
 */
function blankBlock(type) {
  const id = `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

  switch (type) {
    case 'heading':
      return { id, type, text: 'A new heading', level: 2 }
    case 'text':
      return { id, type, text: 'Say something here.' }
    case 'image':
      return { id, type, url: '', alt: '', width: 'wide', radius: 24 }
    case 'button':
      return { id, type, label: 'Get in touch', href: '/contact' }
    case 'spacer':
      return { id, type, height: 40 }
    default:
      return { id, type }
  }
}

export default function SectionDesignerPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { notify } = useToast()

  const isNew = !id

  const [options, setOptions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [page, setPage] = useState(params.get('page') ?? 'home')
  const [label, setLabel] = useState('New section')
  const [style, setStyle] = useState(DEFAULT_STYLE)
  const [blocks, setBlocks] = useState(() => [blankBlock('heading'), blankBlock('text')])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const opts = await sectionService.getOptions()
        if (cancelled) return
        setOptions(opts)

        if (!isNew) {
          const section = await sectionService.getSection(id)
          if (cancelled) return

          setPage(section.page)
          setLabel(section.label)
          setStyle({ ...DEFAULT_STYLE, ...section.style })
          setBlocks(section.blocks)
        }
      } catch (err) {
        if (!cancelled) notify(err.message || 'Could not open the designer.', { tone: 'error' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, isNew, notify])

  const setBlock = useCallback((blockId, changes) => {
    setBlocks((current) =>
      current.map((block) => (block.id === blockId ? { ...block, ...changes } : block))
    )
  }, [])

  function moveBlock(index, delta) {
    const target = index + delta
    if (target < 0 || target >= blocks.length) return

    setBlocks((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  function removeBlock(blockId) {
    setBlocks((current) => current.filter((block) => block.id !== blockId))
  }

  /**
   * Puts a picked file in storage and hands back its URL.
   *
   * The upload happens at once but the URL only enters the draft, so a picture
   * the designer thinks better of is simply never referenced.
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

  async function handleSave() {
    if (blocks.length === 0) {
      notify('A section needs at least one block.', { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      if (isNew) {
        const created = await sectionService.createSection({ page, label, blocks, style })
        notify('Section created — place it from the Arrangement panel.')
        // Straight into editing it, so the URL now points at something real
        // and a second save does not create a second section.
        navigate(`/admin/sections/${created.id}`, { replace: true })
      } else {
        await sectionService.updateSection(id, { label, blocks, style })
        notify('Saved — the website is showing this now.')
      }
    } catch (err) {
      notify(err.message || 'Could not save this section.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await sectionService.deleteSection(id)
      notify('Section removed.')
      navigate('/admin/editor')
    } catch (err) {
      notify(err.message || 'Could not remove this section.', { tone: 'error' })
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink-400">Loading…</p>
      </Card>
    )
  }

  const pages = options?.pages ?? []
  const palette = options?.palette ?? []
  const fonts = options?.fonts ?? []
  const weights = options?.weights ?? []
  const limits = options?.limits
  const blockTypes = options?.blockTypes ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/editor"
            className="mb-1 inline-flex items-center gap-1.5 text-xs text-ink-400 transition-colors hover:text-brass-700"
          >
            <ArrowLeft size={13} />
            Back to Content
          </Link>
          <p className="max-w-2xl text-sm text-ink-400">
            Build a band out of blocks, then place it anywhere on the page from
            the Arrangement panel. Nothing here needs a developer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="ghost" onClick={handleDelete} disabled={saving} icon={Trash2}>
              Delete
            </Button>
          )}
          <Button onClick={handleSave} loading={saving} icon={Save}>
            {saving ? 'Saving…' : isNew ? 'Create section' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ---- The form ---- */}
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
              The section
            </p>

            <Field label="Name" hint="Shown in the panel only — visitors never see it.">
              <Input
                value={label}
                maxLength={60}
                disabled={saving}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>

            <Field
              label="Page"
              hint={
                isNew
                  ? 'Which page it belongs to.'
                  : 'A section stays on the page it was made for — its position there is what the arrangement points at.'
              }
            >
              <Select
                value={page}
                disabled={saving || !isNew}
                onChange={(event) => setPage(event.target.value)}
              >
                {pages.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Background">
                <ColorInput
                  value={style.background}
                  palette={palette}
                  disabled={saving}
                  onChange={(value) => setStyle((s) => ({ ...s, background: value }))}
                />
              </Field>

              <Field label="Width">
                <Select
                  value={style.width}
                  disabled={saving}
                  onChange={(event) => setStyle((s) => ({ ...s, width: event.target.value }))}
                >
                  {(options?.widths ?? []).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Space above and below">
                <NumberInput
                  value={style.paddingY}
                  min={0}
                  max={200}
                  step={2}
                  unit="px"
                  disabled={saving}
                  onChange={(value) => setStyle((s) => ({ ...s, paddingY: value }))}
                />
              </Field>

              <Field label="Alignment">
                <Select
                  value={style.align}
                  disabled={saving}
                  onChange={(event) => setStyle((s) => ({ ...s, align: event.target.value }))}
                >
                  <option value="left">Left</option>
                  <option value="center">Centre</option>
                  <option value="right">Right</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
                Blocks
              </p>
              <span className="text-xs text-ink-400">
                {blocks.length} in this section
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {blocks.map((block, index) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  index={index}
                  total={blocks.length}
                  palette={palette}
                  fonts={fonts}
                  weights={weights}
                  limits={limits}
                  disabled={saving}
                  onChange={setBlock}
                  onMove={moveBlock}
                  onRemove={removeBlock}
                  onUpload={handleUpload}
                />
              ))}

              {blocks.length === 0 && (
                <p className="rounded-xl border border-dashed border-ink-100 py-8 text-center text-sm text-ink-400">
                  Nothing in this section yet. Add a block below.
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
              {blockTypes.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  disabled={saving}
                  title={item.description}
                  onClick={() => setBlocks((current) => [...current, blankBlock(item.type)])}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-100 px-3 py-2 text-xs font-medium text-ink-600 transition-colors hover:border-brass-500/50 hover:bg-brass-500/[0.06] hover:text-brass-700 disabled:opacity-40"
                >
                  <Plus size={12} aria-hidden />
                  {item.label}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* ---- The preview ---- */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3">
              <Eye size={15} className="text-brass-600" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
                How it will look
              </p>
            </div>

            {/* The website's own theme class, so the brand faces and the site's
                own resets apply here exactly as they do on the page itself. */}
            <div className="web-theme max-h-[70vh] overflow-y-auto">
              <CustomSection blocks={blocks} style={style} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** One block's controls. Which controls appear depends on what kind it is. */
function BlockEditor({
  block,
  index,
  total,
  palette,
  fonts,
  weights,
  limits,
  disabled,
  onChange,
  onMove,
  onRemove,
  onUpload,
}) {
  const [open, setOpen] = useState(false)

  const set = (changes) => onChange(block.id, changes)

  const summary =
    block.text ?? block.label ?? block.url ?? (block.height ? `${block.height}px tall` : 'A line')

  return (
    <div className="rounded-xl border border-ink-100 bg-ivory-100/40">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="shrink-0 rounded-md bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
          {TYPE_LABELS[block.type] ?? block.type}
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 truncate text-left text-sm text-ink-600 transition-colors hover:text-ink-900"
        >
          {String(summary).slice(0, 60) || 'Empty'}
        </button>

        <span className="flex shrink-0 items-center gap-1">
          <SmallButton
            label="Move up"
            icon={ArrowUp}
            disabled={disabled || index === 0}
            onClick={() => onMove(index, -1)}
          />
          <SmallButton
            label="Move down"
            icon={ArrowDown}
            disabled={disabled || index === total - 1}
            onClick={() => onMove(index, 1)}
          />
          <SmallButton
            label="Remove"
            icon={Trash2}
            disabled={disabled}
            onClick={() => onRemove(block.id)}
          />
        </span>
      </div>

      {open && (
        <div className="space-y-4 border-t border-ink-100 px-3 py-3">
          {(block.type === 'heading' || block.type === 'text') && (
            <>
              <Field label="Words">
                {block.type === 'heading' ? (
                  <Input
                    value={block.text ?? ''}
                    maxLength={160}
                    disabled={disabled}
                    onChange={(event) => set({ text: event.target.value })}
                  />
                ) : (
                  <Textarea
                    value={block.text ?? ''}
                    maxLength={2000}
                    rows={5}
                    disabled={disabled}
                    onChange={(event) => set({ text: event.target.value })}
                  />
                )}
              </Field>

              {block.type === 'heading' && (
                <Field label="How large">
                  <Select
                    value={String(block.level ?? 2)}
                    disabled={disabled}
                    onChange={(event) => set({ level: Number(event.target.value) })}
                  >
                    <option value="1">Largest</option>
                    <option value="2">Section heading</option>
                    <option value="3">Small heading</option>
                  </Select>
                </Field>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Font">
                  <FontSelect
                    value={block.font ?? ''}
                    fonts={fonts}
                    disabled={disabled}
                    onChange={(value) => set({ font: value || undefined })}
                  />
                </Field>

                <Field label="Size">
                  <MeasureInput
                    value={block.size ?? ''}
                    min={limits?.fontSize?.min}
                    max={limits?.fontSize?.max}
                    unit="px"
                    disabled={disabled}
                    onChange={(value) => set({ size: value === '' ? undefined : Number(value) })}
                  />
                </Field>

                <Field label="Colour">
                  <ColorInput
                    value={block.color ?? ''}
                    palette={palette}
                    disabled={disabled}
                    onChange={(value) => set({ color: value || undefined })}
                  />
                </Field>

                <Field label="Weight">
                  <WeightSelect
                    value={block.weight ?? ''}
                    weights={weights}
                    disabled={disabled}
                    onChange={(value) => set({ weight: value || undefined })}
                  />
                </Field>
              </div>
            </>
          )}

          {block.type === 'image' && (
            <>
              <Field label="Picture">
                <ImageInput
                  value={block.url}
                  disabled={disabled}
                  onPick={async (file) => {
                    const url = await onUpload(file)
                    if (url) set({ url })
                  }}
                  onClear={() => set({ url: '' })}
                />
              </Field>

              <Field
                label="Description for screen readers"
                hint="What the picture shows. Leave it empty if it is decoration."
              >
                <Input
                  value={block.alt ?? ''}
                  maxLength={200}
                  disabled={disabled}
                  onChange={(event) => set({ alt: event.target.value })}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="How wide">
                  <Select
                    value={block.width ?? 'wide'}
                    disabled={disabled}
                    onChange={(event) => set({ width: event.target.value })}
                  >
                    <option value="third">Small</option>
                    <option value="half">Medium</option>
                    <option value="wide">Large</option>
                    <option value="full">Full width</option>
                  </Select>
                </Field>

                <Field label="Corner rounding">
                  <NumberInput
                    value={block.radius ?? 24}
                    min={0}
                    max={80}
                    unit="px"
                    disabled={disabled}
                    onChange={(value) => set({ radius: value })}
                  />
                </Field>
              </div>
            </>
          )}

          {block.type === 'button' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Label">
                <Input
                  value={block.label ?? ''}
                  maxLength={60}
                  disabled={disabled}
                  onChange={(event) => set({ label: event.target.value })}
                />
              </Field>

              <Field
                label="Where it goes"
                hint="A page on this site like /contact, or a full https:// address."
              >
                <Input
                  value={block.href ?? ''}
                  maxLength={500}
                  disabled={disabled}
                  onChange={(event) => set({ href: event.target.value })}
                />
              </Field>

              <Field label="Button colour">
                <ColorInput
                  value={block.background ?? ''}
                  palette={palette}
                  disabled={disabled}
                  onChange={(value) => set({ background: value || undefined })}
                />
              </Field>

              <Field label="Label colour">
                <ColorInput
                  value={block.color ?? ''}
                  palette={palette}
                  disabled={disabled}
                  onChange={(value) => set({ color: value || undefined })}
                />
              </Field>
            </div>
          )}

          {block.type === 'spacer' && (
            <Field label="How much room">
              <NumberInput
                value={block.height ?? 40}
                min={4}
                max={240}
                step={2}
                unit="px"
                disabled={disabled}
                onChange={(value) => set({ height: value })}
              />
            </Field>
          )}

          {block.type === 'divider' && (
            <Field label="Colour of the line">
              <ColorInput
                value={block.color ?? ''}
                palette={palette}
                disabled={disabled}
                onChange={(value) => set({ color: value || undefined })}
              />
            </Field>
          )}
        </div>
      )}
    </div>
  )
}

function SmallButton({ label, icon: Icon, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={classNames(
        'flex h-7 w-7 items-center justify-center rounded-md border border-ink-100 text-ink-600 transition-colors',
        'hover:border-brass-500/50 hover:bg-brass-500/[0.06] hover:text-brass-700',
        'disabled:cursor-not-allowed disabled:opacity-35'
      )}
    >
      <Icon size={13} aria-hidden />
    </button>
  )
}
