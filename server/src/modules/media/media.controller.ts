import { Request, Response } from "express";

import mediaService from "./media.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { MEDIA_MESSAGES } from "./media.constants.js";

/**
 * The image library. Uploading is all this does now — the Editor saves the
 * returned URL into the page_content field the picture belongs to, so there
 * is no separate "publish this image to that frame" step any more.
 */
class MediaController {
  listAssets = asyncHandler(async (_req: Request, res: Response) => {
    const assets = await mediaService.listAssets();

    res.status(200).json(new ApiResponse(true, MEDIA_MESSAGES.FETCHED, assets));
  });

  upload = asyncHandler(async (req: Request, res: Response) => {
    const asset = await mediaService.uploadAsset(req.file);

    res.status(201).json(new ApiResponse(true, MEDIA_MESSAGES.UPLOADED, asset));
  });

  deleteAsset = asyncHandler(async (req: Request, res: Response) => {
    const result = await mediaService.deleteAsset(req.params.id as string);

    res.status(200).json(new ApiResponse(true, MEDIA_MESSAGES.DELETED, result));
  });
}

export default new MediaController();
