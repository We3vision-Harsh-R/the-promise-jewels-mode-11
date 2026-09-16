/**
 * Exhibition data — single source of truth for the /Exhibition page, the
 * homepage Exhibition Highlights section and the JSON-LD event schema.
 *
 * Every field below was cross-checked against the organisers' own sites in
 * August 2026 (see `sources` on each entry). The values that were in the app
 * before this file existed were wrong in several places and are noted inline
 * so nobody "corrects" them back.
 *
 * DATES ARE THE ONE THING THAT GOES STALE. Re-check `sources` before each
 * season and update `venues[].start` / `.end` — everything on the page
 * (status, countdown, schema, sorting) is derived from those two fields, so
 * that is the only edit needed.
 */

// Per-venue schedule, because IIJS genuinely runs different dates at each of
// its two venues — modelling it as one range would misinform visitors.
export const EXHIBITIONS = [
  {
    id: "iijs-bharat-premiere-2026",
    name: "IIJS Bharat Premiere",
    year: 2026,
    edition: "42nd Edition",
    logo: "/images/Exhibition/IIJS.webp",
    organiser: "Gem & Jewellery Export Promotion Council (GJEPC)",
    city: "Mumbai",
    region: "Maharashtra, India",
    audience: "B2B — trade buyers, retailers and international importers",
    hours: "10:00 – 19:00",
    // Two venues, staggered by one day, with shuttle service between them.
    venues: [
      {
        name: "Jio World Convention Centre",
        area: "BKC, Mumbai",
        start: "2026-08-05",
        end: "2026-08-09",
      },
      {
        name: "Bombay Exhibition Centre (NESCO)",
        area: "Goregaon, Mumbai",
        start: "2026-08-06",
        end: "2026-08-10",
      },
    ],
    // "Why" — what this show is for, and why Promise Jewels attends.
    about:
      "IIJS Bharat Premiere is the largest gem and jewellery trade show in India and the second largest in the world. Organised by GJEPC, it brings the entire supply chain — manufacturers, exporters, retailers and technology partners — into one buying season.",
    whyWeExhibit:
      "This is where we meet our national retail partners and international buyers in a single week. Bulk order books for the festive and bridal season are largely written here, so it anchors our manufacturing calendar for the year.",
    highlights: [
      "2,100+ exhibitors across roughly 3,600 stalls",
      "Over 135,000 sq. metres across the two venues",
      "50,000+ trade visitors expected",
      "2,700+ international buyers from 80+ countries",
    ],
    sources: [
      "https://gjepc.org/iijs-premiere/show-details.php",
      "https://retailjewellerindia.com/iijs-bharat-premiere-2026-begins-amid-stronger-global-market-access-for-indian-jewellery-exporters/",
    ],
    datesConfirmed: true,
  },
  {
    id: "ggjs-gujarat-gold-jewellery-show",
    name: "GGJS — Gujarat Gold Jewellery Show",
    year: 2026,
    edition: "16th Edition",
    logo: "/images/Exhibition/ggjs.webp",
    organiser: "Gujarat Gold Jewellery Show",
    // NOTE: the app previously listed this as "Ahmedabad" — the show is
    // actually held in Gandhinagar, at the Helipad Exhibition Centre.
    city: "Gandhinagar",
    region: "Gujarat, India",
    audience: "B2B — jewellers, wholesalers and distributors",
    hours: "10:00 – 19:00",
    venues: [
      {
        name: "Helipad Exhibition Centre (HEC)",
        area: "Gandhinagar, Gujarat",
        start: "2026-10-09",
        end: "2026-10-11",
      },
    ],
    about:
      "GGJS is Gujarat's flagship gold jewellery trade exhibition, built around the state's retail network. It runs as a complete business ecosystem — product launches, buyer networking and industry seminars alongside the exhibition floor.",
    whyWeExhibit:
      "Gujarat is our home market and our manufacturing base. GGJS is where we show new gold lines to the regional retailers we supply directly, and where long-standing accounts see the full range in one place.",
    highlights: [
      "Gujarat's flagship B2B gold jewellery show",
      "Regional retail and wholesale buyer base",
      "Product launches and industry seminars",
    ],
    sources: [
      "https://www.ggjs.co.in/",
      "https://www.eventseye.com/fairs/f-ggjs-gujarat-gold-jewellery-show-23038-1.html",
    ],
    // Sources disagree on this one — an exhibition directory lists
    // 9–11 October 2026 while another listing shows April 2027, and the
    // organiser's own site does not publish dates on its landing page.
    // Confirm with the organiser before promoting these dates.
    datesConfirmed: false,
  },
  {
    id: "rootz-2026",
    name: "ROOTZ — Gems & Jewellery Manufacturers' Show",
    year: 2026,
    edition: "6th Edition",
    logo: "/images/Exhibition/Rootz.webp",
    organiser: "Surat Jewellery Manufacturers' Association (SJMA)",
    // NOTE: previously a placeholder ("Exhibition Centre, City"). ROOTZ is
    // held in Surat, at SIECC.
    city: "Surat",
    region: "Gujarat, India",
    audience: "B2B — manufacturers, retailers, wholesalers and exporters",
    hours: "10:00 – 19:00",
    venues: [
      {
        name: "Surat International Exhibition & Convention Centre (SIECC)",
        area: "Surat, Gujarat",
        start: "2026-12-04",
        end: "2026-12-06",
      },
    ],
    about:
      "ROOTZ is organised by the Surat Jewellery Manufacturers' Association in Surat — India's jewellery manufacturing hub. It covers the full manufacturing ecosystem: gold, diamond, silver and platinum jewellery alongside casting, CNC, machinery, packaging and allied technology.",
    whyWeExhibit:
      "ROOTZ is a manufacturer's show, held in the city where the craft lives. It is the best place to talk process and capability rather than catalogue — sourcing partners, technology suppliers and trade buyers all in one room.",
    highlights: [
      "Organised by SJMA in India's jewellery manufacturing hub",
      "Covers manufacturing, machinery and allied technology",
      "Trade-only sourcing and networking platform",
    ],
    sources: [
      "https://www.rootzexpo.com/",
      "https://www.rootzexpo.com/pages/rootz/",
    ],
    datesConfirmed: true,
  },
];

