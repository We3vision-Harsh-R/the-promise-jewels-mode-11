/**
 * The Home page's non-text shades.
 *
 * These are the decorations: the hairline rules, the gold lozenge in the
 * divider, the scrim under a slide caption, the border of a social button,
 * the fill a card takes on hover. They are part of the drawing, not part of
 * the copy, so they are NOT offered in the Editor — an admin colouring a
 * heading should not have to think about the 1px rule beside it, and a rule
 * that drifted away from the section it sits in would read as a fault rather
 * than a choice.
 *
 * Text is the opposite: every editable string on this page now carries its
 * own colour, declared next to it in the Editor (see `tint` and `fade` in
 * server/src/modules/page-content/page-content.constants.ts) and applied by
 * the section's own component.
 *
 * Spread onto a section's root element so the arbitrary-value classes inside
 * it (`bg-[var(--pj-accent)]`, `border-[var(--pj-heading)]`, …) resolve. Each
 * section sets its own copy, so nothing here leaks across section boundaries
 * the way the old page-wide "Colours" section did.
 *
 * Two of the values below are NOT the shades the site originally shipped
 * with. The old page-wide "Colours" section had two saved overrides in the
 * client's database — body text #0B5B5D became #0E4238, and the gradient end
 * #286F6F became #3E9C86 — so those are what the live Home page has actually
 * been showing. Dropping that section without carrying the two values forward
 * would have quietly reverted the page to a design they had already moved
 * away from, so the overridden values are the defaults here and in the Editor.
 *
 * The two rows behind them are still in the page_content table. They are
 * ignored now (the service returns only fields the schema declares) and were
 * left in place rather than deleted.
 */
export const CHROME = {
  '--pj-heading': '#01383B',
  '--pj-heading-alt': '#3E9C86',
  '--pj-body': '#0E4238',
  '--pj-accent': '#C9A15A',
  '--pj-accent-deep': '#A87F3D',
  '--pj-muted': '#7C8F8C',
}
