/**
 * Turns the Editor's typography values for one piece of copy into what the
 * DOM needs: an inline style, plus a class when a size was set.
 *
 * Every value is optional and empty means "leave the design alone", which is
 * what every field starts as. So a section nobody has touched gets an empty
 * style object and no extra class, and renders exactly as it did before any of
 * this existed.
 *
 * Size is the one that cannot simply be written inline. The site's headings
 * carry their sizes as Tailwind classes that already hold three breakpoints —
 * 4rem on a desktop, 3.2rem on a tablet, 1.9rem on a phone — and one inline
 * font-size would flatten all three, leaving a heading that fits a desktop
 * overflowing a phone. So an admin size is passed as the `--pj-fs` custom
 * property; globals.css matches any element carrying it and steps it down at
 * the same breakpoints the design already used. The caller changes nothing
 * but the style object it was already building.
 *
 * Usage in a component:
 *
 *   <h2 className="text-[4rem]" style={{ ...typeStyle(text, 'titleBold') }}>
 *
 * The built-in class stays: it is what renders when no size is set, and the
 * `--pj-fs` rule outweighs it when one is.
 */
export function typeStyle(text, key) {
  const style = {}

  const font = text?.[`${key}Font`]
  const size = text?.[`${key}Size`]
  const weight = text?.[`${key}Weight`]
  const spacing = text?.[`${key}Spacing`]

  // Quoted because these are real family names with no fallback of their own,
  // and an unquoted multi-word name is not a valid CSS identifier.
  if (font) style.fontFamily = `"${font}", sans-serif`

  if (size) style['--pj-fs'] = `${size}px`

  if (weight) style.fontWeight = weight

  if (spacing) style.letterSpacing = `${spacing}em`

  return style
}

/**
 * The same thing for copy the design paints as a top-to-bottom gradient.
 *
 * Returns the background-image the text is clipped to, so a caller does not
 * have to remember the direction or that both stops are separate fields.
 */
export function gradientOf(text, key, fallbackFrom, fallbackTo) {
  const from = text?.[`${key}Color`] || fallbackFrom
  const to = text?.[`${key}ColorTo`] || fallbackTo || from
  return `linear-gradient(180deg, ${from} 0%, ${to} 100%)`
}
