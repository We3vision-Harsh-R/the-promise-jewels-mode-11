import { useState } from "react";

/**
 * A single collection tile: full-bleed photo with the category
 * name resting on a teal scrim at the bottom, inside a gold hairline —
 * the same card treatment as the Leaders / Gallery / Brands cards, so the
 * whole site reads as one system.
 *
 * `showLabel` (default true) — set false to render just the photo, no
 * name/scrim caption. Used by the brand-hover preview grid, where the
 * tiles are plain product shots rather than named categories.
 *
 * Usage:
 *   <CategoryCard name="Necklace" image="/images/..." onClick={...} />
 *   <CategoryCard image="/images/..." showLabel={false} />
 */
export default function CategoryCard({ name, image, onClick, showLabel = true }) {
  // A collection saved without a banner, thumbnail or gallery has no picture
  // to show, and one saved with a URL that no longer resolves in Supabase has
  // a broken one. Both keep the card's shape instead of drawing the browser's
  // broken-image glyph — the tile is already deep teal, so an empty one reads
  // as intentional.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(image) && !imageFailed;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name || "Jewellery photo"}
      className="js-cat-card group relative block w-full cursor-pointer overflow-hidden rounded-[24px] bg-[#01383B] [aspect-ratio:3/4] shadow-[0_20px_44px_-20px_rgba(1,56,59,0.45)] [transition:box-shadow_0.55s_ease,translate_0.55s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[6px] hover:shadow-[0_30px_58px_-20px_rgba(1,56,59,0.55)] max-[479px]:rounded-[16px]"
    >
      {showImage && (
        <img
          src={image}
          alt={name || ""}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover [transition:transform_0.9s_cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.07]"
        />
      )}

      {/* Gold hairline inset — shown on every tile, including the
          brand-preview ones, so a preview still reads as the same card. */}
      <span className="pointer-events-none absolute inset-[12px] rounded-[15px] border-[1px] border-[#C9A15A]/35 max-[479px]:inset-[8px] max-[479px]:rounded-[10px]" />

      {showLabel && (
        <>
          {/* Teal scrim keeps the label legible over any photo. */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[#01383B] via-[#01383B]/55 to-transparent" />

          <span className="absolute inset-x-0 bottom-0 px-[22px] pb-[20px] text-left max-[991px]:px-[16px] max-[991px]:pb-[14px] max-[479px]:px-[12px] max-[479px]:pb-[10px]">
            <span className="mb-[9px] block h-px w-[24px] bg-[#C9A15A] max-[479px]:mb-[6px] max-[479px]:w-[16px]" />
            <span className="block font-ticker text-[1.3rem] font-medium text-white max-[991px]:text-[1.05rem] max-[479px]:text-[0.9rem]">
              {name}
            </span>
          </span>
        </>
      )}
    </button>
  );
}
