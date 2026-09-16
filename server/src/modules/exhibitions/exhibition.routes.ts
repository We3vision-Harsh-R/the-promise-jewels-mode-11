import { Router } from "express";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { requireAdmin } from "../../middleware/authorize.middleware.js";

import { exhibitionController } from "./exhibition.controller.js";

import { asyncHandler } from "../../utils/asyncHandler.js";

import { validate } from "../../middleware/validation.middleware.js";

import { requireAuth } from "../../middleware/auth.middleware.js";

import {
  createExhibitionSchema,
  updateExhibitionSchema,
  searchExhibitionSchema,
  exhibitionIdSchema,
  exhibitionSlugSchema,
} from "./exhibition.validation.js";

import { uploadImage } from "../../middleware/upload.middleware.js";
const router = Router();


// =====================================================
// ADMIN ROUTES
// =====================================================


// Create Exhibition
router.post(
  "/",
  requireAuth,
  requirePermission("exhibitions", "create"),
  validate(createExhibitionSchema, "body"),
  asyncHandler(exhibitionController.create),
);

router.patch(
  "/:id",
  requireAuth,
  requirePermission("exhibitions", "edit"),
  validate(exhibitionIdSchema, "params"),
  validate(updateExhibitionSchema, "body"),
  asyncHandler(
    exhibitionController.update,
  ),
);

// Delete Exhibition
router.delete(
  "/:id",
  requirePermission("exhibitions", "delete"), requireAdmin,
  requireAuth,
  validate(exhibitionIdSchema,"params"),
  asyncHandler(
    exhibitionController.remove,
  ),
);

// =====================================================
// PUBLIC ROUTES
// =====================================================

// Get All Exhibitions
router.get(
  "/",
  asyncHandler(
    exhibitionController.findAll,
  ),
);

// Search Exhibition
router.get(
  "/search",
  validate(searchExhibitionSchema, "query"),
  asyncHandler(
    exhibitionController.search,
  ),
);

// Get Single Exhibition By Slug
router.get(
  "/:slug",
  // "params", not the default "body". A GET has no body, so validating this
  // against it made the route answer 400 "expected object, received undefined"
  // for every request — it had never returned a show.
  validate(exhibitionSlugSchema, "params"),
  asyncHandler(
    exhibitionController.findOne,
  ),
);
router.post(
  "/:id/gallery",
 requireAuth,
 requirePermission("exhibitions", "edit"),
 uploadImage,
 asyncHandler(
   exhibitionController.uploadGalleryImage
 )
);

router.post(
  "/:id/thumbnail",
 requireAuth,
 requirePermission("exhibitions", "edit"),
 uploadImage,
 asyncHandler(
   exhibitionController.uploadThumbnail
 )
);

router.get(
 "/:id/gallery",
 asyncHandler(
   exhibitionController.getGallery
 )
);


router.delete(
  "/gallery/:imageId",
 requirePermission("exhibitions", "delete"), requireAdmin,
 requireAuth,
 asyncHandler(
   exhibitionController.deleteGalleryImage
 )
);

export default router;