import { z } from "zod";

// multipart/form-data always sends strings, so booleans need coercion
const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((val) => (typeof val === "boolean" ? val : val === "true" || val === "1"))
  .optional();

export const createBrandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Brand name must be at least 2 characters")
    .max(150, "Brand name is too long"),

  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters"),

  overview: z.string().trim().max(5000).optional(),

  ctaTitle: z.string().trim().max(150).optional(),

  ctaButtonText: z.string().trim().max(50).optional(),

  displayOrder: z.coerce.number().int().min(0).optional(),

  isActive: boolFromString,
});

export const updateBrandSchema = createBrandSchema.partial();

export const reorderBrandsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        displayOrder: z.coerce.number().int().min(0),
      }),
    )
    .min(1, "At least one item is required"),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type ReorderBrandsInput = z.infer<typeof reorderBrandsSchema>;
