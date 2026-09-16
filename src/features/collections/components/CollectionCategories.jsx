import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "@/lib/gsap.js";
import useReveal from "@/hooks/useReveal.js";
import SectionHeading from "@/components/common/SectionHeading.jsx";
import CategoryCard from "@/features/collections/components/CategoryCard.jsx";

// Fallback only. The tiles normally come from Admin > Collections via
// OurCollectionPage, which passes them in as `categories` — see
// usePublicCollections.js. These four stand in while that request is in
// flight, if it fails, or while no collection has been added yet, using the
// photography bundled in /public/images/collection.
//
// `addedAt` only drives the "Latest" sort; it never renders.
const CATEGORIES = [
  { id: "necklaces", name: "Necklaces", image: "/images/collection/image_357.png", addedAt: "2026-08-20" },
  { id: "rings", name: "Rings", image: "/images/collection/Lady_Rings.png", addedAt: "2026-08-18" },
  { id: "earrings", name: "Earrings", image: "/images/collection/Earrings.png", addedAt: "2026-08-16" },
  { id: "pendants", name: "Pendants", image: "/images/collection/Pendants.png", addedAt: "2026-08-12" },
];

const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "az", label: "Name (A–Z)" },
  { value: "za", label: "Name (Z–A)" },
];

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * "Collection Categories" browse section — search box + Sort By control +
 * a responsive grid of tiles, one per collection. The rows are fetched by the
 * page and handed down through `categories`; all filtering/sorting here is
 * local and derived, so there's no effect/fetch in this component to keep in
 * sync.
 *
 * The toolbar + grid are wrapped in the same `max-w-[1200px] mx-auto`
 * container InquiryForm uses below, so the 4-card row's left/right edges
 * line up with the inquiry form's edges on wide screens instead of the
 * grid stretching to the full `px-[8%]` section width.
 *
 * `previewBrand` (optional) — pass `{ label, images, key }` while a brand
 * tab above this section is hovered (see BrandTabs' `onHoverChange`) and
 * the grid swaps to that brand's own photos instead of the usual
 * categories. The search/sort toolbar stays visible throughout — it only
 * ever filters `categories`, so it's simply inert (not hidden) during a
 * preview. Pass `null`/`undefined` to go back to the normal grid.
 *
 * Clicking a tile calls `onSelect`:
 *   - normal category tile → onSelect(cat)          // cat.id used by caller
 *   - brand-preview photo  → onSelect(previewBrand)  // previewBrand.key used by caller
 *
 * Usage:
 *   <CollectionCategories id="collections" onSelect={(cat) => ...} />
 *   <CollectionCategories id="collections" previewBrand={hoveredBrand ? BRAND_GALLERIES[hoveredBrand] : null} onSelect={(sel) => ...} />
 */
export default function CollectionCategories({
  id,
  categories = CATEGORIES,
  onSelect,
  previewBrand,
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("latest");
  const [focused, setFocused] = useState(null);

  const sectionRef = useRef(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? categories.filter((c) => c.name.toLowerCase().includes(q))
      : categories;

    const sorted = [...filtered];
    if (sort === "az") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "za") sorted.sort((a, b) => b.name.localeCompare(a.name));
    else sorted.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)); // latest
    return sorted;
  }, [categories, query, sort]);

  const isPreviewing = Boolean(previewBrand?.images?.length);

  // Focus styling is applied inline rather than with `focus:` utilities.
  // Tailwind is not picking up classes that appear ONLY in this file — every
  // utility here that renders correctly also happens to be used elsewhere
  // (h-[50px] in Footer.jsx, border-[#DCEAE7] in OurPillars.jsx), while a
  // unique one like focus:border-[#C9A15A] never generates. Inline styles
  // sidestep that entirely; see the note in the handover about the scan.
  const fieldStyle = (key) => ({
    borderColor: focused === key ? "#C9A15A" : "#DCEAE7",
    boxShadow:
      focused === key ? "0 0 0 3px rgba(201, 161, 90, 0.22)" : "none",
    transition: "border-color 0.35s ease, box-shadow 0.35s ease",
  });

  // Site-wide reveal for the heading + toolbar. The card grid animates
  // separately below, because it also has to re-animate on search/sort.
  useReveal(sectionRef);

  // Re-runs whenever the visible set changes — searching, sorting or
  // hovering a brand tab. Without this the grid would swap its contents
  // instantly while everything around it animates, which is the single
  // thing that made this section feel unfinished.
  //
  // `key` on the tween target list is derived from what is actually shown,
  // so a no-op re-render (e.g. typing then deleting a character back to the
  // same result set) does not re-trigger it.
  const visibleKey = isPreviewing
    ? `preview:${previewBrand.label}`
    : visible.map((category) => category.id).join("|");

  useEffect(() => {
    const cards = sectionRef.current?.querySelectorAll(".js-cat-card");
    if (!cards?.length) return;

    gsap.fromTo(
      cards,
      { y: 34, opacity: 0, scale: 0.97 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.7,
        stagger: 0.07,
        ease: "power3.inOut",
        overwrite: "auto",
      }
    );
  }, [visibleKey]);

  return (
    <section
      ref={sectionRef}
      id={id}
      className="w-full bg-white px-[8%] pt-[20px] pb-[90px] max-[991px]:pt-[16px] max-[991px]:pb-[70px] max-[479px]:px-[6%] max-[479px]:pb-[55px]"
    >
      <div data-reveal className="text-center">
        <SectionHeading light="Collection" bold="Categories" className="text-center" />
      </div>

      {/* Aligns with InquiryForm's max-w-[1200px] container below so the
          toolbar and card grid share the same left/right edges as the form. */}
      <div className="mx-auto w-full max-w-[1200px]">
        {/* Toolbar: search (left) + sort (right) — stays visible even during
            a brand-hover preview; it just doesn't affect the preview photos
            below (only the normal category grid). */}
        <div data-reveal className="js-cat-toolbar mt-[36px] flex items-center justify-between gap-[20px] max-[639px]:flex-col max-[639px]:items-stretch">
            <label className="relative block w-full max-w-[560px] max-[639px]:max-w-none">
              <span className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-[#8a8a8a]">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search jewellery, collections, designs…"
                aria-label="Search categories"
                onFocus={() => setFocused("search")}
                onBlur={() => setFocused(null)}
                style={fieldStyle("search")}
                className="
                  w-full h-[50px] rounded-[14px] border-[1px] border-[#DCEAE7] bg-white
                  pl-[48px] pr-[20px] text-[0.95rem] text-[#0E4238] font-ticker
                  placeholder:text-[#9a9a9a]
                  focus:outline-none
                  transition-colors
                "
              />
            </label>

            <div className="flex items-center gap-[12px] shrink-0 max-[639px]:justify-between">
              <span className="text-[0.9rem] text-[#555] font-ticker whitespace-nowrap">Sort By:</span>
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sort categories"
                  onFocus={() => setFocused("sort")}
                  onBlur={() => setFocused(null)}
                  style={fieldStyle("sort")}
                  className="
                    appearance-none h-[50px] rounded-[14px] border-[1px] border-[#DCEAE7] bg-white
                    pl-[16px] pr-[36px] text-[0.9rem] text-[#0E4238] font-ticker cursor-pointer
                    focus:outline-none
                    transition-colors
                  "
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-[16px] top-1/2 -translate-y-1/2 text-[#0B5B5D]">
                  <ChevronDownIcon />
                </span>
              </div>
            </div>
          </div>
        {/* Grid — swaps to the hovered brand's own photos when previewing. */}
        {isPreviewing ? (
          <div
            key="brand-preview"
            className="mt-[40px] grid grid-cols-4 gap-[26px] max-[1199px]:grid-cols-3 max-[991px]:grid-cols-2 max-[991px]:gap-[20px] max-[479px]:gap-[14px]"
          >
            {previewBrand.images.map((image, i) => (
              <CategoryCard
                key={`${previewBrand.label}-${i}`}
                image={image}
                showLabel={false}
                onClick={() => onSelect?.(previewBrand)}
              />
            ))}
          </div>
        ) : visible.length > 0 ? (
          <div className="mt-[40px] grid grid-cols-4 gap-[26px] max-[1199px]:grid-cols-3 max-[991px]:grid-cols-2 max-[991px]:gap-[20px] max-[479px]:gap-[14px]">
            {visible.map((cat) => (
              <CategoryCard
                key={cat.id}
                name={cat.name}
                image={cat.image}
                onClick={() => onSelect?.(cat)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-[50px] text-center text-[1.1rem] text-[#777] font-ticker">
            No collections match "{query}".
          </p>
        )}
      </div>
    </section>
  );
}