import { Request, Response } from "express";

import seoService from "./seo.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { SEO_MESSAGES } from "./seo.constants.js";

class SeoController {
  getAll = asyncHandler(async (_req: Request, res: Response) => {
    const pages = await seoService.getAll();

    res
      .status(200)
      .json(new ApiResponse(true, "SEO pages fetched successfully.", pages));
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
   const id = String(req.params.id);

   const page = await seoService.getById(id);

    res
      .status(200)
      .json(new ApiResponse(true, SEO_MESSAGES.SEO_PAGE_FETCHED, page));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { tags, ...payload } = req.body;

   const id = String(req.params.id);

   const page = await seoService.update(id, payload, tags);

    res
      .status(200)
      .json(new ApiResponse(true, SEO_MESSAGES.SEO_PAGE_UPDATED, page));
  });
}

export default new SeoController();
