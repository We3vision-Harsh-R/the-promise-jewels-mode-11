import { z } from "zod";

import {
  BRAND_PALETTE,
  FONT_FAMILIES,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHTS,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
} from "./page-content.constants.js";

/**
 * What a designed section is made of.
 *
 * A declared section is a React component: it can pin itself to the scroll,
 * mask photographs into rings and run a GSAP timeline, and every one of those
 * behaviours is written by hand. A designed section cannot do any of that, and
 * pretending otherwise would produce a builder that promises a page and
 * delivers a broken one.
 *
 * What it CAN do is the shape most sections actually are underneath: a band of
 * colour holding a heading, some words, a picture, a button. Six block types
 * cover that, and each one is rendered with the same brand rules the rest of
 * the site follows — so a section built here looks like it belongs, which is
 * the harder half of the problem.
 *
 * Everything below is validated on the way in. The values end up in inline
 * styles on the public website, so an unchecked field here is a stylesheet
 * anyone with the panel can write. Fonts, weights and sizes are checked
 * against the same lists the Editor offers, exactly as page-content does.
 */

const FONT_VALUES = FONT_FAMILIES.map((font) => font.value);
const WEIGHT_VALUES = FONT_WEIGHTS.map((weight) => weight.value);

/** #rgb or #rrggbb. Nothing else — no rgb(), no named colours, no url(). */
const colour = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a colour like #0E4238");

const font = z.enum(FONT_VALUES as [string, ...string[]]);
const weight = z.enum(WEIGHT_VALUES as [string, ...string[]]);
const fontSize = z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX);
const spacing = z.number().min(LETTER_SPACING_MIN).max(LETTER_SPACING_MAX);
const align = z.enum(["left", "center", "right"]);

/**
 * Typography, shared by the blocks that show words.
 *
 * Optional throughout: a block that sets nothing inherits the section's own
 * defaults, which are in turn the brand's. That matters for the person who
 * just wants a heading and does not want to answer six questions to get one.
 */
const typography = {
  font: font.optional(),
  size: fontSize.optional(),
  weight: weight.optional(),
  spacing: spacing.optional(),
  color: colour.optional(),
  align: align.optional(),
};

const id = z.string().trim().min(1).max(60);

const headingBlock = z.object({
  id,
  type: z.literal("heading"),
  text: z.string().trim().min(1, "A heading needs words").max(160),
  /** 1 is the page's own title; a section's heading is normally 2. */
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  ...typography,
});

const textBlock = z.object({
  id,
  type: z.literal("text"),
  text: z.string().trim().min(1, "A paragraph needs words").max(2000),
  ...typography,
});

const imageBlock = z.object({
  id,
  type: z.literal("image"),
  /** An uploaded asset's URL, or a path under /images. */
  url: z.string().trim().min(1, "Choose a picture").max(500),
  alt: z.string().trim().max(200).default(""),
  width: z.enum(["full", "wide", "half", "third"]).default("wide"),
  /** Corner rounding in pixels. The site's own tiles sit around 24. */
  radius: z.number().int().min(0).max(80).default(24),
  align: align.optional(),
});

const buttonBlock = z.object({
  id,
  type: z.literal("button"),
  label: z.string().trim().min(1, "A button needs a label").max(60),
  /**
   * Where it goes. A path on this site, or a full http(s) address.
   *
   * Anything else is refused — "javascript:" in an href is a script the panel
   * would be publishing to every visitor, and a designed section is the one
   * place in this codebase where a non-developer supplies a URL that ends up
   * in the markup.
   */
  href: z
    .string()
    .trim()
    .min(1, "Where should this button go?")
    .max(500)
    .refine(
      (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
      "Use a path like /contact or a full https:// address",
    ),
  background: colour.optional(),
  color: colour.optional(),
  align: align.optional(),
});

const spacerBlock = z.object({
  id,
  type: z.literal("spacer"),
  height: z.number().int().min(4).max(240).default(40),
});

const dividerBlock = z.object({
  id,
  type: z.literal("divider"),
  color: colour.optional(),
});

export const blockSchema = z.discriminatedUnion("type", [
  headingBlock,
  textBlock,
  imageBlock,
  buttonBlock,
  spacerBlock,
  dividerBlock,
]);

/**
 * The band itself: what sits behind the blocks and how much air they get.
 *
 * Capped rather than free. A section is part of a page, and a builder that
 * allows 900px of padding allows someone to make the site look broken from
 * a form with no way to tell it went wrong.
 */
export const sectionStyleSchema = z.object({
  background: colour.default("#FFFFFF"),
  /** Vertical breathing room, in pixels. The site's bands run 76–110. */
  paddingY: z.number().int().min(0).max(200).default(90),
  /** How wide the content runs inside the band. */
  width: z.enum(["narrow", "normal", "wide"]).default("normal"),
  align: align.default("center"),
});

export const blocksSchema = z
  .array(blockSchema)
  .min(1, "A section needs at least one block")
  .max(30, "A section this long is really two sections");

export type SectionBlock = z.infer<typeof blockSchema>;
export type SectionStyle = z.infer<typeof sectionStyleSchema>;

/** Offered to the designer so the panel and the site agree on what exists. */
export const BLOCK_TYPES = [
  { type: "heading", label: "Heading", description: "A title for the band." },
  { type: "text", label: "Paragraph", description: "A run of words." },
  { type: "image", label: "Picture", description: "One image, centred." },
  { type: "button", label: "Button", description: "A link that looks like a button." },
  { type: "spacer", label: "Space", description: "Empty room between blocks." },
  { type: "divider", label: "Line", description: "A hairline rule." },
] as const;

export const SECTION_WIDTHS = [
  { value: "narrow", label: "Narrow — for reading" },
  { value: "normal", label: "Normal" },
  { value: "wide", label: "Wide — edge to edge" },
] as const;

export { BRAND_PALETTE };
