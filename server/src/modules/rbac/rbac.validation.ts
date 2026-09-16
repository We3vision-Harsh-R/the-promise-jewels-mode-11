import { z } from "zod";

import { ALL_PERMISSIONS } from "./permissions.catalog.js";

/**
 * Role input.
 *
 * The permission list is checked against the catalogue here AND again in the
 * service. That is not redundancy for its own sake: this schema rejects a
 * malformed request early with a clear message, and the service's check is
 * what protects the database from any other caller — a script, a future
 * endpoint, a test — that does not pass through this middleware.
 */
const permission = z.enum(ALL_PERMISSIONS as [string, ...string[]]);

const name = z
  .string()
  .trim()
  .min(2, "A role name needs at least two characters")
  .max(40, "Role names are limited to 40 characters");

const description = z
  .string()
  .trim()
  .max(200, "Keep the description under 200 characters")
  .optional()
  .or(z.literal(""));

export const createRoleSchema = z.object({
  name,
  description,
  // An empty list is allowed: a role that can sign in and see nothing is a
  // legitimate starting point, and better than forcing a first guess.
  permissions: z.array(permission).max(ALL_PERMISSIONS.length),
});

export const updateRoleSchema = z.object({
  name: name.optional(),
  description,
  permissions: z.array(permission).max(ALL_PERMISSIONS.length).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