const MS_PER_DAY = 86400000;

export function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Earliest opening day / latest closing day across all of a show's venues.
 *
 * Deliberately total: every branch returns a usable range and nothing here
 * can throw. Records reaching this function come from the admin panel as
 * well as the seed above, and `venues` is a nullable column there — reading
 * `.map` off it straight took the whole /Exhibition page down to a blank
 * screen, because one bad record threw during render. Falling back to the
 * record's own start/end, and then to today, keeps a half-filled show as a
 * row with odd dates rather than a page nobody can load.
 */
export function getRange(exhibition) {
  const venues = Array.isArray(exhibition?.venues) ? exhibition.venues : [];

  const starts = venues.map((venue) => startOfDay(venue?.start)).filter(isValidDate);
  const ends = venues.map((venue) => startOfDay(venue?.end)).filter(isValidDate);

  if (starts.length > 0 && ends.length > 0) {
    return {
      start: new Date(Math.min(...starts)),
      end: new Date(Math.max(...ends)),
    };
  }

  // Records that never had a per-venue schedule still carry a flat span.
  const flatStart = startOfDay(exhibition?.startDate ?? exhibition?.start_date);
  const flatEnd = startOfDay(exhibition?.endDate ?? exhibition?.end_date);

  if (isValidDate(flatStart) && isValidDate(flatEnd)) {
    return { start: flatStart, end: flatEnd };
  }

  const today = startOfDay(new Date());
  return { start: today, end: today };
}

/**
 * 'live' while any venue is open, 'past' once the last one closes, otherwise
 * 'upcoming' with the whole-day count until the first door opens.
 */
export function getStatus(exhibition, today = startOfDay(new Date())) {
  const { start, end } = getRange(exhibition);

  if (today > end) return { key: "past", label: "Concluded", days: 0 };
  if (today >= start) return { key: "live", label: "Happening Now", days: 0 };

  return {
    key: "upcoming",
    label: "Upcoming",
    days: Math.round((start - today) / MS_PER_DAY),
  };
}

const DATE_FMT = { day: "numeric", month: "long", year: "numeric" };
const DAY_MONTH_FMT = { day: "numeric", month: "long" };

/** "4 – 6 December 2026", collapsing the month when both ends share it. */
export function formatRange(start, end) {
  const from = startOfDay(start);
  const to = startOfDay(end);
  const sameMonth =
    from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();

  const left = sameMonth
    ? from.toLocaleDateString("en-GB", { day: "numeric" })
    : from.toLocaleDateString("en-GB", DAY_MONTH_FMT);

  return `${left} – ${to.toLocaleDateString("en-GB", DATE_FMT)}`;
}

/** Upcoming and live shows first (soonest first), concluded ones last. */
export function sortForDisplay(exhibitions, today = startOfDay(new Date())) {
  return [...exhibitions].sort((a, b) => {
    const aPast = getStatus(a, today).key === "past";
    const bPast = getStatus(b, today).key === "past";
    if (aPast !== bPast) return aPast ? 1 : -1;
    return getRange(a).start - getRange(b).start;
  });
}
