import { useState } from "react";

/**
 * A single collection tile.
 *
 * TWO LOOKS, CHOSEN FROM THE PICTURE ITSELF
 *
 * Collection pictures arrive in two kinds. A lifestyle photograph (a necklace
 * on a dark bust, a ring on velvet) fills the whole card and carries its own
 * background — that is the "photo" look: full bleed, a teal scrim under the
 * name, a gold hairline.
 *
 * A product shot on a white background looks wrong in that frame: it lands as a
 * bright white block inside a dark card. For those the card becomes a "studio"
 * mat — a warm ivory-to-champagne gradient with a soft spotlight — and the
 * picture is shown whole, centred, with its white blended away so the jewel
 * seems to sit on the mat itself. The name goes on the mat in deep teal.
 *
 * Which look applies is decided by measuring the picture's edge once it has
 * loaded: bright, near-white edges mean a studio shot. If the browser will not
 * let the page read the pixels (the picture's host sent no cross-origin
 * permission), the studio look is kept — it is the safe one, since it shows
 * every kind of picture whole.
 *
 * `showLabel` (default true) — set false to render just the picture, no name.
 * Used by the brand-hover preview grid, where tiles are plain product shots.
 *
 * Usage:
 *   <CategoryCard name="Necklace" image="/images/..." onClick={...} />
 *   <CategoryCard image="/images/..." showLabel={false} />
 */

/** Average brightness (0–1) of the outermost pixels of a loaded picture, or null if unreadable. */
function edgeBrightness(img) {
  try {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(img, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);

    let total = 0;
    let count = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        // The two outermost rows and columns only.
        if (x > 1 && x < size - 2 && y > 1 && y < size - 2) continue;
        const i = (y * size + x) * 4;
        // Transparent pixels count as white: they will sit on a light mat.
        const alpha = data[i + 3] / 255;
        const luminance = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        total += luminance * alpha + (1 - alpha);
        count += 1;
      }
    }
    return total / count;
  } catch {
    // A canvas that has held a cross-origin picture cannot be read back.
    return null;
  }
}

function isCrossOrigin(url) {
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

export default function CategoryCard({ name, image, onClick, showLabel = true }) {
  // A collection saved without a picture, or with an address that no longer
  // resolves, keeps the card's shape instead of drawing the browser's broken
  // image glyph.
  const [imageFailed, setImageFailed] = useState(false);
  // Ask the picture's host for permission to read its pixels, so the brightness
  // can be measured. Some hosts do not answer; the picture is then asked for
  // again without the request, and simply is not measured.
  const [withCors, setWithCors] = useState(() => Boolean(image) && isCrossOrigin(image));
  const [look, setLook] = useState("studio");
  const showImage = Boolean(image) && !imageFailed;
  const studio = look === "studio";

  const handleLoad = (event) => {
    const brightness = edgeBrightness(event.currentTarget);
    // Edges brighter than this are a white or near-white studio background.
    if (brightness !== null) setLook(brightness > 0.8 ? "studio" : "photo");
  };

  const handleError = () => {
    if (withCors) setWithCors(false);
    else setImageFailed(true);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name || "Jewellery photo"}
      className={`js-cat-card group relative block w-full cursor-pointer overflow-hidden rounded-[24px] [aspect-ratio:3/4] [transition:box-shadow_0.55s_ease,translate_0.55s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[6px] max-[479px]:rounded-[16px] ${
        studio
          ? "border-[1px] border-[#C9A15A]/45 bg-[linear-gradient(165deg,#FFFFFF_0%,#F8F4EA_52%,#EDE2C9_100%)] shadow-[0_18px_40px_-22px_rgba(1,56,59,0.38)] hover:shadow-[0_28px_54px_-22px_rgba(1,56,59,0.5)]"
          : "bg-[#01383B] shadow-[0_20px_44px_-20px_rgba(1,56,59,0.45)] hover:shadow-[0_30px_58px_-20px_rgba(1,56,59,0.55)]"
      }`}
    >
      {studio && (
        // The spotlight behind the jewel, and a faint floor under it.
        <>
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.35)_42%,transparent_72%)]" />
          <span className="pointer-events-none absolute inset-x-[16%] bottom-[24%] h-[5%] rounded-[50%] bg-[#01383B]/10 blur-[10px]" />
        </>
      )}

      {showImage && (
        <img
          src={image}
          alt={name || ""}
          loading="lazy"
          crossOrigin={withCors ? "anonymous" : undefined}
          onLoad={handleLoad}
          onError={handleError}
          className={
            studio
              ? `absolute left-[7%] top-[6%] w-[86%] ${showLabel ? "h-[70%]" : "h-[88%]"} object-contain mix-blend-multiply [transition:transform_0.9s_cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] max-[479px]:left-[5%] max-[479px]:w-[90%]`
              : "h-full w-full object-cover [transition:transform_0.9s_cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.07]"
          }
        />
      )}

      {/* Gold hairline inset — shown on every tile, including the brand-preview
          ones, so a preview still reads as the same card. */}
      <span
        className={`pointer-events-none absolute inset-[12px] rounded-[15px] border-[1px] max-[479px]:inset-[8px] max-[479px]:rounded-[10px] ${
          studio ? "border-[#C9A15A]/40" : "border-[#C9A15A]/35"
        }`}
      />

      {showLabel && (
        <>
          {/* Under the name: a teal scrim over a photograph, a soft ivory fade over the mat. */}
          <span
            className={`pointer-events-none absolute inset-x-0 bottom-0 ${
              studio
                ? "h-[34%] bg-gradient-to-t from-[#EDE2C9] via-[#F3EBD8]/85 to-transparent"
                : "h-[52%] bg-gradient-to-t from-[#01383B] via-[#01383B]/55 to-transparent"
            }`}
          />

          <span className="absolute inset-x-0 bottom-0 px-[22px] pb-[20px] text-left max-[991px]:px-[16px] max-[991px]:pb-[14px] max-[479px]:px-[12px] max-[479px]:pb-[10px]">
            <span className="mb-[9px] block h-px w-[24px] bg-[#C9A15A] max-[479px]:mb-[6px] max-[479px]:w-[16px]" />
            <span
              className={`block font-ticker text-[1.3rem] font-medium max-[991px]:text-[1.05rem] max-[479px]:text-[0.9rem] ${
                studio ? "text-[#01383B]" : "text-white"
              }`}
            >
              {name}
            </span>
          </span>
        </>
      )}
    </button>
  );
}
