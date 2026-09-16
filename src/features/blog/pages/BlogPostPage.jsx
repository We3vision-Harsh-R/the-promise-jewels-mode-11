import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import Footer from '@/components/common/Footer.jsx'
import ShareRow from '@/features/blog/components/ShareRow.jsx'
import CommentSection from '@/features/blog/components/CommentSection.jsx'
import { getPublicPost } from '@/features/blog/blog.api.js'

function formatDate(value) {
  if (!value) return ''

  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Writes this post's title, description and sharing card into <head>.
 *
 * The site has no server-side rendering, so this is the same approach
 * useSeoMeta.js takes for the fixed pages — tag what we create with
 * data-blog-seo and remove exactly those on the way out, leaving the tags in
 * index.html alone.
 *
 * Worth knowing: Facebook and LinkedIn read the HTML as SERVED and do not run
 * scripts, so the card they show comes from index.html, not from here. This
 * gets the title and description right for the reader's browser tab, for
 * search engines that do execute scripts, and for anything reading the page
 * after load — see the note in the summary about pre-rendering.
 */
function useBlogSeo(post) {
  useEffect(() => {
    if (!post) return undefined

    const previousTitle = document.title
    const { seo } = post

    document.title = seo.metaTitle ?? post.title

    const created = []

    const meta = (attr, key, content) => {
      if (!content) return

      const el = document.createElement('meta')
      el.setAttribute(attr, key)
      el.setAttribute('content', content)
      el.setAttribute('data-blog-seo', 'true')
      document.head.appendChild(el)
      created.push(el)
    }

    meta('name', 'description', seo.metaDescription)
    meta('property', 'og:type', 'article')
    meta('property', 'og:title', seo.metaTitle ?? post.title)
    meta('property', 'og:description', seo.metaDescription)
    meta('property', 'og:image', seo.ogImageUrl)
    meta('property', 'og:url', window.location.href)
    meta('name', 'twitter:card', seo.ogImageUrl ? 'summary_large_image' : 'summary')
    meta('name', 'twitter:title', seo.metaTitle ?? post.title)
    meta('name', 'twitter:description', seo.metaDescription)
    meta('name', 'twitter:image', seo.ogImageUrl)

    if (seo.noindex) meta('name', 'robots', 'noindex, nofollow')

    const canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    canonical.setAttribute('href', seo.canonicalUrl || window.location.href)
    canonical.setAttribute('data-blog-seo', 'true')
    document.head.appendChild(canonical)
    created.push(canonical)

    // Article structured data, so a search result can show the headline,
    // date and image rather than just a link.
    const schema = document.createElement('script')
    schema.type = 'application/ld+json'
    schema.setAttribute('data-blog-seo', 'true')
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: seo.metaDescription ?? undefined,
      image: seo.ogImageUrl ?? undefined,
      datePublished: post.publishedAt ?? undefined,
      author: post.authorName
        ? { '@type': 'Person', name: post.authorName }
        : { '@type': 'Organization', name: 'Promise Jewels' },
      publisher: { '@type': 'Organization', name: 'Promise Jewels' },
      mainEntityOfPage: window.location.href,
    })
    document.head.appendChild(schema)
    created.push(schema)

    return () => {
      document.title = previousTitle
      created.forEach((el) => el.remove())
    }
  }, [post])
}

/** /blog/:slug — one published post. */
export default function BlogPostPage() {
  const { slug } = useParams()

  const [post, setPost] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | missing

  useEffect(() => {
    let cancelled = false

    setState('loading')

    getPublicPost(slug)
      .then((data) => {
        if (cancelled) return
        setPost(data)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('missing')
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  // Every route change starts at the top of the article, not wherever the
  // previous page was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [slug])

  useBlogSeo(post)

  if (state === 'loading') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-white">
        <p className="font-ticker text-[1rem] text-[#7E9694]">Loading…</p>
      </div>
    )
  }

  if (state === 'missing') {
    return (
      <>
        <div className="flex min-h-[60vh] flex-col items-center justify-center bg-white px-[8%] text-center">
          <h1 className="m-0 font-ticker text-[2.4rem] font-medium text-[#01383B] max-[479px]:text-[1.7rem]">
            That post is not here
          </h1>
          <p className="mt-[12px] max-w-[520px] font-ticker text-[1rem] leading-[1.75] text-[#43605F]">
            It may have been unpublished, or the address may be wrong.
          </p>
          <Link
            to="/blog"
            className="mt-[26px] rounded-full bg-gradient-to-b from-[#01383B] to-[#286F6F] px-[34px] py-[14px] font-ticker text-[0.95rem] font-semibold text-white no-underline"
          >
            Back to the blog
          </Link>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <article className="w-full bg-white px-[8%] pt-[140px] pb-[80px] max-[991px]:px-[40px] max-[479px]:px-[20px] max-[479px]:pt-[110px]">
        <div className="mx-auto w-full max-w-[820px]">
          <Link
            to="/blog"
            className="font-ticker text-[0.82rem] text-[#0B5B5D] no-underline underline-offset-4 hover:underline"
          >
            ← All posts
          </Link>

          <span className="mt-[22px] flex items-center gap-[12px]">
            <span className="h-px w-[34px] bg-[#C9A15A]" />
            <span className="font-ticker text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#C9A15A]">
              {post.tags?.[0] ?? 'Journal'}
            </span>
          </span>

          <h1 className="mt-[16px] mb-0 font-ticker text-[3rem] font-medium leading-[1.15] text-[#01383B] max-[991px]:text-[2.3rem] max-[479px]:text-[1.75rem]">
            {post.title}
          </h1>

          <p className="mt-[16px] font-ticker text-[0.9rem] text-[#7E9694]">
            {[
              post.authorName,
              formatDate(post.publishedAt),
              `${post.readMinutes} min read`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {post.coverUrl && (
            <div className="relative mt-[34px] overflow-hidden rounded-[28px] bg-[#01383B]">
              <img
                src={post.coverUrl}
                alt=""
                className="block w-full object-cover"
              />
              <span className="pointer-events-none absolute inset-[14px] rounded-[18px] border-[1px] border-[#C9A15A]/35" />
            </div>
          )}

          {/* The post itself. The HTML was sanitised on the SERVER before it
              was stored (blog.sanitize.ts), which is what makes rendering it
              here safe — the column can be trusted by anything that reads it,
              not just by this component. */}
          <div
            className="pj-prose mt-[38px]"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {post.tags?.length > 0 && (
            <div className="mt-[34px] flex flex-wrap gap-[10px]">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border-[1px] border-[#DCEAE7] bg-[#F6FAF9] px-[14px] py-[6px] font-ticker text-[0.78rem] text-[#0B5B5D]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <ShareRow title={post.title} />

          <CommentSection slug={post.slug} comments={post.comments ?? []} />
        </div>
      </article>

      <Footer />
    </>
  )
}
