import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import PageHeroCircle from '@/components/layout/PageHeroCircle.jsx'
import Footer from '@/components/common/Footer.jsx'
import GrowthSection from '@/pages/Home/components/GrowthSection.jsx'
import useReveal from '@/hooks/useReveal.js'
import useSectionContent from '@/features/page-content/hooks/usePageContent.js'
import { HERO_BASE, ringFrom } from '@/components/layout/heroContent.js'
import PageSections from '@/features/page-content/PageSections.jsx'
import { listPublicPosts } from '@/features/blog/blog.api.js'
import { settleToSection } from '@/utils/scroll.js'
import { useRef } from 'react'

// Editable from Admin > Editor > Blog page; this is the fallback.
const HERO = {
  ...HERO_BASE,
  eyebrow: 'Journal',
  title: 'Notes from the Workshop',
  subtitle:
    'Craftsmanship, trade shows and the making of fine jewellery — written by the people who do it.',
  ctaLabel: 'Read the latest',
}

function formatDate(value) {
  if (!value) return ''

  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function PostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      data-reveal
      className="group flex flex-col overflow-hidden rounded-[28px] border-[1px] border-[#DCEAE7] bg-white no-underline shadow-[0_18px_40px_-24px_rgba(1,56,59,0.35)] [transition:box-shadow_0.55s_ease,translate_0.55s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[4px] hover:shadow-[0_28px_56px_-24px_rgba(1,56,59,0.45)]"
    >
      <span className="relative block aspect-[16/10] overflow-hidden bg-[#01383B]">
        {post.coverUrl ? (
          <img
            src={post.coverUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover [transition:transform_0.9s_cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
          />
        ) : null}
        <span className="pointer-events-none absolute inset-[13px] rounded-[18px] border-[1px] border-[#C9A15A]/35" />
      </span>

      <span className="flex flex-1 flex-col p-[26px]">
        <span className="flex items-center gap-[10px]">
          <span className="h-px w-[24px] bg-[#C9A15A]" />
          <span className="font-ticker text-[0.66rem] font-semibold uppercase tracking-[0.26em] text-[#C9A15A]">
            {post.tags?.[0] ?? 'Journal'}
          </span>
        </span>

        <span className="mt-[12px] block font-ticker text-[1.35rem] font-medium leading-[1.3] text-[#01383B]">
          {post.title}
        </span>

        {post.excerpt && (
          <span className="mt-[10px] block font-ticker text-[0.95rem] leading-[1.7] text-[#43605F]">
            {post.excerpt}
          </span>
        )}

        <span className="mt-auto pt-[18px] font-ticker text-[0.8rem] text-[#7E9694]">
          {[post.authorName, formatDate(post.publishedAt)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </Link>
  )
}

/** /blog — every published post, newest first. */
export default function BlogListPage() {
  const navigate = useNavigate()
  const sectionRef = useRef(null)

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const hero = useSectionContent('blog', 'hero', HERO)
  const heroRing = useMemo(() => ringFrom(hero), [hero])

  useReveal(sectionRef)

  useEffect(() => {
    let cancelled = false

    listPublicPosts()
      .then((rows) => {
        if (!cancelled) setPosts(rows ?? [])
      })
      .catch(() => {
        // A failed request shows the empty state rather than an error page —
        // the rest of the site is still perfectly usable.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

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
        onCtaClick={() => settleToSection('posts')}/>
    ),
    posts: () => (
      <section
        id="posts"
        ref={sectionRef}
        className="w-full bg-white px-[8%] pt-[70px] pb-[100px] max-[991px]:px-[40px] max-[479px]:px-[20px] max-[479px]:pt-[50px] max-[479px]:pb-[64px]"
      >
        {loading ? (
          <p className="text-center font-ticker text-[1rem] text-[#7E9694]">Loading…</p>
        ) : posts.length === 0 ? (
          <div className="mx-auto max-w-[560px] text-center">
            <h2 className="m-0 font-ticker text-[1.9rem] font-medium text-[#01383B] max-[479px]:text-[1.5rem]">
              Nothing published yet
            </h2>
            <p className="mt-[12px] font-ticker text-[1rem] leading-[1.75] text-[#43605F]">
              The first post is on its way. In the meantime, have a look at our
              collections or get in touch.
            </p>
            <button
              type="button"
              onClick={() => navigate('/our-collection')}
              className="mt-[26px] cursor-pointer rounded-full border-0 bg-gradient-to-b from-[#01383B] to-[#286F6F] px-[34px] py-[14px] font-ticker text-[0.95rem] font-semibold text-white"
            >
              View collections
            </button>
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-[1240px] grid-cols-3 gap-[30px] max-[1024px]:grid-cols-2 max-[640px]:grid-cols-1 max-[1024px]:gap-[22px]">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    ),
    growth: () => <GrowthSection />,
  }

  return (
    <>
      <PageSections page="blog" sections={sections} />
      <Footer />
    </>
  )
}
