import { InquiryStatus } from "@prisma/client";

export interface CreateInquiryDto {
  name: string;
  email: string;
  phone: string;
  company?: string;
  message: string;
}

export interface UpdateInquiryStatusDto {
  status: InquiryStatus;
}

export interface InquiryListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: InquiryStatus;
  sortBy?: "createdAt" | "name" | "email" | "status";
  sortOrder?: "asc" | "desc";
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface InquiryExportRow {
  Name: string;
  Email: string;
  Phone: string;
  Company: string;
  Message: string;
  Status: string;
  "Created At": string;
}