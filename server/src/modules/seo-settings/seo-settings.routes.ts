import { Router } from "express";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { requireAdmin } from "../../middleware/authorize.middleware.js";

import seoSettingsController from "./seo-settings.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
// import { validate } from "../../middleware/validate.middleware.js";
// import { updateSeoSettingsSchema } from "./seo-settings.validation.js";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("seo", "view"), seoSettingsController.get);

router.patch(
  "/",
  requirePermission("seo", "edit"), requireAdmin,
  // validate(updateSeoSettingsSchema),
  seoSettingsController.update,
);

export default router;
