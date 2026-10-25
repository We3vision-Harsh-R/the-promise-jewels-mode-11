import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),

  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters")
    .max(100),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});

const otpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "OTP must be 6 digits");

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),

  otp: otpCode,
});

// Step 2 of a password reset: the emailed code, checked on the server.
export const verifyResetOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),

  otp: otpCode,
});

// A new password must be long enough to resist guessing and not be a bare word
// or a bare number; the same rule is shown on the form.
const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be at most 100 characters")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/\d/, "Password must include a number");

// Step 3: the short-lived reset token the server handed out after step 2 — not
// the emailed code. Without that token no password can be changed.
export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),

  resetToken: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/, "Invalid reset session"),

  newPassword,
});

export type LoginSchema = z.infer<typeof loginSchema>;

export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;

export type VerifyResetOtpSchema = z.infer<typeof verifyResetOtpSchema>;

export type VerifyOtpSchema = z.infer<typeof verifyOtpSchema>;

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;