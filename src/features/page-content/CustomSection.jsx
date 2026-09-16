import { Link } from 'react-router-dom'

/**
 * Draws a section that was designed in the admin panel.
 *
 * One component renders every one of them. The design is data — a list of
 * blocks and a few settings for the band around them — so adding a section to
 * the website is a row in a table, not a file in this folder.
 *
 * The defaults below are doing the real work. A person building a section
 * should be able to add a heading and get something that looks like it belongs
 * on this site without answering a single question about typography, so every
 * setting falls back to the brand's own: Ringtte for display, Optika for body,
 * the deep emerald for headings, the muted teal for words. What they choose
 * overrides it; what they leave alone is already right.
 */

const WIDTHS = {
  narrow: '760px',
  normal: '1100px',
  wide: '1440px',
}

/** The band's own defaults, matching the site's other sections. */
const SECTION_DEFAULTS = {
  background: '#FFFFFF',
  paddingY: 90,
  width: 'normal',
  align: 'center',
}

const HEADING_SIZES = { 1: '3.4rem', 2: '2.6rem', 3: '1.75rem' }

/**
 * Turns a block's optional typography into an inline style.
 *
 * Size goes through `--pj-fs` rather than font-size for the reason typeStyle.js
 * explains: the size below it is responsive, and one flat font-size would
 * leave a heading that fits a laptop running off the side of a phone.
 */
function typographyOf(block, fallbackColor) {
  const style = {}

  if (block.font) style.fontFamily = `"${block.font}", sans-serif`
  if (block.size) style['--pj-fs'] = `${block.size}px`
  if (block.weight) style.fontWeight = block.weight
  if (block.spacing) style.letterSpacing = `${block.spacing}em`
  style.color = block.color || fallbackColor
  if (block.align) style.textAlign = block.align

  return style
}

function Block({ block }) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level ?? 2}`
      return (
        <Tag
          className="m-0 font-heading leading-[1.15]"
          style={{
            fontSize: HEADING_SIZES[block.level ?? 2],
            ...typographyOf(block, '#01383B'),
          }}
        >
          {block.text}
        </Tag>
      )
    }

    case 'text':
      // Newlines typed into the panel are the paragraph breaks the person
      // meant, so they are kept rather than collapsed into one run.
      return (
        <p
          className="m-0 max-w-[70ch] whitespace-pre-line font-ticker text-[1.05rem] leading-[1.7]"
          style={typographyOf(block, '#2F6B6B')}
        >
          {block.text}
        </p>
      )

    case 'image':
      return (
        <img
          src={block.url}
          alt={block.alt ?? ''}
          loading="lazy"
          className="block h-auto w-full object-cover"
          style={{
            maxWidth: { full: '100%', wide: '820px', half: '540px', third: '360px' }[
              block.width ?? 'wide'
            ],
            borderRadius: `${block.radius ?? 24}px`,
          }}
        />
      )

    case 'button': {
      const style = {
        background: block.background || 'linear-gradient(180deg, #01383B 0%, #286F6F 100%)',
        color: block.color || '#FFFFFF',
      }
      const className =
        'inline-flex items-center justify-center rounded-full px-[34px] py-[14px] font-ticker text-[0.95rem] font-medium no-underline transition-transform duration-300 hover:-translate-y-[2px]'

      // An address off this site is a real navigation; a path within it should
      // not throw away the app it is already running in.
      return block.href.startsWith('/') ? (
        <Link to={block.href} className={className} style={style}>
          {block.label}
        </Link>
      ) : (
        <a
          href={block.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          style={style}
        >
          {block.label}
        </a>
      )
    }

    case 'spacer':
      return <div aria-hidden style={{ height: `${block.height ?? 40}px` }} />

    case 'divider':
      return (
        <hr
          className="w-full max-w-[420px] border-0"
          style={{ height: '1px', background: block.color || '#C9A15A' }}
        />
      )

    default:
      // A block type this build does not know about. Rendering nothing is the
      // right answer: the section still appears, minus one piece, rather than
      // taking the page down over a field name.
      return null
  }
}

export default function CustomSection({ blocks = [], style = {} }) {
  const settings = { ...SECTION_DEFAULTS, ...style }

  const items = { left: 'flex-start', center: 'center', right: 'flex-end' }[settings.align]

  return (
    <section
      className="w-full px-[8%] max-[767px]:px-[6%]"
      style={{
        background: settings.background,
        paddingTop: `${settings.paddingY}px`,
        paddingBottom: `${settings.paddingY}px`,
      }}
    >
      <div
        className="mx-auto flex w-full flex-col gap-[22px]"
        style={{
          maxWidth: WIDTHS[settings.width] ?? WIDTHS.normal,
          alignItems: items,
          textAlign: settings.align,
        }}
      >
        {blocks.map((block) => (
          <Block key={block.id} block={block} />
        ))}
      </div>
    </section>
  )
}
