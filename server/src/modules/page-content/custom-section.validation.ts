import { z } from "zod";

import { blocksSchema, sectionStyleSchema } from "./custom-section.types.js";

/**
 * A designed section, on the way in.
 *
 * The blocks and the style carry their own rules (custom-section.types.ts) —
 * this only adds what surrounds them, so there is one place that says what a
 * block may contain and it is the same place the renderer reads.
 */
const body = {
  label: z
    .string()
    .trim()
    .min(1, "Give the section a name")
    .max(60, "Keep the name short — it is a label, not a heading"),
  blocks: blocksSchema,
  style: sectionStyleSchema,
};

export const createCustomSectionSchema = z.object({
  page: z.string().trim().min(1, "Which page is this for?"),
  ...body,
});

export const updateCustomSectionSchema = z.object(body);
