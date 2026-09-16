import { z } from "zod";


/**
 * Operator-defined extra content on a show.
 *
 * The client keeps asking for details nobody planned a column for — a stall
 * number this year, a travel note the next — and a migration per request does
 * not scale. One section is one extra block on the public page; one field
 * inside it is one labelled line. Add a section in the admin panel and it
 * appears on the site; nothing here needs changing to add either.
 *
 * This IS the contract. Sections are stored as real rows in
 * exhibition_sections / exhibition_section_fields, but those columns are plain
 * text with no length limits of their own, so this schema is still the only
 * thing standing between a hand-rolled request and a shape the public page
 * cannot render. The caps bound how much a single show can push onto the page;
 * this is the one place to raise them.
 */
export const customSectionsSchema = z
  .array(
    z.object({
      title: z
        .string()
        .trim()
        .min(1, "Give the section a heading.")
        .max(120, "Section heading is too long."),

      fields: z
        .array(
          z.object({
            label: z
              .string()
              .trim()
              .min(1, "Every field needs a label.")
              .max(120, "Field label is too long."),

            value: z.string().trim().max(5000, "Field value is too long."),
          }),
        )
        .max(50, "A section can hold at most 50 fields."),
    }),
  )
  .max(30, "A show can hold at most 30 custom sections.");

const exhibitionFields = {
  title: z
    .string()
    .trim()
    .min(1)
    .max(200),

  description: z
    .string()
    .trim()
    .min(1)
    .max(5000),

  venue: z
    .string()
    .trim()
    .min(1)
    .max(200),

  city: z
    .string()
    .trim()
    .max(200, "City is too long.")
    .optional(),

  country: z
    .string()
    .trim()
    .max(200, "State / Country is too long.")
    .optional(),

  startDate: z.coerce.date(),

  endDate: z.coerce.date(),

  featured: z.boolean().optional(),

  isActive: z.boolean().optional(),

  // ---- Everything the public /Exhibition page renders ----
  //
  // NOTE ON THE LIMITS BELOW. The original caps (12 highlights, 300-character
  // audience, 100-character hours/city/country, 6 venues) were arbitrary and
  // small enough that ordinary content hit them — and because the admin only
  // showed "Validation failed." with no field name, that read as the form
  // being broken rather than as a limit. They have been raised to numbers a
  // real show will not reach, and every one now carries its own message so
  // the admin can name the field. Raise them here, in one place, if ever
  // needed again.
  //
  // These columns already existed on the model and the admin form already
  // collected them, but they were missing from this schema — and `validate()`
  // replaces req.body with the PARSED object, so zod silently dropped every
  // one of them on the way in. That is why saved shows came back with a name
  // and a date range and nothing else.
  //
  // `name` and `region` are deliberately NOT listed: the admin form composes
  // them into `title` and `country` before sending, so letting them through
  // would hand Prisma columns that do not exist.

  // 1800, not 1900. The admin form derives this from the show's start date for
  // records that predate the field, so a row with an odd date (ROOTZ carries
  // 1858) produced a year the schema rejected — and that show could then never
  // be saved at all, whatever else you changed. The range only exists to catch
  // a typo, so it should sit well outside anything real.
  year: z.coerce
    .number()
    .int()
    .min(1800, "Year looks wrong — check the date.")
    .max(2200, "Year looks wrong — check the date.")
    .optional(),

  edition: z.string().trim().max(200, "Edition is too long.").optional(),

  organiser: z.string().trim().max(300, "Organiser is too long.").optional(),

  audience: z.string().trim().max(1000, "Who attends is too long.").optional(),

  hours: z.string().trim().max(200, "Show hours is too long.").optional(),

  whyWeExhibit: z.string().trim().max(5000, "Why we exhibit is too long.").optional(),

  /** Bullet list under each show. Stored as a Json array of strings. */
  highlights: z
    .array(z.string().trim().min(1).max(500, "One highlight line is too long."))
    .max(50, "At most 50 highlight lines.")
    .optional(),

  /**
   * Per-hall schedule. A show can run different dates at each venue (IIJS
   * does), which the flat startDate/endDate pair cannot express.
   */
  venues: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Venue needs a name.").max(300, "Venue name is too long."),
        area: z.string().trim().max(300, "Venue area is too long.").optional().default(""),
        start: z.string().trim().min(1),
        end: z.string().trim().min(1),
      }),
    )
    .min(1, "Add at least one venue.")
    .max(20, "At most 20 venues.")
    .optional(),

  /** See customSectionsSchema above — the extensible half of a show. */
  customSections: customSectionsSchema.optional(),

  datesConfirmed: z.boolean().optional(),
};



export const createExhibitionSchema =
  z.object(exhibitionFields)
  .refine(
    (data)=>data.endDate >= data.startDate,
    {
      message:
      "End date must be greater than start date",

      path:[
        "endDate"
      ],
    }
  );



export const updateExhibitionSchema =
  z.object(exhibitionFields)
  .partial()
  .refine(
    (data)=>{

      if(
        !data.startDate ||
        !data.endDate
      ){
        return true;
      }


      return data.endDate >= data.startDate;

    },
    {
      message:
      "End date must be greater than start date",

      path:[
        "endDate"
      ],
    }
  );



export const searchExhibitionSchema =
z.object({

  keyword:
  z.string()
  .trim()
  .min(1),


  page:
  z.coerce
  .number()
  .int()
  .positive()
  .default(1),


  limit:
  z.coerce
  .number()
  .int()
  .min(1)
  .max(50)
  .default(20),

});



export const exhibitionIdSchema =
z.object({

 id:
 z.string()
 .trim()
 .min(1),

});



export const exhibitionSlugSchema =
z.object({

 slug:
 z.string()
 .trim()
 .min(1),

});



export const imageIdSchema =
z.object({

 imageId:
 z.string()
 .trim()
 .min(1),

});



export const uploadImageSchema =
z.object({

 altText:
 z.string()
 .optional(),


 caption:
 z.string()
 .optional(),

});



export type CreateExhibitionInput =
z.infer<
 typeof createExhibitionSchema
>;


export type UpdateExhibitionInput =
z.infer<
 typeof updateExhibitionSchema
>;