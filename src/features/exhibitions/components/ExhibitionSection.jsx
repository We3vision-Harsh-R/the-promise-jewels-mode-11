import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import { formatRange, getStatus } from "@/features/exhibitions/data/exhibitions.js";

const ICON = "h-[17px] w-[17px] shrink-0";

function CalendarIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <path d="M16 5.2A3.4 3.4 0 0 1 16 12M18 20c0-2.2-.9-4.2-2.4-5.6" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_PILL = {
  upcoming: "bg-[#F1F7F5] text-[#0B5B5D] border-[#D3E6E2]",
  live: "bg-[#C9A15A] text-white border-[#C9A15A]",
  past: "bg-[#F2F4F4] text-[#7C8F8C] border-[#E1E7E6]",
};

/** One labelled fact. `children` rather than a string so dates can use <time>. */
function Fact({ icon, label, children }) {
  return (
    <div className="js-exh-item flex items-start gap-[13px] text-left">
      <span className="mt-[3px] text-[#C9A15A]">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[0.64rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#0B5B5D]/55">
          {label}
        </dt>
        <dd className="mt-[5px] text-[0.98rem] leading-[1.6] text-[#01383B]">{children}</dd>
      </div>
    </div>
  );
}

/**
 * One exhibition, rendered as a full section: what it is, when and where it
 * runs, and why Promise Jewels is there.
 *
 * `index` only drives the alternating left/right layout, so adding a fourth
 * show needs no other change.
 */
export default function ExhibitionSection({ exhibition, index }) {
  const sectionRef = useRef(null);
  const status = getStatus(exhibition);
  const flipped = index % 2 === 1;

  // Both are normalised to arrays in exhibition.api.js, but this component is
  // also handed records straight from the bundled seed file, which carries
  // neither.
  const customSections = exhibition.customSections ?? [];
  const gallery = (exhibition.gallery ?? []).filter((image) => image?.image_url);

  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(exhibition.logo) && !logoFailed;

  const location =
    exhibition.location ||
    [exhibition.city, exhibition.country].filter(Boolean).join(", ");

  // exhibition.api.js derives a venue's area from city + country when a show
  // has no per-hall schedule, so for most shows the location is already on
  // screen under Venue.
  const venuesCoverLocation =
    Boolean(location) &&
    (exhibition.venues ?? []).some((venue) =>
      String(venue?.area ?? "").toLowerCase().includes(location.toLowerCase()),
    );

  useGSAP(
    () => {
      const timeline = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        scrollTrigger: { trigger: sectionRef.current, start: "top 76%" },
      });

      timeline
        .from(".js-exh-rule", { scaleX: 0, duration: 1, ease: "power2.inOut" })
        .from(".js-exh-media", { y: 48, opacity: 0, duration: 1 }, "-=0.8")
        .from(".js-exh-head", { y: 26, opacity: 0, duration: 0.8, stagger: 0.1 }, "-=0.8")
        .from(".js-exh-item", { y: 22, opacity: 0, duration: 0.7, stagger: 0.08 }, "-=0.55");

      // Slow drift on the logo panel, tied to scroll position.
      gsap.fromTo(
        ".js-exh-glow",
        { scale: 1 },
        {
          scale: 1.12,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        }
      );
    },
    sectionRef,
    []
  );

  return (
    <section
      ref={sectionRef}
      id={exhibition.id}
      aria-labelledby={`${exhibition.id}-heading`}
      className="w-full scroll-mt-[90px] bg-white px-[8%] py-[70px] max-[1024px]:py-[54px] max-[479px]:px-[6%] max-[479px]:py-[40px]"
    >
      <div className="mx-auto w-full max-w-[1240px]">
        <span className="js-exh-rule mb-[54px] block h-px w-full origin-left bg-[#DCEAE7] max-[1024px]:mb-[38px]" />

        {/* The column TEMPLATE flips along with the order, not just the order.
            `order` moves an item into the other grid cell, so flipping alone
            handed the logo panel the wide 1fr column and squeezed the copy
            into the 420px one — alternate shows read as a giant empty panel
            beside a cramped column of text. Mirroring the template keeps the
            panel at 420px and the copy in the wide column either way. */}
        <div
          className={`grid items-start gap-[70px] max-[1024px]:grid-cols-1 max-[1024px]:gap-[32px] ${
            flipped
              ? "grid-cols-[1fr_minmax(0,420px)] [&>*:first-child]:order-2 max-[1024px]:[&>*:first-child]:order-1"
              : "grid-cols-[minmax(0,420px)_1fr]"
          }`}
        >
          {/* Logo panel */}
          <div className="js-exh-media relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[26px] bg-white shadow-[0_22px_46px_rgba(1,56,59,0.12)] max-[479px]:rounded-[18px]">
            <span className="js-exh-glow pointer-events-none absolute h-[78%] w-[78%] rounded-full bg-[radial-gradient(circle,rgba(11,91,93,0.09)_0%,rgba(11,91,93,0)_70%)]" />
            {showLogo ? (
              <img
                src={exhibition.logo}
                alt={`${exhibition.name} logo`}
                loading="lazy"
                onError={() => setLogoFailed(true)}
                className="relative z-[2] max-h-[62%] max-w-[74%] object-contain"
              />
            ) : (
              /* A show saved without a logo, or whose stored URL no longer
                 resolves in Supabase. The panel keeps its shape and sets the
                 show's name rather than drawing a broken-image glyph. */
              <span className="relative z-[2] px-[10%] text-center font-ticker text-[1.3rem] font-medium leading-tight text-[#01383B]/35 max-[479px]:text-[1rem]">
                {exhibition.name}
              </span>
            )}
            <span className="pointer-events-none absolute inset-[14px] rounded-[18px] border-[1px] border-[#C9A15A]/30 max-[479px]:inset-[10px] max-[479px]:rounded-[13px]" />
          </div>

          <div className="min-w-0">
            <div className="js-exh-head mb-[16px] flex flex-wrap items-center gap-[12px]">
              <span
                className={`rounded-full border-[1px] px-[13px] py-[6px] text-[0.64rem] max-[479px]:text-[0.7rem] font-medium uppercase tracking-[0.16em] ${STATUS_PILL[status.key]}`}
              >
                {status.key === "upcoming" ? `${status.days} Days To Go` : status.label}
              </span>
              {exhibition.edition && (
                <span className="text-[0.64rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#C9A15A]">
                  {exhibition.edition}
                </span>
              )}
            </div>

            <h2
              id={`${exhibition.id}-heading`}
              className="js-exh-head m-0 font-ticker text-[2.3rem] font-medium leading-[1.15] text-[#01383B] max-[1024px]:text-[1.9rem] max-[479px]:text-[1.5rem]"
            >
              {exhibition.name}{" "}
              <span className="text-[#0B5B5D]/55">{exhibition.year}</span>
            </h2>

            <p className="js-exh-head mt-[18px] max-w-[620px] text-[1rem] leading-[1.75] text-[#0B5B5D]/80 max-[479px]:text-[0.92rem]">
              {exhibition.about}
            </p>

            <dl className="mt-[32px] grid grid-cols-2 gap-x-[34px] gap-y-[22px] max-[639px]:grid-cols-1 max-[639px]:gap-y-[18px]">
              <Fact icon={<CalendarIcon />} label="Dates">
                {/* One line per venue — IIJS genuinely opens on different
                    days at each of its two halls. */}
                {exhibition.venues.map((venue) => (
                  <span key={venue.name} className="block">
                    <time dateTime={venue.start}>{formatRange(venue.start, venue.end)}</time>
                    {exhibition.venues.length > 1 && (
                      <span className="text-[#0B5B5D]/60"> · {venue.name}</span>
                    )}
                  </span>
                ))}
                {!exhibition.datesConfirmed && (
                  <span className="mt-[6px] block text-[0.78rem] text-[#B23A2E]">
                    Dates to be confirmed with the organiser.
                  </span>
                )}
              </Fact>

              <Fact icon={<PinIcon />} label="Venue">
                {exhibition.venues.map((venue) => (
                  <span key={venue.name} className="block">
                    {venue.name}
                    <span className="text-[#0B5B5D]/60"> — {venue.area}</span>
                  </span>
                ))}
              </Fact>

              {/* hours / audience are nullable on the exhibitions table.
                  A show that has not had them filled in drops the whole
                  Fact rather than printing a label above an empty line. */}
              {exhibition.hours && (
                <Fact icon={<ClockIcon />} label="Show Hours">
                  {exhibition.hours} daily
                </Fact>
              )}

              {/* City / State-Country from the admin form. They usually reach
                  the page inside a venue's area line, so this only renders
                  when no venue already says the same thing — otherwise every
                  single-venue show would print its location twice. */}
              {location && !venuesCoverLocation && (
                <Fact icon={<PinIcon />} label="Location">
                  {location}
                </Fact>
              )}

              {exhibition.audience && (
                <Fact icon={<UsersIcon />} label="Who Attends">
                  {exhibition.audience}
                </Fact>
              )}
            </dl>

            {/* The "why" — the question a visitor actually arrives with.
                Also nullable, and an empty panel reads as a broken one. */}
            {exhibition.whyWeExhibit && (
            <div className="js-exh-item mt-[34px] rounded-[20px] border-[1px] border-[#DCEAE7] bg-[#F6FAF9] p-[26px] max-[479px]:p-[20px]">
              <span className="mb-[10px] flex items-center gap-[10px]">
                <span className="h-px w-[24px] bg-[#C9A15A]" />
                <span className="text-[0.64rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#C9A15A]">
                  Why We Exhibit
                </span>
              </span>
              <p className="m-0 text-[0.96rem] leading-[1.7] text-[#01383B]">
                {exhibition.whyWeExhibit}
              </p>
            </div>
            )}

            <ul className="js-exh-item mt-[26px] flex list-none flex-col gap-[10px] p-0">
              {exhibition.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-[11px] text-[0.92rem] text-[#0B5B5D]/85">
                  <span className="mt-[7px] h-[5px] w-[5px] shrink-0 rotate-45 bg-[#C9A15A]" />
                  {highlight}
                </li>
              ))}
            </ul>

            {/* Operator-defined blocks, entered under "Custom sections" in
                /admin/exhibitions. Rendered generically: whatever sections and
                labelled lines a show carries appear here in the order they
                were entered, so a new one needs no change to this file. */}
            {customSections.map((section) => (
              <div
                key={section.title}
                className="js-exh-item mt-[26px] rounded-[20px] border-[1px] border-[#DCEAE7] bg-white p-[26px] max-[479px]:p-[20px]"
              >
                <span className="mb-[14px] flex items-center gap-[10px]">
                  <span className="h-px w-[24px] bg-[#C9A15A]" />
                  <span className="text-[0.64rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#C9A15A]">
                    {section.title}
                  </span>
                </span>

                <dl className="grid grid-cols-2 gap-x-[34px] gap-y-[16px] max-[639px]:grid-cols-1 max-[639px]:gap-y-[14px]">
                  {section.fields.map((field) => (
                    <div key={field.label} className="min-w-0">
                      <dt className="text-[0.64rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#0B5B5D]/55">
                        {field.label}
                      </dt>
                      <dd className="mt-[5px] whitespace-pre-line text-[0.96rem] leading-[1.6] text-[#01383B]">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}

            {/* Photographs uploaded against this show. They had nowhere to
                appear on the public page before, so anything added through the
                admin gallery was write-only. */}
            {gallery.length > 0 && (
              <div className="js-exh-item mt-[26px] grid grid-cols-4 gap-[12px] max-[639px]:grid-cols-3 max-[479px]:gap-[8px]">
                {gallery.map((image) => (
                  <span
                    key={image.id ?? image.image_url}
                    className="aspect-square overflow-hidden rounded-[14px] bg-[#F1F6F5] max-[479px]:rounded-[10px]"
                  >
                    <img
                      src={image.image_url}
                      alt={image.alt_text || `${exhibition.name} stand`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </span>
                ))}
              </div>
            )}

            {exhibition.organiser && (
              <p className="js-exh-item mt-[24px] text-[0.78rem] text-[#7E9694]">
                Organised by {exhibition.organiser}.
              </p>
            )}

            {/* One action only: booking a meeting is the point of this page.
                A second link out to the collections competed with it and sent
                readers away from the show they were reading about. */}
            <div className="js-exh-item mt-[26px] flex flex-wrap items-center gap-[14px]">
              <Link
                to="/contact"
                className="inline-flex items-center rounded-full border-[1px] border-[#C9A15A]/50 bg-gradient-to-b from-[#01383B] to-[#0B5B5D] px-[30px] py-[15px] font-ticker text-[0.95rem] font-semibold text-white no-underline shadow-[0_12px_26px_rgba(1,56,59,0.22)] [transition:box-shadow_0.45s_ease,translate_0.45s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:shadow-[0_18px_34px_rgba(1,56,59,0.3)]"
              >
                {status.key === "past"
                  ? "Enquire about the next edition"
                  : `Book a meeting at ${exhibition.name.split(" ")[0]}`}
              </Link>

              {/* Through to the show's own page. Only rendered for records
                  that have a slug — the bundled seed entries do not, and a
                  link to /Exhibition/undefined would dead-end. */}
              {exhibition.slug && (
                <Link
                  to={`/Exhibition/${exhibition.slug}`}
                  className="inline-flex items-center gap-[8px] rounded-full border-[1px] border-[#C9A15A] px-[26px] py-[14px] font-ticker text-[0.92rem] font-medium text-[#01383B] no-underline transition-colors duration-300 hover:bg-[#C9A15A] hover:text-white"
                >
                  Full details
                  <span aria-hidden="true">&#8594;</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
