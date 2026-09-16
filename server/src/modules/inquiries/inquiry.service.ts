import { randomUUID } from "crypto";
import * as XLSX from "xlsx";

import inquiryRepository from "./inquiry.repository.js";

import { ApiError } from "../../utils/ApiError.js";

import {
  INQUIRY_DEFAULTS,
  INQUIRY_EXPORT_COLUMNS,
  INQUIRY_MESSAGES,
} from "./inquiry.constants.js";

import type {
  CreateInquiryDto,
  InquiryExportRow,
  InquiryListQuery,
  UpdateInquiryStatusDto,
} from "./inquiry.types.js";

class InquiryService {
  /**
   * ===========================
   * Public
   * ===========================
   */

  async createInquiry(data: CreateInquiryDto) {
    return inquiryRepository.create({
      id: randomUUID(),

      name: data.name,

      email: data.email,

      phone: data.phone,

      company: data.company || null,

      message: data.message,
    });
  }

  /**
   * ===========================
   * Admin
   * ===========================
   */

  async listInquiries(query: InquiryListQuery) {
    const page =
      query.page || INQUIRY_DEFAULTS.PAGE;

    const limit = Math.min(
      query.limit || INQUIRY_DEFAULTS.LIMIT,
      INQUIRY_DEFAULTS.MAX_LIMIT,
    );

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      inquiryRepository.findMany({
        skip,
        take: limit,

        search: query.search,

        status: query.status,

        sortBy: query.sortBy,

        sortOrder: query.sortOrder,
      }),

      inquiryRepository.count(
        query.search,
        query.status,
      ),
    ]);

    const totalPages =
      Math.ceil(total / limit) || 1;

    return {
      items,

      pagination: {
        page,

        limit,

        total,

        totalPages,

        hasNext: page < totalPages,

        hasPrevious: page > 1,
      },
    };
  }

  async getInquiryById(id: string) {
    const inquiry =
      await inquiryRepository.findById(id);

    if (!inquiry) {
      throw new ApiError(
        404,
        INQUIRY_MESSAGES.NOT_FOUND,
      );
    }

    return inquiry;
  }

  async updateInquiryStatus(
    id: string,
    data: UpdateInquiryStatusDto,
  ) {
    const inquiry =
      await this.getInquiryById(id);

    if (inquiry.status === data.status) {
      return inquiry;
    }

    return inquiryRepository.updateStatus(
      id,
      data.status,
    );
  }

  async deleteInquiry(id: string) {
    await this.getInquiryById(id);

    await inquiryRepository.softDelete(id);

    return {
      message:
        INQUIRY_MESSAGES.DELETED,
    };
  }
    async exportInquiries(query: InquiryListQuery) {
    const inquiries = await inquiryRepository.findAll({
      search: query.search,
      status: query.status,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    const rows: InquiryExportRow[] = inquiries.map((inquiry) => ({
      Name: inquiry.name,
      Email: inquiry.email,
      Phone: inquiry.phone,
      Company: inquiry.company ?? "",
      Message: inquiry.message,
      Status: inquiry.status,
      "Created At": inquiry.createdAt.toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...INQUIRY_EXPORT_COLUMNS],
    });

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Inquiries",
    );

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return {
      fileName: `inquiries-${new Date()
        .toISOString()
        .split("T")[0]}.xlsx`,
      buffer,
      message: INQUIRY_MESSAGES.EXPORTED,
    };
  }
}

export default new InquiryService();