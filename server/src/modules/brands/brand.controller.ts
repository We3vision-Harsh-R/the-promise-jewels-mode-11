import { Request, Response } from "express";

import brandService from "./brand.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { BRAND_MESSAGES } from "./brand.constants.js";

type MulterFiles = { [fieldname: string]: Express.Multer.File[] };

class BrandController {
  // ---- Public ----

  listPublic = asyncHandler(async (_req: Request, res: Response) => {
    const brands = await brandService.listPublic();
    res.status(200).json(new ApiResponse(true, BRAND_MESSAGES.FETCHED, brands));
  });

  getPublicBySlug = asyncHandler(async (req: Request, res: Response) => {
    const brand = await brandService.getPublicBySlug(req.params.slug as string);
    res.status(200).json(new ApiResponse(true, BRAND_MESSAGES.FETCHED, brand));
  });

  // ---- Admin ----

listAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { search, isActive, page, limit } = req.query;

    const result = await brandService.listAdmin({
      search: search as string | undefined,
      isActive: isActive === undefined ? undefined : isActive === "true",
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json(new ApiResponse(true, BRAND_MESSAGES.FETCHED, result));
  });
  
  listOptions = asyncHandler(async (_req: Request, res: Response) => {
    const options = await brandService.listOptions();
    res.status(200).json(new ApiResponse(true, BRAND_MESSAGES.FETCHED, options));
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const brand = await brandService.getById(req.params.id as string);
    res.status(200).json(new ApiResponse(true, BRAND_MESSAGES.FETCHED, brand));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const brand = await brandService.create(
      req.body,
      req.files as MulterFiles,
      req.user!.id,
    );
    res.status(201).json(new ApiResponse(true, BRAND_MESSAGES.CREATED, brand));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const brand = await brandService.update(
      req.params.id as string,
      req.body,
      req.files as MulterFiles,
    );
    res.status(200).json(new ApiResponse(true, BRAND_MESSAGES.UPDATED, brand));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const result = await brandService.remove(req.params.id as string);
    res.status(200).json(new ApiResponse(true, BRAND_MESSAGES.DELETED, result));
  });

  toggleStatus = asyncHandler(async (req: Request, res: Response) => {
    const brand = await brandService.toggleStatus(req.params.id as string);
    res.status(200).json(new ApiResponse(true, BRAND_MESSAGES.STATUS_UPDATED, brand));
  });

  reorder = asyncHandler(async (req: Request, res: Response) => {
    const result = await brandService.reorder(req.body.items);
    res.status(200).json(new ApiResponse(true, BRAND_MESSAGES.REORDERED, result));
  });

  deleteImage = asyncHandler(async (req: Request, res: Response) => {
    const result = await brandService.deleteImage(req.params.id as string, req.params.imageId as string);
    res.status(200).json(new ApiResponse(true, BRAND_MESSAGES.IMAGE_DELETED, result));
  });
}

export default new BrandController();
