import { useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import Footer from '@/components/common/Footer.jsx'
import SectionHeading from '@/components/common/SectionHeading.jsx'
import PageHeroCircle from '@/components/layout/PageHeroCircle.jsx'
import CategoryCard from '@/features/collections/components/CategoryCard.jsx'
import usePublicBrands from '@/features/brands/hooks/usePublicBrands.js'
import usePublicCollections from '@/features/collections/hooks/usePublicCollections.js'
import useSectionContent from '@/features/page-content/hooks/usePageContent.js'
import { typeStyle } from '@/features/page-content/typeStyle.js'
import MemberCard from '@/features/team/components/MemberCard.jsx'
import usePublicTeam from '@/features/team/hooks/usePublicTeam.js'
import usePublicSettings from '@/features/settings/hooks/usePublicSettings.js'
import useReveal from '@/hooks/useReveal.js'
import { settleToSection } from '@/utils/scroll.js'
import { useSeoMeta } from '@/features/seo/hooks/useSeoMeta.js'

// The words around a brand: headings, buttons and the fallback messages. The
// brand's own name, description, overview, pictures and call to action are
// edited under Admin > Brands; which team members stand behind it is chosen in
// Admin > Editor > Brand page. These are what the page ships with.
const PAGE_TEXT = {
  eyebrow: 'Our Brand',
  heroButton: 'About the brand',
  aboutLight: 'About',
  aboutBold: 'the brand',
  galleryLight: 'Brand',
  galleryBold: 'Gallery',
  collectionsLight: 'Brand',
  collectionsBold: 'Collections',
  collectionsEmpty: 'The collections for this brand will be listed here soon.',
  teamLight: 'Meet the',
  teamBold: 'Team',
  teamIntro: 'The people who stand behind this brand.',
  ctaFallbackTitle: 'Interested in this brand?',
  ctaFallbackButton: 'Enquire now',
  notFoundLight: 'Brand',
  notFoundBold: 'not found',
  notFoundText: 'This brand is no longer listed, or the link is wrong.',
  notFoundButton: 'See all brands',
  byBrand: '{}',
}

/** The ids ticked for one brand in Editor > Brand page, or [] when none. */
function idsFor(byBrand, brandId) {
  try {
    const all = JSON.parse(byBrand || '{}')
    return String(all?.[brandId] || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/** First sentence-ish chunk of the description, for the line under the title. */
function lead(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= 180) return clean
  const cut = clean.slice(0, 180)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 120))}…`
}

function Band({ id, children, className = '' }) {
  const ref = useRef(null)
  useReveal(ref)

  return (
    <section ref={ref} id={id} className={`w-full bg-white px-[8%] max-[479px]:px-[6%] ${className}`}>
      {children}
    </section>
  )
}

export default function BrandDetailPage() {
  const { slug } = useParams()
  // Applies an SEO record for this brand if one was added under Admin > SEO
  // with the slug "our-brand/<brand slug>"; does nothing otherwise.
  useSeoMeta(slug ? `our-brand/${slug}` : '')
  const navigate = useNavigate()
  const text = useSectionContent('brandDetail', 'page', PAGE_TEXT)
  const teamText = useSectionContent('brandDetail', 'team', { byBrand: '{}' })
  const { social } = usePublicSettings()
  const { brands, loading } = usePublicBrands()
  const { collections } = usePublicCollections()
  const { members } = usePublicTeam()

  const brand = useMemo(() => brands.find((item) => item.slug === slug) ?? null, [brands, slug])

  const brandCollections = useMemo(
    () => (brand ? collections.filter((collection) => collection.brandId === brand.id) : []),
    [collections, brand],
  )

  const team = useMemo(() => {
    if (!brand) return []
    const ids = idsFor(teamText.byBrand, brand.id)
    return ids.map((id) => members.find((member) => member.id === id)).filter(Boolean)
  }, [teamText.byBrand, brand, members])

  // The tab title names the brand.
  useEffect(() => {
    if (brand) document.title = `${brand.name} | Promise Jewels`
  }, [brand])

  if (loading) return <div className="min-h-screen bg-white" aria-busy="true" />

  if (!brand) {
    return (
      <>
        <section className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-[22px] bg-white px-[8%] text-center">
          <SectionHeading light={text.notFoundLight} bold={text.notFoundBold} />
          <p className="m-0 max-w-[460px] font-ticker text-[1.05rem] text-[#2F6B6B]">{text.notFoundText}</p>
          <Link
            to="/our-brand"
            className="rounded-full border border-[#C9A15A] px-[24px] py-[10px] font-ticker text-[0.9rem] text-[#01383B] transition-colors hover:bg-[#C9A15A] hover:text-white"
          >
            {text.notFoundButton}
          </Link>
        </section>
        <Footer />
      </>
    )
  }

  const subtitle = lead(brand.description)

  return (
    <>
      <PageHeroCircle
        eyebrow={text.eyebrow}
        title={brand.name}
        subtitle={subtitle}
        ctaText={text.heroButton}
        ringPage="brands"
        showTicker={false}
        socialLinks={social}
        onCtaClick={() => settleToSection('brand-about')}
      />

      {/* ---- About ---- */}
      <Band id="brand-about" className="pb-[80px] pt-[60px] max-[767px]:pb-[50px] max-[767px]:pt-[40px]">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-[56px] min-[992px]:grid-cols-2 max-[991px]:gap-[34px]">
          <div data-reveal className="relative overflow-hidden rounded-[28px] bg-[#F4F8F7] shadow-[0_24px_50px_-18px_rgba(1,56,59,0.35)] [aspect-ratio:4/3]">
            {brand.image ? (
              <img src={brand.image} alt={brand.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <span className="pointer-events-none absolute inset-[13px] rounded-[18px] border border-[#C9A15A]/35" />
          </div>

          <div>
            <div data-reveal>
              <SectionHeading
                light={text.aboutLight}
                bold={text.aboutBold}
                lightStyle={typeStyle(text, 'aboutLight')}
                boldStyle={typeStyle(text, 'aboutBold')}
              />
            </div>
            <span data-reveal className="mt-[16px] block h-px w-[54px] bg-[#C9A15A]" />
            <p data-reveal className="m-0 mt-[18px] whitespace-pre-line font-ticker text-[1.02rem] leading-[1.8] text-[#2F6B6B]">
              {brand.description}
            </p>
            {brand.overview ? (
              <p data-reveal className="m-0 mt-[16px] whitespace-pre-line font-ticker text-[0.95rem] leading-[1.8] text-[#2F6B6B]/75">
                {brand.overview}
              </p>
            ) : null}

            <div data-reveal className="mt-[26px]">
              <p className="m-0 mb-[10px] font-ticker text-[1.05rem] text-[#01383B]">
                {brand.ctaTitle || text.ctaFallbackTitle}
              </p>
              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="inline-flex items-center gap-[8px] rounded-full border border-[#C9A15A] px-[24px] py-[10px] font-ticker text-[0.9rem] font-medium text-[#01383B] transition-colors duration-300 hover:bg-[#C9A15A] hover:text-white"
              >
                {brand.ctaButtonText || text.ctaFallbackButton}
                <span aria-hidden="true">&#8594;</span>
              </button>
            </div>
          </div>
        </div>
      </Band>

      {/* ---- Gallery ---- */}
      {brand.gallery.length > 0 && (
        <Band className="pb-[80px] max-[767px]:pb-[50px]">
          <div data-reveal className="text-center">
            <SectionHeading
              light={text.galleryLight}
              bold={text.galleryBold}
              lightStyle={typeStyle(text, 'galleryLight')}
              boldStyle={typeStyle(text, 'galleryBold')}
            />
          </div>
          <div className="mx-auto mt-[40px] grid w-full max-w-[1200px] grid-cols-4 gap-[18px] max-[991px]:grid-cols-3 max-[599px]:grid-cols-2 max-[599px]:gap-[12px]">
            {brand.gallery.map((image) => (
              <div
                key={image.id}
                data-reveal
                className="relative overflow-hidden rounded-[20px] bg-[#F4F8F7] shadow-[0_18px_40px_-16px_rgba(1,56,59,0.35)] [aspect-ratio:3/4]"
              >
                <img src={image.url} alt={image.alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </Band>
      )}

      {/* ---- This brand's collections ---- */}
      <Band className="pb-[80px] max-[767px]:pb-[50px]">
        <div data-reveal className="text-center">
          <SectionHeading
            light={text.collectionsLight}
            bold={text.collectionsBold}
            lightStyle={typeStyle(text, 'collectionsLight')}
            boldStyle={typeStyle(text, 'collectionsBold')}
          />
        </div>
        {brandCollections.length === 0 ? (
          <p data-reveal className="m-0 mt-[30px] text-center font-ticker text-[1rem] text-[#2F6B6B]">
            {text.collectionsEmpty}
          </p>
        ) : (
          <div className="mx-auto mt-[40px] grid w-full max-w-[1200px] grid-cols-4 gap-[22px] max-[991px]:grid-cols-3 max-[599px]:grid-cols-2 max-[599px]:gap-[12px]">
            {brandCollections.map((collection) => (
              <div key={collection.id} data-reveal>
                <CategoryCard
                  name={collection.name}
                  image={collection.coverUrl}
                  onClick={() => navigate(`/our-collection/${collection.slug}`)}
                />
              </div>
            ))}
          </div>
        )}
      </Band>

      {/* ---- The team behind it (chosen in Editor > Brand page) ---- */}
      {team.length > 0 && (
        <Band id="brand-team" className="pb-[100px] max-[767px]:pb-[60px]">
          <div data-reveal className="text-center">
            <SectionHeading
              light={text.teamLight}
              bold={text.teamBold}
              lightStyle={typeStyle(text, 'teamLight')}
              boldStyle={typeStyle(text, 'teamBold')}
            />
            {text.teamIntro ? (
              <p className="m-0 mx-auto mt-[14px] max-w-[560px] font-ticker text-[1rem] leading-[1.7] text-[#2F6B6B]">
                {text.teamIntro}
              </p>
            ) : null}
          </div>
          <div className="mx-auto mt-[44px] flex w-full max-w-[1200px] flex-wrap justify-center gap-[26px] max-[991px]:gap-[20px] max-[479px]:gap-[12px]">
            {team.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </Band>
      )}

      <Footer />
    </>
  )
}
