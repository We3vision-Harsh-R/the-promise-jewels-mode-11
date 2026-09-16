import { Router } from "express";
import { requirePermission } from "../../middleware/permission.middleware.js";
import { requireAdmin } from "../../middleware/authorize.middleware.js";

import seoController from "./seo.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
// import { validate } from "../../middlewares/validate.middleware.js";
// import {
//   updateSeoSchema,
// } from "./seo.validation.js";

const router = Router();

router.use(authenticate);

router.get("/", seoController.getAll);

router.get("/:id", seoController.getById);

router.patch(
  "/:id",
  requirePermission("seo", "edit"), requireAdmin,
  // validate(updateSeoSchema),
  seoController.update,
);

export default router;
