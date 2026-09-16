import { Request, Response } from "express";

import settingsService from "./settings.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { SETTINGS_MESSAGES } from "./settings.constants.js";

class SettingsController {
  // ---- Public ----

  getPublic = asyncHandler(async (_req: Request, res: Response) => {
    const settings = await settingsService.getPublic();
    res.status(200).json(new ApiResponse(true, SETTINGS_MESSAGES.FETCHED, settings));
  });

  // ---- Admin ----

  getAdmin = asyncHandler(async (_req: Request, res: Response) => {
    const settings = await settingsService.getAdmin();
    res.status(200).json(new ApiResponse(true, SETTINGS_MESSAGES.FETCHED, settings));
  });

  updateAdmin = asyncHandler(async (req: Request, res: Response) => {
    const settings = await settingsService.updateAdmin(req.body);
    res.status(200).json(new ApiResponse(true, SETTINGS_MESSAGES.UPDATED, settings));
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    await settingsService.changePassword(req.userId as string, req.body);
    res.status(200).json(new ApiResponse(true, SETTINGS_MESSAGES.PASSWORD_UPDATED, null));
  });
}

export default new SettingsController();
