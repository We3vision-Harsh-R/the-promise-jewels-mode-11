import { z } from "zod";

// Empty string is allowed (clearing a social link) — that's why these
// use .or(z.literal("")) instead of just .url().optional().
const optionalUrl = z.string().trim().url().or(z.literal("")).optional();

export const updateSettingsSchema = z.object({
  site_name: z.string().trim().min(2, "Site name must be at least 2 characters").max(150).optional(),

  contact_email: z.string().trim().email("Enter a valid email").optional(),

  contact_phone: z.string().trim().max(30).optional(),

  address: z.string().trim().max(500).optional(),

  // One line per row, newline separated.
  business_hours: z.string().trim().max(300).optional(),

  // Whether signing in needs the emailed one-time code. Off by default —
  // see auth/otp-policy.ts for why.
  otp_required: z.boolean().optional(),

  social: z
    .object({
      instagram: optionalUrl,
      facebook: optionalUrl,
      linkedin: optionalUrl,
    })
    .optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),

  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(72, "New password is too long"),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
