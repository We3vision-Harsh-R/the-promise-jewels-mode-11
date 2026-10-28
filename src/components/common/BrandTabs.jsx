import { useEffect, useState } from "react";
import { classNames } from "@/utils/helpers.js";
import { trimMargin } from "@/utils/trimLogo.js";

/**
 * One tab's artwork. Brands coming from Admin > Brands carry whatever logo
 * was uploaded to Supabase — or none at all — so a tab falls back to setting
 * the brand's name instead of rendering a broken image. `onError` covers a
 * logoUrl that is saved but no longer resolves.
 */
function TabArtwork({ brand }) {
  const [failed, setFailed] = useState(false);
  // The trimmed copy, remembered with the logo it was made from so a changed
  // logo never shows a stale crop.
  const [trim, setTrim] = useState({ from: null, src: null });
  const shown = trim.from === brand.logo && trim.src ? trim.src : brand.logo;

  useEffect(() => {
    let live = true;
    if (brand.logo && !brand.logoClass) {
      trimMargin(brand.logo).then((src) => live && setTrim({ from: brand.logo, src }));
    }
    return () => {
      live = false;
    };
  }, [brand.logo, brand.logoClass]);

  if (!brand.logo || failed) {
    return (
      <span className="px-[6px] text-center font-ticker text-[1rem] font-medium leading-tight text-[#01383B] max-[991px]:text-[0.85rem] max-[479px]:text-[0.7rem]">
        {brand.name}
      </span>
    );
  }

  return (
    <img
      src={shown}
      alt={brand.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={classNames(
        "object-contain",
        brand.logoClass ??
          "h-[64px] w-auto max-w-[200px] max-[991px]:h-[52px] max-[991px]:max-w-[160px] max-[479px]:h-[38px] max-[479px]:max-w-[110px]"
      )}
    />
  );
}

/**
 * The three Promise Group sub-brands, shown as a row of selectable logo
 * "tabs" at the top of the collection page (matches the CLARICUTS /
 * Luxifine / Netram Jewels row in the design).
 *
 * Logos live in /public/images/brands. The `-logo-tab.webp` files here are
 * tightly-cropped versions of the brand's real logo (…-logo.webp, same
 * files the homepage OurBrands section uses) — the originals sit on a huge
 * mostly-blank square canvas, which is fine in OurBrands' large card but
 * shrinks to near-invisible text in this small 220×92 tab, so these crop
 * the dead space out instead of changing the source logo files.
 */
const DEFAULT_BRANDS = [
  {
    key: "claricuts",
    name: "CLARICUTS",
    logo: "/images/brands/claricuts-logo-tab.webp",
    // Wide wordmark — width is the binding constraint, so it naturally
    // fills the tab; a modest height cap is enough.
    logoClass: "h-[64px] w-auto max-w-[200px] max-[991px]:h-[52px] max-[991px]:max-w-[160px] max-[479px]:h-[38px] max-[479px]:max-w-[110px]",
  },
  {
    key: "luxifine",
    name: "Luxifine",
    logo: "/images/brands/luxifine-logo-tab.webp",
    logoClass: "h-[64px] w-auto max-w-[200px] max-[991px]:h-[52px] max-[991px]:max-w-[160px] max-[479px]:h-[38px] max-[479px]:max-w-[110px]",
  },
  {
    key: "netram",
    name: "Netram Jewels",
    logo: "/images/brands/netram-logo-tab.webp",
    // Near-square icon + wordmark stack — height is the binding constraint
    // here, so it needs a taller cap than the two wordmarks above to read
    // as the same visual weight/fill inside the tab.
    logoClass: "h-[84px] w-auto max-w-[200px] max-[991px]:h-[68px] max-[991px]:max-w-[160px] max-[479px]:h-[50px] max-[479px]:max-w-[110px]",
  },
];

/**
 * Reusable brand selector row.
 *
 * Controlled OR uncontrolled: pass `activeKey` + `onChange` to drive it from
 * a parent (e.g. to filter the collection grid by brand), or leave both off
 * and it manages its own highlighted tab internally.
 *
 * The lifted/shadowed "selected" look applies to a tab when it's EITHER
 * clicked (`active`) OR currently hovered/focused (`hoveredKey`) — either
 * one is enough, and only ever one tab shows it at a time. Tabs that are
 * neither stay a plain white card with a light border; there's no
 * permanent dimming on the rest.
 *
 * `onHoverChange(key | null)` fires as the pointer/focus enters and leaves a
 * tab — e.g. wire it up to swap a photo grid elsewhere on the page to that
 * brand's images while the tab is hovered (see CollectionCategories'
 * `previewBrand` prop, used together with this on OurCollectionPage).
 *
 * Usage:
 *   <BrandTabs />
 *   <BrandTabs activeKey={brand} onChange={setBrand} onHoverChange={setHoveredBrand} />
 */
export default function BrandTabs({
  brands = DEFAULT_BRANDS,
  activeKey,
  onChange,
  onHoverChange,
  className = "",
}) {
  // No brand is pre-selected — the lifted/shadowed look should only ever
  // reflect what's actually clicked or hovered, never a default.
  const [internalKey, setInternalKey] = useState(null);
  // activeKey (controlled) always wins; otherwise fall back to internal state.
  const active = activeKey ?? internalKey;

  // Purely local hover/focus tracking, separate from `active` — lets a tab
  // show the shadow while hovered without permanently "selecting" it.
  const [hoveredKey, setHoveredKey] = useState(null);

  const handleSelect = (key) => {
    if (activeKey === undefined) setInternalKey(key);
    onChange?.(key);
  };

  const handleHoverEnter = (key) => {
    setHoveredKey(key);
    onHoverChange?.(key);
  };

  const handleHoverLeave = () => {
    setHoveredKey(null);
    onHoverChange?.(null);
  };

  return (
    <section
      className={classNames(
        "w-full bg-white flex flex-wrap justify-center items-center",
        "gap-[24px] px-[8%] pt-[120px] pb-[50px]",
        "max-[991px]:gap-[18px] max-[991px]:pt-[80px] max-[991px]:pb-[40px]",
        "max-[479px]:gap-[12px] max-[479px]:pt-[50px] max-[479px]:pb-[32px]",
        className
      )}
    >
      {brands.map((brand) => {
        const isHighlighted = active === brand.key || hoveredKey === brand.key;
        return (
          <button
            key={brand.key}
            type="button"
            onClick={() => handleSelect(brand.key)}
            onMouseEnter={() => handleHoverEnter(brand.key)}
            onMouseLeave={handleHoverLeave}
            onFocus={() => handleHoverEnter(brand.key)}
            onBlur={handleHoverLeave}
            aria-pressed={active === brand.key}
            aria-label={brand.name}
            className={classNames(
              "flex items-center justify-center bg-white cursor-pointer",
              "rounded-[16px] border transition-all duration-300",
              "w-[270px] h-[116px] px-[30px]",
              "max-[991px]:w-[220px] max-[991px]:h-[96px] max-[991px]:px-[22px]",
              "max-[479px]:w-[150px] max-[479px]:h-[72px] max-[479px]:px-[14px] max-[479px]:rounded-[12px]",
              isHighlighted
                ? "-translate-y-[6px] border-[#0B5B5D] shadow-[0_10px_30px_-12px_rgba(11,91,93,0.55)]"
                : "border-[#E7E7E7]"
            )}
          >
            <TabArtwork brand={brand} />
          </button>
        );
      })}
    </section>
  );
}