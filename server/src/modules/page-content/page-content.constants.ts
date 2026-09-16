// Editable text on the public website.
//
// This file is the single source of truth for the Editor in the admin panel.
// Every editable string on a page is declared here with its label, its input
// type and — importantly — the copy the site shipped with as its `default`.
//
// Nothing is written to the database until an admin saves. The website merges
// whatever IS saved over the same defaults declared below (each component
// keeps its own copy as a literal fallback), so an empty table, an untouched
// field or a failed request all render the page exactly as it looked before
// it became editable.
//
// Adding a new editable string is one entry here plus reading it in the
// component — no schema change, because page_content stores key/value rows.

export type FieldType =
  | "text"
  | "textarea"
  /** A hex colour. Rendered as a picker plus the brand palette. */
  | "color"
  /** A photograph. Stored as the uploaded asset's URL. */
  | "image"
  /** An icon. SVG only, so its colour can be driven from here. */
  | "svg"
  /** A plain number — a speed, a count, a percentage. */
  | "number"
  /** One of the brand's typefaces, applied to a single piece of copy. */
  | "font"
  /** A font size in pixels, applied to a single piece of copy. */
  | "fontsize"
  /** A font weight, applied to a single piece of copy. */
  | "weight"
  /** Letter spacing in em, applied to a single piece of copy. */
  | "spacing";

export interface ContentField {
  /** Stored in page_content.field. Dotted keys group repeated rows. */
  key: string;
  label: string;
  type: FieldType;
  default: string;
  /** Optional sub-heading so repeated rows read as a set in the admin form. */
  group?: string;
  hint?: string;
  max: number;
  /** number only: the range the slider covers and what the value is measured in. */
  min?: number;
  step?: number;
  unit?: string;
}

export interface ContentSection {
  key: string;
  label: string;
  description: string;
  fields: ContentField[];
  /**
   * Set when the content shown in this part of the page is owned by another
   * admin screen — collections, brands, exhibitions. Rather than duplicating
   * those records here (two places to edit, two places to disagree), the
   * Editor shows a link through to the screen that actually owns them.
   */
  manage?: { label: string; path: string };
  /**
   * A band with no editable words of its own — a listing, a form, a grid of
   * records. It is declared anyway because it is part of the page, and the
   * arrangement cannot move or hide what it does not know exists.
   *
   * The Editor shows these as a card that says so rather than an empty form.
   */
  structural?: boolean;
}

/**
 * The brand's colours, offered beside every colour picker.
 *
 * Without this an editor gets a bare colour wheel, invents a slightly
 * different teal each time, and the site drifts out of its own palette one
 * page at a time. Picking off this list is the easy path; a custom colour is
 * still allowed, but it becomes a deliberate choice rather than an accident.
 */

/**
 * The typefaces an admin may choose, and the weights and sizes they may set.
 *
 * These are the ONLY accepted values. Every one of them ends up inside an
 * inline `style` on the public site, so the server checks each against these
 * lists on save (page-content.service.ts) rather than trusting whatever the
 * form posted — a font name is a CSS fragment, not a label.
 *
 * Ringtte and Optika are the two the site was built in. Amiora, Choase and
 * Giliant were sitting unused in /public/fonts with no @font-face rule, so
 * they could not be applied to anything; globals.css now declares all five.
 */
export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Ringtte — display", value: "Ringtte" },
  { label: "Optika — body", value: "Optika" },
  { label: "Amiora", value: "Amiora" },
  { label: "Choase", value: "Choase" },
  { label: "Giliant", value: "Giliant" },
];

export const FONT_WEIGHTS: { label: string; value: string }[] = [
  { label: "Light (300)", value: "300" },
  { label: "Regular (400)", value: "400" },
  { label: "Medium (500)", value: "500" },
  { label: "Semi-bold (600)", value: "600" },
  { label: "Bold (700)", value: "700" },
];

/** Font size bounds, in px. Anything outside this is refused on save. */
export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 200;

/** Letter-spacing bounds, in em. */
export const LETTER_SPACING_MIN = -0.2;
export const LETTER_SPACING_MAX = 1;

export const BRAND_PALETTE: { label: string; value: string }[] = [
  { label: "Emerald — deep", value: "#01383B" },
  { label: "Emerald", value: "#0E4238" },
  { label: "Teal — deep", value: "#0B5B5D" },
  { label: "Teal", value: "#286F6F" },
  { label: "Teal — light", value: "#3E9C86" },
  { label: "Muted teal", value: "#2F6B6B" },
  { label: "Sage", value: "#7C8F8C" },
  { label: "Gold — deep", value: "#A87F3D" },
  { label: "Gold", value: "#C9A15A" },
  { label: "Gold — light", value: "#D4B45C" },
  { label: "Champagne", value: "#E8CB92" },
  { label: "Ivory", value: "#F7F3EA" },
  { label: "White", value: "#FFFFFF" },
  { label: "Ink — 900", value: "#111827" },
  { label: "Ink — 600", value: "#4B5563" },
  { label: "Ink — 400", value: "#9CA3AF" },
  { label: "Rose", value: "#B3564B" },
];

// --- field builders -------------------------------------------------------
//
// The declarations below repeat a lot: nearly every colour is the same shape
// with a different key. These keep the page definitions readable, so what a
// section contains is visible at a glance instead of buried in punctuation.

/** A colour, offered alongside the brand palette. */
function colour(
  key: string,
  label: string,
  value: string,
  group = "Colours",
): ContentField {
  return { key, label, type: "color", default: value, group, max: 32 };
}

/**
 * The colour of ONE piece of copy, declared immediately after the field that
 * holds that copy.
 *
 * The Home page used to carry a single "Colours" section at the top: six
 * shades applied to the whole page at once through CSS variables. It was the
 * only colour control that worked, and it was all-or-nothing — an admin who
 * wanted the Welcome heading a different teal from the Pillars heading could
 * not have it, because both read the same variable. Worse, several sections
 * ALSO declared their own colour fields, which the components never read: a
 * page-wide value silently overrode a field that had never been wired up, so
 * the panel offered a setting that did nothing.
 *
 * Colours now sit beside the words they tint, so the pairing is visible in
 * the form rather than something you have to know. Each is scoped to its own
 * section — nothing on this page overrides anything else on it.
 *
 * The key is the text field's own key with "Color" appended, and the label is
 * its own label, so a colour is always readable as belonging to the field
 * above it.
 */
function tint(
  key: string,
  label: string,
  value: string,
  group?: string,
  hint?: string,
): ContentField {
  return {
    key: `${key}Color`,
    label: `${label} — colour`,
    type: "color",
    default: value,
    group,
    hint,
    max: 32,
  };
}

/**
 * The two ends of a gradient, for copy the design paints top-to-bottom rather
 * than in one flat shade — the big section headings and the scrolling names.
 *
 * Set both to the same value for a solid colour; the gradient is what the
 * site shipped with, so the defaults reproduce it exactly.
 */
function fade(
  key: string,
  label: string,
  from: string,
  to: string,
  group?: string,
): ContentField[] {
  return [
    {
      key: `${key}Color`,
      label: `${label} — colour (top)`,
      type: "color",
      default: from,
      group,
      max: 32,
    },
    {
      key: `${key}ColorTo`,
      label: `${label} — colour (bottom)`,
      type: "color",
      default: to,
      group,
      max: 32,
    },
  ];
}


