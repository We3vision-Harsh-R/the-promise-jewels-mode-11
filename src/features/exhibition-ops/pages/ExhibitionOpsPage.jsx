import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'

import * as opsService from '@/features/exhibition-ops/exhibition-ops.api.js'
import OpsTable from '@/features/exhibition-ops/OpsTable.jsx'
import { MODULES, BADGE_TONE, pretty } from '@/features/exhibition-ops/opsSpec.js'
import { rememberCurrentShow } from '@/features/exhibition-ops/currentShow.js'
import { useToast } from '@/components/feedback/Toast.jsx'
import { Can } from '@/features/rbac/usePermissions.jsx'
import Card from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'
import { Field, Input, Select, Textarea } from '@/components/forms/Field.jsx'
import { classNames } from '@/utils/helpers.js'

// Running one show.
//
// The Exhibitions screen next door is the marketing record — what the website
// prints. This is the operation: the stall, the money, the buyers, the gold.
// Different permission (`exhibitionOps`), different tables, and nothing here
// can reach the public API.

function Stat({ label, value, hint, tone }) {
  return (
    <div className="rounded-xl border border-ink-100 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p
        className={classNames(
          'mt-1 font-display text-xl tabular-nums',
          tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-rose' : 'text-ink-900',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>}
    </div>
  )
}

/** Groups a digit string without parsing it — see OpsTable for why. */
function amount(value) {
  if (value === null || value === undefined || value === '') return '—'
  const [whole, fraction] = String(value).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

export default function ExhibitionOpsPage() {
  const { id, tab: tabFromUrl } = useParams()
  const navigate = useNavigate()
  const { notify } = useToast()

  const [data, setData] = useState(null)
  const [options, setOptions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  // The open tab lives in the URL, not in state.
  //
  // These are sidebar destinations now, so each one has to be addressable:
  // /admin/exhibitions/<id>/ops/leads has to land on Leads. It also makes a
  // tab shareable, bookmarkable and survivable by the back button, none of
  // which a useState could do.
  const tab = tabFromUrl ?? 'overview'
  const setTab = (next) =>
    navigate(`/admin/exhibitions/${id}/ops/${next}`, { replace: true })

  const [header, setHeader] = useState(null)
  const [savingHeader, setSavingHeader] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const [full, opts] = await Promise.all([
          opsService.getOps(id),
          opsService.getOptions(),
        ])
        if (cancelled) return

        setData(full)
        setOptions(opts)
        setHeader({
          stage: full.ops.stage ?? 'PLANNED',
          hall: full.ops.hall ?? '',
          stallNumber: full.ops.stallNumber ?? '',
          stallSize: full.ops.stallSize ?? '',
          setupAt: full.ops.setupAt ? String(full.ops.setupAt).slice(0, 10) : '',
          teardownAt: full.ops.teardownAt ? String(full.ops.teardownAt).slice(0, 10) : '',
          organiserName: full.ops.organiserName ?? '',
          organiserPhone: full.ops.organiserPhone ?? '',
          organiserEmail: full.ops.organiserEmail ?? '',
          currency: full.ops.currency ?? 'INR',
          budget: full.ops.budget ?? '',
          notes: full.ops.notes ?? '',
        })
      } catch (err) {
        if (!cancelled) notify(err.message || 'Could not open this show.', { tone: 'error' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, notify, reloadToken])

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  // The sidebar has ten per-show links and no way to ask which show you
  // meant, so opening one here is what tells it. Written on every visit
  // rather than once, because the answer is "the last one you looked at".
  useEffect(() => {
    rememberCurrentShow(id)
  }, [id])

  async function saveHeader() {
    setSavingHeader(true)
    try {
      await opsService.saveHeader(id, header)
      notify('Saved.')
      reload()
    } catch (err) {
      notify(err.message || 'Could not save.', { tone: 'error' })
    } finally {
      setSavingHeader(false)
    }
  }

  /**
   * Every module's three actions, built once.
   *
   * They reload the whole show afterwards rather than patching the row into
   * local state. The report at the top is a function of all of this data — a
   * lead marked WON changes the pipeline figure, a counted stock line changes
   * the gold totals — so a local patch would leave the numbers above quietly
   * describing the previous state.
   */
  function actionsFor(kind) {
    return {
      onCreate: async (body) => {
        try {
          await opsService.createRow(id, kind, body)
          notify('Added.')
          reload()
        } catch (err) {
          notify(err.message || 'Could not add that.', { tone: 'error' })
          throw err
        }
      },
      onUpdate: async (rowId, body) => {
        try {
          await opsService.updateRow(id, kind, rowId, body)
          notify('Saved.')
          reload()
        } catch (err) {
          notify(err.message || 'Could not save that.', { tone: 'error' })
          throw err
        }
      },
      onDelete: async (rowId) => {
        try {
          await opsService.deleteRow(id, kind, rowId)
          notify('Removed.')
          reload()
        } catch (err) {
          notify(err.message || 'Could not remove that.', { tone: 'error' })
        }
      },
    }
  }

  if (loading || !data) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink-400">Loading…</p>
      </Card>
    )
  }

  const { show, report } = data

  // Leads are offered to the meetings form, so a booking can point at the
  // person already captured rather than becoming a second half-record.
  const formOptions = { ...options, leads: data.leads }

  const TABS = [{ slug: 'overview', label: 'Overview' }, ...MODULES]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/exhibitions"
            className="mb-1 inline-flex items-center gap-1.5 text-xs text-ink-400 transition-colors hover:text-brass-700"
          >
            <ArrowLeft size={13} />
            Back to Exhibitions
          </Link>
          <p className="max-w-2xl text-sm text-ink-400">
            Running <span className="text-ink-900">{show.title}</span> — the stall, the money, the
            buyers and the stock. None of this appears on the website.
          </p>
        </div>

        <span
          className={classNames(
            'rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide',
            BADGE_TONE[data.ops.stage] ?? 'bg-ink-100 text-ink-400',
          )}
        >
          {pretty(data.ops.stage)}
        </span>
      </div>

      {/* ---- Tabs ---- */}
      <Card className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((entry) => {
            const count = entry.slug === 'overview' ? null : (data[entry.kind] ?? []).length
            return (
              <button
                key={entry.slug}
                type="button"
                onClick={() => setTab(entry.slug)}
                className={classNames(
                  'rounded-xl border px-3.5 py-2 text-sm transition-colors',
                  tab === entry.slug
                    ? 'border-brass-500 bg-brass-500/10 font-medium text-ink-900'
                    : 'border-ink-100 text-ink-600 hover:bg-brass-500/[0.06] hover:text-brass-700',
                )}
              >
                {entry.label}
                {count !== null && count > 0 && (
                  <span className="ml-1.5 text-[10px] text-ink-400">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {tab === 'overview' ? (
        <>
          {/* ---- The report ---- */}
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
              Where this show stands
            </p>
            <p className="mt-1 text-xs text-ink-400">
              Worked out from the tabs, every time this page loads — never stored, so it cannot
              go stale between an edit and a refresh.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label={`Spent (${report.currency})`}
                value={amount(report.cost.actual)}
                hint={report.cost.budget ? `of ${amount(report.cost.budget)} budgeted` : 'no budget set'}
              />
              <Stat
                label="Left in budget"
                value={report.cost.remaining === null ? '—' : amount(report.cost.remaining)}
                tone={
                  report.cost.remaining === null
                    ? undefined
                    : String(report.cost.remaining).startsWith('-')
                      ? 'bad'
                      : 'good'
                }
                hint={`${amount(report.cost.unpaid)} still unpaid`}
              />
              <Stat
                label="Leads"
                value={report.leads.total}
                hint={report.leads.costPerLead ? `${amount(report.leads.costPerLead)} each` : 'nothing spent yet'}
              />
              <Stat
                label="Won"
                value={amount(report.leads.wonValue)}
                tone="good"
                hint={`of ${amount(report.leads.pipelineValue)} in play`}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Net weight out"
                value={amount(report.stock.netWeightOut)}
                hint={`${report.stock.piecesOut} pieces`}
              />
              <Stat
                label="Net weight back"
                value={amount(report.stock.netWeightBack)}
                hint={`${report.stock.piecesBack} pieces`}
              />
              <Stat
                label="Net weight sold"
                value={amount(report.stock.netWeightSold)}
                tone="good"
                hint={`${report.stock.piecesSold} pieces · ${amount(report.stock.valueSold)} value`}
              />
              <Stat
                label="Stock not counted"
                value={report.stock.linesUncounted}
                tone={report.stock.linesUncounted > 0 ? 'bad' : 'good'}
                hint={
                  report.stock.linesUncounted > 0
                    ? 'left out of the totals until counted'
                    : `all ${report.stock.linesTotal} lines counted`
                }
              />
            </div>
          </Card>

          {/* ---- The stall ---- */}
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">
                  The stall
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  Setup and teardown are not the show dates — the stall is built the day before
                  and stripped the night after, and travel is booked around those.
                </p>
              </div>

              <Can resource="exhibitionOps" action="edit">
                <Button onClick={saveHeader} loading={savingHeader} icon={Save}>
                  {savingHeader ? 'Saving…' : 'Save'}
                </Button>
              </Can>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Stage">
                <Select
                  value={header.stage}
                  onChange={(e) => setHeader((h) => ({ ...h, stage: e.target.value }))}
                >
                  {(options?.stages ?? []).map((s) => (
                    <option key={s} value={s}>
                      {pretty(s)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Hall">
                <Input
                  value={header.hall}
                  onChange={(e) => setHeader((h) => ({ ...h, hall: e.target.value }))}
                />
              </Field>

              <Field label="Stall number">
                <Input
                  value={header.stallNumber}
                  onChange={(e) => setHeader((h) => ({ ...h, stallNumber: e.target.value }))}
                />
              </Field>

              <Field label="Stall size">
                <Input
                  value={header.stallSize}
                  onChange={(e) => setHeader((h) => ({ ...h, stallSize: e.target.value }))}
                />
              </Field>

              <Field label="Setup day">
                <Input
                  type="date"
                  value={header.setupAt}
                  onChange={(e) => setHeader((h) => ({ ...h, setupAt: e.target.value }))}
                />
              </Field>

              <Field label="Teardown day">
                <Input
                  type="date"
                  value={header.teardownAt}
                  onChange={(e) => setHeader((h) => ({ ...h, teardownAt: e.target.value }))}
                />
              </Field>

              <Field label="Currency" hint="Three letters — INR, USD, AED.">
                <Input
                  value={header.currency}
                  maxLength={3}
                  onChange={(e) => setHeader((h) => ({ ...h, currency: e.target.value.toUpperCase() }))}
                />
              </Field>

              <Field label="Budget">
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={header.budget}
                  onChange={(e) => setHeader((h) => ({ ...h, budget: e.target.value }))}
                />
              </Field>

              <Field label="Organiser">
                <Input
                  value={header.organiserName}
                  onChange={(e) => setHeader((h) => ({ ...h, organiserName: e.target.value }))}
                />
              </Field>

              <Field label="Organiser phone">
                <Input
                  value={header.organiserPhone}
                  onChange={(e) => setHeader((h) => ({ ...h, organiserPhone: e.target.value }))}
                />
              </Field>

              <Field label="Organiser email">
                <Input
                  value={header.organiserEmail}
                  onChange={(e) => setHeader((h) => ({ ...h, organiserEmail: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Notes">
              <Textarea
                rows={3}
                value={header.notes}
                onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))}
              />
            </Field>
          </Card>
        </>
      ) : (
        (() => {
          const module = MODULES.find((m) => m.slug === tab)

          // An address somebody typed, or a tab removed since they
          // bookmarked it. Better than a blank screen.
          if (!module) {
            return (
              <Card className="p-5">
                <p className="text-sm text-ink-900">There is no “{tab}” here.</p>
                <p className="mt-1 text-sm text-ink-400">
                  Pick one of the tabs above.
                </p>
              </Card>
            )
          }

          return (
            <OpsTable
              module={module}
              rows={data[module.kind] ?? []}
              options={formOptions}
              {...actionsFor(module.kind)}
            />
          )
        })()
      )}
    </div>
  )
}
