import { Router } from "express";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { requireAdmin } from "../../middleware/authorize.middleware.js";

import collectionController from "./collection.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { uploadCollectionImages } from "../../middleware/upload.middleware.js";
import {
  createCollectionSchema,
  reorderCollectionsSchema,
  updateCollectionSchema,
} from "./collection.validation.js";

// ---------------------------------------------------------------------------
// Public routes -> mounted at /api/v1/collections
// Used by the client website (Collections listing + Collection detail page)
// Supports ?brandId=&category=&featured= filters
// ---------------------------------------------------------------------------
const publicRouter = Router();

publicRouter.get("/", collectionController.listPublic);
publicRouter.get("/:slug", collectionController.getPublicBySlug);

// ---------------------------------------------------------------------------
// Admin routes -> mounted at /api/v1/admin/collections
// Everything below requires a valid logged-in session
// ---------------------------------------------------------------------------
const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.get("/", collectionController.listAdmin);
adminRouter.get("/:id", requirePermission("collections", "view"), collectionController.getById);

adminRouter.post(
  "/",
  requirePermission("collections", "create"),
  uploadCollectionImages,
  validate(createCollectionSchema),
  collectionController.create,
);

adminRouter.put(
  "/:id",
  requirePermission("collections", "edit"),
  uploadCollectionImages,
  validate(updateCollectionSchema),
  collectionController.update,
);

adminRouter.patch(
  "/reorder",
  requirePermission("collections", "edit"),
  validate(reorderCollectionsSchema),
  collectionController.reorder,
);

adminRouter.patch("/:id/status", requirePermission("collections", "edit"), collectionController.toggleStatus);
adminRouter.patch("/:id/featured", requirePermission("collections", "edit"), collectionController.toggleFeatured);
adminRouter.patch("/:id/images/:imageId/thumbnail", requirePermission("collections", "edit"), collectionController.setThumbnail);

// Deletes are administrator-only. requireAuth above proves WHO is calling;
// it says nothing about what they are allowed to destroy, and a collection
// takes its images and its public page with it.
adminRouter.delete(
  "/:id/images/:imageId",
  requirePermission("collections", "delete"),
  requireAdmin,
  collectionController.deleteImage,
);
adminRouter.delete("/:id", requirePermission("collections", "delete"), requireAdmin, collectionController.remove);

export { adminRouter as collectionAdminRoutes };
export default publicRouter;
