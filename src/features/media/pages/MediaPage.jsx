import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Trash2, Check, ImageOff, ImagePlus, Images, X } from 'lucide-react'

import * as mediaService from '@/features/media/media.api.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import Card from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import { classNames } from '@/utils/helpers.js'

// Home hero images, managed from the admin.
//
// Every picture holder in a hero ring is a numbered FRAME — outer ring 1-18,
// inner ring 1-12, counted clockwise from the top. A frame is the image's
// identification number: it is what you edit, and setting frame 7 never
// touches frame 8.
//
// Flow, top to bottom:
//   1. pick the ring you are editing
//   2. work down the numbered frame list, one image per frame — either
//      "Upload" straight into a frame, or pick a library image and "Use" it
//   3. "Upload many" fills consecutive frames from one multi-file pick, for
//      setting up a whole ring in one go
//   4. every change is live on the website immediately; a frame left empty
//      keeps the photo bundled with the site

/** Frames are numbered from 1 in the UI, matching the API. */
const FIRST_SLOT = 1

export default function MediaPage() {
  const { notify } = useToast()

  const [sections, setSections] = useState([])
  const [activeSection, setActiveSection] = useState(null)

  const [slots, setSlots] = useState([])
  const [assets, setAssets] = useState([])

  const [selectedAssetId, setSelectedAssetId] = useState(null)

  const [loading, setLoading] = useState(true)
  // The frame currently being written to, so only that card shows a spinner.
  const [busySlot, setBusySlot] = useState(null)
  const [bulk, setBulk] = useState(null) // { done, total } while filling frames
  const [bulkStart, setBulkStart] = useState(FIRST_SLOT)
  const [confirm, setConfirm] = useState(null)

  // One file input drives every per-frame "Upload" button; the frame that
  // opened it is remembered here so onChange knows where the file belongs.
  const slotFileRef = useRef(null)
  const pendingSlotRef = useRef(null)
  const bulkFileRef = useRef(null)

  // ---- Loading ----

  const loadSlots = useCallback(
    async (section) => {
      if (!section) return
      try {
        setSlots(await mediaService.listSectionSlots(section))
      } catch (err) {
        notify(err.message || 'Failed to load the frames.', { tone: 'error' })
      }
    },
    [notify]
  )

  const loadAssets = useCallback(async () => {
    try {
      setAssets(await mediaService.listAssets())
    } catch (err) {
      notify(err.message || 'Failed to load the image library.', { tone: 'error' })
    }
  }, [notify])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const list = await mediaService.listSections()
        if (cancelled) return
        setSections(list)
        setActiveSection((current) => current ?? list[0]?.key ?? null)
      } catch (err) {
        if (!cancelled) notify(err.message || 'Failed to load sections.', { tone: 'error' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    loadAssets()

    return () => {
      cancelled = true
    }
  }, [loadAssets, notify])

  useEffect(() => {
    loadSlots(activeSection)
  }, [activeSection, loadSlots])

  // ---- Frame actions ----

  function pickFileForSlot(slot) {
    pendingSlotRef.current = slot
    slotFileRef.current?.click()
  }

  async function handleSlotUpload(event) {
    const file = event.target.files?.[0]
    const slot = pendingSlotRef.current
    // Reset immediately so re-picking the same file still fires onChange.
    event.target.value = ''
    pendingSlotRef.current = null

    if (!file || !slot || !activeSection) return

    setBusySlot(slot)
    try {
      await mediaService.uploadToSlot(activeSection, slot, file)
      // The upload also added a library image, so both lists move.
      await Promise.all([loadSlots(activeSection), loadAssets()])
      notify(`Frame ${slot} updated — it is live on the website now.`)
    } catch (err) {
      notify(err.message || `Could not set frame ${slot}.`, { tone: 'error' })
    } finally {
      setBusySlot(null)
    }
  }

  async function handleUseSelected(slot) {
    if (!selectedAssetId || !activeSection) return

    setBusySlot(slot)
    try {
      await mediaService.setSlotImage(activeSection, slot, selectedAssetId)
      await loadSlots(activeSection)
      notify(`Frame ${slot} updated — it is live on the website now.`)
    } catch (err) {
      notify(err.message || `Could not set frame ${slot}.`, { tone: 'error' })
    } finally {
      setBusySlot(null)
    }
  }

  async function handleClearSlot(slot) {
    if (!activeSection) return

    setBusySlot(slot)
    try {
      await mediaService.clearSlot(activeSection, slot)
      await loadSlots(activeSection)
      notify(`Frame ${slot} cleared — it shows the built-in photo again.`)
    } catch (err) {
      notify(err.message || `Could not clear frame ${slot}.`, { tone: 'error' })
    } finally {
      setBusySlot(null)
    }
  }

  /**
   * Fills consecutive frames from one multi-file pick — the fast way to set
   * up a ring. Files go in one at a time rather than in parallel so a failure
   * is attributable to a frame, and so the frame numbering can't race.
   */
  async function handleBulkUpload(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''

    if (files.length === 0 || !activeSection) return

    const capacity = slots.length - (bulkStart - FIRST_SLOT)
    const queue = files.slice(0, Math.max(capacity, 0))

    if (queue.length === 0) {
      notify(`Frame ${bulkStart} is past the end of this ring.`, { tone: 'error' })
      return
    }

    if (queue.length < files.length) {
      notify(
        `Only ${queue.length} frame${queue.length === 1 ? '' : 's'} left from frame ${bulkStart} — the remaining ${files.length - queue.length} file(s) were skipped.`,
        { tone: 'error' }
      )
    }

    setBulk({ done: 0, total: queue.length })

    let filled = 0
    try {
      for (const [index, file] of queue.entries()) {
        const slot = bulkStart + index
        try {
          await mediaService.uploadToSlot(activeSection, slot, file)
          filled += 1
        } catch (err) {
          notify(err.message || `Frame ${slot} failed — stopped there.`, { tone: 'error' })
          break
        }
        setBulk({ done: index + 1, total: queue.length })
      }
    } finally {
      setBulk(null)
      await Promise.all([loadSlots(activeSection), loadAssets()])
    }

    if (filled > 0) {
      const last = bulkStart + filled - 1
      setBulkStart(Math.min(last + 1, slots.length))
      notify(
        filled === 1
          ? `Frame ${bulkStart} updated.`
          : `Frames ${bulkStart}-${last} updated — all live on the website now.`
      )
    }
  }

  // ---- Library actions ----

  async function handleDeleteAsset() {
    const asset = confirm?.asset
    if (!asset) return

    try {
      await mediaService.deleteAsset(asset.id)
      // Deleting cascades onto every frame it filled, so reload both.
      await Promise.all([loadAssets(), loadSlots(activeSection)])
      if (selectedAssetId === asset.id) setSelectedAssetId(null)
      notify('Image deleted from the library.')
    } catch (err) {
      notify(err.message || 'Could not delete that image.', { tone: 'error' })
    } finally {
      setConfirm(null)
    }
  }

  const section = sections.find((s) => s.key === activeSection)
  const selected = assets.find((a) => a.id === selectedAssetId)
  const busy = busySlot !== null || bulk !== null

  const usedAssetIds = useMemo(
    () => new Set(slots.map((s) => s.entry?.assetId).filter(Boolean)),
    [slots]
  )
  const filledCount = slots.filter((s) => s.entry).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-ink-900">Home page images</h1>
        <p className="text-sm text-ink-400">
          Each photo in the homepage hero rings has a frame number. Set them one
          at a time — every change goes live immediately.
        </p>
      </div>

      {/* ---- 1. Which ring ---- */}
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
          Ring
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setActiveSection(s.key)
                // Rings differ in length, so a start frame carried over from
                // the other ring could point past the end of this one.
                setBulkStart(FIRST_SLOT)
              }}
              disabled={busy}
              className={classNames(
                'rounded-xl border px-4 py-2 text-sm transition-colors disabled:opacity-50',
                s.key === activeSection
                  ? 'border-brass-500 bg-brass-500/10 text-ink-900 font-medium'
                  : 'border-ink-100 text-ink-600 hover:bg-ink-50'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {section && (
          <p className="mt-3 text-sm text-ink-400">
            {section.description} It has{' '}
            <span className="text-ink-900">
              {section.slots} frames, numbered 1 to {section.slots}
            </span>{' '}
            clockwise from the top. {filledCount} of {section.slots} are set;
            the rest show the photo built into the site.
          </p>
        )}
      </Card>

      {/* ---- 2. The numbered frame list ---- */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
              Frames
            </p>
            <p className="mt-1 text-sm text-ink-400">
              {selected
                ? `“${selected.fileName}” is selected below — press Use on any frame to put it there.`
                : 'Press Upload on a frame to replace just that photo.'}
            </p>
          </div>

          {/* Bulk fill: one pick, consecutive frames. */}
          <div className="flex items-end gap-2">
            <label className="text-xs text-ink-400">
              Start at frame
              <input
                type="number"
                min={FIRST_SLOT}
                max={slots.length || FIRST_SLOT}
                value={bulkStart}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (Number.isNaN(next)) return
                  setBulkStart(
                    Math.min(Math.max(next, FIRST_SLOT), slots.length || FIRST_SLOT)
                  )
                }}
                disabled={busy}
                className="mt-1 block w-20 rounded-xl border border-ink-100 px-3 py-2 text-sm text-ink-900 disabled:opacity-50"
              />
            </label>
            <input
              ref={bulkFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleBulkUpload}
              className="hidden"
            />
            <Button
              onClick={() => bulkFileRef.current?.click()}
              disabled={busy || slots.length === 0}
              loading={bulk !== null}
              icon={Images}
            >
              {bulk ? `Uploading ${bulk.done}/${bulk.total}…` : 'Upload many'}
            </Button>
          </div>
        </div>

        {/* Shared by every per-frame Upload button. */}
        <input
          ref={slotFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleSlotUpload}
          className="hidden"
        />

        {loading ? (
          <p className="mt-4 text-sm text-ink-400">Loading…</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {slots.map(({ slot, entry }) => (
              <SlotCard
                key={slot}
                slot={slot}
                entry={entry}
                busy={busySlot === slot || bulk !== null}
                disabled={busy}
                canUseSelected={Boolean(selectedAssetId)}
                onUpload={() => pickFileForSlot(slot)}
                onUseSelected={() => handleUseSelected(slot)}
                onClear={() => handleClearSlot(slot)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ---- 3. Library ---- */}
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
          Image library
        </p>
        <p className="mt-1 text-sm text-ink-400">
          Everything uploaded so far. Select one to reuse it in a frame above;
          the same photo can fill more than one frame.
        </p>

        {assets.length === 0 ? (
          <EmptyBlock
            icon={ImageOff}
            title="No images yet"
            hint="Upload into a frame above and it lands here too."
          />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {assets.map((asset) => {
              const isSelected = asset.id === selectedAssetId
              return (
                <div key={asset.id} className="group relative">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAssetId(isSelected ? null : asset.id)
                    }
                    className={classNames(
                      'block w-full overflow-hidden rounded-xl border-2 transition-all',
                      isSelected
                        ? 'border-brass-500 ring-2 ring-brass-300/40'
                        : 'border-transparent hover:border-brass-300/60'
                    )}
                  >
                    <img
                      src={asset.url}
                      alt={asset.fileName}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  </button>

                  {isSelected && (
                    <span className="pointer-events-none absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brass-500 text-white">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}

                  {usedAssetIds.has(asset.id) && (
                    <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-emerald px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Live
                    </span>
                  )}

                  <button
                    type="button"
                    aria-label={`Delete ${asset.fileName}`}
                    onClick={() => setConfirm({ asset })}
                    className="absolute bottom-2 right-2 rounded-lg bg-white/85 p-1.5 text-rose opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={handleDeleteAsset}
        title="Delete image?"
        description="This removes the image from the library and empties every frame it fills — those frames go back to the built-in photo. It can't be undone."
        confirmLabel="Delete"
      />
    </div>
  )
}

/** One numbered picture holder in a ring. */
function SlotCard({
  slot,
  entry,
  busy,
  disabled,
  canUseSelected,
  onUpload,
  onUseSelected,
  onClear,
}) {
  return (
    <div className="rounded-xl border border-ink-100 p-2">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs font-semibold text-ink-900">Frame {slot}</span>
        {entry ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald">
            Set
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-ink-400">
            Built-in
          </span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg bg-ink-50">
        {entry ? (
          <img
            src={entry.asset.url}
            alt={`Frame ${slot}: ${entry.asset.fileName}`}
            loading="lazy"
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 border border-dashed border-ink-100 text-ink-400">
            <ImagePlus size={18} />
            <span className="text-[10px]">Empty</span>
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brass-500 border-t-transparent" />
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUpload}
          disabled={disabled}
          className="flex-1 gap-1"
        >
          <Upload size={12} />
          Upload
        </Button>

        {canUseSelected && (
          <Button
            variant="brass"
            size="sm"
            onClick={onUseSelected}
            disabled={disabled}
            className="flex-1 gap-1"
          >
            <Check size={12} />
            Use
          </Button>
        )}

        {entry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={disabled}
            aria-label={`Clear frame ${slot}`}
            className="px-2"
          >
            <X size={12} />
          </Button>
        )}
      </div>
    </div>
  )
}

function EmptyBlock({ icon: Icon, title, hint }) {
  return (
    <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-ink-100 py-8 text-center">
      <Icon size={22} className="text-ink-400" />
      <p className="mt-2 text-sm font-medium text-ink-900">{title}</p>
      <p className="text-sm text-ink-400">{hint}</p>
    </div>
  )
}
