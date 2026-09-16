import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listExhibitions } from "@/features/exhibitions/exhibition.api.js";
import PageHeroCircle from "@/components/layout/PageHeroCircle.jsx";
import Footer from "@/components/common/Footer.jsx";
import { settleToSection } from "@/utils/scroll.js";
import InquiryForm from "@/features/inquiries/components/InquiryForm.jsx";
import ExhibitionSchedule from "@/features/exhibitions/components/ExhibitionSchedule.jsx";
import ExhibitionSection from "@/features/exhibitions/components/ExhibitionSection.jsx";
import ExhibitionFaq from "@/features/exhibitions/components/ExhibitionFaq.jsx";
import ExhibitionSchema from "@/features/exhibitions/components/ExhibitionSchema.jsx";
import { EXHIBITIONS, sortForDisplay } from "@/features/exhibitions/data/exhibitions.js";
import useSectionContent from '@/features/page-content/hooks/usePageContent.js'
import { HERO_BASE, ringFrom } from '@/components/layout/heroContent.js'
import PageSections from "@/features/page-content/PageSections.jsx";

// What this page opens with. The shades and the eighteen turning frames
// come from HERO_BASE so every hero on the site starts from the same place;
// only the words below belong to this page. All of it is editable from
// Admin > Editor > this page, and these values are the fallback.
const HERO = {
  ...HERO_BASE,
  eyebrow: "Exhibitions",
  title: "Where You Can Find Us",
  subtitle: "We show at the trade fairs that matter. Come and see the work in person — the stand details for each show are below.",
  ctaLabel: "See Upcoming Shows",
}

/**
 * Questions written from what someone actually searches before a trade show.
 * They are deliberately phrased as full questions so they match spoken and
 * long-tail queries, and each answer is self-contained — an answer that only
 * makes sense after reading the one above it cannot be used as a rich result.
 */
const FAQS = [
  {
    question: "Which jewellery exhibitions does Promise Jewels attend?",
    answer:
      "Promise Jewels exhibits at IIJS Bharat Premiere in Mumbai, GGJS — Gujarat Gold Jewellery Show in Gandhinagar, and ROOTZ — the Gems & Jewellery Manufacturers' Show in Surat. All three are business-to-business trade shows covering gold and diamond jewellery manufacturing.",
  },
  {
    question: "Are these jewellery exhibitions open to the public?",
    answer:
      "No. IIJS Bharat Premiere, GGJS and ROOTZ are all trade-only B2B exhibitions. Entry is limited to registered trade visitors — retailers, wholesalers, distributors, importers and exporters — and you will need valid business credentials to register.",
  },
  {
    question: "Where is IIJS Bharat Premiere 2026 held, and on what dates?",
    answer:
      "IIJS Bharat Premiere 2026 runs across two Mumbai venues on staggered dates: the Jio World Convention Centre in BKC from 5 to 9 August 2026, and the Bombay Exhibition Centre at NESCO, Goregaon from 6 to 10 August 2026. Both halls open 10:00 to 19:00 and a shuttle service connects them.",
  },
  {
    question: "How do I book a meeting with Promise Jewels at a show?",
    answer:
      "Send an enquiry through the form on this page with the exhibition name and the day you plan to visit. We will confirm a time slot and share our stall number once the organiser publishes the floor plan. Booking ahead matters at IIJS in particular, where the floor is busiest.",
  },
  {
    question: "Why does a jewellery manufacturer exhibit at trade shows?",
    answer:
      "Trade shows are where the buying season is written. They let retailers and wholesalers see the full range and finish quality in person, compare manufacturing capability, and place bulk orders for festive and bridal collections — none of which translates well to a catalogue or a website.",
  },
  {
    question: "Can I see Promise Jewels collections before the exhibition?",
    answer:
      "Yes. Our current necklace, ring, earring and pendant lines are on the collections page of this site, and we can send a detailed catalogue on request ahead of any show so your team arrives with a shortlist.",
  },
];

