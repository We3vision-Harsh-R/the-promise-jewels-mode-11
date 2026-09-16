import { InquiryStatus } from "@prisma/client";

export const INQUIRY_MESSAGES = {
  CREATED: "Inquiry submitted successfully.",
  FETCHED: "Inquiry fetched successfully.",
  LISTED: "Inquiries fetched successfully.",
  UPDATED: "Inquiry updated successfully.",
  DELETED: "Inquiry deleted successfully.",
  EXPORTED: "Inquiry exported successfully.",

  NOT_FOUND: "Inquiry not found.",
  INVALID_STATUS: "Invalid inquiry status.",
} as const;

export const INQUIRY_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export const INQUIRY_STATUS = {
  NEW: InquiryStatus.NEW,
  READ: InquiryStatus.READ,
} as const;

export const INQUIRY_SORT_FIELDS = [
  "createdAt",
  "name",
  "email",
  "status",
] as const;

export const INQUIRY_SEARCH_FIELDS = [
  "name",
  "email",
  "phone",
  "company",
] as const;

export const INQUIRY_EXPORT_COLUMNS = [
  "Name",
  "Email",
  "Phone",
  "Company",
  "Message",
  "Status",
  "Created At",
] as const;