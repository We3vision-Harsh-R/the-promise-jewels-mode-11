import { cloneElement, isValidElement } from 'react'
import { useGsapReveal } from '@/hooks/useGsapReveal.js'
import Card from '@/components/ui/Card.jsx'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import { Inbox } from 'lucide-react'

// Same frosted-glass tokens as every other Dashboard glass surface (see
// .glass / --glass-* in global.css and StatCard/DashboardPage's CARD_GLASS)
// so every list-page table reads as the same dark, translucent, blurred
// panel as the Dashboard's Recent inquiries card — not a flat opaque card.
const CARD_GLASS = {
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  boxShadow: 'var(--glass-shadow)',
}

// Every list page (Collections, Brands, Exhibitions, Inquiries, SEO) renders
// through this one component, so defaulting to the glass card here is what
// makes the frosted-glass theme apply everywhere at once. Pass dark={false}
// from a caller if a page ever needs the plain white table back.
export default function DataTable({ columns, rows, rowKey = 'id', loading, emptyProps, toolbar, dark = true }) {
  const ref = useGsapReveal([rows], { selector: 'tbody tr', stagger: 0.04, y: 8, duration: 0.35 })

  const toolbarWithTone = toolbar && isValidElement(toolbar) && toolbar.props.dark === undefined
    ? cloneElement(toolbar, { dark })
    : toolbar

  return (
    <Card
      glass={dark}
      className={dark ? 'overflow-hidden dark-surface' : 'overflow-hidden'}
      style={dark ? CARD_GLASS : undefined}
    >
      {/* p-5 sm:p-6 (not p-4 sm:p-5) so the search box's left edge lines
          up with the table's own 20px/24px column inset below it — see
          the .pj-table padding + first-child rules in index.css. */}
      {toolbar && <div className="p-5 sm:p-6 border-b border-ink-100">{toolbarWithTone}</div>}

      {loading ? (
        <div className="p-10 text-center text-sm text-ink-400">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing here yet" dark={dark} {...emptyProps} />
      ) : (
        // No toolbar (e.g. SeoPage) means the p-5 sm:p-6 wrapper above never
        // renders, so the table would otherwise sit flush against the card's
        // rounded top edge with only .pj-table's own (smaller) cell padding.
        // Match the toolbar wrapper's top spacing here in that case only —
        // pages that do have a toolbar are unaffected.
        <div className={`overflow-x-auto ${!toolbar ? 'pt-5 sm:pt-6' : ''}`} ref={ref}>
          <table className={dark ? 'pj-table pj-table--dark' : 'pj-table'}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={c.headClassName}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[rowKey]}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.className}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}