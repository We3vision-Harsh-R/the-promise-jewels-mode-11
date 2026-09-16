import { useNavigate, useParams } from "react-router-dom";
import PageHeroCircle from "@/components/layout/PageHeroCircle.jsx";
import SectionHeading from "@/components/common/SectionHeading.jsx";
import CategoryCard from "@/features/collections/components/CategoryCard.jsx";
import InquiryForm from "@/features/inquiries/components/InquiryForm.jsx";
import Footer from "@/components/common/Footer.jsx";
import usePublicSettings from "@/features/settings/hooks/usePublicSettings.js";
import { usePublicCollection } from "@/features/collections/hooks/usePublicCollections.js";
import { useSeoMeta } from "@/features/seo/hooks/useSeoMeta.js";
import BRAND_GALLERIES from "@/services/mock/brandGalleries.js";

/**
 * Per-category content for the details page, used when the URL slug is a
 * category id (necklaces / rings / earrings / pendants) rather than a
 * brand key — see the brand-vs-category resolution below.
 *
 * NOTE: the client's asset folder has no photography shot specifically for
 * these detail galleries (or, for rings, no dedicated ring photography at
 * all — see the same note in CollectionCategories.jsx). Each list below
 * reuses the closest existing product photos as placeholders; swap for the
 * real per-category shots referenced in the Figma as soon as they exist.
 */
const CATEGORY_DETAILS = {
  necklaces: {
    title: "Necklace",
    images: [
      "/images/collection/image_310.png",
      "/images/collection/image_292.png",
      "/images/collection/image_293.png",
      "/images/collection/image_294.png",
      "/images/collection/image_295.png",
      "/images/collection/image_297.png",
      "/images/collection/image_298.png",
      "/images/collection/image_366.png",
    ],
  },
  rings: {
    title: "Ring",
    // No dedicated ring product photography in assets — reusing the
    // closest available shots (see CollectionCategories.jsx's ring note).
    images: [
      "/images/Featured-collection/image_70.webp",
      "/images/Featured-collection/image_71.webp",
      "/images/jewellery/image_20_1.webp",
      "/images/jewellery/image_22.webp",
      "/images/jewellery/image_56.webp",
      "/images/jewellery/image_77.webp",
      "/images/jewellery/image_78.webp",
      "/images/jewellery/image_79.webp",
    ],
  },
  earrings: {
    title: "Earring",
    images: [
      "/images/jewellery/image_82.webp",
      "/images/jewellery/image_83.webp",
      "/images/jewellery/image_80.webp",
      "/images/jewellery/image_81.webp",
      "/images/jewellery/image_77.webp",
      "/images/jewellery/image_78.webp",
      "/images/jewellery/image_79.webp",
      "/images/jewellery/image_56.webp",
    ],
  },
  pendants: {
    title: "Pendant",
    images: [
      "/images/jewellery/image_89.webp",
      "/images/jewellery/image_90.webp",
      "/images/jewellery/image_91.webp",
      "/images/jewellery/image_92.webp",
      "/images/jewellery/image_93.webp",
      "/images/jewellery/image_94.webp",
      "/images/jewellery/image_86.webp",
      "/images/jewellery/image_84.webp",
    ],
  },
};

// Same 18-image ring used on the "Our Collection" hero — kept identical so
// the rotating circle looks continuous with the page the user arrived from.
const HERO_RING_IMAGES = [
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

/* ---- Feature-card icons (Collection Description section) ----
   Sized up from the original 30px to sit comfortably inside the larger
   ~100px icon circle used below (Figma's cards read much bigger/airier
   than a 30px glyph in a small circle would support). */
function DiamondIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20M9 3l3 6-3 12M15 3l-3 6 3 12" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
      <path d="M5 15l.7 1.6L7.3 17l-1.6.7L5 19.3l-.7-1.6L2.7 17l1.6-.7z" />
    </svg>
  );
}

// Generic — not tied to a category or brand, matches the two cards in the
// Figma exactly. Shown when the slug is a legacy category/brand one; a real
// collection replaces this section with its own description and
// specifications, which is what the admin panel writes.
const FEATURE_CARDS = [
  {
    Icon: DiamondIcon,
    title: "Premium Craftsmanship",
    description: "Expertly crafted by skilled artisans with precision and attention to every detail.",
  },
  {
    Icon: SparkleIcon,
    title: "Timeless Designs",
    description: "Contemporary and classic designs that complement every jewellery collection.",
  },
];

