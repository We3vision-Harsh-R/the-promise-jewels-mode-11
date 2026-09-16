import { z } from "zod";

/**
 * Admin account input.
 *
 * The password floor matches the sign-in schema (8 characters) rather than
 * being stricter here. A stricter rule on creation than on login produces
 * accounts whose own password would be rejected if they tried to set it again,
 * which is the kind of inconsistency nobody finds until it bites.
 */
const password = z
  .string()
  .trim()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be under 100 characters");

const name = z
  .string()
  .trim()
  .min(2, "A name needs at least two characters")
  .max(80, "Names are limited to 80 characters");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("That does not look like an email address");

const roleId = z.string().trim().min(1, "Choose a role for this account");

export const createUserSchema = z.object({
  name,
  email,
  password,
  roleId,
});

/**
 * Email is absent on purpose: it is the address the one-time sign-in code goes
 * to, so changing it changes who can get into the account. That is a different,
 * more dangerous operation than editing a name, and it should not ride along in
 * the same form.
 */
export const updateUserSchema = z.object({
  name: name.optional(),
  roleId: roleId.optional(),
  isActive: z.boolean().optional(),
  password: password.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
