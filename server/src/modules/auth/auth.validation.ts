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

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),

  otp: z.string().trim().length(6, "OTP must be 6 digits"),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),

  otp: z.string().trim().length(6),

  newPassword: z.string().min(8).max(100),
});

export type LoginSchema = z.infer<typeof loginSchema>;

export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;

export type VerifyOtpSchema = z.infer<typeof verifyOtpSchema>;

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;