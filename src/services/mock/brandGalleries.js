// Per-brand photo sets shown in the "Collection Categories" grid on
// /our-collection while a brand tab (CLARICUTS / Luxifine / Netram Jewels)
// is hovered — swap the file paths below for each brand's real product
// photography as soon as it's available. Assets currently sit in
// /public/images/jewellery, split four-per-brand as placeholders since the
// client folder only had one logo + one background shot per brand, no
// brand-tagged product galleries yet.
//
// `key` mirrors each entry's own object key (e.g. "claricuts") — added so
// CollectionCategories.jsx can pass the whole brand object along on a
// preview-photo click and CollectionDetailsPage.jsx can read `.key`
// directly, instead of every caller needing the object key separately.
const BRAND_GALLERIES = {
  claricuts: {
    key: "claricuts",
    label: "CLARICUTS",
    images: [
      "/images/jewellery/image_77.webp",
      "/images/jewellery/image_79.webp",
      "/images/jewellery/image_81.webp",
      "/images/jewellery/image_83.webp",
    ],
  },
  luxifine: {
    key: "luxifine",
    label: "Luxifine",
    images: [
      "/images/jewellery/image_86.webp",
      "/images/jewellery/image_89.webp",
      "/images/jewellery/image_91.webp",
      "/images/jewellery/image_93.webp",
    ],
  },
  netram: {
    key: "netram",
    label: "Netram Jewels",
    images: [
      "/images/jewellery/image_95.webp",
      "/images/jewellery/image_97.webp",
      "/images/jewellery/image_99.webp",
      "/images/jewellery/image_101.webp",
    ],
  },
};

export default BRAND_GALLERIES;