/**
 * The brand's three social glyphs plus the circular icon row that wraps
 * them. Extracted out of Footer.jsx so the footer and PageHeroCircle's
 * optional social row share one copy of each SVG path and one set of
 * spacing rules, instead of duplicating both.
 */

export function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M13.5 21v-6.5h2.2l.3-2.6h-2.5V10.2c0-.75.2-1.26 1.28-1.26h1.37V6.6c-.24-.03-1.05-.1-2-.1-1.98 0-3.33 1.2-3.33 3.42v1.98H8.5v2.6h2.27V21" />
    </svg>
  );
}

export function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="7.5" y1="10" x2="7.5" y2="17" />
      <circle cx="7.5" cy="7" r="0.5" fill="currentColor" />
      <path d="M11.5 17v-4.2c0-1.5 1-2.3 2.2-2.3 1.2 0 2 .8 2 2.3V17" />
      <line x1="11.5" y1="10" x2="11.5" y2="17" />
    </svg>
  );
}

// Only ONE variant ever applies to a given link, so there's no Tailwind
// class-conflict risk between the two sets of background/border utilities.
const VARIANTS = {
  // Footer treatment: hairline teal ring on the white page background.
  outline: "border border-[#0B5B5D] text-[#0B5B5D]",
  // Hero treatment: filled teal pill with a white glyph.
  solid: "border-0 text-white bg-gradient-to-b from-[#01383B] to-[#286F6F]",
};

const ITEMS = [
  { key: "instagram", label: "Instagram", Icon: InstagramIcon },
  { key: "facebook", label: "Facebook", Icon: FacebookIcon },
  { key: "linkedin", label: "LinkedIn", Icon: LinkedInIcon },
];

/**
 * Row of circular social links. Size and spacing come from the caller
 * (itemClassName / className) so the footer and hero can differ without
 * this component needing to know about either.
 *
 * Usage:
 *   <SocialLinks links={social} variant="solid" className="gap-[14px]"
 *                itemClassName="w-[36px] h-[36px]" />
 */
export function SocialLinks({ links, variant = "outline", className = "", itemClassName = "" }) {
  const shown = ITEMS.filter((item) => links?.[item.key]);
  if (shown.length === 0) return null;

  return (
    <div className={`flex ${className}`}>
      {shown.map(({ key, label, Icon }) => (
        <a
          key={key}
          href={links[key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className={`flex items-center justify-center rounded-full no-underline ${VARIANTS[variant]} ${itemClassName}`}
        >
          <Icon />
        </a>
      ))}
    </div>
  );
}

export default SocialLinks;
