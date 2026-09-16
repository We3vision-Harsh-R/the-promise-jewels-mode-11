import { Request, Response } from "express";

import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as customSections from "./custom-section.service.js";
import { BLOCK_TYPES, SECTION_WIDTHS } from "./custom-section.types.js";
import {
  BRAND_PALETTE,
  FONT_FAMILIES,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHTS,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  CONTENT_PAGES,
} from "./page-content.constants.js";

class CustomSectionController {
  /**
   * Everything the designer screen needs to offer choices.
   *
   * Sent from the server for the same reason the Editor's palette is: the
   * lists here are the ones the validator will accept, so a panel that built
   * its own copy could offer a font that is refused on save.
   */
  options = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(
      new ApiResponse(true, "Options loaded", {
        blockTypes: BLOCK_TYPES,
        widths: SECTION_WIDTHS,
        palette: BRAND_PALETTE,
        fonts: FONT_FAMILIES,
        weights: FONT_WEIGHTS,
        limits: {
          fontSize: { min: FONT_SIZE_MIN, max: FONT_SIZE_MAX },
          spacing: { min: LETTER_SPACING_MIN, max: LETTER_SPACING_MAX },
        },
        // Only the pages that render from their arrangement can hold one, so
        // the "which page" picker offers exactly those.
        pages: CONTENT_PAGES.filter((page) => page.arrangeable).map((page) => ({
          key: page.key,
          label: page.label,
          path: page.path,
        })),
      }),
    );
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const sections = await customSections.listForPage(req.params.page as string);
    res.status(200).json(new ApiResponse(true, "Sections loaded", sections));
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const section = await customSections.getById(req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Section loaded", section));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const section = await customSections.create(req.body);
    res.status(201).json(new ApiResponse(true, "Section created", section));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const section = await customSections.update(req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(true, "Section saved", section));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await customSections.remove(req.params.id as string);
    res.status(200).json(new ApiResponse(true, "Section removed", null));
  });
}

export default new CustomSectionController();
