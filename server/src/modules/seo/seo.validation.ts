import { z } from "zod";

import {
  RobotsPolicy,
  SchemaType,
  SitemapChangeFrequency,
} from "@prisma/client";

export const updateSeoSchema = z.object({
  body: z.object({
    metaTitle: z
      .string()
      .trim()
      .min(10, "Meta title must be at least 10 characters.")
      .max(60, "Meta title cannot exceed 60 characters."),

    metaDescription: z
      .string()
      .trim()
      .min(50, "Meta description must be at least 50 characters.")
      .max(160, "Meta description cannot exceed 160 characters."),

    canonicalUrl: z
      .string()
      .trim()
      .url("Invalid canonical URL.")
      .optional()
      .or(z.literal("")),

    robots: z.nativeEnum(RobotsPolicy),

    ogTitle: z
      .string()
      .trim()
      .max(60)
      .optional()
      .or(z.literal("")),

    ogDescription: z
      .string()
      .trim()
      .max(200)
      .optional()
      .or(z.literal("")),

    ogImage: z
      .string()
      .trim()
      .url()
      .optional()
      .or(z.literal("")),

    twitterTitle: z
      .string()
      .trim()
      .max(60)
      .optional()
      .or(z.literal("")),

    twitterDescription: z
      .string()
      .trim()
      .max(200)
      .optional()
      .or(z.literal("")),

    twitterImage: z
      .string()
      .trim()
      .url()
      .optional()
      .or(z.literal("")),

    schemaType: z.nativeEnum(SchemaType),

    priority: z
      .number()
      .min(0)
      .max(1),

    changeFrequency: z.nativeEnum(
      SitemapChangeFrequency,
    ),

    includeInSitemap: z.boolean(),

    isIndexed: z.boolean(),

    isPublished: z.boolean(),

    tags: z.union([
      z.string(),

      z.array(z.string()),
    ]),
  }),
});

export type UpdateSeoInput = z.infer<
  typeof updateSeoSchema
>;