import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import useReveal from "@/hooks/useReveal.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";
import { CHROME } from "@/pages/Home/homeChrome.js";
import { typeStyle } from "@/features/page-content/typeStyle.js";
import { listExhibitions } from "@/features/exhibitions/exhibition.api.js";
import {
  formatRange,
  getRange,
  sortForDisplay,
} from "@/features/exhibitions/data/exhibitions.js";

// Fallback only. The cards normally come from Admin > Exhibitions — the same
// records the /Exhibition page renders — via listExhibitions() below. These
// three stand in while that request is in flight, if it fails, or while no
// show has been added yet.
const BUNDLED_EXHIBITIONS = [
  {
    id: "rootz",
    name: "ROOTZ",
    logo: "/images/Exhibition/Rootz.webp",
    title: "Rootz Gems & Jewellery Manufacturers Show",
    startDate: "2026-12-04",
    endDate: "2026-12-06",
    dateLabel: "4 – 6 December 2026",
    venue: "Exhibition Centre, City",
    note: "Trade Only",
  },
  {
    id: "iijs",
    name: "IIJS Bharat",
    logo: "/images/Exhibition/IIJS.webp",
    title: "IIJS Bharat – Premiere 2026",
    startDate: "2026-08-05",
    endDate: "2026-08-09",
    dateLabel: "05 – 09 August 2026",
    venue: "Jio World Convention Centre (BKC) & Bombay Exhibition Centre",
    note: "Mumbai, India",
  },
  {
    id: "ggjs",
    name: "GJS",
    logo: "/images/Exhibition/ggjs.webp",
    title: "Gujarat Gold Jewellery Show",
    startDate: "2027-01-12",
    endDate: "2027-01-15",
    dateLabel: "12 – 15 January 2027",
    venue: "Exhibition Centre, Ahmedabad",
    note: "Gujarat, India",
  },
];

// Copy bundled with the site. Admin > Editor > Home page overrides these at
// runtime; the events themselves are separate data (see EXHIBITIONS above).
const EXHIBITION_TEXT = {
  titleLight: "Exhibition",
  titleBold: "Highlights",
  subtitle: "Upcoming Events",

  // Shades, one per string, matching the Editor. useSectionContent reads only
  // the keys this fallback declares.
  titleLightColor: "#01383B",
  titleLightColorTo: "#3E9C86",
  titleBoldColor: "#01383B",
  titleBoldColorTo: "#3E9C86",
  subtitleColor: "#0E4238",
};


const MS_PER_DAY = 86400000;

// Mobile/tablet ordering. Written out as literal strings — Tailwind scans
// source text, so a template-built `order-${i}` would never be generated.
// Below 1025px each logo is immediately followed by its own details card:
// 1-col => logo, details, logo, details… / 2-col => one event per row.
//
// Written out to MAX_CARDS pairs rather than three, now that the number of
// shows comes from the database and is not known here. A template-built
// `order-${i}` would never generate, which is the whole reason these are
// literals.
const LOGO_ORDER = [
  "max-[1024px]:order-1",
  "max-[1024px]:order-3",
  "max-[1024px]:order-5",
  "max-[1024px]:order-7",
  "max-[1024px]:order-9",
  "max-[1024px]:order-11",
];
const DETAIL_ORDER = [
  "max-[1024px]:order-2",
  "max-[1024px]:order-4",
  "max-[1024px]:order-6",
  "max-[1024px]:order-8",
  "max-[1024px]:order-10",
  "max-[1024px]:order-12",
];

// The homepage is a teaser, not the full schedule — /Exhibition lists every
// show. Capped at the number of order pairs above; raise both together.
const MAX_CARDS = LOGO_ORDER.length;

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

// 'live' while the show is running, 'past' once it has closed, otherwise
// 'upcoming' plus the whole-day count until the doors open.
function getStatus(item, today) {
  const start = startOfDay(item.startDate);
  const end = startOfDay(item.endDate);

  if (today > end) return { key: "past", label: "Concluded" };
  if (today >= start) return { key: "live", label: "Live Now" };

  const days = Math.round((start - today) / MS_PER_DAY);
  return { key: "upcoming", label: `${days} Days To Go` };
}

const PILL_STYLES = {
  upcoming: "bg-[#F1F7F5] text-[var(--pj-body)] border-[#D3E6E2]",
  live: "bg-[var(--pj-accent)] text-white border-[var(--pj-accent)]",
  past: "bg-[#F2F4F4] text-[var(--pj-muted)] border-[#E1E7E6]",
};

const ICON_CLASSES = "w-[18px] h-[18px] max-[430px]:w-[16px] max-[430px]:h-[16px]";

