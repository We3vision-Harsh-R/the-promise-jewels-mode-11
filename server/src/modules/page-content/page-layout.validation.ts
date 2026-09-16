import { z } from "zod";

/**
 * A page's arrangement.
 *
 * The whole list is always sent — see saveLayout for why a diff would be
 * worse. The section KEYS are checked against the catalogue in the service
 * rather than here, because only the service knows which page is being saved.
 */
export const saveLayoutSchema = z.object({
  sections: z
    .array(
      z.object({
        key: z.string().trim().min(1),
        isVisible: z.boolean(),
      }),
    )
    .min(1, "A page needs at least one section"),
});

export type SaveLayoutInput = z.infer<typeof saveLayoutSchema>;
