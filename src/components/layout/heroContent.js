// The fallback for every PageHeroCircle on the site.
//
// Five pages open with the same hero, and each keeps its OWN copy of the words
// in the Editor (Collections, Brands, Exhibitions, Contact and About are
// separate tabs) — but the shades and the ring of photographs start from the
// same place on all of them. Declaring that once here is what stops the five
// fallbacks from drifting apart from each other and from the defaults the
// server declares in page-content.constants.ts.
//
// A page spreads HERO_BASE into its own object and adds only its own copy:
//
//   const HERO = { ...HERO_BASE, eyebrow: "Contact Us", title: "…", … }
//
// HERO_RING is exported separately because a page also needs its LENGTH: the
// ring must keep its 18 frames however few of them have been replaced, so the
// array — never the saved values — decides how many frames there are.

export const HERO_RING = [
  "/images/jewellery/image_20_1.webp",
  "/images/jewellery/image_22.webp",
  "/images/jewellery/image_56.webp",
  "/images/jewellery/image_77.webp",
  "/images/jewellery/image_78.webp",
  "/images/jewellery/image_79.webp",
  "/images/jewellery/image_80.webp",
  "/images/jewellery/image_81.webp",
  "/images/jewellery/image_82.webp",
  "/images/jewellery/image_83.webp",
  "/images/jewellery/image_84.webp",
  "/images/jewellery/image_86.webp",
  "/images/jewellery/image_89.webp",
  "/images/jewellery/image_90.webp",
  "/images/jewellery/image_91.webp",
  "/images/jewellery/image_92.webp",
  "/images/jewellery/image_93.webp",
  "/images/jewellery/image_94.webp",
];

export const HERO_BASE = {
  eyebrowColorFrom: "#01383B",
  eyebrowColorTo: "#286F6F",
  titleColorFrom: "#01383B",
  titleColorTo: "#286F6F",
  subtitleColor: "#2F6B6B",
  ctaTextColor: "#FFFFFF",
  ...Object.fromEntries(HERO_RING.map((src, index) => [`ring.${index + 1}`, src])),
};

/**
 * The ring for one hero, frame by frame, from that hero's saved content.
 *
 * Callers wrap this in a useMemo keyed on the content object — the hook hands
 * back a stable identity while nothing has changed, so the ring is rebuilt
 * only when a frame actually differs.
 */
export function ringFrom(content) {
  return HERO_RING.map((_bundled, index) => content[`ring.${index + 1}`]);
}

/**
 * One list of pictures, with anything saved in the Editor laid over it.
 *
 * The bundled array — never the saved values — decides how many pictures there
 * are, exactly as with the hero ring above. That matters because these lists
 * have a fixed shape the layout depends on: eight tiles in the inner ring,
 * five cards across the collections strip. A saved value can replace a
 * picture; it cannot add a ninth tile or leave a gap where one should be.
 *
 *   const photos = imagesFrom(content, BUNDLED, "outer")
 *
 * reads `outer.1` … `outer.N` and falls back to BUNDLED[i] for any frame
 * nobody has replaced.
 */
export function imagesFrom(content, bundled, prefix = "img") {
  return bundled.map((fallback, index) => content[`${prefix}.${index + 1}`] || fallback);
}

/** The same list as editable `image` fields, for page-content.constants.ts. */
export function imageKeys(bundled, prefix = "img") {
  return bundled.map((src, index) => [`${prefix}.${index + 1}`, src]);
}

/**
 * The same overlay for a list of objects — a card with a name and a picture,
 * a pillar with a title and an icon. Only the named property is replaced, so
 * the words travelling with each item are untouched.
 */
export function withImagesFrom(content, bundled, prop, prefix = "img") {
  return bundled.map((item, index) => {
    const saved = content[`${prefix}.${index + 1}`];

    return saved ? { ...item, [prop]: saved } : item;
  });
}
