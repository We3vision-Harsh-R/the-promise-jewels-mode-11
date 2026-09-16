import { useEffect, useState } from 'react'
import { Check, Link2, Share2 } from 'lucide-react'

/**
 * Share this post.
 *
 * Each network below is a plain link to its own share endpoint — no scripts
 * from the networks are loaded, so nothing here tracks the reader before they
 * choose to share.
 *
 * INSTAGRAM IS DELIBERATELY NOT A LINK. Instagram has no web share endpoint
 * that accepts a URL: you cannot hand it a link the way you can LinkedIn or
 * WhatsApp. What works instead is the device's own share sheet, which offers
 * Instagram among everything else the reader has installed — so on a phone
 * the first button is "Share", and everywhere else it falls back to copying
 * the link, which is what you would paste into a story anyway.
 */
const NETWORKS = [
  {
    key: 'linkedin',
    label: 'LinkedIn',
    href: ({ url }) => `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    href: ({ url }) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
  },
  {
    key: 'x',
    label: 'X',
    href: ({ url, title }) => `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    href: ({ url, title }) => `https://api.whatsapp.com/send?text=${title}%20${url}`,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    href: ({ url, title }) => `https://t.me/share/url?url=${url}&text=${title}`,
  },
  {
    key: 'email',
    label: 'Email',
    href: ({ url, title }) => `mailto:?subject=${title}&body=${url}`,
  },
]

const BUTTON =
  'inline-flex items-center gap-[8px] rounded-full border-[1px] border-[#DCEAE7] bg-white px-[16px] py-[9px] ' +
  'font-ticker text-[0.82rem] text-[#0B5B5D] no-underline ' +
  '[transition:border-color_0.35s_ease,color_0.35s_ease,background-color_0.35s_ease] ' +
  'hover:border-[#C9A15A] hover:bg-[#FCFAF6] hover:text-[#01383B]'

export default function ShareRow({ title }) {
  const [href, setHref] = useState('')
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  // Read on the client, not during render: the address is only knowable in
  // the browser, and reading it while rendering would differ between the
  // first paint and the next.
  useEffect(() => {
    setHref(window.location.href)
    setCanShare(typeof navigator !== 'undefined' && Boolean(navigator.share))
  }, [])

  useEffect(() => {
    if (!copied) return undefined

    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const url = encodeURIComponent(href)
  const encodedTitle = encodeURIComponent(title ?? '')

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
    } catch {
      // Clipboard access can be refused (an insecure origin, a permission
      // prompt declined). Selecting the address bar still works, so this is
      // not worth an error message.
    }
  }

  return (
    <div className="mt-[40px] border-t-[1px] border-[#DCEAE7] pt-[24px]">
      <p className="mb-[14px] font-ticker text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#C9A15A]">
        Share this post
      </p>

      <div className="flex flex-wrap gap-[10px]">
        {canShare && (
          <button
            type="button"
            onClick={() =>
              navigator.share({ title, url: href }).catch(() => {
                /* the reader dismissed the sheet */
              })
            }
            className={BUTTON}
          >
            <Share2 size={14} />
            Share
          </button>
        )}

        {NETWORKS.map((network) => (
          <a
            key={network.key}
            href={network.href({ url, title: encodedTitle })}
            target="_blank"
            rel="noopener noreferrer"
            className={BUTTON}
          >
            {network.label}
          </a>
        ))}

        <button type="button" onClick={copyLink} className={BUTTON}>
          {copied ? <Check size={14} /> : <Link2 size={14} />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>

      {!canShare && (
        <p className="mt-[10px] font-ticker text-[0.78rem] text-[#7E9694]">
          For Instagram, copy the link and paste it into your story or bio —
          Instagram does not accept shared links from a website.
        </p>
      )}
    </div>
  )
}
