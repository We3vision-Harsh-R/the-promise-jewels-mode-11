import { InquiryStatus } from "@prisma/client";
import { z } from "zod";

/**
 * ==========================
 * Public Contact Form
 * ==========================
 */

export const createInquirySchema = z.object({
  name: z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(100)
  .regex(
    /^[A-Za-z\s.'-]+$/,
    "Name can only contain letters, spaces, apostrophes, periods, and hyphens."
  ),

 email: z
  .string()
  .trim()
  .toLowerCase()
  .min(5)
  .max(254)
  .email("Please enter a valid email address."),

phone: z
  .string()
  .trim()
  .regex(
    /^\d{10}$/,
    "Please enter a valid 10-digit phone number."
  ),

  company: z
    .string()
    .trim()
    .max(150)
    .optional()
    .or(z.literal("")),

  message: z
    .string()
    .trim()
    .min(10, "Message is too short.")
    .max(2000),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

/**
 * ==========================
 * Admin Update Status
 * ==========================
 */

export const updateInquirySchema = z.object({
  status: z.nativeEnum(InquiryStatus),
});

export type UpdateInquiryInput = z.infer<typeof updateInquirySchema>;

/**
 * ==========================
 * List / Pagination
 * ==========================
 */

export const inquiryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().max(100).optional(),

  status: z.nativeEnum(InquiryStatus).optional(),

  sortBy: z
    .enum([
      "createdAt",
      "name",
      "email",
      "status",
    ])
    .default("createdAt"),

  sortOrder: z
    .enum(["asc", "desc"])
    .default("desc"),
});

export type InquiryQueryInput = z.infer<typeof inquiryQuerySchema>;

/**
 * ==========================
 * Params
 * ==========================
 */

export const inquiryIdSchema = z.object({
  id: z.string().uuid("Invalid inquiry id."),
});

export type InquiryIdInput = z.infer<typeof inquiryIdSchema>;