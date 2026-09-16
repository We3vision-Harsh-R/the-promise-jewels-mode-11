import { z } from "zod";

import { RobotsPolicy } from "@prisma/client";

export const updateSeoSettingsSchema = z.object({
  siteName: z.string().trim().min(1, "Site name is required"),

  siteUrl: z.string().trim().url("Invalid site URL"),

  defaultMetaTitle: z.string().trim().min(1, "Default meta title is required"),

  defaultMetaDescription: z
    .string()
    .trim()
    .min(1, "Default meta description is required"),

  defaultOgImage: z
    .string()
    .trim()
    .url("Invalid default OG image URL")
    .optional()
    .or(z.literal("")),

  robots: z.nativeEnum(RobotsPolicy).optional(),
});

export type UpdateSeoSettingsInput = z.infer<typeof updateSeoSettingsSchema>;
