import HeroCircle from "@/pages/Home/components/Herocircle.jsx";
import BrandsSection from "@/pages/Home/components/BrandsSection.jsx";
import FeaturedCollections from "@/pages/Home/components/FeaturedCollections.jsx";
import OurPillars from "@/pages/Home/components/OurPillars.jsx";
import OurBrands from "@/pages/Home/components/OurBrands.jsx";
import Exhibition from "@/pages/Home/components/Exhibition.jsx";
import GrowthSection from "@/pages/Home/components/GrowthSection.jsx";
import Footer from "@/components/common/Footer.jsx";
import PageSections from "@/features/page-content/PageSections.jsx";
import { useSeoMeta } from "@/features/seo/hooks/useSeoMeta.js";

/**
 * The home page's sections, keyed as the Editor knows them.
 *
 * This object replaces the list of JSX tags that used to sit in the markup
 * below. The keys must match page-content.constants.ts, because that is what
 * Admin > Content > Home lists and reorders; the order written here is the
 * order the site ships with, used until the panel has saved an arrangement
 * and kept if that request ever fails.
 *
 * The footer is not in here. It closes every page and is not part of any
 * page's arrangement — moving it above the hero is not an arrangement anyone
 * wants, and it has its own screen in the panel.
 */
const SECTIONS = {
  hero: () => <HeroCircle />,
  welcome: () => <BrandsSection />,
  collections: () => <FeaturedCollections />,
  pillars: () => <OurPillars />,
  brands: () => <OurBrands />,
  exhibition: () => <Exhibition />,
  growth: () => <GrowthSection />,
};

/**
 * Colour used to live here.
 *
 * This page carried one "Colours" section that set six CSS variables on the
 * wrapper below, and every section downstream read them. It was the only
 * colour control on the page that did anything — and it was all-or-nothing.
 * Every heading shared one teal, so making the Welcome heading differ from
 * the Pillars heading was not possible. Several sections declared colour
 * fields of their own to get around that, but no component ever read them:
 * the page-wide value won by default, and the admin panel offered settings
 * that changed nothing.
 *
 * Each section now owns its own shades, declared in the Editor beside the
 * words they tint (see `tint`/`fade` in page-content.constants.ts) and
 * applied by the section's own component. Nothing here overrides them.
 */
export default function Home() {
  // Applies the "home" SeoPage's title/description/canonical/OG/Twitter/
  // schema (as configured in /admin/seo) to the document head. No-ops
  // quietly if that SEO record doesn't exist yet — see useSeoMeta.js.
  useSeoMeta("home");

  return (
    <div>
      <PageSections page="home" sections={SECTIONS} />
      <Footer />
    </div>
  );
}