/**
 * The typeface, size, weight and letter spacing of ONE piece of copy.
 *
 * Every one of these defaults to an EMPTY string, which means "leave the
 * design alone". That matters for two reasons. The site's type is currently
 * expressed in Tailwind classes that also carry the responsive steps — a
 * heading is 4rem on a desktop, 3.2rem on a tablet and 1.9rem on a phone —
 * and a single inline font-size would flatten all three into one. So an empty
 * value keeps the built-in class, and a value the admin actually sets
 * overrides it (scaled per breakpoint by .pj-type in globals.css, so the
 * responsive behaviour survives).
 *
 * The second reason is that nothing changes on the live site until somebody
 * deliberately changes it. An empty value writes no row, so shipping this
 * leaves all seven sections rendering exactly as they did before.
 *
 * Emitted in the order the fields are meant to be read: the words first, then
 * how they look — font, size, colour, then weight and spacing. `tint`/`fade`
 * supply the colour, so this returns what sits either side of it.
 */
function face(
  key: string,
  label: string,
  group?: string,
): ContentField[] {
  return [
    {
      key: `${key}Font`,
      label: `${label} — font`,
      type: "font",
      default: "",
      group,
      hint: "Blank keeps the font this section was designed in.",
      max: 32,
    },
    {
      key: `${key}Size`,
      label: `${label} — size`,
      type: "fontsize",
      default: "",
      group,
      hint: "Pixels, on a desktop. Blank keeps the design size. Tablet and phone scale down from whatever is set here.",
      max: 8,
    },
  ];
}

/** The weight and letter spacing, which sit after the colour. */
function style(
  key: string,
  label: string,
  group?: string,
): ContentField[] {
  return [
    {
      key: `${key}Weight`,
      label: `${label} — weight`,
      type: "weight",
      default: "",
      group,
      hint: "Blank keeps the design weight.",
      max: 8,
    },
    {
      key: `${key}Spacing`,
      label: `${label} — letter spacing`,
      type: "spacing",
      default: "",
      group,
      hint: "In em — 0.1 is wide, -0.02 is tight. Blank keeps the design spacing.",
      max: 8,
    },
  ];
}

/** A photograph. `default` is the image the site shipped with. */
function picture(
  key: string,
  label: string,
  value: string,
  group?: string,
  hint?: string,
): ContentField {
  return { key, label, type: "image", default: value, group, hint, max: 500 };
}

/** An icon. SVG only — see the note on the footer's ticker mark. */
function vector(
  key: string,
  label: string,
  value: string,
  group?: string,
  hint?: string,
): ContentField {
  return { key, label, type: "svg", default: value, group, hint, max: 500 };
}

/** A number with a slider beside the box. */
function amount(
  key: string,
  label: string,
  value: number,
  opts: {
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    group?: string;
    hint?: string;
  } = {},
): ContentField {
  return {
    key,
    label,
    type: "number",
    default: String(value),
    group: opts.group,
    hint: opts.hint,
    min: opts.min ?? 0,
    max: opts.max ?? 100,
    step: opts.step ?? 1,
    unit: opts.unit,
  };
}

export interface ContentPage {
  key: string;
  label: string;
  /** Where the page lives on the public site, shown in the admin as a link. */
  path: string;
  sections: ContentSection[];
  /**
   * True for the bands that are not pages at all — the header and the footer.
   * They appear on EVERY page, so listing them as tabs beside "Home page" and
   * "About page" read as though they belonged to whichever tab was selected.
   * They get their own screens under Editor instead, and are left out of the
   * Content tab bar so the same thing is never edited from two places.
   */
  standalone?: boolean;
  /**
   * True when the page renders its sections through PageSections.jsx, and so
   * can be rearranged and have sections hidden from the panel.
   *
   * Not every page can. Most still list their sections as JSX in their own
   * file, where the order is fixed at build time — offering a reorder there
   * would save rows that nothing reads and show the editor a control that
   * quietly does nothing. Converting a page is one import swap in its page
   * file plus this flag.
   */
  arrangeable?: boolean;
}

/** Shorthand for a band that is part of the page but holds no editable words. */
function structural(
  key: string,
  label: string,
  description: string,
  manage?: { label: string; path: string },
): ContentSection {
  return { key, label, description, fields: [], structural: true, manage };
}

const SHORT = 60;
const MEDIUM = 120;
const LONG = 400;


/**
 * Puts the typography controls around each piece of copy.
 *
 * The alternative was writing face()/style() out by hand beside all 42 text
 * fields on this page, which is 42 chances to put one in the wrong place or
 * forget it on a field added later. Rebuilding the array here means the order
 * is stated once and holds for every field, including ones added tomorrow.
 *
 * The order is: the words, then the font and size, then whatever colours
 * already belong to that key, then the weight and spacing. A colour "belongs"
 * only when it is exactly `<key>Color` or `<key>ColorTo` — a shade that tints
 * something else (a button's background, a heading that covers two fields)
 * is left where its author put it rather than guessed at.
 */
function withTypography(sections: ContentSection[]): ContentSection[] {
  const ownsColour = (field: ContentField, key: string) =>
    field.type === "color" &&
    (field.key === `${key}Color` || field.key === `${key}ColorTo`);

  return sections.map((section) => {
    const out: ContentField[] = [];

    for (let i = 0; i < section.fields.length; i += 1) {
      const field = section.fields[i];
      out.push(field);

      if (field.type !== "text" && field.type !== "textarea") continue;

      out.push(...face(field.key, field.label, field.group));

      while (i + 1 < section.fields.length && ownsColour(section.fields[i + 1], field.key)) {
        i += 1;
        out.push(section.fields[i]);
      }

      out.push(...style(field.key, field.label, field.group));
    }

    return { ...section, fields: out };
  });
}

// --- Home page ------------------------------------------------------------

