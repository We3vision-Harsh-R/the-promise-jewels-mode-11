import { Request, Response } from "express";

import inquiryService from "./inquiry.service.js";
import { getParam } from "../../utils/helpers.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

import {
  INQUIRY_MESSAGES,
  INQUIRY_DEFAULTS,
} from "./inquiry.constants.js";

class InquiryController {
  /**
   * ===========================
   * Public
   * ===========================
   */

  createInquiry = asyncHandler(
    async (req: Request, res: Response) => {
      const inquiry =
        await inquiryService.createInquiry(req.body);

      return res.status(201).json(
        new ApiResponse(
          true,
          INQUIRY_MESSAGES.CREATED,
          inquiry,
        ),
      );
    },
  );

  /**
   * ===========================
   * Admin
   * ===========================
   */

  listInquiries = asyncHandler(
    async (req: Request, res: Response) => {
      const result =
        await inquiryService.listInquiries({
          page:
            Number(req.query.page) ||
            INQUIRY_DEFAULTS.PAGE,

          limit:
            Number(req.query.limit) ||
            INQUIRY_DEFAULTS.LIMIT,

          search: req.query.search as string,

          status: req.query.status as any,

          sortBy: req.query.sortBy as any,

          sortOrder: req.query.sortOrder as any,
        });

      return res.status(200).json(
        new ApiResponse(
          true,
          INQUIRY_MESSAGES.LISTED,
          result,
        ),
      );
    },
  );

  getInquiryById = asyncHandler(
    async (req: Request, res: Response) => {
      const inquiry =
        await inquiryService.getInquiryById(
          getParam(req.params.id),
        );

      return res.status(200).json(
        new ApiResponse(
          true,
          INQUIRY_MESSAGES.FETCHED,
          inquiry,
        ),
      );
    },
  );

  updateInquiryStatus = asyncHandler(
    async (req: Request, res: Response) => {
      const inquiry =
        await inquiryService.updateInquiryStatus(
          getParam(req.params.id),
          req.body,
        );

      return res.status(200).json(
        new ApiResponse(
          true,
          INQUIRY_MESSAGES.UPDATED,
          inquiry,
        ),
      );
    },
  );

  deleteInquiry = asyncHandler(
    async (req: Request, res: Response) => {
      const result =
        await inquiryService.deleteInquiry(
          getParam(req.params.id),
        );

      return res.status(200).json(
        new ApiResponse(
          true,
          result.message,
        ),
      );
    },
  );

  /**
   * ===========================
   * Export
   * ===========================
   */

  exportInquiries = asyncHandler(
    async (req: Request, res: Response) => {
      const result =
        await inquiryService.exportInquiries({
          page:
            Number(req.query.page) ||
            INQUIRY_DEFAULTS.PAGE,

          limit:
            Number(req.query.limit) ||
            INQUIRY_DEFAULTS.LIMIT,

          search: req.query.search as string,

          status: req.query.status as any,

          sortBy: req.query.sortBy as any,

          sortOrder: req.query.sortOrder as any,
        });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );

      return res.send(result.buffer);
    },
  );
}

export default new InquiryController();