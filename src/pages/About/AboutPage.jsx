import Footer from "@/components/common/Footer.jsx";
import { settleToSection } from "@/utils/scroll.js";
import PageHeroCircle from "@/components/layout/PageHeroCircle.jsx";
import Ours from "@/pages/About/components/Ours.jsx";
import GrowthSection from "@/pages/Home/components/GrowthSection.jsx";
import Gallery from "@/pages/About/components/Gallery.jsx";
import OurLeaders from "@/pages/About/components/OurLeaders.jsx";
import PageSections from "@/features/page-content/PageSections.jsx";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";

// The copy and colours bundled with the page. Everything here is editable
// from Admin > Editor > About page, and whatever is saved there wins at
// runtime — this object is the fallback for an empty database, an untouched
// field or a failed request, and it doubles as the list of keys read.
const HERO = {
  eyebrow: "About Us",
  eyebrowColor: "#01383B",
  eyebrowColorTo: "#286F6F",
  title: "Crafting Trust, One Piece at a Time",
  titleColor: "#01383B",
  titleColorTo: "#286F6F",
  subtitle:
    "Promise Jewels has spent over two decades turning gold and precision into pieces that businesses and families trust. From our first workshop to a name recognized across the industry, our story is one of craftsmanship, integrity, and an unwavering promise to deliver quality that speaks for itself.",
  subtitleColor: "#2F6B6B",
  ctaLabel: "Explore Our Story",
  ctaLabelColor: "#FFFFFF",
};

function AboutHero() {
  const hero = useSectionContent("about", "hero", HERO);

  return (
    <PageHeroCircle
      content={hero}
      eyebrow={hero.eyebrow}
      title={hero.title}
      subtitle={hero.subtitle}
      ctaText={hero.ctaLabel}
      // Was a dead button — the hero rendered a CTA with no handler at all.
      onCtaClick={() => settleToSection("story")}/>
  );
}

/**
 * The About page's sections, keyed as the Editor knows them.
 *
 * Keys match page-content.constants.ts. The order here is what the site
 * ships with; Admin > Content > About page can rearrange it, and hide any of
 * these, without a deploy. Each entry takes no props, so anything a section
 * needs is wrapped just above rather than threaded through the renderer.
 */
const SECTIONS = {
  hero: () => <AboutHero />,
  values: () => <Ours />,
  leaders: () => <OurLeaders />,
  gallery: () => <Gallery />,
  growth: () => <GrowthSection page="about" />,
};

export default function AboutUsPage() {
  // Applies the "our-brand" SeoPage's title/description/canonical/OG/
  // Twitter/schema (as configured in /admin/seo) to the document head.
  // No-ops quietly if that SEO record doesn't exist yet — see useSeoMeta.js.

  return (
    <>
      <PageSections page="about" sections={SECTIONS} />
      <Footer />
    </>
  );
}