const HOME_SECTIONS: ContentSection[] = [
  {
    key: "hero",
    label: "Hero — spinning rings",
    description:
      "The first screen: the brand name at the centre of the two rotating rings, and the names that scroll past underneath.",
    fields: [
      {
        key: "titleTop",
        label: "Brand name — large line",
        type: "text",
        default: "Promise",
        hint: "Rendered in capitals by the design.",
        max: SHORT,
      },
      tint("titleTop", "Brand name — large line", "#0E4238"),
      {
        key: "titleBottom",
        label: "Brand name — letterspaced line",
        type: "text",
        default: "JEWELS",
        max: SHORT,
      },
      tint("titleBottom", "Brand name — letterspaced line", "#0E4238"),
      {
        key: "ticker.1",
        label: "First name",
        type: "text",
        group: "Scrolling names",
        default: "Claricuts",
        max: SHORT,
      },
      ...fade("ticker.1", "First name", "#01383B", "#3E9C86", "Scrolling names"),
      {
        key: "ticker.2",
        label: "Second name",
        type: "text",
        group: "Scrolling names",
        default: "Luxifine",
        max: SHORT,
      },
      ...fade("ticker.2", "Second name", "#01383B", "#3E9C86", "Scrolling names"),
      {
        key: "ticker.3",
        label: "Third name",
        type: "text",
        group: "Scrolling names",
        default: "Netram",
        max: SHORT,
      },
      ...fade("ticker.3", "Third name", "#01383B", "#3E9C86", "Scrolling names"),
      picture("outer.1", "Frame 1", "/images/jewellery/image_20_1.webp", "Outer ring photographs", "Square images look best — they are masked into rounded tiles."),
      picture("outer.2", "Frame 2", "/images/jewellery/image_22.webp", "Outer ring photographs"),
      picture("outer.3", "Frame 3", "/images/jewellery/image_56.webp", "Outer ring photographs"),
      picture("outer.4", "Frame 4", "/images/jewellery/image_77.webp", "Outer ring photographs"),
      picture("outer.5", "Frame 5", "/images/jewellery/image_78.webp", "Outer ring photographs"),
      picture("outer.6", "Frame 6", "/images/jewellery/image_79.webp", "Outer ring photographs"),
      picture("outer.7", "Frame 7", "/images/jewellery/image_80.webp", "Outer ring photographs"),
      picture("outer.8", "Frame 8", "/images/jewellery/image_81.webp", "Outer ring photographs"),
      picture("outer.9", "Frame 9", "/images/jewellery/image_82.webp", "Outer ring photographs"),
      picture("outer.10", "Frame 10", "/images/jewellery/image_83.webp", "Outer ring photographs"),
      picture("outer.11", "Frame 11", "/images/jewellery/image_84.webp", "Outer ring photographs"),
      picture("outer.12", "Frame 12", "/images/jewellery/image_86.webp", "Outer ring photographs"),
      picture("outer.13", "Frame 13", "/images/jewellery/image_89.webp", "Outer ring photographs"),
      picture("outer.14", "Frame 14", "/images/jewellery/image_90.webp", "Outer ring photographs"),
      picture("outer.15", "Frame 15", "/images/jewellery/image_91.webp", "Outer ring photographs"),
      picture("outer.16", "Frame 16", "/images/jewellery/image_92.webp", "Outer ring photographs"),
      picture("outer.17", "Frame 17", "/images/jewellery/image_93.webp", "Outer ring photographs"),
      picture("outer.18", "Frame 18", "/images/jewellery/image_94.webp", "Outer ring photographs"),
      picture("inner.1", "Tile 1", "/images/jewellery/image_95.webp", "Inner ring photographs", "Square images look best — they are masked into rounded tiles."),
      picture("inner.2", "Tile 2", "/images/jewellery/image_96.webp", "Inner ring photographs"),
      picture("inner.3", "Tile 3", "/images/jewellery/image_97.webp", "Inner ring photographs"),
      picture("inner.4", "Tile 4", "/images/jewellery/image_98.webp", "Inner ring photographs"),
      picture("inner.5", "Tile 5", "/images/jewellery/image_99.webp", "Inner ring photographs"),
      picture("inner.6", "Tile 6", "/images/jewellery/image_100.webp", "Inner ring photographs"),
      picture("inner.7", "Tile 7", "/images/jewellery/image_101.webp", "Inner ring photographs"),
      picture("inner.8", "Tile 8", "/images/jewellery/image_102.webp", "Inner ring photographs"),
      picture("inner.9", "Tile 9", "/images/jewellery/image_82.webp", "Inner ring photographs"),
      picture("inner.10", "Tile 10", "/images/jewellery/image_83.webp", "Inner ring photographs"),
      picture("inner.11", "Tile 11", "/images/jewellery/image_84.webp", "Inner ring photographs"),
      picture("inner.12", "Tile 12", "/images/jewellery/image_86.webp", "Inner ring photographs"),

    ],
  },
  {
    key: "welcome",
    label: "Welcome",
    description:
      "The introduction under the hero — the small gold label, the large headline and the paragraph above the social buttons.",
    fields: [
      {
        key: "eyebrow",
        label: "Small gold label",
        type: "text",
        default: "Est. Excellence",
        max: SHORT,
      },
      tint("eyebrow", "Small gold label", "#C9A15A", undefined, "Also tints the two rules either side of it."),
      {
        key: "headlineStart",
        label: "Headline — opening words",
        type: "text",
        group: "Headline",
        default: "Welcome to",
        hint: "Shown in plain teal.",
        max: MEDIUM,
      },
      {
        key: "headlineAccent",
        label: "Headline — highlighted words",
        type: "text",
        group: "Headline",
        default: "Promise Group of Companies,",
        hint: "Shown in bold gold.",
        max: MEDIUM,
      },
      ...fade("headlineAccent", "Headline — highlighted words", "#C9A15A", "#A87F3D", "Headline"),
      {
        key: "headlineEnd",
        label: "Headline — closing words",
        type: "textarea",
        group: "Headline",
        default:
          "a leading name in the jewelry industry, where craftsmanship meets innovation.",
        max: LONG,
      },
      // The design paints every unhighlighted word of the headline in one
      // shade, so this one colour covers the opening AND the closing words —
      // which is why it sits after both rather than beside either.
      tint("headline", "Headline — opening and closing words", "#01383B", "Headline"),
      {
        key: "bodyStart",
        label: "Paragraph — opening words",
        type: "textarea",
        group: "Paragraph",
        default:
          "With a legacy rooted in excellence and a vision aimed at national prominence,",
        max: LONG,
      },
      tint("bodyStart", "Paragraph — opening words", "#0E4238", "Paragraph"),
      {
        key: "bodyAccent",
        label: "Paragraph — bold ending",
        type: "textarea",
        group: "Paragraph",
        default:
          "Promise Group encompasses three distinctive sub-brands: CLARICUTS AND LUXIFINE.",
        max: LONG,
      },
      tint("bodyAccent", "Paragraph — bold ending", "#01383B", "Paragraph"),
      {
        key: "ctaLabel",
        label: "Button text",
        type: "text",
        group: "Button",
        default: "About Us",
        max: SHORT,
      },
      tint("ctaLabel", "Button text", "#FFFFFF", "Button"),
      ...fade("ctaBg", "Button background", "#01383B", "#0E4238", "Button"),
    ],
  },
  {
    key: "collections",
    label: "Featured Collections",
    description:
      "The heading above the photo slideshow, and the name shown on each slide.",
    fields: [
      {
        key: "titleLight",
        label: "Heading — light word",
        type: "text",
        group: "Heading",
        default: "Featured",
        max: SHORT,
      },
      ...fade("titleLight", "Heading — light word", "#01383B", "#3E9C86", "Heading"),
      {
        key: "titleBold",
        label: "Heading — bold word",
        type: "text",
        group: "Heading",
        default: "Collections",
        max: SHORT,
      },
      ...fade("titleBold", "Heading — bold word", "#01383B", "#3E9C86", "Heading"),
      {
        key: "eyebrow",
        label: "Label above each name",
        type: "text",
        default: "Collection",
        max: SHORT,
      },
      tint("eyebrow", "Label above each name", "#E8CB92"),
      ...[
        "Eternal Bloom",
        "Golden Hour",
        "Soft Glam",
        "Midnight Sapphire",
        "Rose Whisper",
      ].flatMap((name, index) => [
        {
          key: `items.${index + 1}.name`,
          label: `Slide ${index + 1}`,
          type: "text" as FieldType,
          group: "Slide names",
          default: name,
          max: SHORT,
        },
        tint(`items.${index + 1}.name`, `Slide ${index + 1}`, "#FFFFFF", "Slide names"),
      ]),
      picture("img.1", "Card 1", "/images/Featured-collection/image_70.webp", "Photographs", "Square images look best — they are masked into rounded tiles."),
      picture("img.2", "Card 2", "/images/Featured-collection/image_68.webp", "Photographs"),
      picture("img.3", "Card 3", "/images/Featured-collection/image_63.webp", "Photographs"),
      picture("img.4", "Card 4", "/images/Featured-collection/image_71.webp", "Photographs"),
      picture("img.5", "Card 5", "/images/Featured-collection/image_72.webp", "Photographs"),

    ],
  },
  {
    key: "pillars",
    label: "Our Pillars",
    description:
      "The five values that open one at a time as the section scrolls. Each has a heading and the caption underneath it.",
    fields: [
      {
        key: "titleLight",
        label: "Heading — light word",
        type: "text",
        group: "Heading",
        default: "Our",
        max: SHORT,
      },
      ...fade("titleLight", "Heading — light word", "#01383B", "#3E9C86", "Heading"),
      {
        key: "titleBold",
        label: "Heading — bold word",
        type: "text",
        group: "Heading",
        default: "Pillars",
        max: SHORT,
      },
      ...fade("titleBold", "Heading — bold word", "#01383B", "#3E9C86", "Heading"),
      ...[
        {
          title: "Innovation",
          caption:
            "We continuously develop new jewelry designs, advanced manufacturing techniques, and modern production processes to meet evolving market trends.",
        },
        {
          title: "Customer Satisfaction",
          caption:
            "Every piece of jewelry is crafted with precision to ensure superior quality, timely delivery, and complete customer satisfaction.",
        },
        {
          title: "Superior Quality",
          caption:
            "As a trusted gold jewelry manufacturer, we maintain strict quality standards using premium materials, skilled craftsmanship, and advanced manufacturing technology.",
        },
        {
          title: "Transparency & Ethics",
          caption:
            "We believe in honest business practices, ethical sourcing, and long-term partnerships built on trust and integrity.",
        },
        {
          title: "Employee Well-being",
          caption:
            "Our people are our greatest strength. We foster a safe, collaborative, and growth-oriented workplace that encourages innovation and excellence.",
        },
      ].flatMap((pillar, index) => {
        const group = `Pillar ${String(index + 1).padStart(2, "0")}`;

        return [
          {
            key: `items.${index + 1}.title`,
            label: "Heading",
            type: "text" as FieldType,
            group,
            default: pillar.title,
            max: SHORT,
          },
          tint(`items.${index + 1}.title`, "Heading", "#01383B", group, "Used while this pillar is the open one."),
          {
            key: `items.${index + 1}.caption`,
            label: "Caption",
            type: "textarea" as FieldType,
            group,
            default: pillar.caption,
            max: LONG,
          },
          tint(`items.${index + 1}.caption`, "Caption", "#0E4238", group),
        ];
      }),
      picture("img.1", "Pillar 1", "/images/jewellery/image_22.webp", "Photographs", "Square images look best — they are masked into rounded tiles."),
      picture("img.2", "Pillar 2", "/images/jewellery/image_56.webp", "Photographs"),
      picture("img.3", "Pillar 3", "/images/jewellery/image_100.webp", "Photographs"),
      picture("img.4", "Pillar 4", "/images/jewellery/image_101.webp", "Photographs"),
      picture("img.5", "Pillar 5", "/images/jewellery/image_102.webp", "Photographs"),
      picture("icon.1", "Icon 1", "/images/icons/innovation.svg", "Icons", "Square images look best — they are masked into rounded tiles."),
      picture("icon.2", "Icon 2", "/images/icons/Customer satisfaction.svg", "Icons"),
      picture("icon.3", "Icon 3", "/images/icons/Superior Quality.svg", "Icons"),
      picture("icon.4", "Icon 4", "/images/icons/Transparency & Ethics.svg", "Icons"),
      picture("icon.5", "Icon 5", "/images/icons/Employee well-being.svg", "Icons"),

    ],
  },
  {
    key: "brands",
    label: "Our Brands",
    // The brand rows themselves are no longer editable here. Each row — name,
    // description, overview, logo, banner, gallery and CTA — is one record in
    // Admin > Brands, and the section renders every active brand from there,
    // in display order. Keeping a second copy of the names and paragraphs in
    // this editor would let the two drift apart, with no way to tell which one
    // the live site was showing.
    description:
      "The section heading. The brand rows below it are managed in Admin > Brands — add or edit a brand there and it appears here and on /our-brand automatically.",
    // Sends the editor to the screen that actually owns the brand records,
    // rather than leaving them hunting for names and descriptions that are
    // deliberately not on this form.
    manage: { label: "Manage brands", path: "/admin/brands" },
    fields: [
      {
        key: "titleLight",
        label: "Heading — light word",
        type: "text",
        group: "Heading",
        default: "Our",
        max: SHORT,
      },
      ...fade("titleLight", "Heading — light word", "#01383B", "#3E9C86", "Heading"),
      {
        key: "titleBold",
        label: "Heading — bold word",
        type: "text",
        group: "Heading",
        default: "Brands",
        max: SHORT,
      },
      ...fade("titleBold", "Heading — bold word", "#01383B", "#3E9C86", "Heading"),
      // The rows below the heading are brand records, not copy — but their
      // shades belong to this page, so they are set here rather than on each
      // record. One brand styled differently from the next would read as a
      // fault, not a choice.
      tint("brandName", "Brand name", "#01383B", "Brand rows"),
      tint("brandIndex", "Brand number", "#C9A15A", "Brand rows"),
      tint("brandBody", "Brand description", "#0E4238", "Brand rows"),
    ],
  },
  {
    key: "exhibition",
    label: "Exhibition Highlights",
    description:
      "The heading above the upcoming events grid. The events themselves are managed under Exhibitions.",
    fields: [
      {
        key: "titleLight",
        label: "Heading — light word",
        type: "text",
        group: "Heading",
        default: "Exhibition",
        max: SHORT,
      },
      ...fade("titleLight", "Heading — light word", "#01383B", "#3E9C86", "Heading"),
      {
        key: "titleBold",
        label: "Heading — bold word",
        type: "text",
        group: "Heading",
        default: "Highlights",
        max: SHORT,
      },
      ...fade("titleBold", "Heading — bold word", "#01383B", "#3E9C86", "Heading"),
      {
        key: "subtitle",
        label: "Line underneath",
        type: "text",
        default: "Upcoming Events",
        max: MEDIUM,
      },
      tint("subtitle", "Line underneath", "#0E4238"),
    ],
  },
  {
    key: "growth",
    label: "Let's Drive Growth",
    description:
      "The closing call to action inside the second spinning ring, above the footer.",
    fields: [
      {
        key: "eyebrow",
        label: "Small label",
        type: "text",
        default: "JEWELLERY MANUFACTURER & WHOLESALER",
        max: MEDIUM,
      },
      tint("eyebrow", "Small label", "#0E4238"),
      {
        key: "title",
        label: "Heading — light words",
        type: "text",
        group: "Heading",
        default: "Let’s Drive",
        max: SHORT,
      },
      tint("title", "Heading — light words", "#0E4238", "Heading"),
      {
        key: "highlight",
        label: "Heading — highlighted word",
        type: "text",
        group: "Heading",
        default: "Growth",
        max: SHORT,
      },
      tint("highlight", "Heading — highlighted word", "#C9A15A", "Heading"),
      {
        key: "subtitle",
        label: "Paragraph",
        type: "textarea",
        default:
          "From concept to craftsmanship, Promise Jewels Private Limited delivers premium-quality jewellery manufacturing and wholesale solutions tailored to your business needs.",
        max: LONG,
      },
      tint("subtitle", "Paragraph", "#0E4238"),
      {
        key: "ctaLabel",
        label: "Button text",
        type: "text",
        group: "Button",
        default: "Get Started",
        max: SHORT,
      },
      tint("ctaLabel", "Button text", "#FFFFFF", "Button"),
      ...fade("ctaBg", "Button background", "#01383B", "#3E9C86", "Button"),
      picture("img.1", "Frame 1", "/images/jewellery/image_20_1.webp", "Rotating photographs", "Square images look best — they are masked into rounded tiles."),
      picture("img.2", "Frame 2", "/images/jewellery/image_22.webp", "Rotating photographs"),
      picture("img.3", "Frame 3", "/images/jewellery/image_56.webp", "Rotating photographs"),
      picture("img.4", "Frame 4", "/images/jewellery/image_77.webp", "Rotating photographs"),
      picture("img.5", "Frame 5", "/images/jewellery/image_78.webp", "Rotating photographs"),
      picture("img.6", "Frame 6", "/images/jewellery/image_79.webp", "Rotating photographs"),
      picture("img.7", "Frame 7", "/images/jewellery/image_80.webp", "Rotating photographs"),
      picture("img.8", "Frame 8", "/images/jewellery/image_81.webp", "Rotating photographs"),
      picture("img.9", "Frame 9", "/images/jewellery/image_82.webp", "Rotating photographs"),
      picture("img.10", "Frame 10", "/images/jewellery/image_83.webp", "Rotating photographs"),
      picture("img.11", "Frame 11", "/images/jewellery/image_84.webp", "Rotating photographs"),
      picture("img.12", "Frame 12", "/images/jewellery/image_86.webp", "Rotating photographs"),
      picture("img.13", "Frame 13", "/images/jewellery/image_89.webp", "Rotating photographs"),
      picture("img.14", "Frame 14", "/images/jewellery/image_90.webp", "Rotating photographs"),
      picture("img.15", "Frame 15", "/images/jewellery/image_91.webp", "Rotating photographs"),
      picture("img.16", "Frame 16", "/images/jewellery/image_92.webp", "Rotating photographs"),
      picture("img.17", "Frame 17", "/images/jewellery/image_93.webp", "Rotating photographs"),
      picture("img.18", "Frame 18", "/images/jewellery/image_94.webp", "Rotating photographs"),

    ],
  },
];

