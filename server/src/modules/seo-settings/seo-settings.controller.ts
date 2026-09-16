import { Request, Response } from "express";

import seoSettingsService from "./seo-settings.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { SEO_SETTINGS_MESSAGES } from "./seo-settings.constants.js";

class SeoSettingsController {
  get = asyncHandler(async (_req: Request, res: Response) => {
    const settings = await seoSettingsService.get();

    res
      .status(200)
      .json(new ApiResponse(true, SEO_SETTINGS_MESSAGES.FETCHED, settings));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const settings = await seoSettingsService.update(req.body);

    res
      .status(200)
      .json(new ApiResponse(true, SEO_SETTINGS_MESSAGES.UPDATED, settings));
  });
}

export default new SeoSettingsController();
