import { useMemo, useRef, useState } from 'react'
import Footer from '@/components/common/Footer.jsx'
import SectionHeading from '@/components/common/SectionHeading.jsx'
import PageHeroCircle from '@/components/layout/PageHeroCircle.jsx'
import GrowthSection from '@/pages/Home/components/GrowthSection.jsx'
import PageSections from '@/features/page-content/PageSections.jsx'
import useSectionContent from '@/features/page-content/hooks/usePageContent.js'
import { typeStyle } from '@/features/page-content/typeStyle.js'
import { HERO_BASE } from '@/components/layout/heroContent.js'
import { useSeoMeta } from '@/features/seo/hooks/useSeoMeta.js'
import MemberCard from '@/features/team/components/MemberCard.jsx'
import usePublicTeam from '@/features/team/hooks/usePublicTeam.js'
import CategoryTabs from '@/features/team/components/CategoryTabs.jsx'
import { DEFAULT_CATEGORY } from '@/features/team/categories.js'
import useReveal from '@/hooks/useReveal.js'
import { settleToSection } from '@/utils/scroll.js'

// What the page opens with, and what is said around the photographs. All of it
// is editable under Admin > Editor > Our Team page; these values are the
// fallback. The PEOPLE are not here — they come from Admin > Our Team.
const HERO = {
  ...HERO_BASE,
  eyebrow: 'Our Team',
  title: 'The People Behind the Promise',
  subtitle:
    'Behind every piece that leaves our workshop is a team that designs, casts, sets, finishes and checks it. These are the people who keep the promise.',
  ctaLabel: 'Meet the Team',
}

const MEMBERS_TEXT = {
  headingLight: 'Meet the',
  headingBold: 'Team',
  emptyText: 'Our team will be introduced here soon.',
}

function Members() {
  const text = useSectionContent('team', 'members', MEMBERS_TEXT)
  const { members: everyone, loading } = usePublicTeam()
  const [category, setCategory] = useState(DEFAULT_CATEGORY)
  // Promise Jewels / Netram: each tab lists the people filed under it.
  const members = useMemo(() => everyone.filter((member) => member.category === category), [everyone, category])
  const sectionRef = useRef(null)

  // The site-wide entrance for the heading and the cards.
  useReveal(sectionRef)

  return (
    <section
      id="team"
      ref={sectionRef}
      className="w-full bg-white px-[8%] pb-[100px] pt-[30px] max-[991px]:pb-[70px] max-[479px]:px-[6%] max-[479px]:pb-[56px]"
    >
      <div data-reveal className="text-center">
        <SectionHeading
          light={text.headingLight}
          bold={text.headingBold}
          lightStyle={typeStyle(text, 'headingLight')}
          boldStyle={typeStyle(text, 'headingBold')}
          className="text-center"
        />
      </div>

      <div className="mt-[34px]">
        <CategoryTabs value={category} onChange={setCategory} label="Team by company" />
      </div>

      <div key={category} className="mx-auto w-full max-w-[1200px] [animation:pj-tab-in_0.45s_ease_both]">
        {loading ? (
          <div className="flex flex-wrap justify-center gap-[26px] max-[991px]:gap-[20px] max-[479px]:gap-[12px]" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="w-[calc((100%-78px)/4)] max-[1199px]:w-[calc((100%-52px)/3)] max-[991px]:w-[calc((100%-20px)/2)] max-[479px]:w-[calc((100%-12px)/2)] animate-pulse rounded-[26px] bg-[#EEF4F3] [aspect-ratio:3/4] max-[479px]:rounded-[18px]" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="m-0 py-[40px] text-center font-ticker text-[1.05rem] text-[#2F6B6B]">{text.emptyText}</p>
        ) : (
          // Centred, so a team of three or five sits in the middle of the page
          // rather than leaving an empty column on the right.
          <div className="flex flex-wrap justify-center gap-[26px] max-[991px]:gap-[20px] max-[479px]:gap-[12px]">
            {members.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default function OurTeamPage() {
  // Applies the "our-team" SEO record from /admin/seo if one exists.
  useSeoMeta('our-team')

  const hero = useSectionContent('team', 'hero', HERO)

  // The page's bands, keyed as Admin > Content knows them, so they can be
  // rearranged or hidden from there without a deploy.
  const sections = {
    hero: () => (
      <PageHeroCircle
        content={hero}
        eyebrow={hero.eyebrow}
        title={hero.title}
        subtitle={hero.subtitle}
        ctaText={hero.ctaLabel}
        ringPage="team"
        // Through the smooth-scroll helper: the browser's own scrollIntoView does
        // nothing while the site's smooth scrolling is running.
        onCtaClick={() => settleToSection('team')}
      />
    ),
    members: () => <Members />,
    growth: () => <GrowthSection />,
  }

  return (
    <>
      <PageSections page="team" sections={sections} />
      <Footer />
    </>
  )
}