// --- the shared hero ------------------------------------------------------
//
// Six pages open with the same component: an eyebrow, a title, a paragraph, a
// button, and a ring of eighteen photographs turning behind them. The words
// differ per page and the shades and pictures start from the same place, which
// is exactly how src/components/layout/heroContent.js is arranged on the site.
//
// The frame list is duplicated there rather than imported because the server
// and the browser bundle are built separately; the pairing is what matters and
// it is asserted by heroFields() producing one entry per frame.

const HERO_RING_DEFAULTS = [
  "/images/jewellery/image_20_1.webp",
  "/images/jewellery/image_22.webp",
  "/images/jewellery/image_56.webp",
  "/images/jewellery/image_77.webp",
  "/images/jewellery/image_78.webp",
  "/images/jewellery/image_79.webp",
  "/images/jewellery/image_80.webp",
  "/images/jewellery/image_81.webp",
  "/images/jewellery/image_82.webp",
  "/images/jewellery/image_83.webp",
  "/images/jewellery/image_84.webp",
  "/images/jewellery/image_86.webp",
  "/images/jewellery/image_89.webp",
  "/images/jewellery/image_90.webp",
  "/images/jewellery/image_91.webp",
  "/images/jewellery/image_92.webp",
  "/images/jewellery/image_93.webp",
  "/images/jewellery/image_94.webp",
];