/**
 * Public "Collection Details" page (route: /our-collection/:categoryId).
 *
 * Reached by clicking a tile on the "Our Collection" page's grid. The slug is
 * resolved in three steps, in this order:
 *
 *   1. A real collection from Admin > Collections (GET /collections/:slug).
 *      This is the normal case: its name, description, specifications, brand,
 *      banner and gallery are what render, so everything on this page is
 *      edited in the admin panel and nowhere else.
 *   2. A brand key from BRAND_GALLERIES (claricuts / luxifine / netram).
 *   3. A legacy category id (necklaces / rings / earrings / pendants),
 *      falling back to necklaces.
 *
 * Steps 2 and 3 keep every link that existed before the collections were
 * wired up working, and mean a bad link still renders a page rather than a
 * blank one.
 */
export default function CollectionDetailsPage() {
  const { categoryId: slug } = useParams();
  const navigate = useNavigate();
  const { social } = usePublicSettings();
  const { collection, loading } = usePublicCollection(slug);

  const brand = !collection ? BRAND_GALLERIES[slug] : null;
  const category =
    !collection && !brand ? CATEGORY_DETAILS[slug] || CATEGORY_DETAILS.necklaces : null;

  // Everything the page needs, resolved once from whichever matched above.
  const eyebrow = collection ? collection.brandName || "Collection" : brand ? brand.label : "Collection";
  const headingLight = collection ? collection.name : brand ? brand.label : category.title;

  // A collection's own pictures: its gallery, led by the banner so the tile
  // you clicked is the first thing on the page.
  const collectionImages = collection
    ? [collection.bannerUrl, ...collection.gallery.map((img) => img.image_url)].filter(
        (url, index, all) => url && all.indexOf(url) === index
      )
    : null;

  const galleryImages = collectionImages ?? (brand ? brand.images : category.images);
  const gallerySlugPrefix = collection ? collection.slug : brand ? brand.key : slug || "necklaces";

  useSeoMeta(`our-collection-${slug || "necklaces"}`);

  // The request is still out and the slug may yet turn out to be a real
  // collection. Rendering the category fallback first would flash the wrong
  // name and gallery for a moment before swapping.
  if (loading) return null;

  return (
    <>
      <PageHeroCircle
        eyebrow={eyebrow}
        logoUrl="/images/PROMISE_LOGO.webp"
        subtitle="We combine strategy, creativity, and AI-driven insights to help ambitious brands grow smarter and faster."
        ctaText="Get in touch"
        onCtaClick={() => navigate("/contact")}
        // Second, quieter action: this page is one brand's gallery, so the
        // obvious next step is back out to every collection.
        secondaryCtaText="View Collection"
        onSecondaryCtaClick={() => navigate("/our-collection")}
        socialLinks={social}
        outerImages={HERO_RING_IMAGES}
        showTicker={false}
      />

      {/* Collection Description */}
      <section className="w-full bg-white px-[8%] pt-[10px] pb-[70px] max-[991px]:pb-[50px] max-[479px]:px-[6%]">
        <div className="text-center">
          <SectionHeading light="Collection" bold="Description" className="text-center" />
        </div>

        {/* A real collection says what it is in its own words — the
            Description and Specifications typed into Admin > Collections.
            The two generic Figma cards below only stand in for the legacy
            category and brand slugs, which have no such copy. */}
        {collection ? (
          <div className="mt-[45px] mx-auto w-full max-w-[1200px]">
            <div className="rounded-[20px] border border-[#0B5B5D]/20 bg-white p-[34px] max-[991px]:p-[28px] max-[479px]:p-[20px]">
              {collection.category && (
                <span className="mb-[14px] inline-block rounded-full border border-[#C9A15A]/50 px-[14px] py-[5px] font-ticker text-[0.78rem] uppercase tracking-wider text-[#C9922E]">
                  {collection.category}
                </span>
              )}

              <p className="m-0 whitespace-pre-line text-[1rem] leading-[1.75] text-[#0B5B5D]/80 max-[479px]:text-[0.9rem]">
                {collection.description}
              </p>

              {collection.specification && (
                <>
                  <span className="mt-[24px] mb-[14px] block h-px w-[54px] bg-gradient-to-r from-[#C9A15A] to-[#C9A15A]/0" />
                  <p className="m-0 font-ticker text-[1.05rem] font-semibold text-[#0B5B5D]">
                    Specifications
                  </p>
                  <p className="mt-[8px] whitespace-pre-line text-[0.95rem] leading-[1.7] text-[#666] max-[479px]:text-[0.85rem]">
                    {collection.specification}
                  </p>
                </>
              )}

              {(collection.ctaTitle || collection.ctaButtonText) && (
                <div className="mt-[26px]">
                  {collection.ctaTitle && (
                    <p className="m-0 mb-[10px] font-ticker text-[1.05rem] text-[#01383B]">
                      {collection.ctaTitle}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/contact")}
                    className="inline-flex items-center gap-[8px] rounded-full border border-[#C9A15A] px-[22px] py-[10px] font-ticker text-[0.88rem] font-medium text-[#01383B] transition-colors duration-300 hover:bg-[#C9A15A] hover:text-white"
                  >
                    {collection.ctaButtonText || "Enquire now"}
                    <span aria-hidden="true">&#8594;</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
        /*
          Figma reference: 750×400 cards (roughly a 1.875:1 width:height
          ratio) — noticeably taller/airier than a compact strip. Matched
          here with a min-h floor + generous padding rather than a fixed
          height, so the card still grows for wrapped description text
          instead of clipping/overflowing.
        */
        <div className="mt-[45px] mx-auto grid w-full max-w-[1200px] grid-cols-2 gap-[26px] max-[767px]:grid-cols-1">
          {FEATURE_CARDS.map(({ Icon, title, description }) => (
            <div
              key={title}
              className="
                flex items-center gap-[24px] rounded-[20px] border border-[#0B5B5D]/20 bg-white
                p-[34px] min-h-[220px]
                max-[991px]:p-[28px] max-[991px]:min-h-[190px]
                max-[479px]:p-[20px] max-[479px]:min-h-0 max-[479px]:gap-[16px]
              "
            >
              <span className="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-full border border-[#E4E4E4] text-[#C9922E] max-[991px]:h-[68px] max-[991px]:w-[68px] max-[479px]:h-[56px] max-[479px]:w-[56px]">
                <Icon />
              </span>
              <span className="h-[64px] w-px shrink-0 bg-[#E4E4E4] max-[479px]:hidden" />
              <span className="text-left">
                <span className="block font-ticker text-[1.25rem] font-semibold leading-[1.3] text-[#0B5B5D] max-[991px]:text-[1.15rem] max-[479px]:text-[1.05rem]">
                  {title}
                </span>
                <span className="mt-[8px] block text-[0.95rem] leading-[1.55] text-[#666] font-ticker max-[991px]:text-[0.9rem] max-[479px]:text-[0.85rem]">
                  {description}
                </span>
              </span>
            </div>
          ))}
        </div>
        )}
      </section>

      {/* "{Collection, Category or Brand} Collection" — plain photo grid */}
      <section className="w-full bg-white px-[8%] pt-[10px] pb-[90px] max-[991px]:pb-[70px] max-[479px]:px-[6%]">
        <div className="text-center">
          <SectionHeading light={headingLight} bold="Collection" className="text-center" />
        </div>

        <div className="mt-[40px] mx-auto grid w-full max-w-[1200px] grid-cols-4 gap-[26px] max-[1199px]:grid-cols-3 max-[767px]:grid-cols-2 max-[991px]:gap-[20px] max-[479px]:gap-[14px]">
          {galleryImages.map((image, i) => (
            <CategoryCard key={`${gallerySlugPrefix}-${i}`} image={image} showLabel={false} />
          ))}
        </div>
      </section>

      <InquiryForm id="inquiry" />

      <PageHeroCircle
        eyebrow="Explore Our Collections"
        title="Explore Collections"
        subtitle="Explore our premium jewellery collections and connect with us for manufacturing, wholesale, and business inquiries."
        ctaText="Get Started"
        onCtaClick={() => navigate("/contact")}
        showTicker={false}
      />

      <Footer />
    </>
  );
}