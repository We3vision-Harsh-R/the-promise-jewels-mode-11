import { z } from "zod";

const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((val) => (typeof val === "boolean" ? val : val === "true" || val === "1"))
  .optional();

export const createCollectionSchema = z.object({
  brandId: z.string().trim().min(1, "Please select a brand."),

  name: z
    .string()
    .trim()
    .min(2, "Collection name must be at least 2 characters")
    .max(150, "Collection name is too long"),

  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters"),

  category: z.string().trim().max(100).optional(),

  specification: z.string().trim().max(5000).optional(),

  ctaTitle: z.string().trim().max(150).optional(),

  ctaButtonText: z.string().trim().max(50).optional(),

  featured: boolFromString,

  displayOrder: z.coerce.number().int().min(0).optional(),

  isActive: boolFromString,
});

export const updateCollectionSchema = createCollectionSchema.partial();

export const reorderCollectionsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        displayOrder: z.coerce.number().int().min(0),
      }),
    )
    .min(1, "At least one item is required"),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type ReorderCollectionsInput = z.infer<typeof reorderCollectionsSchema>;