/** The eighteen turning frames, as editable image fields. */
function ring(): ContentField[] {
  return HERO_RING_DEFAULTS.map((src, index) =>
    picture(
      `ring.${index + 1}`,
      `Frame ${index + 1}`,
      src,
      "Rotating photographs",
      index === 0
        ? "Square images look best — they are masked into rounded tiles."
        : undefined,
    ),
  );
}

/**
 * One page's hero: its own words, the shared shades, the shared ring.
 *
 * Every page keeps a SEPARATE copy of all of it. Editing the Contact hero must
 * not silently change the About hero, which is what a shared section key would
 * have done.
 */
function heroFields(copy: {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
}): ContentField[] {
  return [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: copy.eyebrow, max: SHORT },
    ...fade("eyebrow", "Eyebrow", "#01383B", "#286F6F"),
    { key: "title", label: "Title", type: "text", default: copy.title, max: MEDIUM },
    ...fade("title", "Title", "#01383B", "#286F6F"),
    {
      key: "subtitle",
      label: "Introduction",
      type: "textarea",
      default: copy.subtitle,
      max: LONG,
    },
    tint("subtitle", "Introduction", "#2F6B6B"),
    { key: "ctaLabel", label: "Button label", type: "text", default: copy.ctaLabel, max: SHORT },
    tint("ctaLabel", "Button label", "#FFFFFF"),

    ...ring(),
  ];

}

/**
 * The panel shown where a page lists records owned by another admin screen.
 *
 * Collections, brands and exhibitions are real records with their own pages,
 * images and SEO. Copying their names and pictures into the Editor as well
 * would mean two places to change one fact, and two places for it to be
 * wrong — so the Editor shows the surrounding copy and links through to the
 * screen that actually owns them.
 */
function inquirySection(
  key: string,
  label: string,
  description: string,
  manage: { label: string; path: string },
  fields: ContentField[],
): ContentSection {
  return { key, label, description, fields, manage };
}

// --- About page -----------------------------------------------------------

