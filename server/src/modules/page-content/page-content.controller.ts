import { Request, Response } from "express";

import pageContentService from "./page-content.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { PAGE_CONTENT_MESSAGES } from "./page-content.constants.js";
import {
  getLayout,
  getPublicLayout,
  saveLayout,
} from "./page-layout.service.js";

class PageContentController {
  // ---- Layout: which sections appear, and in what order ----

  /** The website reads this: visible section keys, in order. */
  getPublicLayout = asyncHandler(async (req: Request, res: Response) => {
    const keys = await getPublicLayout(req.params.page as string);
    res.status(200).json(new ApiResponse(true, "Layout loaded", keys));
  });

  /** The panel reads this: every section, with its label and visibility. */
  getLayout = asyncHandler(async (req: Request, res: Response) => {
    const layout = await getLayout(req.params.page as string);
    res.status(200).json(new ApiResponse(true, "Layout loaded", layout));
  });

  saveLayout = asyncHandler(async (req: Request, res: Response) => {
    const layout = await saveLayout(
      req.params.page as string,
      req.body.sections,
    );
    res.status(200).json(new ApiResponse(true, "Layout saved", layout));
  });

  // ---- Public ----

  getPublic = asyncHandler(async (req: Request, res: Response) => {
    const values = await pageContentService.getPublic(req.params.page as string);

    res
      .status(200)
      .json(new ApiResponse(true, PAGE_CONTENT_MESSAGES.FETCHED, values));
  });

  // ---- Admin ----

  listPages = asyncHandler(async (_req: Request, res: Response) => {
    res
      .status(200)
      .json(
        new ApiResponse(
          true,
          PAGE_CONTENT_MESSAGES.FETCHED,
          pageContentService.listPages(),
        ),
      );
  });

  getAdmin = asyncHandler(async (req: Request, res: Response) => {
    const page = await pageContentService.getAdmin(req.params.page as string);

    res
      .status(200)
      .json(new ApiResponse(true, PAGE_CONTENT_MESSAGES.FETCHED, page));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const page = await pageContentService.update(
      req.params.page as string,
      req.body.values,
    );

    res
      .status(200)
      .json(new ApiResponse(true, PAGE_CONTENT_MESSAGES.UPDATED, page));
  });
}

export default new PageContentController();
