import { z } from "zod";

// A multipart form sends everything as a string, so the booleans and numbers
// are read back from text.
const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === "boolean" ? value : value === "true" || value === "1"))
  .optional();

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
  designation: z
    .string()
    .trim()
    .min(2, "Role must be at least 2 characters")
    .max(120, "Role is too long"),
  bio: z.string().trim().max(600, "The short line is limited to 600 characters").optional(),
  displayOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  isActive: boolFromString,
});

export const updateTeamSchema = createTeamSchema.partial().extend({
  removePhoto: boolFromString,
});

export const reorderTeamSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one person is required").max(500),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
