import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeroCircle from "@/components/layout/PageHeroCircle.jsx";
import SectionHeading from "@/components/common/SectionHeading.jsx";
import Footer from "@/components/common/Footer.jsx";
import InquiryForm from "@/features/inquiries/components/InquiryForm.jsx";
import usePublicSettings from "@/features/settings/hooks/usePublicSettings.js";
import usePublicExhibition from "@/features/exhibitions/hooks/usePublicExhibition.js";
import { formatRange, getStatus } from "@/features/exhibitions/data/exhibitions.js";
import { useSeoMeta } from "@/features/seo/hooks/useSeoMeta.js";

const STATUS_PILL = {
  upcoming: "bg-[#F1F7F5] text-[#0B5B5D] border-[#D3E6E2]",
  live: "bg-[#C9A15A] text-white border-[#C9A15A]",
  past: "bg-[#F2F4F4] text-[#7C8F8C] border-[#E1E7E6]",
};

/**
 * One labelled fact. `children` rather than a string so dates can use <time>,
 * and so a fact can hold one line per venue.
 */
function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.64rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#0B5B5D]/55">
        {label}
      </dt>
      <dd className="mt-[6px] text-[0.98rem] leading-[1.6] text-[#01383B]">{children}</dd>
    </div>
  );
}

/** A headed block — used for the written copy and for each custom section. */
function Panel({ title, children, tone = "plain" }) {
  return (
    <section
      className={`rounded-[20px] border-[1px] p-[26px] max-[479px]:p-[20px] ${
        tone === "tinted"
          ? "border-[#DCEAE7] bg-[#F6FAF9]"
          : "border-[#DCEAE7] bg-white"
      }`}
    >
      <span className="mb-[14px] flex items-center gap-[10px]">
        <span className="h-px w-[24px] bg-[#C9A15A]" />
        <span className="text-[0.64rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#C9A15A]">
          {title}
        </span>
      </span>
      {children}
    </section>
  );
}

/**
 * Public page for ONE exhibition — route: /Exhibition/:slug.
 *
 * Every show entered in Admin > Exhibitions gets one of these, and adding a
 * show is all it takes to create its page. Nothing here is bundled with the
 * site: the record, its photographs and its custom sections all arrive from
 * Supabase in a single `GET /exhibitions/:slug`.
 *
 * The order deliberately mirrors the admin form, so what you type there and
 * what a visitor reads here line up field for field: name and year, edition,
 * status, about, then the facts (dates and venues, location, show hours, who
 * attends, organised by), then why we exhibit, highlights, any custom
 * sections, and finally the photographs.
 */
