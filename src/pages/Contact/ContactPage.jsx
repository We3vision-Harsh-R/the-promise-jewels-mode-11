import { useMemo } from 'react'
import PageHeroCircle from "@/components/layout/PageHeroCircle.jsx";
import InquiryForm from "@/features/inquiries/components/InquiryForm.jsx";
import Footer from "@/components/common/Footer.jsx";
import { useSeoMeta } from "@/features/seo/hooks/useSeoMeta.js";
import { scrollToTarget } from "@/utils/scroll.js";
import PageSections from '@/features/page-content/PageSections.jsx'
import useSectionContent from '@/features/page-content/hooks/usePageContent.js'
import { HERO_BASE, ringFrom } from '@/components/layout/heroContent.js'

// What this page opens with. The shades and the eighteen turning frames
// come from HERO_BASE so every hero on the site starts from the same place;
// only the words below belong to this page. All of it is editable from
// Admin > Editor > this page, and these values are the fallback.
const HERO = {
  ...HERO_BASE,
  eyebrow: "Contact Us",
  title: "Let's Talk About Your Next Collection",
  subtitle: "Tell us what you are planning and we will come back to you with what it takes to make it — quantities, timelines and finish.",
  ctaLabel: "Send an Enquiry",
}

/**
 * Public "Contact" page (route: /contact).
 *
 * A lighter page built around the same reusable InquiryForm used on the
 * collection page — hero on top, the business-inquiry form, then the footer.
 */
export default function ContactPage() {
  // Applies the "contact" SEO record to the document head if one exists in
  // /admin/seo; no-ops quietly otherwise (see useSeoMeta.js).
  useSeoMeta("contact");

  const scrollToForm = () => {
    scrollToTarget(document.getElementById("inquiry"));
  };

  const hero = useSectionContent('contact', 'hero', HERO)

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
        onCtaClick={scrollToForm}/>
    ),
    details: () => <InquiryForm id="inquiry" />,
  };

  return (
    <>
      <PageSections page="contact" sections={sections} />
      <Footer />
    </>
  );
}