const ABOUT_SECTIONS: ContentSection[] = [
  {
    key: "hero",
    label: "Hero",
    description: "The opening screen, and the photographs turning behind it.",
    fields: heroFields({
      eyebrow: "About Us",
      title: "Crafting Trust, One Piece at a Time",
      subtitle:
        "Promise Jewels has spent over two decades turning gold and precision into pieces that businesses and families trust. From our first workshop to a name recognized across the industry, our story is one of craftsmanship, integrity, and an unwavering promise to deliver quality that speaks for itself.",
      ctaLabel: "Explore Our Story",
    }),
  },
  {
    key: "values",
    label: "What we stand for",
    description:
      "The values listed down the About page — each with its title, its description and its icon.",
    fields: [
      { key: "items.1.title", label: "Title", type: "text", default: "Innovation", group: "Value 1", max: MEDIUM },
      { key: "items.1.description", label: "Description", type: "textarea", default: "We continuously develop new jewelry designs, advanced manufacturing techniques, and modern production processes to meet evolving market trends.", group: "Value 1", max: LONG },
      vector("items.1.icon", "Icon", "/images/icons/innovation.svg", "Value 1", "SVG only — it is drawn as a mask so the colour below applies to it."),
      { key: "items.2.title", label: "Title", type: "text", default: "Customer Satisfaction", group: "Value 2", max: MEDIUM },
      { key: "items.2.description", label: "Description", type: "textarea", default: "Every piece of jewelry is crafted with precision to ensure superior quality, timely delivery, and complete customer satisfaction.", group: "Value 2", max: LONG },
      vector("items.2.icon", "Icon", "/images/icons/Customer satisfaction.svg", "Value 2", undefined),
      { key: "items.3.title", label: "Title", type: "text", default: "Superior Quality", group: "Value 3", max: MEDIUM },
      { key: "items.3.description", label: "Description", type: "textarea", default: "As a trusted gold jewelry manufacturer, we maintain strict quality standards using premium materials, skilled craftsmanship, and advanced manufacturing technology.", group: "Value 3", max: LONG },
      vector("items.3.icon", "Icon", "/images/icons/Superior Quality.svg", "Value 3", undefined),
      { key: "items.4.title", label: "Title", type: "text", default: "Transparency & Ethics", group: "Value 4", max: MEDIUM },
      { key: "items.4.description", label: "Description", type: "textarea", default: "We believe in honest business practices, ethical sourcing, and long-term partnerships built on trust and integrity.", group: "Value 4", max: LONG },
      vector("items.4.icon", "Icon", "/images/icons/Transparency & Ethics.svg", "Value 4", undefined),
      { key: "items.5.title", label: "Title", type: "text", default: "Employee Well-being", group: "Value 5", max: MEDIUM },
      { key: "items.5.description", label: "Description", type: "textarea", default: "Our people are our greatest strength. We foster a safe, collaborative, and growth-oriented workplace that encourages innovation and excellence.", group: "Value 5", max: LONG },
      vector("items.5.icon", "Icon", "/images/icons/Employee well-being.svg", "Value 5", undefined),
      colour("titleColor", "Titles", "#01383B"),
      colour("bodyColor", "Descriptions", "#2F6B6B"),
      colour("iconColor", "Icons", "#C9A15A"),
    ],
  },
  {
    key: "leaders",
    label: "Our leaders",
    description: "The people shown on the About page, with their photographs.",
    fields: [
      { key: "items.1.name", label: "Name", type: "text", default: "Bharat Jogani", group: "Person 1", max: MEDIUM },
      { key: "items.1.title", label: "Role", type: "text", default: "Founder", group: "Person 1", max: MEDIUM },
      { key: "items.1.description", label: "Description", type: "textarea", default: "Leading with vision, building trust, and crafting excellence in every creation.", group: "Person 1", max: LONG },
      picture("items.1.image", "Photograph", "/images/OurLeaders/image_142.webp", "Person 1"),
      { key: "items.2.name", label: "Name", type: "text", default: "Bharat Jogani", group: "Person 2", max: MEDIUM },
      { key: "items.2.title", label: "Role", type: "text", default: "Founder", group: "Person 2", max: MEDIUM },
      { key: "items.2.description", label: "Description", type: "textarea", default: "Leading with vision, building trust, and crafting excellence in every creation.", group: "Person 2", max: LONG },
      picture("items.2.image", "Photograph", "/images/OurLeaders/image_143.webp", "Person 2"),
      { key: "items.3.name", label: "Name", type: "text", default: "Bharat Jogani", group: "Person 3", max: MEDIUM },
      { key: "items.3.title", label: "Role", type: "text", default: "Founder", group: "Person 3", max: MEDIUM },
      { key: "items.3.description", label: "Description", type: "textarea", default: "Leading with vision, building trust, and crafting excellence in every creation.", group: "Person 3", max: LONG },
      picture("items.3.image", "Photograph", "/images/OurLeaders/image_144.webp", "Person 3"),
      { key: "heading", label: "Section heading", type: "text", default: "Our Leaders", max: MEDIUM },
      colour("headingColor", "Section heading", "#01383B"),
      colour("nameColor", "Names", "#01383B"),
      colour("roleColor", "Roles", "#C9A15A"),
      colour("bodyColor", "Descriptions", "#2F6B6B"),
    ],
  },
  {
    key: "gallery",
    label: "Gallery",
    description:
      "The two rows of photographs that slide past on the About page. The bundled rows fix how many frames there are; a saved picture replaces one.",
    fields: [
      picture("row1.1", "Top row 1", "/images/jewellery/image_252.webp", "Top row"),
      { key: "row1.1.name", label: "Top row 1 — caption", type: "text", default: "Black Beaded Necklace", group: "Top row", max: MEDIUM },
      picture("row1.2", "Top row 2", "/images/jewellery/image_245.webp", "Top row"),
      { key: "row1.2.name", label: "Top row 2 — caption", type: "text", default: "Diamond Chandelier Earrings", group: "Top row", max: MEDIUM },
      picture("row1.3", "Top row 3", "/images/jewellery/image_244.webp", "Top row"),
      { key: "row1.3.name", label: "Top row 3 — caption", type: "text", default: "Diamond Cluster Cocktail Ring", group: "Top row", max: MEDIUM },
      picture("row1.4", "Top row 4", "/images/jewellery/image_247.webp", "Top row"),
      { key: "row1.4.name", label: "Top row 4 — caption", type: "text", default: "Layered Gold Chain Necklace", group: "Top row", max: MEDIUM },
      picture("row1.5", "Top row 5", "/images/jewellery/image_253.webp", "Top row"),
      { key: "row1.5.name", label: "Top row 5 — caption", type: "text", default: "Diamond Drop Earrings", group: "Top row", max: MEDIUM },
      picture("row2.1", "Bottom row 1", "/images/jewellery/image_248.webp", "Bottom row"),
      { key: "row2.1.name", label: "Bottom row 1 — caption", type: "text", default: "Emerald Statement Necklace", group: "Bottom row", max: MEDIUM },
      picture("row2.2", "Bottom row 2", "/images/jewellery/image_249.webp", "Bottom row"),
      { key: "row2.2.name", label: "Bottom row 2 — caption", type: "text", default: "Diamond Statement Necklace", group: "Bottom row", max: MEDIUM },
      picture("row2.3", "Bottom row 3", "/images/jewellery/image_250.webp", "Bottom row"),
      { key: "row2.3.name", label: "Bottom row 3 — caption", type: "text", default: "Yellow Gold Band Ring", group: "Bottom row", max: MEDIUM },
      picture("row2.4", "Bottom row 4", "/images/jewellery/image_251.webp", "Bottom row"),
      { key: "row2.4.name", label: "Bottom row 4 — caption", type: "text", default: "Diamond Dangle Earrings", group: "Bottom row", max: MEDIUM },
      picture("row2.5", "Bottom row 5", "/images/jewellery/image_254.webp", "Bottom row"),
      { key: "row2.5.name", label: "Bottom row 5 — caption", type: "text", default: "Turquoise Pendant Necklace", group: "Bottom row", max: MEDIUM },
      // "Gallery" is what the page has always rendered — the field said
      // "Our Work", but nothing read it, so the mismatch never showed.
      { key: "heading", label: "Section heading", type: "text", default: "Gallery", max: MEDIUM },
      colour("headingColor", "Section heading", "#01383B"),
      colour("captionColor", "Captions", "#2F6B6B"),
    ],
  },
  {
    key: "growth",
    label: "Let's Drive Growth",
    description:
      "The closing band. This page keeps its own copy, so editing it here does not change the same band on the Home page.",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", default: "JEWELLERY MANUFACTURER & WHOLESALER", max: MEDIUM },
      tint("eyebrow", "Eyebrow", "#0B5B5D"),
      { key: "title", label: "Title", type: "text", default: "Let's Drive Growth", max: MEDIUM },
      tint("title", "Title", "#0B5B5D"),
      { key: "highlight", label: "Highlighted words", type: "text", default: "Growth", max: SHORT },
      tint("highlight", "Highlighted words", "#C9A15A"),
      {
        key: "subtitle",
        label: "Paragraph",
        type: "textarea",
        default:
          "From concept to craftsmanship, Promise Jewels partners with retailers and wholesalers to build collections that sell.",
        max: LONG,
      },
      tint("subtitle", "Paragraph", "#0B5B5D"),
      { key: "ctaLabel", label: "Button label", type: "text", default: "Get Started", max: SHORT },
      tint("ctaLabel", "Button label", "#FFFFFF"),
      // The button's own fill, not the label's — left as a pair of its own so
      // it is not mistaken for the colour of the words on it.
      colour("ctaBgColor", "Button background — colour (top)", "#01383B"),
      colour("ctaBgColorTo", "Button background — colour (bottom)", "#286F6F"),
      picture("img.1", "Frame 1", "/images/jewellery/image_20_1.webp", "Rotating photographs", "Square images look best — they are masked into rounded tiles."),
      picture("img.2", "Frame 2", "/images/jewellery/image_22.webp", "Rotating photographs"),
      picture("img.3", "Frame 3", "/images/jewellery/image_56.webp", "Rotating photographs"),
      picture("img.4", "Frame 4", "/images/jewellery/image_77.webp", "Rotating photographs"),
      picture("img.5", "Frame 5", "/images/jewellery/image_78.webp", "Rotating photographs"),
      picture("img.6", "Frame 6", "/images/jewellery/image_79.webp", "Rotating photographs"),
      picture("img.7", "Frame 7", "/images/jewellery/image_80.webp", "Rotating photographs"),
      picture("img.8", "Frame 8", "/images/jewellery/image_81.webp", "Rotating photographs"),
      picture("img.9", "Frame 9", "/images/jewellery/image_82.webp", "Rotating photographs"),
      picture("img.10", "Frame 10", "/images/jewellery/image_83.webp", "Rotating photographs"),
      picture("img.11", "Frame 11", "/images/jewellery/image_84.webp", "Rotating photographs"),
      picture("img.12", "Frame 12", "/images/jewellery/image_86.webp", "Rotating photographs"),
      picture("img.13", "Frame 13", "/images/jewellery/image_89.webp", "Rotating photographs"),
      picture("img.14", "Frame 14", "/images/jewellery/image_90.webp", "Rotating photographs"),
      picture("img.15", "Frame 15", "/images/jewellery/image_91.webp", "Rotating photographs"),
      picture("img.16", "Frame 16", "/images/jewellery/image_92.webp", "Rotating photographs"),
      picture("img.17", "Frame 17", "/images/jewellery/image_93.webp", "Rotating photographs"),
      picture("img.18", "Frame 18", "/images/jewellery/image_94.webp", "Rotating photographs"),

    ],
  },
];

