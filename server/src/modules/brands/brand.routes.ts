import { Router } from "express";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { requireAdmin } from "../../middleware/authorize.middleware.js";

import brandController from "./brand.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { uploadBrandImages } from "../../middleware/upload.middleware.js";
import {
  createBrandSchema,
  reorderBrandsSchema,
  updateBrandSchema,
} from "./brand.validation.js";

// ---------------------------------------------------------------------------
// Public routes -> mounted at /api/v1/brands
// Used by the client website (Brands listing + Brand detail page)
// ---------------------------------------------------------------------------
const publicRouter = Router();

publicRouter.get("/", brandController.listPublic);
publicRouter.get("/:slug", brandController.getPublicBySlug);

// ---------------------------------------------------------------------------
// Admin routes -> mounted at /api/v1/admin/brands
// Everything below requires a valid logged-in session
// ---------------------------------------------------------------------------
const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.get("/", brandController.listAdmin);
adminRouter.get("/options", requirePermission("brands", "view"), brandController.listOptions);
adminRouter.get("/:id", requirePermission("brands", "view"), brandController.getById);

adminRouter.post(
  "/",
  requirePermission("brands", "create"),
  uploadBrandImages,
  validate(createBrandSchema),
  brandController.create,
);

adminRouter.put(
  "/:id",
  requirePermission("brands", "edit"),
  uploadBrandImages,
  validate(updateBrandSchema),
  brandController.update,
);

adminRouter.patch(
  "/reorder",
  requirePermission("brands", "edit"),
  validate(reorderBrandsSchema),
  brandController.reorder,
);

adminRouter.patch("/:id/status", requirePermission("brands", "edit"), brandController.toggleStatus);

// Administrator-only, for the same reason as the collection deletes: being
// signed in is not the same as being allowed to remove a brand and every
// image and page hanging off it.
adminRouter.delete(
  "/:id/images/:imageId",
  requirePermission("brands", "delete"),
  requireAdmin,
  brandController.deleteImage,
);
adminRouter.delete("/:id", requirePermission("brands", "delete"), requireAdmin, brandController.remove);

export { adminRouter as brandAdminRoutes };
export default publicRouter;
