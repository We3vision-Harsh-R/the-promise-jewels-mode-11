import { Link } from 'react-router-dom'
import Footer from '@/components/common/Footer.jsx'

/**
 * Shown for any address on the website that is not a page.
 *
 * Without it an unknown URL rendered the navigation bar over an empty screen,
 * which reads as a broken site. This keeps the visitor on the site with a way
 * back to the pages that do exist.
 */
const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/our-collection', label: 'Collections' },
  { to: '/our-brand', label: 'Brands' },
  { to: '/Exhibition', label: 'Exhibitions' },
  { to: '/contact', label: 'Contact' },
]

export default function NotFoundPage() {
  return (
    <>
      <section className="flex min-h-[70vh] w-full flex-col items-center justify-center bg-white px-[8%] pb-[60px] pt-[160px] text-center max-[479px]:px-[6%]">
        <span className="mb-[16px] flex items-center gap-[12px]">
          <span className="h-px w-[34px] bg-[#C9A15A]" />
          <span className="font-ticker text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[#C9A15A]">
            Error 404
          </span>
          <span className="h-px w-[34px] bg-[#C9A15A]" />
        </span>

        <h1 className="m-0 font-ticker text-[2.8rem] font-light leading-[1.2] text-[#01383B] max-[479px]:text-[2rem]">
          This page <strong className="font-semibold">could not be found</strong>
        </h1>

        <p className="mt-[16px] max-w-[520px] font-ticker text-[1rem] leading-[1.7] text-[#2F6B6B]">
          The address may have been typed wrongly, or the page may have moved.
          These pages are always here:
        </p>

        <nav aria-label="Pages" className="mt-[28px] flex flex-wrap justify-center gap-[12px]">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-full border-[1px] border-[#0B5B5D] px-[22px] py-[10px] font-ticker text-[0.92rem] font-semibold text-[#0B5B5D] no-underline transition-colors hover:bg-[#0B5B5D] hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </section>
      <Footer />
    </>
  )
}