// --- Blog -----------------------------------------------------------------

const BLOG_SECTIONS: ContentSection[] = [
  {
    key: "hero",
    label: "Hero",
    description: "The journal's opening screen. Posts themselves live under Marketing > Blog.",
    fields: heroFields({
      eyebrow: "Journal",
      title: "Notes from the Workshop",
      subtitle:
        "Craftsmanship, trade shows and the making of fine jewellery — written by the people who do it.",
      ctaLabel: "Read the latest",
    }),
  },
  structural("posts", "The posts", "The grid of published posts.", {
    label: "Write posts under Marketing > Blog",
    path: "/admin/blog",
  }),
  structural(
    "growth",
    "Let's Drive Growth",
    "The closing call to action. Its words are the Home page's — edit them there.",
    { label: "Edit under Content > Home page", path: "/admin/editor" },
  ),
];

// --- Collections, Brands, Exhibitions, Contact -----------------------------

// Every array below is declared in the order the page renders, because that
// order is what an untouched arrangement falls back to.
const COLLECTIONS_SECTIONS: ContentSection[] = [
  {
    key: "hero",
    label: "Hero",
    description: "The opening screen of the collections page.",
    fields: heroFields({
      eyebrow: "Our Collections",
      title: "Designed to Be Worn, Built to Be Sold",
      subtitle:
        "Every collection begins on a bench and ends in a display case. Browse the ranges we manufacture for retailers and wholesalers across India and beyond.",
      ctaLabel: "Browse Collections",
    }),
  },
  structural("tabs", "Brand filter", "The row of brand tabs above the grid.", {
    label: "Open Brands",
    path: "/admin/brands",
  }),
  inquirySection(
    "listing",
    "The collections themselves",
    "Each collection is a record with its own images, description and page. They are managed on their own screen rather than duplicated here.",
    { label: "Open Collections", path: "/admin/collections" },
    [
      { key: "heading", label: "Section heading", type: "text", default: "Our Collections", max: MEDIUM },
      {
        key: "intro",
        label: "Introduction above the grid",
        type: "textarea",
        default: "Explore the ranges we design and manufacture.",
        max: LONG,
      },
      colour("headingColor", "Section heading", "#01383B", "Colours"),
      colour("introColor", "Introduction", "#2F6B6B", "Colours"),
    ],
  ),
  structural("inquiry", "Enquiry form", "The enquiry form near the foot of the page.", {
    label: "Read enquiries under Inquiries",
    path: "/admin/inquiries",
  }),
  structural("cta", "Closing panel", "The second spinning-ring panel that closes the page."),
];

const BRANDS_SECTIONS: ContentSection[] = [
  {
    key: "hero",
    label: "Hero",
    description: "The opening screen of the brands page.",
    fields: heroFields({
      eyebrow: "Our Brands",
      title: "The Names We Build For",
      subtitle:
        "Promise Jewels manufactures for brands that expect the same standard every single time. These are the labels we work with.",
      ctaLabel: "Meet the Brands",
    }),
  },
  inquirySection(
    "listing",
    "The brands themselves",
    "Each brand is a record with its own logo, description and page — managed on its own screen.",
    { label: "Open Brands", path: "/admin/brands" },
    [
      { key: "heading", label: "Section heading", type: "text", default: "Our Brands", max: MEDIUM },
      {
        key: "intro",
        label: "Introduction above the grid",
        type: "textarea",
        default: "The labels we manufacture for.",
        max: LONG,
      },
      colour("headingColor", "Section heading", "#01383B", "Colours"),
      colour("introColor", "Introduction", "#2F6B6B", "Colours"),
    ],
  ),
  structural(
    "growth",
    "Let's Drive Growth",
    "The closing call to action. Its words are the Home page's — edit them there.",
    { label: "Edit under Content > Home page", path: "/admin/editor" },
  ),
];

const EXHIBITIONS_SECTIONS: ContentSection[] = [
  {
    key: "hero",
    label: "Hero",
    description: "The opening screen of the exhibitions page.",
    fields: heroFields({
      eyebrow: "Exhibitions",
      title: "Where You Can Find Us",
      subtitle:
        "We show at the trade fairs that matter. Come and see the work in person — the stand details for each show are below.",
      ctaLabel: "See Upcoming Shows",
    }),
  },
  structural("schedule", "The schedule", "The table of dates and stand numbers.", {
    label: "Open Exhibitions",
    path: "/admin/exhibitions",
  }),
  inquirySection(
    "listing",
    "The shows themselves",
    "Each show is a record with its own dates, stand number and gallery — managed on its own screen.",
    { label: "Open Exhibitions", path: "/admin/exhibitions" },
    [
      { key: "heading", label: "Section heading", type: "text", default: "Exhibition Highlights", max: MEDIUM },
      {
        key: "intro",
        label: "Introduction above the list",
        type: "textarea",
        default: "The fairs we are showing at this season.",
        max: LONG,
      },
      colour("headingColor", "Section heading", "#01383B", "Colours"),
      colour("introColor", "Introduction", "#2F6B6B", "Colours"),
    ],
  ),
  structural("cta", "Plan your visit", "The dark panel inviting visitors to book a meeting."),
  structural("faq", "Questions", "The frequently asked questions below the shows."),
  structural("inquiry", "Enquiry form", "The enquiry form that closes the page.", {
    label: "Read enquiries under Inquiries",
    path: "/admin/inquiries",
  }),
];