function CalendarIcon() {
  return (
    <svg className={ICON_CLASSES} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className={ICON_CLASSES} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg className={ICON_CLASSES} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8.5 14.5 7 22l5-2.6L17 22l-1.5-7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Fixed icon column + fixed label line, so the Dates / Venue / Entry rows sit
// on the same baseline across all three cards regardless of text length.
//
// `reserve` holds two lines of space for values that wrap on some events but
// not others (venues), keeping the row below it aligned across all three
// cards. It is 3em — 2 lines x the 1.5 line-height — rather than a rem value,
// so it stays exactly two lines as the font size drops at each breakpoint.
function DetailRow({ icon, label, value, reserve = false }) {
  return (
    <div className="flex items-start gap-[13px] text-left">
      <span className="shrink-0 mt-[3px] text-[var(--pj-accent)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[0.66rem] tracking-[0.18em] uppercase text-white/45 max-[430px]:text-[0.69rem]">
          {label}
        </p>
        <p
          className={`mt-[4px] text-[0.95rem] leading-[1.5] text-white/90 min-[768px]:max-[1024px]:text-[0.9rem] max-[430px]:text-[0.85rem] ${
            reserve ? "[min-height:3em]" : ""
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

const CARD_MOTION =
  "[transition:transform_0.5s_cubic-bezier(0.22,1,0.36,1),box-shadow_0.5s_ease,border-color_0.5s_ease] " +
  "hover:-translate-y-[7px]";

/**
 * Flattens one API record into the six things a card draws. The /Exhibition
 * page reads the same records in full; this section is the short version, so
 * the mapping lives here rather than every card knowing the model.
 */
function toCard(row) {
  const { start, end } = getRange(row);
  const venues = Array.isArray(row.venues) ? row.venues : [];

  return {
    id: row.id,
    name: row.name ?? row.title,
    logo: row.logo ?? row.thumbnailUrl ?? "",
    title: row.title,
    startDate: start,
    endDate: end,
    dateLabel: formatRange(start, end),
    // One line per hall when a show runs across more than one.
    venue: venues.length
      ? venues.map((venue) => venue.name).filter(Boolean).join(" & ")
      : row.venue || "Venue to be announced",
    note: row.location || [row.city, row.country].filter(Boolean).join(", ") || "Trade Only",
  };
}

export default function Exhibition() {
  const text = useSectionContent("home", "exhibition", EXHIBITION_TEXT);
  const sectionRef = useRef(null);

  // Same records the /Exhibition page and the admin panel use, so a show
  // edited there changes here too. The bundled three stay on screen until
  // real ones arrive, and stay for good if the request fails.
  const [records, setRecords] = useState(BUNDLED_EXHIBITIONS);

  useEffect(() => {
    let cancelled = false;

    listExhibitions()
      .then((rows) => {
        if (cancelled || !rows?.length) return;
        setRecords(rows.map(toCard));
      })
      .catch(() => {
        /* keep the bundled cards already in state */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Midnight today, computed once — every countdown below is derived from
  // this so the whole section agrees on "now".
  const today = useMemo(() => startOfDay(new Date()), []);

  const events = useMemo(
    () =>
      sortForDisplay(records, today)
        .slice(0, MAX_CARDS)
        .map((item) => ({ ...item, status: getStatus(item, today) })),
    [records, today]
  );

  // `deps` matters because the cards arrive from an async request: without it
  // the reveal would run once against the bundled three and every card that
  // replaced them would stay at opacity 0.
  useReveal(sectionRef, { deps: [events] });

  useGSAP(
    () => {
      // Very slow breathing glow behind each logo — staggered so the three
      // never pulse in unison.
      gsap.to(".js-glow", {
        scale: 1.12,
        opacity: 0.75,
        duration: 3.2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.8,
      });
    },
    sectionRef,
    // Re-created when the live cards swap in, for the same reason as above.
    [events]
  );

  return (
    <section
      ref={sectionRef}
      style={CHROME}
      className="w-full py-[90px] px-[8%] bg-[#F6FAF9] text-center max-[430px]:py-[56px] max-[430px]:px-[5%]"
    >
      <h2 className="text-[4rem] font-normal mt-0 mb-[14px] font-ticker min-[768px]:max-[1024px]:text-[3.2rem] max-[430px]:text-[1.9rem]">
        <span
          className="bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
          style={{
            ...typeStyle(text, "titleLight"),
            backgroundImage: `linear-gradient(180deg, ${text.titleLightColor} 0%, ${text.titleLightColorTo} 100%)`,
          }}
        >
          {text.titleLight}
        </span>{" "}
        <strong
          className="font-semibold font-ticker bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
          style={{
            ...typeStyle(text, "titleBold"),
            backgroundImage: `linear-gradient(180deg, ${text.titleBoldColor} 0%, ${text.titleBoldColorTo} 100%)`,
          }}
        >
          {text.titleBold}
        </strong>
      </h2>
      <p
        style={{ color: text.subtitleColor, ...typeStyle(text, "subtitle") }}
        className="[font-family:cursive] text-[2rem] mt-0 mb-[56px] min-[768px]:max-[1024px]:text-[1.7rem] min-[768px]:max-[1024px]:mb-[40px] max-[430px]:text-[1.35rem] max-[430px]:mb-[30px]"
      >
        {text.subtitle}
      </p>

      <div className="mx-auto w-full max-w-[1320px] grid grid-cols-3 gap-x-[26px] gap-y-[14px] max-[1024px]:grid-cols-2 max-[1024px]:gap-x-[20px] max-[1024px]:gap-y-[12px] max-[640px]:grid-cols-1 max-[640px]:gap-[12px]">
        {/* Row 1 — logos */}
        {events.map((item, index) => (
          <article
            key={`${item.id}-logo`}
            data-reveal
            className={`js-logo-card ${CARD_MOTION} ${LOGO_ORDER[index]} relative flex flex-col items-center justify-center overflow-hidden rounded-[24px] border-[1px] border-[#E3EFEC] bg-white px-[30px] pt-[30px] pb-[26px] shadow-[0_10px_30px_rgba(1,56,59,0.06)] hover:border-[var(--pj-accent)]/45 hover:shadow-[0_26px_50px_rgba(1,56,59,0.13)] max-[430px]:rounded-[20px] max-[430px]:px-[20px] max-[430px]:pt-[22px] max-[430px]:pb-[18px]`}
          >
            <span
              className={`absolute top-[18px] right-[18px] z-[3] rounded-full border-[1px] px-[13px] py-[6px] text-[0.66rem] font-medium tracking-[0.14em] uppercase max-[430px]:top-[12px] max-[430px]:right-[12px] max-[430px]:px-[10px] max-[430px]:py-[5px] max-[430px]:text-[0.69rem] ${PILL_STYLES[item.status.key]}`}
            >
              {item.status.label}
            </span>

            <div className="relative flex h-[210px] w-full items-center justify-center min-[768px]:max-[1024px]:h-[180px] max-[430px]:h-[140px]">
              <span className="js-glow pointer-events-none absolute h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgba(11,91,93,0.10)_0%,rgba(11,91,93,0)_70%)] opacity-55 max-[430px]:h-[160px] max-[430px]:w-[160px]" />
              <img
                src={item.logo}
                alt={item.name}
                loading="lazy"
                className="relative z-[2] max-h-full max-w-[90%] object-contain"
              />
            </div>

            <p className="mt-[14px] text-[0.7rem] tracking-[0.28em] uppercase text-[var(--pj-body)]/55 max-[430px]:mt-[10px] max-[430px]:text-[0.72rem]">
              {item.name}
            </p>
          </article>
        ))}

        {/* Row 2 — matching details, one per logo above */}
        {events.map((item, index) => (
          <article
            key={`${item.id}-details`}
            data-reveal
            className={`js-detail-card ${CARD_MOTION} ${DETAIL_ORDER[index]} relative flex flex-col overflow-hidden rounded-[24px] border-[1px] border-[var(--pj-heading)] bg-gradient-to-br from-[var(--pj-heading)] via-[var(--pj-body)] to-[var(--pj-heading-alt)] p-[30px] text-left shadow-[0_18px_40px_rgba(1,56,59,0.22)] hover:shadow-[0_30px_60px_rgba(1,56,59,0.32)] max-[430px]:rounded-[20px] max-[430px]:p-[22px]`}
          >
            {/* Soft gold sheen in the corner — depth without a heavy overlay */}
            <span className="pointer-events-none absolute -top-[70px] -right-[70px] h-[190px] w-[190px] rounded-full bg-[radial-gradient(circle,rgba(201,161,90,0.22)_0%,rgba(201,161,90,0)_70%)]" />

            <h3 className="relative z-[2] min-h-[3.6rem] text-[1.2rem] leading-[1.4] font-medium text-white font-ticker min-[768px]:max-[1024px]:text-[1.1rem] max-[430px]:min-h-0 max-[430px]:text-[1.02rem]">
              {item.title}
            </h3>

            <span className="relative z-[2] mt-[16px] mb-[22px] block h-px w-full bg-gradient-to-r from-[var(--pj-accent)] via-[var(--pj-accent)]/35 to-transparent max-[430px]:mt-[12px] max-[430px]:mb-[16px]" />

            <div className="relative z-[2] flex flex-col gap-[18px] max-[430px]:gap-[14px]">
              <DetailRow icon={<CalendarIcon />} label="Dates" value={item.dateLabel} />
              <DetailRow icon={<PinIcon />} label="Venue" value={item.venue} reserve />
              <DetailRow icon={<BadgeIcon />} label="Entry & Region" value={item.note} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