/**
 * /Exhibition — the page the "Exhibition Highlights" navbar link points at.
 *
 * Structure is deliberate: hero, then the schedule table (the one thing a
 * search visitor came for), then a full section per show, then FAQ, then the
 * enquiry form. Anyone landing cold can answer "which show, when, where and
 * why" without scrolling past the first screen and a half.
 *
 * Everything renders from src/data/exhibitions.js — adding or updating a show
 * there updates the schedule, the sections, the countdowns and the JSON-LD
 * schema together, with no duplicated dates to drift apart.
 */
export default function ExhibitionPage() {
  // The opening screen's words, shades and eighteen frames, as saved in
  // Admin > Editor. HERO above is the fallback, so nothing saved renders
  // exactly what the page shipped with.
  const hero = useSectionContent('exhibitions', 'hero', HERO)
  const heroRing = useMemo(() => ringFrom(hero), [hero])

  // Loaded through the same service the admin panel writes to, so anything
  // edited under /admin/exhibitions appears here. EXHIBITIONS is the seed the
  // mock store starts from and the fallback if the request fails — the page
  // must never render empty just because an API call did not come back.
  const [records, setRecords] = useState(EXHIBITIONS);

  useEffect(() => {
    let cancelled = false;

    listExhibitions()
      .then((rows) => {
        if (cancelled || !rows?.length) return;
        setRecords(rows);
      })
      .catch(() => {
        /* keep the seed already in state */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Upcoming shows first, concluded ones last, so the page stays useful as
  // the season moves without anyone editing the order by hand.
  const ordered = useMemo(() => sortForDisplay(records), [records]);

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
        onCtaClick={() => settleToSection("schedule")}/>
    ),
    schedule: () => <ExhibitionSchedule exhibitions={ordered} />,
    listing: () =>
      ordered.map((exhibition, index) => (
        <ExhibitionSection
          key={exhibition.id}
          exhibition={exhibition}
          index={index}
        />
      )),
    // Catches the reader who has finished the shows and is ready to act,
    // before the questions send them looking elsewhere.
    cta: () => (
      <section className="w-full bg-[#F6FAF9] px-[8%] py-[70px] max-[479px]:px-[6%] max-[479px]:py-[48px]">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-[40px] rounded-[28px] border-[1px] border-[#01383B] bg-gradient-to-br from-[#01383B] via-[#0B5B5D] to-[#286F6F] p-[44px] shadow-[0_26px_54px_rgba(1,56,59,0.28)] max-[860px]:flex-col max-[860px]:items-start max-[860px]:gap-[26px] max-[479px]:rounded-[20px] max-[479px]:p-[28px]">
          <div className="min-w-0">
            <span className="mb-[12px] flex items-center gap-[12px]">
              <span className="h-px w-[30px] bg-[#C9A15A]" />
              <span className="font-ticker text-[0.66rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#E8CB92]">
                Plan Your Visit
              </span>
            </span>
            <h2 className="m-0 max-w-[560px] font-ticker text-[1.9rem] font-medium leading-[1.25] text-white max-[479px]:text-[1.4rem]">
              Tell us which show you're attending, and we'll hold a slot.
            </h2>
            <p className="mt-[14px] max-w-[560px] text-[0.96rem] leading-[1.7] text-white/75 max-[479px]:text-[0.9rem]">
              Share your requirements ahead of time and our team will have the
              relevant collections ready when you arrive at the stall.
            </p>
          </div>

          <Link
            to="/contact"
            className="shrink-0 rounded-full border-[1px] border-[#C9A15A] bg-[#C9A15A] px-[32px] py-[15px] font-ticker text-[0.95rem] font-semibold text-white no-underline shadow-[0_14px_30px_rgba(201,161,90,0.35)] [transition:box-shadow_0.45s_ease,translate_0.45s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:shadow-[0_20px_38px_rgba(201,161,90,0.45)]"
          >
            Book a meeting
          </Link>
        </div>
      </section>
    ),
    faq: () => <ExhibitionFaq faqs={FAQS} />,
    inquiry: () => <InquiryForm id="inquiry" />,
  };

  return (
    <>
      {/* Structured data for the shows. Not a band on the page — it is markup
          for search engines, so it is not part of the arrangement. */}
      <ExhibitionSchema exhibitions={ordered} faqs={FAQS} />

      <PageSections page="exhibitions" sections={sections} />
      <Footer />
    </>
  );
}
