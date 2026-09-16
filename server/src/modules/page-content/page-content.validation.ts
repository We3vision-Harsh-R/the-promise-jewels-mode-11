import { z } from "zod";

// Shape only. WHICH sections and fields are allowed, and how long each may
// be, depends on the page being saved — the service checks that against the
// declared schema, where the page key is known.
export const updatePageContentSchema = z.object({
  values: z.record(z.string(), z.record(z.string(), z.string())),
});

export type UpdatePageContentInput = z.infer<typeof updatePageContentSchema>;
