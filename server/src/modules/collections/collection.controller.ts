import { Request, Response } from "express";

import collectionService from "./collection.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { COLLECTION_MESSAGES } from "./collection.constants.js";

type MulterFiles = { [fieldname: string]: Express.Multer.File[] };

class CollectionController {
  // ---- Public ----

  listPublic = asyncHandler(async (req: Request, res: Response) => {
    const { brandId, category, featured } = req.query;

    const collections = await collectionService.listPublic({
      brandId: brandId as string | undefined,
      category: category as string | undefined,
      featured: featured as string | undefined,
    });

    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.FETCHED, collections));
  });

  getPublicBySlug = asyncHandler(async (req: Request, res: Response) => {
    const collection = await collectionService.getPublicBySlug(req.params.slug as string);
    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.FETCHED, collection));
  });

  // ---- Admin ----

listAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { search, brandId, isActive, page, limit } = req.query;

    const result = await collectionService.listAdmin({
      search: search as string | undefined,
      brandId: brandId as string | undefined,
      isActive: isActive === undefined ? undefined : isActive === "true",
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.FETCHED, result));
  });
  
  getById = asyncHandler(async (req: Request, res: Response) => {
    const collection = await collectionService.getById(req.params.id as string);
    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.FETCHED, collection));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const collection = await collectionService.create(
      req.body,
      req.files as MulterFiles,
      req.user!.id,
    );
    res.status(201).json(new ApiResponse(true, COLLECTION_MESSAGES.CREATED, collection));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const collection = await collectionService.update(
      req.params.id as string,
      req.body,
      req.files as MulterFiles,
    );
    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.UPDATED, collection));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const result = await collectionService.remove(req.params.id as string);
    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.DELETED, result));
  });

  toggleStatus = asyncHandler(async (req: Request, res: Response) => {
    const collection = await collectionService.toggleStatus(req.params.id as string);
    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.STATUS_UPDATED, collection));
  });

  toggleFeatured = asyncHandler(async (req: Request, res: Response) => {
    const collection = await collectionService.toggleFeatured(req.params.id as string);
    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.FEATURED_UPDATED, collection));
  });

  reorder = asyncHandler(async (req: Request, res: Response) => {
    const result = await collectionService.reorder(req.body.items);
    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.REORDERED, result));
  });

  deleteImage = asyncHandler(async (req: Request, res: Response) => {
    const result = await collectionService.deleteImage(req.params.id as string, req.params.imageId as string);
    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.IMAGE_DELETED, result));
  });

  setThumbnail = asyncHandler(async (req: Request, res: Response) => {
    const result = await collectionService.setThumbnail(req.params.id as string, req.params.imageId as string);
    res.status(200).json(new ApiResponse(true, COLLECTION_MESSAGES.THUMBNAIL_UPDATED, result));
  });
}

export default new CollectionController();
