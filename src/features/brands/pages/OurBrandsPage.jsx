import { useMemo } from 'react'
import Footer from "@/components/common/Footer.jsx";
import { useNavigate } from "react-router-dom";
import PageHeroCircle from "@/components/layout/PageHeroCircle.jsx";
import GrowthSection from "@/pages/Home/components/GrowthSection.jsx";
import OurBrands from "@/pages/Home/components/OurBrands.jsx";
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
  eyebrow: "Our Brands",
  title: "The Names We Build For",
  subtitle: "Promise Jewels manufactures for brands that expect the same standard every single time. These are the labels we work with.",
  ctaLabel: "Meet the Brands",
}

export default function OurBrandsPage() {
  // Applies the "our-brand" SeoPage's title/description/canonical/OG/
  // Twitter/schema (as configured in /admin/seo) to the document head.
  // No-ops quietly if that SEO record doesn't exist yet — see useSeoMeta.js.
  useSeoMeta("our-brand");
  const navigate = useNavigate();

  const hero = useSectionContent('brands', 'hero', HERO)

  const heroRing = useMemo(() => ringFrom(hero), [hero])

  // The page's bands, keyed as Admin > Content knows them. The order written
  // here is what the site ships with; the panel can rearrange it, hide any of
  // them, or slot a designed section in between — without a deploy.
  const sections = {
    hero: () => (
      <PageHeroCircle
        content={hero}
        eyebrow={hero.eyebrow}
        title={hero.title}
        subtitle={hero.subtitle}
        ctaText={hero.ctaLabel}
        outerImages={heroRing}
        onCtaClick={() => navigate("/our-collection")}/>
    ),
    listing: () => (
      <>
        {/* The gap belongs to the brand rows, not to the hero above them, so
            it travels with this band when the band moves. */}
        <div className="mt-[80px] max-[767px]:mt-[50px]"></div>
        <OurBrands />
      </>
    ),
    growth: () => <GrowthSection />,
  };

  return (
    <>
      <PageSections page="brands" sections={sections} />
      <Footer />
    </>
  );
}