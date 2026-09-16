import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import PageHeroCircle from "@/components/layout/PageHeroCircle.jsx";
import BrandTabs from "@/components/common/BrandTabs.jsx";
import CollectionCategories from "@/features/collections/components/CollectionCategories.jsx";
import InquiryForm from "@/features/inquiries/components/InquiryForm.jsx";
import Footer from "@/components/common/Footer.jsx";
import usePublicSettings from "@/features/settings/hooks/usePublicSettings.js";
import usePublicBrands from "@/features/brands/hooks/usePublicBrands.js";
import usePublicCollections from "@/features/collections/hooks/usePublicCollections.js";
import { useSeoMeta } from "@/features/seo/hooks/useSeoMeta.js";
import useSectionContent from '@/features/page-content/hooks/usePageContent.js'
import { HERO_BASE, ringFrom } from '@/components/layout/heroContent.js'
import PageSections from '@/features/page-content/PageSections.jsx'

// What this page opens with. The shades and the eighteen turning frames
// come from HERO_BASE so every hero on the site starts from the same place;
// only the words below belong to this page. All of it is editable from
// Admin > Editor > this page, and these values are the fallback.
const HERO = {
  ...HERO_BASE,
  eyebrow: "Our Collections",
  title: "Designed to Be Worn, Built to Be Sold",
  subtitle: "Every collection begins on a bench and ends in a display case. Browse the ranges we manufacture for retailers and wholesalers across India and beyond.",
  ctaLabel: "Browse Collections",
}

/**
 * Public "Our Collection" page (route: /our-collection).
 *
 * Both halves of this page now come from the admin panel rather than from
 * files bundled with the site:
 *   BrandTabs            → every active brand in Admin > Brands
 *   CollectionCategories → every active collection in Admin > Collections
 *
 * They stay connected through `brandId`, which is the same relation the admin
 * form sets when you pick a brand for a collection:
 *   - hovering a brand tab previews that brand's collections in the grid
 *   - clicking one filters the grid to that brand (click again to clear)
 *   - clicking a collection tile opens /our-collection/<its slug>
 *
 * Each hook falls back to the copy bundled with the site when its request
 * gives nothing back, so an API outage never blanks the page.
 */
export default function OurCollectionPage() {
  // Applies the "our-collection" SEO record to the document head if one
  // exists in /admin/seo; no-ops quietly otherwise (see useSeoMeta.js).
  useSeoMeta("our-collection");

  const navigate = useNavigate();
  const { social } = usePublicSettings();
  const { brands } = usePublicBrands();
  const { collections } = usePublicCollections();

  const [hoveredBrandId, setHoveredBrandId] = useState(null);
  const [activeBrandId, setActiveBrandId] = useState(null);

  // Tabs are keyed by brand id — the same id the collections carry — so the
  // filtering below is an id match and never a name comparison.
  const brandTabs = useMemo(
    () =>
      brands.map((brand) => ({
        key: brand.id,
        name: brand.name,
        logo: brand.logoUrl,
      })),
    [brands]
  );

  // Grid tiles. `id` is what CollectionCategories keys and sorts on, `slug` is
  // what the details route needs; `addedAt` drives its "Latest" sort.
  const tiles = useMemo(
    () =>
      collections
        .filter((c) => !activeBrandId || c.brandId === activeBrandId)
        .map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          image: c.coverUrl,
          addedAt: c.created_at,
        })),
    [collections, activeBrandId]
  );

  // While a tab is hovered the grid swaps to that brand's own photos. Built
  // from the same live collections rather than a bundled photo set, so a
  // brand added today previews with today's collections.
  const previewBrand = useMemo(() => {
    if (!hoveredBrandId) return null;
    const images = collections
      .filter((c) => c.brandId === hoveredBrandId)
      .map((c) => c.coverUrl)
      .filter(Boolean);
    if (!images.length) return null;
    return {
      key: hoveredBrandId,
      label: brands.find((b) => b.id === hoveredBrandId)?.name ?? "",
      images,
    };
  }, [hoveredBrandId, brands, collections]);

  const activeBrandName = brands.find((b) => b.id === activeBrandId)?.name;

  const hero = useSectionContent('collections', 'hero', HERO)

  const heroRing = useMemo(() => ringFrom(hero), [hero])

  // The page's bands, keyed as Admin > Content knows them. The order written
  // here is what the site ships with; the panel can rearrange it, hide any of
  // them, or slot a designed section in between — without a deploy.
  //
  // They are closures rather than components because three of them share this
  // page's filter state — which brand is selected, which is being hovered —
  // and a registry of bare components would have nowhere to put it.
  const sections = {
    hero: () => (
      <PageHeroCircle
        content={hero}
        eyebrow={hero.eyebrow}
        title={hero.title}
        subtitle={hero.subtitle}
        ctaText={hero.ctaLabel}
        outerImages={heroRing}
        logoUrl="/images/PROMISE_LOGO.webp"
        onCtaClick={() => navigate("/contact")}
        socialLinks={social}
        showTicker={false}/>
    ),
    tabs: () => (
      <>
        {/* No `brands` prop until they have loaded — BrandTabs then shows the
            bundled trio rather than an empty row mid-request. */}
        <BrandTabs
          {...(brandTabs.length ? { brands: brandTabs } : {})}
          activeKey={activeBrandId}
          // Clicking the brand already being filtered on clears the filter, so
          // the tabs work as a toggle and there is always a way back to all
          // collections without leaving the page.
          onChange={(key) => setActiveBrandId((current) => (current === key ? null : key))}
          onHoverChange={setHoveredBrandId}
        />

        {/* The way out of a filter belongs beside the control that set it, so
            hiding the tabs hides this too rather than stranding it. */}
        {activeBrandName && (
          <div className="w-full bg-white px-[8%] text-center max-[479px]:px-[6%]">
            <button
              type="button"
              onClick={() => setActiveBrandId(null)}
              className="font-ticker text-[0.9rem] text-[#0B5B5D] underline underline-offset-4 transition-colors hover:text-[#C9A15A]"
            >
              Showing {activeBrandName} only — show all collections
            </button>
          </div>
        )}
      </>
    ),
    listing: () => (
      <CollectionCategories
        id="collections"
        {...(tiles.length ? { categories: tiles } : {})}
        previewBrand={previewBrand}
        onSelect={(selection) => {
          // A grid tile carries a slug; a brand-preview photo carries `key`,
          // its brand id — clicking one filters rather than navigating, since
          // a brand is not a collection and has no details page of its own.
          if (selection.slug) navigate(`/our-collection/${selection.slug}`);
          else if (selection.key) setActiveBrandId(selection.key);
        }}
      />
    ),
    inquiry: () => <InquiryForm id="inquiry" />,
    cta: () => (
      <PageHeroCircle
        eyebrow="Explore Our Collections"
        title="Explore Collections"
        subtitle="Explore our premium jewellery collections and connect with us for manufacturing, wholesale, and business inquiries."
        ctaText="Get Started"
        onCtaClick={() => navigate("/contact")}
        showTicker={false}
      />
    ),
  };

  return (
    <>
      <PageSections page="collections" sections={sections} />
      <Footer />
    </>
  );
}