const CONTACT_SECTIONS: ContentSection[] = [
  {
    key: "hero",
    label: "Hero",
    description: "The opening screen of the contact page.",
    fields: heroFields({
      eyebrow: "Contact Us",
      title: "Let's Talk About Your Next Collection",
      subtitle:
        "Tell us what you are planning and we will come back to you with what it takes to make it — quantities, timelines and finish.",
      ctaLabel: "Send an Enquiry",
    }),
  },
  inquirySection(
    "details",
    "Address and contact details",
    "The phone number, address and email shown on the page. Enquiries submitted through the form are read under Inquiries.",
    { label: "Open Inquiries", path: "/admin/inquiries" },
    [
      { key: "heading", label: "Section heading", type: "text", default: "Get in Touch", max: MEDIUM },
      { key: "phone", label: "Phone", type: "text", default: "+91 00000 00000", max: SHORT },
      { key: "email", label: "Email", type: "text", default: "info@promisejewels.com", max: MEDIUM },
      { key: "address", label: "Address", type: "textarea", default: "Rajkot, Gujarat, India", max: LONG },
      colour("headingColor", "Section heading", "#01383B", "Colours"),
      colour("detailColor", "Details text", "#2F6B6B", "Colours"),
    ],
  ),
];

// --- Header and Footer ----------------------------------------------------
//
// These are not pages. They are the two bands that appear on EVERY page, so
// they get their own tabs in the Editor rather than being edited from
// whichever page an editor happens to be looking at.

const HEADER_SECTIONS: ContentSection[] = [
  {
    key: "bar",
    label: "The navigation bar",
    description:
      "The menu that appears at the top of every page on the site, and the colours of the bar itself. Editing it here changes it everywhere at once.",
    fields: [
      { key: "link1", label: "Link 1", type: "text", default: "Home", group: "Menu", max: SHORT },
      { key: "link2", label: "Link 2", type: "text", default: "About", group: "Menu", max: SHORT },
      { key: "link3", label: "Link 3", type: "text", default: "Our Team", group: "Menu", max: SHORT },
      { key: "link4", label: "Link 4", type: "text", default: "Our Brand", group: "Menu", max: SHORT },
      { key: "link5", label: "Link 5", type: "text", default: "Collections", group: "Menu", max: SHORT },
      { key: "link6", label: "Link 6", type: "text", default: "Exhibition Highlights", group: "Menu", max: SHORT },
      { key: "link7", label: "Link 7", type: "text", default: "Blog", group: "Menu", max: SHORT },
      { key: "link8", label: "Link 8", type: "text", default: "Contact Us", group: "Menu", max: SHORT },
      colour("linkColor", "Menu text", "#F7F3EA"),
      colour("linkHoverColor", "Menu text — hovered", "#C9A15A"),
      colour("background", "Bar background", "#01383B"),
    ],
  },
];

const FOOTER_SECTIONS: ContentSection[] = [
  {
    key: "band",
    label: "The footer",
    description: "The closing band on every page: the wording, the colours and the moving line of names.",
    fields: [
      { key: "tagline", label: "Tagline", type: "text", default: "Crafted in Gujarat, worn everywhere.", max: MEDIUM },
      { key: "copyright", label: "Copyright line", type: "text", default: "© Promise Jewels Pvt Ltd", max: MEDIUM },
      picture("logo", "Logo", "/images/PROMISE_LOGO.webp", "Branding"),
      colour("background", "Footer background", "#0E2B26", "Colours"),
      colour("textColor", "Text", "#F7F3EA", "Colours"),
      colour("linkColor", "Links", "#D4B45C", "Colours"),
    ],
  },
  {
    key: "ticker",
    label: "The moving line",
    description:
      "The line of names that slides across the footer, the mark that separates them, and how fast it travels.",
    fields: [
      { key: "item1", label: "Word 1", type: "text", default: "Promise", group: "Words", max: SHORT },
      { key: "item2", label: "Word 2", type: "text", default: "Jewels", group: "Words", max: SHORT },
      { key: "item3", label: "Word 3", type: "text", default: "", group: "Words", max: SHORT },
      vector(
        "icon",
        "Separator mark",
        "/Icons/ticker-star.svg",
        "Appearance",
        "SVG only. The file is drawn as a mask, which is what lets the colour below apply to it — a PNG would keep its own colours and ignore the setting.",
      ),
      colour("iconColor", "Separator mark", "#C9A15A", "Appearance"),
      colour("itemColor", "Words", "#0B5B5D", "Appearance"),
      amount("speed", "Speed", 36, {
        min: 5,
        max: 120,
        step: 1,
        unit: "s per lap",
        group: "Motion",
        hint: "Seconds for one full pass. Higher is slower.",
      }),
      amount("gap", "Spacing between words", 60, {
        min: 8,
        max: 200,
        step: 4,
        unit: "px",
        group: "Motion",
      }),
    ],
  },
];

/**
 * Every page the Editor lists. Pages with no sections yet still appear as a
 * tab, so the Editor shows the whole site rather than implying Home is all
 * there is — adding one is a `sections` array here plus reading the values in
 * that page's components.
 */
export const CONTENT_PAGES: ContentPage[] = [
  { key: "home", label: "Home page", path: "/", sections: withTypography(HOME_SECTIONS), arrangeable: true },
  { key: "about", label: "About page", path: "/AboutPage", sections: withTypography(ABOUT_SECTIONS), arrangeable: true },
  { key: "collections", label: "Collections page", path: "/our-collection", sections: COLLECTIONS_SECTIONS, arrangeable: true },
  { key: "brands", label: "Brands page", path: "/our-brand", sections: BRANDS_SECTIONS, arrangeable: true },
  { key: "exhibitions", label: "Exhibitions page", path: "/Exhibition", sections: EXHIBITIONS_SECTIONS, arrangeable: true },
  { key: "contact", label: "Contact page", path: "/contact", sections: CONTACT_SECTIONS, arrangeable: true },
  { key: "blog", label: "Blog", path: "/blog", sections: BLOG_SECTIONS, arrangeable: true },
  // Not pages — the two bands that wrap every page. See the note above.
  { key: "header", label: "Header", path: "/", sections: HEADER_SECTIONS, standalone: true },
  { key: "footer", label: "Footer", path: "/", sections: FOOTER_SECTIONS, standalone: true },
];

export const VALID_PAGE_KEYS: string[] = CONTENT_PAGES.map((page) => page.key);

export function findPage(key: string): ContentPage | undefined {
  return CONTENT_PAGES.find((page) => page.key === key);
}

/** `{ section: { field: default } }` for one page. */
export function defaultsFor(page: ContentPage): Record<string, Record<string, string>> {
  const defaults: Record<string, Record<string, string>> = {};

  for (const section of page.sections) {
    defaults[section.key] = {};
    for (const field of section.fields) {
      defaults[section.key][field.key] = field.default;
    }
  }

  return defaults;
}

export const PAGE_CONTENT_MESSAGES = {
  FETCHED: "Content fetched successfully.",
  UPDATED: "Content updated successfully.",
  PAGE_NOT_FOUND: "Unknown page.",
  SECTION_NOT_FOUND: "Unknown section.",
  FIELD_NOT_FOUND: "Unknown field.",
  TOO_LONG: "That text is longer than this field allows.",
} as const;