export default function ExhibitionDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { social } = usePublicSettings();
  const { exhibition, loading } = usePublicExhibition(slug);

  // A per-show SEO record if one exists in /admin/seo; no-ops otherwise.
  useSeoMeta(`exhibition-${slug || ""}`);

  // Holding the layout until the record lands avoids rendering a heading with
  // no name in it for a frame.
  if (loading) return null;

  if (!exhibition) {
    return (
      <>
        <section className="flex min-h-[60vh] w-full flex-col items-center justify-center bg-white px-[8%] text-center">
          <SectionHeading light="Exhibition" bold="not found" className="text-center" />
          <p className="mt-[18px] max-w-[520px] text-[1rem] leading-[1.7] text-[#0B5B5D]/75">
            This show is no longer listed, or the link is wrong.
          </p>
          <Link
            to="/Exhibition"
            className="mt-[26px] inline-flex items-center rounded-full border-[1px] border-[#C9A15A] px-[26px] py-[12px] font-ticker text-[0.92rem] font-medium text-[#01383B] no-underline transition-colors duration-300 hover:bg-[#C9A15A] hover:text-white"
          >
            See all exhibitions
          </Link>
        </section>
        <Footer />
      </>
    );
  }

  const status = getStatus(exhibition);
  const gallery = (exhibition.gallery ?? []).filter((image) => image?.image_url);
  const customSections = exhibition.customSections ?? [];
  const location =
    exhibition.location ||
    [exhibition.city, exhibition.country].filter(Boolean).join(", ");

  return (
    <>
      <PageHeroCircle
        eyebrow={exhibition.edition || "Exhibition"}
        title={exhibition.name}
        subtitle={exhibition.about}
        ctaText="Book a meeting"
        onCtaClick={() => navigate("/contact")}
        secondaryCtaText="All exhibitions"
        onSecondaryCtaClick={() => navigate("/Exhibition")}
        socialLinks={social}
        showTicker={false}
      />

      <section className="w-full bg-white px-[8%] pb-[80px] pt-[10px] max-[1024px]:pb-[60px] max-[479px]:px-[6%] max-[479px]:pb-[44px]">
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,380px)_1fr] items-start gap-[60px] max-[1024px]:grid-cols-1 max-[1024px]:gap-[32px]">
          {/* Logo panel — falls back to the show's name when no logo is set
              or the stored URL no longer resolves. */}
          <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[26px] bg-white shadow-[0_22px_46px_rgba(1,56,59,0.12)] max-[479px]:rounded-[18px]">
            {exhibition.logo ? (
              <img
                src={exhibition.logo}
                alt={`${exhibition.name} logo`}
                className="relative z-[2] max-h-[62%] max-w-[74%] object-contain"
              />
            ) : (
              <span className="px-[10%] text-center font-ticker text-[1.3rem] font-medium leading-tight text-[#01383B]/35">
                {exhibition.name}
              </span>
            )}
            <span className="pointer-events-none absolute inset-[14px] rounded-[18px] border-[1px] border-[#C9A15A]/30 max-[479px]:inset-[10px] max-[479px]:rounded-[13px]" />
          </div>

          <div className="min-w-0">
            <div className="mb-[16px] flex flex-wrap items-center gap-[12px]">
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

            <h1 className="m-0 font-ticker text-[2.4rem] font-medium leading-[1.15] text-[#01383B] max-[1024px]:text-[2rem] max-[479px]:text-[1.55rem]">
              {exhibition.name}{" "}
              {exhibition.year && (
                <span className="text-[#0B5B5D]/55">{exhibition.year}</span>
              )}
            </h1>

            {exhibition.about && (
              <p className="mt-[18px] max-w-[680px] whitespace-pre-line text-[1rem] leading-[1.75] text-[#0B5B5D]/80 max-[479px]:text-[0.92rem]">
                {exhibition.about}
              </p>
            )}

            <dl className="mt-[32px] grid grid-cols-2 gap-x-[34px] gap-y-[22px] max-[639px]:grid-cols-1 max-[639px]:gap-y-[18px]">
              <Fact label="Dates">
                {/* One line per venue — a show can open on different days at
                    each hall, which a single range cannot express. */}
                {exhibition.venues.map((venue) => (
                  <span key={`${venue.name}-${venue.start}`} className="block">
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

              <Fact label="Venue">
                {exhibition.venues.map((venue) => (
                  <span key={venue.name} className="block">
                    {venue.name}
                    {venue.area && <span className="text-[#0B5B5D]/60"> — {venue.area}</span>}
                  </span>
                ))}
              </Fact>

              {location && <Fact label="City / Region">{location}</Fact>}

              {exhibition.hours && <Fact label="Show Hours">{exhibition.hours} daily</Fact>}

              {exhibition.audience && <Fact label="Who Attends">{exhibition.audience}</Fact>}

              {exhibition.organiser && <Fact label="Organised By">{exhibition.organiser}</Fact>}
            </dl>
          </div>
        </div>

        {/* Everything below is optional per show, and each block drops out
            entirely when its field is empty rather than printing a heading
            over nothing. */}
        <div className="mx-auto mt-[46px] grid w-full max-w-[1240px] gap-[20px] max-[1024px]:mt-[34px]">
          {exhibition.whyWeExhibit && (
            <Panel title="Why We Exhibit" tone="tinted">
              <p className="m-0 whitespace-pre-line text-[0.98rem] leading-[1.75] text-[#01383B]">
                {exhibition.whyWeExhibit}
              </p>
            </Panel>
          )}

          {exhibition.highlights.length > 0 && (
            <Panel title="Highlights">
              <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
                {exhibition.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-[11px] text-[0.95rem] leading-[1.6] text-[#0B5B5D]/85"
                  >
                    <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rotate-45 bg-[#C9A15A]" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* Operator-defined blocks from Admin > Exhibitions > Custom
              sections. Rendered generically, so a section added tomorrow needs
              no change to this file. */}
          {customSections.map((section) => (
            <Panel key={section.title} title={section.title}>
              <dl className="grid grid-cols-2 gap-x-[34px] gap-y-[16px] max-[639px]:grid-cols-1">
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
            </Panel>
          ))}
        </div>

        {gallery.length > 0 && (
          <div className="mx-auto mt-[46px] w-full max-w-[1240px] max-[1024px]:mt-[34px]">
            <SectionHeading light="From the" bold="Show" className="text-center" />
            <div className="mt-[30px] grid grid-cols-4 gap-[16px] max-[1024px]:grid-cols-3 max-[639px]:grid-cols-2 max-[479px]:gap-[10px]">
              {gallery.map((image) => (
                <span
                  key={image.id ?? image.image_url}
                  className="aspect-square overflow-hidden rounded-[16px] bg-[#F1F6F5] max-[479px]:rounded-[10px]"
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
          </div>
        )}
      </section>

      <InquiryForm id="inquiry" defaultCollection="" />

      <Footer />
    </>
  );
}
