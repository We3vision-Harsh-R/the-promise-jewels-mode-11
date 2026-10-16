/**
 * The public site's standard two-tone section title: a light-weight first
 * half followed by a semibold second half, both filled with the brand teal
 * gradient — "Collection **Description**", "Necklace **Collection**", and
 * so on.
 *
 * Usage:
 *   <SectionHeading light="Collection" bold="Description" />
 *   <SectionHeading light="Let's Discuss" bold="Your Jewelry Requirements" />
 */

// -webkit-text-fill-color is required alongside text-transparent: Safari
// otherwise paints the solid text color and ignores the background clip.
export const GRADIENT_TEXT =
  "font-ticker bg-gradient-to-b from-[#01383B] to-[#286F6F] bg-clip-text " +
  "text-transparent [-webkit-text-fill-color:transparent]";

// Overridable via sizeClassName — a few sections (the homepage carousels)
// run larger than this.
const DEFAULT_SIZE = "text-[2.9rem] max-[991px]:text-[2.3rem] max-[479px]:text-[1.8rem]";

export default function SectionHeading({
  light,
  bold,
  as: Tag = "h2",
  className = "",
  sizeClassName = DEFAULT_SIZE,
  // Optional inline styles for the two halves — the Editor's font, size,
  // weight and spacing for each. Empty by default, so nothing changes.
  lightStyle,
  boldStyle,
}) {
  return (
    <Tag className={`m-0 font-light leading-[1.25] ${GRADIENT_TEXT} ${sizeClassName} ${className}`}>
      {lightStyle && Object.keys(lightStyle).length ? <span style={lightStyle}>{light}</span> : light}
      {bold ? (
        <>
          {light ? " " : null}
          <strong className={`font-semibold ${GRADIENT_TEXT}`} style={boldStyle}>{bold}</strong>
        </>
      ) : null}
    </Tag>
  );
}
